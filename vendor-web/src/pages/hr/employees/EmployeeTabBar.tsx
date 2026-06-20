import { cn } from '@/lib/utils'
import { EMPLOYEE_MASTER_TABS, EMPLOYEE_OPS_TABS, type EmployeeTabId } from './employeeMasterTabs'
import { hrTabActiveClass, hrTabInactiveClass } from '../hrFormUi'

export function EmployeeTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: EmployeeTabId
  onTabChange: (id: EmployeeTabId) => void
}) {
  const tabBtn = (isActive: boolean) =>
    cn(
      'flex min-w-[72px] flex-1 flex-col items-center justify-center gap-1 border-b-2 py-2.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-0',
      isActive ? hrTabActiveClass : hrTabInactiveClass,
    )

  return (
    <div className="flex shrink-0 overflow-x-auto rounded-t-xl border-b border-border bg-card">
      {EMPLOYEE_MASTER_TABS.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={tabBtn(isActive)}
          >
            <tab.icon className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap px-1">{tab.label}</span>
          </button>
        )
      })}
      <div className="my-1 w-px shrink-0 self-stretch bg-border" aria-hidden />
      {EMPLOYEE_OPS_TABS.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={tabBtn(isActive)}
          >
            <tab.icon className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap px-1">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
