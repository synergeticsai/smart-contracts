const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying BotAccount");

    // Deploy the contract
    const BotAccount = await ethers.getContractFactory("BotAccount");
    const botAccount = await BotAccount.deploy();

    console.log("BotAccount deployed to:", await botAccount.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

