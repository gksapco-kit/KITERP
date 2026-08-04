import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Loader2, MoreVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formEditLayout } from '@/components/common/FormSectionNav'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
]

function statusTriggerClass(status: string) {
  return cn(
    'h-8 min-w-[6.25rem] rounded-md border px-2.5 text-xs font-semibold shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:px-3 sm:text-sm',
    status === 'active'
      ? 'border-primary/35 bg-primary/10 text-primary'
      : status === 'archived'
        ? 'border-destructive/35 bg-destructive/10 text-destructive'
        : 'border-border bg-muted/50 text-foreground',
  )
}

export type CatalogEditStickyBarProps = {
  backLabel?: string
  onBack: () => void
  title: string
  /** Optional chip next to the title (e.g. product type). */
  badge?: ReactNode
  status: string
  onStatusChange: (value: string) => void
  visibleControl: ReactNode
  onSave: () => void
  saveLabel: string
  /** Shorter label on very small screens (defaults to "Save"). */
  saveLabelShort?: string
  isSaving?: boolean
  isEdit?: boolean
  onDelete?: () => void
  isDeleting?: boolean
  deleteConfirmMessage?: string
}

export function CatalogEditStickyBar({
  backLabel = 'Back',
  onBack,
  title,
  badge,
  status,
  onStatusChange,
  visibleControl,
  onSave,
  saveLabel,
  saveLabelShort = 'Save',
  isSaving = false,
  isEdit = false,
  onDelete,
  isDeleting = false,
  deleteConfirmMessage = 'Delete this item?',
}: CatalogEditStickyBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0, openUp: false })

  useEffect(() => {
    if (!menuOpen || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuHeight = 240
    const openUp = window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight
    setMenuPos({
      top: openUp ? rect.top + window.scrollY - 4 : rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
      openUp,
    })
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) return
      setMenuOpen(false)
      setConfirmDelete(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const statusSelect = (
    <Select
      value={status}
      onChange={onStatusChange}
      options={STATUS_OPTIONS}
      aria-label="Status"
      className="min-w-[6.25rem] w-auto"
      triggerClassName={statusTriggerClass(status)}
    />
  )

  const deleteButton = isEdit && onDelete ? (
    confirmDelete ? (
      <div className="flex items-center gap-1.5">
        <span className="hidden text-xs text-red-600 lg:inline">{deleteConfirmMessage}</span>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isDeleting}
          onClick={() => {
            onDelete()
            setConfirmDelete(false)
            setMenuOpen(false)
          }}
        >
          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirm'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
          Cancel
        </Button>
      </div>
    ) : (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 border-red-500/35 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/15"
        onClick={() => setConfirmDelete(true)}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </Button>
    )
  ) : null

  const saveButton = (
    <Button type="button" onClick={onSave} disabled={isSaving} size="sm" className="shrink-0">
      {isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
      <span className="sm:hidden">{saveLabelShort}</span>
      <span className="hidden sm:inline">{saveLabel}</span>
    </Button>
  )

  const mobileMenu = menuOpen
    ? createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top: menuPos.top,
            right: menuPos.right,
            zIndex: 9999,
            transform: menuPos.openUp ? 'translateY(-100%)' : undefined,
          }}
          className="w-52 rounded-lg border border-border bg-popover py-2 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <div className="space-y-2 px-3 pb-2">
            <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
            {statusSelect}
          </div>
          <div className="border-t px-3 py-2">{visibleControl}</div>
          {isEdit && onDelete && (
            <>
              <div className="border-t my-1" />
              {confirmDelete ? (
                <div className="space-y-2 px-3 py-2">
                  <p className="text-xs font-medium text-red-600">{deleteConfirmMessage}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                      disabled={isDeleting}
                      onClick={() => {
                        onDelete()
                        setMenuOpen(false)
                        setConfirmDelete(false)
                      }}
                    >
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      className="btn-cancel flex-1 rounded px-2 py-1.5 text-xs font-medium"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              )}
            </>
          )}
        </div>,
        document.body,
      )
    : null

  return (
    <div className={formEditLayout.stickyBar}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" className="shrink-0 text-foreground" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {backLabel}
          </Button>
          <h1 className="min-w-0 truncate text-base font-bold text-foreground sm:text-xl">{title}</h1>
          {badge}
          {isEdit ? (
            <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
              Editing
            </span>
          ) : null}
        </div>

        <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
          {statusSelect}
          <div className="flex h-9 items-center">{visibleControl}</div>
          {deleteButton}
          {saveButton}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
          {saveButton}
          <button
            ref={triggerRef}
            type="button"
            aria-label="More actions"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            onClick={() => {
              setMenuOpen((v) => !v)
              setConfirmDelete(false)
            }}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {mobileMenu}
        </div>
      </div>
    </div>
  )
}
