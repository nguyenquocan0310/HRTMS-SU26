import {
  type IdentityData,
  type RegisterFormErrors,
} from '../../../types/auth.types';

import styles from './StepIdentity.module.scss';

interface Props {
  data: IdentityData;
  errors?: RegisterFormErrors['identity'];
  onChange: (data: IdentityData) => void;
}

const StepIdentity = ({ data, errors, onChange }: Props) => {
  const handleChange = (
    field: keyof IdentityData,
    value: string
  ) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Identity Information</h2>

      <p className={styles.subtitle}>
        Enter your personal information to identify your account.
      </p>

      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Username</label>

          <input
            type="text"
            className={`${styles.input} ${
              errors?.username ? styles.inputError : ''
            }`}
            placeholder="Enter your username"
            value={data.username}
            onChange={(event) =>
              handleChange('username', event.target.value)
            }
          />

          {errors?.username && (
            <span className={styles.error}>
              {errors.username}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Họ và tên</label>

          <input
            type="text"
            className={`${styles.input} ${
              errors?.fullName ? styles.inputError : ''
            }`}
            placeholder="Enter your full name"
            value={data.fullName}
            onChange={(event) =>
              handleChange('fullName', event.target.value)
            }
          />

          {errors?.fullName && (
            <span className={styles.error}>
              {errors.fullName}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Email Address</label>

          <input
            type="email"
            className={`${styles.input} ${
              errors?.email ? styles.inputError : ''
            }`}
            placeholder="Enter your email"
            value={data.email}
            onChange={(event) =>
              handleChange('email', event.target.value)
            }
          />

          {errors?.email && (
            <span className={styles.error}>
              {errors.email}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StepIdentity;