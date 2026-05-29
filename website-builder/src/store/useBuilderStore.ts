import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import { clearPersistedSite, persistSite } from '../lib/sitePersistence'
import { generateSite } from '../lib/pageTemplates'
import { getHomePage, isSiteChromeBlock } from '../lib/siteChrome'
import { createBlockFromType } from '../lib/blockRegistry'
import {
  canNestBlockType,
  cloneBlockDeep,
  findBlockInTree,
  insertBlockInTree,
  moveBlockInTree,
  removeBlockFromTree,
  reorderContainerChild,
  updateBlockInTree,
  type BlockLocation,
} from '../lib/blockTree'
import type {
  Block,
  BlockProps,
  BlockStyles,
  BlockType,
  CartItem,
  CatalogProduct,
  CatalogService,
  EditorMode,
  Page,
  PageBackground,
  PageKind,
  SiteConfig,
} from '../types/builder'
import { DEFAULT_PAGE_BACKGROUND } from '../lib/pageBackground'

interface BuilderState {
  onboardingComplete: boolean
  siteConfig: SiteConfig | null
  siteName: string
  pages: Page[]
  activePageId: string
  catalog: { products: CatalogProduct[]; services: CatalogService[] }
  cart: CartItem[]
  selectedBlockId: string | null
  mode: EditorMode
  darkMode: boolean
  /** Hides component + properties panels for a wider canvas. */
  canvasMaximized: boolean

  completeOnboarding: (config: SiteConfig) => void
  setDarkMode: (dark: boolean) => void
  toggleBlockVisibility: (id: string) => void
  resetOnboarding: () => void
  /** Empty editor canvas for a new template (clears persisted site). */
  startNewBlankSite: () => void
  setSiteName: (name: string) => void
  setMode: (mode: EditorMode) => void
  selectBlock: (id: string | null) => void
  setActivePage: (pageId: string) => void
  addPage: (name: string, kind?: PageKind) => void
  removePage: (pageId: string) => void
  renamePage: (pageId: string, name: string) => void
  updatePageBackground: (background: Partial<PageBackground>) => void
  addBlock: (type: BlockType, index?: number, parentId?: string) => void
  removeBlock: (id: string) => void
  duplicateBlock: (id: string) => void
  moveBlock: (activeId: string, overId: string) => void
  reorderContainerChild: (containerId: string, childId: string, direction: 'up' | 'down') => void
  updateBlockProps: (id: string, props: Partial<BlockProps>) => void
  updateBlockStyles: (id: string, styles: Partial<BlockStyles>) => void
  clearCanvas: () => void
  addToCart: (item: Omit<CartItem, 'id'>) => void
  removeFromCart: (id: string) => void
  updateCartQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  setCatalogProducts: (products: CatalogProduct[]) => void
  toggleCanvasMaximized: () => void
  setCanvasMaximized: (maximized: boolean) => void
}

function updateActivePageBlocks(
  state: BuilderState,
  updater: (blocks: Block[]) => Block[],
): Partial<BuilderState> {
  const pages = state.pages.map((page) =>
    page.id === state.activePageId ? { ...page, blocks: updater(page.blocks) } : page,
  )
  return { pages }
}

const emptyState = {
  onboardingComplete: false,
  siteConfig: null,
  siteName: 'My Website',
  pages: [] as Page[],
  activePageId: '',
  catalog: { products: [] as CatalogProduct[], services: [] as CatalogService[] },
  cart: [] as CartItem[],
  selectedBlockId: null,
  mode: 'edit' as EditorMode,
  darkMode: false,
  canvasMaximized: false,
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  ...emptyState,

  completeOnboarding: (config) => {
    const { pages, catalog } = generateSite(config)
    set({
      onboardingComplete: true,
      siteConfig: config,
      siteName: config.businessName,
      pages,
      activePageId: pages[0]?.id ?? '',
      catalog,
      cart: [],
      selectedBlockId: null,
      mode: 'edit',
    })
  },

  resetOnboarding: () => {
    clearPersistedSite()
    set({ ...emptyState })
  },

  startNewBlankSite: () => {
    clearPersistedSite()
    const homePage: Page = {
      id: uuid(),
      name: 'Home',
      slug: 'home',
      kind: 'home',
      blocks: [],
      background: { ...DEFAULT_PAGE_BACKGROUND },
    }
    const siteConfig: SiteConfig = {
      businessName: 'My Website',
      businessType: 'both',
      category: 'other',
    }
    set({
      ...emptyState,
      onboardingComplete: true,
      siteConfig,
      siteName: 'My Website',
      pages: [homePage],
      activePageId: homePage.id,
      catalog: { products: [], services: [] },
      mode: 'edit',
    })
    persistSite(get(), { immediate: true })
  },

  setSiteName: (name) => set({ siteName: name }),

  setDarkMode: (darkMode) =>
    set((state) => ({
      darkMode,
      pages: state.pages.map((p) =>
        p.id === state.activePageId ? { ...p, darkMode } : p,
      ),
    })),

  setActivePage: (pageId) =>
    set((state) => {
      const page = state.pages.find((p) => p.id === pageId)
      return {
        activePageId: pageId,
        selectedBlockId: null,
        darkMode: page?.darkMode ?? state.darkMode,
      }
    }),

  toggleBlockVisibility: (id) =>
    set((state) =>
      updateActivePageBlocks(state, (blocks) =>
        updateBlockInTree(blocks, id, (b) => ({
          ...b,
          props: { ...b.props, visible: b.props.visible === false ? true : false },
        })),
      ),
    ),

  setMode: (mode) =>
    set({
      mode,
      selectedBlockId: mode === 'preview' ? null : get().selectedBlockId,
      canvasMaximized: mode === 'preview' ? true : get().canvasMaximized,
    }),

  toggleCanvasMaximized: () => set((state) => ({ canvasMaximized: !state.canvasMaximized })),

  setCanvasMaximized: (canvasMaximized) => set({ canvasMaximized }),

  selectBlock: (id) => set({ selectedBlockId: id }),

  addPage: (name, kind = 'custom') => {
    const slug = name.toLowerCase().replace(/\s+/g, '-')
    set((state) => {
      const home = getHomePage(state.pages)
      const homeNavbar = home?.blocks.find((b) => b.type === 'navbar')
      const homeFooters = home?.blocks.filter((b) => b.type === 'footer' || b.type === 'footerMinimal') ?? []
      const body: Block[] = [
        createBlockFromType('heading', uuid()),
        createBlockFromType('paragraph', uuid()),
      ]
      const blocks: Block[] = []
      if (homeNavbar) {
        blocks.push(JSON.parse(JSON.stringify(homeNavbar)) as Block)
      } else {
        blocks.push(createBlockFromType('navbar', uuid()))
      }
      blocks.push(...body)
      if (homeFooters.length > 0) {
        for (const footer of homeFooters) {
          blocks.push(JSON.parse(JSON.stringify(footer)) as Block)
        }
      } else {
        blocks.push(createBlockFromType('footer', uuid()))
      }

      const page: Page = {
        id: uuid(),
        name,
        slug,
        kind,
        background: { ...DEFAULT_PAGE_BACKGROUND },
        blocks,
      }
      return {
        pages: [...state.pages, page],
        activePageId: page.id,
        selectedBlockId: null,
      }
    })
  },

  removePage: (pageId) =>
    set((state) => {
      if (state.pages.length <= 1) return state
      const pages = state.pages.filter((p) => p.id !== pageId)
      const activePageId = state.activePageId === pageId ? pages[0].id : state.activePageId
      return { pages, activePageId, selectedBlockId: null }
    }),

  renamePage: (pageId, name) =>
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, name, slug: name.toLowerCase().replace(/\s+/g, '-') } : p,
      ),
    })),

  updatePageBackground: (background) =>
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === state.activePageId
          ? {
              ...p,
              background: {
                ...(p.background ?? DEFAULT_PAGE_BACKGROUND),
                ...background,
              },
            }
          : p,
      ),
    })),

  addBlock: (type, index, parentId) =>
    set((state) => {
      if (parentId && !canNestBlockType(type)) return state
      const newBlock = createBlockFromType(type, uuid())
      const activePage = state.pages.find((p) => p.id === state.activePageId)
      const parentLoc = parentId && activePage ? findBlockInTree(activePage.blocks, parentId) : null
      const insertIndex = index ?? (parentLoc ? (parentLoc.block.children?.length ?? 0) : activePage?.blocks.length ?? 0)

      return {
        ...updateActivePageBlocks(state, (blocks) =>
          insertBlockInTree(blocks, newBlock, parentId ?? null, insertIndex),
        ),
        selectedBlockId: newBlock.id,
      }
    }),

  removeBlock: (id) =>
    set((state) => {
      const located = state.pages
        .map((p) => findBlockInTree(p.blocks, id))
        .find((loc) => loc != null)
      const isChrome = located ? isSiteChromeBlock(located.block) : false

      if (isChrome) {
        return {
          pages: state.pages.map((page) => ({
            ...page,
            blocks: removeBlockFromTree(page.blocks, id),
          })),
          selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
        }
      }

      return {
        ...updateActivePageBlocks(state, (blocks) => removeBlockFromTree(blocks, id)),
        selectedBlockId: state.selectedBlockId === id ? null : state.selectedBlockId,
      }
    }),

  duplicateBlock: (id) =>
    set((state) => {
      const activePage = state.pages.find((p) => p.id === state.activePageId)
      if (!activePage) return state
      const loc = findBlockInTree(activePage.blocks, id)
      if (!loc) return state
      const duplicate = cloneBlockDeep(loc.block)
      return {
        ...updateActivePageBlocks(state, (blocks) =>
          insertBlockInTree(blocks, duplicate, loc.parent?.id ?? null, loc.index + 1),
        ),
        selectedBlockId: duplicate.id,
      }
    }),

  moveBlock: (activeId, overId) =>
    set((state) => {
      const activePage = state.pages.find((p) => p.id === state.activePageId)
      if (!activePage) return state
      const next = moveBlockInTree(activePage.blocks, activeId, overId)
      if (!next) return state
      return updateActivePageBlocks(state, () => next)
    }),

  reorderContainerChild: (containerId, childId, direction) =>
    set((state) => {
      const activePage = state.pages.find((p) => p.id === state.activePageId)
      if (!activePage) return state
      const next = reorderContainerChild(activePage.blocks, containerId, childId, direction)
      if (!next) return state
      return updateActivePageBlocks(state, () => next)
    }),

  updateBlockProps: (id, props) =>
    set((state) => {
      const pages = state.pages.map((page) => ({
        ...page,
        blocks: updateBlockInTree(page.blocks, id, (b) => {
          const next = { ...b.props, ...props }
          for (const key of Object.keys(props) as (keyof BlockProps)[]) {
            if (props[key] === undefined) delete next[key]
          }
          return { ...b, props: next }
        }),
      }))
      const catalog =
        props.products != null
          ? { ...state.catalog, products: props.products.map((p) => ({ ...p })) }
          : state.catalog
      return { pages, catalog }
    }),

  updateBlockStyles: (id, styles) =>
    set((state) => ({
      pages: state.pages.map((page) => ({
        ...page,
        blocks: updateBlockInTree(page.blocks, id, (b) => {
          const next = { ...b.styles, ...styles }
          if ('width' in styles && styles.width === undefined) delete next.width
          if ('height' in styles && styles.height === undefined) delete next.height
          return { ...b, styles: next }
        }),
      })),
    })),

  clearCanvas: () =>
    set((state) => ({
      ...updateActivePageBlocks(state, () => []),
      selectedBlockId: null,
    })),

  addToCart: (item) =>
    set((state) => {
      const existing = state.cart.find((c) => c.itemId === item.itemId && c.itemType === item.itemType)
      if (existing) {
        return {
          cart: state.cart.map((c) =>
            c.id === existing.id ? { ...c, quantity: c.quantity + item.quantity } : c,
          ),
        }
      }
      return { cart: [...state.cart, { ...item, id: uuid() }] }
    }),

  removeFromCart: (id) => set((state) => ({ cart: state.cart.filter((c) => c.id !== id) })),

  updateCartQuantity: (id, quantity) =>
    set((state) => ({
      cart:
        quantity <= 0
          ? state.cart.filter((c) => c.id !== id)
          : state.cart.map((c) => (c.id === id ? { ...c, quantity } : c)),
    })),

  clearCart: () => set({ cart: [] }),

  setCatalogProducts: (products) =>
    set((state) => ({
      catalog: { ...state.catalog, products: products.map((p) => ({ ...p })) },
    })),
}))

export function useActivePage() {
  return useBuilderStore((s) => s.pages.find((p) => p.id === s.activePageId))
}

export function useActiveBlocks() {
  return useBuilderStore((s) => s.pages.find((p) => p.id === s.activePageId)?.blocks ?? [])
}

export function useSelectedBlock(): Block | undefined {
  return useSelectedBlockLocation()?.block
}

export function useSelectedBlockLocation(): BlockLocation | null {
  const page = useActivePage()
  const selectedBlockId = useBuilderStore((s) => s.selectedBlockId)
  if (!page || !selectedBlockId) return null
  return findBlockInTree(page.blocks, selectedBlockId)
}

useBuilderStore.subscribe((state) => {
  if (state.onboardingComplete && state.siteConfig) {
    try {
      persistSite(state)
    } catch (err) {
      console.warn('[website-builder] auto-save failed:', err)
    }
  }
})
