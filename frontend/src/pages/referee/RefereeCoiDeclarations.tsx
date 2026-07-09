import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createFamilyDeclaration,
  deleteFamilyDeclaration,
  getFamilyDeclarations,
  updateFamilyDeclaration,
  type FamilyDeclaration,
  type FamilyDeclarationPayload,
} from '../../services/familyDeclarationService';

const RELATION_OPTIONS = ['Spouse', 'Parent', 'Child', 'Sibling'];
const ROLE_OPTIONS = ['Owner', 'Jockey', 'Referee', 'Doctor'];

interface FormState {
  relatedPersonName: string;
  relatedUserId: string;
  relationType: string;
  industryRole: string;
  notes: string;
}

const emptyForm: FormState = {
  relatedPersonName: '',
  relatedUserId: '',
  relationType: 'Spouse',
  industryRole: 'Owner',
  notes: '',
};

function toPayload(form: FormState): FamilyDeclarationPayload {
  const relatedUserId = form.relatedUserId.trim();
  return {
    relatedPersonName: form.relatedPersonName.trim(),
    relatedUserId: relatedUserId ? Number(relatedUserId) : null,
    relationType: form.relationType,
    industryRole: form.industryRole,
    notes: form.notes.trim(),
  };
}

function toForm(item: FamilyDeclaration): FormState {
  return {
    relatedPersonName: item.relatedPersonName ?? item.relatedUserFullName ?? '',
    relatedUserId: item.relatedUserId ? String(item.relatedUserId) : '',
    relationType: item.relationType || 'Spouse',
    industryRole: item.industryRole || item.relatedUserRole || 'Owner',
    notes: item.notes ?? '',
  };
}

function formatDateTime(value: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RefereeCoiDeclarations() {
  const [items, setItems] = useState<FamilyDeclaration[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<FamilyDeclaration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => new Date(b.declaredAt).getTime() - new Date(a.declaredAt).getTime()),
    [items]
  );

  const loadDeclarations = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setItems(await getFamilyDeclarations());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải khai báo COI.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeclarations();
  }, [loadDeclarations]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
    setFormError('');
  };

  const validateForm = () => {
    if (!form.relatedPersonName.trim()) {
      setFormError('Vui lòng nhập tên người liên quan.');
      return false;
    }
    if (form.relatedUserId.trim()) {
      const parsed = Number(form.relatedUserId);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        setFormError('User ID liên quan phải là số dương.');
        return false;
      }
    }
    setFormError('');
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      const payload = toPayload(form);
      if (editing) {
        await updateFamilyDeclaration(editing.declarationId, payload);
        showToast('Đã cập nhật khai báo COI.');
      } else {
        await createFamilyDeclaration(payload);
        showToast('Đã thêm khai báo COI.');
      }
      resetForm();
      await loadDeclarations();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Lưu khai báo COI thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: FamilyDeclaration) => {
    const relatedName = item.relatedUserFullName || item.relatedPersonName;
    if (!window.confirm(`Xóa khai báo COI của ${relatedName}?`)) return;

    try {
      setDeletingId(item.declarationId);
      await deleteFamilyDeclaration(item.declarationId);
      showToast('Đã xóa khai báo COI.');
      if (editing?.declarationId === item.declarationId) resetForm();
      await loadDeclarations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa khai báo COI thất bại.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-2 border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Khai báo COI</h1>
        <p className="text-sm text-gray-500">
          Khai báo quan hệ gia đình để hệ thống kiểm tra xung đột lợi ích khi Admin phân công trọng tài vào race.
        </p>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        Referee chỉ khai báo dữ liệu quan hệ. Backend sẽ tự chạy COI Check khi Admin assign Referee vào race.
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm xl:col-span-1">
          <div className="mb-4">
            <h2 className="text-base font-bold text-gray-900">{editing ? 'Sửa khai báo' : 'Thêm khai báo'}</h2>
            <p className="mt-1 text-xs text-gray-500">Nhập người liên quan để hệ thống đối chiếu COI.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {formError}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Người liên quan
              </label>
              <input
                value={form.relatedPersonName}
                onChange={(event) => setForm({ ...form, relatedPersonName: event.target.value })}
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                placeholder="VD: Nguyễn Văn A"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                User ID liên quan
              </label>
              <input
                type="number"
                min="1"
                value={form.relatedUserId}
                onChange={(event) => setForm({ ...form, relatedUserId: event.target.value })}
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                placeholder="Không bắt buộc"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Quan hệ
                </label>
                <select
                  value={form.relationType}
                  onChange={(event) => setForm({ ...form, relationType: event.target.value })}
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                >
                  {RELATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Vai trò
                </label>
                <select
                  value={form.industryRole}
                  onChange={(event) => setForm({ ...form, industryRole: event.target.value })}
                  className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                >
                  {ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                Ghi chú
              </label>
              <textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                className="min-h-[96px] w-full resize-y rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                placeholder="Không bắt buộc"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {saving ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Thêm khai báo'}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Hủy
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm xl:col-span-2">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Danh sách khai báo</h2>
              <p className="mt-1 text-xs text-gray-500">{items.length} khai báo COI</p>
            </div>
            <button
              onClick={loadDeclarations}
              disabled={loading}
              className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Làm mới
            </button>
          </div>

          {error && <div className="m-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Đang tải khai báo COI...</div>
          ) : sortedItems.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-semibold text-gray-700">Bạn chưa có khai báo COI nào.</p>
              <p className="mt-1 text-xs text-gray-400">Thêm người liên quan nếu có quan hệ cần khai báo.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Người liên quan</th>
                    <th className="px-5 py-3 font-semibold">Vai trò</th>
                    <th className="px-5 py-3 font-semibold">Quan hệ</th>
                    <th className="px-5 py-3 font-semibold">Ghi chú</th>
                    <th className="px-5 py-3 font-semibold">Ngày khai báo</th>
                    <th className="px-5 py-3 text-right font-semibold">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedItems.map((item) => {
                    const relatedName = item.relatedUserFullName || item.relatedPersonName;
                    const role = item.relatedUserRole || item.industryRole;
                    const isDeleting = deletingId === item.declarationId;

                    return (
                      <tr key={item.declarationId} className="hover:bg-gray-50/50">
                        <td className="px-5 py-4 font-semibold text-gray-900">{relatedName}</td>
                        <td className="px-5 py-4 text-gray-700">{role}</td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {item.relationType}
                          </span>
                        </td>
                        <td className="max-w-[240px] px-5 py-4 text-gray-600">{item.notes || '-'}</td>
                        <td className="px-5 py-4 text-xs text-gray-500">{formatDateTime(item.declaredAt)}</td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditing(item);
                                setForm(toForm(item));
                                setFormError('');
                              }}
                              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                            >
                              Sửa
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              disabled={isDeleting}
                              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                            >
                              {isDeleting ? 'Đang xóa...' : 'Xóa'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
