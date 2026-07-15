import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegRole } from '../../types/role.types';
import { type RegisterFormData, initialFormData } from '../../types/auth.types';
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
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [formData, setFormData] = useState<RegisterFormData>(initialFormData);
  const [roleError, setRoleError] = useState<string>('');


  const updateFormData = (partial: Partial<RegisterFormData>) => {
    setFormData(prev => ({ ...prev, ...partial }));
  };

const nextStep = () => {
  if (currentStep === 1 && !formData.role) {
    setRoleError('Vui lòng chọn role trước khi tiếp tục');
    return;
  }
  setRoleError('');
  // Spectator skip bước 4
  if (currentStep === 3 && formData.role === RegRole.Spectator) {
    setCurrentStep(5);
    return;
  }
  setCurrentStep(prev => Math.min(prev + 1, 6));
};

  const prevStep = () => {
    // Spectator skip bước 4 khi back
    if (currentStep === 5 && formData.role === RegRole.Spectator) {
      setCurrentStep(3);
      return;
    }
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const goToStep = (step: number) => setCurrentStep(step);

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepRoleSelection
            selected={formData.role}
            onSelect={(role) => {
              updateFormData({ role });
              setRoleError('');
            }}
            error={roleError}
          />
        );
      case 2:
        return (
          <StepIdentity
            data={formData.identity}
            onChange={(identity) => updateFormData({ identity })}
          />
        );
      case 3:
        return (
          <StepCredentials
            data={formData.credentials}
            onChange={(credentials) => updateFormData({ credentials })}
          />
        );
      case 4:
        return (
          <StepVerification
            role={formData.role}
            formData={formData}
            onChange={updateFormData}
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
        <h1 className={styles.logo}>HRTMS</h1>
        <p className={styles.subtitle}>TOURNAMENT REGISTRATION PORTAL</p>
      </div>

      {/* Stepper */}
      <StepperBar currentStep={currentStep} role={formData.role} />

      {/* Nội dung bước */}
      <div className={styles.content}>
        {renderStep()}
      </div>

      {/* Footer điều hướng */}
      <div className={styles.footer}>
        <button
          className={styles.backBtn}
          onClick={currentStep === 1 ? () => navigate('/login') : prevStep}
        >
          {currentStep === 1 ? '← Back to Login' : '← Back'}
        </button>

        {currentStep < 6 && (
          <button className={styles.nextBtn} onClick={nextStep}>
            Next Step →
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div className={styles.bottomBar}>
        <span>🛡 System Integrity Verified</span>
        <span>© 2024 Horse Race Tournament Management System</span>
      </div>
    </div>
  );
};

export default RegisterPage;
