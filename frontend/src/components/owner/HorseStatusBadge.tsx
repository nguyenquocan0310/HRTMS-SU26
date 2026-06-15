import React from 'react';

interface HorseStatusBadgeProps {
  status: 'Pending' | 'Approved' | 'Rejected';
}

const HorseStatusBadge: React.FC<HorseStatusBadgeProps> = ({ status }) => {
  const getStatusStyles = (status: HorseStatusBadgeProps['status']): string => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStyle()}`}>
      {status}
    </span>
  );
};

export default HorseStatusBadge;