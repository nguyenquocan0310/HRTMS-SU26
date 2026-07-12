import { useState, useEffect } from 'react';
import type { JockeyInvitation, Horse } from '../../types/owner.types';
import { cancelPairing, getAvailableJockeys, getMyHorses, getOwnerPairings, inviteJockey, confirmPairing } from '../../services/ownerService';
import { getMyTournamentParticipations, type ParticipationResponse } from '../../services/tournamentService';

const PAIRING_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  Pending:   { label: 'Chờ xác nhận',          cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  Accepted:  { label: 'Chờ xác nhận',          cls: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-500' },
  Confirmed: { label: 'Đã xác nhận ghép cặp',  cls: 'bg-green-50 text-green-700 border-green-200',    dot: 'bg-green-500' },
  Declined:  { label: 'Bị từ chối',            cls: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-500' },
  Cancelled: { label: 'Đã hủy',                cls: 'bg-gray-50 text-gray-500 border-gray-200',       dot: 'bg-gray-400' },
};

const JOCKEY_RESPONSE: Record<string, { label: string; cls: string; dot: string }> = {
  Pending:   { label: 'Chờ phản hồi',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  Accepted:  { label: 'Đã chấp nhận',   cls: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-500' },
  Confirmed: { label: 'Đã chấp nhận',   cls: 'bg-green-50 text-green-700 border-green-200',    dot: 'bg-green-500' },
  Declined:  { label: 'Đã từ chối',     cls: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-500' },
  Cancelled: { label: 'Đã hủy',         cls: 'bg-gray-50 text-gray-500 border-gray-200',       dot: 'bg-gray-400' },
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

export default function JockeyInvite() {
  const [invitations, setInvitations] = useState<JockeyInvitation[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [jockeyName, setJockeyName] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [error, setError] = useState('');
  const [availableJockeys, setAvailableJockeys] = useState<any[]>([]);
  const [loadingJockeys, setLoadingJockeys] = useState(false);
  const [selectedJockeyId, setSelectedJockeyId] = useState('');
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loadingHorses, setLoadingHorses] = useState(false);
  const [selectedHorseId, setSelectedHorseId] = useState('');
  const [filterHorseId, setFilterHorseId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'history'>('available');
  // Track which pairing is being confirmed (shows spinner on that row only)
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);

  // ── Tournament picker state ──────────────────────────────────────────────────
  const [approvedTournaments, setApprovedTournaments] = useState<ParticipationResponse[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(false);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);

  const getHorseNameById = (horseID?: string, horseName?: string) => {
    if (!horseID) return 'Chưa gán ngựa';
    const found = horses.find(h => String(h.horseID || (h as any).id || (h as any).horseId) === String(horseID));
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

  // ── Fetch available jockeys whenever selectedTournamentId changes ────────────
  useEffect(() => {
    if (!selectedTournamentId) {
      setAvailableJockeys([]);
      return;
    }
    const fetchJockeys = async () => {
      try {
        setLoadingJockeys(true);
        const data = await getAvailableJockeys(selectedTournamentId, 1, 20);
        setAvailableJockeys(data);
      } catch (err) {
        console.error('Failed to fetch available jockeys:', err);
        setAvailableJockeys([]);
      } finally {
        setLoadingJockeys(false);
      }
    };
    fetchJockeys();
  }, [selectedTournamentId]);

  useEffect(() => {
    const fetchInvitations = async () => {
      try {
        setLoadingInvitations(true);
        const data = await getOwnerPairings(filterStatus, filterHorseId);

        // Map the backend pairings to our UI JockeyInvitation format
        const mapped: JockeyInvitation[] = data.map((item: any) => {
          return {
            invitationID: String(item.pairingId || item.pairingID || item.id || `inv-${Date.now()}-${Math.random()}`),
            raceID: item.raceId || item.raceID || item.requestMessage || 'N/A',
            ownerID: item.ownerId || item.ownerID || '',
            jockeyID: String(item.jockey?.jockeyId || item.jockeyId || item.jockeyID || ''),
            jockeyName: item.jockey?.fullName || item.jockeyName || item.jockey?.name || 'N/A',
            status: item.status || 'Pending',
            invitedAt: item.createdAt ? new Date(item.createdAt) : (item.invitedAt ? new Date(item.invitedAt) : new Date()),
            respondedAt: item.respondedAt ? new Date(item.respondedAt) : undefined,
            horseID: String(item.horse?.horseId || item.horseId || item.horseID || ''),
            horseName: item.horse?.name || '',
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
  }, [filterStatus, filterHorseId, refreshTrigger]);

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
      setSelectedHorseId('');
      setRequestMessage('');
      setShowModal(false);
      setRefreshTrigger((prev) => prev + 1);
      setActiveTab('history');
    } catch (err: any) {
      console.error('POST /api/pairings failed:', err);
      // Surface real backend message (apiFetch throws Error with BE message)
      const msg = err?.message || err?.response?.data?.message || 'Đã xảy ra lỗi khi gửi lời mời. Vui lòng thử lại.';
      setError(msg);
    } finally {
      setSending(false);
    }
  };


  const handleConfirmPairing = async (invitationID: string) => {
    setConfirmError(null);
    setConfirmSuccess(null);
    setConfirmingId(invitationID);
    try {
      await confirmPairing(invitationID);
      setConfirmSuccess('Xác nhận ghép cặp thành công!');
      // Optimistically update local state so UI responds immediately
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.invitationID === invitationID ? { ...inv, status: 'Confirmed' as const } : inv
        )
      );
      // Also trigger a full refetch to sync with backend
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      console.error('Failed to confirm pairing:', err);
      setConfirmError(err?.message || 'Đã xảy ra lỗi khi xác nhận ghép cặp. Vui lòng thử lại.');
    } finally {
      setConfirmingId(null);
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
          onClick={() => {
            setSelectedJockeyId('');
            setJockeyName('');
            setShowModal(true);
          }}
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
              onClick={() => setActiveTab(tab.key as 'available' | 'history')}
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
                    const jId = String(j.jockeyId || j.jockeyID || j.id || '');
                    return (
                      <tr key={jId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">{j.fullName || 'N/A'}</td>
                        <td className="px-4 py-3 text-gray-600">{j.licenseCertificate || 'N/A'}</td>
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
                            onClick={() => {
                              setSelectedJockeyId(jId);
                              setJockeyName(j.fullName || '');
                              setShowModal(true);
                            }}
                            className="px-3.5 py-2 text-xs font-bold text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors"
                          >
                            Mời tham gia
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
                  const hId = String(h.horseID || (h as any).id || (h as any).horseId || '');
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
                      const isConfirming = confirmingId === invitation.invitationID;
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
                            {invitation.status === 'Accepted' || canCancel ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {invitation.status === 'Accepted' && (
                                  <button
                                    onClick={() => handleConfirmPairing(invitation.invitationID)}
                                    disabled={isConfirming || isCancelling}
                                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isConfirming && (
                                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    )}
                                    {isConfirming ? 'Đang xác nhận...' : 'Xác nhận ghép cặp'}
                                  </button>
                                )}
                                {canCancel && (
                                  <button
                                    onClick={() => handleCancelPairing(invitation.invitationID)}
                                    disabled={isConfirming || isCancelling}
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
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Gửi lời mời cho jockey</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setError('');
                  setJockeyName('');
                  setSelectedJockeyId('');
                  setSelectedHorseId('');
                  setRequestMessage('');
                }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
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
                        String(j.jockeyId || j.jockeyID || j.id) === targetId
                      );
                      if (jockeyObj) {
                        setJockeyName(jockeyObj.fullName || jockeyObj.jockeyName || jockeyObj.name || '');
                      } else {
                        setJockeyName('');
                      }
                    }}
                    className={inputCls}
                  >
                    <option value="">— Chọn Jockey —</option>
                    {availableJockeys.map((j) => {
                      const idVal = String(j.jockeyId || j.jockeyID || j.id || '');
                      const nameVal = j.fullName || j.name || j.jockeyName || 'Jockey không tên';
                      const licVal = j.licenseCertificate || j.licenseNumber ? ` (GPLX: ${j.licenseCertificate || j.licenseNumber})` : '';
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
                    {horses.map((h) => {
                      const hId = h.horseID || (h as any).id || (h as any).horseId || '';
                      return (
                        <option key={hId} value={hId}>
                          {h.name} (ID: {hId})
                        </option>
                      );
                    })}
                  </select>
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
                onClick={() => {
                  setShowModal(false);
                  setError('');
                  setJockeyName('');
                  setSelectedJockeyId('');
                  setSelectedHorseId('');
                  setRequestMessage('');
                }}
                disabled={sending}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button
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
      )}
    </div>
  );
}
