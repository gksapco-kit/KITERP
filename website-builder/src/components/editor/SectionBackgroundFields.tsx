import { ImageUploadField } from '../builder/ImageUploadField'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
    </label>
  )
}

export interface SectionBackgroundFieldsProps {
  backgroundImage?: string
  onBackgroundImageChange: (url: string) => void
  overlayOpacity?: number
  onOverlayOpacityChange: (opacity: number) => void
  showTiles?: boolean
  onShowTilesChange?: (show: boolean) => void
  tileToggleLabel?: string
}

export function SectionBackgroundFields({
  backgroundImage = '',
  onBackgroundImageChange,
  overlayOpacity = 0.5,
  onOverlayOpacityChange,
  showTiles,
  onShowTilesChange,
  tileToggleLabel = 'Logo tiles',
}: SectionBackgroundFieldsProps) {
  const hasBg = !!backgroundImage.trim()

  return (
    <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Section look</p>

      <ImageUploadField
        label="Background image (optional)"
        value={backgroundImage}
        onChange={onBackgroundImageChange}
      />

      {hasBg && (
        <Field label="Image overlay darkness">
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={overlayOpacity}
            onChange={(e) => onOverlayOpacityChange(parseFloat(e.target.value))}
            className="w-full"
          />
        </Field>
      )}

      {onShowTilesChange != null && showTiles != null && (
        <ToggleField label={tileToggleLabel} checked={showTiles} onChange={onShowTilesChange} />
      )}
    </div>
  )
}
