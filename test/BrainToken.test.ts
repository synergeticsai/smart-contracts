import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers, network, upgrades } from "hardhat";
import { expect } from "chai";
import { ProxyFactory, Brain, Brain__factory } from "../typechain-types";
import { calculateProxyAddress } from "./utils/proxies";

describe("Brain Contract", function () {
  let brain: Brain;
  let proxyFactory: ProxyFactory;
  let owner: any, minter: any, pauser: any, user: any;
  const baseTokenURI = "QmExampleBaseURI/";

  async function deployBrainFixture() {
    [owner, minter, pauser, user] = await ethers.getSigners();

    const ProxyFactoryFactory = await ethers.getContractFactory("ProxyFactory");
    proxyFactory = await upgrades.deployProxy(
      ProxyFactoryFactory,
      [owner.address, owner.address],
      { initializer: "initialize" }
    );
    await proxyFactory.waitForDeployment();
    
    const brainImplementation: Brain = await new Brain__factory(owner).deploy();
    const singletonAddress = await brainImplementation.getAddress();

    await proxyFactory.updateSingletons(singletonAddress, singletonAddress);

    const saltNonce = 42;
    const collectionID = "12345";
    const pauserAddress = pauser.address;

    const initCode = brainImplementation.interface.encodeFunctionData(
      "initialize",
      [
        await proxyFactory.getAddress(),
        owner.address,
        minter.address,
        pauserAddress,
        baseTokenURI,
      ]
    );

    const collectionAddress = await calculateProxyAddress(
      proxyFactory,
      singletonAddress,
      initCode,
      saltNonce
    );

    await proxyFactory.createBrainProxyWithNonce(
      owner.address,
      minter.address,
      pauser.address,
      collectionID,
      baseTokenURI,
      saltNonce
    );

    brain = await ethers.getContractAt("Brain", collectionAddress);
    return { brain, proxyFactory, owner, minter, pauser, user };
  }

  beforeEach(async function () {
    ({ brain, proxyFactory, owner, minter, pauser, user } = await loadFixture(
      deployBrainFixture
    ));
  });

  it("should initialize with correct values", async function () {
    expect(await brain.hasRole(await brain.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
    expect(await brain.hasRole(await brain.BRAIN_MINTER_ROLE(), minter.address)).to.be.true;
    expect(await brain.hasRole(await brain.BRAIN_PAUSER_ROLE(), pauser.address)).to.be.true;
  });

  it("should allow minter to mint NFTs", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });
    expect(await brain.ownerOf(0)).to.equal(user.address);
  });

  it("should prevent unauthorized users from minting", async function () {
    await expect(
      brain.connect(user).safeMint(user.address, {
        subscriptionTierId: 1,
        subscriptionStatus: 1,
      })
    ).to.be.reverted;
  });

  it("should update subscription details correctly", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });
    await brain
      .connect(owner)
      .updateSubscription(0, { subscriptionTierId: 2, subscriptionStatus: 0 });
    const subscription = await brain.subscriptionInfo(0);
    expect(subscription.subscriptionTierId).to.equal(2);
    expect(subscription.subscriptionStatus).to.equal(0);
  });

  it("should pause and unpause contract", async function () {
    await brain.connect(pauser).pause();
    expect(await brain.paused()).to.be.true;
    await brain.connect(pauser).unpause();
    expect(await brain.paused()).to.be.false;
  });

  it("should allow linking and unlinking of bots", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });
    await brain.connect(owner).linkBot(1, 0);
    let bots = await brain.getLinkedBots(0);
    expect(bots.length).to.equal(1);
    expect(bots[0]).to.equal(1);

    await brain.connect(owner).unlinkBot(1, 0);
    bots = await brain.getLinkedBots(0);
    expect(bots.length).to.equal(0);
  });

  it("should allow only admin or owner to link bots", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });
    await expect(brain.connect(minter).linkBot(1, 0)).to.be.reverted;
  });

  it("should burn an NFT and remove ownership", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });
    await brain.connect(user).burn(0);
    await expect(brain.ownerOf(0)).to.be.revertedWith(
      "ERC721: invalid token ID"
    );
  });

  it("should correctly report supported interfaces", async function () {
    expect(await brain.supportsInterface("0x80ac58cd")).to.be.true; // ERC721
    expect(await brain.supportsInterface("0x780e9d63")).to.be.true; // ERC721Enumerable
    expect(await brain.supportsInterface("0x5b5e139f")).to.be.true; // ERC721Metadata
    expect(await brain.supportsInterface("0xffffffff")).to.be.false; // Invalid interface
  });

  it("should allow only admin or token owner to unlink multiple bots", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });

    await brain.connect(owner).linkBot(101, 0);
    await brain.connect(owner).linkBot(102, 0);
    await brain.connect(owner).linkBot(103, 0);

    let bots = await brain.getLinkedBots(0);
    expect(bots.length).to.equal(3);

    await brain.connect(user).unlinkBotBatch([101, 102], 0);

    bots = await brain.getLinkedBots(0);
    expect(bots).to.deep.equal([103]);

    await brain.connect(owner).unlinkBotBatch([103], 0);
    bots = await brain.getLinkedBots(0);
    expect(bots.length).to.equal(0);
  });

  it("should revert if unauthorized user tries to unlink bots", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });

    await brain.connect(owner).linkBot(101, 0);
    await brain.connect(owner).linkBot(102, 0);
    await expect(
      brain.connect(pauser).unlinkBotBatch([101, 102], 0)
    ).to.be.reverted;
  });

  it("should return correct token URI for an existing token", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });

    const tokenUri = await brain.tokenURI(0);
    expect(tokenUri).to.equal("ipfs://QmExampleBaseURI/");
  });

  it("should allow only admin or token owner to link multiple bots", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });

    await brain.connect(user).linkBotBatch([101, 102, 103], 0);

    let bots = await brain.getLinkedBots(0);
    expect(bots.length).to.equal(3);
    expect(bots).to.deep.equal([101, 102, 103]);
    await brain.connect(owner).linkBotBatch([104, 105], 0);

    bots = await brain.getLinkedBots(0);
    expect(bots).to.deep.equal([101, 102, 103, 104, 105]);
  });

  it("should revert if unauthorized user tries to link bots", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });

    await expect(
      brain.connect(pauser).linkBotBatch([101, 102], 0)
    ).to.be.reverted;
  });

  it("should allow only admin or token owner to unlink multiple bots", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });

    await brain.connect(user).linkBotBatch([101, 102, 103], 0);
    let bots = await brain.getLinkedBots(0);
    expect(bots.length).to.equal(3);
    await brain.connect(user).unlinkBotBatch([101, 102], 0);

    bots = await brain.getLinkedBots(0);
    expect(bots).to.deep.equal([103]);
    await brain.connect(owner).unlinkBotBatch([103], 0);
    bots = await brain.getLinkedBots(0);
    expect(bots.length).to.equal(0);
  });

  it("should revert if unauthorized user tries to unlink bots", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });

    await brain.connect(owner).linkBotBatch([101, 102], 0);
    await expect(
      brain.connect(pauser).unlinkBotBatch([101, 102], 0)
    ).to.be.reverted;
  });

  it("should handle unlinking an empty array without errors", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });

    await expect(brain.connect(owner).unlinkBotBatch([], 0)).to.not.be.reverted;
  });

  it("should not unlink a bot that was never linked", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });

    await brain.connect(owner).linkBotBatch([101, 102], 0);

    await expect(brain.connect(owner).unlinkBotBatch([101, 999], 0)).to.be.reverted;
  });

  it("should correctly iterate and unlink all bots", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });

    await brain.connect(owner).linkBotBatch([101, 102, 103, 104], 0);

    await brain.connect(owner).unlinkBotBatch([101, 102, 103, 104], 0);

    let bots = await brain.getLinkedBots(0);
    expect(bots.length).to.equal(0); 
  });

  it("should revert if trying to unlink bots for a non-existent token", async function () {
    await expect(
      brain.connect(user).unlinkBotBatch([101, 102], 999)
    ).to.be.reverted;
  });

  it("should update subscription status correctly", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });

    await brain.connect(owner).updateSubscriptionStatus(0, 0);

    const subscription = await brain.subscriptionInfo(0);
    expect(subscription.subscriptionStatus).to.equal(0);
  });

  it("should revert if trying to update subscription status of a non-existent token", async function () {
    await expect(
      brain.connect(owner).updateSubscriptionStatus(999, 1)
    ).to.be.reverted;
  });

  it("should revert if updating to the same subscription status", async function () {
    await brain
      .connect(minter)
      .safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });

    await expect(
      brain.connect(owner).updateSubscriptionStatus(0, 1)
    ).to.be.reverted;
  });

  it("should revert if non-admin tries to update subscription", async function () {
    const tokenId = 0;
    const subscription = { subscriptionTierId: 1, subscriptionStatus: 1 };
    await brain.connect(minter).safeMint(user.address, subscription);
    const newSubscription = { subscriptionTierId: 2, subscriptionStatus: 0 };
    await expect(
      brain.connect(user).updateSubscription(tokenId, newSubscription)
    ).to.be.reverted;
  });

  it("should revert when linking the same bot twice", async function () {
    await brain.connect(minter).safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });
  
    await brain.connect(owner).linkBot(101, 0);
  
    await expect(brain.connect(owner).linkBot(101, 0)).to.be.revertedWith("Bot is already linked to the brain");
  });

  it("should revert when updating subscription of a burned token", async function () {
    await brain.connect(minter).safeMint(user.address, { subscriptionTierId: 1, subscriptionStatus: 1 });
  
    await brain.connect(user).burn(0);
  
    await expect(
      brain.connect(owner).updateSubscription(0, { subscriptionTierId: 2, subscriptionStatus: 0 })
    ).to.be.revertedWith("Brain: token does not exist");
  });

  it("should revert when unlinking a bot that is not linked", async function () {
    await expect(brain.connect(owner).unlinkBot(999, 0)).to.be.reverted;
  });

  it("should prevent re-initialization", async function () {
    await expect(
      brain.initialize(
        await proxyFactory.getAddress(),
        owner.address,
        minter.address,
        pauser.address,
        baseTokenURI
      )
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("should allow only pauser to pause/unpause", async function () {
    await expect(brain.connect(user).pause()).to.be.reverted;
    await expect(brain.connect(owner).unpause()).to.be.reverted;
  });

  it("should return the correct chain ID", async function () {
    const chainId = await proxyFactory.getChainId();
    expect(chainId).to.equal(network.config.chainId);
  });

});
