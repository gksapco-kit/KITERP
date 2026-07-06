import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
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
  onClose: () => void
  onCreated?: () => void
}

export function AddSizeOptionModal({ vendorId, onClose, onCreated }: Props) {
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

  const handleCreate = () => {
    const validated = validateSizePresetInput({ size, value }, vendorId)
    if (!validated.ok) {
      toast.error(validated.message)
      return
    }
    try {
      addSizePreset({ size: validated.size, value: validated.value }, vendorId)
      toast.success(`Size "${validated.size}" (${validated.value}) added`)
      onCreated?.()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add size')
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <ModalPanel className="max-w-md w-full">
        <ModalHeader
          title="Add a size"
          subtitle={
            <p className="text-sm text-muted-foreground mt-0.5">
              Pick a common size or enter your own — one name and one code per entry.
            </p>
          }
          onClose={onClose}
        />
        <ModalBody className="px-6 py-4 space-y-4">
          <SizePresetPicker selectedValue={selectedPreset} onSelect={selectPreset} />
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
              autoFocus
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
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={handleCreate}>Create</Button>
        </ModalFooter>
      </ModalPanel>
    </ModalOverlay>
  )
}
