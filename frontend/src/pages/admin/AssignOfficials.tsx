import { useEffect, useState } from 'react';
import { FiChevronDown, FiX, FiSearch, FiCheckCircle, FiUserMinus } from 'react-icons/fi';
import { getTournaments } from '../../services/tournamentService';
import { getActiveUsersByRole, type ActiveUser } from '../../services/approvalService';
import {
  getRefereesByRace, assignReferee, removeReferee,
  getDoctorsByRace, assignDoctor, removeDoctor,
  type RefereeAssignment, type DoctorAssignment,
} from '../../services/officialAssignmentService';
import styles from './AssignOfficials.module.scss';

interface TournamentOption { id: number; name: string; }
interface RaceOption { id: number; label: string; scheduledTime: string; status: string; }

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
};

type ModalType = 'referee' | 'doctor' | null;

const AssignOfficials = () => {
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [races, setRaces] = useState<RaceOption[]>([]);
  const [selectedRace, setSelectedRace] = useState<RaceOption | null>(null);

  const [referees, setReferees] = useState<RefereeAssignment[]>([]);
  const [doctors, setDoctors] = useState<DoctorAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Available personnel from pending-approvals (approved ones)
  const [availableReferees, setAvailableReferees] = useState<ActiveUser[]>([]);
  const [availableDoctors, setAvailableDoctors] = useState<ActiveUser[]>([]);

  const [modal, setModal] = useState<ModalType>(null);
  const [search, setSearch] = useState('');
  const [refereeRole, setRefereeRole] = useState<'Lead Referee' | 'Assistant Referee'>('Lead Referee');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Load tournaments
  useEffect(() => {
    getTournaments().then((list) => {
      const opts = list.map((t) => ({ id: t.tournamentId, name: t.name }));
      setTournaments(opts);
      if (opts.length > 0) setSelectedTournamentId(opts[0].id);
    }).catch(() => {});
  }, []);

  // Load races when tournament changes
  useEffect(() => {
    if (!selectedTournamentId) return;
    getTournaments().then((list) => {
      const t = list.find((x) => x.tournamentId === selectedTournamentId);
      if (!t) return;
      const opts: RaceOption[] = t.rounds.flatMap((r) =>
        r.races.map((race) => ({
          id: race.raceId,
          label: `${r.name} - Race #${race.raceNumber}`,
          scheduledTime: race.scheduledTime,
          status: race.status,
        }))
      );
      setRaces(opts);
      if (opts.length > 0) setSelectedRace(opts[0]);
    }).catch(() => {});
  }, [selectedTournamentId]);

  // Load assignments when race changes
  useEffect(() => {
    if (!selectedRace) return;
    setLoadingAssignments(true);
    Promise.all([
      getRefereesByRace(selectedRace.id),
      getDoctorsByRace(selectedRace.id),
    ]).then(([r, d]) => {
      setReferees(r);
      setDoctors(d);
    }).finally(() => setLoadingAssignments(false));
  }, [selectedRace]);

  // Load available personnel
// Load available personnel (Active referees/doctors, không phải danh sách chờ duyệt)
  useEffect(() => {
    getActiveUsersByRole('Referee').then(setAvailableReferees).catch(() => {});
    getActiveUsersByRole('Doctor').then(setAvailableDoctors).catch(() => {});
  }, []);

  const reloadAssignments = async () => {
    if (!selectedRace) return;
    const [r, d] = await Promise.all([
      getRefereesByRace(selectedRace.id),
      getDoctorsByRace(selectedRace.id),
    ]);
    setReferees(r);
    setDoctors(d);
  };

  const handleAssignReferee = async (person: ActiveUser) => {
    if (!selectedRace) return;
    setActionLoading(true);
    setError(''); setMsg('');
    try {
      await assignReferee(selectedRace.id, person.userId, refereeRole);
      setMsg(`Đã assign ${person.fullName} làm ${refereeRole}.`);
      setModal(null);
      await reloadAssignments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assign thất bại.');
    } finally { setActionLoading(false); }
  };

  const handleAssignDoctor = async (person: ActiveUser) => {
    if (!selectedRace) return;
    setActionLoading(true);
    setError(''); setMsg('');
    try {
      await assignDoctor(selectedRace.id, person.userId);
      setMsg(`Đã assign ${person.fullName} làm Race Doctor.`);
      setModal(null);
      await reloadAssignments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assign thất bại.');
    } finally { setActionLoading(false); }
  };

  const handleRemoveReferee = async (refereeId: number) => {
    if (!selectedRace) return;
    setActionLoading(true);
    setError(''); setMsg('');
    try {
      await removeReferee(selectedRace.id, refereeId);
      setMsg('Đã xóa referee.');
      await reloadAssignments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xóa thất bại.');
    } finally { setActionLoading(false); }
  };

  const handleRemoveDoctor = async (doctorId: number) => {
    if (!selectedRace) return;
    setActionLoading(true);
    setError(''); setMsg('');
    try {
      await removeDoctor(selectedRace.id, doctorId);
      setMsg('Đã xóa doctor.');
      await reloadAssignments();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xóa thất bại.');
    } finally { setActionLoading(false); }
  };

  const filteredReferees = availableReferees.filter((p) =>
    p.fullName.toLowerCase().includes(search.toLowerCase())
  );
  const filteredDoctors = availableDoctors.filter((p) =>
    p.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const refereeConfirmed = referees.length > 0;
  const doctorConfirmed = doctors.length > 0;

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Admin Workspace</h1>
        <p className={styles.subtext}>System operations and governance</p>
      </div>

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Assign Officials</h2>
        <p className={styles.sectionDesc}>Phân công Trọng tài và Bác sĩ cho từng Race.</p>
      </div>

      {/* Filters */}
      <div className={styles.filterCard}>
        <div className={styles.filterRow}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Tournament</label>
            <div className={styles.selectWrap}>
              <select className={styles.select} value={selectedTournamentId ?? ''}
                onChange={(e) => setSelectedTournamentId(Number(e.target.value))}>
                {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <FiChevronDown className={styles.selectIcon} size={14} />
            </div>
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Race</label>
            <div className={styles.selectWrap}>
              <select className={styles.select} value={selectedRace?.id ?? ''}
                onChange={(e) => {
                  const race = races.find((r) => r.id === Number(e.target.value));
                  if (race) setSelectedRace(race);
                }}>
                {races.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <FiChevronDown className={styles.selectIcon} size={14} />
            </div>
          </div>
        </div>

        {/* Race info */}
        {selectedRace && (
          <div className={styles.raceInfo}>
            <span className={styles.raceInfoItem}><strong>Race:</strong> {selectedRace.label}</span>
            <span className={styles.raceInfoItem}><strong>Scheduled:</strong> {formatDateTime(selectedRace.scheduledTime)}</span>
            <span className={styles.raceInfoItem}><strong>Status:</strong> {selectedRace.status}</span>
          </div>
        )}
      </div>

      {msg && <p className={styles.successMsg}>{msg}</p>}
      {error && <p className={styles.errorMsg}>{error}</p>}

      {/* Assignment cards */}
      <div className={styles.assignGrid}>
        {/* Lead Referee */}
        <div className={styles.assignCard}>
          <h3 className={styles.cardTitle}>Lead Referee</h3>
          {loadingAssignments ? (
            <p className={styles.loading}>Đang tải...</p>
          ) : referees.length === 0 ? (
            <div className={styles.emptyAssign}>
              <p className={styles.emptyText}>No Referee Assigned</p>
              <button type="button" className={styles.assignBtn}
                onClick={() => { setModal('referee'); setSearch(''); setError(''); }}>
                Assign Referee
              </button>
            </div>
          ) : (
            referees.map((r) => (
              <div key={r.refereeId} className={styles.assignedItem}>
                <div className={styles.assignedInfo}>
                  <span className={styles.assignedName}>{r.refereeName}</span>
                  <span className={styles.assignedRole}>{r.role}</span>
                  <span className={styles.assignedMeta}>Assigned: {formatDateTime(r.assignedAt)}</span>
                  <span className={styles.assignedMeta}>Cert: {r.certificationLevel}</span>
                </div>
                <button type="button" className={styles.removeBtn}
                  onClick={() => handleRemoveReferee(r.refereeId)} disabled={actionLoading}>
                  <FiUserMinus size={14} /> Remove
                </button>
              </div>
            ))
          )}
          {referees.length > 0 && (
            <button type="button" className={styles.addMoreBtn}
              onClick={() => { setModal('referee'); setSearch(''); setError(''); }}>
              + Add Another Referee
            </button>
          )}
        </div>

        {/* Race Doctor */}
        <div className={styles.assignCard}>
          <h3 className={styles.cardTitle}>Race Doctor</h3>
          {loadingAssignments ? (
            <p className={styles.loading}>Đang tải...</p>
          ) : doctors.length === 0 ? (
            <div className={styles.emptyAssign}>
              <p className={styles.emptyText}>No Doctor Assigned</p>
              <button type="button" className={styles.assignBtn}
                onClick={() => { setModal('doctor'); setSearch(''); setError(''); }}>
                Assign Doctor
              </button>
            </div>
          ) : (
            doctors.map((d) => (
              <div key={d.doctorId} className={styles.assignedItem}>
                <div className={styles.assignedInfo}>
                  <span className={styles.assignedName}>{d.doctorName}</span>
                  <span className={styles.assignedMeta}>License: {d.medicalLicenseNumber}</span>
                  <span className={styles.assignedMeta}>Assigned: {formatDateTime(d.assignedAt)}</span>
                </div>
                <button type="button" className={styles.removeBtn}
                  onClick={() => handleRemoveDoctor(d.doctorId)} disabled={actionLoading}>
                  <FiUserMinus size={14} /> Remove
                </button>
              </div>
            ))
          )}
          {doctors.length > 0 && (
            <button type="button" className={styles.addMoreBtn}
              onClick={() => { setModal('doctor'); setSearch(''); setError(''); }}>
              + Add Another Doctor
            </button>
          )}
        </div>
      </div>

      {/* Overall status */}
      <div className={styles.statusCard}>
        <h3 className={styles.cardTitle}>Overall Assignment Status</h3>
        <div className={styles.statusItems}>
          <div className={`${styles.statusItem} ${refereeConfirmed ? styles.statusOk : styles.statusPending}`}>
            {refereeConfirmed ? <FiCheckCircle size={16} /> : <span className={styles.statusDot} />}
            <span>Referee {refereeConfirmed ? 'Assigned' : 'Not Assigned'}</span>
          </div>
          <div className={`${styles.statusItem} ${doctorConfirmed ? styles.statusOk : styles.statusPending}`}>
            {doctorConfirmed ? <FiCheckCircle size={16} /> : <span className={styles.statusDot} />}
            <span>Doctor {doctorConfirmed ? 'Assigned' : 'Not Assigned'}</span>
          </div>
        </div>
        {!refereeConfirmed || !doctorConfirmed ? (
          <p className={styles.statusNote}>Race cannot proceed until Referee and Doctor are assigned.</p>
        ) : (
          <p className={styles.statusReady}>✓ All officials assigned. Race is ready.</p>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <>
          <div className={styles.overlay} onClick={() => setModal(null)} />
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {modal === 'referee' ? 'Assign Lead Referee' : 'Assign Race Doctor'}
              </h3>
              <button type="button" className={styles.closeBtn} onClick={() => setModal(null)}>
                <FiX size={18} />
              </button>
            </div>

            {modal === 'referee' && (
              <div className={styles.roleSelect}>
                <label className={styles.filterLabel}>Role</label>
                <select className={styles.select} value={refereeRole}
                  onChange={(e) => setRefereeRole(e.target.value as 'Lead Referee' | 'Assistant Referee')}>
                  <option value="Lead Referee">Lead Referee</option>
                  <option value="Assistant Referee">Assistant Referee</option>
                </select>
              </div>
            )}

            <div className={styles.searchWrap}>
              <FiSearch size={14} className={styles.searchIcon} />
              <input type="text" className={styles.searchInput}
                placeholder="Tìm kiếm theo tên..."
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className={styles.personList}>
              {(modal === 'referee' ? filteredReferees : filteredDoctors).map((p) => (
                <div key={p.userId} className={styles.personRow}>
                  <div className={styles.personInfo}>
                    <span className={styles.personName}>{p.fullName}</span>
                    <span className={styles.personMeta}>{p.email}</span>
                    <span className={`${styles.personStatus} ${styles.statusApproved}`}>
                      {p.status}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.sendBtn}
                    disabled={actionLoading}
                    onClick={() => modal === 'referee' ? handleAssignReferee(p) : handleAssignDoctor(p)}
                  >
                    Assign
                  </button>
                </div>
              ))}
              {(modal === 'referee' ? filteredReferees : filteredDoctors).length === 0 && (
                <p className={styles.emptyText}>Không tìm thấy.</p>
              )}
            </div>

            {error && <p className={styles.errorMsg}>{error}</p>}
          </div>
        </>
      )}
    </div>
  );
};

export default AssignOfficials;