import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  changeMyPassword,
  getMyAccountProfile,
  updateMyBasicInfo,
} from '../../services/accountService'
import type { SpectatorRoleProfile, UserProfile } from '../../types/account.types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type SpectatorAccountProfile = UserProfile<SpectatorRoleProfile>

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

export default function SpectatorProfile() {
  const [profile, setProfile] = useState<SpectatorAccountProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const applyProfile = useCallback((nextProfile: SpectatorAccountProfile) => {
    setProfile(nextProfile)
    setFullName(nextProfile.fullName)
    setEmail(nextProfile.email)
  }, [])

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    try {
      applyProfile(await getMyAccountProfile<SpectatorRoleProfile>())
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Không tải được thông tin tài khoản.'))
    } finally {
      setLoading(false)
    }
  }, [applyProfile])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void loadProfile() }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadProfile])

  const trimmedFullName = fullName.trim()
  const trimmedEmail = email.trim()
  const hasProfileChanges = useMemo(
    () => Boolean(profile) && (
      trimmedFullName !== profile?.fullName || trimmedEmail !== profile?.email
    ),
    [profile, trimmedEmail, trimmedFullName],
  )

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProfileSuccess('')
    setProfileError('')

    if (!trimmedFullName) {
      setProfileError('Họ và tên không được để trống.')
      return
    }
    if (!trimmedEmail) {
      setProfileError('Email không được để trống.')
      return
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setProfileError('Email không đúng định dạng.')
      return
    }
    if (!hasProfileChanges) {
      setProfileError('Thông tin chưa có thay đổi.')
      return
    }

    setSavingProfile(true)
    try {
      let successMessage = 'Cập nhật thông tin thành công.'
      await updateMyBasicInfo(
        { fullName: trimmedFullName, email: trimmedEmail },
        (message) => { successMessage = message },
      )

      try {
        applyProfile(await getMyAccountProfile<SpectatorRoleProfile>())
        window.dispatchEvent(new Event('hrtms:profile-changed'))
        setProfileSuccess(successMessage)
      } catch (error) {
        setProfileSuccess(successMessage)
        setProfileError(getErrorMessage(error, 'Đã cập nhật nhưng chưa thể tải lại thông tin mới.'))
      }
    } catch (error) {
      setProfileError(getErrorMessage(error, 'Cập nhật thông tin thất bại.'))
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordSuccess('')
    setPasswordError('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Vui lòng nhập đầy đủ thông tin mật khẩu.')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('Mật khẩu mới phải có ít nhất 6 ký tự.')
      return
    }
    if (newPassword === currentPassword) {
      setPasswordError('Mật khẩu mới phải khác mật khẩu hiện tại.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Xác nhận mật khẩu mới không khớp.')
      return
    }

    setChangingPassword(true)
    try {
      let successMessage = 'Đổi mật khẩu thành công.'
      await changeMyPassword(
        { currentPassword, newPassword },
        (message) => { successMessage = message },
      )
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(successMessage)
    } catch (error) {
      setPasswordError(getErrorMessage(error, 'Đổi mật khẩu thất bại. Vui lòng kiểm tra mật khẩu hiện tại.'))
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 animate-pulse" aria-label="Đang tải hồ sơ tài khoản">
        <div className="h-16 w-72 rounded-xl bg-gray-200" />
        <div className="h-72 rounded-2xl border border-gray-200 bg-white" />
        <div className="h-40 rounded-2xl border border-gray-200 bg-white" />
        <div className="h-64 rounded-2xl border border-gray-200 bg-white" />
      </div>
    )
  }

  if (loadError || !profile) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-extrabold text-gray-900">Không tải được hồ sơ tài khoản</h1>
        <p role="alert" className="mt-3 text-sm text-red-600">
          {loadError || 'Dữ liệu hồ sơ không tồn tại.'}
        </p>
        <button
          type="button"
          onClick={() => void loadProfile()}
          className="mt-6 rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white hover:bg-amber-700"
        >
          Thử lại
        </button>
      </div>
    )
  }

  const inputClassName = 'mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-gray-50'
  const readOnlyClassName = 'mt-2 min-h-11 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700'

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <header className="border-b border-gray-200 pb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Tài khoản Spectator</p>
        <h1 className="mt-2 text-3xl font-extrabold text-gray-900">Hồ sơ và bảo mật</h1>
        <p className="mt-1 text-sm text-gray-500">Quản lý thông tin tài khoản, ví điểm và mật khẩu đăng nhập.</p>
      </header>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="border-b border-gray-100 pb-5">
          <h2 className="text-lg font-extrabold text-gray-900">Thông tin tài khoản</h2>
          <p className="mt-1 text-sm text-gray-500">Username, role và trạng thái là thông tin chỉ đọc.</p>
        </div>

        <form onSubmit={handleProfileSubmit} className="mt-6 space-y-6" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-bold text-gray-700">
              Họ và tên
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={savingProfile}
                className={inputClassName}
                autoComplete="name"
              />
            </label>
            <label className="text-sm font-bold text-gray-700">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={savingProfile}
                className={inputClassName}
                autoComplete="email"
              />
            </label>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div><p className="text-sm font-bold text-gray-700">Username</p><p className={readOnlyClassName}>{profile.username}</p></div>
            <div><p className="text-sm font-bold text-gray-700">Role</p><p className={readOnlyClassName}>{profile.role}</p></div>
            <div><p className="text-sm font-bold text-gray-700">Trạng thái</p><p className={readOnlyClassName}>{profile.status}</p></div>
          </div>

          {profileSuccess && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{profileSuccess}</p>}
          {profileError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{profileError}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile || !hasProfileChanges}
              className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-white shadow-lg sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Ví Spectator</p>
            <p className="mt-3 text-4xl font-black text-amber-300">
              {(profile.profile?.balance ?? 0).toLocaleString('vi-VN')} <span className="text-lg">điểm</span>
            </p>
            <p className="mt-2 text-xs text-slate-400">Số dư hiện tại của tài khoản.</p>
          </div>
          <Link
            to="/spectator/wallet"
            className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
          >
            Đi tới ví điểm
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="border-b border-gray-100 pb-5">
          <h2 className="text-lg font-extrabold text-gray-900">Đổi mật khẩu</h2>
          <p className="mt-1 text-sm text-gray-500">Mật khẩu mới cần tối thiểu 6 ký tự và khác mật khẩu hiện tại.</p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-5" noValidate>
          <div className="grid gap-5 lg:grid-cols-3">
            <label className="text-sm font-bold text-gray-700">
              Mật khẩu hiện tại
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={changingPassword} className={inputClassName} autoComplete="current-password" />
            </label>
            <label className="text-sm font-bold text-gray-700">
              Mật khẩu mới
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={changingPassword} className={inputClassName} autoComplete="new-password" />
            </label>
            <label className="text-sm font-bold text-gray-700">
              Xác nhận mật khẩu mới
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={changingPassword} className={inputClassName} autoComplete="new-password" />
            </label>
          </div>

          {passwordSuccess && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{passwordSuccess}</p>}
          {passwordError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{passwordError}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={changingPassword}
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-bold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {changingPassword ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
