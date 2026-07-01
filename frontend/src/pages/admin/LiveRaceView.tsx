import { FiMonitor } from 'react-icons/fi';
import styles from './LiveRaceView.module.scss';

const LiveRaceView = () => (
  <div className={styles.container}>
    <div className={styles.pageHeader}>
      <h1 className={styles.heading}>Admin Workspace</h1>
      <p className={styles.subtext}>System operations and governance</p>
    </div>
    <div className={styles.sectionHeader}>
      <span className={styles.noFeedBadge}>No live feed</span>
      <h2 className={styles.sectionTitle}>Live Race View</h2>
      <p className={styles.sectionDesc}>Live telemetry and runner positions will appear here when connected to official race timing data.</p>
    </div>
    <div className={styles.card}>
      <div className={styles.empty}>
        <div className={styles.emptyIcon}><FiMonitor size={24} /></div>
        <h3 className={styles.emptyTitle}>No live race feed</h3>
        <p className={styles.emptyDesc}>Connect this screen to a live race endpoint to show runners and splits.</p>
      </div>
    </div>
  </div>
);

export default LiveRaceView;