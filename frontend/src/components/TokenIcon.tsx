import { useState } from 'react'
import type { Token } from '../constants'

interface Props {
  token: Token
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_MAP = {
  sm:  'w-5 h-5 text-[9px]',
  md:  'w-7 h-7 text-xs',
  lg:  'w-9 h-9 text-sm',
  xl:  'w-12 h-12 text-base',
}

export function TokenIcon({ token, size = 'md', className = '' }: Props) {
  const [imgError, setImgError] = useState(false)
  const sizeClass = SIZE_MAP[size]

  if (token.logoUrl && !imgError) {
    return (
      <img
        src={token.logoUrl}
        alt={token.symbol}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover shrink-0 ${className}`}
      />
    )
  }

  // Fallback: colored letter avatar
  return (
    <span className={`${sizeClass} rounded-full ${token.color} flex items-center justify-center font-bold text-white shrink-0 ${className}`}>
      {token.symbol[0]}
    </span>
  )
}
