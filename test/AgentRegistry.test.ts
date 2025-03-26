import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { ethers } from "hardhat";
import { expect } from "chai";
import { AgentRegistry, AgentRegistry__factory } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("AgentRegistry", function () {
  async function generatePublicKey(
    wallet: HardhatEthersSigner | any
  ): Promise<string> {
    const message = wallet.target? wallet.runner.address: wallet.address;
    const digest = ethers.hashMessage(message);
    const sig = wallet.target?await wallet.runner.signMessage(message) : await wallet.signMessage(message);
    const pk = ethers.SigningKey.recoverPublicKey(digest, sig);
    return "0x" + pk.slice(4);
  }

  async function deployAgentRegistryFixture() {
    const [deployer, agent1, agent2, unregistered, smartAccount] =
      await ethers.getSigners();

    const agentRegistry: AgentRegistry = await new AgentRegistry__factory(
      deployer
    ).deploy();
    
    return {
      agentRegistry,
      deployer,
      agent1,
      agent2,
      unregistered,
      smartAccount,
    };
  }

  it("should allow an agent to register successfully", async function () {
    const { agentRegistry, agent1 } = await loadFixture(
      deployAgentRegistryFixture
    );

    const publicKey = ethers.getBytes(await generatePublicKey(agent1));

    await expect(
      agentRegistry
        .connect(agent1)
        .registerAgent(
          "AI Model",
          ["Addon1", "Addon2"],
          ["v1.0"],
          "Tag1,Tag2",
          true,
          publicKey
        )
    )
      .to.emit(agentRegistry, "AgentRegistered")
      .withArgs(agent1.address);

    expect(await agentRegistry.isRegistered(agent1.address)).to.be.true;
  });

  it("should not allow duplicate registration", async function () {
    const { agentRegistry, agent1 } = await loadFixture(
      deployAgentRegistryFixture
    );
    const publicKey = ethers.getBytes(await generatePublicKey(agent1));

    await agentRegistry
      .connect(agent1)
      .registerAgent("AI Model", ["Addon1"], ["v1.0"], "Tag1", true, publicKey);

    await expect(
      agentRegistry
        .connect(agent1)
        .registerAgent(
          "AI Model",
          ["Addon1"],
          ["v1.0"],
          "Tag1",
          true,
          publicKey
        )
    ).to.be.revertedWith("AgentRegistry: agent already registered");
  });

  it("should allow an agent to update availability", async function () {
    const { agentRegistry, agent1 } = await loadFixture(
      deployAgentRegistryFixture
    );
    const publicKey = ethers.getBytes(await generatePublicKey(agent1));

    await agentRegistry
      .connect(agent1)
      .registerAgent("AI Model", ["Addon1"], ["v1.0"], "Tag1", true, publicKey);
    await expect(agentRegistry.connect(agent1).updateAvailability(false))
      .to.emit(agentRegistry, "StatusChanged")
      .withArgs(agent1.address, false);
  });

  it("should allow an agent to update addons", async function () {
    const { agentRegistry, agent1 } = await loadFixture(
      deployAgentRegistryFixture
    );
    const publicKey = ethers.getBytes(await generatePublicKey(agent1));

    await agentRegistry
      .connect(agent1)
      .registerAgent("AI Model", ["Addon1"], ["v1.0"], "Tag1", true, publicKey);
    await expect(
      agentRegistry.connect(agent1).updateAddon(["AddonX", "AddonY"])
    )
      .to.emit(agentRegistry, "AgentAddonListUpdated")
      .withArgs(agent1.address);
  });

  it("should revert if an unregistered agent tries to update availability", async function () {
    const { agentRegistry, unregistered } = await loadFixture(
      deployAgentRegistryFixture
    );
    await expect(
      agentRegistry.connect(unregistered).updateAvailability(false)
    ).to.be.revertedWith("AgentRegistry: only registered agents");
  });

  it("should correctly compute Ethereum address from public key", async function () {
    const { agentRegistry, agent1 } = await loadFixture(
      deployAgentRegistryFixture
    );
    const publicKey = ethers.getBytes(await generatePublicKey(agent1));
    const computedAddress = await agentRegistry.computeAddressFromPublicKey(
      publicKey
    );
    expect(computedAddress).to.be.properAddress;
  });

  it("should revert if querying details for an unregistered agent", async function () {
    const { agentRegistry, unregistered } = await loadFixture(
      deployAgentRegistryFixture
    );
    await expect(
      agentRegistry.agentDetails(unregistered.address)
    ).to.be.revertedWith("AgentRegistry: agent not registered");
  });

  it("should reject registration if public key verification fails", async function () {
    const { agentRegistry, agent1 } = await loadFixture(
      deployAgentRegistryFixture
    );
    const invalidPublicKey = ethers.randomBytes(64);

    await expect(
      agentRegistry
        .connect(agent1)
        .registerAgent(
          "AI Model",
          ["Addon1"],
          ["v1.0"],
          "Tag1",
          true,
          invalidPublicKey
        )
    ).to.be.revertedWith("AgentRegistry: Public key verification failed");
  });

  it("should register an agent successfully with a valid public key", async function () {
    const { agentRegistry, agent1 } = await loadFixture(
      deployAgentRegistryFixture
    );
    const publicKey = ethers.getBytes(await generatePublicKey(agent1));

    await expect(
      agentRegistry
        .connect(agent1)
        .registerAgent(
          "AI Model",
          ["Addon1"],
          ["v1.0"],
          "Tag1",
          true,
          publicKey
        )
    )
      .to.emit(agentRegistry, "AgentRegistered")
      .withArgs(agent1.address);

    expect(await agentRegistry.isRegistered(agent1.address)).to.be.true;
  });

  it("should return correct registration status for registered agents", async function () {
    const { agentRegistry, agent1, unregistered } = await loadFixture(
      deployAgentRegistryFixture
    );
    const publicKey = ethers.getBytes(await generatePublicKey(agent1));

    await agentRegistry
      .connect(agent1)
      .registerAgent("AI Model", ["Addon1"], ["v1.0"], "Tag1", true, publicKey);

    expect(await agentRegistry.isRegistered(agent1.address)).to.be.true;
    expect(await agentRegistry.isRegistered(unregistered.address)).to.be.false;
  });

  it("should return agent details correctly", async function () {
    const { agentRegistry, agent1 } = await loadFixture(
      deployAgentRegistryFixture
    );
    const publicKey = ethers.getBytes(await generatePublicKey(agent1));

    await agentRegistry
      .connect(agent1)
      .registerAgent("AI Model", ["Addon1"], ["v1.0"], "Tag1", true, publicKey);

    const agentDetails = await agentRegistry.agentDetails(agent1.address);
    expect(agentDetails.agentType).to.equal("AI Model");
    expect(agentDetails.isAvailable).to.equal(true);
  });

  it("should revert when retrieving details of an unregistered agent", async function () {
    const { agentRegistry, unregistered } = await loadFixture(
      deployAgentRegistryFixture
    );

    await expect(
      agentRegistry.agentDetails(unregistered.address)
    ).to.be.revertedWith("AgentRegistry: agent not registered");
  });

  it("should allow a registered agent to update availability", async function () {
    const { agentRegistry, agent1 } = await loadFixture(
      deployAgentRegistryFixture
    );
    const publicKey = ethers.getBytes(await generatePublicKey(agent1));

    await agentRegistry
      .connect(agent1)
      .registerAgent("AI Model", ["Addon1"], ["v1.0"], "Tag1", true, publicKey);

    await expect(agentRegistry.connect(agent1).updateAvailability(false))
      .to.emit(agentRegistry, "StatusChanged")
      .withArgs(agent1.address, false);

    const agentDetails = await agentRegistry.agentDetails(agent1.address);
    expect(agentDetails.isAvailable).to.equal(false);
  });

  it("should prevent unregistered agents from updating availability", async function () {
    const { agentRegistry, unregistered } = await loadFixture(
      deployAgentRegistryFixture
    );

    await expect(
      agentRegistry.connect(unregistered).updateAvailability(false)
    ).to.be.revertedWith("AgentRegistry: only registered agents");
  });

  it("should allow a registered agent to update addons", async function () {
    const { agentRegistry, agent1 } = await loadFixture(
      deployAgentRegistryFixture
    );
    const publicKey = ethers.getBytes(await generatePublicKey(agent1));

    await agentRegistry
      .connect(agent1)
      .registerAgent("AI Model", ["Addon1"], ["v1.0"], "Tag1", true, publicKey);

    await expect(
      agentRegistry.connect(agent1).updateAddon(["Addon2", "Addon3"])
    )
      .to.emit(agentRegistry, "AgentAddonListUpdated")
      .withArgs(agent1.address);

    const agentDetails = await agentRegistry.agentDetails(agent1.address);
    expect(agentDetails.addons).to.deep.equal(["Addon2", "Addon3"]);
  });

  it("should prevent unregistered agents from updating addons", async function () {
    const { agentRegistry, unregistered } = await loadFixture(
      deployAgentRegistryFixture
    );

    await expect(
      agentRegistry.connect(unregistered).updateAddon(["AddonX"])
    ).to.be.revertedWith("AgentRegistry: only registered agents");
  });

  it("should revert if public key is not exactly 64 bytes", async function () {
    const { agentRegistry, agent1 } = await loadFixture(
      deployAgentRegistryFixture
    );

    const invalidPublicKeyShort = ethers.randomBytes(32); 
    const invalidPublicKeyLong = ethers.randomBytes(65); 

    await expect(
      agentRegistry
        .connect(agent1)
        .registerAgent(
          "AI Model",
          ["Addon1"],
          ["v1.0"],
          "Tag1",
          true,
          invalidPublicKeyShort
        )
    ).to.be.revertedWith("Public key must be 64 bytes.");

    await expect(
      agentRegistry
        .connect(agent1)
        .registerAgent(
          "AI Model",
          ["Addon1"],
          ["v1.0"],
          "Tag1",
          true,
          invalidPublicKeyLong
        )
    ).to.be.revertedWith("Public key must be 64 bytes.");
  });

});
