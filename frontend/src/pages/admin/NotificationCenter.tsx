/* eslint-disable react-hooks/set-state-in-effect -- Notification state is hydrated from the API. */
import { useCallback, useEffect, useState } from 'react';
import { FiBell, FiCheck, FiRefreshCw } from 'react-icons/fi';
import {
  emitNotificationsChanged,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '../../services/notificationService';
import styles from './NotificationCenter.module.scss';

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diff / 60_000));
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.floor(hours / 24)} ngày trước`;
};

const NotificationCenter = () => {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getNotifications());
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Không tải được thông báo. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadNotifications(); }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    setError('');
    try {
      await markAllNotificationsRead();
      setItems((previous) => previous.map((item) => ({ ...item, isRead: true })));
      emitNotificationsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đánh dấu tất cả thông báo là đã đọc.');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkRead = async (notificationId: number) => {
    setMarkingId(notificationId);
    setError('');
    try {
      await markNotificationRead(notificationId);
      setItems((previous) => previous.map((item) => item.notificationId === notificationId ? { ...item, isRead: true } : item));
      emitNotificationsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đánh dấu thông báo là đã đọc.');
    } finally {
      setMarkingId(null);
    }
  };

  const unreadCount = items.filter((item) => !item.isRead).length;

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Thông báo</h1>
        <p className={styles.subtext}>Cập nhật vận hành và phê duyệt dành cho quản trị viên.</p>
      </div>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTop}>
          <div><h2 className={styles.sectionTitle}>Trung tâm thông báo</h2><p className={styles.sectionDesc}>{unreadCount ? `Có ${unreadCount} thông báo chưa đọc.` : 'Bạn đã đọc tất cả thông báo.'}</p></div>
          <div className={styles.actions}>
            <button type="button" className={styles.markAllBtn} onClick={() => void loadNotifications()} disabled={loading}><FiRefreshCw size={14} /> Tải lại</button>
            <button type="button" className={styles.markAllBtn} onClick={() => void handleMarkAllRead()} disabled={markingAll || unreadCount === 0}><FiCheck size={14} /> {markingAll ? 'Đang cập nhật...' : 'Đánh dấu đã đọc'}</button>
          </div>
        </div>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}
      <div className={styles.card}>
        {loading ? <p className={styles.loading}>Đang tải thông báo...</p> : items.length === 0 ? (
          <div className={styles.empty}><div className={styles.emptyIcon}><FiBell size={24} /></div><h3 className={styles.emptyTitle}>Chưa có thông báo</h3><p className={styles.emptyDesc}>Các cập nhật mới sẽ xuất hiện tại đây.</p></div>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => <li key={item.notificationId} className={`${styles.item} ${!item.isRead ? styles.unread : ''}`}>
              <div className={styles.itemLeft}><div className={styles.itemIcon}><FiBell size={15} /></div><div className={styles.itemBody}><span className={styles.itemTitle}>{item.title}</span><span className={styles.itemMsg}>{item.message}</span><span className={styles.itemTime}>{relativeTime(item.sentAt)}</span></div></div>
              {!item.isRead && <button type="button" className={styles.readBtn} disabled={markingId === item.notificationId} onClick={() => void handleMarkRead(item.notificationId)} aria-label="Đánh dấu đã đọc"><FiCheck size={13} /></button>}
            </li>)}
          </ul>
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
