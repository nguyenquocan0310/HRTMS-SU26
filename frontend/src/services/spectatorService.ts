import { apiFetch } from './apiClient'

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T | null
}

export interface WalletTransaction {
  transactionId: number
  amount: number
  type: string
  referenceId: string | null
  createdAt: string
}

export interface SpectatorWallet {
  walletId: number
  balance: number
  transactions: WalletTransaction[]
  totalTransactions: number
}

export interface WalletTransactionPage {
  items: WalletTransaction[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export interface SpectatorPrediction {
  predictionId: number
  raceId: number
  raceName: string
  horseName: string
  predictionType: string
  pointsPlaced: number
  status: string
  pointsAwarded: number | null
  createdAt: string
}

export interface PredictionGateStatus {
  raceId: number
  isPostPositionDrawn: boolean
  isPredictionGateClosed: boolean
  raceStatus: string
  canPredict: boolean
}

export interface PredictionFormScore {
  raceEntryId: number
  horseId: number
  horseName: string
  jockeyId: number
  jockeyName: string
  horseHistoryScore: number
  jockeyHistoryScore: number
  roundTypeAvgScore: number
  formScore: number
}

export interface CreatePredictionPayload {
  raceId: number
  raceEntryId: number
  pointsPlaced: number
}

export interface PredictionResult extends SpectatorPrediction {
  walletBalanceAfter: number
}

export interface LiveRaceEntry {
  raceEntryId: number
  postPosition: number | null
  status: string
  isWithdrawn: boolean
  horseId: number
  horseName: string
  jockeyId: number
  jockeyName: string
  finishPosition: number | null
  finishTime: number | null
}

export interface RaceLiveStatus {
  raceId: number
  status: string
  scheduledTime: string | null
  actualStartTime: string | null
  raceDurationSeconds: number | null
  entries: LiveRaceEntry[]
}

export interface RaceViolation {
  violationId?: number
  raceEntryId: number | null
  horseName?: string | null
  violationCode: string
  penalty: string
  description?: string | null
  loggedAt?: string | null
}

export interface RedeemTicketResult {
  pointsAdded: number
  newBalance: number
}

const unwrap = <T>(response: ApiResponse<T> | T): T => {
  if (response && typeof response === 'object' && 'success' in response) {
    const wrapped = response as ApiResponse<T>
    if (!wrapped.success || wrapped.data == null) {
      throw new Error(wrapped.message || 'API trả về dữ liệu không hợp lệ.')
    }
    return wrapped.data
  }
  return response as T
}

export const getSpectatorWallet = async () =>
  unwrap(await apiFetch<ApiResponse<SpectatorWallet> | SpectatorWallet>('/reconciliation/wallet'))

export const getWalletTransactions = async (page = 1, pageSize = 50) =>
  unwrap(
    await apiFetch<ApiResponse<WalletTransactionPage> | WalletTransactionPage>(
      `/reconciliation/wallet/transactions?page=${page}&pageSize=${pageSize}`
    )
  )

export const getMyPredictions = async () =>
  unwrap(
    await apiFetch<ApiResponse<SpectatorPrediction[]> | SpectatorPrediction[]>(
      '/reconciliation/predictions'
    )
  )

export const getPredictionGateStatus = async (raceId: number) =>
  unwrap(
    await apiFetch<ApiResponse<PredictionGateStatus> | PredictionGateStatus>(
      `/predictions/races/${raceId}/gate-status`
    )
  )

export const getPredictionFormScores = async (raceId: number) =>
  unwrap(
    await apiFetch<ApiResponse<PredictionFormScore[]> | PredictionFormScore[]>(
      `/predictions/races/${raceId}/form-scores`
    )
  )

export const createPrediction = async (payload: CreatePredictionPayload) =>
  unwrap(
    await apiFetch<ApiResponse<PredictionResult> | PredictionResult>('/predictions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  )

export const redeemTicketCode = async (code: string) =>
  unwrap(
    await apiFetch<ApiResponse<RedeemTicketResult> | RedeemTicketResult>(
      '/wallet/ticket-codes/redeem',
      { method: 'POST', body: JSON.stringify({ code }) }
    )
  )

export const getRaceLiveStatus = async (raceId: number) =>
  unwrap(
    await apiFetch<ApiResponse<RaceLiveStatus> | RaceLiveStatus>(`/races/${raceId}/live-status`)
  )

export const getRaceViolations = async (raceId: number) =>
  unwrap(
    await apiFetch<ApiResponse<RaceViolation[]> | RaceViolation[]>(`/races/${raceId}/violations`)
  )
