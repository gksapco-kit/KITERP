import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { generateSalt, generateSessionToken, hashPassword } from '../lib/authCrypto'
import {
  clearSession,
  findUserByEmail,
  loadSession,
  loadStoredUsers,
  saveSession,
  saveStoredUsers,
} from '../lib/authPersistence'
import { normalizeEmail, validateLogin, validateSignup } from '../lib/authValidation'
import type { AuthUser, LoginInput, SignupInput, StoredUser } from '../types/auth'

const SESSION_DAYS_DEFAULT = 7
const SESSION_DAYS_REMEMBER = 30

interface AuthState {
  user: AuthUser | null
  isHydrated: boolean
  isSubmitting: boolean
  error: string | null
  hydrate: () => void
  clearError: () => void
  signup: (input: SignupInput) => Promise<boolean>
  login: (input: LoginInput) => Promise<boolean>
  logout: () => void
}

function toPublicUser(stored: StoredUser): AuthUser {
  return {
    id: stored.id,
    name: stored.name,
    email: stored.email,
    phone: stored.phone,
    createdAt: stored.createdAt,
  }
}

function sessionExpiry(rememberMe?: boolean): string {
  const days = rememberMe ? SESSION_DAYS_REMEMBER : SESSION_DAYS_DEFAULT
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

function startSession(userId: string, rememberMe?: boolean) {
  const session = {
    userId,
    token: generateSessionToken(),
    expiresAt: sessionExpiry(rememberMe),
  }
  saveSession(session)
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isHydrated: false,
  isSubmitting: false,
  error: null,

  hydrate: () => {
    const session = loadSession()
    if (!session) {
      set({ user: null, isHydrated: true })
      return
    }
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      clearSession()
      set({ user: null, isHydrated: true })
      return
    }
    const stored = loadStoredUsers().find((u) => u.id === session.userId)
    set({ user: stored ? toPublicUser(stored) : null, isHydrated: true })
  },

  clearError: () => set({ error: null }),

  signup: async (input) => {
    const validationError = validateSignup(input)
    if (validationError) {
      set({ error: validationError })
      return false
    }

    set({ isSubmitting: true, error: null })
    try {
      const email = normalizeEmail(input.email)
      if (findUserByEmail(email)) {
        set({ error: 'An account with this email already exists. Try logging in.', isSubmitting: false })
        return false
      }

      const salt = await generateSalt()
      const passwordHash = await hashPassword(input.password, salt)
      const user: StoredUser = {
        id: uuid(),
        name: input.name.trim(),
        email,
        phone: input.phone?.trim() || undefined,
        passwordHash,
        salt,
        createdAt: new Date().toISOString(),
      }

      saveStoredUsers([...loadStoredUsers(), user])
      startSession(user.id, true)
      set({ user: toPublicUser(user), isSubmitting: false, error: null })
      return true
    } catch {
      set({ error: 'Could not create account. Please try again.', isSubmitting: false })
      return false
    }
  },

  login: async (input) => {
    const validationError = validateLogin(input)
    if (validationError) {
      set({ error: validationError })
      return false
    }

    set({ isSubmitting: true, error: null })
    try {
      const email = normalizeEmail(input.email)
      const stored = findUserByEmail(email)
      if (!stored) {
        set({ error: 'No account found with this email.', isSubmitting: false })
        return false
      }

      const passwordHash = await hashPassword(input.password, stored.salt)
      if (passwordHash !== stored.passwordHash) {
        set({ error: 'Incorrect password. Please try again.', isSubmitting: false })
        return false
      }

      startSession(stored.id, input.rememberMe)
      set({ user: toPublicUser(stored), isSubmitting: false, error: null })
      return true
    } catch {
      set({ error: 'Could not sign in. Please try again.', isSubmitting: false })
      return false
    }
  },

  logout: () => {
    clearSession()
    set({ user: null, error: null })
  },
}))
