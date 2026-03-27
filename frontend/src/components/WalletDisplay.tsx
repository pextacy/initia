import { useUsernameQuery } from '@initia/interwovenkit-react'

interface Props {
  address: string
  className?: string
}

export function WalletDisplay({ address, className = '' }: Props) {
  const { data: username } = useUsernameQuery(address)

  const display = username
    ? username
    : `${address.slice(0, 6)}…${address.slice(-4)}`

  return (
    <span className={`font-mono text-sm ${className}`} title={address}>
      {display}
    </span>
  )
}
