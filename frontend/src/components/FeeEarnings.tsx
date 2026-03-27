import { useState, useEffect } from 'react'
import { createPublicClient, http, formatUnits, encodeFunctionData } from 'viem'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { FEE_DISTRIBUTOR_ABI, CONTRACTS, RPC_URL, TOKENS } from '../constants'

const client = createPublicClient({ transport: http(RPC_URL) })

export function FeeEarnings() {
  const { address, hexAddress, requestTxSync } = useInterwovenKit()
  const [earnings,  setEarnings]  = useState<{ token: string; symbol: string; amount: string; raw: bigint }[]>([])
  const [claiming,  setClaiming]  = useState<string | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)

  useEffect(() => {
    if (!hexAddress) return
    let cancelled = false

    Promise.all(
      TOKENS.map(async token => {
        try {
          const raw = await client.readContract({
            address: CONTRACTS.FEE_DISTRIBUTOR as `0x${string}`,
            abi: FEE_DISTRIBUTOR_ABI,
            functionName: 'pendingFees',
            args: [token.address as `0x${string}`, hexAddress as `0x${string}`],
          }) as bigint
          return { token: token.address, symbol: token.symbol, amount: formatUnits(raw, token.decimals), raw }
        } catch {
          return { token: token.address, symbol: token.symbol, amount: '0', raw: 0n }
        }
      })
    ).then(results => {
      if (!cancelled) setEarnings(results.filter(r => r.raw > 0n))
    }).catch(() => {
      // registry not deployed or RPC unavailable — show empty state
    })

    return () => { cancelled = true }
  }, [hexAddress])

  async function claim(tokenAddress: string) {
    if (!address) return
    setClaimError(null)
    setClaiming(tokenAddress)
    try {
      await requestTxSync({
        messages: [{
          typeUrl: '/minievm.evm.v1.MsgCall',
          value: {
            sender: address,
            contractAddr: CONTRACTS.FEE_DISTRIBUTOR,
            input: encodeFunctionData({
              abi: FEE_DISTRIBUTOR_ABI,
              functionName: 'claim',
              args: [tokenAddress as `0x${string}`],
            }),
            value: '0',
            accessList: [],
            authList: [],
          },
        }],
      })
      setEarnings(prev => prev.filter(e => e.token !== tokenAddress))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Claim failed'
      setClaimError(msg.includes('user rejected') ? 'Transaction cancelled' : msg)
    } finally {
      setClaiming(null)
    }
  }

  if (!address) {
    return (
      <div className="card text-center py-14">
        <p className="text-gray-500 text-sm font-medium">Connect your wallet</p>
        <p className="text-gray-600 text-xs mt-1">See and claim your rollup swap fee earnings</p>
      </div>
    )
  }

  if (earnings.length === 0) {
    return (
      <div className="card text-center py-14">
        <p className="text-gray-500 text-sm font-medium">No earnings yet</p>
        <p className="text-gray-600 text-xs mt-1">Register a pool to start earning swap fees</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-100">Fee Earnings</h2>
        <span className="text-xs text-gray-500">{earnings.length} token{earnings.length !== 1 ? 's' : ''}</span>
      </div>
      {claimError && (
        <p className="text-xs text-red-400 mb-3">{claimError}</p>
      )}
      <div className="space-y-2">
        {earnings.map(e => (
          <div key={e.token} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
            <div>
              <span className="text-sm font-medium text-gray-100">
                {Number(e.amount).toFixed(6)}
              </span>
              <span className="text-xs text-gray-500 ml-2">{e.symbol}</span>
            </div>
            <button
              type="button"
              onClick={() => claim(e.token)}
              disabled={!!claiming}
              className="text-xs px-4 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {claiming === e.token ? 'Claiming…' : 'Claim'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
