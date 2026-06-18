import React, { useState, useEffect } from 'react';
import type { RaceInvitation } from '../../types/jockey.types';
import InvitationCard from '../../components/jockey/InvitationCard';

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
    status: 'Accept',
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
    status: 'Decline',
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
    // Mô phỏng tải dữ liệu
    setTimeout(() => {
      setInvitations(mockInvitations);
      setLoading(false);
    }, 500);
  }, []);

  const handleAccept = (invitationID: string) => {
    setInvitations((prev) =>
      prev.map((inv) =>
        inv.invitationID === invitationID
          ? {
              ...inv,
              status: 'Accept' as const,
              respondedAt: new Date().toISOString(),
            }
          : inv
      )
    );
  };

  const handleDecline = (invitationID: string) => {
    const confirmed = window.confirm(
      'Bạn có chắc chắn muốn từ chối lời mời này không?'
    );

    if (confirmed) {
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.invitationID === invitationID
            ? {
                ...inv,
                status: 'Decline' as const,
                respondedAt: new Date().toISOString(),
              }
            : inv
        )
      );
      setDeclineConfirmID(null);
    }
  };

  const getFilteredInvitations = (): RaceInvitation[] => {
    switch (activeTab) {
      case 'pending':
        return invitations.filter((inv) => inv.status === 'Pending');
      case 'accepted':
        return invitations.filter((inv) => inv.status === 'Accept');
      case 'declined':
        return invitations.filter((inv) => inv.status === 'Decline');
      case 'all':
      default:
        return invitations;
    }
  };

  const filteredInvitations = getFilteredInvitations();

  // Trạng thái đang tải
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 text-lg">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Trạng thái rỗng
  if (invitations.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">📩</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Chưa có lời mời nào
          </h2>
          <p className="text-gray-600">
            Bạn sẽ nhận được lời mời từ các chủ ngựa sắp tới.
          </p>
        </div>
      </div>
    );
  }

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
            Đã chấp nhận ({invitations.filter((inv) => inv.status === 'Accept').length})
          </button>

          <button
            onClick={() => setActiveTab('declined')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'declined'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            Đã từ chối ({invitations.filter((inv) => inv.status === 'Decline').length})
          </button>
        </div>

        {/* Trạng thái rỗng sau lọc */}
        {filteredInvitations.length === 0 ? (
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
