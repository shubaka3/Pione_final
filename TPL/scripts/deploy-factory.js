const { ethers, run, network } = require("hardhat");
// Đảm bảo file helper-hardhat-config tồn tại trong dự án của bạn
const { developmentChains, blockConfirmation } = require("../helper-hardhat-config");
require("dotenv").config();

const EXPLORER_API_KEY = process.env.EXPLORER_API_KEY || "";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    
    // Kiểm tra số dư
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("Account balance:", balance.toString());
    console.log("Network:", network.name);

    // --- BẮT ĐẦU DEPLOY TPLContract ---
    console.log("Deploying TPLContract...");
    
    // 1. Lấy Contract Factory
    const TPLContractFactory = await ethers.getContractFactory("TPLContract");
    
    // 2. Deploy (Không có tham số constructor)
    const tplContract = await TPLContractFactory.deploy(); 

    // 3. Chờ deployment hoàn tất
    await tplContract.waitForDeployment();
    
    // 4. Lấy địa chỉ
    const tplContractAddress = await tplContract.getAddress(); 

    console.log("TPLContract deployed to:", tplContractAddress);
    console.log("Transaction hash:", tplContract.deploymentTransaction().hash);

    // --- XÁC THỰC CONTRACT (VERIFY) ---
    // Chỉ chạy khi không phải mạng local và có API Key
    if (!developmentChains.includes(network.name) && EXPLORER_API_KEY) {
        const confirmations = blockConfirmation[network.name] || 6;
        console.log(`Waiting for ${confirmations} block confirmations...`);

        // Chờ đủ số block để Explorer cập nhật
        await tplContract.deploymentTransaction().wait(confirmations); 
        console.log("Block confirmations completed. Starting verification...");

        // Verify contract
        try {
            await run("verify:verify", {
                address: tplContractAddress,
                // Đường dẫn chính xác tới file contract
                contract: `contracts/TPLContract.sol:TPLContract`, 
                constructorArguments: [], // Constructor của TPLContract không có tham số
            });
            console.log("Contract verified successfully!");
        } catch (error) {
            if (error.message.toLowerCase().includes("already verified")) {
                console.log("Contract already verified!");
            } else {
                console.log("Verification failed:", error.message);
            }
        }
    } else if (developmentChains.includes(network.name)) {
        console.log("Local network detected. Skipping verification.");
    } else {
        console.log("EXPLORER_API_KEY not found. Skipping verification.");
    }

    console.log("----------------------------------------------------");
    console.log("Deployment completed!");
    console.log("TPLContract Address:", tplContractAddress);
    
    // Kiểm tra Owner (để chắc chắn contract hoạt động)
    try {
        const owner = await tplContract.owner();
        console.log("Owner:", owner);
    } catch (e) {
        console.log("Could not fetch owner (Contract might not be ready yet).");
    }
    console.log("----------------------------------------------------");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });