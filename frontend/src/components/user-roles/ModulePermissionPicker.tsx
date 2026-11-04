import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { PlatformModuleDef } from '@/api/admin.api'
import {
  setModuleLevel,
  setSubmoduleLevel,
  submoduleLevel,
  type SubmoduleLevel,
} from '@/lib/platformModulePerms'
import { cn } from '@/lib/utils'

type Props = {
  modules: PlatformModuleDef[]
  perms: string[]
  onChange: (next: string[]) => void
}

/**
 * Per sub-module access for CRM / Finance / HR.
 * View + Manage columns; "Access" rows have a single toggle because the API requires the
 * manage permission even to open them; "View" rows are read-only screens (reports, audit).
 */
export default function ModulePermissionPicker({ modules, perms, onChange }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  if (modules.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Modules &amp; sub-modules
      </p>
      <p className="text-xs text-muted-foreground">
        Pick access for each sub-module independently. Manage includes View. Changes apply to a
        support user the next time they open a business store.
      </p>

      {modules.map((m) => {
        const levels = m.submodules.map((s) => submoduleLevel(perms, s))
        const viewable = levels.filter((l) => l !== 'none').length
        const managed = levels.filter((l) => l === 'manage').length
        const expanded = open[m.module] ?? viewable > 0

        return (
          <div key={m.module} className="rounded-lg border">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <button
                type="button"
                className="flex items-center gap-2 text-left"
                aria-expanded={expanded}
                onClick={() => setOpen((prev) => ({ ...prev, [m.module]: !expanded }))}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-gray-900">{m.label}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {viewable}/{m.submodules.length} open · {managed} manage
                </span>
              </button>
              <div className="flex gap-3 text-xs">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  title="Read-only for every sub-module that supports it. Access-only screens are left off."
                  onClick={() => onChange(setModuleLevel(perms, m, 'view'))}
                >
                  All view
                </button>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => onChange(setModuleLevel(perms, m, 'manage'))}
                >
                  All manage
                </button>
                <button
                  type="button"
                  className="text-gray-500 hover:underline"
                  onClick={() => onChange(setModuleLevel(perms, m, 'none'))}
                >
                  Clear
                </button>
              </div>
            </div>

            {expanded && (
              <div className="border-t">
                <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-x-2 border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-gray-500">
                  <span>Sub-module</span>
                  <span className="text-center">View</span>
                  <span className="text-center">Manage</span>
                </div>
                <div className="max-h-72 divide-y overflow-y-auto">
                  {m.submodules.map((sub) => {
                    const level = submoduleLevel(perms, sub)
                    const set = (next: SubmoduleLevel) =>
                      onChange(setSubmoduleLevel(perms, sub, next))
                    return (
                      <div
                        key={sub.slug}
                        className={cn(
                          'grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-x-2 px-3 py-1.5 text-sm',
                          level !== 'none' && 'bg-primary/5',
                        )}
                      >
                        <span className="min-w-0 truncate text-gray-800" title={sub.label}>
                          {sub.label}
                          {sub.mode === 'access' && (
                            <span className="ml-1.5 text-xs text-muted-foreground">(access only)</span>
                          )}
                          {sub.mode === 'view_only' && (
                            <span className="ml-1.5 text-xs text-muted-foreground">(read-only screen)</span>
                          )}
                        </span>

                        <span className="flex justify-center">
                          {sub.mode === 'access' ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <input
                              type="checkbox"
                              aria-label={`${sub.label} view`}
                              checked={level === 'view' || level === 'manage'}
                              onChange={(e) => set(e.target.checked ? 'view' : 'none')}
                            />
                          )}
                        </span>

                        <span className="flex justify-center">
                          {sub.mode === 'view_only' ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <input
                              type="checkbox"
                              aria-label={`${sub.label} ${sub.mode === 'access' ? 'access' : 'manage'}`}
                              checked={level === 'manage'}
                              onChange={(e) =>
                                set(e.target.checked ? 'manage' : sub.mode === 'access' ? 'none' : 'view')
                              }
                            />
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
