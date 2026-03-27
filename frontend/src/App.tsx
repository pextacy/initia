import { useState } from 'react'
import Header from './components/Header'
import { SwapUI }    from './components/SwapUI'
import { PoolTable } from './components/PoolTable'
import { FeeEarnings } from './components/FeeEarnings'
import { PriceChart }  from './components/PriceChart'
import { DepthBook }   from './components/DepthBook'
import { Analytics }   from './components/Analytics'
import { Bridge }              from './components/Bridge'
import { Leaderboard }         from './components/Leaderboard'
import { Portfolio }           from './components/Portfolio'
import { TxHistory }           from './components/TxHistory'
import { LiquidityPositions }  from './components/LiquidityPositions'
import { MarketBar }           from './components/MarketBar'
import { TradePanel }          from './components/TradePanel'
import { TOKENS, type Token }  from './constants'

type Tab = 'swap' | 'pools' | 'earn' | 'bridge' | 'stats' | 'leaderboard'

// ── Trading terminal (Swap tab) ───────────────────────────────────────────────
function TradingTerminal() {
  const [tokenIn,  setTokenIn]  = useState<Token | undefined>(TOKENS[0])
  const [tokenOut, setTokenOut] = useState<Token | undefined>(TOKENS[1])

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Market stats bar */}
      <MarketBar tokenIn={tokenIn} tokenOut={tokenOut} />

      {/* Main area: [chart+depth+panel] | [swap] */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* Left column: chart → depth, then trade panel below */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* Chart row */}
          <div className="flex min-h-0" style={{ flex: '1 1 0' }}>
            {/* Price chart — fills remaining width */}
            <div className="flex-1 min-w-0 border-r border-gray-800">
              <PriceChart tokenIn={tokenIn} tokenOut={tokenOut} />
            </div>

            {/* Depth book */}
            <div className="w-[200px] shrink-0 border-r border-gray-800 overflow-hidden">
              <div className="px-3 pt-2.5 pb-1.5 border-b border-gray-800">
                <span className="text-xs font-medium text-gray-400">Order Book</span>
              </div>
              <div className="h-[calc(100%-33px)]">
                <DepthBook tokenIn={tokenIn} tokenOut={tokenOut} />
              </div>
            </div>
          </div>

          {/* Trade panel — fixed height at the bottom of left column */}
          <div className="h-[220px] shrink-0 border-r border-gray-800">
            <TradePanel />
          </div>
        </div>

        {/* Right column: swap panel */}
        <div className="w-[300px] shrink-0 border-l border-gray-800 overflow-hidden">
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
          <div className="max-w-xl mx-auto px-4 pt-8 pb-20 space-y-5">
            <Portfolio />
            <LiquidityPositions />
            <FeeEarnings />
            <TxHistory />
          </div>
        </main>
      )}

      {tab === 'bridge' && (
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto px-4 pt-8 pb-20">
            <Bridge />
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

      {tab === 'leaderboard' && (
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 pt-8 pb-20">
            <Leaderboard />
          </div>
        </main>
      )}
    </div>
  )
}
