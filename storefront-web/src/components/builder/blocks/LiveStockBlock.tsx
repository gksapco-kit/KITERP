import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import BlockEmptyPlaceholder from '@/components/builder/BlockEmptyPlaceholder'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isBlockFieldHidden, resolveBlockTextField } from '@/lib/blockHiddenFields'

interface Props { site: PublicSite; style: StyleConfig; props: Record<string, unknown>; liveItems: LiveItem[]; branchCode?: string | null; blockId?: string }

export default function LiveStockBlock({ style, props, liveItems, blockId }: Props) {
  const { storePath } = useVendor()
  const builderCanvas = useBuilderCanvas()
  const isEditorCanvas = builderCanvas?.isEditorCanvas && !!blockId
  const title = resolveBlockTextField(props, 'title', {
    fallback: () => (isEditorCanvas ? null : 'In stock now'),
  })
  const showTitle = !isBlockFieldHidden(props, 'title') && (title || isEditorCanvas)
  if (liveItems.length === 0) {
    return (
      <BlockEmptyPlaceholder
        style={style}
        title={title ?? undefined}
        message="Live stock levels will appear here once you add products to your catalog."
        hint="Add products from Products in your dashboard, then connect this section to your catalog."
        icon={<Package className="w-10 h-10" style={{ color: style.primary_color }} />}
      />
    )
  }
  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {showTitle && (
        <BuilderTextField fieldKey="title" blockId={blockId} blockProps={props} value={title ?? ''} as="h3" className="text-xl font-bold text-gray-900 mb-4" placeholder="Section title" />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 px-3 font-semibold text-gray-600">Product</th>
              <th className="text-right py-2 px-3 font-semibold text-gray-600">Price</th>
              <th className="text-center py-2 px-3 font-semibold text-gray-600">Stock</th>
            </tr>
          </thead>
          <tbody>
            {liveItems.map(item => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 px-3">
                  <Link to={item.url ? storePath(item.url) : storePath('/products')} className="font-medium text-gray-900 hover:text-primary flex items-center gap-2">
                    {item.image_url && <img src={item.image_url} alt="" className="w-8 h-8 rounded-lg object-cover" loading="lazy" />}
                    {item.title}
                  </Link>
                </td>
                <td className="py-2 px-3 text-right font-semibold" style={{ color: style.primary_color }}>{item.price_formatted || '—'}</td>
                <td className="py-2 px-3 text-center">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.meta?.stock_status === 'out_of_stock' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                    {item.meta?.stock_status === 'out_of_stock' ? 'Out' : item.meta?.quantity != null ? `${item.meta.quantity} left` : 'In stock'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
