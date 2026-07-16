import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  changeMyPassword,
  getMyAccountProfile,
  updateMyBasicInfo,
} from '../../services/accountService'
import {
  getRefereeProfile,
  updateRefereeProfile,
  type RefereeProfile as RefereeProfessionalProfile,
} from '../../services/refereeService'
import type { RefereeRoleProfile, UserProfile } from '../../types/account.types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CERTIFICATION_MAX_LENGTH = 50

type RefereeAccountProfile = UserProfile<RefereeRoleProfile>

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

const formatDate = (value?: string) => {
  if (!value) return 'Chưa có thông tin'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

const formatFileSize = (bytes?: number) => {
  if (bytes === undefined || bytes === null) return 'Chưa có thông tin'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const statusClass = (status: string) => {
  const normalized = status.toLowerCase()
  if (normalized === 'pending') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (normalized === 'active' || normalized === 'approved') return 'border-green-200 bg-green-50 text-green-700'
  return 'border-gray-200 bg-gray-50 text-gray-700'
}

export default function RefereeProfile() {
  const [account, setAccount] = useState<RefereeAccountProfile | null>(null)
  const [professional, setProfessional] = useState<RefereeProfessionalProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)
  const [accountSuccess, setAccountSuccess] = useState('')
  const [accountError, setAccountError] = useState('')

  const [certificationLevel, setCertificationLevel] = useState('')
  const [certificationConfirmed, setCertificationConfirmed] = useState(false)
  const [savingProfessional, setSavingProfessional] = useState(false)
  const [professionalSuccess, setProfessionalSuccess] = useState('')
  const [professionalError, setProfessionalError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const applyAccount = useCallback((nextAccount: RefereeAccountProfile) => {
    setAccount(nextAccount)
    setFullName(nextAccount.fullName)
    setEmail(nextAccount.email)
  }, [])

  const applyProfessional = useCallback((nextProfile: RefereeProfessionalProfile) => {
    setProfessional(nextProfile)
    setCertificationLevel(nextProfile.certificationLevel)
    setCertificationConfirmed(false)
  }, [])

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [nextAccount, nextProfessional] = await Promise.all([
        getMyAccountProfile<RefereeRoleProfile>(),
        getRefereeProfile(),
      ])
      applyAccount(nextAccount)
      applyProfessional(nextProfessional)
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Không tải được hồ sơ trọng tài.'))
    } finally {
      setLoading(false)
    }
  }, [applyAccount, applyProfessional])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void loadProfiles() }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadProfiles])

  const trimmedFullName = fullName.trim()
  const trimmedEmail = email.trim()
  const hasAccountChanges = useMemo(
    () => Boolean(account) && (trimmedFullName !== account?.fullName || trimmedEmail !== account?.email),
    [account, trimmedEmail, trimmedFullName],
  )
  const trimmedCertification = certificationLevel.trim()
  const hasCertificationChanges = Boolean(professional) && trimmedCertification !== professional?.certificationLevel

  const handleAccountSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAccountSuccess('')
    setAccountError('')
    if (!trimmedFullName) return setAccountError('Họ và tên không được để trống.')
    if (!trimmedEmail) return setAccountError('Email không được để trống.')
    if (!EMAIL_PATTERN.test(trimmedEmail)) return setAccountError('Email không đúng định dạng.')
    if (!hasAccountChanges) return setAccountError('Thông tin chưa có thay đổi.')

    setSavingAccount(true)
    try {
      let message = 'Cập nhật thông tin thành công.'
      await updateMyBasicInfo(
        { fullName: trimmedFullName, email: trimmedEmail },
        (nextMessage) => { message = nextMessage },
      )
      setAccountSuccess(message)
      try {
        applyAccount(await getMyAccountProfile<RefereeRoleProfile>())
        window.dispatchEvent(new CustomEvent('hrtms:profile-changed'))
      } catch (error) {
        setAccountError(getErrorMessage(error, 'Đã cập nhật nhưng chưa thể tải lại thông tin mới.'))
      }
    } catch (error) {
      setAccountError(getErrorMessage(error, 'Cập nhật thông tin thất bại.'))
    } finally {
      setSavingAccount(false)
    }
  }

  const handleProfessionalSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfessionalSuccess('')
    setProfessionalError('')
    if (!trimmedCertification) return setProfessionalError('Certification Level không được để trống.')
    if (trimmedCertification.length > CERTIFICATION_MAX_LENGTH) return setProfessionalError('Certification Level không được vượt quá 50 ký tự.')
    if (!hasCertificationChanges) return setProfessionalError('Certification Level chưa có thay đổi.')
    if (!certificationConfirmed) return setProfessionalError('Vui lòng xác nhận việc hồ sơ cần được duyệt lại.')

    setSavingProfessional(true)
    try {
      const result = await updateRefereeProfile({ certificationLevel: trimmedCertification })
      setProfessionalSuccess(result.message || 'Cập nhật hồ sơ chuyên môn thành công.')
      setProfessional((current) => current ? { ...current, status: result.status } : current)
      setCertificationConfirmed(false)
      try {
        applyProfessional(await getRefereeProfile())
        window.dispatchEvent(new CustomEvent('hrtms:profile-changed'))
      } catch (error) {
        setProfessionalError(getErrorMessage(error, 'Đã cập nhật nhưng chưa thể tải lại hồ sơ chuyên môn.'))
      }
    } catch (error) {
      setProfessionalError(getErrorMessage(error, 'Cập nhật hồ sơ chuyên môn thất bại.'))
    } finally {
      setSavingProfessional(false)
    }
  }

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordSuccess('')
    setPasswordError('')
    if (!currentPassword || !newPassword || !confirmPassword) return setPasswordError('Vui lòng nhập đầy đủ thông tin mật khẩu.')
    if (newPassword.length < 6) return setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự.')
    if (newPassword !== confirmPassword) return setPasswordError('Xác nhận mật khẩu mới không khớp.')
    if (newPassword === currentPassword) return setPasswordError('Mật khẩu mới phải khác mật khẩu hiện tại.')

    setChangingPassword(true)
    try {
      let message = 'Đổi mật khẩu thành công.'
      await changeMyPassword({ currentPassword, newPassword }, (nextMessage) => { message = nextMessage })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(message)
    } catch (error) {
      setPasswordError(getErrorMessage(error, 'Đổi mật khẩu thất bại.'))
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl space-y-5 animate-pulse" aria-label="Đang tải hồ sơ trọng tài"><div className="h-8 w-64 rounded bg-gray-200" /><div className="h-64 rounded-xl border border-gray-200 bg-white" /><div className="h-64 rounded-xl border border-gray-200 bg-white" /></div>
  }

  if (loadError || !account || !professional) {
    return <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-bold text-gray-900">Không tải được hồ sơ trọng tài</h1><p className="mt-3 text-sm text-red-600">{loadError || 'Dữ liệu hồ sơ không tồn tại.'}</p><button type="button" onClick={() => void loadProfiles()} className="mt-6 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Thử lại</button></div>
  }

  const inputClass = 'mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100'
  const readOnlyClass = 'mt-2 min-h-10 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-700'
  const certificate = account.profile?.certificate

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Tài khoản trọng tài</p><h1 className="mt-2 text-3xl font-bold text-gray-900">Hồ sơ và bảo mật</h1><p className="mt-1 text-sm text-gray-500">Quản lý thông tin tài khoản, hồ sơ chuyên môn và mật khẩu đăng nhập.</p></div>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="border-b border-gray-100 pb-4"><h2 className="text-lg font-bold text-gray-900">Thông tin tài khoản</h2><p className="mt-1 text-sm text-gray-500">Username, role và trạng thái tài khoản là thông tin chỉ đọc.</p></div>
        <form onSubmit={handleAccountSubmit} className="mt-5 space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-gray-700">Họ và tên<input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={savingAccount} className={inputClass} autoComplete="name" /></label><label className="text-sm font-semibold text-gray-700">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={savingAccount} className={inputClass} autoComplete="email" /></label></div>
          <div className="grid gap-4 sm:grid-cols-3"><div><p className="text-sm font-semibold text-gray-700">Username</p><p className={readOnlyClass}>{account.username}</p></div><div><p className="text-sm font-semibold text-gray-700">Role</p><p className={readOnlyClass}>{account.role}</p></div><div><p className="text-sm font-semibold text-gray-700">Trạng thái tài khoản</p><p className={readOnlyClass}>{account.status}</p></div></div>
          {accountSuccess && <p role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{accountSuccess}</p>}
          {accountError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{accountError}</p>}
          <div className="flex justify-end"><button type="submit" disabled={savingAccount || !hasAccountChanges} className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{savingAccount ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="border-b border-gray-100 pb-4"><h2 className="text-lg font-bold text-gray-900">Hồ sơ chuyên môn</h2><p className="mt-1 text-sm text-gray-500">Thông tin cấp độ chứng nhận của trọng tài.</p></div>
        <form onSubmit={handleProfessionalSubmit} className="mt-5 space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-3"><div><p className="text-sm font-semibold text-gray-700">Referee ID</p><p className={readOnlyClass}>{professional.refereeId}</p></div><div><p className="text-sm font-semibold text-gray-700">Trạng thái chuyên môn</p><p className={`mt-2 inline-flex min-h-10 items-center rounded-md border px-3 py-2 text-sm font-semibold ${statusClass(professional.status)}`}>{professional.status}</p></div><div><p className="text-sm font-semibold text-gray-700">Ngày tạo</p><p className={readOnlyClass}>{formatDate(professional.createdAt)}</p></div></div>
          <label className="block text-sm font-semibold text-gray-700">Certification Level<input value={certificationLevel} onChange={(e) => { setCertificationLevel(e.target.value); setCertificationConfirmed(false) }} disabled={savingProfessional} maxLength={CERTIFICATION_MAX_LENGTH + 1} className={inputClass} /><span className="mt-1 block text-right text-xs text-gray-400">{certificationLevel.length}/{CERTIFICATION_MAX_LENGTH} ký tự</span></label>
          {hasCertificationChanges && <div className="rounded-md border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-800">Nếu thay đổi Certification Level, hồ sơ đang Active sẽ chuyển về Pending và cần được duyệt lại.</p><label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-amber-900"><input type="checkbox" checked={certificationConfirmed} onChange={(e) => setCertificationConfirmed(e.target.checked)} disabled={savingProfessional} className="mt-0.5 h-4 w-4" /><span>Tôi hiểu và xác nhận cập nhật Certification Level.</span></label></div>}
          {professionalSuccess && <p role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{professionalSuccess}</p>}
          {professionalError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{professionalError}</p>}
          <div className="flex justify-end"><button type="submit" disabled={savingProfessional || !hasCertificationChanges || !certificationConfirmed} className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{savingProfessional ? 'Đang cập nhật...' : 'Cập nhật Certification Level'}</button></div>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="border-b border-gray-100 pb-4"><h2 className="text-lg font-bold text-gray-900">Chứng chỉ</h2><p className="mt-1 text-sm text-gray-500">Metadata của tệp chứng chỉ hiện có (chỉ đọc).</p></div>
        {certificate ? <div className="mt-5 grid gap-4 sm:grid-cols-2"><div><p className="text-sm font-semibold text-gray-700">Tên tệp</p><p className={readOnlyClass}>{certificate.fileName}</p></div><div><p className="text-sm font-semibold text-gray-700">Content type</p><p className={readOnlyClass}>{certificate.contentType || 'Không xác định'}</p></div><div><p className="text-sm font-semibold text-gray-700">Kích thước</p><p className={readOnlyClass}>{formatFileSize(certificate.fileSizeBytes)}</p></div><div><p className="text-sm font-semibold text-gray-700">Ngày tải lên</p><p className={readOnlyClass}>{formatDate(certificate.uploadedAt)}</p></div></div> : <p className="mt-5 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">Chưa có metadata chứng chỉ.</p>}
        <p className="mt-4 rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">Chức năng cập nhật file chứng chỉ đang chờ Backend hỗ trợ.</p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="border-b border-gray-100 pb-4"><h2 className="text-lg font-bold text-gray-900">Bảo mật</h2><p className="mt-1 text-sm text-gray-500">Đổi mật khẩu đăng nhập mà không làm gián đoạn phiên hiện tại.</p></div>
        <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-5" noValidate><div className="grid gap-4 lg:grid-cols-3"><label className="text-sm font-semibold text-gray-700">Mật khẩu hiện tại<input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={changingPassword} className={inputClass} autoComplete="current-password" /></label><label className="text-sm font-semibold text-gray-700">Mật khẩu mới<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={changingPassword} className={inputClass} autoComplete="new-password" /></label><label className="text-sm font-semibold text-gray-700">Xác nhận mật khẩu mới<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={changingPassword} className={inputClass} autoComplete="new-password" /></label></div>
          {passwordSuccess && <p role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{passwordSuccess}</p>}
          {passwordError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{passwordError}</p>}
          <div className="flex justify-end"><button type="submit" disabled={changingPassword} className="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50">{changingPassword ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}</button></div>
        </form>
      </section>
    </div>
  )
}
