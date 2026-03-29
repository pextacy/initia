import { useState, useEffect, useMemo } from 'react'
import { createPublicClient, http } from 'viem'
import { CONTRACTS, ROUTER_EVENTS_ABI, RPC_URL, TOKENS } from '../constants'

const client = createPublicClient({ transport: http(RPC_URL) })
const ZERO   = '0x0000000000000000000000000000000000000000'

const APPROX_USD: Record<string, number> = {
  USDC: 1, USDT: 1, INIT: 1.24, WBTC: 65000, ETH: 3400,
}
function tokenSym(addr: string) {
  return TOKENS.find(t => t.address.toLowerCase() === addr.toLowerCase())?.symbol ?? addr.slice(0, 6) + '…'
}
function tokenDec(addr: string) {
  return TOKENS.find(t => t.address.toLowerCase() === addr.toLowerCase())?.decimals ?? 18
}
function roughUSD(sym: string, n: number) {
  return (APPROX_USD[sym] ?? 1) * n
}

interface Trader {
  rank:    number
  address: string
  volume:  number   // USD
  swaps:   number
}

function fmtVolume(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

const MEDALS = ['1ST', '2ND', '3RD']
const TOP_BG  = [
  'from-yellow-950/60 to-gray-900 border-yellow-800/40',
  'from-gray-800/60   to-gray-900 border-gray-700/40',
  'from-orange-950/50 to-gray-900 border-orange-900/40',
]
const TOP_RANK_COLOR = ['text-yellow-400', 'text-gray-300', 'text-orange-400']

export function Leaderboard() {
  const [traders, setTraders] = useState<Trader[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [sortBy,  setSortBy]  = useState<'volume' | 'swaps'>('volume')

  useEffect(() => {
    async function load() {
      if (!CONTRACTS.ROUTER || CONTRACTS.ROUTER === ZERO) {
        setLoading(false)
        return
      }
      try {
        const latest = await client.getBlockNumber()
        const from   = latest > 50000n ? latest - 50000n : 0n
        const logs   = await client.getContractEvents({
          address:   CONTRACTS.ROUTER as `0x${string}`,
          abi:       ROUTER_EVENTS_ABI,
          eventName: 'SwapExecuted',
          fromBlock: from,
          toBlock:   latest,
        })

        const map = new Map<string, { volume: number; swaps: number }>()
        for (const log of logs) {
          const { user, tokenIn, amountIn } = log.args as {
            user: string; tokenIn: string; amountIn: bigint
          }
          const sym = tokenSym(tokenIn)
          const usd = roughUSD(sym, Number(amountIn) / 10 ** tokenDec(tokenIn))
          const key = user.toLowerCase()
          const ex  = map.get(key)
          if (ex) { ex.volume += usd; ex.swaps++ }
          else map.set(key, { volume: usd, swaps: 1 })
        }

        const result: Trader[] = [...map.entries()]
          .map(([address, { volume, swaps }]) => ({
            rank: 0,
            address: `${address.slice(0, 6)}…${address.slice(-4)}`,
            volume,
            swaps,
          }))
          .sort((a, b) => b.volume - a.volume)
          .map((t, i) => ({ ...t, rank: i + 1 }))

        setTraders(result)
      } catch { /* no data */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return traders
      .filter(t => !q || t.address.toLowerCase().includes(q))
      .sort((a, b) => sortBy === 'volume' ? b.volume - a.volume : b.swaps - a.swaps)
      .map((t, i) => ({ ...t, rank: i + 1 }))
  }, [traders, search, sortBy])

  const top3 = filtered.slice(0, 3)
  const rest  = filtered.slice(3)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Swap Leaderboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Top traders ranked by volume on AppSwap</p>
        </div>
        {/* Sort toggle */}
        <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-1 gap-0.5 shrink-0">
          {(['volume', 'swaps'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                sortBy === s ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {s === 'volume' ? 'Volume' : 'Swaps'}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by wallet address…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-600 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-6 px-1 py-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex-1 animate-pulse space-y-2">
              <div className="h-24 bg-gray-800 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-600">
          {search ? 'No matching addresses found' : 'No swap activity yet'}
        </div>
      ) : (
        <>
          {/* Top 3 podium */}
          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {top3.map((t, i) => (
                <div
                  key={t.address}
                  className={`relative rounded-xl border bg-gradient-to-b ${TOP_BG[i]} p-4 flex flex-col items-center gap-2`}
                >
                  {/* Rank badge */}
                  <span className={`text-xs font-black tracking-widest ${TOP_RANK_COLOR[i]}`}>
                    {MEDALS[i]}
                  </span>

                  {/* Avatar placeholder */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                    i === 0 ? 'bg-yellow-900/40 border-yellow-700/50 text-yellow-400'
                    : i === 1 ? 'bg-gray-800 border-gray-600 text-gray-300'
                    : 'bg-orange-900/30 border-orange-800/50 text-orange-400'
                  }`}>
                    {t.address.slice(2, 4).toUpperCase()}
                  </div>

                  <span className="font-mono text-xs text-gray-300">{t.address}</span>

                  {/* Swaps */}
                  <div className="text-sm font-semibold tabular-nums text-brand-400">
                    {t.swaps} swap{t.swaps !== 1 ? 's' : ''}
                  </div>

                  {/* Volume */}
                  <div className="text-center">
                    <div className="text-xs font-medium text-gray-200 tabular-nums">{fmtVolume(t.volume)}</div>
                    <div className="text-[10px] text-gray-600">Volume</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ranks 4+ table */}
          {rest.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[3rem_1fr_1fr_1fr] items-center px-4 py-2.5 border-b border-gray-800 text-[10px] uppercase tracking-wider text-gray-600">
                <span>#</span>
                <span>Address</span>
                <span className="text-right">Swaps</span>
                <span className="text-right">Volume</span>
              </div>

              <div className="divide-y divide-gray-800/60">
                {rest.map(t => (
                  <div
                    key={t.address}
                    className="grid grid-cols-[3rem_1fr_1fr_1fr] items-center px-4 py-3 hover:bg-gray-800/40 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-500 tabular-nums">{t.rank}</span>

                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-400 shrink-0">
                        {t.address.slice(2, 4).toUpperCase()}
                      </div>
                      <span className="font-mono text-xs text-gray-300">{t.address}</span>
                    </div>

                    <div className="text-right text-sm font-medium tabular-nums text-gray-400">
                      {t.swaps}
                    </div>

                    <div className="text-right text-sm text-gray-300 tabular-nums">
                      {fmtVolume(t.volume)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <p className="text-[10px] text-gray-700 text-center pb-2">
        Live data from on-chain SwapExecuted events
        {' '}•{' '}
        Last {loading ? '…' : filtered.length} trader{filtered.length !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
