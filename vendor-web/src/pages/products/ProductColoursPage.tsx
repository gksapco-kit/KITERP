import { Link } from 'react-router-dom'
import { ArrowLeft, Palette, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AddColourPresetForm } from '@/components/products/AddColourPresetForm'
import { useProductVariantPresets } from '@/hooks/useProductVariantPresets'
import { removeColourPreset } from '@/lib/productVariantPresets'
import { useVendorStore } from '@/stores/vendorStore'
import { toast } from 'sonner'

export default function ProductColoursPage() {
  const vendorId = useVendorStore(s => s.vendor?.id)
  const { presets } = useProductVariantPresets(vendorId)

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link
          to="/products"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </Link>
        <div className="flex items-center gap-2">
          <Palette className="w-6 h-6 text-violet-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Colours</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Save colours here — they appear when you generate variants on a product.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="py-5 px-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Add a colour</h2>
          <AddColourPresetForm vendorId={vendorId} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-5 px-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Saved colours</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {presets.colours.length} colour{presets.colours.length !== 1 ? 's' : ''} saved
          </p>
          {presets.colours.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-6 text-center rounded-lg border border-dashed border-gray-200">
              No colours yet — add one above.
            </p>
          ) : (
            <ul className="space-y-2">
              {presets.colours.map(c => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5"
                >
                  <span
                    className="h-8 w-8 shrink-0 rounded-full border border-gray-200"
                    style={{ backgroundColor: c.hex }}
                    title={c.hex}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs font-mono text-gray-400">{c.hex}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 shrink-0"
                    aria-label={`Remove ${c.name}`}
                    onClick={() => {
                      removeColourPreset(c.id, vendorId)
                      toast.success(`Removed colour "${c.name}"`)
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
