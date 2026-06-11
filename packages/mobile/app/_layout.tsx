import './global.css'
import { useEffect } from 'react'
import { Stack, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import { configureApi } from '@tf-dashboard/shared/api/client'
import { api } from '@tf-dashboard/shared/api/client'
import { useSettings } from '../src/store/settings'
import { trackPageView, trackApiCall, startTracking, stopTracking } from '../src/lib/tracking'

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
  const pathname = usePathname()
  const { apiUrl, apiKey, loaded, load } = useSettings()

  useEffect(() => { load() }, [])

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

  // ─── Tracking ──────────────────────────────────────
  useEffect(() => {
    startTracking()
    return () => stopTracking()
  }, [])

  // Page view on route change
  useEffect(() => {
    trackPageView(pathname)
  }, [pathname])

  // API call tracking interceptor
  useEffect(() => {
    const id = api.interceptors.response.use(
      (res) => {
        const ms = res.config?.headers?.['X-Start-Time']
          ? Date.now() - Number(res.config.headers['X-Start-Time'])
          : 0
        trackApiCall(res.config.url || '', ms, res.status, res.config.method?.toUpperCase())
        return res
      },
      (err) => {
        const ms = err.config?.headers?.['X-Start-Time']
          ? Date.now() - Number(err.config.headers['X-Start-Time'])
          : 0
        trackApiCall(err.config?.url || '', ms, err.response?.status || 0, err.config?.method?.toUpperCase())
        return Promise.reject(err)
      },
    )
    // Also track request start time
    const reqId = api.interceptors.request.use((config) => {
      config.headers.set('X-Start-Time', Date.now())
      return config
    })
    return () => {
      api.interceptors.response.eject(id)
      api.interceptors.request.eject(reqId)
    }
  }, [])

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
