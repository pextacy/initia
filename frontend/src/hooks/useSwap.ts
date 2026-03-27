import { useState } from 'react'
import { createPublicClient, http, parseUnits, encodeFunctionData } from 'viem'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { CONTRACTS, ROUTER_ABI, ERC20_ABI, RPC_URL } from '../constants'

const client = createPublicClient({ transport: http(RPC_URL) })

export type SwapStatus = 'idle' | 'approving' | 'swapping' | 'success' | 'error'

function evmMsg(sender: string, contractAddr: string, input: string) {
  return {
    typeUrl: '/minievm.evm.v1.MsgCall',
    value: { sender, contractAddr, input, value: '0', accessList: [], authList: [] },
  }
}

export function useSwap() {
  const { address, hexAddress, requestTxSync } = useInterwovenKit()
  const [status, setStatus]   = useState<SwapStatus>('idle')
  const [txHash, setTxHash]   = useState<string>('')
  const [error,  setError]    = useState<string>('')

  async function executeSwap(
    tokenIn:      string,
    tokenOut:     string,
    amountIn:     string,
    minAmountOut: bigint,
    decimalsIn:   number,
  ) {
    if (!hexAddress || !address) { setError('Connect wallet first'); return }

    setError(''); setTxHash('')

    try {
      const amountInRaw = parseUnits(amountIn, decimalsIn)
      const deadline    = BigInt(Math.floor(Date.now() / 1000) + 300)

      // Check allowance — only approve if needed
      const currentAllowance = await client.readContract({
        address: tokenIn as `0x${string}`,
        abi:     ERC20_ABI,
        functionName: 'allowance',
        args: [hexAddress as `0x${string}`, CONTRACTS.ROUTER as `0x${string}`],
      }) as bigint

      if (currentAllowance < amountInRaw) {
        setStatus('approving')
        await requestTxSync({
          messages: [evmMsg(
            address,
            tokenIn,
            encodeFunctionData({
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [CONTRACTS.ROUTER as `0x${string}`, amountInRaw],
            }),
          )],
        })
      }

      setStatus('swapping')
      const hash = await requestTxSync({
        messages: [evmMsg(
          address,
          CONTRACTS.ROUTER,
          encodeFunctionData({
            abi: ROUTER_ABI,
            functionName: 'swap',
            args: [
              tokenIn  as `0x${string}`,
              tokenOut as `0x${string}`,
              amountInRaw,
              minAmountOut,
              deadline,
            ],
          }),
        )],
      })

      setTxHash(hash)
      setStatus('success')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Swap failed'
      setError(msg.includes('user rejected') ? 'Transaction cancelled' : msg)
      setStatus('error')
    }
  }

  function reset() { setStatus('idle'); setError(''); setTxHash('') }

  return { executeSwap, status, txHash, error, reset }
}
