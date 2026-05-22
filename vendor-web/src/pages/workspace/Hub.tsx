import { Link } from 'react-router-dom'
import {
  BarChart3, FileText, LayoutTemplate, Megaphone, Factory, ClipboardList,
  MessageSquare, GraduationCap, Truck, ClipboardCheck, Mail,
} from 'lucide-react'

const tiles: { to: string; title: string; desc: string; icon: typeof BarChart3 }[] = [
  { to: '/reports', title: 'Reports & BI', desc: 'Sales, Inventory, And Operational Reports.', icon: BarChart3 },
  { to: '/document-templates', title: 'Documents', desc: 'Invoice & PDF Templates — Extend To A Full Library Later.', icon: LayoutTemplate },
  { to: '/invoices', title: 'Invoices & Signing', desc: 'PDF Trail And Signature Capture On Invoices.', icon: FileText },
  { to: '/hr/expenses', title: 'Finance Expenses', desc: 'Vendor Expense Claims (Finance Visibility).', icon: ClipboardCheck },
  { to: '/crm/campaigns', title: 'Email Marketing', desc: 'Campaigns And Templates Under CRM.', icon: Megaphone },
  { to: '/crm/segments', title: 'Segments', desc: 'Audience Segments For Outreach.', icon: Mail },
  { to: '/controlling/internal-orders', title: 'Projects', desc: 'Internal & Project Manufacturing Orders.', icon: Factory },
  { to: '/hr/attendance', title: 'Timesheets (Attendance)', desc: 'Clock-Based Attendance; CO Shop-Floor Time Uses Manufacturing.', icon: ClipboardList },
  { to: '/crm/tickets', title: 'Field & Support', desc: 'Tickets And Knowledge Base As Service Hub.', icon: Truck },
  { to: '/crm/inbox', title: 'Discuss / Inbox', desc: 'CRM Inbox For Customer Conversations.', icon: MessageSquare },
  { to: '/hr/training', title: 'eLearning', desc: 'Training Programs & Enrollments (Employee Self-Service Uses Employee Portal).', icon: GraduationCap },
]

export default function WorkspaceHubPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Workspace Apps</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Shortcuts To Capabilities Across Finance, Sales, Marketing, Services, And HR — Without Duplicating Full Odoo-Style Standalone Apps.
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
