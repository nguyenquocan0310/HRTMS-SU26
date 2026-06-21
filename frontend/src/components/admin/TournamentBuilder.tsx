import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2 } from 'react-icons/fi';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import StatusBadge, { type StatusType } from '../../components/common/StatusBadge';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import TabBasicInfo from './tabs/TabBasicInfo';
import TabPrizeDistribution from './tabs/TabPrizeDistribution';
import TabRoundsRaces from './tabs/TabRoundsRaces';
import TabPostPositionDraw from './tabs/TabPostPositionDraw';
import * as tournamentService from '../../services/tournamentService';
import type { TournamentResponse } from '../../services/tournamentService';
import styles from './TournamentBuilder.module.scss';

// ─── Shared types — dùng chung cho cả 4 tab ─────────────────────────────────

export type AllowedBreed = 'Thoroughbred' | 'Arabian' | 'Quarter Horse' | 'Mixed';
export type TrackType = 'Turf' | 'Dirt' | 'Synthetic';
export type RaceCategory = 'Open' | 'Classic' | 'Maiden';
export type TournamentStatus = 'Draft' | 'OpenRegistration' | 'Closed' | 'Completed' | 'Cancelled';

export interface TournamentBasicInfo {
  name: string;
  startDate: string;
  endDate: string;
  allowedBreed: AllowedBreed | '';
  trackType: TrackType | '';
  raceDistance: number | '';
  raceCategory: RaceCategory | '';
  maxHorses: number | '';
  minJockeyExperienceYears: number | '';
  purseAmount: number | '';
  entryFeeAmount: number;
  preRaceWeightThresholdKg: number;
  postRaceWeightDiffThresholdKg: number;
}

export interface PrizeRow {
  rank: 1 | 2 | 3 | 4 | 5;
  percentage: number;
}

export interface RaceEntryDraw {
  id: string;
  horseName: string;
  postPosition: number | null;
}

export interface Race {
  id: string;
  sequenceOrder: number;
  scheduledDate: string;
  raceNumber: number;
  scheduledTime: string;
  purseAmount: number | '';
  raceDistanceOverride: number | '';
  trackTypeOverride: TrackType | '';
  isPostPositionDrawn: boolean;
  entries: RaceEntryDraw[];
}

export interface Round {
  id: string;
  name: string;
  scheduledDate: string;
  races: Race[];
}

export interface TournamentDraft {
  id: string;
  status: TournamentStatus;
  basicInfo: TournamentBasicInfo;
  prizeDistribution: PrizeRow[];
  rounds: Round[];
}

// ─── Giá trị khởi tạo cho 1 giải mới ─────────────────────────────────────────
export const createEmptyTournament = (): TournamentDraft => ({
  id: `t-${Date.now()}`,
  status: 'Draft',
  basicInfo: {
    name: '',
    startDate: '',
    endDate: '',
    allowedBreed: '',
    trackType: '',
    raceDistance: '',
    raceCategory: '',
    maxHorses: '',
    minJockeyExperienceYears: '',
    purseAmount: '',
    entryFeeAmount: 0,
    preRaceWeightThresholdKg: 2.0,
    postRaceWeightDiffThresholdKg: 1.0,
  },
  prizeDistribution: [
    { rank: 1, percentage: 40 },
    { rank: 2, percentage: 25 },
    { rank: 3, percentage: 15 },
    { rank: 4, percentage: 12 },
    { rank: 5, percentage: 8 },
  ],
  rounds: [],
});

const TABS = [
  { key: 'basic', label: 'Thông số' },
  { key: 'prize', label: 'Prize Distribution' },
  { key: 'rounds', label: 'Rounds & Races' },
  { key: 'draw', label: 'Post Position Draw' },
] as const;

type TabKey = typeof TABS[number]['key'];

const TournamentBuilder = () => {
  const [view, setView] = useState<'list' | 'wizard'>('list');
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [draft, setDraft] = useState<TournamentDraft>(createEmptyTournament());
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [tournamentList, setTournamentList] = useState<TournamentResponse[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  const loadTournaments = async () => {
    setIsLoadingList(true);
    setListError('');
    try {
      const data = await tournamentService.getTournaments();
      setTournamentList(data);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Không tải được danh sách giải đấu.');
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  // ─── Validate điều kiện Publish (tổng hợp cả 4 tab) ───────────────────────
  const isBasicInfoValid = (): boolean => {
    const b = draft.basicInfo;
    return (
      b.name.trim() !== '' &&
      b.startDate !== '' &&
      b.endDate !== '' &&
      b.endDate >= b.startDate &&
      b.allowedBreed !== '' &&
      b.trackType !== '' &&
      b.raceDistance !== '' &&
      b.raceCategory !== '' &&
      b.maxHorses !== '' &&
      b.minJockeyExperienceYears !== '' &&
      b.purseAmount !== ''
    );
  };

  const isPrizeValid = (): boolean => {
    const total = draft.prizeDistribution.reduce((sum, p) => sum + p.percentage, 0);
    return total === 100;
  };

  const totalRacePurse = draft.rounds.reduce(
    (sum, round) => sum + round.races.reduce((rSum, race) => rSum + (Number(race.purseAmount) || 0), 0),
    0
  );

  const isRoundsValid = (): boolean => {
    if (draft.rounds.length === 0) return false;
    if (typeof draft.basicInfo.purseAmount === 'number' && totalRacePurse > draft.basicInfo.purseAmount) {
      return false;
    }
    return true;
  };

  const canPublish = isBasicInfoValid() && isPrizeValid() && isRoundsValid();

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleCreateNew = () => {
    setDraft(createEmptyTournament());
    setActiveTab('basic');
    setView('wizard');
  };

  const handleEdit = (id: number) => {
    // TODO Bước B: gọi tournamentService.getTournamentById(id) để load đầy đủ vào draft
    console.log('[TournamentBuilder] Edit tournament', id);
    setDraft(createEmptyTournament());
    setActiveTab('basic');
    setView('wizard');
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const buildCreatePayload = (): tournamentService.CreateTournamentPayload => {
    const b = draft.basicInfo;
    return {
      name: b.name,
      startDate: b.startDate,
      endDate: b.endDate,
      maxHorses: typeof b.maxHorses === 'number' ? b.maxHorses : undefined,
      allowedBreed: b.allowedBreed,
      trackType: b.trackType,
      raceDistance: typeof b.raceDistance === 'number' ? b.raceDistance : undefined,
      raceCategory: b.raceCategory,
      minJockeyExperienceYears:
        typeof b.minJockeyExperienceYears === 'number' ? b.minJockeyExperienceYears : undefined,
      purseAmount: typeof b.purseAmount === 'number' ? b.purseAmount : undefined,
      entryFeeAmount: b.entryFeeAmount,
      preRaceWeightThresholdKg: b.preRaceWeightThresholdKg,
      postRaceWeightDiffThresholdKg: b.postRaceWeightDiffThresholdKg,
    };
  };

  // Tournament mới (chưa có trên BE) có id dạng "t-<timestamp>" (string).
  // Tournament đã tồn tại trên BE có id là số nguyên thật — dùng để phân biệt
  // giữa "tạo mới" (POST) và "cập nhật" (PUT).
  const isNewDraft = draft.id.startsWith('t-');

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setSaveError('');
    try {
      const payload = buildCreatePayload();
      if (isNewDraft) {
        const created = await tournamentService.createTournament(payload);
        setDraft((prev) => ({ ...prev, id: String(created.tournamentId), status: created.status as TournamentStatus }));
      } else {
        await tournamentService.updateTournament(Number(draft.id), payload);
      }
      await loadTournaments();
      setView('list');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Lưu giải đấu thất bại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!canPublish) return;
    setIsSaving(true);
    setSaveError('');
    try {
      // Đảm bảo giải đã tồn tại trên BE trước khi đổi status
      let tournamentId = Number(draft.id);
      if (isNewDraft) {
        const created = await tournamentService.createTournament(buildCreatePayload());
        tournamentId = created.tournamentId;
      } else {
        await tournamentService.updateTournament(tournamentId, buildCreatePayload());
      }
      await tournamentService.updateTournamentStatus(tournamentId, 'OpenRegistration');
      await loadTournaments();
      setView('list');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Publish giải đấu thất bại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmCancel = () => {
    // TODO: gọi API thật — PATCH /api/tournament/:id/status (Cancelled)
    console.log('[TournamentBuilder] Cancel Tournament', draft.id);
    setShowCancelModal(false);
    setView('list');
  };

  // ─── Columns cho danh sách giải ────────────────────────────────────────────
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('vi-VN');

  const listColumns: DataTableColumn<TournamentResponse>[] = [
    {
      key: 'name',
      header: 'Tên giải',
      render: (row) => <span className={styles.tournamentName}>{row.name}</span>,
    },
    {
      key: 'startDate',
      header: 'Ngày bắt đầu',
      render: (row) => formatDate(row.startDate),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status as StatusType} />,
    },
    {
      key: 'action',
      header: '',
      width: '120px',
      render: (row) => (
        <button type="button" className={styles.editBtn} onClick={() => handleEdit(row.tournamentId)}>
          <FiEdit2 size={13} /> Edit
        </button>
      ),
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW: LIST
  // ═══════════════════════════════════════════════════════════════════════
  if (view === 'list') {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.heading}>Tournament Builder</h1>
          <button type="button" className={styles.createBtn} onClick={handleCreateNew}>
            <FiPlus size={16} /> Create Tournament
          </button>
        </div>

        {listError && <div className={styles.listError}>{listError}</div>}

        {isLoadingList ? (
          <p className={styles.loadingText}>Đang tải danh sách giải đấu...</p>
        ) : (
          <DataTable
            columns={listColumns}
            data={tournamentList}
            rowKey={(row) => row.tournamentId}
            emptyMessage="Chưa có giải đấu nào được tạo."
          />
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW: WIZARD
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className={styles.container}>
      <div className={styles.wizardHeader}>
        <button type="button" className={styles.backLink} onClick={() => setView('list')}>
          ← Quay lại danh sách
        </button>
        <h1 className={styles.heading}>
          {draft.basicInfo.name.trim() !== '' ? draft.basicInfo.name : 'Tạo giải đấu mới'}
        </h1>
      </div>

      {/* ═══ TAB STEPPER ════════════════════════════════════════ */}
      <div className={styles.tabStepper}>
        {TABS.map((tab, index) => (
          <div key={tab.key} className={styles.tabStepWrapper}>
            {index > 0 && <div className={styles.tabConnector} />}
            <button
              type="button"
              className={`${styles.tabStep} ${activeTab === tab.key ? styles.tabStepActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className={styles.tabStepCircle}>{index + 1}</span>
              <span className={styles.tabStepLabel}>{tab.label}</span>
            </button>
          </div>
        ))}
      </div>

      {/* ═══ TAB CONTENT ════════════════════════════════════════ */}
      <div className={styles.tabContent}>
        {activeTab === 'basic' && (
          <TabBasicInfo
            data={draft.basicInfo}
            onChange={(basicInfo) => setDraft((prev) => ({ ...prev, basicInfo }))}
          />
        )}

        {activeTab === 'prize' && (
          <TabPrizeDistribution
            prizeDistribution={draft.prizeDistribution}
            totalPurse={typeof draft.basicInfo.purseAmount === 'number' ? draft.basicInfo.purseAmount : 0}
            onChange={(prizeDistribution) => setDraft((prev) => ({ ...prev, prizeDistribution }))}
          />
        )}

        {activeTab === 'rounds' && (
          <TabRoundsRaces
            rounds={draft.rounds}
            tournamentPurse={typeof draft.basicInfo.purseAmount === 'number' ? draft.basicInfo.purseAmount : 0}
            tournamentStartDate={draft.basicInfo.startDate}
            tournamentEndDate={draft.basicInfo.endDate}
            onChange={(rounds) => setDraft((prev) => ({ ...prev, rounds }))}
          />
        )}

        {activeTab === 'draw' && (
          <TabPostPositionDraw
            rounds={draft.rounds}
            onChange={(rounds) => setDraft((prev) => ({ ...prev, rounds }))}
          />
        )}
      </div>

      {/* ═══ ACTION BAR (cố định ở mọi tab) ══════════════════════ */}
{saveError && <div className={styles.listError}>{saveError}</div>}

      <div className={styles.actionBar}>
        <button type="button" className={styles.cancelTournamentBtn} onClick={() => setShowCancelModal(true)}>
          Cancel Tournament
        </button>

        <div className={styles.actionBarRight}>
          <button type="button" className={styles.saveDraftBtn} onClick={handleSaveDraft} disabled={isSaving}>
            {isSaving ? 'Đang lưu...' : 'Save Draft'}
          </button>
          <button
            type="button"
            className={styles.publishBtn}
            onClick={handlePublish}
            disabled={!canPublish || isSaving}
            title={!canPublish ? 'Cần hoàn tất đủ điều kiện cả 4 tab trước khi Publish.' : undefined}
          >
            {isSaving ? 'Đang xử lý...' : 'Publish'}
          </button>
        </div>
      </div>

      {showCancelModal && (
        <ConfirmationModal
          title="Hủy giải đấu"
          message="Đây là thao tác KHÔNG THỂ HOÀN TÁC. Toàn bộ Round, Race và dữ liệu liên quan sẽ bị hủy vĩnh viễn."
          confirmationPhrase={draft.basicInfo.name.trim() !== '' ? draft.basicInfo.name : 'XAC NHAN'}
          confirmLabel="Hủy giải đấu"
          onConfirm={handleConfirmCancel}
          onCancel={() => setShowCancelModal(false)}
        />
      )}
    </div>
  );
};

export default TournamentBuilder;