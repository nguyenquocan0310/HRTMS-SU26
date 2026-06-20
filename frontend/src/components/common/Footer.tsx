import { Link } from 'react-router-dom';
import {
  FiShare2,
  FiMail,
  FiPhone,
} from 'react-icons/fi';
import styles from './Footer.module.scss';

const ECOSYSTEM = [
  { label: 'Owner Console', path: '/owner' },
  { label: 'Jockey Insights', path: '/jockey' },
  { label: 'Referee Hub', path: '/referee' },
  { label: 'Doctor Portal', path: '/doctor' },
];

const RESOURCES = [
  { label: 'Racing Rulebook', path: '#' },
  { label: 'API Documentation', path: '#' },
  { label: 'Integrity Reports', path: '#' },
  { label: 'Support Center', path: '#' },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className="row gy-5">
          {/* Column 1 — Brand */}
          <div className="col-lg-3 col-md-6">
            <Link to="/" className={styles.logo}>
              HRTMS
            </Link>
            <p className={styles.tagline}>
              Next‑generation thoroughbred racing management. Empowering owners, jockeys, and officials worldwide.
            </p>
            <div className={styles.socialRow}>
              <a href="#" className={styles.socialIcon} aria-label="Share">
                <FiShare2 />
              </a>
              <a href="#" className={styles.socialIcon} aria-label="Email">
                <FiMail />
              </a>
              <a href="#" className={styles.socialIcon} aria-label="Phone">
                <FiPhone />
              </a>
            </div>
          </div>

          {/* Column 2 — Ecosystem */}
          <div className="col-lg-3 col-md-6">
            <h6 className={styles.heading}>ECOSYSTEM</h6>
            <ul className={styles.linkList}>
              {ECOSYSTEM.map((item) => (
                <li key={item.label}>
                  <Link to={item.path}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Resources */}
          <div className="col-lg-3 col-md-6">
            <h6 className={styles.heading}>RESOURCES</h6>
            <ul className={styles.linkList}>
              {RESOURCES.map((item) => (
                <li key={item.label}>
                  <Link to={item.path}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 — Connect */}
          <div className="col-lg-3 col-md-6">
            <h6 className={styles.heading}>CONNECT</h6>
            <ul className={styles.contactList}>
              <li>
                <FiShare2 className={styles.contactIcon} />
                <span>@hrtms_official</span>
              </li>
              <li>
                <FiMail className={styles.contactIcon} />
                <a href="mailto:hq@hrtms.management">hq@hrtms.management</a>
              </li>
              <li>
                <FiPhone className={styles.contactIcon} />
                <span>+1 (555) 234-5678</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className={styles.bottomBar}>
          <span>© {currentYear} HRTMS — Horse Racing Thoroughbred Management System. All rights reserved.</span>
          <div className={styles.bottomLinks}>
            <Link to="#">Privacy</Link>
            <Link to="#">Terms</Link>
            <Link to="#">Regulatory</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
