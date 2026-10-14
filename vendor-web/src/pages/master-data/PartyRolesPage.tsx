/**
 * Master Data — Party Roles Maintenance
 * Manage party role types (Customer, Vendor, Employee, Partner, Contractor + custom).
 * Custom roles are stored in localStorage (md_custom_party_types) so they sync
 * instantly with the Add / Edit party modal on the same browser.
 */
import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus, Pencil, Trash2, Search, ShieldCheck, Lock,
  CheckCircle2, X, Users, Briefcase, HardHat, UserCog, Truck,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useCustomers, useSuppliers } from '@/hooks/useVendor'
import { useNavigate } from 'react-router-dom'
import type { Customer, Supplier } from '@/types'

// ── localStorage key (must match AddPartyModal) ───────────────────────────────
const LS_CUSTOM_PARTY_TYPES_KEY = 'md_custom_party_types'

// ── Built-in / system roles ───────────────────────────────────────────────────
const SYSTEM_ROLES: { value: string; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'customer',   label: 'Customer',   icon: <Users className="w-4 h-4 text-blue-600" />,   description: 'Individuals or companies that purchase goods/services' },
  { value: 'supplier',   label: 'Vendor',     icon: <Truck className="w-4 h-4 text-orange-600" />, description: 'Suppliers from whom you procure materials or services' },
  { value: 'employee',   label: 'Employee',   icon: <UserCog className="w-4 h-4 text-green-600" />, description: 'Internal staff members' },
  { value: 'partner',    label: 'Partner',    icon: <Briefcase className="w-4 h-4 text-purple-600" />, description: 'Business partners and agencies' },
  { value: 'contractor', label: 'Contractor', icon: <HardHat className="w-4 h-4 text-amber-600" />, description: 'External contractors and freelancers' },
]

function loadCustomRoles(): string[] {
  try {
    const raw = localStorage.getItem(LS_CUSTOM_PARTY_TYPES_KEY)
    const saved: string[] = raw ? JSON.parse(raw) : []
    return Array.isArray(saved) ? saved : []
  } catch { return [] }
}

function saveCustomRoles(roles: string[]) {
  try { localStorage.setItem(LS_CUSTOM_PARTY_TYPES_KEY, JSON.stringify(roles)) } catch { /* ignore */ }
}

const ROLE_COLORS = [
  'bg-sky-100 text-sky-700 border-sky-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
]
function roleColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % ROLE_COLORS.length
  return ROLE_COLORS[h]
}

export default function PartyRolesPage() {
  const navigate = useNavigate()
  const [customRoles, setCustomRoles] = useState<string[]>(loadCustomRoles)
  const [search, setSearch] = useState('')
  const [addingName, setAddingName] = useState('')
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: customersData } = useCustomers({ size: 500 })
  const { data: suppliersData } = useSuppliers({ size: 500 })
  const customers: Customer[] = customersData?.items ?? []
  const suppliers: Supplier[] = suppliersData?.items ?? []

  // Count per role
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    customers.forEach(c => {
      const g = (c as unknown as Record<string, unknown>).customer_group as string || 'customer'
      // Customers always count as "customer" role
      counts['customer'] = (counts['customer'] ?? 0) + 1
    })
    suppliers.forEach(s => {
      const pt = (s.party_type as string) || 'supplier'
      counts[pt] = (counts[pt] ?? 0) + 1
    })
    return counts
  }, [customers, suppliers])

  const systemLabels = SYSTEM_ROLES.map(r => r.label.toLowerCase())

  const allRoleLabels = useMemo(() => [
    ...SYSTEM_ROLES.map(r => r.label),
    ...customRoles,
  ], [customRoles])

  const filteredSystem = SYSTEM_ROLES.filter(r =>
    r.label.toLowerCase().includes(search.toLowerCase()) ||
    r.description.toLowerCase().includes(search.toLowerCase())
  )
  const filteredCustom = customRoles.filter(r =>
    r.toLowerCase().includes(search.toLowerCase())
  )

  const handleAdd = () => {
    const name = addingName.trim()
    if (!name) return
    const normalised = name.charAt(0).toUpperCase() + name.slice(1)
    if (allRoleLabels.map(l => l.toLowerCase()).includes(normalised.toLowerCase())) {
      toast.error(`Role "${normalised}" already exists`)
      return
    }
    const next = [...customRoles, normalised]
    setCustomRoles(next)
    saveCustomRoles(next)
    setAddingName('')
    toast.success(`Role "${normalised}" added`)
  }

  const handleEditSave = () => {
    if (!editTarget) return
    const name = editName.trim()
    if (!name) { setEditTarget(null); return }
    const normalised = name.charAt(0).toUpperCase() + name.slice(1)
    if (allRoleLabels.map(l => l.toLowerCase()).includes(normalised.toLowerCase()) &&
        normalised !== editTarget) {
      toast.error(`Role "${normalised}" already exists`)
      return
    }
    const next = customRoles.map(r => r === editTarget ? normalised : r)
    setCustomRoles(next)
    saveCustomRoles(next)
    setEditTarget(null)
    toast.success('Role renamed')
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const next = customRoles.filter(r => r !== deleteTarget)
    setCustomRoles(next)
    saveCustomRoles(next)
    setDeleteTarget(null)
    toast.success('Role deleted')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Business Partner Roles
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage role types for customers, vendors, employees and custom business partners.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/master-data')}>
          <Users className="w-3.5 h-3.5 mr-1.5" /> View Business Partners
        </Button>
      </div>

      {/* Add + search row */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search roles…"
            className="pl-8 h-8 text-sm"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5">
          <Input
            value={addingName}
            onChange={e => setAddingName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="New custom role…"
            className="h-8 text-sm w-44"
          />
          <Button size="sm" className="h-8" onClick={handleAdd} disabled={!addingName.trim()}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 text-sm text-muted-foreground">
        <span>{SYSTEM_ROLES.length} system roles</span>
        <span>·</span>
        <span>{customRoles.length} custom roles</span>
      </div>

      {/* System roles */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
          <Lock className="w-3 h-3" /> System Roles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSystem.map(role => (
            <div key={role.value}
              className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                {role.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{role.label}</p>
                <p className="text-[11px] text-muted-foreground truncate">{role.description}</p>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                {(roleCounts[role.value] ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate(`/master-data?type=${role.value}`)}
                    className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-1.5 py-0.5 hover:bg-primary/20 transition-colors"
                    title={`${roleCounts[role.value]} business partners`}
                  >
                    {roleCounts[role.value]}
                  </button>
                )}
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  <Lock className="w-2.5 h-2.5" /> system
                </span>
              </div>
            </div>
          ))}
          {filteredSystem.length === 0 && search && (
            <p className="col-span-3 text-sm text-muted-foreground italic">No system roles match "{search}"</p>
          )}
        </div>
      </div>

      {/* Custom roles */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
          <UserCog className="w-3 h-3" /> Custom Roles
        </h2>
        {filteredCustom.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            {search ? `No custom roles match "${search}"` : 'No custom roles yet — type a name above and click Add.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCustom.map(name => (
              <div key={name}
                className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold shrink-0 ${roleColor(name)}`}>
                  {name.charAt(0).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  {editTarget === name ? (
                    <div className="flex items-center gap-1">
                      <Input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleEditSave()
                          if (e.key === 'Escape') setEditTarget(null)
                        }}
                        className="h-7 text-xs py-0 px-2 flex-1"
                      />
                      <button type="button" onClick={handleEditSave}
                        className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => setEditTarget(null)}
                        className="p-1 text-muted-foreground hover:bg-muted rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold truncate">{name}</p>
                  )}
                </div>
                {editTarget !== name && (
                  <div className="flex items-center gap-1 shrink-0">
                    {(roleCounts[name.toLowerCase()] ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => navigate(`/master-data?type=${name.toLowerCase()}`)}
                        className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-1.5 py-0.5 hover:bg-primary/20 transition-colors"
                        title={`${roleCounts[name.toLowerCase()]} business partners`}
                      >
                        {roleCounts[name.toLowerCase()]}
                      </button>
                    )}
                    <button type="button"
                      onClick={() => { setEditTarget(name); setEditName(name) }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Rename">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button"
                      onClick={() => setDeleteTarget(name)}
                      className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                      title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete role "${deleteTarget}"?`}
        description="This removes the role from the list. Existing business partners tagged with this role will keep the value until manually edited."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
