import { useState, useEffect } from 'react'
import { createPublicClient, http, formatUnits } from 'viem'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import {
  RPC_URL, CONTRACTS, POOL_REGISTRY_ABI, AMM_ABI, ERC20_ABI,
  ROUTER_EVENTS_ABI, TOKENS, type Token,
} from '../constants'
import { usePendingOrders } from '../hooks/usePendingOrders'

const client = createPublicClient({ transport: http(RPC_URL) })
const ZERO   = '0x0000000000000000000000000000000000000000'

type PanelTab = 'positions' | 'orders' | 'balances' | 'order_history' | 'position_history'

const TABS: { id: PanelTab; label: string }[] = [
  { id: 'positions',        label: 'Positions'        },
  { id: 'orders',           label: 'Orders'           },
  { id: 'balances',         label: 'Balances'         },
  { id: 'order_history',    label: 'Order History'    },
  { id: 'position_history', label: 'Position History' },
]

function tokenInfo(address: string) {
  return TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase())
}

// ── Positions: LP shares held by user in each AMM pool ────────────────────────
interface LPPosition {
  poolAddress: string
  tokenA:      Token
  tokenB:      Token
  lpBalance:   bigint
  lpTotal:     bigint
  reserveA:    bigint
  reserveB:    bigint
}

function usePositions(hexAddress: string | undefined) {
  const [positions, setPositions] = useState<LPPosition[]>([])
  const [loading,   setLoading]   = useState(false)

  useEffect(() => {
    if (!hexAddress || !CONTRACTS.POOL_REGISTRY || CONTRACTS.POOL_REGISTRY === ZERO) return
    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const ids = await client.readContract({
          address: CONTRACTS.POOL_REGISTRY as `0x${string}`,
          abi: POOL_REGISTRY_ABI, functionName: 'getAllPoolIds',
        }) as `0x${string}`[]

        const result: LPPosition[] = []
        for (const id of ids) {
          const cfg = await client.readContract({
            address: CONTRACTS.POOL_REGISTRY as `0x${string}`,
            abi: POOL_REGISTRY_ABI, functionName: 'get_pool', args: [id],
          }) as { tokenA: string; tokenB: string; poolAddress: string; active: boolean }

          if (!cfg.active) continue

          const tA = tokenInfo(cfg.tokenA)
          const tB = tokenInfo(cfg.tokenB)
          if (!tA || !tB) continue

          const lpBalance = await client.readContract({
            address: cfg.poolAddress as `0x${string}`,
            abi: AMM_ABI, functionName: 'balanceOf',
            args: [hexAddress as `0x${string}`],
          }) as bigint

          if (lpBalance === 0n) continue

          const lpTotal = await client.readContract({
            address: cfg.poolAddress as `0x${string}`,
            abi: AMM_ABI, functionName: 'totalSupply',
          }) as bigint

          const [reserveA, reserveB] = await client.readContract({
            address: cfg.poolAddress as `0x${string}`,
            abi: AMM_ABI, functionName: 'getReserves',
          }) as [bigint, bigint]

          result.push({ poolAddress: cfg.poolAddress, tokenA: tA, tokenB: tB, lpBalance, lpTotal, reserveA, reserveB })
        }

        if (!cancelled) setPositions(result)
      } catch {
        // RPC not available
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [hexAddress])

  return { positions, loading }
}

// ── All token balances ─────────────────────────────────────────────────────────
interface TokenBalance { token: Token; balance: bigint }

function useAllBalances(hexAddress: string | undefined) {
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    if (!hexAddress || TOKENS.length === 0) { setBalances([]); return }
    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const results = await Promise.all(
          TOKENS.map(async t => {
            try {
              const bal = await client.readContract({
                address: t.address as `0x${string}`,
                abi: ERC20_ABI, functionName: 'balanceOf',
                args: [hexAddress as `0x${string}`],
              }) as bigint
              return { token: t, balance: bal }
            } catch {
              return { token: t, balance: 0n }
            }
          })
        )
        if (!cancelled) setBalances(results)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [hexAddress])

  return { balances, loading }
}

// ── Order history: SwapExecuted events ────────────────────────────────────────
interface SwapEvent {
  txHash:    string
  tokenIn:   string
  tokenOut:  string
  amountIn:  bigint
  amountOut: bigint
  blockNumber: bigint
}

function useOrderHistory(hexAddress: string | undefined) {
  const [events,  setEvents]  = useState<SwapEvent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!hexAddress || !CONTRACTS.ROUTER || CONTRACTS.ROUTER === ZERO) return
    let cancelled = false
    setLoading(true)

    ;(async () => {
      try {
        const latest     = await client.getBlockNumber()
        const startBlock = latest > 10000n ? latest - 10000n : 0n
        const logs = await client.getContractEvents({
          address:   CONTRACTS.ROUTER as `0x${string}`,
          abi:       ROUTER_EVENTS_ABI,
          eventName: 'SwapExecuted',
          args:      { user: hexAddress as `0x${string}` },
          fromBlock: startBlock,
          toBlock:   latest,
        })
        if (!cancelled) {
          setEvents(logs.reverse().slice(0, 50).map(l => ({
            txHash:      l.transactionHash ?? '',
            blockNumber: l.blockNumber ?? 0n,
            tokenIn:     (l.args as { tokenIn: string }).tokenIn,
            tokenOut:    (l.args as { tokenOut: string }).tokenOut,
            amountIn:    (l.args as { amountIn: bigint }).amountIn,
            amountOut:   (l.args as { amountOut: bigint }).amountOut,
          })))
        }
      } catch {} finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [hexAddress])

  return { events, loading }
}

// ── Component ──────────────────────────────────────────────────────────────────
export function TradePanel() {
  const [tab, setTab] = useState<PanelTab>('orders')
  const { hexAddress } = useInterwovenKit()
  const { orders, cancelOrder, clearCompleted } = usePendingOrders()
  const { positions, loading: posLoading }   = usePositions(hexAddress)
  const { balances,  loading: balLoading }   = useAllBalances(hexAddress)
  const { events,    loading: evtLoading }   = useOrderHistory(hexAddress)

  return (
    <div className="flex flex-col h-full bg-gray-950 border-t border-gray-800">

      {/* Tab bar */}
      <div className="flex items-center border-b border-gray-800 shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
            {t.id === 'orders' && orders.filter(o => o.status === 'pending').length > 0 && (
              <span className="ml-1.5 bg-brand-700/40 text-brand-400 text-[9px] px-1.5 py-0.5 rounded-full">
                {orders.filter(o => o.status === 'pending').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">

        {/* ── Positions ─────────────────────────────────────────────── */}
        {tab === 'positions' && (
          <div className="h-full">
            {!hexAddress ? (
              <Empty>Connect wallet to view positions</Empty>
            ) : !CONTRACTS.POOL_REGISTRY || CONTRACTS.POOL_REGISTRY === ZERO ? (
              <Empty>Contracts not deployed</Empty>
            ) : posLoading ? (
              <Loading />
            ) : positions.length === 0 ? (
              <Empty>No liquidity positions</Empty>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-600 text-left">
                    <Th>Pool</Th><Th>Your LP</Th><Th>Token A</Th><Th>Token B</Th><Th>Share</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {positions.map(p => {
                    const share    = p.lpTotal > 0n ? Number(p.lpBalance * 10000n / p.lpTotal) / 100 : 0
                    const userA    = p.lpTotal > 0n ? p.reserveA * p.lpBalance / p.lpTotal : 0n
                    const userB    = p.lpTotal > 0n ? p.reserveB * p.lpBalance / p.lpTotal : 0n
                    return (
                      <tr key={p.poolAddress} className="hover:bg-gray-800/30">
                        <Td className="font-mono">
                          <span className={`inline-block w-2 h-2 rounded-full ${p.tokenA.color} mr-1`} />
                          {p.tokenA.symbol}/{p.tokenB.symbol}
                        </Td>
                        <Td>{formatUnits(p.lpBalance, 18).slice(0, 10)}</Td>
                        <Td>{formatUnits(userA, p.tokenA.decimals).slice(0, 8)} {p.tokenA.symbol}</Td>
                        <Td>{formatUnits(userB, p.tokenB.decimals).slice(0, 8)} {p.tokenB.symbol}</Td>
                        <Td className="text-brand-400">{share.toFixed(2)}%</Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Orders (client-side pending) ──────────────────────────── */}
        {tab === 'orders' && (
          <div className="h-full">
            {orders.length === 0 ? (
              <Empty>No open orders — place a Limit, Stop, or TP order</Empty>
            ) : (
              <>
                <div className="flex items-center justify-end px-3 py-1.5 border-b border-gray-800/40">
                  <button onClick={clearCompleted} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">
                    Clear completed
                  </button>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-600 text-left">
                      <Th>Type</Th><Th>Side</Th><Th>Pair</Th><Th>Amount</Th><Th>Trigger</Th><Th>Status</Th><Th></Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/40">
                    {orders.map(o => (
                      <tr key={o.id} className="hover:bg-gray-800/30">
                        <Td className="uppercase tracking-wide text-gray-500">{o.type.replace('_', ' ')}</Td>
                        <Td className={o.side === 'long' ? 'text-green-400' : 'text-red-400'}>
                          {o.side.toUpperCase()}
                        </Td>
                        <Td>{o.tokenInSymbol}/{o.tokenOutSymbol}</Td>
                        <Td>{o.amountIn} {o.tokenInSymbol}</Td>
                        <Td className="tabular-nums">{o.triggerPrice.toFixed(4)}</Td>
                        <Td>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            o.status === 'pending'   ? 'bg-yellow-900/30 text-yellow-400' :
                            o.status === 'triggered' ? 'bg-blue-900/30 text-blue-400' :
                            o.status === 'executed'  ? 'bg-green-900/30 text-green-400' :
                            'bg-gray-800 text-gray-500'
                          }`}>
                            {o.status}
                          </span>
                        </Td>
                        <Td>
                          {o.status === 'pending' && (
                            <button onClick={() => cancelOrder(o.id)}
                              className="text-gray-600 hover:text-red-400 transition-colors">✕</button>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* ── Balances ──────────────────────────────────────────────── */}
        {tab === 'balances' && (
          <div className="h-full">
            {!hexAddress ? (
              <Empty>Connect wallet to view balances</Empty>
            ) : balLoading ? (
              <Loading />
            ) : TOKENS.length === 0 ? (
              <Empty>No tokens configured (set VITE_TOKEN_* env vars)</Empty>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-600 text-left">
                    <Th>Token</Th><Th>Balance</Th><Th>Est. USD</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {balances.map(({ token, balance }) => {
                    const human = parseFloat(formatUnits(balance, token.decimals))
                    const usd   = human * (({ USDC: 1, USDT: 1, INIT: 1.24, WBTC: 65000, ETH: 3400 } as Record<string, number>)[token.symbol] ?? 0)
                    return (
                      <tr key={token.address} className="hover:bg-gray-800/30">
                        <Td>
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full ${token.color} flex items-center justify-center text-[9px] font-bold text-white`}>
                              {token.symbol[0]}
                            </span>
                            <div>
                              <div className="font-medium text-gray-200">{token.symbol}</div>
                              <div className="text-gray-600">{token.name}</div>
                            </div>
                          </div>
                        </Td>
                        <Td className="tabular-nums text-gray-200">
                          {human.toLocaleString(undefined, { maximumFractionDigits: token.decimals <= 6 ? token.decimals : 6 })}
                        </Td>
                        <Td className="tabular-nums text-gray-500">
                          {usd > 0
                            ? `$${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                            : '—'}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Order History ─────────────────────────────────────────── */}
        {tab === 'order_history' && (
          <div className="h-full">
            {!hexAddress ? (
              <Empty>Connect wallet to view history</Empty>
            ) : !CONTRACTS.ROUTER || CONTRACTS.ROUTER === ZERO ? (
              <Empty>Router contract not deployed</Empty>
            ) : evtLoading ? (
              <Loading />
            ) : events.length === 0 ? (
              <Empty>No swap history found</Empty>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-600 text-left">
                    <Th>Pair</Th><Th>Sold</Th><Th>Received</Th><Th>Tx</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/40">
                  {events.map((e, i) => {
                    const tIn  = tokenInfo(e.tokenIn)
                    const tOut = tokenInfo(e.tokenOut)
                    const inAmt  = formatUnits(e.amountIn,  tIn?.decimals  ?? 18)
                    const outAmt = formatUnits(e.amountOut, tOut?.decimals ?? 18)
                    return (
                      <tr key={`${e.txHash}-${i}`} className="hover:bg-gray-800/30">
                        <Td>
                          <div className="flex items-center gap-1">
                            <span className={`w-3 h-3 rounded-full ${tIn?.color ?? 'bg-gray-600'} inline-block`} />
                            <span className="text-gray-300">{tIn?.symbol ?? e.tokenIn.slice(0, 6)}</span>
                            <span className="text-gray-600">→</span>
                            <span className={`w-3 h-3 rounded-full ${tOut?.color ?? 'bg-gray-600'} inline-block`} />
                            <span className="text-gray-300">{tOut?.symbol ?? e.tokenOut.slice(0, 6)}</span>
                          </div>
                        </Td>
                        <Td className="text-red-400 tabular-nums">
                          -{parseFloat(inAmt).toFixed(4)} {tIn?.symbol}
                        </Td>
                        <Td className="text-green-400 tabular-nums">
                          +{parseFloat(outAmt).toFixed(4)} {tOut?.symbol}
                        </Td>
                        <Td className="font-mono text-gray-600">
                          {e.txHash ? `${e.txHash.slice(0, 8)}…${e.txHash.slice(-6)}` : `#${e.blockNumber}`}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Position History ──────────────────────────────────────── */}
        {tab === 'position_history' && (
          <div className="h-full">
            {!hexAddress ? (
              <Empty>Connect wallet to view position history</Empty>
            ) : !CONTRACTS.POOL_REGISTRY || CONTRACTS.POOL_REGISTRY === ZERO ? (
              <Empty>Contracts not deployed</Empty>
            ) : (
              <Empty>
                No LP add/remove events found.
                {' '}
                <span className="text-gray-700">
                  Liquidity events are recorded once you add or remove liquidity from a pool.
                </span>
              </Empty>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Small helpers ──────────────────────────────────────────────────────────────
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[100px] text-xs text-gray-600 text-center px-4 py-6">
      {children}
    </div>
  )
}
function Loading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[100px]">
      <div className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 font-medium text-gray-600">{children}</th>
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 text-gray-400 ${className}`}>{children}</td>
}
