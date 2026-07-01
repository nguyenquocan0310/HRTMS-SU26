import React from 'react';
import type { Horse } from '../../types/owner.types';
import HorseStatusBadge from './HorseStatusBadge';

interface HorseCardProps {
  horse: Horse;
  onViewDetail: (horseID: string) => void;
}

const getDopingLabel = (result: Horse['dopingTestResult']): string => {
  switch (result) {
    case 'Clean':   return 'Âm tính';
    case 'Pending': return 'Chờ duyệt';
    case 'Failed':  return 'Dương tính';
    default:        return result || '—';
  }
};

const getDopingColor = (result: Horse['dopingTestResult']): string => {
  switch (result) {
    case 'Clean':   return 'text-green-600';
    case 'Pending': return 'text-yellow-600';
    case 'Failed':  return 'text-red-600';
    default:        return 'text-gray-500';
  }
};

const getGenderLabel = (gender: Horse['gender']): string => {
  switch (gender) {
    case 'Male': case 'male':       return 'Đực';
    case 'Female': case 'female':   return 'Cái';
    case 'Gelding': case 'gelding': return 'Thiến';
    case 'Stallion': return 'Đực (trưởng thành)';
    case 'Colt':     return 'Đực (non)';
    case 'Mare':     return 'Cái (trưởng thành)';
    case 'Filly':    return 'Cái (non)';
    default:         return gender;
  }
};

const HorseCard: React.FC<HorseCardProps> = ({ horse, onViewDetail }) => {
  const age = new Date().getFullYear() - horse.birthYear;

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Giống',    value: horse.breed || (horse as any).breedCode || '—' },
    { label: 'Giới tính', value: getGenderLabel(horse.gender) },
    { label: 'Tuổi',     value: `${age} tuổi` },
    {
      label: 'Doping',
      value: (
        <span className={`font-medium ${getDopingColor(horse.dopingTestResult || '')}`}>
          {getDopingLabel(horse.dopingTestResult || '')}
        </span>
      ),
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all">
      {/* Card header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-900 leading-tight">{horse.name}</h3>
        <HorseStatusBadge
          status={horse.status || (horse as any).adminApprovalStatus || 'Pending'}
        />
      </div>

      {/* Data rows */}
      <div className="px-4 py-3 space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{row.label}</span>
            <span className="text-gray-800 font-medium">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Action */}
      <div className="px-4 pb-3">
        <button
          onClick={() => onViewDetail(String(horse.horseID || (horse as any).horseId))}
          className="w-full text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 py-1.5 rounded transition-colors"
        >
          Xem chi tiết
        </button>
      </div>
    </div>
  );
};

export default HorseCard;
