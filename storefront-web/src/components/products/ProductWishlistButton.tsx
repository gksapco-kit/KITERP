import { Heart, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useVendor } from '@/contexts/VendorContext'
import { useWishlist, useToggleWishlist } from '@/hooks/useStore'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Props = {
  productId: string
  productName: string
  slug?: string
  price?: number
  imageUrl?: string
  variantId?: string
  className?: string
  size?: 'default' | 'icon'
  /** Floated on product hero image — white chip with shadow for contrast */
  overlay?: boolean
}

export function ProductWishlistButton({
  productId,
  productName,
  slug,
  price = 0,
  imageUrl,
  variantId,
  className,
  size = 'icon',
  overlay = false,
}: Props) {
  const { isAuthenticated } = useAuthStore()
  const { storePath } = useVendor()
  const navigate = useNavigate()
  const { data: wishlist = [] } = useWishlist()
  const toggle = useToggleWishlist()
  const isSaved = wishlist.some((item) => item.id === productId)

  const handleClick = () => {
    if (!isAuthenticated) {
      navigate(storePath('/login'))
      return
    }
    toggle.mutate(
      {
        product_id: productId,
        variant_id: variantId,
        name: productName,
        price,
        image_url: imageUrl,
        slug,
      },
      {
        onSuccess: () => {
          toast.success(isSaved ? 'Removed from wishlist' : 'Saved to wishlist')
        },
      },
    )
  }

  if (size === 'icon') {
    return (
      <Button
        type="button"
        variant="outline"
        className={cn(
          'inline-flex shrink-0 items-center justify-center p-0',
          overlay && 'border-gray-200/80 bg-white/95 shadow-md backdrop-blur-sm hover:bg-white',
          className ?? 'h-10 w-10',
        )}
        aria-label={isSaved ? 'Remove from wishlist' : 'Add to wishlist'}
        disabled={toggle.isPending}
        onClick={handleClick}
      >
        {toggle.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Heart className={cn('h-4 w-4', isSaved && 'fill-rose-500 text-rose-500')} />
        )}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn('gap-2', className)}
      disabled={toggle.isPending}
      onClick={handleClick}
    >
      {toggle.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={cn('h-4 w-4', isSaved && 'fill-rose-500 text-rose-500')} />
      )}
      {isSaved ? 'Saved' : 'Save'}
    </Button>
  )
}
