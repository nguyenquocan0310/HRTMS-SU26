import React from 'react';

interface RaceStatusBadgeProps {
  status: 'PendingConf' | 'Confirmed' | 'Cancelled' | 'Disqualified';
}

const RaceStatusBadge: React.FC<RaceStatusBadgeProps> = ({ status }) => {
  const getStatusStyles = (status: RaceStatusBadgeProps['status']): string => {
    switch (status) {
      case 'PendingConf':
        return 'bg-yellow-100 text-yellow-800';
      case 'Confirmed':
        return 'bg-green-100 text-green-800';
      case 'Cancelled':
        return 'bg-gray-100 text-gray-800';
      case 'Disqualified':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: RaceStatusBadgeProps['status']): string => {
    switch (status) {
      case 'PendingConf':
        return 'Chờ xác nhận';
      case 'Confirmed':
        return 'Đã xác nhận';
      case 'Cancelled':
        return 'Đã hủy';
      case 'Disqualified':
        return 'Bị loại';
      default:
        return status;
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusStyles(status)}`}>
      {getStatusLabel(status)}
    </span>
  );
};

export default RaceStatusBadge;
