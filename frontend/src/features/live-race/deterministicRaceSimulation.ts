export const DETERMINISTIC_FINISH_THRESHOLD = 1
export const DETERMINISTIC_STOP_PROGRESS = 1.5
export const DETERMINISTIC_FIXED_STEP_MS = 100
export const DETERMINISTIC_MAXIMUM_CATCH_UP_STEPS = 3000
export const DETERMINISTIC_CURVE_SEGMENT_START = 0.15
export const DETERMINISTIC_CURVE_SEGMENT_END = 0.62

const minimumSpeed = 0.012
const maximumSpeed = 0.022
const finishingKickStart = 0.68
const finishingKickEnd = 0.95
const minimumPaceBias = -0.04
const maximumPaceBias = 0.04
const minimumWaveAmplitude = 0.01
const maximumWaveAmplitude = 0.025
const minimumWavePeriodSteps = 90
const maximumWavePeriodSteps = 160
const minimumCurveSurge = -0.03
const maximumCurveSurge = 0.03
const minimumFinalKick = 0.02
const maximumFinalKick = 0.06
const minimumPaceModifier = 0.94
const maximumPaceModifier = 1.06
const maximumEffectiveSpeed = maximumSpeed * maximumPaceModifier

export interface DeterministicRaceEntry {
  raceEntryId: number
  status: string
  isWithdrawn?: boolean
}

export interface DeterministicPaceProfile {
  curveSurge: number
  finalKick: number
  holdScore: number
  paceBias: number
  rawPaceBias: number
  waveAmplitude: number
  waveFrequency: number
  wavePhase: number
}

export interface DeterministicMotionState {
  finished: boolean
  finishElapsedMs: number | null
  paceProfile: DeterministicPaceProfile | null
  raceEntryId: number
  previousProgress: number
  progress: number
  speed: number
  targetSpeed: number
}

export interface DeterministicFinishResult {
  raceEntryId: number
  finishPosition: number
  finishElapsedMs: number
  finishTime: number
}

export interface DeterministicRaceSnapshot {
  elapsedMs: number
  eligibleEntryCount: number
  results: DeterministicFinishResult[]
  complete: boolean
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const smoothstep = (progress: number) => {
  const boundedProgress = clamp(progress, 0, 1)
  return boundedProgress * boundedProgress * (3 - 2 * boundedProgress)
}

const segmentEnvelope = (progress: number, start: number, end: number) => {
  if (progress <= start || progress >= end) return 0
  const localProgress = (progress - start) / (end - start)
  const smoothedProgress = smoothstep(localProgress)
  return 4 * smoothedProgress * (1 - smoothedProgress)
}

const mixUint32 = (value: number) => {
  let mixed = value >>> 0
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d)
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b)
  return (mixed ^ (mixed >>> 16)) >>> 0
}

const stableTagHash = (tag: string) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < tag.length; index += 1) {
    hash = Math.imul(hash ^ tag.charCodeAt(index), 0x01000193)
  }
  return hash >>> 0
}

export const deterministicUnitFromTag = (tag: string) =>
  mixUint32(stableTagHash(tag)) / 0x100000000

const deterministicAbility = (raceId: number, raceEntryId: number, tag: string) => {
  const seed = (
    Math.imul(Math.trunc(raceId), 0x9e3779b1)
    ^ Math.imul(Math.trunc(raceEntryId), 0x85ebca6b)
    ^ stableTagHash(tag)
  ) >>> 0
  return mixUint32(seed) / 0x100000000
}

const valueInRange = (unitValue: number, minimum: number, maximum: number) =>
  minimum + unitValue * (maximum - minimum)

export const createDeterministicPaceProfile = (
  raceId: number,
  raceEntryId: number
): DeterministicPaceProfile => {
  const rawPaceBias = valueInRange(
    deterministicAbility(raceId, raceEntryId, 'visual-pace-v1'),
    minimumPaceBias,
    maximumPaceBias
  )
  const wavePeriodSteps = valueInRange(
    deterministicAbility(raceId, raceEntryId, 'visual-wave-frequency-v1'),
    minimumWavePeriodSteps,
    maximumWavePeriodSteps
  )
  const holdHigh = deterministicAbility(raceId, raceEntryId, 'visual-hold-v1')
  const holdLow = deterministicAbility(raceId, raceEntryId, 'visual-hold-detail-v1')
  return {
    curveSurge: valueInRange(
      deterministicAbility(raceId, raceEntryId, 'visual-curve-v1'),
      minimumCurveSurge,
      maximumCurveSurge
    ),
    finalKick: valueInRange(
      deterministicAbility(raceId, raceEntryId, 'visual-kick-v1'),
      minimumFinalKick,
      maximumFinalKick
    ),
    holdScore: holdHigh + holdLow / 0x100000000,
    paceBias: rawPaceBias,
    rawPaceBias,
    waveAmplitude: valueInRange(
      deterministicAbility(raceId, raceEntryId, 'visual-wave-amplitude-v1'),
      minimumWaveAmplitude,
      maximumWaveAmplitude
    ),
    waveFrequency: Math.PI * 2 / wavePeriodSteps,
    wavePhase: deterministicAbility(
      raceId,
      raceEntryId,
      'visual-wave-phase-v1'
    ) * Math.PI * 2,
  }
}

export const normalizeDeterministicPaceProfiles = (
  profiles: DeterministicPaceProfile[]
) => {
  const averageRawPaceBias = profiles.length === 0
    ? 0
    : profiles.reduce((sum, profile) => sum + profile.rawPaceBias, 0) / profiles.length
  for (const profile of profiles) {
    profile.paceBias = clamp(
      profile.rawPaceBias - averageRawPaceBias,
      minimumPaceBias,
      maximumPaceBias
    )
  }
}

export const deterministicTargetSpeed = (
  raceId: number,
  raceEntryId: number,
  simulationStep: number
) => {
  const seed = (
    Math.imul(Math.trunc(raceId), 0x9e3779b1)
    ^ Math.imul(Math.trunc(raceEntryId), 0x85ebca6b)
    ^ Math.imul(simulationStep, 0xc2b2ae35)
  ) >>> 0
  const unitValue = mixUint32(seed) / 0x100000000
  return minimumSpeed + unitValue * (maximumSpeed - minimumSpeed)
}

const speedModifierForProgress = (
  progress: number,
  profile: DeterministicPaceProfile | null,
  simulationStep: number
) => {
  if (!profile) return 1
  const wave = profile.waveAmplitude * Math.sin(
    simulationStep * profile.waveFrequency + profile.wavePhase
  )
  const curveModifier = profile.curveSurge
    * segmentEnvelope(
      progress,
      DETERMINISTIC_CURVE_SEGMENT_START,
      DETERMINISTIC_CURVE_SEGMENT_END
    )
  const finalKickModifier = profile.finalKick
    * segmentEnvelope(progress, finishingKickStart, finishingKickEnd)
  return clamp(
    1 + profile.paceBias + wave + curveModifier + finalKickModifier,
    minimumPaceModifier,
    maximumPaceModifier
  )
}

export const effectiveDeterministicMotionSpeed = (
  state: DeterministicMotionState,
  simulationStep: number
) => Math.min(
  maximumEffectiveSpeed,
  state.speed * speedModifierForProgress(
    state.progress,
    state.paceProfile,
    simulationStep
  )
)

export const createDeterministicMotionState = (
  raceId: number,
  raceEntryId: number
): DeterministicMotionState => {
  const initialSpeed = deterministicTargetSpeed(raceId, raceEntryId, 0)
  return {
    finished: false,
    finishElapsedMs: null,
    paceProfile: null,
    raceEntryId,
    previousProgress: 0,
    progress: 0,
    speed: initialSpeed,
    targetSpeed: initialSpeed,
  }
}

export const resetDeterministicMotionState = (
  state: DeterministicMotionState,
  raceId: number
) => {
  const initialSpeed = deterministicTargetSpeed(raceId, state.raceEntryId, 0)
  state.finished = false
  state.finishElapsedMs = null
  state.previousProgress = 0
  state.progress = 0
  state.speed = initialSpeed
  state.targetSpeed = initialSpeed
}

export const advanceDeterministicMotionState = (
  state: DeterministicMotionState,
  raceId: number,
  simulationStep: number
) => {
  if (state.finished) return

  state.previousProgress = state.progress
  state.targetSpeed = deterministicTargetSpeed(raceId, state.raceEntryId, simulationStep)
  const smoothing = Math.min(1, DETERMINISTIC_FIXED_STEP_MS / 1000 * 2.5)
  state.speed += (state.targetSpeed - state.speed) * smoothing
  const effectiveSpeed = effectiveDeterministicMotionSpeed(state, simulationStep)
  const progressBeforeStep = state.progress
  state.progress = Math.min(
    DETERMINISTIC_STOP_PROGRESS,
    state.progress + effectiveSpeed * (DETERMINISTIC_FIXED_STEP_MS / 1000)
  )

  if (
    state.finishElapsedMs == null
    && progressBeforeStep < DETERMINISTIC_FINISH_THRESHOLD
    && state.progress >= DETERMINISTIC_FINISH_THRESHOLD
  ) {
    const stepProgress = state.progress - progressBeforeStep
    const crossingFraction = stepProgress <= 0
      ? 1
      : clamp(
          (DETERMINISTIC_FINISH_THRESHOLD - progressBeforeStep) / stepProgress,
          0,
          1
        )
    state.finishElapsedMs = simulationStep * DETERMINISTIC_FIXED_STEP_MS
      + crossingFraction * DETERMINISTIC_FIXED_STEP_MS
  }

  if (state.progress >= DETERMINISTIC_STOP_PROGRESS) {
    state.previousProgress = DETERMINISTIC_STOP_PROGRESS
    state.progress = DETERMINISTIC_STOP_PROGRESS
    state.speed = 0
    state.targetSpeed = 0
    state.finished = true
  }
}

export const isDeterministicRaceEntryEligible = (entry: DeterministicRaceEntry) => {
  const status = entry.status.trim().toLowerCase()
  return !entry.isWithdrawn
    && !['cancelled', 'withdrawn', 'disqualified'].includes(status)
}

export const parseRaceActualStartTimestamp = (value: string | null | undefined) => {
  if (!value?.trim()) return null
  const trimmed = value.trim()
  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(trimmed)
  const timestamp = Date.parse(hasTimezone ? trimmed : `${trimmed}Z`)
  return Number.isFinite(timestamp) ? timestamp : null
}

export const rankDeterministicFinishResults = (
  states: Iterable<DeterministicMotionState>
): DeterministicFinishResult[] => [...states]
  .flatMap((state) => state.finishElapsedMs == null
    ? []
    : [{
        raceEntryId: state.raceEntryId,
        finishElapsedMs: state.finishElapsedMs,
      }])
  .sort((left, right) =>
    left.finishElapsedMs - right.finishElapsedMs
    || left.raceEntryId - right.raceEntryId
  )
  .map((result, index) => ({
    ...result,
    finishPosition: index + 1,
    finishTime: Number((result.finishElapsedMs / 1000).toFixed(3)),
  }))

export const simulateDeterministicRace = ({
  raceId,
  entries,
  actualStartTime,
  now = Date.now(),
}: {
  raceId: number
  entries: DeterministicRaceEntry[]
  actualStartTime: string | null | undefined
  now?: number
}): DeterministicRaceSnapshot => {
  const eligibleEntries = entries.filter(isDeterministicRaceEntryEligible)
  const states = eligibleEntries.map((entry) => {
    const state = createDeterministicMotionState(raceId, entry.raceEntryId)
    state.paceProfile = createDeterministicPaceProfile(raceId, entry.raceEntryId)
    return state
  })
  normalizeDeterministicPaceProfiles(
    states
      .map((state) => state.paceProfile)
      .filter((profile): profile is DeterministicPaceProfile => profile != null)
  )

  const actualStartTimestamp = parseRaceActualStartTimestamp(actualStartTime)
  const elapsedMs = actualStartTimestamp == null ? 0 : Math.max(0, now - actualStartTimestamp)
  const elapsedSteps = Math.floor(elapsedMs / DETERMINISTIC_FIXED_STEP_MS)
  const stepsToRun = Math.min(elapsedSteps, DETERMINISTIC_MAXIMUM_CATCH_UP_STEPS)

  for (let simulationStep = 0; simulationStep < stepsToRun; simulationStep += 1) {
    for (const state of states) {
      advanceDeterministicMotionState(state, raceId, simulationStep)
    }
    if (states.length > 0 && states.every((state) => state.finished)) break
  }

  const results = rankDeterministicFinishResults(states)
  const complete = eligibleEntries.length > 0 && results.length === eligibleEntries.length
  return {
    elapsedMs: complete
      ? Math.max(...results.map((result) => result.finishElapsedMs))
      : elapsedMs,
    eligibleEntryCount: eligibleEntries.length,
    results,
    complete,
  }
}

export const formatDeterministicRaceTime = (elapsedMs: number) => {
  const totalMilliseconds = Math.max(0, Math.floor(elapsedMs))
  const minutes = Math.floor(totalMilliseconds / 60_000)
  const seconds = Math.floor(totalMilliseconds / 1_000) % 60
  const milliseconds = totalMilliseconds % 1_000
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`
}
