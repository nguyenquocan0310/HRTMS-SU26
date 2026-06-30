import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Horse } from '../../types/owner.types';
import HorseCard from '../../components/owner/HorseCard';
import { getMyHorses } from '../../services/ownerService';

const MyHorses: React.FC = () => {
  const navigate = useNavigate();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHorses = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMyHorses();
        if (data && data.length > 0) {
          setHorses(data);
        } else {
          setHorses([]);
          setError('Không có ngựa');
        }
      } catch (err) {
        console.error('Lỗi khi tải danh sách ngựa:', err);
        setHorses([]);
        setError('Không có ngựa');
      } finally {
        setLoading(false);
      }
    };
    fetchHorses();
  }, []);

  const handleViewDetail = (horseID: string) => {
    navigate(`/owner/horses/${horseID}`);
  };

  const handleRegisterHorse = () => {
    navigate('/owner/horses/register');
  };

  // Loading state
  if (loading) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ngựa của tôi</h1>
            <p className="text-sm text-gray-500 mt-0.5">Danh sách ngựa đã đăng ký</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
              <div className="flex justify-between mb-3">
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-100 rounded-full w-16" />
              </div>
              <div className="space-y-2">
                {[...Array(4)].map((_, j) => <div key={j} className="h-3 bg-gray-100 rounded" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty / error state
  if (error || horses.length === 0) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ngựa của tôi</h1>
            <p className="text-sm text-gray-500 mt-0.5">Danh sách ngựa đã đăng ký</p>
          </div>
          <button
            onClick={handleRegisterHorse}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            + Đăng ký ngựa
          </button>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
          <p className="text-4xl mb-3">🐴</p>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            {error || 'Chưa có ngựa nào'}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Đăng ký ngựa để bắt đầu tham gia giải đua.
          </p>
          <button
            onClick={handleRegisterHorse}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Đăng ký ngựa đầu tiên
          </button>
        </div>
      </div>
    );
  }

  // Horse list
  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">Ngựa của tôi</h1>
          <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">
            {horses.length}
          </span>
        </div>
        <button
          onClick={handleRegisterHorse}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          + Đăng ký ngựa mới
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.isArray(horses) && horses.map((horse) => (
          <HorseCard
            key={horse.horseID}
            horse={horse}
            onViewDetail={handleViewDetail}
          />
        ))}
      </div>
    </div>
  );
};

export default MyHorses;
