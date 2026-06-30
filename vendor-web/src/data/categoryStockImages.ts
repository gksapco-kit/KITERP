/**
 * Royalty-free stock URLs for layout previews and builder gallery.
 * Used when the local `/business-images/` pack is not installed.
 */

/** Each gallery category shows this many unique image slots (matches local JPG pack size). */
export const GALLERY_SLOT_COUNT = 10

const UNSPLASH = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`

const SHOP_DEFAULT = [
  UNSPLASH('1441986300917-64674bd600d8'),
  UNSPLASH('1495121605193-b116b5b9c5fe'),
  UNSPLASH('1516257984-b1b4d707412e'),
  UNSPLASH('1591561954557-26941169b49e'),
  UNSPLASH('1556742049-0cfed4f6a45d'),
  UNSPLASH('1486406146926-c627a92ad1ab'),
  UNSPLASH('1556761175-5973dc0f32e8'),
  UNSPLASH('1560472354-b33ff0c44a43'),
  UNSPLASH('1558618666-fcd25c85cd64'),
  UNSPLASH('1523275335684-37898b6baf30'),
]

const GROUP_STOCK_POOLS: Record<string, string[]> = {
  'General Business': SHOP_DEFAULT,
  'Retail & Commerce': [
    UNSPLASH('1555529665-1569b70306e2'),
    UNSPLASH('1607082348824-0a96f2a4b9da'),
    UNSPLASH('1472851294608-062f824d29cc'),
    UNSPLASH('1563013544-824ae1b704d3'),
    UNSPLASH('1445205170230-053b73816039'),
    UNSPLASH('1528698821843-031c577a4edc'),
    UNSPLASH('1441986300917-64674bd600d8'),
    UNSPLASH('1495121605193-b116b5b9c5fe'),
    UNSPLASH('1516257984-b1b4d707412e'),
    UNSPLASH('1591561954557-26941169b49e'),
  ],
  'Food & Hospitality': [
    UNSPLASH('1414235077428-338989a2e8c0'),
    UNSPLASH('1504674900247-0877df9cc836'),
    UNSPLASH('1559339352-11d035aa65de'),
    UNSPLASH('1542838132-92c53300491e'),
    UNSPLASH('1517248135467-6f788ed42308'),
    UNSPLASH('1555396273-367ea4eb4db5'),
    UNSPLASH('1565299624946-b28f40a0ae38'),
    UNSPLASH('1574480664578-86d9f2d6cbb1'),
    UNSPLASH('1555939594-58d7cb561ad1'),
    UNSPLASH('1467003902550-3e4e0ea0a237'),
  ],
  Healthcare: [
    UNSPLASH('1576091160399-112ba8d25d1d'),
    UNSPLASH('1631217868264-e5b1a5fe279c'),
    UNSPLASH('1582750433449-648ed127bb54'),
    UNSPLASH('1519494021062-207bded1ffb1'),
    UNSPLASH('1579684385137-1ef15d508118'),
    UNSPLASH('1584985827496-379b322b0f27'),
    UNSPLASH('1559757175-0eb830ac8b84'),
    UNSPLASH('1576091160550-2173dba999ef'),
    UNSPLASH('1584515930351-d80f7278bccb'),
    UNSPLASH('1530497618107-15613de89435'),
  ],
  'Technology & IT': [
    UNSPLASH('1518770660439-4636190af475'),
    UNSPLASH('1451187580459-43490279c0fa'),
    UNSPLASH('1550751827-4bd374c3f58b'),
    UNSPLASH('1485827405103-c6fd79f2a1b0'),
    UNSPLASH('1504384308090-c894fdcc538d'),
    UNSPLASH('1531482615713-691fdb963553'),
    UNSPLASH('1551288049-bebda4e38f71'),
    UNSPLASH('1460925895917-afdab827c52f'),
    UNSPLASH('1555949963-aa79dcee981c'),
    UNSPLASH('1516321318523-f06f85e504b3'),
  ],
  'Manufacturing & Industrial': [
    UNSPLASH('1581091226825-a6a2a5aee158'),
    UNSPLASH('1565793298599-6f3944421475'),
    UNSPLASH('1504917595217-d4dc5eb1aeeb'),
    UNSPLASH('1581092160562-40aa08e78837'),
    UNSPLASH('1581092918056-0c4c3acd3789'),
    UNSPLASH('1581094794329-c811d26509c9'),
    UNSPLASH('1581092160607-5c7c0a0659bb'),
    UNSPLASH('1581091228775-a8166f0c38ef'),
    UNSPLASH('1581091226035-6a7d3a6e8b0e'),
    UNSPLASH('1581092162384-8987c1d6418f'),
  ],
  'Logistics & Transport': [
    UNSPLASH('1586528110311-48fd604b0701'),
    UNSPLASH('1601584115197-04ffd0d5cfcf'),
    UNSPLASH('1494412571407-7c26a77d17e8'),
    UNSPLASH('1566576912321-d58ddd667a59'),
    UNSPLASH('1578574577313-3f84fa3be373'),
    UNSPLASH('1519003722464-0a7706541777'),
    UNSPLASH('1504914399878-9ea4e67696bb'),
    UNSPLASH('1580674285004-82447517381a'),
    UNSPLASH('1601584115297-47f0b5c35147'),
    UNSPLASH('1558618666-fcd25c85cd64'),
  ],
  'Professional Services': [
    UNSPLASH('1454165804606-c3d57bc86b40'),
    UNSPLASH('1556761175-b19da4aaef9b'),
    UNSPLASH('1553877522-43269d4ea984'),
    UNSPLASH('1521791136062-1886e16c8db4'),
    UNSPLASH('1552664730-d307ca884978'),
    UNSPLASH('1556761175-5973dc0f32e8'),
    UNSPLASH('1600880292203-757bb62b4baf'),
    UNSPLASH('1556761175-4b46a572b786'),
    UNSPLASH('1522071820081-009f0129c71c'),
    UNSPLASH('1551836022-d5d88f8e3e4f'),
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
  'computer-store': GROUP_STOCK_POOLS['Technology & IT'],
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
    UNSPLASH('1514933651103-005eec06c04b'),
    UNSPLASH('1572116469696-31de0f17cc34'),
    UNSPLASH('1551218808-94e220e084d2'),
  ],
  'sweet-shop': [
    UNSPLASH('1574480664578-86d9f2d6cbb1'),
    UNSPLASH('1488477181946-6428a0291776'),
    UNSPLASH('1551024506-0bccd828db5a'),
    UNSPLASH('1514517521187-7ca8d4870688'),
    UNSPLASH('1606313564200-e75d5e30476f'),
    UNSPLASH('1587241321441-47ecc4d73603'),
    UNSPLASH('1499636138093-9ef5a46055a6'),
    UNSPLASH('1558961363-f1879f7d98a8'),
    UNSPLASH('1563805042-7684c019a132'),
    UNSPLASH('1563729787504-dd933a2e2cb1'),
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

function uniqueUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const url of urls) {
    if (seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}

/** Merge pools and keep the first N unique URLs (no cycling duplicates). */
function expandPoolToGallerySize(base: string[], ...extraPools: string[][]): string[] {
  const merged = uniqueUrls([...base, ...extraPools.flat()])
  return merged.slice(0, GALLERY_SLOT_COUNT)
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
  if (
    id.includes('software') || id.includes('saas') || id.includes('cloud')
    || id.includes('cyber') || id.includes('data-analytics') || id.includes('machine-learning')
    || id.includes('bpo') || id.includes('call-center') || id.includes('mobile-app')
    || id.includes('web-development') || id.includes('it-support') || id.includes('computer')
  ) {
    return GROUP_STOCK_POOLS['Technology & IT']
  }
  if (
    id.includes('manufacturing') || id.includes('engineering-works')
    || id.includes('processing') || id.includes('packaging-unit')
    || id.includes('printing-press') || id.includes('textile')
  ) {
    return GROUP_STOCK_POOLS['Manufacturing & Industrial']
  }
  if (
    id.includes('transport') || id.includes('trucking') || id.includes('freight')
    || id.includes('cargo') || id.includes('courier') || id.includes('shipping')
    || id.includes('fleet') || id.includes('bus-operator') || id.includes('taxi')
    || id.includes('packers-movers') || id.includes('logistics')
  ) {
    return GROUP_STOCK_POOLS['Logistics & Transport']
  }
  if (
    id.includes('consultant') || id.includes('consultancy') || id.includes('auditor')
    || id.includes('accountant') || id.includes('legal') || id.includes('recruitment')
    || id.includes('translation') || id.includes('corporate-services')
    || id.includes('market-research') || id.includes('tax-')
  ) {
    return GROUP_STOCK_POOLS['Professional Services']
  }
  return GROUP_STOCK_POOLS['Retail & Commerce']
}

export function stockPoolForCategory(categoryId: string): string[] {
  const normalized = normalizeGalleryCategoryId(categoryId)
  const specific = CATEGORY_STOCK_POOLS[normalized]
  const group = inferGroupPool(normalized) ?? SHOP_DEFAULT
  const base = specific?.length ? specific : group
  return expandPoolToGallerySize(base, SHOP_DEFAULT)
}

/** 1-based index — matches businessImagePack numbering. */
export function resolveCategoryStockImageUrl(categoryId: string, index: number): string {
  const pool = stockPoolForCategory(categoryId)
  if (pool.length === 0) return SHOP_DEFAULT[0]
  const i = Math.max(1, index) - 1
  return pool[i % pool.length]
}
