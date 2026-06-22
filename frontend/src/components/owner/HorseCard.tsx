
import React from 'react';
import type { Horse } from '../../types/owner.types';
import HorseStatusBadge from './HorseStatusBadge';

interface HorseCardProps {
  horse: Horse;
  onViewDetail: (horseID: string) => void;
}

const HorseCard: React.FC<HorseCardProps> = ({ horse, onViewDetail }) => {
  const age = new Date().getFullYear() - horse.birthYear;

  const getDopingTextColor = (result: Horse['dopingTestResult']): string => {
    switch (result) {
      case 'Clean':
        return 'text-green-600';
      case 'Pending':
        return 'text-yellow-600';
      case 'Failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getDopingLabel = (result: Horse['dopingTestResult']): string => {
    switch (result) {
      case 'Clean':
        return 'Âm tính';
      case 'Pending':
        return 'Chờ duyệt';
      case 'Failed':
        return 'Dương tính';
      default:
        return result;
    }
  };

  const getGenderLabel = (gender: Horse['gender']): string => {
    switch (gender) {
      case 'Male':
      case 'male':
        return 'Đực (Male)';
      case 'Female':
      case 'female':
        return 'Cái (Female)';
      case 'Gelding':
      case 'gelding':
        return 'Bị thiến (Gelding)';
      case 'Stallion':
        return 'Ngựa đực (trưởng thành)';
      case 'Colt':
        return 'Ngựa đực (non)';
      case 'Mare':
        return 'Ngựa cái (trưởng thành)';
      case 'Filly':
        return 'Ngựa cái (non)';
      default:
        return gender;
    }
  };

  return (
    <div className="border rounded-lg shadow-sm p-4 bg-white hover:shadow-md transition-shadow">
      {/* Tên ngựa */}
      <h3 className="font-bold text-lg mb-2">{horse.name}</h3>

      {/* Thông tin ngựa */}
      <div className="text-sm text-gray-700 mb-3 space-y-1">
        <p>
          <span className="font-medium">Giống ngựa:</span> {horse.breed || (horse as any).breedCode}
        </p>
        <p>
          <span className="font-medium">Giới tính:</span> {getGenderLabel(horse.gender)}
        </p>
        <p>
          <span className="font-medium">Tuổi:</span> {age} tuổi
        </p>
      </div>

      {/* Kết quả kiểm tra doping */}
      <div className="mb-3">
        <p>
          <span className="font-medium text-sm text-gray-700">Kiểm tra doping:</span>{' '}
          <span className={`font-medium ${getDopingTextColor(horse.dopingTestResult || '')}`}>
            {getDopingLabel(horse.dopingTestResult || '')}
          </span>
        </p>
      </div>

      {/* Badge trạng thái */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-gray-700 font-medium">Trạng thái:</span>
        <HorseStatusBadge status={horse.status || (horse as any).adminApprovalStatus || 'Pending'} />
      </div>

      {/* Nút xem chi tiết */}
      <button
        onClick={() => onViewDetail(String(horse.horseID || (horse as any).horseId))}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
      >
        Xem chi tiết
      </button>
    </div>
  );
};

export default HorseCard;
