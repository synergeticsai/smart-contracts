// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

interface IAgentRegistry {
    function isRegistered(address agentWallet) external view returns (bool);
}