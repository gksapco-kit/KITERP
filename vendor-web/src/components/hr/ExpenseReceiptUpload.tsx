import { useRef, useState } from 'react'
import { Upload, X, FileIcon, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

export type ExpenseReceipt = { url: string; name?: string }

type Props = {
  receipts: ExpenseReceipt[]
  onChange: (receipts: ExpenseReceipt[]) => void
  uploadFile: (file: File) => Promise<{ url: string; name?: string }>
  disabled?: boolean
}

export function ExpenseReceiptUpload({ receipts, onChange, uploadFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length || disabled) return
    setUploading(true)
    const added: ExpenseReceipt[] = []
    try {
      for (const file of Array.from(fileList)) {
        const result = await uploadFile(file)
        added.push({ url: result.url, name: result.name ?? file.name })
      }
      onChange([...receipts, ...added])
    } catch {
      toast.error('Could not upload file. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  function removeAt(index: number) {
    onChange(receipts.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-gray-700 mb-1">Receipts &amp; attachments</span>
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        className="w-full border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-primary/50 hover:bg-gray-50/80 transition-colors disabled:opacity-50 disabled:pointer-events-none"
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400 py-1">
            <Upload className="w-8 h-8" />
            <p className="text-sm text-gray-600">Click to upload documents or media</p>
            <p className="text-xs">Images, PDF, Office files, video — no size limit</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.heic,.heif"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </button>

      {receipts.length > 0 && (
        <ul className="space-y-1.5">
          {receipts.map((r, i) => (
            <li
              key={`${r.url}-${i}`}
              className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2 text-sm"
            >
              <FileIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="flex-1 truncate text-gray-800" title={r.name ?? r.url}>
                {r.name ?? r.url.split('/').pop()}
              </span>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="p-1 text-gray-400 hover:text-blue-600"
                title="View"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="p-1 text-gray-400 hover:text-red-600"
                  title="Remove"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
