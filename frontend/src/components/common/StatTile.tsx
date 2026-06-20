import { Link } from 'react-router-dom';
import styles from './StatTile.module.scss';

interface StatTileProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  linkTo?: string;
  variant?: 'default' | 'urgent';
}

const StatTile = ({ label, value, icon, linkTo, variant = 'default' }: StatTileProps) => {
  const content = (
    <div className={`${styles.tile} ${variant === 'urgent' ? styles.urgent : ''}`}>
      <div className={styles.iconWrap}>{icon}</div>
      <div className={styles.textWrap}>
        <span className={styles.value}>{value}</span>
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className={styles.tileLink}>
        {content}
      </Link>
    );
  }

  return content;
};

export default StatTile;