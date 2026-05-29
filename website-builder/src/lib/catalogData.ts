import type { BusinessCategory, CatalogProduct, CatalogService } from '../types/builder'

const productImages = {
  fashion: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400&q=80',
  electronics: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&q=80',
  food: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80',
  beauty: 'https://images.unsplash.com/photo-1596462502278-27bf403348ba?w=400&q=80',
  health: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&q=80',
  education: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&q=80',
  consulting: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&q=80',
  'real-estate': 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&q=80',
  fitness: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=80',
  other: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&q=80',
}

const serviceImages = {
  fashion: 'https://images.unsplash.com/photo-1487412947517-5cebf100ffc2?w=400&q=80',
  electronics: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=400&q=80',
  food: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80',
  beauty: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=80',
  health: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&q=80',
  education: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=400&q=80',
  consulting: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&q=80',
  'real-estate': 'https://images.unsplash.com/photo-1560520033-403a64d45713?w=400&q=80',
  fitness: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&q=80',
  other: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400&q=80',
}

const catalogByCategory: Record<BusinessCategory, { products: Omit<CatalogProduct, 'id'>[]; services: Omit<CatalogService, 'id'>[] }> = {
  fashion: {
    products: [
      { name: 'Classic Denim Jacket', price: 89, imageUrl: productImages.fashion, description: 'Timeless style for every season' },
      { name: 'Silk Scarf Collection', price: 45, imageUrl: productImages.fashion, description: 'Elegant patterns and premium fabric' },
      { name: 'Leather Crossbody Bag', price: 120, imageUrl: productImages.fashion, description: 'Handcrafted genuine leather' },
    ],
    services: [
      { name: 'Personal Styling Session', price: 150, duration: '2 hours', imageUrl: serviceImages.fashion, description: 'One-on-one wardrobe consultation' },
      { name: 'Custom Tailoring', price: 80, duration: '1 week', imageUrl: serviceImages.fashion, description: 'Perfect fit alterations' },
    ],
  },
  electronics: {
    products: [
      { name: 'Wireless Earbuds Pro', price: 129, imageUrl: productImages.electronics, description: 'Premium sound with noise cancellation' },
      { name: 'Smart Watch Series', price: 249, imageUrl: productImages.electronics, description: 'Track fitness and stay connected' },
      { name: 'Portable Charger 20K', price: 49, imageUrl: productImages.electronics, description: 'Fast charging on the go' },
    ],
    services: [
      { name: 'Device Setup & Training', price: 75, duration: '1 hour', imageUrl: serviceImages.electronics, description: 'Get your devices running smoothly' },
      { name: 'Tech Support Plan', price: 199, duration: 'Monthly', imageUrl: serviceImages.electronics, description: 'Priority support for all devices' },
    ],
  },
  food: {
    products: [
      { name: 'Gourmet Gift Box', price: 65, imageUrl: productImages.food, description: 'Curated selection of artisan treats' },
      { name: 'House Spice Blend Set', price: 28, imageUrl: productImages.food, description: 'Signature flavors from our kitchen' },
      { name: 'Fresh Baked Bread Loaf', price: 8, imageUrl: productImages.food, description: 'Baked daily with organic flour' },
    ],
    services: [
      { name: 'Private Dining Experience', price: 350, duration: '3 hours', imageUrl: serviceImages.food, description: 'Exclusive chef-prepared meal' },
      { name: 'Catering Package', price: 500, duration: 'Per event', imageUrl: serviceImages.food, description: 'Full-service event catering' },
    ],
  },
  beauty: {
    products: [
      { name: 'Hydrating Skincare Set', price: 78, imageUrl: productImages.beauty, description: 'Complete daily skincare routine' },
      { name: 'Luxury Lipstick Trio', price: 55, imageUrl: productImages.beauty, description: 'Long-lasting vibrant colors' },
      { name: 'Aromatherapy Candle', price: 32, imageUrl: productImages.beauty, description: 'Relaxing natural scents' },
    ],
    services: [
      { name: 'Signature Facial', price: 95, duration: '60 min', imageUrl: serviceImages.beauty, description: 'Deep cleanse and rejuvenation' },
      { name: 'Hair Styling & Cut', price: 65, duration: '45 min', imageUrl: serviceImages.beauty, description: 'Expert cut and blowout' },
    ],
  },
  health: {
    products: [
      { name: 'Vitamin Wellness Pack', price: 42, imageUrl: productImages.health, description: 'Essential daily supplements' },
      { name: 'Organic Tea Collection', price: 24, imageUrl: productImages.health, description: 'Herbal blends for wellness' },
      { name: 'Fitness Recovery Kit', price: 58, imageUrl: productImages.health, description: 'Foam roller and massage tools' },
    ],
    services: [
      { name: 'Health Consultation', price: 120, duration: '45 min', imageUrl: serviceImages.health, description: 'Personalized wellness assessment' },
      { name: 'Therapy Session', price: 150, duration: '50 min', imageUrl: serviceImages.health, description: 'Licensed professional counseling' },
    ],
  },
  education: {
    products: [
      { name: 'Study Guide Bundle', price: 35, imageUrl: productImages.education, description: 'Comprehensive learning materials' },
      { name: 'Online Course Access', price: 99, imageUrl: productImages.education, description: 'Lifetime access to video lessons' },
      { name: 'Workbook & Planner', price: 22, imageUrl: productImages.education, description: 'Structured learning tracker' },
    ],
    services: [
      { name: 'Private Tutoring', price: 60, duration: '1 hour', imageUrl: serviceImages.education, description: 'One-on-one expert instruction' },
      { name: 'Career Coaching', price: 200, duration: '90 min', imageUrl: serviceImages.education, description: 'Resume and interview prep' },
    ],
  },
  consulting: {
    products: [
      { name: 'Business Toolkit', price: 149, imageUrl: productImages.consulting, description: 'Templates and frameworks' },
      { name: 'Strategy Playbook', price: 79, imageUrl: productImages.consulting, description: 'Step-by-step growth guide' },
      { name: 'Market Research Report', price: 299, imageUrl: productImages.consulting, description: 'Industry insights and analysis' },
    ],
    services: [
      { name: 'Strategy Consultation', price: 250, duration: '2 hours', imageUrl: serviceImages.consulting, description: 'Business growth planning session' },
      { name: 'Monthly Advisory Retainer', price: 1500, duration: 'Monthly', imageUrl: serviceImages.consulting, description: 'Ongoing expert guidance' },
    ],
  },
  'real-estate': {
    products: [
      { name: 'Home Staging Kit', price: 199, imageUrl: productImages['real-estate'], description: 'Professional staging essentials' },
      { name: 'Property Guide Book', price: 29, imageUrl: productImages['real-estate'], description: 'Local market buyer guide' },
    ],
    services: [
      { name: 'Property Valuation', price: 350, duration: '2 hours', imageUrl: serviceImages['real-estate'], description: 'Accurate market assessment' },
      { name: 'Buyer Representation', price: 0, duration: 'Full service', imageUrl: serviceImages['real-estate'], description: 'Expert negotiation and support' },
    ],
  },
  fitness: {
    products: [
      { name: 'Resistance Band Set', price: 35, imageUrl: productImages.fitness, description: 'Full body workout bands' },
      { name: 'Protein Shake Mix', price: 48, imageUrl: productImages.fitness, description: 'Plant-based recovery nutrition' },
      { name: 'Yoga Mat Premium', price: 55, imageUrl: productImages.fitness, description: 'Non-slip eco-friendly mat' },
    ],
    services: [
      { name: 'Personal Training', price: 75, duration: '1 hour', imageUrl: serviceImages.fitness, description: 'Customized workout program' },
      { name: 'Group Fitness Class', price: 25, duration: '45 min', imageUrl: serviceImages.fitness, description: 'High-energy group sessions' },
    ],
  },
  other: {
    products: [
      { name: 'Starter Product', price: 49, imageUrl: productImages.other, description: 'Our most popular offering' },
      { name: 'Premium Bundle', price: 99, imageUrl: productImages.other, description: 'Best value package deal' },
      { name: 'Gift Card', price: 50, imageUrl: productImages.other, description: 'Perfect for any occasion' },
    ],
    services: [
      { name: 'Consultation Call', price: 50, duration: '30 min', imageUrl: serviceImages.other, description: 'Discuss your needs with us' },
      { name: 'Premium Service', price: 150, duration: '2 hours', imageUrl: serviceImages.other, description: 'Full-service experience' },
    ],
  },
}

export function createCatalogForCategory(category: BusinessCategory) {
  const data = catalogByCategory[category]
  return {
    products: data.products.map((p, i) => ({ ...p, id: `prod-${category}-${i}` })),
    services: data.services.map((s, i) => ({ ...s, id: `svc-${category}-${i}` })),
  }
}
