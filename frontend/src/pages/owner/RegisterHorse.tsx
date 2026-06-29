import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createHorseWithTournament,
  type HorseCreateResponse,
} from '../../services/ownerService';
import {
  getMyTournamentParticipations,
  type ParticipationResponse,
} from '../../services/tournamentService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  tournamentId: number | '';
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
  tournamentId: '',
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

// ─── Screening Result Badge ───────────────────────────────────────────────────

interface ScreeningResultProps {
  result: HorseCreateResponse;
}

function ScreeningResult({ result }: ScreeningResultProps) {
  const configs: Record<
    string,
    { bg: string; border: string; text: string; icon: string; label: string }
  > = {
    AutoEligible: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      icon: '✅',
      label: 'Đã tự duyệt',
    },
    ManualReview: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      icon: '⏳',
      label: 'Chờ Admin duyệt',
    },
    AutoRejected: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: '❌',
      label: 'Bị từ chối tự động',
    },
  };

  const cfg = configs[result.screeningStatus] ?? {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-800',
    icon: 'ℹ️',
    label: result.screeningStatus,
  };

  return (
    <div className={`${cfg.bg} ${cfg.border} border rounded-xl p-5 space-y-3`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{cfg.icon}</span>
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">
            Kết quả xét duyệt
          </p>
          <p className={`font-bold text-lg ${cfg.text}`}>{cfg.label}</p>
        </div>
      </div>

      {result.screeningReason && (
        <div className="bg-white bg-opacity-60 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Lý do</p>
          <p className={`text-sm font-medium ${cfg.text}`}>{result.screeningReason}</p>
        </div>
      )}

      {result.adminApprovalStatus && (
        <div className="bg-white bg-opacity-60 rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Trạng thái Admin</p>
          <p className={`text-sm font-medium ${cfg.text}`}>{result.adminApprovalStatus}</p>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Ngựa <span className="font-semibold text-gray-700">"{result.name}"</span> đã được ghi nhận
        (ID: #{result.horseId}).
      </p>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function RegisterHorse() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screeningResult, setScreeningResult] = useState<HorseCreateResponse | null>(null);

  // Tournament participations state
  const [participations, setParticipations] = useState<ParticipationResponse[]>([]);
  const [participationsLoading, setParticipationsLoading] = useState(true);
  const [participationsError, setParticipationsError] = useState<string | null>(null);

  // ── Fetch approved participations on mount ──────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setParticipationsLoading(true);
        setParticipationsError(null);
        const list = await getMyTournamentParticipations();
        // Lọc: chỉ lấy Approved (và tournament.status === "Open Registration" nếu BE trả về)
        const approved = list.filter((p) => p.status === 'Approved');
        setParticipations(approved);
      } catch (err: unknown) {
        setParticipationsError(
          err instanceof Error ? err.message : 'Không tải được danh sách giải đấu.'
        );
      } finally {
        setParticipationsLoading(false);
      }
    };
    load();
  }, []);

  const hasApprovedTournament = participations.length > 0;

  // ── Validation ──────────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    if (!formData.tournamentId) {
      setError('Vui lòng chọn giải đấu.');
      return false;
    }
    if (!formData.name.trim()) {
      setError('Tên ngựa là bắt buộc.');
      return false;
    }
    if (!formData.breedCode) {
      setError('Mã giống ngựa là bắt buộc.');
      return false;
    }
    if (!formData.birthYear) {
      setError('Năm sinh là bắt buộc.');
      return false;
    }
    if (!formData.gender) {
      setError('Giới tính là bắt buộc.');
      return false;
    }
    if (!formData.color.trim()) {
      setError('Màu sắc là bắt buộc.');
      return false;
    }
    if (formData.weight === '') {
      setError('Cân nặng là bắt buộc.');
      return false;
    }
    if (!formData.identifyingMarks.trim()) {
      setError('Đặc điểm nhận dạng là bắt buộc.');
      return false;
    }
    return true;
  };

  // ── Input handler ───────────────────────────────────────────────────────────
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
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
          : name === 'weight' || name === 'tournamentId'
          ? value ? Number(value) : ''
          : value,
    }));
    setError(null);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setLoading(true);
      setError(null);
      setScreeningResult(null);

      const result = await createHorseWithTournament({
        tournamentId: formData.tournamentId as number,
        name: formData.name,
        birthYear: formData.birthYear as number,
        gender: formData.gender,
        color: formData.color,
        pedigree: formData.pedigree || undefined,
        weight: formData.weight as number,
        identifyingMarks: formData.identifyingMarks,
        breed: formData.breedCode,
        vaccinationRecordRef: formData.vaccinationRecordRef || undefined,
        dopingTestDate: formData.dopingTestDate || undefined,
        dopingTestResult: formData.dopingTestResult || undefined,
        legalConsentAccepted: formData.legalConsentAccepted,
      });

      setScreeningResult(result);
      // Form vẫn giữ nguyên để người dùng xem kết quả
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi khi đăng ký ngựa.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
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
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Đăng ký ngựa mới</h1>

          {/* Kết quả screening (sau khi submit thành công) */}
          {screeningResult && (
            <div className="mb-6">
              <ScreeningResult result={screeningResult} />
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/owner/horses')}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
                >
                  Xem danh sách ngựa →
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScreeningResult(null);
                    setFormData(initialFormData);
                  }}
                  className="px-5 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  Đăng ký ngựa khác
                </button>
              </div>
            </div>
          )}

          {/* Thông báo lỗi */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">⚠️ {error}</p>
            </div>
          )}

          {/* Cảnh báo nếu chưa có giải Approved */}
          {!participationsLoading && !hasApprovedTournament && !participationsError && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <span className="text-xl mt-0.5">🏆</span>
              <div>
                <p className="font-semibold text-amber-800 text-sm">
                  Bạn chưa có giải đấu nào được duyệt
                </p>
                <p className="text-amber-700 text-sm mt-0.5">
                  Bạn cần đăng ký tham gia một giải trước khi đăng ký ngựa.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/owner/tournaments')}
                  className="mt-2 text-sm font-medium text-amber-800 underline hover:text-amber-900"
                >
                  Đến trang giải đấu →
                </button>
              </div>
            </div>
          )}

          {participationsError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">⚠️ {participationsError}</p>
            </div>
          )}

          {/* Form — ẩn nếu đã submit thành công */}
          {!screeningResult && (
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

                {/* ── Giải đấu (chiếm full width) ── */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Giải đấu <span className="text-red-600">*</span>
                  </label>
                  {participationsLoading ? (
                    <div className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 text-sm animate-pulse">
                      Đang tải danh sách giải đấu...
                    </div>
                  ) : (
                    <select
                      name="tournamentId"
                      value={formData.tournamentId}
                      onChange={handleInputChange}
                      disabled={!hasApprovedTournament}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {hasApprovedTournament
                          ? 'Chọn giải đấu'
                          : 'Không có giải đấu nào được duyệt'}
                      </option>
                      {participations.map((p) => (
                        <option key={p.participationId} value={p.tournamentId}>
                          {p.tournamentName || `Giải #${p.tournamentId}`}
                        </option>
                      ))}
                    </select>
                  )}
                  {!participationsLoading && !hasApprovedTournament && (
                    <p className="mt-1 text-xs text-amber-600">
                      Cần đăng ký và được duyệt vào ít nhất một giải để tiếp tục.
                    </p>
                  )}
                </div>

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

                {/* Giống ngựa */}
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
                    Cân nặng (kg) <span className="text-red-600">*</span>
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
                    Kết quả doping <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="dopingTestResult"
                    value={formData.dopingTestResult}
                    onChange={handleInputChange}
                    placeholder="Ví dụ: Clean"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                {/* Đặc điểm nhận dạng */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Đặc điểm nhận dạng <span className="text-red-600">*</span>
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
                  disabled={loading || !hasApprovedTournament || participationsLoading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  )}
                  {loading ? 'Đang xử lý...' : 'Xác nhận Đăng ký'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
