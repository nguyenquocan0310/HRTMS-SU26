import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiChevronDown,
  FiBarChart2,
  FiActivity,
  FiEye,
} from 'react-icons/fi';
import { LuScale } from 'react-icons/lu';

import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import styles from './LandingPage.module.scss';

/* ─── Static data ───────────────────────────────────────── */
const FEED_ITEMS = [
  { name: 'Royal Stakes — Ascot Cup', status: 'LIVE', statusClass: styles.live },
  { name: 'Dubai World Sprint — Meydan', status: 'UPCOMING', statusClass: styles.upcoming },
  { name: 'Melbourne Classic — Flemington', status: 'COMPLETED', statusClass: styles.completed },
];

const TRACKS = [
  {
    name: 'Epsom Downs',
    badge: 'OFFICIAL TRACK',
    condition: 'Good to Firm',
    races: 12,
    image: 'https://images.unsplash.com/photo-1529040181623-e04ebc611e25?w=640&q=80',
  },
  {
    name: 'Meydan Dubai',
    badge: 'FEATURED VENUE',
    condition: 'Fast',
    races: 8,
    image: 'https://images.unsplash.com/photo-1582650949598-145f6e642b05?w=640&q=80',
  },
  {
    name: 'Flemington Melbourne',
    badge: 'REGIONAL CIRCUIT',
    condition: 'Soft',
    races: 10,
    image: 'https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?w=640&q=80',
  },
];

/* ─── Component ─────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className={styles.landingPage}>
      <Navbar />

      {/* ═══ HERO ═══════════════════════════════════════════ */}
      <section className={styles.hero} id="hero">
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          <span className={styles.heroBadge}>
            <span className={styles.dot} />
            SEASON 2024 NOW LIVE
          </span>

          <h1 className={styles.heroTitle}>
            Experience the{' '}
            <span className={styles.accent}>Pinnacle</span>{' '}
            of Thoroughbred Racing
          </h1>

          <p className={styles.heroDesc}>
            Manage stables, monitor performance analytics, and experience
            live race events — all from a single, beautifully crafted
            management platform.
          </p>

          <div className={styles.heroCta}>
            <Link to="/login" className={styles.btnPrimary}>
              Enter Workspace <FiArrowRight />
            </Link>
            <Link to="#" className={styles.btnOutline}>
              <FiActivity size={16} /> Live Dashboard
            </Link>
          </div>
        </div>

        <div className={styles.scrollIndicator}>
          <FiChevronDown />
        </div>
      </section>

      {/* ═══ STRATEGIC MANAGEMENT + LIVE FEED ═══════════════ */}
      <section className={`${styles.section} container`}>
        <div className="row g-4">
          {/* Strategic Management */}
          <div className="col-lg-7">
            <div className={styles.card}>
              <div className={styles.cardIcon}>
                <FiBarChart2 />
              </div>
              <h3 className={styles.cardTitle}>Strategic Management</h3>
              <p className={styles.cardDesc}>
                Oversee your entire racing portfolio with real-time insights,
                advanced analytics, and intelligent stable management tools
                designed for elite horse owners.
              </p>

              <div className={styles.statsRow}>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>STABLES MANAGED</div>
                  <div className={styles.statValue}>1,248+</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>PERFORMANCE DELTA</div>
                  <div className={styles.statValue}>+18.4%</div>
                </div>
              </div>

              <Link to="/owner" className={styles.cardLink}>
                Manage Your Assets <FiArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Live Feed */}
          <div className="col-lg-5">
            <div className={styles.card}>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h3 className={`${styles.cardTitle} mb-0`}>Live Feed</h3>
                <span className={styles.liveBadge}>
                  <span className={styles.liveDot} />
                  LIVE
                </span>
              </div>

              <ul className={styles.feedList}>
                {FEED_ITEMS.map((item) => (
                  <li key={item.name} className={styles.feedItem}>
                    <span className={styles.feedName}>{item.name}</span>
                    <span className={`${styles.feedStatus} ${item.statusClass}`}>
                      {item.status}
                    </span>
                  </li>
                ))}
              </ul>

              <button className={styles.feedBtn} type="button">
                VIEW ALL RACES
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ OFFICIATING + PREDICTIONS ══════════════════════ */}
      <section className={`${styles.section} container`}>
        <div className="row g-4">
          {/* Precision Officiating */}
          <div className="col-md-6">
            <div className={styles.card}>
              <div className={styles.cardIcon}>
                <LuScale />
              </div>
              <h3 className={styles.cardTitle}>Precision Officiating</h3>
              <p className={styles.cardDesc}>
                Streamlined race adjudication with digital verification
                protocols, ensuring integrity across every event and
                jurisdiction.
              </p>
              <div className={styles.miniLabels}>
                <span className={styles.miniLabel}>Official Verification</span>
                <span className={styles.miniLabel}>Health Passports</span>
                <span className={styles.miniLabel}>Audit Trails</span>
              </div>
            </div>
          </div>

          {/* High-Stakes Predictions */}
          <div className="col-md-6">
            <div className={styles.predictCard}>
              <div className={styles.cardIcon}>
                <FiEye />
              </div>
              <h3 className={styles.cardTitle}>High-Stakes Predictions</h3>
              <p className={styles.cardDesc}>
                Leverage AI-driven analytics and historical data to make
                informed predictions on race outcomes, form guides, and
                performance trajectories.
              </p>
              <Link to="#" className={styles.predictBtn}>
                Start Predicting <FiArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PADDOCK EXPERIENCE ═════════════════════════════ */}
      <section className={`${styles.paddockSection} container`}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>The Paddock Experience</h2>
          <p className={styles.sectionDesc}>
            Explore world-class racecourses, from the storied turf of Epsom
            Downs to the gleaming surfaces of Meydan Dubai.
          </p>
        </div>

        <div className="row g-4">
          {TRACKS.map((track) => (
            <div className="col-md-4" key={track.name}>
              <div className={styles.trackCard}>
                <div className={styles.trackImageWrap}>
                  <img
                    className={styles.trackImage}
                    src={track.image}
                    alt={track.name}
                    loading="lazy"
                  />
                  <span className={styles.trackBadge}>{track.badge}</span>
                </div>
                <div className={styles.trackInfo}>
                  <h4 className={styles.trackName}>{track.name}</h4>
                  <div className={styles.trackMeta}>
                    <div>
                      <div className={styles.trackMetaLabel}>Track Condition</div>
                      <div>{track.condition}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className={styles.trackMetaLabel}>Races</div>
                      <div>{track.races}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
