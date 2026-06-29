import { APP_FAVICON_URL } from '@/lib/appFavicon'
import { cn } from '@/lib/utils'

type KitErpBrandMarkProps = {
  className?: string
}

/** Shared KITERP logo — official cropped PNG asset. */
export function KitErpBrandMark({ className }: KitErpBrandMarkProps) {
  return (
    <img
      src={APP_FAVICON_URL}
      alt=""
      draggable={false}
      className={cn('h-8 w-8 shrink-0 object-contain', className)}
      aria-hidden
    />
  )
}
