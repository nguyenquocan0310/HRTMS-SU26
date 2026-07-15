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

export interface UpdateBasicInfoPayload {
  fullName: string
  email: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}
