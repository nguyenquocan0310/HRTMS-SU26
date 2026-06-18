import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface COIDeclaration {
  id: string;
  raceName: string;
  partyName: string;
  relationType: string;
  description: string;
  declaredAt: string;
}

export default function RefereeDashboard() {
  const navigate = useNavigate();
  const [showPendingBanner, setShowPendingBanner] = useState(true);
  
  // COI Form State
  const [raceName, setRaceName] = useState('');
  const [partyName, setPartyName] = useState('');
  const [relationType, setRelationType] = useState('');
  const [description, setDescription] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [declarations, setDeclarations] = useState<COIDeclaration[]>([
    {
      id: 'COI-001',
      raceName: 'Lượt 1 - Giải Derby Mùa Hè',
      partyName: 'Ngựa Thần Phong (Số 5)',
      relationType: 'Chủ sở hữu cũ',
      description: 'Tôi từng sở hữu ngựa này 2 năm trước khi bán cho chủ hiện tại.',
      declaredAt: '18/06/2026 08:00'
    }
  ]);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Duty assignment data
  const duties = [
    { id: 'R-01', name: 'Lượt 1 - Giải Derby Mùa Hè', time: '09:00', role: 'Trọng tài biên', status: 'Đã kết thúc' },
    { id: 'R-02', name: 'Lượt 2 - Giải Vô Địch Quốc Gia', time: '14:30', role: 'Trọng tài chính', status: 'Đang diễn ra' },
    { id: 'R-03', name: 'Lượt 3 - Cúp Tốc Độ Hà Nội', time: '16:00', role: 'Trọng tài biên', status: 'Sắp diễn ra' },
  ];

  const handleCOISubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!raceName || !partyName || !relationType || !isAgreed) return;

    const newCOI: COIDeclaration = {
      id: `COI-00${declarations.length + 2}`,
      raceName,
      partyName,
      relationType,
      description,
      declaredAt: new Date().toLocaleString('vi-VN'),
    };

    setDeclarations([newCOI, ...declarations]);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);

    // Reset Form
    setRaceName('');
    setPartyName('');
    setRelationType('');
    setDescription('');
    setIsAgreed(false);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Bảng điều khiển</h1>
          <p className="text-slate-500 mt-1">Hệ thống giám sát điều hành và xử lý khiếu nại dành cho Trọng tài.</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm w-fit">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-semibold text-slate-700">Trực tuyến (18/06/2026)</span>
        </div>
      </div>

      {/* 1. Yellow banner for Pending Approval */}
      {showPendingBanner && (
        <div className="relative bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm flex items-start space-x-4 animate-slide-in">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-amber-900 text-sm">Tài khoản đang chờ duyệt bổ sung nhiệm vụ</h3>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              Tài khoản trọng tài chính của bạn đang chờ Hội đồng Trọng tài Quốc gia xác nhận hồ sơ năm 2026. Một số tính năng biểu quyết nâng cao có thể tạm khóa cho tới khi có phê duyệt chính thức.
            </p>
          </div>
          <button 
            onClick={() => setShowPendingBanner(false)}
            className="text-amber-500 hover:text-amber-700 transition-colors p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 2. Grid of 4 index cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Cuộc đua hôm nay</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-baseline">
            <span className="text-3xl font-extrabold text-slate-900">3</span>
            <span className="ml-2 text-xs font-semibold text-slate-500">lượt đua</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Đang diễn ra</span>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl relative">
              <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-8.22-.07m1.41-1.41a4 4 0 015.4 0m-4.24-1.42a2 2 0 013.07 0M12 9.75v.008h-.008V9.75H12z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-rose-600">1</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100 animate-pulse">
              TRỰC TIẾP
            </span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Vi phạm đã ghi</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-baseline">
            <span className="text-3xl font-extrabold text-slate-900">2</span>
            <span className="ml-2 text-xs font-semibold text-slate-500">lỗi ghi nhận</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Khiếu nại chờ xử lý</span>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 flex items-baseline">
            <span className="text-3xl font-extrabold text-slate-900">1</span>
            <span className="ml-2 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Cần duyệt</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 3. COI Declaration Form (Xung đột lợi ích) */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 pb-4 border-b border-slate-100 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-indigo-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.03 0 1.9.693 2.166 1.638m-7.377 0A48.536 48.536 0 0112 3c1.73 0 3.427.109 5.086.321m-9.041-.32a4.847 4.847 0 00-.317 1.5H4.25a2.25 2.25 0 00-2.25 2.25v12.75a2.25 2.25 0 002.25 2.25h11.5" />
              </svg>
              <h2 className="text-lg font-bold text-slate-900">Khai báo Xung đột lợi ích (COI)</h2>
            </div>
            
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Trọng tài bắt buộc phải kê khai mọi quan hệ cá nhân, tài chính hoặc lịch sử sở hữu với bất kỳ ngựa đua hoặc kỵ sĩ nào trong các lượt đua được phân công.
            </p>

            <form onSubmit={handleCOISubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Lượt đua cần khai báo *</label>
                <select
                  value={raceName}
                  onChange={(e) => setRaceName(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-800"
                >
                  <option value="">-- Chọn lượt đua --</option>
                  <option value="Lượt 2 - Giải Vô Địch Quốc Gia">Lượt 2 - Giải Vô Địch Quốc Gia</option>
                  <option value="Lượt 3 - Cúp Tốc Độ Hà Nội">Lượt 3 - Cúp Tốc Độ Hà Nội</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ngựa hoặc Kỵ sĩ liên quan *</label>
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="Ví dụ: Kỵ sĩ Trần Văn A hoặc Ngựa Chiến Thần"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mối quan hệ *</label>
                <select
                  value={relationType}
                  onChange={(e) => setRelationType(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-800"
                >
                  <option value="">-- Chọn loại quan hệ --</option>
                  <option value="Họ hàng ruột thịt">Họ hàng / Người thân thiết</option>
                  <option value="Chủ sở hữu cũ">Lịch sử huấn luyện / Chủ cũ</option>
                  <option value="Chung lợi ích tài chính">Lợi ích tài chính / Quảng cáo</option>
                  <option value="Khác">Lý do khác</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mô tả chi tiết tình huống</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Nêu rõ thông tin xung đột lợi ích để Ban tổ chức ghi nhận..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800"
                />
              </div>

              <div className="flex items-start space-x-2 pt-2">
                <input
                  id="coi-agree"
                  type="checkbox"
                  checked={isAgreed}
                  onChange={(e) => setIsAgreed(e.target.checked)}
                  required
                  className="mt-1 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="coi-agree" className="text-xs text-slate-600 leading-normal select-none">
                  Tôi cam kết thông tin khai báo trên là chính xác và hoàn toàn trung thực trước Hội đồng.
                </label>
              </div>

              <button
                type="submit"
                disabled={!isAgreed}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all duration-200 text-center ${
                  isAgreed
                    ? 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95 shadow-sm'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                Gửi bản khai báo COI
              </button>
            </form>
          </div>

          {/* Success Toast */}
          {showSuccessToast && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center space-x-2 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-emerald-600">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.859-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <span>Khai báo thành công!</span>
            </div>
          )}
        </div>

        {/* 4. Duty assignment table and declared list */}
        <div className="lg:col-span-2 space-y-6">
          {/* Duty Assignments */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-blue-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <h2 className="text-lg font-bold text-slate-900">Lịch phân công điều hành</h2>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">Hôm nay</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3 font-semibold">Lượt đua</th>
                    <th className="pb-3 font-semibold">Giờ bắt đầu</th>
                    <th className="pb-3 font-semibold">Vai trò</th>
                    <th className="pb-3 font-semibold">Trạng thái</th>
                    <th className="pb-3 font-semibold text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {duties.map((duty) => (
                    <tr key={duty.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-4 font-bold text-slate-950">{duty.name}</td>
                      <td className="py-4 font-medium text-slate-600">{duty.time}</td>
                      <td className="py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          duty.role === 'Trọng tài chính' 
                            ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                            : 'bg-slate-50 text-slate-600 border border-slate-200'
                        }`}>
                          {duty.role}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex items-center space-x-1.5 text-xs font-semibold ${
                          duty.status === 'Đang diễn ra' 
                            ? 'text-rose-600 font-bold' 
                            : duty.status === 'Đã kết thúc' 
                            ? 'text-slate-400' 
                            : 'text-amber-600'
                        }`}>
                          {duty.status === 'Đang diễn ra' && <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></span>}
                          <span>{duty.status}</span>
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {duty.status === 'Đang diễn ra' || duty.status === 'Sắp diễn ra' ? (
                          <button
                            onClick={() => navigate('/referee/officiating')}
                            className="bg-blue-600 text-white hover:bg-blue-700 active:scale-95 px-4 py-2 rounded-xl text-xs font-bold tracking-wide transition-all shadow-sm flex items-center space-x-1 ml-auto"
                          >
                            <span>Vào giám sát</span>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium italic pr-4">Nhiệm vụ đã hoàn thành</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* List of Declared COIs */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center space-x-2">
              <span>Danh sách khai báo COI đã nộp</span>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{declarations.length}</span>
            </h3>
            
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {declarations.map((decl) => (
                <div key={decl.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{decl.raceName}</span>
                    <span className="text-slate-400 font-semibold">{decl.declaredAt}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1 border-t border-slate-200/50">
                    <div>
                      <span className="text-slate-400">Đối tượng:</span> <strong className="text-slate-700 font-bold">{decl.partyName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Quan hệ:</span> <strong className="text-slate-700 font-bold">{decl.relationType}</strong>
                    </div>
                  </div>
                  {decl.description && (
                    <div className="text-slate-500 italic bg-white p-2 rounded border border-slate-200/50 mt-1">
                      "{decl.description}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
