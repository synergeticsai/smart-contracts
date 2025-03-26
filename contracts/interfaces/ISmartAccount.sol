// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface ISmartAccount {
    function owner() external view returns (address); // Get owner address for ERC-4337 smart account
}
