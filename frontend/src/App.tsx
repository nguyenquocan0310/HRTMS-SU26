import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import type { Role } from './types'
import LandingPage from './pages/landing/LandingPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import AdminLayout from './layouts/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import ApprovalCenter from './pages/admin/ApprovalCenter'
import UserManagement from './pages/admin/UserManagement'
import TournamentBuilder from './components/admin/TournamentBuilder'
import TournamentHub from './pages/admin/TournamentHub'
import Leaderboard from './pages/admin/Leaderboard'
import LiveRaceView from './pages/admin/LiveRaceView'
import AdminNotificationCenter from './pages/admin/NotificationCenter'
import MyAccount from './pages/admin/MyAccount'
import AssignOfficials from './pages/admin/AssignOfficials'



// ── Import các trang Owner ──
import MyHorses from './pages/owner/MyHorses'
import OwnerDashboard from './pages/owner/OwnerDashboard'
import OwnerEarningsPage from './pages/owner/OwnerEarnings'
import OwnerLayout from './pages/owner/OwnerLayout'
import RegisterHorse from './pages/owner/RegisterHorse'
import HorseDetail from './pages/owner/HorseDetail'
import ScheduleConfirm from './pages/owner/ScheduleConfirm'
import RaceEntries from './pages/owner/RaceEntries'
import JockeyInvite from './pages/owner/JockeyInvite'
import TournamentList from './pages/owner/TournamentList'

// ── Import các trang Jockey ──
import JockeyLayout from './pages/jockey/JockeyLayout'
import InvitationList from './pages/jockey/InvitationList'
import MyRaces from './pages/jockey/MyRaces'
import RaceHistory from './pages/jockey/RaceHistory'
import ProfileDeclaration from './pages/jockey/ProfileDeclaration'
import JockeyTournamentList from './pages/jockey/JockeyTournamentList'

// ── Import các trang shared ──
import Protest from './pages/shared/Protest'
import NotificationCenter from './pages/shared/NotificationCenter'

// ── Import các trang Doctor ──
import DoctorLayout from './pages/doctor/DoctorLayout'
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import PaddockConsole from './pages/doctor/PaddockConsole'
import DoctorTournamentList from './pages/doctor/DoctorTournamentList'
import DoctorCoiDeclarations from './pages/doctor/DoctorCoiDeclarations'

// ── Import các trang Referee ──
import RefereeLayout from './pages/referee/RefereeLayout'
import RefereeDashboard from './pages/referee/RefereeDashboard'
import RefereeRaceConsole from './pages/referee/RefereeRaceConsole'
import RefereeTournamentList from './pages/referee/RefereeTournamentList'
import RefereeCoiDeclarations from './pages/referee/RefereeCoiDeclarations'

// ── Import các trang Spectator ──
import SpectatorLayout from './pages/spectator/SpectatorLayout'
import SpectatorHome from './pages/spectator/SpectatorHome'
import PredictionPage from './pages/spectator/PredictionPage'
import WalletTransactions from './pages/spectator/WalletTransactions'
import MyPredictions from './pages/spectator/MyPredictions'
import SpectatorLiveRace from './pages/spectator/SpectatorLiveRace'
import SpectatorLeaderboard from './pages/spectator/SpectatorLeaderboard'
import RaceOperations from './pages/admin/RaceOperation'
import EntryFees from './pages/admin/EntryFees'

// ── Placeholder Admin ──

// ── Protected Route ──
interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: Role[]
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  if (import.meta.env.DEV) return <>{children}</>

  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }
  return <>{children}</>
}

export function getRoleHomePath(role: Role): string {
  switch (role) {
    case 'Admin': return '/admin'
    case 'HorseOwner':
    case 'Owner': return '/owner'
    case 'Jockey': return '/jockey'
    case 'RaceReferee':
    case 'Referee': return '/referee'
    case 'Doctor': return '/doctor'
    case 'Spectator': return '/spectator'
    case 'Admin':       return '/admin'
    case 'HorseOwner':
    case 'Owner':  return '/owner'
    case 'Jockey':      return '/jockey'
    case 'RaceReferee': 
    case 'Referee':     return '/referee'    
    case 'Doctor':      return '/doctor'
    case 'Spectator':   return '/spectator'
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Owner routes */}
        <Route path="/owner" element={
          <ProtectedRoute allowedRoles={['Owner']}>
            <OwnerLayout />
          </ProtectedRoute>
        }>
          <Route index element={<OwnerDashboard />} />
          <Route path="earnings" element={<OwnerEarningsPage />} />
          <Route path="horses" element={<MyHorses />} />
          <Route path="horses/register" element={<RegisterHorse />} />
          <Route path="horses/:id" element={<HorseDetail />} />
          <Route path="race-entries" element={<RaceEntries />} />
          <Route path="tournaments" element={<TournamentList />} />
          <Route path="schedule-confirm" element={<Navigate to="/owner/race-entries" replace />} />
          <Route path="jockey-invite" element={<JockeyInvite />} />
          <Route path="protest" element={<Protest userRole="HorseOwner" />} />
          <Route path="notifications" element={<NotificationCenter />} />
        </Route>

        {/* ── Cấu trúc Route của KỴ SĨ (Jockey) ── */}
        <Route path="/jockey" element={
          <ProtectedRoute allowedRoles={['Jockey']}>
            <JockeyLayout />
          </ProtectedRoute>
        }>
          <Route index element={<div>Jockey Dashboard</div>} />
          <Route path="invitations" element={<InvitationList />} />
          <Route path="races" element={<MyRaces />} />
          <Route path="history" element={<RaceHistory />} />
          <Route path="profile-declaration" element={<ProfileDeclaration />} />
          <Route path="tournaments" element={<JockeyTournamentList />} />
          <Route path="protest" element={<Protest userRole="Jockey" />} />
          <Route path="notifications" element={<NotificationCenter />} />
        </Route>

        {/* ── Cấu trúc Route của BÁC SĨ (Doctor) ── */}
        <Route path="/doctor" element={
          <ProtectedRoute allowedRoles={['Doctor']}>
            <DoctorLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DoctorDashboard />} />
          <Route path="paddock" element={<PaddockConsole />} />
          <Route path="tournaments" element={<DoctorTournamentList />} />
          <Route path="coi" element={<DoctorCoiDeclarations />} />
          <Route path="notifications" element={<NotificationCenter />} />
        </Route>

        {/* ── Cấu trúc Route của TRỌNG TÀI (Referee) ── */}
        <Route path="/referee" element={
          <ProtectedRoute allowedRoles={['RaceReferee', 'Referee']}>
            <RefereeLayout />
          </ProtectedRoute>
        }>
          <Route index element={<RefereeDashboard />} />
          <Route path="tournaments" element={<RefereeTournamentList />} />
          <Route path="coi" element={<RefereeCoiDeclarations />} />
          <Route path="race-console" element={<RefereeRaceConsole />} />
          <Route path="notifications" element={<NotificationCenter />} />
        </Route>

        {/* ── Cấu trúc Route của KHÁN GIẢ (Spectator) ── */}
        <Route path="/spectator" element={
          <ProtectedRoute allowedRoles={['Spectator']}>
            <SpectatorLayout />
          </ProtectedRoute>
        }>
          <Route index element={<SpectatorHome />} />
          <Route path="prediction" element={<PredictionPage />} />
          <Route path="wallet" element={<WalletTransactions />} />
          <Route path="my-predictions" element={<MyPredictions />} />
          <Route path="live-race" element={<SpectatorLiveRace />} />
          <Route path="leaderboard" element={<SpectatorLeaderboard />} />
          <Route path="notifications" element={<NotificationCenter />} />
        </Route>

        {/* Admin */}
        {/* ── Cấu trúc Route của ADMIN ── */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="approval-center" element={<ApprovalCenter />} />
          <Route path="users" element={<UserManagement />} />
          {/* Danh sách giải đấu — trang riêng */}
          <Route path="tournaments" element={<TournamentBuilder />} />
          {/* Wizard tạo mới / chỉnh sửa giải đấu */}
          <Route path="tournament-builder" element={<TournamentBuilder />} />
          <Route path="tournament-builder/:id" element={<TournamentBuilder />} />
          <Route path="race-operations" element={<RaceOperations />} />
          <Route path="entry-fees" element={<EntryFees />} />
          <Route path="tournament-hub" element={<TournamentHub />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="live-race" element={<LiveRaceView />} />
          <Route path="notifications" element={<AdminNotificationCenter />} />
          <Route path="my-account" element={<MyAccount />} />
          <Route path="assign-officials" element={<AssignOfficials />} />
        </Route>

        <Route path="/unauthorized" element={<div>403 — Không có quyền truy cập</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
