import type { ReactNode } from 'react'
import type { StoreRecord } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Link2, ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  stores: StoreRecord[]
  listSearch: string
  onListSearchChange: (value: string) => void
  onCopyLinks: () => void
  onTransfer?: () => void
  className?: string
  trailing?: ReactNode
  /** Compact mode: smaller inputs and icon-only buttons for inline header use */
  compact?: boolean
}

/** Search + bulk actions for the business-units list (settings header or stores page). */
export function StoresListToolbar({
  stores,
  listSearch,
  onListSearchChange,
  onCopyLinks,
  onTransfer,
  className,
  trailing,
  compact = false,
}: Props) {
  if (stores.length === 0 && !trailing) return null

  return (
    <div className={cn('flex flex-wrap items-center', compact ? 'gap-1' : 'gap-2', className)}>
      {stores.length > 0 && (
        <div className={cn('relative flex-1', compact ? 'min-w-[7rem] max-w-[11rem]' : 'min-w-[10rem] sm:max-w-xs')}>
          <Search className={cn('pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground', compact ? 'left-2 h-3 w-3' : 'left-2.5 h-3.5 w-3.5')} />
          <Input
            value={listSearch}
            onChange={(e) => onListSearchChange(e.target.value)}
            placeholder="Search units…"
            className={cn(compact ? 'h-6 pl-6 text-[0.7rem]' : 'h-8 pl-8 text-xs')}
          />
        </div>
      )}
      {stores.length >= 2 && (
        <Button
          variant="outline"
          size="sm"
          className={cn(compact ? 'h-6 gap-1 px-2 text-[0.68rem]' : 'h-8')}
          onClick={onCopyLinks}
          title="Copy all business front links"
        >
          <Link2 className={cn(compact ? 'h-3 w-3 shrink-0' : 'h-3.5 w-3.5 sm:mr-1')} />
          {compact ? 'Copy links' : <span className="hidden sm:inline">Copy links</span>}
        </Button>
      )}
      {onTransfer && stores.length >= 2 && (
        <Button
          variant="outline"
          size="sm"
          className={cn(compact ? 'h-6 px-1.5' : 'h-8')}
          onClick={onTransfer}
          title="Transfer stock between units"
        >
          <ArrowLeftRight className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5 sm:mr-1')} />
          {!compact && <span className="hidden sm:inline">Transfer</span>}
        </Button>
      )}
      {trailing}
    </div>
  )
}
