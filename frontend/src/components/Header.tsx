import { useState } from 'react'
import { useInterwovenKit, useUsernameQuery } from '@initia/interwovenkit-react'
import { WalletMenu, ConnectedMenu } from './WalletMenu'

type Tab = 'swap' | 'pools' | 'earn' | 'bridge' | 'stats' | 'leaderboard'

interface Props {
  tab: Tab
  onTabChange: (t: Tab) => void
}

export default function Header({ tab, onTabChange }: Props) {
  const { address, hexAddress } = useInterwovenKit()
  const { data: username } = useUsernameQuery(address)
  const [menuOpen, setMenuOpen] = useState(false)

  const displayAddress = username
    ? username
    : hexAddress
    ? `${hexAddress.slice(0, 6)}…${hexAddress.slice(-4)}`
    : null

  const tabs: { id: Tab; label: string }[] = [
    { id: 'swap',        label: 'Swap'        },
    { id: 'pools',       label: 'Pools'       },
    { id: 'earn',        label: 'Earn'        },
    { id: 'bridge',      label: 'Bridge'      },
    { id: 'stats',       label: 'Stats'       },
    { id: 'leaderboard', label: 'Leaderboard' },
  ]

  return (
    <header className="border-b border-gray-800 sticky top-0 z-20 bg-gray-950">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
            A
          </div>
          <span className="font-semibold text-white tracking-tight">AppSwap</span>
        </div>

        {/* Nav tabs */}
        <nav className="flex items-center gap-0.5 bg-gray-900 rounded-lg p-1 border border-gray-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Wallet button + dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`text-sm font-medium px-4 py-1.5 rounded-lg border transition-colors ${
              hexAddress
                ? 'bg-transparent border-gray-700 text-gray-300 hover:border-gray-600 hover:text-gray-100'
                : 'bg-brand-600 border-brand-600 text-white hover:bg-brand-500'
            }`}
          >
            {displayAddress ?? 'Connect'}
          </button>

          {menuOpen && !hexAddress && (
            <WalletMenu onClose={() => setMenuOpen(false)} />
          )}

          {menuOpen && hexAddress && (
            <ConnectedMenu
              hexAddress={hexAddress}
              username={username}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>

      </div>
    </header>
  )
}
