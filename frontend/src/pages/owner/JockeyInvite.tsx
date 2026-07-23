import { useCallback, useEffect, useState } from 'react';
import type { AvailableJockey, JockeyInvitation, Horse } from '../../types/owner.types';
import { cancelPairing, getAvailableJockeys, getMyHorses, getMyTournamentHorseEnrollments, getOwnerPairings, inviteJockey } from '../../services/ownerService';
import { getMyTournamentParticipations, getTournamentById, type ParticipationResponse, type TournamentResponse } from '../../services/tournamentService';
import { submitPairingFeePayment, type FeePaymentMethod } from '../../services/entryFeePaymentService';
import { getJockeyInviteState, type JockeyInviteAction } from './jockeyInviteState';

const PAIRING_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  Pending:   { label: 'Chờ Jockey phản hồi',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  Accepted:  { label: 'Chờ nộp lệ phí',        cls: 'bg-amber-50 text-amber-700 border-amber-200',     dot: 'bg-amber-500' },
  PendingVerification: { label: 'Chờ Admin đối chứng', cls: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  Confirmed: { label: 'Đã xác nhận ghép cặp',  cls: 'bg-green-50 text-green-700 border-green-200',    dot: 'bg-green-500' },
  Declined:  { label: 'Bị từ chối',            cls: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-500' },
  Cancelled: { label: 'Đã hủy',                cls: 'bg-gray-50 text-gray-500 border-gray-200',       dot: 'bg-gray-400' },
  Rejected:  { label: 'Bị từ chối',            cls: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-500' },
  Expired:   { label: 'Đã hết hạn',             cls: 'bg-gray-50 text-gray-500 border-gray-200',       dot: 'bg-gray-400' },
};

const JOCKEY_RESPONSE: Record<string, { label: string; cls: string; dot: string }> = {
  Pending:   { label: 'Chờ phản hồi',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  Accepted:  { label: 'Đã chấp nhận',   cls: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-500' },
  PendingVerification: { label: 'Đã chấp nhận', cls: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  Confirmed: { label: 'Đã chấp nhận',   cls: 'bg-green-50 text-green-700 border-green-200',    dot: 'bg-green-500' },
  Declined:  { label: 'Đã từ chối',     cls: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-500' },
  Cancelled: { label: 'Đã hủy',         cls: 'bg-gray-50 text-gray-500 border-gray-200',       dot: 'bg-gray-400' },
  Rejected:  { label: 'Đã từ chối',     cls: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-500' },
  Expired:   { label: 'Đã hết hạn',      cls: 'bg-gray-50 text-gray-500 border-gray-200',       dot: 'bg-gray-400' },
};

function StatusBadge({ status, kind }: { status: JockeyInvitation['status']; kind: 'pairing' | 'response' }) {
  const cfg = (kind === 'pairing' ? PAIRING_STATUS : JOCKEY_RESPONSE)[status];
  if (!cfg) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// Shared input class
const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white';

const formatCurrency = (value: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
}).format(value);

const formatDeadline = (value: string | null) => value
  ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
  : 'Không có';

const remainingDays = (value: string | null) => value
  ? Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000))
  : null;

const ACTION_PRESENTATION: Record<JockeyInviteAction, { label: string; disabled: boolean; cls: string }> = {
  invite: { label: 'Mời tham gia', disabled: false, cls: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' },
  invited: { label: 'Đã gửi lời mời', disabled: true, cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  pay: { label: 'Nộp lệ phí', disabled: false, cls: 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600' },
  verifying: { label: 'Chờ đối chứng', disabled: true, cls: 'border-violet-200 bg-violet-50 text-violet-700' },
  paired: { label: 'Đã ghép cặp', disabled: true, cls: 'border-gray-200 bg-gray-100 text-gray-500' },
  reinvite: { label: 'Mời lại', disabled: false, cls: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' },
};

export default function JockeyInvite() {
  const [invitations, setInvitations] = useState<JockeyInvitation[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [jockeyName, setJockeyName] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [error, setError] = useState('');
  const [availableJockeys, setAvailableJockeys] = useState<AvailableJockey[]>([]);
  const [loadingJockeys, setLoadingJockeys] = useState(false);
  const [selectedJockeyId, setSelectedJockeyId] = useState('');
  const [horses, setHorses] = useState<Horse[]>([]);
  const [eligibleHorses, setEligibleHorses] = useState<Horse[]>([]);
  const [loadingHorses, setLoadingHorses] = useState(false);
  const [selectedHorseId, setSelectedHorseId] = useState('');
  const [filterHorseId, setFilterHorseId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'history'>('available');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);

  // ── Tournament picker state ──────────────────────────────────────────────────
  const [approvedTournaments, setApprovedTournaments] = useState<ParticipationResponse[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [selectedContextHorseId, setSelectedContextHorseId] = useState('');
  const [paymentPairing, setPaymentPairing] = useState<JockeyInvitation | null>(null);
  const [paymentTournament, setPaymentTournament] = useState<TournamentResponse | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<FeePaymentMethod>('Transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const closeInviteModal = useCallback(() => {
    setShowModal(false);
    setError('');
    setJockeyName('');
    setSelectedJockeyId('');
    setSelectedHorseId('');
    setRequestMessage('');
  }, []);

  const openInviteModal = useCallback((jockeyId = '', name = '', horseId = selectedContextHorseId) => {
    setError('');
    setSelectedJockeyId(jockeyId);
    setJockeyName(name);
    setSelectedHorseId(horseId);
    setRequestMessage('');
    setShowModal(true);
  }, [selectedContextHorseId]);

  const closePaymentModal = useCallback(() => {
    if (paymentSubmitting) return;
    setPaymentPairing(null);
    setPaymentTournament(null);
    setPaymentMethod('Transfer');
    setPaymentReference('');
    setPaymentProof(null);
    setPaymentError('');
  }, [paymentSubmitting]);

  const openPaymentModal = useCallback(async (pairing: JockeyInvitation) => {
    setPaymentPairing(pairing);
    setPaymentTournament(null);
    setPaymentMethod('Transfer');
    setPaymentReference('');
    setPaymentProof(null);
    setPaymentError('');
    setPaymentLoading(true);
    try {
      setPaymentTournament(await getTournamentById(pairing.tournamentID));
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Không tải được thông tin lệ phí của giải đấu.');
    } finally {
      setPaymentLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showModal && !paymentPairing) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (paymentPairing) closePaymentModal();
        else closeInviteModal();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeInviteModal, closePaymentModal, paymentPairing, showModal]);

  const getHorseNameById = (horseID?: string, horseName?: string) => {
    if (!horseID) return 'Chưa gán ngựa';
    const found = horses.find(h => String(h.horseID || h.horseId || '') === String(horseID));
    if (found) return found.name;
    if (horseName) return horseName;
    return `Ngựa (ID: ${horseID})`;
  };

  const filteredInvitations = invitations.filter((inv) => {
    const matchHorse = filterHorseId ? String(inv.horseID) === filterHorseId : true;
    const matchStatus = filterStatus ? inv.status === filterStatus : true;
    return matchHorse && matchStatus;
  });

  // ── Fetch approved tournament participations on mount ───────────────────────
  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        setLoadingTournaments(true);
        const list = await getMyTournamentParticipations();
        const approved = list.filter((p) => p.status === 'Approved');
        setApprovedTournaments(approved);
        // Auto-select the first approved tournament so the table populates immediately
        if (approved.length > 0) {
          setSelectedTournamentId(approved[0].tournamentId);
        }
      } catch (err) {
        console.error('Failed to fetch tournament participations:', err);
      } finally {
        setLoadingTournaments(false);
      }
    };

    const fetchHorses = async () => {
      try {
        setLoadingHorses(true);
        const data = await getMyHorses();
        setHorses(data);
      } catch (err) {
        console.error('Failed to fetch my horses:', err);
      } finally {
        setLoadingHorses(false);
      }
    };

    fetchTournaments();
    fetchHorses();
  }, []);

  // ── Chỉ tải jockey và ngựa đã được duyệt trong đúng giải đang chọn ──────────
  useEffect(() => {
    if (!selectedTournamentId) {
      return;
    }
    const fetchTournamentOptions = async () => {
      try {
        setLoadingJockeys(true);
        setLoadingHorses(true);
        const [jockeyData, enrollments] = await Promise.all([
          getAvailableJockeys(selectedTournamentId, 1, 100),
          getMyTournamentHorseEnrollments(selectedTournamentId, 'Approved'),
        ]);
        setAvailableJockeys(jockeyData);

        const eligibleHorseIds = new Set(
          enrollments
            .filter((entry) => entry.status === 'Enrolled' && entry.adminApprovalStatus === 'Approved')
            .map((entry) => String(entry.horseId))
        );
        const nextEligibleHorses = horses.filter((horse) =>
          eligibleHorseIds.has(String(horse.horseID || horse.horseId || ''))
        );
        setEligibleHorses(nextEligibleHorses);
        setSelectedContextHorseId((currentHorseId) => {
          const stillEligible = nextEligibleHorses.some((horse) =>
            String(horse.horseID || horse.horseId || '') === currentHorseId);
          return stillEligible
            ? currentHorseId
            : String(nextEligibleHorses[0]?.horseID || nextEligibleHorses[0]?.horseId || '');
        });
      } catch (err) {
        console.error('Failed to fetch tournament invitation options:', err);
        setAvailableJockeys([]);
        setEligibleHorses([]);
      } finally {
        setLoadingJockeys(false);
        setLoadingHorses(false);
      }
    };
    fetchTournamentOptions();
  }, [selectedTournamentId, horses, refreshTrigger]);

  useEffect(() => {
    const fetchInvitations = async () => {
      try {
        setLoadingInvitations(true);
        const data = await getOwnerPairings(undefined, undefined, 1, 100);

        // Map the backend pairings to our UI JockeyInvitation format
        const mapped: JockeyInvitation[] = data.map((item) => {
          return {
            invitationID: String(item.pairingId),
            tournamentID: item.tournamentId,
            raceID: item.requestMessage || 'N/A',
            ownerID: '',
            jockeyID: String(item.jockey.jockeyId),
            jockeyName: item.jockey.fullName || 'N/A',
            status: item.status,
            invitedAt: new Date(item.createdAt),
            horseID: String(item.horse.horseId),
            horseName: item.horse.name || '',
            requestMessage: item.requestMessage || '',
          };
        });
        setInvitations(mapped);
      } catch (err) {
        console.error('Failed to fetch invitations:', err);
      } finally {
        setLoadingInvitations(false);
      }
    };

    fetchInvitations();
  }, [refreshTrigger]);

  useEffect(() => {
    const refreshOnFocus = () => setRefreshTrigger((current) => current + 1);
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, []);

  const handleSendInvitation = async () => {
    setError('');

    // ── Validation ─────────────────────────────────────────────────────────────
    if (!selectedTournamentId) {
      setError('Vui lòng chọn giải đấu trước khi gửi lời mời.');
      return;
    }
    if (!selectedJockeyId) {
      setError('Vui lòng chọn Jockey từ danh sách khả dụng.');
      return;
    }
    if (!selectedHorseId) {
      setError('Vui lòng chọn ngựa.');
      return;
    }
    if (!requestMessage.trim()) {
      setError('Vui lòng nhập lời nhắn.');
      return;
    }

    const currentState = getJockeyInviteState(
      selectedJockeyId,
      selectedTournamentId,
      selectedHorseId,
      invitations,
    );
    if (currentState.action === 'invited') {
      setError('Lời mời cho Jockey và ngựa này đã được gửi trước đó.');
      return;
    }
    if (currentState.action === 'pay') {
      setError('Jockey đã chấp nhận. Vui lòng nộp lệ phí thay vì gửi lời mời mới.');
      return;
    }
    if (currentState.action === 'verifying') {
      setError('Lệ phí của cặp này đang chờ Admin đối chứng.');
      return;
    }
    if (currentState.action === 'paired') {
      setError('Jockey và ngựa này đã được ghép cặp.');
      return;
    }

    // ── Build payload — all IDs as number ──────────────────────────────────────
    const payload = {
      tournamentId: selectedTournamentId,
      horseId: Number(selectedHorseId),
      jockeyId: Number(selectedJockeyId),
      requestMessage: requestMessage.trim(),
    };

    console.debug('POST /api/pairings payload', payload);

    try {
      setSending(true);
      await inviteJockey(payload);

      // ── Success: reset form, close modal, refresh list, switch tab ────────────
      setJockeyName('');
      setSelectedJockeyId('');
      setSelectedContextHorseId(String(payload.horseId));
      setSelectedHorseId('');
      setRequestMessage('');
      setShowModal(false);
      setRefreshTrigger((prev) => prev + 1);
      setActiveTab('history');
    } catch (err: unknown) {
      console.error('POST /api/pairings failed:', err);
      // Surface real backend message (apiFetch throws Error with BE message)
      const msg = err instanceof Error
        ? err.message
        : 'Đã xảy ra lỗi khi gửi lời mời. Vui lòng thử lại.';
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  const handleSubmitFeePayment = async () => {
    if (!paymentPairing || !paymentTournament || paymentSubmitting) return;

    const reference = paymentReference.trim();
    if (!reference) {
      setPaymentError(paymentMethod === 'Transfer' ? 'Vui lòng nhập mã giao dịch.' : 'Vui lòng nhập số biên lai.');
      return;
    }
    if (paymentMethod === 'Transfer' && !paymentProof) {
      setPaymentError('Vui lòng đính kèm ảnh hoặc file chứng từ chuyển khoản.');
      return;
    }
    if (paymentProof && paymentProof.size > 10 * 1024 * 1024) {
      setPaymentError('File chứng từ không được vượt quá 10MB.');
      return;
    }

    setPaymentError('');
    setPaymentSubmitting(true);
    try {
      const result = await submitPairingFeePayment(paymentPairing.invitationID, {
        method: paymentMethod,
        reference,
        proofFile: paymentProof,
      });
      setInvitations((previous) => previous.map((invitation) =>
        invitation.invitationID === paymentPairing.invitationID
          ? { ...invitation, status: 'PendingVerification' }
          : invitation));
      setConfirmSuccess('Đã nộp lệ phí. Ban tổ chức sẽ đối chiếu chứng từ và xác nhận cặp đấu.');
      setPaymentPairing(null);
      setPaymentTournament(null);
      setPaymentReference('');
      setPaymentProof(null);
      if (result.pairingStatus === 'Confirmed') {
        setConfirmSuccess('Lệ phí đã được xác nhận và ghép cặp thành công.');
      }
      setRefreshTrigger((previous) => previous + 1);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Nộp lệ phí thất bại. Vui lòng thử lại.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleCancelPairing = async (invitationID: string) => {
    if (cancellingId === invitationID) return;
    if (!window.confirm('Bạn có chắc muốn hủy lời mời ghép cặp này không?')) return;

    setConfirmError(null);
    setConfirmSuccess(null);
    setCancellingId(invitationID);
    try {
      await cancelPairing(invitationID);
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.invitationID === invitationID ? { ...inv, status: 'Cancelled' as const } : inv
        )
      );
      setConfirmSuccess('Hủy lời mời ghép cặp thành công!');
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Hủy lời mời ghép cặp thất bại.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleAvailableAction = (
    action: JockeyInviteAction,
    jockey: AvailableJockey,
    pairing?: JockeyInvitation,
  ) => {
    if (action === 'pay' && pairing) {
      void openPaymentModal(pairing);
      return;
    }

    if (action === 'invite' || action === 'reinvite') {
      openInviteModal(String(jockey.jockeyId), jockey.fullName);
    }
  };

  // Main Render
  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Mời Jockey</h1>
          <p className="text-base text-slate-500 mt-2">Quản lý lời mời và tìm kỵ sĩ khả dụng</p>
        </div>
        <button
          onClick={() => openInviteModal()}
          className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
        >
          + Gửi lời mời mới
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <div className="flex gap-1">
          {[
            { key: 'available', label: `Kỵ sĩ khả dụng (${availableJockeys.length})` },
            { key: 'history',   label: `Lịch sử lời mời (${invitations.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key as 'available' | 'history');
                setRefreshTrigger((current) => current + 1);
              }}
              className={`px-4 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Available Jockeys */}
      {activeTab === 'available' ? (
        <div className="space-y-3">
          {/* Tournament picker */}
          <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">Giải đấu:</label>
            {loadingTournaments ? (
              <span className="text-sm text-gray-400 italic">Đang tải giải đấu...</span>
            ) : approvedTournaments.length === 0 ? (
              <span className="text-sm text-amber-600 font-medium">
                Bạn chưa được duyệt vào giải đấu nào — không thể xem kỵ sĩ khả dụng.
              </span>
            ) : (
              <select
                value={selectedTournamentId ?? ''}
                onChange={(e) => setSelectedTournamentId(e.target.value ? Number(e.target.value) : null)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
              >
                {approvedTournaments.map((p) => (
                  <option key={p.tournamentId} value={p.tournamentId}>
                    {p.tournamentName || `Giải #${p.tournamentId}`}
                  </option>
                ))}
              </select>
            )}
            {selectedTournamentId && (
              <>
                <label className="ml-0 text-xs font-semibold text-gray-500 whitespace-nowrap sm:ml-4">Ngựa:</label>
                <select
                  value={selectedContextHorseId}
                  onChange={(event) => setSelectedContextHorseId(event.target.value)}
                  disabled={loadingHorses || eligibleHorses.length === 0}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white disabled:bg-gray-100"
                  aria-label="Chọn ngựa để đối chiếu lời mời"
                >
                  {eligibleHorses.length === 0 ? (
                    <option value="">Không có ngựa đủ điều kiện</option>
                  ) : eligibleHorses.map((horse) => {
                    const horseId = String(horse.horseID || horse.horseId || '');
                    return <option key={horseId} value={horseId}>{horse.name}</option>;
                  })}
                </select>
              </>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
          {!selectedTournamentId ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              Chọn một giải đấu để xem kỵ sĩ khả dụng
            </div>
          ) : loadingJockeys ? (
            <div className="py-14 text-center">
              <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600 mb-3" />
              <p className="text-sm text-gray-500">Đang tải danh sách kỵ sĩ...</p>
            </div>
          ) : availableJockeys.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              Không có kỵ sĩ khả dụng cho giải này
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tên kỵ sĩ</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Chứng chỉ</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Kinh nghiệm</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sức khỏe</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {availableJockeys.map((j) => {
                    const jId = String(j.jockeyId);
                    const inviteState = getJockeyInviteState(
                      jId,
                      selectedTournamentId,
                      selectedContextHorseId,
                      invitations,
                    );
                    const presentation = ACTION_PRESENTATION[inviteState.action];
                    const isOpeningPayment = inviteState.pairing?.invitationID === paymentPairing?.invitationID && paymentLoading;
                    const disabled = presentation.disabled || isOpeningPayment || !selectedContextHorseId;
                    return (
                      <tr key={jId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">{j.fullName || 'N/A'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                            Đã xác thực
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{j.experienceYears || 0} năm</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${
                            j.healthStatus === 'Good'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${j.healthStatus === 'Good' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            {j.healthStatus === 'Good' ? 'Khỏe mạnh' : j.healthStatus || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleAvailableAction(inviteState.action, j, inviteState.pairing)}
                            disabled={disabled}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${presentation.cls}`}
                          >
                            {isOpeningPayment && <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            {isOpeningPayment ? 'Đang tải...' : presentation.label}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      ) : (
        /* Tab: Invitation History */
        <div className="space-y-3">
          {/* Filters */}
          <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500">Ngựa:</label>
              <select
                value={filterHorseId}
                onChange={(e) => setFilterHorseId(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
              >
                <option value="">Tất cả ngựa</option>
                {horses.map((h) => {
                  const hId = String(h.horseID || h.horseId || '');
                  return (
                    <option key={hId} value={hId}>
                      {h.name} (ID: {hId})
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500">Trạng thái:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
              >
                <option value="">Tất cả</option>
                <option value="Pending">Chờ phản hồi</option>
                <option value="Accepted">Jockey đã chấp nhận</option>
                <option value="PendingVerification">Chờ Admin đối chứng</option>
                <option value="Confirmed">Đã xác nhận ghép cặp</option>
                <option value="Declined">Jockey từ chối</option>
                <option value="Cancelled">Đã hủy</option>
              </select>
            </div>
          </div>

          {/* Inline feedback banners */}
          {confirmSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 flex items-center justify-between">
              <p className="text-sm text-green-700 font-medium">{confirmSuccess}</p>
              <button onClick={() => setConfirmSuccess(null)} className="text-green-500 hover:text-green-700 text-lg leading-none">×</button>
            </div>
          )}
          {confirmError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 flex items-center justify-between">
              <p className="text-sm text-red-700">{confirmError}</p>
              <button onClick={() => setConfirmError(null)} className="text-red-500 hover:text-red-700 text-lg leading-none">×</button>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
            {loadingInvitations ? (
              <div className="py-14 text-center">
                <div className="inline-block animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600 mb-3" />
                <p className="text-sm text-gray-500">Đang tải lịch sử lời mời...</p>
              </div>
            ) : filteredInvitations.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                Không tìm thấy lời mời nào
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Jockey</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ngựa</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Lời nhắn</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Trạng thái ghép cặp</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Phản hồi Jockey</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ngày mời</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredInvitations.map((invitation) => {
                      const isCancelling = cancellingId === invitation.invitationID;
                      const canCancel = invitation.status === 'Pending' || invitation.status === 'Accepted';
                      return (
                        <tr key={invitation.invitationID} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-800">{invitation.jockeyName || 'N/A'}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded border border-blue-100">
                              {getHorseNameById(invitation.horseID, invitation.horseName)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                            {invitation.requestMessage || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={invitation.status} kind="pairing" />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={invitation.status} kind="response" />
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {new Date(invitation.invitedAt).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="px-4 py-3">
                            {invitation.status === 'Confirmed' ? (
                              <button
                                type="button"
                                disabled
                                className="inline-flex cursor-not-allowed items-center whitespace-nowrap rounded-full border border-gray-200 bg-gray-100 px-3.5 py-2 text-xs font-bold text-gray-500"
                              >
                                Đã ghép cặp
                              </button>
                            ) : invitation.status === 'PendingVerification' ? (
                              <button
                                type="button"
                                disabled
                                className="inline-flex cursor-not-allowed items-center whitespace-nowrap rounded-full border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-bold text-violet-700"
                              >
                                Đã nộp lệ phí — chờ đối chiếu
                              </button>
                            ) : invitation.status === 'Cancelled' || invitation.status === 'Declined' || invitation.status === 'Rejected' || invitation.status === 'Expired' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTournamentId(invitation.tournamentID);
                                  setSelectedContextHorseId(invitation.horseID || '');
                                  openInviteModal(invitation.jockeyID, invitation.jockeyName || '', invitation.horseID || '');
                                }}
                                className="inline-flex items-center whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                              >
                                Mời lại
                              </button>
                            ) : invitation.status === 'Accepted' || canCancel ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {invitation.status === 'Accepted' && (
                                  <button
                                    onClick={() => void openPaymentModal(invitation)}
                                    disabled={paymentLoading || isCancelling}
                                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-500 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    Nộp lệ phí
                                  </button>
                                )}
                                {canCancel && (
                                  <button
                                    onClick={() => handleCancelPairing(invitation.invitationID)}
                                    disabled={paymentLoading || isCancelling}
                                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isCancelling && (
                                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                                    )}
                                    {isCancelling ? 'Đang hủy...' : 'Hủy lời mời'}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Send Invitation Modal */}
      {showModal && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-black/40"
            onClick={closeInviteModal}
            aria-label="Đóng modal gửi lời mời"
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="invite-jockey-title"
              className="pointer-events-auto max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl"
            >
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 id="invite-jockey-title" className="text-base font-bold text-gray-900">Gửi lời mời cho jockey</h3>
              <button
                type="button"
                onClick={closeInviteModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Đóng modal"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Jockey select */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Chọn Jockey khả dụng
                </label>
                {loadingJockeys ? (
                  <div className="text-sm text-gray-400 italic">Đang tải danh sách jockey...</div>
                ) : !selectedTournamentId ? (
                  <div className="text-sm text-amber-600 italic">Vui lòng chọn giải đấu trong tab "Kỵ sĩ khả dụng" trước khi gửi lời mời.</div>
                ) : (
                  <select
                    value={selectedJockeyId}
                    onChange={(e) => {
                      const targetId = e.target.value;
                      setSelectedJockeyId(targetId);
                      const jockeyObj = availableJockeys.find(j =>
                        String(j.jockeyId) === targetId
                      );
                      if (jockeyObj) {
                        setJockeyName(jockeyObj.fullName || '');
                      } else {
                        setJockeyName('');
                      }
                    }}
                    className={inputCls}
                  >
                    <option value="">— Chọn Jockey —</option>
                    {availableJockeys.map((j) => {
                      const idVal = String(j.jockeyId);
                      const nameVal = j.fullName || 'Jockey không tên';
                      const licVal = ' (Chứng chỉ: Đã xác thực)';
                      const expVal = j.experienceYears ? ` - ${j.experienceYears} năm KN` : '';
                      return (
                        <option key={idVal} value={idVal}>
                          {nameVal}{licVal}{expVal}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Jockey name manual */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Tên jockey (tự động điền hoặc nhập thủ công)
                </label>
                <input
                  type="text"
                  value={jockeyName}
                  onChange={(e) => {
                    setJockeyName(e.target.value);
                    setSelectedJockeyId('');
                  }}
                  placeholder="Nhập tên jockey"
                  className={inputCls}
                />
              </div>

              {/* Horse select */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Chọn Ngựa
                </label>
                {loadingHorses ? (
                  <div className="text-sm text-gray-400 italic">Đang tải danh sách ngựa...</div>
                ) : (
                  <select
                    value={selectedHorseId}
                    onChange={(e) => setSelectedHorseId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Chọn Ngựa —</option>
                    {eligibleHorses.map((h) => {
                      const hId = h.horseID || h.horseId || '';
                      return (
                        <option key={hId} value={hId}>
                          {h.name} (ID: {hId})
                        </option>
                      );
                    })}
                  </select>
                )}
                {!loadingHorses && selectedTournamentId && eligibleHorses.length === 0 && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    Chưa có ngựa nào được duyệt và còn trong giải này.
                  </p>
                )}
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Lời nhắn
                </label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="Nhập lời nhắn gửi đến jockey"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-xl">
              <button
                type="button"
                onClick={closeInviteModal}
                disabled={sending}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSendInvitation}
                disabled={sending}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {sending && (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                )}
                {sending ? 'Đang gửi...' : 'Gửi lời mời'}
              </button>
            </div>
            </div>
          </div>
        </>
      )}

      {paymentPairing && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-black/50"
            onClick={closePaymentModal}
            aria-label="Đóng modal nộp lệ phí"
          />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="fee-payment-title"
              className="pointer-events-auto max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            >
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 id="fee-payment-title" className="text-xl font-black text-slate-950">Nộp lệ phí tham gia</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {getHorseNameById(paymentPairing.horseID, paymentPairing.horseName)} · {paymentPairing.jockeyName}
                </p>
              </div>

              <div className="space-y-5 px-6 py-5">
                {paymentLoading ? (
                  <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">Đang tải thông tin lệ phí...</div>
                ) : paymentTournament ? (
                  <>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-bold text-amber-950">Hạn nộp lệ phí</p>
                          <p className="mt-1 text-amber-800">{formatDeadline(paymentTournament.paymentDeadline)}</p>
                        </div>
                        {remainingDays(paymentTournament.paymentDeadline) !== null && (
                          <span className="shrink-0 font-black text-amber-800">còn {remainingDays(paymentTournament.paymentDeadline)} ngày</span>
                        )}
                      </div>
                      <div className="mt-3 border-t border-amber-200 pt-3 text-amber-800">
                        <p>Hạn hoàn phí khi rút lui: {formatDeadline(paymentTournament.refundDeadline)}</p>
                        <p className="mt-1 font-bold">Số tiền: {formatCurrency(paymentTournament.entryFeeAmount)}</p>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-bold text-slate-700">Hình thức thanh toán</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(['Transfer', 'Cash'] as const).map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() => { setPaymentMethod(method); setPaymentReference(''); setPaymentError(''); }}
                            className={`rounded-xl border px-4 py-3 text-sm font-bold ${paymentMethod === method ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                          >
                            {method === 'Transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="block text-sm font-bold text-slate-700">
                      {paymentMethod === 'Transfer' ? 'Mã giao dịch' : 'Số biên lai'} <span className="text-red-500">*</span>
                      <input
                        aria-label={`${paymentMethod === 'Transfer' ? 'Mã giao dịch' : 'Số biên lai'} *`}
                        value={paymentReference}
                        onChange={(event) => setPaymentReference(event.target.value)}
                        maxLength={paymentMethod === 'Transfer' ? 100 : 50}
                        placeholder={paymentMethod === 'Transfer' ? 'Ví dụ: MOMO-6128-20260717' : 'Nhập số biên lai tiền mặt'}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      />
                    </label>

                    <div>
                      <label htmlFor="fee-proof" className="block text-sm font-bold text-slate-700">
                        Ảnh/file chứng từ {paymentMethod === 'Transfer' && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        id="fee-proof"
                        aria-label="Ảnh/file chứng từ *"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(event) => {
                          setPaymentProof(event.target.files?.[0] ?? null);
                          setPaymentError('');
                        }}
                        className="mt-2 block w-full rounded-xl border border-slate-200 p-2 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-bold file:text-blue-700"
                      />
                      <p className="mt-2 text-xs text-slate-400">Chấp nhận PDF, JPG, PNG, WEBP. Tối đa 10MB.</p>
                    </div>

                    <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                      Nộp lệ phí đồng nghĩa Owner xác nhận ghép cặp. Cặp đấu chỉ thành công sau khi Admin đối chứng đúng chứng từ.
                    </p>
                  </>
                ) : null}

                {paymentError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{paymentError}</p>}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <button type="button" onClick={closePaymentModal} disabled={paymentSubmitting} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">Hủy</button>
                <button
                  type="button"
                  onClick={() => void handleSubmitFeePayment()}
                  disabled={paymentLoading || paymentSubmitting || !paymentTournament}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-black text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {paymentSubmitting && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  {paymentSubmitting ? 'Đang nộp...' : 'Nộp lệ phí'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
