import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { useProducts } from '@/hooks/useVendor'

interface Props {
  value: string
  onChange: (id: string) => void
  label?: string
  required?: boolean
  className?: string
}

export function ProcurementProductField({
  value,
  onChange,
  label = 'Product',
  required = false,
  className,
}: Props) {
  const { data: productsData, isLoading } = useProducts({ size: 500, status: 'active' })
  const products = productsData?.items ?? []

  return (
    <div className={className}>
      <Label className="text-xs">{label}{required ? ' *' : ''}</Label>
      <Select
        value={value}
        onChange={onChange}
        options={selectOptionsWithBlank(
          'Select product…',
          products.map(p => ({ value: p.id, label: p.name })),
        )}
        placeholder={isLoading ? 'Loading products…' : 'Select product…'}
        disabled={isLoading}
        className="mt-1"
        aria-label={label}
      />
      {!isLoading && products.length === 0 && (
        <p className="text-xs text-amber-600 mt-1">No active products — add products under Inventory first.</p>
      )}
    </div>
  )
}
