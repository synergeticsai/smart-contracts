// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {SafeProxy} from "./SafeProxy.sol";
import {IProxyCreationCallback} from "./IProxyCreationCallback.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";
import "../interfaces/IParentProxy.sol";

contract ProxyFactory is Initializable, IParentProxy {
    /** States */
    address public admin;
    address public brainSingleton;
    address public wearableSingleton;
    IAccessControl private accessControlRegistry;
    TimelockController public timelock;

    // Proxy Factory Roles
    bytes32 public constant PROXY_DEPLOYER_ROLE =
        keccak256("PROXY_DEPLOYER_ROLE");

    /** Modifiers */
    modifier onlyAdmin() {
        require(msg.sender == admin, "ProxyFactory: only admin");
        _;
    }

    modifier onlyDeployer() {
        require(
            msg.sender == admin ||
                accessControlRegistry.hasRole(PROXY_DEPLOYER_ROLE, msg.sender),
            "ProxyFactory: only deployer"
        );
        _;
    }

    /** Events */
    event AdminUpdated(address indexed newAdmin);
    event AccessControlRegistryUpdated(
        IAccessControl indexed newAccessControlRegistry
    );

    event WearableDeployed(
        string indexed wearableIdIndexed,
        SafeProxy indexed wearableToken,
        string wearableId
    );
    event BrainDeployed(
        string indexed brainIdToIndex,
        SafeProxy indexed brainToken,
        string brainId
    );

    event ProxyCreation(SafeProxy indexed proxy, address singleton);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _admin,
        IAccessControl _newAccessControlRegistry,
        TimelockController _timelock
    ) public initializer {
        require(_admin != address(0), "Admin cannot be zero address");
        admin = _admin;
        accessControlRegistry = _newAccessControlRegistry;
        timelock = _timelock;
    }

    /** Functions */

    /**
     * @param   _newAdmin Address of the new admin.
     */
    function updateAdmin(address _newAdmin) external {
        require(msg.sender == address(timelock), "ProxyFactory: only timelock");
        require(_newAdmin != address(0), "Admin cannot be zero address");
        admin = _newAdmin;
        emit AdminUpdated(_newAdmin);
    }

    /**
     * @param   _newAccessControlRegistry  Address of new access control registry.
     */
    function updateAccessControlRegistry(
        IAccessControl _newAccessControlRegistry
    ) external {
        require(msg.sender == address(timelock), "ProxyFactory: only timelock");
        accessControlRegistry = _newAccessControlRegistry;
        emit AccessControlRegistryUpdated(_newAccessControlRegistry);
    }

    function getAccessControlRegistry() external view returns (address) {
        return address(accessControlRegistry);
    }

    /**
     * @dev
     * @param   _brainSingleton Address of brain sigleton contract.
     * @param   _wearableSingleton Address of wearable singleton contract.
     */
    function updateSingletons(
        address _brainSingleton,
        address _wearableSingleton
    ) external onlyAdmin {
        require(_brainSingleton != address(0), "Brain singleton cannot be zero address");
        require(_wearableSingleton != address(0), "Wearable singleton cannot be zero address");
        brainSingleton = _brainSingleton;
        wearableSingleton = _wearableSingleton;
    }

    /// @dev Allows to retrieve the creation code used for the Proxy deployment. With this it is easily possible to calculate predicted address.
    function proxyCreationCode() public pure returns (bytes memory) {
        return type(SafeProxy).creationCode;
    }

    /**
     * @notice Internal method to create a new proxy contract using CREATE2. Optionally executes an initializer call to a new proxy.
     * @param _singleton Address of singleton contract. Must be deployed at the time of execution.
     * @param initializer (Optional) Payload for a message call to be sent to a new proxy contract.
     * @param salt Create2 salt to use for calculating the address of the new proxy contract.
     * @return proxy Address of the new proxy contract.
     */
    function deployProxy(
        address _singleton,
        bytes memory initializer,
        bytes32 salt
    ) internal returns (SafeProxy proxy) {
        require(isContract(_singleton), "Singleton contract not deployed");

        bytes memory deploymentData = abi.encodePacked(
            type(SafeProxy).creationCode,
            uint256(uint160(_singleton))
        );
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            proxy := create2(
                0x0,
                add(0x20, deploymentData),
                mload(deploymentData),
                salt
            )
        }
        /* solhint-enable no-inline-assembly */
        require(address(proxy) != address(0), "Create2 call failed");

        if (initializer.length > 0) {
            /* solhint-disable no-inline-assembly */
            /// @solidity memory-safe-assembly
            assembly {
                if eq(
                    call(
                        gas(),
                        proxy,
                        0,
                        add(initializer, 0x20),
                        mload(initializer),
                        0,
                        0
                    ),
                    0
                ) {
                    revert(0, 0)
                }
            }
            /* solhint-enable no-inline-assembly */
        }
    }

    /**
     * @notice Deploys a new proxy with `brainSingleton` singleton and `saltNonce` salt. Executes an initializer call to a new proxy.
     * @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
     */
    function createBrainProxyWithNonce(
        address _defaultAdmin,
        address _minter,
        address _pauser,
        string calldata brainId,
        string memory _tokenBaseURI,
        uint256 saltNonce
    ) public onlyDeployer returns (SafeProxy proxy) {
        bytes memory initializer = abi.encodeWithSignature(
            "initialize(address,address,address,address,string)",
            address(this),
            _defaultAdmin,
            _minter,
            _pauser,
            _tokenBaseURI
        );

        // If the initializer changes the proxy address should change too. Hashing the initializer data is cheaper than just concatinating it
        bytes32 salt = keccak256(
            abi.encodePacked(keccak256(initializer), saltNonce)
        );
        proxy = deployProxy(brainSingleton, initializer, salt);

        emit BrainDeployed(brainId, proxy, brainId);
    }

    /**
     * @notice Deploys a new proxy with `wearableSingleton` singleton and `saltNonce` salt. Executes an initializer call to a new proxy.
     * @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
     */
    function createWearableProxyWithNonce(
        address _defaultAdmin,
        address _minter,
        address _pauser,
        string calldata wearableId,
        string calldata contractMetadataURI,
        uint256 saltNonce
    ) public onlyDeployer returns (SafeProxy proxy) {
        bytes memory initializer = abi.encodeWithSignature(
            "initialize(address,address,address,address,string)",
            address(this),
            _defaultAdmin,
            _minter,
            _pauser,
            contractMetadataURI
        );

        // If the initializer changes the proxy address should change too. Hashing the initializer data is cheaper than just concatinating it
        bytes32 salt = keccak256(
            abi.encodePacked(keccak256(initializer), saltNonce)
        );
        proxy = deployProxy(wearableSingleton, initializer, salt);

        emit WearableDeployed(wearableId, proxy, wearableId);
    }

    /**
     * @notice Deploys a new proxy with `_singleton` singleton and `saltNonce` salt. Optionally executes an initializer call to a new proxy.
     * @param _singleton Address of singleton contract. Must be deployed at the time of execution.
     * @param initializer Payload for a message call to be sent to a new proxy contract.
     * @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
     */
    function createProxyWithNonce(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce
    ) public onlyDeployer returns (SafeProxy proxy) {
        // If the initializer changes the proxy address should change too. Hashing the initializer data is cheaper than just concatinating it
        bytes32 salt = keccak256(
            abi.encodePacked(keccak256(initializer), saltNonce)
        );
        proxy = deployProxy(_singleton, initializer, salt);
        emit ProxyCreation(proxy, _singleton);
    }

    /**
     * @notice Deploys a new chain-specific proxy with `_singleton` singleton and `saltNonce` salt. Optionally executes an initializer call to a new proxy.
     * @dev Allows to create a new proxy contract that should exist only on 1 network (e.g. specific governance or admin accounts)
     *      by including the chain id in the create2 salt. Such proxies cannot be created on other networks by replaying the transaction.
     * @param _singleton Address of singleton contract. Must be deployed at the time of execution.
     * @param initializer Payload for a message call to be sent to a new proxy contract.
     * @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
     */
    function createChainSpecificProxyWithNonce(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce
    ) public onlyDeployer returns (SafeProxy proxy) {
        // If the initializer changes the proxy address should change too. Hashing the initializer data is cheaper than just concatinating it
        bytes32 salt = keccak256(
            abi.encodePacked(keccak256(initializer), saltNonce, getChainId())
        );
        proxy = deployProxy(_singleton, initializer, salt);
        emit ProxyCreation(proxy, _singleton);
    }

    /**
     * @notice Deploy a new proxy with `_singleton` singleton and `saltNonce` salt.
     *         Optionally executes an initializer call to a new proxy and calls a specified callback address `callback`.
     * @param _singleton Address of singleton contract. Must be deployed at the time of execution.
     * @param initializer Payload for a message call to be sent to a new proxy contract.
     * @param saltNonce Nonce that will be used to generate the salt to calculate the address of the new proxy contract.
     * @param callback Callback that will be invoked after the new proxy contract has been successfully deployed and initialized.
     */
    function createProxyWithCallback(
        address _singleton,
        bytes memory initializer,
        uint256 saltNonce,
        IProxyCreationCallback callback
    ) public onlyDeployer returns (SafeProxy proxy) {
        uint256 saltNonceWithCallback = uint256(
            keccak256(abi.encodePacked(saltNonce, callback))
        );
        proxy = createProxyWithNonce(
            _singleton,
            initializer,
            saltNonceWithCallback
        );
        if (address(callback) != address(0))
            callback.proxyCreated(proxy, _singleton, initializer, saltNonce);
    }

    /**
     * @notice Returns true if `account` is a contract.
     * @dev This function will return false if invoked during the constructor of a contract,
     *      as the code is not actually created until after the constructor finishes.
     * @param account The address being queried
     * @return True if `account` is a contract
     */
    function isContract(address account) internal view returns (bool) {
        uint256 size;
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            size := extcodesize(account)
        }
        /* solhint-enable no-inline-assembly */
        return size > 0;
    }

    /**
     * @notice Returns the ID of the chain the contract is currently deployed on.
     * @return The ID of the current chain as a uint256.
     */
    function getChainId() public view returns (uint256) {
        uint256 id;
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            id := chainid()
        }
        /* solhint-enable no-inline-assembly */
        return id;
    }
}
