import { create } from 'zustand'
import { storage } from '../lib/storage'

const KEYS = {
  API_URL: 'api_url',
  API_KEY: 'api_key',
  DEEPSEEK_KEY: 'deepseek_key',
} as const

interface SettingsState {
  apiUrl: string
  apiKey: string
  deepseekKey: string
  loaded: boolean
  load: () => Promise<void>
  setApiUrl: (url: string) => Promise<void>
  setApiKey: (key: string) => Promise<void>
  setDeepseekKey: (key: string) => Promise<void>
}

export const useSettings = create<SettingsState>((set) => ({
  apiUrl: '',
  apiKey: '',
  deepseekKey: '',
  loaded: false,

  load: async () => {
    try {
      const [apiUrl, apiKey, deepseekKey] = await Promise.all([
        storage.getItem(KEYS.API_URL),
        storage.getItem(KEYS.API_KEY),
        storage.getItem(KEYS.DEEPSEEK_KEY),
      ])
      set({
        apiUrl: apiUrl ?? '',
        apiKey: apiKey ?? '',
        deepseekKey: deepseekKey ?? '',
        loaded: true,
      })
    } catch {
      set({ loaded: true })
    }
  },

  setApiUrl: async (url: string) => {
    await storage.setItem(KEYS.API_URL, url)
    set({ apiUrl: url })
  },

  setApiKey: async (key: string) => {
    await storage.setItem(KEYS.API_KEY, key)
    set({ apiKey: key })
  },

  setDeepseekKey: async (key: string) => {
    await storage.setItem(KEYS.DEEPSEEK_KEY, key)
    set({ deepseekKey: key })
  },
}))
