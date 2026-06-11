import { View, type ViewProps } from 'react-native'
import { cn } from '../lib/cn'

interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated' | 'tinted'
}

export function Card({ variant = 'default', className, children, ...props }: CardProps) {
  return (
    <View
      className={cn(
        'rounded-card p-4',
        variant === 'default' && 'bg-white dark:bg-surface-dark border border-line dark:border-line-dark',
        variant === 'elevated' && 'bg-surface-elevated dark:bg-surface-elevated-dark',
        variant === 'tinted' && 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30',
        className,
      )}
      {...props}
    >
      {children}
    </View>
  )
}
