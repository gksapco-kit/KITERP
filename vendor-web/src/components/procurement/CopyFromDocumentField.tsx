import { useState } from 'react'
import { Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function CopyFromDocumentField({
  placeholder,
  onCopy,
  loading,
  copiedFrom,
  disabled,
}: {
  placeholder: string
  onCopy: (number: string) => Promise<void> | void
  loading?: boolean
  copiedFrom?: string | null
  disabled?: boolean
}) {
  const [number, setNumber] = useState('')

  const handleCopy = async () => {
    const value = number.trim()
    if (!value || loading || disabled) return
    await onCopy(value)
  }

  return (
    <div className="rounded-md border border-dashed border-blue-200 bg-blue-50/60 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Copy from document
          </p>
          <Input
            value={number}
            onChange={e => setNumber(e.target.value)}
            placeholder={placeholder}
            disabled={disabled || loading}
            className="h-8 w-full rounded-md border-blue-200 bg-white text-sm dark:border-blue-800"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleCopy()
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={disabled || loading || !number.trim()}
          onClick={() => void handleCopy()}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
          Copy
        </Button>
      </div>
      {copiedFrom ? (
        <p className="mt-1.5 text-[11px] text-green-700 dark:text-green-400">
          Copied from {copiedFrom}. A new document number is assigned when you save.
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-blue-700/80 dark:text-blue-300/80">
          Enter an existing document number to copy its header and lines into this draft.
        </p>
      )}
    </div>
  )
}
