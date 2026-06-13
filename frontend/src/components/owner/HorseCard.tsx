import React from 'react';
import { Horse } from '../../types/owner.types';
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

  return (
    <div className="border rounded-lg shadow-sm p-4 bg-white hover:shadow-md transition-shadow">
      {/* Horse Name */}
      <h3 className="font-bold text-lg mb-2">{horse.name}</h3>

      {/* Horse Details */}
      <div className="text-sm text-gray-700 mb-3 space-y-1">
        <p>
          <span className="font-medium">Breed Code:</span> {horse.breedCode}
        </p>
        <p>
          <span className="font-medium">Gender:</span> {horse.gender}
        </p>
        <p>
          <span className="font-medium">Age:</span> {age} years
        </p>
      </div>

      {/* Doping Test Result */}
      <div className="mb-3">
        <p>
          <span className="font-medium text-sm text-gray-700">Doping Test:</span>{' '}
          <span className={`font-medium ${getDopingTextColor(horse.dopingTestResult)}`}>
            {horse.dopingTestResult}
          </span>
        </p>
      </div>

      {/* Status Badge */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-gray-700 font-medium">Status:</span>
        <HorseStatusBadge status={horse.status} />
      </div>

      {/* View Detail Button */}
      <button
        onClick={() => onViewDetail(horse.horseID)}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
      >
        Xem chi tiết
      </button>
    </div>
  );
};

export default HorseCard;