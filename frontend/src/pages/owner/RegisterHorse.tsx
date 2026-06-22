import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createHorse } from '../../services/ownerService';
import type { Horse } from '../../types/owner.types';

interface FormData {
  name: string;
  breedCode: string;
  birthYear: number | '';
  gender: string;
  color: string;
  pedigree: string;
  weight: number | '';
  identifyingMarks: string;
  vaccinationRecordRef: string;
  dopingTestDate: string;
  dopingTestResult: string;
  legalConsentAccepted: boolean;
}

const initialFormData: FormData = {
  name: '',
  breedCode: '',
  birthYear: '',
  gender: '',
  color: '',
  pedigree: '',
  weight: '',
  identifyingMarks: '',
  vaccinationRecordRef: '',
  dopingTestDate: new Date().toISOString().split('T')[0],
  dopingTestResult: 'Pending',
  legalConsentAccepted: true, // Default to true as required in format
};

const genderOptions = [
  { value: 'Male', label: 'Đực (Male)' },
  { value: 'Female', label: 'Cái (Female)' },
  { value: 'Gelding', label: 'Bị thiến (Gelding)' },
];

export default function RegisterHorse() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breedOptions = [
    { value: 'Mixed', label: 'Mixed' },
    { value: 'Quarter Horse', label: 'Quarter Horse' },
    { value: 'Arabian', label: 'Arabian' },
    { value: 'Thoroughbred', label: 'Thoroughbred' }
  ];

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Tên ngựa là bắt buộc');
      return false;
    }
    if (!formData.breedCode) {
      setError('Mã giống ngựa là bắt buộc');
      return false;
    }
    if (!formData.birthYear) {
      setError('Năm sinh là bắt buộc');
      return false;
    }
    if (!formData.gender) {
      setError('Giới tính là bắt buộc');
      return false;
    }
    if (!formData.color.trim()) {
      setError('Màu sắc là bắt buộc');
      return false;
    }
    if (formData.weight === '') {
      setError('Cân nặng là bắt buộc');
      return false;
    }
    if (!formData.identifyingMarks.trim()) {
      setError('Đặc điểm nhận dạng là bắt buộc');
      return false;
    }
    return true;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const val = type === 'checkbox'
      ? (e.target as HTMLInputElement).checked
      : name === 'birthYear' || name === 'weight'
        ? (value ? parseFloat(value) : '')
        : value;

    setFormData((prev) => ({
      ...prev,
      [name]: name === 'birthYear' ? (value ? parseInt(value, 10) : '') : value,
    }));
    setError(null);
  };

  // Hàm lấy thông tin của form sau khi người dùng xác nhận đăng ký
  const getRegisteredHorseInfo = () => {
    const info = {
      breedCode: formData.breedCode,
      name: formData.name,
      birthYear: Number(formData.birthYear),
      gender: formData.gender,
      color: formData.color,
      pedigree: formData.pedigree || 'string',
      weight: Number(formData.weight),
      identifyingMarks: formData.identifyingMarks,
      breed: formData.breedCode,
      vaccinationRecordRef: formData.vaccinationRecordRef || 'string',
      dopingTestDate: formData.dopingTestDate,
      dopingTestResult: formData.dopingTestResult,
      legalConsentAccepted: formData.legalConsentAccepted,
    };
    console.log('Thông tin đăng ký ngựa đã xác nhận:', info);
    return info;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Lấy thông tin form sau khi xác nhận đăng ký
    const formInfo = getRegisteredHorseInfo();

    try {
      setLoading(true);
      setError(null);

      // dataToSubmit theo đúng format người dùng yêu cầu
      const dataToSubmit: Omit<Horse, 'horseID' | 'ownerID' | 'createdAt'> = {
        breed: formInfo.breedCode,
        name: formInfo.name,
        birthYear: formInfo.birthYear,
        gender: formInfo.gender,
        color: formInfo.color,
        // pedigree: formInfo.pedigree,
        weight: formInfo.weight,
        identifyingMarks: formInfo.identifyingMarks,
        vaccinationRecordRef: formInfo.vaccinationRecordRef,
        dopingTestDate: formInfo.dopingTestDate,
        dopingTestResult: formInfo.dopingTestResult,
        legalConsentAccepted: formInfo.legalConsentAccepted,
      };

      await createHorse(dataToSubmit);
      navigate('/owner/horses');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Lỗi khi đăng ký ngựa';
      setError(errorMessage);
      console.error('Lỗi đăng ký ngựa:', err);
    } finally {
      setLoading(false);
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
          ← Quay lại danh sách
        </button>

        {/* Khung form */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">
            Đăng ký ngựa mới
          </h1>

          {/* Thông báo lỗi */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          )}

          {/* Form đăng ký */}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Tên ngựa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên ngựa <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Nhập tên ngựa"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* Mã giống ngựa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Giống ngựa <span className="text-red-600">*</span>
                </label>
                <select
                  name="breedCode"
                  value={formData.breedCode}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                >
                  <option value="">Chọn giống ngựa</option>
                  {breedOptions.map((breed) => (
                    <option key={breed.value} value={breed.value}>
                      {breed.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Năm sinh */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Năm sinh <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  name="birthYear"
                  value={formData.birthYear}
                  onChange={handleInputChange}
                  placeholder="Nhập năm sinh"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* Giới tính */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Giới tính <span className="text-red-600">*</span>
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                >
                  <option value="">Chọn giới tính</option>
                  {genderOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Màu sắc */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Màu sắc chủ đạo <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="color"
                  value={formData.color}
                  onChange={handleInputChange}
                  placeholder="Nhập màu sắc"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* Hồ sơ tiêm chủng */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mã tham chiếu hồ sơ tiêm chủng
                </label>
                <input
                  type="text"
                  name="vaccinationRecordRef"
                  value={formData.vaccinationRecordRef}
                  onChange={handleInputChange}
                  placeholder="Nhập mã tham chiếu (không bắt buộc)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* Ngày kiểm tra doping */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ngày kiểm tra doping <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  name="dopingTestDate"
                  value={formData.dopingTestDate}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* Cân nặng */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cân nặng (Weight) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleInputChange}
                  placeholder="Nhập cân nặng"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* Kết quả doping */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kết quả doping (DopingTestResult) <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="dopingTestResult"
                  value={formData.dopingTestResult}
                  onChange={handleInputChange}
                  placeholder="Nhập kết quả doping (ví dụ: Clean)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* Đặc điểm nhận dạng */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Đặc điểm nhận dạng (IdentifyingMarks) <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  name="identifyingMarks"
                  value={formData.identifyingMarks}
                  onChange={handleInputChange}
                  placeholder="Nhập đặc điểm nhận dạng"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            {/* Nút hành động */}
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => navigate('/owner/horses')}
                className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {loading ? 'Đang xử lý...' : 'Xác nhận Đăng ký'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
