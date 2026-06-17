/** Chart color palette — ink-wash theme (matches web: 朱砂 vermillion + 墨 ink) */
export const CHART_COLORS = {
  primary: '#c23a2b',
  primaryLight: '#e05a4a',
  secondary: '#d4a764',
  secondaryLight: '#e0b87a',
  warn: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  orange: '#f97316',
} as const

/** Ordered palette for model/category breakdown charts */
export const PALETTE_CATEGORICAL = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.purple,
  CHART_COLORS.warn,
  CHART_COLORS.pink,
  CHART_COLORS.cyan,
  CHART_COLORS.danger,
  CHART_COLORS.orange,
] as const

/** Theme tokens for chart components */
export function chartTheme(isDark: boolean) {
  return {
    axis: {
      label: { color: isDark ? '#8a7a60' : '#7d7468' },
      grid: { color: isDark ? '#2a2520' : '#d4cdc0' },
      tick: { color: isDark ? '#8a7a60' : '#7d7468' },
    },
    line: {
      stroke: { color: CHART_COLORS.primary },
    },
  }
}
