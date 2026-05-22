import { EMPLOYEE_MASTER_TABS, EMPLOYEE_OPS_TABS, type EmployeeTabId } from './employeeMasterTabs'

export function EmployeeTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: EmployeeTabId
  onTabChange: (id: EmployeeTabId) => void
}) {
  return (
    <div className="flex shrink-0 border-b overflow-x-auto bg-white rounded-t-xl">
      {EMPLOYEE_MASTER_TABS.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex min-w-[72px] flex-1 flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              isActive
                ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap px-1">{tab.label}</span>
          </button>
        )
      })}
      <div className="w-px shrink-0 bg-gray-200 self-stretch my-1" aria-hidden />
      {EMPLOYEE_OPS_TABS.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex min-w-[72px] flex-1 flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              isActive
                ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap px-1">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
