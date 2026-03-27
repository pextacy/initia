// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFeeDistributor {
    function distribute(bytes32 poolId, address feeToken, uint256 grossFee) external;
}
