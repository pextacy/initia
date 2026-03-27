import { useState } from 'react'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { parseUnits } from 'viem'
import { TOKENS, type Token } from '../constants'
import { TokenIcon } from './TokenIcon'

// ── Known chains that AppSwap can bridge to ──────────────────────────────────
const CHAINS = [
  { id: 'appswap-1',     name: 'AppSwap',   channel: 'channel-0', isHome: true  },
  { id: 'initiation-2',  name: 'Initia L1', channel: 'channel-0'  },
  { id: 'minimove-1',    name: 'MiniMove',  channel: 'channel-1'  },
  { id: 'miniwasm-1',    name: 'MiniWasm',  channel: 'channel-2'  },
  { id: 'minievm-2512',  name: 'MiniEVM',   channel: 'channel-3'  },
] as const

type ChainId = typeof CHAINS[number]['id']

function getChannel(fromId: ChainId, toId: ChainId): string {
  if (fromId === 'appswap-1') {
    return CHAINS.find(c => c.id === toId)?.channel ?? 'channel-0'
  }
  return CHAINS.find(c => c.id === fromId)?.channel ?? 'channel-0'
}

// Cosmos bech32 or EVM hex address basic check
function isValidRecipient(addr: string) {
  return addr.startsWith('init1') || /^0x[0-9a-fA-F]{40}$/.test(addr)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Bridge() {
  const { address, requestTxSync } = useInterwovenKit()

  const [fromChain, setFromChain] = useState<ChainId>('appswap-1')
  const [toChain,   setToChain]   = useState<ChainId>('initiation-2')
  const [token,     setToken]     = useState<Token | undefined>(TOKENS[0])
  const [amount,    setAmount]    = useState('')
  const [recipient, setRecipient] = useState('')
  const [status,    setStatus]    = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  const [txHash,    setTxHash]    = useState<string | null>(null)
  const [errMsg,    setErrMsg]    = useState<string | null>(null)

  // swap direction
  function flip() {
    setFromChain(toChain)
    setToChain(fromChain)
    setAmount('')
  }

  async function handleBridge() {
    if (!address || !token || !amount || parseFloat(amount) <= 0) return
    const dest = recipient || address   // default: same address on dest chain

    setStatus('pending')
    setErrMsg(null)

    try {
      const amountRaw = parseUnits(amount, token.decimals).toString()
      const channel   = getChannel(fromChain, toChain)
      // timeout: 10 minutes from now in nanoseconds
      const timeoutTs = (BigInt(Date.now() + 10 * 60 * 1000) * 1_000_000n).toString()

      const result = await requestTxSync({
        messages: [{
          typeUrl: '/ibc.applications.transfer.v1.MsgTransfer',
          value: {
            sourcePort:       'transfer',
            sourceChannel:    channel,
            token:            { denom: token.address, amount: amountRaw },
            sender:           address,
            receiver:         dest,
            timeoutHeight:    { revisionNumber: '0', revisionHeight: '0' },
            timeoutTimestamp: timeoutTs,
            memo:             'AppSwap Bridge',
          },
        }],
      })

      setTxHash((result as { txHash?: string })?.txHash ?? null)
      setStatus('success')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Bridge failed'
      setErrMsg(msg.includes('user rejected') ? 'Transaction cancelled' : msg)
      setStatus('error')
    }
  }

  const fromInfo = CHAINS.find(c => c.id === fromChain)!
  const toInfo   = CHAINS.find(c => c.id === toChain)!
  const canBridge = !!address && !!token && !!amount && parseFloat(amount) > 0 && fromChain !== toChain && status !== 'pending'

  return (
    <div className="space-y-4">
      {/* Header — matches PoolTable style */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Interwoven Bridge</h1>
          <p className="text-xs text-gray-500 mt-0.5">Transfer assets across Initia rollups via IBC</p>
        </div>
      </div>

      {/* Main form card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">

        {/* From / To chains */}
        <div className="px-5 pt-5 pb-4 space-y-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5 block">From</label>
              <select
                value={fromChain}
                onChange={e => setFromChain(e.target.value as ChainId)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-brand-600"
              >
                {CHAINS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <button
              type="button"
              onClick={flip}
              className="bg-gray-800 border border-gray-700 rounded-lg p-2.5 hover:bg-gray-700 hover:scale-110 transition-all active:scale-95 mb-0.5"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4M4 17h12m0 0l-4-4m4 4l-4 4" />
              </svg>
            </button>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5 block">To</label>
              <select
                value={toChain}
                onChange={e => setToChain(e.target.value as ChainId)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-brand-600"
              >
                {CHAINS.filter(c => c.id !== fromChain).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="h-px bg-gray-800" />

        {/* Token + Amount */}
        <div className="px-5 py-4">
          <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5 block">Asset & Amount</label>
          <div className="bg-gray-800/70 rounded-xl border border-gray-700/50 flex items-center overflow-hidden">
            <div className="flex items-center gap-2 px-3 border-r border-gray-700 shrink-0">
              {token && <TokenIcon token={token} size="sm" />}
              <select
                value={token?.address ?? ''}
                onChange={e => setToken(TOKENS.find(t => t.address === e.target.value))}
                className="bg-transparent text-sm font-semibold text-gray-100 focus:outline-none pr-1 py-3"
              >
                {!token && <option value="">Select</option>}
                {TOKENS.map(t => <option key={t.address} value={t.address}>{t.symbol}</option>)}
              </select>
            </div>
            <input
              type="number"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="flex-1 bg-transparent px-4 py-3 text-xl font-semibold text-white focus:outline-none placeholder-gray-700"
            />
          </div>
        </div>

        <div className="h-px bg-gray-800" />

        {/* Recipient */}
        <div className="px-5 py-4">
          <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5 block">
            Recipient <span className="text-gray-600 normal-case">(leave blank to use your address)</span>
          </label>
          <input
            type="text"
            placeholder="init1… or 0x…"
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            className={`w-full bg-gray-800 border rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-600 font-mono ${
              recipient && !isValidRecipient(recipient) ? 'border-red-700' : 'border-gray-700'
            }`}
          />
          {recipient && !isValidRecipient(recipient) && (
            <p className="text-[10px] text-red-400 mt-1">Invalid address format</p>
          )}
        </div>

        <div className="h-px bg-gray-800" />

        {/* Bridge details */}
        <div className="divide-y divide-gray-800/60">
          <InfoRow label="Route"      value={`${fromInfo.name} → ${toInfo.name}`} />
          <InfoRow label="Protocol"   value="IBC Transfer" />
          <InfoRow label="Est. Time"  value="~30 seconds" />
          <InfoRow label="Bridge Fee" value="Free (gas only)" />
        </div>

        {/* Error / Success / Button */}
        <div className="px-5 py-4 space-y-3">
          {errMsg && <p className="text-xs text-red-400 text-center">{errMsg}</p>}

          {status === 'success' && (
            <div className="rounded-xl bg-green-950/40 border border-green-800/50 px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="text-sm font-medium text-green-400">Bridge initiated!</p>
                <p className="text-xs text-green-600 mt-0.5">{amount} {token?.symbol} is on its way to {toInfo.name}</p>
                {txHash && <p className="font-mono text-[10px] text-green-700 mt-1">{txHash.slice(0, 12)}…{txHash.slice(-8)}</p>}
              </div>
            </div>
          )}

          {!address ? (
            <p className="text-center text-sm text-gray-500 py-1">Connect wallet to bridge</p>
          ) : (
            <button
              type="button"
              onClick={status === 'error' ? () => { setStatus('idle'); setErrMsg(null) } : handleBridge}
              disabled={status === 'error' ? false : !canBridge}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] ${
                status === 'success'
                  ? 'bg-green-900/40 border border-green-800/50 text-green-400'
                  : canBridge || status === 'error'
                  ? 'bg-brand-600 hover:bg-brand-500 text-white'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/50'
              }`}
            >
              {status === 'pending' ? 'Bridging…'
                : status === 'success' ? 'Bridge again'
                : status === 'error'   ? 'Retry'
                : fromChain === toChain ? 'Select different chains'
                : !token               ? 'Select token'
                : !amount || parseFloat(amount) <= 0 ? 'Enter amount'
                : `Bridge ${token?.symbol ?? ''} →`}
            </button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-3 gap-3">
        <InfoCard title="Fast"      body="IBC transfers settle in ~30 seconds" />
        <InfoCard title="Trustless" body="Secured by Initia's interwoven stack" />
        <InfoCard title="Any Chain" body="Bridge to any Initia rollup" />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-300">{value}</span>
    </div>
  )
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-3 text-center">
      <p className="text-xs font-semibold text-gray-300">{title}</p>
      <p className="text-[10px] text-gray-600 mt-0.5">{body}</p>
    </div>
  )
}
