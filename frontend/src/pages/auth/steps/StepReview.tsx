import { type RegisterFormData } from '../../../types/auth.types';
import { RegRole } from '../../../types/role.types';
import styles from './StepReview.module.scss';

interface Props {
  formData: RegisterFormData;
  onGoToStep: (step: number) => void;
}

interface ReviewItem {
  label: string;
  value: string;
  step: number;
}

const StepReview = ({ formData, onGoToStep }: Props) => {
  const items: ReviewItem[] = [];

  items.push({
    label: 'Role',
    value: formData.role ?? '—',
    step: 1,
  });

  items.push({
    label: 'Username',
    value: formData.identity.username || '—',
    step: 2,
  });

  items.push({
    label: 'Email',
    value: formData.identity.email || '—',
    step: 2,
  });

  items.push({
    label: 'Password',
    value: formData.credentials.password ? '••••••••' : '—',
    step: 3,
  });

  if (formData.role === RegRole.Owner) {
    items.push({
      label: 'Phone Number',
      value: formData.ownerVerification.phoneNumber || '—',
      step: 4,
    });

    items.push({
      label: 'Identity Number',
      value: formData.ownerVerification.identityNumber || '—',
      step: 4,
    });
  }

  if (formData.role === RegRole.Jockey) {
    items.push({
      label: 'License Certificate',
      value: formData.jockeyVerification.licenseCertificate || '—',
      step: 4,
    });

    items.push({
      label: 'Experience Years',
      value:
        formData.jockeyVerification.experienceYears !== ''
          ? String(formData.jockeyVerification.experienceYears)
          : '—',
      step: 4,
    });

    items.push({
      label: 'Self Declared Weight',
      value:
        formData.jockeyVerification.selfDeclaredWeight !== ''
          ? `${formData.jockeyVerification.selfDeclaredWeight} kg`
          : '—',
      step: 4,
    });

    items.push({
      label: 'Blood Type',
      value: formData.jockeyVerification.bloodType || '—',
      step: 4,
    });
  }

  if (formData.role === RegRole.Referee) {
    items.push({
      label: 'Certification Level',
      value: formData.refereeVerification.certificationLevel || '—',
      step: 4,
    });
  }

  if (formData.role === RegRole.Doctor) {
    items.push({
      label: 'Medical License Number',
      value: formData.doctorVerification.medicalLicenseNumber || '—',
      step: 4,
    });
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Review Your Information</h2>

      <p className={styles.subtitle}>
        Please review all your details before submitting.
      </p>

      <div className={styles.card}>
        {items.map((item, index) => (
          <div key={`${item.label}-${index}`} className={styles.row}>
            <span className={styles.label}>{item.label}</span>
            <span className={styles.value}>{item.value}</span>

            <button
              type="button"
              className={styles.editBtn}
              onClick={() => onGoToStep(item.step)}
            >
              Sửa
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StepReview;