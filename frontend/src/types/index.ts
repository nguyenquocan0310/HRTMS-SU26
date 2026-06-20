// ─── Roles ────────────────────────────────────────────────────────────────────
export type Role =
  | 'Admin'
  | 'HorseOwner'
  | 'Jockey'
  | 'RaceReferee'
  | 'Doctor'
  | 'Spectator'

// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  userId: number
  username: string
  fullName: string
  email: string
  role: Role
  status: 'Active' | 'Pending' | 'Suspended'
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

export interface RegisterRequest {
  username: string
  fullName: string
  email: string
  password: string
  role: Role
}

// ─── API response wrapper ─────────────────────────────────────────────────────
export interface ApiError {
  errorCode: string
  message: string
}

export * from './jockey.types'
export * from './owner.types'
