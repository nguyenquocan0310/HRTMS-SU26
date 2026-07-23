import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import {
  FiAward,
  FiBell,
  FiCalendar,
  FiChevronRight,
  FiClipboard,
  FiDollarSign,
  FiFlag,
  FiGrid,
  FiLink2,
  FiLogOut,
  FiMenu,
  FiPlusCircle,
  FiUser,
  FiX,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'
import { getMyAccountProfile } from '../../services/accountService'
import { logout } from '../../services/authService'
import useAuthStore from '../../store/authStore'
import type { OwnerRoleProfile, UserProfile } from '../../types/account.types'
import NotificationBell from '../../components/notifications/NotificationBell'
import './owner-theme.css'

type OwnerProfile = UserProfile<OwnerRoleProfile>

interface NavItem {
  to: string
  label: string
  icon: IconType
  end?: boolean
}

const overviewItem: NavItem = { to: '/owner', label: 'Tổng quan', icon: FiGrid, end: true }

const navGroups: Array<{ title: string; icon: IconType; items: NavItem[] }> = [
  {
    title: 'Chuẩn bị dự giải',
    icon: FiFlag,
    items: [
      { to: '/owner/horses', label: 'Ngựa của tôi', icon: FiAward },
      { to: '/owner/horses/register', label: 'Tạo hồ sơ ngựa', icon: FiPlusCircle },
      { to: '/owner/tournaments', label: 'Tham gia giải đấu', icon: FiClipboard },
    ],
  },
  {
    title: 'Ghép cặp & thi đấu',
    icon: FiLink2,
    items: [
      { to: '/owner/jockey-invite', label: 'Ghép cặp với Jockey', icon: FiLink2 },
      { to: '/owner/race-entries', label: 'Lịch & xác nhận thi đấu', icon: FiCalendar },
    ],
  },
  {
    title: 'Sau cuộc đua',
    icon: FiAward,
    items: [
      { to: '/owner/earnings', label: 'Kết quả & tiền thưởng', icon: FiDollarSign },
    ],
  },
  {
    title: 'Khác',
    icon: FiGrid,
    items: [
      { to: '/owner/notifications', label: 'Thông báo', icon: FiBell },
      { to: '/owner/profile', label: 'Hồ sơ tài khoản', icon: FiUser },
    ],
  },
]

const navItems = [overviewItem, ...navGroups.flatMap((group) => group.items)]

function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.to === '/owner') return pathname === '/owner'
  if (item.to === '/owner/horses') return pathname === item.to || /^\/owner\/horses\/\d+/.test(pathname)
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

function SidebarLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: () => void }) {
  const Icon = item.icon
  const active = isNavItemActive(pathname, item)
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={`group flex min-h-11 items-center gap-3 rounded-xl border-l-2 px-3 py-2.5 text-sm transition-colors ${
        active
          ? 'border-[#cfa73d] bg-white/10 font-bold text-white'
          : 'border-transparent font-medium text-emerald-50/80 hover:bg-white/[.06] hover:text-white'
      }`}
    >
      <Icon className={active ? 'text-[#e1bc58]' : 'text-emerald-100/60 group-hover:text-[#e1bc58]'} size={17} aria-hidden="true" />
      <span className="min-w-0 flex-1">{item.label}</span>
      {active && <FiChevronRight className="text-[#e1bc58]" size={15} aria-hidden="true" />}
    </NavLink>
  )
}

export default function OwnerLayout() {
  const [profile, setProfile] = useState<OwnerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await getMyAccountProfile())
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => { void loadProfile() }, 0)
    const handleProfileChanged = () => void loadProfile()
    window.addEventListener('hrtms:profile-changed', handleProfileChanged)
    return () => {
      window.clearTimeout(initialLoadId)
      window.removeEventListener('hrtms:profile-changed', handleProfileChanged)
    }
  }, [loadProfile])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const currentNav = navItems.find((item) => isNavItemActive(location.pathname, item))
  const pageTitle = currentNav?.label ?? 'Tổng quan'
  const initials = profile?.fullName
    ? profile.fullName.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase()
    : 'O'

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      clearAuth()
      localStorage.removeItem('token')
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('authReason')
      navigate('/login', { replace: true })
    }
  }

  const sidebar = (
    <aside className="owner-sidebar flex h-full w-[286px] flex-col border-r border-white/10">
      <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-5">
        <div className="owner-sidebar-brand flex h-11 w-11 items-center justify-center rounded-xl text-xl" aria-hidden="true">♞</div>
        <div className="min-w-0">
          <p className="truncate text-lg font-black tracking-tight text-white">HRTMS-SU26</p>
          <p className="text-[11px] font-medium text-emerald-100/65">Tournament Management</p>
        </div>
      </div>

      <nav className="owner-sidebar-nav flex-1 overflow-y-auto px-3 py-5" aria-label="Điều hướng Chủ ngựa">
        <p className="mb-3 inline-flex rounded-full border border-[#cfa73d]/40 bg-[#cfa73d]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.12em] text-[#e1bc58]">Chủ ngựa</p>
        <SidebarLink item={overviewItem} pathname={location.pathname} onNavigate={() => setMenuOpen(false)} />

        {navGroups.map((group) => {
          const GroupIcon = group.icon
          return (
            <div key={group.title} className="mt-6">
              <p className="mb-2 flex items-center gap-2 px-2 text-[10px] font-black uppercase tracking-[.14em] text-emerald-100/55">
                <GroupIcon size={12} aria-hidden="true" /> {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => <SidebarLink key={item.to} item={item} pathname={location.pathname} onNavigate={() => setMenuOpen(false)} />)}
              </div>
            </div>
          )
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button type="button" onClick={() => { navigate('/owner/profile'); setMenuOpen(false) }} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/[.06]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#cfa73d] text-sm font-black text-[#082b20]">{initials}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white">{loading ? 'Đang tải...' : profile?.fullName || 'Chủ ngựa'}</span>
            <span className="block truncate text-xs text-emerald-100/55">{profile?.email || 'Hồ sơ tài khoản'}</span>
          </span>
        </button>
        <button type="button" onClick={() => void handleLogout()} disabled={isLoggingOut} className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-emerald-100/65 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-50">
          <FiLogOut aria-hidden="true" /> {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
        </button>
      </div>
    </aside>
  )

  return (
    <div className="owner-shell flex text-slate-950">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setMenuOpen(false)} aria-label="Đóng lớp phủ menu" />
          <div className="relative h-full w-[286px] max-w-[86vw] shadow-2xl">
            {sidebar}
            <button type="button" onClick={() => setMenuOpen(false)} className="absolute right-3 top-3 rounded-lg p-2 text-emerald-50 hover:bg-white/10" aria-label="Đóng menu"><FiX size={20} /></button>
          </div>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-[286px]">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between gap-3 border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMenuOpen(true)} className="rounded-lg border border-slate-200 p-2 text-slate-700 lg:hidden" aria-label="Mở menu"><FiMenu size={20} /></button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="hidden text-slate-500 sm:inline">Chủ ngựa</span>
                <span className="hidden text-slate-300 sm:inline">/</span>
                <strong className="truncate text-slate-900">{pageTitle}</strong>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={() => navigate('/owner/horses/register')} className="hidden min-h-10 items-center gap-2 rounded-xl bg-[#cfa73d] px-4 text-sm font-bold text-[#082b20] hover:bg-[#bd9229] sm:inline-flex">
              <FiPlusCircle aria-hidden="true" /> Tạo hồ sơ ngựa
            </button>
            <NotificationBell notificationsPath="/owner/notifications" />
            <button type="button" onClick={() => navigate('/owner/profile')} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#cfa73d] text-xs font-black text-[#082b20]" aria-label="Mở hồ sơ tài khoản">{initials}</button>
          </div>
        </header>

        <main className="owner-main flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="owner-content"><Outlet /></div>
        </main>
      </div>
    </div>
  )
}
