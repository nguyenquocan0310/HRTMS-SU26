import React, { useState } from 'react'

interface Transaction {
  id: string
  date: string
  type: 'deposit' | 'bet' | 'reward' | 'refund'
  typeLabel: string
  details: string
  amount: number
  balanceAfter: number
}

type FilterTab = 'all' | 'deposit' | 'bet' | 'reward' | 'refund'

export default function WalletTransactions() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const transactions: Transaction[] = [
    {
      id: 'tx-07',
      date: '18/06/2026 12:30',
      type: 'reward',
      typeLabel: 'Nhận thưởng giải',
      details: 'Thưởng dự đoán chính xác "Place" chiến mã Xích Thố - Lượt 1 Cup Ngôi Sao',
      amount: 150,
      balanceAfter: 850,
    },
    {
      id: 'tx-06',
      date: '18/06/2026 10:15',
      type: 'bet',
      typeLabel: 'Đặt dự đoán',
      details: 'Đặt dự đoán "Win" cho chiến mã Thần Phong - Lượt 2 Cup Ngôi Sao 2026',
      amount: -500,
      balanceAfter: 700,
    },
    {
      id: 'tx-05',
      date: '17/06/2026 19:00',
      type: 'refund',
      typeLabel: 'Hoàn trả điểm',
      details: 'Hoàn trả điểm cược - Hủy lượt đua số 4 do thời tiết xấu',
      amount: 200,
      balanceAfter: 1200,
    },
    {
      id: 'tx-04',
      date: '17/06/2026 18:30',
      type: 'bet',
      typeLabel: 'Đặt dự đoán',
      details: 'Đặt dự đoán "Win" cho chiến mã Hắc Nhãn - Lượt 4 Derby Mùa Hè',
      amount: -200,
      balanceAfter: 1000,
    },
    {
      id: 'tx-03',
      date: '17/06/2026 09:30',
      type: 'deposit',
      typeLabel: 'Nạp điểm',
      details: 'Nạp điểm trực tuyến thành công qua ví điện tử VNPay',
      amount: 500,
      balanceAfter: 1200,
    },
    {
      id: 'tx-02',
      date: '16/06/2026 14:00',
      type: 'bet',
      typeLabel: 'Đặt dự đoán',
      details: 'Đặt dự đoán "Place" cho chiến mã Bạch Long - Vòng loại Derby',
      amount: -300,
      balanceAfter: 700,
    },
    {
      id: 'tx-01',
      date: '15/06/2026 08:00',
      type: 'deposit',
      typeLabel: 'Nạp điểm',
      details: 'Hệ thống tự động cộng điểm thưởng trải nghiệm đăng ký tài khoản mới',
      amount: 1000,
      balanceAfter: 1000,
    },
  ]

  // Filter transactions based on selected tab
  const filteredTransactions = activeTab === 'all'
    ? transactions
    : transactions.filter((tx) => tx.type === activeTab)

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'deposit', label: 'Nạp điểm' },
    { key: 'bet', label: 'Đặt dự đoán' },
    { key: 'reward', label: 'Nhận thưởng giải' },
    { key: 'refund', label: 'Hoàn trả điểm' },
  ]

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight bg-gradient-to-r from-amber-600 to-amber-900 bg-clip-text text-transparent">
          Ví điểm cá nhân & Giao dịch
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Quản lý số dư, xem lịch sử biến động điểm số và nạp/rút điểm thưởng của bạn.
        </p>
      </div>

      {/* Khối hiển thị số dư (Balance Banner) */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white p-8 rounded-3xl shadow-xl border border-slate-800">
        {/* Background decorative shapes */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl -z-0"></div>
        <div className="absolute left-1/3 bottom-0 w-40 h-40 bg-blue-500/5 rounded-full blur-2xl -z-0"></div>

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Số dư ví khả dụng</span>
            <span className="text-xs bg-amber-500/20 text-amber-300 font-bold px-3 py-1 rounded-full border border-amber-500/30">
              Ví chính thức
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
              850
            </span>
            <span className="text-xl font-bold text-amber-300">Điểm</span>
          </div>

          <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-xl pt-2 border-t border-slate-800">
            ℹ️ Hệ thống tự động cộng <strong className="text-emerald-400">+1000 điểm thưởng</strong> trải nghiệm khi bạn đăng ký tài khoản thành công.
          </p>
        </div>
      </section>

      {/* Bộ điều hướng bộ lọc (Tabs Filter) */}
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

        {/* Bảng lịch sử giao dịch (Table) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <th className="py-3.5 px-6">Ngày giao dịch</th>
                  <th className="py-3.5 px-6">Loại giao dịch</th>
                  <th className="py-3.5 px-6">Nội dung chi tiết</th>
                  <th className="py-3.5 px-6 text-right">Biến động</th>
                  <th className="py-3.5 px-6 text-right pr-8">Số dư sau GD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => {
                    const isPositive = tx.amount > 0
                    return (
                      <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-6 text-gray-600 whitespace-nowrap">
                          {tx.date}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              tx.type === 'deposit'
                                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                : tx.type === 'bet'
                                ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                : tx.type === 'reward'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-slate-50 text-slate-700 border border-slate-100'
                            }`}
                          >
                            {tx.typeLabel}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-700 font-medium max-w-sm truncate" title={tx.details}>
                          {tx.details}
                        </td>
                        <td
                          className={`py-4 px-6 text-right font-bold whitespace-nowrap ${
                            isPositive ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isPositive ? `+${tx.amount.toLocaleString('vi-VN')}` : tx.amount.toLocaleString('vi-VN')} điểm
                        </td>
                        <td className="py-4 px-6 text-right pr-8 font-bold text-gray-800 whitespace-nowrap">
                          {tx.balanceAfter.toLocaleString('vi-VN')}đ
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 font-medium">
                      📭 Không có giao dịch nào phù hợp với bộ lọc đã chọn.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
