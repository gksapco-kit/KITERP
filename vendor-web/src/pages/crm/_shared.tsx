import { type ReactNode, type FormEvent } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, X, Search, ChevronLeft, ChevronRight } from 'lucide-react'

export function CrmModal({
  title, onClose, children, maxW = 'max-w-lg',
}: { title: string; onClose: () => void; children: ReactNode; maxW?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxW} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10" onClick={e => e.stopPropagation()}>
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function Field({
  label, children, required,
}: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <div>
      <Label>{label}{required && <span className="text-red-500 ml-0.5">*</span>}</Label>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-10" />
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
    <div className="flex items-center justify-between px-6 py-3 border-t bg-gray-50">
      <span className="text-xs text-gray-500">Page {page} of {pages} ({total} total)</span>
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
      <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
    </td></tr>
  )
}

export function EmptyRow({
  cols, message, action,
}: { cols: number; message: string; action?: ReactNode }) {
  return (
    <tr><td colSpan={cols} className="px-6 py-16 text-center">
      <p className="text-sm text-gray-500 mb-3">{message}</p>
      {action}
    </td></tr>
  )
}
