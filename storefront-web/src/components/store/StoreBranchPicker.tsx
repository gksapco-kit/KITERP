import { MapPin, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBranch } from '@/contexts/BranchContext'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  /** Compact label for narrow headers */
  compact?: boolean
}

export function StoreBranchPicker({ className, compact = false }: Props) {
  const { branches, branchCode, selectedBranch, isBranchClosed, setBranchCode, loading } = useBranch()

  // Show picker when there are multiple open branches OR when a branch is closed (to let user switch)
  if (loading || (branches.length <= 1 && !isBranchClosed)) return null

  const label = isBranchClosed
    ? 'Store Closed'
    : selectedBranch?.name ?? (branchCode ? `Unit ${branchCode}` : 'All locations')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-1.5 font-normal shrink-0',
            compact ? 'max-w-[120px] px-2 text-xs' : 'max-w-[180px]',
            isBranchClosed && 'border-rose-300 text-rose-600 dark:border-rose-700 dark:text-rose-400',
            className,
          )}
          aria-label="Choose business unit or store"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-[min(60vh,320px)] overflow-y-auto">
        {isBranchClosed && (
          <div className="px-3 py-2 text-xs text-rose-600 dark:text-rose-400 border-b border-border">
            This store is currently closed.
          </div>
        )}
        <DropdownMenuItem onClick={() => setBranchCode(null)}>All locations</DropdownMenuItem>
        {branches.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onClick={() => setBranchCode(b.code || b.id)}
            className={cn(
              (branchCode === b.code || branchCode === b.id) && 'bg-accent font-medium',
            )}
          >
            <span className="truncate">{b.name}</span>
            {b.code ? (
              <span className="ml-auto pl-2 font-mono text-[10px] text-muted-foreground">{b.code}</span>
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
