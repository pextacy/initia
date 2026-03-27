import { useState, useEffect, useRef } from 'react'
import { createPublicClient, http, isAddress } from 'viem'
import { TOKENS, RPC_URL, type Token } from '../constants'
import { TokenIcon } from './TokenIcon'

const client = createPublicClient({ transport: http(RPC_URL) })

const ERC20_META_ABI = [
  { name: 'symbol',   type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { name: 'name',     type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8'  }] },
] as const

const COLORS = [
  'bg-purple-500', 'bg-pink-500', 'bg-teal-500', 'bg-cyan-500',
  'bg-lime-500',   'bg-amber-500','bg-rose-500', 'bg-sky-500',
]
function colorFor(addr: string) {
  let h = 0
  for (let i = 0; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) & 0xffffffff
  return COLORS[Math.abs(h) % COLORS.length]
}

function loadCustom(): Token[] {
  try { return JSON.parse(localStorage.getItem('custom_tokens') ?? '[]') } catch { return [] }
}
function saveCustom(list: Token[]) {
  localStorage.setItem('custom_tokens', JSON.stringify(list))
}

interface Props {
  selected:  Token | undefined
  onChange:  (token: Token) => void
  exclude?:  string
  label:     string
}

export function TokenSelector({ selected, onChange, exclude, label }: Props) {
  const [open,         setOpen]         = useState(false)
  const [search,       setSearch]       = useState('')
  const [customTokens, setCustomTokens] = useState<Token[]>(loadCustom)
  const [importing,    setImporting]    = useState(false)
  const [importError,  setImportError]  = useState('')
  const [importPreview, setImportPreview] = useState<Token | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const trimmed     = search.trim()
  const looksLikeAddr = isAddress(trimmed)

  const allTokens = [...TOKENS, ...customTokens]
  const available = allTokens
    .filter(t => t.address.toLowerCase() !== exclude?.toLowerCase())
    .filter(t => {
      if (!trimmed) return true
      return (
        t.symbol.toLowerCase().includes(trimmed.toLowerCase()) ||
        t.name.toLowerCase().includes(trimmed.toLowerCase()) ||
        t.address.toLowerCase() === trimmed.toLowerCase()
      )
    })

  // When search is a valid address not already in list, try to resolve it
  useEffect(() => {
    if (!looksLikeAddr) { setImportPreview(null); setImportError(''); return }
    const already = allTokens.find(t => t.address.toLowerCase() === trimmed.toLowerCase())
    if (already) { setImportPreview(null); return }

    setImportPreview(null)
    setImportError('')
    setImporting(true)

    ;(async () => {
      try {
        const addr = trimmed as `0x${string}`
        const [symbol, name, decimals] = await Promise.all([
          client.readContract({ address: addr, abi: ERC20_META_ABI, functionName: 'symbol'   }),
          client.readContract({ address: addr, abi: ERC20_META_ABI, functionName: 'name'     }),
          client.readContract({ address: addr, abi: ERC20_META_ABI, functionName: 'decimals' }),
        ])
        setImportPreview({
          address:  trimmed,
          symbol:   symbol as string,
          name:     name as string,
          decimals: Number(decimals),
          color:    colorFor(trimmed),
        })
      } catch {
        setImportError('Could not resolve token — check the address or RPC')
      } finally {
        setImporting(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed])

  function addAndSelect(token: Token) {
    const updated = [...customTokens.filter(t => t.address !== token.address), token]
    setCustomTokens(updated)
    saveCustom(updated)
    onChange(token)
    setOpen(false)
    setSearch('')
  }

  function removeCustom(addr: string, e: React.MouseEvent) {
    e.stopPropagation()
    const updated = customTokens.filter(t => t.address !== addr)
    setCustomTokens(updated)
    saveCustom(updated)
  }

  function openModal() {
    setSearch('')
    setImportPreview(null)
    setImportError('')
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  return (
    <>
      {/* Trigger button */}
      <div>
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <button
          type="button"
          onClick={openModal}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700
                     rounded-xl px-3 py-2 transition-colors min-w-[130px]"
        >
          {selected ? (
            <>
              <TokenIcon token={selected} size="sm" />
              <span className="font-semibold text-sm text-gray-100 truncate">{selected.symbol}</span>
            </>
          ) : (
            <span className="text-gray-400 text-sm">Select token</span>
          )}
          <svg className="w-3.5 h-3.5 text-gray-500 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-base font-semibold text-gray-100">Select token</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pb-3">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                     fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search name, symbol or paste address (0x…)"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm
                             text-gray-100 placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {/* Common tokens (only shown when no search) */}
            {!trimmed && (
              <div className="px-4 pb-3">
                <p className="text-xs text-gray-500 mb-2">Common tokens</p>
                <div className="flex flex-wrap gap-1.5">
                  {TOKENS.filter(t => t.address.toLowerCase() !== exclude?.toLowerCase()).map(t => (
                    <button
                      key={t.address}
                      type="button"
                      onClick={() => { onChange(t); setOpen(false) }}
                      className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700
                                 rounded-full px-3 py-1 text-sm font-medium text-gray-200 transition-colors"
                    >
                      <TokenIcon token={t} size="sm" />
                      {t.symbol}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-gray-800" />

            {/* Token list */}
            <div className="overflow-y-auto max-h-64">
              {available.length === 0 && !looksLikeAddr && (
                <p className="text-center text-xs text-gray-500 py-6">No tokens found</p>
              )}

              {available.map(token => {
                const isCustom = customTokens.some(c => c.address === token.address)
                return (
                  <button
                    key={token.address}
                    type="button"
                    onClick={() => { onChange(token); setOpen(false); setSearch('') }}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-800 transition-colors group"
                  >
                    <TokenIcon token={token} size="lg" />
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-100">{token.symbol}</p>
                      <p className="text-xs text-gray-500 truncate">{token.name}</p>
                    </div>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={e => removeCustom(token.address, e)}
                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs"
                        title="Remove custom token"
                      >
                        ✕
                      </button>
                    )}
                  </button>
                )
              })}

              {/* Import preview when address typed */}
              {looksLikeAddr && !available.some(t => t.address.toLowerCase() === trimmed.toLowerCase()) && (
                <div className="px-5 py-3 border-t border-gray-800">
                  {importing && (
                    <p className="text-xs text-gray-500 animate-pulse">Resolving token…</p>
                  )}
                  {importError && !importing && (
                    <div>
                      <p className="text-xs text-red-400 mb-2">{importError}</p>
                      <p className="text-xs text-gray-600">You can still import with placeholder metadata:</p>
                      <button
                        type="button"
                        onClick={() => addAndSelect({
                          address:  trimmed,
                          symbol:   `${trimmed.slice(0, 6)}…`,
                          name:     'Unknown token',
                          decimals: 18,
                          color:    colorFor(trimmed),
                        })}
                        className="mt-2 text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors"
                      >
                        Import anyway →
                      </button>
                    </div>
                  )}
                  {importPreview && !importing && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <TokenIcon token={importPreview} size="lg" />
                        <div>
                          <p className="text-sm font-semibold text-gray-100">{importPreview.symbol}</p>
                          <p className="text-xs text-gray-500">{importPreview.name}</p>
                          <p className="text-xs text-gray-600 font-mono">{trimmed.slice(0, 10)}…{trimmed.slice(-6)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addAndSelect(importPreview)}
                        className="shrink-0 text-xs bg-brand-600 hover:bg-brand-500 text-white font-medium
                                   px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Import
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer note */}
            {customTokens.length > 0 && !trimmed && (
              <div className="border-t border-gray-800 px-5 py-2">
                <p className="text-xs text-gray-600">{customTokens.length} custom token{customTokens.length !== 1 ? 's' : ''} imported</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
