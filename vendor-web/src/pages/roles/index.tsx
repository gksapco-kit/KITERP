import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  ShieldCheck, Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronRight,
  Lock, Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import {
  useRoles, useAllPermissions, useDefaultRoles, useCreateRole, useUpdateRole, useDeleteRole,
} from '@/hooks/useVendor'
import { useAuthStore } from '@/stores/authStore'
import type { VendorRole } from '@/types'
import { cn } from '@/lib/utils'
import { PERMISSION_MODULE_ICONS, PERMISSION_MODULE_LABELS } from '@/lib/permissionModules'

import { askConfirm } from '@/components/common/ConfirmProvider'
const BUILTIN_ROLE_STYLES: Record<string, { container: string; header: string }> = {
  owner: {
    container: 'border-primary/30 bg-accent dark:bg-primary/10',
    header: 'text-primary',
  },
  admin: {
    container: 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10',
    header: 'text-blue-700 dark:text-blue-200',
  },
  manager: {
    container: 'border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10',
    header: 'text-green-700 dark:text-green-200',
  },
  sales: {
    container: 'border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10',
    header: 'text-orange-700 dark:text-orange-200',
  },
  staff: {
    container: 'border-border bg-muted/50 dark:bg-card',
    header: 'text-foreground',
  },
  support: {
    container: 'border-cyan-200 dark:border-cyan-500/30 bg-cyan-50 dark:bg-cyan-500/10',
    header: 'text-cyan-700 dark:text-cyan-200',
  },
  marketing: {
    container: 'border-pink-200 dark:border-pink-500/30 bg-pink-50 dark:bg-pink-500/10',
    header: 'text-pink-700 dark:text-pink-200',
  },
  accountant: {
    container: 'border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10',
    header: 'text-violet-700 dark:text-violet-200',
  },
}

const MODULE_ICONS = PERMISSION_MODULE_ICONS
const MODULE_LABELS = PERMISSION_MODULE_LABELS

export default function RolesPage() {
  const { user } = useAuthStore()
  const [searchParams] = useSearchParams()
  const { data: rolesData, isLoading } = useRoles()
  const { data: permData } = useAllPermissions()
  const { data: defaultsData } = useDefaultRoles()
  const createMutation = useCreateRole()
  const updateMutation = useUpdateRole()
  const deleteMutation = useDeleteRole()

  const fromTeam = searchParams.get('from') === 'team'

  const [showForm, setShowForm] = useState(false)
  const [editRole, setEditRole] = useState<VendorRole | null>(null)
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [expandedBuiltIn, setExpandedBuiltIn] = useState<string | null>(null)

  // Auto-expand built-in roles — runs whenever the URL params change (handles
  // navigating from team page to the same /roles route without remounting).
  useEffect(() => {
    const builtin = searchParams.get('builtin')
    if (builtin) setExpandedBuiltIn(builtin)
  }, [searchParams])

  // Auto-expand custom roles — runs once data is loaded so the role id is available.
  useEffect(() => {
    const roleId = searchParams.get('roleId')
    if (!roleId || !rolesData) return
    setExpandedRole(roleId)
  }, [searchParams, rolesData])

  // Form state
  const [formName, setFormName] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formPerms, setFormPerms] = useState<string[]>([])

  const roles = rolesData?.roles || []
  const allPerms = permData?.permissions || {}
  const allPermsList = permData?.all || []
  const defaultRoles = (defaultsData?.roles || []) as { name: string; permissions: string[] }[]

  const canManageRoles = user?.vendor_role?.permissions?.includes('roles.manage')

  const openCreateForm = () => {
    setEditRole(null)
    setFormName('')
    setFormDesc('')
    setFormPerms([])
    setShowForm(true)
  }

  const openEditForm = (role: VendorRole) => {
    setEditRole(role)
    setFormName(role.name)
    setFormDesc(role.description || '')
    setFormPerms([...role.permissions])
    setShowForm(true)
  }

  const togglePerm = (perm: string) => {
    setFormPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    )
  }

  const toggleModule = (module: string) => {
    const modulePerms = (allPerms[module] || []).map((p: { key: string }) => p.key)
    const allSelected = modulePerms.every((p: string) => formPerms.includes(p))
    if (allSelected) {
      setFormPerms((prev) => prev.filter((p) => !modulePerms.includes(p)))
    } else {
      setFormPerms((prev) => [...new Set([...prev, ...modulePerms])])
    }
  }

  const handleSave = () => {
    if (editRole) {
      updateMutation.mutate(
        { id: editRole.id, data: { name: formName, description: formDesc || undefined, permissions: formPerms } },
        { onSuccess: () => setShowForm(false) }
      )
    } else {
      createMutation.mutate(
        { name: formName, description: formDesc || undefined, permissions: formPerms },
        { onSuccess: () => setShowForm(false) }
      )
    }
  }

  const handleDelete = async (roleId: string) => {
    if (await askConfirm('Delete this role? Team members using it will lose their custom permissions.')) {
      deleteMutation.mutate(roleId)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-3 p-3 md:p-4">
      {/* Page header — title already shown in the top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          {fromTeam && (
            <>
              <Link to="/team" className="text-primary hover:underline">Staff Access Control</Link>
              {' · '}
            </>
          )}
          Define custom roles to control team member access
        </p>
        {canManageRoles && (
          <Button type="button" size="sm" className="h-8 gap-1.5" onClick={openCreateForm}>
            <Plus className="h-3.5 w-3.5" />
            Create Role
          </Button>
        )}
      </div>

      {/* Built-in Roles with Permissions */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-blue-600 dark:text-blue-300" />
          <h2 className="text-lg font-semibold text-foreground">Built-in System Roles</h2>
          <span className="text-xs text-muted-foreground">Click to view permissions</span>
        </div>
        {defaultRoles.map((dr) => {
          const isExpanded = expandedBuiltIn === dr.name
          const permCount = dr.permissions.length
          const styles = BUILTIN_ROLE_STYLES[dr.name] ?? {
            container: 'border-border bg-card',
            header: 'text-foreground',
          }
          return (
            <div key={dr.name} className={cn('rounded-lg border overflow-hidden', styles.container)}>
              <div
                className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedBuiltIn(isExpanded ? null : dr.name)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <Shield className={cn('w-4 h-4', styles.header)} />
                  <span className={cn('font-medium capitalize', styles.header)}>{dr.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {permCount === allPermsList.length ? 'All permissions' : `${permCount} of ${allPermsList.length} permissions`}
                </span>
              </div>
              {isExpanded && (
                <div className="px-5 py-4 border-t border-border bg-muted/30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(allPerms).map(([module, perms]) => {
                      const Icon = MODULE_ICONS[module] || Shield
                      return (
                        <div key={module} className="bg-card rounded-lg border border-border p-3">
                          <p className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-2">
                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                            {MODULE_LABELS[module] || module}
                          </p>
                          <div className="space-y-1">
                            {(perms as { key: string; action: string }[]).map((p) => (
                              <div key={p.key} className="flex items-center gap-1.5 text-xs">
                                {dr.permissions.includes(p.key) ? (
                                  <Check className="w-3 h-3 text-green-500 dark:text-green-400" />
                                ) : (
                                  <X className="w-3 h-3 text-red-400 dark:text-red-300" />
                                )}
                                <span
                                  className={cn(
                                    dr.permissions.includes(p.key)
                                      ? 'text-foreground'
                                      : 'text-muted-foreground line-through',
                                  )}
                                >
                                  {p.action}
                                </span>
                              </div>
                            ))}
                          </div>
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

      {/* Custom Roles List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Custom Roles</h2>
        {isLoading ? (
          <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
            Loading roles...
          </div>
        ) : roles.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-8 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No custom roles yet</p>
            <p className="text-xs text-muted-foreground/80 mt-1">Create a custom role to fine-tune team access</p>
            {canManageRoles && (
              <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={openCreateForm}>
                <Plus className="w-4 h-4" /> Create First Role
              </Button>
            )}
          </div>
        ) : (
          roles.map((role) => (
            <div key={role.id} className="bg-card rounded-lg border border-border overflow-hidden">
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedRole === role.id ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{role.name}</p>
                      {!role.is_active && (
                        <span className="text-xs bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{role.permissions.length} permissions</span>
                  {canManageRoles && !role.is_system && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditForm(role) }}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(role.id) }}
                        className="p-1.5 rounded hover:bg-red-500/10 text-red-500 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {expandedRole === role.id && (
                <div className="px-6 py-4 border-t border-border bg-muted/30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(allPerms).map(([module, perms]) => {
                      const modulePerms = (perms as { key: string; action: string }[]).map((p) => p.key)
                      const hasAny = modulePerms.some((p) => role.permissions.includes(p))
                      if (!hasAny) return null
                      const Icon = MODULE_ICONS[module] || Shield
                      return (
                        <div key={module} className="bg-card rounded-lg border border-border p-3">
                          <p className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-2">
                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                            {MODULE_LABELS[module] || module}
                          </p>
                          <div className="space-y-1">
                            {(perms as { key: string; action: string }[]).map((p) => (
                              <div key={p.key} className="flex items-center gap-1.5 text-xs">
                                {role.permissions.includes(p.key) ? (
                                  <Check className="w-3 h-3 text-green-500 dark:text-green-400" />
                                ) : (
                                  <X className="w-3 h-3 text-muted-foreground/50" />
                                )}
                                <span className={role.permissions.includes(p.key) ? 'text-foreground' : 'text-muted-foreground'}>
                                  {p.action}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Role Modal */}
      {showForm && (
        <ModalOverlay onClose={() => setShowForm(false)} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-h-[calc(100dvh-1.5rem)] max-w-2xl !rounded-lg overflow-hidden">
            <ModalHeader
              title={editRole ? 'Edit Role' : 'Create New Role'}
              onClose={() => setShowForm(false)}
              className="border-0 px-4 py-2.5 [&>div>h2]:text-base [&>div>h2]:leading-none"
            />
            <ModalBody className="space-y-3 overflow-y-auto px-4 pb-1 pt-0">
              <div>
                <label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Role Name</label>
                <input
                  type="text"
                  className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Warehouse Manager"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">Description (optional)</label>
                <textarea
                  className="w-full resize-none rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="What can this role do?"
                  rows={2}
                />
              </div>

              {/* Permissions */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">Permissions</label>
                  <div className="flex gap-2">
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => setFormPerms([...allPermsList])}
                    >
                      Select All
                    </button>
                    <span className="text-border">|</span>
                    <button
                      className="text-xs text-muted-foreground hover:underline"
                      onClick={() => setFormPerms([])}
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(allPerms).map(([module, perms]) => {
                    const modulePerms = (perms as { key: string; action: string }[]).map((p) => p.key)
                    const allChecked = modulePerms.every((p) => formPerms.includes(p))
                    const someChecked = modulePerms.some((p) => formPerms.includes(p))
                    const Icon = MODULE_ICONS[module] || Shield

                    return (
                      <div key={module} className="border border-border rounded-lg p-3 bg-muted/20">
                        <label className="flex items-center gap-2 cursor-pointer mb-2">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked }}
                            onChange={() => toggleModule(module)}
                            className="rounded border-input text-primary focus:ring-primary/20"
                          />
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">
                            {MODULE_LABELS[module] || module}
                          </span>
                        </label>
                        <div className="ml-6 space-y-1.5">
                          {(perms as { key: string; action: string }[]).map((p) => (
                            <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formPerms.includes(p.key)}
                                onChange={() => togglePerm(p.key)}
                                className="rounded border-input text-primary focus:ring-primary/20"
                              />
                              <span className="text-xs text-muted-foreground">{p.action}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  {formPerms.length} of {allPermsList.length} permissions selected
                </p>
              </div>
            </ModalBody>
            <ModalFooter className="border-0 px-4 py-2.5">
              <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                type="button"
                size="sm"
                className="h-8"
                onClick={handleSave}
                disabled={!formName || createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending)
                  ? 'Saving...'
                  : editRole ? 'Update Role' : 'Create Role'}
              </Button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}
    </div>
  )
}
