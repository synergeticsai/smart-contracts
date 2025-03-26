const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying UnifyToken");

    const admin = "0x144363edE7995A990dF9AfBFaE39C5f1297E9743";

    console.log("Deploying UnifyToken with the following parameters:");
    console.log("Admin:", admin);

    // Deploy the contract
    const UnifyToken = await ethers.getContractFactory("UnifyToken");
    const unifyToken = await UnifyToken.deploy(admin);

    console.log("UnifyToken deployed to:", await unifyToken.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
