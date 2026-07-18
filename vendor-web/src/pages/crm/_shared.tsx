import { type ReactNode, type FormEvent } from 'react'
import {
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  ModalOverlay,
  ModalPanel,
} from '@/components/ui/Modal'
import { modalWidthLg } from '@/lib/modalUi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { TablePagination } from '@/components/table/TablePagination'
import { Loader2, Search } from 'lucide-react'
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
  return (
    <ModalOverlay
      onClose={onClose}
      className="z-[100] overflow-y-auto overscroll-contain bg-black/60 p-2 sm:p-3 md:p-4"
    >
      <ModalPanel
        className={cn(
          maxW,
          'my-auto w-full max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-1.5rem)] md:max-h-[calc(100dvh-2rem)] !rounded-lg',
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
          {typeof title === 'string' ? (
            <h2 className="min-w-0 truncate text-base font-semibold leading-none text-foreground">{title}</h2>
          ) : (
            <div className="min-w-0">{title}</div>
          )}
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <ModalCloseButton onClose={onClose} />
          </div>
        </div>
        {/* Scroll appears only when content exceeds the live viewport height */}
        <ModalBody
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 pt-0',
            '[scrollbar-gutter:stable]',
            bodyClassName,
          )}
        >
          {children}
        </ModalBody>
        {footer ? (
          <ModalFooter className="justify-end gap-2 border-0 bg-transparent px-4 py-3">
            {footer}
          </ModalFooter>
        ) : null}
      </ModalPanel>
    </ModalOverlay>
  )
}

export function Field({
  label, children, required, className,
}: { label: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <div className={cn('space-y-0.5', className)}>
      <Label required={required} className="text-xs leading-none text-muted-foreground">{label}</Label>
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
    <tr>
      <td colSpan={cols} className="px-6 py-12 text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </td>
    </tr>
  )
}

export function EmptyRow({
  cols, message, action,
}: { cols: number; message: string; action?: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-6 py-16 text-center">
        <p className="mb-3 text-sm text-muted-foreground">{message}</p>
        {action}
      </td>
    </tr>
  )
}
