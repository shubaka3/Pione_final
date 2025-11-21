const { ethers, run, network } = require("hardhat");
const { developmentChains, blockConfirmation } = require("../helper-hardhat-config");
require("dotenv").config();

const EXPLORER_API_KEY = process.env.EXPLORER_API_KEY || "";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());
    console.log("Network:", network.name);

    // Deploy DemoFarmTraceabilityFactory
    console.log("Deploying DemoFarmTraceabilityFactory...");
    const DemoFarmTraceabilityFactory = await ethers.getContractFactory("DemoFarmTraceabilityFactory");
    const factory = await DemoFarmTraceabilityFactory.deploy();

    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();

    console.log("DemoFarmTraceabilityFactory deployed to:", factoryAddress);
    console.log("Transaction hash:", factory.deploymentTransaction().hash);

    // Wait for block confirmations before verification
    if (!developmentChains.includes(network.name) && EXPLORER_API_KEY) {
        const confirmations = blockConfirmation[network.name] || 6;
        console.log(`Waiting for ${confirmations} block confirmations...`);

        await factory.deploymentTransaction().wait(confirmations);
        console.log("Block confirmations completed. Starting verification...");

        // Verify contract
        try {
            await run("verify:verify", {
                address: factoryAddress,
                contract: `contracts/DemoFarmTraceabilityFactory.sol:DemoFarmTraceabilityFactory`,
                constructorArguments: [],
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

    console.log("Deployment completed!");
    console.log("Factory Address:", factoryAddress);
    console.log("Owner:", await factory.owner());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });