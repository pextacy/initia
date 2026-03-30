// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAMM {
    function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut) external returns (uint256 amountOut);
    function getAmountOut(address tokenIn, uint256 amountIn) external view returns (uint256 amountOut);
    function getReserves() external view returns (uint256 reserveA, uint256 reserveB);
    function tokenA() external view returns (address);
    function tokenB() external view returns (address);
    function addLiquidity(
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);
    function removeLiquidity(
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to
    ) external returns (uint256 amountA, uint256 amountB);
}
