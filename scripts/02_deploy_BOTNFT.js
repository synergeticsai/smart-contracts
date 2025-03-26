const { ethers } = require("hardhat");

async function main() {

    // Set the parameters 
    const admin = "0x144363edE7995A990dF9AfBFaE39C5f1297E9743";
    const minter = "0x8A6Ec2DeB81E431F1a64F4c4512e2629a2E60e9D";
    const erc6551Registry = "0x9eA55702eE36f7cA425B003A139F21542C1f1A7B";
    const erc6551Account = "0xae8c656ad28F2B59a196AB61815C16A0AE1c3cba";

    console.log("Deploying Bot with the following parameters:");
    console.log("Admin:", admin);
    console.log("Minter:", minter);
    console.log("erc6551Registry:", erc6551Registry);
    console.log("erc6551Account:", erc6551Account);

    // Deploy the contract
    const Bot = await ethers.getContractFactory("Bot");
    const bot = await Bot.deploy(admin, minter, erc6551Registry, erc6551Account);

    console.log("Bot deployed to:", await bot.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
