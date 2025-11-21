// Để chạy file này, bạn cần cài đặt: npm install express ethers dotenv
// Sau đó chạy bằng: node server.js

const express = require('express');
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
require('dotenv').config(); // Load biến môi trường từ .env

const app = express();
app.use(express.json()); // Middleware để phân tích body JSON

// --- CẤU HÌNH BLOCKCHAIN ---
const RPC_URL = "https://rpc.zeroscan.org";
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
// ======================================================================================
// ❗️ ĐÃ KHẮC PHỤC:
// Địa chỉ Contract TYTAgriSupplyChain THỰC TẾ (được Factory tạo) đã được tìm thấy qua Logs.
// Địa chỉ cũ là EOA và gây ra lỗi BAD_DATA.
// ======================================================================================
const SUPPLY_CHAIN_ADDRESS = "0xC360ad0e3767A9d05b8a7509b5CFE4113998098D"; // 👈 ĐỊA CHỈ CONTRACT CHÍNH XÁC ĐÃ ĐƯỢC CẬP NHẬT

// Kiểm tra Private Key ngay từ đầu
if (!PRIVATE_KEY) {
    console.error("==============================================");
    console.error("❌ LỖI KHỞI TẠO: PRIVATE_KEY không được tìm thấy. Ứng dụng dừng.");
    console.error("   Vui lòng kiểm tra file .env");
    console.error("==============================================");
    process.exit(1); 
}

// Khai báo biến toàn cục (Global variables)
let provider;
let wallet;
let SUPPLY_CHAIN_ABI;
let supplyChainContract;
let SENDER_ADDRESS;

// --- KHỞI TẠO VÀ XỬ LÝ LỖI KHỞI TẠO ---
async function initializeBlockchain() {
    try {
        // 1. Khởi tạo Provider và Wallet
        provider = new ethers.JsonRpcProvider(RPC_URL);
        // Khởi tạo ví từ Private Key
        wallet = new ethers.Wallet(PRIVATE_KEY, provider);

        // 2. Lấy ABI
        const abiPath = path.join(__dirname, 'artifacts', 'contracts', 'TYTAgriSupplyChain.sol', 'TYTAgriSupplyChain.json');
        
        if (!fs.existsSync(abiPath)) {
            throw new Error(`File ABI không tồn tại tại đường dẫn: ${abiPath}`);
        }

        const abiJson = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
        SUPPLY_CHAIN_ABI = abiJson.abi;
        
        // 3. Khởi tạo Contract Object
        // Khắc phục lỗi "bad address checksum" bằng cách đưa địa chỉ về dạng lowercase (từ Ethers v6)
        const lowerCaseAddress = SUPPLY_CHAIN_ADDRESS.toLowerCase();
        
        // Liên kết Contract với Wallet để có thể gửi giao dịch
        supplyChainContract = new ethers.Contract(lowerCaseAddress, SUPPLY_CHAIN_ABI, wallet);
        SENDER_ADDRESS = wallet.address;

    } catch (error) {
        console.error("==============================================");
        console.error("❌ LỖI KHỞI TẠO BLOCKCHAIN (Ứng dụng đã bị dừng):");
        console.error(`   Chi tiết: ${error.message}`);
        console.error("   Vui lòng kiểm tra:");
        console.error("   - PRIVATE_KEY có hợp lệ không (ví dụ: 'invalid hex string' nếu sai).");
        console.error("   - Đường dẫn file ABI có đúng không.");
        console.error("==============================================");
        process.exit(1); 
    }
}


// --- API 1: GHI DỮ LIỆU (POST/Transaction) ---

app.post('/api/product/add', async (req, res) => {
    /*
    Thêm Sản phẩm/Lô hàng mới vào Supply Chain.
    CẦN 3 THAM SỐ: productID, name, description.
    */
    const { productID, name, description } = req.body;

    if (!productID || !name || !description) {
        return res.status(400).json({ error: "Thiếu một trong các tham số: productID, name, hoặc description" });
    }

    try {
        // Cú pháp Ethers.js V6 CHUẨN: Gọi hàm contract trực tiếp
        // 1. Gửi giao dịch
        const tx = await supplyChainContract.addProduct(productID, name, description, {
            gasLimit: 3000000 // Đặt Gas Limit cố định (an toàn)
        });
        
        // 2. Chờ receipt (biên nhận)
        const receipt = await tx.wait();
        
        if (receipt.status === 0) {
            throw new Error(`Giao dịch thất bại trên chuỗi. Hash: ${receipt.hash}`);
        }

        res.status(200).json({
            message: "Thêm sản phẩm thành công",
            transactionHash: receipt.hash,
            productID: productID
        });

    } catch (error) {
        console.error(`LỖI GIAO DỊCH: ${error.message}`);
        res.status(500).json({ error: "Lỗi khi thêm sản phẩm", details: error.message });
    }
});

// --- API 2: LẤY DANH SÁCH (GET/Call) ---

app.get('/api/products', async (req, res) => {
    /*
    Lấy danh sách tất cả ID Sản phẩm đã được tạo.
    */
    try {
        // ĐÃ SỬA: Tên hàm từ getAllProductIDs -> getAllProductIds (Khớp với ABI)
        const productIds = await supplyChainContract.getAllProductIds(); 

        res.status(200).json({
            total: productIds.length,
            ids: productIds
        });

    } catch (error) {
        console.error(`LỖI ĐỌC: ${error.message}`);
        res.status(500).json({ error: "Lỗi khi lấy danh sách sản phẩm", details: error.message });
    }
});


// --- API 3: LẤY CHI TIẾT (GET/Call) ---

app.get('/api/product/:product_id', async (req, res) => {
    /*
    Lấy chi tiết thông tin của một Sản phẩm cụ thể.
    */
    const { product_id } = req.params;
    try {
        // Cú pháp Ethers.js V6 CHUẨN: Gọi hàm view/call trực tiếp
        // Hàm getProductInfo trả về 4 giá trị: [productId, productName, description, isActive] (Theo ABI)
        const productInfo = await supplyChainContract.getProductInfo(product_id);

        // Lấy 3 giá trị đầu tiên cho phản hồi (ID, Name, Description)
        const [productId, name, description, isActive] = productInfo;

        if (name === "") {
             return res.status(404).json({ error: `Không tìm thấy sản phẩm với ID: ${product_id}` });
        }
        
        // Lưu ý: ABI cho thấy getProductInfo KHÔNG trả về ownerAddress, 
        // nó trả về productId, productName, description, isActive.
        // Tôi sẽ sửa lại phản hồi để phản ánh đúng cấu trúc dữ liệu này.
        res.status(200).json({
            productID: productId,
            name: name,
            description: description,
            isActive: isActive 
        });
        
    } catch (error) {
        console.error(`LỖI ĐỌC CHI TIẾT: ${error.message}`);
        res.status(500).json({ error: "Lỗi khi lấy chi tiết sản phẩm", details: error.message });
    }
}
);

// --- KHỞI ĐỘNG SERVER ---
const PORT = 3000;

async function startServer() {
    // 1. Khởi tạo các đối tượng Blockchain
    await initializeBlockchain();

    try {
        // 2. Kiểm tra kết nối
        const network = await provider.getNetwork();
        
        console.log("==============================================");
        console.log(`✅ Đã kết nối thành công với mạng Pioné Zero. Chain ID: ${network.chainId}`);
        console.log(`   Địa chỉ gửi giao dịch: ${SENDER_ADDRESS}`);
        console.log(`   API đang chạy tại http://localhost:${PORT}`);
        console.log("==============================================");

        // 3. Chạy Server Express
        app.listen(PORT, () => {
            console.log(`Express server đã sẵn sàng.`);
        });
    } catch (e) {
        // Bắt lỗi kết nối mạng (Network) nếu có
        console.error("LỖI KHỞI TẠO SERVER:", e.message);
        console.error("Vui lòng kiểm tra RPC URL và kết nối mạng.");
        process.exit(1);
    }
}

startServer();
