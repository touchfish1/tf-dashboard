import { useState } from 'react'
import { View, Text, useColorScheme } from 'react-native'
import { LineChart } from 'react-native-gifted-charts'
import { CHART_COLORS } from '../constants/theme'

interface DataPoint { date: string; value: number }

export function TokenTrendChart({ data, height = 200 }: { data: DataPoint[]; height?: number }) {
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
        data={data.map(d => ({ value: d.value }))}
        color={CHART_COLORS.primary}
        startFillColor={CHART_COLORS.primary}
        startOpacity={0.15}
        endFillColor={CHART_COLORS.primary}
        endOpacity={0.01}
        thickness={2.5} curved
        hideDataPoints
        showDataPointOnFocus
        dataPointsColor={CHART_COLORS.primary}
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
          pointerColor: CHART_COLORS.primary,
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
            <Text className="text-xs font-mono text-white dark:text-zinc-900 font-semibold">{fmt(data[sel].value)}</Text>
            <Text className="text-[9px] text-zinc-400 dark:text-zinc-500 text-center">{data[sel].date}</Text>
          </View>
        </View>
      )}
    </View>
  )
}

function fmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return String(v)
}
