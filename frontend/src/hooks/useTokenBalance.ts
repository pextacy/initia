import { useState, useEffect } from 'react'
import { createPublicClient, http, formatUnits } from 'viem'
import { ERC20_ABI, RPC_URL } from '../constants'

const client = createPublicClient({ transport: http(RPC_URL) })

export function useTokenBalance(tokenAddress: string, userAddress: string | undefined, decimals: number, refreshKey = 0) {
  const [balance, setBalance] = useState<string>('0')
  const [raw, setRaw] = useState<bigint>(0n)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userAddress || !tokenAddress) return
    let cancelled = false
    setLoading(true)

    client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [userAddress as `0x${string}`],
    }).then((bal) => {
      if (!cancelled) {
        setRaw(bal)
        setBalance(formatUnits(bal, decimals))
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [tokenAddress, userAddress, decimals, refreshKey])

  return { balance, raw, loading }
}
