import { useState } from 'react'
import { View, Text, useColorScheme } from 'react-native'
import Svg, { Path, Circle, Line, G } from 'react-native-svg'
import { CHART_COLORS } from '../constants/theme'

interface DataPoint { date: string; value: number }

export function TokenTrendChart({ data, height = 200 }: { data: DataPoint[]; height?: number }) {
  const [sel, setSel] = useState<number | null>(null)
  const isDark = useColorScheme() === 'dark'
  const pad = { t: 20, r: 10, b: 30, l: 40 }

  if (!data || data.length < 2) return (
    <View style={{ height }} className="items-center justify-center">
      <Text className="text-xs text-ink-muted dark:text-ink-muted-dark">暂无数据</Text>
    </View>
  )

  const w = 300, h = height
  const plotW = w - pad.l - pad.r
  const plotH = h - pad.t - pad.b
  const vals = data.map(d => d.value)
  const max = Math.max(...vals, 1), min = Math.min(...vals, 0), range = max - min || 1

  const x = (i: number) => pad.l + (i / (data.length - 1)) * plotW
  const y = (v: number) => pad.t + plotH - ((v - min) / range) * plotH

  const pts = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(0)},${y(v).toFixed(0)}`)
  const linePath = pts.join(' ')
  const areaPath = `${linePath} L${x(data.length - 1)},${h - pad.b} L${x(0)},${h - pad.b} Z`

  const selData = sel !== null ? data[sel] : null

  return (
    <View style={{ height }}>
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
          <Line key={i} x1={pad.l} y1={y(min + range * pct)} x2={w - pad.r} y2={y(min + range * pct)}
            stroke={isDark ? '#3f3f46' : '#e4e4e7'} strokeWidth={0.5} />
        ))}
        {/* Area fill */}
        <Path d={areaPath} fill={CHART_COLORS.primary} fillOpacity={0.12} />
        {/* Line */}
        <Path d={linePath} stroke={CHART_COLORS.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Touch targets */}
        {data.map((d, i) => (
          <Circle key={i} cx={x(i)} cy={y(d.value)} r={12} fill="transparent"
            onPress={() => setSel(sel === i ? null : i)} />
        ))}
        {/* Selected indicator */}
        {selData && (
          <G>
            <Line x1={x(sel as number)} y1={pad.t} x2={x(sel as number)} y2={h - pad.b}
              stroke={isDark ? '#52525b' : '#a1a1aa'} strokeWidth={1} strokeDasharray="3,3" />
            <Circle cx={x(sel as number)} cy={y(selData.value)} r={5} fill={CHART_COLORS.primary} />
          </G>
        )}
      </Svg>
      {/* Tooltip */}
      {selData && (
        <View className="absolute top-1 left-0 right-0 items-center" pointerEvents="none">
          <View className="bg-zinc-800 dark:bg-zinc-100 px-3 py-1.5 rounded-card-sm">
            <Text className="text-xs font-mono text-white dark:text-zinc-900 font-semibold">{fmt(selData.value)}</Text>
            <Text className="text-[9px] text-zinc-400 dark:text-zinc-500 text-center">{selData.date}</Text>
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
