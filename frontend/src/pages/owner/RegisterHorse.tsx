import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createHorse } from '../../services/ownerService';
import type { Horse } from '../../types/owner.types';

interface FormData {
  name: string;
  breedCode: string;
  birthYear: number | '';
  gender: 'Colt' | 'Filly' | 'Stallion' | 'Mare' | '';
  color: string;
  vaccinationRecordRef: string;
  dopingTestResult: 'Clean' | 'Pending' | 'Failed';
}

const initialFormData: FormData = {
  name: '',
  breedCode: '',
  birthYear: '',
  gender: '',
  color: '',
  vaccinationRecordRef: '',
  dopingTestResult: 'Pending',
};

export default function RegisterHorse() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breedOptions = ['THO', 'ARAB', 'QUAR', 'APPA'];
  const genderOptions = ['Stallion', 'Colt', 'Mare', 'Filly'] as const;

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
    return true;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'birthYear' ? (value ? parseInt(value, 10) : '') : value,
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const dataToSubmit: Omit<Horse, 'horseID' | 'ownerID' | 'createdAt'> = {
        breedCode: formData.breedCode,
        name: formData.name,
        birthYear: formData.birthYear as number,
        gender: formData.gender as 'Colt' | 'Filly' | 'Stallion' | 'Mare',
        color: formData.color,
        vaccinationRecordRef: formData.vaccinationRecordRef || undefined,
        dopingTestResult: formData.dopingTestResult,
        status: 'Pending',
      };

      await createHorse(dataToSubmit);
      navigate('/owner/horses');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Lỗi khi đăng ký ngựa';
      setError(errorMessage);
      console.error('Error registering horse:', err);
    } finally {
      setLoading(false);
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
          ← Quay lại danh sách
        </button>

        {/* Form Container */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">
            Đăng ký ngựa mới
          </h1>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">{error}</p>
            </div>
          )}

          {/* Form */}
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
                  Mã giống ngựa <span className="text-red-600">*</span>
                </label>
                <select
                  name="breedCode"
                  value={formData.breedCode}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                >
                  <option value="">Chọn mã giống</option>
                  {breedOptions.map((breed) => (
                    <option key={breed} value={breed}>
                      {breed}
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
                  {genderOptions.map((gen) => (
                    <option key={gen} value={gen}>
                      {gen}
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
            </div>
                      
            {/* Action Buttons */}
            
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
                Xác nhận Đăng ký
                
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
