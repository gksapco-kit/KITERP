export interface BusinessImageCategory {
  id: string
  label: string
  description: string
}

export interface BusinessImage {
  id: string
  categoryId: string
  filename: string
  url: string
  label: string
}

const IMAGE_COUNT = 10

export const BUSINESS_IMAGE_CATEGORIES: BusinessImageCategory[] = [
  {
    id: 'beauty',
    label: 'Beauty',
    description: 'Skincare, makeup, perfume, portraits, and store interiors',
  },
  {
    id: 'electronics',
    label: 'Electronics',
    description: 'Showrooms, phones, laptops, earbuds, smartwatches, and lifestyle',
  },
  {
    id: 'jewelry',
    label: 'Jewelry',
    description: 'Luxury interiors, rings, necklaces, hands, and displays',
  },
  {
    id: 'shop',
    label: 'Shop',
    description: 'Boutique storefronts, interiors, products, and lifestyle',
  },
  {
    id: 'store',
    label: 'Store',
    description: 'Retail interiors, displays, shoppers, and checkout',
  },
  {
    id: 'supermarket',
    label: 'Supermarket',
    description: 'Produce, aisles, bakery, deli, shoppers, and exteriors',
  },
]

function imageUrl(categoryId: string, index: number): string {
  const num = String(index).padStart(2, '0')
  return `/business-images/${categoryId}/${categoryId}-${num}.jpg`
}

export const BUSINESS_IMAGES: BusinessImage[] = BUSINESS_IMAGE_CATEGORIES.flatMap((cat) =>
  Array.from({ length: IMAGE_COUNT }, (_, i) => {
    const num = i + 1
    const padded = String(num).padStart(2, '0')
    return {
      id: `${cat.id}-${padded}`,
      categoryId: cat.id,
      filename: `${cat.id}-${padded}.jpg`,
      url: imageUrl(cat.id, num),
      label: `${cat.label} ${num}`,
    }
  }),
)

export function imagesForCategory(categoryId: string): BusinessImage[] {
  return BUSINESS_IMAGES.filter((img) => img.categoryId === categoryId)
}

export function categoryById(categoryId: string): BusinessImageCategory | undefined {
  return BUSINESS_IMAGE_CATEGORIES.find((c) => c.id === categoryId)
}
