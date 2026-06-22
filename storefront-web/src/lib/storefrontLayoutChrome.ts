import type { PublicBlock, PublicPage, PublicSite } from '@/blocks/registry'
import { getWbCatalogTemplateId } from '@/storefront/catalogTemplateIds'
import { isStoreHomePath } from '@/lib/siteNavPages'
import {
  isDefaultLayoutTemplateId,
  isStorefrontCatalogTemplateId,
  isWebsiteBuilderBlockTemplateId,
  resolveLiveCatalogTemplateId,
} from '@/lib/storefrontTemplateAssignment'

const SHELL_ROUTE_PREFIXES = [
  'login',
  'register',
  'forgot-password',
  'products',
  'services',
  'cart',
  'checkout',
  'account',
  'blog',
  'policies',
  'hr',
  'preview',
  'draft-catalog',
  'table',
  'reserve',
  'rentals',
  'order',
  'employee',
]

export function builderSiteHomePage(site: PublicSite | null | undefined) {
  if (!site?.pages?.length) return null
  return site.pages.find(p => p.is_homepage) || site.pages[0]
}

export function builderSiteHomeHasBlocks(site: PublicSite | null | undefined): boolean {
  const home = builderSiteHomePage(site)
  return Boolean(home?.blocks?.length)
}

export function pageHasNavBlock(
  blocks: Array<{ block_type?: string; visible?: boolean }> | null | undefined,
): boolean {
  return Boolean(
    blocks?.some(b => b.block_type === 'nav' && b.visible !== false),
  )
}

/** Header shell blocks (announcement + nav) from the site homepage — shared across catalog preview. */
export function siteShellBlocks(site: PublicSite | null | undefined) {
  const home = builderSiteHomePage(site)
  if (!home?.blocks?.length) return { homePage: home, blocks: [] as NonNullable<typeof home.blocks> }
  const blocks = home.blocks.filter(
    b => b.visible !== false && (b.block_type === 'nav' || b.block_type === 'announcement_bar'),
  )
  return { homePage: home, blocks }
}

/** True when the site exposes a navigation block on its homepage (the shared header source). */
export function siteHasNavShell(site: PublicSite | null | undefined): boolean {
  return siteShellBlocks(site).blocks.some(b => b.block_type === 'nav')
}

/** Homepage footer block shared across catalog/shell routes. */
export function siteFooterShellBlock(site: PublicSite | null | undefined): PublicBlock | null {
  const home = builderSiteHomePage(site)
  if (!home?.blocks?.length) return null
  return home.blocks.find(b => b.block_type === 'footer' && b.visible !== false) ?? null
}

/**
 * Builder catch-all pages and the store home render nav via BlockRenderer /
 * withSharedShellBlocks — shell routes (products, services, …) need injected chrome.
 */
export function storePageOwnsBuilderNav(
  pathname: string,
  vendorSlug: string,
  storePath: (p: string) => string,
): boolean {
  if (isStoreHomePath(pathname, storePath)) return true
  return resolveBuilderPageSlug(pathname, vendorSlug) !== null
}

const SHARED_SHELL_BLOCK_TYPES = new Set(['nav', 'announcement_bar', 'footer'])

/** Strip nav / announcement / footer from page content — homepage shell is canonical. */
export function stripSharedShellBlocksFromPage(blocks: PublicBlock[]): PublicBlock[] {
  return blocks.filter(b => !SHARED_SHELL_BLOCK_TYPES.has(b.block_type))
}

/**
 * Returns the blocks to render for a page, guaranteeing a consistent site-wide
 * header/footer from the homepage nav shell. Non-home pages never use their own
 * nav/footer clones (even if seeded by AI or legacy templates).
 */
export function withSharedShellBlocks(
  site: PublicSite | null | undefined,
  page: Pick<PublicPage, 'id' | 'is_homepage' | 'blocks'> | null | undefined,
): PublicBlock[] {
  const pageBlocks = page?.blocks ?? []
  if (!site || !page || page.is_homepage) return pageBlocks

  const home = builderSiteHomePage(site)
  if (!home || home.id === page.id) return pageBlocks
  const homeBlocks = home.blocks ?? []

  const contentBlocks = stripSharedShellBlocksFromPage(pageBlocks)

  const leading: PublicBlock[] = []
  for (const b of homeBlocks) {
    if (b.visible !== false && (b.block_type === 'announcement_bar' || b.block_type === 'nav')) {
      leading.push(b)
    }
  }

  const trailing: PublicBlock[] = []
  const footer = homeBlocks.find(b => b.block_type === 'footer' && b.visible !== false)
  if (footer) trailing.push(footer)

  if (leading.length === 0 && trailing.length === 0) return contentBlocks
  return [...leading, ...contentBlocks, ...trailing]
}

function isShellRelativePath(rel: string): boolean {
  if (!rel) return true
  return SHELL_ROUTE_PREFIXES.some(
    prefix => rel === prefix || rel.startsWith(`${prefix}/`),
  )
}

/** Slug for builder catch-all routes (null on home or shell routes). */
export function resolveBuilderPageSlug(
  pathname: string,
  vendorSlug: string,
): string | null {
  const base = `/store/${vendorSlug}`
  if (!pathname.startsWith(base)) return null
  const rel = pathname.slice(base.length).replace(/^\/+/, '')
  if (!rel || isShellRelativePath(rel)) return null
  return rel.replace(/^\/+|\/+$/g, '')
}

export function findBuilderPageBySlug(site: PublicSite, slug: string) {
  const normalized = slug.replace(/^\/+|\/+$/g, '')
  return site.pages?.find(p => p.slug === normalized) ?? null
}

export type StoreChromeHideInput = {
  pathname: string
  storePath: (path: string) => string
  vendorSlug?: string | null
  builderSite: PublicSite | null
  assignedTemplateId: string | null
  storeSpecificTemplateId: string | null
  isBuilderPreview: boolean
  draftCatalogEmbed: boolean
}

/**
 * When true, StoreLayout should not render UnifiedNav / theme footer — the page
 * content (builder nav block, catalog template shell, etc.) owns the chrome.
 */
export function shouldHideStoreLayoutChrome(input: StoreChromeHideInput): boolean {
  if (input.isBuilderPreview || input.draftCatalogEmbed) return true

  const isHome = isStoreHomePath(input.pathname, input.storePath)
  const site = input.builderSite
  const wbCatalogTemplateId = getWbCatalogTemplateId(
    site?.style_config as Record<string, unknown> | undefined,
  )
  const resolvedCatalogId = resolveLiveCatalogTemplateId(
    input.storeSpecificTemplateId ?? input.assignedTemplateId,
    wbCatalogTemplateId,
  )

  const usesAssignedLegacyHome = Boolean(
    input.assignedTemplateId && isDefaultLayoutTemplateId(input.assignedTemplateId),
  )
  const usesAssignedBlockTemplate = Boolean(
    input.assignedTemplateId && isWebsiteBuilderBlockTemplateId(input.assignedTemplateId),
  )

  const catalogHomeLayout = Boolean(
    resolvedCatalogId
    && isHome
    && site
    && !builderSiteHomeHasBlocks(site)
    && !usesAssignedLegacyHome
    && !usesAssignedBlockTemplate
    && isStorefrontCatalogTemplateId(resolvedCatalogId),
  )
  if (catalogHomeLayout) return true

  const assignedTemplateShellHome = Boolean(
    input.assignedTemplateId
    && isHome
    && !isDefaultLayoutTemplateId(input.assignedTemplateId),
  )
  if (assignedTemplateShellHome) return true

  if (!site) return false

  if (isHome && builderSiteHomeHasBlocks(site)) return true

  if (isHome && isWebsiteBuilderBlockTemplateId(resolvedCatalogId)) return true

  if (input.vendorSlug) {
    const slug = resolveBuilderPageSlug(input.pathname, input.vendorSlug)
    if (slug) {
      const page = findBuilderPageBySlug(site, slug)
      // The page owns the header when it has its own nav block, OR when it will
      // inherit the homepage's shared nav shell (see withSharedShellBlocks).
      if (page && (pageHasNavBlock(page.blocks) || siteHasNavShell(site))) return true
    }
  }

  // Catalog/shell routes (/products, /services, …) must use the same builder nav
  // as builder pages — not the legacy UnifiedNav header.
  if (siteHasNavShell(site) && input.vendorSlug) {
    const base = `/store/${input.vendorSlug}`
    if (input.pathname === base || input.pathname.startsWith(`${base}/`)) {
      return true
    }
  }

  return false
}
