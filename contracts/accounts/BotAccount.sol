// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../interfaces/IERC6551Account.sol";
import "../lib/Bytecode.sol";

/**
 * @title BotAccount
 * @dev A smart contract for ERC-6551 BotAccount Accounts.
 */
contract BotAccount is
    IERC721Receiver,
    IERC165,
    IERC1271,
    IERC6551Account,
    Initializable
{
    using ECDSA for bytes32;
    uint256 private _nonce;
    address public botExecutor;

    /** Constructor */

    /**
     * @dev Constructor for BotAccount. Disables initializers for upgradeability.
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Initializes the contract with Bot Executor.
     * @param _botExecutor Address of Bot Executor.
     */
    function initialize(address _botExecutor) external initializer {
        botExecutor = _botExecutor;
    }

    /**
     * @dev Fallback function to receive Ether.
     */
    receive() external payable {}

    /**
     * @dev Execute a call to another contract.
     * @param to Target contract address.
     * @param value Value to send with the call.
     * @param data Calldata for the call.
     * @return result Result of the call.
     */
    function executeCall(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory result) {
        require(msg.sender == owner(), "Not token owner");

        bool success;
        (success, result) = to.call{value: value}(data);

        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        _nonce++;
    }

    /**
     * @dev Execute a call to another contract with a signature.
     * @param to Target contract address.
     * @param value Value to send with the call.
     * @param data Calldata for the call.
     * @param signature Signature for the call.
     * @return result Result of the call.
     */
    function executeCallWithSignature(
        address to,
        uint256 value,
        bytes calldata data,
        bytes calldata signature
    ) external payable returns (bytes memory result) {
        bytes32 payload = keccak256(abi.encodePacked(_nonce, to, value, data));

        address signer = payload.toEthSignedMessageHash().recover(signature);
        require(signer == botExecutor, "Not executor approved");

        bool success;
        (success, result) = to.call{value: value}(data);

        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
        _nonce++;
    }

    /**
     * @dev Get the token that this contract holds.
     * @return chainId The chain ID of the token.
     * @return tokenContract The address of the token contract.
     * @return tokenId The ID of the token.
     */
    function token()
        public
        view
        returns (uint256 chainId, address tokenContract, uint256 tokenId)
    {
        uint256 length = address(this).code.length;
        return
            abi.decode(
                Bytecode.codeAt(address(this), length - 0x60, length),
                (uint256, address, uint256)
            );
    }

    /**
     * @dev Get the owner of the token held by this contract.
     * @return The address of the token owner.
     */
    function owner() public view returns (address) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = this
            .token();
        if (chainId != block.chainid) return address(0);

        return IERC721(tokenContract).ownerOf(tokenId);
    }

    /**
     * @dev Get the nonce value.
     * @return The nonce value.
     */
    function nonce() external view returns (uint256) {
        return _nonce;
    }

    /**
     * @dev Check if the contract supports an interface.
     * @param interfaceId The interface identifier.
     * @return True if the interface is supported, otherwise false.
     */
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return (interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC6551Account).interfaceId);
    }

    /**
     * @dev Check if a signature is valid.
     * @param hash The hashed message.
     * @param signature The signature to verify.
     * @return magicValue The magic value "0x1626ba7e" if the signature is valid, otherwise empty.
     */
    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) external view returns (bytes4 magicValue) {
        address signer = hash.toEthSignedMessageHash().recover(signature);

        if (signer == owner() || signer == botExecutor) {
            return IERC1271.isValidSignature.selector;
        }
        return "";
    }

    /**
     * @dev Function to handle ERC721 token received by this contract.
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
