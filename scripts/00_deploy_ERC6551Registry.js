const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying erc6551Registry");

    // Deploy the contract
    const ERC6551Registry = await ethers.getContractFactory("ERC6551Registry");
    const erc6551Registry = await ERC6551Registry.deploy();

    console.log("ERC6551Registry deployed to:", await erc6551Registry.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

