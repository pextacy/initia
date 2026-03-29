import { useState, useEffect } from 'react'
import { createPublicClient, http } from 'viem'
import { CONTRACTS, POOL_REGISTRY_ABI, AMM_ABI, RPC_URL, TOKENS } from '../constants'
import type { Token } from '../constants'
import { getBybitSymbol, APPROX_USD } from '../utils/bybit'

const client = createPublicClient({ transport: http(RPC_URL) })
const ZERO   = '0x0000000000000000000000000000000000000000'

function roughUSD(sym: string, n: number) {
  return (APPROX_USD[sym] ?? 1) * n
}

interface PairStats {
  price:     number
  change24h: number   // percent
  high24h:   number
  low24h:    number
  tvlUSD:    number
  vol24hUSD: number
}

async function fetchFromBybit(tokenIn: Token, tokenOut: Token): Promise<PairStats | null> {
  const info = getBybitSymbol(tokenIn.symbol, tokenOut.symbol)
  if (!info) return null
  try {
    const res  = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${info.symbol}`)
    if (!res.ok) return null
    const json = await res.json()
    const t    = json?.result?.list?.[0]
    if (!t) return null

    let price     = parseFloat(t.lastPrice)
    let change24h = parseFloat(t.price24hPcnt) * 100
    let high24h   = parseFloat(t.highPrice24h)
    let low24h    = parseFloat(t.lowPrice24h)
    const vol24hUSD = parseFloat(t.turnover24h)

    if (info.invert) {
      const origHigh = high24h
      price     = 1 / price
      high24h   = 1 / low24h
      low24h    = 1 / origHigh
      change24h = -change24h
    }

    return { price, change24h, high24h, low24h, vol24hUSD, tvlUSD: 0 }
  } catch { return null }
}


async function fetchPairStats(tokenIn: Token, tokenOut: Token): Promise<PairStats | null> {
  // 1. Try on-chain pool registry
  if (CONTRACTS.POOL_REGISTRY && CONTRACTS.POOL_REGISTRY !== ZERO) {
    try {
      const ids = await client.readContract({
        address: CONTRACTS.POOL_REGISTRY as `0x${string}`,
        abi: POOL_REGISTRY_ABI, functionName: 'getAllPoolIds',
      }) as `0x${string}`[]

      for (const id of ids) {
        const cfg = await client.readContract({
          address: CONTRACTS.POOL_REGISTRY as `0x${string}`,
          abi: POOL_REGISTRY_ABI, functionName: 'get_pool', args: [id],
        }) as { tokenA: string; tokenB: string; poolAddress: string; active: boolean }

        if (!cfg.active) continue
        const aIn  = tokenIn.address.toLowerCase()
        const aOut = tokenOut.address.toLowerCase()
        const cfgA = cfg.tokenA.toLowerCase()
        const cfgB = cfg.tokenB.toLowerCase()
        if (!((cfgA === aIn && cfgB === aOut) || (cfgA === aOut && cfgB === aIn))) continue

        const [[rA, rB], ammTokenA] = await Promise.all([
          client.readContract({
            address: cfg.poolAddress as `0x${string}`,
            abi: AMM_ABI, functionName: 'getReserves',
          }) as Promise<[bigint, bigint]>,
          client.readContract({
            address: cfg.poolAddress as `0x${string}`,
            abi: AMM_ABI, functionName: 'tokenA',
          }) as Promise<string>,
        ])

        // AMM sorts tokens by address — align to tokenIn/tokenOut using amm.tokenA()
        const ammIsIn  = ammTokenA.toLowerCase() === aIn
        const rIn  = Number(ammIsIn ? rA : rB) / 10 ** tokenIn.decimals
        const rOut = Number(ammIsIn ? rB : rA) / 10 ** tokenOut.decimals
        const price = rOut / rIn

        const symA = TOKENS.find(t => t.address.toLowerCase() === cfgA)?.symbol ?? 'UNKNOWN'
        const symB = TOKENS.find(t => t.address.toLowerCase() === cfgB)?.symbol ?? 'UNKNOWN'
        const tvlUSD = roughUSD(symA, rIn) + roughUSD(symB, rOut)

        // Merge on-chain price/tvl with Bybit 24h stats
        const bybit = await fetchFromBybit(tokenIn, tokenOut)
        return {
          price,
          change24h: bybit?.change24h ?? 0,
          high24h:   bybit?.high24h   ?? price * 1.035,
          low24h:    bybit?.low24h    ?? price * 0.967,
          tvlUSD, vol24hUSD: bybit?.vol24hUSD ?? 0,
        }
      }
    } catch { /* RPC not available */ }
  }

  // 2. Bybit live market data
  return fetchFromBybit(tokenIn, tokenOut)
}

function fmtUSD(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function fmtPrice(p: number) {
  if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (p >= 1)    return p.toFixed(4)
  if (p >= 0.01) return p.toFixed(6)
  return p.toFixed(8)
}

interface Props {
  tokenIn?:  Token
  tokenOut?: Token
}

export function MarketBar({ tokenIn, tokenOut }: Props) {
  const [stats,   setStats]   = useState<PairStats | null>(null)
  const [noData,  setNoData]  = useState(false)

  useEffect(() => {
    if (!tokenIn || !tokenOut) { setStats(null); setNoData(false); return }
    let cancelled = false
    setStats(null); setNoData(false)
    ;(async () => {
      const live = await fetchPairStats(tokenIn, tokenOut)
      if (!cancelled) {
        setStats(live ?? null)
        setNoData(!live)
      }
    })()
    return () => { cancelled = true }
  }, [tokenIn?.address, tokenOut?.address])

  if (!tokenIn || !tokenOut) return null

  const pos = stats ? stats.change24h >= 0 : true
  const changeColor = pos ? 'text-green-400' : 'text-red-400'
  const pairLabel   = `${tokenIn.symbol} / ${tokenOut.symbol}`
  const outSym      = tokenOut.symbol

  return (
    <div className="flex items-center gap-0 border-b border-gray-800 bg-gray-950 px-5 shrink-0 overflow-x-auto">
      {/* Pair name */}
      <div className="flex items-center gap-2 pr-4 py-2 border-r border-gray-800 shrink-0">
        <div className="flex -space-x-1">
          <span className={`w-5 h-5 rounded-full ${tokenIn.color} flex items-center justify-center text-[10px] font-bold text-white ring-1 ring-gray-950`}>
            {tokenIn.symbol[0]}
          </span>
          <span className={`w-5 h-5 rounded-full ${tokenOut.color} flex items-center justify-center text-[10px] font-bold text-white ring-1 ring-gray-950`}>
            {tokenOut.symbol[0]}
          </span>
        </div>
        <span className="text-sm font-semibold text-gray-100 whitespace-nowrap">{pairLabel}</span>
        <span className="text-[10px] text-gray-600 bg-gray-800 rounded px-1.5 py-0.5">AMM</span>
      </div>

      {stats ? (
        <>
          <Stat value={fmtPrice(stats.price)} sub={outSym} className="pl-4" />
          <Stat value={`${pos ? '+' : ''}${stats.change24h.toFixed(2)}%`} sub="24h" valueClass={changeColor} />
          <Stat value={fmtPrice(stats.high24h)} sub="24h H" valueClass="text-green-400/80" />
          <Stat value={fmtPrice(stats.low24h)}  sub="24h L" valueClass="text-red-400/80" />
          <Stat value={fmtUSD(stats.vol24hUSD)} sub="24h Vol" />
          <Stat value={fmtUSD(stats.tvlUSD)}    sub="TVL" />
          <Stat value="0.25%" sub="Fee" />
        </>
      ) : noData ? (
        <div className="flex items-center px-4 py-2">
          <span className="text-xs text-gray-600">No market data available</span>
        </div>
      ) : (
        <div className="flex items-center gap-6 px-4 py-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse space-y-1">
              <div className="h-3.5 w-16 bg-gray-800 rounded" />
              <div className="h-2.5 w-8 bg-gray-800/60 rounded" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({
  value, sub, valueClass = 'text-gray-100', className = '',
}: { value: string; sub: string; valueClass?: string; className?: string }) {
  return (
    <div className={`flex flex-col px-4 py-2 border-r border-gray-800 shrink-0 ${className}`}>
      <span className={`text-xs font-semibold tabular-nums ${valueClass}`}>{value}</span>
      <span className="text-[10px] text-gray-600">{sub}</span>
    </div>
  )
}
