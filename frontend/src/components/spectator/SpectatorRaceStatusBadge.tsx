import {
  getSpectatorRaceStatusClasses,
  getSpectatorRaceStatusLabel,
} from './spectatorRaceStatus'

interface SpectatorRaceStatusBadgeProps {
  status: string
  label?: string
}

export default function SpectatorRaceStatusBadge({
  status,
  label,
}: SpectatorRaceStatusBadgeProps) {
  const normalizedStatus = status.toLowerCase()
  const colorClasses = getSpectatorRaceStatusClasses(status)

  return (
    <span
      data-race-status={normalizedStatus}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${colorClasses}`}
    >
      {normalizedStatus === 'live' && (
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      )}
      {normalizedStatus === 'official' && <span aria-hidden="true">✓</span>}
      <span>{label ?? getSpectatorRaceStatusLabel(status)}</span>
    </span>
  )
}
