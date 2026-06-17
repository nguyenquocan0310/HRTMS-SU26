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

const getStatusBadge = (status: ProtestRecord['status']) => {
  switch (status) {
    case 'Đang xử lý':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
          ⏳ Đang xử lý
        </span>
      );
    case 'Chấp thuận':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
          ✅ Chấp thuận
        </span>
      );
    case 'Bác bỏ':
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
          ❌ Bác bỏ
        </span>
      );
  }
};

const MIN_REASON_LENGTH = 20;

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
  const targetPlaceholder =
    userRole === 'HorseOwner'
      ? 'Nhập tên ngựa / kỵ sĩ bị khiếu nại'
      : 'Nhập tên ngựa / kỵ sĩ bị khiếu nại';

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
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Tiêu đề trang */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-gray-800">Khiếu nại kết quả</h1>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
              {roleLabel}
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            Nộp khiếu nại về kết quả cuộc đua và theo dõi tiến trình xử lý.
          </p>
        </div>

        {/* ===== SECTION 1: Form nộp khiếu nại ===== */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-5 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">1</span>
            Nộp khiếu nại mới
          </h2>

          {/* Thông báo nộp thành công */}
          {submitted && (
            <div className="mb-5 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <span className="text-xl">✅</span>
              <div>
                <p className="text-green-800 font-semibold text-sm">Khiếu nại đã được nộp thành công!</p>
                <p className="text-green-700 text-xs">Chúng tôi sẽ xem xét và phản hồi trong thời gian sớm nhất.</p>
              </div>
            </div>
          )}

          {/* Thông báo lỗi */}
          {formError && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm font-medium">⚠️ {formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Chọn cuộc đua */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Cuộc đua bị khiếu nại <span className="text-red-500">*</span>
              </label>
              <select
                name="raceID"
                value={form.raceID}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
              >
                <option value="">— Chọn cuộc đua —</option>
                {mockRaces.map((race) => (
                  <option key={race.id} value={race.id}>
                    {race.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Đối tượng bị khiếu nại */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Đối tượng bị khiếu nại <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="targetName"
                value={form.targetName}
                onChange={handleChange}
                placeholder={targetPlaceholder}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
              />
            </div>

            {/* Lý do khiếu nại */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Lý do khiếu nại <span className="text-red-500">*</span>
                <span className="text-gray-400 font-normal ml-2">(tối thiểu {MIN_REASON_LENGTH} ký tự)</span>
              </label>
              <textarea
                name="reason"
                value={form.reason}
                onChange={handleChange}
                rows={4}
                placeholder="Mô tả chi tiết lý do khiếu nại của bạn..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm resize-none"
              />
              <div className="mt-1 flex justify-end">
                <span className={`text-xs ${form.reason.length < MIN_REASON_LENGTH ? 'text-red-400' : 'text-green-600'}`}>
                  {form.reason.length}/{MIN_REASON_LENGTH} ký tự tối thiểu
                </span>
              </div>
            </div>

            {/* Nút nộp */}
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-sm"
              >
                📨 Nộp khiếu nại
              </button>
            </div>
          </form>
        </div>

        {/* ===== SECTION 2: Danh sách khiếu nại đã nộp ===== */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">2</span>
              Danh sách khiếu nại đã nộp
            </h2>
            <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
              {protests.length} khiếu nại
            </span>
          </div>

          {protests.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm">Bạn chưa nộp khiếu nại nào.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3.5 text-left font-semibold text-gray-700">Mã khiếu nại</th>
                    <th className="px-5 py-3.5 text-left font-semibold text-gray-700">Cuộc đua</th>
                    <th className="px-5 py-3.5 text-left font-semibold text-gray-700">Ngày nộp</th>
                    <th className="px-5 py-3.5 text-left font-semibold text-gray-700">Trạng thái</th>
                    <th className="px-5 py-3.5 text-left font-semibold text-gray-700">Phán quyết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {protests.map((protest) => (
                    <tr key={protest.protestID} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4 font-mono text-blue-700 font-semibold text-xs">
                        {protest.protestID}
                      </td>
                      <td className="px-5 py-4 text-gray-700">{protest.race}</td>
                      <td className="px-5 py-4 text-gray-600">{protest.submittedDate}</td>
                      <td className="px-5 py-4">{getStatusBadge(protest.status)}</td>
                      <td className="px-5 py-4 text-gray-600 max-w-xs">
                        {protest.verdict === '—' ? (
                          <span className="text-gray-400 italic">Chưa có phán quyết</span>
                        ) : (
                          <span className="text-sm">{protest.verdict}</span>
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
    </div>
  );
}
