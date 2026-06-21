import { type IdentityData } from '../../../types/auth.types';
import styles from './StepIdentity.module.scss';

interface Props {
  data: IdentityData;
  onChange: (data: IdentityData) => void;
}

const StepIdentity = ({ data, onChange }: Props) => {
  const handleChange = (field: keyof IdentityData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Identity Information</h2>
      <p className={styles.subtitle}>
        Enter your username and email address to identify your account.
      </p>

      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Username</label>
          <input
            type="text"
            className={styles.input}
            placeholder="Enter your username"
            value={data.username}
            onChange={(e) => handleChange('username', e.target.value)}
          />
        </div>

        <div className={styles.field}>
  <label className={styles.label}>Họ và Tên</label>
  <input
    type="text"
    className={styles.input}
    placeholder="Enter your full name"
    value={data.fullName}
    onChange={(e) => handleChange('fullName', e.target.value)}
  />
</div>

        <div className={styles.field}>
          <label className={styles.label}>Email Address</label>
          <input
            type="email"
            className={styles.input}
            placeholder="Enter your email"
            value={data.email}
            onChange={(e) => handleChange('email', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default StepIdentity;