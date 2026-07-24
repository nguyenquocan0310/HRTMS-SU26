import { useEffect, useMemo, useState } from 'react';
import { FiCheckCircle, FiChevronDown, FiEye, FiMapPin } from 'react-icons/fi';
import {
  declareRaceOfficial,
  getUnofficialRaces,
  type UnofficialRace,
} from '../../services/raceOperationService';
import { getRaceSchedule } from '../../services/schedulingService';
import {
  getTournaments,
  type RaceResponse,
  type TournamentResponse,
} from '../../services/tournamentService';
import { adminError, adminLabel, dateTime } from '../../utils/adminLabels';
import styles from './RaceList.module.scss';

type RaceRow = RaceResponse & {
  tournamentName: string;
  roundName: string;
  entryCount: number;
  venueName?: string | null;
  venueCity?: string | null;
  canDeclareOfficial: boolean;
};

const RaceList = () => {
  const [tournaments, setTournaments] = useState<TournamentResponse[]>([]);
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [races, setRaces] = useState<RaceRow[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RaceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [declaring, setDeclaring] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const tournament = useMemo(
    () => tournaments.find((item) => item.tournamentId === tournamentId) ?? null,
    [tournaments, tournamentId],
  );

  useEffect(() => {
    void getTournaments()
      .then((items) => {
        setTournaments(items);
        setTournamentId(items[0]?.tournamentId ?? null);
      })
      .catch((err) => setError(adminError(err)))
      .finally(() => setLoading(false));
  }, []);

  const loadRaces = async (selectedTournament: TournamentResponse) => {
    setLoading(true);
    setError('');
    try {
      const allRaces = selectedTournament.rounds.flatMap((round) =>
        round.races.map((race) => ({ race, roundName: round.name })),
      );
      const [unofficial, schedules] = await Promise.all([
        getUnofficialRaces(selectedTournament.tournamentId),
        Promise.all(allRaces.map(({ race }) => getRaceSchedule(race.raceId).catch(() => null))),
      ]);
      const unofficialByRaceId = new Map<number, UnofficialRace>(
        unofficial.map((race) => [race.raceId, race]),
      );
      const rows = allRaces
        .map(({ race, roundName }, index) => ({
          ...race,
          status: schedules[index]?.status ?? race.status,
          tournamentName: selectedTournament.name,
          roundName,
          entryCount: schedules[index]?.entries.length ?? 0,
          venueName: schedules[index]?.venueName,
          venueCity: schedules[index]?.venueCity,
          canDeclareOfficial: unofficialByRaceId.get(race.raceId)?.canDeclareOfficial ?? false,
        }))
        .sort((left, right) => left.scheduledTime.localeCompare(right.scheduledTime));

      setRaces(rows);
      setSelectedRaceId((current) =>
        rows.some((race) => race.raceId === current) ? current : (rows[0]?.raceId ?? null),
      );
    } catch (err) {
      setError(adminError(err, 'Không tải được danh sách cuộc đua.'));
      setRaces([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tournament) {
      void loadRaces(tournament);
    } else if (!loading) {
      setRaces([]);
    }
  }, [tournament]);

  const selected = races.find((item) => item.raceId === selectedRaceId) ?? null;

  const declareOfficial = async (race: RaceRow) => {
    if (!window.confirm(`Chuyển cuộc đua #${race.raceNumber} sang trạng thái chính thức?`)) return;

    setDeclaring(true);
    setError('');
    try {
      await declareRaceOfficial(race.raceId, { confirmedByAdmin: true });
      setNotice(`Cuộc đua #${race.raceNumber} đã chuyển sang trạng thái chính thức.`);
      setDetail(null);
      if (tournament) await loadRaces(tournament);
    } catch (err) {
      setError(adminError(err, 'Không thể chuyển trạng thái cuộc đua.'));
    } finally {
      setDeclaring(false);
    }
  };

  return <div className={styles.page}>
    <header><h1>Danh sách cuộc đua</h1></header>
    {notice && <div className={styles.notice}>{notice}</div>}
    {error && <div className={styles.error}>{error}</div>}

    <section className={styles.card}>
      <div className={styles.filters}>
        <label>Giải đấu<div><select value={tournamentId ?? ''} onChange={(event) => { setTournamentId(event.target.value ? Number(event.target.value) : null); setDetail(null); }}><option value="">-- Chọn giải đấu --</option>{tournaments.map((item) => <option key={item.tournamentId} value={item.tournamentId}>{item.name}</option>)}</select><FiChevronDown /></div></label>
        <label>Cuộc đua hiện tại<div><select value={selectedRaceId ?? ''} disabled={races.length === 0} onChange={(event) => setSelectedRaceId(event.target.value ? Number(event.target.value) : null)}><option value="">-- Không có cuộc đua --</option>{races.map((race) => <option key={race.raceId} value={race.raceId}>{race.roundName} · Cuộc đua #{race.raceNumber} · {adminLabel(race.status)}</option>)}</select><FiChevronDown /></div></label>
      </div>
      {selected && <div className={styles.selected}><strong>{selected.roundName} · Cuộc đua #{selected.raceNumber}</strong><span>{dateTime(selected.scheduledTime)}</span><span>{selected.entryCount} ngựa đăng ký</span><span className={styles.status}>{adminLabel(selected.status)}</span>{tournament?.venueName && <span><FiMapPin />{tournament.venueName}{tournament.venueCity ? ` · ${tournament.venueCity}` : ''}</span>}<button onClick={() => setDetail(selected)}><FiEye /> Xem chi tiết</button></div>}
    </section>

    <section className={styles.card}>
      <div className={styles.titleRow}><h2>Tất cả cuộc đua</h2><span>{races.length}</span></div>
      {loading ? <p className={styles.empty}>Đang tải danh sách cuộc đua…</p> : races.length === 0 ? <p className={styles.empty}>Chưa có cuộc đua nào trong giải đấu này.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Cuộc đua</th><th>Vòng đấu</th><th>Thời gian</th><th>Địa điểm</th><th>Số ngựa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{races.map((race) => <tr key={race.raceId}><td><strong>Cuộc đua #{race.raceNumber}</strong></td><td>{race.roundName}</td><td>{dateTime(race.scheduledTime)}</td><td>{race.venueName ?? tournament?.venueName ?? '—'}{(race.venueCity ?? tournament?.venueCity) && <small>{race.venueCity ?? tournament?.venueCity}</small>}</td><td>{race.entryCount}</td><td><span className={styles.status}>{adminLabel(race.status)}</span></td><td><button className={styles.view} onClick={() => setDetail(race)}><FiEye /> Xem</button></td></tr>)}</tbody></table></div>}
    </section>

    {detail && <div className={styles.modalLayer}><div className={styles.modal}><h2>Cuộc đua #{detail.raceNumber}</h2><dl><dt>Vòng đấu</dt><dd>{detail.roundName}</dd><dt>Thời gian</dt><dd>{dateTime(detail.scheduledTime)}</dd><dt>Số ngựa</dt><dd>{detail.entryCount}</dd><dt>Trạng thái</dt><dd>{adminLabel(detail.status)}</dd></dl>{detail.status === 'Unofficial' ? <><p className={styles.muted}>Chỉ chuyển trạng thái sau khi kết quả, chi thưởng và các điều kiện nghiệp vụ đã sẵn sàng.</p><div><button onClick={() => setDetail(null)}>Đóng</button><button className={styles.official} disabled={!detail.canDeclareOfficial || declaring} onClick={() => void declareOfficial(detail)}><FiCheckCircle />{declaring ? 'Đang xử lý…' : 'Chuyển chính thức'}</button></div>{!detail.canDeclareOfficial && <small className={styles.hint}>Cuộc đua chưa đáp ứng đủ điều kiện để chuyển sang chính thức.</small>}</> : <><p className={styles.muted}>Thông tin cuộc đua ở trạng thái {adminLabel(detail.status).toLocaleLowerCase()}.</p><div><button onClick={() => setDetail(null)}>Đóng</button></div></>}</div></div>}
  </div>;
};

export default RaceList;
