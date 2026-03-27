// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Holds tokens in escrow during cross-rollup bridge transfers.
///         If the bridge succeeds, tokens are released to recipient.
///         If the bridge fails, tokens are refunded to the original user.
contract LiquidityEscrow is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct EscrowRecord {
        address token;
        uint256 amount;
        address user;       // original sender — receives refund on failure
        address recipient;  // intended recipient after bridge
        bool    released;
        bool    refunded;
    }

    mapping(bytes32 => EscrowRecord) public escrows;
    address public router;
    address public bridgeAdapter;
    uint256 private _nonce;

    event Locked(bytes32 indexed escrowId, address token, uint256 amount, address user);
    event Released(bytes32 indexed escrowId, address recipient, uint256 amount);
    event Refunded(bytes32 indexed escrowId, address user, uint256 amount);

    modifier onlyAuthorized() {
        require(msg.sender == router || msg.sender == bridgeAdapter, "not authorized");
        _;
    }

    constructor(address _owner) Ownable(_owner) {}

    function setRouter(address _router) external onlyOwner {
        require(_router != address(0), "zero router");
        router = _router;
    }

    function setBridgeAdapter(address _bridgeAdapter) external onlyOwner {
        require(_bridgeAdapter != address(0), "zero bridge adapter");
        bridgeAdapter = _bridgeAdapter;
    }

    function lock(
        address token,
        uint256 amount,
        address user,
        address recipient
    ) external onlyAuthorized nonReentrant returns (bytes32 escrowId) {
        require(amount > 0, "zero amount");
        escrowId = keccak256(abi.encodePacked(token, amount, user, block.timestamp, blockhash(block.number - 1), ++_nonce));
        require(escrows[escrowId].amount == 0, "escrow id collision");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        escrows[escrowId] = EscrowRecord({
            token:     token,
            amount:    amount,
            user:      user,
            recipient: recipient,
            released:  false,
            refunded:  false
        });

        emit Locked(escrowId, token, amount, user);
    }

    function release(bytes32 escrowId) external onlyAuthorized nonReentrant {
        EscrowRecord storage rec = escrows[escrowId];
        require(rec.amount > 0, "escrow not found");
        require(!rec.released && !rec.refunded, "already settled");

        rec.released = true;
        IERC20(rec.token).safeTransfer(rec.recipient, rec.amount);

        emit Released(escrowId, rec.recipient, rec.amount);
    }

    function refund(bytes32 escrowId) external onlyAuthorized nonReentrant {
        EscrowRecord storage rec = escrows[escrowId];
        require(rec.amount > 0, "escrow not found");
        require(!rec.released && !rec.refunded, "already settled");

        rec.refunded = true;
        IERC20(rec.token).safeTransfer(rec.user, rec.amount);

        emit Refunded(escrowId, rec.user, rec.amount);
    }
}
