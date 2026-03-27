import { useState, useEffect, useRef } from 'react'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { TokenSelector } from './TokenSelector'
import { SlippageSettings } from './SlippageSettings'
import { useQuote } from '../hooks/useQuote'
import type { ImpactLevel } from '../hooks/useQuote'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { useSwap } from '../hooks/useSwap'
import { type Token, CHAIN_ID } from '../constants'
import { TokenIcon } from './TokenIcon'

// Approximate USD prices for display (fallback when no oracle)
const APPROX_USD: Record<string, number> = {
  USDC: 1,
  USDT: 1,
  INIT: 1.24,
  WBTC: 65000,
  ETH:  3400,
}
function usdValue(amount: string, symbol?: string): string | null {
  if (!amount || !symbol || parseFloat(amount) <= 0) return null
  const price = APPROX_USD[symbol]
  if (!price) return null
  const val = parseFloat(amount) * price
  if (val < 0.01) return null
  return val >= 1000
    ? `~$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : `~$${val.toFixed(2)}`
}

interface SwapUIProps {
  tokenIn?:           Token
  tokenOut?:          Token
  onTokenInChange?:   (t: Token | undefined) => void
  onTokenOutChange?:  (t: Token | undefined) => void
}

export function SwapUI({ tokenIn: extIn, tokenOut: extOut, onTokenInChange, onTokenOutChange }: SwapUIProps = {}) {
  const { address, hexAddress, openWallet } = useInterwovenKit()

  const [tokenInInt,  setTokenInInt]  = useState<Token | undefined>()
  const [tokenOutInt, setTokenOutInt] = useState<Token | undefined>()

  const tokenIn  = extIn  ?? tokenInInt
  const tokenOut = extOut ?? tokenOutInt

  function setTokenIn(t: Token | undefined) { setTokenInInt(t); onTokenInChange?.(t) }
  function setTokenOut(t: Token | undefined) { setTokenOutInt(t); onTokenOutChange?.(t) }

  const [amountIn, setAmountIn] = useState('')
  const [slippage, setSlippage] = useState(50)

  const [balRefreshKey, setBalRefreshKey] = useState(0)
  const { balance: balIn, loading: balLoading } = useTokenBalance(
    tokenIn?.address ?? '', hexAddress, tokenIn?.decimals ?? 18, balRefreshKey,
  )

  const quote = useQuote(
    tokenIn?.address  ?? '', tokenOut?.address ?? '',
    amountIn, tokenIn?.decimals ?? 18, tokenOut?.decimals ?? 18,
  )

  const { executeSwap, status, txHash, error: swapError, reset } = useSwap()

  // Quote staleness
  const [quoteAge, setQuoteAge] = useState(0)
  const ageIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  useEffect(() => {
    clearInterval(ageIntervalRef.current)
    if (!quote.fetchedAt) { setQuoteAge(0); return }
    setQuoteAge(0)
    ageIntervalRef.current = setInterval(() => {
      setQuoteAge(Math.floor((Date.now() - quote.fetchedAt!) / 1000))
    }, 1000)
    return () => clearInterval(ageIntervalRef.current)
  }, [quote.fetchedAt])

  const quoteStale = quoteAge >= 30

  const insufficientBalance = !balLoading && !!tokenIn && !!amountIn
    && parseFloat(amountIn) > 0
    && parseFloat(amountIn) > parseFloat(balIn)

  const minAmountOut = quote.amountOutRaw > 0n
    ? (quote.amountOutRaw * (10000n - BigInt(slippage))) / 10000n
    : 0n

  const exchangeRate = quote.amountOut && amountIn && parseFloat(amountIn) > 0
    ? (parseFloat(quote.amountOut) / parseFloat(amountIn))
    : null

  const feeAmt = amountIn && parseFloat(amountIn) > 0
    ? (parseFloat(amountIn) * 0.0025).toFixed(6)
    : null

  function flipTokens() {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    setAmountIn(quote.amountOut ?? '')
    reset()
  }

  async function handleSwap() {
    if (!tokenIn || !tokenOut || !amountIn || quote.amountOutRaw === 0n) return
    await executeSwap(tokenIn.address, tokenOut.address, amountIn, minAmountOut, tokenIn.decimals)
    setBalRefreshKey(k => k + 1)
  }

  const isLoading = status === 'approving' || status === 'swapping'
  const canSwap =
    !!address && !!tokenIn && !!tokenOut && !!amountIn &&
    parseFloat(amountIn) > 0 && quote.amountOutRaw > 0n &&
    !isLoading && !insufficientBalance && status !== 'success'

  const impactColor =
    quote.impactLevel === 'high'   ? 'text-red-400' :
    quote.impactLevel === 'medium' ? 'text-yellow-400' :
    'text-gray-300'

  const isCrossRollup = quote.poolChainId && quote.poolChainId !== CHAIN_ID && quote.poolChainId !== ''

  return (
    <div className="space-y-2">

      {/* ── Main swap card ─────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <span className="text-sm font-semibold text-gray-100">Swap</span>
          <SlippageSettings
            slippage={slippage}
            onChange={v => { setSlippage(v); reset() }}
            impactLevel={quote.impactLevel}
            impactPct={quote.priceImpact !== '0.00' ? quote.priceImpact : undefined}
          />
        </div>

        {/* Pay box */}
        <div className="mx-3 rounded-xl bg-gray-800/70 border border-gray-700/50 px-4 pt-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Pay</p>
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={amountIn}
                onChange={e => { setAmountIn(e.target.value); reset() }}
                className="w-full bg-transparent text-[26px] font-semibold focus:outline-none placeholder-gray-700 text-white leading-tight"
              />
              <p className="text-xs text-gray-600 mt-1 h-4">
                {usdValue(amountIn, tokenIn?.symbol) ?? ''}
              </p>
            </div>
            <div className="pt-1 shrink-0 flex flex-col items-end gap-2">
              {tokenIn && (
                <div className="flex items-center gap-2 mb-1">
                  <TokenIcon token={tokenIn} size="xl" className="ring-2 ring-gray-700/60 shadow-lg" />
                </div>
              )}
              <TokenSelector label="From" selected={tokenIn} onChange={t => { setTokenIn(t); reset() }} exclude={tokenOut?.address} />
              {tokenIn && hexAddress && (
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-[11px] text-gray-600">
                    {balLoading ? '…' : Number(balIn).toFixed(4)}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setAmountIn(balIn); reset() }}
                    className="text-[10px] font-semibold text-brand-500 hover:text-brand-400 bg-brand-900/30 hover:bg-brand-900/50 px-1.5 py-0.5 rounded transition-colors"
                  >
                    MAX
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Flip button */}
        <div className="flex justify-center -my-0.5 relative z-10">
          <button
            type="button"
            onClick={flipTokens}
            className="bg-gray-900 border-2 border-gray-800 rounded-xl p-2 hover:bg-gray-800 hover:border-gray-700 transition-all hover:scale-110 active:scale-95"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* Receive box */}
        <div className="mx-3 rounded-xl bg-gray-800/40 border border-gray-700/30 px-4 pt-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Receive</p>
              <p className="text-[26px] font-semibold leading-tight text-white min-h-[34px]">
                {quote.loading
                  ? <span className="text-gray-600 animate-pulse text-2xl">…</span>
                  : quote.amountOut
                    ? <span className="text-green-400">{Number(quote.amountOut).toFixed(6)}</span>
                    : <span className="text-gray-700">0.00</span>
                }
              </p>
              <p className="text-xs text-gray-600 mt-1 h-4">
                {quote.amountOut ? usdValue(quote.amountOut, tokenOut?.symbol) ?? '' : ''}
              </p>
            </div>
            <div className="pt-1 shrink-0 flex flex-col items-end gap-2">
              {tokenOut && (
                <div className="flex items-center gap-2 mb-1">
                  <TokenIcon token={tokenOut} size="xl" className="ring-2 ring-gray-700/60 shadow-lg" />
                </div>
              )}
              <TokenSelector label="To" selected={tokenOut} onChange={t => { setTokenOut(t); reset() }} exclude={tokenIn?.address} />
            </div>
          </div>
        </div>

        {/* Info rows */}
        <div className="mx-3 mt-2 mb-3 rounded-xl border border-gray-800 divide-y divide-gray-800/60 overflow-hidden">

          {/* Rate */}
          <InfoRow
            label="Rate"
            value={
              exchangeRate !== null && tokenIn && tokenOut
                ? `1 ${tokenIn.symbol} = ${exchangeRate.toFixed(exchangeRate < 0.001 ? 8 : 4)} ${tokenOut.symbol}`
                : '—'
            }
          />

          {/* Price impact */}
          <InfoRow
            label="Price Impact"
            value={quote.amountOut && !quote.error ? `${quote.priceImpact}%` : '—'}
            valueClassName={quote.amountOut ? impactColor : ''}
          />

          {/* Fee */}
          <InfoRow
            label="Fee (0.25%)"
            value={feeAmt && tokenIn ? `${feeAmt} ${tokenIn.symbol}` : '—'}
          />

          {/* Route */}
          <div className="flex items-center justify-between px-3 py-2.5">
            <span className="text-xs text-gray-500">Route</span>
            {tokenIn && tokenOut ? (
              isCrossRollup ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-purple-400">
                  {tokenIn.symbol}
                  <span className="text-purple-600 mx-0.5">→</span>
                  <span className="bg-purple-900/40 border border-purple-700/40 rounded px-1.5 py-0.5 text-[10px]">Bridge</span>
                  <span className="text-purple-600 mx-0.5">→</span>
                  {tokenOut.symbol}
                  <span className="text-purple-700 ml-1">~5s</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-medium text-green-400">
                  {tokenIn.symbol}
                  <span className="text-gray-600 mx-0.5">→</span>
                  {tokenOut.symbol}
                  <span className="text-gray-600 ml-1">⚡ Direct</span>
                </span>
              )
            ) : (
              <span className="text-xs text-gray-600">—</span>
            )}
          </div>

          {/* Min received */}
          <InfoRow
            label="Min. Received"
            value={
              quote.amountOut && tokenOut
                ? `${(Number(quote.amountOut) * (1 - slippage / 10000)).toFixed(6)} ${tokenOut.symbol}`
                : '—'
            }
          />
        </div>

        {/* Warnings */}
        {quote.impactLevel === 'high' && quote.amountOut && (
          <div className="mx-3 mb-3 bg-red-950/50 border border-red-800/50 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <span className="text-red-400 text-base leading-none">⚠</span>
            <p className="text-xs text-red-300">
              <span className="font-semibold">High price impact ({quote.priceImpact}%)</span> — consider a smaller trade.
            </p>
          </div>
        )}

        {quoteStale && (
          <div className="mx-3 mb-3 border border-gray-700/60 rounded-xl px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">Quote is {quoteAge}s old</span>
            <button type="button" onClick={() => { quote.refresh(); reset() }}
              className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Refresh
            </button>
          </div>
        )}

        {(quote.error || swapError) && (
          <p className="mx-3 mb-3 text-xs text-red-400 text-center">{quote.error || swapError}</p>
        )}

        {/* Swap button */}
        <div className="px-3 pb-4">
          {!address ? (
            <button type="button" onClick={openWallet}
              className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-brand-900/50 active:scale-[0.98]">
              Connect Wallet
            </button>
          ) : (
            <button
              type="button"
              onClick={
                quoteStale ? () => { quote.refresh(); reset() }
                : status === 'error' ? reset
                : handleSwap
              }
              disabled={quoteStale ? false : status === 'error' ? false : !canSwap}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] ${
                insufficientBalance
                  ? 'bg-red-900/50 border border-red-800/60 text-red-400 cursor-not-allowed'
                  : status === 'success'
                  ? 'bg-green-900/50 border border-green-800/60 text-green-400'
                  : canSwap || quoteStale || status === 'error'
                  ? 'bg-brand-600 hover:bg-brand-500 text-white hover:shadow-lg hover:shadow-brand-900/50'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/50'
              }`}
            >
              {status === 'approving'    ? '⏳ Approving…'
                : status === 'swapping' ? '⏳ Swapping…'
                : status === 'success'  ? '✓ Swap again'
                : status === 'error'    ? 'Retry'
                : !tokenIn || !tokenOut ? 'Select tokens'
                : !amountIn            ? 'Enter an amount'
                : insufficientBalance  ? `Insufficient ${tokenIn.symbol}`
                : quote.loading        ? 'Getting quote…'
                : quoteStale           ? 'Refresh quote'
                : 'Swap'}
            </button>
          )}
        </div>

        {/* Tx hash */}
        {txHash && (
          <div className="flex items-center justify-center gap-2 pb-4 -mt-2">
            <span className="text-xs text-green-500 font-mono">{txHash.slice(0, 10)}…{txHash.slice(-8)}</span>
            <button type="button"
              onClick={() => navigator.clipboard?.writeText(txHash).catch(() => {})}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors bg-gray-800 px-2 py-0.5 rounded">
              Copy
            </button>
          </div>
        )}
      </div>

      {/* ── Order & Account panel ───────────────────────────────── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-gray-800">
          {/* Order */}
          <div className="px-4 py-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2.5">Order</p>
            <StatRow label="Available"
              value={hexAddress && tokenIn ? (balLoading ? '…' : `${Number(balIn).toFixed(4)} ${tokenIn.symbol}`) : '—'} />
            <StatRow label="Order Value"
              value={amountIn && parseFloat(amountIn) > 0 && tokenIn ? `${parseFloat(amountIn).toFixed(4)} ${tokenIn.symbol}` : '—'} />
            <StatRow label="Fees"
              value={feeAmt && tokenIn ? `${feeAmt} ${tokenIn.symbol}` : '—'} />
            <StatRow label="Margin Required" value="$0.00" />
            <StatRow label="Liquidation Price" value="None" dim />
          </div>
          {/* Account */}
          <div className="px-4 py-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2.5">Account</p>
            <StatRow label="Position" value="0" />
            <StatRow label="Account Health" value="100.0%" valueClassName="text-brand-400" />
            <StatRow label="Total Collateral" value="None" dim />
            <StatRow label="Maint. Margin" value="None" dim />
            <StatRow label="Leverage" value="0×" />
            <StatRow label="Cross Positions" value="—" dim />
          </div>
        </div>
      </div>

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ label, value, valueClassName = '' }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-medium text-gray-300 ${valueClassName}`}>{value}</span>
    </div>
  )
}

function StatRow({
  label, value, dim = false, valueClassName = '',
}: { label: string; value: string; dim?: boolean; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-gray-600">{label}</span>
      <span className={`text-[11px] font-medium ${dim ? 'text-gray-700' : 'text-gray-400'} ${valueClassName}`}>
        {value}
      </span>
    </div>
  )
}

function ImpactRow({ impact, level }: { impact: string; level: ImpactLevel }) {
  const color = level === 'high' ? 'text-red-400' : level === 'medium' ? 'text-yellow-400' : 'text-gray-300'
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">Price impact</span>
      <span className={`text-xs font-medium ${color}`}>{impact}%</span>
    </div>
  )
}

// Keep exported for potential external use
export { ImpactRow }
