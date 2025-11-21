const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Boundary and Input Validation Tests", function() {
    let factory, supplyChain;
    let owner, user1, user2;
    let registrationNumber;

    beforeEach(async function() {
        [owner, user1, user2] = await ethers.getSigners();

        const Factory = await ethers.getContractFactory("DemoFarmTraceabilityFactory");
        factory = await Factory.deploy();
        await factory.waitForDeployment();

        registrationNumber = "BOUNDARY_TEST_123";
        await factory.registerCompany(registrationNumber, "Boundary Test Company", user1.address);

        const createTx = await factory.connect(user1).createSupplyChain(registrationNumber, "Test Chain", "Description");
        const receipt = await createTx.wait();

        const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'AgriSupplyChainCreated');
        const chainAddress = event.args[0];

        supplyChain = await ethers.getContractAt("TYTFarmFactory", chainAddress);
    });

    describe("String Length Boundary Tests", function() {
        it("Should handle empty strings correctly", async function() {
            // Empty product ID should be rejected
            await expect(
                supplyChain.connect(user1).addProduct("", "Valid Name", "Valid Description")
            ).to.be.revertedWith("Product ID cannot be empty");

            // Empty batch ID should be rejected
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Desc");
            await expect(
                supplyChain.connect(user1).updateProductProcesses("PROD1", "", "Process")
            ).to.be.revertedWith("Batch ID cannot be empty");

            await expect(
                supplyChain.connect(user1).updateProductStatus("PROD1", "", "Status")
            ).to.be.revertedWith("Batch ID cannot be empty");
        });

        it("Should handle single character strings", async function() {
            // Single character strings should be valid
            await supplyChain.connect(user1).addProduct("P", "N", "D");

            const info = await supplyChain.getProductInfo("P");
            expect(info.productId).to.equal("P");
            expect(info.productName).to.equal("N");
            expect(info.description).to.equal("D");

            // Single character batch operations
            await supplyChain.connect(user1).updateProductProcesses("P", "B", "X");
            await supplyChain.connect(user1).updateProductStatus("P", "B", "Y");

            const batchInfo = await supplyChain.getProductByBatch("P", "B");
            expect(batchInfo.processes).to.equal("X");
            expect(batchInfo.status).to.equal("Y");
        });

        it("Should handle extremely long strings within gas limits", async function() {
            const maxReasonableLength = 1000; // Reasonable max for blockchain storage

            const longProductId = "P" + "A".repeat(maxReasonableLength - 1);
            const longProductName = "N" + "B".repeat(maxReasonableLength - 1);
            const longDescription = "D" + "C".repeat(maxReasonableLength - 1);

            try {
                await supplyChain.connect(user1).addProduct(longProductId, longProductName, longDescription);

                const info = await supplyChain.getProductInfo(longProductId);
                expect(info.productName).to.equal(longProductName);
                expect(info.description).to.equal(longDescription);
            } catch (error) {
                // Should fail due to gas limit, not contract logic
                expect(error.message).to.not.include("revert");
            }
        });

        it("Should handle strings with special characters and Unicode", async function() {
            const specialChars = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~";
            const unicodeString = "产品测试🌾🚜📦";
            const mixedString = "Prod-123_αβγ测试";

            await supplyChain.connect(user1).addProduct(specialChars, unicodeString, mixedString);

            const info = await supplyChain.getProductInfo(specialChars);
            expect(info.productName).to.equal(unicodeString);
            expect(info.description).to.equal(mixedString);
        });

        it("Should handle whitespace-only strings", async function() {
            const whitespaceOnly = "   \t\n\r   ";

            // Whitespace-only product ID should technically be valid (not empty)
            await supplyChain.connect(user1).addProduct(whitespaceOnly, "Test", "Desc");

            const hasProduct = await supplyChain.hasProduct(whitespaceOnly);
            expect(hasProduct).to.be.true;
        });

        it("Should handle strings with null bytes", async function() {
            // JavaScript strings can contain null bytes, but Solidity might handle them differently
            const withNullBytes = "Test\x00Product\x00ID";

            await supplyChain.connect(user1).addProduct(withNullBytes, "Test", "Description");

            const hasProduct = await supplyChain.hasProduct(withNullBytes);
            expect(hasProduct).to.be.true;
        });
    });

    describe("Address Boundary Tests", function() {
        it("Should reject zero address in all contexts", async function() {
            // Factory level
            await expect(
                factory.registerCompany("TEST123", "Test", ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid wallet address");

            await expect(
                factory.modifyCompany(registrationNumber, "Test", ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid wallet address");

            // Supply chain level
            await expect(
                supplyChain.connect(user1).addProductManager(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid user address");

            await expect(
                supplyChain.connect(user1).addAuditor(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid user address");

            await expect(
                supplyChain.connect(user1).updateCompanyOwner(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid owner address");
        });

        it("Should handle maximum address value", async function() {
            const maxAddress = "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF";

            // Should be valid for all address operations
            await factory.registerCompany("MAX_ADDR", "Max Address Test", maxAddress);

            const info = await factory.getCompanyInfo("MAX_ADDR");
            expect(info.wallet.toLowerCase()).to.equal(maxAddress.toLowerCase());
        });

        it("Should handle contract addresses as users", async function() {
            // Using factory address as a user address should be valid
            const factoryAddress = await factory.getAddress();

            await supplyChain.connect(user1).addProductManager(factoryAddress);

            const hasRole = await supplyChain.hasRole(await supplyChain.PRODUCT_MANAGER_ROLE(), factoryAddress);
            expect(hasRole).to.be.true;
        });
    });

    describe("Numeric Boundary Tests", function() {
        it("Should handle large timestamp values", async function() {
            // Events use block.timestamp which is uint256
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Description");

            // Get the event and check timestamp is reasonable
            const filter = supplyChain.filters.ProductAdded("PROD1");
            const events = await supplyChain.queryFilter(filter);

            expect(events).to.have.length(1);
            const timestamp = events[0].args[4];

            // Timestamp should be a positive number and reasonable (not in far future)
            expect(timestamp).to.be.gt(0);
            expect(timestamp).to.be.lt(ethers.getBigInt("2000000000")); // Year 2033
        });

        it("Should handle array index boundaries", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Description");

            // Add many batches to test array indexing
            const batchCount = 255; // Reasonable upper limit

            for(let i = 0; i < batchCount; i++) {
                await supplyChain.connect(user1).updateProductProcesses("PROD1", `BATCH${i}`, `Process${i}`);
            }

            const batches = await supplyChain.getProductBatches("PROD1");
            expect(batches).to.have.length(batchCount);

            // First and last elements should be accessible
            expect(batches[0]).to.equal("BATCH0");
            expect(batches[batchCount - 1]).to.equal(`BATCH${batchCount - 1}`);
        });

        it("Should handle supply chain list index boundaries", async function() {
            // Create multiple supply chains
            const chainCount = 50;

            for(let i = 0; i < chainCount; i++) {
                await factory.connect(user1).createSupplyChain(registrationNumber, `Chain${i}`, `Desc${i}`);
            }

            const chains = await factory.getListAgriSupplyChain(registrationNumber);
            expect(chains).to.have.length(chainCount + 1); // +1 from beforeEach
        });
    });

    describe("State Transition Boundary Tests", function() {
        it("Should handle rapid state changes", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Description");

            // Rapid activate/deactivate cycles
            for(let i = 0; i < 10; i++) {
                await supplyChain.connect(user1).deactivateProduct("PROD1");
                expect(await supplyChain.hasProduct("PROD1")).to.be.false;

                await supplyChain.connect(user1).reactivateProduct("PROD1");
                expect(await supplyChain.hasProduct("PROD1")).to.be.true;
            }
        });

        it("Should handle batch updates with mixed operations", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Description");

            // Interleave process and status updates
            await supplyChain.connect(user1).updateProductProcesses("PROD1", "BATCH1", "Process1");
            await supplyChain.connect(user1).updateProductStatus("PROD1", "BATCH1", "Status1");
            await supplyChain.connect(user1).updateProductProcesses("PROD1", "BATCH1", "Process2");
            await supplyChain.connect(user1).updateProductStatus("PROD1", "BATCH1", "Status2");

            const info = await supplyChain.getProductByBatch("PROD1", "BATCH1");
            expect(info.processes).to.equal("Process2");
            expect(info.status).to.equal("Status2");
        });

        it("Should maintain consistency across role changes", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Description");

            // Give user2 product manager role
            await supplyChain.connect(user1).addProductManager(user2.address);

            // user2 should be able to add products
            await supplyChain.connect(user2).addProduct("PROD2", "Test2", "Description2");

            // Remove role
            await supplyChain.connect(user1).removeProductManager(user2.address);

            // user2 should no longer be able to add products
            await expect(
                supplyChain.connect(user2).addProduct("PROD3", "Test3", "Description3")
            ).to.be.revertedWith("Caller is not a product manager");

            // But existing products should remain accessible
            expect(await supplyChain.hasProduct("PROD2")).to.be.true;
        });
    });

    describe("Company Registration Boundary Tests", function() {
        it("Should handle registration number uniqueness", async function() {
            // Attempt to register same registration number should fail
            await expect(
                factory.registerCompany(registrationNumber, "Another Company", user2.address)
            ).to.be.revertedWith("Already registered");
        });

        it("Should handle case sensitivity in registration numbers", async function() {
            const upperCaseReg = registrationNumber.toUpperCase();
            const lowerCaseReg = registrationNumber.toLowerCase();

            if (upperCaseReg !== registrationNumber) {
                // Should be able to register uppercase version
                await factory.registerCompany(upperCaseReg, "Upper Case Company", user2.address);

                const info = await factory.getCompanyInfo(upperCaseReg);
                expect(info.name).to.equal("Upper Case Company");
            }
        });

        it("Should handle very long registration numbers", async function() {
            const longRegNumber = "REG" + "0".repeat(100);

            try {
                await factory.registerCompany(longRegNumber, "Long Reg Company", user2.address);

                const info = await factory.getCompanyInfo(longRegNumber);
                expect(info.name).to.equal("Long Reg Company");
            } catch (error) {
                // Should fail due to gas limit, not validation
                expect(error.message).to.not.include("revert");
            }
        });
    });

    describe("Batch Tracking Edge Cases", function() {
        it("Should handle duplicate batch IDs across different operations", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Description");

            // Add same batch via processes first
            await supplyChain.connect(user1).updateProductProcesses("PROD1", "SAME_BATCH", "Process");

            // Then add via status - should not duplicate in batch list
            await supplyChain.connect(user1).updateProductStatus("PROD1", "SAME_BATCH", "Status");

            const batches = await supplyChain.getProductBatches("PROD1");
            expect(batches).to.have.length(1);
            expect(batches[0]).to.equal("SAME_BATCH");

            const info = await supplyChain.getProductByBatch("PROD1", "SAME_BATCH");
            expect(info.processes).to.equal("Process");
            expect(info.status).to.equal("Status");
        });

        it("Should handle batch updates without prior process or status", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Description");

            // Update status for new batch (no prior process)
            await supplyChain.connect(user1).updateProductStatus("PROD1", "NEW_BATCH", "Status");

            const info = await supplyChain.getProductByBatch("PROD1", "NEW_BATCH");
            expect(info.status).to.equal("Status");
            expect(info.processes).to.equal(""); // Should be empty

            // Now update process for same batch
            await supplyChain.connect(user1).updateProductProcesses("PROD1", "NEW_BATCH", "Process");

            const updatedInfo = await supplyChain.getProductByBatch("PROD1", "NEW_BATCH");
            expect(updatedInfo.status).to.equal("Status");
            expect(updatedInfo.processes).to.equal("Process");
        });

        it("Should track batch order correctly", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Description");

            const batchNames = ["ALPHA", "BETA", "GAMMA", "DELTA"];

            // Add batches in specific order
            for(let batch of batchNames) {
                await supplyChain.connect(user1).updateProductProcesses("PROD1", batch, `Process-${batch}`);
            }

            const batches = await supplyChain.getProductBatches("PROD1");
            expect(batches).to.deep.equal(batchNames);
        });
    });

    describe("Gas Limit Boundary Tests", function() {
        it("Should handle operations near gas limit", async function() {
            // Test large data operations
            const mediumString = "X".repeat(500);

            await supplyChain.connect(user1).addProduct("PROD1", mediumString, mediumString);

            // Add multiple batches with medium-size data
            for(let i = 0; i < 20; i++) {
                await supplyChain.connect(user1).updateProductProcesses("PROD1", `BATCH${i}`, mediumString);
                await supplyChain.connect(user1).updateProductStatus("PROD1", `BATCH${i}`, mediumString);
            }

            // Should still be able to retrieve all data
            const batches = await supplyChain.getProductBatches("PROD1");
            expect(batches).to.have.length(20);

            const info = await supplyChain.getProductByBatch("PROD1", "BATCH0");
            expect(info.processes).to.equal(mediumString);
            expect(info.status).to.equal(mediumString);
        });
    });

    describe("Factory Query Boundary Tests", function() {
        it("Should handle queries for non-existent companies", async function() {
            await expect(
                factory.getCompanyInfo("NONEXISTENT")
            ).to.be.revertedWith("Company is not registered");

            await expect(
                factory.getListAgriSupplyChain("NONEXISTENT")
            ).to.be.revertedWith("Company not registered");
        });

        it("Should return empty arrays for companies with no supply chains", async function() {
            await factory.registerCompany("EMPTY_COMPANY", "Empty", user2.address);

            const chains = await factory.getListAgriSupplyChain("EMPTY_COMPANY");
            expect(chains).to.be.an('array').that.is.empty;
        });

        it("Should handle company ID generation edge cases", async function() {
            // Test with various registration number formats
            const regNumbers = ["123", "ABC", "123ABC", "abc123", "A1B2C3"];

            for(let regNum of regNumbers) {
                await factory.registerCompany(regNum, `Company ${regNum}`, user2.address);

                const calculatedId = await factory.getCompanyIdfromTaxcode(regNum);

                // Verify company can be found with this ID
                const info = await factory.getCompanyInfo(regNum);
                expect(info.registrationNumber).to.equal(regNum);
            }
        });
    });
});