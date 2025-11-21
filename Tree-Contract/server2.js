// Để chạy file này, bạn cần cài đặt: npm install express ethers dotenv
// Sau đó chạy bằng: node server.js

const express = require('express');
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
require('dotenv').config(); // Load biến môi trường từ .env

const cors = require('cors');

const app = express();

app.use(cors()); 


app.use(express.json()); // Middleware để phân tích body JSON

// --- CẤU HÌNH BLOCKCHAIN ---
const RPC_URL = "https://rpc.zeroscan.org";
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
// ======================================================================================
// ĐỊA CHỈ CONTRACT CHÍNH XÁC ĐANG ĐƯỢC SỬ DỤNG
// ======================================================================================
const SUPPLY_CHAIN_ADDRESS = "0xC360ad0e3767A9d05b8a7509b5CFE4113998098D"; 

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
        wallet = new ethers.Wallet(PRIVATE_KEY, provider);

        // 2. Lấy ABI (Giả định file ABI của Contract TYTAgriSupplyChain đã tồn tại)
        const abiPath = path.join(__dirname, 'artifacts', 'contracts', 'TYTAgriSupplyChain.sol', 'TYTAgriSupplyChain.json');
        
        if (!fs.existsSync(abiPath)) {
            throw new Error(`File ABI không tồn tại tại đường dẫn: ${abiPath}`);
        }

        const abiJson = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
        SUPPLY_CHAIN_ABI = abiJson.abi;
        
        // 3. Khởi tạo Contract Object
        const lowerCaseAddress = SUPPLY_CHAIN_ADDRESS.toLowerCase();
        supplyChainContract = new ethers.Contract(lowerCaseAddress, SUPPLY_CHAIN_ABI, wallet);
        SENDER_ADDRESS = wallet.address;

    } catch (error) {
        console.error("==============================================");
        console.error("❌ LỖI KHỞI TẠO BLOCKCHAIN (Ứng dụng đã bị dừng):");
        console.error(`   Chi tiết: ${error.message}`);
        console.error("==============================================");
        process.exit(1); 
    }
}

// ======================================================================================
//             API CƠ BẢN: QUẢN LÝ SẢN PHẨM
// ======================================================================================

// --- API 1: THÊM SẢN PHẨM (addProduct) ---
app.post('/api/product/add', async (req, res) => {
    const { productID, name, description } = req.body;
    if (!productID || !name || !description) {
        return res.status(400).json({ error: "Thiếu các tham số: productID, name, hoặc description" });
    }
    try {
        const tx = await supplyChainContract.addProduct(productID, name, description, { gasLimit: 3000000 });
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
        console.error(`LỖI API 1: ${error.message}`);
        res.status(500).json({ error: "Lỗi khi thêm sản phẩm", details: error.message });
    }
});

// --- API 2: LẤY DANH SÁCH & CHI TIẾT TẤT CẢ SẢN PHẨM (getAllProductIds + getProductInfo) ---
app.get('/api/products', async (req, res) => {
    try {
        const productIds = await supplyChainContract.getAllProductIds(); 
        const detailPromises = productIds.map(async (id) => {
            try {
                // getProductInfo trả về: [productId, productName, description, isActive]
                const productInfo = await supplyChainContract.getProductInfo(id);
                const [productId, name, description, isActive] = productInfo;
                return { productID: productId, name: name, description: description, isActive: isActive };
            } catch (detailError) {
                console.warn(`Cảnh báo: Không thể lấy chi tiết cho ID ${id}. Lỗi: ${detailError.message}`);
                return null; 
            }
        });
        
        const results = await Promise.all(detailPromises);
        const validProducts = results.filter(p => p !== null);

        res.status(200).json({
            total: validProducts.length,
            products: validProducts 
        });
    } catch (error) {
        console.error(`LỖI API 2: ${error.message}`);
        res.status(500).json({ error: "Lỗi khi lấy danh sách sản phẩm", details: error.message });
    }
});

// --- API 3: LẤY CHI TIẾT CỦA MỘT SẢN PHẨM (getProductInfo) ---
app.get('/api/product/:product_id', async (req, res) => {
    const { product_id } = req.params;
    try {
        // getProductInfo trả về: [productId, productName, description, isActive]
        const productInfo = await supplyChainContract.getProductInfo(product_id);
        const [productId, name, description, isActive] = productInfo;

        if (name === "") {
             return res.status(404).json({ error: `Không tìm thấy sản phẩm với ID: ${product_id}` });
        }
        
        res.status(200).json({
            productID: productId,
            name: name,
            description: description,
            isActive: isActive 
        });
    } catch (error) {
        console.error(`LỖI API 3: ${error.message}`);
        res.status(500).json({ error: "Lỗi khi lấy chi tiết sản phẩm", details: error.message });
    }
});


// ======================================================================================
//             API QUẢN LÝ VÒNG ĐỜI SẢN PHẨM
// ======================================================================================

// --- API 4: VÔ HIỆU HÓA SẢN PHẨM (deactivateProduct) ---
app.post('/api/product/deactivate', async (req, res) => {
    const { productID } = req.body;
    if (!productID) {
        return res.status(400).json({ error: "Thiếu tham số: productID" });
    }
    try {
        const tx = await supplyChainContract.deactivateProduct(productID, { gasLimit: 3000000 });
        const receipt = await tx.wait();
        res.status(200).json({
            message: `Sản phẩm ${productID} đã được vô hiệu hóa thành công.`,
            transactionHash: receipt.hash
        });
    } catch (error) {
        console.error(`LỖI API 4: ${error.message}`);
        res.status(500).json({ error: "Lỗi khi vô hiệu hóa sản phẩm", details: error.message });
    }
});

// --- API 5: KÍCH HOẠT LẠI SẢN PHẨM (reactivateProduct) ---
app.post('/api/product/reactivate', async (req, res) => {
    const { productID } = req.body;
    if (!productID) {
        return res.status(400).json({ error: "Thiếu tham số: productID" });
    }
    try {
        const tx = await supplyChainContract.reactivateProduct(productID, { gasLimit: 3000000 });
        const receipt = await tx.wait();
        res.status(200).json({
            message: `Sản phẩm ${productID} đã được kích hoạt lại thành công.`,
            transactionHash: receipt.hash
        });
    } catch (error) {
        console.error(`LỖI API 5: ${error.message}`);
        res.status(500).json({ error: "Lỗi khi kích hoạt lại sản phẩm", details: error.message });
    }
});

// ======================================================================================
//             API CẬP NHẬT DỮ LIỆU CHUỖI CUNG ỨNG (THEO LÔ HÀNG)
// ======================================================================================

// --- API 6: CẬP NHẬT QUY TRÌNH (updateProductProcesses) ---
app.post('/api/product/update/processes', async (req, res) => {
    const { productID, batch, newProcesses } = req.body; // newProcesses là string chứa dữ liệu quy trình
    if (!productID || !batch || !newProcesses) {
        return res.status(400).json({ error: "Thiếu các tham số: productID, batch, hoặc newProcesses" });
    }
    try {
        const tx = await supplyChainContract.updateProductProcesses(productID, batch, newProcesses, { gasLimit: 3000000 });
        const receipt = await tx.wait();
        res.status(200).json({
            message: `Cập nhật quy trình thành công cho lô hàng ${batch} của sản phẩm ${productID}.`,
            transactionHash: receipt.hash
        });
    } catch (error) {
        console.error(`LỖI API 6: ${error.message}`);
        res.status(500).json({ error: "Lỗi khi cập nhật quy trình", details: error.message });
    }
});

// --- API 7: CẬP NHẬT TRẠNG THÁI (updateProductStatus) ---
app.post('/api/product/update/status', async (req, res) => {
    const { productID, batch, newStatus } = req.body; // newStatus là string chứa trạng thái mới
    if (!productID || !batch || !newStatus) {
        return res.status(400).json({ error: "Thiếu các tham số: productID, batch, hoặc newStatus" });
    }
    try {
        const tx = await supplyChainContract.updateProductStatus(productID, batch, newStatus, { gasLimit: 3000000 });
        const receipt = await tx.wait();
        res.status(200).json({
            message: `Cập nhật trạng thái thành công cho lô hàng ${batch} của sản phẩm ${productID}.`,
            transactionHash: receipt.hash
        });
    } catch (error) {
        console.error(`LỖI API 7: ${error.message}`);
        res.status(500).json({ error: "Lỗi khi cập nhật trạng thái", details: error.message });
    }
});

// --- API 8: LẤY DANH SÁCH LÔ HÀNG (getProductBatches) ---
app.get('/api/product/batches/:product_id', async (req, res) => {
    const { product_id } = req.params;
    try {
        // getProductBatches trả về một mảng các string (IDs lô hàng)
        const batches = await supplyChainContract.getProductBatches(product_id); 
        
        res.status(200).json({
            productID: product_id,
            totalBatches: batches.length,
            batches: batches 
        });
        
    } catch (error) {
        console.error(`LỖI API 8: ${error.message}`);
        res.status(500).json({ error: "Lỗi khi lấy danh sách lô hàng", details: error.message });
    }
}
);

// --- API 11: LẤY CHI TIẾT LỊCH SỬ LÔ HÀNG (getProductByBatch) ---
app.get('/api/product/:product_id/batch/:batch_id', async (req, res) => {
    const { product_id, batch_id } = req.params;
    try {
        // getProductByBatch trả về mảng lịch sử (History[]) cho lô hàng cụ thể
        const batchHistory = await supplyChainContract.getProductByBatch(product_id, batch_id);

        if (batchHistory.length === 0) {
            // Trường hợp lô hàng tồn tại nhưng chưa có sự kiện nào được ghi 
            // hoặc ID không tồn tại
            return res.status(404).json({ 
                error: `Không tìm thấy lịch sử chi tiết cho Lô hàng ID: ${batch_id} của Sản phẩm ID: ${product_id}.`,
                suggestion: "Kiểm tra lại ProductID và BatchID. Nếu lô hàng mới tạo, hãy đảm bảo đã có ít nhất một lần cập nhật trạng thái/quy trình (API 6 hoặc 7)."
            });
        }

        res.status(200).json({
            productID: product_id,
            batchID: batch_id,
            totalEvents: batchHistory.length,
            history: batchHistory // Trả về mảng lịch sử thô (raw array) từ Contract
        });
        
    } catch (error) {
        console.error(`LỖI API 11: ${error.message}`);
        res.status(500).json({ error: "Lỗi khi lấy chi tiết lịch sử lô hàng", details: error.message });
    }
});

// ======================================================================================
//             API TRUY VẤN THÔNG TIN CONTRACT
// ======================================================================================

// --- API 9: XEM ID CÔNG TY (companyId) ---
app.get('/api/info/companyid', async (req, res) => {
    try {
        // companyId trả về bytes32
        const companyIdBytes = await supplyChainContract.companyId(); 
        
        // Chuyển đổi bytes32 sang string (nếu nó là ID dạng hex)
        // Nếu ID được lưu dưới dạng bytes32 không phải là chuỗi UTF-8, nó sẽ hiển thị dưới dạng hex.
        const companyIdHex = companyIdBytes; 

        res.status(200).json({
            message: "Thông tin ID Công ty",
            companyId: companyIdHex
        });

    } catch (error) {
        console.error(`LỖI API 9: ${error.message}`);
        res.status(500).json({ error: "Lỗi khi lấy ID công ty", details: error.message });
    }
});

// --- API 10: XEM CHỦ SỞ HỮU CONTRACT (companyOwner) ---
app.get('/api/info/owner', async (req, res) => {
    try {
        // companyOwner trả về địa chỉ (address)
        const ownerAddress = await supplyChainContract.companyOwner(); 

        res.status(200).json({
            message: "Thông tin chủ sở hữu Contract",
            owner: ownerAddress
        });

    } catch (error) {
        console.error(`LỖI API 10: ${error.message}`);
        res.status(500).json({ error: "Lỗi khi lấy thông tin chủ sở hữu", details: error.message });
    }
});

// --- API 12: CẤP QUYỀN QUẢN LÝ SẢN PHẨM (addProductManager) ---
// CHỈ CHỦ SỞ HỮU (Owner/Admin) MỚI CÓ THỂ GỌI HÀM NÀY
// Hàm này cấp vai trò PRODUCT_MANAGER_ROLE cho một địa chỉ.
app.post('/api/access/add-manager', async (req, res) => {
    const { managerAddress } = req.body;
    if (!managerAddress || !ethers.isAddress(managerAddress)) {
        return res.status(400).json({ error: "Thiếu hoặc địa chỉ ví Quản lý không hợp lệ." });
    }
    try {
        // Giao dịch này cần được ký bởi ví Chủ sở hữu/Admin (SENDER_ADDRESS)
        const tx = await supplyChainContract.addProductManager(managerAddress, { gasLimit: 3000000 });
        const receipt = await tx.wait();

        res.status(200).json({
            message: `Địa chỉ ${managerAddress} đã được cấp vai trò PRODUCT_MANAGER_ROLE thành công.`,
            transactionHash: receipt.hash,
            managerAdded: managerAddress
        });
    } catch (error) {
        // Lỗi thường gặp: AccessControlUnauthorizedAccount (Revert reason)
        console.error(`LỖI API 12 (Phân quyền Product Manager): ${error.message}`);
        let errorMessage = "Lỗi khi cấp quyền Quản lý. Kiểm tra xem bạn có đang sử dụng ví Owner/Admin không.";
        if (error.message.includes("AccessControlUnauthorizedAccount")) {
             errorMessage = "LỖI PHÂN QUYỀN: Ví đang dùng không có vai trò DEFAULT_ADMIN_ROLE (Chủ sở hữu Contract).";
        }
        res.status(500).json({ error: errorMessage, details: error.message });
    }
});

// --- KHỞI ĐỘNG SERVER ---
const PORT = 3000;

async function startServer() {
    await initializeBlockchain();

    try {
        const network = await provider.getNetwork();
        
        console.log("==============================================");
        console.log(`✅ Đã kết nối thành công với mạng Pioné Zero. Chain ID: ${network.chainId}`);
        console.log(`   Địa chỉ gửi giao dịch: ${SENDER_ADDRESS}`);
        console.log(`   Contract đang sử dụng: ${SUPPLY_CHAIN_ADDRESS}`);
        console.log(`   API đang chạy tại http://localhost:${PORT}`);
        console.log("==============================================");
        console.log("Tổng cộng 10 API Endpoint đã được khởi tạo.");
        console.log("Các API mới tập trung vào Quản lý Vòng đời và Cập nhật Lô hàng (Batch).");
        console.log("==============================================");

        app.listen(PORT, () => {
            console.log(`Express server đã sẵn sàng.`);
        });
    } catch (e) {
        console.error("LỖI KHỞI TẠO SERVER:", e.message);
        console.error("Vui lòng kiểm tra RPC URL và kết nối mạng.");
        process.exit(1);
    }
}

startServer();
