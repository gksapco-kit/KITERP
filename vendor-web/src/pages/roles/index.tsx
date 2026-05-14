import { useState } from 'react'
import {
  ShieldCheck, Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronRight,
  Lock, Eye, Package, Wrench, ShoppingCart, Users as UsersIcon,
  MessageSquare, Settings, UserPlus, Shield, UserCog,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useRoles, useAllPermissions, useDefaultRoles, useCreateRole, useUpdateRole, useDeleteRole,
} from '@/hooks/useVendor'
import { useAuthStore } from '@/stores/authStore'
import type { VendorRole } from '@/types'

const MODULE_ICONS: Record<string, React.ElementType> = {
  dashboard: Eye,
  products: Package,
  services: Wrench,
  orders: ShoppingCart,
  customers: UsersIcon,
  reviews: MessageSquare,
  settings: Settings,
  team: UserPlus,
  roles: ShieldCheck,
  hr: UserCog,
}

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  services: 'Services',
  orders: 'Orders',
  customers: 'Customers',
  reviews: 'Reviews',
  settings: 'Settings',
  team: 'Team',
  roles: 'Roles',
  hr: 'Human Resources',
}

export default function RolesPage() {
  const { user } = useAuthStore()
  const { data: rolesData, isLoading } = useRoles()
  const { data: permData } = useAllPermissions()
  const { data: defaultsData } = useDefaultRoles()
  const createMutation = useCreateRole()
  const updateMutation = useUpdateRole()
  const deleteMutation = useDeleteRole()

  const [showForm, setShowForm] = useState(false)
  const [editRole, setEditRole] = useState<VendorRole | null>(null)
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [expandedBuiltIn, setExpandedBuiltIn] = useState<string | null>(null)

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

  const handleDelete = (roleId: string) => {
    if (confirm('Delete this role? Team members using it will lose their custom permissions.')) {
      deleteMutation.mutate(roleId)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-primary" />
            Roles & Permissions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Define custom roles to control team member access
          </p>
        </div>
        {canManageRoles && (
          <Button onClick={openCreateForm} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Role
          </Button>
        )}
      </div>

      {/* Built-in Roles with Permissions */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Built-in System Roles</h2>
          <span className="text-xs text-gray-400">Click to view permissions</span>
        </div>
        {defaultRoles.map((dr) => {
          const isExpanded = expandedBuiltIn === dr.name
          const permCount = dr.permissions.length
          const roleColors: Record<string, string> = {
            owner: 'border-primary/30 bg-accent',
            admin: 'border-blue-200 bg-blue-50',
            manager: 'border-green-200 bg-green-50',
            sales: 'border-orange-200 bg-orange-50',
            staff: 'border-gray-200 bg-gray-50',
          }
          const headerColors: Record<string, string> = {
            owner: 'text-primary', admin: 'text-blue-700',
            manager: 'text-green-700', sales: 'text-orange-700', staff: 'text-gray-700',
          }
          return (
            <div key={dr.name} className={`rounded-lg border overflow-hidden ${roleColors[dr.name] || 'border-gray-200'}`}>
              <div
                className="flex items-center justify-between px-5 py-3 cursor-pointer hover:opacity-80"
                onClick={() => setExpandedBuiltIn(isExpanded ? null : dr.name)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <Shield className={`w-4 h-4 ${headerColors[dr.name] || 'text-gray-600'}`} />
                  <span className={`font-medium capitalize ${headerColors[dr.name] || 'text-gray-700'}`}>{dr.name}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {permCount === allPermsList.length ? 'All permissions' : `${permCount} of ${allPermsList.length} permissions`}
                </span>
              </div>
              {isExpanded && (
                <div className="px-5 py-4 border-t border-white/50 bg-white/60">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(allPerms).map(([module, perms]) => {
                      const Icon = MODULE_ICONS[module] || Shield
                      return (
                        <div key={module} className="bg-white rounded-lg border border-gray-200 p-3">
                          <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5 mb-2">
                            <Icon className="w-3.5 h-3.5" />
                            {MODULE_LABELS[module] || module}
                          </p>
                          <div className="space-y-1">
                            {(perms as { key: string; action: string }[]).map((p) => (
                              <div key={p.key} className="flex items-center gap-1.5 text-xs">
                                {dr.permissions.includes(p.key) ? (
                                  <Check className="w-3 h-3 text-green-500" />
                                ) : (
                                  <X className="w-3 h-3 text-red-400" />
                                )}
                                <span className={dr.permissions.includes(p.key) ? 'text-gray-700' : 'text-gray-400 line-through'}>
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
        <h2 className="text-lg font-semibold text-gray-900">Custom Roles</h2>
        {isLoading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            Loading roles...
          </div>
        ) : roles.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No custom roles yet</p>
            <p className="text-xs text-gray-400 mt-1">Create a custom role to fine-tune team access</p>
            {canManageRoles && (
              <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={openCreateForm}>
                <Plus className="w-4 h-4" /> Create First Role
              </Button>
            )}
          </div>
        ) : (
          roles.map((role) => (
            <div key={role.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedRole === role.id ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{role.name}</p>
                      {!role.is_active && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{role.permissions.length} permissions</span>
                  {canManageRoles && !role.is_system && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditForm(role) }}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(role.id) }}
                        className="p-1.5 rounded hover:bg-red-50 text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {expandedRole === role.id && (
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(allPerms).map(([module, perms]) => {
                      const modulePerms = (perms as { key: string; action: string }[]).map((p) => p.key)
                      const hasAny = modulePerms.some((p) => role.permissions.includes(p))
                      if (!hasAny) return null
                      const Icon = MODULE_ICONS[module] || Shield
                      return (
                        <div key={module} className="bg-white rounded-lg border border-gray-200 p-3">
                          <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5 mb-2">
                            <Icon className="w-3.5 h-3.5" />
                            {MODULE_LABELS[module] || module}
                          </p>
                          <div className="space-y-1">
                            {(perms as { key: string; action: string }[]).map((p) => (
                              <div key={p.key} className="flex items-center gap-1.5 text-xs">
                                {role.permissions.includes(p.key) ? (
                                  <Check className="w-3 h-3 text-green-500" />
                                ) : (
                                  <X className="w-3 h-3 text-gray-300" />
                                )}
                                <span className={role.permissions.includes(p.key) ? 'text-gray-700' : 'text-gray-400'}>
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">
                {editRole ? 'Edit Role' : 'Create New Role'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Warehouse Manager"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="What can this role do?"
                  rows={2}
                />
              </div>

              {/* Permissions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">Permissions</label>
                  <div className="flex gap-2">
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => setFormPerms([...allPermsList])}
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      className="text-xs text-gray-500 hover:underline"
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
                      <div key={module} className="border border-gray-200 rounded-lg p-3">
                        <label className="flex items-center gap-2 cursor-pointer mb-2">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked }}
                            onChange={() => toggleModule(module)}
                            className="rounded border-gray-300 text-primary focus:ring-primary/20"
                          />
                          <Icon className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-700">
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
                                className="rounded border-gray-300 text-primary focus:ring-primary/20"
                              />
                              <span className="text-xs text-gray-600">{p.action}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <p className="text-xs text-gray-400 mt-2">
                  {formPerms.length} of {allPermsList.length} permissions selected
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl shrink-0">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={!formName || createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending)
                  ? 'Saving...'
                  : editRole ? 'Update Role' : 'Create Role'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
