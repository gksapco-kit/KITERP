import { MapPin, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBranch } from '@/contexts/BranchContext'
import { useVendor } from '@/contexts/VendorContext'
import { resolveStorefrontLinkMode } from '@/lib/storefrontTemplateAssignment'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  /** Compact label for narrow headers */
  compact?: boolean
}

export function StoreBranchPicker({ className, compact = false }: Props) {
  const { vendor } = useVendor()
  const { branches, branchCode, selectedBranch, isBranchClosed, setBranchCode, loading } = useBranch()
  const openBranches = branches.filter(b => b.is_open !== false)

  // Only offer the multi-store selector when the vendor runs a single website
  // shared across all stores. In per-unit mode each store has its own website,
  // so there is nothing to switch between.
  const singleWebsiteForAllStores = resolveStorefrontLinkMode(vendor?.settings) === 'single'
  if (!singleWebsiteForAllStores) return null

  // Hide only when loaded and a picker is not needed (single location, etc.).
  if (!loading && openBranches.length <= 1 && !isBranchClosed) return null

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
        {openBranches.map((b) => (
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
