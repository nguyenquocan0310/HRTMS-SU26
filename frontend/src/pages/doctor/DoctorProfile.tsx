import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  changeMyPassword,
  getMyAccountProfile,
  updateMyBasicInfo,
} from '../../services/accountService'
import {
  getDoctorProfile,
  updateDoctorProfile,
  type DoctorProfessionalProfile,
} from '../../services/doctorService'
import type { DoctorRoleProfile, UserProfile } from '../../types/account.types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LICENSE_MAX_LENGTH = 50

type DoctorAccountProfile = UserProfile<DoctorRoleProfile>

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

export default function DoctorProfile() {
  const [account, setAccount] = useState<DoctorAccountProfile | null>(null)
  const [professional, setProfessional] = useState<DoctorProfessionalProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)
  const [accountSuccess, setAccountSuccess] = useState('')
  const [accountError, setAccountError] = useState('')

  const [medicalLicenseNumber, setMedicalLicenseNumber] = useState('')
  const [licenseConfirmed, setLicenseConfirmed] = useState(false)
  const [savingProfessional, setSavingProfessional] = useState(false)
  const [professionalSuccess, setProfessionalSuccess] = useState('')
  const [professionalError, setProfessionalError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const applyAccount = useCallback((nextAccount: DoctorAccountProfile) => {
    setAccount(nextAccount)
    setFullName(nextAccount.fullName)
    setEmail(nextAccount.email)
  }, [])

  const applyProfessional = useCallback((nextProfile: DoctorProfessionalProfile) => {
    setProfessional(nextProfile)
    setMedicalLicenseNumber(nextProfile.medicalLicenseNumber)
    setLicenseConfirmed(false)
  }, [])

  const loadProfiles = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [nextAccount, nextProfessional] = await Promise.all([
        getMyAccountProfile<DoctorRoleProfile>(),
        getDoctorProfile(),
      ])
      applyAccount(nextAccount)
      applyProfessional(nextProfessional)
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Không tải được hồ sơ Doctor.'))
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
  const trimmedLicense = medicalLicenseNumber.trim()
  const hasLicenseChanges = Boolean(professional) && trimmedLicense !== professional?.medicalLicenseNumber

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
        applyAccount(await getMyAccountProfile<DoctorRoleProfile>())
      } catch (error) {
        setAccountError(getErrorMessage(error, 'Đã cập nhật nhưng chưa thể tải lại thông tin mới.'))
      }
      window.dispatchEvent(new CustomEvent('hrtms:profile-changed'))
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
    if (!trimmedLicense) return setProfessionalError('Medical License Number không được để trống.')
    if (trimmedLicense.length > LICENSE_MAX_LENGTH) return setProfessionalError('Medical License Number không được vượt quá 50 ký tự.')
    if (!hasLicenseChanges) return setProfessionalError('Medical License Number chưa có thay đổi.')
    if (!licenseConfirmed) return setProfessionalError('Vui lòng xác nhận việc hồ sơ cần được duyệt lại.')

    setSavingProfessional(true)
    try {
      const result = await updateDoctorProfile({ medicalLicenseNumber: trimmedLicense })
      setProfessionalSuccess(result.message || 'Cập nhật hồ sơ chuyên môn thành công.')
      setProfessional((current) => current ? {
        ...current,
        medicalLicenseNumber: trimmedLicense,
        status: result.status,
      } : current)
      setLicenseConfirmed(false)
      try {
        applyProfessional(await getDoctorProfile())
      } catch (error) {
        setProfessionalError(getErrorMessage(error, 'Đã cập nhật nhưng chưa thể tải lại hồ sơ chuyên môn.'))
      }
      window.dispatchEvent(new CustomEvent('hrtms:profile-changed'))
    } catch (error) {
      const message = getErrorMessage(error, 'Cập nhật hồ sơ chuyên môn thất bại.')
      setProfessionalError(
        message === 'LICENSE_ALREADY_EXISTS' || /already in use by another doctor/i.test(message)
          ? `Medical License Number đã được sử dụng bởi Doctor khác.${message !== 'LICENSE_ALREADY_EXISTS' ? ` (${message})` : ''}`
          : message,
      )
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
    return <div className="mx-auto max-w-5xl space-y-5 animate-pulse" aria-label="Đang tải hồ sơ Doctor"><div className="h-8 w-64 rounded bg-gray-200" /><div className="h-64 rounded-xl border border-gray-200 bg-white" /><div className="h-64 rounded-xl border border-gray-200 bg-white" /></div>
  }

  if (loadError || !account || !professional) {
    return <div className="mx-auto max-w-xl rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-bold text-gray-900">Không tải được hồ sơ Doctor</h1><p className="mt-3 text-sm text-red-600">{loadError || 'Dữ liệu hồ sơ không tồn tại.'}</p><button type="button" onClick={() => void loadProfiles()} className="mt-6 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Thử lại</button></div>
  }

  const inputClass = 'mt-2 w-full rounded-md border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-50'
  const readOnlyClass = 'mt-2 min-h-10 rounded-md border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm font-medium text-gray-700'
  const certificate = account.profile?.certificate

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Tài khoản Doctor</p><h1 className="mt-1 text-2xl font-bold text-gray-900">Hồ sơ và bảo mật</h1><p className="mt-1 text-sm text-gray-500">Quản lý thông tin tài khoản và hồ sơ hành nghề của bạn.</p></div>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="border-b border-gray-100 pb-4"><h2 className="text-lg font-bold text-gray-900">Thông tin tài khoản</h2><p className="mt-1 text-sm text-gray-500">Chỉ họ tên và email có thể được cập nhật.</p></div>
        <form onSubmit={handleAccountSubmit} className="mt-5 space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-gray-700">Họ và tên<input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={savingAccount} className={inputClass} autoComplete="name" /></label><label className="text-sm font-semibold text-gray-700">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={savingAccount} className={inputClass} autoComplete="email" /></label></div>
          <div className="grid gap-4 sm:grid-cols-3"><div><p className="text-sm font-semibold text-gray-700">Username</p><p className={readOnlyClass}>{account.username}</p></div><div><p className="text-sm font-semibold text-gray-700">Role</p><p className={readOnlyClass}>{account.role}</p></div><div><p className="text-sm font-semibold text-gray-700">Trạng thái tài khoản</p><p className={readOnlyClass}>{account.status}</p></div></div>
          {accountSuccess && <p role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{accountSuccess}</p>}
          {accountError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{accountError}</p>}
          <div className="flex justify-end"><button type="submit" disabled={savingAccount || !hasAccountChanges} className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{savingAccount ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="border-b border-gray-100 pb-4"><h2 className="text-lg font-bold text-gray-900">Hồ sơ chuyên môn</h2><p className="mt-1 text-sm text-gray-500">Thông tin giấy phép hành nghề bác sĩ thú y.</p></div>
        <form onSubmit={handleProfessionalSubmit} className="mt-5 space-y-5" noValidate>
          <div className="grid gap-4 sm:grid-cols-3"><div><p className="text-sm font-semibold text-gray-700">Doctor ID</p><p className={readOnlyClass}>{professional.doctorId}</p></div><div><p className="text-sm font-semibold text-gray-700">Trạng thái hồ sơ</p><p className={readOnlyClass}>{professional.status}</p></div><div><p className="text-sm font-semibold text-gray-700">Ngày tạo</p><p className={readOnlyClass}>{formatDate(professional.createdAt)}</p></div></div>
          <label className="block text-sm font-semibold text-gray-700">Medical License Number<input value={medicalLicenseNumber} onChange={(e) => { setMedicalLicenseNumber(e.target.value); setLicenseConfirmed(false) }} disabled={savingProfessional} maxLength={LICENSE_MAX_LENGTH + 1} className={inputClass} /><span className="mt-1 block text-right text-xs text-gray-400">{medicalLicenseNumber.length}/{LICENSE_MAX_LENGTH} ký tự</span></label>
          {hasLicenseChanges && <div className="rounded-md border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-800">Nếu thay đổi Medical License Number, hồ sơ đang Active sẽ chuyển về Pending và cần được duyệt lại.</p><label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-amber-900"><input type="checkbox" checked={licenseConfirmed} onChange={(e) => setLicenseConfirmed(e.target.checked)} disabled={savingProfessional} className="mt-0.5 h-4 w-4" /><span>Tôi hiểu và xác nhận cập nhật Medical License Number.</span></label></div>}
          {professionalSuccess && <p role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{professionalSuccess}</p>}
          {professionalError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{professionalError}</p>}
          <div className="flex justify-end"><button type="submit" disabled={savingProfessional || !hasLicenseChanges || !licenseConfirmed} className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{savingProfessional ? 'Đang cập nhật...' : 'Cập nhật giấy phép'}</button></div>
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
