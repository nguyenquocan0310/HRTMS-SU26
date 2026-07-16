import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Horse } from '../../types/owner.types';
import type { HorseEnrollmentResponse } from '../../services/ownerService';
import { getHorseById, getHorseEnrollments } from '../../services/ownerService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Status Badges ────────────────────────────────────────────────────────────

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

const getProfileBadge = (status: string | undefined): BadgeProps => {
  switch (status) {
    case 'Approved': return { label: 'Hồ sơ đã duyệt',   variant: 'green'  };
    case 'Rejected': return { label: 'Hồ sơ bị từ chối', variant: 'red'    };
    case 'Pending':
    default:         return { label: 'Hồ sơ chờ duyệt',  variant: 'yellow' };
  }
};

const getEnrollmentBadge = (enrollment: HorseEnrollmentResponse): BadgeProps => {
  switch (enrollment.adminApprovalStatus) {
    case 'Approved': return { label: 'Trong giải: Đã duyệt',       variant: 'green'  };
    case 'Rejected': return { label: 'Trong giải: Bị từ chối',      variant: 'red'    };
    case 'Pending':
    default:         return { label: 'Trong giải: Chờ Admin duyệt', variant: 'yellow' };
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function HorseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [horse, setHorse] = useState<Horse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Enrollment state
  const [enrollments, setEnrollments] = useState<HorseEnrollmentResponse[] | null>(null);
  const [enrollmentLoading, setEnrollmentLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchHorse = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const horseIdNum = Number(id);
        if (!isNaN(horseIdNum)) {
          const data = await getHorseById(horseIdNum);
          setHorse(data);
          // Fetch enrollments sau khi có horse (không block render)
          setEnrollmentLoading(true);
          getHorseEnrollments(horseIdNum).then((result) => {
            setEnrollments(result);
            setEnrollmentLoading(false);
          });
        } else {
          setError('Không tìm thấy thông tin ngựa');
        }
      } catch (err) {
        console.error(`Lỗi khi tải chi tiết ngựa ID ${id}:`, err);
        setError('Không tìm thấy thông tin ngựa');
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
  const profileStatus = horse.adminApprovalStatus ?? horse.status;
  const profileBadge = getProfileBadge(profileStatus);

  // Enrollment mới nhất
  const latestEnrollment = enrollments && enrollments.length > 0
    ? [...enrollments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    : null;

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
    <div className="max-w-5xl">
      {/* Back link */}
      <button
        onClick={() => navigate('/owner/horses')}
        className="text-sm text-blue-700 hover:text-blue-800 font-bold mb-5"
      >
        Quay lại danh sách
      </button>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">{horse.name}</h1>
          {horse.identifyingMarks && (
            <p className="text-sm text-slate-500 mt-2">{horse.identifyingMarks}</p>
          )}
        </div>
        {/* Hai badge riêng biệt: Hồ sơ và Trong giải */}
        <div className="flex flex-col items-end gap-1.5">
          <Badge {...profileBadge} />
          {enrollmentLoading ? (
            <Badge label="Đang tải trạng thái giải..." variant="gray" />
          ) : enrollments === null ? (
            <Badge label="Không tải được trạng thái giải" variant="gray" />
          ) : latestEnrollment ? (
            <Badge {...getEnrollmentBadge(latestEnrollment)} />
          ) : (
            <Badge label="Chưa đăng ký giải" variant="gray" />
          )}
        </div>
      </div>

      {/* Rejection reason (hồ sơ bị từ chối) */}
      {profileStatus === 'Rejected' && horse.rejectionReason && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-red-700 mb-0.5">Lý do từ chối hồ sơ</p>
          <p className="text-sm text-red-700">{horse.rejectionReason}</p>
        </div>
      )}

      {/* Rejection reason (enrollment bị từ chối) */}
      {latestEnrollment?.adminApprovalStatus === 'Rejected' && latestEnrollment.rejectionReason && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-orange-700 mb-0.5">Lý do từ chối trong giải</p>
          <p className="text-sm text-orange-700">{latestEnrollment.rejectionReason}</p>
        </div>
      )}

      {/* Enrollment info panel (nếu có) */}
      {latestEnrollment && (
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-blue-700 mb-1">Thông tin giải đang tham gia</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-blue-800">
            {latestEnrollment.tournamentName && (
              <>
                <span className="text-blue-600">Giải đấu</span>
                <span className="font-medium">{latestEnrollment.tournamentName}</span>
              </>
            )}
            <span className="text-blue-600">Mã đăng ký</span>
            <span className="font-medium">#{latestEnrollment.enrollmentId}</span>
            <span className="text-blue-600">Đăng ký lúc</span>
            <span className="font-medium">{new Date(latestEnrollment.createdAt).toLocaleDateString('vi-VN')}</span>
          </div>
        </div>
      )}

      {/* Detail panel */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Thông tin chi tiết</p>
        </div>
        <div className="divide-y divide-gray-100">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center px-6 py-4 text-sm">
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
          className="px-5 py-2.5 text-sm font-bold text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
        >
          Quay lại
        </button>
        <button
          onClick={() => navigate(`/owner/horses/edit/${horse.horseId || horse.horseID || id || ''}`)}
          className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-full transition-colors"
        >
          Cập nhật thông tin
        </button>
      </div>
    </div>
  );
}
