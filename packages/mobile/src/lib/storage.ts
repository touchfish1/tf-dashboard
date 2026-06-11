import { Platform } from 'react-native'

const isWeb = Platform.OS === 'web'

/**
 * Cross-platform storage:
 * - Native: expo-secure-store (hardware-backed Keychain/Keystore)
 * - Web: localStorage
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      return localStorage.getItem(key)
    }
    try {
      const { getItemAsync } = await import('expo-secure-store')
      return await getItemAsync(key)
    } catch {
      return null
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      localStorage.setItem(key, value)
      return
    }
    try {
      const { setItemAsync } = await import('expo-secure-store')
      await setItemAsync(key, value)
    } catch {
      // Silently fail - storage not available
    }
  },

  async removeItem(key: string): Promise<void> {
    if (isWeb) {
      localStorage.removeItem(key)
      return
    }
    try {
      const { deleteItemAsync } = await import('expo-secure-store')
      await deleteItemAsync(key)
    } catch {
      // Silently fail
    }
  },
}
