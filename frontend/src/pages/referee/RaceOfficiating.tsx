import { useState } from 'react';

interface Participant {
  gate: number;
  horseName: string;
  jockeyName: string;
  startStatus: 'Chờ xuất phát' | 'Đã xuất phát' | 'Lỗi xuất phát';
}

interface LoggedViolation {
  id: string;
  horseName: string;
  errorCode: string;
  errorName: string;
  description: string;
  timestamp: string;
}

const VIOLATION_CODES: Record<string, string> = {
  'E-01': 'Chèn lấn làn đua',
  'E-02': 'Dùng roi quá mức',
  'E-03': 'Xuất phát sai',
  'E-04': 'Cản trở ngựa khác',
  'E-05': 'Vi phạm trang phục',
  'E-06': 'Không tuân lệnh',
  'E-07': 'Nghi vấn Doping',
};

export default function RaceOfficiating() {
  // 1. Participant List State
  const [participants, setParticipants] = useState<Participant[]>([
    { gate: 1, horseName: 'Thần Phong', jockeyName: 'Lê Minh Tuấn', startStatus: 'Chờ xuất phát' },
    { gate: 2, horseName: 'Hồng Kỳ', jockeyName: 'Nguyễn Văn Hùng', startStatus: 'Chờ xuất phát' },
    { gate: 3, horseName: 'Chiến Thần', jockeyName: 'Trần Quốc Bảo', startStatus: 'Chờ xuất phát' },
    { gate: 4, horseName: 'Kim Cương', jockeyName: 'Phạm Minh Hải', startStatus: 'Chờ xuất phát' },
    { gate: 5, horseName: 'Bạch Mã', jockeyName: 'Nguyễn Hoàng Nam', startStatus: 'Chờ xuất phát' },
  ]);

  // 2. Infraction Form State
  const [selectedHorse, setSelectedHorse] = useState('');
  const [selectedErrorCode, setSelectedErrorCode] = useState('');
  const [violationDesc, setViolationDesc] = useState('');
  const [loggedViolations, setLoggedViolations] = useState<LoggedViolation[]>([
    {
      id: 'V-001',
      horseName: 'Chiến Thần',
      errorCode: 'E-01',
      errorName: 'Chèn lấn làn đua',
      description: 'Chèn ép làn chạy của ngựa Hồng Kỳ ở khúc cua số 2.',
      timestamp: '14:32'
    }
  ]);

  // 3. Rankings State
  const [rankings, setRankings] = useState<Record<string, string>>({
    'Thần Phong': '',
    'Hồng Kỳ': '',
    'Chiến Thần': '',
    'Kim Cương': '',
    'Bạch Mã': '',
  });
  
  // Dialog State
  const [showConfirmRankDialog, setShowConfirmRankDialog] = useState(false);
  const [isRankingsPublished, setIsRankingsPublished] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Handle Quick Action Report
  const handleQuickReport = (horseName: string, type: 'False Start' | 'Chèn làn' | 'Dùng roi quá mức') => {
    setSelectedHorse(horseName);
    let code = '';
    let desc = '';

    if (type === 'False Start') {
      code = 'E-03';
      desc = `Ngựa ${horseName} có hành vi xuất phát trước khi có tín hiệu còi của trọng tài.`;
      // Cập nhật trạng thái xuất phát của ngựa đó thành Lỗi xuất phát
      setParticipants(prev =>
        prev.map(p => p.horseName === horseName ? { ...p, startStatus: 'Lỗi xuất phát' } : p)
      );
      showToast(`Đã chuyển trạng thái ${horseName} sang Lỗi xuất phát`);
    } else if (type === 'Chèn làn') {
      code = 'E-01';
      desc = `Ngựa ${horseName} chạy lấn sang làn chạy của ngựa khác gây mất an toàn.`;
      showToast(`Đã chọn nhanh lỗi Chèn làn cho ${horseName}`);
    } else if (type === 'Dùng roi quá mức') {
      code = 'E-02';
      desc = `Kỵ sĩ điều khiển ngựa ${horseName} sử dụng roi thúc ngựa liên tục vượt quá quy định cho phép.`;
      showToast(`Đã chọn nhanh lỗi Dùng roi cho ${horseName}`);
    }

    setSelectedErrorCode(code);
    setViolationDesc(desc);
  };

  const handleLogViolation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHorse || !selectedErrorCode) return;

    const newViolation: LoggedViolation = {
      id: `V-00${loggedViolations.length + 2}`,
      horseName: selectedHorse,
      errorCode: selectedErrorCode,
      errorName: VIOLATION_CODES[selectedErrorCode] || 'Vi phạm khác',
      description: violationDesc,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setLoggedViolations([...loggedViolations, newViolation]);
    
    // Clean up
    setSelectedHorse('');
    setSelectedErrorCode('');
    setViolationDesc('');
    showToast('Ghi nhận vi phạm thành công!');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleStartAll = () => {
    setParticipants(prev =>
      prev.map(p => p.startStatus === 'Chờ xuất phát' ? { ...p, startStatus: 'Đã xuất phát' } : p)
    );
    showToast('Tất cả ngựa hợp lệ đã xuất phát!');
  };

  const handleResetRace = () => {
    setParticipants(prev =>
      prev.map(p => ({ ...p, startStatus: 'Chờ xuất phát' }))
    );
    setIsRankingsPublished(false);
    setRankings({
      'Thần Phong': '',
      'Hồng Kỳ': '',
      'Chiến Thần': '',
      'Kim Cương': '',
      'Bạch Mã': '',
    });
    showToast('Đặt lại trạng thái lượt đua thành công!');
  };

  const handleRankChange = (horseName: string, value: string) => {
    setRankings(prev => ({
      ...prev,
      [horseName]: value,
    }));
  };

  const submitRankings = () => {
    // Check if at least one rank is filled
    const hasRank = Object.values(rankings).some(r => r !== '');
    if (!hasRank) {
      showToast('Vui lòng điền ít nhất một thứ hạng để công bố.');
      return;
    }
    setShowConfirmRankDialog(true);
  };

  const confirmPublishRankings = () => {
    setIsRankingsPublished(true);
    setShowConfirmRankDialog(false);
    showToast('Đã công bố thứ hạng sơ bộ thành công!');
  };

  return (
    <div className="space-y-8 relative animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 text-sm font-bold flex items-center space-x-2 animate-bounce">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 mb-2 animate-pulse">
            🔴 ĐANG GIÁM SÁT TRỰC TIẾP
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Giám sát cuộc đua tại sân</h1>
          <p className="text-slate-500 mt-1">Lượt đua 2 - Giải Vô Địch Quốc Gia | Cự ly 1600m</p>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={handleStartAll}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all active:scale-95 flex items-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M13.5 4.975a.75.75 0 00-1.5 0v5.025a.75.75 0 001.5 0V4.975zM6.5 4.975a.75.75 0 00-1.5 0v5.025a.75.75 0 001.5 0V4.975zM10 3a.75.75 0 01.75.75v12.5a.75.75 0 01-1.5 0V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
            </svg>
            <span>Báo xuất phát</span>
          </button>
          <button
            onClick={handleResetRace}
            className="px-5 py-3 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-bold transition-all active:scale-95"
          >
            Đặt lại lượt
          </button>
        </div>
      </div>

      {/* Grid containing Section 1 and Section 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SECTION 1: Danh sách tham gia & Phản ứng lỗi nhanh */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Danh sách tham gia</h2>
            <span className="text-xs text-slate-500 font-medium">Chọn nút lỗi nhanh để điền nhanh biên bản</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 w-16 text-center">Cổng</th>
                  <th className="pb-3">Thông tin Đua</th>
                  <th className="pb-3">Trạng thái</th>
                  <th className="pb-3 text-right">Phát hiện lỗi nhanh (Click để báo lỗi)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participants.map((p) => (
                  <tr key={p.gate} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white font-extrabold text-xs">
                        {p.gate}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="font-bold text-slate-950">{p.horseName}</div>
                      <div className="text-xs text-slate-500 font-medium">Kỵ sĩ: {p.jockeyName}</div>
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        p.startStatus === 'Đã xuất phát'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          : p.startStatus === 'Lỗi xuất phát'
                          ? 'bg-rose-50 text-rose-700 border-rose-100'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {p.startStatus}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <div className="inline-flex space-x-1.5">
                        {/* False Start Button */}
                        <button
                          onClick={() => handleQuickReport(p.horseName, 'False Start')}
                          className="px-2.5 py-1.5 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 font-bold rounded-lg transition-all active:scale-95"
                          title="Báo ngựa xuất phát sai cổng"
                        >
                          False Start
                        </button>
                        {/* Chèn Làn Button */}
                        <button
                          onClick={() => handleQuickReport(p.horseName, 'Chèn làn')}
                          className="px-2.5 py-1.5 text-xs bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 font-bold rounded-lg transition-all active:scale-95"
                          title="Báo chèn làn bất hợp pháp"
                        >
                          Chèn làn
                        </button>
                        {/* Dùng Roi Quá Mức Button */}
                        <button
                          onClick={() => handleQuickReport(p.horseName, 'Dùng roi quá mức')}
                          className="px-2.5 py-1.5 text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold rounded-lg transition-all active:scale-95"
                          title="Báo lạm dụng roi thúc ngựa"
                        >
                          Roi quá mức
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION 2: Ghi nhận vi phạm Form & Vi phạm đã ghi */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 pb-3 border-b border-slate-100 mb-6 flex items-center space-x-2">
              <span className="text-rose-600">⚠️</span>
              <span>Ghi nhận vi phạm thi đấu</span>
            </h2>

            <form onSubmit={handleLogViolation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ngựa vi phạm *</label>
                <select
                  value={selectedHorse}
                  onChange={(e) => setSelectedHorse(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-semibold text-slate-800"
                >
                  <option value="">-- Chọn ngựa vi phạm --</option>
                  {participants.map(p => (
                    <option key={p.horseName} value={p.horseName}>{p.horseName} (Cổng {p.gate})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mã lỗi vi phạm chuẩn *</label>
                <select
                  value={selectedErrorCode}
                  onChange={(e) => setSelectedErrorCode(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-semibold text-slate-800"
                >
                  <option value="">-- Chọn mã lỗi vi phạm --</option>
                  <option value="E-01">E-01: Chèn lấn làn đua</option>
                  <option value="E-02">E-02: Dùng roi quá mức</option>
                  <option value="E-03">E-03: Xuất phát sai</option>
                  <option value="E-04">E-04: Cản trở ngựa khác</option>
                  <option value="E-05">E-05: Vi phạm trang phục</option>
                  <option value="E-06">E-06: Không tuân lệnh</option>
                  <option value="E-07">E-07: Nghi vấn Doping</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mô tả tình huống chi tiết</label>
                <textarea
                  rows={4}
                  value={violationDesc}
                  onChange={(e) => setViolationDesc(e.target.value)}
                  placeholder="Nhập thông tin chi tiết sự cố tại thực địa..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm transition-all duration-200 shadow-sm active:scale-95"
              >
                Ghi nhận vi phạm
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* SECTION 3 & Vi phạm đã ghi */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Bảng liệt kê vi phạm đã ghi */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center space-x-2">
            <span>Danh sách lỗi đã ghi nhận trong lượt</span>
            <span className="text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full font-bold">{loggedViolations.length}</span>
          </h3>

          {loggedViolations.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Chưa ghi nhận vi phạm nào trong lượt đua này.</p>
          ) : (
            <div className="space-y-3">
              {loggedViolations.map((v) => (
                <div key={v.id} className="p-4 bg-slate-50 border border-slate-150 rounded-xl flex items-start space-x-3 text-xs">
                  <span className="font-extrabold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100 uppercase mt-0.5">
                    {v.errorCode}
                  </span>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">Ngựa: {v.horseName}</span>
                      <span className="text-slate-400 font-semibold">{v.timestamp}</span>
                    </div>
                    <div className="font-semibold text-slate-700">Lỗi: {v.errorName}</div>
                    {v.description && <div className="text-slate-500 italic mt-1 bg-white p-2 rounded border border-slate-100">"{v.description}"</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 3: Xác nhận thứ hạng sơ bộ */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 pb-3 border-b border-slate-100 mb-6 flex items-center space-x-2">
            <span className="text-blue-600">🏆</span>
            <span>Xác nhận thứ hạng sơ bộ</span>
          </h2>
          
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Điền thứ hạng hoàn thành của từng chú ngựa sau khi cán đích. Kết quả này mang tính chất sơ bộ để làm cơ sở đối chiếu khiếu nại.
          </p>

          <div className="space-y-3 mb-6">
            {participants.map(p => (
              <div key={p.horseName} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center space-x-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
                    {p.gate}
                  </span>
                  <div>
                    <span className="text-sm font-bold text-slate-800">{p.horseName}</span>
                    <span className="text-xs text-slate-500 block">Kỵ sĩ: {p.jockeyName}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <label className="text-xs font-semibold text-slate-500">Hạng về đích:</label>
                  <select
                    value={rankings[p.horseName]}
                    disabled={isRankingsPublished}
                    onChange={(e) => handleRankChange(p.horseName, e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">--</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                    <option value="DQ">DQ (Loại)</option>
                    <option value="DNF">DNF (Bỏ cuộc)</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {!isRankingsPublished ? (
            <button
              onClick={submitRankings}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all duration-200 shadow-sm active:scale-95 flex items-center justify-center space-x-2"
            >
              <span>Công bố thứ hạng sơ bộ</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold text-center flex flex-col items-center justify-center space-y-1">
              <div className="flex items-center space-x-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-emerald-600">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.859-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <span>ĐÃ CÔNG BỐ THỨ HẠNG SƠ BỘ</span>
              </div>
              <p className="text-[10px] text-emerald-600 font-medium leading-relaxed">
                Thứ tự đã được lưu và hiển thị công khai tới Spectators/Owners. Có thể xem lại kết quả dưới bảng đối chiếu.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRM RANKINGS DIALOG (MODAL) */}
      {showConfirmRankDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-6 animate-scale-up">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Xác nhận công bố kết quả</h3>
                <p className="text-xs text-slate-500">Hãy kiểm tra kỹ thứ tự trước khi công bố.</p>
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs text-slate-600 font-medium">Bảng thứ tự về đích ghi nhận:</p>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 divide-y divide-slate-200/50 text-sm">
                {participants.map(p => (
                  <div key={p.horseName} className="flex justify-between py-1.5 first:pt-0 last:pb-0">
                    <span className="font-medium text-slate-700">{p.horseName} (Kỵ sĩ: {p.jockeyName})</span>
                    <span className="font-bold text-slate-950">
                      {rankings[p.horseName] ? `Hạng ${rankings[p.horseName]}` : 'Chưa xếp hạng'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setShowConfirmRankDialog(false)}
                className="flex-1 py-3 px-4 border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-600 transition-all active:scale-95"
              >
                Hủy quay lại
              </button>
              <button
                onClick={confirmPublishRankings}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 text-center"
              >
                Xác nhận công bố
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
