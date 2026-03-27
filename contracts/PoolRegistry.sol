// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PoolRegistry {

    struct PoolConfig {
        address tokenA;
        address tokenB;
        address poolAddress;    // AMM pool on the target rollup
        string  rollupChainId;  // e.g. "mygame-1"
        address feeRecipient;   // rollup owner's address
        uint64  feeBps;         // default 20 (= 0.20%)
        bool    active;
    }

    mapping(bytes32 => PoolConfig) public pools;
    mapping(address => bytes32[])  public rollupPools; // owner → pool IDs
    bytes32[] public allPoolIds;

    event PoolRegistered(bytes32 indexed poolId, string rollupChainId, address feeRecipient);
    event PoolUpdated(bytes32 indexed poolId, uint64 newFeeBps);
    event PoolDeregistered(bytes32 indexed poolId);

    uint64 public constant MAX_ROLLUP_FEE_BPS     = 20; // 0.20% max for rollup share
    // Protocol receives (TOTAL_FEE_BPS - pool.feeBps) / TOTAL_FEE_BPS of grossFee.
    // MIN is when rollup uses max feeBps (20): (25-20)/25 = 5bps.
    // MAX is when rollup uses feeBps=0: 25/25 = 25bps (full fee to protocol).
    uint64 public constant MIN_PROTOCOL_FEE_BPS   = 5;  // 0.05% minimum protocol share

    function register_pool(
        address tokenA,
        address tokenB,
        address poolAddress,
        string  calldata rollupChainId,
        uint64  feeBps
    ) external returns (bytes32 poolId) {
        require(tokenA != address(0) && tokenB != address(0), "zero token address");
        require(poolAddress != address(0), "zero pool address");
        require(tokenA != tokenB, "identical tokens");
        require(bytes(rollupChainId).length > 0, "empty chain id");
        require(feeBps <= MAX_ROLLUP_FEE_BPS, "fee too high");
        poolId = keccak256(abi.encodePacked(tokenA, tokenB, rollupChainId));
        require(!pools[poolId].active, "pool already registered");

        pools[poolId] = PoolConfig({
            tokenA:        tokenA,
            tokenB:        tokenB,
            poolAddress:   poolAddress,
            rollupChainId: rollupChainId,
            feeRecipient:  msg.sender,
            feeBps:        feeBps,
            active:        true
        });

        rollupPools[msg.sender].push(poolId);
        allPoolIds.push(poolId);
        emit PoolRegistered(poolId, rollupChainId, msg.sender);
    }

    function update_fee_bps(bytes32 poolId, uint64 newFeeBps) external {
        require(pools[poolId].active, "pool not found");
        require(pools[poolId].feeRecipient == msg.sender, "not owner");
        require(newFeeBps <= MAX_ROLLUP_FEE_BPS, "fee too high");
        pools[poolId].feeBps = newFeeBps;
        emit PoolUpdated(poolId, newFeeBps);
    }

    function get_pool(bytes32 poolId) external view returns (PoolConfig memory) {
        require(pools[poolId].active, "pool not found");
        return pools[poolId];
    }

    function deregister_pool(bytes32 poolId) external {
        require(pools[poolId].feeRecipient == msg.sender, "not owner");
        pools[poolId].active = false;
        emit PoolDeregistered(poolId);
    }

    function getAllPoolIds() external view returns (bytes32[] memory) {
        return allPoolIds;
    }

    function getRollupPools(address owner) external view returns (bytes32[] memory) {
        return rollupPools[owner];
    }
}
