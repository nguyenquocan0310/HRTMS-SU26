import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FiPlus, FiEdit2, FiEye } from "react-icons/fi";
import DataTable, {
  type DataTableColumn,
} from "../../components/common/DataTable";
import StatusBadge, {
  type StatusType,
} from "../../components/common/StatusBadge";
import ConfirmationModal from "../../components/common/ConfirmationModal";
import TabBasicInfo from "./tabs/TabBasicInfo";
import TabPrizeDistribution from "./tabs/TabPrizeDistribution";
import TabRoundsRaces from "./tabs/TabRoundsRaces";
import TabPostPositionDraw from "./tabs/TabPostPositionDraw";
import TabRoster from "./tabs/TabRoster";
import * as tournamentService from "../../services/tournamentService";
import type { TournamentResponse } from "../../services/tournamentService";
import { getVenues, type Venue } from "../../services/venueService";
import { adminError, adminLabel } from "../../utils/adminLabels";
import styles from "./TournamentBuilder.module.scss";
import {
  validateBasicInfo,
  validatePrizeDistribution,
  validateRounds,
  hasBasicErrors,
  hasPrizeErrors,
  hasRoundsErrors,
} from "./tournamentValidation";

// ─── Shared types — dùng chung cho cả 4 tab ─────────────────────────────────

export type AllowedBreed =
  "Thoroughbred" | "Arabian" | "Quarter Horse" | "Mixed";
export type TrackType = "Turf" | "Dirt" | "Synthetic";
export type RaceCategory = "Open" | "Classic" | "Maiden";
// Phải khớp ĐÚNG với DB (CHK_Tournaments_Status) và state machine ở BE.
export type TournamentStatus =
  | "Draft"
  | "OpenRegistration"
  | "Open Registration"
  | "ClosedRegistration"
  | "Closed Registration"
  | "Pre-Race"
  | "In-Progress"
  | "Completed"
  | "Cancelled";

// State machine khớp ValidTransitions ở BE (TournamentSevice.cs).
// Trả về status kế tiếp, hoặc null nếu đã ở cuối / không thể tiến.
export const NEXT_STATUS: Partial<Record<TournamentStatus, TournamentStatus>> =
  {
    Draft: "Open Registration",
    OpenRegistration: "Closed Registration",
    "Open Registration": "Closed Registration",
    "Closed Registration": "Pre-Race",
    "Pre-Race": "In-Progress",
    "In-Progress": "Completed",
  };

export interface TournamentBasicInfo {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  venueId: number | "";
  venueLaneCount: number | null;
  venueTrackLengthMeters: number | null;
  allowedBreed: AllowedBreed | "";
  trackType: TrackType | "";
  raceDistance: number | "";
  raceCategory: RaceCategory | "";
  maxHorses: number | "";
  minJockeyExperienceYears: number | "";
  purseAmount: number | "";
  entryFeeAmount: number;
  paymentDeadline: string;
  refundDeadline: string;
  clearRefundDeadline: boolean;
  advancementCount: number | "";
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
  purseAmount: number | "";
  raceDistanceOverride: number | "";
  trackTypeOverride: TrackType | "";
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
  status: "Draft",
  basicInfo: {
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    venueId: "",
    venueLaneCount: null,
    venueTrackLengthMeters: null,
    allowedBreed: "",
    trackType: "",
    raceDistance: "",
    raceCategory: "",
    maxHorses: "",
    minJockeyExperienceYears: "",
    purseAmount: "",
    entryFeeAmount: 0,
    paymentDeadline: "",
    refundDeadline: "",
    clearRefundDeadline: false,
    advancementCount: 5,
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
  { key: "basic", label: "Thông tin giải đấu" },
  { key: "prize", label: "Quỹ thưởng" },
  { key: "rounds", label: "Vòng đấu và cuộc đua" },
  { key: "roster", label: "Danh sách người tham gia" },
  { key: "draw", label: "Bốc thăm vị trí xuất phát" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ─── Chuẩn hóa giá trị từ BE cho input HTML ──────────────────────────────────
// BE trả DateTime/Time dạng ISO; input date cần "yyyy-MM-dd", input time cần "HH:mm".
const toDateInput = (value?: string | null): string =>
  (value ?? "").slice(0, 10);
// Dành riêng cho field lưu datetime đầy đủ dạng ISO (vd race.scheduledTime),
// khác với toTimeInput ở trên vốn chỉ dùng cho chuỗi giờ thuần "HH:mm:ss".
const toTimeInputFromDateTime = (value?: string | null): string => {
  if (!value) return "";
  const timePart = value.split("T")[1];
  return timePart ? timePart.slice(0, 5) : "";
};
const toDateTimeLocal = (value?: string | null): string => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

// Đường dẫn route
const LIST_PATH = "/admin/tournaments";
const WIZARD_PATH = "/admin/tournament-builder";

const TournamentBuilder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams<{ id?: string }>();

  // view suy ra từ URL: ở wizard nếu path là /admin/tournament-builder[/:id],
  // ngược lại là list (/admin/tournaments). Nhờ vậy nút Back của trình duyệt
  // đi đúng cấp (wizard → list → dashboard) thay vì nhảy thẳng về home.
  const view: "list" | "wizard" = location.pathname.startsWith(WIZARD_PATH)
    ? "wizard"
    : "list";

  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [draft, setDraft] = useState<TournamentDraft>(createEmptyTournament());
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [validationSummary, setValidationSummary] = useState<string[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venuesError, setVenuesError] = useState("");

  const [tournamentList, setTournamentList] = useState<TournamentResponse[]>(
    [],
  );
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  const loadTournaments = async () => {
    setIsLoadingList(true);
    setListError("");
    try {
      const data = await tournamentService.getTournaments();
      setTournamentList(data);
    } catch (err) {
      setListError(
        err instanceof Error
          ? err.message
          : "Không tải được danh sách giải đấu.",
      );
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (view === "list") {
      loadTournaments();
    } else if (routeId) {
      // Wizard ở chế độ EDIT: nạp giải theo id trên URL.
      loadDraft(Number(routeId));
    } else {
      // Wizard ở chế độ TẠO MỚI: reset về giải rỗng.
      setDraft(createEmptyTournament());
      setActiveTab("basic");
      setShowAllErrors(false);
      setValidationSummary([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, routeId]);

  useEffect(() => {
    if (view !== "wizard") return;
    void getVenues().then((items) => {
      setVenues(items);
      setVenuesError("");
    }).catch((err) => setVenuesError(adminError(err, "Không tải được danh sách trường đua.")));
  }, [view]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  // Điều hướng sang wizard tạo mới (useEffect sẽ reset draft khi tới URL).
  const handleCreateNew = () => navigate(WIZARD_PATH);

  // Điều hướng sang wizard sửa (useEffect sẽ nạp draft theo :id).
  const goEdit = (id: number) => navigate(`${WIZARD_PATH}/${id}`);

  const loadDraft = async (id: number) => {
    setIsSaving(true);
    setSaveError("");
    try {
      const t = await tournamentService.getTournamentById(id);
      setDraft({
        id: String(t.tournamentId),
        status: t.status as TournamentStatus,
        basicInfo: {
          name: t.name,
          description: t.description ?? "",
          // BE trả DateTime → JSON ISO "2026-06-30T18:00:00".
          // <input type="date"> chỉ nhận "yyyy-MM-dd" nên phải cắt 10 ký tự đầu,
          // nếu không ô ngày sẽ hiển thị trống.
          startDate: toDateInput(t.startDate),
          endDate: toDateInput(t.endDate),
          venueId: t.venueId ?? "",
          venueLaneCount: t.laneCount ?? null,
          venueTrackLengthMeters: t.trackLengthMeters ?? null,
          allowedBreed: t.allowedBreed as AllowedBreed,
          trackType: t.trackType as TrackType,
          raceDistance: t.raceDistance,
          raceCategory: t.raceCategory as RaceCategory,
          maxHorses: t.maxHorses,
          minJockeyExperienceYears: t.minJockeyExperienceYears,
          purseAmount: t.purseAmount,
          entryFeeAmount: t.entryFeeAmount,
          paymentDeadline: toDateTimeLocal(t.paymentDeadline),
          refundDeadline: toDateTimeLocal(t.refundDeadline),
          clearRefundDeadline: false,
          advancementCount: t.advancementCount ?? 5,
          preRaceWeightThresholdKg: t.preRaceWeightThresholdKg,
          postRaceWeightDiffThresholdKg: t.postRaceWeightDiffThresholdKg,
        },
        // Phải kiểm tra LENGTH: nếu BE trả mảng rỗng [] thì [].map() vẫn ra []
        // (không nullish) nên "?? mặc định" sẽ KHÔNG chạy → tab Prize hiện 0 dòng,
        // tổng 0%, không thể đạt 100% để lưu/publish. Fallback khi rỗng:
        prizeDistribution:
          t.prizeDistributions && t.prizeDistributions.length > 0
            ? t.prizeDistributions.map((p) => ({
                rank: p.position as 1 | 2 | 3 | 4 | 5,
                percentage: p.percentage,
              }))
            : [
                { rank: 1, percentage: 40 },
                { rank: 2, percentage: 25 },
                { rank: 3, percentage: 15 },
                { rank: 4, percentage: 12 },
                { rank: 5, percentage: 8 },
              ],
        rounds:
          t.rounds?.map((r) => ({
            id: String(r.roundId),
            name: r.name,
            scheduledDate: toDateInput(r.scheduledDate),
            races:
              r.races?.map((race) => ({
                id: String(race.raceId),
                sequenceOrder: race.raceNumber,
                scheduledDate: toDateInput(race.scheduledTime),
                raceNumber: race.raceNumber,
                scheduledTime: toTimeInputFromDateTime(race.scheduledTime),
                purseAmount: race.purseAmount,
                raceDistanceOverride: race.raceDistanceOverride ?? "",
                trackTypeOverride: (race.trackTypeOverride as TrackType) ?? "",
                isPostPositionDrawn: race.status !== "Upcoming",
                entries: [],
              })) ?? [],
          })) ?? [],
      });
      setActiveTab("basic");
      setShowAllErrors(false);
      setValidationSummary([]);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Không tải được giải đấu.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Đẩy giải sang status kế tiếp trong vòng đời (gọi BE ChangeStatus) ──────
  const [advancingId, setAdvancingId] = useState<number | null>(null);
  const handleAdvanceStatus = async (row: TournamentResponse) => {
    const next = NEXT_STATUS[row.status as TournamentStatus];
    if (!next) return;
    setListError("");
    setAdvancingId(row.tournamentId);
    try {
      await tournamentService.updateTournamentStatus(row.tournamentId, next);
      await loadTournaments();
    } catch (err) {
      // BE có thể từ chối (vd chưa đủ 5 PrizeDistributions để mở đăng ký).
      setListError(
        err instanceof Error ? err.message : "Không chuyển được trạng thái.",
      );
    } finally {
      setAdvancingId(null);
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const buildCreatePayload = (): tournamentService.CreateTournamentPayload => {
    const b = draft.basicInfo;
    return {
      name: b.name,
      description: b.description || undefined,
      startDate: b.startDate,
      endDate: b.endDate,
      maxHorses: typeof b.maxHorses === "number" ? b.maxHorses : undefined,
      venueId: typeof b.venueId === "number" ? b.venueId : undefined,
      allowedBreed: b.allowedBreed,
      trackType: b.trackType,
      raceDistance:
        typeof b.raceDistance === "number" ? b.raceDistance : undefined,
      raceCategory: b.raceCategory,
      minJockeyExperienceYears:
        typeof b.minJockeyExperienceYears === "number"
          ? b.minJockeyExperienceYears
          : undefined,
      purseAmount:
        typeof b.purseAmount === "number" ? b.purseAmount : undefined,
      entryFeeAmount: b.entryFeeAmount,
      paymentDeadline: b.paymentDeadline ? new Date(b.paymentDeadline).toISOString() : undefined,
      refundDeadline: b.refundDeadline ? new Date(b.refundDeadline).toISOString() : undefined,
      clearRefundDeadline: b.clearRefundDeadline,
      preRaceWeightThresholdKg: b.preRaceWeightThresholdKg,
      postRaceWeightDiffThresholdKg: b.postRaceWeightDiffThresholdKg,
      advancementRule: "TopPerRace",
      advancementCount: typeof b.advancementCount === "number" ? b.advancementCount : undefined,
    };
  };

  // Tournament mới (chưa có trên BE) có id dạng "t-<timestamp>" (string).
  // Tournament đã tồn tại trên BE có id là số nguyên thật — dùng để phân biệt
  // giữa "tạo mới" (POST) và "cập nhật" (PUT).
  const isNewDraft = draft.id.startsWith("t-");
  const isReadOnly = !isNewDraft && draft.status !== "Draft";

  const basicValidation = validateBasicInfo(draft.basicInfo, isNewDraft);
  const prizeValidation = validatePrizeDistribution(draft.prizeDistribution);
  const roundsValidation = validateRounds(draft.rounds, draft.basicInfo);

  // Lưu toàn bộ draft xuống BE (tạo/cập nhật giải + tỷ lệ thưởng + rounds + races).
  // Trả về tournamentId để Publish dùng tiếp.
  const persistDraft = async (): Promise<number> => {
    const payload = buildCreatePayload();
    let tournamentId: number;

    if (isNewDraft) {
      const created = await tournamentService.createTournament(payload);
      tournamentId = created.tournamentId;
      setDraft((prev) => ({
        ...prev,
        id: String(created.tournamentId),
        status: created.status as TournamentStatus,
      }));
    } else {
      tournamentId = Number(draft.id);
      await tournamentService.updateTournament(tournamentId, payload);
    }

    // Lưu đủ 5 tỷ lệ thưởng sau khi toàn bộ dữ liệu đã vượt qua validation.
    await tournamentService.updatePrizeDistributions(
      tournamentId,
      draft.prizeDistribution.map((p) => ({
        position: p.rank,
        percentage: p.percentage,
      })),
    );

    for (const round of draft.rounds) {
      let roundId = Number(round.id);
      if (!/^\d+$/.test(round.id)) {
        const created = await tournamentService.createRound(tournamentId, {
          name: round.name,
          sequenceOrder: draft.rounds.indexOf(round) + 1,
          scheduledDate: round.scheduledDate,
        });
        roundId = created.roundId;
      }
      for (const race of round.races) {
        if (!/^\d+$/.test(race.id)) {
          await tournamentService.createRace(roundId, {
            raceNumber: race.raceNumber,
            scheduledTime: new Date(
              `${race.scheduledDate}T${race.scheduledTime}:00`,
            ).toISOString(),
            purseAmount: Number(race.purseAmount) || 0,
            trackTypeOverride: race.trackTypeOverride || undefined,
            raceDistanceOverride:
              typeof race.raceDistanceOverride === "number"
                ? race.raceDistanceOverride
                : undefined,
          });
        }
      }
    }

    return tournamentId;
  };

  const moveToFirstInvalidTab = () => {
    if (hasBasicErrors(basicValidation)) {
      setActiveTab("basic");
      return;
    }

    if (hasPrizeErrors(prizeValidation)) {
      setActiveTab("prize");
      return;
    }

    if (hasRoundsErrors(roundsValidation)) {
      setActiveTab("rounds");
    }
  };

  const validateTournament = (): boolean => {
    const summary: string[] = [];
    const basicInvalid = hasBasicErrors(basicValidation);
    const prizeInvalid = hasPrizeErrors(prizeValidation);
    const roundsInvalid = hasRoundsErrors(roundsValidation);

    if (basicInvalid) {
      summary.push("Thông tin giải đấu còn dữ liệu chưa hợp lệ.");
    }

    if (Object.keys(prizeValidation.fieldErrors).length > 0) {
      summary.push("Quỹ thưởng còn tỷ lệ không hợp lệ.");
    }

    summary.push(...prizeValidation.structureErrors);

    if (Object.keys(roundsValidation.fieldErrors).length > 0) {
      summary.push("Vòng đấu và cuộc đua còn dữ liệu chưa hợp lệ.");
    }

    summary.push(...roundsValidation.structureErrors);

    setShowAllErrors(true);
    setValidationSummary(Array.from(new Set(summary)));

    if (basicInvalid || prizeInvalid || roundsInvalid) {
      moveToFirstInvalidTab();
      return false;
    }

    setValidationSummary([]);
    return true;
  };

  const handleSaveDraft = async () => {
    setSaveError("");

    if (!validateTournament()) {
      return;
    }

    setIsSaving(true);
    try {
      await persistDraft();
      navigate(LIST_PATH);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Lưu giải đấu thất bại.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setSaveError("");

    if (!validateTournament()) {
      return;
    }

    setIsSaving(true);
    try {
      const tournamentId = await persistDraft();
      await tournamentService.updateTournamentStatus(
        tournamentId,
        "Open Registration",
      );
      navigate(LIST_PATH);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Publish giải đấu thất bại.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmCancel = async () => {
    setIsSaving(true);
    setSaveError("");
    try {
      // Giải mới chưa lưu (id dạng "t-...") thì không có gì để hủy ở BE.
      if (!isNewDraft) {
        await tournamentService.deleteTournament(Number(draft.id));
      }
      setShowCancelModal(false);
      navigate(LIST_PATH);
    } catch (err) {
      setShowCancelModal(false);
      setSaveError(
        err instanceof Error ? err.message : "Hủy giải đấu thất bại.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Columns cho danh sách giải ────────────────────────────────────────────
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");

  const listColumns: DataTableColumn<TournamentResponse>[] = [
    {
      key: "name",
      header: "Tên giải",
      render: (row) => (
        <span className={styles.tournamentName}>{row.name}</span>
      ),
    },
    {
      key: "startDate",
      header: "Ngày bắt đầu",
      render: (row) => formatDate(row.startDate),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (row) => <StatusBadge status={row.status as StatusType} label={adminLabel(row.status)} />,
    },
    {
      key: "action",
      header: "",
      width: "320px",
      render: (row) => {
        const next = NEXT_STATUS[row.status as TournamentStatus];
        const isDraftRow = row.status === "Draft";
        return (
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              className={styles.editBtn}
              onClick={() => goEdit(row.tournamentId)}
            >
              {isDraftRow ? (
                <>
                  <FiEdit2 size={13} /> Chỉnh sửa
                </>
              ) : (
                <>
                  <FiEye size={13} /> Xem chi tiết
                </>
              )}
            </button>
            {next && (
              <button
                type="button"
                className={styles.editBtn}
                disabled={advancingId === row.tournamentId}
                onClick={() => handleAdvanceStatus(row)}
                title={`Chuyển sang "${next}"`}
              >
                {advancingId === row.tournamentId
                  ? "Đang chuyển..."
                  : `→ ${adminLabel(next)}`}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // VIEW: LIST
  // ═══════════════════════════════════════════════════════════════════════
  if (view === "list") {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.heading}>Quản lý giải đấu</h1>
          <button
            type="button"
            className={styles.createBtn}
            onClick={handleCreateNew}
          >
            <FiPlus size={16} /> Tạo giải đấu
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
        <button
          type="button"
          className={styles.backLink}
          onClick={() => navigate(LIST_PATH)}
        >
          ← Quay lại danh sách
        </button>
        <h1 className={styles.heading}>
          {isNewDraft ? "Tạo giải đấu mới" : "Chỉnh sửa giải đấu"}
        </h1>
      </div>

      {/* ═══ TAB STEPPER ════════════════════════════════════════ */}
      <div className={styles.tabStepper}>
        {TABS.map((tab, index) => (
          <div key={tab.key} className={styles.tabStepWrapper}>
            {index > 0 && <div className={styles.tabConnector} />}
            <button
              type="button"
              className={`${styles.tabStep} ${activeTab === tab.key ? styles.tabStepActive : ""}`}
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
        {activeTab === "basic" && (
          <TabBasicInfo
            data={draft.basicInfo}
            onChange={(basicInfo) =>
              setDraft((prev) => ({ ...prev, basicInfo }))
            }
            readOnly={isReadOnly}
            showAllErrors={showAllErrors}
            isCreateMode={isNewDraft}
            venues={venues}
            venuesError={venuesError}
          />
        )}

        {activeTab === "prize" && (
          <TabPrizeDistribution
            prizeDistribution={draft.prizeDistribution}
            totalPurse={
              typeof draft.basicInfo.purseAmount === "number"
                ? draft.basicInfo.purseAmount
                : 0
            }
            onChange={(prizeDistribution) =>
              setDraft((prev) => ({ ...prev, prizeDistribution }))
            }
            readOnly={isReadOnly}
            showAllErrors={showAllErrors}
          />
        )}

        {activeTab === "rounds" && (
          <TabRoundsRaces
            rounds={draft.rounds}
            tournamentPurse={
              typeof draft.basicInfo.purseAmount === "number"
                ? draft.basicInfo.purseAmount
                : 0
            }
            tournamentStartDate={draft.basicInfo.startDate}
            tournamentEndDate={draft.basicInfo.endDate}
            onChange={(rounds) => setDraft((prev) => ({ ...prev, rounds }))}
            readOnly={isReadOnly}
            showAllErrors={showAllErrors}
          />
        )}

        {activeTab === "roster" && (
          <TabRoster
            tournamentId={draft.id}
            tournamentName={draft.basicInfo.name}
            rounds={draft.rounds}
            isNewDraft={isNewDraft}
          />
        )}

        {activeTab === "draw" && (
          <TabPostPositionDraw
            rounds={draft.rounds}
            onChange={(rounds) => setDraft((prev) => ({ ...prev, rounds }))}
            readOnly={isReadOnly}
          />
        )}
      </div>

      {showAllErrors && validationSummary.length > 0 && (
        <div className={styles.validationSummary} role="alert">
          <strong>Vui lòng kiểm tra lại:</strong>
          <ul>
            {validationSummary.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ═══ ACTION BAR (cố định ở mọi tab) ══════════════════════ */}
      {saveError && <div className={styles.listError}>{saveError}</div>}

      {!isReadOnly && (
        <div className={styles.actionBar}>
          <button
            type="button"
            className={styles.cancelTournamentBtn}
            onClick={() => setShowCancelModal(true)}
          >
            Hủy tạo giải
          </button>
          <div className={styles.actionBarRight}>
            <button
              type="button"
              className={styles.saveDraftBtn}
              onClick={handleSaveDraft}
              disabled={isSaving}
            >
              {isSaving ? "Đang lưu..." : "Lưu bản nháp"}
            </button>
            <button
              type="button"
              className={styles.publishBtn}
              onClick={handlePublish}
              disabled={isSaving}
            >
              {isSaving ? "Đang xử lý..." : "Mở đăng ký"}
            </button>
          </div>
        </div>
      )}

      {showCancelModal && (
        <ConfirmationModal
          title="Hủy giải đấu"
          message="Đây là thao tác KHÔNG THỂ HOÀN TÁC. Toàn bộ Round, Race và dữ liệu liên quan sẽ bị hủy vĩnh viễn."
          confirmationPhrase={
            draft.basicInfo.name.trim() !== ""
              ? draft.basicInfo.name
              : "XAC NHAN"
          }
          confirmLabel="Hủy giải đấu"
          onConfirm={handleConfirmCancel}
          onCancel={() => setShowCancelModal(false)}
        />
      )}
    </div>
  );
};

export default TournamentBuilder;
