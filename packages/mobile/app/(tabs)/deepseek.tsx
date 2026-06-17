import { View, Text, ScrollView, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Card } from '../../src/components/Card'
import { SectionHeader } from '../../src/components/SectionHeader'
import { EmptyState } from '../../src/components/EmptyState'
import { BalanceChart } from '../../src/components/BalanceChart'
import { useRefresh } from '../../src/hooks/useRefresh'
import { useDeepSeekBalance, useDeepSeekHistory } from '../../src/hooks/useQueries'
import { formatCost } from '@tf-dashboard/shared/utils/format'

export default function DeepSeekScreen() {
  const { refreshing, onRefresh } = useRefresh()
  const { data: balance, isLoading } = useDeepSeekBalance()
  const { data: history } = useDeepSeekHistory(30)

  const balanceNum = balance ? parseFloat(balance.balanceTotal) : 0
  const grantedNum = balance ? parseFloat(balance.balanceGranted) : 0
  const toppedUpNum = balance ? parseFloat(balance.balanceToppedUp) : 0
  const currencySymbol = balance?.currency === 'CNY' ? '¥' : '$'

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-paper dark:bg-paper-dark">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c23a2b" />}
        className="flex-1 px-4"
        contentContainerClassName="py-4 gap-5"
      >
        {/* ─── Header ─── */}
        <View className="px-1">
          <Text className="text-[26px] font-bold tracking-tight text-ink dark:text-ink-dark">DeepSeek</Text>
          <Text className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">余额监控</Text>
        </View>

        {/* ─── Balance Hero ─── */}
        {isLoading ? (
          <Card className="h-48 items-center justify-center">
            <Text className="text-ink-muted dark:text-ink-muted-dark">加载中...</Text>
          </Card>
        ) : balance ? (
          <Card variant="tinted" className="items-center py-6 gap-2">
            <Text className="text-[11px] font-medium text-accent uppercase tracking-widest">账户余额</Text>
            <Text className="text-[44px] font-bold text-ink dark:text-ink-dark tracking-tight" adjustsFontSizeToFit numberOfLines={1}>
              {currencySymbol}{balanceNum.toFixed(2)}
            </Text>
            <View className="flex-row gap-6 mt-2">
              <View className="items-center">
                <Text className="text-[10px] text-ink-muted dark:text-ink-muted-dark">赠送</Text>
                <Text className="text-xs font-mono font-medium text-ink dark:text-ink-dark mt-0.5">{currencySymbol}{grantedNum.toFixed(2)}</Text>
              </View>
              <View className="w-px bg-line dark:bg-line-dark" />
              <View className="items-center">
                <Text className="text-[10px] text-ink-muted dark:text-ink-muted-dark">充值</Text>
                <Text className="text-xs font-mono font-medium text-ink dark:text-ink-dark mt-0.5">{currencySymbol}{toppedUpNum.toFixed(2)}</Text>
              </View>
            </View>
            <View className="flex-row items-center gap-1 mt-3">
              <View className="w-1.5 h-1.5 rounded-full bg-status-good" />
              <Text className="text-[10px] text-status-good font-medium">余额正常</Text>
            </View>
          </Card>
        ) : (
          <Card variant="tinted" className="items-center py-6">
            <Ionicons name="alert-circle-outline" size={28} color="#f59e0b" />
            <Text className="text-sm text-ink-muted dark:text-ink-muted-dark mt-2">未获取到余额信息</Text>
            <Text className="text-[10px] text-ink-muted/60 dark:text-ink-muted-dark/60 mt-1">请在设置中配置 API Key</Text>
          </Card>
        )}

        {/* ─── Balance Trend ─── */}
        <View>
          <SectionHeader title="余额趋势" subtitle="近30天" />
          {history && history.length >= 2 ? (
            <Card className="p-3">
              <BalanceChart
                data={history.map((d) => ({
                  date: new Date(d.recordedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
                  balance: parseFloat(d.balanceTotal),
                }))}
                height={200}
              />
            </Card>
          ) : (
            <Card className="h-56 items-center justify-center">
              <Ionicons name="pulse-outline" size={32} color="#7d7468" />
              <Text className="text-sm text-ink-muted dark:text-ink-muted-dark mt-3">暂无数据</Text>
            </Card>
          )}
        </View>

        {/* ─── History Table ─── */}
        <View className="pb-8">
          <SectionHeader title="余额记录" />
          {history && history.length > 0 ? (
            <Card className="gap-0 p-0 overflow-hidden">
              <View className="flex-row px-4 py-2.5 border-b border-line dark:border-line-dark bg-line/30 dark:bg-line-dark/30">
                <Text className="flex-[2] text-[10px] text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider font-medium">时间</Text>
                <Text className="flex-1 text-[10px] text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider text-right font-medium">余额</Text>
              </View>
              {history.slice(0, 10).map((row) => (
                <View key={row.id} className="flex-row px-4 py-2.5 border-b border-line dark:border-line-dark last:border-0">
                  <Text className="flex-[2] text-xs font-mono text-ink dark:text-ink-dark">
                    {new Date(row.recordedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text className="flex-1 text-xs font-mono text-ink dark:text-ink-dark text-right font-semibold">
                    {formatCost(row.balanceTotal)}
                  </Text>
                </View>
              ))}
            </Card>
          ) : (
            <Card><EmptyState icon="receipt-outline" title="暂无记录" /></Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
