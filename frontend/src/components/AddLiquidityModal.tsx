import { useState, useEffect } from 'react'
import { createPublicClient, http, formatUnits } from 'viem'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { RPC_URL, AMM_ABI } from '../constants'
import { useAddLiquidity } from '../hooks/useAddLiquidity'

const client = createPublicClient({ transport: http(RPC_URL) })

interface Pool {
  id:            string
  tokenASymbol:  string
  tokenBSymbol:  string
  tokenAAddress: string
  tokenBAddress: string
  tokenADecimals: number
  tokenBDecimals: number
  poolAddress:   string
  reserveA?:     string
  reserveB?:     string
}

interface Props {
  pool:    Pool
  onClose: () => void
}

const SLIPPAGE_OPTIONS = [
  { label: '0.1%', bps: 10  },
  { label: '0.5%', bps: 50  },
  { label: '1.0%', bps: 100 },
  { label: '2.0%', bps: 200 },
]

export function AddLiquidityModal({ pool, onClose }: Props) {
  const { address, openWallet } = useInterwovenKit()
  const { addLiquidity, status, txHash, error, reset } = useAddLiquidity()

  const [amountA,     setAmountA]     = useState('')
  const [amountB,     setAmountB]     = useState('')
  const [slippageBps, setSlippageBps] = useState(50)
  const [reserves,    setReserves]    = useState<{ a: string; b: string } | null>(null)
  const [lpShare,     setLpShare]     = useState<string | null>(null)

  // Fetch current reserves + total supply
  useEffect(() => {
    if (!pool.poolAddress || pool.poolAddress === '0x0000000000000000000000000000000000000000') return
    ;(async () => {
      try {
        const [rA, rB, totalSupply] = await Promise.all([
          client.readContract({ address: pool.poolAddress as `0x${string}`, abi: AMM_ABI, functionName: 'getReserves' })
            .then(r => (r as [bigint, bigint])),
          client.readContract({ address: pool.poolAddress as `0x${string}`, abi: AMM_ABI, functionName: 'totalSupply' })
            .then(r => r as bigint),
        ]).then(([[rA, rB], ts]) => [rA, rB, ts] as [bigint, bigint, bigint])
        setReserves({
          a: formatUnits(rA, pool.tokenADecimals),
          b: formatUnits(rB, pool.tokenBDecimals),
        })
        // estimate LP share if user enters amountA
        if (amountA && parseFloat(amountA) > 0 && rA > 0n) {
          const shareOf = (parseFloat(amountA) / (Number(rA) / 10 ** pool.tokenADecimals))
          const lpEst   = shareOf * (Number(totalSupply) / 10 ** 18)
          setLpShare(lpEst.toFixed(6))
        }
      } catch { /* pool not deployed */ }
    })()
  }, [pool.poolAddress, amountA]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-compute token B when A changes (maintain ratio)
  function handleAmountAChange(v: string) {
    setAmountA(v)
    if (!reserves || !v || parseFloat(v) <= 0) { setAmountB(''); return }
    const ratio = parseFloat(reserves.b) / parseFloat(reserves.a)
    if (!isFinite(ratio)) return
    setAmountB((parseFloat(v) * ratio).toFixed(pool.tokenBDecimals > 6 ? 6 : pool.tokenBDecimals))
  }

  function handleAmountBChange(v: string) {
    setAmountB(v)
    if (!reserves || !v || parseFloat(v) <= 0) { setAmountA(''); return }
    const ratio = parseFloat(reserves.a) / parseFloat(reserves.b)
    if (!isFinite(ratio)) return
    setAmountA((parseFloat(v) * ratio).toFixed(pool.tokenADecimals > 6 ? 6 : pool.tokenADecimals))
  }

  async function handleAdd() {
    if (!amountA || !amountB) return
    await addLiquidity(
      pool.tokenAAddress, pool.tokenBAddress,
      amountA, amountB,
      pool.tokenADecimals, pool.tokenBDecimals,
      slippageBps,
    )
  }

  const isLoading  = status === 'approving_a' || status === 'approving_b' || status === 'adding'
  const isSuccess  = status === 'success'

  const statusLabel =
    status === 'approving_a' ? `Approving ${pool.tokenASymbol}...` :
    status === 'approving_b' ? `Approving ${pool.tokenBSymbol}...` :
    status === 'adding'      ? 'Adding liquidity...' :
    status === 'success'     ? 'Added' :
    'Add Liquidity'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-800">
          <div>
            <h3 className="text-sm font-semibold text-gray-100">Add Liquidity</h3>
            <p className="text-xs text-gray-500 mt-0.5">{pool.tokenASymbol} / {pool.tokenBSymbol}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* Pool reserves info */}
          {reserves && (
            <div className="bg-gray-800/50 border border-gray-800 rounded-xl px-4 py-3 space-y-1">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Current Pool Reserves</p>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">{pool.tokenASymbol}</span>
                <span className="text-gray-200 tabular-nums font-medium">
                  {Number(reserves.a).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">{pool.tokenBSymbol}</span>
                <span className="text-gray-200 tabular-nums font-medium">
                  {Number(reserves.b).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </span>
              </div>
              {reserves && parseFloat(reserves.a) > 0 && (
                <div className="flex justify-between text-xs pt-1 border-t border-gray-700 mt-1">
                  <span className="text-gray-600">Rate</span>
                  <span className="text-gray-500">
                    1 {pool.tokenASymbol} = {(parseFloat(reserves.b) / parseFloat(reserves.a)).toFixed(4)} {pool.tokenBSymbol}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Token A input */}
          <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{pool.tokenASymbol} amount</p>
            <input
              type="number"
              min="0"
              placeholder="0.00"
              value={amountA}
              onChange={e => handleAmountAChange(e.target.value)}
              disabled={isLoading || isSuccess}
              className="w-full bg-transparent text-xl font-semibold text-white placeholder-gray-700 focus:outline-none"
            />
          </div>

          {/* Plus separator */}
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
          </div>

          {/* Token B input */}
          <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{pool.tokenBSymbol} amount</p>
            <input
              type="number"
              min="0"
              placeholder="0.00"
              value={amountB}
              onChange={e => handleAmountBChange(e.target.value)}
              disabled={isLoading || isSuccess}
              className="w-full bg-transparent text-xl font-semibold text-white placeholder-gray-700 focus:outline-none"
            />
          </div>

          {/* Slippage */}
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Slippage tolerance</p>
            <div className="flex gap-1.5">
              {SLIPPAGE_OPTIONS.map(o => (
                <button
                  key={o.bps}
                  type="button"
                  onClick={() => setSlippageBps(o.bps)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    slippageBps === o.bps
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-700'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* LP share estimate */}
          {lpShare && amountA && (
            <div className="flex justify-between text-xs px-1">
              <span className="text-gray-500">Est. LP tokens</span>
              <span className="text-gray-300 tabular-nums">{lpShare}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          {/* Success */}
          {isSuccess && (
            <div className="bg-green-950/40 border border-green-800/50 rounded-xl px-4 py-3 text-center space-y-1">
              <p className="text-xs font-medium text-green-400">Liquidity added</p>
              {txHash && (
                <p className="text-[10px] text-gray-500 font-mono">
                  {txHash.slice(0, 12)}...{txHash.slice(-8)}
                </p>
              )}
              <button type="button" onClick={reset} className="text-xs text-brand-400 hover:text-brand-300">
                Add more
              </button>
            </div>
          )}

          {/* Action button */}
          {!address ? (
            <button type="button" onClick={openWallet} className="btn-primary">
              Connect Wallet
            </button>
          ) : !isSuccess && (
            <button
              type="button"
              onClick={status === 'error' ? reset : handleAdd}
              disabled={isLoading || (!amountA && status !== 'error')}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading && (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                  {statusLabel}
                </span>
              )}
              {!isLoading && (status === 'error' ? 'Try again' : statusLabel)}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
