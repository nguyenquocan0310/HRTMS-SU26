import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiBell, FiCheck, FiRefreshCw } from 'react-icons/fi'
import {
  emitNotificationsChanged,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '../../services/notificationService'

const PAGE_SIZE = 20
const relativeTimeFormatter = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' })

function formatRelativeTime(sentAt: string): string {
  const timestamp = new Date(sentAt).getTime()
  if (Number.isNaN(timestamp)) return 'Không rõ thời gian'

  const elapsedSeconds = Math.round((timestamp - Date.now()) / 1_000)
  const absoluteSeconds = Math.abs(elapsedSeconds)

  if (absoluteSeconds < 60) return relativeTimeFormatter.format(elapsedSeconds, 'second')

  const elapsedMinutes = Math.round(elapsedSeconds / 60)
  if (Math.abs(elapsedMinutes) < 60) return relativeTimeFormatter.format(elapsedMinutes, 'minute')

  const elapsedHours = Math.round(elapsedMinutes / 60)
  if (Math.abs(elapsedHours) < 24) return relativeTimeFormatter.format(elapsedHours, 'hour')

  const elapsedDays = Math.round(elapsedHours / 24)
  if (Math.abs(elapsedDays) < 30) return relativeTimeFormatter.format(elapsedDays, 'day')

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Không thể tải thông báo. Vui lòng thử lại.'
}

interface NotificationCenterProps { iconless?: boolean }

export default function NotificationCenter({ iconless = false }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [markingIds, setMarkingIds] = useState<Set<number>>(() => new Set())
  const [error, setError] = useState<string | null>(null)

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications],
  )

  const loadInitialNotifications = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const items = await getNotifications(1, PAGE_SIZE)
      setNotifications(items)
      setPage(1)
      setHasMore(items.length === PAGE_SIZE)
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadInitialNotifications()
    }, 0)

    return () => window.clearTimeout(initialLoadId)
  }, [loadInitialNotifications])

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    setError(null)
    const nextPage = page + 1

    try {
      const items = await getNotifications(nextPage, PAGE_SIZE)
      setNotifications((current) => [...current, ...items])
      setPage(nextPage)
      setHasMore(items.length === PAGE_SIZE)
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoadingMore(false)
    }
  }

  const handleMarkRead = async (notificationId: number) => {
    if (markingIds.has(notificationId)) return

    setMarkingIds((current) => new Set(current).add(notificationId))
    setError(null)

    try {
      await markNotificationRead(notificationId)
      setNotifications((current) =>
        current.map((notification) =>
          notification.notificationId === notificationId
            ? { ...notification, isRead: true }
            : notification,
        ),
      )
      emitNotificationsChanged()
    } catch (markError) {
      setError(getErrorMessage(markError))
    } finally {
      setMarkingIds((current) => {
        const next = new Set(current)
        next.delete(notificationId)
        return next
      })
    }
  }

  const handleMarkAllRead = async () => {
    if (markingAll || unreadCount === 0) return

    setMarkingAll(true)
    setError(null)

    try {
      await markAllNotificationsRead()
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, isRead: true })),
      )
      emitNotificationsChanged()
    } catch (markError) {
      setError(getErrorMessage(markError))
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl" aria-labelledby="notification-center-title">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">HRTMS</p>
          <h1 id="notification-center-title" className="mt-1 text-2xl font-black text-gray-950 sm:text-3xl">
            Trung tâm thông báo
          </h1>
          <p className="mt-2 text-sm text-gray-500">Theo dõi các cập nhật mới nhất từ hệ thống.</p>
        </div>

        <button
          type="button"
          onClick={() => void handleMarkAllRead()}
          disabled={markingAll || unreadCount === 0}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400"
        >
          {!iconless && (markingAll ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : <FiCheck aria-hidden="true" />)}
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          {notifications.length === 0 && (
            <button
              type="button"
              onClick={() => void loadInitialNotifications()}
              className="font-bold underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Thử lại
            </button>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-3 text-sm text-gray-500">
            {!iconless && <FiRefreshCw className="animate-spin" aria-hidden="true" />}
            Đang tải thông báo...
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            {!iconless && <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400"><FiBell size={24} aria-hidden="true" /></span>}
            <h2 className="text-base font-bold text-gray-800">Chưa có thông báo</h2>
            <p className="mt-1 text-sm text-gray-500">Các cập nhật mới sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {notifications.map((notification) => {
              const marking = markingIds.has(notification.notificationId)
              return (
                <li
                  key={notification.notificationId}
                  className={`flex gap-3 px-4 py-4 transition-colors sm:gap-4 sm:px-6 ${
                    notification.isRead ? 'bg-white' : 'bg-blue-50/60'
                  }`}
                >
                  {!iconless && <span className={`mt-0.5 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${notification.isRead ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'}`}><FiBell size={17} aria-hidden="true" /></span>}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <h2 className={`text-sm text-gray-900 ${notification.isRead ? 'font-semibold' : 'font-extrabold'}`}>
                        {notification.title}
                      </h2>
                      <time className="flex-shrink-0 text-xs text-gray-400" dateTime={notification.sentAt} title={new Date(notification.sentAt).toLocaleString('vi-VN')}>
                        {formatRelativeTime(notification.sentAt)}
                      </time>
                    </div>
                    <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-gray-600">
                      {notification.message}
                    </p>
                  </div>

                  {!notification.isRead && (
                    <button
                      type="button"
                      onClick={() => void handleMarkRead(notification.notificationId)}
                      disabled={marking}
                      aria-label={`Đánh dấu “${notification.title}” đã đọc`}
                      title="Đánh dấu đã đọc"
                      className={`inline-flex flex-shrink-0 items-center justify-center rounded-lg text-blue-700 transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-wait disabled:opacity-50 ${iconless ? 'min-h-9 px-3 text-xs font-bold' : 'h-9 w-9'}`}
                    >
                      {iconless ? (marking ? 'Đang xử lý...' : 'Đánh dấu đã đọc') : marking ? <FiRefreshCw className="animate-spin" aria-hidden="true" /> : <FiCheck aria-hidden="true" />}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!loading && hasMore && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => void handleLoadMore()}
            disabled={loadingMore}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            {loadingMore && !iconless && <FiRefreshCw className="animate-spin" aria-hidden="true" />}
            {loadingMore ? 'Đang tải...' : 'Tải thêm'}
          </button>
        </div>
      )}
    </section>
  )
}
