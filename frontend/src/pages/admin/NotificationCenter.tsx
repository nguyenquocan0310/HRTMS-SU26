import { useEffect, useState } from 'react';
import { FiBell, FiCheck } from 'react-icons/fi';
import { apiFetch } from '../../services/apiClient';
import styles from './NotificationCenter.module.scss';

interface NotificationItem {
  notificationId: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  type: string;
}

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
};

const NotificationCenter = () => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = () => {
    setLoading(true);
    apiFetch<{ success: boolean; data: NotificationItem[] }>('/notifications')
      .then((res) => setItems(res.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadNotifications(); }, []);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await apiFetch('/notifications/mark-all-read', { method: 'PATCH' });
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
    setMarkingAll(false);
  };

  const handleMarkRead = async (id: number) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
      setItems((prev) => prev.map((n) => n.notificationId === id ? { ...n, isRead: true } : n));
    } catch {}
  };

  const unreadCount = items.filter((n) => !n.isRead).length;

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Admin Workspace</h1>
        <p className={styles.subtext}>System operations and governance</p>
      </div>

      <div className={styles.sectionHeader}>
        <div className={styles.sectionTop}>
          <h2 className={styles.sectionTitle}>Notification Center</h2>
          <button
            type="button"
            className={styles.markAllBtn}
            onClick={handleMarkAllRead}
            disabled={markingAll || unreadCount === 0}
          >
            <FiCheck size={14} /> Mark all read
          </button>
        </div>
        <p className={styles.sectionDesc}>Operational alerts and approval updates will appear here when connected to the notification API.</p>
      </div>

      <div className={styles.card}>
        {loading ? (
          <p className={styles.loading}>Đang tải...</p>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}><FiBell size={24} /></div>
            <h3 className={styles.emptyTitle}>No notifications</h3>
            <p className={styles.emptyDesc}>New alerts will appear after a backend notification endpoint is wired.</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {items.map((n) => (
              <li key={n.notificationId} className={`${styles.item} ${!n.isRead ? styles.unread : ''}`}>
                <div className={styles.itemLeft}>
                  <div className={styles.itemIcon}><FiBell size={15} /></div>
                  <div className={styles.itemBody}>
                    <span className={styles.itemTitle}>{n.title}</span>
                    <span className={styles.itemMsg}>{n.message}</span>
                    <span className={styles.itemTime}>{relativeTime(n.createdAt)}</span>
                  </div>
                </div>
                {!n.isRead && (
                  <button type="button" className={styles.readBtn} onClick={() => handleMarkRead(n.notificationId)}>
                    <FiCheck size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;