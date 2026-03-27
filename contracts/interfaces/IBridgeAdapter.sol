// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IBridgeAdapter {
    function sendCrossChain(
        string  calldata destinationChainId,
        address token,
        uint256 amount,
        address recipient,
        bytes32 escrowId
    ) external returns (bytes32 bridgeId);
}
