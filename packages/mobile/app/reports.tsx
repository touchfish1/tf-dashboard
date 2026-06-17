import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '../src/components/Card'
import { SectionHeader } from '../src/components/SectionHeader'
import { EmptyState } from '../src/components/EmptyState'
import { useRefresh } from '../src/hooks/useRefresh'
import { useReports } from '../src/hooks/useQueries'

const TYPE_LABEL = { daily: '日报', weekly: '周报' } as const
const STATUS_CONFIG = {
  sent: { label: '已发送', color: 'text-status-good', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  failed: { label: '失败', color: 'text-status-bad', bg: 'bg-red-100 dark:bg-red-900/30' },
  pending: { label: '待发送', color: 'text-status-warn', bg: 'bg-amber-100 dark:bg-amber-900/30' },
} as const

export default function ReportsScreen() {
  const { refreshing, onRefresh } = useRefresh()
  const { data: reports, isLoading } = useReports(20)

  return (
    <SafeAreaView className="flex-1 bg-paper dark:bg-paper-dark">
      <View className="flex-row items-center px-4 py-3 border-b border-line dark:border-line-dark">
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={22} color="#c23a2b" />
        </TouchableOpacity>
        <Text className="text-base font-bold text-ink dark:text-ink-dark flex-1">报告历史</Text>
      </View>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c23a2b" />}
        className="flex-1 px-4"
        contentContainerClassName="py-4 gap-4"
      >
        <View className="px-1">
          <Text className="text-[26px] font-bold tracking-tight text-ink dark:text-ink-dark">报告历史</Text>
          <Text className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">定期报告发送记录</Text>
        </View>

        <View>
          <SectionHeader title="发送记录" />
          {isLoading ? (
            <View className="gap-3">
              {[1, 2, 3].map((i) => (
                <View key={i} className="h-14 bg-surface dark:bg-surface-dark border border-line dark:border-line-dark rounded-card animate-pulse" />
              ))}
            </View>
          ) : reports && reports.length > 0 ? (
            <Card className="gap-0 p-0 overflow-hidden">
              <View className="flex-row px-4 py-2.5 border-b border-line dark:border-line-dark bg-line/30 dark:bg-line-dark/30">
                <Text className="flex-1 text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider">类型</Text>
                <Text className="flex-[2] text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider">时间段</Text>
                <Text className="flex-1 text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider text-right">状态</Text>
                <Text className="flex-[2] text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider text-right">时间</Text>
              </View>
              {reports.map((r) => {
                const st = STATUS_CONFIG[r.status]
                return (
                  <View key={r.id} className="flex-row px-4 py-3 border-b border-line dark:border-line-dark last:border-0 items-center">
                    <Text className="flex-1 text-xs font-medium text-ink dark:text-ink-dark">{TYPE_LABEL[r.type]}</Text>
                    <View className="flex-[2]">
                      <Text className="text-[11px] font-mono text-ink-muted dark:text-ink-muted-dark">
                        {new Date(r.periodStart).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                        {' ~ '}
                        {new Date(r.periodEnd).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                      </Text>
                    </View>
                    <View className={`flex-1 px-2 py-0.5 rounded-full ${st.bg} self-center`}>
                      <Text className={`text-[9px] font-medium ${st.color} text-center`}>{st.label}</Text>
                    </View>
                    <Text className="flex-[2] text-[10px] font-mono text-ink-muted dark:text-ink-muted-dark text-right">
                      {new Date(r.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )
              })}
            </Card>
          ) : (
            <Card><EmptyState icon="document-text-outline" title="暂无报告" /></Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
