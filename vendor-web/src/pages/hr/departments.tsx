import { useMemo, useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { askConfirm } from '@/components/common/ConfirmProvider'
import { Plus, Pencil, Trash2, Building2, ChevronRight, Search, X, GitBranch, UserCheck, UserX } from 'lucide-react'
import { useHRDepartments, useDeleteHRDepartment, useHREmployees } from '@/hooks/useVendor'
import { DeptModal } from '@/components/hr/DeptModal'
import type { EmployeeProfile, HRDepartment } from '@/types'
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

export default function DepartmentsPage() {
  const { data: departments = [], isLoading } = useHRDepartments()
  const { data: empData } = useHREmployees({ limit: 200, status: 'active' })
  const deleteDept = useDeleteHRDepartment()
  const [modal, setModal] = useState<{ open: boolean; dept?: HRDepartment | null }>({ open: false })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')

  const allDepts = departments as HRDepartment[]
  const byId = useMemo(() => new Map(allDepts.map(d => [d.id, d])), [allDepts])
  const employees: EmployeeProfile[] = empData?.items ?? []

  const headcountByDept = useMemo(() => {
    const map: Record<string, number> = {}
    for (const emp of employees) {
      if (!emp.department_id) continue
      map[emp.department_id] = (map[emp.department_id] ?? 0) + 1
    }
    return map
  }, [employees])

  const stats = useMemo(() => {
    const active = allDepts.filter(d => d.is_active).length
    const nested = allDepts.filter(d => d.parent_id).length
    return { total: allDepts.length, active, inactive: allDepts.length - active, nested }
  }, [allDepts])

  const visibleIds = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matches = allDepts.filter(d => {
      if (statusFilter === 'active' && !d.is_active) return false
      if (statusFilter === 'inactive' && d.is_active) return false
      if (!q) return true
      const parentName = d.parent_id ? byId.get(d.parent_id)?.name ?? '' : ''
      return (
        d.name.toLowerCase().includes(q) ||
        (d.code ?? '').toLowerCase().includes(q) ||
        (d.description ?? '').toLowerCase().includes(q) ||
        parentName.toLowerCase().includes(q)
      )
    })
    const ids = new Set(matches.map(d => d.id))
    for (const d of matches) {
      let parentId = d.parent_id
      while (parentId) {
        ids.add(parentId)
        parentId = byId.get(parentId)?.parent_id ?? null
      }
    }
    return ids
  }, [allDepts, byId, search, statusFilter])

  const topLevel = allDepts.filter(d => !d.parent_id && visibleIds.has(d.id))
  const childrenOf = (parentId: string) =>
    allDepts.filter(d => d.parent_id === parentId && visibleIds.has(d.id))

  const hasFilters = Boolean(search || statusFilter)

  function clearFilters() {
    setSearch('')
    setStatusFilter('')
  }

  async function handleDelete(dept: HRDepartment) {
    if (!(await askConfirm(`Delete department "${dept.name}"?`))) return
    deleteDept.mutate(dept.id)
  }

  function DeptRow({ dept, depth = 0 }: { dept: HRDepartment; depth?: number }) {
    const kids = childrenOf(dept.id)
    const people = headcountByDept[dept.id] ?? 0
    const parent = dept.parent_id ? byId.get(dept.parent_id) : null
    return (
      <>
        <tr className="transition-colors hover:bg-muted/30">
          <td className="px-4 py-3">
            <div className="flex items-center gap-3" style={{ paddingLeft: depth * 22 }}>
              {depth > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                  <span className="truncate">{dept.name}</span>
                  {dept.code && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {dept.code}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {parent ? `Reports under ${parent.name}` : depth === 0 ? 'Top-level department' : 'Sub-department'}
                </p>
              </div>
            </div>
          </td>
          <td className="px-4 py-3 text-sm text-muted-foreground">
            <p className="line-clamp-2 max-w-xs">{dept.description || '—'}</p>
          </td>
          <td className="px-4 py-3 text-sm text-muted-foreground">
            {people === 0 ? '—' : `${people} employee${people === 1 ? '' : 's'}`}
          </td>
          <td className="px-4 py-3">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                dept.is_active ? hrStatusBadge.active : hrStatusBadge.archived,
              )}
            >
              {dept.is_active ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td className="px-4 py-3 text-right">
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => setModal({ open: true, dept })}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                title="Edit department"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(dept)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Delete department"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </td>
        </tr>
        {kids.map(child => <DeptRow key={child.id} dept={child} depth={depth + 1} />)}
      </>
    )
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Departments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your organisational structure
            {stats.total > 0 ? ` · ${stats.total} department${stats.total === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <Button type="button" onClick={() => setModal({ open: true, dept: null })}>
          <Plus className="h-4 w-4" /> Add Department
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          { key: '' as StatusFilter, label: 'Total departments', value: stats.total, icon: Building2, color: 'blue' },
          { key: 'active' as StatusFilter, label: 'Active', value: stats.active, icon: UserCheck, color: 'green' },
          { key: 'inactive' as StatusFilter, label: 'Inactive', value: stats.inactive, icon: UserX, color: 'yellow' },
          { key: '' as StatusFilter, label: 'Sub-departments', value: stats.nested, icon: GitBranch, color: 'purple', lock: true },
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
              placeholder="Search name, code, or description…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search departments"
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
        ) : allDepts.length === 0 ? (
          <div className={cn(hrEmptyStateClass, 'border-0')}>
            <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No departments yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first department to organise teams and reporting lines.
            </p>
            <div className="mt-4 flex justify-center">
              <Button type="button" size="sm" onClick={() => setModal({ open: true, dept: null })}>
                <Plus className="h-4 w-4" /> Add Department
              </Button>
            </div>
          </div>
        ) : topLevel.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No departments match</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search or clear filters.</p>
            <div className="mt-4 flex justify-center">
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className={hrTableHeadClass}>
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide">
                    <TableColumnLabel>Name</TableColumnLabel>
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide">
                    <TableColumnLabel>Description</TableColumnLabel>
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
                {topLevel.map(dept => <DeptRow key={dept.id} dept={dept} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.open && (
        <DeptModal
          dept={modal.dept}
          departments={allDepts}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}
