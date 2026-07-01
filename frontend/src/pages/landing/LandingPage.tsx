import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCalendar, FiFlag, FiShield, FiUsers } from 'react-icons/fi';
import Navbar from '../../components/common/Navbar';
import { getTournaments } from '../../services/tournamentService';
import styles from './LandingPage.module.scss';

// ── Types inline (tránh import type bị lỗi encoding) ─────────────────────
interface RaceItem {
  raceId: number;
  raceNumber: number;
  scheduledTime: string;
  status: string;
}
interface RoundItem {
  roundId: number;
  name: string;
  races: RaceItem[];
}
interface Tournament {
  tournamentId: number;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  maxHorses: number;
  allowedBreed: string;
  raceDistance: number;
  purseAmount: number;
  entryFeeAmount: number;
  status: string;
  rounds: RoundItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${formatDate(iso)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatVND(amount: number) {
  return amount.toLocaleString('vi-VN') + ' VND';
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    OpenRegistration: 'Open Registration',
    Published: 'Published',
    Draft: 'Draft',
    InProgress: 'In Progress',
    Completed: 'Completed',
    Cancelled: 'Cancelled',
    Upcoming: 'Upcoming',
  };
  return map[status] ?? status;
}

const FLOW_STEPS = [
  'Chọn role Owner, Jockey, Referee, Doctor hoặc Spectator.',
  'Xác thực email bằng mã gửi qua SMTP trước khi tạo tài khoản.',
  'Role chuyên môn cung cấp phone, ngày sinh, CCCD và giấy phép liên quan.',
  'Owner và Spectator active ngay; Jockey, Referee, Doctor chờ Admin duyệt.',
];

// ── Component ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTournaments()
      .then((data) => setTournaments(data as Tournament[]))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const featured =
    tournaments.find((t) => t.status === 'OpenRegistration') ?? tournaments[0] ?? null;

  const openCount = tournaments.filter((t) => t.status === 'OpenRegistration').length;
  const totalRaces = tournaments.reduce(
    (sum, t) => sum + t.rounds.reduce((s, r) => s + r.races.length, 0), 0
  );
  const totalPurse = tournaments.reduce((sum, t) => sum + (t.purseAmount ?? 0), 0);

  const upcomingRaces: { roundName: string; race: RaceItem }[] = [];
  if (featured) {
    for (const round of featured.rounds) {
      for (const race of round.races) {
        upcomingRaces.push({ roundName: round.name, race });
      }
    }
    upcomingRaces.sort(
      (a, b) => new Date(a.race.scheduledTime).getTime() - new Date(b.race.scheduledTime).getTime()
    );
  }

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
            <h1 className={styles.heroTitle}>
              {loading ? 'Đang tải...' : featured ? featured.name : 'HRTMS'}
            </h1>
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

          {loading ? (
            <div className={styles.tournamentCard}>
              <p className={styles.loadingText}>Đang tải dữ liệu giải đấu...</p>
            </div>
          ) : error ? (
            <div className={styles.tournamentCard}>
              <p className={styles.errorText}>{error}</p>
            </div>
          ) : featured ? (
            <article className={styles.tournamentCard}>
              <div className={styles.cardHeader}>
                <span className={styles.statusBadge}>{statusLabel(featured.status)}</span>
                <strong className={styles.raceCount}>{totalRaces} race</strong>
              </div>
              <h2 className={styles.cardTitle}>{featured.name}</h2>
              <p className={styles.cardDesc}>{featured.description}</p>
              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Thời gian</span>
                  <strong className={styles.detailValue}>
                    {formatDate(featured.startDate)} - {formatDate(featured.endDate)}
                  </strong>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Giống ngựa</span>
                  <strong className={styles.detailValue}>{featured.allowedBreed}</strong>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Cự ly</span>
                  <strong className={styles.detailValue}>{featured.raceDistance}m</strong>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Lệ phí</span>
                  <strong className={styles.detailValue}>{formatVND(featured.entryFeeAmount)}</strong>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Quỹ thưởng</span>
                  <strong className={styles.detailValue}>{formatVND(featured.purseAmount)}</strong>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Số ngựa tối đa</span>
                  <strong className={styles.detailValue}>{featured.maxHorses}</strong>
                </div>
              </div>
            </article>
          ) : null}
        </section>

        {/* ── Stats ── */}
        <section className={styles.statsGrid}>
          <article className={styles.statCard}>
            <span className={styles.statIcon}><FiFlag /></span>
            <p className={styles.statLabel}>Giải đang mở</p>
            <strong className={styles.statValue}>{loading ? '...' : openCount}</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statIcon}><FiCalendar /></span>
            <p className={styles.statLabel}>Tổng race</p>
            <strong className={styles.statValue}>{loading ? '...' : totalRaces}</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statIcon}><FiUsers /></span>
            <p className={styles.statLabel}>Role tự đăng ký</p>
            <strong className={styles.statValue}>5</strong>
          </article>
          <article className={styles.statCard}>
            <span className={styles.statIcon}><FiShield /></span>
            <p className={styles.statLabel}>Tổng quỹ thưởng</p>
            <strong className={styles.statValue}>{loading ? '...' : formatVND(totalPurse)}</strong>
          </article>
        </section>

        {/* ── Info Grid ── */}
        <section className={styles.infoGrid}>
          <article className={styles.panel} id="schedule">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Lịch race gần nhất</h2>
              {featured && <strong className={styles.panelMeta}>{featured.name}</strong>}
            </div>
            <div className={styles.scheduleList}>
              {loading ? (
                <p className={styles.loadingText}>Đang tải...</p>
              ) : upcomingRaces.length === 0 ? (
                <p className={styles.emptyText}>Chưa có lịch race.</p>
              ) : (
                upcomingRaces.slice(0, 5).map(({ roundName, race }) => (
                  <div className={styles.scheduleItem} key={race.raceId}>
                    <div>
                      <h3 className={styles.raceName}>{roundName} - Race {race.raceNumber}</h3>
                      <p className={styles.raceTime}>{formatDateTime(race.scheduledTime)}</p>
                    </div>
                    <span className={styles.upcomingBadge}>{statusLabel(race.status)}</span>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className={styles.panel} id="process">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Luồng đăng ký tài khoản</h2>
              <strong className={styles.panelMeta}>Email OTP + xét duyệt role</strong>
            </div>
            <div className={styles.flowText}>
              {FLOW_STEPS.map((step, i) => <p key={i}>{step}</p>)}
            </div>
          </article>
        </section>

      </main>
    </div>
  );
}