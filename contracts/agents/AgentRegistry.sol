// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../interfaces/IERC8004IdentityRegistry.sol";
import "../interfaces/ISmartAccount.sol";


/**
 * @title Agent Registry (Hybrid ERC8004 + Legacy)
 * @dev Combines ERC8004-compliant Identity Registry with legacy agent parameters and verification logic.
 */
contract AgentRegistry is ERC721URIStorage, IERC8004IdentityRegistry, ReentrancyGuard {
    using Counters for Counters.Counter;

    // --- Legacy Structures & State ---

    struct Agent {
        string agentType;
        string[] addons;
        string[] vcs;
        string tags;
        bool isAvailable;
        bool isRegistered;
        bytes publicKey; // Public key of the agent (for encryption and decryption)
    }
<<<<<<< Updated upstream:contracts/agents/AgentRegistry.sol
    mapping(address => Agent) private agents; // Mapping from walletAddress -> Agent
=======
>>>>>>> Stashed changes:agents/AgentRegistry.sol

    // Mapping from agentId => Legacy Agent Data
    mapping(uint256 => Agent) public agents;

<<<<<<< Updated upstream:contracts/agents/AgentRegistry.sol
=======
    // Mapping from owner address => Primary Agent ID (for legacy lookup)
    mapping(address => uint256) public primaryAgentId;

    // --- ERC8004 State ---

    // Counter for auto-incrementing agent IDs
    Counters.Counter private _agentIdCounter;

    // Mapping from agentId => metadata key => metadata value
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    // --- Events ---

    // ERC8004 Events are inherited from IERC8004IdentityRegistry

    // Legacy Events
>>>>>>> Stashed changes:agents/AgentRegistry.sol
    event AgentRegistered(address indexed agentWallet);
    event AgentAddonListUpdated(address indexed agentWallet);
    event StatusChanged(address indexed agentWallet, bool isAvailable);

    /**
     * @dev Constructor initializes the ERC721 token with name and symbol
     */
    constructor() ERC721("TrustlessAgent", "AGENT") {
        // Start agent IDs from 1
        _agentIdCounter.increment();
    }

    // --- Requirements Modifiers ---

    modifier onlyRegisteredAgent() {
        require(primaryAgentId[msg.sender] != 0, "AgentRegistry: caller is not a registered agent");
        _;
    }

    // --- Legacy / Hybrid Registration Logic ---

    /**
     * @dev Legacy-style registration function that mints an ERC8004 NFT and stores legacy data.
     * @param agentType Type of agent being registered.
     * @param addons Array of addon applications for the agent.
     * @param vcs Array of vcs held by the agent.
     * @param tags Tags the agent identifies with.
     * @param isAvailable Availability of the agent.
<<<<<<< Updated upstream:contracts/agents/AgentRegistry.sol
=======
     * @param publicKey Public key of the agent (64 bytes uncompressed or 65 bytes with 0x04 prefix).
>>>>>>> Stashed changes:agents/AgentRegistry.sol
     */
    function registerAgent(
        string memory agentType,
        string[] memory addons,
        string[] memory vcs,
        string memory tags,
        bool isAvailable,
        bytes memory publicKey
<<<<<<< Updated upstream:contracts/agents/AgentRegistry.sol
    ) external {
        require(
            !agents[msg.sender].isRegistered,
            "AgentRegistry: agent already registered"
        );
=======
    ) external nonReentrant {
        require(primaryAgentId[msg.sender] == 0, "AgentRegistry: agent already registered");
        
>>>>>>> Stashed changes:agents/AgentRegistry.sol
        // Verify that the provided public key matches the sender's address
        require(
            verifyPublicKey(msg.sender, publicKey),
            "AgentRegistry: Public key verification failed"
        );

        // 1. Mint NFT (ERC8004 Standard Step) - Empty tokenURI initially for legacy flow
        uint256 newAgentId = _registerAgent(msg.sender, "");

        // 2. Store Legacy Data
        Agent memory newAgent = Agent(
            agentType,
            addons,
            vcs,
            tags,
            isAvailable,
            true,
            publicKey
        );
        agents[newAgentId] = newAgent;
        primaryAgentId[msg.sender] = newAgentId;

<<<<<<< Updated upstream:contracts/agents/AgentRegistry.sol
        emit AgentRegistered(msg.sender);
=======
        // 3. Emit Events
        emit AgentRegistered(msg.sender);
    }

    /**
     * @dev Update public key for registered agent.
     * Only callable by the agent wallet itself.
     */
    function updatePublicKey(bytes memory publicKey) external onlyRegisteredAgent {
        // Verify that the provided public key matches the sender's address
        require(
            verifyPublicKey(msg.sender, publicKey),
            "AgentRegistry: Public key verification failed"
        );
        
        uint256 agentId = primaryAgentId[msg.sender];
        agents[agentId].publicKey = publicKey;
        // Optionally emit an event, or rely on getters
>>>>>>> Stashed changes:agents/AgentRegistry.sol
    }

    // --- ERC8004 Standard Registration Functions ---

    /**
     * @dev Register a new agent with tokenURI and metadata
     * @param tokenURI_ The URI pointing to the agent's registration JSON file
     * @param metadata Array of metadata entries to set during registration
     * @return agentId The unique identifier assigned to the agent
     */
    function register(
        string memory tokenURI_,
        MetadataEntry[] calldata metadata
    ) external nonReentrant returns (uint256 agentId) {
        // Guard: Ensure one-agent-per-wallet if legacy flow is important
        // require(primaryAgentId[msg.sender] == 0, "AgentRegistry: address already has a primary agent");
        
        agentId = _registerAgent(msg.sender, tokenURI_);

        // Set metadata entries if provided
        for (uint256 i = 0; i < metadata.length; i++) {
            _setMetadata(agentId, metadata[i].key, metadata[i].value);
        }

        return agentId;
    }

    /**
     * @dev Register a new agent with tokenURI only
     * @param tokenURI_ The URI pointing to the agent's registration JSON file
     * @return agentId The unique identifier assigned to the agent
     */
    function register(string memory tokenURI_) external nonReentrant returns (uint256 agentId) {
        return _registerAgent(msg.sender, tokenURI_);
    }

    /**
     * @dev Register a new agent without tokenURI (can be set later)
     * @return agentId The unique identifier assigned to the agent
     */
    function register() external nonReentrant returns (uint256 agentId) {
        return _registerAgent(msg.sender, "");
    }

    // --- Legacy Helper Functions ---

    /**
     * @dev For an agent to update its availability status.
     * Updates the PRIMARY agent associated with the sender.
     */
    function updateAvailability(bool isAvailable) external onlyRegisteredAgent {
        uint256 agentId = primaryAgentId[msg.sender];
        agents[agentId].isAvailable = isAvailable;
        emit StatusChanged(msg.sender, isAvailable);
    }

    /**
     * @dev For an agent to update its addons.
     * Updates the PRIMARY agent associated with the sender.
     */
    function updateAddon(string[] memory addons) external onlyRegisteredAgent {
        uint256 agentId = primaryAgentId[msg.sender];
        agents[agentId].addons = addons;
        emit AgentAddonListUpdated(msg.sender);
    }

    /**
     * @dev To check if an address is registered as an agent (Legacy check).
     */
    function isRegistered(address agentWallet) external view returns (bool) {
        return primaryAgentId[agentWallet] != 0;
    }

    /**
     * @dev To get details of an agent by wallet address (Legacy getter).
     */
    function agentDetails(address agentWallet) external view returns (Agent memory) {
        uint256 agentId = primaryAgentId[agentWallet];
        require(agentId != 0, "AgentRegistry: agent not registered");
        return agents[agentId];
    }

    /**
     * @dev Verifies that the provided public key matches the sender's address or
     * the owner's address if the sender is a smart contract (ERC-4337 smart account).
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
        ISmartAccount smartAccount = ISmartAccount(sender);
        address owner = smartAccount.owner(); // Get the owner of the smart account

        // The public key should correspond to the smart account owner's address
        return computedAddress == owner;
    }

    /**
     * @dev Computes the Ethereum address from a public key.
     * Supports both uncompressed (64 bytes) and prefix-uncompressed (65 bytes with 0x04).
     */
    function computeAddressFromPublicKey(
        bytes memory publicKey
    ) public pure returns (address) {
        require(publicKey.length == 64 || publicKey.length == 65, "Invalid public key length");

        bytes32 hash;
        
        assembly {
            // Get pointer to the data part of bytes memory
            let dataPtr := add(publicKey, 32)
            
            // If length is 65, we expect 0x04 prefix, so we skip the first byte
            // Check length loaded from memory (first 32 bytes of publicKey)
            if eq(mload(publicKey), 65) {
                // Check if first byte is 0x04
                let prefix := byte(0, mload(dataPtr))
                if iszero(eq(prefix, 0x04)) {
                    revert(0, 0) // Revert if prefix is not 0x04
                }
                // Advance pointer by 1 byte to skip prefix
                dataPtr := add(dataPtr, 1)
            }
            
            // Hash the next 64 bytes
            hash := keccak256(dataPtr, 64)
        }
        
        // Strict casting: take last 20 bytes
        return address(uint160(uint256(hash)));
    }

    // --- ERC8004 / Metadata Functions ---

    /**
     * @dev Set metadata for an agent (only owner or approved operator)
     * @param agentId The agent's unique identifier
     * @param key The metadata key
     * @param value The metadata value
     */
    function setMetadata(
        uint256 agentId,
        string memory key,
        bytes memory value
    ) external {
        require(_exists(agentId), "AgentRegistry: agentId does not exist");
        require(
            _isApprovedOrOwner(msg.sender, agentId),
            "AgentRegistry: caller is not owner nor approved"
        );

        _setMetadata(agentId, key, value);
    }

    /**
     * @dev Get metadata for an agent
     * @param agentId The agent's unique identifier
     * @param key The metadata key
     * @return value The metadata value
     */
    function getMetadata(
        uint256 agentId,
        string memory key
    ) external view returns (bytes memory value) {
        require(_exists(agentId), "AgentRegistry: agentId does not exist");
        return _metadata[agentId][key];
    }

    /**
     * @dev Get the address of this identity registry
     * @return identityRegistry The address of this contract
     */
    function getIdentityRegistry() external view returns (address identityRegistry) {
        return address(this);
    }

    /**
     * @dev Update the tokenURI for an agent (only owner or approved operator)
     * @param agentId The agent's unique identifier
     * @param tokenURI_ The new URI pointing to the agent's registration JSON file
     */
    function updateTokenURI(uint256 agentId, string memory tokenURI_) external {
        require(_exists(agentId), "AgentRegistry: agentId does not exist");
        require(
            _isApprovedOrOwner(msg.sender, agentId),
            "AgentRegistry: caller is not owner nor approved"
        );

        _setTokenURI(agentId, tokenURI_);
    }

    /**
     * @dev Check if an agent ID is registered (ERC8004 check)
     * @param agentId The agent's unique identifier
     * @return registered True if the agent exists
     */
    function isRegistered(uint256 agentId) external view returns (bool registered) {
        return _exists(agentId);
    }

    /**
     * @dev Get the total number of registered agents
     * @return count The total number of agents
     */
    function totalAgents() external view returns (uint256 count) {
        return _agentIdCounter.current() - 1;
    }

    // --- Internal Functions ---

    /**
     * @dev Internal function to register an agent and mint NFT
     * @param owner The address that will own the agent NFT
     * @param tokenURI_ The URI pointing to the agent's registration JSON file
     * @return agentId The unique identifier assigned to the agent
     */
    function _registerAgent(
        address owner,
        string memory tokenURI_
    ) internal returns (uint256 agentId) {
        agentId = _agentIdCounter.current();
        _agentIdCounter.increment();

        // Mint the NFT to the owner
        _safeMint(owner, agentId);

        // Set the token URI if provided
        if (bytes(tokenURI_).length > 0) {
            _setTokenURI(agentId, tokenURI_);
        }

        emit Registered(agentId, tokenURI_, owner);

        return agentId;
    }

    /**
     * @dev Internal function to set metadata
     * @param agentId The agent's unique identifier
     * @param key The metadata key
     * @param value The metadata value
     */
    function _setMetadata(
        uint256 agentId,
        string memory key,
        bytes memory value
    ) internal {
        _metadata[agentId][key] = value;
        emit MetadataSet(agentId, key, key, value);
    }

    // --- ERC165 / Interface Support ---

     /**
     * @dev ERC165 support for ERC8004 identity registry interface.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721URIStorage)
        returns (bool)
    {
        return
            interfaceId == type(IERC8004IdentityRegistry).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
