import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { StoreRecord } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, ArrowLeftRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BusinessFrontCopyLinksButton } from '@/components/business-units/BusinessFrontCopyLinksButton'

type Props = {
  stores: StoreRecord[]
  listSearch: string
  onListSearchChange: (value: string) => void
  vendorSlug?: string
  vendorSettings?: Record<string, unknown> | null
  onTransfer?: () => void
  className?: string
  trailing?: ReactNode
  /** @deprecated use variant="inline" */
  compact?: boolean
  /** default = stores page row; inline = settings header action cluster */
  variant?: 'default' | 'inline'
  hideCopyLinks?: boolean
}

const inlineIconBtn =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 p-0 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary'

const inlineTextBtn =
  'sm:h-6 sm:w-auto sm:gap-0.5 sm:px-1.5 sm:text-[0.68rem] sm:font-medium'

/** Search + bulk actions for the business-units list (settings header or stores page). */
export function StoresListToolbar({
  stores,
  listSearch,
  onListSearchChange,
  vendorSlug = '',
  vendorSettings,
  onTransfer,
  className,
  trailing,
  compact = false,
  variant,
  hideCopyLinks = false,
}: Props) {
  const [searchExpanded, setSearchExpanded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  const isInline = variant === 'inline' || compact

  useEffect(() => {
    if (!searchExpanded) return
    searchInputRef.current?.focus()
  }, [searchExpanded])

  useEffect(() => {
    if (!searchExpanded) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (searchWrapRef.current?.contains(e.target as Node)) return
      if (!listSearch.trim()) setSearchExpanded(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [searchExpanded, listSearch])

  if (stores.length === 0 && !trailing) return null

  const searchField = stores.length > 0 ? (
    <div
      ref={searchWrapRef}
      className={cn(
        'relative shrink-0',
        isInline
          ? cn(
              !searchExpanded && 'max-sm:hidden',
              searchExpanded &&
                'max-sm:absolute max-sm:right-0 max-sm:top-full max-sm:z-50 max-sm:mt-1 max-sm:rounded-xl max-sm:border max-sm:border-border max-sm:bg-card max-sm:p-1 max-sm:shadow-lg',
            )
          : cn(
              !searchExpanded && 'max-lg:hidden',
              searchExpanded &&
                'max-lg:absolute max-lg:right-0 max-lg:top-full max-lg:z-50 max-lg:mt-1 max-lg:rounded-xl max-lg:border max-lg:border-border max-lg:bg-card max-lg:p-1 max-lg:shadow-lg',
              'min-w-[10rem] flex-1 lg:max-w-xs',
            ),
      )}
    >
      <Search
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground',
          isInline ? 'left-1.5 h-3 w-3' : 'left-2.5 h-3.5 w-3.5',
        )}
      />
      <Input
        ref={searchInputRef}
        value={listSearch}
        onChange={(e) => onListSearchChange(e.target.value)}
        placeholder="Search units…"
        aria-label="Search units"
        className={cn(
          isInline
            ? 'h-6 w-[8.5rem] rounded-full border-border bg-muted/40 pl-6 pr-5 text-[0.68rem] sm:w-[9.5rem]'
            : 'h-8 pl-8 text-xs',
        )}
      />
      {listSearch && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onListSearchChange('')
            searchInputRef.current?.focus()
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  ) : null

  const searchIconToggle = stores.length > 0 ? (
    <button
      type="button"
      aria-label="Search units"
      aria-expanded={searchExpanded}
      onClick={() => setSearchExpanded((v) => !v)}
      className={cn(
        inlineIconBtn,
        isInline ? 'sm:hidden' : 'lg:hidden',
        searchExpanded && 'border-primary/40 bg-primary/10 text-primary',
        listSearch.trim() && !searchExpanded && 'border-primary/30 text-primary',
      )}
    >
      <Search className="h-3 w-3" />
    </button>
  ) : null

  const copyLinksBtn = hideCopyLinks ? null : (
    <BusinessFrontCopyLinksButton
      stores={stores}
      vendorSlug={vendorSlug}
      vendorSettings={vendorSettings}
      variant={isInline ? 'inline' : 'default'}
    />
  )

  const transferBtn = onTransfer && stores.length >= 2 ? (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        isInline
          ? cn(inlineIconBtn, inlineTextBtn)
          : cn(inlineIconBtn, 'lg:h-8 lg:w-auto lg:gap-1 lg:px-2.5'),
      )}
      onClick={onTransfer}
      title="Transfer stock between units"
    >
      <ArrowLeftRight className="h-3 w-3 shrink-0" />
      <span className={cn(isInline ? 'hidden sm:inline' : 'hidden lg:inline')}>Transfer</span>
    </Button>
  ) : null

  return (
    <>
      <div
        className={cn(
          'flex items-center',
          isInline ? 'relative shrink-0 gap-0.5' : 'flex-wrap gap-2',
          className,
        )}
      >
        {searchIconToggle}
        {searchField}
        {copyLinksBtn}
        {transferBtn}
        {trailing}
      </div>
    </>
  )
}
