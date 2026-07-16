export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T | null
}

export interface UserProfile<TProfile> {
  userId: number
  username: string
  fullName: string
  email: string
  role: string
  status: string
  profile: TProfile | null
}

export interface OwnerRoleProfile {
  phoneNumber: string | null
  hasIdentity: boolean
}

export interface CertificateMetadata {
  certificateId: number
  fileName: string
  contentType: string | null
  fileSizeBytes: number
  uploadedAt: string
  downloadUrl: string
}

export interface JockeyRoleProfile {
  licenseCertificate: string
  experienceYears: number
  selfDeclaredWeight: number
  bloodType: string | null
  healthStatus: string | null
  status: string
  certificate: CertificateMetadata | null
}

export interface DoctorRoleProfile {
  medicalLicenseNumber: string
  status: string
  certificate: CertificateMetadata | null
}

export interface RefereeRoleProfile {
  certificationLevel: string
  status: string
  certificate: CertificateMetadata | null
}

export interface UpdateBasicInfoPayload {
  fullName: string
  email: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}
