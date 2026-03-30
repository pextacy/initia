// ============================================================
// AppSwap contract addresses — set via .env after deployment
// ============================================================
export const CONTRACTS = {
  ROUTER:          import.meta.env.VITE_ROUTER_ADDRESS          ?? '0x0000000000000000000000000000000000000000',
  POOL_REGISTRY:   import.meta.env.VITE_POOL_REGISTRY_ADDRESS   ?? '0x0000000000000000000000000000000000000000',
  FEE_DISTRIBUTOR: import.meta.env.VITE_FEE_DISTRIBUTOR_ADDRESS ?? '0x0000000000000000000000000000000000000000',
} as const

// ============================================================
// Chain configuration
// ============================================================
export const CHAIN_ID        = import.meta.env.VITE_CHAIN_ID        ?? 'appswap-1'
export const CHAIN_NAME      = import.meta.env.VITE_CHAIN_NAME      ?? 'AppSwap'
export const RPC_URL         = import.meta.env.VITE_RPC_URL         ?? 'http://127.0.0.1:8545'
export const COSMOS_RPC_URL  = import.meta.env.VITE_COSMOS_RPC_URL  ?? 'http://127.0.0.1:26657'
export const COSMOS_REST_URL = import.meta.env.VITE_COSMOS_REST_URL ?? 'http://127.0.0.1:1317'

// ============================================================
// Token list — addresses set via .env after deployment
// Tokens with unset addresses are excluded from the selector.
// ============================================================
export interface Token {
  address: string
  symbol:  string
  name:    string
  decimals: number
  color:   string   // Tailwind bg-* class for the token icon
  logoUrl?: string
}

// Every token bridged into the Initia / appswap-1 ecosystem.
// Address for each is set via a VITE_TOKEN_*_ADDRESS env var after deployment.
// Tokens whose env var is not set are silently excluded from the UI.
export const TOKENS: Token[] = ([
  // ── Initia native ──────────────────────────────────────────────────────────
  {
    address: import.meta.env.VITE_TOKEN_INIT_ADDRESS as string,
    symbol: 'INIT', name: 'Initia', decimals: 18, color: 'bg-brand-600',
    logoUrl: 'https://raw.githubusercontent.com/initia-labs/initia-registry/main/images/INIT.png',
  },
  // ── Stablecoins ────────────────────────────────────────────────────────────
  {
    address: import.meta.env.VITE_TOKEN_USDC_ADDRESS as string,
    symbol: 'USDC', name: 'USD Coin', decimals: 6, color: 'bg-blue-500',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
  },
  {
    address: import.meta.env.VITE_TOKEN_USDT_ADDRESS as string,
    symbol: 'USDT', name: 'Tether USD', decimals: 6, color: 'bg-green-600',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
  },
  // ── Wrapped major assets ───────────────────────────────────────────────────
  {
    address: import.meta.env.VITE_TOKEN_WBTC_ADDRESS as string,
    symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8, color: 'bg-orange-500',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/logo.png',
  },
  {
    address: import.meta.env.VITE_TOKEN_ETH_ADDRESS as string,
    symbol: 'ETH', name: 'Wrapped Ether', decimals: 18, color: 'bg-indigo-500',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  },
  // ── IBC-bridged Cosmos ecosystem tokens ───────────────────────────────────
  {
    address: import.meta.env.VITE_TOKEN_TIA_ADDRESS as string,
    symbol: 'TIA', name: 'Celestia', decimals: 6, color: 'bg-purple-500',
    logoUrl: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/celestia/images/tia.png',
  },
  {
    address: import.meta.env.VITE_TOKEN_ATOM_ADDRESS as string,
    symbol: 'ATOM', name: 'Cosmos Hub', decimals: 6, color: 'bg-sky-500',
    logoUrl: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.png',
  },
  {
    address: import.meta.env.VITE_TOKEN_INJ_ADDRESS as string,
    symbol: 'INJ', name: 'Injective', decimals: 18, color: 'bg-blue-600',
    logoUrl: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/injective/images/inj.png',
  },
  {
    address: import.meta.env.VITE_TOKEN_OSMO_ADDRESS as string,
    symbol: 'OSMO', name: 'Osmosis', decimals: 6, color: 'bg-pink-500',
    logoUrl: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.png',
  },
  {
    address: import.meta.env.VITE_TOKEN_SEI_ADDRESS as string,
    symbol: 'SEI', name: 'Sei Network', decimals: 6, color: 'bg-red-500',
    logoUrl: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/sei/images/sei.png',
  },
  // ── Liquid staking tokens (IBC via Milkyway / Stride) ─────────────────────
  {
    address: import.meta.env.VITE_TOKEN_MILKTIA_ADDRESS as string,
    symbol: 'milkTIA', name: 'Milkyway Staked TIA', decimals: 6, color: 'bg-violet-500',
    logoUrl: 'https://raw.githubusercontent.com/initia-labs/initia-registry/main/images/milkTIA.png',
  },
  {
    address: import.meta.env.VITE_TOKEN_STATOM_ADDRESS as string,
    symbol: 'stATOM', name: 'Stride Staked ATOM', decimals: 6, color: 'bg-cyan-600',
    logoUrl: 'https://raw.githubusercontent.com/cosmos/chain-registry/master/stride/images/statom.png',
  },
  // ── Cross-chain wrapped assets ─────────────────────────────────────────────
  {
    address: import.meta.env.VITE_TOKEN_BNB_ADDRESS as string,
    symbol: 'BNB', name: 'BNB', decimals: 18, color: 'bg-yellow-500',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
  },
  {
    address: import.meta.env.VITE_TOKEN_SOL_ADDRESS as string,
    symbol: 'SOL', name: 'Solana', decimals: 9, color: 'bg-green-400',
    logoUrl: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png',
  },
] as Token[]).filter(t => !!t.address)

// ============================================================
// Router ABI (minimal — only what the frontend needs)
// ============================================================
export const ROUTER_ABI = [
  {
    name: 'quote',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenIn',  type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
    ],
    outputs: [
      { name: 'bestAmountOut', type: 'uint256' },
      { name: 'bestPoolId',    type: 'bytes32' },
    ],
  },
  {
    name: 'swap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenIn',      type: 'address' },
      { name: 'tokenOut',     type: 'address' },
      { name: 'amountIn',     type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'deadline',     type: 'uint256' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  {
    name: 'TOTAL_FEE_BPS',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint64' }],
  },
  {
    name: 'addLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenA',         type: 'address' },
      { name: 'tokenB',         type: 'address' },
      { name: 'amountADesired', type: 'uint256' },
      { name: 'amountBDesired', type: 'uint256' },
      { name: 'amountAMin',     type: 'uint256' },
      { name: 'amountBMin',     type: 'uint256' },
      { name: 'to',             type: 'address' },
      { name: 'deadline',       type: 'uint256' },
    ],
    outputs: [
      { name: 'amountA',   type: 'uint256' },
      { name: 'amountB',   type: 'uint256' },
      { name: 'liquidity', type: 'uint256' },
    ],
  },
  {
    name: 'removeLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'poolAddress', type: 'address' },
      { name: 'liquidity',   type: 'uint256' },
      { name: 'amountAMin',  type: 'uint256' },
      { name: 'amountBMin',  type: 'uint256' },
      { name: 'to',          type: 'address' },
      { name: 'deadline',    type: 'uint256' },
    ],
    outputs: [
      { name: 'amountA', type: 'uint256' },
      { name: 'amountB', type: 'uint256' },
    ],
  },
] as const

export const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner',   type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

// Used by useQuote to fetch reserves for real price-impact calculation
export const AMM_ABI = [
  {
    name: 'getReserves',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: '_reserveA', type: 'uint256' },
      { name: '_reserveB', type: 'uint256' },
    ],
  },
  {
    name: 'tokenA',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'removeLiquidity',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'liquidity',  type: 'uint256' },
      { name: 'amountAMin', type: 'uint256' },
      { name: 'amountBMin', type: 'uint256' },
      { name: 'to',         type: 'address' },
    ],
    outputs: [
      { name: 'amountA', type: 'uint256' },
      { name: 'amountB', type: 'uint256' },
    ],
  },
] as const

export const POOL_REGISTRY_ABI = [
  {
    name: 'getAllPoolIds',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32[]' }],
  },
  {
    name: 'get_pool',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{
      name: '',
      type: 'tuple',
      components: [
        { name: 'tokenA',        type: 'address' },
        { name: 'tokenB',        type: 'address' },
        { name: 'poolAddress',   type: 'address' },
        { name: 'rollupChainId', type: 'string'  },
        { name: 'feeRecipient',  type: 'address' },
        { name: 'feeBps',        type: 'uint64'  },
        { name: 'active',        type: 'bool'    },
      ],
    }],
  },
  {
    name: 'register_pool',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenA',        type: 'address' },
      { name: 'tokenB',        type: 'address' },
      { name: 'poolAddress',   type: 'address' },
      { name: 'rollupChainId', type: 'string'  },
      { name: 'feeBps',        type: 'uint64'  },
    ],
    outputs: [{ name: 'poolId', type: 'bytes32' }],
  },
  {
    name: 'PoolRegistered',
    type: 'event',
    inputs: [
      { name: 'poolId',        type: 'bytes32', indexed: true  },
      { name: 'rollupChainId', type: 'string',  indexed: false },
      { name: 'feeRecipient',  type: 'address', indexed: false },
    ],
  },
] as const

export const ROUTER_EVENTS_ABI = [
  {
    name: 'SwapExecuted',
    type: 'event',
    inputs: [
      { name: 'user',      type: 'address', indexed: true  },
      { name: 'tokenIn',   type: 'address', indexed: false },
      { name: 'tokenOut',  type: 'address', indexed: false },
      { name: 'amountIn',  type: 'uint256', indexed: false },
      { name: 'amountOut', type: 'uint256', indexed: false },
      { name: 'poolId',    type: 'bytes32', indexed: false },
    ],
  },
] as const

export const FEE_DISTRIBUTOR_EVENTS_ABI = [
  {
    name: 'FeeDistributed',
    type: 'event',
    inputs: [
      { name: 'poolId',         type: 'bytes32', indexed: true  },
      { name: 'recipient',      type: 'address', indexed: false },
      { name: 'rollupAmount',   type: 'uint256', indexed: false },
      { name: 'protocolAmount', type: 'uint256', indexed: false },
    ],
  },
] as const

export const AMM_EVENTS_ABI = [
  {
    name: 'Mint',
    type: 'event',
    inputs: [
      { name: 'sender',    type: 'address', indexed: true  },
      { name: 'amountA',   type: 'uint256', indexed: false },
      { name: 'amountB',   type: 'uint256', indexed: false },
      { name: 'liquidity', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Burn',
    type: 'event',
    inputs: [
      { name: 'sender',    type: 'address', indexed: true  },
      { name: 'amountA',   type: 'uint256', indexed: false },
      { name: 'amountB',   type: 'uint256', indexed: false },
      { name: 'liquidity', type: 'uint256', indexed: false },
    ],
  },
] as const

export const FEE_DISTRIBUTOR_ABI = [
  {
    name: 'pendingFees',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token',     type: 'address' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'claim',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [],
  },
] as const
