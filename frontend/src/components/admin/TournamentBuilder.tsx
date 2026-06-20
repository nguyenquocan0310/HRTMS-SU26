import { useState } from 'react';
import { FiPlus, FiEdit2 } from 'react-icons/fi';
import DataTable, { type DataTableColumn } from '../../components/common/DataTable';
import StatusBadge, { type StatusType } from '../../components/common/StatusBadge';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import TabBasicInfo from './tabs/TabBasicInfo';
import TabPrizeDistribution from './tabs/TabPrizeDistribution';
import TabRoundsRaces from './tabs/TabRoundsRaces';
import TabPostPositionDraw from './tabs/TabPostPositionDraw';
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

// ─── Mock data danh sách giải đã tạo — TODO: GET /api/admin/tournaments ────
const MOCK_TOURNAMENT_LIST: { id: string; name: string; status: TournamentStatus; startDate: string }[] = [
  { id: 'tn1', name: 'Royal Stakes — Ascot Cup 2026', status: 'OpenRegistration', startDate: '15/07/2026' },
  { id: 'tn2', name: 'Dubai World Sprint', status: 'Draft', startDate: '02/08/2026' },
  { id: 'tn3', name: 'Melbourne Classic — Flemington', status: 'Completed', startDate: '10/05/2026' },
  { id: 'tn4', name: 'Spring Maiden Series', status: 'Cancelled', startDate: '20/04/2026' },
];

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

  const handleEdit = (id: string) => {
    // TODO: gọi API thật khi có Swagger — GET /api/admin/tournaments/:id
    console.log('[TournamentBuilder] Edit tournament', id);
    setDraft(createEmptyTournament());
    setActiveTab('basic');
    setView('wizard');
  };

  const handleSaveDraft = () => {
    // TODO: gọi API thật — POST/PUT /api/admin/tournaments (status giữ Draft)
    console.log('[TournamentBuilder] Save Draft', draft);
    setView('list');
  };

  const handlePublish = () => {
    if (!canPublish) return;
    // TODO: gọi API thật — PATCH /api/admin/tournaments/:id/publish (status → OpenRegistration)
    console.log('[TournamentBuilder] Publish', draft);
    setView('list');
  };

  const handleConfirmCancel = () => {
    // TODO: gọi API thật — PATCH /api/admin/tournaments/:id/cancel
    console.log('[TournamentBuilder] Cancel Tournament', draft.id);
    setShowCancelModal(false);
    setView('list');
  };

  // ─── Columns cho danh sách giải ────────────────────────────────────────────
  const listColumns: DataTableColumn<typeof MOCK_TOURNAMENT_LIST[number]>[] = [
    {
      key: 'name',
      header: 'Tên giải',
      render: (row) => <span className={styles.tournamentName}>{row.name}</span>,
    },
    {
      key: 'startDate',
      header: 'Ngày bắt đầu',
      render: (row) => row.startDate,
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
        <button type="button" className={styles.editBtn} onClick={() => handleEdit(row.id)}>
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

        <DataTable
          columns={listColumns}
          data={MOCK_TOURNAMENT_LIST}
          rowKey={(row) => row.id}
          emptyMessage="Chưa có giải đấu nào được tạo."
        />
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
      <div className={styles.actionBar}>
        <button type="button" className={styles.cancelTournamentBtn} onClick={() => setShowCancelModal(true)}>
          Cancel Tournament
        </button>

        <div className={styles.actionBarRight}>
          <button type="button" className={styles.saveDraftBtn} onClick={handleSaveDraft}>
            Save Draft
          </button>
          <button
            type="button"
            className={styles.publishBtn}
            onClick={handlePublish}
            disabled={!canPublish}
            title={!canPublish ? 'Cần hoàn tất đủ điều kiện cả 4 tab trước khi Publish.' : undefined}
          >
            Publish
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