const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying WearableToken");

    // Deploy the contract
    const Wearable = await ethers.getContractFactory("Wearable");
    const wearableToken = await Wearable.deploy();

    console.log("Wearable deployed to:", await wearableToken.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

