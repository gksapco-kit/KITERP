import { useMemo, useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Loader2, UtensilsCrossed, Search, ExternalLink, GripVertical,
  Building2, Plus, FolderTree, Copy, MapPin, ChevronRight, ChevronDown,
  Package, Wrench, Check, Trash2, Power,
} from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import { useMyVendor } from '@/hooks/useVendor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  SelectRoot,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn, formatCurrency } from '@/lib/utils'
import { getCustomerStorefrontBaseUrl } from '@/lib/storefrontPreviewUrl'
import { useRestaurantStore } from '@/stores/restaurantStore'
import type { VendorCategory, RestaurantMenuOut, RestaurantMenuCategoryOut } from '@/types'

type MenuCategoryMode = 'all_active' | 'curated' | 'by_categories'

function getMenuZoneGuestUrl(vendorSlug: string, linkToken: string) {
  return `${getCustomerStorefrontBaseUrl(vendorSlug)}/menu/${linkToken}`
}

function categoryItemSummary(cat: RestaurantMenuCategoryOut) {
  if (cat.mode === 'all_active') return 'All items'
  if (cat.mode === 'by_categories') {
    const n = cat.vendor_category_ids.length
    return n === 0 ? 'No categories' : `${n} categor${n === 1 ? 'y' : 'ies'}`
  }
  const n = cat.product_ids.length + cat.service_ids.length
  return n === 0 ? 'No items' : `${n} item${n === 1 ? '' : 's'}`
}

function categoryModeBadge(mode: MenuCategoryMode) {
  if (mode === 'all_active') return 'All'
  if (mode === 'curated') return 'Pick'
  return 'Cats'
}

function getChildMenuCategories(categories: RestaurantMenuCategoryOut[], parentId: string | null) {
  return categories.filter(cat => (cat.parent_id ?? null) === parentId)
}

function getRootMenuCategories(categories: RestaurantMenuCategoryOut[]) {
  return getChildMenuCategories(categories, null)
}

function flattenMenuCategoriesForOrder(
  categories: RestaurantMenuCategoryOut[],
  parentId: string | null = null,
  depth = 0,
): Array<{ cat: RestaurantMenuCategoryOut; depth: number }> {
  return getChildMenuCategories(categories, parentId).flatMap(cat => [
    { cat, depth },
    ...flattenMenuCategoriesForOrder(categories, cat.id, depth + 1),
  ])
}

function filterVendorCategoryTree(
  nodes: VendorCategory[],
  applies: 'product' | 'service',
): VendorCategory[] {
  return nodes.flatMap(node => {
    const children = filterVendorCategoryTree(node.children || [], applies)
    const selfOk =
      applies === 'product'
        ? node.applies_to === 'product' || node.applies_to === 'both'
        : node.applies_to === 'service' || node.applies_to === 'both'
    if (selfOk || children.length > 0) {
      return [{ ...node, children }]
    }
    return []
  })
}

function collectCategoryMatchTokens(tree: VendorCategory[], selectedIds: string[]): Set<string> {
  const tokens = new Set<string>()
  function addNodeTokens(node: VendorCategory) {
    tokens.add(node.name.toLowerCase())
    tokens.add(node.slug.toLowerCase())
    for (const child of node.children || []) addNodeTokens(child)
  }
  function walk(nodes: VendorCategory[]) {
    for (const node of nodes) {
      if (selectedIds.includes(node.id)) addNodeTokens(node)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(tree)
  return tokens
}

function selectedVendorCategoryIdsForApplies(
  tree: VendorCategory[],
  selectedIds: string[],
  applies: 'product' | 'service',
): string[] {
  const ids: string[] = []
  function walk(nodes: VendorCategory[]) {
    for (const node of nodes) {
      if (selectedIds.includes(node.id)) {
        const ok =
          applies === 'product'
            ? node.applies_to === 'product' || node.applies_to === 'both'
            : node.applies_to === 'service' || node.applies_to === 'both'
        if (ok) ids.push(node.id)
      }
      if (node.children?.length) walk(node.children)
    }
  }
  walk(tree)
  return ids
}

function VendorCategoryTreeNode({
  node,
  depth,
  selectedIds,
  onToggle,
}: {
  node: VendorCategory
  depth: number
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  const children = node.children || []
  const hasChildren = children.length > 0
  const [expanded, setExpanded] = useState(depth < 1)
  const checked = selectedIds.includes(node.id)
  const appliesLabel =
    node.applies_to === 'both' ? 'Both' : node.applies_to === 'service' ? 'Svc' : 'Prod'

  useEffect(() => {
    if (selectedIds.some(id => id !== node.id && isDescendant(node, id))) {
      setExpanded(true)
    }
  }, [selectedIds, node])

  return (
    <li>
      <div
        className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted/60"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggle(node.id)}
            className="rounded border-input accent-primary"
          />
          <FolderTree className="h-3 w-3 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
          <span className="shrink-0 rounded bg-muted px-1 text-[9px] text-muted-foreground">{appliesLabel}</span>
          {checked && <Check className="h-3 w-3 shrink-0 text-primary" />}
        </label>
      </div>
      {hasChildren && expanded && (
        <ul>
          {children.map(child => (
            <VendorCategoryTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function isDescendant(root: VendorCategory, searchId: string): boolean {
  for (const child of root.children || []) {
    if (child.id === searchId) return true
    if (isDescendant(child, searchId)) return true
  }
  return false
}

function VendorCategoryTreePicker({
  nodes,
  selectedIds,
  onToggle,
  emptyLabel,
}: {
  nodes: VendorCategory[]
  selectedIds: string[]
  onToggle: (id: string) => void
  emptyLabel: string
}) {
  if (nodes.length === 0) {
    return (
      <p className="px-2 py-2 text-center text-[10px] text-muted-foreground">
        {emptyLabel}.{' '}
        <Link to="/categories" className="text-primary">Manage categories →</Link>
      </p>
    )
  }
  return (
    <ul className="py-0.5">
      {nodes.map(node => (
        <VendorCategoryTreeNode
          key={node.id}
          node={node}
          depth={0}
          selectedIds={selectedIds}
          onToggle={onToggle}
        />
      ))}
    </ul>
  )
}

function CompactSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <SelectRoot value={value} onValueChange={onChange}>
      <SelectTrigger className={cn('h-7 w-auto min-w-[9rem] gap-1 px-2 text-xs', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  )
}

function DropBtn({
  label,
  count,
  open,
  onToggle,
  children,
  className,
  layer = 'default',
}: {
  label: string
  count?: string | number
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  className?: string
  layer?: 'default' | 'modal'
}) {
  const backdropZ = layer === 'modal' ? 'z-[60]' : 'z-40'
  const menuZ = layer === 'modal' ? 'z-[70]' : 'z-50'
  return (
    <div className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-xs font-normal"
        onClick={onToggle}
      >
        {label}
        {count !== undefined && (
          <span className="rounded bg-muted px-1 py-0 text-[10px] font-medium text-foreground">{count}</span>
        )}
        <ChevronDown className={cn('h-3 w-3 opacity-50 transition-transform', open && 'rotate-180')} />
      </Button>
      {open && (
        <>
          <button type="button" className={cn('fixed inset-0 cursor-default', backdropZ)} aria-label="Close" onClick={onToggle} />
          <div className={cn('absolute left-0 top-full mt-1 min-w-[240px] max-h-56 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md', menuZ)}>
            {children}
          </div>
        </>
      )}
    </div>
  )
}

function DropRow({
  checked,
  onChange,
  icon: Icon,
  title,
  sub,
}: {
  checked: boolean
  onChange: () => void
  icon: typeof Package
  title: string
  sub?: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted/60">
      <input type="checkbox" checked={checked} onChange={onChange} className="rounded border-input accent-primary" />
      <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{title}</span>
      {sub && <span className="shrink-0 text-[10px] text-muted-foreground">{sub}</span>}
      {checked && <Check className="h-3 w-3 shrink-0 text-primary" />}
    </label>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-4xl space-y-2 pb-4">{children}</div>
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-border bg-card p-2.5', className)}>
      {children}
    </section>
  )
}

export default function RestaurantMenuPage() {
  const { data: vendor } = useMyVendor()
  const { selectedRestaurant } = useRestaurantStore()
  const queryClient = useQueryClient()
  const [catalogSearch, setCatalogSearch] = useState('')
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false)
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | null>(null)
  const [newMenuName, setNewMenuName] = useState('')
  const [newMenuRestaurantId, setNewMenuRestaurantId] = useState('')
  const [newMenuZoneIds, setNewMenuZoneIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null)
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [menuListSearch, setMenuListSearch] = useState('')
  const [openDrop, setOpenDrop] = useState<string | null>(null)

  const restaurantsQ = useQuery({
    queryKey: ['restaurants'],
    queryFn: () => vendorApi.listRestaurants(),
    enabled: createMenuOpen || true,
  })
  const restaurants = restaurantsQ.data?.items ?? []

  const menusQ = useQuery({
    queryKey: ['restaurant-menus', selectedRestaurant?.id ?? null],
    queryFn: () => vendorApi.restaurantListMenus(selectedRestaurant?.id),
  })
  const createdMenus: RestaurantMenuOut[] = menusQ.data?.items ?? []

  function refreshMenus() {
    return queryClient.invalidateQueries({ queryKey: ['restaurant-menus'] })
  }

  const createZonesQ = useQuery({
    queryKey: ['restaurant', 'zones', 'create', newMenuRestaurantId],
    queryFn: () => vendorApi.restaurantListZones({ restaurant_id: newMenuRestaurantId }),
    enabled: createMenuOpen && !!newMenuRestaurantId,
  })
  const createRestaurantZones = createZonesQ.data?.items ?? []

  const selectedMenu = useMemo(
    () => createdMenus.find(m => m.id === selectedMenuId) ?? null,
    [createdMenus, selectedMenuId],
  )

  const zonesQ = useQuery({
    queryKey: ['restaurant', 'zones', selectedMenu?.restaurant_id],
    queryFn: () => vendorApi.restaurantListZones({ restaurant_id: selectedMenu!.restaurant_id }),
    enabled: !!selectedMenu?.restaurant_id,
  })
  const restaurantZones = zonesQ.data?.items ?? []

  const catalogQ = useQuery({
    queryKey: ['products', 'menu-config', catalogSearch],
    queryFn: () => vendorApi.listProducts({ status: 'active', search: catalogSearch || undefined, size: 500 }),
    enabled: !!selectedMenuId && expandedCategoryIds.length > 0,
  })

  const servicesQ = useQuery({
    queryKey: ['services', 'menu-config', catalogSearch],
    queryFn: () => vendorApi.listServices({ status: 'active', search: catalogSearch || undefined, size: 500 }),
    enabled: !!selectedMenuId && expandedCategoryIds.length > 0,
  })

  const categoriesQ = useQuery({
    queryKey: ['categories', 'tree', 'menu-config'],
    queryFn: () => vendorApi.listCategories({ tree: true }),
    enabled: !!selectedMenuId && expandedCategoryIds.length > 0,
  })

  const products = catalogQ.data?.items ?? []
  const services = servicesQ.data?.items ?? []
  const vendorCategoryTree = categoriesQ.data?.categories ?? []

  const productCategoryTree = useMemo(
    () => filterVendorCategoryTree(vendorCategoryTree, 'product'),
    [vendorCategoryTree],
  )
  const serviceCategoryTree = useMemo(
    () => filterVendorCategoryTree(vendorCategoryTree, 'service'),
    [vendorCategoryTree],
  )

  const filteredProducts = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      p =>
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q),
    )
  }, [products, catalogSearch])

  const filteredServices = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase()
    if (!q) return services
    return services.filter(
      s =>
        s.name?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q),
    )
  }, [services, catalogSearch])

  const slug = vendor?.slug

  const filteredMenus = useMemo(() => {
    const q = menuListSearch.trim().toLowerCase()
    return createdMenus.filter(menu => {
      if (selectedRestaurant && menu.restaurant_id !== selectedRestaurant.id) return false
      if (!q) return true
      return menu.name.toLowerCase().includes(q)
    })
  }, [createdMenus, menuListSearch, selectedRestaurant])

  function restaurantName(restaurantId: string) {
    return restaurants.find(r => r.id === restaurantId)?.name ?? 'Restaurant'
  }

  function openCreateMenu() {
    setNewMenuName('')
    setNewMenuRestaurantId(selectedRestaurant?.id ?? '')
    setNewMenuZoneIds([])
    setOpenDrop(null)
    setCreateMenuOpen(true)
  }

  function closeCreateMenu() {
    setCreateMenuOpen(false)
    setNewMenuName('')
    setNewMenuRestaurantId('')
    setNewMenuZoneIds([])
    setOpenDrop(null)
  }

  async function handleCreateMenu() {
    const name = newMenuName.trim()
    if (!name) { toast.error('Menu name is required'); return }
    if (!newMenuRestaurantId) { toast.error('Select a restaurant'); return }
    setBusy(true)
    try {
      const menu = await vendorApi.restaurantCreateMenu({
        restaurant_id: newMenuRestaurantId,
        name,
        zone_ids: newMenuZoneIds,
      })
      await refreshMenus()
      setSelectedMenuId(menu.id)
      setExpandedCategoryIds([])
      setNewCategoryName('')
      closeCreateMenu()
      toast.success('Menu created')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to create menu')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteMenu(menuId: string) {
    if (!confirm('Delete this menu? This cannot be undone.')) return
    setBusy(true)
    try {
      await vendorApi.restaurantDeleteMenu(menuId)
      await refreshMenus()
      if (selectedMenuId === menuId) setSelectedMenuId(null)
      toast.success('Menu deleted')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to delete menu')
    } finally {
      setBusy(false)
    }
  }

  function closeMenuDetail() {
    setSelectedMenuId(null)
    setExpandedCategoryIds([])
    setNewCategoryName('')
    setNewCategoryParentId(null)
    setCreateCategoryOpen(false)
    setCatalogSearch('')
    setOpenDrop(null)
  }

  function openMenu(menuId: string) {
    setSelectedMenuId(menuId)
    setExpandedCategoryIds([])
    setNewCategoryName('')
    setNewCategoryParentId(null)
    setCreateCategoryOpen(false)
    setCatalogSearch('')
    setOpenDrop(null)
  }

  function openCreateCategory(parentId: string | null = null) {
    setNewCategoryName('')
    setNewCategoryParentId(parentId)
    setOpenDrop(null)
    setCreateCategoryOpen(true)
  }

  function closeCreateCategory() {
    setCreateCategoryOpen(false)
    setNewCategoryName('')
    setNewCategoryParentId(null)
  }

  async function handleCreateCategory() {
    if (!selectedMenuId) return
    const name = newCategoryName.trim()
    if (!name) { toast.error('Category name is required'); return }
    setBusy(true)
    try {
      const created = await vendorApi.restaurantCreateMenuCategory(selectedMenuId, {
        name,
        parent_id: newCategoryParentId,
      })
      await refreshMenus()
      setExpandedCategoryIds(prev => {
        const next = [...prev, created.id]
        return newCategoryParentId && !next.includes(newCategoryParentId)
          ? [...next, newCategoryParentId]
          : next
      })
      closeCreateCategory()
      toast.success(newCategoryParentId ? 'Sub-category created' : 'Menu category created')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to create category')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    if (!selectedMenuId) return
    if (!confirm('Delete this category and its sub-categories?')) return
    setBusy(true)
    try {
      await vendorApi.restaurantDeleteMenuCategory(selectedMenuId, categoryId)
      await refreshMenus()
      toast.success('Category deleted')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to delete category')
    } finally {
      setBusy(false)
    }
  }

  function toggleCategoryExpand(categoryId: string) {
    setExpandedCategoryIds(prev =>
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId],
    )
  }

  async function moveMenuCategory(categoryId: string, dir: -1 | 1) {
    if (!selectedMenuId) return
    try {
      await vendorApi.restaurantMoveMenuCategory(selectedMenuId, categoryId, dir === -1 ? 'up' : 'down')
      await refreshMenus()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to reorder')
    }
  }

  async function patchCategory(categoryId: string, body: Parameters<typeof vendorApi.restaurantUpdateMenuCategory>[2]) {
    if (!selectedMenuId) return
    try {
      await vendorApi.restaurantUpdateMenuCategory(selectedMenuId, categoryId, body)
      await refreshMenus()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to update category')
    }
  }

  function setCategoryMode(categoryId: string, mode: MenuCategoryMode) {
    void patchCategory(categoryId, { mode })
  }

  function toggleVendorCategory(cat: RestaurantMenuCategoryOut, vendorCategoryId: string) {
    const has = cat.vendor_category_ids.includes(vendorCategoryId)
    const next = has
      ? cat.vendor_category_ids.filter(x => x !== vendorCategoryId)
      : [...cat.vendor_category_ids, vendorCategoryId]
    void patchCategory(cat.id, { vendor_category_ids: next })
  }

  function toggleCategoryProduct(cat: RestaurantMenuCategoryOut, id: string) {
    const has = cat.product_ids.includes(id)
    const next = has ? cat.product_ids.filter(x => x !== id) : [...cat.product_ids, id]
    void patchCategory(cat.id, { product_ids: next })
  }

  function toggleCategoryService(cat: RestaurantMenuCategoryOut, id: string) {
    const has = cat.service_ids.includes(id)
    const next = has ? cat.service_ids.filter(x => x !== id) : [...cat.service_ids, id]
    void patchCategory(cat.id, { service_ids: next })
  }

  function getCategoryPreviewItems(cat: RestaurantMenuCategoryOut) {
    if (cat.mode === 'all_active') {
      return { previewProducts: filteredProducts, previewServices: filteredServices }
    }
    if (cat.mode === 'by_categories') {
      const productIds = selectedVendorCategoryIdsForApplies(
        vendorCategoryTree,
        cat.vendor_category_ids,
        'product',
      )
      const serviceIds = selectedVendorCategoryIdsForApplies(
        vendorCategoryTree,
        cat.vendor_category_ids,
        'service',
      )
      const productTokens = collectCategoryMatchTokens(vendorCategoryTree, productIds)
      const serviceTokens = collectCategoryMatchTokens(vendorCategoryTree, serviceIds)
      const previewProducts = productTokens.size === 0
        ? []
        : filteredProducts.filter(p => {
            const c = (p.category || '').toLowerCase()
            const s = (p.subcategory || '').toLowerCase()
            return productTokens.has(c) || (s && productTokens.has(s))
          })
      const previewServices = serviceTokens.size === 0
        ? []
        : filteredServices.filter(s => {
            const c = (s.category || '').toLowerCase()
            const sub = (s.subcategory || '').toLowerCase()
            return serviceTokens.has(c) || (sub && serviceTokens.has(sub))
          })
      return { previewProducts, previewServices }
    }
    const previewProducts = filteredProducts.filter(p => cat.product_ids.includes(p.id))
    const previewServices = filteredServices.filter(s => cat.service_ids.includes(s.id))
    return { previewProducts, previewServices }
  }

  function toggleNewMenuZone(zoneId: string) {
    setNewMenuZoneIds(prev =>
      prev.includes(zoneId) ? prev.filter(id => id !== zoneId) : [...prev, zoneId],
    )
  }

  async function toggleMenuZone(zoneId: string) {
    if (!selectedMenu) return
    const exists = selectedMenu.zone_links.some(link => link.zone_id === zoneId)
    const nextZoneIds = exists
      ? selectedMenu.zone_links.filter(link => link.zone_id !== zoneId).map(l => l.zone_id)
      : [...selectedMenu.zone_links.map(l => l.zone_id), zoneId]
    try {
      await vendorApi.restaurantSyncMenuZones(selectedMenu.id, nextZoneIds)
      await refreshMenus()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to update zones')
    }
  }

  function copyGuestUrl(url: string) {
    navigator.clipboard.writeText(url)
    toast.success('Copied')
  }

  const createMenuDialog = (
    <Dialog open={createMenuOpen} onOpenChange={open => { if (!open) closeCreateMenu() }}>
      <DialogContent className="sm:max-w-sm gap-3 p-4">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-sm">Create menu</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="menu-name" className="text-xs">Menu name</Label>
            <Input id="menu-name" value={newMenuName} onChange={e => setNewMenuName(e.target.value)}
              placeholder="Lunch menu" className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Restaurant</Label>
            <CompactSelect
              value={newMenuRestaurantId || 'none'}
              onChange={v => {
                setNewMenuRestaurantId(v === 'none' ? '' : v)
                setNewMenuZoneIds([])
              }}
              options={[
                { value: 'none', label: 'Select restaurant…' },
                ...restaurants.map(r => ({ value: r.id, label: r.name })),
              ]}
              className="w-full min-w-0"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Zones</Label>
            {!newMenuRestaurantId ? (
              <p className="text-[10px] text-muted-foreground py-1">Select a restaurant first</p>
            ) : (
              <DropBtn
                label="Zones"
                count={newMenuZoneIds.length}
                open={openDrop === 'create-zones'}
                onToggle={() => setOpenDrop(openDrop === 'create-zones' ? null : 'create-zones')}
                layer="modal"
                className="w-full"
              >
                {createZonesQ.isLoading && <Loader2 className="mx-auto my-2 h-4 w-4 animate-spin" />}
                {!createZonesQ.isLoading && createRestaurantZones.length === 0 && (
                  <p className="px-2 py-2 text-[10px] text-muted-foreground">
                    No zones. <Link to="/restaurant/setup" className="text-primary">Setup →</Link>
                  </p>
                )}
                {createRestaurantZones.map(zone => (
                  <DropRow
                    key={zone.id}
                    checked={newMenuZoneIds.includes(zone.id)}
                    onChange={() => toggleNewMenuZone(zone.id)}
                    icon={MapPin}
                    title={zone.name}
                    sub={zone.floor ?? undefined}
                  />
                ))}
              </DropBtn>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={closeCreateMenu}>Cancel</Button>
          <Button size="sm" className="h-7 text-xs" onClick={handleCreateMenu} disabled={busy}>
            {busy && <Loader2 className="h-3 w-3 animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const createCategoryParent = newCategoryParentId
    ? selectedMenu?.categories.find(cat => cat.id === newCategoryParentId) ?? null
    : null

  const createCategoryDialog = (
    <Dialog open={createCategoryOpen} onOpenChange={open => { if (!open) closeCreateCategory() }}>
      <DialogContent className="sm:max-w-sm gap-3 p-4">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-sm">
            {createCategoryParent ? 'Create sub-category' : 'Create menu category'}
          </DialogTitle>
          {createCategoryParent && (
            <p className="text-[10px] text-muted-foreground">
              Under <span className="font-medium text-foreground">{createCategoryParent.name}</span>
            </p>
          )}
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="category-name" className="text-xs">Category name</Label>
          <Input
            id="category-name"
            value={newCategoryName}
            onChange={e => setNewCategoryName(e.target.value)}
            placeholder="Food, Drinks…"
            className="h-8 text-xs"
            onKeyDown={e => { if (e.key === 'Enter') handleCreateCategory() }}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={closeCreateCategory}>Cancel</Button>
          <Button size="sm" className="h-7 text-xs" onClick={handleCreateCategory} disabled={busy}>
            {busy && <Loader2 className="h-3 w-3 animate-spin" />} Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  function MenuCategoryTreeNode({ cat, depth }: { cat: RestaurantMenuCategoryOut; depth: number }) {
    if (!selectedMenu) return null
    const childCategories = getChildMenuCategories(selectedMenu.categories, cat.id)
    const expanded = expandedCategoryIds.includes(cat.id)
    const { previewProducts, previewServices } = getCategoryPreviewItems(cat)
    const previewCount = previewProducts.length + previewServices.length

    return (
      <li className="border-b border-border last:border-b-0">
        <div
          className={cn(
            'flex w-full items-center gap-2 py-1.5 hover:bg-muted/50',
            expanded && 'bg-muted/30',
          )}
          style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: '8px' }}
        >
          <button
            type="button"
            onClick={() => toggleCategoryExpand(cat.id)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            <FolderTree className="h-3 w-3 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate font-medium">{cat.name}</span>
            {childCategories.length > 0 && (
              <span className="text-[10px] text-muted-foreground">{childCategories.length} sub</span>
            )}
            <span className="text-[10px] text-muted-foreground">{categoryItemSummary(cat)}</span>
            <span className="rounded bg-muted px-1 text-[10px]">{categoryModeBadge(cat.mode)}</span>
          </button>
          <button
            type="button"
            onClick={() => handleDeleteCategory(cat.id)}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete category"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        {expanded && (
          <div
            className="border-t border-border bg-muted/10 py-2 pr-2 space-y-2"
            style={{ paddingLeft: `${20 + depth * 14}px` }}
          >
            <div className="flex flex-wrap items-center gap-2 border-l-2 border-primary/30 pl-2">
              <span className="text-[10px] text-muted-foreground">Mode</span>
              <CompactSelect
                value={cat.mode}
                onChange={v => setCategoryMode(cat.id, v as MenuCategoryMode)}
                className="min-w-[11rem]"
                options={[
                  { value: 'all_active', label: 'All active items' },
                  { value: 'by_categories', label: 'Product & service categories' },
                  { value: 'curated', label: 'Selected only' },
                ]}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[10px] font-normal"
                onClick={() => openCreateCategory(cat.id)}
              >
                <Plus className="h-3 w-3" /> Create sub-category
              </Button>
              {cat.mode === 'by_categories' && (
                <>
                  <DropBtn
                    label="Product categories"
                    count={selectedVendorCategoryIdsForApplies(
                      vendorCategoryTree,
                      cat.vendor_category_ids,
                      'product',
                    ).length}
                    open={openDrop === `prod-cats-${cat.id}`}
                    onToggle={() => setOpenDrop(
                      openDrop === `prod-cats-${cat.id}` ? null : `prod-cats-${cat.id}`,
                    )}
                  >
                    {categoriesQ.isLoading && (
                      <Loader2 className="mx-auto my-2 h-4 w-4 animate-spin" />
                    )}
                    {!categoriesQ.isLoading && (
                      <VendorCategoryTreePicker
                        nodes={productCategoryTree}
                        selectedIds={cat.vendor_category_ids}
                        onToggle={id => toggleVendorCategory(cat, id)}
                        emptyLabel="No product categories"
                      />
                    )}
                  </DropBtn>
                  <DropBtn
                    label="Service categories"
                    count={selectedVendorCategoryIdsForApplies(
                      vendorCategoryTree,
                      cat.vendor_category_ids,
                      'service',
                    ).length}
                    open={openDrop === `svc-cats-${cat.id}`}
                    onToggle={() => setOpenDrop(
                      openDrop === `svc-cats-${cat.id}` ? null : `svc-cats-${cat.id}`,
                    )}
                  >
                    {categoriesQ.isLoading && (
                      <Loader2 className="mx-auto my-2 h-4 w-4 animate-spin" />
                    )}
                    {!categoriesQ.isLoading && (
                      <VendorCategoryTreePicker
                        nodes={serviceCategoryTree}
                        selectedIds={cat.vendor_category_ids}
                        onToggle={id => toggleVendorCategory(cat, id)}
                        emptyLabel="No service categories"
                      />
                    )}
                  </DropBtn>
                </>
              )}
              {cat.mode === 'curated' && (
                <>
                  <DropBtn
                    label="Products"
                    count={cat.product_ids.length}
                    open={openDrop === `products-${cat.id}`}
                    onToggle={() => setOpenDrop(openDrop === `products-${cat.id}` ? null : `products-${cat.id}`)}
                  >
                    <div className="border-b border-border px-2 py-1">
                      <Input value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
                        placeholder="Search…" className="h-7 text-xs" />
                    </div>
                    {catalogQ.isLoading && <Loader2 className="mx-auto my-2 h-4 w-4 animate-spin" />}
                    {filteredProducts.map(p => (
                      <DropRow
                        key={p.id}
                        checked={cat.product_ids.includes(p.id)}
                        onChange={() => toggleCategoryProduct(cat, p.id)}
                        icon={Package}
                        title={p.name}
                        sub={formatCurrency(p.price)}
                      />
                    ))}
                  </DropBtn>
                  <DropBtn
                    label="Services"
                    count={cat.service_ids.length}
                    open={openDrop === `services-${cat.id}`}
                    onToggle={() => setOpenDrop(openDrop === `services-${cat.id}` ? null : `services-${cat.id}`)}
                  >
                    <div className="border-b border-border px-2 py-1">
                      <Input value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
                        placeholder="Search…" className="h-7 text-xs" />
                    </div>
                    {servicesQ.isLoading && <Loader2 className="mx-auto my-2 h-4 w-4 animate-spin" />}
                    {filteredServices.map(s => (
                      <DropRow
                        key={s.id}
                        checked={cat.service_ids.includes(s.id)}
                        onChange={() => toggleCategoryService(cat, s.id)}
                        icon={Wrench}
                        title={s.name}
                        sub={formatCurrency(s.price ?? 0)}
                      />
                    ))}
                  </DropBtn>
                </>
              )}
            </div>

            {childCategories.length > 0 && (
              <ul className="rounded border border-border/70 bg-background/50">
                {childCategories.map(child => (
                  <MenuCategoryTreeNode key={child.id} cat={child} depth={depth + 1} />
                ))}
              </ul>
            )}

            <ul className="max-h-40 overflow-y-auto border-l-2 border-border ml-2 pl-3 space-y-0.5">
              {(catalogQ.isLoading || servicesQ.isLoading || categoriesQ.isLoading) && (
                <li className="py-1"><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /></li>
              )}
              {previewProducts.map(p => (
                <li key={`p-${cat.id}-${p.id}`} className="flex items-center gap-1.5 py-0.5 text-[11px]">
                  <span className="text-muted-foreground">└</span>
                  <Package className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="shrink-0 text-muted-foreground">{formatCurrency(p.price)}</span>
                </li>
              ))}
              {previewServices.map(s => (
                <li key={`s-${cat.id}-${s.id}`} className="flex items-center gap-1.5 py-0.5 text-[11px]">
                  <span className="text-muted-foreground">└</span>
                  <Wrench className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="shrink-0 text-muted-foreground">{formatCurrency(s.price ?? 0)}</span>
                </li>
              ))}
              {!catalogQ.isLoading && !servicesQ.isLoading && !categoriesQ.isLoading && previewCount === 0 && (
                <li className="py-1 text-[10px] text-muted-foreground">
                  {cat.mode === 'by_categories' ? 'No items in selected categories' : 'No items in this category'}
                </li>
              )}
            </ul>
          </div>
        )}
      </li>
    )
  }

  if (menusQ.isLoading) {
    return (
      <PageShell>
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      </PageShell>
    )
  }

  if (selectedMenu) {
    return (
      <PageShell>
        {createMenuDialog}
        {createCategoryDialog}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={closeMenuDetail}>
            <ArrowLeft className="h-3 w-3" /> Menus
          </Button>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">{selectedMenu.name}</span>
          <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-700">
            <Building2 className="h-2.5 w-2.5" /> {restaurantName(selectedMenu.restaurant_id)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {selectedMenu.categories.length} cat · {selectedMenu.zone_links.length} zones
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 px-2 text-[10px] text-destructive hover:text-destructive"
            onClick={() => handleDeleteMenu(selectedMenu.id)}
          >
            <Trash2 className="h-3 w-3" /> Delete menu
          </Button>
        </div>

        <Panel>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <Button size="sm" className="h-7 px-2 text-xs" onClick={() => openCreateCategory()}>
              <Plus className="h-3 w-3" /> Create menu category
            </Button>
            {selectedMenu.categories.length > 0 && (
              <DropBtn
                label="Category order"
                open={openDrop === 'order'}
                onToggle={() => setOpenDrop(openDrop === 'order' ? null : 'order')}
                className="ml-auto"
              >
                {flattenMenuCategoriesForOrder(selectedMenu.categories).map(({ cat, depth }) => {
                  const parentId = cat.parent_id ?? null
                  const siblings = selectedMenu.categories.filter(c => (c.parent_id ?? null) === parentId)
                  const siblingIdx = siblings.findIndex(c => c.id === cat.id)
                  return (
                    <div key={cat.id} className="flex items-center gap-1 px-1 py-0.5 text-xs">
                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                      <span className="flex-1 truncate" style={{ paddingLeft: `${depth * 10}px` }}>{cat.name}</span>
                      <button type="button" disabled={siblingIdx === 0} onClick={() => moveMenuCategory(cat.id, -1)}
                        className="rounded border px-1 text-[10px] disabled:opacity-30">↑</button>
                      <button type="button" disabled={siblingIdx === siblings.length - 1}
                        onClick={() => moveMenuCategory(cat.id, 1)}
                        className="rounded border px-1 text-[10px] disabled:opacity-30">↓</button>
                    </div>
                  )
                })}
              </DropBtn>
            )}
          </div>

          {getRootMenuCategories(selectedMenu.categories).length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              No categories yet — use Create menu category above
            </p>
          ) : (
            <ul className="rounded border border-border text-xs">
              {getRootMenuCategories(selectedMenu.categories).map(cat => (
                <MenuCategoryTreeNode key={cat.id} cat={cat} depth={0} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Guest URLs</p>
            <DropBtn
              label="Zones"
              count={selectedMenu.zone_links.length}
              open={openDrop === 'zones'}
              onToggle={() => setOpenDrop(openDrop === 'zones' ? null : 'zones')}
            >
              {zonesQ.isLoading && <Loader2 className="mx-auto my-2 h-4 w-4 animate-spin" />}
              {!zonesQ.isLoading && restaurantZones.length === 0 && (
                <p className="px-2 py-2 text-[10px] text-muted-foreground">
                  No zones. <Link to="/restaurant/setup" className="text-primary">Setup →</Link>
                </p>
              )}
              {restaurantZones.map(zone => {
                const assigned = selectedMenu.zone_links.some(l => l.zone_id === zone.id)
                return (
                  <DropRow
                    key={zone.id}
                    checked={assigned}
                    onChange={() => toggleMenuZone(zone.id)}
                    icon={MapPin}
                    title={zone.name}
                    sub={zone.floor ?? undefined}
                  />
                )
              })}
            </DropBtn>
          </div>
          {selectedMenu.zone_links.length === 0 ? (
            <p className="py-2 text-center text-[10px] text-muted-foreground">No zones linked — use Zones above</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {selectedMenu.zone_links.map(link => {
                const guestUrl = slug ? getMenuZoneGuestUrl(slug, link.link_token) : null
                return (
                  <li key={link.zone_id} className="rounded border border-border bg-muted/20 px-2 py-1.5">
                    <div className="mb-1 flex items-center gap-1 font-medium">
                      <MapPin className="h-3 w-3" /> {link.zone_name ?? 'Zone'}
                    </div>
                    {guestUrl && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <code className="max-w-[200px] truncate rounded bg-background px-1 py-0.5 font-mono text-[10px]">{guestUrl}</code>
                        <button type="button" onClick={() => copyGuestUrl(guestUrl)} className="text-[10px] text-primary">
                          <Copy className="inline h-3 w-3" /> Copy
                        </button>
                        <a href={guestUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary">
                          <ExternalLink className="inline h-3 w-3" /> Open
                        </a>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </PageShell>
    )
  }

  return (
    <PageShell>
      {createMenuDialog}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
          <Link to="/restaurant/setup"><ArrowLeft className="h-3.5 w-3.5" /></Link>
        </Button>
        <h1 className="text-sm font-semibold text-foreground">Dine-in &amp; QR Menu</h1>
        {selectedRestaurant && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-700">
            {selectedRestaurant.name}
          </span>
        )}
        <div className="relative ml-auto w-36">
          {createdMenus.length > 0 && (
            <>
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input value={menuListSearch} onChange={e => setMenuListSearch(e.target.value)}
                placeholder="Search…" className="h-7 pl-7 text-xs" />
            </>
          )}
        </div>
        <Button size="sm" className="h-7 px-2 text-xs" onClick={openCreateMenu}>
          <Plus className="h-3 w-3" /> Create menu
        </Button>
      </div>

      <Panel>
        {createdMenus.length === 0 ? (
          <div className="py-6 text-center">
            <UtensilsCrossed className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No menus yet</p>
            <Button size="sm" className="mt-2 h-7 text-xs" onClick={openCreateMenu}>
              <Plus className="h-3 w-3" /> Create menu
            </Button>
          </div>
        ) : filteredMenus.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No match</p>
        ) : (
          <ul className="divide-y divide-border text-xs">
            {filteredMenus.map(menu => (
              <li key={menu.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openMenu(menu.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-1 py-2 text-left hover:bg-muted/40"
                >
                  <UtensilsCrossed className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span className="min-w-0 flex-1 truncate font-medium">{menu.name}</span>
                  {!menu.is_active && (
                    <span className="shrink-0 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                      <Power className="inline h-2.5 w-2.5" /> Inactive
                    </span>
                  )}
                  <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">{restaurantName(menu.restaurant_id)}</span>
                  <span className="shrink-0 rounded bg-muted px-1 text-[10px]">{menu.categories.length} cat</span>
                  <span className="shrink-0 rounded bg-muted px-1 text-[10px]">{menu.zone_links.length} zone</span>
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteMenu(menu.id)}
                  className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete menu"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </PageShell>
  )
}
