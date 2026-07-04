import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addSizePreset } from '@/lib/productVariantPresets'
import { toast } from 'sonner'

type Props = {
  vendorId?: string
  onAdded?: () => void
}

export function AddSizePresetForm({ vendorId, onAdded }: Props) {
  const [size, setSize] = useState('')
  const [value, setValue] = useState('')

  const handleCreate = () => {
    const sizeTrim = size.trim()
    const valueTrim = value.trim()
    if (!sizeTrim) {
      toast.error('Enter a size name (e.g. Small, Medium, Large)')
      return
    }
    if (!valueTrim) {
      toast.error('Enter a size code (e.g. S, M, L, XL)')
      return
    }
    addSizePreset({ size: sizeTrim, value: valueTrim }, vendorId)
    toast.success(`Size "${sizeTrim}" (${valueTrim}) added`)
    setSize('')
    setValue('')
    onAdded?.()
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="add-size-name">Size</Label>
          <Input
            id="add-size-name"
            value={size}
            onChange={e => setSize(e.target.value)}
            placeholder="e.g. Small, Medium, Large"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="add-size-code">Value</Label>
          <Input
            id="add-size-code"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="e.g. S, M, L, XL"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate() } }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Size is the display name; Value is the short code used in variants (S, M, L, XL).
      </p>
      <div className="flex justify-end">
        <Button type="button" onClick={handleCreate}>Add size</Button>
      </div>
    </div>
  )
}
