import { useParams, Link, useOutletContext, useNavigate } from 'react-router-dom'
import { ShoppingCart, Trash2, Minus, Plus, ArrowRight, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { storefrontApi } from '@/api/storefront.api'
import type { StorefrontVendor } from '@/api/storefront.api'

export default function StorefrontCart() {
  const { vendorSlug } = useParams<{ vendorSlug: string }>()
  const { themeColor } = useOutletContext<{ vendor: StorefrontVendor; themeColor: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const base = `/store/${vendorSlug}`
  const symbol = '\u20B9'

  const { data: cart, isLoading } = useQuery({
    queryKey: ['storefront', 'cart', vendorSlug],
    queryFn: () => storefrontApi.getCart(vendorSlug || ''),
    enabled: !!vendorSlug,
  })

  const updateItem = useMutation({
    mutationFn: ({ index, qty }: { index: number; qty: number }) =>
      storefrontApi.updateCartItem(vendorSlug || '', index, qty),
    onSuccess: (data) => {
      qc.setQueryData(['storefront', 'cart', vendorSlug], data)
    },
    onError: () => toast.error('Failed to update item'),
  })

  const removeItem = useMutation({
    mutationFn: (index: number) => storefrontApi.removeCartItem(vendorSlug || '', index),
    onSuccess: (data) => {
      qc.setQueryData(['storefront', 'cart', vendorSlug], data)
      toast.success('Item removed')
    },
    onError: () => toast.error('Failed to remove item'),
  })

  const clearCart = useMutation({
    mutationFn: () => storefrontApi.clearCart(vendorSlug || ''),
    onSuccess: (data) => {
      qc.setQueryData(['storefront', 'cart', vendorSlug], data)
      toast.success('Cart cleared')
    },
  })

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    )
  }

  const items = cart?.items || []

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <ShoppingCart className="w-20 h-20 text-gray-300 mx-auto" />
        <h2 className="text-2xl font-bold text-gray-900 mt-6">Your cart is empty</h2>
        <p className="text-gray-500 mt-2">Browse our products and add items to your cart.</p>
        <Link to={`${base}/products`}>
          <Button className="mt-6 gap-2 text-white" style={{ backgroundColor: themeColor }}>
            <ShoppingBag className="w-5 h-5" /> Browse Products
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shopping Cart</h1>
        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => clearCart.mutate()}>
          <Trash2 className="w-4 h-4 mr-1" /> Clear All
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item, index) => (
            <div key={index} className="bg-white rounded-xl border p-4 flex gap-4">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-lg object-cover bg-gray-100" />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
                  <ShoppingBag className="w-8 h-8" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
                <p className="text-sm font-bold mt-1" style={{ color: themeColor }}>
                  {symbol}{item.price.toLocaleString()}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="inline-flex items-center border rounded-lg">
                    <button
                      onClick={() => item.qty > 1 && updateItem.mutate({ index, qty: item.qty - 1 })}
                      className="px-2 py-1 hover:bg-gray-100 disabled:opacity-50"
                      disabled={item.qty <= 1 || updateItem.isPending}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 py-1 text-sm font-medium min-w-[32px] text-center">{item.qty}</span>
                    <button
                      onClick={() => updateItem.mutate({ index, qty: item.qty + 1 })}
                      className="px-2 py-1 hover:bg-gray-100"
                      disabled={updateItem.isPending}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem.mutate(index)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                    disabled={removeItem.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">{symbol}{(item.price * item.qty).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border p-6 sticky top-24">
            <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal ({cart?.item_count} items)</span>
                <span>{symbol}{cart?.subtotal.toLocaleString()}</span>
              </div>
              {(cart?.discount_amount ?? 0) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{symbol}{cart!.discount_amount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-500">
                <span>Shipping</span>
                <span className="text-gray-400">Calculated at checkout</span>
              </div>
              <div className="border-t pt-3 flex justify-between font-bold text-lg text-gray-900">
                <span>Total</span>
                <span style={{ color: themeColor }}>{symbol}{((cart?.subtotal ?? 0) - (cart?.discount_amount ?? 0)).toLocaleString()}</span>
              </div>
            </div>
            <Button
              className="w-full mt-6 gap-2 text-white"
              size="lg"
              style={{ backgroundColor: themeColor }}
              onClick={() => navigate(`${base}/checkout`)}
            >
              Proceed to Checkout <ArrowRight className="w-5 h-5" />
            </Button>
            <Link to={`${base}/products`} className="block text-center text-sm mt-3 hover:underline" style={{ color: themeColor }}>
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
