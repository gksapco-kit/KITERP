import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import type { RestaurantOutlet } from '@/types'
import { useStores } from '@/hooks/useVendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'
import {
  Plus, UtensilsCrossed, Edit2, Trash2, Star, Loader2, Building2, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { KOTNumberingSection } from '@/components/restaurant/KOTNumberingSection'

// ── Form state ────────────────────────────────────────────────────────────

interface FormData {
  store_id: string
  name: string
  code: string
  cuisine: string
  phone: string
  email: string
  is_active: boolean
}

const EMPTY_FORM: FormData = {
  store_id: '', name: '', code: '', cuisine: '', phone: '', email: '', is_active: true,
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function RestaurantsPage() {
  const qc = useQueryClient()
  const { selectedRestaurant, setSelectedRestaurant } = useRestaurantStore()

  const [modal, setModal] = useState<'create' | { id: string } | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<RestaurantOutlet | null>(null)

  const { data: storesData } = useStores()
  const stores = storesData?.stores ?? []

  const { data, isLoading } = useQuery({
    queryKey: ['restaurants'],
    queryFn: () => vendorApi.listRestaurants(),
  })
  const restaurants = data?.items ?? []

  const createMutation = useMutation({
    mutationFn: (d: typeof form) => vendorApi.createRestaurant({
      store_id: d.store_id, name: d.name, code: d.code || undefined,
      cuisine: d.cuisine || undefined, phone: d.phone || undefined, email: d.email || undefined,
      is_active: d.is_active,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurants'] }); setModal(null); toast.success('Restaurant created') },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to create'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: typeof form }) => vendorApi.updateRestaurant(id, {
      name: d.name, code: d.code || undefined, cuisine: d.cuisine || undefined,
      phone: d.phone || undefined, email: d.email || undefined, is_active: d.is_active,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurants'] }); setModal(null); toast.success('Restaurant updated') },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to update'),
  })

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => vendorApi.updateRestaurant(id, { is_default: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['restaurants'] }); toast.success('Default restaurant updated') },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vendorApi.deleteRestaurant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurants'] })
      setDeleteTarget(null)
      toast.success('Restaurant deleted')
      if (selectedRestaurant && selectedRestaurant.id === deleteTarget?.id) setSelectedRestaurant(null)
    },
    onError: (e: unknown) => toast.error((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Cannot delete'),
  })

  function openCreate() {
    setForm({ ...EMPTY_FORM, store_id: stores[0]?.id ?? '' })
    setModal('create')
  }

  function openEdit(r: RestaurantOutlet) {
    setForm({
      store_id: r.store_id, name: r.name, code: r.code ?? '', cuisine: r.cuisine ?? '',
      phone: r.phone ?? '', email: r.email ?? '', is_active: r.is_active,
    })
    setModal({ id: r.id })
  }

  function submit() {
    if (!form.name.trim()) return toast.error('Restaurant name is required')
    if (!form.store_id) return toast.error('Select a Business Unit')
    if (modal === 'create') createMutation.mutate(form)
    else if (modal && typeof modal === 'object') updateMutation.mutate({ id: modal.id, d: form })
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  const storeMap = Object.fromEntries(stores.map(s => [s.id, s.name]))

  return (
    <div className="mx-auto max-w-5xl space-y-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          Outlets under a Business Unit · floors, kitchen, and reservations are scoped per restaurant
        </p>
        <Button onClick={openCreate} className="h-8 shrink-0 gap-1.5 px-3 text-sm">
          <Plus className="h-3.5 w-3.5" /> New Restaurant
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />Loading…
        </div>
      ) : restaurants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <UtensilsCrossed className="w-12 h-12 text-muted-foreground/40" />
            <div>
              <p className="font-semibold text-foreground">No restaurants yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first restaurant outlet to start managing tables, floors, and reservations.</p>
            </div>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1.5" />Add Restaurant</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {restaurants.map(r => {
            const isActive = selectedRestaurant?.id === r.id
            return (
              <Card
                key={r.id}
                className={cn(
                  'relative cursor-pointer transition-all border-2',
                  isActive ? 'border-primary shadow-md' : 'border-border hover:border-primary/50',
                  !r.is_active && 'opacity-60',
                )}
                onClick={() => setSelectedRestaurant(isActive ? null : r)}
              >
                {isActive && (
                  <div className="absolute top-2 right-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary text-white">
                      <Check className="w-3 h-3" />Active
                    </span>
                  </div>
                )}
                <CardContent className="pt-4 pb-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <UtensilsCrossed className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{r.name}</p>
                      {r.code && <p className="text-xs text-muted-foreground font-mono">{r.code}</p>}
                      {r.cuisine && <p className="text-xs text-muted-foreground">{r.cuisine}</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{storeMap[r.store_id] ?? r.store_id}</span>
                    {r.is_default && (
                      <span className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <Star className="w-2.5 h-2.5" />Default
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-border/60" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(r)}>
                      <Edit2 className="w-3 h-3 mr-1" />Edit
                    </Button>
                    {!r.is_default && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDefaultMutation.mutate(r.id)}>
                        <Star className="w-3 h-3 mr-1" />Set Default
                      </Button>
                    )}
                    {!r.is_default && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive ml-auto" onClick={() => setDeleteTarget(r)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <KOTNumberingSection
        restaurantId={selectedRestaurant?.id}
        restaurantName={selectedRestaurant?.name}
        emptyHint="Click a restaurant card above to select it, then configure KOT numbering for that outlet."
      />

      {/* Create / Edit modal */}
      {modal !== null && (
        <ModalOverlay onClose={() => setModal(null)} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-w-md max-h-[calc(100dvh-1.5rem)] !rounded-lg">
            <ModalHeader
              title={modal === 'create' ? 'New Restaurant' : 'Edit Restaurant'}
              onClose={() => setModal(null)}
              className="border-0 px-4 py-3 [&>div>h2]:text-base"
            />
            <ModalBody className="space-y-2.5 px-4 pb-3 pt-0">
              <div className="space-y-1">
                <Label className="text-xs">Business Unit (Hotel / Store) *</Label>
                <select
                  className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                  value={form.store_id}
                  onChange={e => setForm(f => ({ ...f, store_id: e.target.value }))}
                  disabled={typeof modal === 'object'}
                >
                  <option value="">Select a Business Unit…</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Restaurant Name *</Label>
                  <Input className="h-8 text-sm" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Rooftop Bistro" autoFocus />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Code</Label>
                  <Input className="h-8 text-sm" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. RTB-01" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cuisine</Label>
                  <Input className="h-8 text-sm" value={form.cuisine} onChange={e => setForm(f => ({ ...f, cuisine: e.target.value }))} placeholder="e.g. Indian, Italian" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input className="h-8 text-sm" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91…" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input className="h-8 text-sm" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
            </ModalBody>
            <ModalFooter className="items-center justify-between gap-2 border-0 bg-transparent px-4 py-3">
              <label className="flex items-center gap-1.5 text-xs text-foreground">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded accent-primary"
                />
                Active
              </label>
              <div className="flex gap-2">
                <Button type="button" variant="cancel" className="h-8 rounded-md px-3 text-sm" onClick={() => setModal(null)}>Cancel</Button>
                <Button type="button" className="h-8 rounded-md px-3 text-sm" onClick={submit} disabled={isPending}>
                  {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {modal === 'create' ? 'Create' : 'Save'}
                </Button>
              </div>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ModalOverlay onClose={() => setDeleteTarget(null)} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-w-sm !rounded-lg">
            <ModalHeader title={`Delete “${deleteTarget.name}”?`} onClose={() => setDeleteTarget(null)} className="border-0 px-4 py-3 [&>div>h2]:text-base" />
            <ModalBody className="px-4 pb-2 pt-0">
              <p className="text-sm text-muted-foreground">
                This permanently deletes the restaurant and cascades to zones, tables, orders, KOTs, and reservations.
              </p>
            </ModalBody>
            <ModalFooter className="justify-end gap-2 border-0 bg-transparent px-4 py-3">
              <Button type="button" variant="cancel" className="h-8 rounded-md px-3 text-sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button type="button" variant="destructive" className="h-8 rounded-md px-3 text-sm" onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Delete
              </Button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}
    </div>
  )
}
