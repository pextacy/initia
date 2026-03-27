// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {IERC20}        from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PoolRegistry}  from "../contracts/PoolRegistry.sol";
import {FeeDistributor} from "../contracts/FeeDistributor.sol";
import {LiquidityEscrow} from "../contracts/LiquidityEscrow.sol";
import {BridgeAdapter}  from "../contracts/BridgeAdapter.sol";
import {Router}         from "../contracts/Router.sol";
import {AMM}            from "../contracts/AMM.sol";
import {ERC20Mock}      from "./mocks/ERC20Mock.sol";

/// @notice End-to-end integration tests for the full AppSwap flow.
contract IntegrationTest is Test {

    // ── Actors ────────────────────────────────────────────────────────────────
    address deployer  = makeAddr("deployer");
    address alice     = makeAddr("alice");     // regular trader
    address rollup    = makeAddr("rollup");    // rollup owner earning fees

    // ── Tokens ────────────────────────────────────────────────────────────────
    ERC20Mock init;
    ERC20Mock usdc;

    // ── Contracts ─────────────────────────────────────────────────────────────
    PoolRegistry    registry;
    FeeDistributor  feeDist;
    LiquidityEscrow escrow;
    BridgeAdapter   bridge;
    Router          router;
    AMM             amm;

    string constant CHAIN_ID = "appswap-1";

    // ── Setup ─────────────────────────────────────────────────────────────────
    function setUp() public {
        vm.startPrank(deployer);

        // Deploy tokens
        init = new ERC20Mock("Initia", "INIT", 18);
        usdc = new ERC20Mock("USD Coin", "USDC", 6);

        // Mint to actors
        init.mint(deployer, 1_000_000e18);
        usdc.mint(deployer,  10_000_000e6);
        init.mint(alice,     10_000e18);
        usdc.mint(alice,     50_000e6);

        // Deploy infrastructure
        registry = new PoolRegistry();
        feeDist  = new FeeDistributor(deployer, deployer);
        feeDist.setRegistry(address(registry));
        escrow   = new LiquidityEscrow(deployer);
        bridge   = new BridgeAdapter(deployer, deployer);
        bridge.setEscrow(address(escrow));
        router   = new Router(deployer, address(registry), address(bridge), address(feeDist), address(escrow), CHAIN_ID);
        feeDist.setRouter(address(router));
        escrow.setRouter(address(router));
        escrow.setBridgeAdapter(address(bridge));
        bridge.setRouter(address(router));

        // Deploy AMM pool
        amm = new AMM(address(init), address(usdc));

        // Seed pool: 10,000 INIT + 12,400 USDC (price ~1.24)
        address ammTokenA = amm.tokenA();
        (uint256 amtA, uint256 amtB) = ammTokenA == address(init)
            ? (10_000e18, 12_400e6)
            : (12_400e6,  10_000e18);

        IERC20(ammTokenA).approve(address(amm), type(uint256).max);
        IERC20(amm.tokenB()).approve(address(amm), type(uint256).max);
        amm.addLiquidity(amtA, amtB, 0, 0, deployer);

        // Register pool (rollup addr as feeRecipient — use deployer for simplicity)
        registry.register_pool(address(init), address(usdc), address(amm), CHAIN_ID, 20);

        vm.stopPrank();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 1: Pool registered correctly
    // ─────────────────────────────────────────────────────────────────────────
    function test_poolRegistered() public view {
        bytes32[] memory ids = registry.getAllPoolIds();
        assertEq(ids.length, 1, "should have 1 pool");

        PoolRegistry.PoolConfig memory cfg = registry.get_pool(ids[0]);
        assertTrue(cfg.active, "pool should be active");
        assertEq(cfg.feeBps, 20, "fee should be 20 bps");
        assertEq(cfg.rollupChainId, CHAIN_ID);
        console.log("Pool registered: INIT/USDC on", cfg.rollupChainId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 2: AMM seeded with correct reserves
    // ─────────────────────────────────────────────────────────────────────────
    function test_ammSeeded() public view {
        (uint256 rA, uint256 rB) = amm.getReserves();
        assertGt(rA, 0, "reserveA should be > 0");
        assertGt(rB, 0, "reserveB should be > 0");
        console.log("ReserveA:", rA);
        console.log("ReserveB:", rB);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 3: Alice gets a quote from Router
    // ─────────────────────────────────────────────────────────────────────────
    function test_quote() public view {
        uint256 amountIn = 100e18; // 100 INIT
        (uint256 amountOut, bytes32 poolId) = router.quote(address(init), address(usdc), amountIn);
        assertGt(amountOut, 0, "quote should be > 0");
        assertNotEq(poolId, bytes32(0), "poolId should not be zero");
        // Expected: ~100 INIT * 1.24 * (1 - 0.25%) ≈ 123.7 USDC
        console.log("Quote: 100 INIT ->", amountOut, "USDC (raw)");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 4: Alice swaps INIT for USDC
    // ─────────────────────────────────────────────────────────────────────────
    function test_swap() public {
        uint256 amountIn  = 100e18;  // 100 INIT
        uint256 balBefore = usdc.balanceOf(alice);

        vm.startPrank(alice);
        init.approve(address(router), amountIn);
        uint256 amountOut = router.swap(
            address(init),
            address(usdc),
            amountIn,
            1,                                    // minAmountOut = 1 (no slippage check in test)
            block.timestamp + 600
        );
        vm.stopPrank();

        uint256 balAfter = usdc.balanceOf(alice);
        assertEq(balAfter - balBefore, amountOut, "USDC balance delta should match amountOut");
        assertGt(amountOut, 0, "swap should produce output");
        console.log("Swap: 100 INIT ->", amountOut, "USDC (raw)");
        // ~123.69 USDC raw = 123,690,000 (6 decimals)
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 5: Fee is distributed after swap
    // ─────────────────────────────────────────────────────────────────────────
    function test_feeDistributed() public {
        vm.startPrank(alice);
        init.approve(address(router), 100e18);
        router.swap(address(init), address(usdc), 100e18, 1, block.timestamp + 600);
        vm.stopPrank();

        // Fee recipient is deployer (set in setUp as registry msg.sender)
        uint256 pending = feeDist.pendingFees(address(usdc), deployer);
        assertGt(pending, 0, "should have pending fees for rollup owner");
        console.log("Pending fees (deployer, USDC raw):", pending);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 6: Rollup owner claims fees
    // ─────────────────────────────────────────────────────────────────────────
    function test_claimFees() public {
        // First do a swap to generate fees
        vm.startPrank(alice);
        init.approve(address(router), 100e18);
        router.swap(address(init), address(usdc), 100e18, 1, block.timestamp + 600);
        vm.stopPrank();

        uint256 pending    = feeDist.pendingFees(address(usdc), deployer);
        uint256 balBefore  = usdc.balanceOf(deployer);

        vm.prank(deployer);
        feeDist.claim(address(usdc));

        uint256 balAfter = usdc.balanceOf(deployer);
        assertEq(balAfter - balBefore, pending, "claimed amount should match pending");
        assertEq(feeDist.pendingFees(address(usdc), deployer), 0, "pending should be 0 after claim");
        console.log("Claimed fees:", pending, "USDC (raw)");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 7: Add liquidity via AMM directly
    // ─────────────────────────────────────────────────────────────────────────
    function test_addLiquidity() public {
        uint256 lpBefore = amm.balanceOf(alice);

        address tokA = amm.tokenA();
        address tokB = tokA == address(init) ? address(usdc) : address(init);

        vm.startPrank(alice);
        IERC20(tokA).approve(address(amm), type(uint256).max);
        IERC20(tokB).approve(address(amm), type(uint256).max);

        (uint256 amtA, uint256 amtB) = tokA == address(init) ? (1_000e18, 1_240e6) : (1_240e6, 1_000e18);
        amm.addLiquidity(amtA, amtB, 0, 0, alice);
        vm.stopPrank();

        uint256 lpAfter = amm.balanceOf(alice);
        assertGt(lpAfter - lpBefore, 0, "should receive LP tokens");
        console.log("LP tokens received:", lpAfter - lpBefore);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 8: Remove liquidity
    // ─────────────────────────────────────────────────────────────────────────
    function test_removeLiquidity() public {
        // First add liquidity
        address tokA = amm.tokenA();
        vm.startPrank(alice);
        IERC20(tokA).approve(address(amm), type(uint256).max);
        IERC20(tokA == address(init) ? address(usdc) : address(init)).approve(address(amm), type(uint256).max);
        (uint256 amtA, uint256 amtB) = tokA == address(init) ? (1_000e18, 1_240e6) : (1_240e6, 1_000e18);
        amm.addLiquidity(amtA, amtB, 0, 0, alice);

        uint256 lp = amm.balanceOf(alice);
        assertGt(lp, 0);

        uint256 initBefore = init.balanceOf(alice);
        amm.removeLiquidity(lp, 0, 0, alice);
        vm.stopPrank();

        assertEq(amm.balanceOf(alice), 0, "LP balance should be 0 after full removal");
        assertGt(init.balanceOf(alice), initBefore, "should receive INIT back");
        console.log("Removed liquidity, received INIT:", init.balanceOf(alice) - initBefore);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 9: Multiple swaps accumulate fees
    // ─────────────────────────────────────────────────────────────────────────
    function test_multiSwapFees() public {
        vm.startPrank(alice);
        init.approve(address(router), type(uint256).max);

        for (uint256 i = 0; i < 5; i++) {
            router.swap(address(init), address(usdc), 10e18, 1, block.timestamp + 600);
        }
        vm.stopPrank();

        uint256 pending = feeDist.pendingFees(address(usdc), deployer);
        assertGt(pending, 0, "fees should accumulate across swaps");
        console.log("Fees after 5 swaps (USDC raw):", pending);
    }
}
