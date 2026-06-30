import React from 'react';

interface HorseStatusBadgeProps {
  status: 'Pending' | 'Approved' | 'Rejected' | string;
}

const STATUS_MAP: Record<string, { label: string; cls: string; dot: string }> = {
  Approved:   { label: 'Đã duyệt',   cls: 'bg-green-50 text-green-700 border-green-200',  dot: 'bg-green-500'  },
  Pending:    { label: 'Chờ duyệt',  cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  Rejected:   { label: 'Từ chối',    cls: 'bg-red-50 text-red-700 border-red-200',         dot: 'bg-red-500'    },
  ManualReview: { label: 'Xét duyệt thủ công', cls: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  AutoEligible: { label: 'Tự duyệt', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  AutoRejected: { label: 'Tự từ chối', cls: 'bg-red-50 text-red-700 border-red-200',       dot: 'bg-red-500'    },
};

const HorseStatusBadge: React.FC<HorseStatusBadgeProps> = ({ status }) => {
  const cfg = STATUS_MAP[status] ?? {
    label: status,
    cls: 'bg-gray-50 text-gray-600 border-gray-200',
    dot: 'bg-gray-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border ${cfg.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

export default HorseStatusBadge;