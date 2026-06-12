import { useState, useRef } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../src/store/auth'
import { useSettings } from '../src/store/settings'

export default function LoginScreen() {
  const { login } = useAuth()
  const { apiUrl } = useSettings()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordRef = useRef<TextInput>(null)

  const handleLogin = async () => {
    if (!email.trim()) {
      setError('请输入邮箱地址')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }
    setLoading(true)
    setError('')
    try {
      await login(email.trim(), password, apiUrl)
      router.replace('/')
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 justify-center px-6">
            {/* Logo / Title */}
            <View className="items-center mb-10">
              <View className="w-14 h-14 rounded-2xl bg-accent items-center justify-center mb-4">
                <Ionicons name="grid" size={28} color="#ffffff" />
              </View>
              <Text className="text-2xl font-bold text-zinc-100 tracking-tight">
                tf-dashboard
              </Text>
              <Text className="text-sm text-zinc-500 mt-1">
                登录以访问仪表盘
              </Text>
            </View>

            {/* Form */}
            <View className="gap-4">
              {/* Email */}
              <View className="gap-1.5">
                <Text className="text-xs font-medium text-zinc-400 ml-1">邮箱</Text>
                <TextInput
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-base text-zinc-100"
                  placeholder="admin@example.com"
                  placeholderTextColor="#52525b"
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError('') }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              {/* Password */}
              <View className="gap-1.5">
                <Text className="text-xs font-medium text-zinc-400 ml-1">密码</Text>
                <TextInput
                  ref={passwordRef}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-base text-zinc-100"
                  placeholder="输入密码"
                  placeholderTextColor="#52525b"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setError('') }}
                  secureTextEntry
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
              </View>

              {/* Error */}
              {error ? (
                <View className="flex-row items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <Ionicons name="alert-circle" size={16} color="#ef4444" />
                  <Text className="text-sm text-red-400 flex-1">{error}</Text>
                </View>
              ) : null}

              {/* Login Button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
                className="bg-accent rounded-xl py-3.5 items-center justify-center mt-2"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-base font-semibold text-white">登录</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <Text className="text-xs text-zinc-600 text-center mt-12">
              tf-dashboard v0.1.0
            </Text>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
