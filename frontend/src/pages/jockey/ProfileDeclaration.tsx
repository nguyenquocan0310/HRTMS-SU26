import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  changeMyPassword,
  getMyAccountProfile,
  updateMyBasicInfo,
} from '../../services/accountService'
import { getMyProfile, updateMyProfile } from '../../services/jockeyService'
import type { UpdateProfilePayload } from '../../services/jockeyService'
import type { JockeyProfile } from '../../types/jockey.types'
import type { JockeyRoleProfile, UserProfile } from '../../types/account.types'
import CertificateViewer from '../../components/common/CertificateViewer'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const healthStatusOptions = [
  { value: 'Good', label: 'Tốt' },
  { value: 'Fair', label: 'Trung bình' },
  { value: 'Under Treatment', label: 'Đang điều trị' },
]

type JockeyAccountProfile = UserProfile<JockeyRoleProfile>

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

const inputClass = 'mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50'
const readOnlyClass = 'mt-2 min-h-11 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700'

function Feedback({ type, children }: { type: 'success' | 'error'; children: string }) {
  return (
    <p
      role={type === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-4 py-3 text-sm font-medium ${
        type === 'success'
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {children}
    </p>
  )
}

function SectionSkeleton() {
  return (
    <div className="grid animate-pulse gap-5 sm:grid-cols-2">
      {[0, 1, 2, 3].map((item) => <div key={item} className="h-20 rounded-lg bg-gray-100" />)}
    </div>
  )
}

export default function ProfileDeclaration() {
  const [account, setAccount] = useState<JockeyAccountProfile | null>(null)
  const [accountLoading, setAccountLoading] = useState(true)
  const [accountLoadError, setAccountLoadError] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [accountSaving, setAccountSaving] = useState(false)
  const [accountSuccess, setAccountSuccess] = useState('')
  const [accountError, setAccountError] = useState('')

  const applyAccount = useCallback((profile: JockeyAccountProfile) => {
    setAccount(profile)
    setFullName(profile.fullName)
    setEmail(profile.email)
  }, [])

  const loadAccount = useCallback(async () => {
    setAccountLoading(true)
    setAccountLoadError('')
    try {
      applyAccount(await getMyAccountProfile<JockeyRoleProfile>())
    } catch (error) {
      setAccountLoadError(errorMessage(error, 'Không tải được thông tin tài khoản.'))
    } finally {
      setAccountLoading(false)
    }
  }, [applyAccount])

  useEffect(() => {
    const id = window.setTimeout(() => { void loadAccount() }, 0)
    return () => window.clearTimeout(id)
  }, [loadAccount])

  const trimmedFullName = fullName.trim()
  const trimmedEmail = email.trim()
  const accountChanged = useMemo(
    () => Boolean(account) && (trimmedFullName !== account?.fullName || trimmedEmail !== account?.email),
    [account, trimmedEmail, trimmedFullName],
  )

  const handleAccountSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAccountSuccess('')
    setAccountError('')
    if (!trimmedFullName) return setAccountError('Họ và tên không được để trống.')
    if (!trimmedEmail) return setAccountError('Email không được để trống.')
    if (!EMAIL_PATTERN.test(trimmedEmail)) return setAccountError('Email không đúng định dạng.')
    if (!accountChanged) return

    setAccountSaving(true)
    try {
      let message = 'Cập nhật thông tin thành công.'
      await updateMyBasicInfo(
        { fullName: trimmedFullName, email: trimmedEmail },
        (nextMessage) => { message = nextMessage },
      )
      applyAccount(await getMyAccountProfile<JockeyRoleProfile>())
      window.dispatchEvent(new CustomEvent('hrtms:profile-changed'))
      setAccountSuccess(message)
    } catch (error) {
      setAccountError(errorMessage(error, 'Cập nhật thông tin thất bại.'))
    } finally {
      setAccountSaving(false)
    }
  }

  const [professional, setProfessional] = useState<JockeyProfile | null>(null)
  const [professionalForm, setProfessionalForm] = useState<UpdateProfilePayload>({
    licenseCertificate: '', selfDeclaredWeight: 0, bloodType: null, healthStatus: null,
  })
  const [professionalLoading, setProfessionalLoading] = useState(true)
  const [professionalSaving, setProfessionalSaving] = useState(false)
  const [professionalError, setProfessionalError] = useState('')
  const [professionalSuccess, setProfessionalSuccess] = useState('')

  const loadProfessional = useCallback(async () => {
    setProfessionalLoading(true)
    setProfessionalError('')
    try {
      const profile = await getMyProfile()
      setProfessional(profile)
      setProfessionalForm({
        licenseCertificate: profile.licenseCertificate || '',
        selfDeclaredWeight: profile.selfDeclaredWeight,
        bloodType: profile.bloodType,
        healthStatus: profile.healthStatus,
      })
    } catch (error) {
      setProfessionalError(errorMessage(error, 'Không tải được hồ sơ chuyên môn.'))
    } finally {
      setProfessionalLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => { void loadProfessional() }, 0)
    return () => window.clearTimeout(id)
  }, [loadProfessional])

  const handleProfessionalSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfessionalSuccess('')
    setProfessionalError('')
    if (professionalForm.selfDeclaredWeight == null || professionalForm.selfDeclaredWeight <= 0 || professionalForm.selfDeclaredWeight > 300) return setProfessionalError('Cân nặng phải lớn hơn 0 và không vượt quá 300 kg.')
    if ((professionalForm.licenseCertificate?.trim().length ?? 0) > 100) return setProfessionalError('Chứng chỉ hành nghề không được vượt quá 100 ký tự.')

    setProfessionalSaving(true)
    try {
      const result = await updateMyProfile({
        ...professionalForm,
        licenseCertificate: professionalForm.licenseCertificate?.trim() || null,
      })
      setProfessionalSuccess(result.message || 'Cập nhật hồ sơ thành công.')
      await loadProfessional()
    } catch (error) {
      setProfessionalError(errorMessage(error, 'Cập nhật hồ sơ chuyên môn thất bại.'))
    } finally {
      setProfessionalSaving(false)
    }
  }

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    if (!currentPassword || !newPassword || !confirmPassword) return setPasswordError('Vui lòng nhập đầy đủ thông tin mật khẩu.')
    if (newPassword.length < 6) return setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự.')
    if (newPassword !== confirmPassword) return setPasswordError('Xác nhận mật khẩu mới không khớp.')
    if (newPassword === currentPassword) return setPasswordError('Mật khẩu mới phải khác mật khẩu hiện tại.')

    setPasswordSaving(true)
    try {
      let message = 'Đổi mật khẩu thành công.'
      await changeMyPassword({ currentPassword, newPassword }, (nextMessage) => { message = nextMessage })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(message)
    } catch (error) {
      setPasswordError(errorMessage(error, 'Đổi mật khẩu thất bại.'))
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">Hồ sơ</p>
        <h1 className="mt-1 text-2xl font-black text-gray-900 sm:text-3xl">Hồ sơ Jockey</h1>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Thông tin tài khoản</h2>
        <div className="mt-6">
          {accountLoading ? <SectionSkeleton /> : accountLoadError || !account ? (
            <div className="space-y-3">
              <Feedback type="error">{accountLoadError || 'Dữ liệu tài khoản không tồn tại.'}</Feedback>
              <button type="button" onClick={() => void loadAccount()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Thử lại</button>
            </div>
          ) : (
            <form onSubmit={handleAccountSubmit} className="space-y-5" noValidate>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-semibold text-gray-700">Họ và tên<input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={accountSaving} autoComplete="name" className={inputClass} /></label>
                <label className="text-sm font-semibold text-gray-700">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={accountSaving} autoComplete="email" className={inputClass} /></label>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <div><p className="text-sm font-semibold text-gray-700">Username</p><p className={readOnlyClass}>{account.username}</p></div>
                <div><p className="text-sm font-semibold text-gray-700">Role</p><p className={readOnlyClass}>{account.role}</p></div>
                <div><p className="text-sm font-semibold text-gray-700">Trạng thái tài khoản</p><p className={readOnlyClass}>{account.status}</p></div>
              </div>
              {accountSuccess && <Feedback type="success">{accountSuccess}</Feedback>}
              {accountError && <Feedback type="error">{accountError}</Feedback>}
              <div className="flex justify-end"><button type="submit" disabled={accountSaving || !accountChanged} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{accountSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div>
            </form>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Hồ sơ chuyên môn</h2>
        <div className="mt-6">
          {professionalLoading ? <SectionSkeleton /> : !professional ? (
            <div className="space-y-3"><Feedback type="error">{professionalError || 'Dữ liệu hồ sơ không tồn tại.'}</Feedback><button type="button" onClick={() => void loadProfessional()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Thử lại</button></div>
          ) : (
            <form onSubmit={handleProfessionalSubmit} className="space-y-5" noValidate>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-semibold text-gray-700">Chứng chỉ hành nghề<input maxLength={100} value={professionalForm.licenseCertificate ?? ''} onChange={(e) => setProfessionalForm((p) => ({ ...p, licenseCertificate: e.target.value }))} disabled={professionalSaving} className={inputClass} /></label>
                <div><p className="text-sm font-semibold text-gray-700">Số năm kinh nghiệm (chỉ đọc)</p><p className={readOnlyClass}>{professional.experienceYears}</p></div>
                <label className="text-sm font-semibold text-gray-700">Cân nặng tự khai báo (kg)<input type="number" min="0.01" max="300" step="0.1" value={professionalForm.selfDeclaredWeight ?? ''} onChange={(e) => setProfessionalForm((p) => ({ ...p, selfDeclaredWeight: e.target.value === '' ? null : Number(e.target.value) }))} disabled={professionalSaving} className={inputClass} /></label>
                <label className="text-sm font-semibold text-gray-700">Nhóm máu<select value={professionalForm.bloodType || ''} onChange={(e) => setProfessionalForm((p) => ({ ...p, bloodType: e.target.value || null }))} disabled={professionalSaving} className={inputClass}><option value="">Chưa cập nhật</option>{['A', 'B', 'AB', 'O'].map((value) => <option key={value}>{value}</option>)}</select></label>
                <label className="text-sm font-semibold text-gray-700">Tình trạng sức khỏe<select value={professionalForm.healthStatus || ''} onChange={(e) => setProfessionalForm((p) => ({ ...p, healthStatus: e.target.value || null }))} disabled={professionalSaving} className={inputClass}><option value="">Chưa cập nhật</option>{healthStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <div><p className="text-sm font-semibold text-gray-700">Trạng thái hồ sơ</p><p className={readOnlyClass}>{professional.status}</p></div>
              </div>
              {professionalSuccess && <Feedback type="success">{professionalSuccess}</Feedback>}
              {professionalError && <Feedback type="error">{professionalError}</Feedback>}
              <div className="flex justify-end"><button type="submit" disabled={professionalSaving} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{professionalSaving ? 'Đang lưu...' : 'Cập nhật hồ sơ'}</button></div>
            </form>
          )}
        </div>
      </section>

      <CertificateViewer certificate={account?.profile?.certificate} />

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Bảo mật</h2>
        <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-5" noValidate>
          <div className="grid gap-5 lg:grid-cols-3">
            <label className="text-sm font-semibold text-gray-700">Mật khẩu hiện tại<input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={passwordSaving} autoComplete="current-password" className={inputClass} /></label>
            <label className="text-sm font-semibold text-gray-700">Mật khẩu mới<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={passwordSaving} autoComplete="new-password" className={inputClass} /></label>
            <label className="text-sm font-semibold text-gray-700">Xác nhận mật khẩu mới<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={passwordSaving} autoComplete="new-password" className={inputClass} /></label>
          </div>
          {passwordSuccess && <Feedback type="success">{passwordSuccess}</Feedback>}
          {passwordError && <Feedback type="error">{passwordError}</Feedback>}
          <div className="flex justify-end"><button type="submit" disabled={passwordSaving} className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{passwordSaving ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}</button></div>
        </form>
      </section>
    </div>
  )
}
