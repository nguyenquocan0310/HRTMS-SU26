import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Horse } from '../../types/owner.types';
import type { HorseEnrollmentResponse } from '../../services/ownerService';
import { getMyHorses, getHorseEnrollments, enrollHorseToTournament } from '../../services/ownerService';
import { getMyTournamentParticipations, type ParticipationResponse } from '../../services/tournamentService';

type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray';

const BADGE_STYLES: Record<BadgeVariant, string> = {
  green: 'bg-green-50 text-green-700 border-green-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  gray: 'bg-gray-50 text-gray-500 border-gray-200',
};

const DOT_STYLES: Record<BadgeVariant, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  gray: 'bg-gray-400',
};

interface BadgeProps { label: string; variant: BadgeVariant }

const Badge: React.FC<BadgeProps> = ({ label, variant }) => (
  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border ${BADGE_STYLES[variant]}`}>
    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_STYLES[variant]}`} />
    {label}
  </span>
);

const getProfileBadge = (status: string | undefined): BadgeProps => {
  switch (status) {
    case 'Rejected': return { label: 'Hồ sơ bị từ chối', variant: 'red' };
    case 'Pending': return { label: 'Hồ sơ chờ duyệt', variant: 'yellow' };
    case 'Approved': return { label: 'Hồ sơ đã duyệt', variant: 'green' };
    default: return { label: 'Hồ sơ đã khai báo', variant: 'gray' };
  }
};

const getEnrollmentBadge = (enrollment: HorseEnrollmentResponse | null | undefined): BadgeProps => {
  if (!enrollment) return { label: 'Chưa đăng ký giải', variant: 'gray' };
  switch (enrollment.adminApprovalStatus) {
    case 'Approved': return { label: 'Trong giải: Đã duyệt', variant: 'green' };
    case 'Rejected': return { label: 'Trong giải: Bị từ chối', variant: 'red' };
    case 'Pending':
    default: return { label: 'Trong giải: Chờ Admin duyệt', variant: 'yellow' };
  }
};

interface HorseStatus {
  enrollments: HorseEnrollmentResponse[] | null;
  loading: boolean;
}

const getDopingLabel = (result: string | undefined): string => {
  switch (result) {
    case 'Clean': return 'Âm tính';
    case 'Pending': return 'Chờ kết quả';
    case 'Positive':
    case 'Failed': return 'Dương tính';
    default: return result || '—';
  }
};

const getDopingColor = (result: string | undefined): string => {
  switch (result) {
    case 'Clean': return 'text-green-600';
    case 'Pending': return 'text-yellow-600';
    case 'Positive':
    case 'Failed': return 'text-red-600';
    default: return 'text-gray-500';
  }
};

const getGenderLabel = (gender: string): string => {
  switch (gender) {
    case 'Male': case 'male': return 'Đực';
    case 'Female': case 'female': return 'Cái';
    case 'Gelding': case 'gelding': return 'Thiến';
    case 'Stallion': return 'Đực (trưởng thành)';
    case 'Colt': return 'Đực (non)';
    case 'Mare': return 'Cái (trưởng thành)';
    case 'Filly': return 'Cái (non)';
    default: return gender;
  }
};

const getHorseId = (horse: Horse): string => String((horse as any).horseId ?? horse.horseID ?? '');

interface HorseRowCardProps {
  horse: Horse;
  status: HorseStatus;
  onViewDetail: (id: string) => void;
  onEnroll: (horse: Horse) => void;
}

const HorseRowCard: React.FC<HorseRowCardProps> = ({ horse, status, onViewDetail, onEnroll }) => {
  const age = new Date().getFullYear() - horse.birthYear;
  const horseId = getHorseId(horse);
  const profileStatus = (horse as any).adminApprovalStatus ?? horse.status;
  const profileBadge = getProfileBadge(profileStatus);

  let latestEnrollment: HorseEnrollmentResponse | null = null;
  let enrollmentBadge: BadgeProps;
  if (status.loading) {
    enrollmentBadge = { label: 'Đang tải...', variant: 'gray' };
  } else if (status.enrollments === null) {
    enrollmentBadge = { label: 'Không tải được trạng thái giải', variant: 'gray' };
  } else if (status.enrollments.length === 0) {
    enrollmentBadge = { label: 'Chưa đăng ký giải', variant: 'gray' };
  } else {
    latestEnrollment = [...status.enrollments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    enrollmentBadge = getEnrollmentBadge(latestEnrollment);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all">
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900 leading-tight">{horse.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">Hồ sơ #{horseId || '—'}</p>
        </div>
        <Badge {...profileBadge} />
      </div>

      <div className="px-5 py-4 space-y-2">
        {[
          { label: 'Giống', value: horse.breed || (horse as any).breedCode || '—' },
          { label: 'Giới tính', value: getGenderLabel(horse.gender) },
          { label: 'Tuổi', value: `${age} tuổi` },
          {
            label: 'Doping',
            value: <span className={`font-medium ${getDopingColor(horse.dopingTestResult)}`}>{getDopingLabel(horse.dopingTestResult)}</span>,
          },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{row.label}</span>
            <span className="text-gray-800 font-medium">{row.value}</span>
          </div>
        ))}

        <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
          <span className="text-gray-500">Trong giải</span>
          <Badge {...enrollmentBadge} />
        </div>
        {latestEnrollment && (
          <p className="text-xs text-gray-500 pt-1 truncate" title={latestEnrollment.tournamentName || undefined}>
            Gần nhất: {latestEnrollment.tournamentName || `Giải #${latestEnrollment.tournamentId}`}
          </p>
        )}
      </div>

      <div className="px-5 pb-5 grid grid-cols-1 gap-2">
        <button
          onClick={() => onEnroll(horse)}
          className="w-full text-xs font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 py-2 rounded-xl transition-colors"
        >
          Đăng ký vào giải
        </button>
        <button
          onClick={() => onViewDetail(horseId)}
          className="w-full text-xs font-bold text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 py-2 rounded-xl transition-colors"
        >
          Xem chi tiết
        </button>
      </div>
    </div>
  );
};

interface EnrollModalProps {
  horse: Horse;
  status: HorseStatus;
  onClose: () => void;
  onSuccess: (horseId: string, enrollment: HorseEnrollmentResponse) => void;
}

const getTournamentStatus = (participation: ParticipationResponse): string | undefined => {
  const anyParticipation = participation as any;
  return anyParticipation.tournamentStatus ?? anyParticipation.statusName ?? anyParticipation.tournament?.status;
};

const EnrollModal: React.FC<EnrollModalProps> = ({ horse, status, onClose, onSuccess }) => {
  const [participations, setParticipations] = useState<ParticipationResponse[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | ''>('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingParticipations, setLoadingParticipations] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const horseId = getHorseId(horse);
  const enrolledTournamentIds = new Set((status.enrollments || []).map((enrollment) => enrollment.tournamentId));
  const selectedAlreadyEnrolled = selectedTournamentId !== '' && enrolledTournamentIds.has(selectedTournamentId);

  useEffect(() => {
    const loadParticipations = async () => {
      try {
        setLoadingParticipations(true);
        setError(null);
        const list = await getMyTournamentParticipations();
        const approved = list
          .filter((item: any) => item.status === 'Approved' && (!item.role || item.role === 'Owner'))
          .sort((a, b) => {
            const aOpen = getTournamentStatus(a) === 'Open Registration' ? 0 : 1;
            const bOpen = getTournamentStatus(b) === 'Open Registration' ? 0 : 1;
            return aOpen - bOpen;
          });
        setParticipations(approved);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không tải được danh sách giải đã duyệt.');
      } finally {
        setLoadingParticipations(false);
      }
    };
    loadParticipations();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTournamentId) {
      setError('Vui lòng chọn giải đấu.');
      return;
    }
    if (!confirmed) {
      setError('Vui lòng xác nhận thông tin y tế trước khi đăng ký vào giải.');
      return;
    }
    if (selectedAlreadyEnrolled) {
      setError('Ngựa đã vào giải này.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMessage(null);
      const enrollment = await enrollHorseToTournament(horseId, selectedTournamentId);
      setMessage(
        `Đăng ký vào giải thành công: ${enrollment.adminApprovalStatus}. ${enrollment.screeningReason || ''}`.trim()
      );
      onSuccess(horseId, enrollment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng ký ngựa vào giải thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Đăng ký ngựa vào giải</h2>
            <p className="text-sm text-gray-500 mt-0.5">Chọn giải để screening hồ sơ ngựa theo điều kiện giải.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" type="button">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <span className="text-gray-500">Ngựa:</span>{' '}
              <span className="font-semibold text-gray-900">{horse.name}</span>
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{error}</div>}
            {message && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-sm">{message}</div>}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Giải đấu <span className="text-red-500">*</span></label>
              {loadingParticipations ? (
                <div className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-400">Đang tải danh sách giải...</div>
              ) : participations.length === 0 ? (
                <div className="w-full px-3 py-2 text-sm border border-yellow-200 rounded-lg bg-yellow-50 text-yellow-700">Bạn cần đăng ký và được duyệt vào giải trước khi thêm ngựa vào giải.</div>
              ) : (
                <select
                  value={selectedTournamentId}
                  onChange={(event) => {
                    setSelectedTournamentId(event.target.value ? Number(event.target.value) : '');
                    setError(null);
                    setMessage(null);
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="">Chọn giải đấu</option>
                  {participations.map((participation: any) => {
                    const disabled = enrolledTournamentIds.has(participation.tournamentId);
                    return (
                      <option key={participation.participationId ?? participation.participantId ?? participation.tournamentId} value={participation.tournamentId} disabled={disabled}>
                        {participation.tournamentName || `Giải #${participation.tournamentId}`}{disabled ? ' — Đã vào giải này' : ''}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {selectedAlreadyEnrolled && (
              <div className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">Đã vào giải này.</div>
            )}

            <label className="flex items-start gap-3 text-sm text-gray-700 border border-gray-200 rounded-lg p-3">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1"
              />
              <span>Tôi xác nhận hồ sơ ngựa này có thể được screening cho giải đã chọn và thông tin y tế là chính xác.</span>
            </label>
          </div>

          <div className="px-5 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-white transition-colors">Đóng</button>
            <button
              type="submit"
              disabled={loading || loadingParticipations || participations.length === 0 || selectedAlreadyEnrolled}
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang đăng ký...' : 'Đăng ký vào giải'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MyHorses: React.FC = () => {
  const navigate = useNavigate();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [horseStatuses, setHorseStatuses] = useState<Record<string, HorseStatus>>({});
  const [enrollingHorse, setEnrollingHorse] = useState<Horse | null>(null);

  const loadHorseEnrollments = async (horse: Horse) => {
    const hid = getHorseId(horse);
    if (!hid) return;
    const enrollments = await getHorseEnrollments(hid);
    setHorseStatuses((prev) => ({
      ...prev,
      [hid]: { enrollments, loading: false },
    }));
  };

  useEffect(() => {
    const fetchHorses = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMyHorses();
        if (data && data.length > 0) {
          setHorses(data);
          const initial: Record<string, HorseStatus> = {};
          data.forEach((horse) => {
            const hid = getHorseId(horse);
            if (hid) initial[hid] = { enrollments: null, loading: true };
          });
          setHorseStatuses(initial);
          data.forEach(loadHorseEnrollments);
        } else {
          setHorses([]);
          setError(null);
        }
      } catch (err) {
        console.error('Lỗi khi tải danh sách ngựa:', err);
        setHorses([]);
        setError('Không tải được danh sách ngựa.');
      } finally {
        setLoading(false);
      }
    };
    fetchHorses();
  }, []);

  const handleViewDetail = (horseID: string) => {
    if (horseID) navigate(`/owner/horses/${horseID}`);
  };

  const handleRegisterHorse = () => {
    navigate('/owner/horses/register');
  };

  const handleEnrollSuccess = (horseId: string, enrollment: HorseEnrollmentResponse) => {
    setHorseStatuses((prev) => {
      const current = prev[horseId];
      const existing = current?.enrollments || [];
      return {
        ...prev,
        [horseId]: {
          loading: false,
          enrollments: [enrollment, ...existing.filter((item) => item.enrollmentId !== enrollment.enrollmentId)],
        },
      };
    });
  };

  if (loading) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Ngựa của tôi</h1>
            <p className="text-sm text-gray-500 mt-0.5">Danh sách hồ sơ ngựa trong kho</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse">
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

  if (horses.length === 0) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Ngựa của tôi</h1>
            <p className="text-sm text-gray-500 mt-0.5">Danh sách hồ sơ ngựa trong kho</p>
          </div>
          <button onClick={handleRegisterHorse} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors">Tạo hồ sơ ngựa</button>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
          <p className="text-sm font-semibold text-gray-700 mb-1">{error || 'Bạn chưa có hồ sơ ngựa nào.'}</p>
          <p className="text-xs text-gray-500 mb-4">Tạo hồ sơ ngựa trước, sau đó đăng ký ngựa vào giải tại màn này.</p>
          <button onClick={handleRegisterHorse} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors">Tạo hồ sơ ngựa đầu tiên</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Ngựa của tôi</h1>
            <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">{horses.length}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">Quản lý hồ sơ ngựa và đăng ký từng ngựa vào giải phù hợp.</p>
        </div>
        <button onClick={handleRegisterHorse} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors">Tạo hồ sơ ngựa mới</button>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {horses.map((horse) => {
          const hid = getHorseId(horse);
          const status = horseStatuses[hid] ?? { enrollments: null, loading: true };
          return (
            <HorseRowCard
              key={hid || horse.name}
              horse={horse}
              status={status}
              onViewDetail={handleViewDetail}
              onEnroll={setEnrollingHorse}
            />
          );
        })}
      </div>

      {enrollingHorse && (
        <EnrollModal
          horse={enrollingHorse}
          status={horseStatuses[getHorseId(enrollingHorse)] ?? { enrollments: [], loading: false }}
          onClose={() => setEnrollingHorse(null)}
          onSuccess={handleEnrollSuccess}
        />
      )}
    </div>
  );
};

export default MyHorses;
