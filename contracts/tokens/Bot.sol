// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "../interfaces/IERC6551Registry.sol";

/**
 * @title Bot
 * @dev An ERC721-based smart contract for Bot.
 */
contract Bot is ERC721Enumerable, ERC721URIStorage, Pausable {
    uint256 private _nextTokenId;
    address public admin;
    address public minter;

    /** ERC6551 Account */

    IERC6551Registry public erc6551Registry;
    address public erc6551Account;
    uint256 public creationSalt;

    /** Events */

    event BotMinted(
        uint256 indexed tokenId,
        address indexed botWallet,
        address indexed executor
    );

    /** Modifiers */

    /**
     * @dev Modifier to check if the sender is the admin.
     */
    modifier onlyAdmin() {
        require(msg.sender == admin, "Bot: only admin");
        _;
    }

    /**
     * @dev Modifier to check if the sender is the minter or the admin.
     */
    modifier onlyMinter() {
        require(
            msg.sender == admin || msg.sender == minter,
            "Bot: only minter"
        );
        _;
    }

    /** Constructor */

    /**
     * @dev Constructor to initialize the contract.
     * @param _admin Address of the admin.
     * @param _minter Address of the minter.
     * @param _erc6551Registry Address of the ERC6551 registry.
     * @param _erc6551Account Address of the ERC6551 account.
     */
    constructor(
        address _admin,
        address _minter,
        IERC6551Registry _erc6551Registry,
        address _erc6551Account
    ) ERC721("Bot", "bTKN") {
        admin = _admin;
        minter = _minter;
        erc6551Registry = _erc6551Registry;
        erc6551Account = _erc6551Account;
        creationSalt = block.number;
    }

    /** Functions */

    /**
     * @dev Internal function to define the base URI for token metadata.
     * @return The base URI for token metadata.
     */
    function _baseURI() internal pure override returns (string memory) {
        return "ipfs://";
    }

    /**
     * @dev Pause the contract. Can only be called by the admin.
     */
    function pause() external onlyAdmin {
        _pause();
    }

    /**
     * @dev Unpause the contract. Can only be called by the admin.
     */
    function unpause() external onlyAdmin {
        _unpause();
    }

    /**
     * @dev Set the minter address. Can only be called by the admin.
     * @param _minter Address of the minter.
     */
    function setMinter(address _minter) external onlyAdmin {
        require(minter != _minter, "Bot: already minter");
        minter = _minter;
    }

    /**
     * @dev Set the ERC6551Registry address. Can only be called by the admin.
     * @param _erc6551Registry Address of the ERC6551Registry.
     */
    function setERC6551Registry(
        IERC6551Registry _erc6551Registry
    ) external onlyAdmin {
        erc6551Registry = _erc6551Registry;
    }

    /**
     * @dev Set the ERC6551 account address. Can only be called by the admin.
     * @param _erc6551Account Address of the ERC6551 account.
     */
    function setERC6551Account(address _erc6551Account) external onlyAdmin {
        erc6551Account = _erc6551Account;
    }

    /**
     * @dev Mint a new bot NFT and create an ERC6551 account for it.
     * @param to Address of the token recipient.
     * @param executor Address of the executor for ERC6551.
     */
    function safeMint (
        address to,
        string memory uri,
        address executor
    ) external onlyMinter whenNotPaused {
        require(bytes(uri).length > 0, "Bot: invalid URI");
        uint256 tokenId = _nextTokenId;
        _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        _createERC6551Account(tokenId, executor);
    }

    /**
     * @dev Mint multiple bot NFTs and create ERC6551 accounts for them.
     * @param to Array of token recipients.
     * @param executors Array of executors for ERC6551.
     */
    function batchSafeMint (
        address[] memory to,
        string[] memory uri,
        address[] memory executors
    ) external onlyMinter whenNotPaused {
        require(to.length > 0, "Bot: empty batch minting");
        require(to.length == uri.length && to.length == executors.length, "Mismatched input lengths");
        for (uint256 i; i < to.length; i++) {
            uint256 tokenId = _nextTokenId;
            _nextTokenId++;
            _safeMint(to[i], tokenId);
            _setTokenURI(tokenId, uri[i]);
            _createERC6551Account(tokenId, executors[i]);
        }
    }

    /**
     * @dev Internal function to create an ERC6551 account.
     * @param tokenId Token ID of the bot NFT.
     * @param executor Address of the executor for ERC6551.
     */
    function _createERC6551Account(uint256 tokenId, address executor) internal {
        bytes memory initData = abi.encodeWithSelector(
            bytes4(keccak256("initialize(address)")),
            executor
        );
        
        address botWallet = erc6551Registry.createAccount(
            erc6551Account,
            block.chainid,
            address(this),
            tokenId,
            creationSalt,
            initData
        );

        emit BotMinted(tokenId, botWallet, executor);
    }

    /** Overrides */

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _burn(
        uint256 tokenId
    ) internal override(ERC721, ERC721URIStorage) {
        return super._burn(tokenId);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) whenNotPaused {
        return super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }
}
