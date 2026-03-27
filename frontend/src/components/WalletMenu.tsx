import { useEffect, useRef } from 'react'
import { useConnect, useConnectors, useDisconnect } from 'wagmi'
import { useInterwovenKit } from '@initia/interwovenkit-react'
import { WALLET_ICONS } from '../assets/walletIcons'
import { CHAIN_ID } from '../constants'

// ── Wallet registry ──────────────────────────────────────────────────────────
// rdns = EIP-6963 reverse-DNS identifier (this is what wagmi uses as connector.id
// for every wallet that announces itself via the EIP-6963 protocol).
const POPULAR_WALLETS = [
  { rdns: 'io.metamask',        name: 'MetaMask',       icon: WALLET_ICONS.metaMask, installUrl: 'https://metamask.io/download'                 },
  { rdns: 'app.phantom',        name: 'Phantom',        icon: WALLET_ICONS.phantom,  installUrl: 'https://phantom.app/download'                  },
  { rdns: 'io.rabby',           name: 'Rabby',          icon: WALLET_ICONS.rabby,    installUrl: 'https://rabby.io'                               },
  { rdns: 'com.coinbase.wallet',name: 'Coinbase Wallet',icon: WALLET_ICONS.coinbase, installUrl: 'https://www.coinbase.com/wallet/downloads'      },
  { rdns: 'me.rainbow',         name: 'Rainbow',        icon: WALLET_ICONS.rainbow,  installUrl: 'https://rainbow.me/download'                   },
  { rdns: 'com.trustwallet.app',name: 'Trust Wallet',   icon: WALLET_ICONS.trust,    installUrl: 'https://trustwallet.com/download'              },
  { rdns: 'com.okex.wallet',    name: 'OKX Wallet',     icon: WALLET_ICONS.okx,      installUrl: 'https://www.okx.com/web3'                      },
] as const

// ── Shared outside-close logic ───────────────────────────────────────────────

function useOutsideClose(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, onClose])
}

// ── WalletMenu ───────────────────────────────────────────────────────────────

interface WalletMenuProps { onClose: () => void }

export function WalletMenu({ onClose }: WalletMenuProps) {
  const detected           = useConnectors()          // EIP-6963 auto-discovered wallets
  const { connect, isPending } = useConnect()
  const ref                = useRef<HTMLDivElement>(null)
  useOutsideClose(ref, onClose)

  // Map rdns → live connector so we can call connect({ connector })
  const byRdns = Object.fromEntries(detected.map((c) => [c.id, c]))

  // Wallets not in the popular list but detected (rare edge case)
  const extras = detected.filter((c) => !POPULAR_WALLETS.some((w) => w.rdns === c.id))

  return (
    <div
      ref={ref}
      className="absolute right-0 top-[calc(100%+10px)] z-50 w-72 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-[0_24px_64px_-8px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.04)]"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <p className="text-sm font-semibold text-white">Connect Wallet</p>
        <p className="mt-0.5 text-xs text-gray-500">Choose a wallet to continue</p>
      </div>

      <div className="mx-5 h-px bg-gray-800" />

      {/* Wallet list */}
      <ul className="p-3 space-y-0.5 max-h-[340px] overflow-y-auto">
        {POPULAR_WALLETS.map((wallet) => {
          const connector = byRdns[wallet.rdns] ?? null
          // Use the connector's own icon if provided (EIP-6963 can supply a richer one),
          // otherwise fall back to our bundled RainbowKit-sourced icon.
          const iconSrc = connector?.icon ?? wallet.icon

          if (connector) {
            return (
              <li key={wallet.rdns}>
                <button
                  disabled={isPending}
                  onClick={() => { connect({ connector }); onClose() }}
                  className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-800 disabled:opacity-50"
                >
                  <img src={iconSrc} alt={wallet.name} className="h-9 w-9 rounded-xl flex-shrink-0 object-cover" />
                  <span className="flex-1 text-left text-sm font-medium text-gray-100 group-hover:text-white transition-colors">
                    {connector.name}
                  </span>
                  <span className="rounded-md bg-brand-900/40 px-1.5 py-0.5 text-[10px] font-medium text-brand-400">
                    Detected
                  </span>
                </button>
              </li>
            )
          }

          return (
            <li key={wallet.rdns}>
              <a
                href={wallet.installUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-800/60"
              >
                <img src={iconSrc} alt={wallet.name} className="h-9 w-9 rounded-xl flex-shrink-0 object-cover opacity-50 group-hover:opacity-70 transition-opacity" />
                <span className="flex-1 text-left text-sm font-medium text-gray-500 group-hover:text-gray-300 transition-colors">
                  {wallet.name}
                </span>
                <span className="text-[10px] text-gray-600 group-hover:text-gray-400 transition-colors">
                  Install →
                </span>
              </a>
            </li>
          )
        })}

        {/* Any extra detected wallets not in the popular list */}
        {extras.map((connector) => (
          <li key={connector.uid}>
            <button
              disabled={isPending}
              onClick={() => { connect({ connector }); onClose() }}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {connector.icon
                ? <img src={connector.icon} alt={connector.name} className="h-9 w-9 rounded-xl flex-shrink-0 object-cover" />
                : <div className="h-9 w-9 rounded-xl flex-shrink-0 bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-400">{connector.name[0]}</div>
              }
              <span className="flex-1 text-left text-sm font-medium text-gray-100 group-hover:text-white transition-colors">
                {connector.name}
              </span>
              <span className="rounded-md bg-brand-900/40 px-1.5 py-0.5 text-[10px] font-medium text-brand-400">
                Detected
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mx-5 h-px bg-gray-800/60" />
      <p className="px-5 py-3.5 text-xs text-gray-600">
        New to crypto?{' '}
        <a href="https://metamask.io/download" target="_blank" rel="noopener noreferrer"
          className="text-brand-400 hover:text-brand-300 transition-colors">
          Get MetaMask →
        </a>
      </p>
    </div>
  )
}

// ── ConnectedMenu ────────────────────────────────────────────────────────────

interface ConnectedMenuProps {
  hexAddress: string
  username?: string | null
  onClose: () => void
}

export function ConnectedMenu({ hexAddress, username, onClose }: ConnectedMenuProps) {
  const { disconnect } = useDisconnect()
  const { autoSign } = useInterwovenKit()
  const ref = useRef<HTMLDivElement>(null)
  useOutsideClose(ref, onClose)

  const display     = username ?? `${hexAddress.slice(0, 6)}…${hexAddress.slice(-4)}`
  const sessionOn   = autoSign.isEnabledByChain[CHAIN_ID] ?? false
  const sessionExp  = autoSign.expiredAtByChain[CHAIN_ID]

  async function toggleSession() {
    if (sessionOn) {
      await autoSign.disable(CHAIN_ID)
    } else {
      await autoSign.enable(CHAIN_ID)
    }
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-[calc(100%+10px)] z-50 w-64 overflow-hidden rounded-2xl border border-gray-800 bg-gray-900 shadow-[0_24px_64px_-8px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.04)]"
    >
      <div className="px-4 py-4">
        <p className="text-[10px] font-medium uppercase tracking-widest text-gray-500">Connected</p>
        <p className="mt-1.5 font-mono text-sm font-medium text-gray-100 break-all">{display}</p>
      </div>

      <div className="mx-4 h-px bg-gray-800" />

      {/* Session UX (auto-sign) toggle — this is one of the 3 required Initia-native features */}
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-200">Session Keys</p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {sessionOn
                ? sessionExp
                  ? `Expires ${sessionExp.toLocaleTimeString()}`
                  : 'No per-tx popups'
                : 'Enable for frictionless swaps'
              }
            </p>
          </div>
          <button
            onClick={toggleSession}
            disabled={autoSign.isLoading}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
              sessionOn ? 'bg-brand-600' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                sessionOn ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="p-2 space-y-0.5">
        <button
          onClick={() => { navigator.clipboard.writeText(hexAddress); onClose() }}
          className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <svg className="h-4 w-4 text-gray-500 group-hover:text-gray-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy address
        </button>
        <button
          onClick={() => { disconnect(); onClose() }}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Disconnect
        </button>
      </div>
    </div>
  )
}
