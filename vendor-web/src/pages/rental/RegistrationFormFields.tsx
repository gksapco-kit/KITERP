import { useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FieldLabel } from '@/components/common/FieldLabel'
import { mediaUrl } from '@/lib/utils'
import type { RegistrationField, RegistrationTheme } from './registrationFormTemplates'

type Props = {
  fields: RegistrationField[]
  values: Record<string, string | boolean>
  onChange: (key: string, value: string | boolean) => void
  onUploadImage?: (file: File) => Promise<string>
  theme?: RegistrationTheme
  disabled?: boolean
}

function ImageUploadField({
  value,
  onChange,
  onUpload,
  disabled,
}: {
  value: string
  onChange: (url: string) => void
  onUpload?: (file: File) => Promise<string>
  disabled?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const preview = value ? mediaUrl(value) : ''

  const pick = async (file?: File | null) => {
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller')
      return
    }
    if (!onUpload) {
      const reader = new FileReader()
      reader.onload = () => onChange(String(reader.result || ''))
      reader.readAsDataURL(file)
      return
    }
    setBusy(true)
    try {
      onChange(await onUpload(file))
    } catch {
      setError('Could not upload image')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative inline-block">
          <img src={preview} alt="" className="h-28 w-28 rounded-lg border border-border object-cover" />
          {!disabled && (
            <button
              type="button"
              className="absolute -right-2 -top-2 rounded-full bg-background p-1 text-muted-foreground shadow ring-1 ring-border hover:text-foreground"
              onClick={() => onChange('')}
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-5 text-sm text-muted-foreground hover:bg-muted">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {busy ? 'Uploading…' : 'Upload image (optional)'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled || busy}
            onChange={(e) => {
              void pick(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export function RegistrationFormFields({ fields, values, onChange, onUploadImage, theme, disabled }: Props) {
  const accent = theme?.accent || '#0f766e'
  const layout = theme?.layout || 'card'
  const wrapClass =
    layout === 'split'
      ? 'grid gap-4 sm:grid-cols-2'
      : layout === 'minimal'
        ? 'space-y-3'
        : 'space-y-4'
  return (
    <div className={wrapClass}>
      {fields.map((field) => {
        const value = values[field.key]
        const span = field.type === 'textarea' || field.type === 'checkbox' || field.type === 'heading' || field.type === 'terms' || field.type === 'image' ? 'sm:col-span-2' : ''
        if (field.type === 'heading') {
          return (
            <div
              key={field.id || field.key}
              className={`${span} rounded-md px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white`}
              style={{ background: accent }}
            >
              {field.label}
            </div>
          )
        }
        if (field.type === 'terms') {
          return (
            <div key={field.id || field.key} className={`space-y-2 ${span}`}>
              <p className="text-sm font-medium text-foreground">
                Terms and conditions
                {field.required ? <span className="ml-0.5 font-semibold text-red-600">*</span> : null}
              </p>
              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm leading-6 text-foreground">
                {field.content?.trim() || 'Add the terms and conditions text in the form editor.'}
              </div>
              <label className="flex items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border"
                  style={{ accentColor: accent }}
                  checked={Boolean(value)}
                  disabled={disabled}
                  onChange={(e) => onChange(field.key, e.target.checked)}
                />
                <span>
                  <span className="font-medium text-foreground">{field.label || 'I agree to the terms and conditions'}</span>
                  {field.required ? <span className="ml-0.5 font-semibold text-red-600">*</span> : null}
                </span>
              </label>
            </div>
          )
        }
        if (field.type === 'image') {
          return (
            <div key={field.id || field.key} className={span}>
              <FieldLabel required={field.required}>{field.label}</FieldLabel>
              <ImageUploadField
                value={typeof value === 'string' ? value : ''}
                onChange={(url) => onChange(field.key, url)}
                onUpload={onUploadImage}
                disabled={disabled}
              />
              {field.help && <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>}
            </div>
          )
        }
        if (field.type === 'checkbox') {
          return (
            <label key={field.id || field.key} className={`flex items-start gap-2.5 text-sm ${span}`}>
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border"
                style={{ accentColor: accent }}
                checked={Boolean(value)}
                disabled={disabled}
                onChange={(e) => onChange(field.key, e.target.checked)}
              />
              <span>
                <span className="font-medium text-foreground">{field.label}</span>
                {field.required ? <span className="ml-0.5 font-semibold text-red-600">*</span> : null}
                {field.help && <span className="mt-0.5 block text-xs text-muted-foreground">{field.help}</span>}
              </span>
            </label>
          )
        }
        return (
          <div key={field.id || field.key} className={span}>
            <FieldLabel required={field.required}>{field.label}</FieldLabel>
            {field.type === 'textarea' ? (
              <Textarea
                rows={3}
                disabled={disabled}
                placeholder={field.placeholder}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            ) : field.type === 'select' ? (
              <select
                disabled={disabled}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                <option value="">Select…</option>
                {(field.options || []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <Input
                disabled={disabled}
                type={field.type === 'phone' ? 'tel' : field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                placeholder={field.placeholder}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            )}
            {field.help && <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>}
          </div>
        )
      })}
    </div>
  )
}
