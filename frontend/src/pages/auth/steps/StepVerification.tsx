import { RegRole } from '../../../types/role.types';

import {
  type RegisterFormData,
  type RegisterFormErrors,
} from '../../../types/auth.types';

import styles from './StepVerification.module.scss';

interface Props {
  role: RegRole | null;
  formData: RegisterFormData;
  errors?: RegisterFormErrors;
  onChange: (partial: Partial<RegisterFormData>) => void;
}

type CertificateRoleKey =
  | 'jockeyVerification'
  | 'refereeVerification'
  | 'doctorVerification';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const BLOOD_TYPES = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  'O+',
  'O-',
];

const StepVerification = ({
  role,
  formData,
  errors,
  onChange,
}: Props) => {
  const inputClass = (error?: string) =>
    `${styles.input} ${error ? styles.inputError : ''}`;

  const renderError = (error?: string) =>
    error ? (
      <span className={styles.error}>{error}</span>
    ) : null;

  const handleCertificateChange = (
    key: CertificateRoleKey,
    file: File | null
  ) => {
    onChange({
      [key]: {
        ...formData[key],
        certificateFile: file,
      },
    } as Partial<RegisterFormData>);
  };

  const renderCertificateUpload = (
    key: CertificateRoleKey,
    file: File | null,
    error?: string
  ) => {
    return (
      <div className={styles.field}>
        <label className={styles.label}>
          Certificate File
        </label>

        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className={inputClass(error)}
          onChange={(event) => {
            const selectedFile =
              event.target.files?.[0] ?? null;

            if (!selectedFile) {
              handleCertificateChange(key, null);
              return;
            }

            if (
              !ALLOWED_FILE_TYPES.includes(
                selectedFile.type
              )
            ) {
              window.alert(
                'Định dạng file không hợp lệ. Chỉ chấp nhận PDF, JPG, JPEG, PNG hoặc WEBP.'
              );

              event.target.value = '';
              handleCertificateChange(key, null);
              return;
            }

            if (selectedFile.size > MAX_FILE_SIZE) {
              window.alert(
                'File vượt quá dung lượng cho phép. Kích thước tối đa là 10MB.'
              );

              event.target.value = '';
              handleCertificateChange(key, null);
              return;
            }

            handleCertificateChange(
              key,
              selectedFile
            );
          }}
        />

        {renderError(error)}

        {file && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              marginTop: '6px',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                color: '#16a34a',
              }}
            >
              Đã chọn: {file.name}{' '}
              ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </span>

            <button
              type="button"
              onClick={() => {
                const fileUrl =
                  URL.createObjectURL(file);

                window.open(
                  fileUrl,
                  '_blank',
                  'noopener,noreferrer'
                );

                window.setTimeout(() => {
                  URL.revokeObjectURL(fileUrl);
                }, 1000);
              }}
              style={{
                fontSize: '12px',
                color: '#2563eb',
                background: 'transparent',
                border: '1px solid #2563eb',
                borderRadius: '6px',
                padding: '3px 9px',
                cursor: 'pointer',
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
    const verification =
      formData.ownerVerification;

    const verificationErrors =
      errors?.ownerVerification;

    return (
      <div className={styles.container}>
        <h2 className={styles.title}>
          Owner Verification
        </h2>

        <p className={styles.subtitle}>
          Provide your identity details for verification.
        </p>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>
              Phone Number
            </label>

            <input
              type="tel"
              inputMode="numeric"
              className={inputClass(
                verificationErrors?.phoneNumber
              )}
              placeholder="Enter your phone number"
              value={verification.phoneNumber}
              onChange={(event) => {
                const phoneNumber =
                  event.target.value
                    .replace(/\D/g, '')
                    .slice(0, 11);

                onChange({
                  ownerVerification: {
                    ...verification,
                    phoneNumber,
                  },
                });
              }}
            />

            {renderError(
              verificationErrors?.phoneNumber
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Identity Number (CCCD)
            </label>

            <input
              type="text"
              inputMode="numeric"
              maxLength={12}
              className={inputClass(
                verificationErrors?.identityNumber
              )}
              placeholder="Nhập đúng 12 số CCCD"
              value={verification.identityNumber}
              onChange={(event) => {
                const identityNumber =
                  event.target.value
                    .replace(/\D/g, '')
                    .slice(0, 12);

                onChange({
                  ownerVerification: {
                    ...verification,
                    identityNumber,
                  },
                });
              }}
            />

            {renderError(
              verificationErrors?.identityNumber
            )}

            <span
              style={{
                fontSize: '12px',
                color:
                  verification.identityNumber
                    .length === 12
                    ? '#16a34a'
                    : '#999',
              }}
            >
              {verification.identityNumber.length}/12 số
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Date of Birth
            </label>

            <input
              type="date"
              className={inputClass(
                verificationErrors?.dateOfBirth
              )}
              value={verification.dateOfBirth}
              onChange={(event) =>
                onChange({
                  ownerVerification: {
                    ...verification,
                    dateOfBirth:
                      event.target.value,
                  },
                })
              }
            />

            {renderError(
              verificationErrors?.dateOfBirth
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Jockey ───────────────────────────────────────────────────────────────

  if (role === RegRole.Jockey) {
    const verification =
      formData.jockeyVerification;

    const verificationErrors =
      errors?.jockeyVerification;

    return (
      <div className={styles.container}>
        <h2 className={styles.title}>
          Jockey Verification
        </h2>

        <p className={styles.subtitle}>
          Provide your identity, certificate and physical information.
        </p>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>
              Phone Number
            </label>

            <input
              type="tel"
              inputMode="numeric"
              className={inputClass(
                verificationErrors?.phoneNumber
              )}
              placeholder="Enter your phone number"
              value={verification.phoneNumber}
              onChange={(event) => {
                const phoneNumber =
                  event.target.value
                    .replace(/\D/g, '')
                    .slice(0, 11);

                onChange({
                  jockeyVerification: {
                    ...verification,
                    phoneNumber,
                  },
                });
              }}
            />

            {renderError(
              verificationErrors?.phoneNumber
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Identity Number (CCCD)
            </label>

            <input
              type="text"
              inputMode="numeric"
              maxLength={12}
              className={inputClass(
                verificationErrors?.identityNumber
              )}
              placeholder="Nhập đúng 12 số CCCD"
              value={verification.identityNumber}
              onChange={(event) => {
                const identityNumber =
                  event.target.value
                    .replace(/\D/g, '')
                    .slice(0, 12);

                onChange({
                  jockeyVerification: {
                    ...verification,
                    identityNumber,
                  },
                });
              }}
            />

            {renderError(
              verificationErrors?.identityNumber
            )}

            <span
              style={{
                fontSize: '12px',
                color:
                  verification.identityNumber
                    .length === 12
                    ? '#16a34a'
                    : '#999',
              }}
            >
              {verification.identityNumber.length}/12 số
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Date of Birth
            </label>

            <input
              type="date"
              className={inputClass(
                verificationErrors?.dateOfBirth
              )}
              value={verification.dateOfBirth}
              onChange={(event) =>
                onChange({
                  jockeyVerification: {
                    ...verification,
                    dateOfBirth:
                      event.target.value,
                  },
                })
              }
            />

            {renderError(
              verificationErrors?.dateOfBirth
            )}
          </div>

          {renderCertificateUpload(
            'jockeyVerification',
            verification.certificateFile,
            verificationErrors?.certificateFile
          )}

          <div className={styles.field}>
            <label className={styles.label}>
              Experience Years
            </label>

            <input
              type="number"
              min={0}
              step={1}
              className={inputClass(
                verificationErrors?.experienceYears
              )}
              placeholder="Years of experience"
              value={verification.experienceYears}
              onChange={(event) =>
                onChange({
                  jockeyVerification: {
                    ...verification,
                    experienceYears:
                      event.target.value === ''
                        ? ''
                        : Number(
                            event.target.value
                          ),
                  },
                })
              }
            />

            {renderError(
              verificationErrors?.experienceYears
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Self Declared Weight (kg)
            </label>

            <input
              type="number"
              min={1}
              step="0.1"
              className={inputClass(
                verificationErrors?.selfDeclaredWeight
              )}
              placeholder="Your weight in kg"
              value={
                verification.selfDeclaredWeight
              }
              onChange={(event) =>
                onChange({
                  jockeyVerification: {
                    ...verification,
                    selfDeclaredWeight:
                      event.target.value === ''
                        ? ''
                        : Number(
                            event.target.value
                          ),
                  },
                })
              }
            />

            {renderError(
              verificationErrors?.selfDeclaredWeight
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Blood Type
            </label>

            <select
              className={inputClass(
                verificationErrors?.bloodType
              )}
              value={verification.bloodType}
              onChange={(event) =>
                onChange({
                  jockeyVerification: {
                    ...verification,
                    bloodType:
                      event.target.value,
                  },
                })
              }
            >
              <option value="">
                -- Select blood type --
              </option>

              {BLOOD_TYPES.map((bloodType) => (
                <option
                  key={bloodType}
                  value={bloodType}
                >
                  {bloodType}
                </option>
              ))}
            </select>

            {renderError(
              verificationErrors?.bloodType
            )}
          </div>

 <div className={styles.field}>
  <label className={styles.label}>
    Health Status
  </label>

  <select
    className={inputClass(
      verificationErrors?.healthStatus
    )}
    value={verification.healthStatus}
    onChange={(event) =>
      onChange({
        jockeyVerification: {
          ...verification,
          healthStatus: event.target.value,
        },
      })
    }
  >
    <option value="">
      -- Chọn tình trạng sức khỏe --
    </option>

    <option value="Good">
      Tốt
    </option>

    <option value="Fair">
      Trung bình
    </option>

    <option value="Under Treatment">
      Đang điều trị
    </option>
  </select>

  {renderError(
    verificationErrors?.healthStatus
  )}
</div>


        </div>
      </div>
    );
  }

  // ─── Referee ──────────────────────────────────────────────────────────────

  if (role === RegRole.Referee) {
    const verification =
      formData.refereeVerification;

    const verificationErrors =
      errors?.refereeVerification;

    return (
      <div className={styles.container}>
        <h2 className={styles.title}>
          Referee Verification
        </h2>

        <p className={styles.subtitle}>
          Provide your identity and certification information.
        </p>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>
              Phone Number
            </label>

            <input
              type="tel"
              inputMode="numeric"
              className={inputClass(
                verificationErrors?.phoneNumber
              )}
              placeholder="Enter your phone number"
              value={verification.phoneNumber}
              onChange={(event) => {
                const phoneNumber =
                  event.target.value
                    .replace(/\D/g, '')
                    .slice(0, 11);

                onChange({
                  refereeVerification: {
                    ...verification,
                    phoneNumber,
                  },
                });
              }}
            />

            {renderError(
              verificationErrors?.phoneNumber
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Identity Number (CCCD)
            </label>

            <input
              type="text"
              inputMode="numeric"
              maxLength={12}
              className={inputClass(
                verificationErrors?.identityNumber
              )}
              placeholder="Nhập đúng 12 số CCCD"
              value={verification.identityNumber}
              onChange={(event) => {
                const identityNumber =
                  event.target.value
                    .replace(/\D/g, '')
                    .slice(0, 12);

                onChange({
                  refereeVerification: {
                    ...verification,
                    identityNumber,
                  },
                });
              }}
            />

            {renderError(
              verificationErrors?.identityNumber
            )}

            <span
              style={{
                fontSize: '12px',
                color:
                  verification.identityNumber
                    .length === 12
                    ? '#16a34a'
                    : '#999',
              }}
            >
              {verification.identityNumber.length}/12 số
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Date of Birth
            </label>

            <input
              type="date"
              className={inputClass(
                verificationErrors?.dateOfBirth
              )}
              value={verification.dateOfBirth}
              onChange={(event) =>
                onChange({
                  refereeVerification: {
                    ...verification,
                    dateOfBirth:
                      event.target.value,
                  },
                })
              }
            />

            {renderError(
              verificationErrors?.dateOfBirth
            )}
          </div>

          {renderCertificateUpload(
            'refereeVerification',
            verification.certificateFile,
            verificationErrors?.certificateFile
          )}
        </div>
      </div>
    );
  }

  // ─── Doctor ───────────────────────────────────────────────────────────────

  if (role === RegRole.Doctor) {
    const verification =
      formData.doctorVerification;

    const verificationErrors =
      errors?.doctorVerification;

    return (
      <div className={styles.container}>
        <h2 className={styles.title}>
          Doctor Verification
        </h2>

        <p className={styles.subtitle}>
          Provide your identity and medical certification information.
        </p>

        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>
              Phone Number
            </label>

            <input
              type="tel"
              inputMode="numeric"
              className={inputClass(
                verificationErrors?.phoneNumber
              )}
              placeholder="Enter your phone number"
              value={verification.phoneNumber}
              onChange={(event) => {
                const phoneNumber =
                  event.target.value
                    .replace(/\D/g, '')
                    .slice(0, 11);

                onChange({
                  doctorVerification: {
                    ...verification,
                    phoneNumber,
                  },
                });
              }}
            />

            {renderError(
              verificationErrors?.phoneNumber
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Identity Number (CCCD)
            </label>

            <input
              type="text"
              inputMode="numeric"
              maxLength={12}
              className={inputClass(
                verificationErrors?.identityNumber
              )}
              placeholder="Nhập đúng 12 số CCCD"
              value={verification.identityNumber}
              onChange={(event) => {
                const identityNumber =
                  event.target.value
                    .replace(/\D/g, '')
                    .slice(0, 12);

                onChange({
                  doctorVerification: {
                    ...verification,
                    identityNumber,
                  },
                });
              }}
            />

            {renderError(
              verificationErrors?.identityNumber
            )}

            <span
              style={{
                fontSize: '12px',
                color:
                  verification.identityNumber
                    .length === 12
                    ? '#16a34a'
                    : '#999',
              }}
            >
              {verification.identityNumber.length}/12 số
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Date of Birth
            </label>

            <input
              type="date"
              className={inputClass(
                verificationErrors?.dateOfBirth
              )}
              value={verification.dateOfBirth}
              onChange={(event) =>
                onChange({
                  doctorVerification: {
                    ...verification,
                    dateOfBirth:
                      event.target.value,
                  },
                })
              }
            />

            {renderError(
              verificationErrors?.dateOfBirth
            )}
          </div>

          {renderCertificateUpload(
            'doctorVerification',
            verification.certificateFile,
            verificationErrors?.certificateFile
          )}
        </div>
      </div>
    );
  }

  // Spectator bỏ qua Step 4.
  return null;
};

export default StepVerification;