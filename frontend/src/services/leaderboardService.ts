import { apiFetch } from './apiClient'

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T | null
}

export type LeaderboardMode = 'points' | 'earnings'

export interface HorseLeaderboardEntry {
  horseId: number
  horseName: string | null
  races: number
  wins: number
  totalPoints: number
  totalEarnings: number
  winRate: number
  rank: number
}

export interface JockeyLeaderboardEntry {
  jockeyId: number
  jockeyName: string | null
  races: number
  wins: number
  totalPoints: number
  totalEarnings: number
  winRate: number
  rank: number
}

const unwrapLeaderboard = <T>(response: ApiResponse<T>): T => {
  if (!response.success || response.data == null) {
    throw new Error(response.message || 'Không tải được bảng xếp hạng.')
  }

  return response.data
}

const buildLeaderboardQuery = (tournamentId: number, mode: LeaderboardMode) => {
  const params = new URLSearchParams({
    tournamentId: String(tournamentId),
    mode,
  })

  return params.toString()
}

export const getHorseLeaderboard = async (
  tournamentId: number,
  mode: LeaderboardMode,
  signal?: AbortSignal
) =>
  unwrapLeaderboard(
    await apiFetch<ApiResponse<HorseLeaderboardEntry[]>>(
      `/leaderboard/horses?${buildLeaderboardQuery(tournamentId, mode)}`,
      { signal }
    )
  )

export const getJockeyLeaderboard = async (
  tournamentId: number,
  mode: LeaderboardMode,
  signal?: AbortSignal
) =>
  unwrapLeaderboard(
    await apiFetch<ApiResponse<JockeyLeaderboardEntry[]>>(
      `/leaderboard/jockeys?${buildLeaderboardQuery(tournamentId, mode)}`,
      { signal }
    )
  )
