import { useMemo, useState } from 'react'
import { TableColumnLabel } from '@/components/common/FieldLabel'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CustomerPicker, type CustomerPickerValue } from '@/components/commission/CustomerPicker'
import { StaffPicker, type StaffPickerValue } from '@/components/commission/StaffPicker'
import { BusinessUnitSelect } from '@/components/common/BusinessUnitSelect'
import { CatalogItemPicker, type CatalogPickerItem } from '@/components/common/CatalogItemPicker'
import { useCreateProject, useProjects, useProjectsOverview } from '@/hooks/useProjects'
import { formatDate } from '@/lib/utils'
import {
  FolderKanban, Plus, Loader2, Search, CheckCircle2, AlertTriangle,
  ListTodo, Activity,
} from 'lucide-react'
import type { Project, ProjectPriority, ProjectStatus } from '@/types/project'
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
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300',
    violet: 'bg-accent text-primary',
  }
  return (
    <Card>
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</p>}
        </div>
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${tones[accent]}`}>
          <Icon className="w-5 h-5" />
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
        store_id: storeId || undefined,
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

  return (
    <ModalOverlay onClose={onClose}>
      <ModalPanel className="max-w-lg">
        <div className="shrink-0 border-b border-border px-5 py-3">
          <ModalHeader title="New Project" onClose={onClose} />
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label>Business unit</Label>
              <BusinessUnitSelect value={storeId} onChange={(id) => { setStoreId(id); setItems([]) }} allowAll />
              <p className="text-[11px] text-muted-foreground">Scopes the products & services you can attach below.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-name">Name *</Label>
              <Input
                id="proj-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Website redesign"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-desc">Description</Label>
              <textarea
                id="proj-desc"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Brief scope or goals"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="proj-start">Start date</Label>
                <Input
                  id="proj-start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-end">End date</Label>
                <Input
                  id="proj-end"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="proj-due">Due date</Label>
                <Input
                  id="proj-due"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-priority">Priority</Label>
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
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Customer (optional)</Label>
              <CustomerPicker selected={customer} onSelect={setCustomer} />
            </div>
            <div className="space-y-1.5">
              <Label>Project owner (optional)</Label>
              <StaffPicker selected={owner} onSelect={setOwner} />
            </div>
            <div className="space-y-1.5">
              <Label>Products & services (optional)</Label>
              <CatalogItemPicker storeId={storeId} value={items} onChange={setItems} />
            </div>
          </ModalBody>
          <ModalFooter className="flex justify-end gap-3 border-t border-border bg-card px-4 py-4">
            <Button type="button" variant="cancel" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending || !form.name.trim()}>
              {create.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
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
  const [showCreate, setShowCreate] = useState(false)

  const { data: overview, isLoading: overviewLoading } = useProjectsOverview()
  const { data: listData, isLoading: listLoading } = useProjects({
    page: 1,
    size: 100,
    search: search.trim() || undefined,
    status: statusFilter || undefined,
    store_id: storeFilter || undefined,
  })

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

  if (overviewLoading && listLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-primary" />
            Projects
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Track deliverables, tasks, and milestones.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={selectOptionsWithBlank('All statuses', (Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map((s) => ({
                value: s,
                label: PROJECT_STATUS_LABELS[s],
              })))}
              placeholder="All statuses"
              aria-label="Status filter"
            />
            <div className="w-52"><BusinessUnitSelect value={storeFilter} onChange={setStoreFilter} allowAll autoSelectDefault={false} /></div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium"><TableColumnLabel>Project</TableColumnLabel></th>
                  <th className="px-4 py-3 font-medium"><TableColumnLabel>Customer</TableColumnLabel></th>
                  <th className="px-4 py-3 font-medium"><TableColumnLabel>Status</TableColumnLabel></th>
                  <th className="px-4 py-3 font-medium"><TableColumnLabel>Priority</TableColumnLabel></th>
                  <th className="px-4 py-3 font-medium"><TableColumnLabel>Due</TableColumnLabel></th>
                  <th className="px-4 py-3 font-medium"><TableColumnLabel>Progress</TableColumnLabel></th>
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : projects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
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
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.project_number}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.customer_name || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadgeVariant[p.status]}>{PROJECT_STATUS_LABELS[p.status]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={priorityBadgeVariant[p.priority]}>{PROJECT_PRIORITY_LABELS[p.priority]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.due_date ? formatDate(p.due_date) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${p.progress_percent}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{p.progress_percent}%</span>
                        </div>
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
