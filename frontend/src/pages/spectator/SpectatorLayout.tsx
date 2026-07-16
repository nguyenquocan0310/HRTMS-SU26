import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import NotificationBell from '../../components/notifications/NotificationBell'
import { getMyAccountProfile } from '../../services/accountService'
import { logout } from '../../services/authService'
import useAuthStore from '../../store/authStore'
import type { SpectatorRoleProfile, UserProfile } from '../../types/account.types'
import './spectator-theme.css'

type SpectatorProfile = UserProfile<SpectatorRoleProfile>

interface NavItem { to: string; label: string; end?: boolean }

const overview: NavItem = { to: '/spectator', label: 'Tổng quan', end: true }
const navGroups: Array<{ title: string; items: NavItem[] }> = [
  { title: 'Theo dõi cuộc đua', items: [
    { to: '/spectator/live-race', label: 'Cuộc đua trực tiếp' },
    { to: '/spectator/leaderboard', label: 'Bảng xếp hạng' },
  ] },
  { title: 'Dự đoán', items: [
    { to: '/spectator/prediction', label: 'Sảnh dự đoán' },
    { to: '/spectator/my-predictions', label: 'Lịch sử dự đoán' },
  ] },
  { title: 'Tài khoản', items: [
    { to: '/spectator/wallet', label: 'Ví điểm cá nhân' },
    { to: '/spectator/notifications', label: 'Thông báo' },
    { to: '/spectator/profile', label: 'Hồ sơ tài khoản' },
  ] },
]
const navItems = [overview, ...navGroups.flatMap((group) => group.items)]

function isActive(pathname: string, item: NavItem) {
  return item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)
}

function SidebarLink({ item, pathname, close }: { item: NavItem; pathname: string; close: () => void }) {
  const active = isActive(pathname, item)
  return <NavLink to={item.to} end={item.end} onClick={close} className={`flex min-h-11 items-center rounded-xl border-l-2 px-3 py-2.5 text-sm transition-colors ${active ? 'border-[#cfa73d] bg-white/10 font-bold text-white' : 'border-transparent font-medium text-emerald-50/80 hover:bg-white/[.06] hover:text-white'}`}>{item.label}</NavLink>
}

export default function SpectatorLayout() {
  const [profile, setProfile] = useState<SpectatorProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const loadProfile = useCallback(async () => {
    try { setProfile(await getMyAccountProfile<SpectatorRoleProfile>()) }
    catch { setProfile(null) }
    finally { setProfileLoading(false) }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => void loadProfile(), 0)
    const changed = () => void loadProfile()
    window.addEventListener('hrtms:profile-changed', changed)
    return () => { window.clearTimeout(id); window.removeEventListener('hrtms:profile-changed', changed) }
  }, [loadProfile])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const current = navItems.find((item) => isActive(location.pathname, item))
  const initials = profile?.fullName ? profile.fullName.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase() : 'K'

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try { await logout() } finally {
      clearAuth()
      localStorage.removeItem('token')
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('authReason')
      navigate('/login', { replace: true })
    }
  }

  const sidebar = <aside className="spectator-sidebar flex h-full w-[286px] flex-col border-r border-white/10">
    <div className="flex h-[76px] items-center border-b border-white/10 px-5">
      <div><p className="text-lg font-black tracking-tight text-white">HRTMS-SU26</p><p className="text-[11px] font-medium text-emerald-100/65">Tournament Management</p></div>
    </div>
    <nav className="spectator-sidebar-nav flex-1 overflow-y-auto px-3 py-5" aria-label="Điều hướng Khán giả">
      <p className="mb-3 inline-flex rounded-full border border-[#cfa73d]/40 bg-[#cfa73d]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.12em] text-[#e1bc58]">Khán giả</p>
      <SidebarLink item={overview} pathname={location.pathname} close={() => setMenuOpen(false)} />
      {navGroups.map((group) => <div key={group.title} className="mt-6"><p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[.14em] text-emerald-100/55">{group.title}</p><div className="space-y-1">{group.items.map((item) => <SidebarLink key={item.to} item={item} pathname={location.pathname} close={() => setMenuOpen(false)} />)}</div></div>)}
    </nav>
    <div className="border-t border-white/10 p-3">
      <button type="button" onClick={() => { navigate('/spectator/profile'); setMenuOpen(false) }} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[.06]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#cfa73d] text-sm font-black text-[#082b20]">{initials}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-white">{profileLoading ? 'Đang tải...' : profile?.fullName || 'Khán giả'}</span><span className="block truncate text-xs text-emerald-100/55">{profile?.email || 'Hồ sơ tài khoản'}</span></span>
      </button>
      <button type="button" onClick={() => void handleLogout()} disabled={loggingOut} className="mt-1 w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-emerald-100/65 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50">{loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</button>
    </div>
  </aside>

  return <div className="spectator-shell flex text-slate-950">
    <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>
    {menuOpen && <div className="fixed inset-0 z-50 lg:hidden"><button type="button" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setMenuOpen(false)} aria-label="Đóng lớp phủ menu" /><div className="relative h-full w-[286px] max-w-[86vw] shadow-2xl">{sidebar}<button type="button" onClick={() => setMenuOpen(false)} className="absolute right-3 top-3 rounded-lg border border-white/20 px-2 py-1 text-xs font-bold text-white" aria-label="Đóng menu">Đóng</button></div></div>}
    <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-[286px]">
      <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-3 border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur lg:px-8">
        <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setMenuOpen(true)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 lg:hidden" aria-label="Mở menu">Menu</button><div className="flex min-w-0 items-center gap-2 text-sm"><span className="hidden text-slate-500 sm:inline">Khán giả</span><span className="hidden text-slate-300 sm:inline">/</span><strong className="truncate text-slate-900">{current?.label ?? 'Tổng quan'}</strong></div></div>
        <div className="flex items-center gap-2 sm:gap-3"><NotificationBell notificationsPath="/spectator/notifications" textOnly /><button type="button" onClick={() => navigate('/spectator/profile')} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#cfa73d] text-xs font-black text-[#082b20]" aria-label="Mở hồ sơ tài khoản">{initials}</button></div>
      </header>
      <main className="spectator-main flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><div className="spectator-content"><Outlet /></div></main>
    </div>
  </div>
}
