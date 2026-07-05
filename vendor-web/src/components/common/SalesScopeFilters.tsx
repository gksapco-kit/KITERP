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
  itemClassName?: string
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
  itemClassName = 'w-full min-w-[8.5rem] sm:w-[9.5rem]',
}: SalesScopeFiltersProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 sm:gap-3 min-w-0', className)}>
      <div className={itemClassName}>
        <BusinessUnitSelect
          value={businessUnitId}
          onChange={onBusinessUnitChange}
          allowAll={allowAll}
          autoSelectDefault={false}
          disabled={disabled}
        />
      </div>
      <div className={itemClassName}>
        <BranchSelect
          businessUnitId={businessUnitId || null}
          value={branchId}
          onChange={onBranchChange}
          allowAll={allowAll}
          disabled={disabled}
        />
      </div>
      <div className={itemClassName}>
        <SalesAreaSelect
          businessUnitId={businessUnitId || null}
          branchId={branchId || null}
          value={salesAreaId}
          onChange={onSalesAreaChange}
          allowAll={allowAll}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
