import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  FiUser,
  FiLock,
  FiArrowRight,
  FiHelpCircle,
  FiEye,
  FiEyeOff,
} from 'react-icons/fi';
import { GiHorseHead } from 'react-icons/gi';

import styles from './LoginPage.module.scss';

export default function LoginPage() {
  /* ─── Local state ──────────────────────────────────────── */
  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('');
  const [rememberSession, setRememberSession] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const isFormValid = credential.trim() !== '' && password.trim() !== '';

  /* ─── Submit handler ───────────────────────────────────── */
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!credential.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    // TODO: gọi API đăng nhập khi có Swagger từ BE — xem Điều 6
    // Dự kiến: POST /api/auth/login  body: { email: credential, password }
    // Nếu rememberSession === true → lưu token vào localStorage thay vì sessionStorage
    console.log('[LoginPage] submit', { credential, password, rememberSession });
  };

  /* ─── Render ───────────────────────────────────────────── */
  return (
    <div className={styles.loginPage}>
      {/* Faint horse silhouette background */}
      <div className={styles.bgOverlay} />

      {/* ═══ CARD ════════════════════════════════════════════ */}
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logoBlock}>
          <div className={styles.logoIcon}>
            <GiHorseHead />
          </div>
          <span className={styles.logoText}>HRTMS</span>
          <span className={styles.tagline}>MYSTIC THOROUGHBRED</span>
        </div>

        {/* Error */}
        {error && <div className={styles.errorMsg}>{error}</div>}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Username / Email */}
          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="login-credential">
                USERNAME / EMAIL
              </label>
            </div>
            <div className={styles.inputWrap}>
              <input
                id="login-credential"
                className={styles.input}
                type="text"
                placeholder="Enter your credentials"
                autoComplete="username"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
              />
              <FiUser className={styles.inputIcon} />
            </div>
          </div>

          {/* Password */}
          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="login-password">
                PASSWORD
              </label>
              <Link to="#" className={styles.forgotLink}>
                FORGOT PASSWORD?
              </Link>
            </div>
            <div className={styles.inputWrap}>
              <input
                id="login-password"
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <FiLock className={styles.inputIcon} />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          {/* Remember session */}
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={rememberSession}
              onChange={(e) => setRememberSession(e.target.checked)}
            />
            <span className={styles.checkLabel}>Remember this session</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!isFormValid}
          >
            Login to Dashboard <FiArrowRight size={16} />
          </button>
        </form>

        {/* Divider + security notice */}
        <hr className={styles.divider} />
        <div className={styles.securityNotice}>
          Authorized Personnel Only.
          <br />
          Encryption Level: <span className={styles.gold}>256-BIT AES</span>
        </div>
      </div>

      {/* ═══ BELOW CARD ══════════════════════════════════════ */}
      <div className={styles.bottomMeta}>
        <div className={styles.metaRow}>
          <a href="#" className={styles.statusLink}>
            <FiHelpCircle size={13} />
            System Status
          </a>
          <span className={styles.version}>v2.4.0-STABLE</span>
        </div>
        <div className={styles.registerRow}>
          New to HRTMS?{' '}
          <Link to="/register" className={styles.registerLink}>
            Register Account
          </Link>
        </div>
      </div>
    </div>
  );
}
