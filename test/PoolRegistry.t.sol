// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {PoolRegistry} from "../contracts/PoolRegistry.sol";

contract PoolRegistryTest is Test {
    PoolRegistry registry;
    address alice = address(0xA11CE);
    address bob   = address(0xB0B);

    address tokenA = address(0x1);
    address tokenB = address(0x2);
    address pool   = address(0x3);

    function setUp() public {
        registry = new PoolRegistry();
    }

    function test_register_pool() public {
        vm.prank(alice);
        bytes32 poolId = registry.register_pool(tokenA, tokenB, pool, "mygame-1", 10);

        PoolRegistry.PoolConfig memory cfg = registry.get_pool(poolId);
        assertEq(cfg.tokenA,        tokenA);
        assertEq(cfg.tokenB,        tokenB);
        assertEq(cfg.poolAddress,   pool);
        assertEq(cfg.rollupChainId, "mygame-1");
        assertEq(cfg.feeRecipient,  alice);
        assertEq(cfg.feeBps,        10);
        assertTrue(cfg.active);
    }

    function test_register_pool_fee_too_high() public {
        vm.prank(alice);
        vm.expectRevert("fee too high");
        registry.register_pool(tokenA, tokenB, pool, "mygame-1", 21);
    }

    function test_register_pool_duplicate() public {
        vm.prank(alice);
        registry.register_pool(tokenA, tokenB, pool, "mygame-1", 10);

        vm.prank(bob);
        vm.expectRevert("pool already registered");
        registry.register_pool(tokenA, tokenB, pool, "mygame-1", 10);
    }

    function test_update_fee_bps() public {
        vm.prank(alice);
        bytes32 poolId = registry.register_pool(tokenA, tokenB, pool, "mygame-1", 10);

        vm.prank(alice);
        registry.update_fee_bps(poolId, 15);

        PoolRegistry.PoolConfig memory cfg = registry.get_pool(poolId);
        assertEq(cfg.feeBps, 15);
    }

    function test_update_fee_bps_not_owner() public {
        vm.prank(alice);
        bytes32 poolId = registry.register_pool(tokenA, tokenB, pool, "mygame-1", 10);

        vm.prank(bob);
        vm.expectRevert("not owner");
        registry.update_fee_bps(poolId, 15);
    }

    function test_deregister_pool() public {
        vm.prank(alice);
        bytes32 poolId = registry.register_pool(tokenA, tokenB, pool, "mygame-1", 10);

        vm.prank(alice);
        registry.deregister_pool(poolId);

        vm.expectRevert("pool not found");
        registry.get_pool(poolId);
    }

    function test_deregister_pool_not_owner() public {
        vm.prank(alice);
        bytes32 poolId = registry.register_pool(tokenA, tokenB, pool, "mygame-1", 10);

        vm.prank(bob);
        vm.expectRevert("not owner");
        registry.deregister_pool(poolId);
    }

    function test_get_rollup_pools() public {
        vm.startPrank(alice);
        bytes32 id1 = registry.register_pool(tokenA, tokenB, pool, "chain-1", 10);
        bytes32 id2 = registry.register_pool(tokenA, tokenB, pool, "chain-2", 10);
        vm.stopPrank();

        bytes32[] memory alicePools = registry.getRollupPools(alice);
        assertEq(alicePools.length, 2);
        assertEq(alicePools[0], id1);
        assertEq(alicePools[1], id2);
    }
}
