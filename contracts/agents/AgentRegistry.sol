// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "../interfaces/ISmartAccount.sol";

/**
 * @title Agent Registry
 * @dev A contract for Agents to Register.
 */
contract AgentRegistry {
    struct Agent {
        string agentType;
        string[] addons;
        string[] vcs;
        string tags;
        bool isAvailable;
        bool isRegistered;
        bytes publicKey; // Public key of the agent (for encryption and decryption)
    }
    mapping(address => Agent) private agents; // Mapping from walletAddress -> Agent

    /** Events */

    event AgentRegistered(address indexed agentWallet);
    event AgentAddonListUpdated(address indexed agentWallet);
    event StatusChanged(address indexed agentWallet, bool isAvailable);

    /**
     * @dev Modifier to check if the agent is registered.
     */
    modifier onlyAgent() {
        require(
            agents[msg.sender].isRegistered,
            "AgentRegistry: only registered agents"
        );
        _;
    }

    /** Functions */

    /**
     * @dev For an agent to register themselves.
     * @param agentType Type of agent being registered.
     * @param addons Array of addon applications for the agent.
     * @param vcs Array of vcs held by the agent.
     * @param tags Tags the agent identifies with.
     * @param isAvailable Availability of the agent.
     */
    function registerAgent(
        string memory agentType,
        string[] memory addons,
        string[] memory vcs,
        string memory tags,
        bool isAvailable,
        bytes memory publicKey
    ) external {
        require(
            !agents[msg.sender].isRegistered,
            "AgentRegistry: agent already registered"
        );
        // Verify that the provided public key matches the sender's address
        require(
            verifyPublicKey(msg.sender, publicKey),
            "AgentRegistry: Public key verification failed"
        );

        Agent memory agent = Agent(
            agentType,
            addons,
            vcs,
            tags,
            isAvailable,
            true,
            publicKey
        );
        agents[msg.sender] = agent;

        emit AgentRegistered(msg.sender);
    }

    /**
     * @dev For an agent to update its availability status.
     * @param isAvailable Availability of the agent.
     */
    function updateAvailability(bool isAvailable) external onlyAgent {
        agents[msg.sender].isAvailable = isAvailable;
        emit StatusChanged(msg.sender, isAvailable);
    }

    /**
     * @dev For an agent to update its addons.
     * @param addons New addon list for the agent.
     */
    function updateAddon(string[] memory addons) external onlyAgent {
        agents[msg.sender].addons = addons;
        emit AgentAddonListUpdated(msg.sender);
    }

    /**
     * @dev To check if an agent is registered.
     * @param agentWallet New addon list for the agent.
     */
    function isRegistered(address agentWallet) external view returns (bool) {
        return agents[agentWallet].isRegistered;
    }

    /**
     * @dev To get details of an agent.
     * @param agentWallet New addon list for the agent.
     */
    function agentDetails(
        address agentWallet
    ) external view returns (Agent memory) {
        require(
            agents[agentWallet].isRegistered,
            "AgentRegistry: agent not registered"
        );

        return agents[agentWallet];
    }

    /**
     * @dev Verifies that the provided public key matches the sender's address or
     * the owner's address if the sender is a smart contract (ERC-4337 smart account).
     *
     * @param publicKey The public key to verify against the sender's address or smart account owner.
     */
    function verifyPublicKey(
        address sender,
        bytes memory publicKey
    ) internal view returns (bool) {
        // Check if the sender is a contract (ERC-4337 smart account)
        bool isContract = (address(sender).code.length > 0);
        address computedAddress = computeAddressFromPublicKey(publicKey);

        // If the sender is an EOA, the public key should correspond to the sender's address
        if (!isContract) {
            return computedAddress == sender;
        }

        // If the sender is a contract, assume it's a smart account (ERC-4337)
        try ISmartAccount(sender).owner() returns (address owner) {
            return computedAddress == owner;
        } catch {
            return false;
        }
    }

    /**
     * @dev Computes the Ethereum address from a public key (uncompressed, 64 bytes).
     * @param publicKey The public key.
     * @return address The computed address.
     */
    function computeAddressFromPublicKey(
        bytes memory publicKey
    ) public pure returns (address) {
        require(publicKey.length == 64, "Public key must be 64 bytes.");

        // The public key is expected to be in uncompressed format (64 bytes).
        bytes32 pubKeyHash = keccak256(publicKey);
        return address(uint160(uint256(pubKeyHash)));
    }
}
