import { cn } from '@/lib/utils'
import { STORE_CONTENT_GROUPS, type StoreContentGroup } from '@/lib/blockDataSources'

type GroupTab = { id: StoreContentGroup; label: string; desc: string }

type StoreContentGroupTabsProps = {
  activeGroup: StoreContentGroup
  onGroupChange: (group: StoreContentGroup) => void
  /** Override labels/tooltips (e.g. link picker vs store data). */
  groups?: GroupTab[]
  /** Groups that show a small “recommended” dot (store data panel). */
  recommendedGroupIds?: Iterable<StoreContentGroup>
  className?: string
}

/** Two-row tab grid for narrow builder panels — no horizontal scroll. */
export function StoreContentGroupTabs({
  activeGroup,
  onGroupChange,
  groups = STORE_CONTENT_GROUPS,
  recommendedGroupIds,
  className,
}: StoreContentGroupTabsProps) {
  const recommended = recommendedGroupIds
    ? new Set(recommendedGroupIds)
    : null

  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-1 rounded-lg border border-gray-100 bg-gray-50 p-1',
        className,
      )}
      role="tablist"
      aria-label="Content groups"
    >
      {groups.map(g => {
        const tabActive = activeGroup === g.id
        const hasRecommended = recommended?.has(g.id) ?? false
        return (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={tabActive}
            onClick={() => onGroupChange(g.id)}
            className={cn(
              'relative rounded-md px-1.5 py-2 text-[11px] font-medium leading-tight text-center transition-colors',
              tabActive
                ? 'bg-white text-primary shadow-sm ring-1 ring-primary/20'
                : 'text-gray-500 hover:bg-white/70 hover:text-primary',
            )}
            title={g.desc}
          >
            <span className="block truncate">{g.label}</span>
            {hasRecommended && !tabActive ? (
              <span
                className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400"
                aria-hidden
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
