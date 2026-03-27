// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILiquidityEscrow {
    function lock(address token, uint256 amount, address user, address recipient) external returns (bytes32 escrowId);
    function release(bytes32 escrowId) external;
    function refund(bytes32 escrowId) external;
}
