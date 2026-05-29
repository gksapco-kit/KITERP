import { useRef } from 'react'
import { Upload } from 'lucide-react'

interface ImageUploadFieldProps {
  value?: string
  onChange: (url: string) => void
  label?: string
}

export function ImageUploadField({ value, onChange, label = 'Image' }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      onChange(result)
      if (inputRef.current) inputRef.current.value = ''
    }
    reader.onerror = () => {
      alert('Could not read image file. Try a smaller image or a URL instead.')
    }
    reader.readAsDataURL(file)
  }

  const displayUrl = value?.trim() || ''
  const isDataUrl = displayUrl.startsWith('data:')

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <span className="block text-xs font-medium text-gray-600">{label}</span>
      {displayUrl && (
        <img
          key={displayUrl.slice(0, 80)}
          src={displayUrl}
          alt="Preview"
          className="h-28 w-full rounded-lg border border-gray-200 object-cover"
        />
      )}
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 hover:border-brand-400 hover:bg-brand-50">
        <Upload className="h-3.5 w-3.5" />
        {displayUrl ? 'Replace image' : 'Upload image'}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
          onClick={(e) => e.stopPropagation()}
        />
      </label>
      <input
        type="url"
        value={isDataUrl ? '' : displayUrl}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        placeholder={isDataUrl ? 'Uploaded — paste URL to replace' : 'Or paste image URL'}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs"
      />
      {isDataUrl && (
        <p className="text-xs text-green-600">Image uploaded. Preview updates on canvas.</p>
      )}
    </div>
  )
}
