import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createHorseProfile,
  getHorseById,
  updateHorse,
  type HorseCreateResponse,
} from '../../services/ownerService';

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
  dopingTestResult: 'Clean' | 'Pending' | 'Failed';
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
  legalConsentAccepted: true,
};

const genderOptions = [
  { value: 'Male', label: 'Đực (Male)' },
  { value: 'Female', label: 'Cái (Female)' },
  { value: 'Gelding', label: 'Bị thiến (Gelding)' },
];

const breedOptions = [
  { value: 'Mixed', label: 'Mixed' },
  { value: 'Quarter Horse', label: 'Quarter Horse' },
  { value: 'Arabian', label: 'Arabian' },
  { value: 'Thoroughbred', label: 'Thoroughbred' },
];

const dopingOptions = [
  { value: 'Clean', label: 'Âm tính' },
  { value: 'Pending', label: 'Chờ kết quả' },
  { value: 'Failed', label: 'Dương tính' },
] as const;

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white';

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 border-b border-gray-200 pb-1.5 mb-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{children}</p>
    </div>
  );
}

function CreatedResult({ result }: { result: HorseCreateResponse }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500" />
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Hồ sơ ngựa</p>
          <p className="text-sm font-bold text-green-800">Đã tạo hồ sơ trong kho</p>
        </div>
      </div>
      <div className="bg-white bg-opacity-70 rounded px-3 py-2">
        <p className="text-sm text-gray-700">
          Hồ sơ ngựa <span className="font-semibold">"{result.name}"</span> đã được tạo.
          Bạn có thể đăng ký ngựa vào giải tại màn Ngựa của tôi.
        </p>
      </div>
      <p className="text-xs text-gray-500">ID hồ sơ: #{result.horseId}</p>
    </div>
  );
}

export default function RegisterHorse() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdHorse, setCreatedHorse] = useState<HorseCreateResponse | null>(null);

  useEffect(() => {
    if (!id) return;

    const horseId = Number(id);
    if (!Number.isInteger(horseId)) {
      setError('Mã hồ sơ ngựa không hợp lệ.');
      return;
    }

    const loadHorse = async () => {
      try {
        setInitialLoading(true);
        setError(null);
        const horse = await getHorseById(horseId);
        setFormData({
          name: horse.name || '',
          breedCode: horse.breed || '',
          birthYear: horse.birthYear || '',
          gender: horse.gender || '',
          color: horse.color || '',
          pedigree: horse.pedigree || '',
          weight: horse.weight ?? '',
          identifyingMarks: horse.identifyingMarks || '',
          vaccinationRecordRef:
            horse.vaccinationRecordRef === 'Not provided' ? '' : horse.vaccinationRecordRef || '',
          dopingTestDate: horse.dopingTestDate?.slice(0, 10) || '',
          dopingTestResult:
            horse.dopingTestResult === 'Clean' ||
            horse.dopingTestResult === 'Failed' ||
            horse.dopingTestResult === 'Pending'
              ? horse.dopingTestResult
              : 'Pending',
          legalConsentAccepted: horse.legalConsentAccepted ?? true,
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Không tải được hồ sơ ngựa.');
      } finally {
        setInitialLoading(false);
      }
    };

    void loadHorse();
  }, [id]);

  const validateForm = (): boolean => {
    if (!formData.name.trim()) return setError('Tên ngựa là bắt buộc.'), false;
    if (!formData.breedCode) return setError('Giống ngựa là bắt buộc.'), false;
    if (!formData.birthYear) return setError('Năm sinh là bắt buộc.'), false;
    if (!formData.gender) return setError('Giới tính là bắt buộc.'), false;
    if (!formData.color.trim()) return setError('Màu sắc là bắt buộc.'), false;
    if (formData.weight === '') return setError('Cân nặng là bắt buộc.'), false;
    if (!formData.identifyingMarks.trim()) return setError('Đặc điểm nhận dạng là bắt buộc.'), false;
    if (!formData.dopingTestResult) return setError('Kết quả doping là bắt buộc.'), false;
    return true;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : name === 'birthYear'
          ? value ? parseInt(value, 10) : ''
          : name === 'weight'
          ? value ? Number(value) : ''
          : value,
    }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setLoading(true);
      setError(null);
      setCreatedHorse(null);

      const payload = {
        name: formData.name,
        birthYear: formData.birthYear as number,
        gender: formData.gender,
        color: formData.color,
        pedigree: formData.pedigree || undefined,
        weight: formData.weight as number,
        identifyingMarks: formData.identifyingMarks,
        breed: formData.breedCode,
        // Backend hiện vẫn Required field này, nhưng nghiệp vụ Owner không bắt buộc nhập.
        vaccinationRecordRef: formData.vaccinationRecordRef.trim() || 'Not provided',
        dopingTestDate: formData.dopingTestDate || undefined,
        dopingTestResult: formData.dopingTestResult,
        legalConsentAccepted: formData.legalConsentAccepted,
      };

      if (isEditing && id) {
        await updateHorse(Number(id), payload);
        navigate(`/owner/horses/${id}`, { replace: true });
        return;
      }

      const result = await createHorseProfile(payload);

      setCreatedHorse(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi khi tạo hồ sơ ngựa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <button
          onClick={() => navigate('/owner/horses')}
          className="text-sm text-blue-700 hover:text-blue-800 font-bold mb-4"
        >
          Quay lại danh sách
        </button>
        <h1 className="text-3xl font-black tracking-tight text-slate-950">
          {isEditing ? 'Cập nhật thông tin ngựa' : 'Đăng ký hồ sơ ngựa'}
        </h1>
        <p className="text-base text-slate-500 mt-2">
          {isEditing
            ? 'Chỉnh sửa các thông tin hồ sơ ngựa và lưu lại thay đổi.'
            : 'Tạo hồ sơ ngựa dùng lại trong kho. Việc đăng ký ngựa vào giải thực hiện tại màn Ngựa của tôi.'}
        </p>
      </div>

      {initialLoading && (
        <div className="py-16 text-center text-sm font-medium text-slate-500">
          Đang tải thông tin ngựa...
        </div>
      )}

      {createdHorse && (
        <div className="mb-6">
          <CreatedResult result={createdHorse} />
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/owner/horses')}
              className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
            >
              Xem danh sách ngựa →
            </button>
            <button
              type="button"
              onClick={() => {
                setCreatedHorse(null);
                setFormData(initialFormData);
              }}
              className="px-5 py-2.5 text-sm font-bold text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
            >
              Tạo hồ sơ ngựa khác
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {!createdHorse && !initialLoading && (
        <form onSubmit={handleSubmit}>
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <SectionHeader>Thông tin cơ bản</SectionHeader>

              <Field label="Tên ngựa" required>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Nhập tên ngựa" className={inputCls} />
              </Field>

              <Field label="Giống ngựa" required>
                <select name="breedCode" value={formData.breedCode} onChange={handleInputChange} className={inputCls}>
                  <option value="">Chọn giống ngựa</option>
                  {breedOptions.map((breed) => <option key={breed.value} value={breed.value}>{breed.label}</option>)}
                </select>
              </Field>

              <Field label="Năm sinh" required>
                <input type="number" name="birthYear" value={formData.birthYear} onChange={handleInputChange} placeholder="VD: 2019" className={inputCls} />
              </Field>

              <Field label="Giới tính" required>
                <select name="gender" value={formData.gender} onChange={handleInputChange} className={inputCls}>
                  <option value="">Chọn giới tính</option>
                  {genderOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </Field>

              <Field label="Màu sắc chủ đạo" required>
                <input type="text" name="color" value={formData.color} onChange={handleInputChange} placeholder="VD: Đen bóng" className={inputCls} />
              </Field>

              <Field label="Cân nặng (kg)" required>
                <input type="number" name="weight" value={formData.weight} onChange={handleInputChange} placeholder="Nhập cân nặng" className={inputCls} />
              </Field>

              <div className="md:col-span-2">
                <Field label="Đặc điểm nhận dạng" required>
                  <textarea name="identifyingMarks" value={formData.identifyingMarks} onChange={handleInputChange} placeholder="Dấu hiệu nhận dạng, vết bớt, microchip..." className={`${inputCls} min-h-[88px] resize-y`} />
                </Field>
              </div>

              <SectionHeader>Thông tin y tế</SectionHeader>

              <Field label="Mã tham chiếu hồ sơ tiêm chủng" hint="Không bắt buộc. Nếu bỏ trống, hệ thống sẽ ghi nhận là chưa cung cấp.">
                <input type="text" name="vaccinationRecordRef" value={formData.vaccinationRecordRef} onChange={handleInputChange} placeholder="Không bắt buộc" className={inputCls} />
              </Field>

              <Field label="Ngày kiểm tra doping" required>
                <input type="date" name="dopingTestDate" value={formData.dopingTestDate} onChange={handleInputChange} className={inputCls} />
              </Field>

              <Field label="Kết quả doping" required>
                <select name="dopingTestResult" value={formData.dopingTestResult} onChange={handleInputChange} className={inputCls}>
                  {dopingOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </Field>

              <div className="md:col-span-2">
                <Field label="Phả hệ">
                  <textarea name="pedigree" value={formData.pedigree} onChange={handleInputChange} placeholder="Ghi chú dòng máu/phả hệ nếu có" className={`${inputCls} min-h-[88px] resize-y`} />
                </Field>
              </div>
            </div>

            <div className="px-6 md:px-8 py-5 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button type="button" onClick={() => navigate('/owner/horses')} className="px-5 py-2.5 text-sm font-bold text-slate-700 border border-slate-300 rounded-full hover:bg-white transition-colors">
                Hủy bỏ
              </button>
              <button type="submit" disabled={loading} className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center gap-2">
                {loading && <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />}
                {loading
                  ? isEditing ? 'Đang cập nhật...' : 'Đang tạo hồ sơ...'
                  : isEditing ? 'Lưu thay đổi' : 'Tạo hồ sơ ngựa'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
