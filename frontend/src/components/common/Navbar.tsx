import { Link } from 'react-router-dom';
import { FiLogIn } from 'react-icons/fi';
import styles from './Navbar.module.scss';

const NAV_ITEMS = [
  { label: 'Giải đấu', path: '#tournaments' },
  { label: 'Lịch đua', path: '#schedule' },
  { label: 'Quy trình', path: '#process' },
];

export default function Navbar() {
  return (
    <nav className={styles.navbar}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          HRTMS
        </Link>

        <ul className={styles.navList}>
          {NAV_ITEMS.map((item) => (
            <li key={item.path}>
              <a href={item.path} className={styles.navLink}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <Link to="/login" className={styles.loginBtn}>
            <FiLogIn size={15} />
            Đăng nhập
          </Link>
          <Link to="/register" className={styles.registerBtn}>
            Đăng ký
          </Link>
        </div>
      </div>
    </nav>
  );
}