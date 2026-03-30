import { useState, useEffect } from 'react'
import { createPublicClient, http, formatUnits } from 'viem'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { RPC_URL, TOKENS, ERC20_ABI } from '../constants'
import { TokenIcon } from './TokenIcon'

const client = createPublicClient({ transport: http(RPC_URL) })

const BYBIT_SYMBOL: Record<string, string> = {
  INIT: 'INITUSDT', WBTC: 'BTCUSDT', BTC: 'BTCUSDT',
  ETH: 'ETHUSDT', TIA: 'TIAUSDT', milkTIA: 'TIAUSDT',
  ATOM: 'ATOMUSDT', stATOM: 'ATOMUSDT', INJ: 'INJUSDT',
  OSMO: 'OSMOUSDT', SEI: 'SEIUSDT', BNB: 'BNBUSDT', SOL: 'SOLUSDT',
}

function useLivePrices() {
  const [prices, setPrices] = useState<Record<string, number>>({ USDC: 1, USDT: 1 })
  useEffect(() => {
    const symbols = [...new Set(Object.values(BYBIT_SYMBOL))]
    async function fetch_() {
      const updated: Record<string, number> = { USDC: 1, USDT: 1 }
      await Promise.all(symbols.map(async sym => {
        try {
          const res  = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${sym}`)
          const json = await res.json()
          const p    = parseFloat(json?.result?.list?.[0]?.lastPrice ?? '0')
          if (p > 0) updated[sym] = p
        } catch {}
      }))
      const mapped: Record<string, number> = { USDC: 1, USDT: 1 }
      for (const [tok, sym] of Object.entries(BYBIT_SYMBOL)) {
        if (updated[sym]) mapped[tok] = updated[sym]
      }
      setPrices(mapped)
    }
    fetch_()
    const t = setInterval(fetch_, 30_000)
    return () => clearInterval(t)
  }, [])
  return prices
}

interface TokenBalance {
  token: typeof TOKENS[number]
  raw:     bigint
  formatted: string
}

export function Portfolio() {
  const { hexAddress, address } = useInterwovenKit()
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [loading,  setLoading]  = useState(false)
  const [refresh,  setRefresh]  = useState(0)
  const livePrices = useLivePrices()

  useEffect(() => {
    if (!hexAddress) return
    let cancelled = false
    setLoading(true)

    Promise.all(
      TOKENS.map(async token => {
        try {
          const raw = await client.readContract({
            address: token.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [hexAddress as `0x${string}`],
          }) as bigint
          const formatted = formatUnits(raw, token.decimals)
          return { token, raw, formatted }
        } catch {
          return { token, raw: 0n, formatted: '0' }
        }
      })
    ).then(results => {
      if (!cancelled) setBalances(results)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [hexAddress, refresh])

  if (!address) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
          <p className="text-sm font-medium text-gray-400">Connect wallet to view portfolio</p>
      </div>
    )
  }

  const totalUsd = balances.reduce((s, b) => {
    const price = livePrices[b.token.symbol] ?? 0
    return s + parseFloat(b.formatted) * price
  }, 0)

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-gray-800">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-gray-600">Portfolio Value</p>
          <p className="text-2xl font-semibold text-white mt-0.5">
            {loading
              ? <span className="text-gray-600 animate-pulse">—</span>
              : `$${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            }
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefresh(r => r + 1)}
          className="text-gray-600 hover:text-gray-400 transition-colors p-1.5 rounded-lg hover:bg-gray-800"
          title="Refresh"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Allocation bar */}
      {totalUsd > 0 && (
        <div className="px-4 py-2 flex gap-0.5 overflow-hidden">
          {balances.map(b => {
            const usd = parseFloat(b.formatted) * (livePrices[b.token.symbol] ?? 0)
            if (usd <= 0) return null
            return (
              <div
                key={b.token.address}
                className={`h-1.5 rounded-full ${b.token.color} transition-all duration-500`}
                style={{ width: `${(usd / totalUsd) * 100}%` }}
                title={`${b.token.symbol}: ${((usd / totalUsd) * 100).toFixed(1)}%`}
              />
            )
          })}
        </div>
      )}

      {/* Token rows */}
      <div className="divide-y divide-gray-800/60">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-gray-800" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-16 bg-gray-800 rounded" />
                <div className="h-2.5 w-24 bg-gray-800 rounded" />
              </div>
              <div className="space-y-1.5 text-right">
                <div className="h-3 w-20 bg-gray-800 rounded ml-auto" />
                <div className="h-2.5 w-12 bg-gray-800 rounded ml-auto" />
              </div>
            </div>
          ))
        ) : (
          balances.map(b => {
            const price = livePrices[b.token.symbol] ?? 0
            const usd   = parseFloat(b.formatted) * price
            return (
            <div key={b.token.address} className="px-4 py-3 flex items-center gap-3">
              <TokenIcon token={b.token} size="lg" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-100">{b.token.symbol}</p>
                <p className="text-xs text-gray-600">{b.token.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-200">
                  {parseFloat(b.formatted) > 0
                    ? parseFloat(b.formatted).toLocaleString('en-US', { maximumFractionDigits: 4 })
                    : '0'}
                </p>
                <p className="text-xs text-gray-600">
                  {usd > 0
                    ? `$${usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
                    : '—'
                  }
                </p>
              </div>
              {totalUsd > 0 && usd > 0 && (
                <div className="text-right w-12">
                  <p className="text-[11px] text-gray-600">
                    {((usd / totalUsd) * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>
            )
          })
        )}
      </div>
    </div>
  )
}
