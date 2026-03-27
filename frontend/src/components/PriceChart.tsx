import { useEffect, useRef } from 'react'
import type { Token } from '../constants'

// Map our token pairs to TradingView symbols
function toTVSymbol(tokenIn?: Token, tokenOut?: Token): string {
  const a = tokenIn?.symbol?.toUpperCase()
  const b = tokenOut?.symbol?.toUpperCase()
  const pair = `${a}/${b}`

  const map: Record<string, string> = {
    'INIT/USDC': 'BYBIT:INITUSDT',
    'USDC/INIT': 'BYBIT:INITUSDT',
    'INIT/USDT': 'BYBIT:INITUSDT',
    'WBTC/USDC': 'BINANCE:BTCUSDC',
    'USDC/WBTC': 'BINANCE:BTCUSDC',
    'ETH/USDC':  'BINANCE:ETHUSDC',
    'USDC/ETH':  'BINANCE:ETHUSDC',
    'ETH/WBTC':  'BINANCE:ETHBTC',
    'WBTC/ETH':  'BINANCE:ETHBTC',
    'INIT/ETH':  'BYBIT:INITUSDT',
    'INIT/WBTC': 'BYBIT:INITUSDT',
  }

  return map[pair] ?? 'BYBIT:INITUSDT'
}

interface Props {
  tokenIn?:       Token
  tokenOut?:      Token
  onPriceUpdate?: (price: number) => void
}

export function PriceChart({ tokenIn, tokenOut }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef    = useRef<HTMLDivElement | null>(null)
  const symbol = toTVSymbol(tokenIn, tokenOut)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Clean up previous widget
    container.innerHTML = ''

    const wrapper = document.createElement('div')
    wrapper.className = 'tradingview-widget-container'
    wrapper.style.cssText = 'height:100%;width:100%;'

    const chartDiv = document.createElement('div')
    chartDiv.id = `tv_chart_${Date.now()}`
    chartDiv.style.cssText = 'height:100%;width:100%;'
    wrapper.appendChild(chartDiv)
    container.appendChild(wrapper)
    widgetRef.current = wrapper

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/tv.js'
    script.async = true
    script.onload = () => {
      // @ts-expect-error TradingView global
      if (typeof TradingView === 'undefined') return
      // @ts-expect-error TradingView global
      new TradingView.widget({
        autosize:            true,
        symbol,
        interval:            'D',
        timezone:            'Etc/UTC',
        theme:               'dark',
        style:               '1',
        locale:              'en',
        backgroundColor:     '#030712',
        gridColor:           'rgba(31,41,55,0.5)',
        allow_symbol_change: false,
        save_image:          false,
        hide_top_toolbar:    false,
        hide_legend:         false,
        hide_side_toolbar:   false,
        withdateranges:      true,
        details:             false,
        hotlist:             false,
        calendar:            false,
        container_id:        chartDiv.id,
      })
    }
    wrapper.appendChild(script)

    return () => {
      container.innerHTML = ''
    }
  }, [symbol])

  return (
    <div ref={containerRef} className="h-full w-full" />
  )
}
