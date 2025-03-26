const { ethers } = require("hardhat");

async function main() {
    console.log("Deploying AccessControlRegistry");

    const defaultAdmin = "0x144363edE7995A990dF9AfBFaE39C5f1297E9743";
    const relayer = "0xC54428850De98825eEA729DdA236b867533A1fD1";

    console.log("Deploying AccessControlRegistry with the following parameters:");
    console.log("Default Admin:", defaultAdmin);
    console.log("Relayer:", relayer);

    // Deploy the contract
    const AccessControlRegistry = await ethers.getContractFactory("AccessControlRegistry");
    const AccessControlRegistryDeployed = await AccessControlRegistry.deploy(defaultAdmin, relayer);

    console.log("AccessControlRegistry deployed to:", await AccessControlRegistryDeployed.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });