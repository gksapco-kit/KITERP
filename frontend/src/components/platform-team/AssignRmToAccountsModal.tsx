import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, selectOptionsWithBlank } from '@/components/ui/select'
import {
  adminApi,
  type AdminVendor,
  type ListVendorsParams,
  type RelationshipManagerOption,
} from '@/api/admin.api'
import { adminKeys, useAdminVendors, useRelationshipManagerOptions } from '@/hooks/useAdmin'
import { platformTeamSelectClassName } from '@/lib/platformTeam'
import { ChevronLeft, ChevronRight, Loader2, Search, Store } from 'lucide-react'

type Props = {
  onClose: () => void
  relationshipManagerUserId: string
  rmName: string
}

type BulkAction = 'assign_here' | 'clear' | 'assign_other'

function detailMessage(err: unknown): string {
  const d = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
  return typeof d === 'string' ? d : 'Request failed'
}

function rmOptionLabel(o: RelationshipManagerOption): string {
  const login =
    o.login_display?.trim() || o.email?.trim() || o.phone?.trim() || o.full_name?.trim() || o.id
  const name = o.full_name?.trim()
  if (name && login !== name) return `${login} — ${name}`
  return login
}

function rmBriefLogin(v: AdminVendor['relationship_manager']): string {
  if (!v) return '—'
  const login = (v.email || '').trim() || (v.phone || '').trim() || v.full_name?.trim() || '—'
  return login
}

export function AssignRmToAccountsModal({
  onClose,
  relationshipManagerUserId,
  rmName,
}: Props) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkAction, setBulkAction] = useState<BulkAction>('assign_here')
  const [otherRmId, setOtherRmId] = useState('')
  const [assigning, setAssigning] = useState(false)

  const pageSize = 15

  const searchTrimmed = search.trim()

  const { data: rmOptions } = useRelationshipManagerOptions(bulkAction === 'assign_other')

  const otherRmChoices = useMemo(
    () => (rmOptions ?? []).filter((o) => o.id !== relationshipManagerUserId),
    [rmOptions, relationshipManagerUserId],
  )

  const listParams = useMemo((): ListVendorsParams => {
    const p: ListVendorsParams = { page, size: pageSize }
    if (searchTrimmed) p.search = searchTrimmed
    return p
  }, [page, pageSize, searchTrimmed])

  const { data, isLoading, isFetching } = useAdminVendors(listParams)

  useEffect(() => {
    setPage(1)
    setSearch('')
    setSearchInput('')
    setSelectedIds(new Set())
    setBulkAction('assign_here')
    setOtherRmId('')
  }, [relationshipManagerUserId])

  useEffect(() => {
    if (bulkAction !== 'assign_other') setOtherRmId('')
  }, [bulkAction])

  const items = data?.items ?? []

  const allOnPageSelected = useMemo(() => {
    if (!items.length) return false
    return items.every((v) => selectedIds.has(v.id))
  }, [items, selectedIds])

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) {
        for (const v of items) next.delete(v.id)
      } else {
        for (const v of items) next.add(v.id)
      }
      return next
    })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput.trim())
    setPage(1)
    setSelectedIds(new Set())
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearch('')
    setPage(1)
    setSelectedIds(new Set())
  }

  const resolveTargetRmId = (): string | null => {
    if (bulkAction === 'clear') return null
    if (bulkAction === 'assign_here') return relationshipManagerUserId
    return otherRmId.trim() || null
  }

  const handleApply = async () => {
    if (selectedIds.size === 0) return
    const targetRmId = resolveTargetRmId()
    if (bulkAction === 'assign_other' && !targetRmId) {
      toast.error('Choose a relationship manager to assign.')
      return
    }

    setAssigning(true)
    const ids = [...selectedIds]
    let ok = 0
    const errors: string[] = []
    for (const vendorId of ids) {
      try {
        await adminApi.updateVendor(vendorId, {
          relationship_manager_user_id: targetRmId,
        })
        ok++
      } catch (e) {
        errors.push(detailMessage(e))
      }
    }
    setAssigning(false)
    await queryClient.invalidateQueries({ queryKey: adminKeys.vendors() })
    await queryClient.invalidateQueries({ queryKey: adminKeys.vendorStats() })
    if (ok > 0) {
      if (bulkAction === 'clear') {
        toast.success(ok === 1 ? 'Removed RM from 1 account.' : `Removed RM from ${ok} accounts.`)
      } else if (bulkAction === 'assign_other') {
        toast.success(
          ok === 1 ? 'Moved 1 account to the selected RM.' : `Moved ${ok} accounts to the selected RM.`,
        )
      } else {
        toast.success(
          ok === 1 ? 'Assigned 1 business account.' : `Assigned ${ok} business accounts.`,
        )
      }
    }
    if (errors.length > 0) {
      toast.error(
        errors.length === 1
          ? errors[0]
          : `${errors.length} updates failed. First error: ${errors[0]}`,
      )
    }
    if (ok > 0) {
      setSelectedIds(new Set())
      onClose()
    }
  }

  const applyDisabled =
    selectedIds.size === 0 ||
    assigning ||
    (bulkAction === 'assign_other' && !otherRmId.trim())

  const colCount = 7

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-rm-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !assigning) onClose()
      }}
    >
      <div
        className="w-full max-w-6xl max-h-[90vh] rounded-lg border bg-background shadow-lg flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b space-y-1 shrink-0">
          <h3 id="assign-rm-title" className="font-semibold text-lg">
            Manage business account assignments
          </h3>
          <p className="text-sm text-muted-foreground">
            All business accounts load below (paginated). Optionally narrow the list with search. Profile context:{' '}
            <span className="font-medium text-foreground">{rmName}</span>.
          </p>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="assign-rm-bulk-action">Action for selected accounts</Label>
              <Select
                id="assign-rm-bulk-action"
                className={platformTeamSelectClassName}
                value={bulkAction}
                disabled={assigning}
                onChange={(v) => setBulkAction(v as BulkAction)}
                options={[
                  { value: 'assign_here', label: `Assign to ${rmName}` },
                  { value: 'clear', label: 'Clear relationship manager' },
                  { value: 'assign_other', label: 'Assign to another RM…' },
                ]}
              />
            </div>
            {bulkAction === 'assign_other' && (
              <div className="space-y-1">
                <Label htmlFor="assign-rm-other">Relationship manager (login)</Label>
                <Select
                  id="assign-rm-other"
                  className={platformTeamSelectClassName}
                  value={otherRmId}
                  disabled={assigning}
                  onChange={setOtherRmId}
                  options={selectOptionsWithBlank(
                    'Choose…',
                    otherRmChoices.map((o) => ({ value: o.id, label: rmOptionLabel(o) })),
                  )}
                />
                {otherRmChoices.length === 0 && (
                  <p className="text-xs text-muted-foreground">No other eligible RMs in directory.</p>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSearch} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="assign-rm-search">Search businesses</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="assign-rm-search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Business name, display name, email, phone, slug…"
                  className="pl-9"
                  disabled={assigning}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty and click Search to show all accounts on each page. Filter by name, email, phone, or slug.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant="outline" disabled={assigning} onClick={handleClearSearch}>
                Show all
              </Button>
              <Button type="submit" variant="secondary" disabled={assigning}>
                Search
              </Button>
            </div>
          </form>

          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center text-sm">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading accounts…
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm min-w-[860px]">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left">
                      <th className="px-3 py-2 font-medium text-muted-foreground w-10">
                        <input
                          type="checkbox"
                          className="rounded border-input"
                          checked={allOnPageSelected}
                          disabled={items.length === 0 || assigning}
                          onChange={toggleSelectAllOnPage}
                          title="Select all on this page"
                          aria-label="Select all on this page"
                        />
                      </th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Business</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Contact</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Location</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Industry</th>
                      <th className="px-3 py-2 font-medium text-muted-foreground">Current RM (login)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={colCount} className="px-3 py-8 text-center text-muted-foreground">
                          {searchTrimmed
                            ? 'No accounts match this search. Try another name, email, phone, or slug.'
                            : 'No business accounts in the directory.'}
                        </td>
                      </tr>
                    ) : (
                      items.map((v) => {
                        const onThisRm = v.relationship_manager_user_id === relationshipManagerUserId
                        const rm = v.relationship_manager
                        const loginLine = rmBriefLogin(rm)
                        return (
                          <tr key={v.id} className={onThisRm ? 'bg-muted/20' : undefined}>
                            <td className="px-3 py-2 align-top">
                              <input
                                type="checkbox"
                                className="rounded border-input mt-1"
                                checked={selectedIds.has(v.id)}
                                disabled={assigning}
                                onChange={() => toggleId(v.id)}
                                aria-label={`Select ${v.business_name || v.display_name}`}
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="flex items-start gap-2 min-w-0">
                                <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                                  <Store className="w-4 h-4 text-primary" />
                                </div>
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium leading-tight">{v.business_name || v.display_name}</p>
                                    {onThisRm && (
                                      <span className="text-xs uppercase tracking-wide font-semibold text-primary shrink-0 px-1.5 py-0.5 rounded bg-primary/10">
                                        This RM
                                      </span>
                                    )}
                                  </div>
                                  {v.display_name && v.display_name !== v.business_name && (
                                    <p className="text-xs text-muted-foreground truncate">{v.display_name}</p>
                                  )}
                                  <p className="text-xs text-muted-foreground font-mono truncate">{v.slug}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Subdomain: {v.subdomain || '—'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top whitespace-nowrap capitalize text-muted-foreground">
                              {v.status?.replace('_', ' ') ?? '—'}
                            </td>
                            <td className="px-3 py-2 align-top text-muted-foreground">
                              <div className="space-y-0.5 max-w-[14rem]">
                                <p className="truncate">{v.primary_email || '—'}</p>
                                <p className="truncate">{v.primary_phone || '—'}</p>
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top text-muted-foreground">
                              <div className="space-y-0.5 max-w-[12rem]">
                                <p className="truncate">{v.city || '—'}</p>
                                <p className="truncate">
                                  {[v.state, v.postal_code].filter(Boolean).join(' ') || '—'}
                                </p>
                                <p className="truncate text-xs">{v.country || ''}</p>
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top text-muted-foreground max-w-[10rem]">
                              <p className="truncate">{v.industry || '—'}</p>
                              <p className="text-xs truncate capitalize">{v.business_type}</p>
                            </td>
                            <td className="px-3 py-2 align-top text-muted-foreground">
                              <div className="space-y-0.5 max-w-[13rem]">
                                <p className="font-medium text-foreground truncate">{loginLine}</p>
                                {rm && (rm.email || rm.phone) && rm.full_name && (
                                  <p className="text-xs truncate">{rm.full_name}</p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {data && data.pages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>
                    Page {data.page} of {data.pages} ({data.total}
                    {searchTrimmed ? ' matching' : ' total'})
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || isFetching || assigning}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={page >= data.pages || isFetching || assigning}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t flex flex-wrap justify-end gap-2 shrink-0">
          <Button type="button" variant="cancel" onClick={onClose} disabled={assigning}>Cancel</Button>
          <Button type="button" onClick={handleApply} disabled={applyDisabled}>
            {assigning ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Applying…
              </>
            ) : (
              `Apply to selected (${selectedIds.size})`
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
