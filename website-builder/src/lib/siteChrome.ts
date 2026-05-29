import type { Block, Page } from '../types/builder'

const CHROME_TYPES = new Set<Block['type']>(['navbar', 'footer', 'footerMinimal'])

export function isSiteChromeBlock(block: Block): boolean {
  return CHROME_TYPES.has(block.type)
}

export function getHomePage(pages: Page[]): Page | undefined {
  return pages.find((p) => p.kind === 'home' || p.slug === 'home') ?? pages[0]
}

export function stripSiteChrome(blocks: Block[]): Block[] {
  return blocks.filter((b) => !isSiteChromeBlock(b))
}

/** Footer blocks from Home, or the first page that still has one. */
export function getSiteFooterBlocks(pages: Page[]): Block[] {
  const home = getHomePage(pages)
  const fromHome =
    home?.blocks.filter((b) => b.type === 'footer' || b.type === 'footerMinimal') ?? []
  if (fromHome.length > 0) return fromHome

  for (const page of pages) {
    const footers = page.blocks.filter((b) => b.type === 'footer' || b.type === 'footerMinimal')
    if (footers.length > 0) return footers
  }
  return []
}

export function getSiteNavbarBlock(pages: Page[]): Block | undefined {
  const home = getHomePage(pages)
  const fromHome = home?.blocks.find((b) => b.type === 'navbar')
  if (fromHome) return fromHome
  for (const page of pages) {
    const navbar = page.blocks.find((b) => b.type === 'navbar')
    if (navbar) return navbar
  }
  return undefined
}

function cloneBlock(block: Block): Block {
  const cloned: Block = {
    ...block,
    props: JSON.parse(JSON.stringify(block.props)),
    styles: { ...block.styles },
  }
  if (block.children) {
    cloned.children = block.children.map(cloneBlock)
  }
  return cloned
}

/** Use the home page navbar and footer on every page (same block ids, props, and styles). */
export function syncSiteChromeFromHome(pages: Page[]): Page[] {
  const home = getHomePage(pages)
  if (!home) return pages

  const homeNavbar = home.blocks.find((b) => b.type === 'navbar')
  const homeFooters = home.blocks.filter((b) => b.type === 'footer' || b.type === 'footerMinimal')
  if (!homeNavbar && homeFooters.length === 0) return pages

  return pages.map((page) => {
    const body = stripSiteChrome(page.blocks)
    const blocks: Block[] = []
    if (homeNavbar) blocks.push(cloneBlock(homeNavbar))
    blocks.push(...body)
    for (const footer of homeFooters) blocks.push(cloneBlock(footer))
    return { ...page, blocks }
  })
}
