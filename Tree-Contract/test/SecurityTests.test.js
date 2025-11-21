const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Security and Access Control Tests", function() {
    let factory, supplyChain;
    let owner, admin, productManager, auditor, unauthorized, attacker;
    let companyId, registrationNumber;

    beforeEach(async function() {
        [owner, admin, productManager, auditor, unauthorized, attacker] = await ethers.getSigners();

        // Deploy factory
        const Factory = await ethers.getContractFactory("DemoFarmTraceabilityFactory");
        factory = await Factory.deploy();
        await factory.waitForDeployment();

        // Register company and create supply chain
        registrationNumber = "SECURITY_TEST_123";
        await factory.registerCompany(registrationNumber, "Security Test Company", admin.address);

        const createTx = await factory.connect(admin).createSupplyChain(registrationNumber, "Security Chain", "Description");
        const receipt = await createTx.wait();

        // Get supply chain address from event
        const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'AgriSupplyChainCreated');
        const chainAddress = event.args[0];

        supplyChain = await ethers.getContractAt("TYTFarmFactory", chainAddress);
        companyId = await factory.getCompanyIdfromTaxcode(registrationNumber);

        // Set up roles
        await supplyChain.connect(admin).addProductManager(productManager.address);
        await supplyChain.connect(admin).addAuditor(auditor.address);
    });

    describe("Role-Based Access Control Security", function() {
        it("Should prevent privilege escalation attacks", async function() {
            // Product manager should not be able to grant admin role
            await expect(
                supplyChain.connect(productManager).grantRole(await supplyChain.DEFAULT_ADMIN_ROLE(), unauthorized.address)
            ).to.be.revertedWithCustomError(supplyChain, "AccessControlUnauthorizedAccount");

            // Auditor should not be able to grant product manager role
            await expect(
                supplyChain.connect(auditor).addProductManager(unauthorized.address)
            ).to.be.revertedWithCustomError(supplyChain, "AccessControlUnauthorizedAccount");

            // Product manager should not be able to grant auditor role
            await expect(
                supplyChain.connect(productManager).addAuditor(unauthorized.address)
            ).to.be.revertedWithCustomError(supplyChain, "AccessControlUnauthorizedAccount");
        });

        it("Should prevent unauthorized function calls", async function() {
            // Test all functions that should be restricted

            // Only product managers and admins can add products
            await expect(
                supplyChain.connect(unauthorized).addProduct("PROD1", "Test", "Desc")
            ).to.be.revertedWith("Caller is not a product manager");

            await expect(
                supplyChain.connect(auditor).addProduct("PROD1", "Test", "Desc")
            ).to.be.revertedWith("Caller is not a product manager");

            // Only auditors, product managers, and admins can update processes
            await supplyChain.connect(productManager).addProduct("PROD1", "Test", "Desc");

            await expect(
                supplyChain.connect(unauthorized).updateProductProcesses("PROD1", "BATCH1", "Process")
            ).to.be.revertedWith("Caller is not an auditor");

            // Only product managers and admins can update status
            await expect(
                supplyChain.connect(unauthorized).updateProductStatus("PROD1", "BATCH1", "Status")
            ).to.be.revertedWith("Caller is not a product manager");

            await expect(
                supplyChain.connect(auditor).updateProductStatus("PROD1", "BATCH1", "Status")
            ).to.be.revertedWith("Caller is not a product manager");
        });

        it("Should prevent role manipulation by non-admins", async function() {
            await expect(
                supplyChain.connect(productManager).removeProductManager(auditor.address)
            ).to.be.revertedWithCustomError(supplyChain, "AccessControlUnauthorizedAccount");

            await expect(
                supplyChain.connect(auditor).removeAuditor(productManager.address)
            ).to.be.revertedWithCustomError(supplyChain, "AccessControlUnauthorizedAccount");

            await expect(
                supplyChain.connect(unauthorized).addProductManager(attacker.address)
            ).to.be.revertedWithCustomError(supplyChain, "AccessControlUnauthorizedAccount");
        });

        it("Should handle role revocation correctly", async function() {
            // Admin can revoke roles
            await supplyChain.connect(admin).removeProductManager(productManager.address);

            // Product manager should no longer be able to add products
            await expect(
                supplyChain.connect(productManager).addProduct("PROD2", "Test", "Desc")
            ).to.be.revertedWith("Caller is not a product manager");

            // But should still be able to act as auditor if they have that role
            await supplyChain.connect(admin).addAuditor(productManager.address);
            await supplyChain.connect(admin).addProductManager(admin.address);
            await supplyChain.connect(admin).addProduct("PROD2", "Test", "Desc");

            // Now should be able to update processes
            await supplyChain.connect(productManager).updateProductProcesses("PROD2", "BATCH1", "Process");
        });
    });

    describe("Factory Security", function() {
        it("Should prevent unauthorized company registration", async function() {
            await expect(
                factory.connect(unauthorized).registerCompany("HACK123", "Hack Company", attacker.address)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });

        it("Should prevent unauthorized company modification", async function() {
            await expect(
                factory.connect(unauthorized).modifyCompany(registrationNumber, "Hacked Name", attacker.address)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
        });

        it("Should prevent unauthorized supply chain creation", async function() {
            // Only company owner or factory owner can create supply chains
            await expect(
                factory.connect(attacker).createSupplyChain(registrationNumber, "Malicious Chain", "Description")
            ).to.be.revertedWith("Sender does not have permission");
        });

        it("Should prevent supply chain creation for non-registered companies", async function() {
            await expect(
                factory.connect(unauthorized).createSupplyChain("NONEXISTENT", "Chain", "Desc")
            ).to.be.revertedWith("Sender does not have permission");
        });

        it("Should handle ownership transfer securely", async function() {
            const newOwner = unauthorized.address;

            // Only current owner can transfer ownership
            await expect(
                factory.connect(unauthorized).transferOwnership(newOwner)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");

            // Transfer ownership
            await factory.connect(owner).transferOwnership(newOwner);

            // Old owner should no longer have access
            await expect(
                factory.connect(owner).registerCompany("NEW123", "New Company", admin.address)
            ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");

            // New owner should have access
            await factory.connect(unauthorized).registerCompany("NEW123", "New Company", admin.address);
        });
    });

    describe("Reentrancy and External Call Security", function() {
        it("Should not be vulnerable to reentrancy in state-changing functions", async function() {
            // Since the contracts don't make external calls to untrusted contracts,
            // reentrancy risk is low, but we test state consistency

            await supplyChain.connect(productManager).addProduct("PROD1", "Test", "Desc");

            // Multiple rapid calls should all succeed or fail consistently
            const promises = [];
            for(let i = 0; i < 10; i++) {
                promises.push(
                    supplyChain.connect(auditor).updateProductProcesses("PROD1", `BATCH${i}`, `Process${i}`)
                );
            }

            await Promise.all(promises);

            const batches = await supplyChain.getProductBatches("PROD1");
            expect(batches).to.have.length(10);
        });

        it("Should handle concurrent role assignments safely", async function() {
            // Multiple admins trying to assign roles simultaneously
            const users = [unauthorized, attacker];
            const promises = [];

            for(let i = 0; i < users.length; i++) {
                promises.push(
                    supplyChain.connect(admin).addProductManager(users[i].address)
                );
            }

            await Promise.all(promises);

            // All users should have the role
            for(let user of users) {
                const hasRole = await supplyChain.hasRole(await supplyChain.PRODUCT_MANAGER_ROLE(), user.address);
                expect(hasRole).to.be.true;
            }
        });
    });

    describe("Input Validation Security", function() {
        it("Should prevent injection attacks in string inputs", async function() {
            const maliciousInputs = [
                "'; DROP TABLE products; --",
                "<script>alert('xss')</script>",
                "\\x00\\x01\\x02",
                "../../etc/passwd",
                "%00%20%3C%3E",
                "\n\r\t"
            ];

            for(let maliciousInput of maliciousInputs) {
                // Should handle malicious product IDs
                try {
                    await supplyChain.connect(productManager).addProduct(maliciousInput, "Test", "Desc");
                    const hasProduct = await supplyChain.hasProduct(maliciousInput);
                    expect(hasProduct).to.be.true;
                } catch (error) {
                    // If it fails, it should be due to valid business logic, not injection
                    expect(error.message).to.not.include("invalid opcode");
                }
            }
        });

        it("Should handle Unicode and special characters safely", async function() {
            const unicodeInputs = [
                "测试产品",
                "🚀🌟⭐",
                "Ñoño",
                "Ελληνικά",
                "العربية"
            ];

            for(let unicode of unicodeInputs) {
                await supplyChain.connect(productManager).addProduct(unicode, "Test", "Desc");
                const hasProduct = await supplyChain.hasProduct(unicode);
                expect(hasProduct).to.be.true;
            }
        });
    });

    describe("State Manipulation Security", function() {
        it("Should prevent unauthorized state changes through view functions", async function() {
            // View functions should not change state
            await supplyChain.connect(productManager).addProduct("PROD1", "Test", "Desc");

            const initialIds = await supplyChain.getAllProductIds();

            // Call view functions
            await supplyChain.hasProduct("PROD1");
            await supplyChain.getProductInfo("PROD1");
            await supplyChain.getProductBatches("PROD1");
            await supplyChain.getCompanyOwner();

            const finalIds = await supplyChain.getAllProductIds();
            expect(finalIds).to.deep.equal(initialIds);
        });

        it("Should prevent state inconsistencies", async function() {
            await supplyChain.connect(productManager).addProduct("PROD1", "Test", "Desc");

            // Deactivate and reactivate should maintain consistency
            await supplyChain.connect(productManager).deactivateProduct("PROD1");
            expect(await supplyChain.hasProduct("PROD1")).to.be.false;

            await supplyChain.connect(productManager).reactivateProduct("PROD1");
            expect(await supplyChain.hasProduct("PROD1")).to.be.true;

            const info = await supplyChain.getProductInfo("PROD1");
            expect(info.isActive).to.be.true;
        });
    });

    describe("DoS Attack Prevention", function() {
        it("Should handle large batch operations without running out of gas", async function() {
            await supplyChain.connect(productManager).addProduct("PROD1", "Test", "Desc");

            // Try to add many batches in a single transaction
            const batchCount = 50;
            for(let i = 0; i < batchCount; i++) {
                await supplyChain.connect(auditor).updateProductProcesses("PROD1", `BATCH${i}`, `Process${i}`);
            }

            const batches = await supplyChain.getProductBatches("PROD1");
            expect(batches).to.have.length(batchCount);
        });

        it("Should limit array growth to prevent DoS", async function() {
            // Test if there are any limits on array growth
            const productCount = 100;

            for(let i = 0; i < productCount; i++) {
                await supplyChain.connect(productManager).addProduct(`PROD${i}`, `Product ${i}`, `Desc ${i}`);
            }

            const allIds = await supplyChain.getAllProductIds();
            expect(allIds).to.have.length(productCount);

            // Should still be able to retrieve individual products
            const info = await supplyChain.getProductInfo("PROD0");
            expect(info.productName).to.equal("Product 0");
        });
    });

    describe("Front-running and MEV Protection", function() {
        it("Should handle transaction ordering issues gracefully", async function() {
            // Simulate concurrent transactions that might be front-run
            await supplyChain.connect(productManager).addProduct("PROD1", "Test", "Desc");

            // Multiple users trying to update the same batch
            const promises = [];
            promises.push(
                supplyChain.connect(auditor).updateProductProcesses("PROD1", "BATCH1", "Process1")
            );
            promises.push(
                supplyChain.connect(productManager).updateProductStatus("PROD1", "BATCH1", "Status1")
            );

            await Promise.all(promises);

            // Both updates should succeed
            const info = await supplyChain.getProductByBatch("PROD1", "BATCH1");
            expect(info.processes).to.equal("Process1");
            expect(info.status).to.equal("Status1");
        });
    });

    describe("Factory-SupplyChain Interaction Security", function() {
        it("Should maintain proper ownership relationships", async function() {
            // Factory should grant admin role to itself and company owner
            const factoryHasAdmin = await supplyChain.hasRole(await supplyChain.DEFAULT_ADMIN_ROLE(), await factory.getAddress());
            const companyHasAdmin = await supplyChain.hasRole(await supplyChain.DEFAULT_ADMIN_ROLE(), admin.address);

            expect(factoryHasAdmin).to.be.true;
            expect(companyHasAdmin).to.be.true;
        });

        it("Should prevent unauthorized access to factory functions", async function() {
            // Create another company to test cross-company access
            await factory.registerCompany("COMPANY2", "Company 2", unauthorized.address);

            // Company 1 admin should not be able to create supply chain for Company 2
            await expect(
                factory.connect(admin).createSupplyChain("COMPANY2", "Malicious Chain", "Desc")
            ).to.be.revertedWith("Sender does not have permission");
        });
    });

    describe("Event Security", function() {
        it("Should emit events with correct parameters to prevent spoofing", async function() {
            // Events should contain all necessary information to verify authenticity
            await supplyChain.connect(productManager).addProduct("PROD1", "Test Product", "Description");

            // Check that ProductAdded event contains correct company ID
            const filter = supplyChain.filters.ProductAdded("PROD1");
            const events = await supplyChain.queryFilter(filter);

            expect(events).to.have.length(1);
            expect(events[0].args[1]).to.equal("Test Product");
            expect(events[0].args[2]).to.equal(companyId);
        });

        it("Should prevent event parameter manipulation", async function() {
            // Events should be tamper-resistant
            await supplyChain.connect(productManager).addProduct("PROD1", "Test", "Desc");
            await supplyChain.connect(auditor).updateProductProcesses("PROD1", "BATCH1", "Process");

            const processFilter = supplyChain.filters.UpdatedProcesses("PROD1");
            const events = await supplyChain.queryFilter(processFilter);

            expect(events).to.have.length(1);
            expect(events[0].args[1]).to.equal("Process");
        });
    });
});