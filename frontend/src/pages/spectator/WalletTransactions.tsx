import { useEffect, useMemo, useState } from 'react'
import {
  getSpectatorWallet,
  getWalletTransactions,
  redeemTicketCode,
  type SpectatorWallet,
  type WalletTransaction,
} from '../../services/spectatorService'

type FilterTab = 'all' | 'positive' | 'negative'

function formatDate(value: string) {
  return new Date(value).toLocaleString('vi-VN')
}

export default function WalletTransactions() {
  const [wallet, setWallet] = useState<SpectatorWallet | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [ticketCode, setTicketCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [redeeming, setRedeeming] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = async (targetPage = page) => {
    try {
      setLoading(true)
      setError('')
      const [walletResult, transactionResult] = await Promise.all([
        getSpectatorWallet(),
        getWalletTransactions(targetPage, 50),
      ])
      setWallet(walletResult)
      setTransactions(transactionResult.items)
      setPage(transactionResult.page)
      setTotalPages(Math.max(1, transactionResult.totalPages))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được thông tin ví.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
  }, [])

  const filteredTransactions = useMemo(() => {
    if (activeTab === 'positive') return transactions.filter((item) => item.amount > 0)
    if (activeTab === 'negative') return transactions.filter((item) => item.amount < 0)
    return transactions
  }, [activeTab, transactions])

  const handleRedeem = async () => {
    const code = ticketCode.trim()
    if (code.length < 4) {
      setError('Vui lòng nhập mã vé thưởng hợp lệ.')
      return
    }
    try {
      setRedeeming(true)
      setError('')
      const result = await redeemTicketCode(code)
      setTicketCode('')
      setMessage(`Đã cộng ${result.pointsAdded.toLocaleString('vi-VN')} điểm vào ví.`)
      await load(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đổi mã vé thưởng.')
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <header className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-extrabold text-gray-900">Ví điểm cá nhân</h1>
        <p className="mt-1 text-sm text-gray-500">Theo dõi số dư và toàn bộ giao dịch điểm của bạn.</p>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-7 text-white shadow-lg">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Số dư khả dụng</p>
        <p className="mt-3 text-4xl font-black text-amber-300">
          {loading ? '...' : (wallet?.balance ?? 0).toLocaleString('vi-VN')} <span className="text-lg">điểm</span>
        </p>
        <p className="mt-2 text-xs text-slate-400">Tổng giao dịch: {wallet?.totalTransactions ?? 0}</p>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-gray-900">Đổi mã vé thưởng</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={ticketCode} onChange={(event) => setTicketCode(event.target.value)} placeholder="Nhập mã vé thưởng" maxLength={64} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none" />
          <button type="button" onClick={handleRedeem} disabled={redeeming} className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50">
            {redeeming ? 'Đang xử lý...' : 'Đổi mã'}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex gap-5 border-b border-gray-200">
          {([
            ['all', 'Tất cả'],
            ['positive', 'Điểm cộng'],
            ['negative', 'Điểm trừ'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)} className={`border-b-2 px-1 py-3 text-sm font-bold ${activeTab === key ? 'border-amber-600 text-amber-800' : 'border-transparent text-gray-500'}`}>{label}</button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-10 text-center text-sm text-gray-500">Đang tải giao dịch...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">Chưa có giao dịch nào.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr><th className="px-5 py-3">Thời gian</th><th className="px-5 py-3">Loại</th><th className="px-5 py-3">Tham chiếu</th><th className="px-5 py-3 text-right">Số điểm</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTransactions.map((item) => (
                    <tr key={item.transactionId}>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-600">{formatDate(item.createdAt)}</td>
                      <td className="px-5 py-4 font-semibold text-gray-900">{item.type}</td>
                      <td className="px-5 py-4 text-gray-500">{item.referenceId ?? '—'}</td>
                      <td className={`whitespace-nowrap px-5 py-4 text-right font-bold ${item.amount > 0 ? 'text-emerald-600' : item.amount < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString('vi-VN')} điểm
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <button disabled={page <= 1 || loading} onClick={() => load(page - 1)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-40">Trước</button>
            <span className="text-sm text-gray-500">Trang {page}/{totalPages}</span>
            <button disabled={page >= totalPages || loading} onClick={() => load(page + 1)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-40">Sau</button>
          </div>
        )}
      </section>
    </div>
  )
}
