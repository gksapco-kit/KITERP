import { v4 as uuid } from 'uuid'
import { createCatalogForCategory } from './catalogData'
import { createFullFooterProps } from './footerDefaults'
import { defaultNavbarProps } from './navbarDefaults'
import { buildTemplateHomeBlocks, getDefaultTemplateId } from './websiteTemplates'
import { createBlockFromType } from './blockRegistry'
import { DEFAULT_PAGE_BACKGROUND } from './pageBackground'
import { createLegalPage } from './legalPageDefaults'
import { syncSiteChromeFromHome } from './siteChrome'
import type { Block, CatalogProduct, CatalogService, Page, SiteConfig } from '../types/builder'

export function navbarBlock(companyName: string, navItems: string[]): Block {
  const block = createBlockFromType('navbar', uuid())
  block.props = {
    ...block.props,
    ...defaultNavbarProps(companyName),
    navbarLinks: navItems.map((label) => ({ id: uuid(), label })),
    items: navItems,
  }
  return block
}

export function footerBlock(companyName: string, navItems?: string[]): Block {
  const block = createBlockFromType('footer', uuid())
  const items = navItems ?? ['Home', 'Contact']
  block.props = { ...block.props, ...createFullFooterProps(companyName, items) }
  return block
}

export function buildNavItems(config: SiteConfig): string[] {
  const items = ['Home']
  if (config.businessType === 'products' || config.businessType === 'both') items.push('Products')
  if (config.businessType === 'services' || config.businessType === 'both') items.push('Services')
  if (config.businessType !== 'services') items.push('Cart')
  items.push('Contact')
  return items
}

export function generateSite(config: SiteConfig): {
  pages: Page[]
  catalog: { products: CatalogProduct[]; services: CatalogService[] }
} {
  const catalog = createCatalogForCategory(config.category)
  const navItems = buildNavItems(config)
  const { businessName, businessType } = config
  const templateId = config.templateId ?? getDefaultTemplateId(config.category, config.businessType)
  const pages: Page[] = []

  const homeBlocks = buildTemplateHomeBlocks({ ...config, templateId }, templateId)
  pages.push({ id: uuid(), name: 'Home', slug: 'home', kind: 'home', blocks: homeBlocks })

  if (businessType === 'products' || businessType === 'both') {
    const listing = createBlockFromType('productListing', uuid())
    listing.props.text = 'Our Products'
    listing.props.subtitle = 'Browse our collection and add items to your cart.'
    listing.props.columns = 3
    listing.props.showPrices = true
    listing.props.showAddToCart = true
    listing.props.products = catalog.products.map((p) => ({ ...p }))

    pages.push({
      id: uuid(),
      name: 'Products',
      slug: 'products',
      kind: 'products',
      blocks: [
        navbarBlock(businessName, navItems),
        listing,
        footerBlock(businessName, navItems),
      ],
    })

    const cart = createBlockFromType('cartWidget', uuid())
    cart.props.text = 'Your Shopping Cart'
    cart.props.subtitle = 'Review items before checkout.'

    pages.push({
      id: uuid(),
      name: 'Cart',
      slug: 'cart',
      kind: 'cart',
      blocks: [
        navbarBlock(businessName, navItems),
        cart,
        footerBlock(businessName, navItems),
      ],
    })
  }

  if (businessType === 'services' || businessType === 'both') {
    const listing = createBlockFromType('serviceListing', uuid())
    listing.props.text = 'Our Services'
    listing.props.subtitle = 'Book the perfect service for your needs.'
    listing.props.columns = 2
    listing.props.showPrices = true

    pages.push({
      id: uuid(),
      name: 'Services',
      slug: 'services',
      kind: 'services',
      blocks: [
        navbarBlock(businessName, navItems),
        listing,
        footerBlock(businessName, navItems),
      ],
    })
  }

  const checkout = createBlockFromType('checkoutWidget', uuid())
  checkout.props.text = 'Checkout'
  checkout.props.subtitle = 'Complete your order securely.'

  pages.push({
    id: uuid(),
    name: 'Checkout',
    slug: 'checkout',
    kind: 'checkout',
    blocks: [
      navbarBlock(businessName, navItems),
      checkout,
      footerBlock(businessName, navItems),
    ],
  })

  const contact = createBlockFromType('contact', uuid())
  contact.props.text = 'Contact Us'
  contact.props.subtitle = `Get in touch with ${businessName}.`
  contact.props.email = 'hello@example.com'
  contact.props.phone = '+1 (555) 123-4567'

  const mapBlock = createBlockFromType('mapEmbed', uuid())
  mapBlock.props.text = 'Our Location'

  pages.push({
    id: uuid(),
    name: 'Contact',
    slug: 'contact',
    kind: 'contact',
    blocks: [
      navbarBlock(businessName, navItems),
      contact,
      mapBlock,
      footerBlock(businessName, navItems),
    ],
  })

  pages.push({
    id: uuid(),
    ...createLegalPage('privacy', businessName),
  })

  pages.push({
    id: uuid(),
    ...createLegalPage('terms', businessName),
  })

  const pagesWithBackground = syncSiteChromeFromHome(
    pages.map((p) => ({
      ...p,
      background: p.background ?? { ...DEFAULT_PAGE_BACKGROUND },
    })),
  )

  return { pages: pagesWithBackground, catalog }
}
