import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Save, UtensilsCrossed, Search, ExternalLink } from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { useMyVendor } from '@/hooks/useVendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { cn, formatCurrency } from '@/lib/utils'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'

export default function RestaurantMenuPage() {
  const qc = useQueryClient()
  const { data: vendor } = useMyVendor()
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'all_active' | 'curated'>('all_active')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const menuQ = useQuery({
    queryKey: ['restaurant', 'menu'],
    queryFn: () => vendorApi.restaurantGetMenuSettings(),
  })

  const catalogQ = useQuery({
    queryKey: ['products', 'menu-config', search],
    queryFn: () => vendorApi.listProducts({ status: 'active', search: search || undefined, size: 500 }),
  })

  useEffect(() => {
    if (menuQ.data) {
      setMode(menuQ.data.mode)
      setSelected(new Set(menuQ.data.product_ids))
    }
  }, [menuQ.data])

  const save = useMutation({
    mutationFn: () =>
      vendorApi.restaurantUpdateMenuSettings({
        mode,
        product_ids: mode === 'curated' ? [...selected] : [],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant', 'menu'] })
      qc.invalidateQueries({ queryKey: ['restaurant', 'dine-in-products'] })
      toast.success('Dine-in menu saved')
    },
    onError: () => toast.error('Could not save menu settings'),
  })

  const products = catalogQ.data?.items ?? []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      p =>
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q),
    )
  }, [products, search])

  const previewCount = mode === 'all_active' ? products.length : selected.size
  const slug = vendor?.slug
  const sampleQr = slug ? `${getCustomerStorefrontBaseUrl(slug)}/table/TOKEN` : null

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const modeBtn = (active: boolean) =>
    cn(
      'px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
      active
        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
        : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
    )

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/restaurant/setup"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-amber-600 dark:text-amber-400" /> Dine-in &amp; QR Menu
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Controls what guests see on table QR codes and what staff can add on table orders.
            </p>
          </div>
        </div>
        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save menu
        </Button>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-foreground">Menu mode</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode('all_active')} className={modeBtn(mode === 'all_active')}>
            All active products
          </button>
          <button type="button" onClick={() => setMode('curated')} className={modeBtn(mode === 'curated')}>
            Selected items only
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === 'all_active'
            ? 'Every product with status Active appears on QR menus and table orders.'
            : 'Only checked products below appear. Use this to hide retail-only SKUs from dine-in.'}
          {' '}
          <strong className="text-foreground">{previewCount}</strong> item{previewCount === 1 ? '' : 's'} on menu.
        </p>
        {sampleQr && (
          <p className="text-xs text-muted-foreground">
            Guest URL pattern:{' '}
            <code className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
              {sampleQr}
            </code>
            {' '}
            <a
              href={sampleQr.replace('TOKEN', 'preview')}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-0.5 hover:text-primary/80"
            >
              <ExternalLink className="w-3 h-3" /> preview
            </a>
          </p>
        )}
      </section>

      {mode === 'curated' && (
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <h2 className="font-semibold text-foreground">Choose menu items</h2>
            <div className="relative max-w-xs flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products…"
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
          {catalogQ.isLoading && <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />}
          <ul className="divide-y divide-border rounded-lg border border-border max-h-[420px] overflow-y-auto">
            {filtered.map(p => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="rounded border-input accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category || 'Menu'} · {formatCurrency(p.price)}</p>
                </div>
                <Link to={`/products/${p.id}?edit=true`} className="text-xs text-primary shrink-0 hover:text-primary/80">
                  Edit
                </Link>
              </li>
            ))}
            {!catalogQ.isLoading && filtered.length === 0 && (
              <li className="px-3 py-8 text-center text-muted-foreground text-sm">No active products. Add products under Inventory.</li>
            )}
          </ul>
        </section>
      )}

      {mode === 'all_active' && (
        <section className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
          Menu items come from{' '}
          <Link to="/products" className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80">
            Products
          </Link>{' '}
          (status Active). Set category on each product for QR section headers. Add modifiers on the product edit page.
        </section>
      )}
    </div>
  )
}
