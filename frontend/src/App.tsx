import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import type { Role } from './types'
import Home from './pages/Home/Home.js'

import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'

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

{/* ── DOCTOR ── */}
import DoctorLayout from './pages/doctor/DoctorLayout'
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import PaddockConsole from './pages/doctor/PaddockConsole'

{/* ── REFEREE ── */}
import RefereeLayout from './pages/referee/RefereeLayout'
import RefereeDashboard from './pages/referee/RefereeDashboard'
import RaceOfficiating from './pages/referee/RaceOfficiating'
import ProtestHandling from './pages/referee/ProtestHandling'

{/* ── SPECTATOR ── */}
import SpectatorLayout from './pages/spectator/SpectatorLayout'
import SpectatorHome from './pages/spectator/SpectatorHome'
import PredictionPage from './pages/spectator/PredictionPage'
import WalletTransactions from './pages/spectator/WalletTransactions'
import MyPredictions from './pages/spectator/MyPredictions'

// ── Placeholder Admin ──
const AdminDashboard = () => <div>Admin Dashboard</div>

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
    case 'HorseOwner':  return '/owner'
    case 'Jockey':      return '/jockey'
    case 'RaceReferee': return '/referee'
    case 'Doctor':      return '/doctor'
    case 'Spectator':   return '/spectator'
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"         element={<Home />} /> 
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Owner routes */}
        <Route path="/owner" element={
          <ProtectedRoute allowedRoles={['HorseOwner']}>
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

        {/* Jockey routes */}
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

        {/* Doctor routes */}
        <Route path="/doctor" element={
          <ProtectedRoute allowedRoles={['Doctor']}>
            <DoctorLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DoctorDashboard />} />
          <Route path="paddock" element={<PaddockConsole />} />
        </Route>

        {/* Referee routes */}
        <Route path="/referee" element={
          <ProtectedRoute allowedRoles={['RaceReferee']}>
            <RefereeLayout />
          </ProtectedRoute>
        }>
          <Route index element={<RefereeDashboard />} />
          <Route path="officiating" element={<RaceOfficiating />} />
          <Route path="protest" element={<ProtestHandling />} />
        </Route>

        {/* Spectator routes */}
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
        <Route path="/admin/*"     element={<ProtectedRoute allowedRoles={['Admin']}><AdminDashboard /></ProtectedRoute>} />

        <Route path="/unauthorized" element={<div>403 — Không có quyền truy cập</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}