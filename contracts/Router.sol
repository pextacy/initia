// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";
import {IAMM} from "./interfaces/IAMM.sol";
import {ILiquidityEscrow} from "./interfaces/ILiquidityEscrow.sol";
import {IBridgeAdapter} from "./interfaces/IBridgeAdapter.sol";
import {IFeeDistributor} from "./interfaces/IFeeDistributor.sol";

contract Router is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IPoolRegistry   public registry;
    IBridgeAdapter  public bridge;
    IFeeDistributor public feeDistributor;
    ILiquidityEscrow public escrow;

    string  public localChainId;
    bool    public paused;

    uint64 public constant TOTAL_FEE_BPS = 25; // 0.25% total swap fee

    event SwapExecuted(
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        bytes32 indexed poolId
    );
    event CrossRollupSwapInitiated(
        address indexed user,
        bytes32 indexed bridgeId,
        bytes32 indexed escrowId,
        string destinationChainId
    );

    modifier notPaused() {
        require(!paused, "paused");
        _;
    }

    constructor(
        address _owner,
        address _registry,
        address _bridge,
        address _feeDistributor,
        address _escrow,
        string memory _localChainId
    ) Ownable(_owner) {
        registry      = IPoolRegistry(_registry);
        bridge        = IBridgeAdapter(_bridge);
        feeDistributor = IFeeDistributor(_feeDistributor);
        escrow        = ILiquidityEscrow(_escrow);
        localChainId  = _localChainId;
    }

    // -------------------------------------------------------------------------
    // View
    // -------------------------------------------------------------------------

    /// @notice Returns the best pool and expected output for a given swap.
    function quote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public view returns (uint256 bestAmountOut, bytes32 bestPoolId) {
        bytes32[] memory ids = registry.getAllPoolIds();
        for (uint256 i = 0; i < ids.length; i++) {
            IPoolRegistry.PoolConfig memory pool;
            try registry.get_pool(ids[i]) returns (IPoolRegistry.PoolConfig memory p) {
                pool = p;
            } catch {
                continue;
            }
            if (pool.tokenA != tokenIn && pool.tokenB != tokenIn) continue;
            if (pool.tokenA != tokenOut && pool.tokenB != tokenOut) continue;

            try IAMM(pool.poolAddress).getAmountOut(tokenIn, amountIn) returns (uint256 out) {
                if (out > bestAmountOut) {
                    bestAmountOut = out;
                    bestPoolId    = ids[i];
                }
            } catch {
                continue; // pool has no liquidity or is unavailable — skip
            }
        }
    }

    // -------------------------------------------------------------------------
    // Swap
    // -------------------------------------------------------------------------

    /// @notice Main swap entry point.
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external notPaused nonReentrant returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "expired");
        require(amountIn > 0, "zero input");

        // Pull tokens from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // Deduct fee upfront
        uint256 grossFee    = (amountIn * TOTAL_FEE_BPS) / 10000;
        uint256 amountInNet = amountIn - grossFee;

        // Find best pool
        (uint256 expectedOut, bytes32 poolId) = quote(tokenIn, tokenOut, amountInNet);
        require(poolId != bytes32(0), "no pool found");
        require(expectedOut >= minAmountOut, "slippage");

        IPoolRegistry.PoolConfig memory pool = registry.get_pool(poolId);

        // Route swap
        bool isCrossRollup = keccak256(bytes(pool.rollupChainId)) != keccak256(bytes(localChainId));
        if (!isCrossRollup) {
            // Same-chain: approve AMM, swap, send output to user
            IERC20(tokenIn).forceApprove(pool.poolAddress, amountInNet);
            amountOut = IAMM(pool.poolAddress).swap(tokenIn, amountInNet, minAmountOut);
            IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
            require(amountOut >= minAmountOut, "slippage exceeded");
        } else {
            // Cross-rollup: async — tokens are locked in escrow and bridged.
            // amountOut is 0; the user receives tokens on the destination chain via bridge ACK.
            amountOut = 0;
            _crossRollupSwap(pool, poolId, tokenIn, amountInNet, minAmountOut);
        }

        // Transfer fee tokens to FeeDistributor — skip when grossFee rounds to 0
        // (prevents revert on dust-level swaps where amountIn * 25 / 10000 == 0)
        if (grossFee > 0) {
            IERC20(tokenIn).forceApprove(address(feeDistributor), grossFee);
            feeDistributor.distribute(poolId, tokenIn, grossFee);
        }

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, poolId);
    }

    function _crossRollupSwap(
        IPoolRegistry.PoolConfig memory pool,
        bytes32, // poolId — reserved for future destination-side validation
        address tokenIn,
        uint256 amountIn,
        uint256  // minOut — forwarded in bridge payload for destination AMM enforcement
    ) internal {
        // Lock tokenIn in escrow; escrow will hold until bridge ACK.
        // On success: bridge releases output tokens to user on destination chain.
        // On failure: escrow.refund() returns tokenIn to user on this chain.
        IERC20(tokenIn).forceApprove(address(escrow), amountIn);
        bytes32 escrowId = escrow.lock(tokenIn, amountIn, msg.sender, msg.sender);

        bytes32 bridgeId = bridge.sendCrossChain(
            pool.rollupChainId,
            tokenIn,
            amountIn,
            pool.poolAddress,
            escrowId
        );

        emit CrossRollupSwapInitiated(msg.sender, bridgeId, escrowId, pool.rollupChainId);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function pause() external onlyOwner   { paused = true; }
    function unpause() external onlyOwner { paused = false; }

    function setRegistry(address _registry) external onlyOwner {
        require(_registry != address(0), "zero address");
        registry = IPoolRegistry(_registry);
    }

    function setBridge(address _bridge) external onlyOwner {
        require(_bridge != address(0), "zero address");
        bridge = IBridgeAdapter(_bridge);
    }

    function setFeeDistributor(address _feeDistributor) external onlyOwner {
        require(_feeDistributor != address(0), "zero address");
        feeDistributor = IFeeDistributor(_feeDistributor);
    }

    function setEscrow(address _escrow) external onlyOwner {
        require(_escrow != address(0), "zero address");
        escrow = ILiquidityEscrow(_escrow);
    }
}
