import { create } from 'zustand'
import { storage } from '../lib/storage'

export interface AuthUser {
  id: number
  email: string
  displayName: string
  role: 'admin' | 'viewer'
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  load: () => Promise<void>
  login: (email: string, password: string, apiUrl: string) => Promise<void>
  logout: () => Promise<void>
  setToken: (token: string | null) => Promise<void>
}

const KEYS = {
  TOKEN: 'auth_token',
  USER: 'auth_user',
} as const

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  load: async () => {
    try {
      const [token, userJson] = await Promise.all([
        storage.getItem(KEYS.TOKEN),
        storage.getItem(KEYS.USER),
      ])
      if (token && userJson) {
        set({ token, user: JSON.parse(userJson), isLoading: false })
      } else {
        set({ isLoading: false })
      }
    } catch {
      set({ isLoading: false })
    }
  },

  login: async (email: string, password: string, apiUrl: string) => {
    const baseUrl = apiUrl.replace(/\/$/, '')
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'login failed' }))
      throw new Error(err.error || '登录失败')
    }
    const data = await res.json()
    const { accessToken, user } = data
    await Promise.all([
      storage.setItem(KEYS.TOKEN, accessToken),
      storage.setItem(KEYS.USER, JSON.stringify(user)),
    ])
    set({ token: accessToken, user })
  },

  logout: async () => {
    try {
      const token = (await storage.getItem(KEYS.TOKEN)) || ''
      if (token) {
        // Dynamic import to avoid circular dependency with settings store
        const settings = await import('../store/settings')
        const url = settings.useSettings.getState().apiUrl
        if (url) {
          fetch(`${url.replace(/\/$/, '')}/api/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {})
        }
      }
    } catch {
      // Silently fail — local logout is what matters
    } finally {
      await Promise.all([
        storage.removeItem(KEYS.TOKEN),
        storage.removeItem(KEYS.USER),
      ])
      set({ user: null, token: null })
    }
  },

  setToken: async (token: string | null) => {
    if (token) {
      await storage.setItem(KEYS.TOKEN, token)
    } else {
      await storage.removeItem(KEYS.TOKEN)
    }
    set({ token })
  },
}))
