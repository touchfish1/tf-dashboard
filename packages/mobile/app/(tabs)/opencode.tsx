import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '../../src/components/Card'
import { SectionHeader } from '../../src/components/SectionHeader'
import { EmptyState } from '../../src/components/EmptyState'
import { TokenTrendChart } from '../../src/components/TokenTrendChart'
import { useRefresh } from '../../src/hooks/useRefresh'
import { useOpenCodeSummary, useOpenCodeUsage, useOpenCodeByModel } from '../../src/hooks/useQueries'
import { formatTokens, formatCost } from '@tf-dashboard/shared/utils/format'

const TIME_RANGES = [
  { label: '7天', days: 7 },
  { label: '30天', days: 30 },
  { label: '90天', days: 90 },
] as const

export default function OpenCodeScreen() {
  const [days, setDays] = useState(7)
  const { refreshing, onRefresh } = useRefresh()
  const { data: summary } = useOpenCodeSummary()
  const { data: usage } = useOpenCodeUsage(days)
  const { data: byModel } = useOpenCodeByModel(days)

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-zinc-50 dark:bg-zinc-950">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
        className="flex-1 px-4"
        contentContainerClassName="py-4 gap-5"
      >
        {/* ─── Header ─── */}
        <View className="px-1">
          <Text className="text-[26px] font-bold tracking-tight text-ink dark:text-ink-dark">OpenCode</Text>
          <Text className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">LLM Token 使用详情</Text>
        </View>

        {/* ─── Time Range ─── */}
        <View className="flex-row gap-2 px-1">
          {TIME_RANGES.map((r) => (
            <TouchableOpacity
              key={r.days}
              onPress={() => setDays(r.days)}
              activeOpacity={0.7}
              className={`px-4 py-2 rounded-full border ${
                days === r.days
                  ? 'bg-accent border-accent'
                  : 'bg-white dark:bg-surface-dark border-line dark:border-line-dark'
              }`}
            >
              <Text className={`text-xs font-medium ${days === r.days ? 'text-white' : 'text-ink-muted dark:text-ink-muted-dark'}`}>
                {r.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── Summary ─── */}
        <View className="flex-row gap-3">
          <Card variant="tinted" className="flex-1 gap-1">
            <Text className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">总费用</Text>
            <Text className="text-[24px] font-bold text-ink dark:text-ink-dark" adjustsFontSizeToFit numberOfLines={1}>
              {summary ? formatCost(summary.totalCost) : '—'}
            </Text>
            <Text className="text-[11px] text-ink-muted dark:text-ink-muted-dark">
              {summary ? `${summary.totalSessions} 次会话` : ''}
            </Text>
          </Card>
          <Card className="flex-1 gap-1">
            <Text className="text-[10px] font-medium text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider">Token</Text>
            <Text className="text-[24px] font-bold text-ink dark:text-ink-dark font-mono" adjustsFontSizeToFit numberOfLines={1}>
              {summary ? formatTokens(summary.totalInput + summary.totalOutput) : '—'}
            </Text>
            <View className="flex-row gap-2">
              <Text className="text-[10px] text-ink-muted dark:text-ink-muted-dark font-mono">In {summary ? formatTokens(summary.totalInput) : '—'}</Text>
              <Text className="text-[10px] text-ink-muted dark:text-ink-muted-dark font-mono">Out {summary ? formatTokens(summary.totalOutput) : '—'}</Text>
            </View>
          </Card>
        </View>

        {/* ─── Model Ranking ─── */}
        <View>
          <SectionHeader title="模型费用排行" subtitle={`近${days}天`} />
          <Card className="gap-0 p-0 overflow-hidden">
            {byModel && byModel.length > 0 ? (
              byModel.slice(0, 6).map((m, i) => {
                const maxCost = Math.max(...byModel.map((x) => parseFloat(x.cost)))
                const pct = (parseFloat(m.cost) / maxCost) * 100
                return (
                  <View key={m.model} className="flex-row items-center px-4 py-3 border-b border-line dark:border-line-dark last:border-0">
                    <Text className="w-6 text-xs font-mono text-ink-muted dark:text-ink-muted-dark">{i + 1}</Text>
                    <View className="flex-1 mr-3">
                      <Text className="text-xs font-medium text-ink dark:text-ink-dark" numberOfLines={1}>
                        {m.model.split('/').pop()}
                      </Text>
                      <View className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 mt-1 overflow-hidden">
                        <View className="h-full rounded-full bg-accent" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </View>
                    </View>
                    <Text className="text-xs font-mono font-semibold text-ink dark:text-ink-dark">{formatCost(m.cost)}</Text>
                  </View>
                )
              })
            ) : (
              <View className="py-8"><EmptyState icon="bar-chart-outline" title="暂无数据" /></View>
            )}
          </Card>
        </View>

        {/* ─── Daily Trend ─── */}
        <View>
          <SectionHeader title="日用量趋势" />
          {usage && usage.length >= 2 ? (
            <Card className="p-3">
              <TokenTrendChart
                data={usage.map((d) => ({
                  date: new Date(d.bucketStart).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
                  value: d.tokensInput + d.tokensOutput,
                }))}
                height={200}
              />
            </Card>
          ) : (
            <Card className="h-56 items-center justify-center">
              <Ionicons name="trending-up-outline" size={32} color="#a1a1aa" />
              <Text className="text-sm text-ink-muted dark:text-ink-muted-dark mt-3">暂无数据</Text>
            </Card>
          )}
        </View>

        {/* ─── Recent Records ─── */}
        <View className="pb-8">
          <SectionHeader title="最近记录" />
          {usage && usage.length > 0 ? (
            <Card className="gap-0 p-0 overflow-hidden">
              <View className="flex-row px-4 py-2.5 border-b border-line dark:border-line-dark bg-zinc-50 dark:bg-zinc-900/50">
                <Text className="flex-[2] text-[10px] text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider font-medium">日期</Text>
                <Text className="flex-1 text-[10px] text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider text-right font-medium">Input</Text>
                <Text className="flex-1 text-[10px] text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider text-right font-medium">Output</Text>
                <Text className="flex-1 text-[10px] text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider text-right font-medium">费用</Text>
              </View>
              {usage.slice(0, 10).map((row) => (
                <View key={row.bucketStart} className="flex-row px-4 py-2.5 border-b border-line dark:border-line-dark last:border-0">
                  <Text className="flex-[2] text-xs font-mono text-ink dark:text-ink-dark">
                    {new Date(row.bucketStart).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                  </Text>
                  <Text className="flex-1 text-xs font-mono text-ink-muted dark:text-ink-muted-dark text-right">{formatTokens(row.tokensInput)}</Text>
                  <Text className="flex-1 text-xs font-mono text-ink-muted dark:text-ink-muted-dark text-right">{formatTokens(row.tokensOutput)}</Text>
                  <Text className="flex-1 text-xs font-mono text-ink dark:text-ink-dark text-right font-semibold">{formatCost(row.cost)}</Text>
                </View>
              ))}
            </Card>
          ) : (
            <Card><EmptyState icon="document-text-outline" title="暂无记录" /></Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
