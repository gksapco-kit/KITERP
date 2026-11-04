import { Link } from 'react-router-dom'
import { Check, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useREMeta } from '../shared'

const PERMS: { key: string; label: string; detail: string }[] = [
  { key: 'realestate.view', label: 'View', detail: 'Read-only access to every real-estate screen.' },
  { key: 'realestate.manage', label: 'Manage', detail: 'Edit property, project and master data.' },
  { key: 'realestate.sales', label: 'Sales & CRM', detail: 'Leads, enquiries, site visits, quotations, follow-ups.' },
  { key: 'realestate.booking', label: 'Booking', detail: 'Block units, create bookings, allotments, cancellations.' },
  { key: 'realestate.collections', label: 'Collections', detail: 'Demands, receipts, payment schedules, tax entries.' },
  { key: 'realestate.construction', label: 'Construction', detail: 'Site progress, BOQ, procurement, inventory, contractors.' },
  { key: 'realestate.legal', label: 'Legal', detail: 'Title checks, approvals, deeds, agreements, documents.' },
  { key: 'realestate.approve', label: 'Approve', detail: 'Decide approval requests (cannot approve your own).' },
  { key: 'realestate.admin', label: 'Administer', detail: 'Approval rules, number ranges, templates, integrations.' },
  { key: 'realestate.pii', label: 'Personal data', detail: 'See full PAN, KYC numbers, bank account numbers and KYC scans (others see only the last 4 characters).' },
]

const ROLES: { name: string; perms: string }[] = [
  { name: 'Sales Executive', perms: 'view, sales, booking' },
  { name: 'CRM Manager', perms: 'view, manage, sales, booking, personal data' },
  { name: 'Site Engineer', perms: 'view, construction' },
  { name: 'Accounts', perms: 'view, collections, personal data' },
  { name: 'Legal', perms: 'view, legal, personal data' },
]

export default function AccessControl() {
  const { data } = useREMeta()
  const mine = new Set(data?.permissions ?? [])
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Real-estate access is granted through vendor roles. Assign these permissions to roles on the Roles page.
        </p>
        <Button asChild size="sm"><Link to="/roles">Manage roles</Link></Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2">Permission</th><th className="px-3 py-2">Grants</th><th className="px-3 py-2 text-center">You</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PERMS.map((p) => (
              <tr key={p.key}>
                <td className="px-3 py-2"><div className="font-medium">{p.label}</div><code className="text-[11px] text-muted-foreground">{p.key}</code></td>
                <td className="px-3 py-2 text-muted-foreground">{p.detail}</td>
                <td className="px-3 py-2 text-center">
                  {mine.has(p.key) ? <Check className="mx-auto h-4 w-4 text-emerald-600" /> : <Minus className="mx-auto h-4 w-4 text-muted-foreground" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-semibold">Ready-made real-estate roles</h3>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {ROLES.map((r) => (
            <li key={r.name} className="flex justify-between gap-2"><span>{r.name}</span><span className="text-muted-foreground">{r.perms}</span></li>
          ))}
        </ul>
      </div>
    </div>
  )
}
