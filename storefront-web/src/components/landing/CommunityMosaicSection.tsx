import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { imgUrl } from '@/lib/utils'
import { apiClient } from '@/api/client'
import {
  MOSAIC_AVATARS,
  MOSAIC_BRAND_AVATAR,
  MOSAIC_BRAND_DESKTOP,
  MOSAIC_BRAND_GLOW,
  MOSAIC_BRAND_MOBILE,
  MOSAIC_BRAND_SHAPE,
  MOSAIC_GLOW,
  MOSAIC_PALETTE,
  MOSAIC_VENDOR_ROTATE_MS,
  vendorDisplayName,
  vendorInitials,
  type StorefrontVendor,
} from './landingData'
import { StoreSearchBar } from './StoreSearchBar'

type MosaicCell = {
  kind: 'avatar' | 'shape'
  shape?: 'rounded' | 'circle' | 'leaf-tl' | 'leaf-tr' | 'leaf-br' | 'leaf-bl' | 'blob' | 'pill' | 'squircle'
  colorIdx?: number
  avatarIdx?: number
}

const SHAPES = ['leaf-tl', 'leaf-tr', 'leaf-br', 'leaf-bl', 'rounded', 'blob', 'squircle', 'pill'] as const
const PALETTE_LEN = MOSAIC_PALETTE.length

function makeGrid(seed: number, count: number): MosaicCell[] {
  const cells: MosaicCell[] = []
  let avatar = seed * 7
  for (let i = 0; i < count; i++) {
    const n = i + seed * 13
    const shape = SHAPES[n % SHAPES.length]
    const isAvatar = (n * 5 + 3) % 9 < 4
    const colorIdx = (n * 7 + seed * 3) % PALETTE_LEN
    if (isAvatar) {
      cells.push({ kind: 'avatar', shape, avatarIdx: avatar % MOSAIC_AVATARS.length, colorIdx })
      avatar++
    } else {
      cells.push({ kind: 'shape', shape, colorIdx })
    }
  }
  return cells
}

const DESKTOP_COLS = 13
const DESKTOP_ROWS = 5
const MOBILE_COLS = 6
const MOBILE_ROWS = 5

const HL_STEP = 0.45
const DESKTOP_GRID = makeGrid(0, DESKTOP_COLS * DESKTOP_ROWS)
const MOBILE_GRID = makeGrid(2, MOBILE_COLS * MOBILE_ROWS)
const DESKTOP_AVATAR_INDICES = DESKTOP_GRID.map((c, i) => (c.kind === 'avatar' ? i : -1)).filter((i) => i >= 0)
const MOBILE_AVATAR_INDICES = MOBILE_GRID.map((c, i) => (c.kind === 'avatar' ? i : -1)).filter((i) => i >= 0)
const DESKTOP_CYCLE_S = DESKTOP_GRID.length * HL_STEP
const MOBILE_CYCLE_S = MOBILE_GRID.length * HL_STEP
const DESKTOP_CYCLE = `${DESKTOP_CYCLE_S.toFixed(2)}s`
const MOBILE_CYCLE = `${MOBILE_CYCLE_S.toFixed(2)}s`

function makeDelays(count: number, cycleSeconds: number): number[] {
  let s = count * 9301 + 49297
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  return Array.from({ length: count }, () => +(rand() * cycleSeconds).toFixed(2))
}

const DESKTOP_DELAYS = makeDelays(DESKTOP_GRID.length, DESKTOP_CYCLE_S)
const MOBILE_DELAYS = makeDelays(MOBILE_GRID.length, MOBILE_CYCLE_S)

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function vendorsWithLogosFirst(vendors: StorefrontVendor[]): StorefrontVendor[] {
  return [...vendors].sort((a, b) => {
    const aLogo = Boolean(a.logo_url?.trim())
    const bLogo = Boolean(b.logo_url?.trim())
    if (aLogo && !bLogo) return -1
    if (!aLogo && bLogo) return 1
    return 0
  })
}

function vendorPoolKey(vendors: StorefrontVendor[]): string {
  return vendors.map((v) => v.slug).join('|')
}

function permute(count: number, seed: number): number[] {
  const arr = Array.from({ length: count }, (_, i) => i)
  let s = seed
  for (let i = count - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = s % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function rankFromOrder(order: readonly number[], count: number): number[] {
  const rank = new Array<number>(count)
  order.forEach((slot, orderI) => {
    if (slot >= 0 && slot < count) rank[slot] = orderI
  })
  return rank
}

const DESKTOP_AVATAR_SHUFFLE_ORDER = permute(DESKTOP_AVATAR_INDICES.length, 17)
const MOBILE_AVATAR_SHUFFLE_ORDER = permute(MOBILE_AVATAR_INDICES.length, 29)
const DESKTOP_AVATAR_SHUFFLE_RANK = rankFromOrder(DESKTOP_AVATAR_SHUFFLE_ORDER, DESKTOP_AVATAR_INDICES.length)
const MOBILE_AVATAR_SHUFFLE_RANK = rankFromOrder(MOBILE_AVATAR_SHUFFLE_ORDER, MOBILE_AVATAR_INDICES.length)

/** One avatar slot advances per step — vendors shuffle one bubble at a time. */
function buildVendorMap(
  pool: StorefrontVendor[],
  avatarIndices: readonly number[],
  rank: readonly number[],
  step: number,
): Map<number, StorefrontVendor> {
  const map = new Map<number, StorefrontVendor>()
  if (pool.length === 0 || avatarIndices.length === 0) return map

  const slotCount = avatarIndices.length
  const lap = Math.floor(step / slotCount)
  const wave = step % slotCount

  avatarIndices.forEach((cellIdx, i) => {
    const pos = rank[i] ?? i
    const advances = lap + (pos < wave ? 1 : 0)
    map.set(cellIdx, pool[(i + advances) % pool.length])
  })
  return map
}

function useVendorPool(vendors: StorefrontVendor[]): StorefrontVendor[] {
  const poolKey = vendorPoolKey(vendors)
  const orderRef = useRef<string[]>([])
  const prevKeyRef = useRef('')
  if (poolKey !== prevKeyRef.current) {
    prevKeyRef.current = poolKey
    orderRef.current = shuffle(vendorsWithLogosFirst(vendors)).map((v) => v.slug)
  }

  return useMemo(() => {
    const bySlug = new Map(vendors.map((v) => [v.slug, v]))
    return orderRef.current
      .map((slug) => bySlug.get(slug))
      .filter((v): v is StorefrontVendor => Boolean(v))
  }, [vendors, poolKey])
}

function useIsDesktopMosaic(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  )

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return isDesktop
}

function useSectionInView(ref: RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(true)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { root: null, threshold: 0.12 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return inView
}

function useMosaicRotateKey(active: boolean, paused: boolean, inView: boolean): number {
  const [rotateKey, setRotateKey] = useState(0)
  const [tabVisible, setTabVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState === 'visible',
  )

  useEffect(() => {
    const onVisibility = () => setTabVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (!active || paused || !tabVisible || !inView) return
    const first = window.setTimeout(() => {
      setRotateKey((k) => k + 1)
    }, 1_200)
    const id = window.setInterval(() => {
      setRotateKey((k) => k + 1)
    }, MOSAIC_VENDOR_ROTATE_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [active, paused, tabVisible, inView])

  return rotateKey
}

function mosaicCellGlow(cell: MosaicCell, isBrand: boolean, hasStore: boolean): string {
  if (isBrand) return MOSAIC_BRAND_GLOW
  const idx = cell.colorIdx ?? 0
  const paletteGlow = MOSAIC_GLOW[idx % MOSAIC_GLOW.length]
  if (cell.kind === 'avatar') {
    if (hasStore) return paletteGlow
    return MOSAIC_AVATARS[cell.avatarIdx ?? 0]?.glow ?? paletteGlow
  }
  return paletteGlow
}

function StoreTilePhoto({ vendor }: { vendor: StorefrontVendor }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const name = vendorDisplayName(vendor)
  const logo = vendor.logo_url?.trim()
  const resolved = logo ? imgUrl(logo) : ''

  if (!resolved || failed) {
    return <span className="kiterp-mosaic-store-initials">{vendorInitials(name)}</span>
  }

  return (
    <>
      <span className={`kiterp-mosaic-store-cover-skeleton${loaded ? ' kiterp-mosaic-store-cover-skeleton--hidden' : ''}`} aria-hidden />
      <img
        src={resolved}
        alt={name}
        className={`kiterp-mosaic-store-cover${loaded ? ' kiterp-mosaic-store-cover--loaded' : ''}`}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      <span className="kiterp-mosaic-store-cover-gloss" aria-hidden />
    </>
  )
}

function MosaicCellView({
  cell,
  isBrand,
  vendor,
  onStoreHoverChange,
}: {
  cell: MosaicCell
  isBrand: boolean
  vendor?: StorefrontVendor
  onStoreHoverChange?: (hovered: boolean) => void
}) {
  const shape = cell.shape ?? 'rounded'
  const color = isBrand ? MOSAIC_BRAND_SHAPE : MOSAIC_PALETTE[cell.colorIdx ?? 0]
  const classes = ['kiterp-mosaic-shape w-full h-full', shape].join(' ')

  if (cell.kind === 'shape') {
    return (
      <div
        className={`${classes} kiterp-mosaic-shape--soft${isBrand ? ' kiterp-mosaic-shape--brand' : ''}`}
        style={{ background: color }}
      />
    )
  }

  if (vendor) {
    const name = vendorDisplayName(vendor)
    const fallback = MOSAIC_AVATARS[cell.avatarIdx ?? 0]
    const hasPhoto = Boolean(vendor.logo_url?.trim())
    const paletteColor = isBrand ? MOSAIC_BRAND_SHAPE : MOSAIC_PALETTE[cell.colorIdx ?? 0]
    const tileBg = hasPhoto
      ? paletteColor
      : isBrand
        ? MOSAIC_BRAND_AVATAR.bg
        : fallback?.bg
    return (
      <Link
        to={`/${vendor.slug}`}
        className={`${classes} kiterp-mosaic-shape--avatar kiterp-mosaic-store${hasPhoto ? ' kiterp-mosaic-store--has-photo' : ' flex items-center justify-center'}${isBrand ? ' kiterp-mosaic-shape--brand' : ''}`}
        style={{
          background: tileBg,
          color: fallback?.ink,
        }}
        title={`Visit ${name}`}
        aria-label={`Visit ${name} storefront`}
        onMouseEnter={() => onStoreHoverChange?.(true)}
        onMouseLeave={() => onStoreHoverChange?.(false)}
        onFocus={() => onStoreHoverChange?.(true)}
        onBlur={() => onStoreHoverChange?.(false)}
      >
        <span key={vendor.slug} className="kiterp-mosaic-vendor-swap">
          {hasPhoto ? (
            <StoreTilePhoto vendor={vendor} />
          ) : (
            <span className="kiterp-mosaic-store-initials">{vendorInitials(name)}</span>
          )}
          <span className="kiterp-mosaic-store-name">{name}</span>
        </span>
      </Link>
    )
  }

  const av = isBrand ? MOSAIC_BRAND_AVATAR : MOSAIC_AVATARS[cell.avatarIdx ?? 0]
  return (
    <div
      className={`${classes} kiterp-mosaic-shape--avatar kiterp-mosaic-shape--placeholder${isBrand ? ' kiterp-mosaic-shape--brand' : ''} flex items-center justify-center font-medium text-sm sm:text-base tracking-wide`}
      style={{ background: av.bg, color: av.ink }}
      aria-hidden
    >
      {av.initials}
    </div>
  )
}

function MosaicGrid({
  cells,
  cycle,
  delays,
  brandIndices,
  vendorMap,
  className,
  onStoreHoverChange,
}: {
  cells: MosaicCell[]
  cycle: string
  delays: number[]
  brandIndices: readonly number[]
  vendorMap: Map<number, StorefrontVendor>
  className: string
  onStoreHoverChange?: (hovered: boolean) => void
}) {
  const brandSet = new Set(brandIndices)
  return (
    <div className={className}>
      {cells.map((cell, i) => {
        const isBrand = brandSet.has(i)
        const vendor = cell.kind === 'avatar' ? vendorMap.get(i) : undefined
        return (
          <div
            key={i}
            className="kiterp-mosaic-cell aspect-square"
            style={{
              ['--mosaic-delay' as string]: `${(i * 0.05).toFixed(2)}s`,
              ['--mosaic-float-delay' as string]: `${(delays[i] * 0.28).toFixed(2)}s`,
              ['--mosaic-hl' as string]: `${delays[i]}s`,
              ['--mosaic-cycle' as string]: cycle,
              ['--mosaic-hl-glow' as string]: mosaicCellGlow(cell, isBrand, Boolean(vendor)),
              ['--mosaic-float-duration' as string]: `${(4.8 + (i % 5) * 0.55).toFixed(2)}s`,
            }}
          >
            <div className="kiterp-mosaic-motion-wrap w-full h-full">
              <MosaicCellView
                cell={cell}
                isBrand={isBrand}
                vendor={vendor}
                onStoreHoverChange={onStoreHoverChange}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

type Props = {
  vendors: StorefrontVendor[]
  slug: string
  setSlug: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  directory: StorefrontVendor[]
  matchingStores: StorefrontVendor[]
  dirLoading: boolean
  dirError: string | null
  slugNeedle: string
  onVisitStore: (slug: string) => void
}

export function CommunityMosaicSection({
  vendors: vendorsProp,
  slug,
  setSlug,
  onSubmit,
  directory,
  matchingStores,
  dirLoading,
  dirError,
  slugNeedle,
  onVisitStore,
}: Props) {
  const [localVendors, setLocalVendors] = useState<StorefrontVendor[]>([])

  useEffect(() => {
    if (vendorsProp.length > 0) return
    let cancelled = false
    apiClient
      .get<{ items: StorefrontVendor[] }>('/catalog/vendors', { params: { limit: 100 } })
      .then((res) => {
        if (!cancelled) setLocalVendors(res.data.items || [])
      })
      .catch(() => {
        if (!cancelled) setLocalVendors([])
      })
    return () => {
      cancelled = true
    }
  }, [vendorsProp.length])

  const vendors = vendorsProp.length > 0 ? vendorsProp : localVendors
  const sectionRef = useRef<HTMLElement>(null)
  const sectionInView = useSectionInView(sectionRef)
  const hoverCountRef = useRef(0)
  const [mosaicPaused, setMosaicPaused] = useState(false)
  const onStoreHoverChange = useCallback((hovered: boolean) => {
    hoverCountRef.current = Math.max(0, hoverCountRef.current + (hovered ? 1 : -1))
    setMosaicPaused(hoverCountRef.current > 0)
  }, [])
  const isDesktop = useIsDesktopMosaic()
  const pool = useVendorPool(vendors)
  const rotateKey = useMosaicRotateKey(pool.length > 0, mosaicPaused, sectionInView)
  const vendorMap = useMemo(
    () =>
      isDesktop
        ? buildVendorMap(pool, DESKTOP_AVATAR_INDICES, DESKTOP_AVATAR_SHUFFLE_RANK, rotateKey)
        : buildVendorMap(pool, MOBILE_AVATAR_INDICES, MOBILE_AVATAR_SHUFFLE_RANK, rotateKey),
    [isDesktop, pool, rotateKey],
  )
  const storeCount = vendors.length

  return (
    <section
      ref={sectionRef}
      id="community"
      className={`relative py-16 sm:py-24 overflow-hidden scroll-mt-24 kiterp-mosaic-live${mosaicPaused ? ' kiterp-mosaic-paused' : ''}${sectionInView ? ' kiterp-mosaic-inview' : ''}`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="relative">
          <svg className="hidden sm:block absolute -top-6 left-2 w-16 h-16 opacity-50" viewBox="0 0 60 60" fill="none" aria-hidden>
            <path className="kiterp-scribble-arrow" d="M50 6 C30 10 14 24 12 46" />
            <path className="kiterp-scribble-arrow" d="M12 46 L6 34 M12 46 L24 42" />
          </svg>
          <svg className="hidden sm:block absolute -bottom-8 right-2 w-16 h-16 opacity-50" viewBox="0 0 60 60" fill="none" aria-hidden>
            <path className="kiterp-scribble-arrow" d="M10 8 C30 16 44 28 48 52" />
            <path className="kiterp-scribble-arrow" d="M48 52 L38 46 M48 52 L52 40" />
          </svg>

          {isDesktop ? (
            <MosaicGrid
              cells={DESKTOP_GRID}
              cycle={DESKTOP_CYCLE}
              delays={DESKTOP_DELAYS}
              brandIndices={MOSAIC_BRAND_DESKTOP}
              vendorMap={vendorMap}
              onStoreHoverChange={onStoreHoverChange}
              className="grid gap-3 kiterp-mosaic-fullmask"
            />
          ) : (
            <MosaicGrid
              cells={MOBILE_GRID}
              cycle={MOBILE_CYCLE}
              delays={MOBILE_DELAYS}
              brandIndices={MOSAIC_BRAND_MOBILE}
              vendorMap={vendorMap}
              onStoreHoverChange={onStoreHoverChange}
              className="grid grid-cols-6 sm:grid-cols-8 gap-2.5 kiterp-mosaic-fullmask-sm"
            />
          )}

          <div className="absolute inset-0 z-[2] pointer-events-none">
            <div className="kiterp-mosaic-center-shield" aria-hidden />
            <div className="absolute inset-0 flex items-center justify-center px-4">
              <div className="text-center kiterp-mosaic-headline-wrap">
                <p className="text-base sm:text-lg leading-tight">
                  <span className="font-semibold tracking-tight kiterp-mosaic-headline">Trusted by </span>
                  <span className="font-kiterp-script kiterp-mosaic-headline-accent text-lg sm:text-xl">growing</span>
                  <span className="font-semibold tracking-tight kiterp-mosaic-headline"> businesses</span>
                </p>
                <p className="mt-1 kiterp-mosaic-subline text-[10px] sm:text-[11px] font-medium max-w-none mx-auto leading-snug">
                  {storeCount > 0 ? (
                    <>
                      Real stores on <span className="kiterp-mosaic-brand">KIT ERP</span>
                      {' '}— tap a logo or search below
                    </>
                  ) : (
                    <>
                      Live storefronts on <span className="kiterp-mosaic-brand">KIT ERP</span>
                      {' '}— search when vendors go live
                    </>
                  )}
                </p>
                <StoreSearchBar
                  embedded
                  slug={slug}
                  setSlug={setSlug}
                  onSubmit={onSubmit}
                  directory={directory}
                  matchingStores={matchingStores}
                  dirLoading={dirLoading}
                  dirError={dirError}
                  slugNeedle={slugNeedle}
                  onVisitStore={onVisitStore}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
