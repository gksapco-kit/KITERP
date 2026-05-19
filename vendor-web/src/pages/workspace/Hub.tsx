import { Link } from 'react-router-dom'
import {
  BarChart3, FileText, LayoutTemplate, Megaphone, Factory, ClipboardList,
  MessageSquare, GraduationCap, Truck, ClipboardCheck, Mail,
} from 'lucide-react'

const tiles: { to: string; title: string; desc: string; icon: typeof BarChart3 }[] = [
  { to: '/reports', title: 'Reports & BI', desc: 'Sales, inventory, and operational reports.', icon: BarChart3 },
  { to: '/document-templates', title: 'Documents', desc: 'Invoice & PDF templates — extend to a full library later.', icon: LayoutTemplate },
  { to: '/invoices', title: 'Invoices & signing', desc: 'PDF trail and signature capture on invoices.', icon: FileText },
  { to: '/hr/expenses', title: 'Finance expenses', desc: 'Vendor expense claims (finance visibility).', icon: ClipboardCheck },
  { to: '/crm/campaigns', title: 'Email marketing', desc: 'Campaigns and templates under CRM.', icon: Megaphone },
  { to: '/crm/segments', title: 'Segments', desc: 'Audience segments for outreach.', icon: Mail },
  { to: '/controlling/internal-orders', title: 'Projects', desc: 'Internal & project manufacturing orders.', icon: Factory },
  { to: '/hr/attendance', title: 'Timesheets (attendance)', desc: 'Clock-based attendance; CO shop-floor time uses manufacturing.', icon: ClipboardList },
  { to: '/crm/tickets', title: 'Field & support', desc: 'Tickets and knowledge base as service hub.', icon: Truck },
  { to: '/crm/inbox', title: 'Discuss / inbox', desc: 'CRM inbox for customer conversations.', icon: MessageSquare },
  { to: '/hr/training', title: 'eLearning', desc: 'Training programs & enrollments (employee self-service uses Employee portal).', icon: GraduationCap },
]

export default function WorkspaceHubPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Workspace apps</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Shortcuts to capabilities across finance, sales, marketing, services, and HR — without duplicating full Odoo-style standalone apps.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(t => (
          <Link
            key={t.to}
            to={t.to}
            className="rounded-xl border border-border bg-card text-card-foreground p-4 shadow-sm hover:border-primary/40 hover:bg-accent/60 transition-colors flex gap-3"
          >
            <t.icon className="w-8 h-8 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-foreground">{t.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{t.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
