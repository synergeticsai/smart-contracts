// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/governance/TimelockController.sol";

contract SimpleTimelock is TimelockController {
    /**
     * @dev Initializes the Timelock with default delay and roles.
     * @param minDelay How long to wait before execution.
     * @param proposers List of addresses allowed to propose operations.
     * @param executors List of addresses allowed to execute operations.
     */
    constructor(
        uint256 minDelay,
        address[] memory proposers,
        address[] memory executors
    )
        TimelockController(minDelay, proposers, executors, msg.sender)
    {}
}