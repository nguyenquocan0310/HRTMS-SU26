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
import RaceEntries from './pages/owner/RaceEntries'
import JockeyInvite from './pages/owner/JockeyInvite'
import ScheduleConfirm from './pages/owner/ScheduleConfirm'
import Protest from './pages/shared/Protest'
import ProfileDeclaration from './pages/jockey/ProfileDeclaration'

// Import jockey pages
import JockeyLayout from './pages/jockey/JockeyLayout'
import InvitationList from './pages/jockey/InvitationList'
import MyRaces from './pages/jockey/MyRaces'
import RaceHistory from './pages/jockey/RaceHistory'

// ── Placeholder các role khác ──
const AdminDashboard     = () => <div>Admin Dashboard</div>
const JockeyDashboard    = () => <div>Jockey Dashboard</div>
const RefereeDashboard   = () => <div>Race Referee Dashboard</div>
const DoctorDashboard    = () => <div>Doctor Dashboard</div>
const SpectatorDashboard = () => <div>Spectator Dashboard</div>

// ── Protected Route ──
interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: Role[]
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  // TẠM THỜI bypass auth khi dev để làm giao diện nhanh
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

        {/* ── Cấu trúc Route của CHỦ NGỰA (Owner) ── */}
        <Route path="/owner" element={
          <ProtectedRoute allowedRoles={['HorseOwner']}>
            <OwnerLayout />
          </ProtectedRoute>
        }>
          <Route index element={<OwnerDashboard />} />
          <Route path="horses" element={<MyHorses />} />
          <Route path="horses/register" element={<RegisterHorse />} />
          <Route path="horses/:id" element={<HorseDetail />} />
          {/* ✨ ĐÃ BỔ SUNG 2 ROUTE THIẾU CỦA OWNER VÀO ĐÂY: */}
          <Route path="schedule-confirm" element={<ScheduleConfirm />} />
          <Route path="protest" element={<Protest userRole="HorseOwner" />} />
        </Route>

        {/* ── Cấu trúc Route của KỴ SĨ (Jockey) ── */}
        <Route path="/jockey" element={
          <ProtectedRoute allowedRoles={['Jockey']}>
            <JockeyLayout />
          </ProtectedRoute>
        }>
          <Route index element={<JockeyDashboard />} />
          <Route path="invitations" element={<InvitationList />} />
          <Route path="races" element={<MyRaces />} />
          <Route path="history" element={<RaceHistory />} />
          {/* ✨ ĐÃ BỔ SUNG 2 ROUTE THIẾU CỦA JOCKEY VÀO ĐÂY: */}
          <Route path="profile-declaration" element={<ProfileDeclaration />} />
          <Route path="protest" element={<Protest userRole="Jockey" />} />
        </Route>

        {/* Các role hệ thống khác */}
        <Route path="/admin/*"     element={<ProtectedRoute allowedRoles={['Admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/referee/*"   element={<ProtectedRoute allowedRoles={['RaceReferee']}><RefereeDashboard /></ProtectedRoute>} />
        <Route path="/doctor/*"    element={<ProtectedRoute allowedRoles={['Doctor']}><DoctorDashboard /></ProtectedRoute>} />
        <Route path="/spectator/*" element={<ProtectedRoute allowedRoles={['Spectator']}><SpectatorDashboard /></ProtectedRoute>} />

        <Route path="/unauthorized" element={<div>403 — Không có quyền truy cập</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}