const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Edge Case and Security Tests", function() {
    let factory, supplyChain;
    let owner, user1, user2, user3, nonAuthorized;
    let companyId, registrationNumber;

    beforeEach(async function() {
        [owner, user1, user2, user3, nonAuthorized] = await ethers.getSigners();

        // Deploy factory
        const Factory = await ethers.getContractFactory("DemoFarmTraceabilityFactory");
        factory = await Factory.deploy();
        await factory.waitForDeployment();

        // Register company and create supply chain
        registrationNumber = "REG123456";
        const tx = await factory.registerCompany(registrationNumber, "Test Company", user1.address);
        await tx.wait();

        const createTx = await factory.connect(user1).createSupplyChain(registrationNumber, "Test Chain", "Description");
        const receipt = await createTx.wait();

        // Get supply chain address from event
        const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'AgriSupplyChainCreated');
        const chainAddress = event.args[0];

        supplyChain = await ethers.getContractAt("TYTFarmFactory", chainAddress);
        companyId = await factory.getCompanyIdfromTaxcode(registrationNumber);
    });

    describe("Input Validation Edge Cases", function() {
        it("Should reject empty product ID", async function() {
            await expect(
                supplyChain.connect(user1).addProduct("", "Test Product", "Description")
            ).to.be.revertedWith("Product ID cannot be empty");
        });

        it("Should reject empty batch ID in updateProductProcesses", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test Product", "Description");

            await expect(
                supplyChain.connect(user1).updateProductProcesses("PROD1", "", "New processes")
            ).to.be.revertedWith("Batch ID cannot be empty");
        });

        it("Should reject empty batch ID in updateProductStatus", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test Product", "Description");

            await expect(
                supplyChain.connect(user1).updateProductStatus("PROD1", "", "New status")
            ).to.be.revertedWith("Batch ID cannot be empty");
        });

        it("Should reject zero address in company registration", async function() {
            await expect(
                factory.registerCompany("REG999", "Test", ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid wallet address");
        });

        it("Should reject empty registration number", async function() {
            await expect(
                factory.registerCompany("", "Test Company", user2.address)
            ).to.be.revertedWith("Registration number cannot be empty");
        });

        it("Should reject empty company name", async function() {
            await expect(
                factory.registerCompany("REG999", "", user2.address)
            ).to.be.revertedWith("Company name cannot be empty");
        });
    });

    describe("Extremely Long String Input Tests", function() {
        it("Should handle very long product ID (gas limit test)", async function() {
            const longProductId = "A".repeat(1000); // 1KB string

            // This should either succeed or fail gracefully due to gas limits
            try {
                await supplyChain.connect(user1).addProduct(longProductId, "Test", "Desc");
                // If it succeeds, verify it's stored correctly
                const hasProduct = await supplyChain.hasProduct(longProductId);
                expect(hasProduct).to.be.true;
            } catch (error) {
                // Should fail due to gas limit, not a revert
                expect(error.message).to.not.include("revert");
            }
        });

        it("Should handle very long product name and description", async function() {
            const longName = "N".repeat(5000); // 5KB string
            const longDesc = "D".repeat(5000); // 5KB string

            try {
                await supplyChain.connect(user1).addProduct("PROD1", longName, longDesc);
                const info = await supplyChain.getProductInfo("PROD1");
                expect(info.productName).to.equal(longName);
            } catch (error) {
                // Should fail gracefully due to gas limits
                expect(error.message).to.not.include("revert");
            }
        });

        it("Should handle very long batch processes", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Desc");
            const longProcesses = "P".repeat(10000); // 10KB string

            try {
                await supplyChain.connect(user1).updateProductProcesses("PROD1", "BATCH1", longProcesses);
                const info = await supplyChain.getProductByBatch("PROD1", "BATCH1");
                expect(info.processes).to.equal(longProcesses);
            } catch (error) {
                expect(error.message).to.not.include("revert");
            }
        });
    });

    describe("Access Control Edge Cases", function() {
        it("Should prevent non-admin from granting roles", async function() {
            await expect(
                supplyChain.connect(nonAuthorized).addProductManager(user2.address)
            ).to.be.revertedWithCustomError(supplyChain, "AccessControlUnauthorizedAccount");
        });

        it("Should prevent product manager from granting auditor role", async function() {
            await supplyChain.connect(user1).addProductManager(user2.address);

            await expect(
                supplyChain.connect(user2).addAuditor(user3.address)
            ).to.be.revertedWithCustomError(supplyChain, "AccessControlUnauthorizedAccount");
        });

        it("Should prevent non-product-manager from adding products", async function() {
            await expect(
                supplyChain.connect(nonAuthorized).addProduct("PROD1", "Test", "Desc")
            ).to.be.revertedWith("Caller is not a product manager");
        });

        it("Should prevent non-auditor from updating processes", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Desc");

            await expect(
                supplyChain.connect(nonAuthorized).updateProductProcesses("PROD1", "BATCH1", "Process")
            ).to.be.revertedWith("Caller is not an auditor");
        });

        it("Should allow admin to perform all operations", async function() {
            // Admin can add products
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Desc");

            // Admin can update processes
            await supplyChain.connect(user1).updateProductProcesses("PROD1", "BATCH1", "Process");

            // Admin can update status
            await supplyChain.connect(user1).updateProductStatus("PROD1", "BATCH1", "Status");

            const info = await supplyChain.getProductByBatch("PROD1", "BATCH1");
            expect(info.processes).to.equal("Process");
            expect(info.status).to.equal("Status");
        });
    });

    describe("State Consistency Edge Cases", function() {
        it("Should prevent duplicate product registration", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Desc");

            await expect(
                supplyChain.connect(user1).addProduct("PROD1", "Another Product", "Another Desc")
            ).to.be.revertedWith("Product registed");
        });

        it("Should handle operations on non-existent product", async function() {
            await expect(
                supplyChain.getProductInfo("NONEXISTENT")
            ).to.be.revertedWith("Product not found");

            await expect(
                supplyChain.connect(user1).updateProductStatus("NONEXISTENT", "BATCH1", "Status")
            ).to.be.revertedWith("Product is not active or not found");
        });

        it("Should handle deactivated product operations", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Desc");
            await supplyChain.connect(user1).deactivateProduct("PROD1");

            // Should reject operations on deactivated product
            await expect(
                supplyChain.getProductInfo("PROD1")
            ).to.be.revertedWith("Product is not active");

            await expect(
                supplyChain.connect(user1).updateProductStatus("PROD1", "BATCH1", "Status")
            ).to.be.revertedWith("Product is not active or not found");
        });

        it("Should allow reactivation of deactivated product", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Desc");
            await supplyChain.connect(user1).deactivateProduct("PROD1");
            await supplyChain.connect(user1).reactivateProduct("PROD1");

            const hasProduct = await supplyChain.hasProduct("PROD1");
            expect(hasProduct).to.be.true;
        });

        it("Should prevent reactivation of non-existent product", async function() {
            await expect(
                supplyChain.connect(user1).reactivateProduct("NONEXISTENT")
            ).to.be.revertedWith("Product does not exist");
        });

        it("Should prevent reactivation of already active product", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Desc");

            await expect(
                supplyChain.connect(user1).reactivateProduct("PROD1")
            ).to.be.revertedWith("Product is already active");
        });
    });

    describe("Batch Tracking Edge Cases", function() {
        it("Should properly track new batches when updating processes", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Desc");

            // Add multiple batches
            await supplyChain.connect(user1).updateProductProcesses("PROD1", "BATCH1", "Process1");
            await supplyChain.connect(user1).updateProductProcesses("PROD1", "BATCH2", "Process2");
            await supplyChain.connect(user1).updateProductProcesses("PROD1", "BATCH3", "Process3");

            const batches = await supplyChain.getProductBatches("PROD1");
            expect(batches).to.have.length(3);
            expect(batches).to.include("BATCH1");
            expect(batches).to.include("BATCH2");
            expect(batches).to.include("BATCH3");
        });

        it("Should properly track new batches when updating status", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Desc");

            await supplyChain.connect(user1).updateProductStatus("PROD1", "BATCH1", "Status1");
            await supplyChain.connect(user1).updateProductStatus("PROD1", "BATCH2", "Status2");

            const batches = await supplyChain.getProductBatches("PROD1");
            expect(batches).to.have.length(2);
            expect(batches).to.include("BATCH1");
            expect(batches).to.include("BATCH2");
        });

        it("Should not duplicate batch tracking when updating existing batch", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Desc");

            // Add batch via processes
            await supplyChain.connect(user1).updateProductProcesses("PROD1", "BATCH1", "Process1");

            // Update same batch via status (should not duplicate)
            await supplyChain.connect(user1).updateProductStatus("PROD1", "BATCH1", "Status1");

            const batches = await supplyChain.getProductBatches("PROD1");
            expect(batches).to.have.length(1);
            expect(batches[0]).to.equal("BATCH1");
        });
    });

    describe("Factory Edge Cases", function() {
        it("Should prevent duplicate company registration", async function() {
            await expect(
                factory.registerCompany(registrationNumber, "Another Company", user2.address)
            ).to.be.revertedWith("Already registered");
        });

        it("Should prevent non-owner from registering companies", async function() {
            await expect(
                factory.connect(user2).registerCompany("REG999", "Test", user3.address)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });

        it("Should prevent unauthorized users from creating supply chains", async function() {
            await expect(
                factory.connect(nonAuthorized).createSupplyChain(registrationNumber, "Chain", "Desc")
            ).to.be.revertedWith("Sender does not have permission");
        });

        it("Should allow owner to create supply chain for any company", async function() {
            const tx = await factory.connect(owner).createSupplyChain(registrationNumber, "Owner Chain", "Desc");
            const receipt = await tx.wait();

            const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'AgriSupplyChainCreated');
            expect(event.args[1]).to.equal(owner.address); // owner is the creator
        });

        it("Should handle company modification correctly", async function() {
            await factory.modifyCompany(registrationNumber, "Modified Company", user2.address);

            const info = await factory.getCompanyInfo(registrationNumber);
            expect(info.name).to.equal("Modified Company");
            expect(info.wallet).to.equal(user2.address);
        });

        it("Should prevent modification of non-existent company", async function() {
            await expect(
                factory.modifyCompany("NONEXISTENT", "Test", user2.address)
            ).to.be.revertedWith("Company not registered");
        });

        it("Should handle company deactivation", async function() {
            await factory.deactiveCompany(registrationNumber);

            await expect(
                factory.getCompanyInfo(registrationNumber)
            ).to.be.revertedWith("Company is not registered");
        });
    });

    describe("Gas Limit and DoS Prevention", function() {
        it("Should handle multiple supply chain creation", async function() {
            // Create multiple supply chains to test gas limits
            for(let i = 0; i < 10; i++) {
                const tx = await factory.connect(user1).createSupplyChain(
                    registrationNumber,
                    `Chain ${i}`,
                    `Description ${i}`
                );
                await tx.wait();
            }

            const chains = await factory.getListAgriSupplyChain(registrationNumber);
            expect(chains).to.have.length(11); // 10 + 1 from beforeEach
        });

        it("Should handle multiple batch operations", async function() {
            await supplyChain.connect(user1).addProduct("PROD1", "Test", "Desc");

            // Add many batches to test gas limits
            for(let i = 0; i < 100; i++) {
                await supplyChain.connect(user1).updateProductProcesses("PROD1", `BATCH${i}`, `Process${i}`);
            }

            const batches = await supplyChain.getProductBatches("PROD1");
            expect(batches).to.have.length(100);
        });
    });

    describe("Role Management Edge Cases", function() {
        it("Should prevent adding zero address as product manager", async function() {
            await expect(
                supplyChain.connect(user1).addProductManager(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid user address");
        });

        it("Should prevent removing zero address as product manager", async function() {
            await expect(
                supplyChain.connect(user1).removeProductManager(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid user address");
        });

        it("Should prevent adding zero address as auditor", async function() {
            await expect(
                supplyChain.connect(user1).addAuditor(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid user address");
        });

        it("Should allow role removal even if user doesn't have the role", async function() {
            // This should not revert - OpenZeppelin AccessControl handles this gracefully
            await supplyChain.connect(user1).removeProductManager(user2.address);
            await supplyChain.connect(user1).removeAuditor(user2.address);
        });

        it("Should handle company owner update", async function() {
            await supplyChain.connect(user1).updateCompanyOwner(user2.address);

            const newOwner = await supplyChain.getCompanyOwner();
            expect(newOwner).to.equal(user2.address);
        });

        it("Should prevent updating to zero address owner", async function() {
            await expect(
                supplyChain.connect(user1).updateCompanyOwner(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid owner address");
        });
    });

    describe("Inconsistency in getListAgriSupplyChain", function() {
        it("Should correctly retrieve supply chains using stored company ID", async function() {
            // The function recalculates company ID instead of using stored mapping
            // This is a potential bug if implementation changes
            const chains1 = await factory.getListAgriSupplyChain(registrationNumber);
            expect(chains1).to.have.length(1);

            // Direct calculation should match
            const calculatedId = await factory.getCompanyIdfromTaxcode(registrationNumber);
            expect(calculatedId).to.equal(companyId);
        });
    });
});

// Helper function for testing events with timestamps
const anyValue = require("@nomicfoundation/hardhat-chai-matchers/withArgs");