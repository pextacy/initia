// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {Router} from "../contracts/Router.sol";
import {PoolRegistry} from "../contracts/PoolRegistry.sol";
import {FeeDistributor} from "../contracts/FeeDistributor.sol";
import {AMM} from "../contracts/AMM.sol";
import {LiquidityEscrow} from "../contracts/LiquidityEscrow.sol";
import {BridgeAdapter} from "../contracts/BridgeAdapter.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 10_000_000e18);
    }
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract RouterTest is Test {
    Router         router;
    PoolRegistry   registry;
    FeeDistributor distributor;
    AMM            amm;
    LiquidityEscrow escrow;
    BridgeAdapter  bridgeAdapter;

    TestToken tokenA;
    TestToken tokenB;

    address owner    = address(this);
    address treasury = address(0xBEEF);
    address alice    = address(0xA11CE);
    address relayer  = address(0xCA11);

    function setUp() public {
        // Deploy tokens
        tokenA = new TestToken("Token A", "TKA");
        tokenB = new TestToken("Token B", "TKB");

        // Deploy registry
        registry = new PoolRegistry();

        // Deploy AMM (local pool)
        amm = new AMM(address(tokenA), address(tokenB));

        // Add liquidity to AMM: 100k A, 100k B
        uint256 liqAmount = 100_000e18;
        tokenA.approve(address(amm), liqAmount);
        tokenB.approve(address(amm), liqAmount);
        amm.addLiquidity(liqAmount, liqAmount, 0, 0, owner);

        // Register pool in registry
        registry.register_pool(
            address(tokenA),
            address(tokenB),
            address(amm),
            "appswap-1",  // local chain
            20
        );

        // Deploy infrastructure
        distributor  = new FeeDistributor(owner, treasury);
        escrow       = new LiquidityEscrow(owner);
        bridgeAdapter = new BridgeAdapter(owner, relayer);

        // Deploy router
        router = new Router(
            owner,
            address(registry),
            address(bridgeAdapter),
            address(distributor),
            address(escrow),
            "appswap-1"
        );

        // Wire up
        distributor.setRegistry(address(registry));
        distributor.setRouter(address(router));
        escrow.setRouter(address(router));
        escrow.setBridgeAdapter(address(bridgeAdapter));
        bridgeAdapter.setEscrow(address(escrow));
        bridgeAdapter.setRouter(address(router));

        // Fund alice
        tokenA.transfer(alice, 10_000e18);
    }

    function test_quote_returns_amount() public view {
        uint256 amountIn = 100e18;
        (uint256 out, bytes32 poolId) = router.quote(address(tokenA), address(tokenB), amountIn);
        assertTrue(out > 0, "no quote");
        assertTrue(poolId != bytes32(0), "no pool");
    }

    function test_same_chain_swap() public {
        uint256 amountIn = 100e18;
        uint256 deadline = block.timestamp + 300;

        vm.startPrank(alice);
        tokenA.approve(address(router), amountIn);

        uint256 balBefore = tokenB.balanceOf(alice);
        uint256 out = router.swap(
            address(tokenA),
            address(tokenB),
            amountIn,
            1,  // minAmountOut
            deadline
        );
        vm.stopPrank();

        assertGt(out, 0, "swap returned 0");
        assertEq(tokenB.balanceOf(alice), balBefore + out, "tokenB not received");
    }

    function test_swap_expired() public {
        vm.prank(alice);
        tokenA.approve(address(router), 100e18);

        vm.expectRevert("expired");
        vm.prank(alice);
        router.swap(address(tokenA), address(tokenB), 100e18, 0, block.timestamp - 1);
    }

    function test_swap_paused() public {
        router.pause();

        vm.prank(alice);
        tokenA.approve(address(router), 100e18);

        vm.expectRevert("paused");
        vm.prank(alice);
        router.swap(address(tokenA), address(tokenB), 100e18, 0, block.timestamp + 300);
    }

    function test_fee_accrues_after_swap() public {
        uint256 amountIn = 10_000e18;
        vm.startPrank(alice);
        tokenA.approve(address(router), amountIn);
        router.swap(address(tokenA), address(tokenB), amountIn, 1, block.timestamp + 300);
        vm.stopPrank();

        // grossFee = 10_000e18 * 25 / 10000 = 25e18
        // rollupFee = 25e18 * 20 / 25 = 20e18  (80%)
        // protocolFee = 25e18 - 20e18 = 5e18   (20%)
        uint256 ownerPending    = distributor.pendingFees(address(tokenA), owner);
        uint256 treasuryPending = distributor.pendingFees(address(tokenA), treasury);
        uint256 grossFee        = (amountIn * 25) / 10000;
        assertGt(ownerPending, 0, "rollup fee not accrued");
        assertEq(ownerPending + treasuryPending, grossFee, "fee total mismatch");
    }

    function test_swap_slippage_reverts() public {
        uint256 amountIn = 100e18;
        // Demand impossibly high minAmountOut — should revert
        vm.startPrank(alice);
        tokenA.approve(address(router), amountIn);
        vm.expectRevert("slippage");
        router.swap(
            address(tokenA),
            address(tokenB),
            amountIn,
            amountIn,   // 1:1 is impossible with AMM fees
            block.timestamp + 300
        );
        vm.stopPrank();
    }

    function test_cross_rollup_swap_emits_event() public {
        // Register a pool on a different chain with liquidity
        TestToken tokenC = new TestToken("Token C", "TKC");
        AMM ammCross = new AMM(address(tokenA), address(tokenC));

        // Seed liquidity so quote() can return a value
        uint256 liq = 50_000e18;
        tokenA.approve(address(ammCross), liq);
        tokenC.approve(address(ammCross), liq);
        ammCross.addLiquidity(liq, liq, 0, 0, owner);

        registry.register_pool(
            address(tokenA),
            address(tokenC),
            address(ammCross),
            "othergame-1",  // cross-rollup chain
            20
        );

        tokenA.transfer(alice, 1_000e18);
        vm.startPrank(alice);
        tokenA.approve(address(router), 100e18);

        // Only check that the first topic (user address) matches
        vm.expectEmit(true, false, false, false);
        emit Router.CrossRollupSwapInitiated(alice, bytes32(0), bytes32(0), "");

        router.swap(address(tokenA), address(tokenC), 100e18, 1, block.timestamp + 300);
        vm.stopPrank();
    }

    function test_no_pool_reverts() public {
        TestToken tokenUnlisted = new TestToken("Unknown", "UNK");
        vm.startPrank(alice);
        tokenA.approve(address(router), 100e18);
        vm.expectRevert("no pool found");
        router.swap(address(tokenA), address(tokenUnlisted), 100e18, 0, block.timestamp + 300);
        vm.stopPrank();
    }
}
