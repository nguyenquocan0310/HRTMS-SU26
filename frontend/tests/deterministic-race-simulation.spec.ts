import { expect, test } from '@playwright/test'
import {
  DETERMINISTIC_FIXED_STEP_MS,
  advanceDeterministicMotionState,
  createDeterministicMotionState,
  createDeterministicPaceProfile,
  normalizeDeterministicPaceProfiles,
  rankDeterministicFinishResults,
  simulateDeterministicRace,
} from '../src/features/live-race/deterministicRaceSimulation'

const entries = [
  { raceEntryId: 11, status: 'Confirmed', isWithdrawn: false },
  { raceEntryId: 12, status: 'Confirmed', isWithdrawn: false },
  { raceEntryId: 13, status: 'Confirmed', isWithdrawn: false },
  { raceEntryId: 14, status: 'Cancelled', isWithdrawn: false },
  { raceEntryId: 15, status: 'Confirmed', isWithdrawn: true },
  { raceEntryId: 16, status: 'Disqualified', isWithdrawn: false },
]

test('same race seed and elapsed time always produce the same ranking and finish times', () => {
  const now = Date.UTC(2026, 6, 23, 8, 5)
  const actualStartTime = new Date(now - 5 * 60_000).toISOString()
  const first = simulateDeterministicRace({ raceId: 10, entries, actualStartTime, now })
  const second = simulateDeterministicRace({ raceId: 10, entries, actualStartTime, now })

  expect(first).toEqual(second)
  expect(first.complete).toBe(true)
  expect(first.eligibleEntryCount).toBe(3)
  expect(first.results.map((item) => item.raceEntryId).sort()).toEqual([11, 12, 13])
  expect(first.results.map((item) => item.finishPosition)).toEqual([1, 2, 3])
})

test('catch-up snapshot matches the shared fixed-step engine used by the animation', () => {
  const raceId = 25
  const now = Date.UTC(2026, 6, 23, 9, 0)
  const actualStartTime = new Date(now - 30_000).toISOString()
  const snapshot = simulateDeterministicRace({ raceId, entries: entries.slice(0, 3), actualStartTime, now })
  const states = entries.slice(0, 3).map((entry) => {
    const state = createDeterministicMotionState(raceId, entry.raceEntryId)
    state.paceProfile = createDeterministicPaceProfile(raceId, entry.raceEntryId)
    return state
  })
  normalizeDeterministicPaceProfiles(states.flatMap((state) => state.paceProfile ? [state.paceProfile] : []))
  for (let step = 0; step < 30_000 / DETERMINISTIC_FIXED_STEP_MS; step += 1) {
    states.forEach((state) => advanceDeterministicMotionState(state, raceId, step))
  }

  expect(snapshot.results).toEqual(rankDeterministicFinishResults(states))
})

test('simulation never depends on Math.random', () => {
  const originalRandom = Math.random
  Math.random = () => {
    throw new Error('Math.random must not be called')
  }
  try {
    expect(() => simulateDeterministicRace({
      raceId: 30,
      entries: entries.slice(0, 3),
      actualStartTime: '2026-07-23T08:00:00Z',
      now: Date.parse('2026-07-23T08:05:00Z'),
    })).not.toThrow()
  } finally {
    Math.random = originalRandom
  }
})
