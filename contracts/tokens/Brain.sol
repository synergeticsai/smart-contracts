// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/IAccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "../common/Singleton.sol";
import "../interfaces/IParentProxy.sol";

contract Brain is
    Singleton,
    Initializable,
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    ERC721PausableUpgradeable,
    AccessControlUpgradeable,
    ERC721BurnableUpgradeable
{
    bytes32 public constant BRAIN_ADMIN_ROLE = keccak256("BRAIN_ADMIN_ROLE");
    bytes32 public constant BRAIN_MINTER_ROLE = keccak256("BRAIN_MINTER_ROLE");
    bytes32 public constant BRAIN_PAUSER_ROLE = keccak256("BRAIN_PAUSER_ROLE");

    enum SubscriptionStatus {
        INACTIVE,
        ACTIVE
    }

    struct Subscription {
        uint256 subscriptionTierId;
        SubscriptionStatus subscriptionStatus;
    }

    /** States */
    mapping(uint256 => Subscription) public subscriptionInfo;
    mapping(uint256 => uint256[]) private brainToBotIds;
    mapping(uint256 => mapping(uint256 => uint256)) private botIndexInBrain;
    string private baseURI;
    uint256 private nextTokenId;
    IParentProxy private parentProxy;

    /** Events */
    event SetSubscription(
        uint256 indexed tokenId,
        Subscription indexed subscriptionInfo
    );
    event UpdateSubscriptionStatus(
        uint256 indexed tokenId,
        SubscriptionStatus indexed status
    );
    event BotLinked(uint256 indexed botId, uint256 indexed tokenId);
    event BotUnlinked(uint256 indexed botId, uint256 indexed tokenId);
    event SetBaseURI(string indexed baseURI);

    /**
     * @dev Constructor. Disables initializers for upgradeability.
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract with roles and data.
     */
    function initialize(
        address _parentProxy,
        address _defaultAdmin,
        address _minter,
        address _pauser,
        string memory _baseMetadataURI
    ) external initializer {
        require(_parentProxy != address(0), "Brain: parentProxy cannot be zero address");
        require(_defaultAdmin != address(0), "Brain: defaultAdmin cannot be zero address");
        require(_minter != address(0), "Brain: minter cannot be zero address");
        require(_pauser != address(0), "Brain: pauser cannot be zero address");
        __ERC721_init("Brain", "bTKN");
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __ERC721Pausable_init();
        __ERC721Burnable_init();
        _setParentProxy(_parentProxy);
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(BRAIN_MINTER_ROLE, _minter);
        _grantRole(BRAIN_PAUSER_ROLE, _pauser);
        _setBaseURI(_baseMetadataURI);
    }

    modifier onlyAdminOrTokenOwner(uint256 tokenId) {
        require(
                ERC721Upgradeable.ownerOf(tokenId) == _msgSender() ||
                hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
                hasRoleSuper(BRAIN_ADMIN_ROLE, _msgSender()),
            "Brain: Sender must be an admin or be the token owner"
        );
        _;
    }

    modifier onlyAdmin() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
                hasRoleSuper(BRAIN_ADMIN_ROLE, _msgSender()),
            "Brain: Sender must have role admin"
        );
        _;
    }

    modifier onlyMinter() {
        require(
            hasRole(BRAIN_MINTER_ROLE, _msgSender()) ||
                hasRoleSuper(BRAIN_MINTER_ROLE, _msgSender()),
            "Brain: Sender must have role minter"
        );
        _;
    }

    modifier onlyPauser() {
        require(
            hasRole(BRAIN_PAUSER_ROLE, _msgSender()) ||
                hasRoleSuper(BRAIN_PAUSER_ROLE, _msgSender()),
            "Brain: Sender must have role pauser"
        );
        _;
    }

    function pause() public onlyPauser {
        _pause();
    }

    function unpause() public onlyPauser {
        _unpause();
    }

    /**
     * @notice Safely mints a new Brain NFT and associates it with subscription information.
     * @dev Only accessible by accounts with the MINTER_ROLE.
     * @param _to The address to which the newly minted NFT will be assigned.
     * @param _subscriptionInfo The subscription details to be associated with the newly minted NFT.
     * @dev The '_subscriptionInfo' parameter should include information about the Brain subscription.
     */
    function safeMint(
        address _to,
        Subscription calldata _subscriptionInfo
    ) public onlyMinter {
        uint256 tokenId = nextTokenId++;
        _setSubscription(tokenId, _subscriptionInfo);
        _safeMint(_to, tokenId);
    }

    /**
     * @notice Updates the subscription information for a given Brain token.
     * @dev Only accessible by the default admin role.
     * @param _tokenId The unique identifier of the Brain token to be updated.
     * @param _newSubscriptionInfo The new subscription details to be associated with the token.
     * @dev The '_newSubscriptionInfo' parameter should include the subscription Id and subscription status.
     * @dev It is assumed that the '_tokenId' corresponds to an existing Brain token.
     * @dev Throws an error if the specified token does not exist.
     */
    function updateSubscription(
        uint256 _tokenId,
        Subscription calldata _newSubscriptionInfo
    ) external onlyAdmin {
        require(_exists(_tokenId), "Brain: token does not exist");
        _setSubscription(_tokenId, _newSubscriptionInfo);
    }

    /**
     * @notice Updates the subscription status for a given Brain token.
     * @dev Only accessible by the default admin role.
     * @param _tokenId The unique identifier of the Brain token to update the subscription status for.
     * @param _newSubscriptionStatus The new subscription status to be associated with the token.
     * @dev The '_newSubscriptionStatus' parameter represents the updated status (ACTIVE, INACTIVE).
     * @dev It is assumed that the '_tokenId' corresponds to an existing Brain token.
     * @dev Throws an error if the specified token does not exist.
     * @dev Throws an error if attempting to update to the same subscription status.
     * @dev Emits an updateSubscriptionStatus event upon successful status update.
     */
    function updateSubscriptionStatus(
        uint256 _tokenId,
        SubscriptionStatus _newSubscriptionStatus
    ) external onlyAdmin {
        require(_exists(_tokenId), "Brain: token does not exist");
        Subscription storage currentSubscription = subscriptionInfo[_tokenId];

        require(
            currentSubscription.subscriptionStatus != _newSubscriptionStatus,
            "Brain: cannot update to the same subscription status"
        );
        currentSubscription.subscriptionStatus = _newSubscriptionStatus;

        emit UpdateSubscriptionStatus(_tokenId, _newSubscriptionStatus);
    }

    /**
     * @notice Connects a bot with a token by setting the link status to true.
     * @dev Only accessible by accounts with the DEFAULT_ADMIN_ROLE.
     * @param _botId The unique identifier of the bot to be connected.
     * @param _tokenId The unique identifier of the token to be connected.
     */
    function linkBot(
        uint256 _botId,
        uint256 _tokenId
    ) external onlyAdminOrTokenOwner(_tokenId) {
        _linkBot(_botId, _tokenId);
    }

    /**
     * @notice Connects multiple bots with corresponding tokens by setting the link status to true.
     * @dev Only accessible by accounts with the DEFAULT_ADMIN_ROLE.
     * @param _botIds An array of unique identifiers of the bots to be connected.
     * @param _tokenId The Id of the token to be connected.
     * @dev Requires that the lengths of 'botIds' and 'tokenIds' arrays match.
     */
    function linkBotBatch(
        uint256[] calldata _botIds,
        uint256 _tokenId
    ) external onlyAdminOrTokenOwner(_tokenId) {
        for (uint256 i; i < _botIds.length; i++) {
            _linkBot(_botIds[i], _tokenId);
        }
    }

    /**
     * @notice Disconnects a bot from a token by setting the link status to false.
     * @dev Only accessible by accounts with the DEFAULT_ADMIN_ROLE.
     * @param _botId The unique identifier of the bot to be disconnected.
     * @param _tokenId The unique identifier of the token to be disconnected.
     */
    function unlinkBot(
        uint256 _botId,
        uint256 _tokenId
    ) external onlyAdminOrTokenOwner(_tokenId) {
        _unlinkBot(_botId, _tokenId);
    }

    /**
     * @notice Disconnects multiple bots from corresponding tokens by setting the link status to false.
     * @dev Only accessible by accounts with the DEFAULT_ADMIN_ROLE.
     * @param _botIds An array of unique identifiers of the bots to be disconnected.
     * @param _tokenId The Id of the token to be disconnected.
     * @dev Requires that the lengths of 'botIds' and 'tokenIds' arrays match.
     */
    function unlinkBotBatch(
        uint256[] calldata _botIds,
        uint256 _tokenId
    ) external onlyAdminOrTokenOwner(_tokenId) {
        for (uint256 i; i < _botIds.length; i++) {
            _unlinkBot(_botIds[i], _tokenId);
        }
    }

    function getLinkedBots(
        uint256 _tokenId
    ) external view returns (uint256[] memory) {
        return brainToBotIds[_tokenId];
    }

    function tokenURI(
        uint256 _tokenId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return _baseURI();
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(
            ERC721Upgradeable,
            ERC721EnumerableUpgradeable,
            ERC721URIStorageUpgradeable,
            AccessControlUpgradeable
        )
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /** Internal Functions */

    function _setSubscription(
        uint256 _tokenId,
        Subscription calldata _subscriptionInfo
    ) internal {
        subscriptionInfo[_tokenId] = _subscriptionInfo;
        emit SetSubscription(_tokenId, _subscriptionInfo);
    }

    /**
     * @notice  parent proxy address to call and check the global account global access
     * @param   _parentProxyAddress  .
     */
    function _setParentProxy(address _parentProxyAddress) internal {
        parentProxy = IParentProxy(_parentProxyAddress);
    }

    /**
     * @param   _role  .
     * @param   _account  .
     */
    function hasRoleSuper(
        bytes32 _role,
        address _account
    ) public returns (bool) {
        IAccessControlUpgradeable accessControlRegistry = IAccessControlUpgradeable(
                parentProxy.getAccessControlRegistry()
            );
        return accessControlRegistry.hasRole(_role, _account);
    }

    function _linkBot(uint256 _botId, uint256 _tokenId) internal {
        require(_exists(_tokenId), "Brain: token does not exist");
        require(
            botIndexInBrain[_tokenId][_botId] == 0,
            "Bot is already linked to the brain"
        );

        brainToBotIds[_tokenId].push(_botId);
        uint256 index = brainToBotIds[_tokenId].length;

        botIndexInBrain[_tokenId][_botId] = index;

        emit BotLinked(_botId, _tokenId);
    }

    function _unlinkBot(uint256 _botId, uint256 _tokenId) internal {
        uint256 _index = botIndexInBrain[_tokenId][_botId];
        require(_exists(_tokenId), "Brain: token does not exist");
        require(_index != 0, "Bot is not linked to the brain");

        // Remove the bot from the array by swapping with the last element
        uint256 _lastIndex = brainToBotIds[_tokenId].length - 1;
        uint256 _lastBotId = brainToBotIds[_tokenId][_lastIndex];

        brainToBotIds[_tokenId][_index - 1] = _lastBotId;
        brainToBotIds[_tokenId].pop();

        // Update the index of the last bot in the array
        botIndexInBrain[_tokenId][_lastBotId] = _index;

        // Clear the index for the unlinked bot
        botIndexInBrain[_tokenId][_botId] = 0;

        emit BotUnlinked(_botId, _tokenId);
    }

    function _baseURI() internal view override returns (string memory) {
        return string(abi.encodePacked("ipfs://", baseURI));
    }

    function _setBaseURI(string memory _baseMetadataURI) internal {
        baseURI = _baseMetadataURI;
        emit SetBaseURI(_baseMetadataURI);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    )
        internal
        override(
            ERC721Upgradeable,
            ERC721EnumerableUpgradeable,
            ERC721PausableUpgradeable
        )
    {
        return super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    function _burn(
        uint256 tokenId
    ) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {
        return super._burn(tokenId);
    }
}
