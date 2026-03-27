import { useState, useEffect, useRef, useCallback } from 'react'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { TokenSelector }    from './TokenSelector'
import { SlippageSettings } from './SlippageSettings'
import { TokenIcon }        from './TokenIcon'
import { useQuote }         from '../hooks/useQuote'
import { useTokenBalance }  from '../hooks/useTokenBalance'
import { useSwap }          from '../hooks/useSwap'
import { usePendingOrders, getBybitInfo } from '../hooks/usePendingOrders'
import { type Token, CHAIN_ID } from '../constants'

// ── Order types ────────────────────────────────────────────────────────────────
type AllOrderType = 'market' | 'limit' | 'stop_market' | 'tp_market' | 'tp_limit' | 'oracle_limit' | 'scale'
type Side = 'long' | 'short'

const ORDER_LABELS: Record<AllOrderType, string> = {
  market:       'Market',
  limit:        'Limit',
  stop_market:  'Stop',
  tp_market:    'TP·Mkt',
  tp_limit:     'TP·Lmt',
  oracle_limit: 'Oracle',
  scale:        'Scale',
}

// ── USD price estimate ─────────────────────────────────────────────────────────
const APPROX_USD: Record<string, number> = {
  USDC: 1, USDT: 1, INIT: 1.24, WBTC: 65000, ETH: 3400,
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

// ── Props ──────────────────────────────────────────────────────────────────────
interface SwapUIProps {
  tokenIn?:          Token
  tokenOut?:         Token
  onTokenInChange?:  (t: Token | undefined) => void
  onTokenOutChange?: (t: Token | undefined) => void
}

// ── Component ──────────────────────────────────────────────────────────────────
export function SwapUI({
  tokenIn: extIn, tokenOut: extOut, onTokenInChange, onTokenOutChange,
}: SwapUIProps = {}) {
  const { address, hexAddress, openWallet } = useInterwovenKit()

  // Internal token state (syncs with external)
  const [tokenInInt,  setTokenInInt]  = useState<Token | undefined>()
  const [tokenOutInt, setTokenOutInt] = useState<Token | undefined>()
  const tokenIn  = extIn  ?? tokenInInt
  const tokenOut = extOut ?? tokenOutInt
  function setTokenIn(t: Token | undefined)  { setTokenInInt(t);  onTokenInChange?.(t)  }
  function setTokenOut(t: Token | undefined) { setTokenOutInt(t); onTokenOutChange?.(t) }

  // ── Trade direction & order type ────────────────────────────────────────────
  const [side,      setSide]      = useState<Side>('long')
  const [orderType, setOrderType] = useState<AllOrderType>('market')

  // For Long: payToken=tokenIn, receiveToken=tokenOut
  // For Short: payToken=tokenOut, receiveToken=tokenIn
  const payToken     = side === 'long' ? tokenIn  : tokenOut
  const receiveToken = side === 'long' ? tokenOut : tokenIn

  // ── Amounts & slider ────────────────────────────────────────────────────────
  const [amountIn,   setAmountIn]   = useState('')
  const [slippage,   setSlippage]   = useState(50)
  const [sliderPct,  setSliderPct]  = useState(0)

  // Order-type-specific inputs
  const [limitPrice,    setLimitPrice]    = useState('')  // limit / oracle_limit
  const [triggerPrice,  setTriggerPrice]  = useState('')  // stop_market
  const [tpPrice,       setTpPrice]       = useState('')  // tp_market, tp_limit
  const [tpLimitPrice,  setTpLimitPrice]  = useState('')  // tp_limit only
  const [scaleFrom,     setScaleFrom]     = useState('')
  const [scaleTo,       setScaleTo]       = useState('')
  const [scaleCount,    setScaleCount]    = useState('5')

  const [balRefreshKey, setBalRefreshKey] = useState(0)
  const { balance: balIn, loading: balLoading } = useTokenBalance(
    payToken?.address ?? '', hexAddress, payToken?.decimals ?? 18, balRefreshKey,
  )

  // Quote uses actual tokenIn/tokenOut addresses (long or flipped for short)
  const quoteTokenIn  = side === 'long' ? (tokenIn?.address  ?? '') : (tokenOut?.address ?? '')
  const quoteTokenOut = side === 'long' ? (tokenOut?.address ?? '') : (tokenIn?.address  ?? '')

  const quote = useQuote(
    quoteTokenIn, quoteTokenOut,
    amountIn, payToken?.decimals ?? 18, receiveToken?.decimals ?? 18,
  )

  const { executeSwap, status, txHash, error: swapError, reset } = useSwap()
  const { addOrder, triggeredOrders, markTriggered, markExecuted } = usePendingOrders()

  // ── Auto-execute triggered orders ──────────────────────────────────────────
  useEffect(() => {
    if (!hexAddress || triggeredOrders.length === 0) return
    triggeredOrders.forEach(async o => {
      markTriggered(o.id)
      try {
        const minOut = 0n  // user accepted slippage when creating order
        await executeSwap(o.tokenInAddress, o.tokenOutAddress, o.amountIn, minOut, o.decimalsIn)
        markExecuted(o.id)
      } catch {}
    })
  }, [triggeredOrders.length])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Quote staleness ────────────────────────────────────────────────────────
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

  // ── Derived values ─────────────────────────────────────────────────────────
  const insufficientBalance = !balLoading && !!payToken && !!amountIn
    && parseFloat(amountIn) > 0
    && parseFloat(amountIn) > parseFloat(balIn)

  const minAmountOut = quote.amountOutRaw > 0n
    ? (quote.amountOutRaw * (10000n - BigInt(slippage))) / 10000n
    : 0n

  const exchangeRate = quote.amountOut && amountIn && parseFloat(amountIn) > 0
    ? parseFloat(quote.amountOut) / parseFloat(amountIn)
    : null

  const feeAmt = amountIn && parseFloat(amountIn) > 0
    ? (parseFloat(amountIn) * 0.0025).toFixed(6)
    : null

  const isCrossRollup = quote.poolChainId && quote.poolChainId !== CHAIN_ID && quote.poolChainId !== ''

  const impactColor =
    quote.impactLevel === 'high'   ? 'text-red-400' :
    quote.impactLevel === 'medium' ? 'text-yellow-400' :
    'text-gray-300'

  // ── Slider <-> amount sync ─────────────────────────────────────────────────
  const handleAmountChange = useCallback((val: string) => {
    setAmountIn(val)
    reset()
    const bal = parseFloat(balIn)
    if (bal > 0 && parseFloat(val) > 0) {
      setSliderPct(Math.min(100, (parseFloat(val) / bal) * 100))
    } else {
      setSliderPct(0)
    }
  }, [balIn, reset])

  const handleSlider = useCallback((pct: number) => {
    setSliderPct(pct)
    const bal = parseFloat(balIn)
    if (bal > 0) {
      const decimals = payToken?.decimals ?? 18
      const val = (bal * pct / 100).toFixed(Math.min(decimals, 6))
      setAmountIn(val)
      reset()
    }
  }, [balIn, payToken, reset])

  // Update slider when balance loads
  useEffect(() => {
    if (!amountIn || !balIn) return
    const bal = parseFloat(balIn)
    if (bal > 0) setSliderPct(Math.min(100, (parseFloat(amountIn) / bal) * 100))
  }, [balIn])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flip tokens ────────────────────────────────────────────────────────────
  function flipTokens() {
    const prevIn = tokenIn, prevOut = tokenOut
    setTokenIn(prevOut)
    setTokenOut(prevIn)
    setAmountIn(quote.amountOut ?? '')
    setSliderPct(0)
    reset()
  }

  // ── Place order (non-market) ───────────────────────────────────────────────
  function placeConditionalOrder() {
    if (!payToken || !receiveToken || !amountIn) return
    const bybitInfo = getBybitInfo(
      side === 'long' ? (tokenIn?.symbol ?? '') : (tokenOut?.symbol ?? ''),
      side === 'long' ? (tokenOut?.symbol ?? '') : (tokenIn?.symbol ?? ''),
    )
    if (!bybitInfo) return

    const baseOrder = {
      side,
      tokenInAddress:  side === 'long' ? (tokenIn?.address  ?? '') : (tokenOut?.address ?? ''),
      tokenOutAddress: side === 'long' ? (tokenOut?.address ?? '') : (tokenIn?.address  ?? ''),
      tokenInSymbol:   side === 'long' ? (tokenIn?.symbol   ?? '') : (tokenOut?.symbol  ?? ''),
      tokenOutSymbol:  side === 'long' ? (tokenOut?.symbol  ?? '') : (tokenIn?.symbol   ?? ''),
      amountIn,
      decimalsIn:   payToken.decimals,
      slippageBps:  slippage,
      bybitSymbol:  bybitInfo.symbol,
      bybitInvert:  bybitInfo.invert,
    }

    if (orderType === 'limit' || orderType === 'oracle_limit') {
      if (!limitPrice || parseFloat(limitPrice) <= 0) return
      addOrder({ ...baseOrder, type: orderType === 'oracle_limit' ? 'oracle_limit' : 'limit', triggerPrice: parseFloat(limitPrice) })
    } else if (orderType === 'stop_market') {
      if (!triggerPrice || parseFloat(triggerPrice) <= 0) return
      addOrder({ ...baseOrder, type: 'stop_market', triggerPrice: parseFloat(triggerPrice) })
    } else if (orderType === 'tp_market') {
      if (!tpPrice || parseFloat(tpPrice) <= 0) return
      addOrder({ ...baseOrder, type: 'tp_market', triggerPrice: parseFloat(tpPrice) })
    } else if (orderType === 'tp_limit') {
      if (!tpPrice || parseFloat(tpPrice) <= 0) return
      addOrder({ ...baseOrder, type: 'tp_limit', triggerPrice: parseFloat(tpPrice), limitPrice: parseFloat(tpLimitPrice) || parseFloat(tpPrice) })
    }
    setAmountIn('')
    setLimitPrice(''); setTriggerPrice(''); setTpPrice(''); setTpLimitPrice('')
    setSliderPct(0)
  }

  // ── Scale order (N market orders split evenly) ────────────────────────────
  async function executeScaleOrders() {
    if (!payToken || !receiveToken || !amountIn) return
    const n = Math.max(2, Math.min(10, parseInt(scaleCount) || 5))
    const chunk = (parseFloat(amountIn) / n).toFixed(payToken.decimals <= 6 ? payToken.decimals : 6)
    const chunkBig = quote.amountOutRaw > 0n ? (quote.amountOutRaw / BigInt(n) * (10000n - BigInt(slippage))) / 10000n : 0n
    for (let i = 0; i < n; i++) {
      await executeSwap(quoteTokenIn, quoteTokenOut, chunk, chunkBig, payToken.decimals)
    }
    setBalRefreshKey(k => k + 1)
  }

  // ── Market swap ────────────────────────────────────────────────────────────
  async function handleMarketSwap() {
    if (!payToken || !receiveToken || !amountIn || quote.amountOutRaw === 0n) return
    await executeSwap(quoteTokenIn, quoteTokenOut, amountIn, minAmountOut, payToken.decimals)
    setBalRefreshKey(k => k + 1)
  }

  // ── Button state ──────────────────────────────────────────────────────────
  const isLoading = status === 'approving' || status === 'swapping'

  const canMarket = !!address && !!payToken && !!receiveToken && !!amountIn
    && parseFloat(amountIn) > 0 && quote.amountOutRaw > 0n
    && !isLoading && !insufficientBalance && status !== 'success'

  const canConditional = !!address && !!payToken && !!receiveToken && !!amountIn
    && parseFloat(amountIn) > 0 && !insufficientBalance
    && getBybitInfo(
        side === 'long' ? (tokenIn?.symbol ?? '') : (tokenOut?.symbol ?? ''),
        side === 'long' ? (tokenOut?.symbol ?? '') : (tokenIn?.symbol ?? ''),
       ) !== null

  function buttonLabel(): string {
    if (!address)                          return 'Connect Wallet'
    if (status === 'approving')            return 'Approving…'
    if (status === 'swapping')             return 'Executing…'
    if (status === 'success')              return `${side === 'long' ? 'Long' : 'Short'} again`
    if (!payToken || !receiveToken)        return 'Select tokens'
    if (!amountIn)                         return 'Enter amount'
    if (insufficientBalance)               return `Insufficient ${payToken.symbol}`
    if (orderType === 'scale')             return `Place ${scaleCount || 5} Scale Orders`
    if (orderType !== 'market') {
      if (!getBybitInfo(
          side === 'long' ? (tokenIn?.symbol ?? '') : (tokenOut?.symbol ?? ''),
          side === 'long' ? (tokenOut?.symbol ?? '') : (tokenIn?.symbol ?? ''),
        ))                                 return 'Pair not on Bybit — use Market'
      return `Place ${ORDER_LABELS[orderType]} Order`
    }
    if (quote.loading)                     return 'Getting quote…'
    if (quoteStale)                        return 'Refresh quote'
    return side === 'long'
      ? `Buy ${receiveToken.symbol}`
      : `Sell ${payToken.symbol}`
  }

  function handleAction() {
    if (!address) { openWallet(); return }
    if (quoteStale && orderType === 'market') { quote.refresh(); reset(); return }
    if (status === 'error') { reset(); return }
    if (orderType === 'market') { handleMarketSwap(); return }
    if (orderType === 'scale')  { executeScaleOrders(); return }
    placeConditionalOrder()
  }

  const btnEnabled = (() => {
    if (!address) return true
    if (status === 'error') return true
    if (quoteStale && orderType === 'market') return true
    if (orderType === 'market') return canMarket
    if (orderType === 'scale')  return canMarket
    return canConditional
  })()

  const btnClass = (() => {
    if (insufficientBalance) return 'bg-red-900/50 border border-red-800/60 text-red-400 cursor-not-allowed'
    if (status === 'success') return 'bg-green-900/50 border border-green-800/60 text-green-400'
    if (btnEnabled) return side === 'long'
      ? 'bg-green-700 hover:bg-green-600 text-white hover:shadow-lg hover:shadow-green-900/40'
      : 'bg-red-700 hover:bg-red-600 text-white hover:shadow-lg hover:shadow-red-900/40'
    return 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/50'
  })()

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="space-y-2 p-3">

        {/* ── Long / Short toggle + slippage ─────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex bg-gray-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => { setSide('long'); reset() }}
              className={`px-5 py-1.5 rounded-md text-sm font-semibold transition-all ${
                side === 'long' ? 'bg-green-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >Long</button>
            <button
              type="button"
              onClick={() => { setSide('short'); reset() }}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                side === 'short' ? 'bg-red-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >Short</button>
          </div>
          <SlippageSettings
            slippage={slippage}
            onChange={v => { setSlippage(v); reset() }}
            impactLevel={quote.impactLevel}
            impactPct={quote.priceImpact !== '0.00' ? quote.priceImpact : undefined}
          />
        </div>

        {/* ── Order type row ──────────────────────────────────────────── */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-hide">
          {(Object.keys(ORDER_LABELS) as AllOrderType[]).map(ot => (
            <button
              key={ot}
              type="button"
              onClick={() => { setOrderType(ot); reset() }}
              className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                orderType === ot
                  ? 'bg-gray-700 text-gray-100 border border-gray-600'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
            >
              {ORDER_LABELS[ot]}
            </button>
          ))}
        </div>

        {/* ── Token pair selectors ────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <TokenSelector label={side === 'long' ? 'Base' : 'Quote'} selected={tokenIn} onChange={t => { setTokenIn(t); reset() }} exclude={tokenOut?.address} />
          </div>
          <button type="button" onClick={flipTokens}
            className="w-7 h-7 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center hover:bg-gray-700 transition-all hover:scale-110 active:scale-95 shrink-0">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4M4 17h12m0 0l-4-4m4 4l-4-4" />
            </svg>
          </button>
          <div className="flex-1">
            <TokenSelector label={side === 'long' ? 'Quote' : 'Base'} selected={tokenOut} onChange={t => { setTokenOut(t); reset() }} exclude={tokenIn?.address} />
          </div>
        </div>

        {/* ── Amount input ────────────────────────────────────────────── */}
        <div className="rounded-xl bg-gray-800/70 border border-gray-700/50 px-3 pt-2.5 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <input
                type="number"
                min="0"
                placeholder="0.00"
                value={amountIn}
                onChange={e => handleAmountChange(e.target.value)}
                className="w-full bg-transparent text-xl font-semibold focus:outline-none placeholder-gray-700 text-white leading-tight"
              />
              <p className="text-[10px] text-gray-600 mt-0.5 h-3.5">
                {usdValue(amountIn, payToken?.symbol) ?? ''}
              </p>
            </div>
            {payToken && (
              <div className="flex items-center gap-1.5 shrink-0">
                <TokenIcon token={payToken} size="sm" />
                <span className="text-sm font-semibold text-gray-200">{payToken.symbol}</span>
              </div>
            )}
          </div>

          {/* Balance row */}
          {payToken && hexAddress && (
            <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-gray-700/40">
              <span className="text-[10px] text-gray-600">
                Balance: {balLoading ? '…' : Number(balIn).toFixed(4)} {payToken.symbol}
              </span>
              <div className="flex items-center gap-1">
                {[25, 50, 75].map(pct => (
                  <button key={pct} type="button"
                    onClick={() => handleSlider(pct)}
                    className="text-[9px] font-semibold text-gray-600 hover:text-brand-400 bg-gray-700/50 hover:bg-gray-700 px-1.5 py-0.5 rounded transition-colors">
                    {pct}%
                  </button>
                ))}
                <button type="button"
                  onClick={() => handleSlider(100)}
                  className="text-[9px] font-semibold text-brand-500 hover:text-brand-400 bg-brand-900/30 hover:bg-brand-900/50 px-1.5 py-0.5 rounded transition-colors">
                  MAX
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Balance slider ──────────────────────────────────────────── */}
        <div className="rounded-xl bg-gray-800/50 border border-gray-700/40 px-3 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Amount</span>
            <span className={`text-xs font-bold tabular-nums ${hexAddress ? 'text-brand-400' : 'text-gray-600'}`}>
              {Math.round(sliderPct)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            disabled={!hexAddress || !payToken}
            value={Math.round(sliderPct)}
            onChange={e => handleSlider(Number(e.target.value))}
            className="w-full appearance-none cursor-pointer disabled:cursor-not-allowed"
            style={{
              height: '6px',
              borderRadius: '3px',
              outline: 'none',
              background: hexAddress && payToken
                ? `linear-gradient(to right, #14b8a6 0%, #14b8a6 ${Math.round(sliderPct)}%, #374151 ${Math.round(sliderPct)}%, #374151 100%)`
                : '#1f2937',
              WebkitAppearance: 'none',
            }}
          />
          <div className="flex justify-between mt-1.5">
            {[0, 25, 50, 75, 100].map(p => (
              <button
                key={p}
                type="button"
                disabled={!hexAddress || !payToken}
                onClick={() => handleSlider(p)}
                className={`text-[10px] font-semibold transition-colors disabled:cursor-not-allowed ${
                  Math.round(sliderPct) === p
                    ? 'text-brand-400'
                    : 'text-gray-600 hover:text-gray-400 disabled:text-gray-800'
                }`}
              >
                {p === 100 ? 'MAX' : `${p}%`}
              </button>
            ))}
          </div>
        </div>

        {/* ── Order-type-specific inputs ───────────────────────────────── */}
        {(orderType === 'limit' || orderType === 'oracle_limit') && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">
              {orderType === 'oracle_limit' ? 'Oracle Limit Price' : 'Limit Price'} ({receiveToken?.symbol ?? '—'} per {payToken?.symbol ?? '—'})
            </label>
            <input
              type="number" min="0" placeholder="0.00"
              value={limitPrice}
              onChange={e => setLimitPrice(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-600"
            />
          </div>
        )}

        {orderType === 'stop_market' && (
          <div>
            <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">
              Trigger Price ({receiveToken?.symbol ?? '—'} per {payToken?.symbol ?? '—'})
            </label>
            <input
              type="number" min="0" placeholder="0.00"
              value={triggerPrice}
              onChange={e => setTriggerPrice(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-600"
            />
          </div>
        )}

        {(orderType === 'tp_market' || orderType === 'tp_limit') && (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">
                Take Profit Price ({receiveToken?.symbol ?? '—'} per {payToken?.symbol ?? '—'})
              </label>
              <input
                type="number" min="0" placeholder="0.00"
                value={tpPrice}
                onChange={e => setTpPrice(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-600"
              />
            </div>
            {orderType === 'tp_limit' && (
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">
                  Limit Price (execute at)
                </label>
                <input
                  type="number" min="0" placeholder="Same as TP price if empty"
                  value={tpLimitPrice}
                  onChange={e => setTpLimitPrice(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-600"
                />
              </div>
            )}
          </div>
        )}

        {orderType === 'scale' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Price From</label>
                <input type="number" min="0" placeholder="Low" value={scaleFrom} onChange={e => setScaleFrom(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-600" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">Price To</label>
                <input type="number" min="0" placeholder="High" value={scaleTo} onChange={e => setScaleTo(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-600" />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 block">
                Number of Orders (2–10)
              </label>
              <input type="number" min="2" max="10" value={scaleCount} onChange={e => setScaleCount(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-600" />
            </div>
            {amountIn && scaleCount && (
              <p className="text-[10px] text-gray-600">
                {scaleCount} × {(parseFloat(amountIn || '0') / (parseInt(scaleCount) || 1)).toFixed(4)} {payToken?.symbol} each
              </p>
            )}
          </div>
        )}

        {/* ── Estimated output (market + scale) ───────────────────────── */}
        {(orderType === 'market' || orderType === 'scale') && (
          <div className="rounded-xl bg-gray-800/40 border border-gray-700/30 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Receive</p>
              {receiveToken && <TokenIcon token={receiveToken} size="sm" />}
            </div>
            <p className="text-lg font-semibold mt-0.5 leading-tight">
              {quote.loading
                ? <span className="text-gray-600 animate-pulse">…</span>
                : quote.amountOut
                  ? <span className="text-green-400">{Number(quote.amountOut).toFixed(receiveToken?.decimals && receiveToken.decimals <= 6 ? receiveToken.decimals : 6)} {receiveToken?.symbol}</span>
                  : <span className="text-gray-700">0.00</span>
              }
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5 h-3.5">
              {quote.amountOut ? usdValue(quote.amountOut, receiveToken?.symbol) ?? '' : ''}
            </p>
          </div>
        )}

        {/* ── Info rows ────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-800 divide-y divide-gray-800/60 overflow-hidden">
          <InfoRow
            label="Rate"
            value={exchangeRate !== null && payToken && receiveToken
              ? `1 ${payToken.symbol} = ${exchangeRate.toFixed(exchangeRate < 0.001 ? 8 : 4)} ${receiveToken.symbol}`
              : '—'}
          />
          <InfoRow
            label="Price Impact"
            value={quote.amountOut && !quote.error ? `${quote.priceImpact}%` : '—'}
            valueClass={quote.amountOut ? impactColor : ''}
          />
          <InfoRow
            label="Fee (0.25%)"
            value={feeAmt && payToken ? `${feeAmt} ${payToken.symbol}` : '—'}
          />
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs text-gray-500">Route</span>
            {payToken && receiveToken ? (
              isCrossRollup ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-purple-400">
                  {payToken.symbol} <span className="text-purple-600">→</span>
                  <span className="bg-purple-900/40 border border-purple-700/40 rounded px-1 py-0.5 text-[9px]">Bridge</span>
                  <span className="text-purple-600">→</span> {receiveToken.symbol}
                </span>
              ) : (
                <span className="text-[11px] font-medium text-green-400">
                  {payToken.symbol} → {receiveToken.symbol} · Direct
                </span>
              )
            ) : <span className="text-xs text-gray-600">—</span>}
          </div>
          {orderType === 'market' && (
            <InfoRow
              label="Min. Received"
              value={quote.amountOut && receiveToken
                ? `${(Number(quote.amountOut) * (1 - slippage / 10000)).toFixed(6)} ${receiveToken.symbol}`
                : '—'}
            />
          )}
        </div>

        {/* ── Warnings ─────────────────────────────────────────────────── */}
        {quote.impactLevel === 'high' && quote.amountOut && (
          <div className="bg-red-950/50 border border-red-800/50 rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="text-red-400 text-sm">⚠</span>
            <p className="text-xs text-red-300">
              <span className="font-semibold">High impact ({quote.priceImpact}%)</span> — split or reduce size.
            </p>
          </div>
        )}

        {quoteStale && orderType === 'market' && (
          <div className="border border-gray-700/60 rounded-xl px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">Quote is {quoteAge}s old</span>
            <button type="button" onClick={() => { quote.refresh(); reset() }}
              className="text-xs text-brand-400 hover:text-brand-300 font-medium">Refresh</button>
          </div>
        )}

        {(quote.error || swapError) && (
          <p className="text-xs text-red-400 text-center">{quote.error || swapError}</p>
        )}

        {/* ── Action button ────────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleAction}
          disabled={!btnEnabled}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] ${btnClass}`}
        >
          {buttonLabel()}
        </button>

        {/* ── Tx hash ──────────────────────────────────────────────────── */}
        {txHash && (
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-green-500 font-mono">{txHash.slice(0, 10)}…{txHash.slice(-8)}</span>
            <button type="button"
              onClick={() => navigator.clipboard?.writeText(txHash).catch(() => {})}
              className="text-[10px] text-gray-500 hover:text-gray-300 bg-gray-800 px-2 py-0.5 rounded">
              Copy
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function InfoRow({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-medium text-gray-300 ${valueClass}`}>{value}</span>
    </div>
  )
}
