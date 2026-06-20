import { Link, useLocation } from 'react-router-dom';
import {
  FiSearch,
  FiBell,
  FiHelpCircle,
  FiUser,
} from 'react-icons/fi';
import styles from './Navbar.module.scss';

const NAV_ITEMS = [
  { label: 'Admin', path: '/admin' },
  { label: 'Owner', path: '/owner' },
  { label: 'Jockey', path: '/jockey' },
  { label: 'Spectator', path: '/spectator' },
];

export default function Navbar() {
  const location = useLocation();

  return (
    <nav className={`${styles.navbar} fixed-top`}>
      <div className="container-fluid px-4 d-flex align-items-center justify-content-between">
        {/* Logo */}
        <Link to="/" className={styles.logo}>
          HRTMS
        </Link>

        {/* Centre nav */}
        <ul className={`d-none d-md-flex align-items-center gap-1 mb-0 list-unstyled ${styles.navList}`}>
          {NAV_ITEMS.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`${styles.navLink} ${
                  location.pathname.startsWith(item.path) ? styles.active : ''
                }`}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right section */}
        <div className="d-flex align-items-center gap-3">
          <Link to="/login" className={styles.loginBtn}>
            LOGIN
          </Link>
          <div className={`d-none d-lg-flex align-items-center gap-3 ${styles.iconGroup}`}>
            <button className={styles.iconBtn} aria-label="Search">
              <FiSearch />
            </button>
            <button className={styles.iconBtn} aria-label="Notifications">
              <FiBell />
            </button>
            <button className={styles.iconBtn} aria-label="Help">
              <FiHelpCircle />
            </button>
            <button className={styles.iconBtn} aria-label="Profile">
              <FiUser />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
