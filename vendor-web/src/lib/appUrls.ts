import { getStorefrontAppOrigin } from '@/lib/storefrontPreviewUrl'

/** KITERP marketing / landing home (storefront app root). */
export function marketingHomeUrl(): string {
  return `${getStorefrontAppOrigin()}/`
}
