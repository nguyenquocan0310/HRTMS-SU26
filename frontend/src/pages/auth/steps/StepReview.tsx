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

  // STEP 1
  items.push({
    label: 'Role',
    value: formData.role ?? '—',
    step: 1,
  });

  // STEP 2
  items.push({
    label: 'Username',
    value: formData.identity.username || '—',
    step: 2,
  });

  items.push({
    label: 'Full Name',
    value: formData.identity.fullName || '—',
    step: 2,
  });

  items.push({
    label: 'Email',
    value: formData.identity.email || '—',
    step: 2,
  });

  // STEP 3
  items.push({
    label: 'Password',
    value: formData.credentials.password ? '••••••••' : '—',
    step: 3,
  });

  // OWNER
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

    items.push({
      label: 'Date of Birth',
      value: formData.ownerVerification.dateOfBirth || '—',
      step: 4,
    });
  }

  // JOCKEY
  if (formData.role === RegRole.Jockey) {
    items.push({
      label: 'Phone Number',
      value: formData.jockeyVerification.phoneNumber || '—',
      step: 4,
    });

    items.push({
      label: 'Identity Number',
      value: formData.jockeyVerification.identityNumber || '—',
      step: 4,
    });

    items.push({
      label: 'Date of Birth',
      value: formData.jockeyVerification.dateOfBirth || '—',
      step: 4,
    });

    items.push({
      label: 'Experience Years',
      value:
        formData.jockeyVerification.experienceYears === ''
          ? '—'
          : String(formData.jockeyVerification.experienceYears),
      step: 4,
    });

    items.push({
      label: 'Weight',
      value:
        formData.jockeyVerification.selfDeclaredWeight === ''
          ? '—'
          : `${formData.jockeyVerification.selfDeclaredWeight} kg`,
      step: 4,
    });

    items.push({
      label: 'Blood Type',
      value: formData.jockeyVerification.bloodType || '—',
      step: 4,
    });

    items.push({
      label: 'Health Status',
      value: formData.jockeyVerification.healthStatus || '—',
      step: 4,
    });

    items.push({
      label: 'Certificate',
      value:
        formData.jockeyVerification.certificateFile?.name ??
        'Not uploaded',
      step: 4,
    });
  }

  // REFEREE
  if (formData.role === RegRole.Referee) {
    items.push({
      label: 'Phone Number',
      value: formData.refereeVerification.phoneNumber || '—',
      step: 4,
    });

    items.push({
      label: 'Identity Number',
      value: formData.refereeVerification.identityNumber || '—',
      step: 4,
    });

    items.push({
      label: 'Date of Birth',
      value: formData.refereeVerification.dateOfBirth || '—',
      step: 4,
    });

    items.push({
      label: 'Certificate',
      value:
        formData.refereeVerification.certificateFile?.name ??
        'Not uploaded',
      step: 4,
    });
  }

  // DOCTOR
  if (formData.role === RegRole.Doctor) {
    items.push({
      label: 'Phone Number',
      value: formData.doctorVerification.phoneNumber || '—',
      step: 4,
    });

    items.push({
      label: 'Identity Number',
      value: formData.doctorVerification.identityNumber || '—',
      step: 4,
    });

    items.push({
      label: 'Date of Birth',
      value: formData.doctorVerification.dateOfBirth || '—',
      step: 4,
    });

    items.push({
      label: 'Certificate',
      value:
        formData.doctorVerification.certificateFile?.name ??
        'Not uploaded',
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
          <div
            key={`${item.label}-${index}`}
            className={styles.row}
          >
            <span className={styles.label}>{item.label}</span>

            <span className={styles.value}>{item.value}</span>

            <button
              type="button"
              className={styles.editBtn}
              onClick={() => onGoToStep(item.step)}
            >
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StepReview;