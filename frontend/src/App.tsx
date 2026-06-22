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

// ── Import các trang Owner ──
import MyHorses from './pages/owner/MyHorses'
import OwnerDashboard from './pages/owner/OwnerDashboard'
import OwnerLayout from './pages/owner/OwnerLayout'
import RegisterHorse from './pages/owner/RegisterHorse'
import HorseDetail from './pages/owner/HorseDetail'
import ScheduleConfirm from './pages/owner/ScheduleConfirm'

// ── Import các trang Jockey ──
import JockeyLayout from './pages/jockey/JockeyLayout'
import InvitationList from './pages/jockey/InvitationList'
import MyRaces from './pages/jockey/MyRaces'
import RaceHistory from './pages/jockey/RaceHistory'
import ProfileDeclaration from './pages/jockey/ProfileDeclaration'

// ── Import các trang shared ──
import Protest from './pages/shared/Protest'

// ── Import các trang Doctor ──
import DoctorLayout from './pages/doctor/DoctorLayout'
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import PaddockConsole from './pages/doctor/PaddockConsole'

// ── Import các trang Referee ──
import RefereeLayout from './pages/referee/RefereeLayout'
import RefereeDashboard from './pages/referee/RefereeDashboard'
import RaceOfficiating from './pages/referee/RaceOfficiating'
import ProtestHandling from './pages/referee/ProtestHandling'

// ── Import các trang Spectator ──
import SpectatorLayout from './pages/spectator/SpectatorLayout'
import SpectatorHome from './pages/spectator/SpectatorHome'
import PredictionPage from './pages/spectator/PredictionPage'
import WalletTransactions from './pages/spectator/WalletTransactions'
import MyPredictions from './pages/spectator/MyPredictions'

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
    case 'Admin':       return '/admin'
    case 'HorseOwner':  
    case 'Owner':       return '/owner'    
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
  <ProtectedRoute allowedRoles={['HorseOwner', 'Owner']}>
    <OwnerLayout />
  </ProtectedRoute>
}>
          <Route index element={<OwnerDashboard />} />
          <Route path="horses" element={<MyHorses />} />
          <Route path="horses/register" element={<RegisterHorse />} />
          <Route path="horses/:id" element={<HorseDetail />} />
          <Route path="schedule-confirm" element={<ScheduleConfirm />} />
          <Route path="protest" element={<Protest userRole="HorseOwner" />} />
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
          <Route path="protest" element={<Protest userRole="Jockey" />} />
        </Route>

        {/* ── Cấu trúc Route của BÁC SĨ (Doctor) ── */}
        <Route path="/doctor" element={
          <ProtectedRoute allowedRoles={['Doctor']}>
            <DoctorLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DoctorDashboard />} />
          <Route path="paddock" element={<PaddockConsole />} />
        </Route>

        {/* ── Cấu trúc Route của TRỌNG TÀI (Referee) ── */}
        <Route path="/referee" element={
  <ProtectedRoute allowedRoles={['RaceReferee', 'Referee']}>
    <RefereeLayout />
  </ProtectedRoute>
}>
          <Route index element={<RefereeDashboard />} />
          <Route path="officiating" element={<RaceOfficiating />} />
          <Route path="protest" element={<ProtestHandling />} />
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
  <Route path="tournament-builder" element={<TournamentBuilder />} />
</Route>

        <Route path="/unauthorized" element={<div>403 — Không có quyền truy cập</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}