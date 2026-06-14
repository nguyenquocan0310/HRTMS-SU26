import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../../api/auth'
import useAuthStore from '../../store/authStore'
import { getRoleHomePath } from '../../App'
import './LoginPage.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await login(form)
      setAuth(res.token, res.user)
      navigate(getRoleHomePath(res.user.role), { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page-container">
      {/* CỘT TRÁI - PANEL HÌNH ẢNH */}
      <div className="login-image-panel">
        <div className="brand-header">
          <div className="brand-logo-circle">
            <span className="brand-icon">🐴</span> {/* Tạm dùng emoji, bạn có thể thay bằng icon logo */}
          </div>
          <h1>HRTMS</h1>
          <p>Elevate your tournament management to elite standards. Precision, heritage, and performance in every stride.</p>
        </div>
        <div className="brand-stats">
          <div className="stat-item"><span className="stat-number">500+</span><span className="stat-label">Events</span></div>
          <div className="stat-item"><span className="stat-number">12k</span><span className="stat-label">Athletes</span></div>
          <div className="stat-item"><span className="stat-number">Top 10</span><span className="stat-label">Ranked</span></div>
        </div>
      </div>

      {/* CỘT PHẢI - PANEL FORM */}
      <div className="login-form-panel">
        <div className="tabs">
          <Link to="/login" className="tab active">Login</Link>
          <Link to="/register" className="tab">Register</Link>
        </div>

        <div className="form-content">
          <h2>Welcome Back</h2>
          <p className="form-subtitle">Access your elite racing dashboard.</p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <span className="input-icon">📧</span>
              <input
                type="email"
                placeholder="Email Address"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="input-group">
              <span className="input-icon">🔒</span>
              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            {error && <p className="error-message">{error}</p>}

            <div className="form-footer">
              <label className="checkbox-label">
                <input type="checkbox" /> Remember device
              </label>
              <a href="#" className="forgot-password">Forgot credentials?</a>
            </div>

            <button type="submit" className="sign-in-button" disabled={loading}>
              {loading ? 'Đang đăng nhập...' : 'Sign In →'}
            </button>
          </form>

          <div className="separator"><span>Secure Entry</span></div>

          <button className="google-sign-in">
            <span className="google-icon">G</span> Authorized SSO Login
          </button>

          <div className="additional-links">
            <a href="#">Help Center</a>
            <span>|</span>
            <a href="#">Security Protocol</a>
          </div>
        </div>
      </div>
    </div>
  )
}
