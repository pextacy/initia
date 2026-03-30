import { useEffect, useState, useCallback, useRef } from 'react'
import { createPublicClient, http } from 'viem'
import { CONTRACTS, POOL_REGISTRY_ABI, AMM_ABI, RPC_URL } from '../constants'
import type { Token } from '../constants'
import { getBybitSymbol, APPROX_USD } from '../utils/bybit'

const client = createPublicClient({ transport: http(RPC_URL) })

const REFRESH_INTERVAL = 10   // seconds
const LEVELS           = 14

// ── Types ─────────────────────────────────────────────────────────────────────
interface DepthLevel {
  price: number
  size:  number   // tokenIn amount to move price here from previous level
  total: number   // cumulative tokenIn from mid
  pct:   number   // 0-100 for the depth bar
}

interface PoolData {
  poolAddress: string
  rIn:  number   // already in token units (divided by decimals)
  rOut: number
}

interface Depth {
  asks:     DepthLevel[]
  bids:     DepthLevel[]
  midPrice: number
  spread:   number
  spreadPct: number
  pool:     PoolData
}

// ── AMM math ──────────────────────────────────────────────────────────────────
// For x*y=k: to reach price P from current state (rIn, rOut):
//   new_rIn  = sqrt(k / P)
//   new_rOut = sqrt(k * P)
// "size" at each step is the marginal tokenIn needed to go from the previous level to this one.
function computeDepth(pool: PoolData): Depth {
  const { rIn, rOut } = pool
  const k        = rIn * rOut
  const midPrice = rOut / rIn   // how many tokenOut per 1 tokenIn

  // Guard against degenerate pool state
  if (!isFinite(k) || k <= 0 || !isFinite(midPrice) || midPrice <= 0) {
    const empty: DepthLevel[] = Array.from({ length: LEVELS }, (_, i) => ({
      price: 0, size: 0, total: 0, pct: ((i + 1) / LEVELS) * 100,
    }))
    return { asks: [...empty].reverse(), bids: empty, midPrice: 0, spread: 0, spreadPct: 0, pool }
  }

  // Adaptive step: use 0.2% per level so depth fits realistic AMM curve
  const stepPct = 0.002

  const asks: DepthLevel[] = []
  let prevRIn = rIn
  for (let i = 1; i <= LEVELS; i++) {
    const price  = midPrice * (1 + i * stepPct)
    const newRIn = Math.sqrt(k / price)           // rIn shrinks as price rises (AMM sells tokenIn)
    const size   = Math.abs(prevRIn - newRIn)     // tokenIn moved from last level
    const total  = Math.abs(rIn - newRIn)
    asks.push({ price, size: isFinite(size) ? size : 0, total: isFinite(total) ? total : 0, pct: 0 })
    prevRIn = newRIn
  }

  const bids: DepthLevel[] = []
  let prevRInB = rIn
  for (let i = 1; i <= LEVELS; i++) {
    const price  = midPrice * (1 - i * stepPct)
    const newRIn = Math.sqrt(k / price)           // rIn grows as price falls (AMM buys tokenIn)
    const size   = Math.abs(newRIn - prevRInB)
    const total  = Math.abs(newRIn - rIn)
    bids.push({ price, size: isFinite(size) ? size : 0, total: isFinite(total) ? total : 0, pct: 0 })
    prevRInB = newRIn
  }

  const maxTotal = Math.max(asks.at(-1)!.total, bids.at(-1)!.total)
  if (maxTotal > 0) {
    asks.forEach(l => { l.pct = (l.total / maxTotal) * 100 })
    bids.forEach(l => { l.pct = (l.total / maxTotal) * 100 })
  }

  const spread    = asks[0].price - bids[0].price
  const spreadPct = (spread / midPrice) * 100

  return { asks: [...asks].reverse(), bids, midPrice, spread, spreadPct, pool }
}

// ── Spot USD price helper (for cross-pair conversion) ─────────────────────────
async function fetchSpotMidPrice(token: Token): Promise<number> {
  const info = getBybitSymbol(token.symbol, 'USDT')
  if (!info) return APPROX_USD[token.symbol] ?? 0
  try {
    const res  = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${info.symbol}`)
    if (!res.ok) return APPROX_USD[token.symbol] ?? 0
    const json = await res.json()
    const p    = parseFloat(json?.result?.list?.[0]?.lastPrice ?? '0')
    return p > 0 ? p : (APPROX_USD[token.symbol] ?? 0)
  } catch { return APPROX_USD[token.symbol] ?? 0 }
}

// ── Exchange fallback ─────────────────────────────────────────────────────────
type Source = 'onchain' | 'exchange'

type FetchResult =
  | { ok: true;  depth: Depth; source: Source }
  | { ok: false; reason: 'rpc_error' | 'no_data'; detail?: string }

const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

async function fetchFromExchange(tokenIn: Token, tokenOut: Token): Promise<Depth | null> {
  const info = getBybitSymbol(tokenIn.symbol, tokenOut.symbol)
  if (!info) return null

  const isUSD = (s: string) => s === 'USDC' || s === 'USDT'

  try {
    // Bybit spot orderbook only accepts limit ∈ {1, 25, 50, 200}; request 25 and slice later
    const res  = await fetch(
      `https://api.bybit.com/v5/market/orderbook?category=spot&symbol=${info.symbol}&limit=25`
    )
    if (!res.ok) return null
    const json = await res.json()
    const book = json?.result
    if (!book?.b?.length || !book?.a?.length) return null

    // book.b = bids high→low [[price, size]…], book.a = asks low→high
    type Row = [string, string]
    let rawBids: [number, number][] = (book.b as Row[]).map(([p, s]) => [parseFloat(p), parseFloat(s)])
    let rawAsks: [number, number][] = (book.a as Row[]).map(([p, s]) => [parseFloat(p), parseFloat(s)])

    if (info.invert) {
      // Swap & invert: asks of INITUSDT become bids of USDC/INIT and vice-versa
      const newBids: [number, number][] = (book.a as Row[])
        .map(([p, s]): [number, number] => [1 / parseFloat(p), parseFloat(s) * parseFloat(p)])
        .sort((a, b) => b[0] - a[0])
      const newAsks: [number, number][] = (book.b as Row[])
        .map(([p, s]): [number, number] => [1 / parseFloat(p), parseFloat(s) * parseFloat(p)])
        .sort((a, b) => a[0] - b[0])
      rawBids = newBids
      rawAsks = newAsks
    }

    // Cross-pair conversion: when Bybit symbol is USDT-quoted but tokenOut is not USD,
    // prices need to be scaled to the actual quote currency.
    //
    // invert=false, tokenOut not USD (e.g. TIA/INIT via TIAUSDT):
    //   Bybit gives price in USDT → multiply by 1/tokenOut_USD
    //
    // invert=true,  tokenIn  not USD (e.g. INIT/TIA via TIAUSDT):
    //   After inversion prices are 1/tokenIn_USDT → multiply by tokenIn_USD
    //   After inversion sizes  are USDT amounts   → divide  by tokenIn_USD
    let priceScale = 1
    let sizeScale  = 1

    if (!isUSD(tokenOut.symbol) && !info.invert) {
      const tokenOutUSD = await fetchSpotMidPrice(tokenOut)
      if (tokenOutUSD > 0) priceScale = 1 / tokenOutUSD
    } else if (!isUSD(tokenIn.symbol) && info.invert) {
      const tokenInUSD = await fetchSpotMidPrice(tokenIn)
      if (tokenInUSD > 0) { priceScale = tokenInUSD; sizeScale = 1 / tokenInUSD }
    }

    if (priceScale !== 1 || sizeScale !== 1) {
      rawBids = rawBids
        .map(([p, s]) => [p * priceScale, s * sizeScale] as [number, number])
        .sort((a, b) => b[0] - a[0])
      rawAsks = rawAsks
        .map(([p, s]) => [p * priceScale, s * sizeScale] as [number, number])
        .sort((a, b) => a[0] - b[0])
    }

    // Trim to display depth
    rawBids = rawBids.slice(0, LEVELS)
    rawAsks = rawAsks.slice(0, LEVELS)

    // Build cumulative DepthLevel arrays
    function toLevels(raw: [number, number][]): DepthLevel[] {
      let cum = 0
      return raw.map(([price, size]) => {
        cum += size
        return { price, size, total: cum, pct: 0 }
      })
    }

    const bids = toLevels(rawBids)                 // best bid first (high→low)
    const asks = toLevels(rawAsks).reverse()        // display high→low (reversed from exchange)

    const maxTotal = Math.max(bids.at(-1)?.total ?? 0, asks[0]?.total ?? 0)
    if (maxTotal > 0) {
      bids.forEach(l => { l.pct = (l.total / maxTotal) * 100 })
      asks.forEach(l => { l.pct = (l.total / maxTotal) * 100 })
    }

    const bestBid   = rawBids[0]?.[0] ?? 0
    const bestAsk   = rawAsks[0]?.[0] ?? 0
    const midPrice  = (bestBid + bestAsk) / 2
    const spread    = bestAsk - bestBid
    const spreadPct = midPrice > 0 ? (spread / midPrice) * 100 : 0
    const pool: PoolData = { poolAddress: info.symbol, rIn: 0, rOut: 0 }

    return { asks, bids, midPrice, spread, spreadPct, pool }
  } catch { return null }
}

async function fetchDepth(tokenIn: Token, tokenOut: Token): Promise<FetchResult> {
  // Always prefer live Bybit exchange data; fall back to on-chain AMM only when
  // Bybit has no listing for the pair.
  const ex = await fetchFromExchange(tokenIn, tokenOut)
  if (ex) return { ok: true, depth: ex, source: 'exchange' }

  // Bybit has no data for this pair — try on-chain AMM as a last resort
  if (!CONTRACTS.POOL_REGISTRY || CONTRACTS.POOL_REGISTRY === ZERO_ADDR) {
    return { ok: false, reason: 'no_data' }
  }

  try {
    const ids = await client.readContract({
      address:      CONTRACTS.POOL_REGISTRY as `0x${string}`,
      abi:          POOL_REGISTRY_ABI,
      functionName: 'getAllPoolIds',
    }) as `0x${string}`[]

    const aIn  = tokenIn.address.toLowerCase()
    const aOut = tokenOut.address.toLowerCase()

    for (const id of ids) {
      const cfg = await client.readContract({
        address:      CONTRACTS.POOL_REGISTRY as `0x${string}`,
        abi:          POOL_REGISTRY_ABI,
        functionName: 'get_pool',
        args:         [id],
      }) as { tokenA: string; tokenB: string; poolAddress: string; active: boolean }

      const cfgA = cfg.tokenA.toLowerCase()
      const cfgB = cfg.tokenB.toLowerCase()
      const match = (cfgA === aIn && cfgB === aOut) || (cfgA === aOut && cfgB === aIn)
      if (!match || !cfg.active) continue

      const [[rA, rB], ammTokenA] = await Promise.all([
        client.readContract({
          address:      cfg.poolAddress as `0x${string}`,
          abi:          AMM_ABI,
          functionName: 'getReserves',
        }) as Promise<[bigint, bigint]>,
        client.readContract({
          address:      cfg.poolAddress as `0x${string}`,
          abi:          AMM_ABI,
          functionName: 'tokenA',
        }) as Promise<string>,
      ])

      const ammIsIn  = ammTokenA.toLowerCase() === aIn
      const rIn  = Number(ammIsIn ? rA : rB) / 10 ** tokenIn.decimals
      const rOut = Number(ammIsIn ? rB : rA) / 10 ** tokenOut.decimals

      if (rIn === 0 || rOut === 0) break

      const pool: PoolData = { poolAddress: cfg.poolAddress, rIn, rOut }
      return { ok: true, depth: computeDepth(pool), source: 'onchain' }
    }

    return { ok: false, reason: 'no_data' }
  } catch {
    return { ok: false, reason: 'no_data' }
  }
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtPrice(p: number, ref: number): string {
  if (ref >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (ref >= 1)    return p.toFixed(4)
  if (ref >= 0.01) return p.toFixed(6)
  return p.toFixed(8)
}

function fmtSize(s: number): string {
  if (!isFinite(s) || s <= 0) return '—'
  if (s >= 1_000_000) return `${(s / 1_000_000).toFixed(3)}M`
  if (s >= 1_000)     return `${(s / 1_000).toFixed(3)}K`
  if (s >= 1)         return s.toFixed(3)
  return s.toPrecision(4)
}

function fmtAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  tokenIn?:  Token
  tokenOut?: Token
}

export function DepthBook({ tokenIn, tokenOut }: Props) {
  const [depth,     setDepth]     = useState<Depth | null>(null)
  const [source,    setSource]    = useState<Source>('exchange')
  const [status,    setStatus]    = useState<'idle' | 'loading' | 'ok' | 'rpc_error' | 'no_data'>('idle')
  const [detail,    setDetail]    = useState('')
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const load = useCallback(async () => {
    if (!tokenIn || !tokenOut) return
    setStatus('loading')
    const result = await fetchDepth(tokenIn, tokenOut)
    if (result.ok) {
      setDepth(result.depth)
      setSource(result.source)
      setStatus('ok')
      setUpdatedAt(new Date())
      setCountdown(REFRESH_INTERVAL)
    } else {
      setDepth(null)
      setStatus(result.reason as 'rpc_error' | 'no_data')
      setDetail(result.detail ?? '')
    }
  }, [tokenIn, tokenOut])

  // Load on pair change
  useEffect(() => {
    setDepth(null)
    setStatus('idle')
    setDetail('')
    setUpdatedAt(null)
    clearInterval(timerRef.current)
    if (!tokenIn || !tokenOut) return
    load()
  }, [tokenIn?.address, tokenOut?.address])  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh + countdown ticker
  useEffect(() => {
    if (!tokenIn || !tokenOut) return
    clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { load(); return REFRESH_INTERVAL }
        return c - 1
      })
    }, 1_000)

    return () => clearInterval(timerRef.current)
  }, [tokenIn?.address, tokenOut?.address, load])

  // ── Empty / error states ───────────────────────────────────────────────────
  if (!tokenIn || !tokenOut) {
    return <Placeholder>Select a pair</Placeholder>
  }

  if (status === 'idle' || (status === 'loading' && !depth)) {
    return <Placeholder pulse>Fetching depth…</Placeholder>
  }

  if (status === 'rpc_error' || status === 'no_data') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
        <p className="text-xs text-gray-500">
          {status === 'no_data' ? 'No market data available' : 'RPC error'}
        </p>
        {detail && <p className="text-[10px] text-gray-600 break-all line-clamp-3">{detail}</p>}
        <button type="button" onClick={load}
          className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
          Retry
        </button>
      </div>
    )
  }

  if (!depth) return <Placeholder pulse>Loading…</Placeholder>

  const ref  = depth.midPrice
  const isStale = status === 'loading'

  return (
    <div className="flex flex-col h-full text-xs font-mono select-none">

      {/* Column headers */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-gray-800 text-gray-600 shrink-0">
        <span className="w-[37%]">Price</span>
        <span className="w-[30%] text-right">Size</span>
        <span className="w-[31%] text-right">Total</span>
      </div>

      {/* Asks (sell side) — displayed high→low, flush to spread row */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-end">
        {depth.asks.map((a, i) => (
          <div key={i} className="relative flex items-center justify-between px-3 py-[2.5px] hover:bg-gray-900/60 group">
            <div className="absolute inset-y-0 right-0 bg-red-500/[0.07] transition-all"
                 style={{ width: `${a.pct}%` }} />
            <span className="w-[37%] text-red-400 relative z-10 tabular-nums">{fmtPrice(a.price, ref)}</span>
            <span className="w-[30%] text-right text-gray-400 relative z-10 tabular-nums">{fmtSize(a.size)}</span>
            <span className="w-[31%] text-right text-gray-600 relative z-10 tabular-nums">{fmtSize(a.total)}</span>
          </div>
        ))}
      </div>

      {/* Spread row */}
      <div className="shrink-0 px-3 py-1.5 border-y border-gray-800 bg-gray-900/60 flex items-center justify-between">
        <span className={`font-semibold tracking-tight text-gray-100 ${isStale ? 'opacity-50' : ''}`}>
          {fmtPrice(depth.midPrice, ref)}
        </span>
        <span className="text-gray-600 tabular-nums">
          <span className="text-gray-500">{depth.spreadPct.toFixed(3)}%</span>
        </span>
      </div>

      {/* Bids (buy side) — low→high from spread */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {depth.bids.map((b, i) => (
          <div key={i} className="relative flex items-center justify-between px-3 py-[2.5px] hover:bg-gray-900/60">
            <div className="absolute inset-y-0 right-0 bg-green-500/[0.07]"
                 style={{ width: `${b.pct}%` }} />
            <span className="w-[37%] text-green-400 relative z-10 tabular-nums">{fmtPrice(b.price, ref)}</span>
            <span className="w-[30%] text-right text-gray-400 relative z-10 tabular-nums">{fmtSize(b.size)}</span>
            <span className="w-[31%] text-right text-gray-600 relative z-10 tabular-nums">{fmtSize(b.total)}</span>
          </div>
        ))}
      </div>

      {/* Footer — pool info + refresh */}
      <div className="shrink-0 border-t border-gray-800 px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {source === 'exchange' ? (
            <span />
          ) : (
            <>
              <span className="text-gray-700 font-sans">Pool</span>
              <a
                href={`#pool-${depth.pool.poolAddress}`}
                title={depth.pool.poolAddress}
                className="text-gray-600 hover:text-gray-400 transition-colors font-sans"
              >
                {fmtAddr(depth.pool.poolAddress)}
              </a>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {updatedAt && (
            <span className="text-gray-700 font-sans">
              {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={() => { load(); setCountdown(REFRESH_INTERVAL) }}
            title={`Auto-refresh in ${countdown}s`}
            className="flex items-center gap-1 text-gray-600 hover:text-brand-400 transition-colors font-sans"
          >
            <svg className={`w-3 h-3 ${isStale ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{countdown}s</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function Placeholder({ children, pulse }: { children: React.ReactNode; pulse?: boolean }) {
  return (
    <div className={`flex items-center justify-center h-full text-xs text-gray-600 ${pulse ? 'animate-pulse' : ''}`}>
      {children}
    </div>
  )
}
