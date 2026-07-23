import { useCallback, useEffect, useState } from 'react'
import { FiCheckCircle, FiDownload, FiRefreshCw, FiXCircle } from 'react-icons/fi'
import {
  downloadFeePaymentProof,
  getAdminFeePayments,
  rejectFeePayment,
  verifyFeePayment,
  type FeePaymentRecord,
} from '../../services/entryFeePaymentService'

type PaymentFilter = '' | 'PendingVerification' | 'Verified' | 'Rejected'

const statusPresentation: Record<string, { label: string; className: string }> = {
  PendingVerification: { label: 'Chờ đối chứng', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  Verified: { label: 'Đã xác nhận', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  Rejected: { label: 'Đã từ chối', className: 'border-red-200 bg-red-50 text-red-700' },
}

const formatCurrency = (value: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
}).format(value)

const formatDateTime = (value: string) => new Date(value).toLocaleString('vi-VN', {
  hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
})

export default function EntryFees() {
  const [payments, setPayments] = useState<FeePaymentRecord[]>([])
  const [filter, setFilter] = useState<PaymentFilter>('PendingVerification')
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<number | null>(null)
  const [rejecting, setRejecting] = useState<FeePaymentRecord | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadPayments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const page = await getAdminFeePayments(filter)
      setPayments(page.items ?? [])
    } catch (err) {
      setPayments([])
      setError(err instanceof Error ? err.message : 'Không tải được hồ sơ lệ phí.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPayments(), 0)
    return () => window.clearTimeout(timer)
  }, [loadPayments])

  const verify = async (payment: FeePaymentRecord) => {
    if (!window.confirm(`Xác nhận chứng từ của ${payment.ownerName} và hoàn tất ghép cặp ${payment.horseName} / ${payment.jockeyName}?`)) return
    setActionId(payment.paymentId)
    setError('')
    setMessage('')
    try {
      await verifyFeePayment(payment.paymentId)
      setMessage('Đã đối chứng đúng lệ phí. Cặp ngựa và Jockey đã ghép thành công.')
      await loadPayments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xác nhận chứng từ thất bại.')
    } finally {
      setActionId(null)
    }
  }

  const reject = async () => {
    if (!rejecting || rejectReason.trim().length < 10) return
    setActionId(rejecting.paymentId)
    setError('')
    setMessage('')
    try {
      await rejectFeePayment(rejecting.paymentId, rejectReason)
      setMessage('Đã từ chối chứng từ. Owner có thể nộp lại trước hạn.')
      setRejecting(null)
      setRejectReason('')
      await loadPayments()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Từ chối chứng từ thất bại.')
    } finally {
      setActionId(null)
    }
  }

  const downloadProof = async (payment: FeePaymentRecord) => {
    setActionId(payment.paymentId)
    setError('')
    try {
      await downloadFeePaymentProof(payment)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được chứng từ.')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">Đối chứng thanh toán</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">Lệ phí ghép cặp</h1>
          <p className="mt-2 text-sm text-slate-500">Kiểm tra mã giao dịch và chứng từ trước khi xác nhận cặp ngựa – Jockey.</p>
        </div>
        <button type="button" onClick={() => void loadPayments()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Làm mới
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {([['', 'Tất cả'], ['PendingVerification', 'Chờ đối chứng'], ['Verified', 'Đã xác nhận'], ['Rejected', 'Đã từ chối']] as const).map(([value, label]) => (
          <button key={value || 'all'} type="button" onClick={() => setFilter(value)} className={`rounded-full border px-4 py-2 text-sm font-bold ${filter === value ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</div>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Owner</th><th className="px-4 py-3">Ngựa / Jockey</th>
                <th className="px-4 py-3">Giải đấu</th><th className="px-4 py-3">Thanh toán</th>
                <th className="px-4 py-3">Chứng từ</th><th className="px-4 py-3">Ngày nộp</th>
                <th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-16 text-center text-slate-500">Đang tải hồ sơ lệ phí...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-16 text-center text-slate-500">Không có hồ sơ phù hợp.</td></tr>
              ) : payments.map((payment) => {
                const status = statusPresentation[payment.status] ?? { label: payment.status, className: 'border-slate-200 bg-slate-50 text-slate-600' }
                const busy = actionId === payment.paymentId
                return (
                  <tr key={payment.paymentId} className="align-top">
                    <td className="px-4 py-4"><p className="font-bold text-slate-900">{payment.ownerName}</p><p className="mt-1 text-xs text-slate-400">Payment #{payment.paymentId}</p></td>
                    <td className="px-4 py-4"><p className="font-bold text-slate-900">{payment.horseName}</p><p className="mt-1 text-xs text-slate-500">Jockey: {payment.jockeyName}</p></td>
                    <td className="px-4 py-4 text-slate-600">{payment.tournamentName}</td>
                    <td className="px-4 py-4"><p className="font-black text-slate-900">{formatCurrency(payment.amount)}</p><p className="mt-1 text-xs text-slate-500">{payment.method === 'Transfer' ? 'Chuyển khoản' : 'Tiền mặt'} · {payment.transferRef || payment.receiptNo || '—'}</p></td>
                    <td className="px-4 py-4">{payment.hasProof ? <button type="button" onClick={() => void downloadProof(payment)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50"><FiDownload /> {payment.proofFileName || 'Tải chứng từ'}</button> : <span className="text-xs text-slate-400">Không có file</span>}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatDateTime(payment.submittedAt)}</td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>{payment.rejectReason && <p className="mt-2 max-w-52 text-xs text-red-600">{payment.rejectReason}</p>}</td>
                    <td className="px-4 py-4 text-right">{payment.status === 'PendingVerification' ? <div className="flex justify-end gap-2"><button type="button" onClick={() => void verify(payment)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><FiCheckCircle /> Xác nhận đúng</button><button type="button" onClick={() => { setRejecting(payment); setRejectReason('') }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50"><FiXCircle /> Từ chối</button></div> : <span className="text-xs text-slate-400">Đã xử lý</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {rejecting && <><button type="button" aria-label="Đóng modal từ chối" className="fixed inset-0 z-40 bg-black/45" onClick={() => setRejecting(null)} /><div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-labelledby="reject-payment-title" className="pointer-events-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 id="reject-payment-title" className="text-xl font-black text-slate-950">Từ chối chứng từ</h2><p className="mt-2 text-sm text-slate-500">Owner sẽ được phép nộp lại lệ phí trước hạn.</p><textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} rows={4} className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-red-400" placeholder="Nhập lý do, tối thiểu 10 ký tự" />{rejectReason.length > 0 && rejectReason.trim().length < 10 && <p className="mt-2 text-xs text-red-600">Cần ít nhất 10 ký tự.</p>}<div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => setRejecting(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">Hủy</button><button type="button" onClick={() => void reject()} disabled={rejectReason.trim().length < 10 || actionId !== null} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Xác nhận từ chối</button></div></div></div></>}
    </div>
  )
}
