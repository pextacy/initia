import { useState, useEffect } from 'react'
import { createPublicClient, http, formatUnits } from 'viem'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { RPC_URL, CONTRACTS, ROUTER_EVENTS_ABI, TOKENS } from '../constants'

const client = createPublicClient({ transport: http(RPC_URL) })

function tokenSymbol(address: string) {
  return TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase())?.symbol
    ?? address.slice(0, 6) + '…'
}
function tokenDecimals(address: string) {
  return TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase())?.decimals ?? 18
}
function tokenColor(address: string) {
  return TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase())?.color ?? 'bg-gray-600'
}

interface SwapTx {
  txHash:    string
  blockNumber: bigint
  tokenIn:   string
  tokenOut:  string
  amountIn:  bigint
  amountOut: bigint
}

export function TxHistory() {
  const { hexAddress } = useInterwovenKit()
  const [txs,     setTxs]     = useState<SwapTx[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!hexAddress) return
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
          setTxs(
            logs.reverse().slice(0, 20).map(log => ({
              txHash:      log.transactionHash ?? '',
              blockNumber: log.blockNumber ?? 0n,
              tokenIn:     (log.args as { tokenIn: string }).tokenIn,
              tokenOut:    (log.args as { tokenOut: string }).tokenOut,
              amountIn:    (log.args as { amountIn: bigint }).amountIn,
              amountOut:   (log.args as { amountOut: bigint }).amountOut,
            }))
          )
        }
      } catch {
        // no data
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [hexAddress])

  if (!hexAddress) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6 text-center">
        <p className="text-sm text-gray-500">Connect wallet to see your swap history</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-gray-800 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-200">Swap History</p>
        {!loading && txs.length > 0 && (
          <span className="text-xs text-gray-600">{txs.length} swap{txs.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : txs.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-gray-600">No swaps yet</p>
          <p className="text-xs text-gray-700 mt-1">Your swap history will appear here</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-800/60">
          {txs.map((tx, i) => {
            const inSym  = tokenSymbol(tx.tokenIn)
            const outSym = tokenSymbol(tx.tokenOut)
            const inAmt  = parseFloat(formatUnits(tx.amountIn,  tokenDecimals(tx.tokenIn))).toFixed(4)
            const outAmt = parseFloat(formatUnits(tx.amountOut, tokenDecimals(tx.tokenOut))).toFixed(4)
            const inCol  = tokenColor(tx.tokenIn)
            const outCol = tokenColor(tx.tokenOut)

            return (
              <div key={`${tx.txHash}-${i}`} className="px-4 py-3 flex items-center gap-3">
                {/* Arrow icon */}
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>

                {/* Pair */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 rounded-full ${inCol} flex items-center justify-center text-[8px] font-bold text-white`}>
                      {inSym[0]}
                    </span>
                    <span className="text-xs font-semibold text-gray-200">{inSym}</span>
                    <span className="text-gray-600">→</span>
                    <span className={`w-4 h-4 rounded-full ${outCol} flex items-center justify-center text-[8px] font-bold text-white`}>
                      {outSym[0]}
                    </span>
                    <span className="text-xs font-semibold text-gray-200">{outSym}</span>
                  </div>
                  <p className="font-mono text-[10px] text-gray-600 mt-0.5">
                    {tx.txHash ? `${tx.txHash.slice(0, 8)}…${tx.txHash.slice(-6)}` : `Block #${tx.blockNumber}`}
                  </p>
                </div>

                {/* Amounts */}
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-300">
                    <span className="text-red-400">-{inAmt}</span> {inSym}
                  </p>
                  <p className="text-xs font-medium text-green-400">
                    +{outAmt} {outSym}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
