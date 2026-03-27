// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPoolRegistry {
    struct PoolConfig {
        address tokenA;
        address tokenB;
        address poolAddress;
        string  rollupChainId;
        address feeRecipient;
        uint64  feeBps;
        bool    active;
    }

    function get_pool(bytes32 poolId) external view returns (PoolConfig memory);
    function getAllPoolIds() external view returns (bytes32[] memory);
}
