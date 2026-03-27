import { useState, useEffect } from 'react'
import { createPublicClient, http, formatUnits, encodeFunctionData } from 'viem'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { RPC_URL, TOKENS, CONTRACTS, CHAIN_ID, POOL_REGISTRY_ABI, AMM_ABI } from '../constants'

const client = createPublicClient({ transport: http(RPC_URL) })

interface Pool {
  id:            string
  tokenASymbol:  string
  tokenBSymbol:  string
  tokenADecimals: number
  tokenBDecimals: number
  rollupChainId: string
  feeBps:        number
  feeRecipient:  string
  poolAddress:   string
  reserveA?:     string
  reserveB?:     string
}

function tokenInfo(address: string) {
  const t = TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase())
  return { symbol: t?.symbol ?? address.slice(0, 6) + '…', decimals: t?.decimals ?? 18 }
}

export function PoolTable() {
  const { address, requestTxSync } = useInterwovenKit()
  const [pools,   setPools]   = useState<Pool[]>([])
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)

  // ── Register pool form ────────────────────────────────────────────────────
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
    setRegisterError(null)
    setRegisterOk(false)
    setRegistering(true)
    try {
      await requestTxSync({
        messages: [{
          typeUrl: '/minievm.evm.v1.MsgCall',
          value: {
            sender:       address,
            contractAddr: CONTRACTS.POOL_REGISTRY,
            input: encodeFunctionData({
              abi: POOL_REGISTRY_ABI,
              functionName: 'register_pool',
              args: [
                formTokenA    as `0x${string}`,
                formTokenB    as `0x${string}`,
                formPoolAddr  as `0x${string}`,
                formChainId,
                BigInt(formFeeBps),
              ],
            }),
            value:      '0',
            accessList: [],
            authList:   [],
          },
        }],
      })
      setRegisterOk(true)
      setShowForm(false)
      setRefresh(r => r + 1)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Registration failed'
      setRegisterError(msg.includes('user rejected') ? 'Transaction cancelled' : msg)
    } finally {
      setRegistering(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // eslint-disable-next-line no-unused-expressions
    refresh // re-run after successful registration

    ;(async () => {
      try {
        const ids = await client.readContract({
          address: CONTRACTS.POOL_REGISTRY as `0x${string}`,
          abi: POOL_REGISTRY_ABI,
          functionName: 'getAllPoolIds',
        }) as `0x${string}`[]

        const configs = await Promise.all(
          ids.map(id =>
            client.readContract({
              address: CONTRACTS.POOL_REGISTRY as `0x${string}`,
              abi: POOL_REGISTRY_ABI,
              functionName: 'get_pool',
              args: [id],
            })
          )
        )

        type PoolConfig = {
          tokenA: string; tokenB: string; poolAddress: string
          rollupChainId: string; feeRecipient: string; feeBps: bigint; active: boolean
        }

        const basePools = (configs as PoolConfig[]).map((cfg, i) => {
          const a = tokenInfo(cfg.tokenA)
          const b = tokenInfo(cfg.tokenB)
          return {
            id:             ids[i],
            tokenASymbol:   a.symbol,
            tokenBSymbol:   b.symbol,
            tokenADecimals: a.decimals,
            tokenBDecimals: b.decimals,
            rollupChainId:  cfg.rollupChainId,
            feeBps:         Number(cfg.feeBps),
            feeRecipient:   cfg.feeRecipient,
            poolAddress:    cfg.poolAddress,
          }
        })

        // Fetch reserves for each pool
        const withReserves = await Promise.all(
          basePools.map(async pool => {
            try {
              const [rA, rB] = await client.readContract({
                address: pool.poolAddress as `0x${string}`,
                abi: AMM_ABI,
                functionName: 'getReserves',
              }) as [bigint, bigint]
              return {
                ...pool,
                reserveA: formatUnits(rA, pool.tokenADecimals),
                reserveB: formatUnits(rB, pool.tokenBDecimals),
              }
            } catch {
              return pool
            }
          })
        )

        if (!cancelled) setPools(withReserves)
      } catch {
        /* registry not deployed yet — show empty state */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [refresh])

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
    <div className="card">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-100">Pools</h2>
        <div className="flex items-center gap-3">
          {!loading && pools.length > 0 && (
            <span className="text-xs text-gray-500">{pools.length} pool{pools.length !== 1 ? 's' : ''}</span>
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

      {registerOk && (
        <p className="text-xs text-brand-400 mb-3">Pool registered successfully.</p>
      )}
      {registerError && (
        <p className="text-xs text-red-400 mb-3">{registerError}</p>
      )}

      {/* ── Register pool form ──────────────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleRegister} className="bg-gray-800/50 rounded-xl p-4 mb-5 space-y-3 border border-gray-700">
          <p className="text-xs font-semibold text-gray-300 mb-1">Register Your Rollup Pool</p>
          <p className="text-[11px] text-gray-500 mb-3">
            Any Initia rollup can register a pool here and earn <span className="text-brand-400">20bps</span> on every swap routed through it.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Token A</label>
              <select
                value={formTokenA}
                onChange={e => setFormTokenA(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-600"
              >
                <option value="">Select token</option>
                {TOKENS.map(t => <option key={t.address} value={t.address}>{t.symbol}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Token B</label>
              <select
                value={formTokenB}
                onChange={e => setFormTokenB(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-600"
              >
                <option value="">Select token</option>
                {TOKENS.map(t => <option key={t.address} value={t.address}>{t.symbol}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Pool Contract Address</label>
            <input
              type="text"
              value={formPoolAddr}
              onChange={e => setFormPoolAddr(e.target.value)}
              placeholder="0x..."
              required
              pattern="^0x[0-9a-fA-F]{40}$"
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Rollup Chain ID</label>
              <input
                type="text"
                value={formChainId}
                onChange={e => setFormChainId(e.target.value)}
                placeholder="appswap-1"
                required
                className="input-field"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">
                Fee (bps) <span className="text-gray-600">max 20</span>
              </label>
              <input
                type="number"
                min={0}
                max={20}
                value={formFeeBps}
                onChange={e => setFormFeeBps(e.target.value)}
                required
                className="input-field"
              />
              <p className="text-[10px] text-gray-600 mt-1">
                {formFeeBps} bps = {(Number(formFeeBps) / 100).toFixed(2)}% rollup fee per swap
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={registering}
            className="btn-primary mt-2"
          >
            {registering ? 'Registering…' : 'Register Pool'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pools.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-sm">No pools registered yet.</p>
          <p className="text-gray-700 text-xs mt-1">Register your rollup pool to start earning swap fees.</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-800">
                <th className="pb-3 pr-4 text-xs font-medium text-gray-500">Pair</th>
                <th className="pb-3 pr-4 text-xs font-medium text-gray-500">Liquidity</th>
                <th className="pb-3 pr-4 text-xs font-medium text-gray-500">Fee</th>
                <th className="pb-3 text-xs font-medium text-gray-500">Chain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {pools.map(p => (
                <tr key={p.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-3.5 pr-4 font-medium text-gray-200">
                    {p.tokenASymbol}/{p.tokenBSymbol}
                  </td>
                  <td className="py-3.5 pr-4 text-xs text-gray-400">
                    {p.reserveA && p.reserveB ? (
                      <span>
                        {Number(p.reserveA).toLocaleString(undefined, { maximumFractionDigits: 2 })} {p.tokenASymbol}
                        <span className="text-gray-600 mx-1">/</span>
                        {Number(p.reserveB).toLocaleString(undefined, { maximumFractionDigits: 2 })} {p.tokenBSymbol}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="text-xs font-medium text-brand-400">
                      {(p.feeBps / 100).toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-3.5 font-mono text-xs text-gray-500">
                    {p.rollupChainId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </div>
  )
}
