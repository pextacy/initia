import { useState } from 'react'
import { encodeFunctionData, parseUnits } from 'viem'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { CONTRACTS, ROUTER_ABI, ERC20_ABI } from '../constants'

type Status = 'idle' | 'approving_a' | 'approving_b' | 'adding' | 'success' | 'error'

export function useAddLiquidity() {
  const { address, requestTxSync } = useInterwovenKit()
  const [status,  setStatus]  = useState<Status>('idle')
  const [txHash,  setTxHash]  = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [lpReceived, setLpReceived] = useState<string | null>(null)

  function reset() {
    setStatus('idle')
    setTxHash(null)
    setError(null)
    setLpReceived(null)
  }

  async function addLiquidity(
    tokenAAddr:    string,
    tokenBAddr:    string,
    amountAHuman:  string,
    amountBHuman:  string,
    decimalsA:     number,
    decimalsB:     number,
    slippageBps:   number = 50,   // 0.5% default
  ) {
    if (!address) return
    setStatus('idle')
    setError(null)
    setTxHash(null)
    setLpReceived(null)

    try {
      const amountA = parseUnits(amountAHuman, decimalsA)
      const amountB = parseUnits(amountBHuman, decimalsB)
      const minA    = (amountA * (10000n - BigInt(slippageBps))) / 10000n
      const minB    = (amountB * (10000n - BigInt(slippageBps))) / 10000n
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600)

      function evmMsg(contractAddr: string, input: string) {
        return {
          typeUrl: '/minievm.evm.v1.MsgCall',
          value: { sender: address, contractAddr, input, value: '0', accessList: [], authList: [] },
        }
      }

      // 1. Approve token A
      setStatus('approving_a')
      await requestTxSync({
        messages: [evmMsg(tokenAAddr, encodeFunctionData({
          abi: ERC20_ABI, functionName: 'approve',
          args: [CONTRACTS.ROUTER as `0x${string}`, amountA],
        }))],
      })

      // 2. Approve token B
      setStatus('approving_b')
      await requestTxSync({
        messages: [evmMsg(tokenBAddr, encodeFunctionData({
          abi: ERC20_ABI, functionName: 'approve',
          args: [CONTRACTS.ROUTER as `0x${string}`, amountB],
        }))],
      })

      // 3. Add liquidity
      setStatus('adding')
      const result = await requestTxSync({
        messages: [evmMsg(CONTRACTS.ROUTER, encodeFunctionData({
          abi: ROUTER_ABI, functionName: 'addLiquidity',
          args: [
            tokenAAddr as `0x${string}`,
            tokenBAddr as `0x${string}`,
            amountA, amountB,
            minA, minB,
            address as `0x${string}`,
            deadline,
          ],
        }))],
      })

      setTxHash((result as { tx_hash?: string })?.tx_hash ?? null)
      setStatus('success')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Transaction failed'
      setError(msg.includes('user rejected') ? 'Transaction cancelled' : msg)
      setStatus('error')
    }
  }

  return { addLiquidity, status, txHash, error, lpReceived, reset }
}
