# AppSwap — Cross-Rollup DEX on Initia

> Permissionless decentralized exchange where any Initia rollup can register a liquidity pool and earn swap fee revenue in real time.

Built for the **Initia Hackathon Season 1 · DeFi Track** · Submission deadline: 15 April 2026

---

## What it does

AppSwap lets users swap tokens across any Initia rollup through a single interface. The rollup that owns the liquidity pool automatically earns 20bps of every swap that routes through it — on-chain, in real time, with no middleman.

**Key properties:**
- 0.25% total swap fee (20bps to rollup owner, 5bps to protocol)
- Same-chain swaps settle in ~100ms (Initia block time)
- Cross-rollup swaps route through the Interwoven Bridge (~2–5s)
- Session keys via InterwovenKit — no per-transaction popups
- `.init` username display throughout the UI

---

## Architecture

```
AppSwap appchain (appswap-1)
├── Router.sol          — swap entry point, routes same-chain & cross-rollup
├── PoolRegistry.sol    — any rollup registers pools here
├── FeeDistributor.sol  — tracks & pays out fee earnings per rollup
├── BridgeAdapter.sol   — wraps IBC/OPinit calls for cross-rollup swaps
├── LiquidityEscrow.sol — holds tokens safely during bridge transit
└── AMM.sol             — x*y=k AMM with ERC20 LP tokens
```

---

## Setup

### Prerequisites

- Docker Desktop (running, for IBC relayer)
- Go 1.22+
- Foundry: `curl -L https://foundry.paradigm.xyz | bash`
- Node.js 18+

### 1. Launch appchain

```bash
weave init
# Follow prompts: VM=EVM, chain-id=appswap-1
weave opinit start executor -d
weave relayer start -d
```

### 2. Install OZ dependencies

```bash
forge install OpenZeppelin/openzeppelin-contracts
```

### 3. Deploy contracts

```bash
export PRIVATE_KEY=0x...   # your deployer key
./scripts/deploy.sh local
```

Copy the logged addresses into `frontend/.env` (see `frontend/.env.example` for variable names).

### 4. Run frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Testing

```bash
forge test -vv
```

---

## Initia-native features used

| Feature | Where |
|---|---|
| InterwovenKit session keys | `frontend/src/main.tsx` — `InterwovenKitProvider` |
| Interwoven Bridge | `contracts/BridgeAdapter.sol` + `contracts/LiquidityEscrow.sol` |
| `.init` usernames | `frontend/src/components/Header.tsx`, `WalletDisplay.tsx` |

---

## Contracts

| Contract | Description |
|---|---|
| `PoolRegistry.sol` | Registry — rollups call `register_pool()` to list liquidity |
| `Router.sol` | Main swap entry — `quote()` + `swap()` |
| `FeeDistributor.sol` | Tracks per-rollup fee earnings, `claim()` to withdraw |
| `AMM.sol` | x*y=k AMM with ERC20 LP tokens |
| `BridgeAdapter.sol` | IBC/OPinit bridge wrapper for cross-rollup swaps |
| `LiquidityEscrow.sol` | Atomic escrow for in-flight bridge transfers |

---

## Revenue model

| Recipient | Rate | On $1,000 swap |
|---|---|---|
| Pool's rollup owner | 0.20% (20 bps) | $2.00 |
| AppSwap protocol | 0.05% (5 bps) | $0.50 |
| **Total** | **0.25%** | **$2.50** |
