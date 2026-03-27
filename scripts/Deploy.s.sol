// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PoolRegistry}    from "../contracts/PoolRegistry.sol";
import {FeeDistributor}  from "../contracts/FeeDistributor.sol";
import {LiquidityEscrow} from "../contracts/LiquidityEscrow.sol";
import {BridgeAdapter}   from "../contracts/BridgeAdapter.sol";
import {Router}          from "../contracts/Router.sol";
import {AMM}             from "../contracts/AMM.sol";
import {ERC20Mock}       from "../test/mocks/ERC20Mock.sol";

contract Deploy is Script {

    // ── Seed amounts (~$12,400 per side) ─────────────────────────────────────
    // INIT $1.24 · USDC $1.00 · ETH $3,400 · WBTC $65,000
    uint256 constant INIT_SEED   = 10_000   * 1e18;  // 10,000 INIT
    uint256 constant USDC_SEED   = 12_400   * 1e6;   // 12,400 USDC
    uint256 constant ETH_SEED    = 3647     * 1e15;  // 3.647 ETH  (3647e15 = 3.647e18)
    uint256 constant WBTC_SEED   = 19077    * 1e3;   // 0.19077 WBTC (19077e3 = 0.19077e8)
    uint256 constant USDC_SEED2  = 12_400   * 1e6;   // 12,400 USDC for USDC/ETH pool

    function run() external {
        uint256 deployerKey   = vm.envUint("PRIVATE_KEY");
        address deployer      = vm.addr(deployerKey);
        address treasury      = vm.envOr("TREASURY_ADDRESS", deployer);
        address relayer       = vm.envOr("RELAYER_ADDRESS",  deployer);
        string memory chainId = vm.envOr("LOCAL_CHAIN_ID",   string("appswap-1"));

        vm.startBroadcast(deployerKey);

        // ── Infrastructure ────────────────────────────────────────────────────
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

        // ── Tokens: use env vars if provided (testnet), else deploy mocks ─────
        address tInit = vm.envOr("TOKEN_INIT", address(0));
        address tUsdc = vm.envOr("TOKEN_USDC", address(0));
        address tWbtc = vm.envOr("TOKEN_WBTC", address(0));
        address tEth  = vm.envOr("TOKEN_ETH",  address(0));

        if (tInit == address(0)) {
            ERC20Mock mInit = new ERC20Mock("Initia",         "INIT", 18);
            ERC20Mock mUsdc = new ERC20Mock("USD Coin",        "USDC", 6);
            ERC20Mock mWbtc = new ERC20Mock("Wrapped Bitcoin", "WBTC", 8);
            ERC20Mock mEth  = new ERC20Mock("Wrapped Ether",   "ETH",  18);
            mInit.mint(deployer, 1_000_000 * 1e18);
            mUsdc.mint(deployer, 50_000_000 * 1e6);
            mWbtc.mint(deployer, 500 * 1e8);
            mEth.mint(deployer,  5_000 * 1e18);
            tInit = address(mInit);
            tUsdc = address(mUsdc);
            tWbtc = address(mWbtc);
            tEth  = address(mEth);
        }

        // ── Deploy 4 AMM pools ────────────────────────────────────────────────
        AMM ammInitUsdc = new AMM(tInit, tUsdc);
        AMM ammInitEth  = new AMM(tInit, tEth);
        AMM ammInitWbtc = new AMM(tInit, tWbtc);
        AMM ammUsdcEth  = new AMM(tUsdc, tEth);

        // ── Seed liquidity ────────────────────────────────────────────────────
        _seed(ammInitUsdc, tInit, tUsdc, INIT_SEED,  USDC_SEED,  deployer);
        _seed(ammInitEth,  tInit, tEth,  INIT_SEED,  ETH_SEED,   deployer);
        _seed(ammInitWbtc, tInit, tWbtc, INIT_SEED,  WBTC_SEED,  deployer);
        _seed(ammUsdcEth,  tUsdc, tEth,  USDC_SEED2, ETH_SEED,   deployer);

        // ── Register pools (deployer = feeRecipient, 20bps) ──────────────────
        registry.register_pool(tInit, tUsdc, address(ammInitUsdc), chainId, 20);
        registry.register_pool(tInit, tEth,  address(ammInitEth),  chainId, 20);
        registry.register_pool(tInit, tWbtc, address(ammInitWbtc), chainId, 20);
        registry.register_pool(tUsdc, tEth,  address(ammUsdcEth),  chainId, 20);

        vm.stopBroadcast();

        // ── Print .env values ─────────────────────────────────────────────────
        console.log("\n=== AppSwap Deployment Complete ===");
        console.log("# Paste into frontend/.env:");
        console.log("");
        _log("VITE_RPC_URL",                  "http://127.0.0.1:8545");
        _logAddr("VITE_ROUTER_ADDRESS",          address(router));
        _logAddr("VITE_POOL_REGISTRY_ADDRESS",   address(registry));
        _logAddr("VITE_FEE_DISTRIBUTOR_ADDRESS", address(feeDist));
        _logAddr("VITE_TOKEN_INIT_ADDRESS",       tInit);
        _logAddr("VITE_TOKEN_USDC_ADDRESS",       tUsdc);
        _logAddr("VITE_TOKEN_WBTC_ADDRESS",       tWbtc);
        _logAddr("VITE_TOKEN_ETH_ADDRESS",        tEth);
        console.log("");
        console.log("Pools (4 registered, seeded ~$12,400 each side):");
        console.log("  INIT/USDC:", address(ammInitUsdc));
        console.log("  INIT/ETH: ", address(ammInitEth));
        console.log("  INIT/WBTC:", address(ammInitWbtc));
        console.log("  USDC/ETH: ", address(ammUsdcEth));
    }

    /// @dev Approves and seeds a pool, respecting AMM's internal address-sorted tokenA/tokenB.
    function _seed(
        AMM amm,
        address tok0, address tok1,
        uint256 amt0, uint256 amt1,
        address to
    ) internal {
        // AMM constructor sorts tokens by address — match correctly
        bool tok0isA = amm.tokenA() == tok0;
        (uint256 amtA, uint256 amtB) = tok0isA ? (amt0, amt1) : (amt1, amt0);
        address tokA = tok0isA ? tok0 : tok1;
        address tokB = tok0isA ? tok1 : tok0;
        IERC20(tokA).approve(address(amm), type(uint256).max);
        IERC20(tokB).approve(address(amm), type(uint256).max);
        amm.addLiquidity(amtA, amtB, 0, 0, to);
    }

    function _logAddr(string memory key, address val) internal pure {
        console.log(string.concat(key, "="), val);
    }
    function _log(string memory key, string memory val) internal pure {
        console.log(string.concat(key, "=", val));
    }
}
