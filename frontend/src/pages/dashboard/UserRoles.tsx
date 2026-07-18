import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/authStore'
import { isSuperuserAdmin } from '@/lib/platformAccess'
import {
  useCreatePlatformJobRole,
  useDeletePlatformJobRole,
  usePlatformJobRolePermissions,
  usePlatformJobRoles,
  useUpdatePlatformJobRole,
} from '@/hooks/usePlatformJobRoles'
import type { PlatformJobRole } from '@/api/admin.api'
import { cn } from '@/lib/utils'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Headphones,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Store,
  Trash2,
  X,
} from 'lucide-react'

const MODULE_LABELS: Record<string, string> = {
  admin: 'Admin panel',
  vendors: 'Business accounts & vendor store',
  staff: 'Support hierarchy',
}

function vendorScopeFromPerms(perms: string[]): { scope: 'all' | 'assigned_only' | 'none'; summary: string } {
  if (!perms.includes('vendors.handoff')) {
    return { scope: 'none', summary: 'No store handoff' }
  }
  if (perms.includes('vendors.scope_assigned')) {
    return { scope: 'assigned_only', summary: 'Assigned stores only' }
  }
  return { scope: 'all', summary: 'All vendor stores' }
}

function scopeBadgeClass(scope: 'all' | 'assigned_only' | 'none'): string {
  if (scope === 'all') return 'bg-green-50 text-green-800 border-green-200'
  if (scope === 'assigned_only') return 'bg-amber-50 text-amber-900 border-amber-200'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

function RoleFormModal({
  open,
  onClose,
  editRole,
}: {
  open: boolean
  onClose: () => void
  editRole: PlatformJobRole | null
}) {
  const { data: permData } = usePlatformJobRolePermissions()
  const createRole = useCreatePlatformJobRole()
  const updateRole = useUpdatePlatformJobRole()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [perms, setPerms] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    if (editRole) {
      setName(editRole.name)
      setDescription(editRole.description || '')
      setPerms([...(editRole.permissions || [])])
    } else {
      setName('')
      setDescription('')
      setPerms([
        'admin.dashboard',
        'admin.vendors',
        'admin.website_analytics',
        'admin.account_activity',
        'admin.crm',
        'vendors.create',
        'vendors.handoff',
      ])
    }
  }, [open, editRole])

  if (!open) return null

  const grouped = permData?.permissions || {}
  const busy = createRole.isPending || updateRole.isPending

  const togglePerm = (key: string) => {
    setPerms((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]))
  }

  const toggleModule = (module: string) => {
    const keys = (grouped[module] || []).map((p) => p.key)
    const allOn = keys.every((k) => perms.includes(k))
    if (allOn) {
      setPerms((prev) => prev.filter((p) => !keys.includes(p)))
    } else {
      setPerms((prev) => [...new Set([...prev, ...keys])])
    }
  }

  const handleSave = () => {
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      permissions: perms,
    }
    if (editRole?.id) {
      updateRole.mutate(
        { roleId: editRole.id, data: payload },
        { onSuccess: () => onClose() },
      )
    } else {
      createRole.mutate(payload, { onSuccess: () => onClose() })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-2xl rounded-lg border bg-background p-4 shadow-lg space-y-4 max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg">
              {editRole ? 'Edit custom role' : 'Create custom role'}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Choose Admin areas and vendor-store access for this support job role.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="role-name">Role name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Onboarding specialist"
              required
              minLength={2}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="role-desc">Description</Label>
            <Input
              id="role-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Permissions</p>
          {Object.entries(grouped).map(([module, items]) => {
            const keys = items.map((p) => p.key)
            const allOn = keys.length > 0 && keys.every((k) => perms.includes(k))
            return (
              <div key={module} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    {MODULE_LABELS[module] || module}
                  </p>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => toggleModule(module)}
                  >
                    {allOn ? 'Clear module' : 'Select module'}
                  </button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {items.map((p) => {
                    const on = perms.includes(p.key)
                    return (
                      <label
                        key={p.key}
                        className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={on}
                          onChange={() => togglePerm(p.key)}
                        />
                        <span className={on ? 'text-gray-900' : 'text-gray-600'}>{p.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={busy || name.trim().length < 2 || perms.length === 0}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {editRole ? 'Save changes' : 'Create role'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function RoleCard({
  role,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  permissionLabels,
}: {
  role: PlatformJobRole
  expanded: boolean
  onToggle: () => void
  onEdit?: () => void
  onDelete?: () => void
  permissionLabels: Record<string, string>
}) {
  const store = vendorScopeFromPerms(role.permissions || [])
  const adminPerms = (role.permissions || []).filter((p) => p.startsWith('admin.'))
  const vendorPerms = (role.permissions || []).filter(
    (p) => p.startsWith('vendors.') || p.startsWith('staff.'),
  )

  return (
    <div
      className={cn(
        'rounded-lg border bg-white transition-colors',
        role.is_builtin ? 'border-gray-200' : 'border-primary/20',
        !role.is_active && 'opacity-70',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-muted/40"
        aria-expanded={expanded}
      >
        <span className="mt-0.5 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900">{role.name}</span>
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-xs font-medium',
                role.is_builtin
                  ? 'border-gray-200 bg-gray-50 text-gray-700'
                  : 'border-primary/30 bg-primary/10 text-primary',
              )}
            >
              {role.is_builtin ? 'Built-in' : 'Custom'}
            </span>
            {!role.is_active && (
              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
                Inactive
              </span>
            )}
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-xs font-medium',
                scopeBadgeClass(store.scope),
              )}
            >
              <Store className="mr-1 inline h-3 w-3 align-[-1px]" />
              {store.summary}
            </span>
          </div>
          {role.description && <p className="mt-1 text-sm text-gray-600">{role.description}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums text-gray-900">
            {role.assigned_count ?? 0}
          </p>
          <p className="text-xs text-muted-foreground">assigned</p>
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t px-4 py-4 sm:px-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Admin panel access
              </h3>
              <ul className="space-y-1.5">
                {adminPerms.length === 0 && (
                  <li className="text-sm text-muted-foreground">No admin areas selected</li>
                )}
                {adminPerms.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-gray-800">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    {permissionLabels[p] || p}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Business accounts &amp; vendor store
              </h3>
              <ul className="space-y-1.5">
                {vendorPerms.length === 0 && (
                  <li className="text-sm text-muted-foreground">No vendor permissions</li>
                )}
                {vendorPerms.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-gray-800">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    {permissionLabels[p] || p}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild type="button" variant="outline" size="sm">
              <Link to="/dashboard/platform-team">
                <Headphones className="mr-1.5 h-3.5 w-3.5" />
                Assign on Support team
              </Link>
            </Button>
            {!role.is_builtin && role.id && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function UserRoles() {
  const { user } = useAuthStore()
  const { data, isLoading, isError } = usePlatformJobRoles(true)
  const { data: permData } = usePlatformJobRolePermissions()
  const deleteRole = useDeletePlatformJobRole()

  const [expanded, setExpanded] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editRole, setEditRole] = useState<PlatformJobRole | null>(null)

  const permissionLabels = useMemo(() => {
    const map: Record<string, string> = {}
    for (const items of Object.values(permData?.permissions || {})) {
      for (const p of items) map[p.key] = p.label
    }
    return map
  }, [permData])

  const roles = data?.roles ?? []
  const builtin = roles.filter((r) => r.is_builtin)
  const custom = roles.filter((r) => !r.is_builtin)

  if (!isSuperuserAdmin(user)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="w-full max-w-none space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <ShieldCheck className="h-7 w-7 text-primary" />
            User roles
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Built-in and custom job roles control what support users see in this admin app and which
            vendor stores they can open via Business Accounts handoff.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild type="button" variant="outline" size="sm">
            <Link to="/dashboard/platform-team">
              <Headphones className="mr-1.5 h-4 w-4" />
              Support team
            </Link>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditRole(null)
              setFormOpen(true)
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Create role
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading roles…
        </div>
      )}
      {isError && (
        <p className="text-sm text-red-600">Could not load roles. Are you logged in as a superuser?</p>
      )}

      {!isLoading && !isError && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Built-in roles</CardTitle>
              <p className="text-sm font-normal text-muted-foreground">
                System roles used by Support team. These cannot be deleted.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {builtin.map((role) => (
                <RoleCard
                  key={role.slug}
                  role={role}
                  expanded={expanded === role.slug}
                  onToggle={() => setExpanded((prev) => (prev === role.slug ? null : role.slug))}
                  permissionLabels={permissionLabels}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Custom roles</CardTitle>
                  <p className="text-sm font-normal text-muted-foreground">
                    User-defined roles you create for your support team.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditRole(null)
                    setFormOpen(true)
                  }}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create role
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {custom.length === 0 && (
                <div className="rounded-lg border border-dashed px-4 py-8 text-center">
                  <ShieldCheck className="mx-auto mb-2 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No custom roles yet</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      setEditRole(null)
                      setFormOpen(true)
                    }}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Create first role
                  </Button>
                </div>
              )}
              {custom.map((role) => (
                <RoleCard
                  key={role.slug}
                  role={role}
                  expanded={expanded === role.slug}
                  onToggle={() => setExpanded((prev) => (prev === role.slug ? null : role.slug))}
                  permissionLabels={permissionLabels}
                  onEdit={() => {
                    setEditRole(role)
                    setFormOpen(true)
                  }}
                  onDelete={() => {
                    if (!role.id) return
                    if (
                      confirm(
                        `Delete role “${role.name}”? Support users must be reassigned before delete.`,
                      )
                    ) {
                      deleteRole.mutate(role.id)
                    }
                  }}
                />
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <RoleFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditRole(null)
        }}
        editRole={editRole}
      />
    </div>
  )
}
