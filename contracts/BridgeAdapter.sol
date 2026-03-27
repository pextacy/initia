// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ILiquidityEscrow} from "./interfaces/ILiquidityEscrow.sol";

/// @notice Wraps Initia IBC/OPinit bridge calls for cross-rollup token transfers.
///         In production, sendCrossChain triggers an IBC transfer via the precompile.
///         acknowledgeBridge is called by the IBC relayer bot when the message settles.
contract BridgeAdapter is Ownable {
    using SafeERC20 for IERC20;

    struct BridgeRequest {
        bytes32 escrowId;
        address token;
        uint256 amount;
        address recipient;
        string  destinationChainId;
        bool    acknowledged;
        bool    success;
    }

    mapping(bytes32 => BridgeRequest) public pendingBridges;
    ILiquidityEscrow public escrow;
    address public relayer;
    address public router;
    uint256 private _nonce;

    // Initia IBC transfer precompile address (EVM chains)
    address public constant IBC_PRECOMPILE = 0x0000000000000000000000000000000000000802;

    event BridgeSent(
        bytes32 indexed bridgeId,
        string  destinationChainId,
        address token,
        uint256 amount,
        address recipient
    );
    event BridgeAcknowledged(bytes32 indexed bridgeId, bool success);

    modifier onlyRelayer() {
        require(msg.sender == relayer, "not relayer");
        _;
    }

    modifier onlyRouter() {
        require(msg.sender == router, "not router");
        _;
    }

    constructor(address _owner, address _relayer) Ownable(_owner) {
        relayer = _relayer;
    }

    function setEscrow(address _escrow) external onlyOwner {
        require(_escrow != address(0), "zero escrow");
        escrow = ILiquidityEscrow(_escrow);
    }

    function setRouter(address _router) external onlyOwner {
        require(_router != address(0), "zero router");
        router = _router;
    }

    function setRelayer(address _relayer) external onlyOwner {
        require(_relayer != address(0), "zero relayer");
        relayer = _relayer;
    }

    /// @notice Initiates a cross-rollup token transfer via IBC
    function sendCrossChain(
        string  calldata destinationChainId,
        address token,
        uint256 amount,
        address recipient,
        bytes32 escrowId
    ) external onlyRouter returns (bytes32 bridgeId) {
        bridgeId = keccak256(abi.encodePacked(destinationChainId, token, amount, recipient, ++_nonce));

        pendingBridges[bridgeId] = BridgeRequest({
            escrowId:           escrowId,
            token:              token,
            amount:             amount,
            recipient:          recipient,
            destinationChainId: destinationChainId,
            acknowledged:       false,
            success:            false
        });

        // In production: call IBC precompile to trigger transfer
        // IIBCTransfer(IBC_PRECOMPILE).transfer(destinationChainId, token, amount, recipient);

        emit BridgeSent(bridgeId, destinationChainId, token, amount, recipient);
    }

    /// @notice Called by the IBC relayer when the bridge message is acknowledged
    function acknowledgeBridge(bytes32 bridgeId, bool success) external onlyRelayer {
        require(address(escrow) != address(0), "escrow not set");
        BridgeRequest storage req = pendingBridges[bridgeId];
        require(req.amount > 0, "bridge not found");
        require(!req.acknowledged, "already acknowledged");
        req.acknowledged = true;
        req.success = success;

        if (success) {
            escrow.release(req.escrowId);
        } else {
            escrow.refund(req.escrowId);
        }

        emit BridgeAcknowledged(bridgeId, success);
    }
}
