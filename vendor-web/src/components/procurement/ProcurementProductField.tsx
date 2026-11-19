import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { useProducts } from '@/hooks/useVendor'

interface Props {
  value: string
  onChange: (id: string) => void
  label?: string
  required?: boolean
  className?: string
  /** Compact label + control spacing for dense modals */
  inline?: boolean
}

export function ProcurementProductField({
  value,
  onChange,
  label = 'Product',
  required = false,
  className,
  inline = false,
}: Props) {
  const { data: productsData, isLoading } = useProducts({ size: 500, status: 'active' })
  const products = productsData?.items ?? []
  const labelClass = inline ? 'text-[11px] text-muted-foreground' : 'text-xs'

  return (
    <div className={className}>
      <div className={inline ? 'space-y-0.5' : undefined}>
        <Label className={labelClass}>{label}{required ? ' *' : ''}</Label>
        <Select
          value={value}
          onChange={onChange}
          options={selectOptionsWithBlank(
            'Select product…',
            products.map(p => ({ value: p.id, label: p.name })),
          )}
          placeholder={isLoading ? 'Loading products…' : 'Select product…'}
          disabled={isLoading}
          className={inline ? 'h-8 text-sm' : 'mt-1'}
          aria-label={label}
        />
      </div>
      {!isLoading && products.length === 0 && (
        <p className={`text-xs text-amber-600 ${inline ? 'mt-0.5' : 'mt-1'}`}>No active products — add products under Inventory first.</p>
      )}
    </div>
  )
}
