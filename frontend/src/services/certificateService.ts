import { API_BASE_URL, apiFetch } from './apiClient'
import type { ApiResponse, CertificateMetadata } from '../types/account.types'

const getToken = () =>
  sessionStorage.getItem('token') ?? localStorage.getItem('token')

const resolveDownloadUrl = (downloadUrl: string): string => {
  if (/^https?:\/\//i.test(downloadUrl)) return downloadUrl

  const apiBase = new URL(API_BASE_URL, window.location.origin)
  if (downloadUrl.startsWith('/')) {
    return new URL(downloadUrl, apiBase.origin).toString()
  }

  return `${API_BASE_URL.replace(/\/$/, '')}/${downloadUrl.replace(/^\//, '')}`
}

export const getMyCertificateMetadata = async (): Promise<CertificateMetadata> => {
  const response = await apiFetch<ApiResponse<CertificateMetadata>>('/certificates/me')
  if (!response.success || !response.data) {
    throw new Error(response.message || 'Không tải được thông tin chứng chỉ.')
  }

  return response.data
}

export const downloadCertificateFile = async (
  downloadUrl: string,
): Promise<Blob> => {
  const token = getToken()
  const response = await fetch(resolveDownloadUrl(downloadUrl), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!response.ok) {
    let serverMessage = ''
    try {
      const body = await response.json() as { message?: string }
      serverMessage = body.message ?? ''
    } catch {
      // File endpoints may return an empty or non-JSON error response.
    }

    const fallbackByStatus: Record<number, string> = {
      401: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      403: 'Bạn không có quyền xem chứng chỉ này.',
      404: 'Không tìm thấy file chứng chỉ trên hệ thống.',
    }
    throw new Error(
      serverMessage || fallbackByStatus[response.status] || 'Không thể tải file chứng chỉ.',
    )
  }

  return response.blob()
}
