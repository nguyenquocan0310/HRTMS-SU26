import { useCallback, useEffect, useState } from 'react'
import { FiBell } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import {
  getUnreadNotificationCount,
  NOTIFICATIONS_CHANGED_EVENT,
} from '../../services/notificationService'

interface NotificationBellProps {
  notificationsPath: string
  textOnly?: boolean
}

const POLLING_INTERVAL_MS = 45_000

export default function NotificationBell({ notificationsPath, textOnly = false }: NotificationBellProps) {
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)

  const refreshUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadNotificationCount()
      setUnreadCount(Math.max(0, count))
    } catch (error) {
      console.error('Không thể cập nhật số thông báo chưa đọc:', error)
    }
  }, [])

  useEffect(() => {
    const initialRefreshId = window.setTimeout(() => {
      void refreshUnreadCount()
    }, 0)

    const intervalId = window.setInterval(() => {
      void refreshUnreadCount()
    }, POLLING_INTERVAL_MS)

    const handleNotificationsChanged = () => {
      void refreshUnreadCount()
    }
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged)

    return () => {
      window.clearTimeout(initialRefreshId)
      window.clearInterval(intervalId)
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged)
    }
  }, [refreshUnreadCount])

  return (
    <button
      type="button"
      onClick={() => navigate(notificationsPath)}
      aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
      className={`relative inline-flex h-10 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${textOnly ? 'px-4 text-xs font-bold' : 'w-10'}`}
    >
      {textOnly ? 'Thông báo' : <FiBell aria-hidden="true" size={19} />}
      {unreadCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
