import { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────
export type OrderType = 'limit' | 'stop_market' | 'tp_market' | 'tp_limit' | 'oracle_limit'

export interface PendingOrder {
  id:               string
  type:             OrderType
  side:             'long' | 'short'
  tokenInAddress:   string
  tokenOutAddress:  string
  tokenInSymbol:    string
  tokenOutSymbol:   string
  amountIn:         string        // human-readable
  decimalsIn:       number
  slippageBps:      number
  triggerPrice:     number        // price of base token in quote at which to trigger
  limitPrice?:      number        // for tp_limit: limit price to use after trigger
  bybitSymbol:      string        // e.g. "INITUSDT"
  bybitInvert:      boolean       // true if pair is quote/base (e.g. USDC/INIT)
  createdAt:        number
  status:           'pending' | 'triggered' | 'executed' | 'cancelled'
}

const STORAGE_KEY = 'appswap_pending_orders_v1'

function loadFromStorage(): PendingOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PendingOrder[]) : []
  } catch {
    return []
  }
}

function saveToStorage(orders: PendingOrder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
  } catch {}
}

// ── Bybit symbol mapping ───────────────────────────────────────────────────────
export function getBybitInfo(
  tokenInSymbol: string,
  tokenOutSymbol: string,
): { symbol: string; invert: boolean } | null {
  const a = tokenInSymbol, b = tokenOutSymbol
  if (a === 'INIT'  && (b === 'USDC' || b === 'USDT')) return { symbol: 'INITUSDT', invert: false }
  if ((a === 'USDC' || a === 'USDT') && b === 'INIT')  return { symbol: 'INITUSDT', invert: true  }
  if (a === 'WBTC'  && (b === 'USDC' || b === 'USDT')) return { symbol: 'BTCUSDT',  invert: false }
  if ((a === 'USDC' || a === 'USDT') && b === 'WBTC')  return { symbol: 'BTCUSDT',  invert: true  }
  if (a === 'ETH'   && (b === 'USDC' || b === 'USDT')) return { symbol: 'ETHUSDT',  invert: false }
  if ((a === 'USDC' || a === 'USDT') && b === 'ETH')   return { symbol: 'ETHUSDT',  invert: true  }
  if (a === 'ETH'   && b === 'WBTC')                   return { symbol: 'ETHBTC',   invert: false }
  if (a === 'WBTC'  && b === 'ETH')                    return { symbol: 'ETHBTC',   invert: true  }
  return null
}

// Fetch current Bybit spot price for a symbol
async function fetchBybitPrice(symbol: string): Promise<number> {
  try {
    const res  = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`)
    const json = await res.json()
    return parseFloat(json?.result?.list?.[0]?.lastPrice ?? '0')
  } catch {
    return 0
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function usePendingOrders() {
  const [orders, setOrders] = useState<PendingOrder[]>(loadFromStorage)
  // Map bybitSymbol → raw price (not inverted)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  // Persist orders whenever they change
  useEffect(() => { saveToStorage(orders) }, [orders])

  // Collect unique bybit symbols from pending orders
  const pendingOrders = orders.filter(o => o.status === 'pending')
  const symbols = [...new Set(pendingOrders.map(o => o.bybitSymbol))]

  // Price polling
  useEffect(() => {
    clearInterval(pollRef.current)
    if (symbols.length === 0) return

    async function poll() {
      const updates: Record<string, number> = {}
      await Promise.all(symbols.map(async sym => {
        const p = await fetchBybitPrice(sym)
        if (p > 0) updates[sym] = p
      }))
      if (Object.keys(updates).length > 0) {
        setPrices(prev => ({ ...prev, ...updates }))
      }
    }

    poll()
    pollRef.current = setInterval(poll, 5_000)
    return () => clearInterval(pollRef.current)
  }, [symbols.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  // Determine which orders should fire now
  const triggeredOrders = pendingOrders.filter(o => {
    const rawPrice = prices[o.bybitSymbol]
    if (!rawPrice) return false
    const price = o.bybitInvert ? 1 / rawPrice : rawPrice

    switch (o.type) {
      case 'limit':
      case 'oracle_limit':
        // Long limit: buy when price drops to or below limit
        // Short limit: sell when price rises to or above limit
        return o.side === 'long' ? price <= o.triggerPrice : price >= o.triggerPrice
      case 'stop_market':
        // Long stop: buy when price rises to trigger (breakout)
        // Short stop: sell when price falls to trigger (stop loss)
        return o.side === 'long' ? price >= o.triggerPrice : price <= o.triggerPrice
      case 'tp_market':
      case 'tp_limit':
        // Take profit: long TP fires when price rises; short TP fires when price falls
        return o.side === 'long' ? price >= o.triggerPrice : price <= o.triggerPrice
      default:
        return false
    }
  })

  const addOrder = useCallback((order: Omit<PendingOrder, 'id' | 'createdAt' | 'status'>) => {
    const newOrder: PendingOrder = {
      ...order,
      id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      status:    'pending',
    }
    setOrders(prev => [newOrder, ...prev])
  }, [])

  const cancelOrder = useCallback((id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o))
  }, [])

  const markTriggered = useCallback((id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'triggered' } : o))
  }, [])

  const markExecuted = useCallback((id: string) => {
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'executed' } : o))
  }, [])

  const clearCompleted = useCallback(() => {
    setOrders(prev => prev.filter(o => o.status === 'pending'))
  }, [])

  return {
    orders,
    pendingOrders,
    triggeredOrders,
    prices,
    addOrder,
    cancelOrder,
    markTriggered,
    markExecuted,
    clearCompleted,
  }
}
