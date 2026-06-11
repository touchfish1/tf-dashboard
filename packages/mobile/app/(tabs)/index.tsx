import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '../../src/components/Card'
import { StatCard } from '../../src/components/StatCard'
import { SectionHeader } from '../../src/components/SectionHeader'
import { EmptyState } from '../../src/components/EmptyState'
import { StatCardSkeleton } from '../../src/components/LoadingSkeleton'
import { TokenTrendChart } from '../../src/components/TokenTrendChart'
import { useRefresh } from '../../src/hooks/useRefresh'
import { useOpenCodeSummary, useOpenCodeUsage, useServers, useNavLinks, useUnreadAlertCount } from '../../src/hooks/useQueries'

export default function DashboardScreen() {
  const { refreshing, onRefresh } = useRefresh()
  const { data: summary, isLoading: summaryLoading } = useOpenCodeSummary()
  const { data: usage } = useOpenCodeUsage(7)
  const { data: servers } = useServers()
  const { data: links } = useNavLinks()
  const { data: unread } = useUnreadAlertCount()

  const chartData = (usage ?? []).map((d) => ({
    date: new Date(d.bucketStart).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
    value: d.tokensInput + d.tokensOutput,
  }))

  const onlineCount = servers?.filter((s) => s.isActive).length ?? 0

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-zinc-50 dark:bg-zinc-950">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
        className="flex-1 px-4"
        contentContainerClassName="py-4 gap-5"
      >
        {/* ─── Header ─── */}
        <View className="flex-row items-center justify-between px-1">
          <View>
            <Text className="text-[26px] font-bold tracking-tight text-ink dark:text-ink-dark">
              Dashboard
            </Text>
            <Text className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">
              LLM Token 用量概览
            </Text>
          </View>
          {unread && unread.count > 0 ? (
            <TouchableOpacity activeOpacity={0.7} className="relative w-9 h-9 rounded-full bg-white dark:bg-surface-dark border border-line dark:border-line-dark items-center justify-center">
              <Ionicons name="notifications-outline" size={18} color="#71717a" />
              <View className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-status-bad items-center justify-center">
                <Text className="text-[9px] font-bold text-white">{unread.count}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View className="w-9 h-9 rounded-full bg-white dark:bg-surface-dark border border-line dark:border-line-dark items-center justify-center">
              <Ionicons name="notifications-outline" size={18} color="#71717a" />
            </View>
          )}
        </View>

        {/* ─── Summary Stat Cards ─── */}
        {summaryLoading ? (
          <View className="flex-row gap-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </View>
        ) : (
          <View className="flex-row gap-3">
            <StatCard
              icon="flash"
              label="今日 Token"
              value={summary ? `${((summary.totalInput + summary.totalOutput) / 1000).toFixed(0)}k` : '—'}
              sub="Input + Output"
            />
            <StatCard
              icon="wallet-outline"
              label="今日费用"
              value={summary ? `¥${summary.totalCost}` : '—'}
              sub="累计"
            />
            <StatCard
              icon="server-outline"
              label="活跃服务器"
              value={String(onlineCount)}
              sub={servers ? `共 ${servers.length} 台` : '—'}
              accent
            />
          </View>
        )}

        {/* ─── Quick Links ─── */}
        <View>
          <SectionHeader title="常用链接" />
          {links && links.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {links.slice(0, 6).map((link) => (
                <TouchableOpacity
                  key={link.id}
                  className="flex-row items-center gap-2 bg-white dark:bg-surface-dark border border-line dark:border-line-dark rounded-card-sm px-3.5 py-2.5"
                  activeOpacity={0.7}
                >
                  <Ionicons name="link-outline" size={14} color="#10b981" />
                  <Text className="text-xs font-medium text-ink dark:text-ink-dark" numberOfLines={1}>
                    {link.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Card>
              <EmptyState icon="bookmarks-outline" title="暂无快捷链接" message="在设置页面添加常用链接即可快速访问" />
            </Card>
          )}
        </View>

        {/* ─── Usage Chart ─── */}
        <View>
          <SectionHeader title="用量趋势" subtitle="近7天" />
          {chartData.length >= 2 ? (
            <Card className="p-3">
              <TokenTrendChart data={chartData} height={200} />
            </Card>
          ) : (
            <Card className="h-56 items-center justify-center">
              <Ionicons name="stats-chart-outline" size={32} color="#a1a1aa" />
              <Text className="text-sm text-ink-muted dark:text-ink-muted-dark mt-3">暂无数据</Text>
            </Card>
          )}
        </View>

        {/* ─── Server Status ─── */}
        <View className="pb-8">
          <SectionHeader title="服务器状态" />
          {servers && servers.length > 0 ? (
            <View className="gap-2">
              {servers.slice(0, 3).map((server) => (
                <TouchableOpacity
                  key={server.id}
                  onPress={() => router.push(`/servers/${server.id}`)}
                  className="flex-row items-center bg-white dark:bg-surface-dark border border-line dark:border-line-dark rounded-card-sm px-4 py-3.5 gap-3"
                  activeOpacity={0.7}
                >
                  <View className="w-2 h-2 rounded-full bg-status-good" />
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-ink dark:text-ink-dark">{server.name}</Text>
                    <Text className="text-[11px] text-ink-muted dark:text-ink-muted-dark" numberOfLines={1}>{server.metricsUrl}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#a1a1aa" />
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Card>
              <EmptyState icon="server-outline" title="未添加服务器" message="在设置中配置服务器地址" />
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
