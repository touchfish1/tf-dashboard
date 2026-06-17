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
        variant === 'default' && 'bg-surface dark:bg-surface-dark border border-line dark:border-line-dark',
        variant === 'elevated' && 'bg-surface-elevated dark:bg-surface-elevated-dark',
        variant === 'tinted' && 'bg-[#fef2f2] dark:bg-[#7f1d1d]/20 border border-[#fecaca] dark:border-[#7f1d1d]/30',
        className,
      )}
      {...props}
    >
      {children}
    </View>
  )
}
