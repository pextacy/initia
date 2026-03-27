// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Simple x*y=k AMM with ERC20 LP tokens
contract AMM is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable tokenA;
    address public immutable tokenB;

    uint256 private reserveA;
    uint256 private reserveB;

    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    event Swap(address indexed sender, address tokenIn, uint256 amountIn, uint256 amountOut, address indexed to);
    event Mint(address indexed sender, uint256 amountA, uint256 amountB, uint256 liquidity);
    event Burn(address indexed sender, uint256 amountA, uint256 amountB, uint256 liquidity);

    constructor(address _tokenA, address _tokenB) ERC20("AppSwap LP", "ASLP") {
        require(_tokenA != address(0) && _tokenB != address(0), "zero token address");
        require(_tokenA != _tokenB, "identical tokens");
        (tokenA, tokenB) = _tokenA < _tokenB ? (_tokenA, _tokenB) : (_tokenB, _tokenA);
    }

    function getReserves() public view returns (uint256 _reserveA, uint256 _reserveB) {
        _reserveA = reserveA;
        _reserveB = reserveB;
    }

    function getAmountOut(address _tokenIn, uint256 amountIn) public view returns (uint256 amountOut) {
        require(amountIn > 0, "insufficient input");
        (uint256 _reserveA, uint256 _reserveB) = getReserves();
        require(_reserveA > 0 && _reserveB > 0, "no liquidity");

        (uint256 reserveIn, uint256 reserveOut) = _tokenIn == tokenA
            ? (_reserveA, _reserveB)
            : (_reserveB, _reserveA);

        // x*y=k with no additional fee (fee is deducted by Router before calling)
        amountOut = (amountIn * reserveOut) / (reserveIn + amountIn);
    }

    function addLiquidity(
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to
    ) external nonReentrant returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        (uint256 _reserveA, uint256 _reserveB) = getReserves();

        if (_reserveA == 0 && _reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = (amountADesired * _reserveB) / _reserveA;
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "insufficient B amount");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = (amountBDesired * _reserveA) / _reserveB;
                require(amountAOptimal >= amountAMin, "insufficient A amount");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }

        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);

        uint256 _totalSupply = totalSupply();
        if (_totalSupply == 0) {
            liquidity = Math.sqrt(amountA * amountB) - MINIMUM_LIQUIDITY;
            _mint(address(0xdead), MINIMUM_LIQUIDITY); // lock minimum liquidity forever
        } else {
            liquidity = Math.min(
                (amountA * _totalSupply) / _reserveA,
                (amountB * _totalSupply) / _reserveB
            );
        }
        require(liquidity > 0, "insufficient liquidity minted");

        _mint(to, liquidity);
        reserveA = _reserveA + amountA;
        reserveB = _reserveB + amountB;

        emit Mint(msg.sender, amountA, amountB, liquidity);
    }

    function removeLiquidity(
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to
    ) external nonReentrant returns (uint256 amountA, uint256 amountB) {
        (uint256 _reserveA, uint256 _reserveB) = getReserves();
        uint256 _totalSupply = totalSupply();

        amountA = (liquidity * _reserveA) / _totalSupply;
        amountB = (liquidity * _reserveB) / _totalSupply;
        require(amountA >= amountAMin, "insufficient A output");
        require(amountB >= amountBMin, "insufficient B output");

        _burn(msg.sender, liquidity);
        IERC20(tokenA).safeTransfer(to, amountA);
        IERC20(tokenB).safeTransfer(to, amountB);

        reserveA = _reserveA - amountA;
        reserveB = _reserveB - amountB;

        emit Burn(msg.sender, amountA, amountB, liquidity);
    }

    /// @notice Swap tokens. Caller must have sent tokenIn to this contract already, or use transferFrom.
    function swap(
        address _tokenIn,
        uint256 amountIn,
        uint256 minAmountOut
    ) external nonReentrant returns (uint256 amountOut) {
        require(_tokenIn == tokenA || _tokenIn == tokenB, "invalid token");
        require(amountIn > 0, "insufficient input");

        IERC20(_tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        amountOut = getAmountOut(_tokenIn, amountIn);
        require(amountOut >= minAmountOut, "slippage exceeded");

        address tokenOut = _tokenIn == tokenA ? tokenB : tokenA;
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        if (_tokenIn == tokenA) {
            reserveA += amountIn;
            reserveB -= amountOut;
        } else {
            reserveB += amountIn;
            reserveA -= amountOut;
        }

        emit Swap(msg.sender, _tokenIn, amountIn, amountOut, msg.sender);
    }
}
