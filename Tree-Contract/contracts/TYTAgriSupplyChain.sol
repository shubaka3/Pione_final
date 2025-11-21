// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TYTAgriSupplyChain
 * @dev Smart contract for managing agricultural supply chain with role-based access control
 * @notice This contract allows companies to manage their agricultural products and track batch processes
 */
contract TYTAgriSupplyChain is AccessControl {

    // ========== STATE VARIABLES ==========
    
    address public factory;
    bytes32 public immutable companyId;
    address public companyOwner;

    // ========== ROLE DEFINITIONS ==========
    
    /// @notice Role identifier for product managers who can add products and update status
    bytes32 public constant PRODUCT_MANAGER_ROLE = keccak256("PRODUCT_MANAGER_ROLE");
    
    /// @notice Role identifier for auditors who can update product processes
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    // ========== STRUCTS ==========
    
    /**
     * @dev Structure to store product information
     * @param productId Unique identifier for the product
     * @param productName Human-readable name of the product
     * @param description Detailed description of the product
     * @param status Mapping from batch ID to current status
     * @param batchs Mapping from batch ID to processes information
     * @param isActive Flag indicating if the product is currently active
     */
    struct Product {
        string productId;
        string productName;
        string description;
        mapping(string batch => string) status;
        mapping(string batch => string processes) batchs;
        bool isActive;
    }

    // ========== STORAGE MAPPINGS ==========
    
    /// @notice Array of all registered product IDs
    string[] private productIds;
    /// @notice Mapping from product ID to Product struct
    mapping(string => Product) public products;
    /// @notice Mapping from product ID to array of batch IDs for tracking
    mapping(string => string[]) listIndexBatchs;

    // ========== EVENTS ==========
    
    /**
     * @dev Emitted when a new product is added
     * @param productId The unique identifier of the added product
     * @param productName The name of the added product
     * @param companyId The company ID that owns this product
     * @param description The product description
     * @param updateAt Timestamp when the product was added
     */
    event ProductAdded(string indexed productId, string productName, bytes32 companyId, string description, uint256 updateAt);
    
    /**
     * @dev Emitted when product processes are updated
     * @param productId The unique identifier of the product
     * @param _newProcesses The new processes information
     * @param updateAt Timestamp when the processes were updated
     */
    event UpdatedProcesses(string indexed productId, string _newProcesses, uint256 updateAt);
    
    /**
     * @dev Emitted when product status is updated
     * @param productId The unique identifier of the product
     * @param oldStatus The previous status
     * @param newStatus The new status
     * @param updateAt Timestamp when the status was updated
     */
    event UpdatedProductStatus(string indexed productId, string oldStatus, string newStatus, uint256 updateAt);
    
    // Events for role management
    /**
     * @dev Emitted when a product manager is added
     * @param account The address granted the product manager role
     * @param admin The address of the admin who granted the role
     */
    event ProductManagerAdded(address indexed account, address indexed admin);
    
    /**
     * @dev Emitted when a product manager is removed
     * @param account The address from which the product manager role was revoked
     * @param admin The address of the admin who revoked the role
     */
    event ProductManagerRemoved(address indexed account, address indexed admin);
    
    /**
     * @dev Emitted when an auditor is added
     * @param account The address granted the auditor role
     * @param auditor The address of the admin who granted the role
     */
    event AuditorAdded(address indexed account, address indexed auditor);
    
    /**
     * @dev Emitted when an auditor is removed
     * @param account The address from which the auditor role was revoked
     * @param auditor The address of the admin who revoked the role
     */
    event AuditorRemoved(address indexed account, address indexed auditor);
    
    /**
     * @dev Emitted when a product is deactivated
     * @param productId The unique identifier of the deactivated product
     * @param deactivatedBy The address that deactivated the product
     * @param deactivatedAt Timestamp when the product was deactivated
     */
    event ProductDeactivated(string indexed productId, address indexed deactivatedBy, uint256 deactivatedAt);
    
    /**
     * @dev Emitted when company owner is updated
     * @param oldOwner The previous owner address
     * @param newOwner The new owner address
     * @param updatedAt Timestamp when the owner was updated
     */
    event CompanyOwnerUpdated(address indexed oldOwner, address indexed newOwner, uint256 updatedAt);

    // ========== CONSTRUCTOR ==========
    
    /**
     * @dev Constructor to initialize the contract
     * @param _companyId Unique identifier for the company
     * @param _companyOwner Address of the company owner
     * @notice The factory contract is granted the default admin role
     */
    constructor(bytes32 _companyId, address _companyOwner) {
        factory = msg.sender;
        companyId = _companyId;
        companyOwner = _companyOwner;

        // Grant default admin role to the factory contract
        _grantRole(DEFAULT_ADMIN_ROLE, factory);
        _grantRole(DEFAULT_ADMIN_ROLE, _companyOwner);
    }

    // ========== MODIFIERS ==========
    
    /**
     * @dev Modifier to restrict access to product managers and admins
     * @notice Allows only addresses with PRODUCT_MANAGER_ROLE or DEFAULT_ADMIN_ROLE
     */
    modifier onlyProductManager() {
        require(hasRole(PRODUCT_MANAGER_ROLE, msg.sender) || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Caller is not a product manager");
        _;
    }

    /**
     * @dev Modifier to restrict access to auditors, product managers, and admins
     * @notice Allows addresses with AUDITOR_ROLE, PRODUCT_MANAGER_ROLE, or DEFAULT_ADMIN_ROLE
     */
    modifier onlyAuditor() {
        require(
            hasRole(AUDITOR_ROLE, msg.sender) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) ||
            hasRole(PRODUCT_MANAGER_ROLE, msg.sender),
            "Caller is not an auditor"
        );
        _;
    }

    // ========== PRODUCT MANAGEMENT FUNCTIONS ==========
    
    /**
     * @dev Add a new product to the supply chain
     * @param _productId Unique identifier for the product
     * @param _productName Human-readable name of the product
     * @param _description Detailed description of the product
     * @notice Only product managers can call this function
     * @notice Product ID must be unique and not already registered
     */
    function addProduct(
        string calldata _productId,
        string calldata _productName,
        string calldata _description
    ) public onlyProductManager {
        require(bytes(_productId).length > 0, "Product ID cannot be empty");
        require(!products[_productId].isActive, "Product registed");

        // Initialize product struct
        Product storage p = products[_productId];
        p.productId = _productId;
        p.productName = _productName;
        p.description = _description;
        p.isActive = true;
        
        // Add to product IDs array for enumeration
        productIds.push(_productId);
        
        emit ProductAdded(_productId, _productName, companyId, _description, block.timestamp);
    }

    /**
     * @dev Update the processes information for a specific product batch
     * @param _productId Unique identifier of the product
     * @param batch Batch identifier within the product
     * @param _newProcesses New processes information to be recorded
     * @notice Only auditors, product managers, and admins can call this function
     * @notice Product must exist and be active
     */
    function updateProductProcesses(string calldata _productId, string calldata batch, string calldata _newProcesses) 
        public onlyAuditor 
    {
        require(hasProduct(_productId), "Product is not active or not found");
        require(bytes(batch).length > 0, "Batch ID cannot be empty");
        
        Product storage p = products[_productId];
        
        // Track new batches
        if (bytes(p.batchs[batch]).length == 0) {
            listIndexBatchs[_productId].push(batch);
        }
        
        p.batchs[batch] = _newProcesses;

        emit UpdatedProcesses(_productId, _newProcesses, block.timestamp); 
    }

    /**
     * @dev Update the status of a specific product batch
     * @param _productId Unique identifier of the product
     * @param batch Batch identifier within the product
     * @param _status New status to be set
     * @notice Only product managers and admins can call this function
     * @notice Product must exist and be active
     */
    function updateProductStatus(string calldata _productId, string calldata batch, string calldata _status) public onlyProductManager {
        require(hasProduct(_productId), "Product is not active or not found");
        require(bytes(batch).length > 0, "Batch ID cannot be empty");
        
        Product storage p = products[_productId];
        
        // Track new batches
        if (bytes(p.status[batch]).length == 0 && bytes(p.batchs[batch]).length == 0) {
            listIndexBatchs[_productId].push(batch);
        }
        
        string memory oldStatus = p.status[batch];
        p.status[batch] = _status;

        emit UpdatedProductStatus(_productId, oldStatus, _status, block.timestamp);
    }

    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @dev Check if a product exists and is active
     * @param _productId Unique identifier of the product to check
     * @return bool True if product exists and is active, false otherwise
     * @notice Checks both product ID existence and active status
     */
    function hasProduct(string calldata _productId) public view returns (bool) {
        return bytes(products[_productId].productId).length > 0 && products[_productId].isActive;
    }

    /**
     * @dev Get basic information about a product
     * @param _productId Unique identifier of the product
     * @return productId The product's unique identifier
     * @return productName The product's name
     * @return description The product's description
     * @return isActive Whether the product is currently active
     * @notice Product must exist and be active
     */
    function getProductInfo(string calldata _productId) public view returns (
        string memory productId,
        string memory productName,
        string memory description,
        bool isActive
    ) {
        require(bytes(products[_productId].productId).length > 0, "Product not found");
        require(products[_productId].isActive , "Product is not active");
        Product storage product = products[_productId];
        return (
            product.productId,
            product.productName,
            product.description,
            product.isActive
        );
    }

    /**
     * @dev Get detailed information about a specific product batch
     * @param _productId Unique identifier of the product
     * @param batch Batch identifier within the product
     * @return productId The product's unique identifier
     * @return productName The product's name
     * @return description The product's description
     * @return status The current status of the batch
     * @return processes The processes information for the batch
     * @return isActive Whether the product is currently active
     * @notice Product must exist and be active
     */
    function getProductByBatch(string memory _productId, string memory batch) external view returns (
        string memory productId,
        string memory productName,
        string memory description,
        string memory status,
        string memory processes,
        bool isActive
    ) {
        require(bytes(products[_productId].productId).length > 0, "Product not found");
        require(products[_productId].isActive , "Product is not active");
        require(bytes(batch).length > 0, "Batch ID cannot be empty");
        
        Product storage p = products[_productId];
        return(
            p.productId,
            p.productName,
            p.description,
            p.status[batch],
            p.batchs[batch],
            p.isActive
        );
    }

    /**
     * @dev Get all registered product IDs
     * @return Array of all product IDs that have been registered
     * @notice This includes both active and inactive products
     */
    function getAllProductIds() public view returns (string[] memory) {
        return productIds;
    }
    
    /**
     * @dev Get all batch IDs for a specific product
     * @param _productId Unique identifier of the product
     * @return Array of batch IDs associated with the product
     * @notice Product must exist and be active
     */
    function getProductBatches(string calldata _productId) external view returns (string[] memory) {
        require(bytes(products[_productId].productId).length > 0, "Product not found");
        require(products[_productId].isActive , "Product is not active");
        return listIndexBatchs[_productId];
    }
    
    /**
     * @dev Deactivate a product (soft delete)
     * @param _productId Unique identifier of the product to deactivate
     * @notice Only product managers and admins can call this function
     * @notice Product must exist and be currently active
     */
    function deactivateProduct(string calldata _productId) external onlyProductManager {
        require(hasProduct(_productId), "Product is not active or not found");
        
        Product storage p = products[_productId];
        p.isActive = false;
        
        emit ProductDeactivated(_productId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev Reactivate a previously deactivated product
     * @param _productId Unique identifier of the product to reactivate
     * @notice Only product managers and admins can call this function
     * @notice Product must exist but be currently inactive
     */
    function reactivateProduct(string calldata _productId) external onlyProductManager {
        require(bytes(products[_productId].productId).length > 0, "Product does not exist");
        require(!products[_productId].isActive, "Product is already active");
        
        Product storage p = products[_productId];
        p.isActive = true;
        
        emit ProductAdded(_productId, p.productName, companyId, p.description, block.timestamp);
    }
    
    /**
     * @dev Get company owner address
     * @return address The address of the company owner
     * @notice This is a view function accessible to anyone
     */
    function getCompanyOwner() external view returns (address) {
        return companyOwner;
    }
    
    /**
     * @dev Update company owner address
     * @param _newOwner New owner address
     * @notice Only default admin can call this function
     * @notice New owner address must not be zero address
     */
    function updateCompanyOwner(address _newOwner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newOwner != address(0), "Invalid owner address");
        address oldOwner = companyOwner;
        companyOwner = _newOwner;
        
        emit CompanyOwnerUpdated(oldOwner, _newOwner, block.timestamp);
    }

    // ========== ROLE MANAGEMENT FUNCTIONS ==========
    
    /**
     * @dev Grant product manager role to an address
     * @param account Address to grant the role to
     * @notice Only default admin can call this function
     * @notice Address must not be zero address
     */
    function addProductManager(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid user address");
        _grantRole(PRODUCT_MANAGER_ROLE, account);
        emit ProductManagerAdded(account, msg.sender);
    }

    /**
     * @dev Revoke product manager role from an address
     * @param account Address to revoke the role from
     * @notice Only default admin can call this function
     * @notice Address must not be zero address
     */
    function removeProductManager(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid user address");
        _revokeRole(PRODUCT_MANAGER_ROLE, account);
        emit ProductManagerRemoved(account, msg.sender);
    }

    /**
     * @dev Grant auditor role to an address
     * @param account Address to grant the role to
     * @notice Only default admin can call this function
     * @notice Address must not be zero address
     */
    function addAuditor(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid user address");
        _grantRole(AUDITOR_ROLE, account);
        emit AuditorAdded(account, msg.sender);
    }

    /**
     * @dev Revoke auditor role from an address
     * @param account Address to revoke the role from
     * @notice Only default admin can call this function
     * @notice Address must not be zero address
     */
    function removeAuditor(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "Invalid user address");
        _revokeRole(AUDITOR_ROLE, account);
        emit AuditorRemoved(account, msg.sender);
    }
    
    // ========== INTERFACE SUPPORT ==========
    
    /**
     * @dev Override supportsInterface to support AccessControl
     * @param interfaceId The interface identifier to check
     * @return bool True if the interface is supported, false otherwise
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}