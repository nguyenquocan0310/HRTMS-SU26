import {
  type CredentialsData,
  type RegisterFormErrors,
} from '../../../types/auth.types';

import styles from './StepCredentials.module.scss';

interface Props {
  data: CredentialsData;
  errors?: RegisterFormErrors['credentials'];
  onChange: (data: CredentialsData) => void;
}

const StepCredentials = ({
  data,
  errors,
  onChange,
}: Props) => {
  const handleChange = (
    field: keyof CredentialsData,
    value: string
  ) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Set Your Credentials</h2>

      <p className={styles.subtitle}>
        Create a strong password to secure your account.
      </p>

      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Password</label>

          <input
            type="password"
            className={`${styles.input} ${
              errors?.password ? styles.inputError : ''
            }`}
            placeholder="Enter your password"
            value={data.password}
            onChange={(event) =>
              handleChange('password', event.target.value)
            }
          />

          {errors?.password && (
            <span className={styles.error}>
              {errors.password}
            </span>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Confirm Password
          </label>

          <input
            type="password"
            className={`${styles.input} ${
              errors?.confirmPassword
                ? styles.inputError
                : ''
            }`}
            placeholder="Re-enter your password"
            value={data.confirmPassword}
            onChange={(event) =>
              handleChange(
                'confirmPassword',
                event.target.value
              )
            }
          />

          {errors?.confirmPassword && (
            <span className={styles.error}>
              {errors.confirmPassword}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StepCredentials;