import { View, Text } from 'react-native'

type ServerStatus = 'online' | 'offline' | 'warning'

interface ServerBadgeProps {
  status: ServerStatus
  label?: string
}

const statusConfig: Record<ServerStatus, { color: string; bg: string; label: string }> = {
  online: { color: 'text-status-good', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: '在线' },
  offline: { color: 'text-status-bad', bg: 'bg-red-100 dark:bg-red-900/30', label: '离线' },
  warning: { color: 'text-status-warn', bg: 'bg-amber-100 dark:bg-amber-900/30', label: '告警' },
}

export function ServerBadge({ status, label }: ServerBadgeProps) {
  const cfg = statusConfig[status]
  return (
    <View className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full ${cfg.bg}`}>
      <View className={`w-1.5 h-1.5 rounded-full ${cfg.color} bg-current`} />
      <Text className={`text-[11px] font-medium ${cfg.color}`}>
        {label ?? cfg.label}
      </Text>
    </View>
  )
}
