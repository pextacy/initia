// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPoolRegistry} from "./interfaces/IPoolRegistry.sol";

contract FeeDistributor is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    address public protocolTreasury;
    IPoolRegistry public registry;
    address public router;

    // token => recipient => pending amount
    mapping(address => mapping(address => uint256)) public pendingFees;
    uint256 public totalDistributed;

    // Total fee deducted by the Router per swap (25 bps = 0.25%)
    // Rollup share = pool.feeBps / TOTAL_FEE_BPS of grossFee
    // Protocol share = remainder (no dust ever lost)
    uint64 public constant TOTAL_FEE_BPS = 25;

    event FeeDistributed(
        bytes32 indexed poolId,
        address indexed feeToken,
        address recipient,
        uint256 rollupAmount,
        uint256 protocolAmount
    );
    event FeeClaimed(address indexed recipient, address indexed token, uint256 amount);

    modifier onlyRouter() {
        require(msg.sender == router, "not router");
        _;
    }

    constructor(address _owner, address _protocolTreasury) Ownable(_owner) {
        require(_protocolTreasury != address(0), "zero treasury");
        protocolTreasury = _protocolTreasury;
    }

    function setRegistry(address _registry) external onlyOwner {
        registry = IPoolRegistry(_registry);
    }

    function setRouter(address _router) external onlyOwner {
        router = _router;
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "zero treasury");
        protocolTreasury = _treasury;
    }

    /// @notice Called by Router after each swap to distribute the gross fee
    /// @param poolId  The pool that generated the fee
    /// @param feeToken The token the fee is denominated in
    /// @param grossFee Total fee amount (already deducted from amountIn)
    function distribute(
        bytes32 poolId,
        address feeToken,
        uint256 grossFee
    ) external onlyRouter {
        require(address(registry) != address(0), "registry not set");
        require(grossFee > 0, "zero fee");

        // Pull fee tokens from the router (router must have transferred them here first)
        IERC20(feeToken).safeTransferFrom(msg.sender, address(this), grossFee);

        IPoolRegistry.PoolConfig memory pool = registry.get_pool(poolId);

        // rollup gets pool.feeBps/TOTAL_FEE_BPS share of the gross fee
        // e.g. feeBps=20, TOTAL=25 → rollup gets 80%, protocol gets 20%
        uint256 rollupFee   = (grossFee * pool.feeBps) / TOTAL_FEE_BPS;
        // Protocol gets the remainder — no dust ever lost
        uint256 protocolFee = grossFee - rollupFee;

        pendingFees[feeToken][pool.feeRecipient] += rollupFee;
        pendingFees[feeToken][protocolTreasury]  += protocolFee;
        totalDistributed                         += grossFee;

        emit FeeDistributed(poolId, feeToken, pool.feeRecipient, rollupFee, protocolFee);
    }

    /// @notice Claim all pending fees for a given token
    function claim(address token) external nonReentrant {
        uint256 amount = pendingFees[token][msg.sender];
        require(amount > 0, "nothing to claim");
        pendingFees[token][msg.sender] = 0;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit FeeClaimed(msg.sender, token, amount);
    }

    /// @notice Claim all pending fees for multiple tokens in one tx
    function claimMultiple(address[] calldata tokens) external nonReentrant {
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = pendingFees[tokens[i]][msg.sender];
            if (amount > 0) {
                pendingFees[tokens[i]][msg.sender] = 0;
                IERC20(tokens[i]).safeTransfer(msg.sender, amount);
                emit FeeClaimed(msg.sender, tokens[i], amount);
            }
        }
    }
}
