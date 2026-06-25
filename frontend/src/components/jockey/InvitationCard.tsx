import React from 'react';
import type { RaceInvitation } from '../../types/jockey.types';

interface InvitationCardProps {
  invitation: RaceInvitation;
  onAccept: (invitationID: string) => void;
  onDecline: (invitationID: string) => void;
}

const InvitationCard: React.FC<InvitationCardProps> = ({
  invitation,
  onAccept,
  onDecline,
}) => {
  const getStatusBadgeColor = (status: RaceInvitation['status']): string => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Accepted':
        return 'bg-green-100 text-green-800';
      case 'Declined':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: RaceInvitation['status']): string => {
    switch (status) {
      case 'Pending':
        return 'Chờ phản hồi';
      case 'Accepted':
        return 'Đã chấp nhận';
      case 'Declined':
        return 'Đã từ chối';
      default:
        return status;
    }
  };

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
        {invitation.raceID && (
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
        <span
          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
            invitation.status
          )}`}
        >
          {getStatusLabel(invitation.status)}
        </span>
      </div>

      {/* Nút hành động — chỉ hiển thị khi Chờ phản hồi */}
      {invitation.status === 'Pending' && (
        <div className="flex gap-3">
          <button
            onClick={() => onAccept(invitation.invitationID)}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Chấp nhận
          </button>
          <button
            onClick={() => onDecline(invitation.invitationID)}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Từ chối
          </button>
        </div>
      )}

      {/* Hiển thị thời gian phản hồi cho Accepted/Declined */}
      {(invitation.status === 'Accepted' || invitation.status === 'Declined') && (
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
