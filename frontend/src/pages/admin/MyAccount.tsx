import { useEffect, useState } from 'react';
import { FiHash, FiUser, FiMail, FiShield, FiCheckCircle } from 'react-icons/fi';
import { apiFetch } from '../../services/apiClient';
import useAuthStore from '../../store/authStore';
import styles from './MyAccount.module.scss';

interface ProfileData {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  nationalId?: string;
  certificationLevel?: string;
  medicalLicenseNumber?: string;
  experienceYears?: number;
}

const MyAccount = () => {
  const user = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ success: boolean; data: ProfileData }>('/auth/profile')
      .then((res) => setProfile(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusLabel = profile?.status ?? user?.role ?? 'Active';

  const INFO_CARDS = profile ? [
    { icon: <FiHash size={20} />, label: 'User ID', value: String(profile.userId) },
    { icon: <FiUser size={20} />, label: 'Username', value: profile.username },
    { icon: <FiUser size={20} />, label: 'Full name', value: profile.fullName },
    { icon: <FiMail size={20} />, label: 'Email', value: profile.email },
    { icon: <FiShield size={20} />, label: 'Role', value: profile.role },
    { icon: <FiCheckCircle size={20} />, label: 'Status', value: profile.status || 'Active' },
  ] : [];

  // Role-specific fields
  const roleFields: { label: string; value: string }[] = [];
  if (profile) {
    if (profile.phoneNumber) roleFields.push({ label: 'Phone', value: profile.phoneNumber });
    if (profile.dateOfBirth) roleFields.push({ label: 'Date of birth', value: new Date(profile.dateOfBirth).toLocaleDateString('vi-VN') });
    if (profile.nationalId) roleFields.push({ label: 'National ID', value: profile.nationalId });
    if (profile.certificationLevel) roleFields.push({ label: 'Certification', value: profile.certificationLevel });
    if (profile.medicalLicenseNumber) roleFields.push({ label: 'Medical license', value: profile.medicalLicenseNumber });
    if (profile.experienceYears !== undefined) roleFields.push({ label: 'Experience (years)', value: String(profile.experienceYears) });
  }

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Admin Workspace</h1>
        <p className={styles.subtext}>System operations and governance</p>
      </div>

      <div className={styles.sectionHeader}>
        <span className={styles.statusBadge}>{statusLabel}</span>
        <h2 className={styles.sectionTitle}>My Account</h2>
        <p className={styles.sectionDesc}>Profile, role and access information shared across every authenticated workspace.</p>
      </div>

      {loading ? (
        <p className={styles.loading}>Đang tải...</p>
      ) : (
        <>
          {/* Info grid */}
          <div className={styles.infoGrid}>
            {INFO_CARDS.map((card) => (
              <div key={card.label} className={styles.infoCard}>
                <span className={styles.cardIcon}>{card.icon}</span>
                <span className={styles.cardLabel}>{card.label}</span>
                <strong className={styles.cardValue}>{card.value}</strong>
              </div>
            ))}
          </div>

          {/* Role profile */}
          <div className={styles.section}>
            <h3 className={styles.sectionSubTitle}>Role profile</h3>
            <p className={styles.sectionSubDesc}>Extended fields from the backend profile endpoint for this role.</p>
            <div className={styles.roleCard}>
              {roleFields.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}><FiUser size={22} /></div>
                  <h4 className={styles.emptyTitle}>No role profile</h4>
                  <p className={styles.emptyDesc}>This role does not expose extra profile fields yet.</p>
                </div>
              ) : (
                <div className={styles.roleGrid}>
                  {roleFields.map((f) => (
                    <div key={f.label} className={styles.roleItem}>
                      <span className={styles.roleLabel}>{f.label}</span>
                      <strong className={styles.roleValue}>{f.value}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Security */}
          <div className={styles.section}>
            <h3 className={styles.sectionSubTitle}>Security and preferences</h3>
            <div className={styles.secGrid}>
              <div className={styles.secCard}>Password changes are handled by <code>/api/auth/change-password</code>.</div>
              <div className={styles.secCard}>Identity number is encrypted and not returned by API.</div>
              <div className={styles.secCard}>Notification preferences can be connected when BE exposes settings.</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MyAccount;