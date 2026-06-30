import React, { useState } from 'react';

interface ProtestProps {
  userRole: 'HorseOwner' | 'Jockey';
}

interface ProtestForm {
  raceID: string;
  targetName: string;
  reason: string;
}

interface ProtestRecord {
  protestID: string;
  race: string;
  submittedDate: string;
  status: 'Đang xử lý' | 'Chấp thuận' | 'Bác bỏ';
  verdict: string;
}

const mockRaces = [
  { id: 'R001', label: 'Giải Mùa Hè 2026 – Vòng 1 (20/06/2026)' },
  { id: 'R002', label: 'Giải Vô Địch 2026 – Chung kết (22/06/2026)' },
  { id: 'R003', label: 'Giải Mở Rộng 2026 – Bán kết (18/06/2026)' },
];

const mockProtests: ProtestRecord[] = [
  {
    protestID: 'KN-001',
    race: 'Giải Mùa Hè 2026 – Vòng 1',
    submittedDate: '21/06/2026',
    status: 'Đang xử lý',
    verdict: '—',
  },
  {
    protestID: 'KN-002',
    race: 'Giải Vô Địch 2026 – Chung kết',
    submittedDate: '23/06/2026',
    status: 'Chấp thuận',
    verdict: 'Kết quả được điều chỉnh lại theo yêu cầu khiếu nại.',
  },
];

const STATUS_CFG: Record<
  ProtestRecord['status'],
  { cls: string; dot: string }
> = {
  'Đang xử lý': { cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  'Chấp thuận': { cls: 'bg-green-50 text-green-700 border-green-200',    dot: 'bg-green-500'  },
  'Bác bỏ':     { cls: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-500'    },
};

function ProtestStatusBadge({ status }: { status: ProtestRecord['status'] }) {
  const cfg = STATUS_CFG[status] ?? { cls: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {status}
    </span>
  );
}

const MIN_REASON_LENGTH = 20;

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all';

export default function Protest({ userRole }: ProtestProps) {
  const [form, setForm] = useState<ProtestForm>({
    raceID: '',
    targetName: '',
    reason: '',
  });
  const [protests, setProtests] = useState<ProtestRecord[]>(mockProtests);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const roleLabel = userRole === 'HorseOwner' ? 'Chủ ngựa' : 'Kỵ sĩ';
  const targetPlaceholder = 'Nhập tên ngựa / kỵ sĩ bị khiếu nại';

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormError(null);
    setSubmitted(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.raceID) {
      setFormError('Vui lòng chọn cuộc đua bị khiếu nại.');
      return;
    }
    if (!form.targetName.trim()) {
      setFormError('Vui lòng nhập đối tượng bị khiếu nại.');
      return;
    }
    if (form.reason.trim().length < MIN_REASON_LENGTH) {
      setFormError(`Lý do khiếu nại phải có ít nhất ${MIN_REASON_LENGTH} ký tự.`);
      return;
    }

    const selectedRace = mockRaces.find((r) => r.id === form.raceID);
    const newProtest: ProtestRecord = {
      protestID: `KN-${String(protests.length + 1).padStart(3, '0')}`,
      race: selectedRace?.label ?? form.raceID,
      submittedDate: new Date().toLocaleDateString('vi-VN'),
      status: 'Đang xử lý',
      verdict: '—',
    };

    setProtests((prev) => [newProtest, ...prev]);
    setForm({ raceID: '', targetName: '', reason: '' });
    setSubmitted(true);
    setFormError(null);
  };

  return (
    <div className="max-w-4xl">
      {/* Page header */}
      <div className="mb-5 flex items-center gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Khiếu nại kết quả</h1>
          <p className="text-sm text-gray-500 mt-0.5">Nộp khiếu nại và theo dõi tiến trình xử lý.</p>
        </div>
        <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded border border-blue-100">
          {roleLabel}
        </span>
      </div>

      {/* ===== SECTION 1: Submission form ===== */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-5">
        {/* Section header */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            1
          </span>
          <p className="text-sm font-semibold text-gray-700">Nộp khiếu nại mới</p>
        </div>

        <div className="p-5">
          {/* Success message */}
          {submitted && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-start gap-2">
              <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
              <div>
                <p className="text-sm font-semibold text-green-800">Khiếu nại đã được nộp thành công!</p>
                <p className="text-xs text-green-700 mt-0.5">Chúng tôi sẽ xem xét và phản hồi trong thời gian sớm nhất.</p>
              </div>
            </div>
          )}

          {/* Error */}
          {formError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-red-700 font-medium">⚠️ {formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Race select */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Cuộc đua bị khiếu nại <span className="text-red-500">*</span>
              </label>
              <select
                name="raceID"
                value={form.raceID}
                onChange={handleChange}
                className={inputCls}
              >
                <option value="">— Chọn cuộc đua —</option>
                {mockRaces.map((race) => (
                  <option key={race.id} value={race.id}>{race.label}</option>
                ))}
              </select>
            </div>

            {/* Target name */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Đối tượng bị khiếu nại <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="targetName"
                value={form.targetName}
                onChange={handleChange}
                placeholder={targetPlaceholder}
                className={inputCls}
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Lý do khiếu nại <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-1">(tối thiểu {MIN_REASON_LENGTH} ký tự)</span>
              </label>
              <textarea
                name="reason"
                value={form.reason}
                onChange={handleChange}
                rows={4}
                placeholder="Mô tả chi tiết lý do khiếu nại của bạn..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
              />
              <div className="mt-1 flex justify-end">
                <span className={`text-xs ${form.reason.length < MIN_REASON_LENGTH ? 'text-red-400' : 'text-green-600'}`}>
                  {form.reason.length}/{MIN_REASON_LENGTH} ký tự tối thiểu
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Nộp khiếu nại
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ===== SECTION 2: Protest history ===== */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
              2
            </span>
            <p className="text-sm font-semibold text-gray-700">Danh sách khiếu nại đã nộp</p>
          </div>
          <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500 rounded-full">
            {protests.length} khiếu nại
          </span>
        </div>

        {protests.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            Bạn chưa nộp khiếu nại nào.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mã KN</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cuộc đua</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ngày nộp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Trạng thái</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Phán quyết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {protests.map((protest) => (
                  <tr key={protest.protestID} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">
                      {protest.protestID}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{protest.race}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{protest.submittedDate}</td>
                    <td className="px-4 py-3">
                      <ProtestStatusBadge status={protest.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      {protest.verdict === '—' ? (
                        <span className="text-xs text-gray-400 italic">Chưa có phán quyết</span>
                      ) : (
                        <span className="text-xs">{protest.verdict}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
