import { Link } from 'react-router-dom'
import { useVendor } from '@/contexts/VendorContext'
import { WishlistPage } from '@/kit/account/AccountBlocks'
import { useAddToCart } from '@/hooks/useStore'
import { ChevronRight } from 'lucide-react'
import { useWishlist, useRemoveWishlistItem } from '@/hooks/useStore'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function MyWishlist() {
  const { storePath } = useVendor()
  const addToCart = useAddToCart()
  const { data: items = [], isLoading } = useWishlist()
  const removeItem = useRemoveWishlistItem()

  const handleMoveToCart = async (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    try {
      await addToCart.mutateAsync({
        product_id: item.id,
        name: item.name,
        qty: 1,
        price: item.price,
        image_url: item.image,
      })
      await removeItem.mutateAsync(id)
      toast.success(`${item.name} moved to cart`)
    } catch {
      toast.error('Could not add to cart')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <nav className="text-sm text-gray-500 mb-6 flex items-center gap-1.5">
        <Link to={storePath('/account')} className="hover:text-primary">Account</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-gray-900 font-medium">Wishlist</span>
      </nav>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
      ) : (
        <WishlistPage items={items} onMoveToCart={handleMoveToCart} />
      )}
    </div>
  )
}
