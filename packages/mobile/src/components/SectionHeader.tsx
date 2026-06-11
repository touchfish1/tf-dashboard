import { View, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: { label: string; onPress: () => void }
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-1 mb-3">
      <View className="flex-row items-baseline gap-2">
        <Text className="text-base font-semibold text-ink dark:text-ink-dark">{title}</Text>
        {subtitle && (
          <Text className="text-xs text-ink-muted dark:text-ink-muted-dark">{subtitle}</Text>
        )}
      </View>
      {action && (
        <TouchableOpacity onPress={action.onPress} className="flex-row items-center gap-0.5">
          <Text className="text-xs text-accent font-medium">{action.label}</Text>
          <Ionicons name="chevron-forward" size={12} color="#10b981" />
        </TouchableOpacity>
      )}
    </View>
  )
}
