import { useEffect, useMemo, useState } from 'react'
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

const DESKTOP_COLS = 11
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

function buildVendorMap(
  vendors: StorefrontVendor[],
  avatarIndices: readonly number[],
  rotateKey: number,
): Map<number, StorefrontVendor> {
  const map = new Map<number, StorefrontVendor>()
  if (vendors.length === 0 || avatarIndices.length === 0) return map

  const pool = shuffle(vendorsWithLogosFirst(vendors))
  const offset = rotateKey % pool.length
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)]

  avatarIndices.forEach((cellIdx, i) => {
    map.set(cellIdx, rotated[i % rotated.length])
  })
  return map
}

function useRotatingVendorMap(
  vendors: StorefrontVendor[],
  avatarIndices: readonly number[],
): Map<number, StorefrontVendor> {
  const [rotateKey, setRotateKey] = useState(0)

  useEffect(() => {
    if (vendors.length === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => {
      setRotateKey((k) => k + 1)
    }, MOSAIC_VENDOR_ROTATE_MS)
    return () => window.clearInterval(id)
  }, [vendors.length])

  return useMemo(
    () => buildVendorMap(vendors, avatarIndices, rotateKey),
    [vendors, avatarIndices, rotateKey],
  )
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

function StoreTilePhoto({
  vendor,
}: {
  vendor: StorefrontVendor
}) {
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
  morphVariant,
  isBrand,
  vendor,
}: {
  cell: MosaicCell
  morphVariant: number
  isBrand: boolean
  vendor?: StorefrontVendor
}) {
  const shape = cell.shape ?? 'rounded'
  const color = isBrand ? MOSAIC_BRAND_SHAPE : MOSAIC_PALETTE[cell.colorIdx ?? 0]
  const classes = [
    'kiterp-mosaic-shape w-full h-full',
    shape,
    `kiterp-morph-v${morphVariant % 3}`,
  ].join(' ')

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
      >
        {hasPhoto ? <StoreTilePhoto vendor={vendor} /> : <span className="kiterp-mosaic-store-initials">{vendorInitials(name)}</span>}
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
}: {
  cells: MosaicCell[]
  cycle: string
  delays: number[]
  brandIndices: readonly number[]
  vendorMap: Map<number, StorefrontVendor>
  className: string
}) {
  const brandSet = new Set(brandIndices)
  return (
    <div className={className}>
      {cells.map((cell, i) => {
        const isBrand = brandSet.has(i)
        const vendor = cell.kind === 'avatar' ? vendorMap.get(i) : undefined
        return (
          <div
            key={`${i}-${vendor?.slug ?? 'shape'}`}
            className="kiterp-mosaic-cell aspect-square"
            style={{
              ['--mosaic-delay' as string]: `${(i * 0.08).toFixed(2)}s`,
              ['--mosaic-morph-delay' as string]: `${(delays[i] * 0.35).toFixed(2)}s`,
              ['--mosaic-hl' as string]: `${delays[i]}s`,
              ['--mosaic-cycle' as string]: cycle,
              ['--mosaic-hl-glow' as string]: mosaicCellGlow(cell, isBrand, Boolean(vendor)),
            }}
          >
            <MosaicCellView
              cell={cell}
              morphVariant={i % 3}
              isBrand={isBrand}
              vendor={vendor}
            />
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
  const desktopVendorMap = useRotatingVendorMap(vendors, DESKTOP_AVATAR_INDICES)
  const mobileVendorMap = useRotatingVendorMap(vendors, MOBILE_AVATAR_INDICES)
  const storeCount = vendors.length

  return (
    <section id="community" className="relative py-16 sm:py-24 overflow-hidden scroll-mt-24">
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

          <MosaicGrid
            cells={DESKTOP_GRID}
            cycle={DESKTOP_CYCLE}
            delays={DESKTOP_DELAYS}
            brandIndices={MOSAIC_BRAND_DESKTOP}
            vendorMap={desktopVendorMap}
            className="hidden lg:grid grid-cols-11 gap-3 kiterp-mosaic-fullmask"
          />
          <MosaicGrid
            cells={MOBILE_GRID}
            cycle={MOBILE_CYCLE}
            delays={MOBILE_DELAYS}
            brandIndices={MOSAIC_BRAND_MOBILE}
            vendorMap={mobileVendorMap}
            className="grid lg:hidden grid-cols-6 sm:grid-cols-8 gap-2.5 kiterp-mosaic-fullmask-sm"
          />

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
