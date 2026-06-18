import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Horse } from '../../types/owner.types';
import HorseCard from '../../components/owner/HorseCard';

const MyHorses: React.FC = () => {
  const navigate = useNavigate();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHorses = async () => {
      try {
        setLoading(true);

        // Dữ liệu mẫu
        const mockData: Horse[] = [
          {
            horseID: 'H001', ownerID: 'O001', breedCode: 'THO',
            name: 'Thunder Storm', birthYear: 2019, gender: 'Stallion',
            color: 'Bay', dopingTestResult: 'Clean',
            status: 'Approved', createdAt: new Date()
          },
          {
            horseID: 'H002', ownerID: 'O001', breedCode: 'ARAB',
            name: 'Golden Arrow', birthYear: 2020, gender: 'Filly',
            color: 'Chestnut', dopingTestResult: 'Pending',
            status: 'Pending', createdAt: new Date()
          },
          {
            horseID: 'H003', ownerID: 'O001', breedCode: 'THO',
            name: 'Dark Knight', birthYear: 2018, gender: 'Colt',
            color: 'Black', dopingTestResult: 'Failed',
            status: 'Rejected', rejectionReason: 'Kết quả xét nghiệm doping không hợp lệ',
            createdAt: new Date()
          }
        ];

        setHorses(mockData);
      } catch (err) {
        setError('Không thể tải danh sách ngựa');
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

  // Trạng thái đang tải
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 text-lg">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Trạng thái lỗi
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">Lỗi</h3>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  // Trạng thái rỗng
  if (horses.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🐴</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Bạn chưa có ngựa nào
          </h2>
          <button
            onClick={handleRegisterHorse}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Đăng ký ngựa đầu tiên
          </button>
        </div>
      </div>
    );
  }

  // Danh sách ngựa
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-800">Ngựa của tôi</h1>
          <span className="bg-blue-100 text-blue-800 font-semibold py-1 px-3 rounded-full text-sm">
            {horses.length}
          </span>
        </div>
        <button
          onClick={handleRegisterHorse}
          className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
        >
          <span>+</span> Đăng ký ngựa mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
