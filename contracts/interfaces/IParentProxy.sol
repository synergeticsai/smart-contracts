// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

interface IParentProxy {

    /**
     * @notice  The function is to retrive access control registry address, where it will be used to check the
     *          global permission of accounts to perform actions such as mint. pause etc
     * @dev     This interface should be used in token contracts to retrive the
     *          access control registry address from parent Proxy contract
     */
    function getAccessControlRegistry() external returns(address);
}