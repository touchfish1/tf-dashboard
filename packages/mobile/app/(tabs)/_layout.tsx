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
          headerStyle: { backgroundColor: isDark ? '#141210' : '#efe8db' },
          headerTintColor: isDark ? '#d4a764' : '#1a1a18',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          tabBarActiveTintColor: '#c23a2b',
          tabBarInactiveTintColor: isDark ? '#8a7a60' : '#7d7468',
          tabBarStyle: {
            backgroundColor: isDark ? '#1a1815' : '#faf7f2',
            borderTopColor: isDark ? '#2a2520' : '#d4cdc0',
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
