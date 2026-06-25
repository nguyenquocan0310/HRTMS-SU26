import React, { useState, useEffect } from 'react';
import type { JockeyProfile } from '../../types/jockey.types';
import { getMyProfile, updateMyProfile } from '../../services/jockeyService';
import type { UpdateProfilePayload } from '../../services/jockeyService';

interface FamilyMember {
  id: string;
  fullName: string;
  relationship: string;
  role: string;
  declaredDate: string;
}

const relationshipOptions = ['Cha', 'Mẹ', 'Vợ/Chồng', 'Anh/Chị/Em'];
const roleOptions = ['Chủ ngựa', 'Trọng tài', 'Huấn luyện viên', 'Ban tổ chức'];
const bloodTypeOptions = ['A', 'B', 'AB', 'O'];
const healthStatusOptions = ['Good', 'Fair', 'Poor'];

// Nhãn hiển thị tiếng Việt
const healthStatusLabel: Record<string, string> = {
  Good: 'Tốt',
  Fair: 'Trung bình',
  Poor: 'Kém',
};

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-500 mb-1.5">{label}</label>
      <div className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm flex items-center gap-2">
        <span className="text-gray-400 text-xs">🔒</span>
        {value}
      </div>
      <p className="mt-1 text-xs text-gray-400">Thông tin chỉ đọc, không thể chỉnh sửa</p>
    </div>
  );
}

function SkeletonField() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
      <div className="h-10 bg-gray-100 rounded-lg"></div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────

export default function ProfileDeclaration() {
  // ── Profile API state ──
  const [profile, setProfile] = useState<JockeyProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setProfileLoading(true);
        const data = await getMyProfile();
        setProfile(data);
      } catch (err) {
        console.error('Failed to fetch jockey profile:', err);
        setProfileError('Không thể tải thông tin hồ sơ. Vui lòng thử lại.');
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, []);

  // ── Editable professional info state ──
  const [editForm, setEditForm] = useState({
    licenseCertificate: '',
    experienceYears: 0,
    bloodType: '',
    healthStatus: '',
    selfDeclaredWeight: 0,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [editChanged, setEditChanged] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Sync edit form khi profile load xong
  useEffect(() => {
    if (profile) {
      setEditForm({
        licenseCertificate: profile.licenseCertificate,
        experienceYears: profile.experienceYears,
        bloodType: profile.bloodType,
        healthStatus: profile.healthStatus,
        selfDeclaredWeight: profile.selfDeclaredWeight,
      });
    }
  }, [profile]);

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: name === 'experienceYears' || name === 'selfDeclaredWeight'
        ? Number(value)
        : value,
    }));
    setEditChanged(true);
    setEditSaved(false);
  };

  const handleSaveProfessional = async () => {
    setEditSaving(true);
    setSaveSuccessMsg(null);
    setSaveErrorMsg(null);
    try {
      const payload: UpdateProfilePayload = {
        licenseCertificate: editForm.licenseCertificate,
        experienceYears: editForm.experienceYears,
        bloodType: editForm.bloodType,
        healthStatus: editForm.healthStatus,
        selfDeclaredWeight: editForm.selfDeclaredWeight,
      };
      const result = await updateMyProfile(payload);
      setSaveSuccessMsg('Cập nhật hồ sơ thành công.');
      setEditSaved(true);
      setEditChanged(false);
      setTimeout(() => {
        setEditSaved(false);
        setSaveSuccessMsg(null);
      }, 4000);
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.title ||
        'Đã xảy ra lỗi khi lưu thông tin. Vui lòng thử lại.';
      setSaveErrorMsg(msg);
      setTimeout(() => setSaveErrorMsg(null), 5000);
    } finally {
      setEditSaving(false);
    }
  };

  // ── COI Family state ──
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([
    {
      id: 'coi-001',
      fullName: 'Nguyễn Văn Bình',
      relationship: 'Cha',
      role: 'Chủ ngựa',
      declaredDate: '10/06/2026',
    },
  ]);
  const [memberForm, setMemberForm] = useState({ fullName: '', relationship: '', role: '' });
  const [memberFormError, setMemberFormError] = useState<string | null>(null);
  const [noConflict, setNoConflict] = useState(false);
  const [deleteConfirmID, setDeleteConfirmID] = useState<string | null>(null);

  const handleMemberFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setMemberForm((prev) => ({ ...prev, [name]: value }));
    setMemberFormError(null);
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.fullName.trim()) {
      setMemberFormError('Vui lòng nhập họ tên thành viên.');
      return;
    }
    if (!memberForm.relationship) {
      setMemberFormError('Vui lòng chọn quan hệ.');
      return;
    }
    if (!memberForm.role) {
      setMemberFormError('Vui lòng chọn vai trò trong giải.');
      return;
    }
    const newMember: FamilyMember = {
      id: `coi-${Date.now()}`,
      fullName: memberForm.fullName.trim(),
      relationship: memberForm.relationship,
      role: memberForm.role,
      declaredDate: new Date().toLocaleDateString('vi-VN'),
    };
    setFamilyMembers((prev) => [...prev, newMember]);
    setMemberForm({ fullName: '', relationship: '', role: '' });
    setMemberFormError(null);
  };

  const handleDeleteMember = (id: string) => {
    setFamilyMembers((prev) => prev.filter((m) => m.id !== id));
    setDeleteConfirmID(null);
  };

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">

        {/* ── Tiêu đề trang ── */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Hồ sơ &amp; Khai báo</h1>
          <p className="text-gray-500 text-sm">
            Xem thông tin tài khoản, cập nhật hồ sơ chuyên môn và khai báo xung đột lợi ích.
          </p>
        </div>

        {/* ════════════════════════════════════════
            SECTION 1 — Thông tin tài khoản (chỉ đọc)
        ════════════════════════════════════════ */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-slate-500 text-white text-sm font-bold flex items-center justify-center">
              1
            </span>
            Thông tin tài khoản
            <span className="ml-2 text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              Chỉ đọc
            </span>
          </h2>

          {profileLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => <SkeletonField key={i} />)}
            </div>
          ) : profileError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              ⚠️ {profileError}
            </div>
          ) : profile ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ReadOnlyField label="Tên đăng nhập" value={profile.username} />
              <ReadOnlyField label="Họ và tên" value={profile.fullName} />
              <ReadOnlyField label="Email" value={profile.email} />
            </div>
          ) : null}
        </div>

        {/* ════════════════════════════════════════
            SECTION 2 — Thông tin chuyên môn (có thể chỉnh sửa)
        ════════════════════════════════════════ */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
              2
            </span>
            Thông tin chuyên môn
            <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              ✏️ Có thể chỉnh sửa
            </span>
          </h2>

          {profileLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(5)].map((_, i) => <SkeletonField key={i} />)}
            </div>
          ) : profileError ? null : profile ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

                {/* Chứng chỉ hành nghề */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Số chứng chỉ hành nghề
                  </label>
                  <input
                    type="text"
                    name="licenseCertificate"
                    value={editForm.licenseCertificate}
                    onChange={handleEditChange}
                    placeholder="VD: LIC-JOCKEY-2026-01"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                  />
                </div>

                {/* Năm kinh nghiệm */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Số năm kinh nghiệm
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name="experienceYears"
                      value={editForm.experienceYears}
                      onChange={handleEditChange}
                      min={0}
                      max={50}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                    />
                    <span className="text-gray-500 text-sm font-medium whitespace-nowrap">năm</span>
                  </div>
                </div>

                {/* Nhóm máu */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nhóm máu
                  </label>
                  <select
                    name="bloodType"
                    value={editForm.bloodType}
                    onChange={handleEditChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm bg-white"
                  >
                    <option value="">— Chọn nhóm máu —</option>
                    {bloodTypeOptions.map((bt) => (
                      <option key={bt} value={bt}>{bt}</option>
                    ))}
                  </select>
                </div>

                {/* Tình trạng sức khoẻ */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tình trạng sức khoẻ
                  </label>
                  <select
                    name="healthStatus"
                    value={editForm.healthStatus}
                    onChange={handleEditChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm bg-white"
                  >
                    <option value="">— Chọn tình trạng —</option>
                    {healthStatusOptions.map((hs) => (
                      <option key={hs} value={hs}>{healthStatusLabel[hs] ?? hs}</option>
                    ))}
                  </select>
                </div>

                {/* Cân nặng tự khai */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Cân nặng tự khai (kg)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      name="selfDeclaredWeight"
                      value={editForm.selfDeclaredWeight}
                      onChange={handleEditChange}
                      min={40}
                      max={120}
                      step={0.1}
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                    />
                    <span className="text-gray-500 text-sm font-medium">kg</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    * Có thể được ban tổ chức xác minh lại.
                  </p>
                </div>
              </div>

              {/* Nút lưu */}
              <div className="border-t border-gray-100 pt-5 space-y-3">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleSaveProfessional}
                    disabled={editSaving || !editChanged}
                    className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                      editSaving || !editChanged
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md'
                    }`}
                  >
                    {editSaving ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                        Đang lưu...
                      </>
                    ) : (
                      'Lưu thay đổi'
                    )}
                  </button>

                  {editChanged && !editSaved && !editSaving && (
                    <span className="text-amber-600 text-xs">
                      • Có thay đổi chưa được lưu
                    </span>
                  )}
                </div>

                {/* Toast thành công — hiển thị message từ API */}
                {saveSuccessMsg && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-green-700 text-sm font-medium">
                    <span className="text-base">✅</span>
                    {saveSuccessMsg}
                  </div>
                )}

                {/* Toast lỗi */}
                {saveErrorMsg && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-red-700 text-sm">
                    <span className="text-base">⚠️</span>
                    {saveErrorMsg}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* ════════════════════════════════════════
            SECTION 3 — Khai báo xung đột lợi ích
        ════════════════════════════════════════ */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">
              3
            </span>
            Khai báo xung đột lợi ích
          </h2>
          <p className="text-gray-500 text-sm mb-5 ml-9">
            Vui lòng khai báo nếu có thân nhân là Chủ ngựa hoặc Trọng tài trong giải đấu
          </p>

          {/* Form thêm thành viên */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">➕ Thêm khai báo mới</h3>

            {memberFormError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">⚠️ {memberFormError}</p>
              </div>
            )}

            <form onSubmit={handleAddMember} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Họ tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={memberForm.fullName}
                  onChange={handleMemberFormChange}
                  placeholder="Nhập họ và tên"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Quan hệ <span className="text-red-500">*</span>
                </label>
                <select
                  name="relationship"
                  value={memberForm.relationship}
                  onChange={handleMemberFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm bg-white"
                >
                  <option value="">— Chọn quan hệ —</option>
                  {relationshipOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Vai trò trong giải <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={memberForm.role}
                  onChange={handleMemberFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm bg-white"
                >
                  <option value="">— Chọn vai trò —</option>
                  {roleOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  + Thêm khai báo
                </button>
              </div>
            </form>
          </div>

          {/* Bảng danh sách đã khai */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              📋 Danh sách thành viên đã khai báo
              <span className="ml-2 text-xs text-gray-400 font-normal bg-gray-100 px-2 py-0.5 rounded-full">
                {familyMembers.length} thành viên
              </span>
            </h3>

            {familyMembers.length === 0 ? (
              <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <p className="text-sm">Chưa có khai báo nào. Thêm thành viên ở phía trên.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Họ tên</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Quan hệ</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Vai trò</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Ngày khai</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {familyMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-800">{member.fullName}</td>
                        <td className="px-4 py-3 text-gray-600">{member.relationship}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            {member.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{member.declaredDate}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setDeleteConfirmID(member.id)}
                            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-lg transition-colors"
                          >
                            🗑 Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Checkbox xác nhận không có xung đột */}
          <div className="border-t border-gray-100 pt-5">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={noConflict}
                onChange={(e) => setNoConflict(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                Tôi xác nhận <strong>không có xung đột lợi ích</strong> nào khác chưa được khai báo
                và cam kết cung cấp thông tin trung thực theo quy định.
              </span>
            </label>
            {noConflict && (
              <div className="mt-3 ml-7 text-xs text-green-600 font-medium flex items-center gap-1">
                ✅ Đã xác nhận không có xung đột lợi ích khác.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dialog xác nhận xóa ── */}
      {deleteConfirmID && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🗑️</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Xác nhận xóa khai báo</h2>
              <p className="text-gray-600 text-sm">
                Bạn có chắc muốn xóa khai báo thành viên này? Thao tác này không thể hoàn tác.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmID(null)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => handleDeleteMember(deleteConfirmID)}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
