// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PoolRegistry}    from "../contracts/PoolRegistry.sol";
import {FeeDistributor}  from "../contracts/FeeDistributor.sol";
import {LiquidityEscrow} from "../contracts/LiquidityEscrow.sol";
import {BridgeAdapter}   from "../contracts/BridgeAdapter.sol";
import {Router}          from "../contracts/Router.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);
        address treasury    = vm.envOr("TREASURY_ADDRESS", deployer);
        address relayer     = vm.envOr("RELAYER_ADDRESS",  deployer);
        string memory chainId = vm.envOr("LOCAL_CHAIN_ID", string("appswap-1"));

        vm.startBroadcast(deployerKey);

        // 1. Registry
        PoolRegistry registry = new PoolRegistry();
        console.log("PoolRegistry:   ", address(registry));

        // 2. Fee Distributor
        FeeDistributor feeDistributor = new FeeDistributor(deployer, treasury);
        feeDistributor.setRegistry(address(registry));
        console.log("FeeDistributor: ", address(feeDistributor));

        // 3. Liquidity Escrow
        LiquidityEscrow escrow = new LiquidityEscrow(deployer);
        console.log("LiquidityEscrow:", address(escrow));

        // 4. Bridge Adapter
        BridgeAdapter bridgeAdapter = new BridgeAdapter(deployer, relayer);
        bridgeAdapter.setEscrow(address(escrow));
        console.log("BridgeAdapter:  ", address(bridgeAdapter));

        // 5. Router
        Router router = new Router(
            deployer,
            address(registry),
            address(bridgeAdapter),
            address(feeDistributor),
            address(escrow),
            chainId
        );
        console.log("Router:         ", address(router));

        // 6. Wire up cross-references
        feeDistributor.setRouter(address(router));
        escrow.setRouter(address(router));
        escrow.setBridgeAdapter(address(bridgeAdapter));
        bridgeAdapter.setRouter(address(router));

        vm.stopBroadcast();

        // Print summary
        console.log("\n=== AppSwap Deployment Summary ===");
        console.log("Chain ID:       ", chainId);
        console.log("Deployer:       ", deployer);
        console.log("Treasury:       ", treasury);
        console.log("Relayer:        ", relayer);
        console.log("PoolRegistry:   ", address(registry));
        console.log("FeeDistributor: ", address(feeDistributor));
        console.log("LiquidityEscrow:", address(escrow));
        console.log("BridgeAdapter:  ", address(bridgeAdapter));
        console.log("Router:         ", address(router));
    }
}
