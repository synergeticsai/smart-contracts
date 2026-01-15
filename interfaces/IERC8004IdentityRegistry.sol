// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title IERC8004 Identity Registry Interface
 * @dev Interface for ERC8004 Trustless Agents - Identity Registry
 * The Identity Registry uses ERC-721 with URIStorage extension for agent registration
 */
interface IERC8004IdentityRegistry {
    /**
     * @dev Struct for metadata entries
     */
    struct MetadataEntry {
        string key;
        bytes value;
    }

    /**
     * @dev Emitted when a new agent is registered
     * @param agentId The unique identifier (tokenId) for the agent
     * @param tokenURI The URI pointing to the agent's registration file
     * @param owner The address of the agent owner
     */
    event Registered(
        uint256 indexed agentId,
        string tokenURI,
        address indexed owner
    );

    /**
     * @dev Emitted when metadata is set for an agent
     * @param agentId The agent's unique identifier
     * @param indexedKey Indexed version of the key for filtering
     * @param key The metadata key
     * @param value The metadata value
     */
    event MetadataSet(
        uint256 indexed agentId,
        string indexed indexedKey,
        string key,
        bytes value
    );

    /**
     * @dev Register a new agent with tokenURI and metadata
     * @param tokenURI The URI pointing to the agent's registration JSON file
     * @param metadata Array of metadata entries to set during registration
     * @return agentId The unique identifier assigned to the agent
     */
    function register(
        string memory tokenURI,
        MetadataEntry[] calldata metadata
    ) external returns (uint256 agentId);

    /**
     * @dev Register a new agent with tokenURI only
     * @param tokenURI The URI pointing to the agent's registration JSON file
     * @return agentId The unique identifier assigned to the agent
     */
    function register(string memory tokenURI) external returns (uint256 agentId);

    /**
     * @dev Register a new agent without tokenURI (can be set later)
     * @return agentId The unique identifier assigned to the agent
     */
    function register() external returns (uint256 agentId);

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
    ) external;

    /**
     * @dev Get metadata for an agent
     * @param agentId The agent's unique identifier
     * @param key The metadata key
     * @return value The metadata value
     */
    function getMetadata(
        uint256 agentId,
        string memory key
    ) external view returns (bytes memory value);

    /**
     * @dev Get the address of this identity registry
     * @return identityRegistry The address of this contract
     */
    function getIdentityRegistry() external view returns (address identityRegistry);
}
