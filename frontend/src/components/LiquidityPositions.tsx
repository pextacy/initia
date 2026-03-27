import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, http, formatUnits, parseUnits, encodeFunctionData, maxUint256 } from 'viem'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import {
  RPC_URL, TOKENS, CONTRACTS,
  POOL_REGISTRY_ABI, AMM_ABI, ERC20_ABI, ROUTER_ABI,
} from '../constants'
import { TokenIcon } from './TokenIcon'

const client = createPublicClient({ transport: http(RPC_URL) })

function tokenInfo(address: string) {
  const t = TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase())
  return { symbol: t?.symbol ?? address.slice(0, 6) + '…', decimals: t?.decimals ?? 18, token: t }
}

interface Position {
  poolId:        string
  poolAddress:   string
  tokenAAddr:    string
  tokenBAddr:    string
  symbolA:       string
  symbolB:       string
  decimalsA:     number
  decimalsB:     number
  reserveA:      bigint
  reserveB:      bigint
  totalSupply:   bigint
  userLp:        bigint
  sharePercent:  number
  userAmountA:   string
  userAmountB:   string
  feeBps:        number
}

// ── Add Liquidity Modal ───────────────────────────────────────────────────────
function AddLiquidityModal({
  position,
  onClose,
  onSuccess,
}: {
  position: Position
  onClose: () => void
  onSuccess: () => void
}) {
  const { address, hexAddress, requestTxSync } = useInterwovenKit()
  const [amtA,    setAmtA]    = useState('')
  const [amtB,    setAmtB]    = useState('')
  const [status,  setStatus]  = useState<'idle' | 'approving' | 'adding' | 'done' | 'error'>('idle')
  const [errMsg,  setErrMsg]  = useState<string | null>(null)

  // Auto-calculate B from A based on current ratio
  function handleAmtA(val: string) {
    setAmtA(val)
    if (!val || position.reserveA === 0n) { setAmtB(''); return }
    const ratio = Number(formatUnits(position.reserveB, position.decimalsB))
               / Number(formatUnits(position.reserveA, position.decimalsA))
    setAmtB((parseFloat(val) * ratio).toFixed(6))
  }
  function handleAmtB(val: string) {
    setAmtB(val)
    if (!val || position.reserveB === 0n) { setAmtA(''); return }
    const ratio = Number(formatUnits(position.reserveA, position.decimalsA))
               / Number(formatUnits(position.reserveB, position.decimalsB))
    setAmtA((parseFloat(val) * ratio).toFixed(6))
  }

  async function submit() {
    if (!address || !hexAddress || !amtA || !amtB) return
    setErrMsg(null)
    try {
      const rawA   = parseUnits(amtA, position.decimalsA)
      const rawB   = parseUnits(amtB, position.decimalsB)
      const minA   = (rawA * 95n) / 100n   // 5% slippage
      const minB   = (rawB * 95n) / 100n
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600)

      // Step 1: approve tokenA
      setStatus('approving')
      await requestTxSync({
        messages: [{
          typeUrl: '/minievm.evm.v1.MsgCall',
          value: {
            sender: address,
            contractAddr: position.tokenAAddr,
            input: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [CONTRACTS.ROUTER as `0x${string}`, maxUint256] }),
            value: '0', accessList: [], authList: [],
          },
        }],
      })

      // Step 2: approve tokenB
      await requestTxSync({
        messages: [{
          typeUrl: '/minievm.evm.v1.MsgCall',
          value: {
            sender: address,
            contractAddr: position.tokenBAddr,
            input: encodeFunctionData({ abi: ERC20_ABI, functionName: 'approve', args: [CONTRACTS.ROUTER as `0x${string}`, maxUint256] }),
            value: '0', accessList: [], authList: [],
          },
        }],
      })

      // Step 3: addLiquidity via Router
      setStatus('adding')
      await requestTxSync({
        messages: [{
          typeUrl: '/minievm.evm.v1.MsgCall',
          value: {
            sender: address,
            contractAddr: CONTRACTS.ROUTER,
            input: encodeFunctionData({
              abi: ROUTER_ABI,
              functionName: 'addLiquidity',
              args: [
                position.tokenAAddr as `0x${string}`,
                position.tokenBAddr as `0x${string}`,
                rawA, rawB, minA, minB,
                hexAddress as `0x${string}`,
                deadline,
              ],
            }),
            value: '0', accessList: [], authList: [],
          },
        }],
      })

      setStatus('done')
      setTimeout(() => { onSuccess(); onClose() }, 1000)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed'
      setErrMsg(msg.includes('user rejected') ? 'Cancelled' : msg)
      setStatus('error')
    }
  }

  const tA = tokenInfo(position.tokenAAddr)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-100">Add Liquidity</p>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex items-center gap-2 bg-gray-800/60 rounded-xl px-3 py-2">
          {tA.token && <TokenIcon token={tA.token} size="sm" />}
          <span className="text-xs text-gray-500">{position.symbolA}/{position.symbolB}</span>
          <span className="text-xs text-gray-600 ml-auto">{position.feeBps / 100}% fee</span>
        </div>

        {/* Amount A */}
        <div className="bg-gray-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-500 uppercase tracking-wide">{position.symbolA}</span>
          </div>
          <input type="number" min="0" placeholder="0.00" value={amtA} onChange={e => handleAmtA(e.target.value)}
            className="w-full bg-transparent text-xl font-semibold text-white focus:outline-none placeholder-gray-700" />
        </div>

        <div className="flex justify-center text-gray-600 text-lg">+</div>

        {/* Amount B */}
        <div className="bg-gray-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-500 uppercase tracking-wide">{position.symbolB}</span>
          </div>
          <input type="number" min="0" placeholder="0.00" value={amtB} onChange={e => handleAmtB(e.target.value)}
            className="w-full bg-transparent text-xl font-semibold text-white focus:outline-none placeholder-gray-700" />
        </div>

        {/* Pool share estimate */}
        {position.reserveA > 0n && amtA && parseFloat(amtA) > 0 && (
          <p className="text-xs text-gray-500 text-center">
            Pool share after adding:{' '}
            <span className="text-gray-300">
              ~{(
                (parseFloat(amtA) /
                  (parseFloat(formatUnits(position.reserveA, position.decimalsA)) + parseFloat(amtA))) * 100
              ).toFixed(4)}%
            </span>
          </p>
        )}

        {errMsg && <p className="text-xs text-red-400 text-center">{errMsg}</p>}

        <button
          type="button"
          onClick={status === 'error' ? () => { setStatus('idle'); setErrMsg(null) } : submit}
          disabled={!amtA || !amtB || status === 'approving' || status === 'adding'}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
            status === 'done'
              ? 'bg-green-900/50 border border-green-800/50 text-green-400'
              : !amtA || !amtB
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-brand-600 hover:bg-brand-500 text-white'
          }`}
        >
          {status === 'approving' ? 'Approving tokens…'
            : status === 'adding' ? 'Adding liquidity…'
            : status === 'done'   ? 'Added!'
            : status === 'error'  ? 'Retry'
            : 'Add Liquidity'}
        </button>
      </div>
    </div>
  )
}

// ── Remove Liquidity Modal ────────────────────────────────────────────────────
function RemoveLiquidityModal({
  position,
  onClose,
  onSuccess,
}: {
  position: Position
  onClose: () => void
  onSuccess: () => void
}) {
  const { address, hexAddress, requestTxSync } = useInterwovenKit()
  const [pct,    setPct]    = useState(50)
  const [status, setStatus] = useState<'idle' | 'approving' | 'removing' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const lpToRemove   = (position.userLp * BigInt(pct)) / 100n
  const amountAOut   = position.totalSupply > 0n
    ? (position.reserveA * lpToRemove) / position.totalSupply
    : 0n
  const amountBOut   = position.totalSupply > 0n
    ? (position.reserveB * lpToRemove) / position.totalSupply
    : 0n

  async function submit() {
    if (!address || !hexAddress || lpToRemove === 0n) return
    setErrMsg(null)
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600)
      const minA = (amountAOut * 95n) / 100n
      const minB = (amountBOut * 95n) / 100n

      // Approve LP token to AMM
      setStatus('approving')
      await requestTxSync({
        messages: [{
          typeUrl: '/minievm.evm.v1.MsgCall',
          value: {
            sender: address,
            contractAddr: position.poolAddress,
            input: encodeFunctionData({ abi: AMM_ABI, functionName: 'approve', args: [position.poolAddress as `0x${string}`, maxUint256] }),
            value: '0', accessList: [], authList: [],
          },
        }],
      })

      // Remove liquidity
      setStatus('removing')
      await requestTxSync({
        messages: [{
          typeUrl: '/minievm.evm.v1.MsgCall',
          value: {
            sender: address,
            contractAddr: position.poolAddress,
            input: encodeFunctionData({
              abi: AMM_ABI,
              functionName: 'removeLiquidity',
              args: [lpToRemove, minA, minB, hexAddress as `0x${string}`, deadline],
            }),
            value: '0', accessList: [], authList: [],
          },
        }],
      })

      setStatus('done')
      setTimeout(() => { onSuccess(); onClose() }, 1000)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed'
      setErrMsg(msg.includes('user rejected') ? 'Cancelled' : msg)
      setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-100">Remove Liquidity</p>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex items-center gap-2 bg-gray-800/60 rounded-xl px-3 py-2">
          <span className="text-xs text-gray-300 font-medium">{position.symbolA}/{position.symbolB}</span>
          <span className="text-xs text-gray-500 ml-auto">
            {formatUnits(position.userLp, 18).slice(0, 10)} LP
          </span>
        </div>

        {/* Percentage slider */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Amount to remove</span>
            <span className="text-gray-200 font-semibold">{pct}%</span>
          </div>
          <input type="range" min={1} max={100} value={pct}
            onChange={e => setPct(Number(e.target.value))}
            className="w-full accent-brand-600" />
          <div className="flex gap-2">
            {[25, 50, 75, 100].map(p => (
              <button key={p} type="button" onClick={() => setPct(p)}
                className={`flex-1 text-xs py-1 rounded-lg transition-colors ${pct === p ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {p === 100 ? 'Max' : `${p}%`}
              </button>
            ))}
          </div>
        </div>

        {/* Expected output */}
        <div className="rounded-xl border border-gray-800 divide-y divide-gray-800/60 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-xs text-gray-500">You receive {position.symbolA}</span>
            <span className="text-xs font-medium text-gray-200">
              {parseFloat(formatUnits(amountAOut, position.decimalsA)).toFixed(6)}
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-xs text-gray-500">You receive {position.symbolB}</span>
            <span className="text-xs font-medium text-gray-200">
              {parseFloat(formatUnits(amountBOut, position.decimalsB)).toFixed(6)}
            </span>
          </div>
        </div>

        {errMsg && <p className="text-xs text-red-400 text-center">{errMsg}</p>}

        <button
          type="button"
          onClick={status === 'error' ? () => { setStatus('idle'); setErrMsg(null) } : submit}
          disabled={lpToRemove === 0n || status === 'approving' || status === 'removing'}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
            status === 'done'
              ? 'bg-green-900/50 border border-green-800/50 text-green-400'
              : 'bg-red-900/60 hover:bg-red-900/80 border border-red-800/50 text-red-300'
          }`}
        >
          {status === 'approving' ? 'Approving…'
            : status === 'removing' ? 'Removing…'
            : status === 'done'     ? 'Removed!'
            : status === 'error'    ? 'Retry'
            : `Remove ${pct}%`}
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function LiquidityPositions() {
  const { hexAddress } = useInterwovenKit()
  const [positions, setPositions] = useState<Position[]>([])
  const [loading,   setLoading]   = useState(true)
  const [refresh,   setRefresh]   = useState(0)
  const [addModal,  setAddModal]  = useState<Position | null>(null)
  const [remModal,  setRemModal]  = useState<Position | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const ids = await client.readContract({
        address: CONTRACTS.POOL_REGISTRY as `0x${string}`,
        abi: POOL_REGISTRY_ABI,
        functionName: 'getAllPoolIds',
      }) as `0x${string}`[]

      type PoolConfig = {
        tokenA: string; tokenB: string; poolAddress: string
        rollupChainId: string; feeRecipient: string; feeBps: bigint; active: boolean
      }

      const configs = await Promise.all(
        ids.map(id => client.readContract({
          address: CONTRACTS.POOL_REGISTRY as `0x${string}`,
          abi: POOL_REGISTRY_ABI,
          functionName: 'get_pool',
          args: [id],
        }))
      ) as PoolConfig[]

      const results = await Promise.all(
        configs.map(async (cfg, i) => {
          const a = tokenInfo(cfg.tokenA)
          const b = tokenInfo(cfg.tokenB)
          const addr = cfg.poolAddress as `0x${string}`

          try {
            const [[rA, rB], supply, userLp] = await Promise.all([
              client.readContract({ address: addr, abi: AMM_ABI, functionName: 'getReserves' }) as Promise<[bigint, bigint]>,
              client.readContract({ address: addr, abi: AMM_ABI, functionName: 'totalSupply' }) as Promise<bigint>,
              hexAddress
                ? client.readContract({ address: addr, abi: AMM_ABI, functionName: 'balanceOf', args: [hexAddress as `0x${string}`] }) as Promise<bigint>
                : Promise.resolve(0n),
            ])

            const sharePercent = supply > 0n ? Number((userLp * 10000n) / supply) / 100 : 0
            const userAmountA  = supply > 0n ? formatUnits((rA * userLp) / supply, a.decimals) : '0'
            const userAmountB  = supply > 0n ? formatUnits((rB * userLp) / supply, b.decimals) : '0'

            return {
              poolId:       ids[i],
              poolAddress:  cfg.poolAddress,
              tokenAAddr:   cfg.tokenA,
              tokenBAddr:   cfg.tokenB,
              symbolA:      a.symbol,
              symbolB:      b.symbol,
              decimalsA:    a.decimals,
              decimalsB:    b.decimals,
              reserveA:     rA,
              reserveB:     rB,
              totalSupply:  supply,
              userLp,
              sharePercent,
              userAmountA,
              userAmountB,
              feeBps:       Number(cfg.feeBps),
            } satisfies Position
          } catch {
            return null
          }
        })
      )

      setPositions(results.filter(Boolean) as Position[])
    } catch {
      // contracts not deployed
    } finally {
      setLoading(false)
    }
  }, [hexAddress])

  useEffect(() => { load() }, [load, refresh])

  const myPositions = positions.filter(p => p.userLp > 0n)
  const allPools    = positions

  return (
    <>
      {addModal && (
        <AddLiquidityModal position={addModal} onClose={() => setAddModal(null)} onSuccess={() => setRefresh(r => r + 1)} />
      )}
      {remModal && (
        <RemoveLiquidityModal position={remModal} onClose={() => setRemModal(null)} onSuccess={() => setRefresh(r => r + 1)} />
      )}

      <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-100">Liquidity</p>
            {myPositions.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                Active in {myPositions.length} pool{myPositions.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <button onClick={() => setRefresh(r => r + 1)}
            className="text-gray-600 hover:text-gray-400 transition-colors p-1.5 rounded-lg hover:bg-gray-800">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : allPools.length === 0 ? (
          <p className="text-center text-sm text-gray-600 py-10">No pools registered yet</p>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {allPools.map(pos => {
              const tA = tokenInfo(pos.tokenAAddr)
              const tB = tokenInfo(pos.tokenBAddr)
              const hasPosition = pos.userLp > 0n
              const tvlA = parseFloat(formatUnits(pos.reserveA, pos.decimalsA))
              const tvlB = parseFloat(formatUnits(pos.reserveB, pos.decimalsB))

              return (
                <div key={pos.poolId} className={`px-4 py-4 ${hasPosition ? 'bg-brand-900/10' : ''}`}>
                  {/* Pool header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center -space-x-1.5">
                      {tA.token && <TokenIcon token={tA.token} size="md" className="ring-2 ring-gray-900 z-10" />}
                      {tB.token && <TokenIcon token={tB.token} size="md" className="ring-2 ring-gray-900" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-100">{pos.symbolA}/{pos.symbolB}</p>
                      <p className="text-[11px] text-gray-600">{pos.feeBps / 100}% fee tier</p>
                    </div>
                    {hasPosition && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-900/50 border border-brand-700/50 text-brand-400">
                        Active
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <StatBox label="Pool TVL">
                      <span className="text-xs font-medium text-gray-200">
                        {tvlA.toLocaleString(undefined, { maximumFractionDigits: 2 })} {pos.symbolA}
                      </span>
                      <span className="text-[10px] text-gray-600 block">
                        / {tvlB.toLocaleString(undefined, { maximumFractionDigits: 2 })} {pos.symbolB}
                      </span>
                    </StatBox>
                    <StatBox label="Your Share">
                      <span className={`text-xs font-semibold ${hasPosition ? 'text-brand-400' : 'text-gray-600'}`}>
                        {pos.sharePercent.toFixed(4)}%
                      </span>
                    </StatBox>
                    <StatBox label="Your Position">
                      {hasPosition ? (
                        <>
                          <span className="text-xs font-medium text-gray-200">
                            {parseFloat(pos.userAmountA).toFixed(4)} {pos.symbolA}
                          </span>
                          <span className="text-[10px] text-gray-600 block">
                            {parseFloat(pos.userAmountB).toFixed(4)} {pos.symbolB}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-600">None</span>
                      )}
                    </StatBox>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAddModal(pos)}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-colors"
                    >
                      Add Liquidity
                    </button>
                    {hasPosition && (
                      <button
                        type="button"
                        onClick={() => setRemModal(pos)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function StatBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800/50 rounded-xl px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-600 mb-1">{label}</p>
      {children}
    </div>
  )
}
