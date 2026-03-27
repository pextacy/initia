// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {AMM} from "../contracts/AMM.sol";
import {ERC20Mock} from "./mocks/ERC20Mock.sol";

contract AMMTest is Test {
    AMM    public amm;
    ERC20Mock public tokenA;
    ERC20Mock public tokenB;

    address alice = address(0xA11CE);
    address bob   = address(0xB0B);

    uint256 constant INIT_SUPPLY = 1_000_000 ether;
    uint256 constant LIQUIDITY_A = 100_000 ether;
    uint256 constant LIQUIDITY_B = 200_000 ether; // 1 A = 2 B initial price

    function setUp() public {
        tokenA = new ERC20Mock("Token A", "TKA", 18);
        tokenB = new ERC20Mock("Token B", "TKB", 18);

        // Sort so AMM sorts them correctly
        (address t0, address t1) = address(tokenA) < address(tokenB)
            ? (address(tokenA), address(tokenB))
            : (address(tokenB), address(tokenA));

        amm = new AMM(t0, t1);

        tokenA.mint(alice, INIT_SUPPLY);
        tokenB.mint(alice, INIT_SUPPLY);
        tokenA.mint(bob,   INIT_SUPPLY);
        tokenB.mint(bob,   INIT_SUPPLY);
    }

    // ── Liquidity ───────────────────────────────────────────────────────────

    function test_addLiquidity_initial() public {
        // Use amm.tokenA/B() — AMM sorts by address, so we must match its order
        address tA = amm.tokenA();
        address tB = amm.tokenB();
        vm.startPrank(alice);
        ERC20Mock(tA).approve(address(amm), LIQUIDITY_A);
        ERC20Mock(tB).approve(address(amm), LIQUIDITY_B);

        (, , uint256 lp) = amm.addLiquidity(LIQUIDITY_A, LIQUIDITY_B, 0, 0, alice);
        assertGt(lp, 0, "should mint LP tokens");

        (uint256 rA, uint256 rB) = amm.getReserves();
        assertEq(rA, LIQUIDITY_A);
        assertEq(rB, LIQUIDITY_B);
        vm.stopPrank();
    }

    function test_addLiquidity_subsequent() public {
        _addInitialLiquidity(alice);

        // Must approve in sorted token order to match AMM's internal tokenA/tokenB
        address tA = amm.tokenA();
        address tB = amm.tokenB();
        vm.startPrank(bob);
        uint256 addA = 10_000 ether;
        uint256 addB = 20_000 ether;
        ERC20Mock(tA).approve(address(amm), addA);
        ERC20Mock(tB).approve(address(amm), addB);

        (, , uint256 lp) = amm.addLiquidity(addA, addB, 0, 0, bob);
        assertGt(lp, 0, "should mint LP tokens for subsequent LP");
        vm.stopPrank();
    }

    function test_removeLiquidity() public {
        _addInitialLiquidity(alice);

        vm.startPrank(alice);
        uint256 lpBal = amm.balanceOf(alice);
        assertGt(lpBal, 0);

        (uint256 outA, uint256 outB) = amm.removeLiquidity(lpBal, 0, 0, alice);
        assertGt(outA, 0, "should return token A");
        assertGt(outB, 0, "should return token B");
        assertEq(amm.balanceOf(alice), 0, "LP balance should be 0");
        vm.stopPrank();
    }

    // ── Swap ────────────────────────────────────────────────────────────────

    function test_swap_AtoB() public {
        _addInitialLiquidity(alice);

        vm.startPrank(bob);
        uint256 swapIn = 1_000 ether;
        address tIn    = amm.tokenA();
        address tOut   = amm.tokenB();

        ERC20Mock(tIn).approve(address(amm), swapIn);
        uint256 expectedOut = amm.getAmountOut(tIn, swapIn);
        assertGt(expectedOut, 0, "quote should be positive");

        uint256 balBefore = ERC20Mock(tOut).balanceOf(bob);
        amm.swap(tIn, swapIn, 0);
        uint256 balAfter = ERC20Mock(tOut).balanceOf(bob);

        assertEq(balAfter - balBefore, expectedOut, "received wrong amount");
        vm.stopPrank();
    }

    function test_swap_BtoA() public {
        _addInitialLiquidity(alice);

        vm.startPrank(bob);
        address tIn  = amm.tokenB();
        address tOut = amm.tokenA();
        uint256 swapIn = 1_000 ether;

        ERC20Mock(tIn).approve(address(amm), swapIn);
        uint256 expected = amm.getAmountOut(tIn, swapIn);
        uint256 before   = ERC20Mock(tOut).balanceOf(bob);
        amm.swap(tIn, swapIn, 0);
        assertEq(ERC20Mock(tOut).balanceOf(bob) - before, expected);
        vm.stopPrank();
    }

    function test_swap_reverts_on_slippage() public {
        _addInitialLiquidity(alice);

        vm.startPrank(bob);
        address tIn = amm.tokenA();
        uint256 swapIn = 1_000 ether;
        ERC20Mock(tIn).approve(address(amm), swapIn);

        // Demand impossible amount out
        vm.expectRevert("slippage exceeded");
        amm.swap(tIn, swapIn, type(uint256).max);
        vm.stopPrank();
    }

    // ── Fuzz ────────────────────────────────────────────────────────────────

    function testFuzz_swap(uint256 amountIn) public {
        _addInitialLiquidity(alice);
        // Bound to realistic range: 1 wei to 10% of reserve
        amountIn = bound(amountIn, 1, LIQUIDITY_A / 10);

        address tIn = amm.tokenA();
        address tOut = amm.tokenB();

        vm.startPrank(bob);
        ERC20Mock(tIn).approve(address(amm), amountIn);
        uint256 expected = amm.getAmountOut(tIn, amountIn);
        uint256 before   = ERC20Mock(tOut).balanceOf(bob);
        amm.swap(tIn, amountIn, 0);
        assertEq(ERC20Mock(tOut).balanceOf(bob) - before, expected);
        vm.stopPrank();
    }

    function testFuzz_xy_k_invariant(uint256 amountIn) public {
        _addInitialLiquidity(alice);
        amountIn = bound(amountIn, 1, LIQUIDITY_A / 10);

        (uint256 rA0, uint256 rB0) = amm.getReserves();
        uint256 k0 = rA0 * rB0;

        address tIn = amm.tokenA();
        vm.startPrank(bob);
        ERC20Mock(tIn).approve(address(amm), amountIn);
        amm.swap(tIn, amountIn, 0);
        vm.stopPrank();

        (uint256 rA1, uint256 rB1) = amm.getReserves();
        uint256 k1 = rA1 * rB1;
        // AMM is fee-free (fee deducted by Router). Floor division means k1 >= k0 always.
        assertGe(k1, k0, "invariant violated");
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    function _addInitialLiquidity(address provider) internal {
        address tA = amm.tokenA();
        address tB = amm.tokenB();
        vm.startPrank(provider);
        ERC20Mock(tA).approve(address(amm), LIQUIDITY_A);
        ERC20Mock(tB).approve(address(amm), LIQUIDITY_B);
        amm.addLiquidity(LIQUIDITY_A, LIQUIDITY_B, 0, 0, provider);
        vm.stopPrank();
    }
}
