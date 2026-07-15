import { apiFetch } from './apiClient'
import type {
  JockeyCareerStats,
  JockeyProfile,
  JockeyRaceEntry,
} from '../types/jockey.types'

export interface UpdateProfilePayload {
  licenseCertificate: string
  experienceYears: number
  bloodType: string | null
  healthStatus: string | null
  selfDeclaredWeight: number
}

export interface PagedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T | null
}

const unwrapPaged = <T>(response: PagedResult<T> | ApiResponse<PagedResult<T>>): PagedResult<T> => {
  if ('success' in response) {
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Không tải được dữ liệu.')
    }
    return response.data
  }
  return response
}

export const getMyProfile = (): Promise<JockeyProfile> =>
  apiFetch<JockeyProfile>('/jockeys/profile')

export const updateMyProfile = (
  payload: UpdateProfilePayload,
): Promise<{ jockeyId: number; status: string; message: string }> =>
  apiFetch('/jockeys/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const getMyInvitations = async (
  status?: string,
  page = 1,
  pageSize = 20,
): Promise<unknown[]> => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (status) params.set('status', status)

  const response = await apiFetch<
    PagedResult<unknown> | ApiResponse<PagedResult<unknown>> | unknown[]
  >(`/jockeys/invitations?${params.toString()}`)

  if (Array.isArray(response)) return response
  return unwrapPaged(response).items
}

export const acceptPairing = async (pairingId: string): Promise<unknown> => {
  const response = await apiFetch<ApiResponse<unknown>>(`/pairings/${pairingId}/accept`, {
    method: 'PATCH',
  })
  if (!response.success) throw new Error(response.message || 'Chấp nhận lời mời thất bại.')
  return response.data
}

export const declinePairing = async (
  pairingId: string,
  responseReason = 'Jockey từ chối lời mời.',
): Promise<unknown> => {
  const response = await apiFetch<ApiResponse<unknown>>(`/pairings/${pairingId}/decline`, {
    method: 'PATCH',
    body: JSON.stringify({ responseReason }),
  })
  if (!response.success) throw new Error(response.message || 'Từ chối lời mời thất bại.')
  return response.data
}

export const getMyJockeyRaceEntries = async (
  page = 1,
  pageSize = 20,
): Promise<PagedResult<JockeyRaceEntry>> => {
  const response = await apiFetch<
    PagedResult<JockeyRaceEntry> | ApiResponse<PagedResult<JockeyRaceEntry>>
  >(`/jockeys/race-entries/my?page=${page}&pageSize=${pageSize}`)
  return unwrapPaged(response)
}

export const getMyCareerStats = (): Promise<JockeyCareerStats> =>
  apiFetch<JockeyCareerStats>('/jockeys/stats/my')

export const getJockeyCareerStats = (jockeyId: number): Promise<JockeyCareerStats> =>
  apiFetch<JockeyCareerStats>(`/jockeys/${jockeyId}/stats`)

// Registration preview helper only. It performs no request and is not used by the
// Jockey profile page, where certificate metadata remains read-only.
export const uploadCertificateFile = async (
  file: File,
): Promise<{ url: string; fileName: string }> => ({
  url: URL.createObjectURL(file),
  fileName: file.name,
})
