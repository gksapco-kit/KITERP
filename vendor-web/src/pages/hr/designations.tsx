import { useMemo, useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { Plus, Pencil, Trash2, Award, Search, X, Layers, UserCheck, UserX } from 'lucide-react'
import { useHRDesignations, useDeleteHRDesignation, useHREmployees } from '@/hooks/useVendor'
import { DesigModal } from '@/components/hr/DesigModal'
import type { EmployeeProfile, HRDesignation } from '@/types'
import { askConfirm } from '@/components/common/ConfirmProvider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  hrCardClass,
  hrEmptyStateClass,
  hrInputClass,
  hrStatIconClass,
  hrStatusBadge,
  hrTableHeadClass,
} from './hrFormUi'

type StatusFilter = '' | 'active' | 'inactive'

function seniorityLabel(level: number): string {
  if (level >= 8) return 'Leadership'
  if (level >= 5) return 'Senior'
  if (level >= 3) return 'Mid-level'
  return 'Junior'
}

function levelTone(level: number): string {
  if (level >= 8) return 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
  if (level >= 5) return 'bg-primary/15 text-primary'
  if (level >= 3) return 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
  return 'bg-muted text-muted-foreground'
}

export default function DesignationsPage() {
  const { data: designations = [], isLoading } = useHRDesignations()
  const { data: empData } = useHREmployees({ limit: 200, status: 'active' })
  const deleteDesig = useDeleteHRDesignation()
  const [modal, setModal] = useState<{ open: boolean; desig?: HRDesignation | null }>({ open: false })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')

  const employees: EmployeeProfile[] = empData?.items ?? []
  const headcountByDesig = useMemo(() => {
    const map: Record<string, number> = {}
    for (const emp of employees) {
      if (!emp.designation_id) continue
      map[emp.designation_id] = (map[emp.designation_id] ?? 0) + 1
    }
    return map
  }, [employees])

  const stats = useMemo(() => {
    const active = designations.filter(d => d.is_active).length
    const levels = new Set(designations.map(d => d.level)).size
    return { total: designations.length, active, inactive: designations.length - active, levels }
  }, [designations])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...designations]
      .filter(d => {
        if (statusFilter === 'active' && !d.is_active) return false
        if (statusFilter === 'inactive' && d.is_active) return false
        if (!q) return true
        return d.name.toLowerCase().includes(q) || `l${d.level}`.includes(q) || seniorityLabel(d.level).toLowerCase().includes(q)
      })
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name))
  }, [designations, search, statusFilter])

  const hasFilters = Boolean(search || statusFilter)
  const maxLevel = Math.max(1, ...designations.map(d => d.level), 1)

  function clearFilters() {
    setSearch('')
    setStatusFilter('')
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Designations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Job titles and seniority levels
            {stats.total > 0 ? ` · ${stats.total} role${stats.total === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <Button type="button" onClick={() => setModal({ open: true, desig: null })}>
          <Plus className="h-4 w-4" /> Add Designation
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { key: '' as StatusFilter, label: 'Total roles', value: stats.total, icon: Award, color: 'blue' },
          { key: 'active' as StatusFilter, label: 'Active', value: stats.active, icon: UserCheck, color: 'green' },
          { key: 'inactive' as StatusFilter, label: 'Inactive', value: stats.inactive, icon: UserX, color: 'yellow' },
          { key: '' as StatusFilter, label: 'Levels in use', value: stats.levels, icon: Layers, color: 'purple', lock: true },
        ].map(({ key, label, value, icon: Icon, color, lock }) => {
          const isTotal = !lock && key === ''
          const active = lock ? false : isTotal ? !statusFilter : statusFilter === key
          return (
            <button
              key={label}
              type="button"
              disabled={lock}
              onClick={() => {
                if (lock) return
                setStatusFilter(prev => (key && prev === key ? '' : key))
              }}
              className={cn(
                'flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left transition-colors',
                lock && 'cursor-default',
                !lock && active
                  ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border hover:border-primary/30 hover:bg-muted/30',
              )}
            >
              <div className={cn('inline-flex shrink-0 rounded-lg p-2', hrStatIconClass[color])}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none text-foreground">{value}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{label}</p>
              </div>
            </button>
          )
        })}
      </div>

      <div className={hrCardClass}>
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className={cn(hrInputClass, 'h-10 pl-9')}
              placeholder="Search title, level, or seniority…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search designations"
            />
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-10 items-center gap-1 px-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:ml-auto"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : designations.length === 0 ? (
          <div className={cn(hrEmptyStateClass, 'border-0')}>
            <Award className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No designations yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add job titles so employees can be assigned a role and seniority level.
            </p>
            <div className="mt-4 flex justify-center">
              <Button type="button" size="sm" onClick={() => setModal({ open: true, desig: null })}>
                <Plus className="h-4 w-4" /> Add Designation
              </Button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Award className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No designations match</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search or clear filters.</p>
            <div className="mt-4 flex justify-center">
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className={hrTableHeadClass}>
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide">
                    <TableColumnLabel>Title</TableColumnLabel>
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide">
                    <TableColumnLabel>Level</TableColumnLabel>
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide">
                    <TableColumnLabel>People</TableColumnLabel>
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide">
                    <TableColumnLabel>Status</TableColumnLabel>
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(desig => {
                  const people = headcountByDesig[desig.id] ?? 0
                  const width = Math.max(18, Math.round((desig.level / maxLevel) * 100))
                  return (
                    <tr key={desig.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Award className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{desig.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {seniorityLabel(desig.level)} · L{desig.level}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-[7.5rem]">
                          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', levelTone(desig.level))}>
                            L{desig.level}
                          </span>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary/70" style={{ width: `${width}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {people === 0 ? '—' : `${people} employee${people === 1 ? '' : 's'}`}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-medium',
                            desig.is_active ? hrStatusBadge.active : hrStatusBadge.archived,
                          )}
                        >
                          {desig.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setModal({ open: true, desig })}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                            title="Edit designation"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (await askConfirm(`Delete "${desig.name}"?`)) deleteDesig.mutate(desig.id)
                            }}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            title="Delete designation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.open && (
        <DesigModal desig={modal.desig} onClose={() => setModal({ open: false })} />
      )}
    </div>
  )
}
