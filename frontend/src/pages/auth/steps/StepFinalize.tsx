import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegRole } from '../../../types/role.types';
import styles from './StepFinalize.module.scss';

interface Props {
  role: RegRole | null;
}

const StepFinalize = ({ role }: Props) => {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    // TODO: Gọi API thật ở đây (Điều 6)
    setSubmitted(true);
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
              <p className={styles.successMsg}>
                Tài khoản đã được tạo. Bạn đã nhận{' '}
                <span className={styles.highlight}>1000 điểm</span> vào Wallet.
                Hãy đăng nhập ngay.
              </p>
            </>
          ) : (
            <>
              <h2 className={styles.successTitle}>Hồ sơ đã được gửi!</h2>
              <p className={styles.successMsg}>
                Hồ sơ của bạn đã được gửi và đang chờ{' '}
                <span className={styles.highlight}>Admin xác nhận</span>.
                Bạn sẽ nhận được thông báo qua email.
              </p>
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

      <button className={styles.submitBtn} onClick={handleSubmit}>
        Hoàn tất đăng ký
      </button>
    </div>
  );
};

export default StepFinalize;