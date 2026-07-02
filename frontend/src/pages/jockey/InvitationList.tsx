import React, { useState, useEffect, useCallback } from 'react';
import type { RaceInvitation } from '../../types/jockey.types';
import InvitationCard from '../../components/jockey/InvitationCard';
import { getMyInvitations, acceptPairing, declinePairing } from '../../services/jockeyService';

type FilterTab = 'all' | 'pending' | 'accepted' | 'declined';

export default function InvitationList() {
  const [invitations, setInvitations] = useState<RaceInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  // Per-row action loading (keyed by invitationID)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Inline feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Decline modal state
  const [declineTarget, setDeclineTarget] = useState<string | null>(null); // invitationID
  const [declineReason, setDeclineReason] = useState('');

  const fetchInvitations = useCallback(async () => {
    try {
      setLoading(true);
      setFeedback(null);
      const data = await getMyInvitations(undefined);
      const mapped: RaceInvitation[] = data.map((item: any) => ({
        invitationID: String(item.pairingId || item.id || `inv-${Date.now()}-${Math.random()}`),
        raceID: item.raceId || 'N/A',
        ownerID: String(item.owner?.ownerId || ''),
        ownerName: item.owner?.fullName || 'N/A',
        horseName: item.horse?.name || 'N/A',
        breedCode: item.horse?.breed || 'N/A',
        raceScheduledTime: item.raceScheduledTime || '',
        status: item.status || 'Pending',
        invitedAt: item.createdAt || '',
        respondedAt: item.respondedAt || undefined,
        requestMessage: item.requestMessage || '',
      }));
      setInvitations(mapped);
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
      setFeedback({ type: 'error', msg: 'Không tải được danh sách lời mời.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // ── Accept ────────────────────────────────────────────────────────────────────
  const handleAccept = async (invitationID: string) => {
    setActionLoadingId(invitationID);
    setFeedback(null);
    try {
      await acceptPairing(invitationID);
      setFeedback({ type: 'success', msg: 'Đã chấp nhận lời mời thành công!' });
      // Optimistic update
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.invitationID === invitationID
            ? { ...inv, status: 'Accepted' as const, respondedAt: new Date().toISOString() }
            : inv
        )
      );
      // Sync with backend
      fetchInvitations();
    } catch (err: any) {
      console.error('Failed to accept invitation:', err);
      setFeedback({ type: 'error', msg: err?.message || 'Đã xảy ra lỗi khi chấp nhận lời mời.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Decline (opens modal) ────────────────────────────────────────────────────
  const openDeclineModal = (invitationID: string) => {
    setDeclineReason('');
    setDeclineTarget(invitationID);
    setFeedback(null);
  };

  const handleDeclineConfirm = async () => {
    if (!declineTarget) return;
    const id = declineTarget;
    setDeclineTarget(null);
    setActionLoadingId(id);
    setFeedback(null);
    try {
      await declinePairing(id, declineReason.trim() || 'Jockey từ chối lời mời.');
      setFeedback({ type: 'success', msg: 'Đã từ chối lời mời.' });
      // Optimistic update
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.invitationID === id
            ? { ...inv, status: 'Declined' as const, respondedAt: new Date().toISOString() }
            : inv
        )
      );
      // Sync with backend
      fetchInvitations();
    } catch (err: any) {
      console.error('Failed to decline invitation:', err);
      setFeedback({ type: 'error', msg: err?.message || 'Đã xảy ra lỗi khi từ chối lời mời.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // ── Filter ────────────────────────────────────────────────────────────────────
  const getFilteredInvitations = (): RaceInvitation[] => {
    switch (activeTab) {
      case 'pending':  return invitations.filter((inv) => inv.status === 'Pending');
      case 'accepted': return invitations.filter((inv) => inv.status === 'Accepted' || inv.status === 'Confirmed');
      case 'declined': return invitations.filter((inv) => inv.status === 'Declined' || inv.status === 'Cancelled');
      default:         return invitations;
    }
  };

  const filteredInvitations = getFilteredInvitations();

  const pendingCount   = invitations.filter((inv) => inv.status === 'Pending').length;
  const acceptedCount  = invitations.filter((inv) => inv.status === 'Accepted' || inv.status === 'Confirmed').length;
  const declinedCount  = invitations.filter((inv) => inv.status === 'Declined' || inv.status === 'Cancelled').length;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Tiêu đề */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Lời mời tham gia</h1>
          <p className="text-gray-600">Quản lý các lời mời tham gia cuộc đua từ các chủ ngựa</p>
        </div>

        {/* Feedback banner */}
        {feedback && (
          <div className={`mb-5 flex items-center justify-between rounded-lg px-4 py-3 border ${
            feedback.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <p className="text-sm font-medium">{feedback.msg}</p>
            <button onClick={() => setFeedback(null)} className="text-lg leading-none opacity-60 hover:opacity-100">×</button>
          </div>
        )}

        {/* Tab lọc */}
        <div className="mb-8 flex gap-4 border-b border-gray-200">
          {([
            { key: 'all',      label: `Tất cả (${invitations.length})` },
            { key: 'pending',  label: `Chờ phản hồi (${pendingCount})` },
            { key: 'accepted', label: `Đã chấp nhận (${acceptedCount})` },
            { key: 'declined', label: `Đã từ chối (${declinedCount})` },
          ] as { key: FilterTab; label: string }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
            <p className="text-gray-600 text-lg">Đang tải danh sách lời mời...</p>
          </div>
        ) : filteredInvitations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">Không có lời mời nào trong mục này.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInvitations.map((invitation) => (
              <InvitationCard
                key={invitation.invitationID}
                invitation={invitation}
                actionLoading={actionLoadingId === invitation.invitationID}
                onAccept={handleAccept}
                onDecline={openDeclineModal}
              />
            ))}
          </div>
        )}
      </div>

      {/* Decline reason modal */}
      {declineTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Từ chối lời mời</h3>
              <button
                onClick={() => setDeclineTarget(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-gray-600">Bạn có chắc chắn muốn từ chối lời mời này không?</p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Lý do từ chối (tùy chọn)
                </label>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Nhập lý do từ chối (để trống sẽ dùng lý do mặc định)"
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none resize-none transition-all"
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => setDeclineTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDeclineConfirm}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
