import React from 'react'
import ReactDOM from 'react-dom/client'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { defineChain } from 'viem'
import { InterwovenKitProvider } from '@initia/interwovenkit-react'
import '@initia/interwovenkit-react/styles.css'
import App from './App'
import './index.css'
import { CHAIN_ID, RPC_URL, COSMOS_RPC_URL, COSMOS_REST_URL } from './constants'

// ── Wagmi (EVM wallet) ───────────────────────────────────────────────────────
const evmChainId = Number(import.meta.env.VITE_EVM_CHAIN_ID ?? 12345)

const appSwapChain = defineChain({
  id: evmChainId,
  name: 'AppSwap',
  nativeCurrency: { name: 'Initia', symbol: 'INIT', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
})

const wagmiConfig = createConfig({
  chains: [appSwapChain],
  connectors: [injected()],
  transports: { [evmChainId]: http(RPC_URL) },
})

const queryClient = new QueryClient()

// ── InterwovenKit custom chain ───────────────────────────────────────────────
// appswap-1 is a custom rollup not in the Initia public registry.
// Fl() inside the kit requires: chain_id, chain_name, pretty_name,
// logo_URIs, apis (rpc/rest/json-rpc/indexer), and metadata.
// Update VITE_COSMOS_RPC_URL / VITE_COSMOS_REST_URL after `weave init`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const appSwapCosmosChain: any = {
  chain_id:    CHAIN_ID,
  chain_name:  CHAIN_ID,
  pretty_name: 'AppSwap',
  logo_URIs:   {},
  network_type: 'testnet',
  bech32_prefix: 'init',
  fees: { fee_tokens: [{ denom: 'uinit', fixed_min_gas_price: 0.015 }] },
  staking: { staking_tokens: [] },
  apis: {
    rpc:         [{ address: COSMOS_RPC_URL }],
    rest:        [{ address: COSMOS_REST_URL }],
    'json-rpc':  [{ address: RPC_URL }],
    indexer:     [{ address: COSMOS_REST_URL }],  // fallback — no indexer in local dev
  },
  metadata: {
    minitia: { type: 'minievm' },
  },
}

// ── Error boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { label: string; children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { label: string; children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#0a0a0a', color: '#f87171', padding: '2rem', fontFamily: 'monospace', minHeight: '100vh' }}>
          <p style={{ marginBottom: '0.5rem' }}>Error in {this.props.label}:</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem' }}>
            {this.state.error.message}{'\n\n'}{this.state.error.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Root ─────────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary label="root">
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <InterwovenKitProvider
            defaultChainId={CHAIN_ID}
            customChain={appSwapCosmosChain}
            theme="dark"
            container={document.getElementById('interwovenkit') as HTMLElement}
          >
          <ErrorBoundary label="App">
            <App />
          </ErrorBoundary>
        </InterwovenKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </ErrorBoundary>,
)
