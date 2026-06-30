import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import type { RestaurantOutlet } from '@/types'
import { useStores } from '@/hooks/useVendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Plus, UtensilsCrossed, Edit2, Trash2, Star, X, Loader2, Building2, Check,
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
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-primary" />
            Restaurants
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Each restaurant is an outlet under a Business Unit. All floor, kitchen, and reservation data is scoped per restaurant.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" />New Restaurant
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold">{modal === 'create' ? 'New Restaurant' : 'Edit Restaurant'}</h2>
              <Button variant="ghost" size="icon" onClick={() => setModal(null)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Business Unit (Hotel / Store) *</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.store_id}
                  onChange={e => setForm(f => ({ ...f, store_id: e.target.value }))}
                  disabled={typeof modal === 'object'}
                >
                  <option value="">Select a Business Unit…</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Restaurant Name *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Rooftop Bistro" />
                </div>
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. RTB-01" />
                </div>
                <div className="space-y-1.5">
                  <Label>Cuisine</Label>
                  <Input value={form.cuisine} onChange={e => setForm(f => ({ ...f, cuisine: e.target.value }))} placeholder="e.g. Indian, Italian" />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t">
              <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
              <Button onClick={submit} disabled={isPending}>
                {isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                {modal === 'create' ? 'Create' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-5 py-4 space-y-3">
              <p className="font-semibold text-foreground">Delete "{deleteTarget.name}"?</p>
              <p className="text-sm text-muted-foreground">
                This will permanently delete the restaurant and cascade to all its zones, tables, orders, KOTs, and reservations.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
