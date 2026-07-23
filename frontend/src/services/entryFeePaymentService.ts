import { API_BASE_URL, apiFetch } from './apiClient'

export type FeePaymentMethod = 'Cash' | 'Transfer'

export interface FeePaymentRecord {
  paymentId: number
  pairingId: number
  tournamentId: number
  tournamentName: string
  horseId: number
  horseName: string
  jockeyId: number
  jockeyName: string
  ownerId: number
  ownerName: string
  amount: number
  method: FeePaymentMethod
  receiptNo: string | null
  transferRef: string | null
  proofFileName: string | null
  hasProof: boolean
  status: string
  submittedAt: string
  verifiedBy: number | null
  verifiedAt: string | null
  rejectReason: string | null
  pairingStatus: string
}

export interface FeePaymentPage {
  items: FeePaymentRecord[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

export interface SubmitFeePaymentInput {
  method: FeePaymentMethod
  reference: string
  proofFile?: File | null
}

export const submitPairingFeePayment = (
  pairingId: number | string,
  input: SubmitFeePaymentInput,
): Promise<FeePaymentRecord> => {
  const form = new FormData()
  form.append('Method', input.method)
  form.append(input.method === 'Transfer' ? 'TransferRef' : 'ReceiptNo', input.reference.trim())
  if (input.proofFile) form.append('proofFile', input.proofFile)

  return apiFetch<FeePaymentRecord>(`/pairings/${pairingId}/fee-payment`, {
    method: 'POST',
    body: form,
  })
}

export const getAdminFeePayments = (
  status = 'PendingVerification',
  page = 1,
  pageSize = 100,
): Promise<FeePaymentPage> => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (status) params.set('status', status)
  return apiFetch<FeePaymentPage>(`/admin/fee-payments?${params.toString()}`)
}

export const verifyFeePayment = (paymentId: number): Promise<FeePaymentRecord> =>
  apiFetch<FeePaymentRecord>(`/admin/fee-payments/${paymentId}/verify`, { method: 'POST' })

export const rejectFeePayment = (paymentId: number, reason: string): Promise<FeePaymentRecord> =>
  apiFetch<FeePaymentRecord>(`/admin/fee-payments/${paymentId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason.trim() }),
  })

export const downloadFeePaymentProof = async (payment: FeePaymentRecord): Promise<void> => {
  const token = sessionStorage.getItem('token') ?? localStorage.getItem('token')
  const response = await fetch(`${API_BASE_URL}/fee-payments/${payment.paymentId}/proof`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error('Không tải được chứng từ lệ phí.')

  const objectUrl = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = payment.proofFileName || `chung-tu-${payment.paymentId}`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}
