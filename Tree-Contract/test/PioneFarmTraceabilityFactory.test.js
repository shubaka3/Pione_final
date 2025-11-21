const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DemoFarmTraceabilityFactory", function () {
  let factory, owner, addr1, addr2, addr3;
  const registrationNumber = "REG123";
  const companyName = "Test Company";

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DemoFarmTraceabilityFactory");
    factory = await Factory.deploy();
    await factory.waitForDeployment();
  });

  it("should register a company", async function () {
    const tx = await factory.registerCompany(registrationNumber, companyName, addr1.address);
    const receipt = await tx.wait();
    const event = receipt.logs
      .map(log => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(e => e && e.name === "CompanyRegistered");
    expect(event).to.not.be.undefined;
    expect(event.args.name).to.equal(companyName);
    expect(event.args.owner).to.equal(addr1.address);
  });

  it("should not allow duplicate company registration", async function () {
    await factory.registerCompany(registrationNumber, companyName, addr1.address);
    await expect(
      factory.registerCompany(registrationNumber, companyName, addr1.address)
    ).to.be.revertedWith("Already registered");
  });

  it("should modify company info", async function () {
    await factory.registerCompany(registrationNumber, companyName, addr1.address);
    await factory.modifyCompany(registrationNumber, "New Name", addr2.address);
    const info = await factory.getCompanyInfo(registrationNumber);
    expect(info.name).to.equal("New Name");
    expect(info.wallet).to.equal(addr2.address);
  });

  it("should deactivate a company", async function () {
    await factory.registerCompany(registrationNumber, companyName, addr1.address);
    await factory.deactiveCompany(registrationNumber);
    await expect(factory.getCompanyInfo(registrationNumber)).to.be.revertedWith("Company is not registered");
  });

  it("should create a supply chain contract", async function () {
    await factory.registerCompany(registrationNumber, companyName, addr1.address);
    const tx = await factory.createSupplyChain(registrationNumber, "AgriChain", "desc");
    const receipt = await tx.wait();
    const event = receipt.logs
      .map(log => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(e => e && e.name === "AgriSupplyChainCreated");
    expect(event).to.not.be.undefined;
    expect(event.args.name).to.equal("AgriChain");
  });

  // ========== VALIDATION TESTS ==========

  describe("Input Validation", function () {
    it("should revert with empty registration number", async function () {
      await expect(
        factory.registerCompany("", companyName, addr1.address)
      ).to.be.revertedWith("Registration number cannot be empty");
    });

    it("should revert with empty company name", async function () {
      await expect(
        factory.registerCompany(registrationNumber, "", addr1.address)
      ).to.be.revertedWith("Company name cannot be empty");
    });

    it("should revert with zero address", async function () {
      await expect(
        factory.registerCompany(registrationNumber, companyName, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid wallet address");
    });
  });

  describe("Modify Company Validation", function () {
    beforeEach(async function () {
      await factory.registerCompany(registrationNumber, companyName, addr1.address);
    });

    it("should revert modify with empty registration number", async function () {
      await expect(
        factory.modifyCompany("", "New Name", addr2.address)
      ).to.be.revertedWith("Registration number cannot be empty");
    });

    it("should revert modify with empty company name", async function () {
      await expect(
        factory.modifyCompany(registrationNumber, "", addr2.address)
      ).to.be.revertedWith("Company name cannot be empty");
    });

    it("should revert modify with zero address", async function () {
      await expect(
        factory.modifyCompany(registrationNumber, "New Name", ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid wallet address");
    });

    it("should revert modify for unregistered company", async function () {
      await expect(
        factory.modifyCompany("UNREGISTERED", "New Name", addr2.address)
      ).to.be.revertedWith("Company not registered");
    });
  });

  // ========== PERMISSION TESTS ==========

  describe("Permission Control", function () {
    it("should only allow owner to register companies", async function () {
      await expect(
        factory.connect(addr1).registerCompany(registrationNumber, companyName, addr1.address)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("should only allow owner to modify companies", async function () {
      await factory.registerCompany(registrationNumber, companyName, addr1.address);
      await expect(
        factory.connect(addr1).modifyCompany(registrationNumber, "New Name", addr2.address)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("should only allow owner to deactivate companies", async function () {
      await factory.registerCompany(registrationNumber, companyName, addr1.address);
      await expect(
        factory.connect(addr1).deactiveCompany(registrationNumber)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("should allow company wallet to create supply chain", async function () {
      await factory.registerCompany(registrationNumber, companyName, addr1.address);
      const tx = await factory.connect(addr1).createSupplyChain(registrationNumber, "AgriChain", "desc");
      await expect(tx).to.emit(factory, "AgriSupplyChainCreated");
    });

    it("should allow owner to create supply chain for any company", async function () {
      await factory.registerCompany(registrationNumber, companyName, addr1.address);
      const tx = await factory.connect(owner).createSupplyChain(registrationNumber, "AgriChain", "desc");
      await expect(tx).to.emit(factory, "AgriSupplyChainCreated");
    });

    it("should reject unauthorized user from creating supply chain", async function () {
      await factory.registerCompany(registrationNumber, companyName, addr1.address);
      await expect(
        factory.connect(addr2).createSupplyChain(registrationNumber, "AgriChain", "desc")
      ).to.be.revertedWith("Sender does not have permission");
    });
  });

  // ========== MAPPING CONSISTENCY TESTS ==========

  describe("Mapping Consistency Issues", function () {
    it("should return consistent company ID from different methods", async function () {
      await factory.registerCompany(registrationNumber, companyName, addr1.address);

      // Get ID using the utility function
      const idFromUtility = await factory.getCompanyIdfromTaxcode(registrationNumber);

      // Get ID by creating expected hash
      const expectedId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["string"], [registrationNumber]));

      expect(idFromUtility).to.equal(expectedId);
    });

    it("should handle getListAgriSupplyChain correctly", async function () {
      await factory.registerCompany(registrationNumber, companyName, addr1.address);
      await factory.connect(addr1).createSupplyChain(registrationNumber, "Chain1", "desc1");
      await factory.connect(addr1).createSupplyChain(registrationNumber, "Chain2", "desc2");

      const chains = await factory.getListAgriSupplyChain(registrationNumber);
      expect(chains).to.have.length(2);
    });

    it("should revert getListAgriSupplyChain for unregistered company", async function () {
      await expect(
        factory.getListAgriSupplyChain("UNREGISTERED")
      ).to.be.revertedWith("Company not registered");
    });
  });

  // ========== EDGE CASES ==========

  describe("Edge Cases", function () {
    it("should handle special characters in registration number", async function () {
      const specialRegNumber = "REG-123_ABC.DEF";
      await factory.registerCompany(specialRegNumber, companyName, addr1.address);
      const info = await factory.getCompanyInfo(specialRegNumber);
      expect(info.registrationNumber).to.equal(specialRegNumber);
    });

    it("should handle maximum length inputs", async function () {
      const maxRegNumber = "A".repeat(50);
      const maxName = "B".repeat(100);
      await factory.registerCompany(maxRegNumber, maxName, addr1.address);
      const info = await factory.getCompanyInfo(maxRegNumber);
      expect(info.name).to.equal(maxName);
    });

    it("should handle multiple supply chains per company", async function () {
      await factory.registerCompany(registrationNumber, companyName, addr1.address);

      // Create multiple supply chains
      await factory.connect(addr1).createSupplyChain(registrationNumber, "Chain1", "desc1");
      await factory.connect(addr1).createSupplyChain(registrationNumber, "Chain2", "desc2");
      await factory.connect(addr1).createSupplyChain(registrationNumber, "Chain3", "desc3");

      const chains = await factory.getListAgriSupplyChain(registrationNumber);
      expect(chains).to.have.length(3);
    });

    it("should handle company reactivation after deactivation", async function () {
      await factory.registerCompany(registrationNumber, companyName, addr1.address);
      await factory.deactiveCompany(registrationNumber);

      // Should be able to register again with same registration number
      await factory.registerCompany(registrationNumber, "New Company Name", addr2.address);
      const info = await factory.getCompanyInfo(registrationNumber);
      expect(info.name).to.equal("New Company Name");
      expect(info.wallet).to.equal(addr2.address);
    });
  });

  // ========== COMPREHENSIVE INTEGRATION TESTS ==========

  describe("Integration Tests", function () {
    it("should handle complete company lifecycle", async function () {
      // Register
      let tx = await factory.registerCompany(registrationNumber, companyName, addr1.address);
      await expect(tx).to.emit(factory, "CompanyRegistered");

      // Modify
      tx = await factory.modifyCompany(registrationNumber, "Modified Name", addr2.address);
      await expect(tx).to.emit(factory, "CompanyModified");

      // Create supply chain
      tx = await factory.connect(addr2).createSupplyChain(registrationNumber, "AgriChain", "desc");
      await expect(tx).to.emit(factory, "AgriSupplyChainCreated");

      // Verify final state
      const info = await factory.getCompanyInfo(registrationNumber);
      expect(info.name).to.equal("Modified Name");
      expect(info.wallet).to.equal(addr2.address);

      const chains = await factory.getListAgriSupplyChain(registrationNumber);
      expect(chains).to.have.length(1);

      // Deactivate
      tx = await factory.deactiveCompany(registrationNumber);
      await expect(tx).to.emit(factory, "CompanyDeactivated");
    });
  });
});

describe("TYTFarmFactory", function () {
  let factory, owner, companyOwner, productManager, auditor, agri;
  const registrationNumber = "REG123";
  const companyName = "Test Company";
  const productId = "P1";
  const productName = "Rice";
  const description = "Organic Rice";
  const batchId = "BATCH1";

  beforeEach(async function () {
    [owner, companyOwner, productManager, auditor] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("DemoFarmTraceabilityFactory");
    factory = await Factory.deploy();
    await factory.waitForDeployment();
    await factory.registerCompany(registrationNumber, companyName, companyOwner.address);
    const tx = await factory.createSupplyChain(registrationNumber, "AgriChain", "desc");
    const receipt = await tx.wait();
    const event = receipt.logs.map(log => {
      try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
    }).find(e => e && e.name == "AgriSupplyChainCreated");
    agri = await ethers.getContractAt("TYTFarmFactory", event.args.contractAddr);
  });

  it("should allow admin to add product manager and add product", async function () {
    // await agri.connect(owner).addProductManager(companyOwner.address);
    await agri.connect(companyOwner).addProduct(productId, productName, description);
    const info = await agri.getProductInfo(productId);
    expect(info.productId).to.equal(productId);
    expect(info.productName).to.equal(productName);
    expect(info.description).to.equal(description);
    expect(info.isActive).to.be.true;
  });

  it("should update product processes and status", async function () {
    // await agri.addProductManager(companyOwner.address);
    await agri.connect(companyOwner).addProduct(productId, productName, description);
    await agri.connect(companyOwner).addAuditor(owner.address);
    await agri.connect(companyOwner).updateProductProcesses(productId, batchId, "Harvested");
    await agri.connect(companyOwner).updateProductStatus(productId, batchId, "Packaged");
    const batch = await agri.getProductByBatch(productId, batchId);
    expect(batch.status).to.equal("Packaged");
    expect(batch.processes).to.equal("Harvested");
  });

  it("should deactivate and reactivate product", async function () {
    // await agri.addProductManager(companyOwner.address);
    await agri.connect(companyOwner).addProduct(productId, productName, description);
    await agri.connect(companyOwner).deactivateProduct(productId);
    // let info = await agri.getProductInfo(productId).catch(() => null);
    // expect(info.isActive).to.be.false;
    await agri.connect(companyOwner).reactivateProduct(productId);
    info = await agri.getProductInfo(productId);
    expect(info.isActive).to.be.true;
  });

  // ========== ROLE MANAGEMENT TESTS ==========

  describe("Role Management", function () {
    it("should allow admin to add and remove product manager", async function () {
      await agri.connect(companyOwner).addProductManager(productManager.address);

      // Product manager should be able to add product
      await agri.connect(productManager).addProduct(productId, productName, description);
      const info = await agri.getProductInfo(productId);
      expect(info.productId).to.equal(productId);

      // Remove product manager
      await agri.connect(companyOwner).removeProductManager(productManager.address);

      // Should not be able to add product anymore
      await expect(
        agri.connect(productManager).addProduct("P2", "Product 2", "desc")
      ).to.be.revertedWith("Caller is not a product manager");
    });

    it("should allow admin to add and remove auditor", async function () {
      await agri.connect(companyOwner).addProduct(productId, productName, description);
      await agri.connect(companyOwner).addAuditor(auditor.address);

      // Auditor should be able to update processes
      await agri.connect(auditor).updateProductProcesses(productId, batchId, "Process data");
      const batch = await agri.getProductByBatch(productId, batchId);
      expect(batch.processes).to.equal("Process data");

      // Remove auditor
      await agri.connect(companyOwner).removeAuditor(auditor.address);

      // Should not be able to update processes anymore
      await expect(
        agri.connect(auditor).updateProductProcesses(productId, batchId, "New process")
      ).to.be.revertedWith("Caller is not an auditor");
    });

    it("should reject zero address for role management", async function () {
      await expect(
        agri.connect(companyOwner).addProductManager(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid user address");

      await expect(
        agri.connect(companyOwner).addAuditor(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid user address");
    });

    it("should only allow admin to manage roles", async function () {
      await expect(
        agri.connect(productManager).addProductManager(auditor.address)
      ).to.be.revertedWithCustomError(agri, "AccessControlUnauthorizedAccount");

      await expect(
        agri.connect(auditor).addAuditor(productManager.address)
      ).to.be.revertedWithCustomError(agri, "AccessControlUnauthorizedAccount");
    });
  });

  // ========== PRODUCT VALIDATION TESTS ==========

  describe("Product Input Validation", function () {
    it("should reject empty product ID", async function () {
      await expect(
        agri.connect(companyOwner).addProduct("", productName, description)
      ).to.be.revertedWith("Product ID cannot be empty"); // This catches empty string edge case
    });

    it("should reject duplicate product registration", async function () {
      await agri.connect(companyOwner).addProduct(productId, productName, description);
      await expect(
        agri.connect(companyOwner).addProduct(productId, "Another Product", "desc")
      ).to.be.revertedWith("Product registed");
    });

    it("should reject empty batch ID for processes", async function () {
      await agri.connect(companyOwner).addProduct(productId, productName, description);
      await expect(
        agri.connect(companyOwner).updateProductProcesses(productId, "", "process")
      ).to.be.revertedWith("Batch ID cannot be empty");
    });

    it("should reject empty batch ID for status", async function () {
      await agri.connect(companyOwner).addProduct(productId, productName, description);
      await expect(
        agri.connect(companyOwner).updateProductStatus(productId, "", "status")
      ).to.be.revertedWith("Batch ID cannot be empty");
    });

    it("should reject operations on non-existent product", async function () {
      await expect(
        agri.connect(companyOwner).updateProductProcesses("NONEXISTENT", batchId, "process")
      ).to.be.revertedWith("Product is not active or not found");

      await expect(
        agri.connect(companyOwner).updateProductStatus("NONEXISTENT", batchId, "status")
      ).to.be.revertedWith("Product is not active or not found");
    });
  });

  // ========== BATCH TRACKING TESTS ==========

  describe("Batch Tracking", function () {
    beforeEach(async function () {
      await agri.connect(companyOwner).addProduct(productId, productName, description);
    });

    it("should track multiple batches for one product", async function () {
      const batch1 = "BATCH001";
      const batch2 = "BATCH002";
      const batch3 = "BATCH003";

      await agri.connect(companyOwner).updateProductStatus(productId, batch1, "Status1");
      await agri.connect(companyOwner).updateProductStatus(productId, batch2, "Status2");
      await agri.connect(companyOwner).updateProductProcesses(productId, batch3, "Process3");

      const batches = await agri.getProductBatches(productId);
      expect(batches).to.have.length(3);
      expect(batches).to.include(batch1);
      expect(batches).to.include(batch2);
      expect(batches).to.include(batch3);
    });

    it("should handle complex JSON processes", async function () {
      await agri.connect(companyOwner).addAuditor(auditor.address);

      const complexProcess = JSON.stringify({
        harvesting: {
          date: "2024-01-15",
          location: "Field A",
          quality: "Grade A",
          quantity: "500kg"
        },
        processing: {
          method: "Organic drying",
          temperature: "60°C",
          duration: "8 hours"
        },
        packaging: {
          date: "2024-01-16",
          type: "Vacuum sealed",
          batchCode: "VS001"
        }
      });

      await agri.connect(auditor).updateProductProcesses(productId, batchId, complexProcess);

      const batch = await agri.getProductByBatch(productId, batchId);
      expect(batch.processes).to.equal(complexProcess);

      // Verify it's valid JSON
      const parsed = JSON.parse(batch.processes);
      expect(parsed.harvesting.quality).to.equal("Grade A");
    });
  });

  // ========== COMPANY OWNER MANAGEMENT TESTS ==========

  describe("Company Owner Management", function () {
    it("should return correct company owner", async function () {
      const owner = await agri.getCompanyOwner();
      expect(owner).to.equal(companyOwner.address);
    });

    it("should allow admin to update company owner", async function () {
      const newOwner = productManager.address;
      await agri.connect(companyOwner).updateCompanyOwner(newOwner);

      const updatedOwner = await agri.getCompanyOwner();
      expect(updatedOwner).to.equal(newOwner);
    });

    it("should reject zero address as new company owner", async function () {
      await expect(
        agri.connect(companyOwner).updateCompanyOwner(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid owner address");
    });

    it("should only allow admin to update company owner", async function () {
      await expect(
        agri.connect(productManager).updateCompanyOwner(auditor.address)
      ).to.be.revertedWithCustomError(agri, "AccessControlUnauthorizedAccount");
    });
  });

  // ========== QUERY FUNCTIONS TESTS ==========

  describe("Query Functions", function () {
    beforeEach(async function () {
      await agri.connect(companyOwner).addProduct(productId, productName, description);
      await agri.connect(companyOwner).addProduct("P2", "Product 2", "Description 2");
      await agri.connect(companyOwner).updateProductStatus(productId, batchId, "Status1");
      await agri.connect(companyOwner).updateProductStatus("P2", "B2", "Status2");
    });

    it("should return all product IDs", async function () {
      const productIds = await agri.getAllProductIds();
      expect(productIds).to.have.length(2);
      expect(productIds).to.include(productId);
      expect(productIds).to.include("P2");
    });

    it("should check product existence correctly", async function () {
      expect(await agri.hasProduct(productId)).to.be.true;
      expect(await agri.hasProduct("P2")).to.be.true;
      expect(await agri.hasProduct("NONEXISTENT")).to.be.false;
    });

    it("should handle deactivated products correctly", async function () {
      await agri.connect(companyOwner).deactivateProduct(productId);

      expect(await agri.hasProduct(productId)).to.be.false;

      await expect(
        agri.getProductInfo(productId)
      ).to.be.revertedWith("Product is not active");
    });

    it("should revert queries for non-existent products", async function () {
      await expect(
        agri.getProductInfo("NONEXISTENT")
      ).to.be.revertedWith("Product not found");

      await expect(
        agri.getProductByBatch("NONEXISTENT", batchId)
      ).to.be.revertedWith("Product not found");

      await expect(
        agri.getProductBatches("NONEXISTENT")
      ).to.be.revertedWith("Product not found");
    });

    it("should revert batch queries with empty batch ID", async function () {
      await expect(
        agri.getProductByBatch(productId, "")
      ).to.be.revertedWith("Batch ID cannot be empty");
    });
  });

  // ========== COMPREHENSIVE INTEGRATION TESTS ==========

  describe("Integration Tests", function () {
    it("should handle complete product lifecycle", async function () {
      // Setup roles
      await agri.connect(companyOwner).addProductManager(productManager.address);
      await agri.connect(companyOwner).addAuditor(auditor.address);

      // Product creation by manager
      let tx = await agri.connect(productManager).addProduct(productId, productName, description);
      await expect(tx).to.emit(agri, "ProductAdded");

      // Process updates by auditor
      tx = await agri.connect(auditor).updateProductProcesses(productId, batchId, "Harvested");
      await expect(tx).to.emit(agri, "UpdatedProcesses");

      // Status updates by manager
      tx = await agri.connect(productManager).updateProductStatus(productId, batchId, "Packaged");
      await expect(tx).to.emit(agri, "UpdatedProductStatus");

      // Verify final state
      const batch = await agri.getProductByBatch(productId, batchId);
      expect(batch.productId).to.equal(productId);
      expect(batch.status).to.equal("Packaged");
      expect(batch.processes).to.equal("Harvested");
      expect(batch.isActive).to.be.true;

      // Deactivate product
      tx = await agri.connect(productManager).deactivateProduct(productId);
      await expect(tx).to.emit(agri, "ProductDeactivated");

      // Reactivate product
      tx = await agri.connect(productManager).reactivateProduct(productId);
      await expect(tx).to.emit(agri, "ProductAdded"); // Reactivation emits ProductAdded
    });

    it("should maintain data integrity across role changes", async function () {
      // Create product and add data
      await agri.connect(companyOwner).addProduct(productId, productName, description);
      await agri.connect(companyOwner).addAuditor(auditor.address);
      await agri.connect(auditor).updateProductProcesses(productId, batchId, "Initial Process");

      // Remove auditor and add product manager
      await agri.connect(companyOwner).removeAuditor(auditor.address);
      await agri.connect(companyOwner).addProductManager(productManager.address);

      // Data should still be accessible
      const batch = await agri.getProductByBatch(productId, batchId);
      expect(batch.processes).to.equal("Initial Process");

      // New role should be able to add new data
      await agri.connect(productManager).updateProductStatus(productId, batchId, "New Status");

      const updatedBatch = await agri.getProductByBatch(productId, batchId);
      expect(updatedBatch.status).to.equal("New Status");
      expect(updatedBatch.processes).to.equal("Initial Process"); // Previous data preserved
    });
  });
});
