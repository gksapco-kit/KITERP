import type {
  Cart,
  CartLine,
  Category,
  ListProductsParams,
  ListProductsResult,
  Money,
  Product,
  ServiceItem,
  ServiceProvider,
  StorefrontDataAdapter,
} from '../types'
import type { AddToCartInput } from '../types'
import { categories, products, services, providers } from '../mockData'

let cartCounter = 1
const carts = new Map<string, Cart>()

const sumMoney = (items: { price: Money; qty: number }[]): Money => {
  if (!items.length) return { amount: 0, currency: 'USD' }
  return {
    amount: items.reduce((s, i) => s + i.price.amount * i.qty, 0),
    currency: items[0].price.currency,
  }
}

const recomputeCart = (cart: Cart): Cart => {
  const priced = cart.lines.map((l) => ({
    price: l.unitPrice ?? { amount: 0, currency: 'USD' },
    qty: l.quantity,
  }))
  return { ...cart, subtotal: sumMoney(priced), total: sumMoney(priced) }
}

export const mockAdapter: StorefrontDataAdapter = {
  listCategories: async () => [...categories],

  listProducts: async (params?: ListProductsParams): Promise<ListProductsResult> => {
    let items = [...products]
    if (params?.categorySlug) {
      const cat = categories.find((c) => c.slug === params.categorySlug)
      if (cat) items = items.filter((p) => p.categoryIds.includes(cat.id))
    }
    if (params?.query) {
      const q = params.query.toLowerCase()
      items = items.filter(
        (p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      )
    }
    if (params?.tag) {
      items = items.filter((p) => p.tags?.includes(params.tag!))
    }
    const limit = params?.limit ?? 100
    return { items: items.slice(0, limit), total: items.length }
  },

  getProduct: async (slug: string) => products.find((p) => p.slug === slug) ?? null,

  getCart: async (cartId?: string): Promise<Cart> => {
    if (cartId && carts.has(cartId)) return recomputeCart(carts.get(cartId)!)
    const newCart: Cart = {
      id: `cart-${cartCounter++}`,
      lines: [],
      subtotal: { amount: 0, currency: 'USD' },
      total: { amount: 0, currency: 'USD' },
    }
    carts.set(newCart.id, newCart)
    return newCart
  },

  addToCart: async (input: AddToCartInput & { cartId?: string }) => {
    const { cartId, productId, variantId, quantity, name, variantLabel, imageUrl, unitPrice, inStock, maxQuantity, durationMinutes, providerName } = input
    let cart = cartId ? carts.get(cartId) : undefined
    if (!cart) {
      cart = { id: `cart-${cartCounter++}`, lines: [], subtotal: { amount: 0, currency: 'USD' }, total: { amount: 0, currency: 'USD' } }
    }
    const existing = cart.lines.find((l) => l.variantId === variantId)
    if (existing) {
      existing.quantity += quantity
    } else {
      cart.lines.push({
        id: `line-${Date.now()}`,
        productId,
        variantId,
        quantity,
        name,
        variantLabel,
        imageUrl,
        unitPrice,
        inStock,
        maxQuantity,
        durationMinutes,
        providerName,
      })
    }
    const updated = recomputeCart(cart)
    carts.set(updated.id, updated)
    return updated
  },

  updateCartLine: async ({ cartId, lineId, quantity }) => {
    const cart = carts.get(cartId)
    if (!cart) throw new Error('Cart not found')
    if (quantity <= 0) {
      cart.lines = cart.lines.filter((l) => l.id !== lineId)
    } else {
      const line = cart.lines.find((l) => l.id === lineId)
      if (line) line.quantity = quantity
    }
    const updated = recomputeCart(cart)
    carts.set(cartId, updated)
    return updated
  },

  removeCartLine: async ({ cartId, lineId }) => {
    const cart = carts.get(cartId)
    if (!cart) throw new Error('Cart not found')
    cart.lines = cart.lines.filter((l) => l.id !== lineId)
    const updated = recomputeCart(cart)
    carts.set(cartId, updated)
    return updated
  },

  listServices: async (): Promise<ServiceItem[]> => [...services],
  listProviders: async (): Promise<ServiceProvider[]> => [...providers],
}
