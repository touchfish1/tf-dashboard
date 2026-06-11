import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  message?: string
}

export function EmptyState({ icon = 'cube-outline', title, message }: EmptyStateProps) {
  return (
    <View className="items-center justify-center py-12 px-8">
      <View className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 items-center justify-center mb-4">
        <Ionicons name={icon} size={24} color="#a1a1aa" />
      </View>
      <Text className="text-base font-medium text-ink-muted dark:text-ink-muted-dark mb-1 text-center">
        {title}
      </Text>
      {message && (
        <Text className="text-xs text-ink-muted/60 dark:text-ink-muted-dark/60 text-center leading-5">
          {message}
        </Text>
      )}
    </View>
  )
}
