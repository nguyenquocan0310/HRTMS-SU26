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
    case 'Male': case 'male':       return 'Đực (Male)';
    case 'Female': case 'female':   return 'Cái (Female)';
    case 'Gelding': case 'gelding': return 'Bị thiến (Gelding)';
    case 'Stallion': return 'Ngựa đực (trưởng thành)';
    case 'Colt':     return 'Ngựa đực (non)';
    case 'Mare':     return 'Ngựa cái (trưởng thành)';
    case 'Filly':    return 'Ngựa cái (non)';
    default:         return gender;
  }
};

const getDopingLabel = (result: Horse['dopingTestResult']): string => {
  switch (result) {
    case 'Clean':   return 'Âm tính';
    case 'Pending': return 'Chờ duyệt';
    case 'Failed':  return 'Dương tính';
    default:        return result || 'Chưa kiểm tra';
  }
};

const getDopingColor = (result: Horse['dopingTestResult']): string => {
  switch (result) {
    case 'Clean':   return 'text-green-600';
    case 'Pending': return 'text-yellow-600';
    case 'Failed':  return 'text-red-600';
    default:        return 'text-gray-600';
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
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3" />
          <p className="text-sm text-gray-500">Đang tải chi tiết ngựa...</p>
        </div>
      </div>
    );
  }

  if (error || !horse) {
    return (
      <div className="text-center py-16">
        <p className="text-sm font-semibold text-gray-700 mb-3">
          {error || 'Không tìm thấy ngựa'}
        </p>
        <button
          onClick={() => navigate('/owner/horses')}
          className="px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  const age = new Date().getFullYear() - horse.birthYear;

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: 'Giống ngựa',      value: horse.breed },
    { label: 'Giới tính',       value: getGenderLabel(horse.gender) },
    { label: 'Tuổi',            value: `${age} tuổi` },
    { label: 'Năm sinh',        value: horse.birthYear },
    { label: 'Màu sắc',         value: horse.color },
    {
      label: 'Kiểm tra doping',
      value: (
        <span className={`font-semibold ${getDopingColor(horse.dopingTestResult)}`}>
          {getDopingLabel(horse.dopingTestResult)}
        </span>
      ),
    },
    ...(horse.vaccinationRecordRef
      ? [{ label: 'Hồ sơ tiêm chủng', value: horse.vaccinationRecordRef }]
      : []),
    ...(horse.dopingTestDate
      ? [{ label: 'Ngày xét nghiệm', value: new Date(horse.dopingTestDate).toLocaleDateString('vi-VN') }]
      : []),
    { label: 'Ngày đăng ký', value: horse.createdAt ? new Date(horse.createdAt).toLocaleDateString('vi-VN') : 'N/A' },
  ];

  return (
    <div className="max-w-3xl">
      {/* Back link */}
      <button
        onClick={() => navigate('/owner/horses')}
        className="text-sm text-blue-600 hover:text-blue-700 font-medium mb-4 flex items-center gap-1"
      >
        ← Quay lại danh sách
      </button>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{horse.name}</h1>
          {horse.identifyingMarks && (
            <p className="text-xs text-gray-500 mt-0.5">{horse.identifyingMarks}</p>
          )}
        </div>
        <HorseStatusBadge status={(horse.status as 'Approved' | 'Pending' | 'Rejected') || 'Pending'} />
      </div>

      {/* Rejection reason */}
      {horse.status === 'Rejected' && horse.rejectionReason && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-red-700 mb-0.5">Lý do từ chối</p>
          <p className="text-sm text-red-700">{horse.rejectionReason}</p>
        </div>
      )}

      {/* Detail panel */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thông tin chi tiết</p>
        </div>
        <div className="divide-y divide-gray-100">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center px-5 py-3 text-sm">
              <span className="w-44 text-gray-500 flex-shrink-0">{f.label}</span>
              <span className="text-gray-800 font-medium">{f.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => navigate('/owner/horses')}
          className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Quay lại
        </button>
        <button
          onClick={() =>
            navigate(`/owner/horses/edit/${horse.horseID || (horse as any).horseId || id || ''}`)
          }
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          Cập nhật thông tin
        </button>
      </div>
    </div>
  );
}
