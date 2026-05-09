import type { Category, Product, ServiceItem, ServiceProvider } from './types'

const img = (q: string, alt: string, w = 1200) => ({
  url: `https://images.unsplash.com/photo-${q}?auto=format&fit=crop&w=${w}&q=80`,
  alt,
})

export const categories: Category[] = [
  // fashion
  { id: 'c-fa-1', slug: 'women', name: 'Women', parentId: null, image: img('1495121605193-b116b5b9c5fe', "Women's apparel rack") },
  { id: 'c-fa-2', slug: 'men', name: 'Men', parentId: null, image: img('1516257984-b1b4d707412e', "Men's apparel display") },
  { id: 'c-fa-3', slug: 'accessories', name: 'Accessories', parentId: null, image: img('1591561954557-26941169b49e', 'Leather accessories') },
  // electronics
  { id: 'c-el-1', slug: 'phones', name: 'Phones', parentId: null, image: img('1511707171634-5f897ff02aa9', 'Smartphone on table') },
  { id: 'c-el-2', slug: 'laptops', name: 'Laptops', parentId: null, image: img('1496181133206-80ce9b88a853', 'Laptop on desk') },
  { id: 'c-el-3', slug: 'audio', name: 'Audio', parentId: null, image: img('1505740420928-5e560c06d30e', 'Wireless headphones') },
  // grocery
  { id: 'c-gr-1', slug: 'fruits-veg', name: 'Fruits & Veg', parentId: null, image: img('1542838132-92c53300491e', 'Fresh produce') },
  { id: 'c-gr-2', slug: 'bakery', name: 'Bakery', parentId: null, image: img('1509440159596-0249088772ff', 'Fresh bread') },
  { id: 'c-gr-3', slug: 'beverages', name: 'Beverages', parentId: null, image: img('1551024709-8f23befc6f87', 'Bottled drinks') },
  { id: 'c-gr-4', slug: 'snacks', name: 'Snacks', parentId: null, image: img('1599490659213-e2b9527bd087', 'Snack assortment') },
  // restaurant
  { id: 'c-re-1', slug: 'starters', name: 'Starters', parentId: null, image: img('1565299624946-b28f40a0ae38', 'Pizza starter') },
  { id: 'c-re-2', slug: 'mains', name: 'Mains', parentId: null, image: img('1546069901-ba9599a7e63c', 'Plated main course') },
  { id: 'c-re-3', slug: 'desserts', name: 'Desserts', parentId: null, image: img('1551024506-0bccd828d307', 'Layered dessert') },
]

const usd = (n: number) => ({ amount: n, currency: 'USD' })

export const products: Product[] = [
  // Fashion
  {
    id: 'p-fa-1', slug: 'linen-overcoat', title: 'Linen Overcoat', subtitle: 'Sand',
    description: 'A relaxed-fit overcoat cut from European linen with horn buttons and a half-canvas construction.',
    brand: 'Atelier Nord', categoryIds: ['c-fa-1'],
    images: [img('1539109136881-3be0616acf4b', 'Linen overcoat front', 900), img('1520975916090-3105956dac38', 'Linen overcoat side', 900)],
    variants: [
      { id: 'v1', name: 'S', options: { size: 'S' }, price: usd(28000), inStock: true },
      { id: 'v2', name: 'M', options: { size: 'M' }, price: usd(28000), inStock: true },
      { id: 'v3', name: 'L', options: { size: 'L' }, price: usd(28000), inStock: false },
    ],
    rating: { value: 4.8, count: 124 }, badges: ['New'], tags: ['outerwear'],
  },
  {
    id: 'p-fa-2', slug: 'wool-trousers', title: 'Pleated Wool Trousers', subtitle: 'Charcoal',
    description: 'High-rise wool trousers with a clean pleat and a softly tapered leg. Made in Portugal.',
    brand: 'Atelier Nord', categoryIds: ['c-fa-2'],
    images: [img('1473966968600-fa801b869a1a', 'Wool trousers', 900)],
    variants: [
      { id: 'v1', name: '30', options: { size: '30' }, price: usd(18500), inStock: true },
      { id: 'v2', name: '32', options: { size: '32' }, price: usd(18500), inStock: true },
      { id: 'v3', name: '34', options: { size: '34' }, price: usd(18500), inStock: true },
    ],
    rating: { value: 4.6, count: 88 }, tags: ['bottoms'],
  },
  {
    id: 'p-fa-3', slug: 'silk-scarf', title: 'Hand-Rolled Silk Scarf', subtitle: 'Bordeaux',
    description: '100% mulberry silk, hand-rolled edges. Printed in Como.',
    brand: 'Maison Vela', categoryIds: ['c-fa-3'],
    images: [img('1601924994987-69e26d50dc26', 'Silk scarf', 900)],
    variants: [{ id: 'v1', name: 'One size', options: {}, price: usd(9500), inStock: true }],
    rating: { value: 4.9, count: 41 }, badges: ['Bestseller'],
  },
  {
    id: 'p-fa-4', slug: 'leather-loafers', title: 'Hand-Stitched Loafers', subtitle: 'Cognac',
    description: 'Italian calfskin loafers with a Blake-stitched leather sole.',
    brand: 'Maison Vela', categoryIds: ['c-fa-2', 'c-fa-3'],
    images: [img('1542219550-37153d387c27', 'Leather loafers', 900)],
    variants: [
      { id: 'v1', name: '9', options: { size: '9' }, price: usd(32000), inStock: true },
      { id: 'v2', name: '10', options: { size: '10' }, price: usd(32000), inStock: true },
    ],
    rating: { value: 4.7, count: 63 },
  },
  {
    id: 'p-fa-5', slug: 'knit-sweater', title: 'Merino Crew Sweater', subtitle: 'Oat',
    description: 'Mid-weight merino in a clean crew silhouette. Year-round layer.',
    brand: 'Atelier Nord', categoryIds: ['c-fa-1', 'c-fa-2'],
    images: [img('1576566588028-4147f3842f27', 'Merino sweater', 900)],
    variants: [
      { id: 'v1', name: 'S', options: { size: 'S' }, price: usd(14500), inStock: true },
      { id: 'v2', name: 'M', options: { size: 'M' }, price: usd(14500), inStock: true },
    ],
    rating: { value: 4.5, count: 210 }, tags: ['knitwear'],
  },
  {
    id: 'p-fa-6', slug: 'canvas-tote', title: 'Heavy Canvas Tote', subtitle: 'Natural',
    description: '20oz canvas, leather handles, brass hardware.',
    brand: 'Maison Vela', categoryIds: ['c-fa-3'],
    images: [img('1544816155-12df9643f363', 'Canvas tote', 900)],
    variants: [{ id: 'v1', name: 'One size', options: {}, price: usd(7800), inStock: true }],
    rating: { value: 4.4, count: 156 },
  },
  // Electronics
  {
    id: 'p-el-1', slug: 'phone-x14', title: 'Aurora X14', subtitle: '5G smartphone',
    description: '6.7" OLED, 120Hz, triple 50MP camera, titanium frame.',
    brand: 'Aurora', categoryIds: ['c-el-1'],
    images: [img('1592750475338-74b7b21085ab', 'Aurora X14 phone', 900)],
    variants: [
      { id: 'v1', name: '256GB / Graphite', options: { storage: '256GB', color: 'Graphite' }, price: usd(89900), inStock: true },
      { id: 'v2', name: '512GB / Graphite', options: { storage: '512GB', color: 'Graphite' }, price: usd(99900), inStock: true },
    ],
    rating: { value: 4.7, count: 1820 }, badges: ['New'],
    attributes: { Display: '6.7" OLED 120Hz', Battery: '4800 mAh', Weight: '189 g', Chip: 'A-Series 9' },
  },
  {
    id: 'p-el-2', slug: 'laptop-pro-15', title: 'Volt Pro 15', subtitle: 'Creator laptop',
    description: '15.6" 3K mini-LED, 32GB RAM, 1TB SSD, all-day battery.',
    brand: 'Volt', categoryIds: ['c-el-2'],
    images: [img('1496181133206-80ce9b88a853', 'Volt Pro 15 laptop', 900)],
    variants: [{ id: 'v1', name: '32GB / 1TB', options: { ram: '32GB', storage: '1TB' }, price: usd(189900), inStock: true }],
    rating: { value: 4.8, count: 412 }, badges: ['Bestseller'],
    attributes: { Display: '15.6" 3K mini-LED', RAM: '32GB', Storage: '1TB NVMe', Battery: '18 hr' },
  },
  {
    id: 'p-el-3', slug: 'anc-headphones', title: 'Hush ANC Pro', subtitle: 'Wireless headphones',
    description: 'Industry-leading noise cancellation. 40-hour battery.',
    brand: 'Hush', categoryIds: ['c-el-3'],
    images: [img('1505740420928-5e560c06d30e', 'Hush headphones', 900)],
    variants: [
      { id: 'v1', name: 'Midnight', options: { color: 'Midnight' }, price: usd(34900), inStock: true },
      { id: 'v2', name: 'Pearl', options: { color: 'Pearl' }, price: usd(34900), inStock: true },
    ],
    rating: { value: 4.6, count: 904 },
    attributes: { Battery: '40 hr', Driver: '40mm', Codecs: 'LDAC, aptX HD' },
  },
  {
    id: 'p-el-4', slug: 'smart-watch-s5', title: 'Pulse S5', subtitle: 'Smart watch',
    description: 'ECG, SpO2, 7-day battery, sapphire crystal.',
    brand: 'Pulse', categoryIds: ['c-el-3'],
    images: [img('1523275335684-37898b6baf30', 'Pulse smart watch', 900)],
    variants: [{ id: 'v1', name: '44mm', options: { size: '44mm' }, price: usd(29900), inStock: true }],
    rating: { value: 4.5, count: 612 },
    attributes: { Display: 'AMOLED Always-on', Battery: '7 days', Water: '5 ATM' },
  },
  // Grocery
  {
    id: 'p-gr-1', slug: 'organic-bananas', title: 'Organic Bananas', subtitle: 'Bunch (~1 kg)',
    description: 'Fairtrade-certified organic bananas. Naturally ripened.',
    categoryIds: ['c-gr-1'], images: [img('1571771894821-ce9b6c11b08e', 'Bananas', 600)],
    variants: [{ id: 'v1', name: '1 kg', options: {}, price: usd(199), inStock: true }],
    badges: ['Organic'],
  },
  {
    id: 'p-gr-2', slug: 'sourdough-loaf', title: 'Sourdough Loaf', subtitle: 'Baked today',
    description: 'Naturally leavened, 36-hour ferment, stone-baked.',
    categoryIds: ['c-gr-2'], images: [img('1509440159596-0249088772ff', 'Sourdough loaf', 600)],
    variants: [{ id: 'v1', name: '800 g', options: {}, price: usd(599), inStock: true }],
  },
  {
    id: 'p-gr-3', slug: 'cold-brew', title: 'Cold Brew Coffee', subtitle: '1L bottle',
    description: 'Slow-steeped 18 hours, single-origin Ethiopian beans.',
    categoryIds: ['c-gr-3'], images: [img('1551024709-8f23befc6f87', 'Cold brew bottle', 600)],
    variants: [{ id: 'v1', name: '1L', options: {}, price: usd(799), inStock: true }],
    badges: ['New'],
  },
  {
    id: 'p-gr-4', slug: 'dark-chocolate', title: '70% Dark Chocolate', subtitle: 'Single origin',
    description: 'Ecuadorian cacao, bean-to-bar in small batches.',
    categoryIds: ['c-gr-4'], images: [img('1606312619070-d48b4c652a52', 'Dark chocolate bar', 600)],
    variants: [{ id: 'v1', name: '100 g', options: {}, price: usd(449), inStock: true }],
  },
  {
    id: 'p-gr-5', slug: 'olive-oil', title: 'Extra Virgin Olive Oil', subtitle: '500 ml',
    description: 'First cold-pressed Andalusian olives.',
    categoryIds: ['c-gr-3'], images: [img('1474979266404-7eaacbcd87c5', 'Olive oil bottle', 600)],
    variants: [{ id: 'v1', name: '500 ml', options: {}, price: usd(1499), inStock: true }],
  },
  {
    id: 'p-gr-6', slug: 'tomatoes', title: 'Heirloom Tomatoes', subtitle: '500 g',
    description: 'Mixed varieties, locally grown.',
    categoryIds: ['c-gr-1'], images: [img('1592924357228-91a4daadcfea', 'Heirloom tomatoes', 600)],
    variants: [{ id: 'v1', name: '500 g', options: {}, price: usd(399), inStock: true }],
  },
  // Restaurant
  {
    id: 'p-re-1', slug: 'burrata-toast', title: 'Burrata & Tomato Toast', subtitle: 'Starter',
    description: 'Sourdough, heirloom tomato, burrata, basil oil.',
    categoryIds: ['c-re-1'], images: [img('1565299624946-b28f40a0ae38', 'Burrata toast', 800)],
    variants: [{ id: 'v1', name: 'Single', options: {}, price: usd(1200), inStock: true }],
  },
  {
    id: 'p-re-2', slug: 'ribeye', title: '30-day Aged Ribeye', subtitle: 'Main',
    description: 'Grass-fed ribeye, smoked salt, bone marrow butter.',
    categoryIds: ['c-re-2'], images: [img('1546069901-ba9599a7e63c', 'Ribeye dish', 800)],
    variants: [{ id: 'v1', name: '350g', options: {}, price: usd(4200), inStock: true }],
    badges: ["Chef's pick"],
  },
  {
    id: 'p-re-3', slug: 'miso-cod', title: 'Miso Glazed Cod', subtitle: 'Main',
    description: 'Black cod marinated 48h, served with bok choy.',
    categoryIds: ['c-re-2'], images: [img('1467003909585-2f8a72700288', 'Miso cod plate', 800)],
    variants: [{ id: 'v1', name: 'Single', options: {}, price: usd(3400), inStock: true }],
  },
  {
    id: 'p-re-4', slug: 'tiramisu', title: 'Classic Tiramisu', subtitle: 'Dessert',
    description: 'Mascarpone, espresso, marsala, cocoa.',
    categoryIds: ['c-re-3'], images: [img('1551024506-0bccd828d307', 'Tiramisu', 800)],
    variants: [{ id: 'v1', name: 'Single', options: {}, price: usd(1100), inStock: true }],
  },
]

export const providers: ServiceProvider[] = [
  { id: 'pr-1', name: 'Mira Okafor', role: 'Senior Stylist', bio: '12 years of editorial styling.', avatar: img('1544005313-94ddf0286df2', 'Mira Okafor', 400) },
  { id: 'pr-2', name: 'Elias Tan', role: 'Color Specialist', bio: 'Balayage and dimensional color.', avatar: img('1531427186611-ecfd6d936c79', 'Elias Tan', 400) },
  { id: 'pr-3', name: 'Aiko Reyes', role: 'Barber', bio: 'Precision cuts and beard sculpting.', avatar: img('1500648767791-00dcc994a43e', 'Aiko Reyes', 400) },
]

export const services: ServiceItem[] = [
  { id: 's-1', slug: 'signature-cut', name: 'Signature Cut & Style', description: 'Consultation, cut, finish.', durationMinutes: 60, price: usd(8500), providerIds: ['pr-1', 'pr-3'], image: img('1560066984-138dadb4c035', 'Signature cut') },
  { id: 's-2', slug: 'color-treatment', name: 'Full Color Treatment', description: 'Custom color formulation and application.', durationMinutes: 120, price: usd(18000), providerIds: ['pr-2'], image: img('1522337360788-8b13dee7a37e', 'Color treatment') },
  { id: 's-3', slug: 'beard-sculpt', name: 'Beard Sculpt', description: 'Hot-towel shave and shape.', durationMinutes: 30, price: usd(4500), providerIds: ['pr-3'], image: img('1503951914875-452162b0f3f1', 'Beard sculpt') },
  { id: 's-4', slug: 'deep-conditioning', name: 'Deep Conditioning Mask', description: 'Restorative treatment for damaged hair.', durationMinutes: 45, price: usd(6500), providerIds: ['pr-1', 'pr-2'], image: img('1571689936114-b16146c9570a', 'Deep conditioning') },
]
