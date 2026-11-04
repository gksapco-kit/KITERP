import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { reApi } from '@/api/realestate'
import { humanize } from '../shared'
import { Loading, SimpleTable } from './parts'

type Row = {
  project_id: string
  project: string
  approvals: Record<string, string>
  launch_ready: boolean
  missing_for_launch: string[]
  expiring: number
}

const TYPES = [
  'rera_registration', 'layout_approval', 'building_plan', 'commencement_certificate', 'environmental_clearance',
  'fire_noc', 'water_noc', 'occupancy_certificate',
]

function stateBadge(s?: string) {
  if (!s) return <span className="text-muted-foreground">—</span>
  const v = s === 'approved' ? 'success' : s === 'renewal_due' || s === 'applied' || s === 'under_review' ? 'warning' : s === 'expired' || s === 'rejected' ? 'destructive' : 'secondary'
  return <Badge variant={v}>{humanize(s)}</Badge>
}

export default function ApprovalsTracker() {
  const q = useQuery({
    queryKey: ['re-approvals-tracker'],
    queryFn: () => reApi.report<{ required_for_launch: string[]; projects: Row[] }>('/statutory-approvals/tracker'),
  })
  if (q.isLoading || !q.data) return <Loading />
  const required = new Set(q.data.required_for_launch)
  return (
    <div className="space-y-3">
      <SimpleTable<Row>
        rows={q.data.projects}
        empty="No projects yet"
        cols={[
          { key: 'project', label: 'Project', render: (r) => <span className="font-medium">{r.project}</span> },
          ...TYPES.map((t) => ({
            key: t,
            label: humanize(t) + (required.has(t) ? ' *' : ''),
            render: (r: Row) => stateBadge(r.approvals[t]),
          })),
          {
            key: 'ready', label: 'Launch', render: (r) =>
              r.launch_ready ? <Badge variant="success">Ready</Badge> : <Badge variant="destructive">Missing {r.missing_for_launch.length}</Badge>,
          },
        ]}
      />
      <p className="text-xs text-muted-foreground">
        * Required before launch: RERA registration, sanctioned building plan and commencement certificate. Add or renew items under
        “Approvals”.
      </p>
    </div>
  )
}
