import { useRef, useState } from 'react'
import { FileText, ImagePlus, Loader2, Paperclip, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SingleImagePreview } from '@/components/common/CatalogMediaLightbox'

export type QuoteFileValue = {
  name: string
  mime?: string
  size?: number
  dataUrl?: string
}

export function parseQuoteFile(raw: string): QuoteFileValue | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw) as QuoteFileValue
    if (parsed?.name || parsed?.dataUrl) return parsed
  } catch {
    /* legacy plain filename */
  }
  return raw.trim() ? { name: raw.trim() } : null
}

export function serializeQuoteFile(value: QuoteFileValue | null): string {
  if (!value?.name && !value?.dataUrl) return ''
  return JSON.stringify(value)
}

export function quoteFileIsEmpty(raw: string): boolean {
  const v = parseQuoteFile(raw)
  return !v?.name && !v?.dataUrl
}

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
const MAX_MEDIA_BYTES = 15 * 1024 * 1024

type QuoteFileFieldProps = {
  kind: 'document' | 'photo_video' | 'photo_document'
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

const MAX_ANY_FILE_BYTES = 20 * 1024 * 1024

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function isImageValue(value: QuoteFileValue | null): boolean {
  if (!value?.dataUrl) return false
  if (value.mime?.startsWith('image/')) return true
  return value.dataUrl.startsWith('data:image/')
}

export function QuoteFileField({ kind, value, onChange, placeholder, disabled }: QuoteFileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const parsed = parseQuoteFile(value)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const accept = kind === 'photo_document'
    ? undefined
    : kind === 'document'
      ? '.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'image/*,video/*'

  const maxBytes = kind === 'photo_document' ? MAX_ANY_FILE_BYTES : kind === 'document' ? MAX_DOCUMENT_BYTES : MAX_MEDIA_BYTES
  const label = kind === 'photo_document' ? 'Add photo / document' : kind === 'document' ? 'Attach document' : 'Add photo / video'
  const Icon = kind === 'photo_document' ? Paperclip : kind === 'document' ? FileText : ImagePlus

  const applyFile = async (file: File) => {
    setError(null)
    if (file.size > maxBytes) {
      setError(`File must be under ${Math.round(maxBytes / (1024 * 1024))} MB.`)
      return
    }
    setLoading(true)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      onChange(serializeQuoteFile({
        name: file.name,
        mime: file.type,
        size: file.size,
        dataUrl,
      }))
    } catch {
      setError('Could not read the selected file.')
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || disabled) return
    await applyFile(files[0])
  }

  const showImagePreview = isImageValue(parsed)

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled || loading}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || loading}
          onClick={() => inputRef.current?.click()}
          className="h-8 gap-1.5 text-xs"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
          {label}
        </Button>
        {showImagePreview && parsed?.dataUrl && (
          <SingleImagePreview
            url={parsed.dataUrl}
            alt={parsed.name || 'Uploaded image'}
            className="h-16 w-16 rounded-lg border overflow-hidden"
            imgClassName="h-16 w-16 object-cover"
            editable={!disabled}
            onSave={disabled ? undefined : applyFile}
          />
        )}
        {parsed?.name && !showImagePreview && (
          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs text-gray-700">
            <span className="truncate">{parsed.name}</span>
            {!disabled && (
              <button
                type="button"
                aria-label="Remove file"
                className="shrink-0 text-gray-400 hover:text-red-500"
                onClick={() => {
                  onChange('')
                  setError(null)
                }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        )}
        {parsed?.name && showImagePreview && !disabled && (
          <button
            type="button"
            aria-label="Remove file"
            className="text-xs text-gray-400 hover:text-red-500"
            onClick={() => {
              onChange('')
              setError(null)
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {placeholder && !parsed?.name && (
        <p className="text-xs text-gray-400">{placeholder}</p>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
