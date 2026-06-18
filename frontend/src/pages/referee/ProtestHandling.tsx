import { useState } from 'react';

interface Protest {
  id: string;
  filer: string;
  accused: string;
  reason: string;
  status: 'Chờ xử lý' | 'Đã giải quyết';
  decision?: string;
  notes?: string;
}

export default function ProtestHandling() {
  // 1. Tab State
  const [activeTab, setActiveTab] = useState<'protests' | 'protocol'>('protests');
  
  // 2. Protest List State
  const [protests, setProtests] = useState<Protest[]>([
    {
      id: 'PT-901',
      filer: 'Nguyễn Văn A (Chủ ngựa Thần Phong)',
      accused: 'Chiến Thần (Ngựa số 3)',
      reason: 'Chèn lấn làn đua tại góc cua cuối làm giảm vận tốc và đe dọa an toàn.',
      status: 'Chờ xử lý'
    },
    {
      id: 'PT-902',
      filer: 'Trần Quốc B (Chủ ngựa Kim Cương)',
      accused: 'Bạch Mã (Ngựa số 5)',
      reason: 'Kỵ sĩ dùng roi thúc ngựa liên tục vượt quá quy chuẩn cho phép ở chặng về đích.',
      status: 'Chờ xử lý'
    }
  ]);

  // Modal State
  const [selectedProtest, setSelectedProtest] = useState<Protest | null>(null);
  const [decision, setDecision] = useState('');
  const [protestNotes, setProtestNotes] = useState('');
  
  // Video Simulation State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState('1.0x');
  const [cameraAngle, setCameraAngle] = useState('Khúc cua số 2');
  const [videoProgress, setVideoProgress] = useState(35); // percentage

  // 3. Match Protocol State
  const [protocolText, setProtocolText] = useState(
    `BIÊN BẢN THI ĐẤU & ĐIỀU HÀNH CUỘC ĐUA
Lượt đua: Lượt 2 - Giải Vô Địch Quốc Gia 2026
Cự ly chạy: 1600m
Thời gian xuất phát: 14:30 | Ngày: 18/06/2026
Trọng tài chính: Nguyễn Quốc Hải
Trọng tài biên: Phạm Thanh Nam, Lê Thuận Phát

TỔNG KẾT DIỄN BIẾN CHÍNH:
1. Trạng thái xuất phát:
   - Các ngựa xuất phát đúng tín hiệu. Không có lỗi False Start.

2. Ghi nhận vi phạm trong đường đua:
   - Phút thứ 2: Phát hiện ngựa Chiến Thần (Cổng số 3) chèn làn trái phép tại khúc cua số 2 đối với Hồng Kỳ (Cổng số 2).
   - Đã xử phạt cảnh cáo kỵ sĩ cưỡi Chiến Thần.

3. Thứ tự cán đích sơ bộ:
   - Hạng 1: Thần Phong (Cổng số 1)
   - Hạng 2: Hồng Kỳ (Cổng số 2)
   - Hạng 3: Kim Cương (Cổng số 4)
   - Hạng 4: Bạch Mã (Cổng số 5)
   - Hạng 5: Chiến Thần (Cổng số 3)

Biên bản nháp được tổng hợp bởi Ban trọng tài điều hành.`
  );
  const [isLocked, setIsLocked] = useState(false);
  
  // Toast notifications
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Open Protest Review Modal
  const handleOpenReview = (protest: Protest) => {
    setSelectedProtest(protest);
    setDecision('');
    setProtestNotes('');
    setIsPlaying(false);
    setVideoProgress(40);
  };

  // Submit Protest Decision
  const handleMakeDecision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProtest || !decision) return;

    setProtests(prev =>
      prev.map(p =>
        p.id === selectedProtest.id
          ? { ...p, status: 'Đã giải quyết', decision, notes: protestNotes }
          : p
      )
    );
    
    showToast(`Đã ra phán quyết cho khiếu nại ${selectedProtest.id}`);
    setSelectedProtest(null);
  };

  // Handle Save Protocol Draft
  const handleSaveDraft = () => {
    if (isLocked) return;
    showToast('Đã lưu bản nháp biên bản thi đấu!');
  };

  // Handle Lock Protocol
  const handleLockProtocol = () => {
    if (isLocked) return;
    setIsLocked(true);
    showToast('Biên bản thi đấu đã được KHÓA vĩnh viễn!');
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 text-sm font-bold flex items-center space-x-2 animate-bounce">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Khiếu nại & Biên bản</h1>
          <p className="text-slate-500 mt-1">Quản lý các sự cố khiếu nại từ chủ ngựa và khóa biên bản kết quả thi đấu cuối cùng.</p>
        </div>

        {/* Tab Selection buttons */}
        <div className="bg-slate-200/60 p-1 rounded-xl flex space-x-1 w-fit border border-slate-200 shadow-sm">
          <button
            onClick={() => setActiveTab('protests')}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'protests'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            Khiếu nại chờ xử lý
          </button>
          <button
            onClick={() => setActiveTab('protocol')}
            className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
              activeTab === 'protocol'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            <span>Biên bản thi đấu</span>
            {isLocked && <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>}
          </button>
        </div>
      </div>

      {/* TAB 1: KHIẾU NẠI CHỜ XỬ LÝ */}
      {activeTab === 'protests' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Danh sách khiếu nại từ các đội đua</h2>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {protests.filter(p => p.status === 'Chờ xử lý').length} Đang chờ
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-3">Mã khiếu nại</th>
                  <th className="pb-3">Bên nộp đơn</th>
                  <th className="pb-3">Đối tượng bị khiếu nại</th>
                  <th className="pb-3">Lý do khiếu nại</th>
                  <th className="pb-3">Trạng thái</th>
                  <th className="pb-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {protests.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 font-bold text-slate-900">{p.id}</td>
                    <td className="py-4 font-medium text-slate-700">{p.filer}</td>
                    <td className="py-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {p.accused}
                      </span>
                    </td>
                    <td className="py-4 text-xs text-slate-500 max-w-xs truncate" title={p.reason}>
                      {p.reason}
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        p.status === 'Chờ xử lý'
                          ? 'bg-amber-50 text-amber-700 border border-amber-100'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      {p.status === 'Chờ xử lý' ? (
                        <button
                          onClick={() => handleOpenReview(p)}
                          className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 active:scale-95 text-xs font-bold rounded-xl shadow-sm transition-all"
                        >
                          Xem xét
                        </button>
                      ) : (
                        <div className="text-right text-xs">
                          <div className="text-emerald-700 font-bold">Đã phán quyết</div>
                          <div className="text-[10px] text-slate-400 font-semibold">{p.decision}</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BIÊN BẢN THI ĐẤU */}
      {activeTab === 'protocol' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900">Biên bản kết quả thi đấu chính thức</h2>
              {isLocked ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100 uppercase tracking-wider">
                  🔒 ĐÃ KHÓA
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase tracking-wider">
                  📝 Bản nháp
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 font-medium">Bản ghi có giá trị pháp lý cuối cùng để tính điểm giải đấu</span>
          </div>

          <div className="space-y-4">
            <textarea
              rows={16}
              value={protocolText}
              disabled={isLocked}
              onChange={(e) => setProtocolText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800 disabled:opacity-75 disabled:bg-slate-100 disabled:text-slate-500"
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500 leading-normal max-w-md">
                {isLocked 
                  ? 'Biên bản đã được ký đóng dấu điện tử bởi Trọng tài chính. Mọi thao tác sửa đổi nội dung đã bị khóa vĩnh viễn.' 
                  : 'Lưu ý: Sau khi bấm nút "Khóa biên bản", bạn sẽ không thể chỉnh sửa nội dung hoặc thay đổi phán quyết của lượt đua này nữa.'}
              </p>

              <div className="flex space-x-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={isLocked}
                  className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Lưu bản nháp
                </button>
                <button
                  onClick={handleLockProtocol}
                  disabled={isLocked}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  Khóa biên bản
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL (REVIEW PROTEST WITH VIDEO REPLAY) */}
      {selectedProtest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full p-8 flex flex-col md:flex-row gap-8 max-h-[90vh] overflow-y-auto animate-scale-up">
            
            {/* Left Column: Mock Video Replay System */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Bằng chứng Replay (Góc nhìn trọng tài)</h3>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                  CAMERA 1080P - 60FPS
                </span>
              </div>

              {/* Simulated Video Player UI */}
              <div className="bg-slate-950 rounded-2xl overflow-hidden aspect-video flex flex-col justify-between p-4 border border-slate-800 shadow-inner relative group">
                
                {/* Overlay Text */}
                <div className="flex justify-between items-start text-[10px] text-white/70 font-mono">
                  <div>
                    <div>CAM 01 - {cameraAngle}</div>
                    <div>DERBY SPEEDWAY - TURN 4</div>
                  </div>
                  <div className="text-right">
                    <div>18/06/2026 14:32:18</div>
                    <div className="text-rose-400 font-bold">REPLAY LIVE</div>
                  </div>
                </div>

                {/* Animated graphic representation of horses racing */}
                <div className="my-auto relative h-16 w-full bg-slate-900/50 rounded-lg flex items-center border border-white/5 overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white/20"></div>
                  <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-rose-500/80"></div>
                  
                  {/* Horse positions depending on timeline progress */}
                  <div 
                    style={{ left: `${videoProgress}%` }} 
                    className="absolute -translate-x-1/2 flex flex-col items-center transition-all duration-300"
                  >
                    <div className="text-xs bg-white text-slate-950 px-2 py-0.5 rounded font-extrabold shadow border border-slate-300">
                      🏇 Ngựa số 3 (Chiến Thần)
                    </div>
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping mt-1"></div>
                  </div>

                  <div 
                    style={{ left: `${videoProgress - 8}%` }} 
                    className="absolute -translate-x-1/2 flex flex-col items-center transition-all duration-300"
                  >
                    <div className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-extrabold shadow border border-blue-400">
                      🏇 Ngựa số 2 (Hồng Kỳ)
                    </div>
                  </div>

                  {/* Curving track guidelines overlay */}
                  <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10"></div>
                </div>

                {/* Controls Bar */}
                <div className="space-y-3 bg-slate-900/80 backdrop-blur-md p-3 rounded-xl border border-white/10">
                  {/* Timeline slider */}
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] text-white/50 font-mono">00:15</span>
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      value={videoProgress}
                      onChange={(e) => setVideoProgress(Number(e.target.value))}
                      className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span className="text-[10px] text-white/50 font-mono">00:45</span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between text-xs text-white">
                    <div className="flex items-center space-x-3">
                      <button 
                        type="button"
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="hover:text-blue-400 transition-colors p-1 bg-white/5 hover:bg-white/10 rounded"
                      >
                        {isPlaying ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        )}
                      </button>
                      
                      {/* Play Speed selector */}
                      <span className="text-[10px] text-white/60">Tốc độ:</span>
                      <select 
                        value={playSpeed}
                        onChange={(e) => setPlaySpeed(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-mono text-white focus:outline-none"
                      >
                        <option value="0.25x" className="bg-slate-900 text-white">0.25x</option>
                        <option value="0.5x" className="bg-slate-900 text-white">0.5x</option>
                        <option value="1.0x" className="bg-slate-900 text-white">1.0x</option>
                        <option value="2.0x" className="bg-slate-900 text-white">2.0x</option>
                      </select>
                    </div>

                    {/* Camera Angle Selector */}
                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] text-white/60 mr-1">Góc quay:</span>
                      {['Khúc cua số 2', 'Vạch cán đích', 'Toàn cảnh'].map((angle) => (
                        <button
                          key={angle}
                          type="button"
                          onClick={() => setCameraAngle(angle)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all ${
                            cameraAngle === angle 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          {angle}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Protest Details Info Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex justify-between items-center text-slate-400 font-semibold border-b border-slate-200/50 pb-2 mb-2">
                  <span>MÃ ĐƠN: {selectedProtest.id}</span>
                  <span>NGƯỜI KHIẾU NẠI: {selectedProtest.filer}</span>
                </div>
                <div className="text-slate-700 font-semibold">Đối tượng bị khiếu nại: <span className="text-slate-950 font-bold">{selectedProtest.accused}</span></div>
                <div className="text-slate-600 leading-relaxed"><span className="text-slate-400 font-medium">Chi tiết lý do:</span> "{selectedProtest.reason}"</div>
              </div>
            </div>

            {/* Right Column: Decision Form */}
            <div className="w-full md:w-80 flex flex-col justify-between">
              <form onSubmit={handleMakeDecision} className="space-y-6">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900">Phán quyết của Hội đồng</h3>
                  <p className="text-xs text-slate-500">Quyết định sau khi tham chiếu các bằng chứng camera.</p>
                </div>

                {/* Decision radio selection */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-700">Lựa chọn hình thức phán quyết *</label>
                  
                  <div className="space-y-2">
                    <label className="flex items-center space-x-3 p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="protestDecision"
                        value="Chấp thuận Truất quyền thi đấu DQ"
                        checked={decision === 'Chấp thuận Truất quyền thi đấu DQ'}
                        onChange={(e) => setDecision(e.target.value)}
                        required
                        className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-rose-700 block">Truất quyền thi đấu (DQ)</span>
                        <span className="text-[10px] text-slate-500">Hủy hoàn toàn kết quả lượt đua của đối tượng.</span>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="protestDecision"
                        value="Tụt hạng"
                        checked={decision === 'Tụt hạng'}
                        onChange={(e) => setDecision(e.target.value)}
                        className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-orange-700 block">Hạ vị trí / Tụt hạng</span>
                        <span className="text-[10px] text-slate-500">Giảm bậc xếp hạng về đích của đối tượng.</span>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="protestDecision"
                        value="Cảnh cáo"
                        checked={decision === 'Cảnh cáo'}
                        onChange={(e) => setDecision(e.target.value)}
                        className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-amber-700 block">Cảnh cáo (Warning)</span>
                        <span className="text-[10px] text-slate-500">Ghi nhận vi phạm nhưng giữ nguyên kết quả.</span>
                      </div>
                    </label>

                    <label className="flex items-center space-x-3 p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer transition-colors">
                      <input
                        type="radio"
                        name="protestDecision"
                        value="Bác bỏ khiếu nại"
                        checked={decision === 'Bác bỏ khiếu nại'}
                        onChange={(e) => setDecision(e.target.value)}
                        className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-700 block">Bác bỏ khiếu nại</span>
                        <span className="text-[10px] text-slate-500">Không chấp thuận đơn. Không có lỗi vi phạm.</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Notes textarea */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ghi chú & Căn cứ phán quyết</label>
                  <textarea
                    rows={3}
                    value={protestNotes}
                    onChange={(e) => setProtestNotes(e.target.value)}
                    placeholder="Nêu lý do, thời điểm vi phạm trên video..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800"
                  />
                </div>

                {/* Modal footer buttons */}
                <div className="flex items-center space-x-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedProtest(null)}
                    className="flex-1 py-3 px-4 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-all active:scale-95 text-center"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 text-center"
                  >
                    Ra phán quyết
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
