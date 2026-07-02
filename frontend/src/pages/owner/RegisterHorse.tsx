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
  { value: 'Male',    label: 'Đực (Male)' },
  { value: 'Female',  label: 'Cái (Female)' },
  { value: 'Gelding', label: 'Bị thiến (Gelding)' },
];

const breedOptions = [
  { value: 'Mixed',         label: 'Mixed' },
  { value: 'Quarter Horse', label: 'Quarter Horse' },
  { value: 'Arabian',       label: 'Arabian' },
  { value: 'Thoroughbred',  label: 'Thoroughbred' },
];

// ─── Shared form field ────────────────────────────────────────────────────────

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
const inputDisabledCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed';

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 border-b border-gray-200 pb-1.5 mb-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{children}</p>
    </div>
  );
}

// ─── Screening Result ─────────────────────────────────────────────────────────

interface ScreeningResultProps {
  result: HorseCreateResponse;
}

function ScreeningResult({ result }: ScreeningResultProps) {
  const configs: Record<
    string,
    { bg: string; border: string; text: string; dot: string; label: string }
  > = {
    AutoEligible: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      dot: 'bg-green-500',
      label: 'Đã tự duyệt',
    },
    ManualReview: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      dot: 'bg-yellow-500',
      label: 'Chờ Admin duyệt',
    },
    AutoRejected: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      dot: 'bg-red-500',
      label: 'Bị từ chối tự động',
    },
  };

  const cfg = configs[result.screeningStatus] ?? {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-800',
    dot: 'bg-gray-400',
    label: result.screeningStatus,
  };

  return (
    <div className={`${cfg.bg} ${cfg.border} border rounded-lg p-4 space-y-2`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Kết quả xét duyệt</p>
          <p className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</p>
        </div>
      </div>

      {result.screeningReason && (
        <div className="bg-white bg-opacity-60 rounded px-3 py-2">
          <p className="text-xs text-gray-500 mb-0.5">Lý do</p>
          <p className={`text-sm font-medium ${cfg.text}`}>{result.screeningReason}</p>
        </div>
      )}

      {result.adminApprovalStatus && (
        <div className="bg-white bg-opacity-60 rounded px-3 py-2">
          <p className="text-xs text-gray-500 mb-0.5">Trạng thái Admin</p>
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
    <div className="max-w-3xl">
      {/* Page header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/owner/horses')}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium mb-3 flex items-center gap-1"
        >
          ← Quay lại danh sách
        </button>
        <h1 className="text-xl font-bold text-gray-900">Đăng ký ngựa mới</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Điền đầy đủ thông tin để đăng ký ngựa tham gia giải đấu.
        </p>
      </div>

      {/* Screening result (after successful submit) */}
      {screeningResult && (
        <div className="mb-6">
          <ScreeningResult result={screeningResult} />
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/owner/horses')}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Xem danh sách ngựa →
            </button>
            <button
              type="button"
              onClick={() => {
                setScreeningResult(null);
                setFormData(initialFormData);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Đăng ký ngựa khác
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700 font-medium">⚠️ {error}</p>
        </div>
      )}

      {/* Warning: no approved tournament */}
      {!participationsLoading && !hasApprovedTournament && !participationsError && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3">
          <span className="text-lg mt-0.5">🏆</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Bạn chưa có giải đấu nào được duyệt</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Bạn cần đăng ký tham gia một giải trước khi đăng ký ngựa.
            </p>
            <button
              type="button"
              onClick={() => navigate('/owner/tournaments')}
              className="mt-2 text-xs font-semibold text-amber-800 underline hover:text-amber-900"
            >
              Đến trang giải đấu →
            </button>
          </div>
        </div>
      )}

      {participationsError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm text-red-700">⚠️ {participationsError}</p>
        </div>
      )}

      {/* Form — hidden when submitted */}
      {!screeningResult && (
        <form onSubmit={handleSubmit}>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Form body */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">

              {/* Section: Giải đấu */}
              <SectionHeader>Giải đấu</SectionHeader>

              <div className="md:col-span-2">
                <Field label="Giải đấu" required hint={!participationsLoading && !hasApprovedTournament ? 'Cần đăng ký và được duyệt vào ít nhất một giải để tiếp tục.' : undefined}>
                  {participationsLoading ? (
                    <div className={inputDisabledCls}>Đang tải danh sách giải đấu...</div>
                  ) : (
                    <select
                      name="tournamentId"
                      value={formData.tournamentId}
                      onChange={handleInputChange}
                      disabled={!hasApprovedTournament}
                      className={hasApprovedTournament ? inputCls : inputDisabledCls}
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
                </Field>
              </div>

              {/* Section: Thông tin cơ bản */}
              <SectionHeader>Thông tin cơ bản</SectionHeader>

              <Field label="Tên ngựa" required>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Nhập tên ngựa"
                  className={inputCls}
                />
              </Field>

              <Field label="Giống ngựa" required>
                <select
                  name="breedCode"
                  value={formData.breedCode}
                  onChange={handleInputChange}
                  className={inputCls}
                >
                  <option value="">Chọn giống ngựa</option>
                  {breedOptions.map((breed) => (
                    <option key={breed.value} value={breed.value}>
                      {breed.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Năm sinh" required>
                <input
                  type="number"
                  name="birthYear"
                  value={formData.birthYear}
                  onChange={handleInputChange}
                  placeholder="VD: 2019"
                  className={inputCls}
                />
              </Field>

              <Field label="Giới tính" required>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className={inputCls}
                >
                  <option value="">Chọn giới tính</option>
                  {genderOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Màu sắc chủ đạo" required>
                <input
                  type="text"
                  name="color"
                  value={formData.color}
                  onChange={handleInputChange}
                  placeholder="VD: Bay, Chestnut, Black"
                  className={inputCls}
                />
              </Field>

              <Field label="Cân nặng (kg)" required>
                <input
                  type="number"
                  name="weight"
                  value={formData.weight}
                  onChange={handleInputChange}
                  placeholder="Nhập cân nặng"
                  className={inputCls}
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Đặc điểm nhận dạng" required>
                  <input
                    type="text"
                    name="identifyingMarks"
                    value={formData.identifyingMarks}
                    onChange={handleInputChange}
                    placeholder="VD: Vết bớt trắng ở trán"
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* Section: Thông tin y tế */}
              <SectionHeader>Thông tin y tế</SectionHeader>

              <Field label="Mã tham chiếu hồ sơ tiêm chủng">
                <input
                  type="text"
                  name="vaccinationRecordRef"
                  value={formData.vaccinationRecordRef}
                  onChange={handleInputChange}
                  placeholder="Không bắt buộc"
                  className={inputCls}
                />
              </Field>

              <Field label="Ngày kiểm tra doping" required>
                <input
                  type="date"
                  name="dopingTestDate"
                  value={formData.dopingTestDate}
                  onChange={handleInputChange}
                  className={inputCls}
                />
              </Field>

              <Field label="Kết quả doping" required>
                <input
                  type="text"
                  name="dopingTestResult"
                  value={formData.dopingTestResult}
                  onChange={handleInputChange}
                  placeholder="VD: Clean, Pending"
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Form footer */}
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/owner/horses')}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={loading || !hasApprovedTournament || participationsLoading}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                )}
                {loading ? 'Đang xử lý...' : 'Xác nhận đăng ký'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
