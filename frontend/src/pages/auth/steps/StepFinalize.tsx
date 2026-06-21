import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegRole } from '../../../types/role.types';
import type { RegisterFormData } from '../../../types/auth.types';
import type { Role } from '../../../types';
import * as authService from '../../../services/authService';
import styles from './StepFinalize.module.scss';

interface Props {
  role: RegRole | null;
  formData: RegisterFormData;
}

// RegRole (enum dùng cho UI luồng Register) khớp giá trị với Role (type dùng
// cho authService/User toàn hệ thống) — map tường minh để tránh nhầm lẫn.
const mapRegRoleToRole = (role: RegRole): Role => role as unknown as Role;

const StepFinalize = ({ role, formData }: Props) => {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resultMessage, setResultMessage] = useState('');

  const handleSubmit = async () => {
    if (!role) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // Gom verification data theo role để gửi kèm (BE thật sẽ dùng các field này)
      let verificationData: Record<string, unknown> = {};
      if (role === RegRole.Owner) verificationData = formData.ownerVerification;
      if (role === RegRole.Jockey) verificationData = formData.jockeyVerification;
      if (role === RegRole.Referee) verificationData = formData.refereeVerification;
      if (role === RegRole.Doctor) verificationData = formData.doctorVerification;

      const result = await authService.register({
        role: mapRegRoleToRole(role),
        username: formData.identity.username,
        email: formData.identity.email,
        password: formData.credentials.password,
        verificationData,
      });

      setResultMessage(result.message);
      setSubmitted(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Sau khi submit ───────────────────────────────────────────────────────
  if (submitted) {
    const isSpectator = role === RegRole.Spectator;

    return (
      <div className={styles.container}>
        <div className={styles.successBox}>
          <div className={styles.successIcon}>✅</div>

          {isSpectator ? (
            <>
              <h2 className={styles.successTitle}>Đăng ký thành công!</h2>
              <p className={styles.successMsg}>{resultMessage}</p>
            </>
          ) : (
            <>
              <h2 className={styles.successTitle}>Hồ sơ đã được gửi!</h2>
              <p className={styles.successMsg}>{resultMessage}</p>
            </>
          )}

          <button
            className={styles.loginBtn}
            onClick={() => navigate('/login')}
          >
            Đến trang đăng nhập →
          </button>
        </div>
      </div>
    );
  }

  // ─── Trước khi submit ─────────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Finalize Registration</h2>
      <p className={styles.subtitle}>
        You're almost done! Click the button below to complete your registration.
      </p>

      <div className={styles.summaryBox}>
        <p className={styles.summaryText}>
          {role === RegRole.Spectator
            ? '🎯 Tài khoản Spectator sẽ được kích hoạt ngay lập tức và bạn sẽ nhận 1000 điểm vào Wallet.'
            : '📋 Hồ sơ của bạn sẽ được gửi đến Admin để xét duyệt. Quá trình này có thể mất 1-3 ngày làm việc.'}
        </p>
      </div>

      {errorMsg && <div className={styles.errorMsg}>{errorMsg}</div>}

      <button
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Đang xử lý...' : 'Hoàn tất đăng ký'}
      </button>
    </div>
  );
};

export default StepFinalize;