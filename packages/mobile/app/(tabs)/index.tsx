import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Modal } from 'react-native'
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
import { useOpenCodeSummary, useOpenCodeUsage, useOpenCodePrediction, useOpenCodeAnomaly, useServers, useNavLinks, useUnreadAlertCount, useAlertsList } from '../../src/hooks/useQueries'
import { useHealth } from '../../src/hooks/useHealth'

export default function DashboardScreen() {
  const { refreshing, onRefresh } = useRefresh()
  const { data: summary, isLoading: summaryLoading } = useOpenCodeSummary()
  const { data: usage } = useOpenCodeUsage(7)
  const { data: servers } = useServers()
  const { data: links } = useNavLinks()
  const { data: unread } = useUnreadAlertCount()
  const { data: prediction } = useOpenCodePrediction()
  const { data: anomaly } = useOpenCodeAnomaly()
  const { data: recentAlerts } = useAlertsList(5)
  const isOnline = useHealth()
  const [alertModalVisible, setAlertModalVisible] = useState(false)

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
          <View className="flex-row items-center gap-2">
            <View className={`w-2 h-2 rounded-full ${isOnline ? 'bg-status-good' : 'bg-status-bad'}`} />
            <TouchableOpacity onPress={() => setAlertModalVisible(true)} activeOpacity={0.7}>
              <View className="relative w-9 h-9 rounded-full bg-white dark:bg-surface-dark border border-line dark:border-line-dark items-center justify-center">
                <Ionicons name="notifications-outline" size={18} color="#71717a" />
                {unread && unread.count > 0 && (
                  <View className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-status-bad items-center justify-center">
                    <Text className="text-[9px] font-bold text-white">{unread.count > 9 ? '9+' : unread.count}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
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
        <View>
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

        {/* ─── Usage Prediction ─── */}
        {prediction && prediction.predicted && prediction.predicted.length > 0 && (
          <View>
            <SectionHeader title="用量预测" subtitle="未来7天" />
            <View className="flex-row gap-3">
              <StatCard
                icon="trending-up-outline"
                label="下周预估费用"
                value={`¥${prediction.predicted.reduce((s: number, p: any) => s + (parseFloat(p.cost) || 0), 0).toFixed(0)}`}
                sub=""
              />
              <StatCard
                icon="flash-outline"
                label="日均增长率"
                value={`${prediction.trend?.costSlope ? prediction.trend.costSlope.toFixed(1) : '—'}%`}
                sub=""
              />
            </View>
          </View>
        )}

        {/* ─── Anomaly Detection ─── */}
        {anomaly && (
          <View>
            <SectionHeader title="费用异常" />
            <Card variant={anomaly.status === 'anomaly' ? 'default' : 'tinted'} className="flex-row items-center gap-3 px-4 py-3.5">
              <Ionicons
                name={anomaly.status === 'anomaly' ? 'alert-circle' : 'checkmark-circle'}
                size={22}
                color={anomaly.status === 'anomaly' ? '#ef4444' : '#10b981'}
              />
              <View className="flex-1">
                <Text className="text-sm font-medium text-ink dark:text-ink-dark">
                  今日费用 ¥{anomaly.todayCost?.toFixed(2) ?? '—'}
                </Text>
                <Text className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">
                  较7日均值 {anomaly.ratio > 1 ? `高出 ${((anomaly.ratio - 1) * 100).toFixed(0)}%` : '正常'}
                </Text>
              </View>
            </Card>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>

      {/* ─── Alerts Modal ─── */}
      <Modal visible={alertModalVisible} transparent animationType="slide" onRequestClose={() => setAlertModalVisible(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white dark:bg-zinc-900 rounded-t-2xl max-h-[60%] p-5 gap-3">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-base font-bold text-ink dark:text-ink-dark">通知</Text>
              <TouchableOpacity onPress={() => setAlertModalVisible(false)}>
                <Ionicons name="close" size={20} color="#71717a" />
              </TouchableOpacity>
            </View>

            {recentAlerts && recentAlerts.length > 0 ? (
              <ScrollView>
                {recentAlerts.filter((a) => !a.acknowledged).map((alert) => (
                  <View key={alert.id} className="flex-row items-start gap-3 py-2.5 border-b border-line/50 dark:border-line-dark/50">
                    <Ionicons
                      name={alert.severity === 'critical' ? 'alert-circle' : alert.severity === 'warning' ? 'warning' : 'information-circle'}
                      size={18}
                      color={alert.severity === 'critical' ? '#ef4444' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6'}
                    />
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-ink dark:text-ink-dark">{alert.title}</Text>
                      <Text className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5" numberOfLines={2}>{alert.message}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View className="py-8 items-center">
                <Ionicons name="notifications-off-outline" size={28} color="#71717a" />
                <Text className="text-sm text-ink-muted dark:text-ink-muted-dark mt-2">暂无通知</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
