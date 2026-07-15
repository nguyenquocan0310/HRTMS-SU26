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

const mapRegRoleToRole = (role: RegRole): Role => {
  const mapping: Record<RegRole, Role> = {
    [RegRole.Owner]: 'HorseOwner',
    [RegRole.Jockey]: 'Jockey',
    [RegRole.Referee]: 'RaceReferee',
    [RegRole.Doctor]: 'Doctor',
    [RegRole.Spectator]: 'Spectator',
  };

  return mapping[role];
};

const StepFinalize = ({
  role,
  formData,
}: Props) => {
  const navigate = useNavigate();

  const [submitted, setSubmitted] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMsg, setErrorMsg] =
    useState('');

  const [resultMessage, setResultMessage] =
    useState('');

  const validateBeforeSubmit = (): string | null => {
    if (!role) {
      return 'Vui lòng chọn vai trò.';
    }

    if (!formData.identity.username.trim()) {
      return 'Vui lòng nhập username.';
    }

    if (!formData.identity.fullName.trim()) {
      return 'Vui lòng nhập họ và tên.';
    }

    if (!formData.identity.email.trim()) {
      return 'Vui lòng nhập email.';
    }

    if (!formData.credentials.password) {
      return 'Vui lòng nhập mật khẩu.';
    }

    if (
      formData.credentials.password !==
      formData.credentials.confirmPassword
    ) {
      return 'Mật khẩu xác nhận không khớp.';
    }

    if (role === RegRole.Owner) {
      const verification =
        formData.ownerVerification;

      if (!verification.phoneNumber.trim()) {
        return 'Vui lòng nhập số điện thoại.';
      }

      if (
        verification.identityNumber.length !== 12
      ) {
        return 'CCCD phải có đúng 12 số.';
      }

      if (!verification.dateOfBirth) {
        return 'Vui lòng nhập ngày sinh.';
      }
    }

    if (role === RegRole.Jockey) {
      const verification =
        formData.jockeyVerification;

      if (!verification.phoneNumber.trim()) {
        return 'Vui lòng nhập số điện thoại.';
      }

      if (
        verification.identityNumber.length !== 12
      ) {
        return 'CCCD phải có đúng 12 số.';
      }

      if (!verification.dateOfBirth) {
        return 'Vui lòng nhập ngày sinh.';
      }

      if (!verification.certificateFile) {
        return 'Vui lòng tải lên file chứng chỉ.';
      }

      if (
        verification.experienceYears === ''
      ) {
        return 'Vui lòng nhập số năm kinh nghiệm.';
      }

      if (
        verification.selfDeclaredWeight === ''
      ) {
        return 'Vui lòng nhập cân nặng.';
      }

      if (!verification.bloodType) {
        return 'Vui lòng chọn nhóm máu.';
      }

      if (!verification.healthStatus.trim()) {
        return 'Vui lòng nhập tình trạng sức khỏe.';
      }
    }

    if (role === RegRole.Referee) {
      const verification =
        formData.refereeVerification;

      if (!verification.phoneNumber.trim()) {
        return 'Vui lòng nhập số điện thoại.';
      }

      if (
        verification.identityNumber.length !== 12
      ) {
        return 'CCCD phải có đúng 12 số.';
      }

      if (!verification.dateOfBirth) {
        return 'Vui lòng nhập ngày sinh.';
      }

      if (!verification.certificateFile) {
        return 'Vui lòng tải lên file chứng chỉ.';
      }
    }

    if (role === RegRole.Doctor) {
      const verification =
        formData.doctorVerification;

      if (!verification.phoneNumber.trim()) {
        return 'Vui lòng nhập số điện thoại.';
      }

      if (
        verification.identityNumber.length !== 12
      ) {
        return 'CCCD phải có đúng 12 số.';
      }

      if (!verification.dateOfBirth) {
        return 'Vui lòng nhập ngày sinh.';
      }

      if (!verification.certificateFile) {
        return 'Vui lòng tải lên file chứng chỉ.';
      }
    }

    return null;
  };

  const buildVerificationData =
    (): Record<string, unknown> => {
      if (role === RegRole.Owner) {
        return {
          ...formData.ownerVerification,
        };
      }

      if (role === RegRole.Jockey) {
        return {
          ...formData.jockeyVerification,
        };
      }

      if (role === RegRole.Referee) {
        return {
          ...formData.refereeVerification,
        };
      }

      if (role === RegRole.Doctor) {
        return {
          ...formData.doctorVerification,
        };
      }

      return {};
    };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const validationError =
      validateBeforeSubmit();

    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    if (!role) {
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setResultMessage('');

    try {
      const result =
        await authService.register({
          role: mapRegRoleToRole(role),
          username:
            formData.identity.username.trim(),
          fullName:
            formData.identity.fullName.trim(),
          email:
            formData.identity.email.trim(),
          password:
            formData.credentials.password,
          verificationData:
            buildVerificationData(),
        });

      setResultMessage(
        result.message ||
          'Đăng ký thành công.'
      );

      setSubmitted(true);
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : 'Đăng ký thất bại. Vui lòng thử lại.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    const isInstantActive =
      role === RegRole.Spectator ||
      role === RegRole.Owner;

    return (
      <div className={styles.container}>
        <div className={styles.successBox}>
          <div className={styles.successIcon}>
            ✅
          </div>

          <h2 className={styles.successTitle}>
            {isInstantActive
              ? 'Đăng ký thành công!'
              : 'Hồ sơ đã được gửi!'}
          </h2>

          <p className={styles.successMsg}>
            {resultMessage}
          </p>

          <button
            type="button"
            className={styles.loginBtn}
            onClick={() =>
              navigate('/login')
            }
          >
            Đến trang đăng nhập →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>
        Finalize Registration
      </h2>

      <p className={styles.subtitle}>
        You're almost done! Click the button
        below to complete your registration.
      </p>

      <div className={styles.summaryBox}>
        <p className={styles.summaryText}>
          {role === RegRole.Spectator
            ? '🎯 Tài khoản Spectator sẽ được kích hoạt ngay lập tức và bạn sẽ nhận 1000 điểm vào Wallet.'
            : role === RegRole.Owner
              ? '🎯 Tài khoản Horse Owner sẽ được kích hoạt ngay lập tức. Bạn có thể đăng nhập và sử dụng ngay.'
              : '📋 Hồ sơ của bạn sẽ được gửi đến Admin để xét duyệt.'}
        </p>
      </div>

      {errorMsg && (
        <div className={styles.errorMsg}>
          {errorMsg}
        </div>
      )}

      <button
        type="button"
        className={styles.submitBtn}
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting
          ? 'Đang xử lý...'
          : 'Hoàn tất đăng ký'}
      </button>
    </div>
  );
};

export default StepFinalize;