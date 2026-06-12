import api from '../utils/axios'
import type { LoginRequest, LoginResponse, RegisterRequest } from '../types'

export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const res = await api.post<LoginResponse>('/auth/login', data)
  return res.data
}

export const register = async (data: RegisterRequest): Promise<{ userId: number; message: string }> => {
  const res = await api.post('/auth/register', data)
  return res.data
}
