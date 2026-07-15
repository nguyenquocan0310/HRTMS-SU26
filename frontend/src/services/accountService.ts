import { apiFetch } from './apiClient'
import type {
  ApiResponse,
  ChangePasswordPayload,
  OwnerRoleProfile,
  UpdateBasicInfoPayload,
  UserProfile,
} from '../types/account.types'

type SuccessMessageHandler = (message: string) => void

const assertSuccess = <T>(response: ApiResponse<T>, fallbackMessage: string): T => {
  if (!response.success || response.data === null) {
    throw new Error(response.message || fallbackMessage)
  }

  return response.data
}

const assertMutationSuccess = (
  response: ApiResponse<unknown>,
  fallbackMessage: string,
  onSuccess?: SuccessMessageHandler,
) => {
  if (!response.success) {
    throw new Error(response.message || fallbackMessage)
  }

  onSuccess?.(response.message || fallbackMessage)
}

export const getMyAccountProfile = async (): Promise<UserProfile<OwnerRoleProfile>> => {
  const response = await apiFetch<ApiResponse<UserProfile<OwnerRoleProfile>>>('/auth/profile')
  return assertSuccess(response, 'Không tải được thông tin tài khoản.')
}

export const updateMyBasicInfo = async (
  payload: UpdateBasicInfoPayload,
  onSuccess?: SuccessMessageHandler,
): Promise<void> => {
  const response = await apiFetch<ApiResponse<unknown>>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

  assertMutationSuccess(response, 'Cập nhật thông tin thành công.', onSuccess)
}

export const changeMyPassword = async (
  payload: ChangePasswordPayload,
  onSuccess?: SuccessMessageHandler,
): Promise<void> => {
  const response = await apiFetch<ApiResponse<unknown>>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  assertMutationSuccess(response, 'Đổi mật khẩu thành công.', onSuccess)
}
