import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  changeMyPassword,
  getMyAccountProfile,
  updateMyBasicInfo,
} from '../../services/accountService'
import type { OwnerRoleProfile, UserProfile } from '../../types/account.types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

type OwnerAccountProfile = UserProfile<OwnerRoleProfile>

export default function OwnerProfile() {
  const [profile, setProfile] = useState<OwnerAccountProfile | null>(null)
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

  const applyProfile = useCallback((nextProfile: OwnerAccountProfile) => {
    setProfile(nextProfile)
    setFullName(nextProfile.fullName)
    setEmail(nextProfile.email)
  }, [])

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    try {
      applyProfile(await getMyAccountProfile())
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Không tải được thông tin tài khoản.'))
    } finally {
      setLoading(false)
    }
  }, [applyProfile])

  useEffect(() => {
    void loadProfile()
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
      setProfileSuccess(successMessage)
      window.dispatchEvent(new CustomEvent('hrtms:profile-changed'))

      try {
        applyProfile(await getMyAccountProfile())
      } catch (error) {
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
    if (newPassword !== confirmPassword) {
      setPasswordError('Xác nhận mật khẩu mới không khớp.')
      return
    }
    if (newPassword === currentPassword) {
      setPasswordError('Mật khẩu mới phải khác mật khẩu hiện tại.')
      return
    }

    setChangingPassword(true)
    try {
      let successMessage = 'Đổi mật khẩu thành công.'
      await changeMyPassword(
        { currentPassword, newPassword },
        (message) => { successMessage = message },
      )
      setPasswordSuccess(successMessage)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordError(getErrorMessage(error, 'Đổi mật khẩu thất bại.'))
    } finally {
      setChangingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse" aria-label="Đang tải hồ sơ tài khoản">
        <div className="h-8 w-52 rounded-lg bg-slate-200" />
        <div className="h-64 rounded-2xl bg-white border border-slate-200" />
        <div className="h-64 rounded-2xl bg-white border border-slate-200" />
      </div>
    )
  }

  if (loadError || !profile) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-black text-slate-950">Không tải được hồ sơ tài khoản</h1>
        <p className="mt-3 text-sm text-red-600">{loadError || 'Dữ liệu hồ sơ không tồn tại.'}</p>
        <button
          type="button"
          onClick={() => void loadProfile()}
          className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
        >
          Thử lại
        </button>
      </div>
    )
  }

  const inputClassName = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50'
  const readOnlyClassName = 'mt-2 min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700'

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Tài khoản Owner</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Hồ sơ và bảo mật</h1>
        <p className="mt-2 text-sm text-slate-500">Quản lý thông tin cơ bản và mật khẩu đăng nhập của bạn.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="border-b border-slate-100 pb-5">
          <h2 className="text-lg font-black text-slate-950">Thông tin tài khoản</h2>
          <p className="mt-1 text-sm text-slate-500">Chỉ họ tên và email có thể được cập nhật.</p>
        </div>

        <form onSubmit={handleProfileSubmit} className="mt-6 space-y-6" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-700">
              Họ và tên
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={savingProfile}
                className={inputClassName}
                autoComplete="name"
              />
            </label>
            <label className="text-sm font-bold text-slate-700">
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

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div><p className="text-sm font-bold text-slate-700">Username</p><p className={readOnlyClassName}>{profile.username}</p></div>
            <div><p className="text-sm font-bold text-slate-700">Role</p><p className={readOnlyClassName}>{profile.role}</p></div>
            <div><p className="text-sm font-bold text-slate-700">Trạng thái</p><p className={readOnlyClassName}>{profile.status}</p></div>
            <div><p className="text-sm font-bold text-slate-700">Số điện thoại</p><p className={readOnlyClassName}>{profile.profile?.phoneNumber || 'Chưa cập nhật'}</p></div>
            <div className="sm:col-span-2">
              <p className="text-sm font-bold text-slate-700">Trạng thái định danh</p>
              <p className={readOnlyClassName}>
                {profile.profile?.hasIdentity
                  ? 'Đã xác minh thông tin định danh'
                  : 'Chưa có thông tin định danh'}
              </p>
            </div>
          </div>

          {profileSuccess && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{profileSuccess}</p>}
          {profileError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{profileError}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile || !hasProfileChanges}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="border-b border-slate-100 pb-5">
          <h2 className="text-lg font-black text-slate-950">Bảo mật — Đổi mật khẩu</h2>
          <p className="mt-1 text-sm text-slate-500">Mật khẩu mới cần tối thiểu 6 ký tự và khác mật khẩu hiện tại.</p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-5" noValidate>
          <div className="grid gap-5 lg:grid-cols-3">
            <label className="text-sm font-bold text-slate-700">
              Mật khẩu hiện tại
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={changingPassword} className={inputClassName} autoComplete="current-password" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Mật khẩu mới
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={changingPassword} className={inputClassName} autoComplete="new-password" />
            </label>
            <label className="text-sm font-bold text-slate-700">
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
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {changingPassword ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
