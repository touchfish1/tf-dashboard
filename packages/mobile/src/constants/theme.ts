/** Chart color palette — matches tailwind theme */
export const CHART_COLORS = {
  primary: '#10b981',
  primaryLight: '#34d399',
  secondary: '#3b82f6',
  secondaryLight: '#60a5fa',
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

/** Theme tokens for chart components (Skia-based) */
export function chartTheme(isDark: boolean) {
  return {
    axis: {
      label: { color: isDark ? '#a1a1aa' : '#71717a' },
      grid: { color: isDark ? '#27272a' : '#e4e4e7' },
      tick: { color: isDark ? '#a1a1aa' : '#71717a' },
    },
    line: {
      stroke: { color: CHART_COLORS.primary },
    },
  }
}
