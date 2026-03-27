// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAMM {
    function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut) external returns (uint256 amountOut);
    function getAmountOut(address tokenIn, uint256 amountIn) external view returns (uint256 amountOut);
    function getReserves() external view returns (uint256 reserveA, uint256 reserveB);
}
