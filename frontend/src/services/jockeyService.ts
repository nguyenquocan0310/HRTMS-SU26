import { apiFetch } from './apiClient'
import type {
  JockeyCareerStats,
  JockeyProfile,
  JockeyRaceEntry,
  RaceInvitation,
} from '../types/jockey.types'

export interface UpdateProfilePayload {
  licenseCertificate?: string | null
  bloodType?: string | null
  healthStatus?: string | null
  selfDeclaredWeight?: number | null
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

interface JockeyInvitationResponse {
  pairingId: number
  horse: { horseId: number; name: string; breed: string }
  owner: { ownerId: number; fullName: string }
  requestMessage: string | null
  status: RaceInvitation['status']
  createdAt: string
  respondedAt: string | null
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
): Promise<PagedResult<RaceInvitation>> => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (status) params.set('status', status)

  const response = await apiFetch<
    PagedResult<JockeyInvitationResponse> | ApiResponse<PagedResult<JockeyInvitationResponse>>
  >(`/jockeys/invitations?${params.toString()}`)
  const result = unwrapPaged(response)
  return {
    ...result,
    items: result.items.map((item) => ({
      pairingId: item.pairingId,
      ownerId: item.owner.ownerId,
      ownerName: item.owner.fullName,
      horseId: item.horse.horseId,
      horseName: item.horse.name,
      breedCode: item.horse.breed,
      status: item.status,
      invitedAt: item.createdAt,
      respondedAt: item.respondedAt,
      requestMessage: item.requestMessage,
    })),
  }
}

export const acceptPairing = async (pairingId: number): Promise<unknown> => {
  const response = await apiFetch<ApiResponse<unknown>>(`/pairings/${pairingId}/accept`, {
    method: 'PATCH',
  })
  if (!response.success) throw new Error(response.message || 'Chấp nhận lời mời thất bại.')
  return response.data
}

export const declinePairing = async (
  pairingId: number,
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
  status?: string,
): Promise<PagedResult<JockeyRaceEntry>> => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (status) params.set('status', status)
  const response = await apiFetch<
    PagedResult<JockeyRaceEntry> | ApiResponse<PagedResult<JockeyRaceEntry>>
  >(`/jockeys/race-entries/my?${params.toString()}`)
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
