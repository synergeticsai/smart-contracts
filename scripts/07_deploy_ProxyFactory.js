const { ethers } = require("hardhat");
const { calculateProxyAddress } = require("../test/utils/proxies");

async function main() {
    console.log("Deploying ProxyFactory");

    const admin = "0x144363edE7995A990dF9AfBFaE39C5f1297E9743";
    const accessControlRegistry = "0xC19754C979697D6465B28Df027D57D37eEF8cb3c";

    // Deploy the contract
    const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
    // const proxyFactory = await ProxyFactory.deploy(admin, accessControlRegistry);

    const proxyFactory = await ethers.getContractAt("ProxyFactory", "0xbbc9688f8Ef4fa0EFB7F4E88d4B1A2c2884989C6");

    console.log("ProxyFactory deployed to:", await proxyFactory.getAddress());

    // Update Brain and Wearable Singletons
    const brainSingleton = "0xa6E3EDD567980b390Dd0a57215A1EB6ECde9AeD9"
    const wearableSingleton = "0x83980275145eF8260926Af65fb738c8b5fcE0506"

    await proxyFactory.updateSingletons(brainSingleton, wearableSingleton)

    const params = {
        defaultAdmin: "0x144363edE7995A990dF9AfBFaE39C5f1297E9743",
        minter: "0x144363edE7995A990dF9AfBFaE39C5f1297E9743",
        pauser: "0x144363edE7995A990dF9AfBFaE39C5f1297E9743",
        collectionId: "1",
        saltNonce: 100,
        tokenId: 1,
        mintTo: "0x144363edE7995A990dF9AfBFaE39C5f1297E9743",
        tokenURI: "QmanvuiJ2yjwNUHjJooQJ8M2LWK3ZF348cr4QCM9jgyrfY",
        subscriptionId: 123456,
        subscriptionStatus: 1
    }

    // const { defaultAdmin, minter, pauser, saltNonce, collectionId, tokenURI } = params;
    // const { mintTo, subscriptionId, subscriptionStatus } = params;

    // // Deploying Brain Proxy
    // const deployBrainTransaction = await proxyFactory.createBrainProxyWithNonce(defaultAdmin, minter, pauser, collectionId, tokenURI, saltNonce)
    // const deployBrainTransactionReceipt = await deployBrainTransaction.wait();
    // console.log("deployBrainTransactionReceipt logs", deployBrainTransactionReceipt);

    // // Get Deployed Brain
    // const Brain = await ethers.getContractFactory("Brain");
    // const initCodeBrain = Brain.interface.encodeFunctionData("initialize", [defaultAdmin, minter, pauser, tokenURI]);
    // const deployedBrainAddress = await calculateProxyAddress(proxyFactory, brainSingleton, initCodeBrain, saltNonce);
    // const brainToken = await ethers.getContractAt("Brain", deployedBrainAddress);

    // // Mint Brain Token
    // console.log("Minting Brain Token");
    // const brainTokenMintTransaction = await brainToken.safeMint(mintTo, [subscriptionId, subscriptionStatus]);
    // const brainTokenMintTxnReceipt = await brainTokenMintTransaction.wait();

    // // Fetching Balance
    // const accountBrainBalance = await brainToken.balanceOf(mintTo);
    // console.log(`balance of ${mintTo} is ${accountBrainBalance}`);

    // // Deploying Wearable Proxy
    // const deployWearableTransaction = await proxyFactory.createWearableProxyWithNonce(defaultAdmin, minter, pauser, collectionId, saltNonce)
    // const deployWearableTransactionReceipt = await deployWearableTransaction.wait();
    // console.log("deployWearableTransactionReceipt logs", deployWearableTransactionReceipt);

    // // Get Deployed Wearable
    // const Wearable = await ethers.getContractFactory("Wearable");
    // const initCodeWearable = Wearable.interface.encodeFunctionData("initialize", [defaultAdmin, minter, pauser]);
    // const deployedWearableAddress = await calculateProxyAddress(proxyFactory, wearableSingleton, initCodeWearable, saltNonce);
    // const wearableToken = await ethers.getContractAt("Wearable", deployedWearableAddress);

    // // Mint Wearable Token
    // console.log("Minting Wearable Token");
    // const wearableTokenMintTransaction = await wearableToken.safeMint(mintTo, tokenURI);
    // const wearableTokenMintTxnReceipt = await wearableTokenMintTransaction.wait();

    // // Fetching Wearable Balance
    // const accountWearableBalance = await wearableToken.balanceOf(mintTo);
    // console.log(`Wearable balance of ${mintTo} is ${accountWearableBalance}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
