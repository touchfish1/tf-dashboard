import { Tabs } from 'expo-router'
import { useColorScheme, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

type IoniconsName = keyof typeof Ionicons.glyphMap

const TAB_CONFIG: Record<string, { label: string; icon: IoniconsName; iconFocused: IoniconsName }> = {
  index: { label: '首页', icon: 'grid-outline', iconFocused: 'grid' },
  opencode: { label: 'OpenCode', icon: 'code-slash-outline', iconFocused: 'code-slash' },
  deepseek: { label: 'DeepSeek', icon: 'diamond-outline', iconFocused: 'diamond' },
  servers: { label: '服务器', icon: 'server-outline', iconFocused: 'server' },
  settings: { label: '设置', icon: 'settings-outline', iconFocused: 'settings' },
}

export default function TabLayout() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <Tabs
      screenOptions={({ route }) => {
        const cfg = TAB_CONFIG[route.name]
        return {
          title: cfg?.label ?? route.name,
          headerShown: true,
          headerStyle: { backgroundColor: isDark ? '#09090b' : '#fafafa' },
          headerTintColor: isDark ? '#f4f4f5' : '#18181b',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          tabBarActiveTintColor: '#10b981',
          tabBarInactiveTintColor: isDark ? '#52525b' : '#a1a1aa',
          tabBarStyle: {
            backgroundColor: isDark ? '#18181b' : '#ffffff',
            borderTopColor: isDark ? '#27272a' : '#e4e4e7',
            borderTopWidth: 0.5,
            paddingBottom: Platform.OS === 'ios' ? 20 : 8,
            paddingTop: 6,
            height: Platform.OS === 'ios' ? 85 : 65,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: 2,
          },
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? cfg.iconFocused : cfg.icon}
              size={22}
              color={color}
            />
          ),
        }
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="opencode" />
      <Tabs.Screen name="deepseek" />
      <Tabs.Screen name="servers" />
      <Tabs.Screen name="settings" />
    </Tabs>
  )
}
