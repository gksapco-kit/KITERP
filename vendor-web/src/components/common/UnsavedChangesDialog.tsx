import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModalOverlay, ModalPanel } from '@/components/ui/Modal'

type Props = {
  open: boolean
  saving?: boolean
  title?: string
  message?: string
  onCancel: () => void
  onDiscard: () => void
  onSave: () => void
}

export function UnsavedChangesDialog({
  open,
  saving = false,
  title = 'Unsaved changes',
  message = 'You have unsaved changes. Save before leaving, or discard them to continue.',
  onCancel,
  onDiscard,
  onSave,
}: Props) {
  if (!open) return null

  return (
    <ModalOverlay onClose={saving ? () => {} : onCancel}>
      <ModalPanel className="max-w-md p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="ghost" disabled={saving} onClick={onDiscard} className="text-destructive hover:text-destructive">
            Discard changes
          </Button>
          <Button type="button" disabled={saving} onClick={onSave} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save &amp; continue
          </Button>
        </div>
      </ModalPanel>
    </ModalOverlay>
  )
}
