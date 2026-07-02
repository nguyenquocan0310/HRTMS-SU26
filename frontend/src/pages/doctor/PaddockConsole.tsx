import { useState, useEffect } from 'react'
import { getMyTournamentParticipations } from '../../services/tournamentService'

interface JockeyWeightItem {
  id: string
  name: string
  declaredWeight: number
  actualWeight: number | ''
  isConfirmed: boolean
}

interface HorseCheckItem {
  id: string
  name: string
  chipId: string
  identityVerified: boolean
  isPassed: boolean
  notes: string
  isConfirmed: boolean
}

export default function PaddockConsole() {
  const [activeTab, setActiveTab] = useState<'weigh-in' | 'vet-check' | 'weigh-out'>('weigh-in')

  // ── Kiểm tra Doctor đã được duyệt tham gia giải chưa ─────────────────────
  const [hasApprovedTournament, setHasApprovedTournament] = useState<boolean | null>(null)

  useEffect(() => {
    getMyTournamentParticipations()
      .then((list) => {
        const approved = list.some(
          (p) => p.status === 'Approved' || p.status === 'AutoEligible'
        )
        setHasApprovedTournament(approved)
      })
      .catch(() => {
        // Nếu API lỗi, không hiển thị note — không chặn Paddock
        setHasApprovedTournament(true)
      })
  }, [])

  // Trạng thái cho tab Weigh-In
  const [weighInData, setWeighInData] = useState<JockeyWeightItem[]>([
    { id: 'J1', name: 'Nguyễn Văn Hùng', declaredWeight: 54.0, actualWeight: '', isConfirmed: false },
    { id: 'J2', name: 'Trần Minh Quân', declaredWeight: 55.5, actualWeight: 55.2, isConfirmed: false },
    { id: 'J3', name: 'Lê Hoàng Nam', declaredWeight: 53.2, actualWeight: 54.5, isConfirmed: false },
    { id: 'J4', name: 'Phạm Đức Duy', declaredWeight: 56.0, actualWeight: 56.0, isConfirmed: false },
  ])

  // Trạng thái cho tab Kiểm tra ngựa (Vet Check)
  const [horseData, setHorseData] = useState<HorseCheckItem[]>([
    { id: 'H1', name: 'Kim Long', chipId: 'CHIP9821-VN', identityVerified: true, isPassed: true, notes: '', isConfirmed: false },
    { id: 'H2', name: 'Xích Thố', chipId: 'CHIP7344-VN', identityVerified: true, isPassed: true, notes: '', isConfirmed: false },
    { id: 'H3', name: 'Bạch Mã', chipId: 'CHIP1120-VN', identityVerified: false, isPassed: false, notes: 'Chip không phản hồi khi quét', isConfirmed: false },
    { id: 'H4', name: 'Hắc Phong', chipId: 'CHIP4409-VN', identityVerified: true, isPassed: true, notes: '', isConfirmed: false },
  ])

  // Trạng thái cho tab Weigh-Out
  const [weighOutData, setWeighOutData] = useState<JockeyWeightItem[]>([
    { id: 'J1', name: 'Nguyễn Văn Hùng', declaredWeight: 54.0, actualWeight: '', isConfirmed: false },
    { id: 'J2', name: 'Trần Minh Quân', declaredWeight: 55.5, actualWeight: '', isConfirmed: false },
    { id: 'J3', name: 'Lê Hoàng Nam', declaredWeight: 53.2, actualWeight: '', isConfirmed: false },
    { id: 'J4', name: 'Phạm Đức Duy', declaredWeight: 56.0, actualWeight: '', isConfirmed: false },
  ])

  // Toast feedback khi bấm nút xác nhận
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  
  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // --- LOGIC TAB WEIGH-IN ---
  const handleWeighInWeightChange = (id: string, val: string) => {
    setWeighInData(prev => prev.map(item => {
      if (item.id === id) {
        const parsed = val === '' ? '' : parseFloat(val)
        return { ...item, actualWeight: parsed, isConfirmed: false }
      }
      return item
    }))
  }

  const handleWeighInConfirm = (id: string) => {
    const item = weighInData.find(x => x.id === id)
    if (!item || item.actualWeight === '') {
      showToast('⚠️ Vui lòng nhập cân nặng thực tế trước khi xác nhận!')
      return
    }
    const diff = Math.abs(item.actualWeight - item.declaredWeight)
    setWeighInData(prev => prev.map(x => x.id === id ? { ...x, isConfirmed: true } : x))
    if (diff > 1.0) {
      showToast(`⚠️ Xác nhận Weigh-In với cảnh báo vượt mức lệch ${diff.toFixed(1)}kg!`)
    } else {
      showToast(`✓ Đã xác nhận Weigh-In cho kỵ sĩ ${item.name} thành công.`)
    }
  }

  // --- LOGIC TAB KIỂM TRA NGỰA ---
  const handleHorseTogglePassed = (id: string) => {
    setHorseData(prev => prev.map(item => {
      if (item.id === id) {
        const nextPassed = !item.isPassed
        return { 
          ...item, 
          isPassed: nextPassed, 
          isConfirmed: false,
          notes: nextPassed ? '' : item.notes || 'Không đạt tiêu chuẩn lâm sàng'
        }
      }
      return item
    }))
  }

  const handleHorseNotesChange = (id: string, val: string) => {
    setHorseData(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, notes: val, isConfirmed: false }
      }
      return item
    }))
  }

  const handleHorseConfirm = (id: string) => {
    const item = horseData.find(x => x.id === id)
    if (!item) return
    setHorseData(prev => prev.map(x => x.id === id ? { ...x, isConfirmed: true } : x))
    showToast(`✓ Đã cập nhật kết quả kiểm tra cho ngựa ${item.name} (${item.isPassed ? 'Đạt' : 'Không đạt'}).`)
  }

  // --- LOGIC TAB WEIGH-OUT ---
  const handleWeighOutWeightChange = (id: string, val: string) => {
    setWeighOutData(prev => prev.map(item => {
      if (item.id === id) {
        const parsed = val === '' ? '' : parseFloat(val)
        return { ...item, actualWeight: parsed, isConfirmed: false }
      }
      return item
    }))
  }

  const handleWeighOutConfirm = (id: string) => {
    const item = weighOutData.find(x => x.id === id)
    if (!item || item.actualWeight === '') {
      showToast('⚠️ Vui lòng nhập cân nặng sau đua trước khi xác nhận!')
      return
    }
    const diff = Math.abs(item.actualWeight - item.declaredWeight)
    setWeighOutData(prev => prev.map(x => x.id === id ? { ...x, isConfirmed: true } : x))
    if (diff > 1.0) {
      showToast(`⚠️ Xác nhận Weigh-Out với cảnh báo vượt mức lệch ${diff.toFixed(1)}kg!`)
    } else {
      showToast(`✓ Đã xác nhận Weigh-Out cho kỵ sĩ ${item.name} thành công.`)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-lg border border-gray-800 animate-fade-in flex items-center gap-2">
          <span>🔔</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Note nhẹ: Doctor chưa được duyệt tham gia giải */}
      {hasApprovedTournament === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3 text-amber-800">
          <span className="text-base flex-shrink-0">ℹ️</span>
          <p className="text-xs font-medium flex-1">
            Lưu ý: Bạn cần được Admin duyệt tham gia giải trước khi nhận phân công Paddock.
          </p>
        </div>
      )}

      {/* Header với hiệu ứng nhấp nháy cho badge ĐANG DIỄN RA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-200 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            ⏱️ Bàn điều khiển Paddock
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Giao diện kiểm tra nhanh dành cho máy tính bảng tại khu vực Paddock
          </p>
        </div>
        <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg py-1.5 px-3 self-start sm:self-center">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
          </span>
          <span className="text-red-700 font-bold text-xs tracking-wider uppercase">ĐANG DIỄN RA</span>
        </div>
      </div>

      {/* Hệ thống TAB chuyển đổi trạng thái */}
      <div className="bg-white p-1.5 border border-gray-200 rounded-xl shadow-sm flex">
        <button
          onClick={() => setActiveTab('weigh-in')}
          className={`flex-1 text-center py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'weigh-in'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          ⚖️ Cân nặng trước đua (Weigh-In)
        </button>
        <button
          onClick={() => setActiveTab('vet-check')}
          className={`flex-1 text-center py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'vet-check'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          🐴 Kiểm tra ngựa (Vet Check)
        </button>
        <button
          onClick={() => setActiveTab('weigh-out')}
          className={`flex-1 text-center py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'weigh-out'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          ⚖️ Cân nặng sau đua (Weigh-Out)
        </button>
      </div>

      {/* Nội dung theo từng Tab */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {/* --- TAB WEIGH-IN --- */}
        {activeTab === 'weigh-in' && (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h2 className="text-sm font-bold text-gray-900">Danh sách Kỵ sĩ cân trước cuộc đua</h2>
              <span className="text-xs text-gray-400">Yêu cầu lệch không quá 1.0kg</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-700">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/50">
                    <th className="py-3 px-4">Kỵ sĩ</th>
                    <th className="py-3 px-4">Cân tự khai (kg)</th>
                    <th className="py-3 px-4">Cân thực tế (kg)</th>
                    <th className="py-3 px-4">Chênh lệch (kg)</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {weighInData.map((item) => {
                    const diff = item.actualWeight !== '' ? Number((item.actualWeight - item.declaredWeight).toFixed(1)) : 0
                    const isExceeded = item.actualWeight !== '' && Math.abs(diff) > 1.0

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/20 transition-colors">
                        <td className="py-4 px-4 font-semibold text-gray-900">{item.name}</td>
                        <td className="py-4 px-4 font-mono font-medium">{item.declaredWeight.toFixed(1)}</td>
                        <td className="py-4 px-4">
                          <input
                            type="number"
                            step="0.1"
                            className={`w-28 bg-gray-50 border rounded-lg px-3 py-1.5 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                              isExceeded 
                                ? 'border-red-500 focus:ring-red-500/20 text-red-700 bg-red-50/50' 
                                : 'border-gray-200 focus:ring-emerald-500/20 focus:border-emerald-500'
                            }`}
                            placeholder="Nhập cân"
                            value={item.actualWeight}
                            onChange={(e) => handleWeighInWeightChange(item.id, e.target.value)}
                          />
                        </td>
                        <td className="py-4 px-4">
                          {item.actualWeight !== '' ? (
                            <div className="flex items-center gap-2">
                              <span className={`font-mono font-bold ${isExceeded ? 'text-red-600' : 'text-emerald-600'}`}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                              {isExceeded && (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                  Vượt mức
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Chưa cân</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleWeighInConfirm(item.id)}
                            disabled={item.actualWeight === ''}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              item.isConfirmed
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                                : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed'
                            }`}
                          >
                            {item.isConfirmed ? '✓ Đã xác nhận' : 'Xác nhận Weigh-In'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- TAB KIỂM TRA NGỰA --- */}
        {activeTab === 'vet-check' && (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h2 className="text-sm font-bold text-gray-900">Báo cáo sức khỏe lâm sàng & chip định danh ngựa</h2>
              <span className="text-xs text-gray-400">Yêu cầu xác nhận cho từng ngựa</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-700">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/50">
                    <th className="py-3 px-4">Tên ngựa</th>
                    <th className="py-3 px-4">Mã số chip</th>
                    <th className="py-3 px-4">Xác minh chip</th>
                    <th className="py-3 px-4">Trạng thái sức khỏe</th>
                    <th className="py-3 px-4">Lý do / Ghi chú</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {horseData.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/20 transition-colors">
                      <td className="py-4 px-4 font-semibold text-gray-900">{item.name}</td>
                      <td className="py-4 px-4 font-mono text-xs text-gray-600">{item.chipId}</td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.identityVerified
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {item.identityVerified ? '✓ Khớp danh tính' : '✗ Lỗi danh tính'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {/* Toggle Đạt / Không đạt */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleHorseTogglePassed(item.id)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              item.isPassed ? 'bg-emerald-600' : 'bg-red-500'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                item.isPassed ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span className={`text-xs font-semibold ${item.isPassed ? 'text-emerald-700' : 'text-red-700'}`}>
                            {item.isPassed ? 'Đạt' : 'Không đạt'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <input
                          type="text"
                          className="w-full min-w-[150px] bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                          placeholder="Lý do không đạt hoặc ghi chú"
                          value={item.notes}
                          onChange={(e) => handleHorseNotesChange(item.id, e.target.value)}
                        />
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => handleHorseConfirm(item.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            item.isConfirmed
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                              : 'bg-gray-900 text-white hover:bg-gray-800'
                          }`}
                        >
                          {item.isConfirmed ? '✓ Đã hoàn tất' : 'Hoàn tất kiểm tra'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- TAB WEIGH-OUT --- */}
        {activeTab === 'weigh-out' && (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h2 className="text-sm font-bold text-gray-900">Danh sách Kỵ sĩ cân sau cuộc đua</h2>
              <span className="text-xs text-gray-400">Yêu cầu lệch không quá 1.0kg</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-700">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/50">
                    <th className="py-3 px-4">Kỵ sĩ</th>
                    <th className="py-3 px-4">Cân trước đua (kg)</th>
                    <th className="py-3 px-4">Cân sau đua (kg)</th>
                    <th className="py-3 px-4">Chênh lệch (kg)</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {weighOutData.map((item) => {
                    const diff = item.actualWeight !== '' ? Number((item.actualWeight - item.declaredWeight).toFixed(1)) : 0
                    const isExceeded = item.actualWeight !== '' && Math.abs(diff) > 1.0

                    return (
                      <tr key={item.id} className="hover:bg-gray-50/20 transition-colors">
                        <td className="py-4 px-4 font-semibold text-gray-900">{item.name}</td>
                        <td className="py-4 px-4 font-mono font-medium">{item.declaredWeight.toFixed(1)}</td>
                        <td className="py-4 px-4">
                          <input
                            type="number"
                            step="0.1"
                            className={`w-28 bg-gray-50 border rounded-lg px-3 py-1.5 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                              isExceeded 
                                ? 'border-red-500 focus:ring-red-500/20 text-red-700 bg-red-50/50' 
                                : 'border-gray-200 focus:ring-emerald-500/20 focus:border-emerald-500'
                            }`}
                            placeholder="Nhập cân"
                            value={item.actualWeight}
                            onChange={(e) => handleWeighOutWeightChange(item.id, e.target.value)}
                          />
                        </td>
                        <td className="py-4 px-4">
                          {item.actualWeight !== '' ? (
                            <div className="flex items-center gap-2">
                              <span className={`font-mono font-bold ${isExceeded ? 'text-red-600' : 'text-emerald-600'}`}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                              {isExceeded && (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                                  Vượt mức
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Chưa cân</span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleWeighOutConfirm(item.id)}
                            disabled={item.actualWeight === ''}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              item.isConfirmed
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                                : 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed'
                            }`}
                          >
                            {item.isConfirmed ? '✓ Đã xác nhận' : 'Xác nhận Weigh-Out'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
