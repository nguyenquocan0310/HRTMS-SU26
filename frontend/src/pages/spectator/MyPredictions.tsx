import React, { useState } from 'react'

interface PredictionTicket {
  id: string
  raceName: string
  horseName: string
  betType: 'Win' | 'Place'
  betPoints: number
  actualResult: string
  status: 'pending' | 'win' | 'lose' | 'refund'
  statusLabel: string
  rewardPoints: number
}

type FilterStatus = 'all' | 'pending' | 'win' | 'lose' | 'refund'

export default function MyPredictions() {
  const [activeTab, setActiveTab] = useState<FilterStatus>('all')

  const tickets: PredictionTicket[] = [
    {
      id: 'ticket-05',
      raceName: 'Lượt 2 - Giải Vô Địch Quốc Gia 2026',
      horseName: 'Thần Phong',
      betType: 'Win',
      betPoints: 500,
      actualResult: 'Đang chuẩn bị chạy',
      status: 'pending',
      statusLabel: 'Đang chờ kết quả',
      rewardPoints: 0,
    },
    {
      id: 'ticket-04',
      raceName: 'Lượt 1 - Cup Ngôi Sao 2026',
      horseName: 'Xích Thố',
      betType: 'Place',
      betPoints: 100,
      actualResult: 'Về nhì (Hạng 2)',
      status: 'win',
      statusLabel: 'Đã thắng điểm',
      rewardPoints: 150, // Thắng nhận thêm 150
    },
    {
      id: 'ticket-03',
      raceName: 'Vòng loại Cúp Tốc Độ Hà Nội',
      horseName: 'Hắc Nhãn',
      betType: 'Win',
      betPoints: 200,
      actualResult: 'Về thứ tư (Hạng 4)',
      status: 'lose',
      statusLabel: 'Thua cuộc',
      rewardPoints: 0,
    },
    {
      id: 'ticket-02',
      raceName: 'Lượt đua số 4 - Hủy do thời tiết',
      horseName: 'Bạch Long',
      betType: 'Win',
      betPoints: 200,
      actualResult: 'Hủy giải đua (Thời tiết xấu)',
      status: 'refund',
      statusLabel: 'Đã hoàn trả điểm',
      rewardPoints: 200, // Hoàn trả gốc
    },
    {
      id: 'ticket-01',
      raceName: 'Trận Chung Kết - Derby Mùa Hè',
      horseName: 'Thần Phong',
      betType: 'Win',
      betPoints: 300,
      actualResult: 'Về nhất (Hạng 1)',
      status: 'win',
      statusLabel: 'Đã thắng điểm',
      rewardPoints: 600, // Thắng lớn nhận 600
    },
  ]

  // Filter tickets based on selection
  const filteredTickets = activeTab === 'all'
    ? tickets
    : tickets.filter((ticket) => ticket.status === activeTab)

  const tabs: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'pending', label: 'Đang chờ kết quả' },
    { key: 'win', label: 'Đã thắng điểm' },
    { key: 'lose', label: 'Thua cuộc' },
    { key: 'refund', label: 'Đã hoàn trả điểm' },
  ]

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight bg-gradient-to-r from-amber-600 to-amber-900 bg-clip-text text-transparent">
          Lịch sử phiếu dự đoán của tôi
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Theo dõi tiến độ, kết quả thực tế từ trọng tài và thống kê hiệu suất dự đoán cá nhân.
        </p>
      </div>

      {/* Bộ lọc danh mục trạng thái phiếu (Tabs) */}
      <section className="space-y-4">
        <div className="flex overflow-x-auto border-b border-gray-200 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex space-x-6">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`py-3 text-sm font-bold border-b-2 transition-all duration-200 whitespace-nowrap focus:outline-none ${
                    isActive
                      ? 'border-amber-600 text-amber-900'
                      : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Bảng danh sách phiếu đặt (Table) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <th className="py-3.5 px-6">Tên cuộc đua</th>
                  <th className="py-3.5 px-6">Chiến mã chọn</th>
                  <th className="py-3.5 px-6">Loại đặt</th>
                  <th className="py-3.5 px-6 text-right">Điểm đặt cược</th>
                  <th className="py-3.5 px-6">Kết quả thực tế</th>
                  <th className="py-3.5 px-6 text-center">Trạng thái</th>
                  <th className="py-3.5 px-6 text-right pr-8">Điểm thu về</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredTickets.length > 0 ? (
                  filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6 text-gray-900 font-bold max-w-xs truncate" title={ticket.raceName}>
                        {ticket.raceName}
                      </td>
                      <td className="py-4 px-6 font-medium text-gray-700 whitespace-nowrap">
                        🐴 {ticket.horseName}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                            ticket.betType === 'Win'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {ticket.betType}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-bold text-gray-700 whitespace-nowrap">
                        {ticket.betPoints.toLocaleString('vi-VN')}đ
                      </td>
                      <td className="py-4 px-6 text-gray-600 font-medium">
                        {ticket.actualResult}
                      </td>
                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            ticket.status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : ticket.status === 'win'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : ticket.status === 'lose'
                              ? 'bg-gray-100 text-gray-600 border-gray-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {ticket.statusLabel}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right pr-8 font-extrabold whitespace-nowrap">
                        {ticket.status === 'win' ? (
                          <span className="text-emerald-600">+{ticket.rewardPoints}đ</span>
                        ) : ticket.status === 'refund' ? (
                          <span className="text-blue-600">+{ticket.rewardPoints}đ</span>
                        ) : (
                          <span className="text-gray-400">0đ</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 font-medium">
                      📭 Không tìm thấy phiếu dự đoán nào phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Khối thống kê tổng kết */}
      <section className="bg-gradient-to-r from-gray-50 to-slate-100 rounded-2xl border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl bg-white p-2 rounded-xl shadow-sm">📊</span>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Thống kê hiệu quả dự đoán</h3>
              <p className="text-xs text-gray-500">Số liệu tổng hợp của bạn từ khi tham gia hệ thống</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-gray-600">
            <div>
              Tổng số trận: <span className="text-gray-900 font-bold text-sm">20</span>
            </div>
            <div className="h-4 w-px bg-gray-300 hidden md:block"></div>
            <div>
              Đoán trúng: <span className="text-emerald-600 font-bold text-sm">12</span>
            </div>
            <div className="h-4 w-px bg-gray-300 hidden md:block"></div>
            <div>
              Thua cuộc: <span className="text-rose-600 font-bold text-sm">7</span>
            </div>
            <div className="h-4 w-px bg-gray-300 hidden md:block"></div>
            <div>
              Hoàn trả: <span className="text-blue-600 font-bold text-sm">1</span>
            </div>
            <div className="h-4 w-px bg-gray-300 hidden md:block"></div>
            <div>
              Tỉ lệ chính xác:{' '}
              <span className="text-purple-700 font-black text-sm bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                60%
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
