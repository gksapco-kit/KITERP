/**
 * Master Data — Groups Maintenance
 * Manage party group tags (Regular, VIP, Wholesale, custom…).
 * Groups are stored in localStorage (md_party_groups) so changes
 * sync instantly with the Add / Edit party modal on the same browser.
 */
import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus, Pencil, Trash2, Search, Tag, Lock, Users,
  CheckCircle2, X, RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useCustomers } from '@/hooks/useVendor'
import { useNavigate } from 'react-router-dom'

// ── localStorage keys (must match AddPartyModal) ─────────────────────────────
const LS_GROUPS_KEY = 'md_party_groups'

const SYSTEM_GROUPS = [
  'VIP', 'Regular', 'New', 'Premium', 'Preferred',
  'Wholesale', 'Retail', 'Export', 'Domestic', 'Import',
  'Credit Account', 'Cash Account', 'On-Hold', 'Blacklisted',
]

const GROUP_PALETTE = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-yellow-100 text-yellow-700 border-yellow-200',
  'bg-red-100 text-red-700 border-red-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
]

function groupColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % GROUP_PALETTE.length
  return GROUP_PALETTE[h]
}

function loadCustomGroups(): string[] {
  try {
    const raw = localStorage.getItem(LS_GROUPS_KEY)
    const saved: string[] = raw ? JSON.parse(raw) : []
    return Array.isArray(saved) ? saved : []
  } catch { return [] }
}

function saveCustomGroups(groups: string[]) {
  try { localStorage.setItem(LS_GROUPS_KEY, JSON.stringify(groups)) } catch { /* ignore */ }
}

export default function GroupsPage() {
  const navigate = useNavigate()
  const [customGroups, setCustomGroups] = useState<string[]>(loadCustomGroups)
  const [search, setSearch] = useState('')
  const [addingName, setAddingName] = useState('')
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Fetch total customers to show counts per group
  const { data: customersData } = useCustomers({ size: 500 })
  const customers = customersData?.items ?? []

  // Count parties per group
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    customers.forEach(c => {
      const raw = (c as unknown as Record<string, unknown>).groups
      if (Array.isArray(raw)) {
        (raw as string[]).forEach(g => { counts[g] = (counts[g] ?? 0) + 1 })
      }
    })
    return counts
  }, [customers])

  const allGroups = useMemo(() => {
    const merged = [...SYSTEM_GROUPS]
    customGroups.forEach(g => { if (!merged.includes(g)) merged.push(g) })
    return merged
  }, [customGroups])

  const filtered = useMemo(() =>
    allGroups.filter(g => g.toLowerCase().includes(search.toLowerCase())),
    [allGroups, search])

  const handleAdd = () => {
    const name = addingName.trim()
    if (!name) return
    const normalised = name.charAt(0).toUpperCase() + name.slice(1)
    if (allGroups.includes(normalised)) {
      toast.error(`Group "${normalised}" already exists`)
      return
    }
    const next = [...customGroups, normalised]
    setCustomGroups(next)
    saveCustomGroups(next)
    setAddingName('')
    toast.success(`Group "${normalised}" added`)
  }

  const handleEditSave = () => {
    if (!editTarget) return
    const name = editName.trim()
    if (!name) { setEditTarget(null); return }
    if (SYSTEM_GROUPS.includes(editTarget)) { toast.error('System groups cannot be renamed'); setEditTarget(null); return }
    const normalised = name.charAt(0).toUpperCase() + name.slice(1)
    if (allGroups.includes(normalised) && normalised !== editTarget) {
      toast.error(`Group "${normalised}" already exists`)
      return
    }
    const next = customGroups.map(g => g === editTarget ? normalised : g)
    setCustomGroups(next)
    saveCustomGroups(next)
    setEditTarget(null)
    toast.success('Group renamed')
  }

  const handleDelete = (name: string) => {
    if (SYSTEM_GROUPS.includes(name)) { toast.error('System groups cannot be deleted'); return }
    setDeleteTarget(name)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const next = customGroups.filter(g => g !== deleteTarget)
    setCustomGroups(next)
    saveCustomGroups(next)
    setDeleteTarget(null)
    toast.success('Group deleted')
  }

  const isSystem = (name: string) => SYSTEM_GROUPS.includes(name)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" /> Business Partner Groups
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage segment tags assigned to customers and suppliers.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/master-data')}>
          <Users className="w-3.5 h-3.5 mr-1.5" /> View Business Partners
        </Button>
      </div>

      {/* Add group + search row */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search groups…"
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
            placeholder="New group name…"
            className="h-8 text-sm w-44"
          />
          <Button size="sm" className="h-8" onClick={handleAdd} disabled={!addingName.trim()}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-3 text-sm text-muted-foreground">
        <span>{allGroups.length} total groups</span>
        <span>·</span>
        <span>{SYSTEM_GROUPS.length} system</span>
        <span>·</span>
        <span>{customGroups.length} custom</span>
      </div>

      {/* Groups grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(name => (
          <div key={name}
            className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3">
            {/* Color chip */}
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold truncate max-w-[8rem] ${groupColor(name)}`}>
              {name}
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
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{name}</span>
                  {isSystem(name) && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      <Lock className="w-2.5 h-2.5" /> system
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {(groupCounts[name] ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => navigate(`/master-data?group=${encodeURIComponent(name)}`)}
                  className="text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-1.5 py-0.5 hover:bg-primary/20 transition-colors"
                  title={`View ${groupCounts[name]} business partners`}
                >
                  {groupCounts[name]}
                </button>
              )}
              {!isSystem(name) && editTarget !== name && (
                <>
                  <button type="button"
                    onClick={() => { setEditTarget(name); setEditName(name) }}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Rename">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button type="button"
                    onClick={() => handleDelete(name)}
                    className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                    title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-3 py-12 text-center text-muted-foreground text-sm">
            {search ? `No groups match "${search}"` : 'No groups yet'}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete group "${deleteTarget}"?`}
        description="This removes the group from the list. Existing business partners that already have this tag will keep the value until manually edited."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
