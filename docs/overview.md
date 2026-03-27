# AppSwap — Full Project Guide
### Initia Hackathon (Season 1) · DeFi Track

---

## Table of Contents

1. [What We Are Building](#1-what-we-are-building)
2. [What We Are Using (Free Tools Only)](#2-what-we-are-using-free-tools-only)
3. [How the Initia Stack Works (from the docs)](#3-how-the-initia-stack-works-from-the-docs)
4. [System Architecture](#4-system-architecture)
5. [Smart Contract Design](#5-smart-contract-design)
6. [The Swap Lifecycle (Step by Step)](#6-the-swap-lifecycle-step-by-step)
7. [Frontend](#7-frontend)
8. [Submission Requirements Checklist](#8-submission-requirements-checklist)
9. [Go-to-Market Plan](#9-go-to-market-plan)
10. [Revenue Model](#10-revenue-model)

---

## 1. What We Are Building

**AppSwap** is a permissionless DEX (decentralized exchange) that runs on its own Initia appchain. The core mechanic is simple: any other Initia rollup can register a liquidity pool with AppSwap. When users swap tokens through those pools, the rollup that owns the pool automatically earns a share of the swap fee — on-chain, in real time, with no middleman.

The chain itself becomes the fee model. There is no gas tax paid to someone else, no sequencer cut, no value leak. Revenue stays with builders.

### Why this wins the hackathon

The hackathon judges weight **Technical Execution & Initia Integration** at 30% — the single highest criterion. AppSwap uses every major Initia-native feature in a way that is load-bearing, not cosmetic:

- **Interwoven Bridge** — without it, cross-rollup routing is impossible
- **InterwovenKit** — the entire user session is handled with session keys (no per-tx popups)
- **Initia Usernames (.init)** — wallet identity across the whole UI

---

## 2. What We Are Using (Free Tools Only)

Everything below is free and open source. No paid services required.

### Chain & Infrastructure (all free)

| Tool | What it does | Cost |
|---|---|---|
| **Weave CLI** | Bootstraps and manages your Initia appchain with one command | Free |
| **initiad** | Initia L1 node binary | Free |
| **minitiad** | Your rollup (L2) node binary | Free |
| **OPinit Executor** | Handles rollup data submission and bridge ops | Free |
| **IBC Relayer** (via Weave) | Runs inside Docker, enables cross-chain asset transfers | Free |
| **Initia Testnet** | Full testnet environment (initiation-2) | Free |
| **Initia Testnet Faucet** | Get free testnet INIT tokens at app.testnet.initia.xyz/faucet | Free |

### Smart Contract Development

| Tool | What it does | Cost |
|---|---|---|
| **Move VM** | The recommended VM for DeFi/complex onchain logic on Initia | Free |
| **Foundry (Forge)** | If going EVM/Solidity route instead of Move | Free |
| **Rust + Cargo** | If going Wasm route | Free |

We are going with **EVM (Solidity)** for AppSwap because:
- Existing Uniswap V2 AMM math (x·y=k) is battle-tested and we can adapt it
- Foundry gives us fast local testing
- The DeFi track recommends EVM specifically for leveraging Ethereum tooling

### Frontend

| Tool | What it does | Cost |
|---|---|---|
| **@initia/interwovenkit-react** | Official Initia wallet kit — mandatory for submission | Free |
| **React + Vite** | Frontend framework | Free |
| **Tailwind CSS** | Styling | Free |
| **ethers.js / viem** | EVM contract interaction | Free |

### AI-Assisted Development (optional but recommended by Initia docs)

| Tool | What it does | Cost |
|---|---|---|
| **Claude Code** | Terminal AI agent for contract generation and debugging | Free tier available |
| **Cursor** | AI-powered IDE | Free tier available |
| **VS Code** | Standard editor | Free |
| **Initia Agent Skill** | `npx skills add initia-labs/agent-skills` — gives your AI agent Initia-specific knowledge | Free |

### System Prerequisites

| Tool | Version Required | Cost |
|---|---|---|
| **Docker Desktop** | Any recent version (must be running for IBC relayer) | Free |
| **Go** | 1.22+ | Free |
| **Node.js** | 18+ | Free |
| **Git** | Any | Free |

---

## 3. How the Initia Stack Works (from the docs)

This section breaks down exactly what `https://docs.initia.xyz/hackathon/get-started` tells you to do, in plain English.

### The big picture

When you build on Initia, you are not just deploying a smart contract — you are launching your own blockchain (called a **rollup** or **appchain**) that settles on the Initia L1. Your chain has:

- Its own block production
- Its own gas token
- Its own chain ID
- A bridge back to L1 via the Interwoven Bridge (OPinit + IBC)

This is what makes AppSwap powerful — we are not a contract on someone else's chain. We own our chain, and therefore we own our fee economics.

### Step-by-step setup from the docs

#### Step 1 — Create your project directory

```bash
mkdir appswap
cd appswap
```

#### Step 2 — Install the Initia AI skill (optional but helpful)

This gives any AI agent (Claude Code, Cursor, etc.) full knowledge of Initia tooling:

```bash
npx skills add initia-labs/agent-skills
```

#### Step 3 — Choose your VM

For AppSwap (DeFi track) → **EVM (Solidity)**. This is what the official docs recommend for DeFi.

#### Step 4 — Install prerequisites

- Docker Desktop — must be **running** at all times for the IBC relayer
- Go 1.22+
- Foundry (for EVM track): `curl -L https://foundry.paradigm.xyz | bash`

#### Step 5 — Set up your environment via AI agent

```
Using the `initia-appchain-dev` skill, please set up my environment for the EVM track.
```

This installs `weave`, `initiad`, `jq`, and builds the `minitiad` EVM binary for you.

#### Step 6 — Run `weave init` (interactive appchain launch)

This is the main setup wizard. Run it in a standard terminal (not inside your AI agent):

```bash
weave init
```

Walk through the prompts as follows:

1. **Gas Station Account** → Generate new account → copy the address
2. **Fund it** → go to `app.testnet.initia.xyz/faucet` → paste address → submit
3. **Action** → Launch a new rollup
4. **L1 Network** → Testnet (initiation-2)
5. **VM** → EVM
6. **Chain ID** → `appswap-1` (save this — needed for submission)
7. **Gas Denom** → press Tab for default (`umin`)
8. **Node Moniker** → press Tab for default
9. **Submission Interval** → Tab (default `1m`)
10. **Finalization Period** → Tab (default `168h`)
11. **Data Availability** → Initia L1
12. **Oracle Price Feed** → Enable
13. **System Keys** → Generate new system keys
14. **Funding option** → Use the default preset
15. **Fee Whitelist** → press Enter (leave empty)
16. **Add Gas Station to Genesis** → Yes
17. **Genesis Balance** → `1000000000000000000000000` (10^24 for EVM)
18. **Additional Genesis Accounts** → No
19. Type `continue` → then `y` to confirm transactions

Your appchain is now running and producing blocks.

#### Step 7 — Start the bridge bots

These two bots are what connect your appchain to L1 and enable the Interwoven Bridge:

**OPinit Executor** (handles rollup data and bridge ops):
```bash
weave opinit init executor
# Follow prompts: use detected keys, generate oracle key, prefill config
# Set listen address: localhost:3000
# Then start it:
weave opinit start executor -d
```

**IBC Relayer** (enables asset transfers — Docker must be running):
```bash
weave relayer init
# Select your local rollup (appswap-1)
# Use defaults for RPC/REST endpoints
# Select "Subscribe to only transfer and nft-transfer IBC Channels"
# Select all channels, use challenger key
weave relayer start -d
```

#### Step 8 — Import your Gas Station key

This lets you sign transactions from CLI and lets AI agents deploy contracts:

```bash
MNEMONIC=$(jq -r '.common.gas_station.mnemonic' ~/.weave/config.json)

# Import into L1
initiad keys add gas-station --recover --keyring-backend test --coin-type 60 --key-type eth_secp256k1 --source <(echo -n "$MNEMONIC")

# Import into L2
minitiad keys add gas-station --recover --keyring-backend test --coin-type 60 --key-type eth_secp256k1 --source <(echo -n "$MNEMONIC")
```

#### Step 9 — Verify everything is healthy

```
Using the `initia-appchain-dev` skill, verify my appchain, executor bot, and relayer are running and my Gas Station account has a balance.
```

If all green, you are ready to deploy contracts.

#### After a computer restart

The relayer keeps running via Docker, but you need to restart the rollup and executor:

```bash
weave rollup start -d
weave opinit start executor -d
```

---

## 4. System Architecture

AppSwap has three layers stacked on top of each other.

```
┌─────────────────────────────────────────────────────────┐
│               AppSwap appchain (Initia rollup)           │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │             Core Contracts Layer                  │   │
│  │   Router  │  PoolRegistry  │  FeeDistributor     │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Interwoven Bridge Layer                 │   │
│  │  BridgeAdapter  │  LiquidityEscrow  │  Oracle    │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │         External Rollup Integrations              │   │
│  │  DeFi rollup  │  Gaming rollup  │  Any rollup    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Layer 1 — Core contracts

- **Router.sol** — the main entry point for all swaps. Reads the registry to find the right pool, calls the bridge adapter if cross-rollup, dispatches fee distribution after completion.
- **PoolRegistry.sol** — maps every pool to its owner rollup and fee configuration. Any Initia rollup can call `register_pool()` to list a liquidity pool.
- **FeeDistributor.sol** — receives the gross fee from every swap, splits it between the rollup owner (default 20bps) and the AppSwap protocol (5bps), accrues to a claimable balance.

### Layer 2 — Interwoven Bridge layer

- **BridgeAdapter.sol** — wraps the Initia IBC/OPinit bridge calls. When a swap requires tokens to move between rollups, the adapter handles the IBC transfer and waits for the response.
- **LiquidityEscrow.sol** — holds tokens while they are in transit across the bridge. Ensures atomicity — if the bridge call fails, the tokens return to the user.
- **Price Oracle** — on-chain TWAP feed using the oracle price feed we enabled during `weave init`. Prevents sandwich attacks.

### Layer 3 — External rollup integrations

Any Initia rollup installs our SDK (a thin wrapper around our `register_pool()` call), registers their pool, and immediately starts earning swap fee revenue from every trade routed through their liquidity. No chain migration, no new infrastructure.

---

## 5. Smart Contract Design

### PoolRegistry.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PoolRegistry {

    struct PoolConfig {
        address tokenA;
        address tokenB;
        address poolAddress;    // AMM pool on the target rollup
        string  rollupChainId;  // e.g. "mygame-1"
        address feeRecipient;   // rollup owner's address
        uint64  feeBps;         // default 20 (= 0.20%)
        bool    active;
    }

    mapping(bytes32 => PoolConfig) public pools;
    mapping(address => bytes32[])  public rollupPools; // owner → pool IDs

    event PoolRegistered(bytes32 indexed poolId, string rollupChainId, address feeRecipient);
    event PoolUpdated(bytes32 indexed poolId, uint64 newFeeBps);
    event PoolDeregistered(bytes32 indexed poolId);

    uint64 public constant MAX_ROLLUP_FEE_BPS = 20; // 0.20% max for rollup share
    uint64 public constant PROTOCOL_FEE_BPS   = 5;  // 0.05% always goes to protocol

    function register_pool(
        address tokenA,
        address tokenB,
        address poolAddress,
        string  calldata rollupChainId,
        uint64  feeBps
    ) external returns (bytes32 poolId) {
        require(feeBps <= MAX_ROLLUP_FEE_BPS, "fee too high");
        poolId = keccak256(abi.encodePacked(tokenA, tokenB, rollupChainId));
        require(!pools[poolId].active, "pool already registered");

        pools[poolId] = PoolConfig({
            tokenA:        tokenA,
            tokenB:        tokenB,
            poolAddress:   poolAddress,
            rollupChainId: rollupChainId,
            feeRecipient:  msg.sender,
            feeBps:        feeBps,
            active:        true
        });

        rollupPools[msg.sender].push(poolId);
        emit PoolRegistered(poolId, rollupChainId, msg.sender);
    }

    function update_fee_bps(bytes32 poolId, uint64 newFeeBps) external {
        require(pools[poolId].feeRecipient == msg.sender, "not owner");
        require(newFeeBps <= MAX_ROLLUP_FEE_BPS, "fee too high");
        pools[poolId].feeBps = newFeeBps;
        emit PoolUpdated(poolId, newFeeBps);
    }

    function get_pool(bytes32 poolId) external view returns (PoolConfig memory) {
        require(pools[poolId].active, "pool not found");
        return pools[poolId];
    }

    function deregister_pool(bytes32 poolId) external {
        require(pools[poolId].feeRecipient == msg.sender, "not owner");
        pools[poolId].active = false;
        emit PoolDeregistered(poolId);
    }
}
```

### Router.sol (core swap logic)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPoolRegistry { /* get_pool() */ }
interface IBridgeAdapter  { /* send(chainId, token, amount, recipient) */ }
interface IFeeDistributor { /* distribute(poolId, grossFee) */ }
interface IAMM            { /* swap(tokenIn, amountIn, minOut) returns (uint256) */ }

contract Router {

    IPoolRegistry  public registry;
    IBridgeAdapter public bridge;
    IFeeDistributor public feeDistributor;
    bool public paused;
    address public owner;

    uint64 public constant TOTAL_FEE_BPS = 25; // 0.25% total swap fee

    event SwapExecuted(
        address indexed user,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        bytes32 poolId
    );

    modifier notPaused() { require(!paused, "paused"); _; }

    // --- Quote (read-only, used by frontend) ---
    function quote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut, bytes32 bestPoolId) {
        // Iterate registered pools, find best rate using x*y=k
        // Returns the pool with the highest amountOut
    }

    // --- Main swap entry point ---
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external notPaused returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "expired");

        // 1. Deduct fee upfront
        uint256 grossFee = (amountIn * TOTAL_FEE_BPS) / 10000;
        uint256 amountInNet = amountIn - grossFee;

        // 2. Find best pool
        (,bytes32 poolId) = this.quote(tokenIn, tokenOut, amountInNet);
        PoolRegistry.PoolConfig memory pool = registry.get_pool(poolId);

        // 3. If cross-rollup, route via bridge; else execute locally
        if (keccak256(bytes(pool.rollupChainId)) != keccak256(bytes(LOCAL_CHAIN_ID))) {
            amountOut = _crossRollupSwap(pool, tokenIn, tokenOut, amountInNet, minAmountOut);
        } else {
            amountOut = IAMM(pool.poolAddress).swap(tokenIn, amountInNet, minAmountOut);
        }

        require(amountOut >= minAmountOut, "slippage");

        // 4. Distribute fee
        feeDistributor.distribute(poolId, grossFee);

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, poolId);
    }

    function _crossRollupSwap(
        PoolRegistry.PoolConfig memory pool,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minOut
    ) internal returns (uint256) {
        // Lock tokens in escrow
        // Call bridge adapter with IBC message
        // Return output amount once bridge confirms
    }
}
```

### FeeDistributor.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FeeDistributor {

    address public protocolTreasury;
    mapping(address => uint256) public pendingFees; // rollup owner → accrued fees
    uint256 public totalDistributed;

    event FeeDistributed(bytes32 indexed poolId, address recipient, uint256 rollupAmount, uint256 protocolAmount);
    event FeeClaimed(address indexed recipient, uint256 amount);

    function distribute(bytes32 poolId, uint256 grossFee) external {
        PoolRegistry.PoolConfig memory pool = IPoolRegistry(registry).get_pool(poolId);

        uint256 rollupFee   = (grossFee * pool.feeBps)          / (pool.feeBps + PROTOCOL_FEE_BPS);
        uint256 protocolFee = grossFee - rollupFee;

        pendingFees[pool.feeRecipient] += rollupFee;
        pendingFees[protocolTreasury]  += protocolFee;
        totalDistributed               += grossFee;

        emit FeeDistributed(poolId, pool.feeRecipient, rollupFee, protocolFee);
    }

    function claim() external {
        uint256 amount = pendingFees[msg.sender];
        require(amount > 0, "nothing to claim");
        pendingFees[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit FeeClaimed(msg.sender, amount);
    }
}
```

---

## 6. The Swap Lifecycle (Step by Step)

Here is exactly what happens when a user initiates a swap:

```
1. User opens AppSwap frontend
   └── InterwovenKit session key is active (no per-tx popups)

2. User selects tokenIn / tokenOut / amount
   └── Frontend calls Router.quote() to get live price

3. User taps "Swap"
   └── InterwovenKit signs the transaction silently via session key

4. Router.swap() executes on AppSwap appchain
   └── Deducts 0.25% gross fee
   └── Calls PoolRegistry.get_pool() to find the best pool

5a. If same-chain pool:
    └── Calls AMM.swap() directly on the local pool
    └── Returns tokens to user instantly

5b. If cross-rollup pool:
    └── Locks tokenIn in LiquidityEscrow
    └── BridgeAdapter sends IBC message to target rollup
    └── Target rollup AMM executes the swap
    └── Output tokens sent back via bridge
    └── LiquidityEscrow releases tokens to user

6. FeeDistributor.distribute() is called
   └── 0.20% → pendingFees[rollup_owner]
   └── 0.05% → pendingFees[protocol_treasury]

7. Rollup owner calls claim() at any time to withdraw earnings
```

Total time for same-chain swap: ~100ms (Initia block time).
Total time for cross-rollup swap: ~2–5 seconds (bridge round trip).

---

## 7. Frontend

### Required: InterwovenKit integration

The hackathon **requires** use of `@initia/interwovenkit-react`. This is how we connect wallets and handle session UX.

```bash
npm install @initia/interwovenkit-react
```

```tsx
// main.tsx
import { InterwovenKitProvider } from '@initia/interwovenkit-react'

function App() {
  return (
    <InterwovenKitProvider
      chainId="appswap-1"
      nodeUrl="https://rpc.appswap.example"
    >
      <SwapUI />
    </InterwovenKitProvider>
  )
}
```

```tsx
// SwapUI.tsx — core swap component
import { useInterwovenKit } from '@initia/interwovenkit-react'

function SwapUI() {
  const { address, executeContract } = useInterwovenKit()

  async function handleSwap() {
    await executeContract({
      contractAddress: ROUTER_ADDRESS,
      msg: {
        swap: {
          token_in:       selectedTokenIn,
          token_out:      selectedTokenOut,
          amount_in:      parseUnits(amountIn, 18).toString(),
          min_amount_out: parseUnits(minOut, 18).toString(),
          deadline:       Math.floor(Date.now() / 1000) + 300,
        }
      }
    })
  }

  return (
    <div>
      {/* Token selector, amount input, swap button */}
    </div>
  )
}
```

### Required: Initia Usernames (.init)

Display `.init` usernames instead of hex addresses throughout the UI:

```tsx
import { useInitiaUsername } from '@initia/interwovenkit-react'

function WalletDisplay({ address }) {
  const { username } = useInitiaUsername(address)
  return <span>{username ?? address}</span>
  // Shows "alice.init" instead of "0xaBcD..."
}
```

### Required Initia-native features checklist

The submission requires at least one of: Auto-signing/Session UX, Interwoven Bridge, or Initia Usernames. AppSwap uses **all three**:

- Session UX → InterwovenKit handles session keys for seamless swap UX
- Interwoven Bridge → cross-rollup swaps route through it
- .init usernames → shown in the wallet connector and trading history

---

## 8. Submission Requirements Checklist

From the official submission requirements:

- [ ] Deployed as its own Initia appchain/rollup with a valid chain ID (`appswap-1`)
- [ ] Uses `@initia/interwovenkit-react` for wallet connection and/or transaction handling
- [ ] Implements at least one Initia-native feature (we use all three)
- [ ] `.initia/submission.json` file present in the repository root
- [ ] `README.md` with a human-readable project summary
- [ ] Demo video showing the working product end-to-end

### submission.json template

```json
{
  "project_name": "AppSwap",
  "track": "DeFi",
  "chain_id": "appswap-1",
  "rollup_txn_link": "https://scan.testnet.initia.xyz/initiation-2/txs/YOUR_TX_HASH",
  "interwovenkit_used": true,
  "initia_native_features": [
    "session_ux",
    "interwoven_bridge",
    "initia_usernames"
  ],
  "team": ["your-github-handle"],
  "demo_video": "https://youtube.com/YOUR_DEMO",
  "repo": "https://github.com/YOUR_HANDLE/appswap"
}
```

### Repository structure

```
appswap/
├── .initia/
│   └── submission.json       ← required
├── contracts/
│   ├── PoolRegistry.sol
│   ├── Router.sol
│   └── FeeDistributor.sol
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   └── App.tsx
│   └── package.json
├── scripts/
│   └── deploy.sh             ← deploys contracts to appchain
├── README.md                 ← required
└── foundry.toml
```

---

## 9. Go-to-Market Plan

### Phase 1 — Hackathon launch (weeks 1–4)

Goal: get 3–5 partner rollups integrated before the submission deadline. This makes the demo undeniable — a real cross-rollup swap with fee hitting a partner's wallet in real time.

Actions:
- Reach out to 5 existing Initia rollup teams on Discord before submitting. Offer them zero-effort integration and immediate fee revenue.
- Deploy on testnet, record the demo video showing a live cross-rollup swap.
- Ship a simple analytics page showing total volume and fees earned per rollup — this makes the revenue story visual for judges.
- Target: $50K in testnet liquidity, 3 partner rollups at launch.

### Phase 2 — Ecosystem flywheel (months 1–3)

Goal: more rollups → more liquidity → more swaps → more fees → more rollups.

Actions:
- Publish a one-click SDK: any Initia rollup registers a pool in under 30 minutes.
- Work with the Initia team to get AppSwap listed as a default bridge UI for the ecosystem.
- Run a liquidity mining campaign: rollups that bring >$10K liquidity earn boosted fee share for 30 days.
- Focus on gaming rollups specifically — they have token economies that desperately need in-ecosystem swaps.
- Target: 20+ rollups integrated, $500K monthly volume.

### Phase 3 — Monetisation depth (months 3–12)

Goal: expand beyond swap fees with higher-margin products.

Actions:
- Launch "AppSwap Pro" — rollups pay a monthly fee for priority routing, deeper analytics, custom fee structures.
- Add limit orders and TWAP execution — higher margin product that large DeFi users pay for.
- Explore cross-ecosystem expansion: Initia ↔ Cosmos IBC ↔ EVM chains.
- Token launch: SWAP governance token gives rollup owners voting rights on fee tiers and upgrades.
- Target: $5M+ monthly volume, $12.5K monthly protocol revenue.

---

## 10. Revenue Model

AppSwap charges a flat **0.25% swap fee** on every trade. This is split as follows:

| Recipient | Basis Points | On $1,000 swap |
|---|---|---|
| Pool's rollup owner | 20 bps (0.20%) | $2.00 |
| AppSwap protocol treasury | 5 bps (0.05%) | $0.50 |
| **Total fee** | **25 bps (0.25%)** | **$2.50** |

Rollup owners set their own fee between 0 and 20bps. The 5bps protocol cut is fixed and non-negotiable.

### Revenue projections

| Monthly Volume | Protocol Revenue (5bps) | If 20 rollups share 20bps |
|---|---|---|
| $100K | $50 | $200 total to rollups |
| $1M | $500 | $2,000 total to rollups |
| $10M | $5,000 | $20,000 total to rollups |
| $100M | $50,000 | $200,000 total to rollups |

The flywheel: as rollup owners earn more fees, they have incentive to provide more liquidity, which attracts more users, which generates more volume, which earns more fees.

---

## Quick Reference: Key Commands

```bash
# Launch appchain
weave init

# Start bridge bots
weave opinit start executor -d
weave relayer start -d

# After restart
weave rollup start -d
weave opinit start executor -d

# Check logs
weave relayer log
weave opinit log executor

# Reset everything (start fresh)
rm -rf ~/.weave ~/.initia ~/.minitia ~/.opinit
docker rm -f weave-relayer || true

# Deploy contracts (Foundry)
forge script scripts/Deploy.s.sol --rpc-url http://localhost:26657 --broadcast

# Verify keys
initiad keys list --keyring-backend test
minitiad keys list --keyring-backend test
```

---

*Built for the Initia Hackathon Season 1 · Submission deadline: 15 April 2026*