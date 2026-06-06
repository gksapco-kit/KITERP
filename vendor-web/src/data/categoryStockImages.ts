/**
 * Royalty-free stock URLs for layout previews and builder gallery.
 * Used when the local `/business-images/` pack is not installed.
 */

const SHOP_DEFAULT = [
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1495121605193-b116b5b9c5fe?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1516257984-b1b4d707412e?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80',
]

const GROUP_STOCK_POOLS: Record<string, string[]> = {
  'General Business': SHOP_DEFAULT,
  'Retail & Commerce': [
    'https://images.unsplash.com/photo-1555529665-1569b70306e2?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=900&q=80',
    ...SHOP_DEFAULT,
  ],
  'Food & Hospitality': [
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
  ],
  Healthcare: [
    'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1631217868264-e5b1a5fe279c?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1519494021062-207bded1ffb1?auto=format&fit=crop&w=900&q=80',
  ],
}

/** Maps wizard / site ids that are not in the gallery list to a gallery category. */
export const CATEGORY_ID_ALIASES: Record<string, string> = {
  grocery: 'wellness',
  healthcare: 'medical-equipment-store',
  clinic: 'medical-equipment-store',
  hospital: 'medical-equipment-store',
  restaurant: 'catering-service',
  cafe: 'catering-service',
  fashion: 'shop',
  retail: 'store',
}

const CATEGORY_STOCK_POOLS: Record<string, string[]> = {
  beauty: [
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1516975080664-ed2fc6a329cf?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=900&q=80',
  ],
  electronics: [
    'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=900&q=80',
  ],
  jewelry: [
    'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=900&q=80',
  ],
  shop: SHOP_DEFAULT,
  store: [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1555529665-1569b70306e2?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=900&q=80',
  ],
  supermarket: [
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1606851090756-56d7fd5520ce?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1556679343-7190518ceeb4?auto=format&fit=crop&w=900&q=80',
  ],
  wellness: [
    'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1606851090756-56d7fd5520ce?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80',
  ],
  'book-store': [
    'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1507842217343-583bb7270bce?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1524995994132-5781c2a7a032?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80',
  ],
  'catering-service': GROUP_STOCK_POOLS['Food & Hospitality'],
  'medical-equipment-store': GROUP_STOCK_POOLS.Healthcare,
  'pet-store': [
    'https://images.unsplash.com/photo-1450778868550-539d6d5032e7?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=900&q=80',
  ],
  'furniture-store': [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=900&q=80',
  ],
  resort: [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=900&q=80',
  ],
  'bar-pub': [
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=900&q=80',
  ],
  'veterinary-clinic': [
    'https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1450778868550-539d6d5032e7?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?auto=format&fit=crop&w=900&q=80',
  ],
  'nursing-home': GROUP_STOCK_POOLS.Healthcare,
  'blood-bank': GROUP_STOCK_POOLS.Healthcare,
  'physiotherapy-center': GROUP_STOCK_POOLS.Healthcare,
  'medical-laboratory': GROUP_STOCK_POOLS.Healthcare,
  'ambulance-service': GROUP_STOCK_POOLS.Healthcare,
  'home-healthcare-service': GROUP_STOCK_POOLS.Healthcare,
  'eye-hospital': GROUP_STOCK_POOLS.Healthcare,
  'mental-health-center': GROUP_STOCK_POOLS.Healthcare,
}

export function normalizeGalleryCategoryId(categoryId: string): string {
  const key = (categoryId || 'shop').trim().toLowerCase()
  return CATEGORY_ID_ALIASES[key] || key
}

function inferGroupPool(categoryId: string): string[] | undefined {
  const id = categoryId.toLowerCase()
  if (
    id.includes('medical') || id.includes('health') || id.includes('clinic')
    || id.includes('hospital') || id.includes('nursing') || id.includes('blood')
    || id.includes('physio') || id.includes('laboratory') || id.includes('ambulance')
    || id.includes('eye-') || id.includes('mental') || id.includes('veterinary')
  ) {
    return GROUP_STOCK_POOLS.Healthcare
  }
  if (
    id.includes('food') || id.includes('catering') || id.includes('restaurant')
    || id.includes('cafe') || id.includes('bar') || id.includes('juice')
    || id.includes('ice-cream') || id.includes('sweet') || id.includes('banquet')
    || id.includes('resort') || id.includes('lounge') || id.includes('homestay')
    || id.includes('mess') || id.includes('convention') || id.includes('supermarket')
    || id.includes('grocery') || id === 'wellness'
  ) {
    return GROUP_STOCK_POOLS['Food & Hospitality']
  }
  if (id === 'shop' || id === 'store' || id === 'beauty' || id === 'electronics' || id === 'jewelry') {
    return GROUP_STOCK_POOLS['General Business']
  }
  return GROUP_STOCK_POOLS['Retail & Commerce']
}

export function stockPoolForCategory(categoryId: string): string[] {
  const normalized = normalizeGalleryCategoryId(categoryId)
  const specific = CATEGORY_STOCK_POOLS[normalized]
  if (specific?.length) return specific
  return inferGroupPool(normalized) ?? SHOP_DEFAULT
}

/** 1-based index — matches businessImagePack numbering. */
export function resolveCategoryStockImageUrl(categoryId: string, index: number): string {
  const pool = stockPoolForCategory(categoryId)
  const i = Math.max(1, index) - 1
  return pool[i % pool.length] ?? SHOP_DEFAULT[0]
}
