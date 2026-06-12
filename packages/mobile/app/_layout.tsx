import './global.css'
import { useEffect, useState } from 'react'
import { Stack, usePathname, useSegments, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { View, ActivityIndicator, Text } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import { configureApi } from '@tf-dashboard/shared/api/client'
import { api } from '@tf-dashboard/shared/api/client'
import { useSettings } from '../src/store/settings'
import { useAuth } from '../src/store/auth'
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

/** Redirects unauthenticated users to /login and authenticated users away from it. */
function useAuthGuard() {
  const { token, isLoading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === 'login'

    if (!token && !inAuthGroup) {
      router.replace('/login')
    } else if (token && inAuthGroup) {
      router.replace('/')
    }
  }, [token, isLoading, segments])
}

export default function RootLayout() {
  const pathname = usePathname()
  const { apiUrl, apiKey, loaded: settingsLoaded, load: loadSettings } = useSettings()
  const { isLoading: authLoading, load: loadAuth } = useAuth()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([loadSettings(), loadAuth()]).then(() => setReady(true))
  }, [])

  useEffect(() => {
    if (!settingsLoaded) return
    configureApi({
      baseURL: `${apiUrl}/api`,
      apiKeyProvider: async () => apiKey || null,
      tokenProvider: async () => useAuth.getState().token || null,
    })
  }, [apiUrl, apiKey, settingsLoaded])

  useEffect(() => {
    if (ready) SplashScreen.hideAsync()
  }, [ready])

  useAuthGuard()

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
    const reqId = api.interceptors.request.use((config) => {
      config.headers.set('X-Start-Time', Date.now())
      return config
    })
    return () => {
      api.interceptors.response.eject(id)
      api.interceptors.request.eject(reqId)
    }
  }, [])

  // Show loading screen while auth is loading
  if (!ready || (authLoading && !useAuth.getState().token)) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 bg-zinc-950 items-center justify-center">
          <ActivityIndicator size="large" color="#10b981" />
          <Text className="text-zinc-500 text-sm mt-3">加载中...</Text>
        </View>
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="servers/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
