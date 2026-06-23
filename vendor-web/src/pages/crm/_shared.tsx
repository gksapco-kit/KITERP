import { type ReactNode, type FormEvent } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { onModalBackdropClick } from '@/lib/utils'
import {
  modalBodyPadClass,
  modalCloseBtnClass,
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
import { Loader2, X, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CrmModal({
  title, onClose, children, maxW = modalWidthLg, headerActions,
}: { title: ReactNode; onClose: () => void; children: ReactNode; maxW?: string; headerActions?: ReactNode }) {
  useEscapeToClose(onClose)

  return (
    <div data-kiterp-modal className={modalOverlayCenterClass} onClick={onModalBackdropClick(onClose)}>
      <div
        className={cn(modalPanel2xlClass, maxW)}
        onClick={e => e.stopPropagation()}
      >
        <div className={modalHeaderStickyClass}>
          <h2 className={cn(modalTitleClass, 'truncate')}>{title}</h2>
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            <button type="button" aria-label="Close" onClick={onClose} className={modalCloseBtnClass}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className={modalBodyPadClass}>{children}</div>
      </div>
    </div>
  )
}

export function Field({
  label, children, required,
}: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <div>
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
}: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-muted/30">
      <span className="text-xs text-muted-foreground">Page {page} of {pages} ({total} total)</span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
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
