import { useCallback, useEffect, useMemo, useState } from 'react'
import InvitationCard from '../../components/jockey/InvitationCard'
import { acceptPairing, declinePairing, getMyInvitations } from '../../services/jockeyService'
import type { RaceInvitation } from '../../types/jockey.types'

type FilterTab = 'all' | 'Pending' | 'Accepted' | 'Declined'
const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback

export default function InvitationList() {
  const [invitations, setInvitations] = useState<RaceInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [declineTarget, setDeclineTarget] = useState<number | null>(null)
  const [declineReason, setDeclineReason] = useState('')

  const loadInvitations = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getMyInvitations(undefined, 1, 100)
      setInvitations(result.items)
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Không tải được danh sách lời mời.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { const id = window.setTimeout(() => void loadInvitations(), 0); return () => window.clearTimeout(id) }, [loadInvitations])

  const handleAccept = async (pairingId: number) => {
    const invitation = invitations.find((item) => item.pairingId === pairingId)
    if (!invitation || invitation.status !== 'Pending') return

    setActionLoadingId(pairingId); setError(''); setSuccess('')
    try {
      await acceptPairing(pairingId)
      setInvitations((current) => current.map((item) => item.pairingId === pairingId
        ? { ...item, status: 'Accepted', respondedAt: new Date().toISOString() }
        : item
      ))
      setSuccess('Đã chấp nhận lời mời. Chủ ngựa sẽ thực hiện bước xác nhận tiếp theo.')
    } catch (actionError) {
      setError(getErrorMessage(actionError, 'Chấp nhận lời mời thất bại.'))
    } finally { setActionLoadingId(null) }
  }

  const handleDecline = async () => {
    if (declineTarget === null) return
    const pairingId = declineTarget
    setActionLoadingId(pairingId); setError(''); setSuccess('')
    try {
      await declinePairing(pairingId, declineReason.trim() || 'Jockey từ chối lời mời.')
      setDeclineTarget(null); setDeclineReason('')
      await loadInvitations()
      setSuccess('Đã từ chối lời mời.')
    } catch (actionError) {
      setError(getErrorMessage(actionError, 'Từ chối lời mời thất bại.'))
    } finally { setActionLoadingId(null) }
  }

  const filtered = useMemo(() => invitations.filter((invitation) => {
    if (activeTab === 'all') return true
    if (activeTab === 'Accepted') return invitation.status === 'Accepted' || invitation.status === 'Confirmed'
    if (activeTab === 'Declined') return invitation.status === 'Declined' || invitation.status === 'Cancelled'
    return invitation.status === activeTab
  }), [activeTab, invitations])

  const tabs: Array<{ key: FilterTab; label: string }> = [
    { key: 'all', label: 'Tất cả' }, { key: 'Pending', label: 'Chờ phản hồi' },
    { key: 'Accepted', label: 'Đã chấp nhận / Đã xác nhận' }, { key: 'Declined', label: 'Đã từ chối / Đã hủy' },
  ]

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">Ghép cặp</p><h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Lời mời ghép cặp</h1></div>
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{success}</div>}
      {error && <div role="alert" className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"><span>{error}</span>{invitations.length === 0 && <button type="button" onClick={() => void loadInvitations()} className="font-bold underline">Thử lại</button>}</div>}
      <div className="flex flex-wrap gap-2 border-b border-slate-200">{tabs.map((tab) => <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`border-b-2 px-3 py-2 text-sm font-bold ${activeTab === tab.key ? 'border-[#cfa73d] text-slate-950' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{tab.label}</button>)}</div>
      {loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">{[0, 1, 2].map((item) => <div key={item} className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />)}</div> : filtered.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm"><h2 className="font-bold text-slate-900">Không có lời mời trong mục này</h2><p className="mt-2 text-sm text-slate-500">Danh sách sẽ cập nhật khi Owner gửi hoặc xử lý lời mời.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((invitation) => <InvitationCard key={invitation.pairingId} invitation={invitation} actionLoading={actionLoadingId === invitation.pairingId} onAccept={(id) => void handleAccept(id)} onDecline={(id) => { setDeclineTarget(id); setDeclineReason(''); setError(''); setSuccess('') }} />)}</div>}
      {declineTarget !== null && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"><div role="dialog" aria-modal="true" aria-labelledby="decline-title" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 id="decline-title" className="font-black text-slate-950">Từ chối lời mời</h2><button type="button" onClick={() => setDeclineTarget(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Đóng</button></div><div className="p-5"><label className="text-sm font-bold text-slate-700">Lý do từ chối (tùy chọn)<textarea rows={4} value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Backend chấp nhận lý do tùy chọn" /></label><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setDeclineTarget(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold">Hủy</button><button type="button" onClick={() => void handleDecline()} disabled={actionLoadingId === declineTarget} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{actionLoadingId === declineTarget ? 'Đang xử lý...' : 'Xác nhận từ chối'}</button></div></div></div></div>}
    </div>
  )
}
