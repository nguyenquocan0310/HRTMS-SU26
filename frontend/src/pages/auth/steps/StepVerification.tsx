import { useRef } from 'react';
import { RegRole } from '../../../types/role.types';
import { type RegisterFormData, type FamilyDeclarationItem } from '../../../types/auth.types';
import styles from './StepVerification.module.scss';

interface Props {
  role: RegRole | null;
  formData: RegisterFormData;
  onChange: (partial: Partial<RegisterFormData>) => void;
}

const emptyDeclaration: FamilyDeclarationItem = {
  relatedPersonName: '',
  relationType: '',
  relatedIdentityNumber: '',
  industryRole: '',
  notes: '',
};

const StepVerification = ({ role, formData, onChange }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Khối khai báo gia đình dùng chung cho cả 4 role ───────────────────────
  const renderFamilyDeclarationBlock  = <
    K extends 'ownerVerification' | 'jockeyVerification' | 'refereeVerification' | 'doctorVerification',
  >(
    key: K,
    verification: { hasNoFamilyInIndustry: boolean; familyDeclarations: FamilyDeclarationItem[] }
  ) => {
    const updateVerification = (partial: Record<string, unknown>) => {
      onChange({ [key]: { ...verification, ...partial } } as Partial<RegisterFormData>);
    };

    return (
      <div className={styles.coiBox}>
        <h4 className={styles.coiTitle}>Family / Conflict of Interest Declaration</h4>
        <p className={styles.coiDesc}>
          Khai báo quan hệ gia đình với các thành viên khác trong ngành. Nếu không có, tick vào ô bên dưới.
        </p>

<div className={styles.field}>
          <label className={styles.label}>
            Nếu không có người thân trong ngành, nhập xác nhận bên dưới
          </label>
          <input
            type="text"
            className={styles.input}
            placeholder='Nhập: "Không có người thân làm trong ngành này"'
            value={verification.noFamilyDeclarationNote}
            onChange={(e) => updateVerification({ noFamilyDeclarationNote: e.target.value })}
          />
        </div>

        {verification.noFamilyDeclarationNote.trim().length === 0 && (
          <>
            {verification.familyDeclarations.map((decl, idx) => (
              <div key={idx} className={styles.coiItem}>
                <div className={styles.field}>
                  <label className={styles.label}>Họ tên người liên quan</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={decl.relatedPersonName}
                    onChange={(e) => {
                      const updated = [...verification.familyDeclarations];
                      updated[idx] = { ...updated[idx], relatedPersonName: e.target.value };
                      updateVerification({ familyDeclarations: updated });
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
                      const updated = [...verification.familyDeclarations];
                      updated[idx] = { ...updated[idx], relationType: e.target.value };
                      updateVerification({ familyDeclarations: updated });
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>CCCD người liên quan</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className={styles.input}
                    placeholder="Nhập đúng 12 số CCCD"
                    maxLength={12}
                    value={decl.relatedIdentityNumber}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 12);
                      const updated = [...verification.familyDeclarations];
                      updated[idx] = { ...updated[idx], relatedIdentityNumber: digitsOnly };
                      updateVerification({ familyDeclarations: updated });
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Vai trò trong ngành</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Ví dụ: Owner, Jockey, Referee, Doctor"
                    value={decl.industryRole}
                    onChange={(e) => {
                      const updated = [...verification.familyDeclarations];
                      updated[idx] = { ...updated[idx], industryRole: e.target.value };
                      updateVerification({ familyDeclarations: updated });
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
                      const updated = [...verification.familyDeclarations];
                      updated[idx] = { ...updated[idx], notes: e.target.value };
                      updateVerification({ familyDeclarations: updated });
                    }}
                  />
                </div>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => {
                    const updated = verification.familyDeclarations.filter((_, i) => i !== idx);
                    updateVerification({ familyDeclarations: updated });
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
                const updated = [...verification.familyDeclarations, { ...emptyDeclaration }];
                updateVerification({ familyDeclarations: updated });
              }}
            >
              + Thêm khai báo
            </button>
          </>
        )}
      </div>
    );
  };

  // ─── Ô upload file chứng chỉ dùng chung cho Jockey/Referee/Doctor ──────────
  const renderCertificateUpload = (
    key: 'jockeyVerification' | 'refereeVerification' | 'doctorVerification',
    file: File | null
  ) => {
    const maxSizeBytes = 10 * 1024 * 1024;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    return (
      <div className={styles.field}>
        <label className={styles.label}>Certificate File (bắt buộc)</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className={styles.input}
          onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            if (selected) {
              if (!allowedTypes.includes(selected.type)) {
                alert('Định dạng file không hợp lệ. Chỉ nhận .pdf, .jpg, .jpeg, .png, .webp');
                e.target.value = '';
                return;
              }
              if (selected.size > maxSizeBytes) {
                alert('File vượt quá dung lượng cho phép (tối đa 10MB).');
                e.target.value = '';
                return;
              }
            }
            onChange({ [key]: { ...(formData[key] as object), certificateFile: selected } } as Partial<RegisterFormData>);
          }}
        />
{file && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
            <span style={{ fontSize: '12px', color: '#4caf50' }}>
              Đã chọn: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </span>
            <button
              type="button"
              onClick={() => {
                const url = URL.createObjectURL(file);
                window.open(url, '_blank');
              }}
              style={{
                fontSize: '12px', color: '#2563eb', background: 'none',
                border: '1px solid #2563eb', borderRadius: '6px',
                padding: '2px 8px', cursor: 'pointer',
              }}
            >
              Xem file
            </button>
          </div>
        )}
      </div>
    );
  };

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
                  ownerVerification: { ...formData.ownerVerification, phoneNumber: e.target.value },
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
                  ownerVerification: { ...formData.ownerVerification, identityNumber: digitsOnly },
                });
              }}
            />
            <span style={{ fontSize: '12px', color: formData.ownerVerification.identityNumber.length === 12 ? '#4caf50' : '#999' }}>
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
                  ownerVerification: { ...formData.ownerVerification, dateOfBirth: e.target.value },
                })
              }
            />
          </div>

          {renderFamilyDeclarationBlock('ownerVerification', formData.ownerVerification)}
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
                  jockeyVerification: { ...formData.jockeyVerification, phoneNumber: e.target.value },
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
                  jockeyVerification: { ...formData.jockeyVerification, identityNumber: digitsOnly },
                });
              }}
            />
            <span style={{ fontSize: '12px', color: formData.jockeyVerification.identityNumber.length === 12 ? '#4caf50' : '#999' }}>
              {formData.jockeyVerification.identityNumber.length}/12 số
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
                  jockeyVerification: { ...formData.jockeyVerification, dateOfBirth: e.target.value },
                })
              }
            />
          </div>

          {renderCertificateUpload('jockeyVerification', formData.jockeyVerification.certificateFile)}

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

          {renderFamilyDeclarationBlock('jockeyVerification', formData.jockeyVerification)}
        </div>
      </div>
    );
  }

  // ─── Referee ──────────────────────────────────────────────────────────────
  if (role === RegRole.Referee) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Referee Verification</h2>
        <p className={styles.subtitle}>Provide your certification and declarations.</p>
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
                  refereeVerification: { ...formData.refereeVerification, phoneNumber: e.target.value },
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
                  refereeVerification: { ...formData.refereeVerification, identityNumber: digitsOnly },
                });
              }}
            />
            <span style={{ fontSize: '12px', color: formData.refereeVerification.identityNumber.length === 12 ? '#4caf50' : '#999' }}>
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
                  refereeVerification: { ...formData.refereeVerification, dateOfBirth: e.target.value },
                })
              }
            />
          </div>

          {renderCertificateUpload('refereeVerification', formData.refereeVerification.certificateFile)}

          {renderFamilyDeclarationBlock('refereeVerification', formData.refereeVerification)}
        </div>
      </div>
    );
  }

  // ─── Doctor ───────────────────────────────────────────────────────────────
  if (role === RegRole.Doctor) {
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
                  doctorVerification: { ...formData.doctorVerification, phoneNumber: e.target.value },
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
              value={formData.doctorVerification.identityNumber}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 12);
                onChange({
                  doctorVerification: { ...formData.doctorVerification, identityNumber: digitsOnly },
                });
              }}
            />
            <span style={{ fontSize: '12px', color: formData.doctorVerification.identityNumber.length === 12 ? '#4caf50' : '#999' }}>
              {formData.doctorVerification.identityNumber.length}/12 số
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
                  doctorVerification: { ...formData.doctorVerification, dateOfBirth: e.target.value },
                })
              }
            />
          </div>

          {renderCertificateUpload('doctorVerification', formData.doctorVerification.certificateFile)}

          {renderFamilyDeclarationBlock('doctorVerification', formData.doctorVerification)}
        </div>
      </div>
    );
  }

  // Spectator — không bao giờ render vì RegisterPage skip bước này
  return null;
};

export default StepVerification;