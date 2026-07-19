import { useEffect, useState } from 'react'
import type { LiveRaceEntry, RaceLiveStatus } from '../services/spectatorService'

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const isEntryInactive = (entry: LiveRaceEntry) => {
  const status = entry.status.toLowerCase()
  return entry.isWithdrawn || status === 'cancelled' || status === 'disqualified'
}

const stableOffset = (raceEntryId: number) => {
  const seed = ((raceEntryId * 9301 + 49297) % 233280) / 233280
  return seed * 2 - 1
}

const resultProgress = (finishPosition: number | null) => {
  if (finishPosition == null) return 0.9
  return clamp(1 - (finishPosition - 1) * 0.012, 0.9, 1)
}

export function useLiveRaceProgress(race: RaceLiveStatus | null) {
  const [now, setNow] = useState(() => Date.now())
  const status = race?.status.toLowerCase() ?? ''

  useEffect(() => {
    if (status !== 'live' && status !== 'upcoming') return
    const timer = window.setInterval(() => setNow(Date.now()), status === 'live' ? 100 : 1000)
    return () => window.clearInterval(timer)
  }, [status, race?.raceId])

  const scheduledAt = race?.scheduledTime ? new Date(race.scheduledTime).getTime() : null
  const startedAt = race?.actualStartTime ? new Date(race.actualStartTime).getTime() : null
  const duration = race?.raceDurationSeconds ?? 0
  const elapsedSeconds = startedAt ? Math.max(0, (now - startedAt) / 1000) : 0
  const baseProgress = status === 'live' && startedAt && duration > 0
    ? clamp(elapsedSeconds / duration, 0, 1)
    : 0
  const countdownSeconds = status === 'upcoming' && scheduledAt
    ? Math.max(0, Math.ceil((scheduledAt - now) / 1000))
    : null
  const hasTimingData = Boolean(startedAt && duration > 0)
  const progressByEntry: Record<number, number> = {}
  const isResultStatus = ['unofficial', 'official', 'completed'].includes(status)

  for (const entry of race?.entries ?? []) {
    if (isEntryInactive(entry)) {
      progressByEntry[entry.raceEntryId] = 0
      continue
    }
    if (isResultStatus) {
      progressByEntry[entry.raceEntryId] = resultProgress(entry.finishPosition)
      continue
    }
    if (status !== 'live' || !hasTimingData) {
      progressByEntry[entry.raceEntryId] = 0
      continue
    }

    const offset = stableOffset(entry.raceEntryId)
    const movement = Math.sin(elapsedSeconds * 0.9 + offset * Math.PI) * 0.014
    const spread = offset * 0.025 * Math.sin(Math.PI * Math.min(baseProgress, 1))
    progressByEntry[entry.raceEntryId] = clamp(baseProgress + movement + spread, 0, 0.975)
  }

  return { elapsedSeconds, baseProgress, countdownSeconds, hasTimingData, progressByEntry }
}
