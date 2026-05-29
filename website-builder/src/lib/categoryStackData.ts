import type { Block, CardItem, Page, TabCategory } from '../types/builder'

export interface StackCategoryHit {
  block: Block
  category: TabCategory
  page: Page
}

export interface StackItemHit {
  block: Block
  category: TabCategory
  item: CardItem
  page: Page
}

function stackCategories(block: Block): TabCategory[] {
  return block.props.stackCategories ?? block.props.tabCategories ?? []
}

export function findStackCategoryInPages(
  pages: Page[],
  blockId: string,
  categoryId: string,
): StackCategoryHit | null {
  for (const page of pages) {
    for (const block of page.blocks) {
      if (block.type !== 'categoryStack' || block.id !== blockId) continue
      const category = stackCategories(block).find((c) => c.id === categoryId)
      if (category) return { block, category, page }
    }
  }
  return null
}

export function findStackItemInPages(
  pages: Page[],
  blockId: string,
  itemId: string,
): StackItemHit | null {
  for (const page of pages) {
    for (const block of page.blocks) {
      if (block.type !== 'categoryStack') continue
      if (blockId && block.id !== blockId) continue
      for (const category of stackCategories(block)) {
        const item = category.items.find((i) => i.id === itemId)
        if (item) return { block, category, item, page }
      }
    }
  }
  return null
}

export function resolveStackCategories(block: Block): TabCategory[] {
  return stackCategories(block)
}

export interface StackBlockContext {
  block: Block
  categories: TabCategory[]
  page: Page
}

export function findStackBlockInPages(pages: Page[], blockId: string): StackBlockContext | null {
  for (const page of pages) {
    for (const block of page.blocks) {
      if (block.type !== 'categoryStack' || block.id !== blockId) continue
      return { block, categories: stackCategories(block), page }
    }
  }
  return null
}

export function getRelatedStackItems(
  category: TabCategory,
  currentItemId: string | undefined,
  limit = 4,
): CardItem[] {
  return category.items.filter((i) => i.id !== currentItemId).slice(0, limit)
}

export function getHomePageSlug(pages: Page[]): string {
  const home = pages.find((p) => p.kind === 'home') ?? pages[0]
  return home?.slug ?? 'home'
}
