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
        uint256 deployerKey   = vm.envUint("PRIVATE_KEY");
        address deployer      = vm.addr(deployerKey);
        address treasury      = vm.envOr("TREASURY_ADDRESS", deployer);
        address relayer       = vm.envOr("RELAYER_ADDRESS",  deployer);
        string memory chainId = vm.envOr("CHAIN_ID", string("evm-1"));

        vm.startBroadcast(deployerKey);

        PoolRegistry    registry      = new PoolRegistry();
        FeeDistributor  feeDist       = new FeeDistributor(deployer, treasury);
        feeDist.setRegistry(address(registry));
        LiquidityEscrow escrow        = new LiquidityEscrow(deployer);
        BridgeAdapter   bridgeAdapter = new BridgeAdapter(deployer, relayer);
        bridgeAdapter.setEscrow(address(escrow));
        Router router = new Router(
            deployer, address(registry), address(bridgeAdapter),
            address(feeDist), address(escrow), chainId
        );
        feeDist.setRouter(address(router));
        escrow.setRouter(address(router));
        escrow.setBridgeAdapter(address(bridgeAdapter));
        bridgeAdapter.setRouter(address(router));

        vm.stopBroadcast();

        console.log("=== AppSwap Deployed on", chainId, "===");
        console.log("Router:         ", address(router));
        console.log("PoolRegistry:   ", address(registry));
        console.log("FeeDistributor: ", address(feeDist));
        console.log("LiquidityEscrow:", address(escrow));
        console.log("BridgeAdapter:  ", address(bridgeAdapter));
        console.log("");
        console.log("# Copy to frontend/.env:");
        _logAddr("VITE_ROUTER_ADDRESS",          address(router));
        _logAddr("VITE_POOL_REGISTRY_ADDRESS",   address(registry));
        _logAddr("VITE_FEE_DISTRIBUTOR_ADDRESS", address(feeDist));
    }

    function _logAddr(string memory key, address val) internal pure {
        console.log(string.concat(key, "="), val);
    }
}
