const JEWELRY_IMG = 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=900&q=80'
const GROCERY_IMG = 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=900&q=80'
const FASHION_IMG = 'https://images.unsplash.com/photo-1483985988350-763728e3685b?w=900&q=80'

export function defaultCouponBannerProps() {
  return {
    text: '20% Off Your First Order',
    subtitle: 'Exclusive online offer — one use per customer',
    badge: 'Limited time',
    couponCode: 'WELCOME20',
    buttonText: 'Shop Now',
    buttonLink: '#products',
  }
}

export function defaultFlashSaleBannerProps() {
  return {
    text: 'Flash Sale — Ends Tonight',
    subtitle: 'Up to 50% off select styles. While supplies last.',
    badge: 'Ends soon',
    endsAt: 'Sunday 11:59 PM',
    buttonText: 'Grab the deal',
    buttonLink: '#products',
  }
}

export function defaultSplitCategoryBannerProps() {
  return {
    text: 'New Season Collection',
    subtitle: 'Handcrafted pieces for every occasion — explore rings, necklaces, and more.',
    badge: 'Jewellery',
    imageUrl: JEWELRY_IMG,
    splitImageSide: 'right' as const,
    buttonText: 'View collection',
    buttonLink: '#products',
  }
}

export function defaultOfferStripBannerProps() {
  return {
    text: 'Fresh groceries delivered tomorrow',
    subtitle: 'Order before 6 PM for next-day delivery in your area.',
    icon: '🛒',
    buttonText: 'Start shopping',
    buttonLink: '#products',
  }
}

export function defaultTrustStripBannerProps() {
  return {
    features: [
      { title: 'Free delivery', description: 'On orders over $50' },
      { title: 'Easy returns', description: '30-day hassle-free returns' },
      { title: 'Secure checkout', description: 'SSL encrypted payments' },
    ],
  }
}

export function defaultGroceryDealBannerProps() {
  return {
    text: 'Weekly deals',
    subtitle: 'Save on pantry staples, produce, and household essentials.',
    badge: 'Grocery',
    icon: '🥬',
    buttonText: 'See weekly flyer',
    buttonLink: '#products',
    imageUrl: GROCERY_IMG,
  }
}

export function defaultFashionPromoBannerProps() {
  return {
    text: 'Summer style edit',
    subtitle: 'Curated looks for work, weekend, and everything in between.',
    badge: 'New arrivals',
    buttonText: 'Explore looks',
    buttonLink: '#products',
    imageUrl: FASHION_IMG,
    heroBackgroundMode: 'image' as const,
    overlayOpacity: 0.45,
  }
}
