import { useState, useEffect, useRef } from 'react'
import { createPublicClient, http, parseUnits, formatUnits } from 'viem'
import { CONTRACTS, ROUTER_ABI, POOL_REGISTRY_ABI, AMM_ABI, RPC_URL } from '../constants'

const client = createPublicClient({ transport: http(RPC_URL) })

export type ImpactLevel = 'low' | 'medium' | 'high'

export interface QuoteResult {
  amountOut:    string       // human-readable output amount
  amountOutRaw: bigint
  poolId:       string
  poolChainId:  string       // rollupChainId of the best pool (empty = same chain)
  /** Price impact as a percentage string, e.g. "0.42" */
  priceImpact:  string
  impactLevel:  ImpactLevel  // low < 1%, medium 1–5%, high > 5%
  loading:      boolean
  error:        string | null
  fetchedAt:    number | null  // Date.now() when quote was last fetched, null if no quote
}

const EMPTY: QuoteResult = {
  amountOut: '', amountOutRaw: 0n, poolId: '', poolChainId: '',
  priceImpact: '0.00', impactLevel: 'low', loading: false, error: null, fetchedAt: null,
}

function classifyImpact(pct: number): ImpactLevel {
  if (pct >= 5) return 'high'
  if (pct >= 1) return 'medium'
  return 'low'
}

export type { QuoteResult as default }

export function useQuote(
  tokenIn:    string,
  tokenOut:   string,
  amountIn:   string,
  decimalsIn:  number,
  decimalsOut: number,
): QuoteResult & { refresh: () => void } {
  const [result, setResult] = useState<QuoteResult>(EMPTY)
  const [refreshToken, setRefreshToken] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!tokenIn || !tokenOut || !amountIn || amountIn === '0' || !Number(amountIn)) {
      setResult(EMPTY)
      return
    }
    if (tokenIn === tokenOut) {
      setResult({ ...EMPTY, error: 'Select two different tokens' })
      return
    }

    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setResult(r => ({ ...r, loading: true, error: null }))

      try {
        const amountInRaw = parseUnits(amountIn, decimalsIn)
        // Router deducts 0.25% fee before quoting — mirror that here
        const netAmountIn = amountInRaw - (amountInRaw * 25n) / 10000n

        // 1. Get best pool + expected output from Router
        const [bestAmountOut, bestPoolId] = await client.readContract({
          address: CONTRACTS.ROUTER as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: 'quote',
          args: [tokenIn as `0x${string}`, tokenOut as `0x${string}`, netAmountIn],
        }) as [bigint, `0x${string}`]

        const nullPool = '0x0000000000000000000000000000000000000000000000000000000000000000'
        if (bestPoolId === nullPool || bestAmountOut === 0n) {
          setResult({ ...EMPTY, error: 'No pool found for this pair' })
          return
        }

        // 2. Fetch pool config first (need poolAddress), then fetch reserves
        const poolConfig = await client.readContract({
          address: CONTRACTS.POOL_REGISTRY as `0x${string}`,
          abi: POOL_REGISTRY_ABI,
          functionName: 'get_pool',
          args: [bestPoolId],
        }) as { tokenA: string; poolAddress: string; rollupChainId: string }

        const [reserveA, reserveB] = await client.readContract({
          address: poolConfig.poolAddress as `0x${string}`,
          abi: AMM_ABI,
          functionName: 'getReserves',
        }) as [bigint, bigint]

        // 3. Determine which reserve is the "in" side
        const isTokenA = tokenIn.toLowerCase() === poolConfig.tokenA.toLowerCase()
        const reserveIn = isTokenA ? reserveA : reserveB

        // 4. Price impact: what fraction of the pool depth are we consuming?
        // Impact = netAmountIn / (reserveIn + netAmountIn) * 100
        // This is exact for x*y=k, independent of token prices.
        const impactPct = reserveIn > 0n
          ? (Number(netAmountIn) / (Number(reserveIn) + Number(netAmountIn))) * 100
          : 0

        const impactStr = impactPct.toFixed(2)

        setResult({
          amountOut:    formatUnits(bestAmountOut, decimalsOut),
          amountOutRaw: bestAmountOut,
          poolId:       bestPoolId,
          poolChainId:  poolConfig.rollupChainId ?? '',
          priceImpact:  impactStr,
          impactLevel:  classifyImpact(impactPct),
          loading:      false,
          error:        null,
          fetchedAt:    Date.now(),
        })
      } catch {
        setResult({ ...EMPTY, error: 'Failed to fetch quote' })
      }
    }, 400)

    return () => clearTimeout(debounceRef.current)
  }, [tokenIn, tokenOut, amountIn, decimalsIn, decimalsOut, refreshToken])

  return { ...result, refresh: () => setRefreshToken(t => t + 1) }
}
