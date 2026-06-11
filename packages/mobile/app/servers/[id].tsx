import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '../../src/components/Card'
import { TokenTrendChart } from '../../src/components/TokenTrendChart'
import { useServerMetrics, useServerSummary, useServers } from '../../src/hooks/useQueries'
import { formatPercent, formatUptime, formatBytes } from '@tf-dashboard/shared/utils/format'

export default function ServerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const serverId = Number(id)
  const { data: servers } = useServers()
  const { data: metrics } = useServerMetrics(serverId, 120)
  const { data: summary } = useServerSummary(serverId)

  const server = servers?.find((s) => s.id === serverId)

  const chartData = (metrics ?? []).map((m) => ({
    date: new Date(m.collectedAt).toLocaleDateString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    value: parseFloat(m.cpuPercent || '0'),
  }))

  return (
    <SafeAreaView className="flex-1 bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-line dark:border-line-dark">
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={22} color="#10b981" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-base font-bold text-ink dark:text-ink-dark">{server?.name ?? `服务器 #${id}`}</Text>
          <Text className="text-[11px] text-ink-muted dark:text-ink-muted-dark font-mono" numberOfLines={1}>
            {server?.metricsUrl ?? ''}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerClassName="py-4 gap-4">
        {/* CPU Trend */}
        <View>
          <Text className="text-sm font-semibold text-ink dark:text-ink-dark mb-2 px-1">CPU 使用率</Text>
          {chartData.length >= 2 ? (
            <Card className="p-3">
              <TokenTrendChart data={chartData} height={180} />
            </Card>
          ) : (
            <Card className="h-40 items-center justify-center">
              <Text className="text-xs text-ink-muted dark:text-ink-muted-dark">暂无 CPU 数据</Text>
            </Card>
          )}
        </View>

        {/* Quick Stats */}
        <View className="flex-row gap-3">
          <Card className="flex-1 items-center py-4 gap-1">
            <Ionicons name="pulse-outline" size={18} color="#10b981" />
            <Text className="text-lg font-bold text-ink dark:text-ink-dark font-mono">
              {summary ? formatPercent(summary.latestCpu) : '—'}
            </Text>
            <Text className="text-[10px] text-ink-muted dark:text-ink-muted-dark">当前 CPU</Text>
          </Card>
          <Card className="flex-1 items-center py-4 gap-1">
            <Ionicons name="server-outline" size={18} color="#3b82f6" />
            <Text className="text-lg font-bold text-ink dark:text-ink-dark font-mono">
              {summary ? formatPercent(summary.latestMem) : '—'}
            </Text>
            <Text className="text-[10px] text-ink-muted dark:text-ink-muted-dark">当前内存</Text>
          </Card>
          <Card className="flex-1 items-center py-4 gap-1">
            <Ionicons name="time-outline" size={18} color="#8b5cf6" />
            <Text className="text-lg font-bold text-ink dark:text-ink-dark font-mono" adjustsFontSizeToFit numberOfLines={1}>
              {summary ? formatUptime(summary.uptime) : '—'}
            </Text>
            <Text className="text-[10px] text-ink-muted dark:text-ink-muted-dark">运行时间</Text>
          </Card>
        </View>

        {/* Detail Metrics */}
        {metrics && metrics.length > 0 && (
          <Card className="gap-0 p-0 overflow-hidden">
            <View className="flex-row px-4 py-2.5 border-b border-line dark:border-line-dark bg-zinc-50 dark:bg-zinc-900/50">
              <Text className="flex-1 text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider">时间</Text>
              <Text className="w-16 text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider text-right">CPU</Text>
              <Text className="w-16 text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider text-right">内存</Text>
            </View>
            {metrics.slice(-20).reverse().map((m) => (
              <View key={m.id} className="flex-row px-4 py-2 border-b border-line dark:border-line-dark last:border-0">
                <Text className="flex-1 text-[11px] font-mono text-ink-muted dark:text-ink-muted-dark">
                  {new Date(m.collectedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text className="w-16 text-[11px] font-mono text-ink dark:text-ink-dark text-right">
                  {formatPercent(m.cpuPercent)}
                </Text>
                <Text className="w-16 text-[11px] font-mono text-ink dark:text-ink-dark text-right">
                  {formatPercent(m.memoryPercent)}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* Disk Info */}
        {summary && (
          <Card className="gap-2">
            <Text className="text-sm font-semibold text-ink dark:text-ink-dark">磁盘</Text>
            <View className="flex-row items-center gap-3">
              <View className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <View
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${summary ? (parseFloat(summary.latestDisk) / parseFloat(summary.totalDisk)) * 100 : 0}%` }}
                />
              </View>
              <Text className="text-xs font-mono text-ink-muted dark:text-ink-muted-dark">
                {summary?.latestDisk ?? '—'} / {summary?.totalDisk ?? '—'} GB
              </Text>
            </View>
          </Card>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  )
}
