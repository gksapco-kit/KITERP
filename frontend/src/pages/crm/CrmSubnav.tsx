import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/dashboard/crm', label: 'Overview', end: true },
  { to: '/dashboard/crm/leads', label: 'Leads' },
  { to: '/dashboard/crm/contacts', label: 'Contacts' },
  { to: '/dashboard/crm/pipeline', label: 'Pipeline' },
  { to: '/dashboard/crm/activities', label: 'Tasks' },
]

export default function CrmSubnav() {
  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-3">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100',
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </div>
  )
}
