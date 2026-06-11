import { View } from 'react-native'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <View
      className={`bg-zinc-200 dark:bg-zinc-800 rounded-card-sm animate-pulse ${className ?? ''}`}
    />
  )
}

export function StatCardSkeleton() {
  return (
    <View className="flex-1 bg-white dark:bg-surface-dark border border-line dark:border-line-dark rounded-card p-4 gap-3">
      <Skeleton className="w-9 h-9 rounded-full" />
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-3 w-16" />
    </View>
  )
}

export function ChartSkeleton() {
  return (
    <View className="bg-white dark:bg-surface-dark border border-line dark:border-line-dark rounded-card p-4 gap-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-48 w-full rounded-card-sm" />
    </View>
  )
}
