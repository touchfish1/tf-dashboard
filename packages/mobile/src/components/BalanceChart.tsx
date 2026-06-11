import { useState } from 'react'
import { View, Text, useColorScheme } from 'react-native'
import { LineChart } from 'react-native-gifted-charts'
import { CHART_COLORS } from '../constants/theme'

interface DataPoint { date: string; balance: number }

export function BalanceChart({ data, height = 200 }: { data: DataPoint[]; height?: number }) {
  const [sel, setSel] = useState<number | null>(null)
  const isDark = useColorScheme() === 'dark'

  if (!data || data.length < 2) return (
    <View style={{ height }} className="items-center justify-center">
      <Text className="text-xs text-ink-muted dark:text-ink-muted-dark">暂无数据</Text>
    </View>
  )

  return (
    <View style={{ height }}>
      <LineChart
        data={data.map(d => ({ value: d.balance }))}
        color={CHART_COLORS.secondary}
        startFillColor={CHART_COLORS.secondary}
        startOpacity={0.12}
        endFillColor={CHART_COLORS.secondary}
        endOpacity={0.01}
        thickness={2.5} curved
        hideDataPoints
        showDataPointOnFocus
        dataPointsColor={CHART_COLORS.secondary}
        dataPointsRadius={4}
        xAxisColor={isDark ? '#3f3f46' : '#e4e4e7'}
        yAxisColor={isDark ? '#3f3f46' : '#e4e4e7'}
        xAxisLabelTextStyle={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 9 }}
        yAxisTextStyle={{ color: isDark ? '#a1a1aa' : '#71717a', fontSize: 9 }}
        backgroundColor="transparent"
        spacing={Math.max(10, (height * 3) / data.length)}
        scrollToEnd isAnimated
        pointerConfig={{
          pointerStripHeight: height - 40,
          pointerStripColor: isDark ? '#3f3f46' : '#d4d4d8',
          pointerStripWidth: 1,
          pointerColor: CHART_COLORS.secondary,
          radius: 6,
          pointerLabelWidth: 100,
          pointerLabelHeight: 'auto' as any,
          autoAdjustPointerLabelPosition: true,
          activatePointersOnLongPress: false,
        }}
        onPress={(_item: any, i: number) => setSel(i)}
      />
      {sel !== null && data[sel] && (
        <View className="absolute top-1 left-0 right-0 items-center" pointerEvents="none">
          <View className="bg-zinc-800 dark:bg-zinc-100 px-3 py-1.5 rounded-card-sm">
            <Text className="text-xs font-mono text-white dark:text-zinc-900 font-semibold">¥{data[sel].balance.toFixed(2)}</Text>
            <Text className="text-[9px] text-zinc-400 dark:text-zinc-500 text-center">{data[sel].date}</Text>
          </View>
        </View>
      )}
    </View>
  )
}
