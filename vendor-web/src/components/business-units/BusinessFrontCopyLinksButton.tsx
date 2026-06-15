import { useState } from 'react'
import type { StoreRecord } from '@/api/vendor'
import { Button } from '@/components/ui/button'
import { Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BusinessFrontLinksModal } from '@/components/business-units/BusinessFrontLinksModal'

type Props = {
  stores: StoreRecord[]
  vendorSlug?: string
  vendorSettings?: Record<string, unknown> | null
  /** default = stores page row; inline = settings header action cluster */
  variant?: 'default' | 'inline'
  className?: string
}

const inlineIconBtn =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 p-0 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary'

const inlineTextBtn =
  'sm:h-6 sm:w-auto sm:gap-0.5 sm:px-1.5 sm:text-[0.68rem] sm:font-medium'

export function BusinessFrontCopyLinksButton({
  stores,
  vendorSlug = '',
  vendorSettings,
  variant = 'default',
  className,
}: Props) {
  const [linksOpen, setLinksOpen] = useState(false)
  const isInline = variant === 'inline'
  const canShowLinks = stores.length >= 2 && Boolean(vendorSlug.trim())

  if (!canShowLinks) return null

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          isInline
            ? cn(inlineIconBtn, inlineTextBtn)
            : cn(inlineIconBtn, 'lg:h-8 lg:w-auto lg:gap-1 lg:px-2.5'),
          className,
        )}
        onClick={() => setLinksOpen(true)}
        title="View and copy customer store and HR login links"
      >
        <Link2 className="h-3 w-3 shrink-0" />
        <span className={cn(isInline ? 'hidden sm:inline' : 'hidden lg:inline')}>Copy links</span>
      </Button>

      <BusinessFrontLinksModal
        open={linksOpen}
        onClose={() => setLinksOpen(false)}
        vendorSlug={vendorSlug}
        stores={stores}
        vendorSettings={vendorSettings}
      />
    </>
  )
}
