import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  addColourPreset,
  applyColourSelection,
  COLOUR_PALETTE,
  normalizeHexColor,
} from '@/lib/productVariantPresets'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const DEFAULT_HEX = '#6366F1'

type Props = {
  vendorId?: string
  onAdded?: () => void
  compact?: boolean
}

export function AddColourPresetForm({ vendorId, onAdded, compact = false }: Props) {
  const initial = applyColourSelection(DEFAULT_HEX)
  const [name, setName] = useState(initial.name)
  const [hex, setHex] = useState(initial.hex)

  const resetForm = () => {
    const next = applyColourSelection(DEFAULT_HEX)
    setName(next.name)
    setHex(next.hex)
  }

  const selectColour = (nextHex: string, presetName?: string) => {
    const { hex: normalized, name: suggestedName } = applyColourSelection(nextHex)
    setHex(normalized)
    setName(presetName ?? suggestedName)
  }

  const handleHexInput = (raw: string) => {
    setHex(raw)
    const trimmed = raw.trim()
    if (!trimmed) return
    let h = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed
    if (h.length === 3) h = h.split('').map(c => c + c).join('')
    if (/^[0-9a-fA-F]{6}$/.test(h)) {
      const { hex: normalized, name: suggestedName } = applyColourSelection(`#${h}`)
      setHex(normalized)
      setName(suggestedName)
    }
  }

  const handleCreate = () => {
    const nameTrim = name.trim()
    if (!nameTrim) {
      toast.error('Select a colour first — the name will fill in automatically')
      return
    }
    addColourPreset({ name: nameTrim, hex: normalizeHexColor(hex) }, vendorId)
    toast.success(`Colour "${nameTrim}" added`)
    resetForm()
    onAdded?.()
  }

  const pickerHex = normalizeHexColor(hex)

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      <div className="space-y-2">
        <Label>Colour palette</Label>
        <p className="text-xs text-muted-foreground">Select a swatch to set the colour and name.</p>
        <div className="flex flex-wrap gap-2">
          {COLOUR_PALETTE.map(c => {
            const selected = pickerHex === c.hex.toUpperCase()
            return (
              <button
                key={c.hex}
                type="button"
                title={c.name}
                aria-label={c.name}
                aria-pressed={selected}
                onClick={() => selectColour(c.hex, c.name)}
                className={cn(
                  'h-8 w-8 rounded-full border-2 transition-transform hover:scale-105',
                  selected ? 'border-gray-800 ring-2 ring-primary/30 scale-105' : 'border-gray-200',
                  c.hex === '#FFFFFF' && !selected && 'border-gray-300',
                )}
                style={{ backgroundColor: c.hex }}
              />
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="add-colour-hex">Colour code</Label>
          <div className="flex items-center gap-2">
            <div
              className="relative h-9 w-9 shrink-0 rounded border-2 border-gray-300 overflow-hidden cursor-pointer"
              style={{ backgroundColor: pickerHex }}
              title="Pick colour"
            >
              <input
                type="color"
                value={pickerHex}
                onChange={e => selectColour(e.target.value.toUpperCase())}
                className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                aria-label="Colour picker"
              />
            </div>
            <Input
              id="add-colour-hex"
              value={hex}
              onChange={e => handleHexInput(e.target.value)}
              onBlur={e => selectColour(e.target.value)}
              placeholder="#6366F1"
              className="font-mono uppercase"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="add-colour-name">Colour name</Label>
          <Input
            id="add-colour-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Filled when you pick a colour — edit if needed"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleCreate}>Add colour</Button>
      </div>
    </div>
  )
}
