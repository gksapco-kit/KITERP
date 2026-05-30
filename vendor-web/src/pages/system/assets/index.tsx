import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { Image as ImageIcon, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

const ASSET_NAV = [
  { to: '/system/assets/images', label: 'Images', icon: ImageIcon, description: 'Royalty-free stock photos by category' },
]

export default function AssetsLayout() {
  const location = useLocation()
  const isRoot = location.pathname === '/system/assets' || location.pathname === '/system/assets/'

  if (isRoot) {
    return <Navigate to="/system/assets/images" replace />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-0">
      <aside className="shrink-0 border-b bg-card lg:w-52 lg:border-b-0 lg:border-r">
        <div className="px-4 py-4 lg:px-3 lg:py-5">
          <div className="mb-3 flex items-center gap-2 px-1 lg:mb-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
              <FolderOpen className="h-4 w-4" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Assets</p>
              <p className="text-[0.6875rem] text-muted-foreground">System library</p>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto scrollbar-none lg:flex-col lg:overflow-visible">
            {ASSET_NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
