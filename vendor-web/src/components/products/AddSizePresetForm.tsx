import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SizePresetPicker } from '@/components/products/SizePresetPicker'
import {
  addSizePreset,
  matchSizePaletteEntry,
  validateSizePresetInput,
  type SizePaletteEntry,
} from '@/lib/productVariantPresets'
import { toast } from 'sonner'

type Props = {
  vendorId?: string
  onAdded?: () => void
}

export function AddSizePresetForm({ vendorId, onAdded }: Props) {
  const [size, setSize] = useState('')
  const [value, setValue] = useState('')
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  const selectPreset = (preset: SizePaletteEntry) => {
    setSize(preset.size)
    setValue(preset.value)
    setSelectedPreset(preset.value)
  }

  const syncPresetSelection = (nextSize: string, nextValue: string) => {
    const match = matchSizePaletteEntry(nextSize, nextValue)
    setSelectedPreset(match?.value ?? null)
  }

  const resetForm = () => {
    setSize('')
    setValue('')
    setSelectedPreset(null)
  }

  const handleCreate = () => {
    const validated = validateSizePresetInput({ size, value }, vendorId)
    if (!validated.ok) {
      toast.error(validated.message)
      return
    }
    try {
      addSizePreset({ size: validated.size, value: validated.value }, vendorId)
      toast.success(`Size "${validated.size}" (${validated.value}) added`)
      resetForm()
      onAdded?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add size')
    }
  }

  return (
    <div className="space-y-4">
      <SizePresetPicker selectedValue={selectedPreset} onSelect={selectPreset} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="add-size-name">Size</Label>
          <Input
            id="add-size-name"
            value={size}
            onChange={e => {
              setSize(e.target.value)
              syncPresetSelection(e.target.value, value)
            }}
            placeholder="Filled when you pick a size — edit if needed"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="add-size-code">Value</Label>
          <Input
            id="add-size-code"
            value={value}
            onChange={e => {
              setValue(e.target.value)
              syncPresetSelection(size, e.target.value)
            }}
            placeholder="Filled when you pick a size — edit if needed"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        One size per row — pick a common size above or type your own. Add each size separately.
      </p>
      <div className="flex justify-end">
        <Button type="button" onClick={handleCreate}>Add size</Button>
      </div>
    </div>
  )
}
