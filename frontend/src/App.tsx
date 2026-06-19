import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import type { Role } from './types'
import LandingPage from './pages/landing/LandingPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'


// ─── Placeholder pages — FE leader thay bằng component thật ──────────────────
const AdminDashboard    = () => <div>Admin Dashboard</div>
const OwnerDashboard    = () => <div>Horse Owner Dashboard</div>
const JockeyDashboard   = () => <div>Jockey Dashboard</div>
const RefereeDashboard  = () => <div>Race Referee Dashboard</div>
const DoctorDashboard   = () => <div>Doctor Dashboard</div>
const SpectatorDashboard = () => <div>Spectator Dashboard</div>

// ─── Protected Route ──────────────────────────────────────────────────────────
interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: Role[]
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}

// ─── Role-based redirect sau khi login ───────────────────────────────────────
export function getRoleHomePath(role: Role): string {
  switch (role) {
    case 'Admin':        return '/admin'
    case 'HorseOwner':   return '/owner'
    case 'Jockey':       return '/jockey'
    case 'RaceReferee':  return '/referee'
    case 'Doctor':       return '/doctor'
    case 'Spectator':    return '/spectator'
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected — theo role */}
        <Route path="/admin/*"    element={<ProtectedRoute allowedRoles={['Admin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/owner/*"    element={<ProtectedRoute allowedRoles={['HorseOwner']}><OwnerDashboard /></ProtectedRoute>} />
        <Route path="/jockey/*"   element={<ProtectedRoute allowedRoles={['Jockey']}><JockeyDashboard /></ProtectedRoute>} />
        <Route path="/referee/*"  element={<ProtectedRoute allowedRoles={['RaceReferee']}><RefereeDashboard /></ProtectedRoute>} />
        <Route path="/doctor/*"   element={<ProtectedRoute allowedRoles={['Doctor']}><DoctorDashboard /></ProtectedRoute>} />
        <Route path="/spectator/*" element={<ProtectedRoute allowedRoles={['Spectator']}><SpectatorDashboard /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="/unauthorized" element={<div>403 — Không có quyền truy cập</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
