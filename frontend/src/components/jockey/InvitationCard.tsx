import type { RaceInvitation } from '../../types/jockey.types';

interface InvitationCardProps {
  invitation: RaceInvitation;
  actionLoading?: boolean;
  onAccept: (invitationID: string) => void;
  onDecline: (invitationID: string) => void;
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  Pending: { label: 'Chờ phản hồi', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  Accepted: { label: 'Đã chấp nhận', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  Confirmed: { label: 'Đã xác nhận ghép cặp', cls: 'bg-green-50 text-green-700 border-green-200' },
  Declined: { label: 'Đã từ chối', cls: 'bg-red-50 text-red-700 border-red-200' },
  Cancelled: { label: 'Đã hủy', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
};

export default function InvitationCard({
  invitation,
  actionLoading = false,
  onAccept,
  onDecline,
}: InvitationCardProps) {
  const cfg = STATUS_CFG[invitation.status] ?? {
    label: invitation.status,
    cls: 'bg-gray-50 text-gray-700 border-gray-200',
  };

  const showResponseTime = ['Accepted', 'Confirmed', 'Declined', 'Cancelled'].includes(invitation.status);

  return (
    <div className="border border-gray-200 rounded-lg shadow-sm p-4 bg-white hover:border-blue-100 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 text-base">{invitation.horseName}</h3>
          <p className="text-xs text-gray-500 mt-1">{invitation.breedCode}</p>
        </div>
        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${cfg.cls}`}>
          {cfg.label}
        </span>
      </div>

      <dl className="text-sm text-gray-700 space-y-2 mb-4">
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500">Chủ ngựa</dt>
          <dd className="font-medium text-gray-900 text-right">{invitation.ownerName}</dd>
        </div>
        {invitation.raceScheduledTime && (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Giờ dự kiến</dt>
            <dd className="font-medium text-gray-900 text-right">
              {new Date(invitation.raceScheduledTime).toLocaleString('vi-VN')}
            </dd>
          </div>
        )}
        {invitation.raceID && invitation.raceID !== 'N/A' && (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Mã cuộc đua</dt>
            <dd className="font-medium text-gray-900 text-right">{invitation.raceID}</dd>
          </div>
        )}
        {invitation.requestMessage && (
          <div>
            <dt className="text-gray-500 mb-1">Lời nhắn</dt>
            <dd className="text-gray-800 bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
              {invitation.requestMessage}
            </dd>
          </div>
        )}
      </dl>

      {invitation.status === 'Pending' && (
        <div className="flex gap-2">
          <button
            onClick={() => onAccept(invitation.invitationID)}
            disabled={actionLoading}
            className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 px-3 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {actionLoading && <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />}
            Chấp nhận
          </button>
          <button
            onClick={() => onDecline(invitation.invitationID)}
            disabled={actionLoading}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-sm font-semibold py-2 px-3 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {actionLoading && <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-red-500 border-t-transparent" />}
            Từ chối
          </button>
        </div>
      )}

      {showResponseTime && (
        <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
          Phản hồi lúc:{' '}
          <span className="font-medium text-gray-700">
            {invitation.respondedAt ? new Date(invitation.respondedAt).toLocaleString('vi-VN') : 'Chưa có'}
          </span>
        </p>
      )}
    </div>
  );
}
