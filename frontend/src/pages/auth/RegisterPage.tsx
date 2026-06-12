import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { register } from '../../api/auth'
import type { Role } from '../../types'

const ROLES: Role[] = ['HorseOwner', 'Jockey', 'Spectator']

export default function RegisterPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    username: '',
    fullName: '',
    email: '',
    password: '',
    role: 'Spectator' as Role,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await register(form)
      navigate('/login')
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Đăng ký thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>Đăng ký</h1>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Tên đăng nhập"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
        />
        <input
          placeholder="Họ và tên"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />

        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {error && <p style={{ color: 'red' }}>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Đăng ký'}
        </button>
      </form>

      <a href="/login">Đã có tài khoản? Đăng nhập</a>
    </div>
  )
}
