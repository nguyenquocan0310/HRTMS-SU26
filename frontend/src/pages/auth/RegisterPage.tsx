import { Link, useNavigate } from 'react-router-dom'
import { useFormik } from 'formik' // Import Formik
import * as Yup from 'yup'         // Import Yup
import { register } from '../../api/auth'
import type { Role } from '../../types'
import './RegisterPage.css'

const RegisterSchema = Yup.object().shape({
  fullName: Yup.string().required('Họ và tên là bắt buộc'),
  username: Yup.string().required('Tên đăng nhập là bắt buộc'),
  email: Yup.string().email('Email không hợp lệ').required('Email là bắt buộc'),
  password: Yup.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự').required('Mật khẩu là bắt buộc'),
  confirmPassword: Yup.string().oneOf([Yup.ref('password')], 'Mật khẩu xác nhận không khớp').required('Vui lòng xác nhận mật khẩu'),
  role: Yup.string().required('Vui lòng chọn vai trò'),
});

export default function RegisterPage() {
  const navigate = useNavigate()

  const formik = useFormik({
    initialValues: { username: '', fullName: '', email: '', password: '', confirmPassword: '', role: 'Spectator' as Role },
    validationSchema: RegisterSchema,
    onSubmit: async (values, { setFieldError, setSubmitting }) => {
      try {
        await register(values)
        navigate('/login')
      } catch (err: any) {
        setFieldError('email', err.response?.data?.message ?? 'Đăng ký thất bại')
      } finally {
        setSubmitting(false)
      }
    },
  })

  const ROLES = [
    'HorseOwner',
    'Jockey',
    'Referee',
    'Spectator'
  ]

  return (
    <div className="login-page-container">
      <div className="login-image-panel">        
      </div>

      <div className="login-form-panel">
        <div className="tabs">
          <Link to="/login" className="tab">Login</Link>
          <Link to="/register" className="tab active">Register</Link>
        </div>

        <div className="form-content">
          <h2>Create Account</h2>
          <form onSubmit={formik.handleSubmit} className="login-form">
            
            {/* Ví dụ mẫu cho 1 trường (làm tương tự cho các trường còn lại) */}
            <div className="input-group">
              <label>Full Name <span className="required">*</span></label>

              <input
                type="text"
                name="fullName"
                placeholder="Enter full name"
                value={formik.values.fullName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={formik.touched.fullName && formik.errors.fullName ? 'input-error' : ''}
              />

              {formik.touched.fullName && formik.errors.fullName && (
                <p className="error-text">{formik.errors.fullName}</p>
              )}
            </div>

            <div className="input-group">
              <label>Email<span className="required">*</span></label>
              <input
                type="email"
                name="email"
                placeholder="Enter email"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={formik.touched.email && formik.errors.email ? 'input-error' : ''}
              />
              {formik.touched.email && formik.errors.email && (
                <p className="error-text">{formik.errors.email}</p>
              )}
            </div>

            <div className="input-group">
              <label>Username<span className="required">*</span></label>
              <input
                type="text"
                name="username"
                placeholder="Enter username"
                value={formik.values.username}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={formik.touched.username && formik.errors.username ? 'input-error' : ''}
              />
              {formik.touched.username && formik.errors.username && (
                <p className="error-text">{formik.errors.username}</p>
              )}
            </div>

            <div className="input-group">
              <label>Password<span className="required">*</span></label>
              <input
                type="password"
                name="password"
                placeholder="Enter password"
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={formik.touched.password && formik.errors.password ? 'input-error' : ''}
              />
              {formik.touched.password && formik.errors.password && (
                <p className="error-text">{formik.errors.password}</p>
              )}
            </div>  

            <div className="input-group">
              <label>Confirm Password<span className="required">*</span></label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Confirm password"
                value={formik.values.confirmPassword}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={formik.touched.confirmPassword && formik.errors.confirmPassword ? 'input-error' : ''}
              />
              {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                <p className="error-text">{formik.errors.confirmPassword}</p>
              )}
            </div>              

            <div className="input-group">
              <label>Role<span className="required">*</span></label>
  <select
    name="role"
    value={formik.values.role}
    onChange={formik.handleChange}
    onBlur={formik.handleBlur}
    className={
      formik.touched.role &&
      formik.errors.role
        ? 'input-error'
        : ''
    }
  >
    {ROLES.map((role) => (
      <option
        key={role}
        value={role}
      >
        {role}
      </option>
    ))}
  </select>
              {formik.touched.role && formik.errors.role && (
                <p className="error-text">{formik.errors.role}</p>
              )}
            </div>                                              


            <button type="submit" className="sign-in-button" disabled={formik.isSubmitting}>
              {formik.isSubmitting ? 'Processing...' : 'Create Account →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}