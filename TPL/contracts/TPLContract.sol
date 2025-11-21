// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title TPLContract
 * @dev Hợp đồng lưu trữ 5 loại dữ liệu riêng biệt kèm thời gian và người gửi.
 */
contract TPLContract {

    address public owner;

    // =============================================================
    // 1. CẤU TRÚC DỮ LIỆU (STRUCT)
    // =============================================================
    struct DataRecord {
        address sender;     // Địa chỉ ví người gửi
        string data;        // Dữ liệu (CID hoặc Chuỗi dài)
        uint256 timestamp;  // Thời gian ghi nhận trên Blockchain
    }

    // =============================================================
    // 2. CÁC KHO LƯU TRỮ (DATA STORAGE)
    // =============================================================
    
    // Kho 1: Contributions (CID)
    DataRecord[] public contributions;

    // Kho 2: IoT Data
    DataRecord[] public iotDataList;

    // Kho 3: Collection Data
    DataRecord[] public collectionDataList;

    // Kho 4: Backup Data
    DataRecord[] public backupDataList;

    // Kho 5: Primary Data
    DataRecord[] public primaryDataList;

    // =============================================================
    // 3. EVENTS (Sự kiện để Server lắng nghe)
    // =============================================================
    event ContributionAdded(address indexed sender, uint256 index, uint256 timestamp);
    event IoTDataAdded(address indexed sender, uint256 index, uint256 timestamp);
    event CollectionDataAdded(address indexed sender, uint256 index, uint256 timestamp);
    event BackupDataAdded(address indexed sender, uint256 index, uint256 timestamp);
    event PrimaryDataAdded(address indexed sender, uint256 index, uint256 timestamp);

    // =============================================================
    // 4. KHỞI TẠO
    // =============================================================
    constructor() {
        owner = msg.sender;
    }

    // =============================================================
    // 5. CÁC HÀM GHI (WRITE FUNCTIONS)
    // =============================================================

    // --- 1. Submit Contribution ---
    function submitContribution(string memory _cid) external {
        contributions.push(DataRecord(msg.sender, _cid, block.timestamp));
        emit ContributionAdded(msg.sender, contributions.length - 1, block.timestamp);
    }

    // --- 2. Add IoT Data ---
    function addIoTData(string memory _dataString) external {
        iotDataList.push(DataRecord(msg.sender, _dataString, block.timestamp));
        emit IoTDataAdded(msg.sender, iotDataList.length - 1, block.timestamp);
    }

    // --- 3. Add Collection Data ---
    function addCollectionData(string memory _dataString) external {
        collectionDataList.push(DataRecord(msg.sender, _dataString, block.timestamp));
        emit CollectionDataAdded(msg.sender, collectionDataList.length - 1, block.timestamp);
    }

    // --- 4. Add Backup Data ---
    function addBackupData(string memory _dataString) external {
        backupDataList.push(DataRecord(msg.sender, _dataString, block.timestamp));
        emit BackupDataAdded(msg.sender, backupDataList.length - 1, block.timestamp);
    }

    // --- 5. Add Primary Data ---
    function addPrimaryData(string memory _dataString) external {
        primaryDataList.push(DataRecord(msg.sender, _dataString, block.timestamp));
        emit PrimaryDataAdded(msg.sender, primaryDataList.length - 1, block.timestamp);
    }

    // =============================================================
    // 6. CÁC HÀM ĐỌC (READ FUNCTIONS)
    // =============================================================
    
    // Lấy số lượng phần tử của cả 5 kho
    function getDataCounts() external view returns (uint256 contrib, uint256 iot, uint256 col, uint256 back, uint256 pri) {
        return (
            contributions.length,
            iotDataList.length,
            collectionDataList.length,
            backupDataList.length,
            primaryDataList.length
        );
    }

    // --- Lấy chi tiết từng phần tử theo Index ---

    function getContribution(uint256 _index) external view returns (string memory data, uint256 timestamp, address sender) {
        DataRecord memory record = contributions[_index];
        return (record.data, record.timestamp, record.sender);
    }

    function getIoTData(uint256 _index) external view returns (string memory data, uint256 timestamp, address sender) {
        DataRecord memory record = iotDataList[_index];
        return (record.data, record.timestamp, record.sender);
    }

    function getCollectionData(uint256 _index) external view returns (string memory data, uint256 timestamp, address sender) {
        DataRecord memory record = collectionDataList[_index];
        return (record.data, record.timestamp, record.sender);
    }

    function getBackupData(uint256 _index) external view returns (string memory data, uint256 timestamp, address sender) {
        DataRecord memory record = backupDataList[_index];
        return (record.data, record.timestamp, record.sender);
    }

    function getPrimaryData(uint256 _index) external view returns (string memory data, uint256 timestamp, address sender) {
        DataRecord memory record = primaryDataList[_index];
        return (record.data, record.timestamp, record.sender);
    }
}