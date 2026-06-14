import { Link, useNavigate } from 'react-router-dom'
import { Formik, Form, Field, ErrorMessage } from 'formik'
import * as Yup from 'yup'

import { login } from '../../api/auth'
import useAuthStore from '../../store/authStore'
import { getRoleHomePath } from '../../App'
import './LoginPage.css'

const loginSchema = Yup.object({
  email: Yup.string()
    .email('Email không hợp lệ')
    .required('Email là bắt buộc'),

  password: Yup.string()
    .required('Mật khẩu là bắt buộc')
})

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  return (
    <div className="login-page-container">

      {/* LEFT PANEL */}
      <div className="left-overlay">

  <div className="hero-content">

    <div className="brand-logo-circle">
      🐎
    </div>

    <h1>HRTMS</h1>

    <p>
      Elevate your tournament management to elite
      standards. Precision, heritage, and performance
      in every stride.
    </p>

  </div>

  <div className="brand-stats">

    <div className="stat-item">
      <span className="stat-number">500+</span>
      <span className="stat-label">Events</span>
    </div>

    <div className="stat-item">
      <span className="stat-number">12k</span>
      <span className="stat-label">Athletes</span>
    </div>

    <div className="stat-item">
      <span className="stat-number">Top 10</span>
      <span className="stat-label">Ranked</span>
    </div>

  </div>

</div>

      {/* RIGHT PANEL */}
      <div className="login-form-panel">
        <div className="tabs">
          <Link to="/login" className="tab active">
            Login
          </Link>

          <Link to="/register" className="tab">
            Register
          </Link>
        </div>

        <div className="form-content">
          <h2>Welcome Back</h2>

          <p className="form-subtitle">
            Sign in to access your racing dashboard.
          </p>

          <Formik
            initialValues={{
              email: '',
              password: ''
            }}
            validationSchema={loginSchema}
            onSubmit={async (values, { setSubmitting, setStatus }) => {
              try {
                const res = await login(values)

                setAuth(res.token, res.user)

                navigate(
                  getRoleHomePath(res.user.role),
                  { replace: true }
                )
              } catch (err: any) {
                setStatus(
                  err.response?.data?.message ??
                    'Đăng nhập thất bại'
                )
              } finally {
                setSubmitting(false)
              }
            }}
          >
            {({ errors, touched, isSubmitting, status }) => (
              <Form className="login-form">

                {/* EMAIL */}
                <div className="field-wrapper">
                  <label>
                    Email Address
                    <span className="required">*</span>
                  </label>

                  <Field
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    className={
                      touched.email && errors.email
                        ? 'input-error'
                        : ''
                    }
                  />

                  <ErrorMessage
                    name="email"
                    component="div"
                    className="error-text"
                  />
                </div>

                {/* PASSWORD */}
                <div className="field-wrapper">
                  <label>
                    Password
                    <span className="required">*</span>
                  </label>

                  <Field
                    name="password"
                    type="password"
                    placeholder="Enter your password"
                    className={
                      touched.password && errors.password
                        ? 'input-error'
                        : ''
                    }
                  />

                  <ErrorMessage
                    name="password"
                    component="div"
                    className="error-text"
                  />
                </div>

                {status && (
                  <div className="error-message">
                    {status}
                  </div>
                )}

                <div className="form-footer">
                  <label className="checkbox-label">
                    <input type="checkbox" />
                    Remember device
                  </label>

                  <a href="#" className="forgot-password">
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  className="sign-in-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Signing In...'
                    : 'Sign In →'}
                </button>
              </Form>
            )}
          </Formik>

          <div className="separator">
            <span>Secure Access</span>
          </div>

          <button className="google-sign-in">
            Authorized SSO Login
          </button>
        </div>
      </div>
    </div>
  )
}