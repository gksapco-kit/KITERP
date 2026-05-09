import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AddToCartInput, Cart, StorefrontDataAdapter } from './types'
import { mockAdapter } from './adapters/mock'

export type { AddToCartInput }

interface StorefrontContextValue {
  adapter: StorefrontDataAdapter
  cart: Cart | null
  refreshCart: () => Promise<void>
  addToCart: (input: AddToCartInput) => Promise<void>
  updateLine: (lineId: string, quantity: number) => Promise<void>
  removeLine: (lineId: string) => Promise<void>
}

const StorefrontContext = createContext<StorefrontContextValue | null>(null)

export const StorefrontProvider = ({
  children,
  adapter = mockAdapter,
}: {
  children: ReactNode
  adapter?: StorefrontDataAdapter
}) => {
  const [cart, setCart] = useState<Cart | null>(null)

  useEffect(() => {
    adapter.getCart().then(setCart)
  }, [adapter])

  const refreshCart = async () => {
    if (!cart) return
    const next = await adapter.getCart(cart.id)
    setCart(next)
  }

  const addToCart = async (input: AddToCartInput) => {
    const next = await adapter.addToCart({ ...input, cartId: cart?.id })
    setCart(next)
  }

  const updateLine = async (lineId: string, quantity: number) => {
    if (!cart) return
    const next = await adapter.updateCartLine({ cartId: cart.id, lineId, quantity })
    setCart(next)
  }

  const removeLine = async (lineId: string) => {
    if (!cart) return
    const next = await adapter.removeCartLine({ cartId: cart.id, lineId })
    setCart(next)
  }

  return (
    <StorefrontContext.Provider value={{ adapter, cart, refreshCart, addToCart, updateLine, removeLine }}>
      {children}
    </StorefrontContext.Provider>
  )
}

export const useStorefront = () => {
  const ctx = useContext(StorefrontContext)
  if (!ctx) throw new Error('useStorefront must be used inside <StorefrontProvider>')
  return ctx
}

export const formatMoney = (m: { amount: number; currency: string } | undefined) => {
  if (!m) return ''
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: m.currency }).format(m.amount / 100)
  } catch {
    return `${(m.amount / 100).toFixed(2)} ${m.currency}`
  }
}
