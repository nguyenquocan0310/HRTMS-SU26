import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { RegRole } from '../../types/role.types';

import {
  type RegisterFormData,
  type RegisterFormErrors,
  initialFormData,
} from '../../types/auth.types';

import StepperBar from '../../components/common/StepperBar';
import StepRoleSelection from './steps/StepRoleSelection';
import StepIdentity from './steps/StepIdentity';
import StepCredentials from './steps/StepCredentials';
import StepVerification from './steps/StepVerification';
import StepReview from './steps/StepReview';
import StepFinalize from './steps/StepFinalize';

import styles from './RegisterPage.module.scss';

const RegisterPage = () => {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] =
    useState<number>(1);

  const [formData, setFormData] =
    useState<RegisterFormData>(initialFormData);

  const [errors, setErrors] =
    useState<RegisterFormErrors>({});

  const updateFormData = (
    partial: Partial<RegisterFormData>
  ) => {
    setFormData((previous) => ({
      ...previous,
      ...partial,
    }));
  };

  const validateCurrentStep = (): boolean => {
    const newErrors: RegisterFormErrors = {};

    // ─── Step 1: Role ────────────────────────────────────────────────────

    if (currentStep === 1) {
      if (!formData.role) {
        newErrors.role =
          'Vui lòng chọn role trước khi tiếp tục.';
      }
    }

    // ─── Step 2: Identity ────────────────────────────────────────────────

    if (currentStep === 2) {
      const identityErrors: NonNullable<
        RegisterFormErrors['identity']
      > = {};

      const username =
        formData.identity.username.trim();

      const fullName =
        formData.identity.fullName.trim();

      const email =
        formData.identity.email.trim();

      if (!username) {
        identityErrors.username =
          'Vui lòng nhập username.';
      } else if (username.length < 3) {
        identityErrors.username =
          'Username phải có ít nhất 3 ký tự.';
      }

      if (!fullName) {
        identityErrors.fullName =
          'Vui lòng nhập họ và tên.';
      } else if (fullName.length < 2) {
        identityErrors.fullName =
          'Họ và tên không hợp lệ.';
      }

      if (!email) {
        identityErrors.email =
          'Vui lòng nhập email.';
      } else if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        identityErrors.email =
          'Email không đúng định dạng.';
      }

      if (
        Object.keys(identityErrors).length > 0
      ) {
        newErrors.identity = identityErrors;
      }
    }

    // ─── Step 3: Credentials ─────────────────────────────────────────────

    if (currentStep === 3) {
      const credentialErrors: NonNullable<
        RegisterFormErrors['credentials']
      > = {};

      const password =
        formData.credentials.password;

      const confirmPassword =
        formData.credentials.confirmPassword;

      if (!password) {
        credentialErrors.password =
          'Vui lòng nhập mật khẩu.';
      } else if (password.length < 8) {
        credentialErrors.password =
          'Mật khẩu phải có ít nhất 8 ký tự.';
      }

      if (!confirmPassword) {
        credentialErrors.confirmPassword =
          'Vui lòng xác nhận mật khẩu.';
      } else if (
        password !== confirmPassword
      ) {
        credentialErrors.confirmPassword =
          'Mật khẩu xác nhận không khớp.';
      }

      if (
        Object.keys(credentialErrors).length > 0
      ) {
        newErrors.credentials =
          credentialErrors;
      }
    }

    // ─── Step 4: Verification ────────────────────────────────────────────

    if (currentStep === 4) {
      // ── Owner ─────────────────────────────────────────────────────────

      if (formData.role === RegRole.Owner) {
        const ownerErrors: NonNullable<
          RegisterFormErrors['ownerVerification']
        > = {};

        const verification =
          formData.ownerVerification;

        if (!verification.phoneNumber.trim()) {
          ownerErrors.phoneNumber =
            'Vui lòng nhập số điện thoại.';
        }

        if (!verification.identityNumber.trim()) {
          ownerErrors.identityNumber =
            'Vui lòng nhập CCCD.';
        } else if (
          verification.identityNumber.length !== 12
        ) {
          ownerErrors.identityNumber =
            'CCCD phải có đúng 12 số.';
        }

        if (!verification.dateOfBirth) {
          ownerErrors.dateOfBirth =
            'Vui lòng chọn ngày sinh.';
        }

        if (
          Object.keys(ownerErrors).length > 0
        ) {
          newErrors.ownerVerification =
            ownerErrors;
        }
      }

      // ── Jockey ────────────────────────────────────────────────────────

      if (formData.role === RegRole.Jockey) {
        const jockeyErrors: NonNullable<
          RegisterFormErrors['jockeyVerification']
        > = {};

        const verification =
          formData.jockeyVerification;

        if (!verification.phoneNumber.trim()) {
          jockeyErrors.phoneNumber =
            'Vui lòng nhập số điện thoại.';
        }

        if (!verification.identityNumber.trim()) {
          jockeyErrors.identityNumber =
            'Vui lòng nhập CCCD.';
        } else if (
          verification.identityNumber.length !== 12
        ) {
          jockeyErrors.identityNumber =
            'CCCD phải có đúng 12 số.';
        }

        if (!verification.dateOfBirth) {
          jockeyErrors.dateOfBirth =
            'Vui lòng chọn ngày sinh.';
        }

        if (!verification.certificateFile) {
          jockeyErrors.certificateFile =
            'Vui lòng chọn file chứng chỉ.';
        }

        if (
          verification.experienceYears === ''
        ) {
          jockeyErrors.experienceYears =
            'Vui lòng nhập số năm kinh nghiệm.';
        } else if (
          verification.experienceYears < 0
        ) {
          jockeyErrors.experienceYears =
            'Số năm kinh nghiệm không hợp lệ.';
        }

        if (
          verification.selfDeclaredWeight === ''
        ) {
          jockeyErrors.selfDeclaredWeight =
            'Vui lòng nhập cân nặng.';
        } else if (
          verification.selfDeclaredWeight <= 0
        ) {
          jockeyErrors.selfDeclaredWeight =
            'Cân nặng phải lớn hơn 0.';
        }

        if (!verification.bloodType) {
          jockeyErrors.bloodType =
            'Vui lòng chọn nhóm máu.';
        }

        if (!verification.healthStatus) {
          jockeyErrors.healthStatus =
            'Vui lòng chọn tình trạng sức khỏe.';
        }

        if (
          Object.keys(jockeyErrors).length > 0
        ) {
          newErrors.jockeyVerification =
            jockeyErrors;
        }
      }

      // ── Referee ───────────────────────────────────────────────────────

      if (formData.role === RegRole.Referee) {
        const refereeErrors: NonNullable<
          RegisterFormErrors['refereeVerification']
        > = {};

        const verification =
          formData.refereeVerification;

        if (!verification.phoneNumber.trim()) {
          refereeErrors.phoneNumber =
            'Vui lòng nhập số điện thoại.';
        }

        if (!verification.identityNumber.trim()) {
          refereeErrors.identityNumber =
            'Vui lòng nhập CCCD.';
        } else if (
          verification.identityNumber.length !== 12
        ) {
          refereeErrors.identityNumber =
            'CCCD phải có đúng 12 số.';
        }

        if (!verification.dateOfBirth) {
          refereeErrors.dateOfBirth =
            'Vui lòng chọn ngày sinh.';
        }

        if (!verification.certificateFile) {
          refereeErrors.certificateFile =
            'Vui lòng chọn file chứng chỉ.';
        }

        if (
          Object.keys(refereeErrors).length > 0
        ) {
          newErrors.refereeVerification =
            refereeErrors;
        }
      }

      // ── Doctor ────────────────────────────────────────────────────────

      if (formData.role === RegRole.Doctor) {
        const doctorErrors: NonNullable<
          RegisterFormErrors['doctorVerification']
        > = {};

        const verification =
          formData.doctorVerification;

        if (!verification.phoneNumber.trim()) {
          doctorErrors.phoneNumber =
            'Vui lòng nhập số điện thoại.';
        }

        if (!verification.identityNumber.trim()) {
          doctorErrors.identityNumber =
            'Vui lòng nhập CCCD.';
        } else if (
          verification.identityNumber.length !== 12
        ) {
          doctorErrors.identityNumber =
            'CCCD phải có đúng 12 số.';
        }

        if (!verification.dateOfBirth) {
          doctorErrors.dateOfBirth =
            'Vui lòng chọn ngày sinh.';
        }

        if (!verification.certificateFile) {
          doctorErrors.certificateFile =
            'Vui lòng chọn file chứng chỉ.';
        }

        if (
          Object.keys(doctorErrors).length > 0
        ) {
          newErrors.doctorVerification =
            doctorErrors;
        }
      }
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (!validateCurrentStep()) {
      return;
    }

    // Spectator không cần Step 4 Verification.
    if (
      currentStep === 3 &&
      formData.role === RegRole.Spectator
    ) {
      setCurrentStep(5);
      return;
    }

    setCurrentStep((previous) =>
      Math.min(previous + 1, 6)
    );
  };

  const prevStep = () => {
    setErrors({});

    // Spectator quay lại Step 3 vì đã bỏ qua Step 4.
    if (
      currentStep === 5 &&
      formData.role === RegRole.Spectator
    ) {
      setCurrentStep(3);
      return;
    }

    setCurrentStep((previous) =>
      Math.max(previous - 1, 1)
    );
  };

  const goToStep = (step: number) => {
    setErrors({});
    setCurrentStep(step);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepRoleSelection
            selected={formData.role}
            error={errors.role}
            onSelect={(role) => {
              updateFormData({ role });

              setErrors((previous) => ({
                ...previous,
                role: undefined,
              }));
            }}
          />
        );

      case 2:
        return (
          <StepIdentity
            data={formData.identity}
            errors={errors.identity}
            onChange={(identity) => {
              updateFormData({ identity });

              setErrors((previous) => ({
                ...previous,
                identity: undefined,
              }));
            }}
          />
        );

      case 3:
        return (
          <StepCredentials
            data={formData.credentials}
            errors={errors.credentials}
            onChange={(credentials) => {
              updateFormData({ credentials });

              setErrors((previous) => ({
                ...previous,
                credentials: undefined,
              }));
            }}
          />
        );

      case 4:
        return (
          <StepVerification
            role={formData.role}
            formData={formData}
            errors={errors}
            onChange={(partial) => {
              updateFormData(partial);

              setErrors((previous) => ({
                ...previous,
                ownerVerification: undefined,
                jockeyVerification: undefined,
                refereeVerification: undefined,
                doctorVerification: undefined,
              }));
            }}
          />
        );

      case 5:
        return (
          <StepReview
            formData={formData}
            onGoToStep={goToStep}
          />
        );

      case 6:
        return (
          <StepFinalize
            role={formData.role}
            formData={formData}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.logo}>
          HRTMS
        </h1>

        <p className={styles.subtitle}>
          TOURNAMENT REGISTRATION PORTAL
        </p>
      </div>

      {/* Stepper */}
      <StepperBar
        currentStep={currentStep}
        role={formData.role}
      />

      {/* Step content */}
      <div className={styles.content}>
        {renderStep()}
      </div>

      {/* Navigation footer */}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={
            currentStep === 1
              ? () => navigate('/login')
              : prevStep
          }
        >
          {currentStep === 1
            ? '← Back to Login'
            : '← Back'}
        </button>

        {currentStep < 6 && (
          <button
            type="button"
            className={styles.nextBtn}
            onClick={nextStep}
          >
            Next Step →
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div className={styles.bottomBar}>
        <span>
          🛡 System Integrity Verified
        </span>

        <span>
          © 2024 Horse Race Tournament Management System
        </span>
      </div>
    </div>
  );
};

export default RegisterPage;