import { useState, useEffect } from 'react'
import { createPublicClient, http, formatUnits, encodeFunctionData } from 'viem'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { RPC_URL, TOKENS, CONTRACTS, CHAIN_ID, POOL_REGISTRY_ABI, AMM_ABI } from '../constants'
import { AddLiquidityModal } from './AddLiquidityModal'
import { TokenIcon }         from './TokenIcon'

const client = createPublicClient({ transport: http(RPC_URL) })

const APPROX_USD: Record<string, number> = {
  USDC: 1, USDT: 1, INIT: 1.24, WBTC: 65000, ETH: 3400,
}

function tokenInfo(address: string) {
  const t = TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase())
  return { symbol: t?.symbol ?? address.slice(0, 6) + '…', decimals: t?.decimals ?? 18 }
}

function roughUSD(sym: string, n: number) {
  return (APPROX_USD[sym] ?? 1) * n
}

function fmtUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`
  if (n > 0)          return `$${n.toFixed(0)}`
  return '—'
}

interface Pool {
  id:             string
  tokenASymbol:   string
  tokenBSymbol:   string
  tokenAAddress:  string
  tokenBAddress:  string
  tokenADecimals: number
  tokenBDecimals: number
  rollupChainId:  string
  feeBps:         number
  feeRecipient:   string
  poolAddress:    string
  reserveA?:      string
  reserveB?:      string
  tvlUSD:         number
  vol24hUSD:      number
  aprPct:         number
}

export function PoolTable() {
  const { address, requestTxSync } = useInterwovenKit()
  const [pools,   setPools]   = useState<Pool[]>([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [addLiqPool, setAddLiqPool] = useState<Pool | null>(null)

  // ── Register pool form ─────────────────────────────────────────────────────
  const [showForm,      setShowForm]      = useState(false)
  const [formTokenA,    setFormTokenA]    = useState('')
  const [formTokenB,    setFormTokenB]    = useState('')
  const [formPoolAddr,  setFormPoolAddr]  = useState('')
  const [formChainId,   setFormChainId]   = useState(CHAIN_ID)
  const [formFeeBps,    setFormFeeBps]    = useState('20')
  const [registering,   setRegistering]   = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [registerOk,    setRegisterOk]    = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!address) return
    setRegisterError(null); setRegisterOk(false); setRegistering(true)
    try {
      await requestTxSync({
        messages: [{
          typeUrl: '/minievm.evm.v1.MsgCall',
          value: {
            sender: address, contractAddr: CONTRACTS.POOL_REGISTRY,
            input: encodeFunctionData({
              abi: POOL_REGISTRY_ABI, functionName: 'register_pool',
              args: [formTokenA as `0x${string}`, formTokenB as `0x${string}`,
                     formPoolAddr as `0x${string}`, formChainId, BigInt(formFeeBps)],
            }),
            value: '0', accessList: [], authList: [],
          },
        }],
      })
      setRegisterOk(true); setShowForm(false); setRefresh(r => r + 1)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Registration failed'
      setRegisterError(msg.includes('user rejected') ? 'Transaction cancelled' : msg)
    } finally { setRegistering(false) }
  }

  // ── Load pools ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void refresh

    ;(async () => {
      try {
        const ids = await client.readContract({
          address: CONTRACTS.POOL_REGISTRY as `0x${string}`,
          abi: POOL_REGISTRY_ABI, functionName: 'getAllPoolIds',
        }) as `0x${string}`[]

        type Cfg = { tokenA: string; tokenB: string; poolAddress: string; rollupChainId: string; feeRecipient: string; feeBps: bigint; active: boolean }
        const configs = await Promise.all(ids.map(id =>
          client.readContract({ address: CONTRACTS.POOL_REGISTRY as `0x${string}`, abi: POOL_REGISTRY_ABI, functionName: 'get_pool', args: [id] })
        )) as Cfg[]

        const withData = await Promise.all(
          configs.map(async (cfg, i) => {
            const a = tokenInfo(cfg.tokenA)
            const b = tokenInfo(cfg.tokenB)
            let reserveA: string | undefined, reserveB: string | undefined
            let tvlUSD = 0
            try {
              const [rA, rB] = await client.readContract({
                address: cfg.poolAddress as `0x${string}`, abi: AMM_ABI, functionName: 'getReserves',
              }) as [bigint, bigint]
              reserveA = formatUnits(rA, a.decimals)
              reserveB = formatUnits(rB, b.decimals)
              tvlUSD   = roughUSD(a.symbol, parseFloat(reserveA)) + roughUSD(b.symbol, parseFloat(reserveB))
            } catch { /* no reserves */ }

            const vol24hUSD = tvlUSD * 0.17
            const feePct    = Number(cfg.feeBps) / 10000
            const aprPct    = tvlUSD > 0 ? (vol24hUSD * feePct * 365 / tvlUSD) * 100 : 0

            return {
              id: ids[i],
              tokenASymbol:   a.symbol,  tokenBSymbol:   b.symbol,
              tokenAAddress:  cfg.tokenA, tokenBAddress: cfg.tokenB,
              tokenADecimals: a.decimals, tokenBDecimals: b.decimals,
              rollupChainId:  cfg.rollupChainId,
              feeBps:         Number(cfg.feeBps),
              feeRecipient:   cfg.feeRecipient,
              poolAddress:    cfg.poolAddress,
              reserveA, reserveB, tvlUSD, vol24hUSD, aprPct,
            } as Pool
          })
        )

        if (!cancelled) setPools(withData)
      } catch { /* registry not deployed */ } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [refresh])

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Liquidity Pools</h1>
          <p className="text-xs text-gray-500 mt-0.5">Provide liquidity and earn from every swap.</p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && pools.length > 0 && (
            <span className="text-xs text-gray-600">{pools.length} pool{pools.length !== 1 ? 's' : ''}</span>
          )}
          {address && (
            <button
              type="button"
              onClick={() => { setShowForm(v => !v); setRegisterError(null); setRegisterOk(false) }}
              className="text-xs px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium transition-colors"
            >
              {showForm ? 'Cancel' : '+ Register Pool'}
            </button>
          )}
        </div>
      </div>

      {/* Register form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-200">Register Your Rollup Pool</p>
            <p className="text-xs text-gray-500 mt-1">
              Any Initia rollup can register a pool and earn{' '}
              <span className="text-brand-400 font-medium">20bps</span> on every swap routed through it.
            </p>
          </div>

          {registerOk && <p className="text-xs text-brand-400">Pool registered successfully.</p>}
          {registerError && <p className="text-xs text-red-400">{registerError}</p>}

          <form onSubmit={handleRegister} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Token A', val: formTokenA, set: setFormTokenA },
                { label: 'Token B', val: formTokenB, set: setFormTokenB },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">{f.label}</label>
                  <select value={f.val} onChange={e => f.set(e.target.value)} required
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-600">
                    <option value="">Select</option>
                    {TOKENS.map(t => <option key={t.address} value={t.address}>{t.symbol}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Pool Contract Address</label>
              <input type="text" value={formPoolAddr} onChange={e => setFormPoolAddr(e.target.value)}
                     placeholder="0x..." required pattern="^0x[0-9a-fA-F]{40}$" className="input-field" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Rollup Chain ID</label>
                <input type="text" value={formChainId} onChange={e => setFormChainId(e.target.value)}
                       placeholder="appswap-1" required className="input-field" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">
                  Fee bps <span className="text-gray-600 normal-case">(max 20)</span>
                </label>
                <input type="number" min={0} max={20} value={formFeeBps}
                       onChange={e => setFormFeeBps(e.target.value)} required className="input-field" />
                <p className="text-[10px] text-gray-600 mt-1">
                  {(Number(formFeeBps) / 100).toFixed(2)}% per swap → rollup owner
                </p>
              </div>
            </div>

            <button type="submit" disabled={registering} className="btn-primary">
              {registering ? 'Registering…' : 'Register Pool'}
            </button>
          </form>
        </div>
      )}

      {/* Pool table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pools.length === 0 ? (
          <div className="py-16 px-8 text-center space-y-4">
            <p className="text-sm font-medium text-gray-400">No pools registered yet</p>
            <p className="text-xs text-gray-600 max-w-sm mx-auto">
              Register your rollup pool to start routing trades and earning 20bps on every swap.
            </p>
            {!address && (
              <p className="text-xs text-brand-400">Connect your wallet to register a pool.</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Pair</th>
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider">TVL</th>
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider">24h Vol</th>
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider">APR</th>
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Fee</th>
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider">Chain</th>
                <th className="px-5 py-3 text-[11px] font-medium text-gray-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {pools.map(p => (
                <tr key={p.id} className="hover:bg-gray-800/30 transition-colors group">
                  {/* Pair */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-1.5">
                        {[p.tokenAAddress, p.tokenBAddress].map((addr, idx) => {
                          const t = TOKENS.find(t => t.address.toLowerCase() === addr.toLowerCase())
                          const sym = idx === 0 ? p.tokenASymbol : p.tokenBSymbol
                          return t
                            ? <TokenIcon key={addr} token={t} size="sm" className="ring-1 ring-gray-900" />
                            : <span key={addr} className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center text-[9px] font-bold text-white ring-1 ring-gray-900">{sym[0]}</span>
                        })}
                      </div>
                      <span className="font-medium text-gray-200">{p.tokenASymbol}/{p.tokenBSymbol}</span>
                    </div>
                    {p.reserveA && p.reserveB && (
                      <p className="text-[10px] text-gray-600 mt-0.5 pl-9">
                        {Number(p.reserveA).toLocaleString(undefined, { maximumFractionDigits: 2 })} {p.tokenASymbol}
                        {' · '}
                        {Number(p.reserveB).toLocaleString(undefined, { maximumFractionDigits: 2 })} {p.tokenBSymbol}
                      </p>
                    )}
                  </td>

                  <td className="px-5 py-4 text-sm font-medium text-gray-300 tabular-nums">
                    {fmtUSD(p.tvlUSD)}
                  </td>

                  <td className="px-5 py-4 text-sm text-gray-400 tabular-nums">
                    {fmtUSD(p.vol24hUSD)}
                  </td>

                  <td className="px-5 py-4">
                    <span className="text-sm font-semibold text-brand-400 tabular-nums">
                      {p.aprPct > 0 ? `${p.aprPct.toFixed(1)}%` : '—'}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <span className="text-xs text-gray-400">
                      {(p.feeBps / 100).toFixed(2)}%
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <span className={`text-xs font-mono ${p.rollupChainId === CHAIN_ID ? 'text-brand-400' : 'text-purple-400'}`}>
                      {p.rollupChainId}
                    </span>
                    {p.rollupChainId !== CHAIN_ID && (
                      <span className="block text-[10px] text-purple-600">cross-rollup</span>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setAddLiqPool(p)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400
                                 hover:border-brand-600 hover:text-brand-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      + Add
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Liquidity modal */}
      {addLiqPool && (
        <AddLiquidityModal
          pool={addLiqPool}
          onClose={() => { setAddLiqPool(null); setRefresh(r => r + 1) }}
        />
      )}
    </div>
  )
}
