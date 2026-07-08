import { RegRole } from '../../../types/role.types';
import { type RegisterFormData } from '../../../types/auth.types';
import styles from './StepVerification.module.scss';
import CertificateUpload from '../../../components/common/CertificateUpload';

interface Props {
  role: RegRole | null;
  formData: RegisterFormData;
  onChange: (partial: Partial<RegisterFormData>) => void;
}

const StepVerification = ({ role, formData, onChange }: Props) => {

  // ─── Owner ────────────────────────────────────────────────────────────────
  if (role === RegRole.Owner) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Owner Verification</h2>
        <p className={styles.subtitle}>Provide your identity details for verification.</p>
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Phone Number</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Enter your phone number"
              value={formData.ownerVerification.phoneNumber}
              onChange={(e) =>
                onChange({
                  ownerVerification: {
                    ...formData.ownerVerification,
                    phoneNumber: e.target.value,
                  },
                })
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Identity Number (CCCD)</label>
            <input
              type="text"
              inputMode="numeric"
              className={styles.input}
              placeholder="Nhập đúng 12 số CCCD"
              maxLength={12}
              value={formData.ownerVerification.identityNumber}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 12);
                onChange({
                  ownerVerification: {
                    ...formData.ownerVerification,
                    identityNumber: digitsOnly,
                  },
                });
              }}
            />
            <span
              style={{
                fontSize: '12px',
                color: formData.ownerVerification.identityNumber.length === 12 ? '#4caf50' : '#999',
              }}
            >
              {formData.ownerVerification.identityNumber.length}/12 số
            </span>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Date of Birth</label>
            <input
              type="date"
              className={styles.input}
              value={formData.ownerVerification.dateOfBirth}
              onChange={(e) =>
                onChange({
                  ownerVerification: {
                    ...formData.ownerVerification,
                    dateOfBirth: e.target.value,
                  },
                })
              }
            />
          </div>
        </div>
      </div>
    );
  }

  // ─── Jockey ───────────────────────────────────────────────────────────────
  if (role === RegRole.Jockey) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Jockey Verification</h2>
        <p className={styles.subtitle}>Provide your license and physical details.</p>
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Phone Number</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Enter your phone number"
              value={formData.jockeyVerification.phoneNumber}
              onChange={(e) =>
                onChange({
                  jockeyVerification: {
                    ...formData.jockeyVerification,
                    phoneNumber: e.target.value,
                  },
                })
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Identity Number (CCCD)</label>
            <input
              type="text"
              inputMode="numeric"
              className={styles.input}
              placeholder="Nhập đúng 12 số CCCD"
              maxLength={12}
              value={formData.jockeyVerification.identityNumber}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 12);
                onChange({
                  jockeyVerification: {
                    ...formData.jockeyVerification,
                    identityNumber: digitsOnly,
                  },
                });
              }}
            />
            <span
              style={{
                fontSize: '12px',
                color: formData.jockeyVerification.identityNumber.length === 12 ? '#4caf50' : '#999',
              }}
            >
              {formData.ownerVerification.identityNumber.length}/12 số
            </span>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Date of Birth</label>
            <input
              type="date"
              className={styles.input}
              value={formData.jockeyVerification.dateOfBirth}
              onChange={(e) =>
                onChange({
                  jockeyVerification: {
                    ...formData.jockeyVerification,
                    dateOfBirth: e.target.value,
                  },
                })
              }
            />
          </div>
<div className={styles.field}>
  <label className={styles.label}>License Certificate (ảnh/PDF)</label>
  <CertificateUpload
    value={formData.jockeyVerification.licenseCertificate}
    onChange={(url) =>
      onChange({
        jockeyVerification: { ...formData.jockeyVerification, licenseCertificate: url },
      })
    }
  />
</div>
          <div className={styles.field}>
            <label className={styles.label}>Experience Years</label>
            <input
              type="number"
              className={styles.input}
              placeholder="Years of experience"
              value={formData.jockeyVerification.experienceYears}
              onChange={(e) =>
                onChange({
                  jockeyVerification: {
                    ...formData.jockeyVerification,
                    experienceYears: e.target.value ? Number(e.target.value) : '',
                  },
                })
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Self Declared Weight (kg)</label>
            <input
              type="number"
              className={styles.input}
              placeholder="Your weight in kg"
              value={formData.jockeyVerification.selfDeclaredWeight}
              onChange={(e) =>
                onChange({
                  jockeyVerification: {
                    ...formData.jockeyVerification,
                    selfDeclaredWeight: e.target.value ? Number(e.target.value) : '',
                  },
                })
              }
            />
          </div>

          {/* Family / Conflict of Interest Declaration */}
          <div className={styles.coiBox}>
            <h4 className={styles.coiTitle}>Family / Conflict of Interest Declaration</h4>
            <p className={styles.coiDesc}>
              Khai báo quan hệ gia đình với các thành viên khác trong ngành (nếu có).
            </p>

            {formData.jockeyVerification.familyDeclarations.map((decl, idx) => (
              <div key={idx} className={styles.coiItem}>
                <div className={styles.field}>
                  <label className={styles.label}>Họ tên người liên quan</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={decl.relatedPersonName}
                    onChange={(e) => {
                      const updated = [...formData.jockeyVerification.familyDeclarations];
                      updated[idx] = { ...updated[idx], relatedPersonName: e.target.value };
                      onChange({ jockeyVerification: { ...formData.jockeyVerification, familyDeclarations: updated } });
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Quan hệ</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Ví dụ: Parent, Sibling, Spouse"
                    value={decl.relationType}
                    onChange={(e) => {
                      const updated = [...formData.jockeyVerification.familyDeclarations];
                      updated[idx] = { ...updated[idx], relationType: e.target.value };
                      onChange({ jockeyVerification: { ...formData.jockeyVerification, familyDeclarations: updated } });
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>CCCD người liên quan</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Nhập đúng 12 số CCCD"
                    maxLength={12}
                    value={decl.relatedIdentityNumber}
                    onChange={(e) => {
                      const updated = [...formData.jockeyVerification.familyDeclarations];
                      updated[idx] = { ...updated[idx], relatedIdentityNumber: e.target.value };
                      onChange({ jockeyVerification: { ...formData.jockeyVerification, familyDeclarations: updated } });
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Vai trò trong ngành</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Ví dụ: Owner, Referee, Doctor"
                    value={decl.industryRole}
                    onChange={(e) => {
                      const updated = [...formData.jockeyVerification.familyDeclarations];
                      updated[idx] = { ...updated[idx], industryRole: e.target.value };
                      onChange({ jockeyVerification: { ...formData.jockeyVerification, familyDeclarations: updated } });
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Ghi chú</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={decl.notes}
                    onChange={(e) => {
                      const updated = [...formData.jockeyVerification.familyDeclarations];
                      updated[idx] = { ...updated[idx], notes: e.target.value };
                      onChange({ jockeyVerification: { ...formData.jockeyVerification, familyDeclarations: updated } });
                    }}
                  />
                </div>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => {
                    const updated = formData.jockeyVerification.familyDeclarations.filter((_, i) => i !== idx);
                    onChange({ jockeyVerification: { ...formData.jockeyVerification, familyDeclarations: updated } });
                  }}
                >
                  Xóa khai báo này
                </button>
              </div>
            ))}

            <button
              type="button"
              className={styles.addBtn}
              onClick={() => {
                const updated = [
                  ...formData.jockeyVerification.familyDeclarations,
                  { relatedPersonName: '', relationType: '', relatedIdentityNumber: '', industryRole: '', notes: '' },
                ];
                onChange({ jockeyVerification: { ...formData.jockeyVerification, familyDeclarations: updated } });
              }}
            >
              + Thêm khai báo
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ─── Referee ──────────────────────────────────────────────────────────────
  if (role === RegRole.Referee) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Referee Verification</h2>
        <p className={styles.subtitle}>Provide your certification level and declarations.</p>
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Phone Number</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Enter your phone number"
              value={formData.refereeVerification.phoneNumber}
              onChange={(e) =>
                onChange({
                  refereeVerification: {
                    ...formData.refereeVerification,
                    phoneNumber: e.target.value,
                  },
                })
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Identity Number (CCCD)</label>
            <input
              type="text"
              inputMode="numeric"
              className={styles.input}
              placeholder="Nhập đúng 12 số CCCD"
              maxLength={12}
              value={formData.refereeVerification.identityNumber}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 12);
                onChange({
                  refereeVerification: {
                    ...formData.refereeVerification,
                    identityNumber: digitsOnly,
                  },
                });
              }}
            />
            <span
              style={{
                fontSize: '12px',
                color: formData.refereeVerification.identityNumber.length === 12 ? '#4caf50' : '#999',
              }}
            >
              {formData.refereeVerification.identityNumber.length}/12 số
            </span>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Date of Birth</label>
            <input
              type="date"
              className={styles.input}
              value={formData.refereeVerification.dateOfBirth}
              onChange={(e) =>
                onChange({
                  refereeVerification: {
                    ...formData.refereeVerification,
                    dateOfBirth: e.target.value,
                  },
                })
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Certification Level</label>
            <select
              className={styles.input}
              value={formData.refereeVerification.certificationLevel}
              onChange={(e) =>
                onChange({
                  refereeVerification: {
                    ...formData.refereeVerification,
                    certificationLevel: e.target.value as 'Level1' | 'Level2' | 'Level3',
                  },
                })
              }
            >
              <option value="">-- Select Level --</option>
              <option value="Level1">Cấp 1</option>
              <option value="Level2">Cấp 2</option>
              <option value="Level3">Cấp 3</option>
            </select>
          </div>

          {/* Family / Conflict of Interest Declaration */}
          <div className={styles.coiBox}>
            <h4 className={styles.coiTitle}>
              Family / Conflict of Interest Declaration
            </h4>
            <p className={styles.coiDesc}>
              Khai báo quan hệ gia đình với các thành viên khác trong ngành (nếu có).
              Nếu không có, để trống danh sách bên dưới.
            </p>

            {formData.refereeVerification.familyDeclarations.map((decl, idx) => (
              <div key={idx} className={styles.coiItem}>
                <div className={styles.field}>
                  <label className={styles.label}>Họ tên người liên quan</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={decl.relatedPersonName}
                    onChange={(e) => {
                      const updated = [...formData.refereeVerification.familyDeclarations];
                      updated[idx] = { ...updated[idx], relatedPersonName: e.target.value };
                      onChange({ refereeVerification: { ...formData.refereeVerification, familyDeclarations: updated } });
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Quan hệ</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Ví dụ: Parent, Sibling, Spouse"
                    value={decl.relationType}
                    onChange={(e) => {
                      const updated = [...formData.refereeVerification.familyDeclarations];
                      updated[idx] = { ...updated[idx], relationType: e.target.value };
                      onChange({ refereeVerification: { ...formData.refereeVerification, familyDeclarations: updated } });
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>CCCD người liên quan</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Nhập đúng 12 số CCCD"
                    maxLength={12}
                    value={decl.relatedIdentityNumber}
                    onChange={(e) => {
                      const updated = [...formData.refereeVerification.familyDeclarations];
                      updated[idx] = { ...updated[idx], relatedIdentityNumber: e.target.value };
                      onChange({ refereeVerification: { ...formData.refereeVerification, familyDeclarations: updated } });
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Vai trò trong ngành</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Ví dụ: Owner, Jockey, Doctor"
                    value={decl.industryRole}
                    onChange={(e) => {
                      const updated = [...formData.refereeVerification.familyDeclarations];
                      updated[idx] = { ...updated[idx], industryRole: e.target.value };
                      onChange({ refereeVerification: { ...formData.refereeVerification, familyDeclarations: updated } });
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Ghi chú</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={decl.notes}
                    onChange={(e) => {
                      const updated = [...formData.refereeVerification.familyDeclarations];
                      updated[idx] = { ...updated[idx], notes: e.target.value };
                      onChange({ refereeVerification: { ...formData.refereeVerification, familyDeclarations: updated } });
                    }}
                  />
                </div>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => {
                    const updated = formData.refereeVerification.familyDeclarations.filter((_, i) => i !== idx);
                    onChange({ refereeVerification: { ...formData.refereeVerification, familyDeclarations: updated } });
                  }}
                >
                  Xóa khai báo này
                </button>
              </div>
            ))}

            <button
              type="button"
              className={styles.addBtn}
              onClick={() => {
                const updated = [
                  ...formData.refereeVerification.familyDeclarations,
                  { relatedPersonName: '', relationType: '', relatedIdentityNumber: '', industryRole: '', notes: '' },
                ];
                onChange({ refereeVerification: { ...formData.refereeVerification, familyDeclarations: updated } });
              }}
            >
              + Thêm khai báo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Doctor ───────────────────────────────────────────────────────────────
  if (role === RegRole.Doctor) {
    // Doctor sẽ khai báo gia đình (COI) sau, tại Doctor Dashboard UI-S30, không phải lúc Register
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Doctor Verification</h2>
        <p className={styles.subtitle}>Provide your identity and medical license details.</p>
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Phone Number</label>
            <input
              type="text"
              className={styles.input}
              placeholder="Enter your phone number"
              value={formData.doctorVerification.phoneNumber}
              onChange={(e) =>
                onChange({
                  doctorVerification: {
                    ...formData.doctorVerification,
                    phoneNumber: e.target.value,
                  },
                })
              }
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Identity Number (CCCD)</label>
            <input
              type="text"
              inputMode="numeric"
              className={styles.input}
              placeholder="Nhập đúng 12 số CCCD"
              maxLength={12}
              value={formData.refereeVerification.identityNumber}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 12);
                onChange({
                  refereeVerification: {
                    ...formData.refereeVerification,
                    identityNumber: digitsOnly,
                  },
                });
              }}
            />
            <span
              style={{
                fontSize: '12px',
                color: formData.refereeVerification.identityNumber.length === 12 ? '#4caf50' : '#999',
              }}
            >
              {formData.refereeVerification.identityNumber.length}/12 số
            </span>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Date of Birth</label>
            <input
              type="date"
              className={styles.input}
              value={formData.doctorVerification.dateOfBirth}
              onChange={(e) =>
                onChange({
                  doctorVerification: {
                    ...formData.doctorVerification,
                    dateOfBirth: e.target.value,
                  },
                })
              }
            />
          </div>
<div className={styles.field}>
  <label className={styles.label}>Medical License Certificate (ảnh/PDF)</label>
  <CertificateUpload
    value={formData.doctorVerification.medicalLicenseNumber}
    onChange={(url) =>
      onChange({
        doctorVerification: { ...formData.doctorVerification, medicalLicenseNumber: url },
      })
    }
  />
</div>
        </div>
      </div>
    );
  }

  // Spectator — không bao giờ render vì RegisterPage skip bước này
  return null;
};

export default StepVerification;