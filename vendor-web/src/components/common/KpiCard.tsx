import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  subValue?: string
  delta?: number | null
  deltaLabel?: string
  className?: string
  valueClassName?: string
}

export function KpiCard({
  label,
  value,
  subValue,
  delta,
  deltaLabel,
  className,
  valueClassName,
}: KpiCardProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 space-y-1', className)}>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className={cn('text-2xl font-bold leading-tight', valueClassName)}>{value}</p>
      {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
      {delta !== undefined && delta !== null && (
        <div className="flex items-center gap-1 pt-0.5">
          {delta > 0 ? (
            <TrendingUp className="h-3.5 w-3.5 text-green-500" />
          ) : delta < 0 ? (
            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
          ) : (
            <Minus className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span
            className={cn(
              'text-xs font-medium',
              delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-muted-foreground',
            )}
          >
            {delta > 0 ? '+' : ''}{delta}%{deltaLabel ? ` ${deltaLabel}` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
