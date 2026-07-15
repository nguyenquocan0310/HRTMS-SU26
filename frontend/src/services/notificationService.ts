import { apiFetch } from './apiClient'

export interface Notification {
  notificationId: number
  title: string
  message: string
  type: string
  isRead: boolean
  relatedEntityType: string | null
  relatedEntityId: number | null
  sentAt: string
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

interface UnreadCount {
  count: number
}

export const NOTIFICATIONS_CHANGED_EVENT = 'hrtms:notifications-changed'

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.success) {
    throw new Error(response.message || 'Không thể xử lý thông báo.')
  }

  return response.data
}

export async function getNotifications(page = 1, pageSize = 20): Promise<Notification[]> {
  const response = await apiFetch<ApiResponse<Notification[]>>(
    `/notifications/all?page=${page}&pageSize=${pageSize}`,
  )
  return unwrap(response)
}

export async function getUnreadNotificationCount(): Promise<number> {
  const response = await apiFetch<ApiResponse<UnreadCount>>('/notifications/count')
  return unwrap(response).count
}

export async function markNotificationRead(notificationId: number): Promise<void> {
  await apiFetch<void>(`/notifications/${notificationId}/read`, { method: 'PATCH' })
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch<void>('/notifications/read-all', { method: 'PATCH' })
}

export function emitNotificationsChanged(): void {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
}
