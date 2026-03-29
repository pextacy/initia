# AppSwap — Cross-Rollup DEX on Initia

> Permissionless decentralized exchange where any Initia rollup can register a liquidity pool and earn swap fee revenue in real time.

Built for the **Initia Hackathon Season 1 · DeFi Track** · Submission deadline: 15 April 2026

---

## What it does

AppSwap is a fully on-chain DEX built on an Initia EVM appchain. Any rollup in the Initia ecosystem can register a liquidity pool and instantly start earning 20bps on every swap routed through it — no permission needed, no intermediary.

Users get a professional trading interface with live Bybit order book data, real-time market stats, limit/stop/TP orders, and one-click cross-rollup swaps via the Interwoven Bridge.

**Key properties:**
- **0.25% total fee** — 20bps to the rollup owner, 5bps to protocol, no dust ever lost
- **Same-chain swaps** settle in ~100ms (Initia block time)
- **Cross-rollup swaps** route through the Interwoven Bridge (~2–5s finality)
- **Session keys** via InterwovenKit — sign once, trade without per-tx popups
- **`.init` usernames** displayed throughout the UI
- **Live market data** — real order book and price feeds from Bybit, no mock data

---

## Architecture

```
AppSwap appchain (appswap-1)
├── Router.sol          — swap entry point, routes same-chain & cross-rollup
├── PoolRegistry.sol    — any rollup registers pools here (permissionless)
├── FeeDistributor.sol  — tracks & pays out fee earnings per rollup
├── BridgeAdapter.sol   — wraps IBC/OPinit calls for cross-rollup swaps
├── LiquidityEscrow.sol — holds tokens safely during bridge transit
└── AMM.sol             — x*y=k constant product AMM with ERC20 LP tokens

Frontend (React + Vite + Tailwind)
├── Trading terminal    — TradingView chart, live order book, swap panel
├── Pools               — register pools, add/remove liquidity
├── Earn                — LP positions, fee earnings, tx history
├── Bridge              — cross-rollup asset transfer
└── Stats / Leaderboard — protocol analytics
```

---

## Initia-native features

| Feature | Implementation |
|---|---|
| **InterwovenKit session keys** | `frontend/src/main.tsx` — `InterwovenKitProvider` wraps the app; users sign once per session |
| **Interwoven Bridge** | `contracts/BridgeAdapter.sol` + `contracts/LiquidityEscrow.sol` — async cross-rollup swap flow with nonce-based bridge IDs |
| **`.init` usernames** | `frontend/src/components/Header.tsx` + `WalletMenu.tsx` — resolves and displays `.init` names |

---

## Smart contracts

| Contract | Description |
|---|---|
| `Router.sol` | Main swap entry — `quote()` finds best pool, `swap()` executes with slippage protection |
| `PoolRegistry.sol` | Any rollup calls `register_pool()` to list their AMM and start earning fees |
| `FeeDistributor.sol` | Tracks per-rollup fee accrual; rollup owners call `claim()` to withdraw earnings |
| `AMM.sol` | x*y=k AMM with ERC20 LP tokens; `addLiquidity` / `removeLiquidity` |
| `BridgeAdapter.sol` | Wraps IBC/OPinit bridge calls; uses incrementing nonce (not timestamp) to avoid collisions |
| `LiquidityEscrow.sol` | Atomic escrow for tokens in-flight during cross-rollup swaps |

---

## Revenue model

| Recipient | Rate | On $1,000 swap |
|---|---|---|
| Pool's rollup owner | 0.20% (20 bps) | $2.00 |
| AppSwap protocol | 0.05% (5 bps) | $0.50 |
| **Total** | **0.25%** | **$2.50** |

Fee split is calculated dust-free: `protocolFee = grossFee - rollupFee` (remainder goes to protocol, never lost).

---

## Setup

### Prerequisites

- Foundry: `curl -L https://foundry.paradigm.xyz | bash`
- Node.js 18+
- Docker Desktop (for IBC relayer, cross-rollup swaps only)

### 1. Install dependencies

```bash
forge install OpenZeppelin/openzeppelin-contracts
```

### 2. Deploy contracts

```bash
export PRIVATE_KEY=0x...   # your deployer key
./scripts/deploy.sh local
```

Copy the printed addresses into `frontend/.env` (see `frontend/.env.example` for all variable names).

### 3. Run frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. (Optional) Cross-rollup support

```bash
weave init                        # VM=EVM, chain-id=appswap-1
weave opinit start executor -d
weave relayer start -d
```

---

## Testing

```bash
forge test -vv
# 41 tests, 0 failures
```

Includes unit tests for every contract and end-to-end integration tests covering swap routing, fee distribution, slippage protection, and liquidity management.
