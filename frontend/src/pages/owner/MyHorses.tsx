import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Horse } from '../../types/owner.types';
import type { HorseEnrollmentResponse } from '../../services/ownerService';
import { getMyHorses, getHorseEnrollments } from '../../services/ownerService';

// ─── Badge helpers ────────────────────────────────────────────────────────────

type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray';

const BADGE_STYLES: Record<BadgeVariant, string> = {
  green:  'bg-green-50  text-green-700  border-green-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  red:    'bg-red-50    text-red-700    border-red-200',
  gray:   'bg-gray-50   text-gray-500   border-gray-200',
};

const DOT_STYLES: Record<BadgeVariant, string> = {
  green:  'bg-green-500',
  yellow: 'bg-yellow-500',
  red:    'bg-red-500',
  gray:   'bg-gray-400',
};

interface BadgeProps { label: string; variant: BadgeVariant }

const Badge: React.FC<BadgeProps> = ({ label, variant }) => (
  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border ${BADGE_STYLES[variant]}`}>
    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_STYLES[variant]}`} />
    {label}
  </span>
);

/** Trả về badge "Hồ sơ ..." dựa trên adminApprovalStatus của horse gốc */
const getProfileBadge = (status: string | undefined): BadgeProps => {
  switch (status) {
    case 'Approved': return { label: 'Hồ sơ đã duyệt',    variant: 'green'  };
    case 'Rejected': return { label: 'Hồ sơ bị từ chối',  variant: 'red'    };
    case 'Pending':
    default:         return { label: 'Hồ sơ chờ duyệt',   variant: 'yellow' };
  }
};

/** Trả về badge "Trong giải ..." dựa trên adminApprovalStatus của enrollment */
const getEnrollmentBadge = (enrollment: HorseEnrollmentResponse | null | undefined): BadgeProps => {
  if (!enrollment) return { label: 'Chưa đăng ký giải', variant: 'gray' };
  switch (enrollment.adminApprovalStatus) {
    case 'Approved': return { label: 'Trong giải: Đã duyệt',           variant: 'green'  };
    case 'Rejected': return { label: 'Trong giải: Bị từ chối',          variant: 'red'    };
    case 'Pending':
    default:         return { label: 'Trong giải: Chờ Admin duyệt',     variant: 'yellow' };
  }
};

// ─── Per-horse card ───────────────────────────────────────────────────────────

interface HorseStatus {
  enrollments: HorseEnrollmentResponse[] | null; // null = error, [] = no enrollment
  loading: boolean;
}

const getDopingLabel = (result: string | undefined): string => {
  switch (result) {
    case 'Clean':   return 'Âm tính';
    case 'Pending': return 'Chờ duyệt';
    case 'Failed':  return 'Dương tính';
    default:        return result || '—';
  }
};

const getDopingColor = (result: string | undefined): string => {
  switch (result) {
    case 'Clean':   return 'text-green-600';
    case 'Pending': return 'text-yellow-600';
    case 'Failed':  return 'text-red-600';
    default:        return 'text-gray-500';
  }
};

const getGenderLabel = (gender: string): string => {
  switch (gender) {
    case 'Male': case 'male':       return 'Đực';
    case 'Female': case 'female':   return 'Cái';
    case 'Gelding': case 'gelding': return 'Thiến';
    case 'Stallion': return 'Đực (trưởng thành)';
    case 'Colt':     return 'Đực (non)';
    case 'Mare':     return 'Cái (trưởng thành)';
    case 'Filly':    return 'Cái (non)';
    default:         return gender;
  }
};

interface HorseRowCardProps {
  horse: Horse;
  status: HorseStatus;
  onViewDetail: (id: string) => void;
}

const HorseRowCard: React.FC<HorseRowCardProps> = ({ horse, status, onViewDetail }) => {
  const age = new Date().getFullYear() - horse.birthYear;
  const horseIdRaw = (horse as any).horseId ?? horse.horseID;

  // Hồ sơ badge — từ adminApprovalStatus của horse gốc
  const profileStatus = (horse as any).adminApprovalStatus ?? horse.status;
  const profileBadge = getProfileBadge(profileStatus);

  // Enrollment badge — enrollment mới nhất (sort by createdAt desc)
  let enrollmentBadge: BadgeProps;
  if (status.loading) {
    enrollmentBadge = { label: 'Đang tải...', variant: 'gray' };
  } else if (status.enrollments === null) {
    enrollmentBadge = { label: 'Không tải được trạng thái giải', variant: 'gray' };
  } else if (status.enrollments.length === 0) {
    enrollmentBadge = { label: 'Chưa đăng ký giải', variant: 'gray' };
  } else {
    const latest = [...status.enrollments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    enrollmentBadge = getEnrollmentBadge(latest);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all">
      {/* Card header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-900 leading-tight">{horse.name}</h3>
        <Badge {...profileBadge} />
      </div>

      {/* Data rows */}
      <div className="px-4 py-3 space-y-1.5">
        {[
          { label: 'Giống',     value: horse.breed || (horse as any).breedCode || '—' },
          { label: 'Giới tính', value: getGenderLabel(horse.gender) },
          { label: 'Tuổi',      value: `${age} tuổi` },
          {
            label: 'Doping',
            value: (
              <span className={`font-medium ${getDopingColor(horse.dopingTestResult)}`}>
                {getDopingLabel(horse.dopingTestResult)}
              </span>
            ),
          },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{row.label}</span>
            <span className="text-gray-800 font-medium">{row.value}</span>
          </div>
        ))}

        {/* Enrollment status row */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
          <span className="text-gray-500">Trong giải</span>
          <Badge {...enrollmentBadge} />
        </div>
      </div>

      {/* Action */}
      <div className="px-4 pb-3">
        <button
          onClick={() => onViewDetail(String(horseIdRaw))}
          className="w-full text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 py-1.5 rounded transition-colors"
        >
          Xem chi tiết
        </button>
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const MyHorses: React.FC = () => {
  const navigate = useNavigate();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [horseStatuses, setHorseStatuses] = useState<Record<string, HorseStatus>>({});

  useEffect(() => {
    const fetchHorses = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMyHorses();
        if (data && data.length > 0) {
          setHorses(data);
          // Khởi tạo trạng thái loading cho từng ngựa
          const initial: Record<string, HorseStatus> = {};
          data.forEach((h) => {
            const hid = String((h as any).horseId ?? h.horseID ?? '');
            if (hid) initial[hid] = { enrollments: null, loading: true };
          });
          setHorseStatuses(initial);

          // Fetch enrollments song song, không để lỗi crash list
          data.forEach(async (h) => {
            const hid = (h as any).horseId ?? h.horseID;
            if (!hid) return;
            const key = String(hid);
            const enrollments = await getHorseEnrollments(hid);
            setHorseStatuses((prev) => ({
              ...prev,
              [key]: { enrollments, loading: false },
            }));
          });
        } else {
          setHorses([]);
          setError('Không có ngựa');
        }
      } catch (err) {
        console.error('Lỗi khi tải danh sách ngựa:', err);
        setHorses([]);
        setError('Không có ngựa');
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

  // Loading state
  if (loading) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ngựa của tôi</h1>
            <p className="text-sm text-gray-500 mt-0.5">Danh sách ngựa đã đăng ký</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
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

  // Empty / error state
  if (error || horses.length === 0) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ngựa của tôi</h1>
            <p className="text-sm text-gray-500 mt-0.5">Danh sách ngựa đã đăng ký</p>
          </div>
          <button
            onClick={handleRegisterHorse}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            + Đăng ký ngựa
          </button>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
          <p className="text-4xl mb-3">🐴</p>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            {error || 'Chưa có ngựa nào'}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            Đăng ký ngựa để bắt đầu tham gia giải đua.
          </p>
          <button
            onClick={handleRegisterHorse}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Đăng ký ngựa đầu tiên
          </button>
        </div>
      </div>
    );
  }

  // Horse list
  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">Ngựa của tôi</h1>
          <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-full">
            {horses.length}
          </span>
        </div>
        <button
          onClick={handleRegisterHorse}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          + Đăng ký ngựa mới
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.isArray(horses) && horses.map((horse) => {
          const hid = String((horse as any).horseId ?? horse.horseID ?? '');
          const status = horseStatuses[hid] ?? { enrollments: null, loading: true };
          return (
            <HorseRowCard
              key={hid || horse.name}
              horse={horse}
              status={status}
              onViewDetail={handleViewDetail}
            />
          );
        })}
      </div>
    </div>
  );
};

export default MyHorses;
