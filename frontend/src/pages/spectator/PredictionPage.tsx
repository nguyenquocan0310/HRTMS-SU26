import React, { useState } from 'react'

interface HorseMock {
  id: string
  name: string
  jockey: string
  aiRate: string
  bgGrad: string
  emoji: string
}

export default function PredictionPage() {
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null)
  const [predictionType, setPredictionType] = useState<'win' | 'place'>('win')
  const [pointsBet, setPointsBet] = useState<number>(50)
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false)

  const walletBalance = 850

  const horses: HorseMock[] = [
    {
      id: 'h-01',
      name: 'Thần Phong',
      jockey: 'Nguyễn Văn Hùng',
      aiRate: '35%',
      bgGrad: 'from-amber-100 to-orange-100 text-amber-800',
      emoji: '🐎',
    },
    {
      id: 'h-02',
      name: 'Xích Thố',
      jockey: 'Trần Quốc Anh',
      aiRate: '28%',
      bgGrad: 'from-rose-100 to-red-100 text-rose-800',
      emoji: '🔥',
    },
    {
      id: 'h-03',
      name: 'Hắc Nhãn',
      jockey: 'Lê Minh Thuận',
      aiRate: '22%',
      bgGrad: 'from-slate-200 to-gray-200 text-slate-800',
      emoji: '👁️',
    },
    {
      id: 'h-04',
      name: 'Bạch Long',
      jockey: 'Phạm Đức Thắng',
      aiRate: '15%',
      bgGrad: 'from-blue-100 to-indigo-100 text-blue-800',
      emoji: '❄️',
    },
  ]

  // Validate inputs
  const isValidBet = pointsBet >= 10 && pointsBet <= 500 && pointsBet <= walletBalance
  const isFormValid = selectedHorseId !== null && isValidBet

  // Calculate remaining balance
  const remainingBalance = walletBalance - (isNaN(pointsBet) ? 0 : pointsBet)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return
    setIsSubmitted(true)
    setTimeout(() => {
      setIsSubmitted(false)
    }, 4000)
  }

  const selectedHorse = horses.find((h) => h.id === selectedHorseId)

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight bg-gradient-to-r from-amber-600 to-amber-900 bg-clip-text text-transparent">
          Dự đoán kết quả cuộc đua - Cup Ngôi Sao 2026
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Lựa chọn chiến mã vượt trội và thử tài phân tích để nhận thêm điểm thưởng hấp dẫn.
        </p>
      </div>

      {/* Section 1: Thông tin cuộc đua */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          {/* Cự ly */}
          <div className="flex items-center gap-4 pb-4 md:pb-0">
            <span className="text-3xl bg-blue-50 p-3 rounded-2xl">📏</span>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cự ly thi đấu</div>
              <div className="text-lg font-bold text-gray-800 mt-0.5">1400 mét (Đường cỏ)</div>
            </div>
          </div>
          {/* Quỹ điểm */}
          <div className="flex items-center gap-4 pt-4 md:pt-0 md:pl-6">
            <span className="text-3xl bg-amber-50 p-3 rounded-2xl">🪙</span>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tổng quỹ thưởng</div>
              <div className="text-lg font-bold text-amber-600 mt-0.5">10,000 điểm</div>
            </div>
          </div>
          {/* Trạng thái */}
          <div className="flex items-center gap-4 pt-4 md:pt-0 md:pl-6">
            <span className="text-3xl bg-emerald-50 p-3 rounded-2xl">⚡</span>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Trạng thái</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-sm font-bold text-emerald-600">Chuẩn bị khởi tranh</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Chọn chiến mã của bạn */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>🐴</span> Bước 1: Chọn chiến mã của bạn
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">Vui lòng click chọn duy nhất 1 chiến mã dưới đây:</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {horses.map((horse) => {
            const isSelected = selectedHorseId === horse.id
            return (
              <div
                key={horse.id}
                onClick={() => setSelectedHorseId(horse.id)}
                className={`cursor-pointer rounded-2xl border transition-all duration-300 overflow-hidden group select-none ${
                  isSelected
                    ? 'border-2 border-blue-600 bg-blue-50/50 shadow-md transform scale-[1.02]'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                {/* Square placeholder image */}
                <div className="w-full aspect-square relative bg-gray-50 flex items-center justify-center">
                  <div className={`w-20 h-20 rounded-full bg-gradient-to-tr ${horse.bgGrad} flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform duration-300`}>
                    {horse.emoji}
                  </div>
                  {/* Select check badge */}
                  {isSelected && (
                    <div className="absolute top-3 right-3 bg-blue-600 text-white rounded-full p-1 shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-gray-100">
                  <h3 className="font-bold text-gray-950 text-base">{horse.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">Kỵ sĩ: <span className="font-semibold text-gray-700">{horse.jockey}</span></p>
                  
                  {/* AI prediction rate */}
                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded">AI dự đoán thắng</span>
                    <span className="text-sm font-bold text-purple-700">{horse.aiRate}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Section 3: Đặt điểm dự đoán */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <span>🔮</span> Bước 2: Thiết lập dự đoán & Điểm đặt
        </h2>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
          {/* Loại dự đoán */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700">Loại dự đoán:</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option Win */}
              <label
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  predictionType === 'win'
                    ? 'border-amber-500 bg-amber-50/40 shadow-sm'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="predictionType"
                  value="win"
                  checked={predictionType === 'win'}
                  onChange={() => setPredictionType('win')}
                  className="mt-1 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="block text-sm font-bold text-gray-900">Dự đoán về nhất (Win)</span>
                  <span className="block text-xs text-amber-700 font-medium mt-0.5">Thắng nhận +200đ điểm thưởng</span>
                </div>
              </label>

              {/* Option Place */}
              <label
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  predictionType === 'place'
                    ? 'border-amber-500 bg-amber-50/40 shadow-sm'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="predictionType"
                  value="place"
                  checked={predictionType === 'place'}
                  onChange={() => setPredictionType('place')}
                  className="mt-1 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="block text-sm font-bold text-gray-900">Dự đoán lọt Top 3 (Place)</span>
                  <span className="block text-xs text-amber-700 font-medium mt-0.5">Thắng nhận +100đ điểm thưởng</span>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Input điểm đặt */}
            <div className="space-y-2">
              <label htmlFor="points-input" className="block text-sm font-bold text-gray-700">
                Nhập số điểm muốn đặt:
              </label>
              <div className="relative rounded-xl shadow-sm">
                <input
                  id="points-input"
                  type="number"
                  min={10}
                  max={500}
                  value={pointsBet}
                  onChange={(e) => setPointsBet(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-800"
                  placeholder="Nhập từ 10 đến 500 điểm"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                  <span className="text-gray-400 text-xs font-bold uppercase">điểm</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 font-medium">Hạn mức tối thiểu: 10đ | Tối đa: 500đ</p>
            </div>

            {/* Tính toán ví thời gian thực */}
            <div className="flex flex-col justify-center bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Thông tin điểm ví</div>
              <div className="text-sm text-gray-800 mt-2 font-medium">
                Số dư ví hiện tại: <span className="font-bold">850đ</span>
              </div>
              <div className="text-sm mt-1 text-gray-600 font-medium">
                Sau khi đặt:{' '}
                <span className={`font-extrabold ${remainingBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {remainingBalance.toLocaleString('vi-VN')}đ
                </span>
              </div>
              {remainingBalance < 0 && (
                <p className="text-[11px] text-red-500 font-bold mt-1">⚠️ Số dư ví không đủ để thực hiện lượt đặt này!</p>
              )}
            </div>
          </div>

          {/* Nút bấm gửi dự đoán */}
          <div className="pt-4 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-500 font-medium text-center md:text-left">
              {selectedHorse ? (
                <span>
                  Bạn đang dự đoán cho chiến mã <strong className="text-gray-800">{selectedHorse.name}</strong> về{' '}
                  <strong className="text-amber-800">{predictionType === 'win' ? 'Nhất (Win)' : 'Top 3 (Place)'}</strong>.
                </span>
              ) : (
                <span className="text-red-500 font-semibold">⚠️ Vui lòng chọn chiến mã ở Bước 1 để tiếp tục.</span>
              )}
            </div>

            <button
              type="submit"
              disabled={!isFormValid || remainingBalance < 0}
              className={`w-full md:w-auto px-8 py-3 rounded-xl text-sm font-bold transition-all duration-200 text-center ${
                isFormValid && remainingBalance >= 0
                  ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-sm cursor-pointer'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
              }`}
            >
              Xác nhận gửi dự đoán
            </button>
          </div>
        </form>
      </section>

      {/* Success Modal/Toast khi gửi thành công */}
      {isSubmitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 text-center space-y-4 animate-scale-up">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-3xl mx-auto text-emerald-600">
              🎉
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-gray-900">Gửi dự đoán thành công!</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Hệ thống đã ghi nhận dự đoán của bạn dành cho chiến mã{' '}
                <strong className="text-gray-800">{selectedHorse?.name}</strong> với mức đặt{' '}
                <strong className="text-amber-700">{pointsBet}đ</strong>. Chúc bạn may mắn!
              </p>
            </div>
            <button
              onClick={() => setIsSubmitted(false)}
              className="w-full bg-slate-900 text-white font-bold py-2 rounded-xl text-xs hover:bg-slate-800 active:scale-95 transition-all"
            >
              Đóng và Tiếp tục
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
