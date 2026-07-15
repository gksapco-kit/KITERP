import { type ReactNode, type FormEvent } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { onModalBackdropClick } from '@/lib/utils'
import {
  modalBodyPadClass,
  modalBodyScrollClass,
  modalCloseBtnClass,
  modalFooterClass,
  modalHeaderStickyClass,
  modalOverlayCenterClass,
  modalPanel2xlClass,
  modalTitleClass,
  modalWidthLg,
} from '@/lib/modalUi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { TablePagination } from '@/components/table/TablePagination'
import { Loader2, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CrmModal({
  title, onClose, children, footer, maxW = modalWidthLg, headerActions, bodyClassName,
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  /** Pinned footer (e.g. Cancel / Save). Middle content scrolls independently. */
  footer?: ReactNode
  maxW?: string
  headerActions?: ReactNode
  /** Override scroll/layout on the modal body (e.g. `!overflow-hidden` for split panes). */
  bodyClassName?: string
}) {
  useEscapeToClose(onClose)

  return (
    <div data-kiterp-modal className={modalOverlayCenterClass} onClick={onModalBackdropClick(onClose)}>
      <div
        className={cn(modalPanel2xlClass, maxW)}
        onClick={e => e.stopPropagation()}
      >
        <div className={cn(modalHeaderStickyClass, 'shrink-0')}>
          <h2 className={cn(modalTitleClass, 'truncate')}>{title}</h2>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <button type="button" aria-label="Close" onClick={onClose} className={modalCloseBtnClass}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/* Body and footer as siblings so the footer never scrolls away / clips */}
        <div className={cn(footer ? modalBodyScrollClass : modalBodyPadClass, 'min-h-0 flex-1', bodyClassName)}>
          {children}
        </div>
        {footer ? (
          <div className={cn(modalFooterClass, 'rounded-b-2xl shrink-0')}>{footer}</div>
        ) : null}
      </div>
    </div>
  )
}

export function Field({
  label, children, required, className,
}: { label: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <div className={className}>
      <Label required={required}>{label}</Label>
      {children}
    </div>
  )
}

export function SearchBar({
  value, onChange, onSubmit, placeholder = 'Search…',
}: { value: string; onChange: (v: string) => void; onSubmit: (e: FormEvent) => void; placeholder?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-kiterp-search-field
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="pl-10"
            />
          </div>
          <Button type="submit" variant="outline">Search</Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function Pager({
  page, pages, total, onPage,
  pageSize = 20,
  onPageSizeChange,
  itemLabel = 'items',
}: {
  page: number
  pages: number
  total: number
  onPage: (p: number) => void
  pageSize?: number
  onPageSizeChange?: (size: number) => void
  itemLabel?: string
}) {
  if (total <= 0 && pages <= 1) return null
  return (
    <TablePagination
      page={page}
      pages={pages || 1}
      total={total}
      pageSize={pageSize}
      onPageChange={onPage}
      onPageSizeChange={onPageSizeChange ?? (() => {})}
      itemLabel={itemLabel}
      className="border-border bg-muted/30 px-6"
    />
  )
}

export function LoadingRow({ cols }: { cols: number }) {
  return (
    <tr><td colSpan={cols} className="px-6 py-12 text-center">
      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
    </td></tr>
  )
}

export function EmptyRow({
  cols, message, action,
}: { cols: number; message: string; action?: ReactNode }) {
  return (
    <tr><td colSpan={cols} className="px-6 py-16 text-center">
      <p className="text-sm text-muted-foreground mb-3">{message}</p>
      {action}
    </td></tr>
  )
}
