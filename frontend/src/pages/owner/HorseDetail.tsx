import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Horse } from '../../types/owner.types';
import HorseStatusBadge from '../../components/owner/HorseStatusBadge';

// Mock data
const mockHorses: Horse[] = [
  {
    horseID: 'H001',
    ownerID: 'owner-001',
    breedCode: 'THO',
    name: 'Thunder',
    birthYear: 2020,
    gender: 'Stallion',
    color: 'Black',
    vaccinationRecordRef: 'VAC-2024-001',
    dopingTestDate: new Date('2024-06-10'),
    dopingTestResult: 'Clean',
    status: 'Approved',
    createdAt: new Date('2024-01-15'),
  },
  {
    horseID: 'H002',
    ownerID: 'owner-001',
    breedCode: 'ARAB',
    name: 'Bella',
    birthYear: 2021,
    gender: 'Mare',
    color: 'Chestnut',
    vaccinationRecordRef: 'VAC-2024-002',
    dopingTestDate: new Date('2024-06-12'),
    dopingTestResult: 'Pending',
    status: 'Pending',
    createdAt: new Date('2024-02-20'),
  },
  {
    horseID: 'H003',
    ownerID: 'owner-001',
    breedCode: 'QUAR',
    name: 'Shadow',
    birthYear: 2019,
    gender: 'Colt',
    color: 'Gray',
    dopingTestResult: 'Failed',
    status: 'Rejected',
    rejectionReason: 'Kết quả xét nghiệm doping không hợp lệ',
    createdAt: new Date('2024-03-10'),
  },
];

export default function HorseDetail() {
  const { id } = useParams<{ horseID: string }>();
  const navigate = useNavigate();

  // Find horse from mock data
const horse = mockHorses.find((h) => h.horseID === id);
  if (!horse) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Không tìm thấy ngựa
          </h2>
          <button
            onClick={() => navigate('/owner/horses')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Quay lại
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/owner/horses')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-6 transition-colors"
        >
          ← Quay lại
        </button>

        {/* Detail Container */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">
              {horse.name}
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 font-medium">Trạng thái:</span>
              <HorseStatusBadge status={horse.status} />
            </div>
          </div>

          {/* Rejection Reason Alert */}
          {horse.status === 'Rejected' && horse.rejectionReason && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-red-800 font-semibold mb-2">Lý do từ chối</h3>
              <p className="text-red-700">{horse.rejectionReason}</p>
            </div>
          )}

          {/* Horse Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Breed Code */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-1">Mã giống</p>
              <p className="text-lg font-semibold text-gray-800">
                {horse.breedCode}
              </p>
            </div>

            {/* Gender */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-1">Giới tính</p>
              <p className="text-lg font-semibold text-gray-800">
                {horse.gender}
              </p>
            </div>

            {/* Age */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-1">Tuổi</p>
              <p className="text-lg font-semibold text-gray-800">{age} tuổi</p>
            </div>

            {/* Birth Year */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-1">Năm sinh</p>
              <p className="text-lg font-semibold text-gray-800">
                {horse.birthYear}
              </p>
            </div>

            {/* Color */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-1">Màu sắc</p>
              <p className="text-lg font-semibold text-gray-800">
                {horse.color}
              </p>
            </div>

            {/* Doping Test Result */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-1">
                Kết quả xét nghiệm doping
              </p>
              <p
                className={`text-lg font-semibold ${getDopingTextColor(
                  horse.dopingTestResult
                )}`}
              >
                {horse.dopingTestResult}
              </p>
            </div>

            {/* Vaccination Record */}
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

            {/* Doping Test Date */}
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

            {/* Created At */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 font-medium mb-1">
                Ngày đăng ký
              </p>
              <p className="text-lg font-semibold text-gray-800">
                {new Date(horse.createdAt).toLocaleDateString('vi-VN')}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <button
              onClick={() => navigate('/owner/horses')}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Quay lại
            </button>
            <button
              onClick={() => navigate(`/owner/horses/edit/${horseID}`)}
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
