import { useState } from 'react';
import { type CredentialsData } from '../../../types/auth.types';
import styles from './StepCredentials.module.scss';

interface Props {
  data: CredentialsData;
  onChange: (data: CredentialsData) => void;
}

const StepCredentials = ({ data, onChange }: Props) => {
  const [error, setError] = useState<string>('');

  const handleChange = (field: keyof CredentialsData, value: string) => {
    const updated = { ...data, [field]: value };
    onChange(updated);

    // Validate realtime
    if (field === 'confirmPassword' || field === 'password') {
      const pass = field === 'password' ? value : data.password;
      const confirm = field === 'confirmPassword' ? value : data.confirmPassword;
      if (confirm && pass !== confirm) {
        setError('Passwords do not match.');
      } else {
        setError('');
      }
    }
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
            className={styles.input}
            placeholder="Enter your password"
            value={data.password}
            onChange={(e) => handleChange('password', e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Confirm Password</label>
          <input
            type="password"
            className={`${styles.input} ${error ? styles.inputError : ''}`}
            placeholder="Re-enter your password"
            value={data.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
          />
          {error && <span className={styles.error}>{error}</span>}
        </div>
      </div>
    </div>
  );
};

export default StepCredentials;