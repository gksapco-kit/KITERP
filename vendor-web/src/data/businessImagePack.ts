import { resolveCategoryStockImageUrl } from '@/data/categoryStockImages'

export interface BusinessImageCategory {
  id: string
  label: string
  description: string
  /** Sidebar grouping label */
  group: string
}

export interface BusinessImage {
  id: string
  categoryId: string
  filename: string
  /** Primary src — local generated pack under public/business-images. */
  url: string
  /** Remote stock fallback used if the local image is missing. */
  fallbackUrl: string
  label: string
}

const IMAGE_COUNT = 15

export const BUSINESS_IMAGE_CATEGORIES: BusinessImageCategory[] = [
  // General business pack
  {
    id: 'beauty',
    label: 'Beauty',
    description: 'Skincare, makeup, perfume, portraits, and store interiors',
    group: 'General Business',
  },
  {
    id: 'electronics',
    label: 'Electronics',
    description: 'Showrooms, phones, laptops, earbuds, smartwatches, and lifestyle',
    group: 'General Business',
  },
  {
    id: 'jewelry',
    label: 'Jewelry',
    description: 'Luxury interiors, rings, necklaces, hands, and displays',
    group: 'General Business',
  },
  {
    id: 'shop',
    label: 'Shop',
    description: 'Boutique storefronts, interiors, products, and lifestyle',
    group: 'General Business',
  },
  {
    id: 'store',
    label: 'Store',
    description: 'Retail interiors, displays, shoppers, and checkout',
    group: 'General Business',
  },
  {
    id: 'supermarket',
    label: 'Supermarket',
    description: 'Produce, aisles, bakery, deli, shoppers, and exteriors',
    group: 'General Business',
  },
  {
    id: 'wellness',
    label: 'Wellness & Grocery',
    description: 'Wholesome food, healthy snacks, organic groceries, and beverages',
    group: 'General Business',
  },
  // Retail & commerce pack
  {
    id: 'agricultural-supplies-store',
    label: 'Agricultural Supplies',
    description: 'Farm supply stores, seeds, tools, and rural retail',
    group: 'Retail & Commerce',
  },
  {
    id: 'book-store',
    label: 'Book Store',
    description: 'Bookshops, shelves, reading nooks, and literary interiors',
    group: 'Retail & Commerce',
  },
  {
    id: 'computer-store',
    label: 'Computer Store',
    description: 'PC showrooms, laptops, peripherals, and tech retail',
    group: 'Retail & Commerce',
  },
  {
    id: 'department-store',
    label: 'Department Store',
    description: 'Multi-floor retail, escalators, displays, and shoppers',
    group: 'Retail & Commerce',
  },
  {
    id: 'distributor',
    label: 'Distributor',
    description: 'Warehouses, pallets, logistics, and wholesale distribution',
    group: 'Retail & Commerce',
  },
  {
    id: 'ecommerce-seller',
    label: 'E-commerce Seller',
    description: 'Online retail, packaging, fulfillment, and digital commerce',
    group: 'Retail & Commerce',
  },
  {
    id: 'furniture-store',
    label: 'Furniture Store',
    description: 'Showrooms, sofas, dining sets, and home furnishings',
    group: 'Retail & Commerce',
  },
  {
    id: 'gift-shop',
    label: 'Gift Shop',
    description: 'Curated gifts, wrapping, seasonal displays, and souvenirs',
    group: 'Retail & Commerce',
  },
  {
    id: 'home-decor-store',
    label: 'Home Decor',
    description: 'Interiors, vases, textiles, and styled living spaces',
    group: 'Retail & Commerce',
  },
  {
    id: 'import-export',
    label: 'Import & Export',
    description: 'Shipping containers, cargo, customs, and global trade',
    group: 'Retail & Commerce',
  },
  {
    id: 'liquor-store',
    label: 'Liquor Store',
    description: 'Wine shelves, spirits displays, and beverage retail',
    group: 'Retail & Commerce',
  },
  {
    id: 'medical-equipment-store',
    label: 'Medical Equipment',
    description: 'Clinical devices, hospital supplies, and healthcare retail',
    group: 'Retail & Commerce',
  },
  {
    id: 'mobile-phone-store',
    label: 'Mobile Phone Store',
    description: 'Smartphone displays, accessories, and carrier retail',
    group: 'Retail & Commerce',
  },
  {
    id: 'optical-store',
    label: 'Optical Store',
    description: 'Eyewear displays, frames, fittings, and optometry retail',
    group: 'Retail & Commerce',
  },
  {
    id: 'pet-store',
    label: 'Pet Store',
    description: 'Pet supplies, grooming, aquariums, and animal care retail',
    group: 'Retail & Commerce',
  },
  {
    id: 'sports-goods-store',
    label: 'Sports Goods',
    description: 'Athletic gear, equipment, apparel, and fitness retail',
    group: 'Retail & Commerce',
  },
  {
    id: 'toy-store',
    label: 'Toy Store',
    description: 'Toy aisles, games, plush displays, and children\'s retail',
    group: 'Retail & Commerce',
  },
  {
    id: 'wholesale-trader',
    label: 'Wholesale Trader',
    description: 'Bulk goods, B2B trading floors, and wholesale operations',
    group: 'Retail & Commerce',
  },
  // Food & hospitality pack
  {
    id: 'banquet-hall',
    label: 'Banquet Hall',
    description: 'Wedding halls, table settings, stages, and grand event spaces',
    group: 'Food & Hospitality',
  },
  {
    id: 'bar-pub',
    label: 'Bar & Pub',
    description: 'Cocktail bars, beer flights, live music, and nightlife interiors',
    group: 'Food & Hospitality',
  },
  {
    id: 'catering-service',
    label: 'Catering Service',
    description: 'Buffets, canapés, plated courses, and event catering',
    group: 'Food & Hospitality',
  },
  {
    id: 'convention-center',
    label: 'Convention Center',
    description: 'Expo halls, keynotes, breakout rooms, and conference venues',
    group: 'Food & Hospitality',
  },
  {
    id: 'food-truck',
    label: 'Food Truck',
    description: 'Street food, festival queues, menus, and mobile kitchens',
    group: 'Food & Hospitality',
  },
  {
    id: 'homestay',
    label: 'Homestay',
    description: 'Guest rooms, host meals, gardens, and cozy lodging',
    group: 'Food & Hospitality',
  },
  {
    id: 'ice-cream-shop',
    label: 'Ice Cream Shop',
    description: 'Scoops, cones, parlour counters, and frozen treats',
    group: 'Food & Hospitality',
  },
  {
    id: 'juice-center',
    label: 'Juice Center',
    description: 'Fresh juices, smoothie bars, and healthy beverage counters',
    group: 'Food & Hospitality',
  },
  {
    id: 'lounge',
    label: 'Lounge',
    description: 'Rooftop lounges, ambient seating, and premium dining spaces',
    group: 'Food & Hospitality',
  },
  {
    id: 'mess-canteen',
    label: 'Mess & Canteen',
    description: 'Corporate canteens, cafeteria lines, and institutional dining',
    group: 'Food & Hospitality',
  },
  {
    id: 'resort',
    label: 'Resort',
    description: 'Poolside views, villas, spas, and luxury hospitality',
    group: 'Food & Hospitality',
  },
  {
    id: 'sweet-shop',
    label: 'Sweet Shop',
    description: 'Mithai displays, confectionery, and traditional sweet counters',
    group: 'Food & Hospitality',
  },
  // Healthcare pack
  {
    id: 'veterinary-clinic',
    label: 'Veterinary Clinic',
    description: 'Exam rooms, surgery suites, pet wellness, and clinic exteriors',
    group: 'Healthcare',
  },
  {
    id: 'nursing-home',
    label: 'Nursing Home',
    description: 'Senior care, assisted living, therapy, dining, and family visits',
    group: 'Healthcare',
  },
  {
    id: 'blood-bank',
    label: 'Blood Bank',
    description: 'Blood donation, collection, storage, and laboratory processing',
    group: 'Healthcare',
  },
  {
    id: 'physiotherapy-center',
    label: 'Physiotherapy Center',
    description: 'Rehabilitation, manual therapy, sports recovery, and exercise therapy',
    group: 'Healthcare',
  },
  {
    id: 'medical-laboratory',
    label: 'Medical Laboratory',
    description: 'Diagnostics, microscopy, analyzers, sample collection, and pathology',
    group: 'Healthcare',
  },
  {
    id: 'ambulance-service',
    label: 'Ambulance Service',
    description: 'Emergency response, paramedics, transport, and pre-hospital care',
    group: 'Healthcare',
  },
  {
    id: 'home-healthcare-service',
    label: 'Home Healthcare Service',
    description: 'In-home nursing, elder care, wound care, and patient monitoring',
    group: 'Healthcare',
  },
  {
    id: 'eye-hospital',
    label: 'Eye Hospital',
    description: 'Eye exams, ophthalmology, optical retail, and vision surgery suites',
    group: 'Healthcare',
  },
  {
    id: 'mental-health-center',
    label: 'Mental Health Center',
    description: 'Counseling, therapy sessions, wellness spaces, and group support',
    group: 'Healthcare',
  },
  // Professional services pack
  {
    id: 'auditor',
    label: 'Auditor',
    description: 'Audit firms, financial review, compliance, and assurance',
    group: 'Professional Services',
  },
  {
    id: 'business-consultant',
    label: 'Business Consultant',
    description: 'Strategy meetings, advisory, planning, and consulting',
    group: 'Professional Services',
  },
  {
    id: 'chartered-accountant',
    label: 'Chartered Accountant',
    description: 'Accounting firms, tax filing, ledgers, and financial advisory',
    group: 'Professional Services',
  },
  {
    id: 'corporate-services',
    label: 'Corporate Services',
    description: 'Company registration, compliance, and corporate advisory',
    group: 'Professional Services',
  },
  {
    id: 'hr-consultancy',
    label: 'HR Consultancy',
    description: 'Talent management, HR advisory, and workforce planning',
    group: 'Professional Services',
  },
  {
    id: 'legal-consultant',
    label: 'Legal Consultant',
    description: 'Law offices, legal advice, contracts, and consultations',
    group: 'Professional Services',
  },
  {
    id: 'market-research-agency',
    label: 'Market Research Agency',
    description: 'Surveys, data insights, analytics, and consumer research',
    group: 'Professional Services',
  },
  {
    id: 'recruitment-agency',
    label: 'Recruitment Agency',
    description: 'Hiring, interviews, staffing, and talent acquisition',
    group: 'Professional Services',
  },
  {
    id: 'tax-consultant',
    label: 'Tax Consultant',
    description: 'Tax planning, filing, advisory, and compliance services',
    group: 'Professional Services',
  },
  {
    id: 'translation-services',
    label: 'Translation Services',
    description: 'Language translation, localization, and interpretation',
    group: 'Professional Services',
  },
  // Technology & IT pack
  {
    id: 'ai-machine-learning-company',
    label: 'AI & Machine Learning',
    description: 'AI research, data science, ML models, and innovation labs',
    group: 'Technology & IT',
  },
  {
    id: 'bpo-call-center',
    label: 'BPO & Call Center',
    description: 'Customer support desks, headsets, and contact center floors',
    group: 'Technology & IT',
  },
  {
    id: 'cloud-services-provider',
    label: 'Cloud Services',
    description: 'Data centers, cloud infrastructure, and managed hosting',
    group: 'Technology & IT',
  },
  {
    id: 'cybersecurity-firm',
    label: 'Cybersecurity Firm',
    description: 'Security operations, threat monitoring, and data protection',
    group: 'Technology & IT',
  },
  {
    id: 'data-analytics-company',
    label: 'Data Analytics',
    description: 'Dashboards, big data, visualization, and business intelligence',
    group: 'Technology & IT',
  },
  {
    id: 'it-support-services',
    label: 'IT Support Services',
    description: 'Help desks, network support, and managed IT services',
    group: 'Technology & IT',
  },
  {
    id: 'mobile-app-development',
    label: 'Mobile App Development',
    description: 'App design, prototyping, coding, and mobile UX',
    group: 'Technology & IT',
  },
  {
    id: 'saas-provider',
    label: 'SaaS Provider',
    description: 'Cloud software, subscriptions, dashboards, and platforms',
    group: 'Technology & IT',
  },
  {
    id: 'software-company',
    label: 'Software Company',
    description: 'Development teams, coding, agile workflows, and tech offices',
    group: 'Technology & IT',
  },
  {
    id: 'web-development-company',
    label: 'Web Development Company',
    description: 'Web design, front-end coding, and digital agency studios',
    group: 'Technology & IT',
  },
  // Manufacturing & industrial pack
  {
    id: 'chemical-manufacturing',
    label: 'Chemical Manufacturing',
    description: 'Processing plants, reactors, lab testing, and production lines',
    group: 'Manufacturing & Industrial',
  },
  {
    id: 'electronics-manufacturing',
    label: 'Electronics Manufacturing',
    description: 'PCB assembly, circuit production, and electronics fabrication',
    group: 'Manufacturing & Industrial',
  },
  {
    id: 'engineering-works',
    label: 'Engineering Works',
    description: 'Fabrication, machining, welding, and industrial workshops',
    group: 'Manufacturing & Industrial',
  },
  {
    id: 'food-processing-unit',
    label: 'Food Processing Unit',
    description: 'Food production lines, packaging, and processing facilities',
    group: 'Manufacturing & Industrial',
  },
  {
    id: 'industrial-equipment-manufacturer',
    label: 'Industrial Equipment',
    description: 'Heavy machinery, assembly lines, and industrial production',
    group: 'Manufacturing & Industrial',
  },
  {
    id: 'packaging-unit',
    label: 'Packaging Unit',
    description: 'Packaging lines, cartons, labeling, and fulfillment',
    group: 'Manufacturing & Industrial',
  },
  {
    id: 'pharmaceutical-manufacturing',
    label: 'Pharmaceutical Manufacturing',
    description: 'Drug production, clean rooms, labs, and quality control',
    group: 'Manufacturing & Industrial',
  },
  {
    id: 'plastic-manufacturing',
    label: 'Plastic Manufacturing',
    description: 'Molding, extrusion, and plastic product fabrication',
    group: 'Manufacturing & Industrial',
  },
  {
    id: 'printing-press',
    label: 'Printing Press',
    description: 'Offset printing, presses, bindery, and print production',
    group: 'Manufacturing & Industrial',
  },
  {
    id: 'textile-manufacturing',
    label: 'Textile Manufacturing',
    description: 'Looms, fabric production, dyeing, and garment factories',
    group: 'Manufacturing & Industrial',
  },
  // Logistics & transport pack
  {
    id: 'bus-operator',
    label: 'Bus Operator',
    description: 'Bus fleets, terminals, passengers, and transit operations',
    group: 'Logistics & Transport',
  },
  {
    id: 'cargo-service',
    label: 'Cargo Service',
    description: 'Freight handling, warehouses, and cargo logistics',
    group: 'Logistics & Transport',
  },
  {
    id: 'courier-service',
    label: 'Courier Service',
    description: 'Parcel delivery, dispatch, and last-mile logistics',
    group: 'Logistics & Transport',
  },
  {
    id: 'fleet-management',
    label: 'Fleet Management',
    description: 'Vehicle tracking, fleet operations, and logistics control',
    group: 'Logistics & Transport',
  },
  {
    id: 'freight-forwarder',
    label: 'Freight Forwarder',
    description: 'Shipping coordination, customs, and global freight',
    group: 'Logistics & Transport',
  },
  {
    id: 'packers-movers',
    label: 'Packers & Movers',
    description: 'Relocation, packing, moving trucks, and household shifting',
    group: 'Logistics & Transport',
  },
  {
    id: 'shipping-agency',
    label: 'Shipping Agency',
    description: 'Ports, containers, vessels, and maritime logistics',
    group: 'Logistics & Transport',
  },
  {
    id: 'taxi-service',
    label: 'Taxi Service',
    description: 'Cabs, ride hailing, drivers, and city transport',
    group: 'Logistics & Transport',
  },
  {
    id: 'transport-company',
    label: 'Transport Company',
    description: 'Trucks, logistics fleets, and goods transportation',
    group: 'Logistics & Transport',
  },
  {
    id: 'trucking-service',
    label: 'Trucking Service',
    description: 'Long-haul trucks, freight, and road transport',
    group: 'Logistics & Transport',
  },
]

/** Display URL for gallery / layout previews (remote stock when local pack absent). */
function imageUrl(categoryId: string, index: number): string {
  return resolveCategoryStockImageUrl(categoryId, index)
}

/** Local asset path when the business-images pack is installed under public/. */
export function localBusinessImagePath(categoryId: string, index: number): string {
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
      url: localBusinessImagePath(cat.id, num),
      fallbackUrl: imageUrl(cat.id, num),
      label: `${cat.label} ${num}`,
    }
  }),
)

export const IMAGE_CATEGORY_GROUPS = [...new Set(BUSINESS_IMAGE_CATEGORIES.map((c) => c.group))]

export function categoriesInGroup(group: string): BusinessImageCategory[] {
  return BUSINESS_IMAGE_CATEGORIES.filter((c) => c.group === group)
}

export function imagesForCategory(categoryId: string): BusinessImage[] {
  return BUSINESS_IMAGES.filter((img) => img.categoryId === categoryId)
}

export function categoryById(categoryId: string): BusinessImageCategory | undefined {
  return BUSINESS_IMAGE_CATEGORIES.find((c) => c.id === categoryId)
}

export function totalImageCount(): number {
  return BUSINESS_IMAGES.length
}

function normalizeGalleryPath(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (trimmed.startsWith('/business-images')) return trimmed
  try {
    const parsed = new URL(trimmed, 'http://local')
    if (parsed.pathname.startsWith('/business-images')) return parsed.pathname
  } catch {
    // not a URL
  }
  const idx = trimmed.indexOf('/business-images/')
  if (idx >= 0) return trimmed.slice(idx)
  return trimmed
}

export function businessImageByGalleryUrl(url: string): BusinessImage | undefined {
  const normalized = normalizeGalleryPath(url)
  return BUSINESS_IMAGES.find((img) => img.url === normalized || img.url === url)
}

/** When the local `/business-images/` pack is missing, use the remote stock fallback for display/fetch. */
export function resolveBusinessGalleryDisplayUrl(url: string): string {
  const normalized = normalizeGalleryPath(url)
  if (!normalized.startsWith('/business-images')) return url
  return businessImageByGalleryUrl(normalized)?.fallbackUrl ?? url
}
