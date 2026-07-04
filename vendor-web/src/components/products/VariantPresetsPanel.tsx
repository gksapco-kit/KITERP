import { ChevronDown, ChevronUp, Palette, Ruler, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useProductVariantPresets } from '@/hooks/useProductVariantPresets'
import { removeColourPreset, removeSizePreset } from '@/lib/productVariantPresets'
import { toast } from 'sonner'

type Props = {
  vendorId?: string
}

export function VariantPresetsPanel({ vendorId }: Props) {
  const { presets } = useProductVariantPresets(vendorId)
  const [open, setOpen] = useState(true)
  const total = presets.colours.length + presets.sizes.length

  if (total === 0) {
    return (
      <Card className="border-dashed border-gray-200 bg-gray-50/50">
        <CardContent className="py-3 px-4">
          <p className="text-sm text-gray-500">
            No saved colours or sizes yet. Use <strong>Add Colours</strong> or <strong>Add Sizes</strong> above — they appear here and when you add product variants.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-gray-200/80">
      <CardContent className="py-3 px-4 space-y-3">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <div>
            <p className="text-sm font-semibold text-gray-900">Saved colours &amp; sizes</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {presets.colours.length} colour{presets.colours.length !== 1 ? 's' : ''}, {presets.sizes.length} size{presets.sizes.length !== 1 ? 's' : ''} — reused in new products under Generate from options
            </p>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
        </button>

        {open && (
          <div className="grid gap-4 sm:grid-cols-2 pt-1 border-t border-gray-100">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 flex items-center gap-1.5 mb-2">
                <Palette className="w-3.5 h-3.5" /> Colours
              </p>
              {presets.colours.length === 0 ? (
                <p className="text-xs text-gray-400 italic">None saved</p>
              ) : (
                <ul className="space-y-1.5">
                  {presets.colours.map(c => (
                    <li key={c.id} className="flex items-center gap-2 rounded-md border border-gray-100 bg-white px-2 py-1.5 text-sm">
                      <span
                        className="h-5 w-5 shrink-0 rounded-full border border-gray-200"
                        style={{ backgroundColor: c.hex }}
                        title={c.hex}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{c.name}</span>
                      <span className="text-[10px] font-mono text-gray-400 shrink-0">{c.hex}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                        aria-label={`Remove ${c.name}`}
                        onClick={() => {
                          removeColourPreset(c.id, vendorId)
                          toast.success(`Removed colour "${c.name}"`)
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 flex items-center gap-1.5 mb-2">
                <Ruler className="w-3.5 h-3.5" /> Sizes
              </p>
              {presets.sizes.length === 0 ? (
                <p className="text-xs text-gray-400 italic">None saved</p>
              ) : (
                <ul className="space-y-1.5">
                  {presets.sizes.map(s => (
                    <li key={s.id} className="flex items-center gap-2 rounded-md border border-gray-100 bg-white px-2 py-1.5 text-sm">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium text-gray-800">{s.size}</span>
                        <span className="text-gray-400 mx-1">·</span>
                        <span className="text-gray-600">{s.value}</span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                        aria-label={`Remove size ${s.size}`}
                        onClick={() => {
                          removeSizePreset(s.id, vendorId)
                          toast.success(`Removed size "${s.size}"`)
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
