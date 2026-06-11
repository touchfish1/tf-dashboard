import './global.css'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import { configureApi } from '@tf-dashboard/shared/api/client'
import { useSettings } from '../src/store/settings'

const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || ''
configureApi({ baseURL: `${DEFAULT_API_URL}/api` })

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

export default function RootLayout() {
  const { apiUrl, apiKey, loaded, load } = useSettings()

  // Load persisted settings on first mount
  useEffect(() => {
    load()
  }, [])

  // Re-configure API client whenever settings change
  useEffect(() => {
    if (!loaded) return
    configureApi({
      baseURL: `${apiUrl}/api`,
      apiKeyProvider: async () => apiKey || null,
    })
  }, [apiUrl, apiKey, loaded])

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync()
  }, [loaded])

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="servers/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
