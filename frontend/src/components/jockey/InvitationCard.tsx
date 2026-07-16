import type { RaceInvitation } from '../../types/jockey.types'

interface InvitationCardProps {
  invitation: RaceInvitation
  actionLoading?: boolean
  onAccept: (pairingId: number) => void
  onDecline: (pairingId: number) => void
}

const statusConfig: Record<RaceInvitation['status'], { label: string; cls: string }> = {
  Pending: { label: 'Chờ phản hồi', cls: 'border-amber-200 bg-amber-50 text-amber-800' },
  Accepted: { label: 'Đã chấp nhận', cls: 'border-blue-200 bg-blue-50 text-blue-700' },
  Confirmed: { label: 'Đã xác nhận', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  Declined: { label: 'Đã từ chối', cls: 'border-red-200 bg-red-50 text-red-700' },
  Cancelled: { label: 'Đã hủy', cls: 'border-slate-200 bg-slate-100 text-slate-600' },
}

export default function InvitationCard({ invitation, actionLoading = false, onAccept, onDecline }: InvitationCardProps) {
  const config = statusConfig[invitation.status]
  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#cfa73d]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ngựa được mời ghép cặp</p><h2 className="mt-1 truncate text-lg font-black text-slate-950">{invitation.horseName}</h2>{invitation.breedCode && <p className="mt-1 text-xs text-slate-500">Giống: {invitation.breedCode}</p>}</div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${config.cls}`}>{config.label}</span>
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-slate-500">Chủ ngựa</dt><dd className="text-right font-bold text-slate-900">{invitation.ownerName}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-slate-500">Gửi lúc</dt><dd className="text-right font-semibold text-slate-700">{new Date(invitation.invitedAt).toLocaleString('vi-VN')}</dd></div>
        {invitation.respondedAt && <div className="flex justify-between gap-4"><dt className="text-slate-500">Phản hồi lúc</dt><dd className="text-right font-semibold text-slate-700">{new Date(invitation.respondedAt).toLocaleString('vi-VN')}</dd></div>}
        {invitation.requestMessage && <div><dt className="text-slate-500">Lời nhắn</dt><dd className="mt-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 leading-6 text-slate-700">{invitation.requestMessage}</dd></div>}
      </dl>
      {invitation.status === 'Pending' && <div className="mt-auto grid grid-cols-2 gap-2 pt-5"><button type="button" onClick={() => onAccept(invitation.pairingId)} disabled={actionLoading} className="rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-bold disabled:cursor-wait disabled:opacity-60">{actionLoading ? 'Đang xử lý...' : 'Chấp nhận'}</button><button type="button" onClick={() => onDecline(invitation.pairingId)} disabled={actionLoading} className="rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">Từ chối</button></div>}
    </article>
  )
}
