import { Link } from 'react-router-dom';
import { FiCalendar, FiFlag, FiShield, FiUsers } from 'react-icons/fi';
import Navbar from '../../components/common/Navbar';
import styles from './LandingPage.module.scss';

const TOURNAMENT = {
  status: 'Open Registration',
  raceCount: '5 race',
  title: 'Cúp Đua Ngựa Quốc Gia Việt Nam 2026',
  description:
    'Giải mở đăng ký tại Phú Thọ, dùng để demo đăng ký giải, duyệt roster, mời ký sĩ và phân bổ race.',
};

const DETAILS = [
  { label: 'Thời gian', value: '10/07/2026 - 12/07/2026' },
  { label: 'Giống ngựa', value: 'Thoroughbred' },
  { label: 'Cự ly', value: '1600m' },
  { label: 'Lệ phí', value: '500.000 VND' },
  { label: 'Quỹ thưởng', value: '50.000.000 VND' },
  { label: 'Số ngựa tối đa', value: '12' },
];

const STATS = [
  { icon: <FiFlag />, label: 'Giải đang mở', value: '1' },
  { icon: <FiCalendar />, label: 'Tổng race', value: '6' },
  { icon: <FiUsers />, label: 'Role tự đăng ký', value: '5' },
  { icon: <FiShield />, label: 'Tổng quỹ thưởng', value: '85.000.000 VND' },
];

const SCHEDULE = [
  { name: 'Vòng loại - Race 1', time: '10/07/2026 · 09:00' },
  { name: 'Vòng loại - Race 2', time: '10/07/2026 · 14:00' },
  { name: 'Bán kết - Race 1', time: '11/07/2026 · 09:00' },
  { name: 'Bán kết - Race 2', time: '11/07/2026 · 14:00' },
];

export default function LandingPage() {
  return (
    <div className={styles.landingPage}>
      <Navbar />

      <main className={styles.main}>
        {/* ── Hero ── */}
        <section className={styles.hero}>
          <div className={styles.heroLeft}>
            <p className={styles.liveTag}>
              <FiShield size={13} />
              Dữ liệu giải đấu trực tiếp từ hệ thống
            </p>

            <h1 className={styles.heroTitle}>{TOURNAMENT.title}</h1>

            <p className={styles.heroDesc}>
              Theo dõi giải đang mở đăng ký, lịch race, quỹ thưởng và nghiệp vụ
              đăng ký tài khoản theo từng vai trò.
            </p>

            <div className={styles.heroCta}>
              <Link to="/register" className={styles.primaryAction}>
                Đăng ký tài khoản →
              </Link>
              <Link to="/login" className={styles.secondaryAction}>
                Đăng nhập workspace
              </Link>
            </div>
          </div>

          <article className={styles.tournamentCard}>
            <div className={styles.cardHeader}>
              <span className={styles.statusBadge}>{TOURNAMENT.status}</span>
              <strong className={styles.raceCount}>{TOURNAMENT.raceCount}</strong>
            </div>
            <h2 className={styles.cardTitle}>{TOURNAMENT.title}</h2>
            <p className={styles.cardDesc}>{TOURNAMENT.description}</p>
            <div className={styles.detailGrid}>
              {DETAILS.map((d) => (
                <div className={styles.detailItem} key={d.label}>
                  <span className={styles.detailLabel}>{d.label}</span>
                  <strong className={styles.detailValue}>{d.value}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>

        {/* ── Stats ── */}
        <section className={styles.statsGrid} aria-label="Tổng quan giải đấu">
          {STATS.map((stat) => (
            <article className={styles.statCard} key={stat.label}>
              <span className={styles.statIcon}>{stat.icon}</span>
              <p className={styles.statLabel}>{stat.label}</p>
              <strong className={styles.statValue}>{stat.value}</strong>
            </article>
          ))}
        </section>

        {/* ── Info Grid ── */}
        <section className={styles.infoGrid}>
          <article className={styles.panel} id="schedule">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Lịch race gần nhất</h2>
              <strong className={styles.panelMeta}>{TOURNAMENT.title}</strong>
            </div>
            <div className={styles.scheduleList}>
              {SCHEDULE.map((race) => (
                <div className={styles.scheduleItem} key={race.name}>
                  <div>
                    <h3 className={styles.raceName}>{race.name}</h3>
                    <p className={styles.raceTime}>{race.time}</p>
                  </div>
                  <span className={styles.upcomingBadge}>Upcoming</span>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.panel} id="process">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Luồng đăng ký tài khoản</h2>
              <strong className={styles.panelMeta}>Email OTP + xét duyệt role</strong>
            </div>
            <div className={styles.flowText}>
              <p>Chọn role Owner, Jockey, Referee, Doctor hoặc Spectator.</p>
              <p>Xác thực email bằng mã gửi qua SMTP trước khi tạo tài khoản.</p>
              <p>Role chuyên môn cung cấp phone, ngày sinh, CCCD và giấy phép liên quan.</p>
              <p>Owner và Spectator active ngay; Jockey, Referee, Doctor chờ Admin duyệt.</p>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}