const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying UserAccount");

    // Deploy the contract
    const UserAccount = await ethers.getContractFactory("UserAccount");
    const userAccount = await UserAccount.deploy();

    console.log("UserAccount deployed to:", await userAccount.getAddress());
} 

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
