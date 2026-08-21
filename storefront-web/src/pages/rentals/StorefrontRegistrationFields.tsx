import { useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { mediaUrl } from '@/lib/utils'

export type StorefrontRegField = {
  id?: string
  key: string
  label: string
  type: string
  required?: boolean
  placeholder?: string
  help?: string
  content?: string
  options?: string[]
}

export function missingRequiredAnswers(
  fields: StorefrontRegField[],
  values: Record<string, string | boolean>,
) {
  return fields.filter((f) => {
    if (f.type === 'heading' || !f.required) return false
    const v = values[f.key]
    if (f.type === 'checkbox' || f.type === 'terms') return v !== true
    return !String(v ?? '').trim()
  })
}

function FormLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-medium leading-5 text-slate-800">
      {label}
      {required ? <span className="ml-0.5 font-semibold text-red-600">*</span> : null}
    </label>
  )
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
      const url = await onUpload(file)
      onChange(url)
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
          <img src={preview} alt="" className="h-28 w-28 rounded-lg border border-slate-200 object-cover" />
          {!disabled && (
            <button
              type="button"
              className="absolute -right-2 -top-2 rounded-full bg-white p-1 text-slate-500 shadow ring-1 ring-slate-200 hover:text-slate-800"
              onClick={() => onChange('')}
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-sm text-slate-600 hover:bg-slate-100">
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
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

export function StorefrontRegistrationFields({
  fields,
  values,
  onChange,
  onUploadImage,
  accent = '#0f766e',
  selectOptionsByKey,
}: {
  fields: StorefrontRegField[]
  values: Record<string, string | boolean>
  onChange: (key: string, value: string | boolean) => void
  onUploadImage?: (file: File) => Promise<string>
  accent?: string
  /** Override select options for specific field keys (e.g. room_no ← available sub-assets). */
  selectOptionsByKey?: Record<string, string[]>
}) {
  const inputClass =
    'h-11 rounded-lg border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:border-slate-400'
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
      {fields.map((field) => {
        const value = values[field.key]
        const overrideOptions = selectOptionsByKey?.[field.key]
        const asSelect = field.type === 'select' || (overrideOptions && overrideOptions.length > 0)
        const selectOptions = overrideOptions?.length ? overrideOptions : (field.options || [])
        const wide = field.type === 'textarea' || field.type === 'checkbox' || field.type === 'heading' || field.type === 'terms' || field.type === 'image'
        if (field.type === 'heading') {
          return (
            <div
              key={field.key}
              className="col-span-full rounded-lg px-3.5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white"
              style={{ background: accent }}
            >
              {field.label}
            </div>
          )
        }
        if (field.type === 'terms') {
          return (
            <div key={field.key} className="col-span-full space-y-2">
              <p className="text-sm font-medium text-slate-800">
                Terms and conditions
                {field.required ? <span className="ml-0.5 font-semibold text-red-600">*</span> : null}
              </p>
              <div className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-700">
                {field.content?.trim() || field.help?.trim() || 'Terms and conditions will appear here.'}
              </div>
              <label className="flex items-start gap-2.5 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  style={{ accentColor: accent }}
                  checked={Boolean(value)}
                  onChange={(e) => onChange(field.key, e.target.checked)}
                />
                <span>
                  <span className="font-medium">{field.label || 'I agree to the terms and conditions'}</span>
                  {field.required ? <span className="ml-0.5 font-semibold text-red-600">*</span> : null}
                </span>
              </label>
            </div>
          )
        }
        if (field.type === 'image') {
          return (
            <div key={field.key} className="col-span-full space-y-1">
              <FormLabel label={field.label} required={field.required} />
              <ImageUploadField
                value={typeof value === 'string' ? value : ''}
                onChange={(url) => onChange(field.key, url)}
                onUpload={onUploadImage}
              />
              {field.help ? <p className="text-xs text-slate-500">{field.help}</p> : null}
            </div>
          )
        }
        if (field.type === 'checkbox') {
          return (
            <label key={field.key} className="col-span-full flex items-start gap-2.5 text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
                style={{ accentColor: accent }}
                checked={Boolean(value)}
                onChange={(e) => onChange(field.key, e.target.checked)}
              />
              <span>
                <span className="font-medium">{field.label}</span>
                {field.required ? <span className="ml-0.5 font-semibold text-red-600">*</span> : null}
                {field.help ? <span className="mt-0.5 block text-xs font-normal text-slate-500">{field.help}</span> : null}
              </span>
            </label>
          )
        }
        return (
          <div key={field.key} className={wide ? 'col-span-full' : undefined}>
            <FormLabel label={field.label} required={field.required} />
            {field.type === 'textarea' ? (
              <textarea
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                placeholder={field.placeholder}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            ) : asSelect ? (
              <select
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-slate-400 focus:outline-none"
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                <option value="">Select…</option>
                {selectOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <Input
                type={field.type === 'phone' ? 'tel' : field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                placeholder={field.placeholder}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => onChange(field.key, e.target.value)}
                className={inputClass}
              />
            )}
            {field.help ? <p className="mt-1 text-xs text-slate-500">{field.help}</p> : null}
          </div>
        )
      })}
    </div>
  )
}
