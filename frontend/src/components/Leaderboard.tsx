import { useState, useMemo } from 'react'

interface Trader {
  rank:    number
  address: string
  pnl:     number   // USD
  volume:  number   // USD
}

const MOCK_TRADERS: Trader[] = [
  { rank: 1,  address: '0xBxTE…TDvv', pnl:  89_225.19,  volume: 399_898_304.54 },
  { rank: 2,  address: '0xE69P…9LVL', pnl:  39_454.89,  volume: 218_933_648.90 },
  { rank: 3,  address: '0xCksY…TkrD', pnl: -10_311.51,  volume: 176_438_097.08 },
  { rank: 4,  address: '0xDJTi…uDAd', pnl:  342_629.78, volume: 170_583_546.75 },
  { rank: 5,  address: '0xBsmQ…lLrd', pnl:  20_050.84,  volume:  95_770_347.21 },
  { rank: 6,  address: '0xFvxt…1xYN', pnl:  16_620.20,  volume:  28_556_300.97 },
  { rank: 7,  address: '0xbidu…q31F', pnl: -26_736.59,  volume:  21_776_956.59 },
  { rank: 8,  address: '0xEibQ…89Yj', pnl: -61_845.61,  volume:  21_761_207.98 },
  { rank: 9,  address: '0x81xQ…Kq4h', pnl:  403_331.23, volume:  19_451_434.27 },
  { rank: 10, address: '0xECyv…XBvd', pnl:  40_861.89,  volume:  18_319_803.36 },
  { rank: 11, address: '0x7Hna…mR2k', pnl:  12_440.55,  volume:  15_882_100.00 },
  { rank: 12, address: '0x3Wqz…PLj9', pnl: -5_230.10,   volume:  14_200_450.00 },
  { rank: 13, address: '0xKrpt…8vXc', pnl:  8_910.00,   volume:  13_500_000.00 },
  { rank: 14, address: '0xAmNx…2Fsd', pnl:  3_120.77,   volume:  12_780_900.00 },
  { rank: 15, address: '0xZqLo…9pRt', pnl: -1_880.22,   volume:  11_340_600.00 },
]

function fmtUSD(n: number, alwaysSign = false): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : alwaysSign ? '+' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(3)}K`
  return `${sign}$${abs.toFixed(2)}`
}

function fmtVolume(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(2)}`
}

const MEDALS = ['1ST', '2ND', '3RD']
const TOP_BG  = [
  'from-yellow-950/60 to-gray-900 border-yellow-800/40',
  'from-gray-800/60   to-gray-900 border-gray-700/40',
  'from-orange-950/50 to-gray-900 border-orange-900/40',
]
const TOP_RANK_COLOR = ['text-yellow-400', 'text-gray-300', 'text-orange-400']

export function Leaderboard() {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'volume' | 'pnl'>('volume')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return MOCK_TRADERS
      .filter(t => !q || t.address.toLowerCase().includes(q))
      .sort((a, b) => sortBy === 'volume' ? b.volume - a.volume : b.pnl - a.pnl)
      .map((t, i) => ({ ...t, rank: i + 1 }))
  }, [search, sortBy])

  const top3 = filtered.slice(0, 3)
  const rest  = filtered.slice(3)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Swap Leaderboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Top traders ranked by volume on AppSwap</p>
        </div>
        {/* Sort toggle */}
        <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-1 gap-0.5 shrink-0">
          {(['volume', 'pnl'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                sortBy === s ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {s === 'volume' ? 'Volume' : 'PnL'}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by wallet address…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-brand-600 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-600">No matching addresses found</div>
      ) : (
        <>
          {/* Top 3 podium */}
          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {top3.map((t, i) => (
                <div
                  key={t.address}
                  className={`relative rounded-xl border bg-gradient-to-b ${TOP_BG[i]} p-4 flex flex-col items-center gap-2`}
                >
                  {/* Rank badge */}
                  <span className={`text-xs font-black tracking-widest ${TOP_RANK_COLOR[i]}`}>
                    {MEDALS[i]}
                  </span>

                  {/* Avatar placeholder */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                    i === 0 ? 'bg-yellow-900/40 border-yellow-700/50 text-yellow-400'
                    : i === 1 ? 'bg-gray-800 border-gray-600 text-gray-300'
                    : 'bg-orange-900/30 border-orange-800/50 text-orange-400'
                  }`}>
                    {t.address.slice(2, 4).toUpperCase()}
                  </div>

                  <span className="font-mono text-xs text-gray-300">{t.address}</span>

                  {/* PnL */}
                  <div className={`text-sm font-semibold tabular-nums ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtUSD(t.pnl, true)}
                  </div>

                  {/* Volume */}
                  <div className="text-center">
                    <div className="text-xs font-medium text-gray-200 tabular-nums">{fmtVolume(t.volume)}</div>
                    <div className="text-[10px] text-gray-600">Volume</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Ranks 4+ table */}
          {rest.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[3rem_1fr_1fr_1fr] items-center px-4 py-2.5 border-b border-gray-800 text-[10px] uppercase tracking-wider text-gray-600">
                <span>#</span>
                <span>Address</span>
                <span className="text-right">PnL</span>
                <span className="text-right">Volume</span>
              </div>

              <div className="divide-y divide-gray-800/60">
                {rest.map(t => (
                  <div
                    key={t.address}
                    className="grid grid-cols-[3rem_1fr_1fr_1fr] items-center px-4 py-3 hover:bg-gray-800/40 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-500 tabular-nums">{t.rank}</span>

                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-400 shrink-0">
                        {t.address.slice(2, 4).toUpperCase()}
                      </div>
                      <span className="font-mono text-xs text-gray-300">{t.address}</span>
                    </div>

                    <div className={`text-right text-sm font-medium tabular-nums ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmtUSD(t.pnl, true)}
                    </div>

                    <div className="text-right text-sm text-gray-300 tabular-nums">
                      {fmtVolume(t.volume)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <p className="text-[10px] text-gray-700 text-center pb-2">
        Last updated: 27 Mar 2026 3:33 PM
        {' '}•{' '}
        Excludes accounts with &lt;$10k volume
        {' '}•{' '}
        <span className="text-yellow-700">Mock data</span>
      </p>
    </div>
  )
}
