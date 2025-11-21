// Để chạy file này, bạn cần cài đặt: npm install express ethers dotenv cors
// Sau đó chạy bằng: node server.js

const express = require('express');
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
require('dotenv').config(); // Load biến môi trường từ .env
const cors = require('cors');

const app = express();
app.use(cors()); // Cho phép Cross-Origin Resource Sharing
// Tăng giới hạn body lên 50mb để nhận được chuỗi string rất dài (như yêu cầu của bạn)
app.use(express.json({ limit: '50mb' })); 

// --- CẤU HÌNH BLOCKCHAIN ---
const RPC_URL = "https://rpc.zeroscan.org";
const PRIVATE_KEY = process.env.PRIVATE_KEY; 

// ======================================================================================
// CẬP NHẬT: ĐỊA CHỈ CONTRACT TPLContract (Đã lấy từ log deploy của bạn)
// ======================================================================================
const TPL_CONTRACT_ADDRESS = "0xC5d39765e4DfdDe40dbe3B785D27548567F1e2b2"; 
const CONTRACT_NAME = "TPLContract"; 
const CONTRACT_FILE_NAME = "TPLContract.sol"; 

// Kiểm tra Private Key ngay từ đầu
if (!PRIVATE_KEY) {
    console.error("==============================================");
    console.error("❌ LỖI KHỞI TẠO: PRIVATE_KEY không được tìm thấy. Ứng dụng dừng.");
    console.error("   Vui lòng kiểm tra file .env");
    console.error("==============================================");
    process.exit(1); 
}

// Khai báo biến toàn cục
let provider;
let wallet;
let tplContract;
let SENDER_ADDRESS;

// --- KHỞI TẠO VÀ XỬ LÝ LỖI KHỞI TẠO ---
async function initializeBlockchain() {
    try {
        // 1. Khởi tạo Provider và Wallet
        provider = new ethers.JsonRpcProvider(RPC_URL);
        wallet = new ethers.Wallet(PRIVATE_KEY, provider);

        // 2. Lấy ABI (Đường dẫn ABI của TPLContract)
        const abiPath = path.join(__dirname, 'artifacts', 'contracts', CONTRACT_FILE_NAME, `${CONTRACT_NAME}.json`);
        
        if (!fs.existsSync(abiPath)) {
            // LỖI THƯỜNG GẶP: Chưa chạy npx hardhat compile hoặc đường dẫn sai.
            throw new Error(`File ABI không tồn tại tại đường dẫn: ${abiPath}. Đã chạy 'npx hardhat compile' chưa?`);
        }

        const abiJson = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
        
        // 3. Khởi tạo Contract Object
        tplContract = new ethers.Contract(TPL_CONTRACT_ADDRESS, abiJson.abi, wallet);
        SENDER_ADDRESS = wallet.address;

        console.log("✅ Kết nối Blockchain thành công!");
        console.log(`   - Contract: ${CONTRACT_NAME}`);
        console.log(`   - Address: ${TPL_CONTRACT_ADDRESS}`);

    } catch (error) {
        console.error("==============================================");
        console.error("❌ LỖI KHỞI TẠO BLOCKCHAIN (Ứng dụng đã bị dừng):");
        console.error(`   Chi tiết: ${error.message}`);
        console.error("==============================================");
        process.exit(1); 
    }
}

// ======================================================================================
// HÀM TIỆN ÍCH (HELPER FUNCTIONS) - Giúp code gọn hơn
// ======================================================================================

// Hàm xử lý Ghi dữ liệu (Transaction)
async function handleTransaction(res, contractFunction, dataArg, successMessage) {
    try {
        // Tăng gas limit lên 2,000,000 để an toàn cho các chuỗi dài
        const tx = await contractFunction(dataArg, { gasLimit: 2000000 });
        
        // Chờ transaction được xác nhận (1 block)
        const receipt = await tx.wait();

        res.status(200).json({
            message: successMessage,
            transactionHash: receipt.hash,
            sender: SENDER_ADDRESS,
            inputDataLen: dataArg.length, // Trả về độ dài dữ liệu đã lưu để kiểm tra
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error(`LỖI TRANSACTION: ${error.message}`);
        res.status(500).json({ 
            error: "Lỗi khi gửi giao dịch lên Blockchain", 
            details: error.message 
        });
    }
}

// Hàm xử lý Đọc dữ liệu (View)
async function handleGetData(res, contractFunction, index) {
    try {
        // Smart contract trả về tuple: [data, timestamp, sender]
        const result = await contractFunction(index);
        
        res.status(200).json({
            data: result[0],              // Chuỗi dữ liệu gốc
            timestamp: Number(result[1]), // Thời gian (Unix timestamp)
            sender: result[2]             // Người gửi
        });
    } catch (error) {
        console.error(`LỖI GET DATA (Index: ${index}): ${error.message}`);
        res.status(500).json({ 
            error: "Lỗi khi lấy dữ liệu (Kiểm tra Index có tồn tại không)", 
            details: error.message 
        });
    }
}

// ======================================================================================
// API ENDPOINTS
// ======================================================================================

// --- 1. CONTRIBUTION (Lưu CID) ---
app.post('/api/contributions/add', (req, res) => {
    const { cid } = req.body;
    if (!cid) return res.status(400).json({ error: "Thiếu tham số 'cid'" });
    handleTransaction(res, tplContract.submitContribution, cid, "Thêm Contribution thành công");
});

app.get('/api/contributions/:index', (req, res) => {
    handleGetData(res, tplContract.getContribution, req.params.index);
});


// --- 2. IOT DATA (Lưu chuỗi dài) ---
app.post('/api/iot/add', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "Thiếu tham số 'data'" });
    handleTransaction(res, tplContract.addIoTData, data, "Thêm IoT Data thành công");
});

app.get('/api/iot/:index', (req, res) => {
    handleGetData(res, tplContract.getIoTData, req.params.index);
});


// --- 3. COLLECTION DATA (Lưu chuỗi dài) ---
app.post('/api/collection/add', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "Thiếu tham số 'data'" });
    handleTransaction(res, tplContract.addCollectionData, data, "Thêm Collection Data thành công");
});

app.get('/api/collection/:index', (req, res) => {
    handleGetData(res, tplContract.getCollectionData, req.params.index);
});


// --- 4. BACKUP DATA (Lưu chuỗi dài) ---
app.post('/api/backup/add', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "Thiếu tham số 'data'" });
    handleTransaction(res, tplContract.addBackupData, data, "Thêm Backup Data thành công");
});

app.get('/api/backup/:index', (req, res) => {
    handleGetData(res, tplContract.getBackupData, req.params.index);
});


// --- 5. PRIMARY DATA (Lưu chuỗi dài) ---
app.post('/api/primary/add', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "Thiếu tham số 'data'" });
    handleTransaction(res, tplContract.addPrimaryData, data, "Thêm Primary Data thành công");
});

app.get('/api/primary/:index', (req, res) => {
    handleGetData(res, tplContract.getPrimaryData, req.params.index);
});


// --- 6. API THỐNG KÊ (Lấy số lượng của tất cả các loại) ---
app.get('/api/counts', async (req, res) => {
    try {
        // Gọi hàm getDataCounts trả về 5 biến
        const counts = await tplContract.getDataCounts();
        
        res.status(200).json({
            contributions: Number(counts.contrib),
            iotData: Number(counts.iot),
            collectionData: Number(counts.col),
            backupData: Number(counts.back),
            primaryData: Number(counts.pri)
        });
    } catch (error) {
        console.error(`LỖI API /api/counts: ${error.message}`);
        res.status(500).json({ error: "Lỗi khi lấy thống kê", details: error.message });
    }
});


// --- KHỞI ĐỘNG SERVER ---
const PORT = 3005; // Bạn có thể đổi Port nếu muốn

async function startServer() {
    await initializeBlockchain();

    try {
        const network = await provider.getNetwork();
        
        console.log("==============================================");
        console.log(`✅ SERVER ĐÃ SẴN SÀNG TRÊN PORT ${PORT}`);
        console.log(`   Mạng: Pioné Zero (Chain ID: ${network.chainId})`);
        console.log(`   Người gửi (Sender): ${SENDER_ADDRESS}`);
        console.log("==============================================");
        console.log("DANH SÁCH API:");
        console.log(" 1. Contribution: POST /api/contributions/add | GET /api/contributions/:index");
        console.log(" 2. IoT Data:     POST /api/iot/add           | GET /api/iot/:index");
        console.log(" 3. Collection:   POST /api/collection/add    | GET /api/collection/:index");
        console.log(" 4. Backup Data:  POST /api/backup/add        | GET /api/backup/:index");
        console.log(" 5. Primary Data: POST /api/primary/add       | GET /api/primary/:index");
        console.log(" 6. Thống kê:     GET  /api/counts");
        console.log("==============================================");

        app.listen(PORT, () => {
            console.log(`Server đang lắng nghe tại http://localhost:${PORT}`);
        });
    } catch (e) {
        console.error("LỖI KHỞI ĐỘNG SERVER:", e.message);
        process.exit(1);
    }
}

startServer();