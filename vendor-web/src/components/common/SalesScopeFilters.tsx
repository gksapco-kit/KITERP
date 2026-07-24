import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import { BranchSelect } from '@/components/common/BranchSelect'
import { SalesAreaSelect } from '@/components/common/SalesAreaSelect'
import { cn } from '@/lib/utils'

export interface SalesScopeFiltersProps {
  businessUnitId: string
  branchId: string
  salesAreaId: string
  onBusinessUnitChange: (id: string) => void
  onBranchChange: (id: string) => void
  onSalesAreaChange: (id: string) => void
  allowAll?: boolean
  disabled?: boolean
  className?: string
  /** Width classes applied to each select wrapper */
  itemClassName?: string
  /** Compact (h-8) vs default (h-10) control height */
  size?: 'sm' | 'md'
}

const SIZE_TRIGGER: Record<'sm' | 'md', string> = {
  sm: 'h-8 min-h-8 py-0 text-xs',
  md: 'h-9 min-h-9 py-0 text-sm',
}

/**
 * Standard Business Unit → Branch → Sales Area filter trio for sales module pages.
 */
export function SalesScopeFilters({
  businessUnitId,
  branchId,
  salesAreaId,
  onBusinessUnitChange,
  onBranchChange,
  onSalesAreaChange,
  allowAll = true,
  disabled,
  className,
  itemClassName,
  size = 'sm',
}: SalesScopeFiltersProps) {
  const triggerClassName = SIZE_TRIGGER[size]
  const buWidth = itemClassName ?? 'w-full min-w-[11.5rem] sm:w-[12.5rem]'
  const branchWidth = itemClassName ?? 'w-full min-w-[9rem] sm:w-[10rem]'
  const salesWidth = itemClassName ?? 'w-full min-w-[10.5rem] sm:w-[11.5rem]'

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
      <div className={buWidth}>
        <BusinessUnitSelect
          value={businessUnitId}
          onChange={onBusinessUnitChange}
          allowAll={allowAll}
          autoSelectDefault={false}
          disabled={disabled}
          triggerClassName={triggerClassName}
        />
      </div>
      <div className={branchWidth}>
        <BranchSelect
          businessUnitId={businessUnitId || null}
          value={branchId}
          onChange={onBranchChange}
          allowAll={allowAll}
          disabled={disabled}
          triggerClassName={triggerClassName}
        />
      </div>
      <div className={salesWidth}>
        <SalesAreaSelect
          businessUnitId={businessUnitId || null}
          branchId={branchId || null}
          value={salesAreaId}
          onChange={onSalesAreaChange}
          allowAll={allowAll}
          disabled={disabled}
          triggerClassName={triggerClassName}
          className="w-full min-w-0"
        />
      </div>
    </div>
  )
}
