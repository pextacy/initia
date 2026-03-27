import { useState } from 'react'
import Header from './components/Header'
import { SwapUI }    from './components/SwapUI'
import { PoolTable } from './components/PoolTable'
import { FeeEarnings } from './components/FeeEarnings'
import { PriceChart }  from './components/PriceChart'
import { DepthBook }   from './components/DepthBook'
import { Analytics }   from './components/Analytics'
import { TOKENS, type Token } from './constants'

type Tab = 'swap' | 'pools' | 'earn' | 'stats'

// ── Trading terminal (Swap tab) ───────────────────────────────────────────────
function TradingTerminal() {
  const [tokenIn,  setTokenIn]  = useState<Token | undefined>(TOKENS[0])
  const [tokenOut, setTokenOut] = useState<Token | undefined>(TOKENS[1])

  const pair = tokenIn && tokenOut ? `${tokenIn.symbol} / ${tokenOut.symbol}` : 'Select pair'

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Market bar */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          {tokenIn && (
            <span className={`w-5 h-5 rounded-full ${tokenIn.color} flex items-center justify-center text-[10px] font-bold text-white`}>
              {tokenIn.symbol[0]}
            </span>
          )}
          {tokenOut && (
            <span className={`w-5 h-5 rounded-full ${tokenOut.color} flex items-center justify-center text-[10px] font-bold text-white -ml-1.5 ring-1 ring-gray-950`}>
              {tokenOut.symbol[0]}
            </span>
          )}
          <span className="text-sm font-semibold text-gray-100">{pair}</span>
        </div>
        <span className="text-gray-700 text-sm">|</span>
        <span className="text-xs text-gray-500">Spot</span>
        <span className="text-xs text-gray-600">AMM · 0.25% fee</span>
      </div>

      {/* Main split: chart | depth book | swap panel */}
      <div className="flex-1 flex min-h-0">
        {/* Chart — fills remaining width */}
        <div className="flex-1 min-w-0 border-r border-gray-800">
          <PriceChart
            tokenIn={tokenIn}
            tokenOut={tokenOut}
          />
        </div>

        {/* Depth book */}
        <div className="w-[220px] shrink-0 border-r border-gray-800 overflow-hidden">
          <div className="px-3 pt-2.5 pb-1.5 border-b border-gray-800">
            <span className="text-xs font-medium text-gray-400">Order Book</span>
          </div>
          <div className="h-[calc(100%-33px)]">
            <DepthBook tokenIn={tokenIn} tokenOut={tokenOut} />
          </div>
        </div>

        {/* Swap panel */}
        <div className="w-[360px] shrink-0 overflow-y-auto p-4">
          <SwapUI
            tokenIn={tokenIn}
            tokenOut={tokenOut}
            onTokenInChange={setTokenIn}
            onTokenOutChange={setTokenOut}
          />
        </div>
      </div>
    </div>
  )
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<Tab>('swap')

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      <Header tab={tab} onTabChange={setTab} />

      {tab === 'swap' && <TradingTerminal />}

      {tab === 'pools' && (
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 pt-8 pb-20">
            <PoolTable />
          </div>
        </main>
      )}

      {tab === 'earn' && (
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 pt-8 pb-20">
            <FeeEarnings />
          </div>
        </main>
      )}

      {tab === 'stats' && (
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 pt-8 pb-20">
            <Analytics />
          </div>
        </main>
      )}
    </div>
  )
}
