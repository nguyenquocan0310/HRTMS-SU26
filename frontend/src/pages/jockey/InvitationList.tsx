import React, { useState, useEffect } from 'react';
import type { RaceInvitation } from '../../types/jockey.types';
import InvitationCard from '../../components/jockey/InvitationCard';
import { getMyInvitations, respondToInvitation, acceptPairing } from '../../services/jockeyService';

// Dữ liệu mẫu
const mockInvitations: RaceInvitation[] = [
  {
    invitationID: 'inv-001',
    raceID: 'race-001',
    ownerID: 'owner-001',
    ownerName: 'Nguyễn Văn A',
    horseName: 'Thunder Storm',
    breedCode: 'THO',
    raceScheduledTime: '2024-06-20T14:00:00',
    status: 'Pending',
    invitedAt: '2024-06-15T10:30:00',
  },
  {
    invitationID: 'inv-002',
    raceID: 'race-002',
    ownerID: 'owner-002',
    ownerName: 'Trần Thị B',
    horseName: 'Golden Arrow',
    breedCode: 'ARAB',
    raceScheduledTime: '2024-06-21T15:30:00',
    status: 'Accepted',
    invitedAt: '2024-06-14T09:00:00',
    respondedAt: '2024-06-15T11:00:00',
  },
  {
    invitationID: 'inv-003',
    raceID: 'race-003',
    ownerID: 'owner-003',
    ownerName: 'Lê Văn C',
    horseName: 'Dark Knight',
    breedCode: 'QUAR',
    raceScheduledTime: '2024-06-22T16:00:00',
    status: 'Declined',
    invitedAt: '2024-06-13T08:30:00',
    respondedAt: '2024-06-13T12:00:00',
  },
];

type FilterTab = 'all' | 'pending' | 'accepted' | 'declined';

export default function InvitationList() {
  const [invitations, setInvitations] = useState<RaceInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [declineConfirmID, setDeclineConfirmID] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvitations = async () => {
      try {
        setLoading(true);
        // Luôn fetch tất cả (không filter theo status) để count các tab luôn chính xác
        const data = await getMyInvitations(undefined);
        const mapped: RaceInvitation[] = data.map((item: any) => {
          return {
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
          };
        });
        setInvitations(mapped);
      } catch (err) {
        console.error('Failed to fetch invitations:', err);
      } finally {
        setLoading(false);
      }
    };

    // Chỉ fetch lại khi mount lần đầu, không fetch lại khi đổi tab
    fetchInvitations();
  }, []);

  const handleAccept = async (invitationID: string) => {
    try {
      const response = await acceptPairing(invitationID);
      alert(response.message || 'Pairing invitation accepted successfully.');
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.invitationID === invitationID
            ? {
                ...inv,
                status: 'Accepted' as const,
                respondedAt: new Date().toISOString(),
              }
            : inv
        )
      );
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      alert('Đã xảy ra lỗi khi chấp nhận lời mời');
    }
  };

  const handleDecline = async (invitationID: string) => {
    const confirmed = window.confirm(
      'Bạn có chắc chắn muốn từ chối lời mời này không?'
    );

    if (confirmed) {
      try {
        await respondToInvitation(invitationID, 'Declined');
        setInvitations((prev) =>
          prev.map((inv) =>
            inv.invitationID === invitationID
              ? {
                  ...inv,
                  status: 'Declined' as const,
                  respondedAt: new Date().toISOString(),
                }
              : inv
          )
        );
        setDeclineConfirmID(null);
      } catch (error) {
        console.error('Failed to decline invitation:', error);
        alert('Đã xảy ra lỗi khi từ chối lời mời');
      }
    }
  };

  const getFilteredInvitations = (): RaceInvitation[] => {
    switch (activeTab) {
      case 'pending':
        return invitations.filter((inv) => inv.status === 'Pending');
      case 'accepted':
        return invitations.filter((inv) => inv.status === 'Accepted');
      case 'declined':
        return invitations.filter((inv) => inv.status === 'Declined');
      case 'all':
      default:
        return invitations;
    }
  };

  const filteredInvitations = getFilteredInvitations();



  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Tiêu đề */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Lời mời tham gia
          </h1>
          <p className="text-gray-600">
            Quản lý các lời mời tham gia cuộc đua từ các chủ ngựa
          </p>
        </div>

        {/* Tab lọc */}
        <div className="mb-8 flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'all'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Tất cả ({invitations.length})
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'pending'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Chờ phản hồi ({invitations.filter((inv) => inv.status === 'Pending').length})
          </button>

          <button
            onClick={() => setActiveTab('accepted')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'accepted'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Đã chấp nhận ({invitations.filter((inv) => inv.status === 'Accepted').length})
          </button>

          <button
            onClick={() => setActiveTab('declined')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'declined'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Đã từ chối ({invitations.filter((inv) => inv.status === 'Declined').length})
          </button>
        </div>

        {/* Trạng thái đang tải theo tab, rỗng sau lọc, hoặc lưới danh sách */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 text-lg">Đang tải danh sách lời mời...</p>
          </div>
        ) : filteredInvitations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">
              Không có lời mời nào trong mục này.
            </p>
          </div>
        ) : (
          /* Lưới lời mời */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInvitations.map((invitation) => (
              <InvitationCard
                key={invitation.invitationID}
                invitation={invitation}
                onAccept={handleAccept}
                onDecline={handleDecline}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
