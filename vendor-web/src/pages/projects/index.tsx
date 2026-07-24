import { useMemo, useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { ThemeSelect } from '@/components/common/ThemeSelect'
import { Badge } from '@/components/ui/badge'
import { TableToolbar } from '@/components/table/TableToolbar'
import { InlineEditCell } from '@/components/table/InlineEditCell'
import { useInlineFieldPatch, INLINE_EDIT_HINT } from '@/hooks/useInlineFieldPatch'
import { CustomerPicker, type CustomerPickerValue } from '@/components/commission/CustomerPicker'
import { StaffPicker, type StaffPickerValue } from '@/components/commission/StaffPicker'
import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import { BranchSelect } from '@/components/common/BranchSelect'
import { SalesAreaSelect } from '@/components/common/SalesAreaSelect'
import { SalesScopeFilters } from '@/components/common/SalesScopeFilters'
import { CatalogItemPicker, type CatalogPickerItem } from '@/components/common/CatalogItemPicker'
import { useCreateProject, useProjects, useProjectsOverview, useUpdateProject } from '@/hooks/useProjects'
import { cn, formatDate } from '@/lib/utils'
import { modalWidthMd } from '@/lib/modalUi'
import {
  FolderKanban, Plus, Loader2, CheckCircle2, AlertTriangle,
  ListTodo, Activity,
} from 'lucide-react'
import type { Project, ProjectPriority, ProjectStatus, ProjectUpdateInput } from '@/types/project'
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
} from '@/types/project'

function StatCard({
  label, value, hint, icon: Icon, accent = 'blue',
}: {
  label: string
  value: string | number
  hint?: string
  icon: React.ComponentType<{ className?: string }>
  accent?: 'blue' | 'green' | 'amber' | 'rose' | 'violet'
}) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    violet: 'bg-primary/10 text-primary',
  }
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-2.5">
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${tones[accent]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
          {hint && <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

const statusBadgeVariant: Record<ProjectStatus, 'soft' | 'success' | 'warning' | 'secondary' | 'destructive'> = {
  planning: 'soft',
  active: 'success',
  on_hold: 'warning',
  completed: 'secondary',
  cancelled: 'destructive',
}

const priorityBadgeVariant: Record<ProjectPriority, 'secondary' | 'soft' | 'warning' | 'destructive'> = {
  low: 'secondary',
  medium: 'soft',
  high: 'warning',
  urgent: 'destructive',
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const create = useCreateProject()
  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    due_date: '',
    priority: 'medium' as ProjectPriority,
  })
  const [customer, setCustomer] = useState<CustomerPickerValue | null>(null)
  const [owner, setOwner] = useState<StaffPickerValue | null>(null)
  const [storeId, setStoreId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [salesAreaId, setSalesAreaId] = useState('')
  const effectiveStoreId = branchId || storeId
  const [items, setItems] = useState<CatalogPickerItem[]>([])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    create.mutate(
      {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        due_date: form.due_date || undefined,
        priority: form.priority,
        store_id: effectiveStoreId || undefined,
        sales_area_id: salesAreaId || undefined,
        items: items.length ? items : undefined,
        customer_id: customer?.id,
        customer_name: customer?.full_name,
        owner_id: owner?.user_id,
        owner_name: owner?.full_name,
        status: 'planning',
      },
      { onSuccess: onClose },
    )
  }

  const labelCls = 'text-xs'
  const fieldGap = 'space-y-1'

  return (
    <ModalOverlay onClose={onClose} className="p-2">
      <ModalPanel className={cn(modalWidthMd, 'max-h-[calc(100dvh-1rem)]')}>
        <ModalHeader
          title="New Project"
          onClose={onClose}
          className="border-0 px-4 py-2.5 [&>div>h2]:text-base"
        />
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-2.5 overflow-y-auto px-4 pb-3 pt-0">
            <div className={fieldGap}>
              <Label className={labelCls}>Sales scope</Label>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                <BusinessUnitSelect
                  value={storeId}
                  onChange={(id) => { setStoreId(id); setBranchId(''); setSalesAreaId(''); setItems([]) }}
                  allowAll
                  className="min-w-0"
                />
                <BranchSelect
                  businessUnitId={storeId || null}
                  value={branchId}
                  onChange={(id) => { setBranchId(id); setSalesAreaId(''); setItems([]) }}
                  allowAll
                  className="min-w-0"
                />
                <SalesAreaSelect
                  businessUnitId={storeId || null}
                  branchId={branchId || null}
                  value={salesAreaId}
                  onChange={setSalesAreaId}
                  allowAll={false}
                  className="min-w-0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_8.5rem]">
              <div className={fieldGap}>
                <Label htmlFor="proj-name" className={labelCls}>Name *</Label>
                <Input
                  id="proj-name"
                  className="h-8 text-sm"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Website redesign"
                  autoFocus
                />
              </div>
              <div className={fieldGap}>
                <Label htmlFor="proj-priority" className={labelCls}>Priority</Label>
                <Select
                  id="proj-priority"
                  value={form.priority}
                  onChange={(v) => setForm((p) => ({ ...p, priority: v as ProjectPriority }))}
                  options={(Object.keys(PROJECT_PRIORITY_LABELS) as ProjectPriority[]).map((k) => ({
                    value: k,
                    label: PROJECT_PRIORITY_LABELS[k],
                  }))}
                  aria-label="Priority"
                  className="w-full"
                  triggerClassName="h-8 text-sm"
                />
              </div>
            </div>

            <div className={fieldGap}>
              <Label htmlFor="proj-desc" className={labelCls}>Description</Label>
              <textarea
                id="proj-desc"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Brief scope or goals"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className={fieldGap}>
                <Label htmlFor="proj-start" className={labelCls}>Start date</Label>
                <Input
                  id="proj-start"
                  type="date"
                  className="h-8 text-sm"
                  value={form.start_date}
                  onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                />
              </div>
              <div className={fieldGap}>
                <Label htmlFor="proj-end" className={labelCls}>End date</Label>
                <Input
                  id="proj-end"
                  type="date"
                  className="h-8 text-sm"
                  value={form.end_date}
                  onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                />
              </div>
              <div className={fieldGap}>
                <Label htmlFor="proj-due" className={labelCls}>Due date</Label>
                <Input
                  id="proj-due"
                  type="date"
                  className="h-8 text-sm"
                  value={form.due_date}
                  onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className={fieldGap}>
                <Label className={labelCls}>Customer (optional)</Label>
                <CustomerPicker selected={customer} onSelect={setCustomer} />
              </div>
              <div className={fieldGap}>
                <Label className={labelCls}>Project owner (optional)</Label>
                <StaffPicker selected={owner} onSelect={setOwner} />
              </div>
            </div>

            <div className={fieldGap}>
              <Label className={labelCls}>Products & services (optional)</Label>
              <CatalogItemPicker storeId={effectiveStoreId} value={items} onChange={setItems} />
            </div>
          </ModalBody>
          <ModalFooter className="justify-end gap-2 border-0 bg-transparent px-4 py-2.5">
            <Button type="button" variant="cancel" className="h-8 px-3 text-sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="h-8 px-3 text-sm" disabled={create.isPending || !form.name.trim()}>
              {create.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
              Create
            </Button>
          </ModalFooter>
        </form>
      </ModalPanel>
    </ModalOverlay>
  )
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [storeFilter, setStoreFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [salesAreaFilter, setSalesAreaFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { data: overview, isLoading: overviewLoading } = useProjectsOverview()
  const { data: listData, isLoading: listLoading } = useProjects({
    page: 1,
    size: 100,
    search: search.trim() || undefined,
    status: statusFilter || undefined,
    store_id: branchFilter || storeFilter || undefined,
    sales_area_id: salesAreaFilter || undefined,
  })
  const updateProject = useUpdateProject()
  const { savingCellKey, cellKey, patchField: patchProjectField } = useInlineFieldPatch({
    mutateAsync: ({ id, data }) => updateProject.mutateAsync({ id, data: data as ProjectUpdateInput }),
  })
  const isSaving = (id: string, field: string) => savingCellKey === cellKey(id, field)

  const projectStatusOptions = (Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => ({
    value: s,
    label: PROJECT_STATUS_LABELS[s],
  }))
  const projectPriorityOptions = (Object.keys(PROJECT_PRIORITY_LABELS) as ProjectPriority[]).map((s) => ({
    value: s,
    label: PROJECT_PRIORITY_LABELS[s],
  }))

  const projects = useMemo(() => {
    const items = (listData?.items ?? []) as Project[]
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.project_number.toLowerCase().includes(q) ||
        (p.customer_name?.toLowerCase().includes(q) ?? false),
    )
  }, [listData, search])

  const completedCount = overview?.by_status?.completed ?? 0

  const statusOptions = useMemo(
    () => selectOptionsWithBlank('All statuses', (Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => ({
      value: s,
      label: PROJECT_STATUS_LABELS[s],
    }))),
    [],
  )

  const moreOptionsActiveCount = statusFilter ? 1 : 0

  if (overviewLoading && listLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderKanban className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
            Projects
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Track deliverables, tasks, and milestones.</p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard
          label="Active"
          value={overview?.active_count ?? 0}
          hint={`${overview?.total_projects ?? 0} total`}
          icon={Activity}
          accent="green"
        />
        <StatCard
          label="Completed"
          value={completedCount}
          icon={CheckCircle2}
          accent="blue"
        />
        <StatCard
          label="Overdue"
          value={overview?.overdue_count ?? 0}
          icon={AlertTriangle}
          accent="rose"
        />
        <StatCard
          label="Open Tasks"
          value={overview?.open_tasks ?? 0}
          hint={`${overview?.completed_tasks ?? 0} done`}
          icon={ListTodo}
          accent="violet"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search projects…"
            searchWrapperClassName="min-w-[10rem] flex-1 basis-full sm:basis-auto sm:flex-none sm:w-44 lg:w-52 max-w-full"
            sortOptions={[]}
            sortKey=""
            sortDir="desc"
            onSortKeyChange={() => {}}
            onSortDirChange={() => {}}
            hideSort
            hint={INLINE_EDIT_HINT}
            moreOptionsActiveCount={moreOptionsActiveCount}
            leading={(
              <SalesScopeFilters
                businessUnitId={storeFilter}
                branchId={branchFilter}
                salesAreaId={salesAreaFilter}
                onBusinessUnitChange={(id) => { setStoreFilter(id); setBranchFilter(''); setSalesAreaFilter('') }}
                onBranchChange={(id) => { setBranchFilter(id); setSalesAreaFilter('') }}
                onSalesAreaChange={setSalesAreaFilter}
              />
            )}
            moreOptions={(
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex min-w-[9rem] flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</label>
                  <ThemeSelect
                    value={statusFilter}
                    onChange={setStatusFilter}
                    placeholder="All statuses"
                    aria-label="Status filter"
                    wrapperClassName="w-full min-w-[9rem]"
                    options={statusOptions.map((o) => ({ value: o.value, label: o.label }))}
                  />
                </div>
              </div>
            )}
          />

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium"><TableColumnLabel>Project</TableColumnLabel></th>
                  <th className="px-3 py-2 font-medium hidden sm:table-cell"><TableColumnLabel>Customer</TableColumnLabel></th>
                  <th className="px-3 py-2 font-medium"><TableColumnLabel>Status</TableColumnLabel></th>
                  <th className="px-3 py-2 font-medium hidden md:table-cell"><TableColumnLabel>Priority</TableColumnLabel></th>
                  <th className="px-3 py-2 font-medium hidden lg:table-cell"><TableColumnLabel>Due</TableColumnLabel></th>
                  <th className="px-3 py-2 font-medium"><TableColumnLabel>Progress</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : projects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground text-sm">
                      No projects yet. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  projects.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="border-b border-border hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell
                          value={p.name}
                          saving={isSaving(p.id, 'name')}
                          onSave={(v) => patchProjectField(p.id, 'name', String(v).trim())}
                          className="font-medium"
                        >
                          <p className="font-medium text-foreground truncate max-w-[12rem] sm:max-w-none">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.project_number}</p>
                        </InlineEditCell>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell truncate max-w-[10rem]">{p.customer_name || '—'}</td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell
                          type="select"
                          value={p.status}
                          options={projectStatusOptions}
                          saving={isSaving(p.id, 'status')}
                          onSave={(v) => patchProjectField(p.id, 'status', v)}
                        >
                          <Badge variant={statusBadgeVariant[p.status]} className="text-[11px]">{PROJECT_STATUS_LABELS[p.status]}</Badge>
                        </InlineEditCell>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell
                          type="select"
                          value={p.priority}
                          options={projectPriorityOptions}
                          saving={isSaving(p.id, 'priority')}
                          onSave={(v) => patchProjectField(p.id, 'priority', v)}
                        >
                          <Badge variant={priorityBadgeVariant[p.priority]} className="text-[11px]">{PROJECT_PRIORITY_LABELS[p.priority]}</Badge>
                        </InlineEditCell>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <InlineEditCell
                          type="text"
                          value={p.due_date || ''}
                          saving={isSaving(p.id, 'due_date')}
                          onSave={(v) => patchProjectField(p.id, 'due_date', String(v).trim() || null)}
                        >
                          {p.due_date ? formatDate(p.due_date) : '—'}
                        </InlineEditCell>
                      </td>
                      <td className="px-3 py-2">
                        <InlineEditCell readOnly readOnlyMessage="Progress is calculated from completed tasks" value={p.progress_percent} onSave={() => {}}>
                          <div className="flex items-center gap-1.5 min-w-[5rem] sm:min-w-[7rem]">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${p.progress_percent}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-muted-foreground w-7 text-right shrink-0">{p.progress_percent}%</span>
                          </div>
                        </InlineEditCell>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
