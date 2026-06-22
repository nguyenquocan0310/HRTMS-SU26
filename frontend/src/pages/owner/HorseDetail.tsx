import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Horse } from '../../types/owner.types';
import HorseStatusBadge from '../../components/owner/HorseStatusBadge';
import { getHorseById } from '../../services/ownerService';

// Dữ liệu mẫu làm fallback
const mockHorses: Horse[] = [
  {
    name: 'Thunder Storm', birthYear: 2019, gender: 'Stallion',
    color: 'Bay', dopingTestResult: 'Clean',
    status: 'Approved', breed: 'THO', vaccinationRecordRef: 'VAC-001',
    weight: 450, identifyingMarks: 'Vết bớt trắng ở trán', legalConsentAccepted: true,
    horseID: 'H001', ownerID: 'O001', createdAt: new Date()
  },
  {
    name: 'Golden Arrow', birthYear: 2020, gender: 'Filly',
    color: 'Chestnut', dopingTestResult: 'Pending',
    status: 'Pending', breed: 'ARAB', vaccinationRecordRef: 'VAC-002',
    weight: 420, identifyingMarks: 'Không có', legalConsentAccepted: true,
    horseID: 'H002', ownerID: 'O001', createdAt: new Date()
  },
  {
    name: 'Dark Knight', birthYear: 2018, gender: 'Colt',
    color: 'Black', dopingTestResult: 'Failed',
    status: 'Rejected', breed: 'THO', vaccinationRecordRef: 'VAC-003',
    weight: 480, identifyingMarks: 'Vết sẹo ở cổ', legalConsentAccepted: true,
    rejectionReason: 'Kết quả xét nghiệm doping không hợp lệ',
    horseID: 'H003', ownerID: 'O001', createdAt: new Date()
  }
];

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

export default function HorseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [horse, setHorse] = useState<Horse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHorse = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const horseIdNum = Number(id);
        if (!isNaN(horseIdNum)) {
          const data = await getHorseById(horseIdNum);
          setHorse(data);
        } else {
          // If ID is a string (e.g. H001 in mock), use fallback
          const mock = mockHorses.find((h) => h.horseID === id);
          if (mock) {
            setHorse(mock);
          } else {
            setError('Không tìm thấy thông tin ngựa');
          }
        }
      } catch (err) {
        console.warn(`Lỗi khi tải chi tiết ngựa ID ${id} từ API, dùng dữ liệu mẫu làm fallback:`, err);
        const mock = mockHorses.find((h) => h.horseID === id);
        if (mock) {
          setHorse(mock);
        } else {
          setError('Không tìm thấy thông tin ngựa');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchHorse();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4 animate-duration-500"></div>
          <p className="text-gray-600 text-lg">Đang tải chi tiết ngựa...</p>
        </div>
      </div>
    );
  }

  if (error || !horse) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {error || 'Không tìm thấy ngựa'}
          </h2>
          <button
            onClick={() => navigate('/owner/horses')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

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
        return result || 'Chưa kiểm tra';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Nút quay lại */}
        <button
          onClick={() => navigate('/owner/horses')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-6 transition-colors"
        >
          ← Quay lại
        </button>

        {/* Khung thông tin chi tiết */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
          {/* Tiêu đề */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              {horse.name}
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 font-medium">Trạng thái:</span>
              <HorseStatusBadge status={(horse.status as 'Approved' | 'Pending' | 'Rejected') || 'Pending'} />
            </div>
          </div>

          {/* Thông báo lý do từ chối */}
          {horse.status === 'Rejected' && horse.rejectionReason && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-red-800 font-semibold mb-2">Lý do từ chối</h3>
              <p className="text-red-700">{horse.rejectionReason}</p>
            </div>
          )}

          {/* Bảng thông tin ngựa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Mã giống */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-1">Giống ngựa</p>
              <p className="text-lg font-semibold text-gray-800">
                {horse.breed}
              </p>
            </div>

            {/* Giới tính */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-1">Giới tính</p>
              <p className="text-lg font-semibold text-gray-800">
                {getGenderLabel(horse.gender)}
              </p>
            </div>

            {/* Tuổi */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-1">Tuổi</p>
              <p className="text-lg font-semibold text-gray-800">{age} tuổi</p>
            </div>

            {/* Năm sinh */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-1">Năm sinh</p>
              <p className="text-lg font-semibold text-gray-800">
                {horse.birthYear}
              </p>
            </div>

            {/* Màu sắc */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-1">Màu sắc</p>
              <p className="text-lg font-semibold text-gray-800">
                {horse.color}
              </p>
            </div>

            {/* Kết quả kiểm tra doping */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-1">
                Kiểm tra doping
              </p>
              <p
                className={`text-lg font-semibold ${getDopingTextColor(
                  horse.dopingTestResult
                )}`}
              >
                {getDopingLabel(horse.dopingTestResult)}
              </p>
            </div>

            {/* Hồ sơ tiêm chủng */}
            {horse.vaccinationRecordRef && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 font-medium mb-1">
                  Hồ sơ tiêm chủng
                </p>
                <p className="text-lg font-semibold text-gray-800">
                  {horse.vaccinationRecordRef}
                </p>
              </div>
            )}

            {/* Ngày xét nghiệm */}
            {horse.dopingTestDate && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 font-medium mb-1">
                  Ngày xét nghiệm
                </p>
                <p className="text-lg font-semibold text-gray-800">
                  {new Date(horse.dopingTestDate).toLocaleDateString('vi-VN')}
                </p>
              </div>
            )}

            {/* Ngày đăng ký */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-1">
                Ngày đăng ký
              </p>
              <p className="text-lg font-semibold text-gray-800">
                {horse.createdAt ? new Date(horse.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
              </p>
            </div>
          </div>

          {/* Nút hành động */}
          <div className="flex gap-4 justify-end">
            <button
              onClick={() => navigate('/owner/horses')}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Quay lại
            </button>
            <button
              onClick={() => navigate(`/owner/horses/edit/${horse.horseID || (horse as any).horseId || id || ''}`)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Cập nhật thông tin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

