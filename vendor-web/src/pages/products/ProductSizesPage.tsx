import { Link } from 'react-router-dom'
import { ArrowLeft, Ruler, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AddSizePresetForm } from '@/components/products/AddSizePresetForm'
import { useProductVariantPresets } from '@/hooks/useProductVariantPresets'
import { removeSizePreset } from '@/lib/productVariantPresets'
import { useVendorStore } from '@/stores/vendorStore'
import { toast } from 'sonner'

export default function ProductSizesPage() {
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
          <Ruler className="w-6 h-6 text-indigo-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Sizes</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Save sizes here — they appear when you generate variants on a product.
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="py-5 px-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Add a size</h2>
          <AddSizePresetForm vendorId={vendorId} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-5 px-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Saved sizes</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {presets.sizes.length} size{presets.sizes.length !== 1 ? 's' : ''} saved
          </p>
          {presets.sizes.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-6 text-center rounded-lg border border-dashed border-gray-200">
              No sizes yet — add one above.
            </p>
          ) : (
            <ul className="space-y-2">
              {presets.sizes.map(s => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{s.size}</p>
                    <p className="text-xs text-gray-500">Code: <span className="font-mono font-medium">{s.value}</span></p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 shrink-0"
                    aria-label={`Remove ${s.size}`}
                    onClick={() => {
                      removeSizePreset(s.id, vendorId)
                      toast.success(`Removed size "${s.size}"`)
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
