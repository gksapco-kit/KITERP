export interface AuthUser {
  id: string
  name: string
  email: string
  phone?: string
  createdAt: string
}

export interface StoredUser extends AuthUser {
  passwordHash: string
  salt: string
}

export interface AuthSession {
  userId: string
  token: string
  expiresAt: string
}

export interface SignupInput {
  name: string
  email: string
  password: string
  confirmPassword: string
  phone?: string
}

export interface LoginInput {
  email: string
  password: string
  rememberMe?: boolean
}
