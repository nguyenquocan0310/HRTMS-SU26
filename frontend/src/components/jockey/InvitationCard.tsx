import React from 'react';
import type { RaceInvitation } from '../../types/jockey.types';

interface InvitationCardProps {
  invitation: RaceInvitation;
  /** True when an API call for this card is in-flight (disables buttons) */
  actionLoading?: boolean;
  onAccept: (invitationID: string) => void;
  onDecline: (invitationID: string) => void;
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  Pending:   { label: 'Chờ phản hồi',         cls: 'bg-yellow-100 text-yellow-800' },
  Accepted:  { label: 'Đã chấp nhận',          cls: 'bg-blue-100 text-blue-800'    },
  Confirmed: { label: 'Đã xác nhận ghép cặp',  cls: 'bg-green-100 text-green-800'  },
  Declined:  { label: 'Đã từ chối',             cls: 'bg-red-100 text-red-800'      },
  Cancelled: { label: 'Đã hủy',                 cls: 'bg-gray-100 text-gray-600'    },
};

const InvitationCard: React.FC<InvitationCardProps> = ({
  invitation,
  actionLoading = false,
  onAccept,
  onDecline,
}) => {
  const cfg = STATUS_CFG[invitation.status] ?? {
    label: invitation.status,
    cls: 'bg-gray-100 text-gray-800',
  };

  const showResponseTime =
    invitation.status === 'Accepted' ||
    invitation.status === 'Confirmed' ||
    invitation.status === 'Declined' ||
    invitation.status === 'Cancelled';

  return (
    <div className="border border-gray-200 rounded-lg shadow-sm p-4 bg-white hover:shadow-md transition-shadow">
      {/* Tên ngựa */}
      <h3 className="font-bold text-lg mb-3">{invitation.horseName}</h3>

      {/* Thông tin chi tiết */}
      <div className="text-sm text-gray-700 mb-4 space-y-2">
        <p>
          <span className="font-medium">Chủ ngựa:</span> {invitation.ownerName}
        </p>
        <p>
          <span className="font-medium">Giống ngựa:</span> {invitation.breedCode}
        </p>
        {invitation.raceScheduledTime && (
          <p>
            <span className="font-medium">Giờ dự kiến:</span>{' '}
            {new Date(invitation.raceScheduledTime).toLocaleString('vi-VN')}
          </p>
        )}
        {invitation.raceID && invitation.raceID !== 'N/A' && (
          <p>
            <span className="font-medium">Mã cuộc đua:</span> {invitation.raceID}
          </p>
        )}
        {invitation.requestMessage && (
          <p>
            <span className="font-medium">Lời nhắn:</span> {invitation.requestMessage}
          </p>
        )}
      </div>

      {/* Badge trạng thái */}
      <div className="mb-4">
        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${cfg.cls}`}>
          {cfg.label}
        </span>
      </div>

      {/* Nút hành động — chỉ hiển thị khi Pending */}
      {invitation.status === 'Pending' && (
        <div className="flex gap-3">
          <button
            onClick={() => onAccept(invitation.invitationID)}
            disabled={actionLoading}
            className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {actionLoading && (
              <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
            )}
            Chấp nhận
          </button>
          <button
            onClick={() => onDecline(invitation.invitationID)}
            disabled={actionLoading}
            className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {actionLoading && (
              <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
            )}
            Từ chối
          </button>
        </div>
      )}

      {/* Thời gian phản hồi */}
      {showResponseTime && (
        <div className="text-sm text-gray-600">
          <p>
            <span className="font-medium">Phản hồi lúc:</span>{' '}
            {invitation.respondedAt
              ? new Date(invitation.respondedAt).toLocaleString('vi-VN')
              : 'Chưa có'}
          </p>
        </div>
      )}
    </div>
  );
};

export default InvitationCard;
