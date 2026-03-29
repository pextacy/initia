// ── Bybit spot symbol mapping for every Initia ecosystem pair ─────────────────
// Used by MarketBar, DepthBook and usePendingOrders to fetch live price data.
//
// Rules:
//   invert: false → the Bybit symbol already expresses price as tokenOut per tokenIn
//   invert: true  → price must be inverted (1/p) because the pair is reversed on Bybit
//
// Quote tokens on Bybit: USDT, USDC, BTC, ETH
// When the pair has no direct Bybit listing we route through USDT as the quote.

export interface BybitInfo {
  symbol: string   // Bybit spot symbol, e.g. "INITUSDT"
  invert: boolean  // true when Bybit quotes the inverse of what we want
}

// Normalised symbol lookup: both args are already uppercased token symbols.
// Returns null when no live Bybit data is available for the pair.
export function getBybitSymbol(a: string, b: string): BybitInfo | null {
  const USD = (s: string) => s === 'USDC' || s === 'USDT'

  // ── INIT ──────────────────────────────────────────────────────────────────
  if (a === 'INIT'  && USD(b))           return { symbol: 'INITUSDT',  invert: false }
  if (USD(a)        && b === 'INIT')     return { symbol: 'INITUSDT',  invert: true  }

  // ── BTC / WBTC ────────────────────────────────────────────────────────────
  if ((a === 'WBTC' || a === 'BTC') && USD(b))           return { symbol: 'BTCUSDT',  invert: false }
  if (USD(a)        && (b === 'WBTC' || b === 'BTC'))     return { symbol: 'BTCUSDT',  invert: true  }
  if ((a === 'WBTC' || a === 'BTC') && b === 'ETH')       return { symbol: 'BTCUSDT',  invert: false } // approximate via USD
  if (a === 'ETH'   && (b === 'WBTC' || b === 'BTC'))     return { symbol: 'ETHBTC',   invert: true  }

  // ── ETH ───────────────────────────────────────────────────────────────────
  if (a === 'ETH'   && USD(b))           return { symbol: 'ETHUSDT',   invert: false }
  if (USD(a)        && b === 'ETH')      return { symbol: 'ETHUSDT',   invert: true  }
  if (a === 'ETH'   && (b === 'WBTC' || b === 'BTC'))     return { symbol: 'ETHBTC',   invert: false }

  // ── TIA ───────────────────────────────────────────────────────────────────
  if (a === 'TIA'   && USD(b))           return { symbol: 'TIAUSDT',   invert: false }
  if (USD(a)        && b === 'TIA')      return { symbol: 'TIAUSDT',   invert: true  }
  if (a === 'TIA'   && b === 'INIT')     return { symbol: 'TIAUSDT',   invert: false }
  if (a === 'INIT'  && b === 'TIA')      return { symbol: 'TIAUSDT',   invert: true  }
  if (a === 'TIA'   && b === 'ETH')      return { symbol: 'TIAUSDT',   invert: false }
  if (a === 'ETH'   && b === 'TIA')      return { symbol: 'TIAUSDT',   invert: true  }

  // ── milkTIA ───────────────────────────────────────────────────────────────
  if (a === 'milkTIA' && USD(b))         return { symbol: 'TIAUSDT',   invert: false }
  if (USD(a)          && b === 'milkTIA')return { symbol: 'TIAUSDT',   invert: true  }

  // ── ATOM ──────────────────────────────────────────────────────────────────
  if (a === 'ATOM'  && USD(b))           return { symbol: 'ATOMUSDT',  invert: false }
  if (USD(a)        && b === 'ATOM')     return { symbol: 'ATOMUSDT',  invert: true  }
  if (a === 'ATOM'  && b === 'INIT')     return { symbol: 'ATOMUSDT',  invert: false }
  if (a === 'INIT'  && b === 'ATOM')     return { symbol: 'ATOMUSDT',  invert: true  }
  if (a === 'ATOM'  && b === 'ETH')      return { symbol: 'ATOMUSDT',  invert: false }
  if (a === 'ETH'   && b === 'ATOM')     return { symbol: 'ATOMUSDT',  invert: true  }

  // ── stATOM ────────────────────────────────────────────────────────────────
  if (a === 'stATOM' && USD(b))          return { symbol: 'ATOMUSDT',  invert: false }
  if (USD(a)         && b === 'stATOM')  return { symbol: 'ATOMUSDT',  invert: true  }

  // ── INJ ───────────────────────────────────────────────────────────────────
  if (a === 'INJ'   && USD(b))           return { symbol: 'INJUSDT',   invert: false }
  if (USD(a)        && b === 'INJ')      return { symbol: 'INJUSDT',   invert: true  }
  if (a === 'INJ'   && b === 'INIT')     return { symbol: 'INJUSDT',   invert: false }
  if (a === 'INIT'  && b === 'INJ')      return { symbol: 'INJUSDT',   invert: true  }

  // ── OSMO ──────────────────────────────────────────────────────────────────
  if (a === 'OSMO'  && USD(b))           return { symbol: 'OSMOUSDT',  invert: false }
  if (USD(a)        && b === 'OSMO')     return { symbol: 'OSMOUSDT',  invert: true  }
  if (a === 'OSMO'  && b === 'INIT')     return { symbol: 'OSMOUSDT',  invert: false }
  if (a === 'INIT'  && b === 'OSMO')     return { symbol: 'OSMOUSDT',  invert: true  }

  // ── SEI ───────────────────────────────────────────────────────────────────
  if (a === 'SEI'   && USD(b))           return { symbol: 'SEIUSDT',   invert: false }
  if (USD(a)        && b === 'SEI')      return { symbol: 'SEIUSDT',   invert: true  }
  if (a === 'SEI'   && b === 'INIT')     return { symbol: 'SEIUSDT',   invert: false }
  if (a === 'INIT'  && b === 'SEI')      return { symbol: 'SEIUSDT',   invert: true  }

  // ── BNB ───────────────────────────────────────────────────────────────────
  if (a === 'BNB'   && USD(b))           return { symbol: 'BNBUSDT',   invert: false }
  if (USD(a)        && b === 'BNB')      return { symbol: 'BNBUSDT',   invert: true  }
  if (a === 'BNB'   && b === 'ETH')      return { symbol: 'BNBUSDT',   invert: false }
  if (a === 'ETH'   && b === 'BNB')      return { symbol: 'BNBUSDT',   invert: true  }
  if (a === 'BNB'   && b === 'INIT')     return { symbol: 'BNBUSDT',   invert: false }
  if (a === 'INIT'  && b === 'BNB')      return { symbol: 'BNBUSDT',   invert: true  }

  // ── SOL ───────────────────────────────────────────────────────────────────
  if (a === 'SOL'   && USD(b))           return { symbol: 'SOLUSDT',   invert: false }
  if (USD(a)        && b === 'SOL')      return { symbol: 'SOLUSDT',   invert: true  }
  if (a === 'SOL'   && b === 'ETH')      return { symbol: 'SOLUSDT',   invert: false }
  if (a === 'ETH'   && b === 'SOL')      return { symbol: 'SOLUSDT',   invert: true  }
  if (a === 'SOL'   && b === 'INIT')     return { symbol: 'SOLUSDT',   invert: false }
  if (a === 'INIT'  && b === 'SOL')      return { symbol: 'SOLUSDT',   invert: true  }
  if (a === 'SOL'   && b === 'BNB')      return { symbol: 'SOLUSDT',   invert: false }
  if (a === 'BNB'   && b === 'SOL')      return { symbol: 'SOLUSDT',   invert: true  }

  // ── Stablecoin cross ──────────────────────────────────────────────────────
  if (a === 'USDC'  && b === 'USDT')     return { symbol: 'USDCUSDT',  invert: false }
  if (a === 'USDT'  && b === 'USDC')     return { symbol: 'USDCUSDT',  invert: true  }

  return null
}

// Approximate USD price for a given symbol (used for TVL / USD value estimates
// when no oracle is available). Updated to cover the full token list.
export const APPROX_USD: Record<string, number> = {
  INIT:    1.24,
  USDC:    1,
  USDT:    1,
  WBTC:    65_000,
  BTC:     65_000,
  ETH:     3_400,
  TIA:     4.20,
  milkTIA: 4.20,
  ATOM:    7.80,
  stATOM:  7.80,
  INJ:     22.0,
  OSMO:    0.55,
  SEI:     0.38,
  BNB:     580,
  SOL:     140,
}
