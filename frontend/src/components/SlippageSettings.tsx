import { useState } from 'react'
import type { ImpactLevel } from '../hooks/useQuote'

interface Props {
  slippage:    number       // basis points (e.g. 50 = 0.5%)
  onChange:    (bps: number) => void
  impactLevel?: ImpactLevel  // supplied by SwapUI once a quote exists
  impactPct?:  string        // e.g. "2.34"
}

const PRESETS = [
  { label: '0.1%', bps: 10  },
  { label: '0.5%', bps: 50  },
  { label: '1.0%', bps: 100 },
]

export function SlippageSettings({ slippage, onChange, impactLevel, impactPct }: Props) {
  const [open, setOpen] = useState(false)
  const customVal = PRESETS.some(p => p.bps === slippage) ? '' : (slippage / 100).toFixed(2)

  // Warn if user's tolerance is tighter than the current price impact
  const impactBps     = impactPct ? Math.round(parseFloat(impactPct) * 100) : 0
  const tooTight      = impactBps > 0 && slippage < impactBps
  const dangerousHigh = slippage > 500  // > 5%

  const labelColor = dangerousHigh
    ? 'text-red-400'
    : tooTight
    ? 'text-yellow-400'
    : 'text-gray-400'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg
                    bg-gray-800 border transition-colors
                    ${dangerousHigh ? 'border-red-700' : tooTight ? 'border-yellow-700' : 'border-gray-700'}
                    hover:bg-gray-700`}
      >
        <svg className={`w-3.5 h-3.5 ${labelColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <span className={labelColor}>{(slippage / 100).toFixed(2)}%</span>
        {(dangerousHigh || tooTight) && <span className={dangerousHigh ? 'text-red-400' : 'text-yellow-400'}>⚠</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-20 w-72 bg-gray-900 border border-gray-700
                          rounded-2xl shadow-2xl p-4">
            <p className="text-xs font-semibold text-gray-300 mb-3">Slippage tolerance</p>

            <div className="flex items-center gap-2 mb-3">
              {PRESETS.map(p => (
                <button
                  key={p.bps}
                  type="button"
                  onClick={() => onChange(p.bps)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${slippage === p.bps
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
              <input
                type="number"
                min="0.01"
                max="50"
                step="0.01"
                placeholder="Custom"
                value={customVal}
                onChange={e => {
                  const v = parseFloat(e.target.value)
                  if (!isNaN(v) && v > 0 && v <= 50) onChange(Math.round(v * 100))
                }}
                className="flex-1 bg-transparent text-xs text-gray-100 focus:outline-none min-w-0"
              />
              <span className="text-xs text-gray-400">%</span>
            </div>

            {tooTight && (
              <p className="mt-3 text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded-lg px-3 py-2">
                Your slippage ({(slippage / 100).toFixed(2)}%) is less than the price impact ({impactPct}%).
                The transaction will likely revert.
              </p>
            )}
            {dangerousHigh && (
              <p className="mt-3 text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
                High slippage set ({(slippage / 100).toFixed(2)}%). You may receive significantly less than quoted.
              </p>
            )}

            <div className="mt-3 pt-3 border-t border-gray-800 space-y-1">
              <InfoRow label="Your tolerance" value={`${(slippage / 100).toFixed(2)}%`} />
              {impactPct && (
                <InfoRow
                  label="Price impact"
                  value={`${impactPct}%`}
                  color={impactLevel === 'high' ? 'text-red-400' : impactLevel === 'medium' ? 'text-yellow-400' : 'text-green-400'}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function InfoRow({ label, value, color = 'text-gray-300' }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-medium ${color}`}>{value}</span>
    </div>
  )
}
