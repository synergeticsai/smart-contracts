const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying BrainToken");

    // Deploy the contract
    const Brain = await ethers.getContractFactory("Brain");
    const brainToken = await Brain.deploy();

    console.log("Brain deployed to:", await brainToken.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });




