import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Card } from './Card'

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | 'flat'
  trendValue?: string
  accent?: boolean
}

export function StatCard({ icon, label, value, sub, trend, trendValue, accent }: StatCardProps) {
  const trendColor = trend === 'up' ? 'text-status-good' : trend === 'down' ? 'text-status-bad' : 'text-ink-muted dark:text-ink-muted-dark'

  return (
    <Card variant={accent ? 'tinted' : 'default'} className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <View className="w-9 h-9 rounded-full bg-[#fee2e2] dark:bg-[#7f1d1d]/30 items-center justify-center">
          <Ionicons name={icon} size={16} color={accent ? '#c23a2b' : '#c23a2b'} />
        </View>
        {trend && (
          <View className="flex-row items-center gap-0.5">
            <Ionicons
              name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'}
              size={12}
              className={trendColor}
            />
            {trendValue && <Text className={`text-[10px] font-mono ${trendColor}`}>{trendValue}</Text>}
          </View>
        )}
      </View>
      <Text className="text-[22px] font-bold tracking-tight text-ink dark:text-ink-dark mt-1" adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Text>
      <Text className="text-xs text-ink-muted dark:text-ink-muted-dark">{label}</Text>
      {sub && (
        <Text className="text-[10px] font-mono text-ink-muted dark:text-ink-muted-dark">{sub}</Text>
      )}
    </Card>
  )
}
