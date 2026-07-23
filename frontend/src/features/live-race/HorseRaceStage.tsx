import { useEffect, useRef, useState, type ReactNode } from 'react'
import type {
  AnimatedSprite as PixiAnimatedSprite,
  Application as PixiApplication,
  Container as PixiContainer,
  Graphics as PixiGraphics,
  Text as PixiText,
  Ticker as PixiTicker,
  Texture as PixiTexture,
} from 'pixi.js'
import type { LiveRaceEntry, RaceLiveStatus } from '../../services/spectatorService'
import {
  DETERMINISTIC_FINISH_THRESHOLD,
  DETERMINISTIC_FIXED_STEP_MS,
  DETERMINISTIC_MAXIMUM_CATCH_UP_STEPS,
  DETERMINISTIC_STOP_PROGRESS,
  DETERMINISTIC_CURVE_SEGMENT_END,
  DETERMINISTIC_CURVE_SEGMENT_START,
  advanceDeterministicMotionState,
  createDeterministicMotionState,
  createDeterministicPaceProfile,
  deterministicUnitFromTag,
  deterministicTargetSpeed,
  effectiveDeterministicMotionSpeed,
  formatDeterministicRaceTime,
  isDeterministicRaceEntryEligible,
  normalizeDeterministicPaceProfiles,
  parseRaceActualStartTimestamp,
  rankDeterministicFinishResults,
  resetDeterministicMotionState,
  type DeterministicMotionState,
  type DeterministicPaceProfile,
} from './deterministicRaceSimulation'
import {
  acquirePixelHorseAssets,
  type PixelHorseAnimationName,
  type PixelHorseAssetBundle,
  type PixelHorseAssetLease,
} from './pixelHorseAssets'

type PixiModule = typeof import('pixi.js')

interface HorseRaceStageProps {
  race: RaceLiveStatus
  fallback?: ReactNode
}

const laneColors = [0x2563eb, 0x059669, 0xd97706, 0xe11d48, 0x7c3aed, 0x0891b2]
const laneHeight = 96
const stagePadding = 18
const trackHeaderHeight = 48
const finishThreshold = DETERMINISTIC_FINISH_THRESHOLD
// Halfway through the finish zone keeps the full 64px sprite beyond the line.
const stopProgress = DETERMINISTIC_STOP_PROGRESS
const finishApproachStart = 0.97
const fixedSimulationStepMs = DETERMINISTIC_FIXED_STEP_MS
const maximumCatchUpSteps = DETERMINISTIC_MAXIMUM_CATCH_UP_STEPS
const curveSegmentStart = DETERMINISTIC_CURVE_SEGMENT_START
const curveSegmentEnd = DETERMINISTIC_CURVE_SEGMENT_END
const effectiveMotionSpeed = effectiveDeterministicMotionSpeed
const wallClockCorrectionIntervalMs = 1000
const maximumDeltaMs = 250
const visualSafePadding = 6
const finishTweenDurationMs = 900
const finishTweenDelayMs = 140
const resultUpdateTweenDurationMs = 480
const resultUpdateTweenDelayMs = 70
const settledStopFrameIndex = 5
const stopFrameDurationMs = 120
const desiredFormationGapSpriteRatio = 0.75
const finishZoneTrackRatio = 0.18
const maximumFinishZoneSpriteWidths = 3
const minimumFinishFormationSpanPixels = 12
const minimumLiveTravelPixels = 24
const desktopCurveAmplitudeRange = { minimum: 8, maximum: 16 }
const mobileCurveAmplitudeRange = { minimum: 4, maximum: 8 }
const mobileTrackBreakpoint = 600
const desktopPathSampleCount = 48
const mobilePathSampleCount = 32
const countdownDurationMs = 3000
const goEffectDurationMs = 650
const desktopParticleCount = 22
const mobileParticleCount = 12
const particleColors = [0xfacc15, 0xffffff, 0xfb923c, 0x38bdf8]
const temporaryRankEpsilon = 0.002
const temporaryStandingUpdateIntervalMs = 350
// The measured sixth Idle cell is transparent in Horse I, Leash and Rider.
// Keep the original six-tick cadence while holding the last shared valid pose.
const idleFrameSequence = [0, 1, 2, 3, 4, 4] as const

const accessibleRaceStatus: Record<string, string> = {
  upcoming: 'sắp diễn ra',
  'pre-race': 'chờ xuất phát',
  live: 'đang diễn ra',
  unofficial: 'kết quả sơ bộ',
  official: 'kết quả chính thức',
  completed: 'đã hoàn tất với kết quả chính thức',
  cancelled: 'đã hủy',
}

interface TrackGeometry {
  startX: number
  finishLineX: number
  finishZoneEndX: number
  liveSafeEndX: number
  laneHeight: number
  curveAmplitude: number
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

const smoothstep = (progress: number) => {
  const boundedProgress = clamp(progress, 0, 1)
  return boundedProgress * boundedProgress * (3 - 2 * boundedProgress)
}

const curveAmplitudeForLayout = (width: number, currentLaneHeight: number) => {
  const range = width < mobileTrackBreakpoint
    ? mobileCurveAmplitudeRange
    : desktopCurveAmplitudeRange
  const responsiveAmplitude = Math.min(currentLaneHeight * 0.13, width * 0.015)
  return clamp(responsiveAmplitude, range.minimum, range.maximum)
}

const getRacePathPoint = (
  progress: number,
  laneBaseY: number,
  geometry: TrackGeometry
) => {
  const trackProgress = clamp(progress, 0, 1)
  const finishZoneProgress = clamp(progress - 1, 0, 1)
  const cappedLiveProgress = clamp(trackProgress / finishApproachStart, 0, 1)
  const finishApproachProgress = smoothstep(
    (trackProgress - finishApproachStart) / (finishThreshold - finishApproachStart)
  )
  const x = progress <= finishApproachStart
    ? geometry.startX
      + (geometry.liveSafeEndX - geometry.startX) * cappedLiveProgress
    : progress <= finishThreshold
      ? geometry.liveSafeEndX
        + (geometry.finishLineX - geometry.liveSafeEndX) * finishApproachProgress
      : geometry.finishLineX
        + (geometry.finishZoneEndX - geometry.finishLineX) * finishZoneProgress
  const curveLocalProgress = clamp(
    (trackProgress - curveSegmentStart) / (curveSegmentEnd - curveSegmentStart),
    0,
    1
  )
  const curveOffset = trackProgress >= curveSegmentStart && trackProgress <= curveSegmentEnd
    ? geometry.curveAmplitude
      * Math.sin(curveLocalProgress * Math.PI * 2)
      * Math.pow(Math.sin(curveLocalProgress * Math.PI), 2)
    : 0
  return {
    x,
    y: progress <= finishThreshold ? laneBaseY + curveOffset : laneBaseY,
  }
}

const sampleRacePath = (
  laneBaseY: number,
  geometry: TrackGeometry,
  sampleCount: number
) => Array.from({ length: sampleCount + 1 }, (_, index) =>
  getRacePathPoint(index / sampleCount, laneBaseY, geometry)
)

const motionProgressToPathProgress = (progress: number) =>
  clamp(progress, 0, stopProgress)

type FinishPhase = 'none' | 'tweening' | 'complete'
type CountdownPhase = 'idle' | 'running' | 'completed' | 'cancelled' | 'skipped'

interface FinishEntryTarget {
  raceEntryId: number
  finishPosition: number
  startProgress: number
  targetProgress: number
  delayMs: number
  durationMs: number
}

interface FinishSequenceState {
  entries: Map<number, FinishEntryTarget>
  phase: FinishPhase
  signature: string
  startedAt: number
}

interface FinishValidation {
  kind: 'not-result' | 'invalid' | 'valid'
  error: string
  positions: Map<number, number>
  signature: string
}

interface CountdownParticle {
  graphic: PixiGraphics
  lifetimeMs: number
  originX: number
  originY: number
  velocityX: number
  velocityY: number
}

interface CountdownVisual {
  container: PixiContainer
  overlayText: PixiText
  particles: CountdownParticle[]
  particlesCreated: boolean
}

interface CountdownState {
  activeStartSignature: string
  actualStartTimestamp: number | null
  hasBeenHiddenSincePreRace: boolean
  hasObservedPreRace: boolean
  phase: CountdownPhase
  previousRaceStatus: string
  processedSignatures: Set<string>
  raceId: number | null
  visual: CountdownVisual | null
}

interface SimulatedStanding {
  raceEntryId: number
  temporaryRank: number
  progress: number
}

interface TemporaryStandingsState {
  label: PixiContainer | null
  lastPublishedAt: number
  raceId: number | null
  ranks: Map<number, number>
}

interface HorseMotionState extends DeterministicMotionState {
  visualHoldProgress: number
}

const calculateSimulatedStandings = (
  motions: Array<Pick<HorseMotionState, 'progress' | 'raceEntryId'>>
): SimulatedStanding[] => {
  const sortedMotions = [...motions].sort(
    (left, right) => right.progress - left.progress
  )
  const standings: SimulatedStanding[] = []
  let groupProgress = Number.POSITIVE_INFINITY
  let groupRank = 0

  sortedMotions.forEach((motion, index) => {
    if (index === 0 || groupProgress - motion.progress >= temporaryRankEpsilon) {
      groupProgress = motion.progress
      groupRank = index + 1
    }
    standings.push({
      raceEntryId: motion.raceEntryId,
      temporaryRank: groupRank,
      progress: motion.progress,
    })
  })

  return standings
}

interface LayeredHorseVisual {
  container: PixiContainer
  finishTimeLabel: PixiText | null
  frameSequence: readonly number[]
  geometry: TrackGeometry
  inactive: boolean
  laneBaseY: number
  layers: [PixiAnimatedSprite, PixiAnimatedSprite, PixiAnimatedSprite]
  playback: 'loop' | 'once' | 'stopped' | 'manual'
  raceEntryId: number
  resultBadge: PixiContainer | null
  resultBadgeMinimumX: number
  resultBadgeOffsetX: number
  settledFrameIndex: number
  stopFrameCount: number
  stopStartedAt: number | null
  stopTextures: [PixiTexture[], PixiTexture[], PixiTexture[]]
  temporaryRankBackground: PixiGraphics | null
  temporaryRankBadge: PixiContainer | null
  temporaryRankHeight: number
  temporaryRankText: PixiText | null
  temporaryRankWidth: number
  usingStopTextures: boolean
  winnerHighlight: PixiContainer | null
}

interface TemporaryFinishResult {
  finishElapsedMs: number
  finishPosition: number
  raceEntryId: number
}

interface RaceTimingSnapshot {
  elapsedMs: number
  results: TemporaryFinishResult[]
}

interface MasterAnimationController {
  countdown: CountdownState
  elapsedMs: number
  frameDurationMs: number
  motionRaceId: number | null
  motionStates: Map<number, HorseMotionState>
  motionStartTimestamp: number | null
  motionStatus: string
  lastWallClockCorrectionAt: number
  simulationAccumulatorMs: number
  simulationInitialized: boolean
  simulationStep: number
  step: number
  temporaryStandings: TemporaryStandingsState
  visuals: LayeredHorseVisual[]
  finish: FinishSequenceState
  reducedMotion: boolean
}

const createMasterAnimation = (): MasterAnimationController => ({
  countdown: {
    activeStartSignature: '',
    actualStartTimestamp: null,
    hasBeenHiddenSincePreRace: false,
    hasObservedPreRace: false,
    phase: 'idle',
    previousRaceStatus: '',
    processedSignatures: new Set(),
    raceId: null,
    visual: null,
  },
  elapsedMs: 0,
  frameDurationMs: 160,
  motionRaceId: null,
  motionStates: new Map(),
  motionStartTimestamp: null,
  motionStatus: '',
  lastWallClockCorrectionAt: 0,
  simulationAccumulatorMs: 0,
  simulationInitialized: false,
  simulationStep: 0,
  step: 0,
  temporaryStandings: {
    label: null,
    lastPublishedAt: 0,
    raceId: null,
    ranks: new Map(),
  },
  visuals: [],
  finish: {
    entries: new Map(),
    phase: 'none',
    signature: '',
    startedAt: 0,
  },
  reducedMotion: false,
})

const createVisualPaceProfile = createDeterministicPaceProfile
const parseActualStartTimestamp = parseRaceActualStartTimestamp

const countdownStartSignature = (raceId: number, actualStartTimestamp: number) =>
  `${raceId}:${actualStartTimestamp}`

const destroyCountdownVisual = (countdown: CountdownState) => {
  const visual = countdown.visual
  if (!visual) return
  visual.container.removeFromParent()
  visual.container.destroy({ children: true })
  countdown.visual = null
}

const resetCountdownForRace = (
  countdown: CountdownState,
  race: RaceLiveStatus,
  visibilityState: DocumentVisibilityState
) => {
  destroyCountdownVisual(countdown)
  countdown.activeStartSignature = ''
  countdown.actualStartTimestamp = null
  countdown.hasBeenHiddenSincePreRace = false
  countdown.hasObservedPreRace = false
  countdown.phase = 'idle'
  countdown.previousRaceStatus = race.status.toLowerCase()
  countdown.processedSignatures.clear()
  countdown.raceId = race.raceId

  if (countdown.previousRaceStatus === 'pre-race') {
    countdown.hasObservedPreRace = true
    countdown.hasBeenHiddenSincePreRace = visibilityState !== 'visible'
    return
  }

  if (countdown.previousRaceStatus === 'live') {
    const actualStartTimestamp = parseActualStartTimestamp(race.actualStartTime)
    if (actualStartTimestamp != null) {
      const signature = countdownStartSignature(race.raceId, actualStartTimestamp)
      countdown.activeStartSignature = signature
      countdown.actualStartTimestamp = actualStartTimestamp
      countdown.processedSignatures.add(signature)
    }
    countdown.phase = 'skipped'
  }
}

const observeRaceForCountdown = (
  countdown: CountdownState,
  race: RaceLiveStatus,
  visibilityState: DocumentVisibilityState,
  now = Date.now()
) => {
  if (countdown.raceId !== race.raceId) {
    resetCountdownForRace(countdown, race, visibilityState)
    return
  }

  const status = race.status.toLowerCase()
  const previousStatus = countdown.previousRaceStatus
  const actualStartTimestamp = parseActualStartTimestamp(race.actualStartTime)
  const signature = actualStartTimestamp == null
    ? ''
    : countdownStartSignature(race.raceId, actualStartTimestamp)

  if (status === 'pre-race') {
    if (previousStatus !== 'pre-race') {
      countdown.hasObservedPreRace = true
      countdown.hasBeenHiddenSincePreRace = visibilityState !== 'visible'
      countdown.phase = 'idle'
    }
  } else if (previousStatus === 'pre-race' && status === 'live') {
    const elapsedMs = actualStartTimestamp == null ? -1 : now - actualStartTimestamp
    const eligible = countdown.hasObservedPreRace
      && !countdown.hasBeenHiddenSincePreRace
      && visibilityState === 'visible'
      && signature !== ''
      && !countdown.processedSignatures.has(signature)
      && elapsedMs >= 0
      && elapsedMs < countdownDurationMs

    countdown.activeStartSignature = signature
    countdown.actualStartTimestamp = actualStartTimestamp
    if (signature !== '') countdown.processedSignatures.add(signature)
    countdown.phase = eligible ? 'running' : 'skipped'
  } else if (status === 'live' && signature !== countdown.activeStartSignature) {
    if (countdown.phase === 'running') countdown.phase = 'cancelled'
    countdown.activeStartSignature = signature
    countdown.actualStartTimestamp = actualStartTimestamp
    if (signature !== '') countdown.processedSignatures.add(signature)
    if (countdown.phase === 'idle') countdown.phase = 'skipped'
  } else if (countdown.phase === 'running' && status !== 'live') {
    countdown.phase = 'cancelled'
  }

  if (countdown.phase !== 'running') destroyCountdownVisual(countdown)
  countdown.previousRaceStatus = status
}

const handleCountdownHidden = (
  countdown: CountdownState,
  race: RaceLiveStatus
) => {
  if (race.status.toLowerCase() === 'pre-race' && countdown.hasObservedPreRace) {
    countdown.hasBeenHiddenSincePreRace = true
  }
  if (countdown.phase !== 'running') return
  countdown.phase = 'cancelled'
  destroyCountdownVisual(countdown)
}

const createMotionState = (raceId: number, raceEntryId: number): HorseMotionState => {
  return {
    ...createDeterministicMotionState(raceId, raceEntryId),
    visualHoldProgress: stopProgress,
  }
}

const resetMotionState = (state: HorseMotionState, raceId: number) => {
  resetDeterministicMotionState(state, raceId)
  state.visualHoldProgress = stopProgress
}

const advanceMotionState = advanceDeterministicMotionState

const catchUpMotion = (
  master: MasterAnimationController,
  race: RaceLiveStatus,
  elapsedMs: number
) => {
  const elapsedSteps = Math.floor(Math.max(0, elapsedMs) / fixedSimulationStepMs)
  const stepsToRun = Math.min(elapsedSteps, maximumCatchUpSteps)
  const activeEntries = race.entries.filter((entry) => !isInactive(entry))

  for (const state of master.motionStates.values()) resetMotionState(state, race.raceId)

  let completedSteps = 0
  for (let simulationStep = 0; simulationStep < stepsToRun; simulationStep += 1) {
    for (const entry of activeEntries) {
      const state = master.motionStates.get(entry.raceEntryId)
      if (state) advanceMotionState(state, race.raceId, simulationStep)
    }
    completedSteps = simulationStep + 1

    if (
      activeEntries.length > 0
      && activeEntries.every((entry) =>
        master.motionStates.get(entry.raceEntryId)?.finished === true
      )
    ) {
      completedSteps = elapsedSteps
      break
    }
  }

  master.simulationStep = completedSteps
  master.simulationAccumulatorMs = elapsedSteps <= maximumCatchUpSteps || completedSteps === elapsedSteps
    ? Math.max(0, elapsedMs) % fixedSimulationStepMs
    : 0

  for (const entry of race.entries) {
    if (!isInactive(entry)) continue
    const state = master.motionStates.get(entry.raceEntryId)
    if (state) {
      state.previousProgress = 0
      state.progress = 0
      state.speed = 0
      state.targetSpeed = 0
      state.finished = false
      state.finishElapsedMs = null
    }
  }
}

const activeMotionEntries = (race: RaceLiveStatus) =>
  race.entries.filter((entry) => !isInactive(entry))

const temporaryFinishResults = (
  master: MasterAnimationController,
  race: RaceLiveStatus
): TemporaryFinishResult[] => rankDeterministicFinishResults(
  activeMotionEntries(race)
    .map((entry) => master.motionStates.get(entry.raceEntryId))
    .filter((state): state is HorseMotionState => state != null)
).map(({ raceEntryId, finishElapsedMs, finishPosition }) => ({
  raceEntryId,
  finishElapsedMs,
  finishPosition,
}))

const raceTimingSnapshot = (
  master: MasterAnimationController,
  race: RaceLiveStatus,
  previous: RaceTimingSnapshot,
  now = Date.now()
): RaceTimingSnapshot => {
  const status = race.status.toLowerCase()
  if (status === 'upcoming' || status === 'pre-race') {
    return { elapsedMs: 0, results: [] }
  }

  const results = temporaryFinishResults(master, race)
  if (status === 'live') {
    const activeEntryCount = activeMotionEntries(race).length
    const allEntriesCrossed = activeEntryCount > 0 && results.length === activeEntryCount
    const actualStartTimestamp = parseActualStartTimestamp(race.actualStartTime)
    const elapsedMs = allEntriesCrossed
      ? Math.max(...results.map((result) => result.finishElapsedMs))
      : actualStartTimestamp == null
        ? 0
        : Math.max(0, now - actualStartTimestamp)
    return { elapsedMs, results }
  }

  return results.length > 0
    ? {
        elapsedMs: Math.max(...results.map((result) => result.finishElapsedMs)),
        results,
      }
    : previous
}

const sameTimingSnapshot = (left: RaceTimingSnapshot, right: RaceTimingSnapshot) =>
  Math.floor(left.elapsedMs) === Math.floor(right.elapsedMs)
  && left.results.length === right.results.length
  && left.results.every((result, index) => {
    const other = right.results[index]
    return other != null
      && result.raceEntryId === other.raceEntryId
      && result.finishPosition === other.finishPosition
      && result.finishElapsedMs === other.finishElapsedMs
  })

const formatRaceClock = formatDeterministicRaceTime

const displayedFixedStepProgress = (state: HorseMotionState) =>
  Math.min(state.progress, state.visualHoldProgress)

const syncVisualHoldProgress = (master: MasterAnimationController) => {
  for (const state of master.motionStates.values()) {
    state.visualHoldProgress = stopProgress
  }
}

const allActiveEntriesAtLimit = (
  master: MasterAnimationController,
  entries: LiveRaceEntry[]
) => entries.length === 0 || entries.every((entry) =>
  master.motionStates.get(entry.raceEntryId)?.finished === true
)

const catchUpMissingSteps = (
  master: MasterAnimationController,
  race: RaceLiveStatus,
  desiredStep: number
) => {
  if (desiredStep <= master.simulationStep) return

  const activeEntries = activeMotionEntries(race)
  if (allActiveEntriesAtLimit(master, activeEntries)) {
    master.simulationStep = desiredStep
    return
  }

  const finalStep = Math.min(desiredStep, master.simulationStep + maximumCatchUpSteps)
  while (master.simulationStep < finalStep) {
    for (const entry of activeEntries) {
      const state = master.motionStates.get(entry.raceEntryId)
      if (state) advanceMotionState(state, race.raceId, master.simulationStep)
    }
    master.simulationStep += 1

    if (allActiveEntriesAtLimit(master, activeEntries)) {
      master.simulationStep = desiredStep
      break
    }
  }
}

const correctMotionToWallClock = (
  master: MasterAnimationController,
  race: RaceLiveStatus,
  now = Date.now()
) => {
  master.lastWallClockCorrectionAt = now
  if (
    race.status.toLowerCase() !== 'live'
    || !master.simulationInitialized
    || master.motionStartTimestamp == null
  ) return false

  const elapsedMs = Math.max(0, now - master.motionStartTimestamp)
  const desiredStep = Math.floor(elapsedMs / fixedSimulationStepMs)
  const previousStep = master.simulationStep
  catchUpMissingSteps(master, race, desiredStep)

  if (master.simulationStep === desiredStep) {
    const desiredRemainder = elapsedMs % fixedSimulationStepMs
    master.simulationAccumulatorMs = previousStep < desiredStep
      ? desiredRemainder
      : Math.max(master.simulationAccumulatorMs, desiredRemainder)
  }

  return master.simulationStep !== previousStep
}

const syncMotionStates = (master: MasterAnimationController, race: RaceLiveStatus) => {
  const status = race.status.toLowerCase()
  const raceChanged = master.motionRaceId !== race.raceId
  const enteringLive = status === 'live' && master.motionStatus !== 'live'
  const actualStartTimestamp = parseActualStartTimestamp(race.actualStartTime)
  const startTimeChanged = master.motionStartTimestamp !== actualStartTimestamp

  if (raceChanged) {
    master.motionRaceId = race.raceId
    master.motionStates.clear()
    master.motionStartTimestamp = actualStartTimestamp
    master.lastWallClockCorrectionAt = 0
    master.simulationAccumulatorMs = 0
    master.simulationInitialized = false
    master.simulationStep = 0
  }

  const currentEntryIds = new Set(race.entries.map((entry) => entry.raceEntryId))
  for (const raceEntryId of master.motionStates.keys()) {
    if (!currentEntryIds.has(raceEntryId)) master.motionStates.delete(raceEntryId)
  }

  for (const entry of race.entries) {
    let state = master.motionStates.get(entry.raceEntryId)
    const isNewState = !state
    if (!state) {
      state = createMotionState(race.raceId, entry.raceEntryId)
      master.motionStates.set(entry.raceEntryId, state)
    }

    const inactive = isInactive(entry)
    if (inactive) {
      state.paceProfile = null
      state.visualHoldProgress = stopProgress
    } else if (!state.paceProfile) {
      state.paceProfile = createVisualPaceProfile(race.raceId, entry.raceEntryId)
    }
    if (status === 'upcoming' || status === 'pre-race') {
      resetMotionState(state, race.raceId)
    } else if (inactive || status !== 'live') {
      state.speed = 0
      state.targetSpeed = 0
    } else if (isNewState && master.simulationInitialized) {
      for (
        let simulationStep = 0;
        simulationStep < Math.min(master.simulationStep, maximumCatchUpSteps);
        simulationStep += 1
      ) {
        advanceMotionState(state, race.raceId, simulationStep)
        if (state.finished) break
      }
    } else if (state.speed === 0 && !state.finished) {
      state.speed = deterministicTargetSpeed(race.raceId, state.raceEntryId, master.simulationStep)
      state.targetSpeed = state.speed
    }
  }

  const activeProfiles = race.entries
    .filter((entry) => !isInactive(entry))
    .map((entry) => master.motionStates.get(entry.raceEntryId)?.paceProfile)
    .filter((profile): profile is DeterministicPaceProfile => profile != null)
  normalizeDeterministicPaceProfiles(activeProfiles)

  if (status === 'upcoming' || status === 'pre-race') {
    master.motionStartTimestamp = actualStartTimestamp
    master.lastWallClockCorrectionAt = 0
    master.simulationAccumulatorMs = 0
    master.simulationInitialized = false
    master.simulationStep = 0
  } else if (
    status === 'live'
    && (raceChanged || enteringLive || startTimeChanged || !master.simulationInitialized)
  ) {
    master.motionStartTimestamp = actualStartTimestamp
    const now = Date.now()
    const elapsedMs = actualStartTimestamp == null ? 0 : Math.max(0, now - actualStartTimestamp)
    catchUpMotion(master, race, elapsedMs)
    master.lastWallClockCorrectionAt = now
    master.simulationInitialized = true
  }

  master.motionStatus = status
}

const animationForRace = (status: string): PixelHorseAnimationName => {
  if (status === 'live') return 'run'
  if (status === 'unofficial' || status === 'official' || status === 'completed' || status === 'cancelled') {
    return 'stop'
  }
  return 'idle'
}

const playbackForRace = (status: string): LayeredHorseVisual['playback'] => {
  if (status === 'cancelled') return 'stopped'
  if (status === 'unofficial' || status === 'official' || status === 'completed') return 'once'
  return 'loop'
}

const frameDurationForAnimation = (animation: PixelHorseAnimationName) => {
  if (animation === 'run') return 90
  if (animation === 'stop') return 120
  return 180
}

const resetMasterAnimation = (
  master: MasterAnimationController,
  visuals: LayeredHorseVisual[],
  animation: PixelHorseAnimationName
) => {
  master.elapsedMs = 0
  master.frameDurationMs = frameDurationForAnimation(animation)
  master.step = 0
  master.visuals = visuals

  for (const visual of visuals) {
    const frame = visual.usingStopTextures && master.finish.phase === 'complete'
      ? visual.settledFrameIndex
      : 0
    for (const layer of visual.layers) layer.gotoAndStop(frame)
  }
}

const updateMasterAnimation = (master: MasterAnimationController, ticker: PixiTicker) => {
  if (master.visuals.length === 0) return

  master.elapsedMs += ticker.deltaMS
  if (master.elapsedMs < master.frameDurationMs) return

  const steps = Math.floor(master.elapsedMs / master.frameDurationMs)
  master.elapsedMs -= steps * master.frameDurationMs
  master.step += steps

  for (const visual of master.visuals) {
    if (visual.playback === 'manual') continue
    const sequenceIndex = visual.playback === 'once'
      ? Math.min(master.step, visual.frameSequence.length - 1)
      : master.step % visual.frameSequence.length
    const frame = visual.playback === 'stopped'
      ? visual.frameSequence[0]
      : visual.frameSequence[sequenceIndex]

    for (const layer of visual.layers) layer.gotoAndStop(frame)
  }
}

const renderMotionPositions = (master: MasterAnimationController) => {
  const interpolationSeconds = master.simulationAccumulatorMs / 1000
  const now = performance.now()
  for (const visual of master.visuals) {
    const state = master.motionStates.get(visual.raceEntryId)
    if (!state) continue
    const finishProgress = currentFinishProgress(master, visual.raceEntryId, now)
    const motionProgress = visual.inactive
      ? state.progress
      : Math.min(
          state.visualHoldProgress,
          state.progress
            + effectiveMotionSpeed(state, master.simulationStep) * interpolationSeconds
        )
    const pathProgress = finishProgress ?? motionProgressToPathProgress(motionProgress)
    const pathPoint = getRacePathPoint(pathProgress, visual.laneBaseY, visual.geometry)
    visual.container.position.set(pathPoint.x, pathPoint.y)
    const finishEntry = master.finish.entries.get(visual.raceEntryId)
    const targetReached = master.finish.phase === 'complete'
      || (finishEntry != null
        && master.finish.phase === 'tweening'
        && now - master.finish.startedAt >= finishEntry.delayMs + finishEntry.durationMs)
    if (visual.resultBadge) {
      visual.resultBadge.visible = targetReached
      visual.resultBadge.position.x = Math.max(
        visual.resultBadgeMinimumX,
        visual.container.position.x + visual.resultBadgeOffsetX
      )
      visual.resultBadge.position.y = visual.container.position.y - 20
    }
    if (visual.winnerHighlight) {
      visual.winnerHighlight.visible = targetReached
      visual.winnerHighlight.position.copyFrom(visual.container.position)
    }
    if (visual.finishTimeLabel) {
      visual.finishTimeLabel.visible = targetReached
    }
    if (visual.temporaryRankBadge) {
      const badgeHalfWidth = visual.temporaryRankWidth / 2
      visual.temporaryRankBadge.position.set(
        clamp(
          visual.container.position.x,
          visual.geometry.startX + badgeHalfWidth + 4,
          visual.geometry.finishLineX - badgeHalfWidth - 6
        ),
        visual.container.position.y - 34 - visual.temporaryRankHeight / 2
      )
    }
  }
}

const applyStopPose = (visual: LayeredHorseVisual, frame: number) => {
  if (!visual.usingStopTextures) {
    visual.layers.forEach((layer, index) => {
      layer.textures = visual.stopTextures[index]
    })
    visual.usingStopTextures = true
  }
  visual.playback = 'manual'
  visual.stopStartedAt = null
  const boundedFrame = Math.min(
    Math.max(0, frame),
    visual.stopFrameCount - 1,
    visual.settledFrameIndex
  )
  for (const layer of visual.layers) layer.gotoAndStop(boundedFrame)
}

const startIndependentStopAnimation = (
  visual: LayeredHorseVisual,
  reducedMotion: boolean
) => {
  if (!visual.usingStopTextures) {
    visual.layers.forEach((layer, index) => {
      layer.textures = visual.stopTextures[index]
    })
    visual.usingStopTextures = true
  }
  visual.playback = 'manual'
  visual.stopStartedAt = reducedMotion ? null : performance.now()
  const initialFrame = reducedMotion ? visual.settledFrameIndex : 0
  for (const layer of visual.layers) layer.gotoAndStop(initialFrame)
}

const updateIndependentStopAnimations = (master: MasterAnimationController) => {
  const now = performance.now()
  for (const visual of master.visuals) {
    const state = master.motionStates.get(visual.raceEntryId)
    if (!state?.finished || visual.inactive) continue
    if (!visual.usingStopTextures) {
      startIndependentStopAnimation(visual, master.reducedMotion)
    }
    if (visual.stopStartedAt == null) continue
    const frame = Math.min(
      visual.settledFrameIndex,
      Math.floor((now - visual.stopStartedAt) / stopFrameDurationMs)
    )
    for (const layer of visual.layers) layer.gotoAndStop(frame)
    if (frame >= visual.settledFrameIndex) visual.stopStartedAt = null
  }
}

const finishStopFrame = (
  entry: FinishEntryTarget,
  elapsedMs: number,
  settledFrameIndex: number,
  finishImmediately = false
) => {
  if (finishImmediately) return settledFrameIndex
  const stopElapsedMs = elapsedMs - entry.delayMs - entry.durationMs
  if (stopElapsedMs < 0) return null
  return Math.min(settledFrameIndex, Math.floor(stopElapsedMs / stopFrameDurationMs))
}

const updateFinishSequence = (master: MasterAnimationController, finishImmediately = false) => {
  if (master.finish.phase !== 'tweening') return

  const elapsedMs = Math.max(0, performance.now() - master.finish.startedAt)
  let complete = true
  for (const entry of master.finish.entries.values()) {
    const visual = master.visuals.find((item) => item.raceEntryId === entry.raceEntryId)
    if (!visual) continue
    const stopFrame = finishStopFrame(
      entry,
      elapsedMs,
      visual.settledFrameIndex,
      finishImmediately
    )
    if (stopFrame == null) {
      complete = false
      continue
    }
    applyStopPose(visual, stopFrame)
    if (stopFrame < visual.settledFrameIndex) complete = false
  }

  renderMotionPositions(master)
  if (!complete) return

  master.finish.phase = 'complete'
  for (const entry of master.finish.entries.values()) {
    const state = master.motionStates.get(entry.raceEntryId)
    if (state) {
      state.previousProgress = entry.targetProgress
      state.progress = entry.targetProgress
      state.speed = 0
      state.targetSpeed = 0
    }
  }
  for (const visual of master.visuals) {
    if (!master.finish.entries.has(visual.raceEntryId)) continue
    applyStopPose(visual, visual.settledFrameIndex)
  }
  renderMotionPositions(master)
}

const updateMotion = (
  master: MasterAnimationController,
  ticker: PixiTicker,
  race: RaceLiveStatus
) => {
  if (race.status.toLowerCase() !== 'live' || master.visuals.length === 0) return

  const deltaMs = Math.min(Math.max(ticker.deltaMS, 0), maximumDeltaMs)
  master.simulationAccumulatorMs += deltaMs
  const activeEntries = activeMotionEntries(race)

  while (master.simulationAccumulatorMs >= fixedSimulationStepMs) {
    for (const entry of activeEntries) {
      const state = master.motionStates.get(entry.raceEntryId)
      if (state) advanceMotionState(state, race.raceId, master.simulationStep)
    }
    master.simulationStep += 1
    master.simulationAccumulatorMs -= fixedSimulationStepMs
  }

  const now = Date.now()
  if (now - master.lastWallClockCorrectionAt >= wallClockCorrectionIntervalMs) {
    correctMotionToWallClock(master, race, now)
  }

  updateIndependentStopAnimations(master)
  renderMotionPositions(master)
}

const motionDisplayProgress = (
  master: MasterAnimationController,
  state: HorseMotionState,
  inactive: boolean
) => inactive
  ? state.progress
  : Math.min(
      state.visualHoldProgress,
      state.progress
        + effectiveMotionSpeed(state, master.simulationStep)
          * (master.simulationAccumulatorMs / 1000)
    )

const visualSignature = (race: RaceLiveStatus) => [
  race.raceId,
  race.status.toLowerCase(),
  race.actualStartTime ?? '',
  ...[...race.entries].sort((left, right) => left.raceEntryId - right.raceEntryId).map((entry) => [
    entry.raceEntryId,
    entry.postPosition,
    entry.status,
    entry.isWithdrawn,
    entry.horseName,
    entry.jockeyName,
    entry.finishPosition,
  ].join(':')),
].join('|')

const isInactive = (entry: LiveRaceEntry) => {
  return !isDeterministicRaceEntryEligible(entry)
}

const temporaryRankColor = (rank: number) => {
  if (rank === 1) return 0xfde68a
  if (rank === 2) return 0xe2e8f0
  if (rank === 3) return 0xd6a36a
  return 0xcbd5e1
}

const temporaryRankTextColor = (rank: number) =>
  rank === 3 ? 0x4a2608 : 0x1e293b

const publishTemporaryStandings = (
  master: MasterAnimationController,
  race: RaceLiveStatus,
  force = false,
  now = performance.now()
) => {
  const temporaryStandings = master.temporaryStandings
  if (temporaryStandings.raceId !== race.raceId) {
    temporaryStandings.raceId = race.raceId
    temporaryStandings.lastPublishedAt = 0
    temporaryStandings.ranks.clear()
  }

  if (race.status.toLowerCase() !== 'live') {
    const hadRanks = temporaryStandings.ranks.size > 0
    temporaryStandings.ranks.clear()
    temporaryStandings.lastPublishedAt = 0
    return hadRanks
  }

  if (
    !force
    && now - temporaryStandings.lastPublishedAt < temporaryStandingUpdateIntervalMs
  ) return false

  temporaryStandings.lastPublishedAt = now
  const activeMotions: Array<Pick<HorseMotionState, 'progress' | 'raceEntryId'>> = []
  for (const entry of race.entries) {
    if (isInactive(entry)) continue
    const motion = master.motionStates.get(entry.raceEntryId)
    if (motion) {
      activeMotions.push({
        progress: displayedFixedStepProgress(motion),
        raceEntryId: motion.raceEntryId,
      })
    }
  }
  const standings = calculateSimulatedStandings(activeMotions)
  const ranksChanged = standings.length !== temporaryStandings.ranks.size
    || standings.some((standing) =>
      temporaryStandings.ranks.get(standing.raceEntryId) !== standing.temporaryRank
    )
  if (!ranksChanged) return false

  temporaryStandings.ranks.clear()
  for (const standing of standings) {
    temporaryStandings.ranks.set(standing.raceEntryId, standing.temporaryRank)
  }
  return true
}

const applyTemporaryRankToVisual = (
  visual: LayeredHorseVisual,
  rank: number,
  compact: boolean
) => {
  if (
    !visual.temporaryRankBadge
    || !visual.temporaryRankBackground
    || !visual.temporaryRankText
  ) return
  visual.temporaryRankBackground
    .clear()
    .roundRect(
      -visual.temporaryRankWidth / 2,
      -visual.temporaryRankHeight / 2,
      visual.temporaryRankWidth,
      visual.temporaryRankHeight,
      visual.temporaryRankHeight / 2
    )
    .fill({ color: temporaryRankColor(rank), alpha: 0.96 })
    .stroke({ color: 0xffffff, width: 1.5 })
  visual.temporaryRankText.text = compact ? `T#${rank}` : `Tạm #${rank}`
  visual.temporaryRankText.tint = temporaryRankTextColor(rank)
}

const updateTemporaryStandingVisuals = (
  master: MasterAnimationController,
  race: RaceLiveStatus,
  width: number,
  force = false
) => {
  const live = race.status.toLowerCase() === 'live'
  const countdownVisible = master.countdown.phase === 'running'
  const shouldShow = live && !countdownVisible
  const ranksChanged = shouldShow
    ? publishTemporaryStandings(master, race, force)
    : live
      ? false
      : publishTemporaryStandings(master, race, force)
  const compact = width < mobileTrackBreakpoint

  for (const visual of master.visuals) {
    const badge = visual.temporaryRankBadge
    if (!badge) continue
    const rank = master.temporaryStandings.ranks.get(visual.raceEntryId)
    badge.visible = shouldShow && rank != null
    if (rank != null && (force || ranksChanged)) {
      applyTemporaryRankToVisual(visual, rank, compact)
    }
  }
  if (master.temporaryStandings.label) {
    master.temporaryStandings.label.visible = shouldShow
  }
}

const entryState = (entry: LiveRaceEntry) => {
  const status = entry.status.toLowerCase()
  if (entry.isWithdrawn) return 'Đã rút'
  if (status === 'disqualified') return 'Đã loại'
  if (status === 'cancelled') return 'Đã hủy'
  return entry.status
}

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`
}

const sortedEntries = (race: RaceLiveStatus) => [...race.entries].sort((left, right) => {
  if (left.postPosition == null && right.postPosition == null) {
    return left.raceEntryId - right.raceEntryId
  }
  if (left.postPosition == null) return 1
  if (right.postPosition == null) return -1
  return left.postPosition - right.postPosition
})

const isResultStatus = (status: string) =>
  status === 'unofficial' || status === 'official' || status === 'completed'

const formatFinishTime = (finishTime: LiveRaceEntry['finishTime']) => {
  if (typeof finishTime !== 'number' || !Number.isFinite(finishTime) || finishTime < 0) {
    return '—'
  }
  return `${finishTime} giây`
}

const resultPresentation = (status: string, compact: boolean) => {
  if (status === 'unofficial') {
    return {
      accentColor: 0xd97706,
      backgroundColor: 0x78350f,
      subtitle: compact ? 'Chờ xác nhận' : 'Kết quả đang chờ xác nhận chính thức',
      title: compact ? 'SƠ BỘ' : 'KẾT QUẢ SƠ BỘ',
    }
  }
  if (status === 'official' || status === 'completed') {
    return {
      accentColor: 0x22c55e,
      backgroundColor: 0x14532d,
      subtitle: compact ? 'Đã xác nhận' : 'Kết quả đã được trọng tài xác nhận',
      title: compact ? 'CHÍNH THỨC' : 'KẾT QUẢ CHÍNH THỨC',
    }
  }
  return null
}

const validateFinishResults = (race: RaceLiveStatus): FinishValidation => {
  if (!isResultStatus(race.status.toLowerCase())) {
    return { kind: 'not-result', error: '', positions: new Map(), signature: '' }
  }

  const eligibleEntries = race.entries.filter((entry) => !isInactive(entry))
  if (eligibleEntries.length === 0) {
    return {
      kind: 'invalid',
      error: 'Không có entry hợp lệ để hiển thị kết quả về đích.',
      positions: new Map(),
      signature: '',
    }
  }

  const positions = new Map<number, number>()
  const positionCounts = new Map<number, number>()
  for (const entry of eligibleEntries) {
    const position = entry.finishPosition
    if (!Number.isInteger(position) || position == null || position <= 0) {
      return {
        kind: 'invalid',
        error: `Kết quả chưa đầy đủ: ${entry.horseName || `entry #${entry.raceEntryId}`} chưa có FinishPosition hợp lệ.`,
        positions: new Map(),
        signature: '',
      }
    }
    if (position > eligibleEntries.length) {
      return {
        kind: 'invalid',
        error: `FinishPosition ${position} nằm ngoài phạm vi 1–${eligibleEntries.length}.`,
        positions: new Map(),
        signature: '',
      }
    }
    positions.set(entry.raceEntryId, position)
    positionCounts.set(position, (positionCounts.get(position) ?? 0) + 1)
  }

  let expectedPosition = 1
  for (const [position, count] of [...positionCounts.entries()].sort(
    ([leftPosition], [rightPosition]) => leftPosition - rightPosition
  )) {
    if (position !== expectedPosition) {
      return {
        kind: 'invalid',
        error: `Kết quả không tuân theo standard competition ranking: cần hạng ${expectedPosition} nhưng nhận hạng ${position}.`,
        positions: new Map(),
        signature: '',
      }
    }
    expectedPosition += count
  }

  const signature = [...positions.entries()]
    .sort(([leftId], [rightId]) => leftId - rightId)
    .map(([raceEntryId, position]) => `${raceEntryId}:${position}`)
    .join('|')

  return { kind: 'valid', error: '', positions, signature }
}

const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3)

const finalFormationProgress = (
  finishPosition: number,
  maximumFinishPosition: number,
  spriteWidth: number,
  geometry: TrackGeometry
) => {
  const visualHalfWidth = spriteWidth / 2
  const finishZoneWidth = geometry.finishZoneEndX - geometry.finishLineX
  if (finishZoneWidth <= 0) return 1
  const nearestFinishCenterX = geometry.finishLineX + visualHalfWidth + visualSafePadding
  const farthestFinishCenterX = geometry.finishZoneEndX - visualHalfWidth - visualSafePadding
  if (maximumFinishPosition <= 1) {
    return 1 + (farthestFinishCenterX - geometry.finishLineX) / finishZoneWidth
  }
  const desiredGapPixels = spriteWidth * desiredFormationGapSpriteRatio
  const availableFinishSpanPixels = Math.max(
    0,
    farthestFinishCenterX - nearestFinishCenterX
  )
  const gapPixels = Math.min(
    desiredGapPixels,
    availableFinishSpanPixels / (maximumFinishPosition - 1)
  )
  const targetCenterX = farthestFinishCenterX - (finishPosition - 1) * gapPixels
  return 1 + (targetCenterX - geometry.finishLineX) / finishZoneWidth
}

const finishEntryProgress = (entry: FinishEntryTarget, elapsedMs: number) => {
  const normalizedElapsed = Math.min(
    1,
    Math.max(0, (elapsedMs - entry.delayMs) / entry.durationMs)
  )
  return entry.startProgress
    + (entry.targetProgress - entry.startProgress) * easeOutCubic(normalizedElapsed)
}

const currentFinishProgress = (
  master: MasterAnimationController,
  raceEntryId: number,
  now = performance.now()
) => {
  const entry = master.finish.entries.get(raceEntryId)
  if (!entry) return null
  if (master.finish.phase === 'complete') return entry.targetProgress
  if (master.finish.phase !== 'tweening') return null
  return finishEntryProgress(entry, Math.max(0, now - master.finish.startedAt))
}

const clearFinishSequence = (master: MasterAnimationController) => {
  master.finish.entries.clear()
  master.finish.phase = 'none'
  master.finish.signature = ''
  master.finish.startedAt = 0
}

const syncFinishSequence = (
  master: MasterAnimationController,
  race: RaceLiveStatus,
  validation: FinishValidation,
  previousStatus: string,
  progressBeforeSync: Map<number, number>,
  hadVisuals: boolean,
  spriteWidth: number,
  geometry: TrackGeometry
) => {
  if (validation.kind === 'not-result') {
    clearFinishSequence(master)
    return
  }

  if (validation.kind === 'invalid') {
    for (const entry of race.entries) {
      if (isInactive(entry)) continue
      const state = master.motionStates.get(entry.raceEntryId)
      if (!state) continue
      const frozenProgress = progressBeforeSync.get(entry.raceEntryId)
        ?? displayedFixedStepProgress(state)
      state.previousProgress = frozenProgress
      state.progress = frozenProgress
      state.speed = 0
      state.targetSpeed = 0
    }
    clearFinishSequence(master)
    return
  }

  const maximumFinishPosition = Math.max(...validation.positions.values())
  const formationProgress = (finishPosition: number) => finalFormationProgress(
    finishPosition,
    maximumFinishPosition,
    spriteWidth,
    geometry
  )

  if (master.finish.signature === validation.signature) {
    for (const entry of master.finish.entries.values()) {
      entry.targetProgress = formationProgress(entry.finishPosition)
      if (master.finish.phase !== 'complete') continue
      const state = master.motionStates.get(entry.raceEntryId)
      if (state) {
        state.previousProgress = entry.targetProgress
        state.progress = entry.targetProgress
      }
    }
    return
  }

  const isResultUpdate = master.finish.signature !== ''
  const shouldTween = !master.reducedMotion
    && (previousStatus === 'live' || isResultUpdate || hadVisuals)
  const durationMs = isResultUpdate ? resultUpdateTweenDurationMs : finishTweenDurationMs
  const delayMs = isResultUpdate ? resultUpdateTweenDelayMs : finishTweenDelayMs
  const entries = new Map<number, FinishEntryTarget>()

  for (const [raceEntryId, finishPosition] of validation.positions) {
    const state = master.motionStates.get(raceEntryId)
    const startProgress = progressBeforeSync.get(raceEntryId) ?? state?.progress ?? 0
    const targetProgress = formationProgress(finishPosition)
    entries.set(raceEntryId, {
      raceEntryId,
      finishPosition,
      startProgress,
      targetProgress,
      delayMs: (finishPosition - 1) * delayMs,
      durationMs,
    })
    if (state) {
      state.speed = 0
      state.targetSpeed = 0
      if (!shouldTween) {
        state.previousProgress = targetProgress
        state.progress = targetProgress
      }
    }
  }

  master.finish.entries = entries
  master.finish.phase = shouldTween ? 'tweening' : 'complete'
  master.finish.signature = validation.signature
  master.finish.startedAt = shouldTween ? performance.now() : 0
}

const destroyStageChildren = (app: PixiApplication) => {
  for (const child of app.stage.removeChildren()) {
    child.destroy({ children: true })
  }
}

const countdownParticleUnit = (
  signature: string,
  particleIndex: number,
  channel: number
) => deterministicUnitFromTag(`${signature}:particle:${particleIndex}:${channel}`)

const createCountdownParticles = (
  pixi: PixiModule,
  countdown: CountdownState,
  centerX: number,
  centerY: number,
  trackWidth: number,
  canvasWidth: number
) => {
  const visual = countdown.visual
  if (!visual || visual.particlesCreated) return
  visual.particlesCreated = true
  if (countdown.activeStartSignature === '') return

  const particleCount = canvasWidth < mobileTrackBreakpoint
    ? mobileParticleCount
    : desktopParticleCount
  const burstOffset = Math.min(72, trackWidth * 0.16)

  for (let index = 0; index < particleCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1
    const speedUnit = countdownParticleUnit(countdown.activeStartSignature, index, 0)
    const liftUnit = countdownParticleUnit(countdown.activeStartSignature, index, 1)
    const lifetimeUnit = countdownParticleUnit(countdown.activeStartSignature, index, 2)
    const sizeUnit = countdownParticleUnit(countdown.activeStartSignature, index, 3)
    const colorUnit = countdownParticleUnit(countdown.activeStartSignature, index, 4)
    const originYUnit = countdownParticleUnit(countdown.activeStartSignature, index, 5)
    const graphic = new pixi.Graphics()
      .circle(0, 0, 2 + sizeUnit * 2)
      .fill({
        color: particleColors[Math.floor(colorUnit * particleColors.length)],
      })
    const particle: CountdownParticle = {
      graphic,
      lifetimeMs: 500 + lifetimeUnit * 150,
      originX: centerX + side * burstOffset,
      originY: centerY + (originYUnit - 0.5) * 22,
      velocityX: side * (42 + speedUnit * 72),
      velocityY: -(38 + liftUnit * 78),
    }
    graphic.position.set(particle.originX, particle.originY)
    visual.container.addChild(graphic)
    visual.particles.push(particle)
  }
}

const updateCountdownParticles = (
  countdown: CountdownState,
  goElapsedMs: number
) => {
  const visual = countdown.visual
  if (!visual) return
  const elapsedSeconds = goElapsedMs / 1000
  for (const particle of visual.particles) {
    const lifeProgress = clamp(goElapsedMs / particle.lifetimeMs, 0, 1)
    particle.graphic.visible = lifeProgress < 1
    particle.graphic.alpha = 1 - smoothstep(lifeProgress)
    particle.graphic.scale.set(1 - lifeProgress * 0.35)
    particle.graphic.position.set(
      particle.originX + particle.velocityX * elapsedSeconds,
      particle.originY
        + particle.velocityY * elapsedSeconds
        + 0.5 * 150 * elapsedSeconds * elapsedSeconds
    )
  }
}

const createCountdownVisual = (
  app: PixiApplication,
  pixi: PixiModule,
  countdown: CountdownState,
  geometry: TrackGeometry,
  height: number,
  entryCount: number,
  reducedMotion: boolean
) => {
  if (countdown.phase !== 'running') return
  destroyCountdownVisual(countdown)

  const trackTop = stagePadding + trackHeaderHeight
  const trackBottom = Math.min(
    height - stagePadding,
    trackTop + Math.max(1, entryCount) * laneHeight - 6
  )
  const centerX = (geometry.startX + geometry.finishLineX) / 2
  const centerY = (trackTop + trackBottom) / 2
  const trackWidth = geometry.finishLineX - geometry.startX
  const fontSize = clamp(trackWidth * 0.13, 34, 72)
  const container = new pixi.Container()
  const backdrop = new pixi.Graphics()
    .roundRect(
      geometry.startX + 4,
      trackTop + 4,
      Math.max(0, geometry.finishZoneEndX - geometry.startX - 8),
      Math.max(0, trackBottom - trackTop - 8),
      14
    )
    .fill({ color: 0x0f172a, alpha: 0.42 })
  const overlayText = new pixi.Text({
    text: '',
    style: {
      fill: 0xffffff,
      fontFamily: 'Arial, sans-serif',
      fontSize,
      fontWeight: '900',
      stroke: { color: 0x0f172a, width: 5 },
    },
  })
  overlayText.anchor.set(0.5)
  overlayText.position.set(centerX, centerY)
  container.addChild(backdrop, overlayText)
  app.stage.addChild(container)
  countdown.visual = {
    container,
    overlayText,
    particles: [],
    particlesCreated: reducedMotion,
  }
}

const updateCountdown = (
  master: MasterAnimationController,
  race: RaceLiveStatus,
  pixi: PixiModule,
  width: number,
  now = Date.now()
) => {
  const countdown = master.countdown
  if (countdown.phase !== 'running') return
  if (document.visibilityState !== 'visible') {
    handleCountdownHidden(countdown, race)
    return
  }

  const actualStartTimestamp = parseActualStartTimestamp(race.actualStartTime)
  const signature = actualStartTimestamp == null
    ? ''
    : countdownStartSignature(race.raceId, actualStartTimestamp)
  if (
    race.status.toLowerCase() !== 'live'
    || actualStartTimestamp == null
    || signature === ''
    || signature !== countdown.activeStartSignature
    || actualStartTimestamp !== countdown.actualStartTimestamp
  ) {
    countdown.phase = 'cancelled'
    destroyCountdownVisual(countdown)
    return
  }

  const visual = countdown.visual
  if (!visual) return
  const elapsedMs = now - actualStartTimestamp
  if (elapsedMs < 0) {
    countdown.phase = 'cancelled'
    destroyCountdownVisual(countdown)
    return
  }

  if (elapsedMs < countdownDurationMs) {
    const remainingMs = countdownDurationMs - elapsedMs
    const displayNumber = Math.ceil(remainingMs / 1000)
    const numberElapsedMs = elapsedMs % 1000
    visual.overlayText.text = String(displayNumber)
    visual.overlayText.tint = 0xffffff
    visual.overlayText.alpha = 1
    const scale = master.reducedMotion
      ? 1
      : 0.9 + smoothstep(Math.min(1, numberElapsedMs / 280)) * 0.1
    visual.overlayText.scale.set(scale)
    return
  }

  const goElapsedMs = elapsedMs - countdownDurationMs
  if (goElapsedMs >= goEffectDurationMs) {
    countdown.phase = 'completed'
    destroyCountdownVisual(countdown)
    return
  }

  visual.overlayText.text = 'GO!'
  visual.overlayText.tint = 0xfacc15
  visual.overlayText.alpha = 1 - smoothstep(
    (goElapsedMs - 350) / (goEffectDurationMs - 350)
  )
  visual.overlayText.scale.set(
    master.reducedMotion ? 1 : 1 + smoothstep(goElapsedMs / 300) * 0.15
  )

  if (!master.reducedMotion && !visual.particlesCreated) {
    const geometry = master.visuals[0]?.geometry
    if (geometry) {
      createCountdownParticles(
        pixi,
        countdown,
        visual.overlayText.position.x,
        visual.overlayText.position.y,
        geometry.finishLineX - geometry.startX,
        width
      )
    }
  }
  updateCountdownParticles(countdown, goElapsedMs)
}

const drawStage = (
  app: PixiApplication,
  pixi: PixiModule,
  assets: PixelHorseAssetBundle,
  master: MasterAnimationController,
  race: RaceLiveStatus,
  width: number,
  height: number
) => {
  const { AnimatedSprite, Container, Graphics, Text } = pixi
  const previousStatus = master.motionStatus
  const hadVisuals = master.visuals.length > 0
  const progressBeforeSync = new Map<number, number>()
  const now = performance.now()
  const entries = sortedEntries(race)
  const labelWidth = Math.min(220, Math.max(92, width * 0.27))
  const startX = Math.min(width - 74, labelWidth + 34)
  const availableTrackWidth = Math.max(0, width - startX)
  const minimumFinishZoneWidth = assets.frameWidth
    + visualSafePadding * 2
    + minimumFinishFormationSpanPixels
  const maximumFinishZoneWidth = Math.max(
    0,
    availableTrackWidth
      - assets.frameWidth
      - visualSafePadding * 2
      - minimumLiveTravelPixels
  )
  const finishZoneWidth = Math.max(
    0,
    Math.min(
      Math.max(availableTrackWidth * finishZoneTrackRatio, minimumFinishZoneWidth),
      assets.frameWidth * maximumFinishZoneSpriteWidths,
      maximumFinishZoneWidth
    )
  )
  const finishX = width - finishZoneWidth
  const visualHalfWidth = assets.frameWidth / 2
  const geometry: TrackGeometry = {
    startX,
    finishLineX: finishX,
    finishZoneEndX: width,
    liveSafeEndX: finishX - visualHalfWidth - visualSafePadding,
    laneHeight,
    curveAmplitude: curveAmplitudeForLayout(width, laneHeight),
  }
  for (const entry of race.entries) {
    const finishProgress = currentFinishProgress(master, entry.raceEntryId, now)
    const motionState = master.motionStates.get(entry.raceEntryId)
    if (finishProgress != null) {
      progressBeforeSync.set(entry.raceEntryId, finishProgress)
    } else if (motionState) {
      progressBeforeSync.set(
        entry.raceEntryId,
        motionProgressToPathProgress(
          motionDisplayProgress(master, motionState, isInactive(entry))
        )
      )
    }
  }
  destroyCountdownVisual(master.countdown)
  master.temporaryStandings.label = null
  destroyStageChildren(app)
  syncMotionStates(master, race)
  syncVisualHoldProgress(master)
  const finishValidation = validateFinishResults(race)
  syncFinishSequence(
    master,
    race,
    finishValidation,
    previousStatus,
    progressBeforeSync,
    hadVisuals,
    assets.frameWidth,
    geometry
  )
  publishTemporaryStandings(master, race, true, now)

  const animationName = master.finish.phase === 'tweening'
    ? 'run'
    : animationForRace(race.status.toLowerCase())
  const animationFrames = assets.animations[animationName]
  const animationFrameSequence = animationName === 'idle'
    ? idleFrameSequence
    : Array.from({ length: animationFrames.frameCount }, (_, frame) => frame)
  const stopFrames = assets.animations.stop
  const racePlayback = master.finish.phase === 'complete'
    ? 'stopped'
    : playbackForRace(race.status.toLowerCase())
  const visuals: LayeredHorseVisual[] = []

  const background = new Graphics()
    .rect(0, 0, width, height)
    .fill({ color: 0xdce9d3 })
  app.stage.addChild(background)

  entries.forEach((entry, index) => {
    const laneY = stagePadding + trackHeaderHeight + index * laneHeight
    const centerY = laneY + laneHeight / 2
    const inactive = isInactive(entry)
    const motionState = master.motionStates.get(entry.raceEntryId)
    const liveFinished = race.status.toLowerCase() === 'live'
      && motionState?.finished === true
    const finishPosition = finishValidation.kind === 'valid'
      ? finishValidation.positions.get(entry.raceEntryId) ?? null
      : null
    const settledResult = !inactive
      && finishPosition != null
      && master.finish.phase === 'complete'
    const visualSettledFrameIndex = Math.min(
      settledStopFrameIndex,
      stopFrames.frameCount - 1
    )
    const finishTarget = master.finish.entries.get(entry.raceEntryId)
    const initialStopFrame = liveFinished
      ? visualSettledFrameIndex
      : settledResult
      ? visualSettledFrameIndex
      : master.finish.phase === 'tweening' && finishTarget
        ? finishStopFrame(
            finishTarget,
            Math.max(0, performance.now() - master.finish.startedAt),
            visualSettledFrameIndex
          )
        : null
    const usingStopTextures = initialStopFrame != null
    const laneColor = inactive ? 0x94a3b8 : laneColors[index % laneColors.length]
    const sampleCount = width < mobileTrackBreakpoint
      ? mobilePathSampleCount
      : desktopPathSampleCount
    const pathPoints = sampleRacePath(centerY, geometry, sampleCount)
    const laneHalfHeight = geometry.laneHeight / 2 - 7
    const lane = new Graphics()
    lane.moveTo(pathPoints[0].x, pathPoints[0].y - laneHalfHeight)
    for (const point of pathPoints.slice(1)) {
      lane.lineTo(point.x, point.y - laneHalfHeight)
    }
    for (const point of [...pathPoints].reverse()) {
      lane.lineTo(point.x, point.y + laneHalfHeight)
    }
    lane.closePath().fill({ color: index % 2 === 0 ? 0xe8d29a : 0xf0dda9 })
    lane
      .rect(finishX, laneY + 7, finishZoneWidth, laneHeight - 14)
      .fill({ color: index % 2 === 0 ? 0xd1e3c4 : 0xd9e9ce, alpha: 0.95 })
      .rect(0, laneY, labelWidth, laneHeight - 6)
      .fill({ color: 0xf8fafc, alpha: 0.96 })
      .rect(labelWidth, laneY, 1, laneHeight - 6)
      .fill({ color: 0xcbd5e1 })

    lane.moveTo(pathPoints[0].x, pathPoints[0].y)
    for (const point of pathPoints.slice(1)) lane.lineTo(point.x, point.y)
    lane.stroke({ color: 0xffffff, width: 1, alpha: 0.82 })

    for (const boundaryDirection of [-1, 1]) {
      lane.moveTo(
        pathPoints[0].x,
        pathPoints[0].y + boundaryDirection * laneHalfHeight
      )
      for (const point of pathPoints.slice(1)) {
        lane.lineTo(point.x, point.y + boundaryDirection * laneHalfHeight)
      }
      lane.stroke({ color: 0xb89c63, width: 1, alpha: 0.7 })
    }

    lane
      .rect(startX - 1, centerY - laneHalfHeight, 2, laneHalfHeight * 2)
      .fill({ color: 0x475569 })
      .rect(finishX - 2, centerY - laneHalfHeight, 4, laneHalfHeight * 2)
      .fill({ color: 0x0f172a })
    app.stage.addChild(lane)

    const horseFrames = usingStopTextures
      ? index % 2 === 0 ? stopFrames.horseI : stopFrames.horseII
      : index % 2 === 0 ? animationFrames.horseI : animationFrames.horseII
    const horse = new AnimatedSprite({ textures: horseFrames, autoUpdate: false })
    const leash = new AnimatedSprite({
      textures: usingStopTextures ? stopFrames.leash : animationFrames.leash,
      autoUpdate: false,
    })
    const rider = new AnimatedSprite({
      textures: usingStopTextures ? stopFrames.rider : animationFrames.rider,
      autoUpdate: false,
    })
    const horseVisual = new Container()

    for (const layer of [horse, leash, rider]) {
      layer.anchor.set(0.5)
      layer.gotoAndStop(initialStopFrame ?? 0)
    }
    horseVisual.addChild(horse, leash, rider)
    const finishProgress = currentFinishProgress(master, entry.raceEntryId)
    const motionProgress = motionState ? motionDisplayProgress(master, motionState, inactive) : 0
    const progress = finishProgress ?? motionProgressToPathProgress(motionProgress)
    const pathPoint = getRacePathPoint(progress, centerY, geometry)
    horseVisual.position.set(pathPoint.x, pathPoint.y)
    horseVisual.scale.set(1, 1)
    horseVisual.alpha = inactive ? 0.38 : 1

    let winnerHighlight: PixiContainer | null = null
    if (finishPosition === 1 && !inactive) {
      winnerHighlight = new Container()
      const winnerHalo = new Graphics()
        .ellipse(0, 2, Math.min(36, visualHalfWidth + 10), 24)
        .fill({ color: 0xfacc15, alpha: 0.18 })
        .ellipse(0, 2, Math.min(36, visualHalfWidth + 10), 24)
        .stroke({ color: 0xfbbf24, width: 2, alpha: 0.9 })
      const winnerCrown = new Text({
        text: '♛',
        style: {
          fill: 0xfacc15,
          fontFamily: 'Arial, sans-serif',
          fontSize: 17,
          fontWeight: '700',
          stroke: { color: 0x713f12, width: 2 },
        },
      })
      winnerCrown.anchor.set(0.5)
      winnerCrown.position.set(0, -31)
      winnerHighlight.addChild(winnerHalo, winnerCrown)
      winnerHighlight.position.copyFrom(horseVisual.position)
      winnerHighlight.visible = usingStopTextures
      app.stage.addChild(winnerHighlight)
    }
    app.stage.addChild(horseVisual)

    let resultBadge: PixiContainer | null = null
    const resultBadgeMinimumX = finishX + 13
    const resultBadgeOffsetX = -(visualHalfWidth + 12)
    if (finishPosition != null && !inactive) {
      const badgeColor = finishPosition === 1
        ? 0xd4a017
        : finishPosition === 2
          ? 0xcbd5e1
          : finishPosition === 3
            ? 0xb45309
            : 0x475569
      const badgeTextColor = finishPosition === 1
        ? 0x3f2d00
        : finishPosition === 2
          ? 0x334155
          : 0xffffff
      resultBadge = new Container()
      const badgeShape = new Graphics()
        .circle(0, 0, 11)
        .fill({ color: badgeColor })
        .circle(0, 0, 11)
        .stroke({ color: 0xffffff, width: 2 })
      const badgeLabel = new Text({
        text: `#${finishPosition}`,
        style: {
          fill: badgeTextColor,
          fontFamily: 'Arial, sans-serif',
          fontSize: 10,
          fontWeight: '700',
        },
      })
      badgeLabel.anchor.set(0.5)
      resultBadge.addChild(badgeShape, badgeLabel)
      resultBadge.position.set(
        Math.max(resultBadgeMinimumX, horseVisual.position.x + resultBadgeOffsetX),
        centerY - 20
      )
      resultBadge.visible = usingStopTextures
      app.stage.addChild(resultBadge)
    }

    let temporaryRankBackground: PixiGraphics | null = null
    let temporaryRankBadge: PixiContainer | null = null
    let temporaryRankText: PixiText | null = null
    const compactTemporaryBadge = width < mobileTrackBreakpoint
    const temporaryRankWidth = compactTemporaryBadge ? 34 : 52
    const temporaryRankHeight = compactTemporaryBadge ? 18 : 20
    if (race.status.toLowerCase() === 'live' && !inactive) {
      temporaryRankBadge = new Container()
      temporaryRankBackground = new Graphics()
      temporaryRankText = new Text({
        text: '',
        style: {
          fill: 0x1e293b,
          fontFamily: 'Arial, sans-serif',
          fontSize: compactTemporaryBadge ? 8 : 9,
          fontWeight: '800',
        },
      })
      temporaryRankText.anchor.set(0.5)
      temporaryRankBadge.addChild(temporaryRankBackground, temporaryRankText)
      temporaryRankBadge.visible = false
      app.stage.addChild(temporaryRankBadge)
    }

    let finishTimeLabel: PixiText | null = null
    if (finishPosition != null && !inactive) {
      finishTimeLabel = new Text({
        text: `Thời gian: ${formatFinishTime(entry.finishTime)}`,
        style: {
          fill: 0x334155,
          fontFamily: 'Arial, sans-serif',
          fontSize: width < mobileTrackBreakpoint ? 9 : 10,
          fontWeight: '600',
        },
      })
      finishTimeLabel.position.set(12, laneY + 57)
      finishTimeLabel.visible = usingStopTextures
      app.stage.addChild(finishTimeLabel)
    }

    const visual: LayeredHorseVisual = {
      container: horseVisual,
      finishTimeLabel,
      frameSequence: animationFrameSequence,
      inactive,
      layers: [horse, leash, rider],
      playback: usingStopTextures ? 'manual' : inactive ? 'stopped' : racePlayback,
      raceEntryId: entry.raceEntryId,
      resultBadge,
      resultBadgeMinimumX,
      resultBadgeOffsetX,
      settledFrameIndex: visualSettledFrameIndex,
      stopFrameCount: stopFrames.frameCount,
      stopStartedAt: null,
      stopTextures: [
        index % 2 === 0 ? stopFrames.horseI : stopFrames.horseII,
        stopFrames.leash,
        stopFrames.rider,
      ],
      temporaryRankBackground,
      temporaryRankBadge,
      temporaryRankHeight,
      temporaryRankText,
      temporaryRankWidth,
      usingStopTextures,
      winnerHighlight,
      geometry,
      laneBaseY: centerY,
    }
    visuals.push(visual)
    const initialTemporaryRank = master.temporaryStandings.ranks.get(entry.raceEntryId)
    if (initialTemporaryRank != null) {
      applyTemporaryRankToVisual(
        visual,
        initialTemporaryRank,
        compactTemporaryBadge
      )
    }

    const postBadgeX = Math.max(16, labelWidth - 16)
    const postBadge = new Graphics()
      .circle(postBadgeX, centerY, 12)
      .fill({ color: laneColor })
      .circle(postBadgeX, centerY, 12)
      .stroke({ color: inactive ? 0xcbd5e1 : 0xffffff, width: 2 })
    app.stage.addChild(postBadge)

    const postText = new Text({
      text: String(entry.postPosition ?? '—'),
      style: {
        fill: 0xffffff,
        fontFamily: 'Arial, sans-serif',
        fontSize: 12,
        fontWeight: '700',
      },
    })
    postText.anchor.set(0.5)
    postText.position.set(postBadgeX, centerY)
    app.stage.addChild(postText)

    const availableLabelWidth = Math.max(88, labelWidth - 24)
    const nameLimit = Math.max(10, Math.floor(availableLabelWidth / 7.5))
    const horseName = new Text({
      text: truncate(entry.horseName || 'Chưa có tên', nameLimit),
      style: {
        fill: 0x111827,
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        fontWeight: '700',
      },
    })
    horseName.position.set(12, laneY + 12)
    app.stage.addChild(horseName)

    const jockeyName = new Text({
      text: truncate(entry.jockeyName || 'Chưa có Jockey', nameLimit),
      style: {
        fill: 0x64748b,
        fontFamily: 'Arial, sans-serif',
        fontSize: 11,
      },
    })
    jockeyName.position.set(12, laneY + 34)
    app.stage.addChild(jockeyName)

    if (inactive) {
      const statusText = new Text({
        text: entryState(entry),
        style: {
          fill: 0x475569,
          fontFamily: 'Arial, sans-serif',
          fontSize: 10,
          fontWeight: '700',
        },
      })
      statusText.anchor.set(1, 0.5)
      statusText.position.set(finishX - 8, centerY)
      app.stage.addChild(statusText)
    }
  })

  if (race.status.toLowerCase() === 'live') {
    const compactLabel = width < mobileTrackBreakpoint
    const warningText = new Text({
      text: compactLabel
        ? 'TẠM • KHÔNG PHẢI KẾT QUẢ'
        : 'Thứ hạng tạm thời — kết quả cuối do trọng tài xác nhận',
      style: {
        fill: 0xffffff,
        fontFamily: 'Arial, sans-serif',
        fontSize: compactLabel ? 8 : 9,
        fontWeight: '700',
      },
    })
    warningText.anchor.set(0.5)
    const availableWarningWidth = Math.max(80, width - startX - 16)
    if (warningText.width > availableWarningWidth - 16) {
      warningText.scale.x = (availableWarningWidth - 16) / warningText.width
    }
    const warningWidth = Math.min(
      availableWarningWidth,
      warningText.width * warningText.scale.x + 16
    )
    const warningHeight = compactLabel ? 16 : 18
    const warningBackground = new Graphics()
      .roundRect(
        -warningWidth / 2,
        -warningHeight / 2,
        warningWidth,
        warningHeight,
        warningHeight / 2
      )
      .fill({ color: 0x334155, alpha: 0.88 })
    const warningLabel = new Container()
    warningLabel.addChild(warningBackground, warningText)
    warningLabel.position.set(
      (startX + width) / 2,
      stagePadding + trackHeaderHeight / 2
    )
    warningLabel.visible = master.countdown.phase !== 'running'
    app.stage.addChild(warningLabel)
    master.temporaryStandings.label = warningLabel
  }

  const presentation = resultPresentation(
    race.status.toLowerCase(),
    width < mobileTrackBreakpoint
  )
  if (presentation) {
    const headerWidth = Math.max(120, width - stagePadding * 2)
    const headerHeight = trackHeaderHeight - 8
    const resultHeader = new Container()
    const resultHeaderBackground = new Graphics()
      .roundRect(0, 0, headerWidth, headerHeight, 8)
      .fill({ color: presentation.backgroundColor, alpha: 0.94 })
      .roundRect(0, 0, 5, headerHeight, 3)
      .fill({ color: presentation.accentColor })
    const resultTitle = new Text({
      text: presentation.title,
      style: {
        fill: 0xffffff,
        fontFamily: 'Arial, sans-serif',
        fontSize: width < mobileTrackBreakpoint ? 11 : 13,
        fontWeight: '800',
      },
    })
    const resultSubtitle = new Text({
      text: presentation.subtitle,
      style: {
        fill: 0xf8fafc,
        fontFamily: 'Arial, sans-serif',
        fontSize: width < mobileTrackBreakpoint ? 8 : 9,
      },
    })
    resultTitle.position.set(13, 5)
    resultSubtitle.position.set(13, 22)
    const maximumHeaderTextWidth = headerWidth - 24
    for (const label of [resultTitle, resultSubtitle]) {
      if (label.width > maximumHeaderTextWidth) {
        label.scale.x = maximumHeaderTextWidth / label.width
      }
    }
    resultHeader.addChild(resultHeaderBackground, resultTitle, resultSubtitle)
    resultHeader.position.set(stagePadding, stagePadding)
    app.stage.addChild(resultHeader)
  }

  resetMasterAnimation(master, visuals, animationName)
  renderMotionPositions(master)
  updateTemporaryStandingVisuals(master, race, width, true)
  createCountdownVisual(
    app,
    pixi,
    master.countdown,
    geometry,
    height,
    entries.length,
    master.reducedMotion
  )
  updateCountdown(master, race, pixi, width)
  app.render()
}

export default function HorseRaceStage({ race, fallback }: HorseRaceStageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PixiApplication | null>(null)
  const pixiRef = useRef<PixiModule | null>(null)
  const assetsRef = useRef<PixelHorseAssetBundle | null>(null)
  const masterRef = useRef(createMasterAnimation())
  const lastSignatureRef = useRef('')
  const raceRef = useRef(race)
  const cleanupRef = useRef<(() => void) | null>(null)
  const failRef = useRef<(() => void) | null>(null)
  const [failed, setFailed] = useState(false)
  const [timingSnapshot, setTimingSnapshot] = useState<RaceTimingSnapshot>({
    elapsedMs: 0,
    results: [],
  })
  const timingSnapshotRef = useRef(timingSnapshot)
  const timingRaceIdRef = useRef(race.raceId)
  const stageHeight = Math.max(
    220,
    stagePadding * 2 + trackHeaderHeight + race.entries.length * laneHeight
  )
  const finishValidation = validateFinishResults(race)

  useEffect(() => {
    let disposed = false
    let resizeObserver: ResizeObserver | null = null
    let app: PixiApplication | null = null
    let pixi: PixiModule | null = null
    let assetLease: PixelHorseAssetLease | null = null
    let tickerCallback: ((ticker: PixiTicker) => void) | null = null
    let visibilityCallback: (() => void) | null = null
    let pageShowCallback: ((event: PageTransitionEvent) => void) | null = null
    let resyncVisibleStage: (() => void) | null = null
    let lastTimingPublishedAt = 0

    const publishTimingSnapshot = (force = false) => {
      const now = Date.now()
      if (!force && now - lastTimingPublishedAt < 33) return
      lastTimingPublishedAt = now

      if (timingRaceIdRef.current !== raceRef.current.raceId) {
        timingRaceIdRef.current = raceRef.current.raceId
        timingSnapshotRef.current = { elapsedMs: 0, results: [] }
      }
      const nextSnapshot = raceTimingSnapshot(
        masterRef.current,
        raceRef.current,
        timingSnapshotRef.current,
        now
      )
      if (sameTimingSnapshot(timingSnapshotRef.current, nextSnapshot)) return
      timingSnapshotRef.current = nextSnapshot
      setTimingSnapshot(nextSnapshot)
    }

    visibilityCallback = () => {
      if (document.visibilityState !== 'visible') {
        handleCountdownHidden(masterRef.current.countdown, raceRef.current)
        app?.render()
        return
      }
      resyncVisibleStage?.()
    }
    pageShowCallback = () => resyncVisibleStage?.()
    document.addEventListener('visibilitychange', visibilityCallback)
    window.addEventListener('pageshow', pageShowCallback)

    const redraw = (force = false) => {
      try {
        const host = hostRef.current
        const assets = assetsRef.current
        if (!host || !app || !pixi || !assets || appRef.current !== app) return

        const signature = visualSignature(raceRef.current)
        const width = Math.max(320, Math.floor(host.clientWidth))
        const height = Math.max(220, Math.floor(host.clientHeight))
        const unchangedLayout = app.screen.width === width && app.screen.height === height
        if (
          lastSignatureRef.current === signature
          && (!force || unchangedLayout)
        ) return

        app.renderer.resize(width, height)
        drawStage(app, pixi, assets, masterRef.current, raceRef.current, width, height)
        lastSignatureRef.current = signature
      } catch {
        failRef.current?.()
      }
    }

    const initialize = async () => {
      try {
        const host = hostRef.current
        if (!host) return

        pixi = await import('pixi.js')
        if (disposed) return

        assetLease = await acquirePixelHorseAssets(pixi)
        if (disposed) {
          await assetLease.release()
          assetLease = null
          return
        }

        app = new pixi.Application()
        await app.init({
          width: Math.max(320, Math.floor(host.clientWidth)),
          height: Math.max(220, Math.floor(host.clientHeight)),
          antialias: true,
          autoDensity: true,
          backgroundColor: 0xf8fafc,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        })

        if (disposed) {
          app.destroy({ removeView: true }, { children: true })
          await assetLease.release()
          assetLease = null
          return
        }

        appRef.current = app
        pixiRef.current = pixi
        assetsRef.current = assetLease.assets
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
        masterRef.current.reducedMotion = reducedMotion.matches
        tickerCallback = (ticker) => {
          try {
            masterRef.current.reducedMotion = reducedMotion.matches
            if (!reducedMotion.matches) updateMasterAnimation(masterRef.current, ticker)
            updateMotion(masterRef.current, ticker, raceRef.current)
            updateFinishSequence(masterRef.current, reducedMotion.matches)
            publishTimingSnapshot()
            if (app && pixi) {
              updateCountdown(
                masterRef.current,
                raceRef.current,
                pixi,
                app.screen.width
              )
              updateTemporaryStandingVisuals(
                masterRef.current,
                raceRef.current,
                app.screen.width
              )
            }
          } catch {
            failRef.current?.()
          }
        }
        let released = false
        const release = () => {
          if (released || !app) return
          released = true
          resizeObserver?.disconnect()
          if (visibilityCallback) document.removeEventListener('visibilitychange', visibilityCallback)
          if (pageShowCallback) window.removeEventListener('pageshow', pageShowCallback)
          visibilityCallback = null
          pageShowCallback = null
          resyncVisibleStage = null
          if (tickerCallback) app.ticker.remove(tickerCallback)
          tickerCallback = null
          if (appRef.current === app) appRef.current = null
          pixiRef.current = null
          assetsRef.current = null
          lastSignatureRef.current = ''
          masterRef.current.visuals = []
          masterRef.current.motionStates.clear()
          masterRef.current.motionRaceId = null
          masterRef.current.motionStartTimestamp = null
          masterRef.current.motionStatus = ''
          masterRef.current.lastWallClockCorrectionAt = 0
          masterRef.current.simulationAccumulatorMs = 0
          masterRef.current.simulationInitialized = false
          masterRef.current.simulationStep = 0
          masterRef.current.reducedMotion = false
          destroyCountdownVisual(masterRef.current.countdown)
          masterRef.current.countdown.processedSignatures.clear()
          masterRef.current.countdown.raceId = null
          masterRef.current.countdown.phase = 'idle'
          masterRef.current.temporaryStandings.label = null
          masterRef.current.temporaryStandings.lastPublishedAt = 0
          masterRef.current.temporaryStandings.raceId = null
          masterRef.current.temporaryStandings.ranks.clear()
          clearFinishSequence(masterRef.current)
          try {
            app.destroy({ removeView: true }, { children: true })
          } catch {
            // A partially initialized renderer may already have released its resources.
          }
          const lease = assetLease
          assetLease = null
          if (lease) void lease.release()
        }
        cleanupRef.current = release
        failRef.current = () => {
          if (disposed) return
          release()
          setFailed(true)
        }
        app.ticker.add(tickerCallback)
        app.ticker.start()
        app.canvas.style.display = 'block'
        app.canvas.style.height = '100%'
        app.canvas.style.width = '100%'
        app.canvas.tabIndex = -1
        app.canvas.setAttribute('aria-hidden', 'true')
        host.replaceChildren(app.canvas)

        resizeObserver = new ResizeObserver(() => redraw(true))
        resizeObserver.observe(host)
        redraw(true)

        resyncVisibleStage = () => {
          if (
            disposed
            || document.visibilityState !== 'visible'
            || !app
            || appRef.current !== app
          ) return

          try {
            correctMotionToWallClock(masterRef.current, raceRef.current)
            updateFinishSequence(masterRef.current, masterRef.current.reducedMotion)
            publishTimingSnapshot(true)
            updateTemporaryStandingVisuals(
              masterRef.current,
              raceRef.current,
              app.screen.width,
              true
            )
            renderMotionPositions(masterRef.current)
            app.render()
          } catch {
            failRef.current?.()
          }
        }
      } catch {
        if (!disposed) {
          if (cleanupRef.current) {
            cleanupRef.current()
          } else {
            if (visibilityCallback) {
              document.removeEventListener('visibilitychange', visibilityCallback)
            }
            if (pageShowCallback) window.removeEventListener('pageshow', pageShowCallback)
            visibilityCallback = null
            pageShowCallback = null
            resyncVisibleStage = null
            try {
              app?.destroy({ removeView: true }, { children: true })
            } catch {
              // Pixi may fail before a renderer exists; there is nothing left to release.
            }
            const lease = assetLease
            assetLease = null
            if (lease) void lease.release()
          }
          setFailed(true)
        } else if (assetLease) {
          await assetLease.release()
          assetLease = null
        }
      }
    }

    void initialize()

    return () => {
      disposed = true
      failRef.current = null
      if (visibilityCallback) document.removeEventListener('visibilitychange', visibilityCallback)
      if (pageShowCallback) window.removeEventListener('pageshow', pageShowCallback)
      visibilityCallback = null
      pageShowCallback = null
      resyncVisibleStage = null
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [])

  useEffect(() => {
    raceRef.current = race
    observeRaceForCountdown(
      masterRef.current.countdown,
      race,
      document.visibilityState
    )
    const app = appRef.current
    const pixi = pixiRef.current
    const assets = assetsRef.current
    const host = hostRef.current
    if (!app || !pixi || !assets || !host) return

    const signature = visualSignature(race)
    if (lastSignatureRef.current === signature) return

    const width = Math.max(320, Math.floor(host.clientWidth))
    const height = Math.max(220, Math.floor(host.clientHeight))
    try {
      app.renderer.resize(width, height)
      drawStage(app, pixi, assets, masterRef.current, race, width, height)
      lastSignatureRef.current = signature
    } catch {
      failRef.current?.()
    }
  }, [race])

  if (failed) return fallback ?? null

  const status = race.status.toLowerCase()
  const showTemporaryFinishResults = ['live', 'completed', 'official'].includes(status)
  const entryById = new Map(race.entries.map((entry) => [entry.raceEntryId, entry]))

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold text-gray-900">Đường đua trực tiếp</h2>
          <p className="mt-1 text-xs text-gray-500">
            {status === 'live'
              ? 'Mô phỏng phía client được khôi phục theo thời điểm bắt đầu; kết quả thật vẫn do hệ thống ghi nhận.'
              : 'PixelHorse hiển thị theo trạng thái cuộc đua; vị trí mô phỏng không tạo kết quả.'}
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-950 px-4 py-2 text-right text-white shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">Đồng hồ cuộc đua</p>
          <p className="font-mono text-xl font-black tabular-nums" aria-live="off">
            {formatRaceClock(timingSnapshot.elapsedMs)}
          </p>
        </div>
      </div>
      {finishValidation.kind === 'invalid' && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800" role="alert">
          Không thể hiển thị thứ tự về đích: {finishValidation.error}
        </div>
      )}
      <div
        ref={hostRef}
        className="relative w-full overflow-hidden bg-slate-50"
        style={{ height: `${stageHeight}px`, minWidth: 0 }}
        role="img"
        aria-label={`Mô phỏng đường đua trực tiếp. Trạng thái: ${accessibleRaceStatus[race.status.toLowerCase()] ?? race.status}. Có ${race.entries.length} ngựa.`}
      >
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500">Đang chuẩn bị đường đua...</div>
      </div>
      {showTemporaryFinishResults && (
        <div className="border-t border-slate-200 bg-white">
          <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-black tracking-wide text-slate-950">{status === 'official' ? 'KẾT QUẢ CHÍNH THỨC' : 'KẾT QUẢ CÁN ĐÍCH TẠM THỜI'}</h3>
              <p className={`mt-1 text-xs font-semibold ${status === 'official' ? 'text-blue-700' : 'text-amber-700'}`}>{status === 'live' ? 'Chờ Referee kết thúc cuộc đua' : status === 'completed' ? 'Chờ kiểm tra hậu đua' : 'Đã được Admin công bố'}</p>
            </div>
            <p className="text-xs text-slate-500">Không thay thế kết quả do trọng tài xác nhận.</p>
          </div>
          {timingSnapshot.results.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Đang chờ ngựa đầu tiên cán đích.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Hạng</th>
                    <th className="px-5 py-3">GATE</th>
                    <th className="px-5 py-3">Tên ngựa</th>
                    <th className="px-5 py-3">Jockey</th>
                    <th className="px-5 py-3">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {timingSnapshot.results.map((result) => {
                    const entry = entryById.get(result.raceEntryId)
                    if (!entry) return null
                    return (
                      <tr key={result.raceEntryId}>
                        <td className="px-5 py-3 font-black text-slate-950">{result.finishPosition}</td>
                        <td className="px-5 py-3 font-bold text-slate-600">{entry.postPosition ?? '—'}</td>
                        <td className="px-5 py-3 font-bold text-slate-900">{entry.horseName}</td>
                        <td className="px-5 py-3 text-slate-600">{entry.jockeyName}</td>
                        <td className="px-5 py-3 font-mono font-bold tabular-nums text-slate-900">{formatRaceClock(result.finishElapsedMs)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
