import { v4 as uuid } from 'uuid'
import { createBlockFromType } from './blockRegistry'
import type { Block, BusinessCategory, BusinessType, SiteConfig } from '../types/builder'
import { buildNavItems, footerBlock, navbarBlock } from './pageTemplates'

export interface WebsiteTemplate {
  id: string
  name: string
  description: string
  category: BusinessCategory
  businessTypes: BusinessType[]
  preview: { gradient: string; emoji: string }
  popular?: boolean
}

interface HomeContent {
  hero: {
    text: string
    subtitle: string
    buttonText: string
    styles: Block['styles']
  }
  features?: {
    text: string
    items: { title: string; description: string }[]
    styles?: Block['styles']
  }
  testimonial?: {
    quote: string
    author: string
    role: string
    styles?: Block['styles']
  }
  cta?: {
    text: string
    subtitle: string
    buttonText: string
    styles?: Block['styles']
  }
  extras?: (config: SiteConfig) => Block[]
}

export const websiteTemplates: WebsiteTemplate[] = [
  // Fashion
  { id: 'fashion-boutique', name: 'Boutique Elegance', description: 'Luxury fashion with dark hero and refined layout', category: 'fashion', businessTypes: ['products', 'both'], preview: { gradient: 'from-gray-900 to-rose-900', emoji: '👗' }, popular: true },
  { id: 'fashion-minimal', name: 'Minimal Lookbook', description: 'Clean white layout for modern apparel brands', category: 'fashion', businessTypes: ['products', 'both'], preview: { gradient: 'from-stone-100 to-stone-300', emoji: '✨' } },
  // Electronics
  { id: 'tech-store', name: 'Tech Store Pro', description: 'Bold blue theme for gadgets and electronics', category: 'electronics', businessTypes: ['products', 'both'], preview: { gradient: 'from-blue-600 to-indigo-800', emoji: '📱' }, popular: true },
  { id: 'tech-launch', name: 'Product Launch', description: 'Highlight new releases and key specs', category: 'electronics', businessTypes: ['products', 'both'], preview: { gradient: 'from-slate-800 to-cyan-600', emoji: '🚀' } },
  // Food
  { id: 'restaurant-classic', name: 'Fine Dining', description: 'Warm, appetizing design for restaurants', category: 'food', businessTypes: ['products', 'services', 'both'], preview: { gradient: 'from-amber-700 to-orange-900', emoji: '🍽️' }, popular: true },
  { id: 'cafe-cozy', name: 'Cozy Café', description: 'Friendly café or bakery with inviting feel', category: 'food', businessTypes: ['products', 'services', 'both'], preview: { gradient: 'from-amber-100 to-orange-200', emoji: '☕' } },
  // Beauty
  { id: 'salon-luxury', name: 'Luxury Salon', description: 'Spa and salon with soft pink accents', category: 'beauty', businessTypes: ['services', 'both'], preview: { gradient: 'from-pink-200 to-rose-400', emoji: '💄' }, popular: true },
  { id: 'beauty-shop', name: 'Beauty Shop', description: 'Cosmetics store with product-focused hero', category: 'beauty', businessTypes: ['products', 'both'], preview: { gradient: 'from-fuchsia-500 to-purple-700', emoji: '💅' } },
  // Health
  { id: 'wellness-clinic', name: 'Wellness Clinic', description: 'Calm, trustworthy health services layout', category: 'health', businessTypes: ['services', 'both'], preview: { gradient: 'from-teal-500 to-emerald-700', emoji: '🏥' }, popular: true },
  { id: 'health-store', name: 'Health & Nutrition', description: 'Products for supplements and wellness', category: 'health', businessTypes: ['products', 'both'], preview: { gradient: 'from-green-400 to-teal-600', emoji: '🌿' } },
  // Education
  { id: 'online-academy', name: 'Online Academy', description: 'Courses and learning with clear CTAs', category: 'education', businessTypes: ['services', 'products', 'both'], preview: { gradient: 'from-indigo-500 to-blue-700', emoji: '📚' }, popular: true },
  { id: 'tutoring-center', name: 'Tutoring Center', description: 'Personal coaching and tutoring services', category: 'education', businessTypes: ['services', 'both'], preview: { gradient: 'from-violet-500 to-purple-700', emoji: '🎓' } },
  // Consulting
  { id: 'agency-pro', name: 'Agency Pro', description: 'Professional consulting with pricing section', category: 'consulting', businessTypes: ['services', 'both'], preview: { gradient: 'from-slate-700 to-slate-900', emoji: '💼' }, popular: true },
  { id: 'startup-consult', name: 'Startup Advisor', description: 'Modern layout for business consultants', category: 'consulting', businessTypes: ['services', 'both'], preview: { gradient: 'from-brand-600 to-indigo-800', emoji: '📈' } },
  // Real estate
  { id: 'property-showcase', name: 'Property Showcase', description: 'Listings-focused real estate layout', category: 'real-estate', businessTypes: ['services', 'both'], preview: { gradient: 'from-sky-600 to-blue-900', emoji: '🏠' }, popular: true },
  { id: 'luxury-estates', name: 'Luxury Estates', description: 'High-end properties with premium feel', category: 'real-estate', businessTypes: ['services', 'both'], preview: { gradient: 'from-amber-800 to-stone-900', emoji: '🏛️' } },
  // Fitness
  { id: 'gym-power', name: 'Power Gym', description: 'High-energy fitness and gym template', category: 'fitness', businessTypes: ['products', 'services', 'both'], preview: { gradient: 'from-red-600 to-orange-700', emoji: '💪' }, popular: true },
  { id: 'yoga-studio', name: 'Yoga Studio', description: 'Peaceful wellness and yoga services', category: 'fitness', businessTypes: ['services', 'both'], preview: { gradient: 'from-lime-400 to-teal-500', emoji: '🧘' } },
  // Other
  { id: 'business-starter', name: 'Business Starter', description: 'Versatile template for any business', category: 'other', businessTypes: ['products', 'services', 'both'], preview: { gradient: 'from-brand-500 to-indigo-600', emoji: '🌟' }, popular: true },
  { id: 'creative-bold', name: 'Creative Bold', description: 'Eye-catching layout for unique brands', category: 'other', businessTypes: ['products', 'services', 'both'], preview: { gradient: 'from-purple-600 to-pink-600', emoji: '🎨' } },
]

const homeContentByTemplate: Record<string, (config: SiteConfig) => HomeContent> = {
  'fashion-boutique': (c) => ({
    hero: {
      text: `${c.businessName} — Timeless Style`,
      subtitle: 'Discover curated collections crafted for the modern wardrobe.',
      buttonText: 'Shop Collection',
      styles: { backgroundColor: '#1a1a2e', textColor: '#ffffff', textAlign: 'center', padding: '100px 32px', borderRadius: '0', margin: '0 0 24px' },
    },
    features: {
      text: 'The Boutique Difference',
      items: [
        { title: 'Premium Quality', description: 'Handpicked fabrics and expert craftsmanship in every piece.' },
        { title: 'Free Returns', description: '30-day hassle-free returns on all orders.' },
        { title: 'New Arrivals Weekly', description: 'Fresh styles added every week — stay ahead of trends.' },
      ],
      styles: { padding: '56px 24px', textAlign: 'center', margin: '0 0 24px', backgroundColor: '#fafafa' },
    },
    testimonial: {
      quote: 'The quality and style exceeded my expectations. My go-to boutique for every season.',
      author: 'Emma Richardson',
      role: 'Fashion Enthusiast',
      styles: { padding: '48px 32px', backgroundColor: '#1a1a2e', textColor: '#e5e5e5', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' },
    },
    cta: {
      text: 'Join Our Style Club',
      subtitle: 'Get 15% off your first order and early access to new collections.',
      buttonText: 'Shop Now',
      styles: { backgroundColor: '#4f46e5', textColor: '#ffffff', padding: '56px 32px', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' },
    },
  }),
  'fashion-minimal': (c) => ({
    hero: {
      text: c.businessName,
      subtitle: 'Essential pieces. Thoughtful design. Nothing more.',
      buttonText: 'Explore',
      styles: { backgroundColor: '#fafafa', textColor: '#111827', textAlign: 'center', padding: '120px 32px', margin: '0 0 24px' },
    },
    features: {
      text: 'Our Philosophy',
      items: [
        { title: 'Less is More', description: 'Curated essentials that work together seamlessly.' },
        { title: 'Sustainable', description: 'Ethically sourced materials and responsible production.' },
        { title: 'Made to Last', description: 'Timeless pieces designed for years of wear.' },
      ],
    },
    cta: {
      text: 'New Season Available',
      subtitle: 'Shop the latest collection online or visit our showroom.',
      buttonText: 'View Collection',
      styles: { backgroundColor: '#111827', textColor: '#fff', padding: '48px', textAlign: 'center', borderRadius: '0', margin: '0 0 24px' },
    },
  }),
  'tech-store': (c) => ({
    hero: {
      text: 'Next-Gen Tech at ' + c.businessName,
      subtitle: 'Premium gadgets, unbeatable prices, and expert support.',
      buttonText: 'Shop Tech',
      styles: { backgroundColor: '#1e40af', textColor: '#ffffff', textAlign: 'center', padding: '90px 32px', borderRadius: '16px', margin: '0 0 24px' },
    },
    features: {
      text: 'Why Shop With Us',
      items: [
        { title: 'Latest Products', description: 'Always stocked with the newest releases and bestsellers.' },
        { title: '2-Year Warranty', description: 'Extended warranty on all electronics purchases.' },
        { title: 'Expert Support', description: '24/7 technical support from certified specialists.' },
      ],
    },
    testimonial: {
      quote: 'Fast shipping, genuine products, and amazing customer service. Highly recommend!',
      author: 'David Chen',
      role: 'Tech Reviewer',
    },
    cta: {
      text: 'Flash Sale — Up to 40% Off',
      subtitle: 'Limited time deals on headphones, laptops, and accessories.',
      buttonText: 'Shop Deals',
      styles: { backgroundColor: '#0f172a', textColor: '#fff', padding: '48px', textAlign: 'center', borderRadius: '12px', margin: '0 0 24px' },
    },
  }),
  'tech-launch': (c) => ({
    hero: {
      text: 'The Future is Here',
      subtitle: `${c.businessName} brings you breakthrough technology at launch-day prices.`,
      buttonText: 'Pre-Order Now',
      styles: { backgroundColor: '#0f172a', textColor: '#22d3ee', textAlign: 'center', padding: '100px 32px', margin: '0 0 24px' },
    },
    features: {
      text: 'Launch Highlights',
      items: [
        { title: 'All-Day Battery', description: 'Up to 48 hours of continuous use on a single charge.' },
        { title: 'AI Powered', description: 'Smart features that learn and adapt to your workflow.' },
        { title: 'Launch Bundle', description: 'Save 25% when you pre-order the complete package.' },
      ],
      styles: { backgroundColor: '#f8fafc', padding: '48px 24px', textAlign: 'center', margin: '0 0 24px' },
    },
    cta: { text: 'Be First to Own It', subtitle: 'Pre-orders ship within 2 weeks. Limited quantities.', buttonText: 'Reserve Yours', styles: { backgroundColor: '#06b6d4', textColor: '#0f172a', padding: '48px', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' } },
  }),
  'restaurant-classic': (c) => ({
    hero: {
      text: `Welcome to ${c.businessName}`,
      subtitle: 'An unforgettable dining experience with locally sourced ingredients.',
      buttonText: 'Reserve a Table',
      styles: { backgroundColor: '#92400e', textColor: '#fff', textAlign: 'center', padding: '100px 32px', borderRadius: '16px', margin: '0 0 24px' },
    },
    features: {
      text: 'Our Promise',
      items: [
        { title: 'Farm to Table', description: 'Fresh ingredients sourced from local farms daily.' },
        { title: 'Award-Winning Chef', description: 'Crafted by our head chef with 20 years of experience.' },
        { title: 'Private Events', description: 'Host your celebration in our private dining room.' },
      ],
      styles: { padding: '48px', textAlign: 'center', backgroundColor: '#fffbeb', margin: '0 0 24px' },
    },
    testimonial: {
      quote: 'Every dish was a masterpiece. The ambiance and service were absolutely perfect.',
      author: 'Maria Santos',
      role: 'Food Critic',
      styles: { backgroundColor: '#fef3c7', padding: '40px', textAlign: 'center', borderRadius: '12px', margin: '0 0 24px' },
    },
    cta: { text: 'Book Your Table Tonight', subtitle: 'Open daily 11am–11pm. Walk-ins welcome.', buttonText: 'Make Reservation', styles: { backgroundColor: '#b45309', textColor: '#fff', padding: '48px', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' } },
  }),
  'cafe-cozy': (c) => ({
    hero: {
      text: c.businessName,
      subtitle: 'Freshly brewed coffee, homemade pastries, and good vibes.',
      buttonText: 'View Menu',
      styles: { backgroundColor: '#fef3c7', textColor: '#78350f', textAlign: 'center', padding: '80px 32px', borderRadius: '24px', margin: '0 0 24px' },
    },
    features: {
      text: 'What We Serve',
      items: [
        { title: 'Artisan Coffee', description: 'Single-origin beans roasted in-house every morning.' },
        { title: 'Fresh Pastries', description: 'Baked daily — croissants, muffins, and seasonal treats.' },
        { title: 'Cozy Space', description: 'Free WiFi, comfortable seating, and a welcoming atmosphere.' },
      ],
    },
    cta: { text: 'Visit Us Today', subtitle: 'Mon–Fri 7am–6pm · Sat–Sun 8am–5pm', buttonText: 'Get Directions', styles: { backgroundColor: '#d97706', textColor: '#fff', padding: '40px', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' } },
  }),
  'salon-luxury': (c) => ({
    hero: {
      text: 'Indulge at ' + c.businessName,
      subtitle: 'Premium beauty treatments in a tranquil, luxurious setting.',
      buttonText: 'Book Appointment',
      styles: { backgroundColor: '#fce7f3', textColor: '#831843', textAlign: 'center', padding: '90px 32px', borderRadius: '20px', margin: '0 0 24px' },
    },
    features: {
      text: 'Our Services',
      items: [
        { title: 'Signature Facials', description: 'Customized treatments for radiant, healthy skin.' },
        { title: 'Hair Styling', description: 'Cuts, color, and styling by award-winning stylists.' },
        { title: 'Spa Packages', description: 'Full-day relaxation packages for the ultimate escape.' },
      ],
      styles: { padding: '48px', textAlign: 'center', backgroundColor: '#fdf2f8', margin: '0 0 24px' },
    },
    testimonial: { quote: 'I left feeling like a completely new person. The staff is incredible.', author: 'Jessica Lane', role: 'Regular Client' },
    cta: { text: 'First Visit Special — 20% Off', subtitle: 'Book any service this month and save.', buttonText: 'Book Now', styles: { backgroundColor: '#be185d', textColor: '#fff', padding: '48px', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' } },
  }),
  'beauty-shop': (c) => ({
    hero: {
      text: 'Glow Up with ' + c.businessName,
      subtitle: 'Premium skincare, makeup, and beauty essentials delivered to your door.',
      buttonText: 'Shop Beauty',
      styles: { backgroundColor: '#a855f7', textColor: '#fff', textAlign: 'center', padding: '90px 32px', borderRadius: '16px', margin: '0 0 24px' },
    },
    features: {
      text: 'Beauty Favorites',
      items: [
        { title: 'Clean Beauty', description: 'Cruelty-free, paraben-free products you can trust.' },
        { title: 'Expert Picks', description: 'Curated collections by licensed estheticians.' },
        { title: 'Free Samples', description: 'Try before you buy with every order over $50.' },
      ],
    },
    cta: { text: 'Summer Beauty Sale', subtitle: 'Up to 30% off bestsellers this week only.', buttonText: 'Shop Sale', styles: { backgroundColor: '#7c3aed', textColor: '#fff', padding: '48px', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' } },
  }),
  'wellness-clinic': (c) => ({
    hero: {
      text: 'Your Health, Our Priority',
      subtitle: `${c.businessName} provides compassionate care for mind and body.`,
      buttonText: 'Book Consultation',
      styles: { backgroundColor: '#0d9488', textColor: '#fff', textAlign: 'center', padding: '90px 32px', borderRadius: '16px', margin: '0 0 24px' },
    },
    features: {
      text: 'Comprehensive Care',
      items: [
        { title: 'Holistic Approach', description: 'Treat the whole person — physical, mental, and emotional wellness.' },
        { title: 'Licensed Experts', description: 'Board-certified practitioners with decades of experience.' },
        { title: 'Flexible Scheduling', description: 'Same-week appointments and telehealth options available.' },
      ],
      styles: { padding: '48px', textAlign: 'center', backgroundColor: '#f0fdfa', margin: '0 0 24px' },
    },
    testimonial: { quote: 'They truly listen and create personalized care plans. I feel healthier than ever.', author: 'Robert Kim', role: 'Patient since 2022' },
    cta: { text: 'Schedule Your Wellness Check', subtitle: 'New patients receive a complimentary initial consultation.', buttonText: 'Get Started', styles: { backgroundColor: '#115e59', textColor: '#fff', padding: '48px', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' } },
  }),
  'health-store': (c) => ({
    hero: {
      text: 'Natural Wellness at ' + c.businessName,
      subtitle: 'Vitamins, supplements, and organic products for a healthier you.',
      buttonText: 'Shop Wellness',
      styles: { backgroundColor: '#16a34a', textColor: '#fff', textAlign: 'center', padding: '90px 32px', borderRadius: '16px', margin: '0 0 24px' },
    },
    features: {
      text: 'Shop by Goal',
      items: [
        { title: 'Immunity', description: 'Boost your defenses with proven natural supplements.' },
        { title: 'Energy & Focus', description: 'Plant-based formulas for sustained mental clarity.' },
        { title: 'Sleep & Recovery', description: 'Rest better with our curated sleep support line.' },
      ],
    },
    cta: { text: 'Subscribe & Save 15%', subtitle: 'Monthly wellness boxes tailored to your goals.', buttonText: 'Start Subscription', styles: { backgroundColor: '#14532d', textColor: '#fff', padding: '48px', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' } },
  }),
  'online-academy': (c) => ({
    hero: {
      text: 'Learn Without Limits',
      subtitle: `${c.businessName} — expert-led courses you can take anywhere, anytime.`,
      buttonText: 'Browse Courses',
      styles: { backgroundColor: '#4338ca', textColor: '#fff', textAlign: 'center', padding: '90px 32px', borderRadius: '16px', margin: '0 0 24px' },
    },
    features: {
      text: 'Why Students Choose Us',
      items: [
        { title: 'Expert Instructors', description: 'Learn from industry professionals with real-world experience.' },
        { title: 'Lifetime Access', description: 'Enroll once and revisit course materials forever.' },
        { title: 'Certificates', description: 'Earn recognized certificates to boost your career.' },
      ],
    },
    testimonial: { quote: 'The courses transformed my career. Clear, practical, and incredibly valuable.', author: 'Alex Turner', role: 'Graduate' },
    cta: { text: 'Enroll Today — 30% Off', subtitle: 'Limited-time discount on all foundational courses.', buttonText: 'Start Learning', styles: { backgroundColor: '#312e81', textColor: '#fff', padding: '48px', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' } },
  }),
  'tutoring-center': (c) => ({
    hero: {
      text: `${c.businessName} — Unlock Your Potential`,
      subtitle: 'Personalized tutoring for students of all ages and skill levels.',
      buttonText: 'Book a Session',
      styles: { backgroundColor: '#7c3aed', textColor: '#fff', textAlign: 'center', padding: '90px 32px', borderRadius: '16px', margin: '0 0 24px' },
    },
    features: {
      text: 'How We Help',
      items: [
        { title: '1-on-1 Tutoring', description: 'Personalized attention tailored to your learning style.' },
        { title: 'All Subjects', description: 'Math, science, languages, test prep, and more.' },
        { title: 'Flexible Hours', description: 'After-school, weekend, and online sessions available.' },
      ],
    },
    cta: { text: 'Free Assessment Session', subtitle: 'Discover your strengths and areas for growth — on us.', buttonText: 'Book Free Session', styles: { backgroundColor: '#5b21b6', textColor: '#fff', padding: '48px', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' } },
  }),
  'agency-pro': (c) => ({
    hero: {
      text: 'Strategy That Delivers Results',
      subtitle: `${c.businessName} partners with ambitious businesses to drive measurable growth.`,
      buttonText: 'Schedule a Call',
      styles: { backgroundColor: '#1e293b', textColor: '#fff', textAlign: 'center', padding: '100px 32px', margin: '0 0 24px' },
    },
    features: {
      text: 'Our Expertise',
      items: [
        { title: 'Business Strategy', description: 'Data-driven roadmaps for sustainable growth.' },
        { title: 'Operations', description: 'Streamline processes and maximize efficiency.' },
        { title: 'Digital Transformation', description: 'Modernize your business for the digital age.' },
      ],
      styles: { padding: '48px', textAlign: 'center', margin: '0 0 24px' },
    },
    extras: () => {
      const pricing = createBlockFromType('pricingTable', uuid())
      pricing.props.text = 'Engagement Plans'
      return [pricing]
    },
    testimonial: { quote: 'Their insights helped us double revenue in 12 months. True partners, not just consultants.', author: 'James Wright', role: 'CEO, TechVentures' },
    cta: { text: 'Ready to Transform Your Business?', subtitle: 'Book a free 30-minute strategy session with our team.', buttonText: 'Book Consultation', styles: { backgroundColor: '#4f46e5', textColor: '#fff', padding: '48px', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' } },
  }),
  'startup-consult': (c) => ({
    hero: {
      text: 'Scale Your Startup Faster',
      subtitle: `${c.businessName} — mentorship and strategy for founders who move fast.`,
      buttonText: 'Get Started',
      styles: { backgroundColor: '#4f46e5', textColor: '#fff', textAlign: 'center', padding: '90px 32px', borderRadius: '16px', margin: '0 0 24px' },
    },
    features: {
      text: 'For Founders',
      items: [
        { title: 'Pitch Deck Review', description: 'Polish your story and impress investors.' },
        { title: 'Go-to-Market', description: 'Launch strategies that acquire customers fast.' },
        { title: 'Fundraising Prep', description: 'Get investor-ready with our proven frameworks.' },
      ],
    },
    cta: { text: 'Join 200+ Startups We\'ve Helped', subtitle: 'From idea to Series A — we\'ve been there.', buttonText: 'Apply Now', styles: { backgroundColor: '#312e81', textColor: '#fff', padding: '48px', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' } },
  }),
  'property-showcase': (c) => ({
    hero: {
      text: 'Find Your Dream Home',
      subtitle: `${c.businessName} — trusted real estate experts in your neighborhood.`,
      buttonText: 'View Listings',
      styles: { backgroundColor: '#0369a1', textColor: '#fff', textAlign: 'center', padding: '100px 32px', borderRadius: '16px', margin: '0 0 24px' },
    },
    features: {
      text: 'Why Work With Us',
      items: [
        { title: 'Local Experts', description: 'Deep knowledge of neighborhoods, schools, and market trends.' },
        { title: 'Full Service', description: 'Buying, selling, and renting — we handle it all.' },
        { title: 'No Hidden Fees', description: 'Transparent pricing and honest communication always.' },
      ],
      styles: { padding: '48px', textAlign: 'center', backgroundColor: '#f0f9ff', margin: '0 0 24px' },
    },
    testimonial: { quote: 'They found us the perfect home within two weeks. Professional and caring throughout.', author: 'The Martinez Family', role: 'Home Buyers' },
    cta: { text: 'Free Home Valuation', subtitle: 'Find out what your property is worth in today\'s market.', buttonText: 'Get Valuation', styles: { backgroundColor: '#0c4a6e', textColor: '#fff', padding: '48px', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' } },
  }),
  'luxury-estates': (c) => ({
    hero: {
      text: 'Exceptional Properties',
      subtitle: 'Exclusive estates and luxury homes curated by ' + c.businessName,
      buttonText: 'Explore Estates',
      styles: { backgroundColor: '#292524', textColor: '#fcd34d', textAlign: 'center', padding: '110px 32px', margin: '0 0 24px' },
    },
    features: {
      text: 'The Luxury Standard',
      items: [
        { title: 'Private Listings', description: 'Access off-market properties not available elsewhere.' },
        { title: 'White Glove Service', description: 'Concierge-level support from search to closing.' },
        { title: 'Global Network', description: 'International properties for discerning clients.' },
      ],
      styles: { padding: '56px', textAlign: 'center', backgroundColor: '#fafaf9', margin: '0 0 24px' },
    },
    cta: { text: 'Schedule a Private Viewing', subtitle: 'Discreet showings by appointment only.', buttonText: 'Contact Agent', styles: { backgroundColor: '#78350f', textColor: '#fef3c7', padding: '48px', textAlign: 'center', borderRadius: '8px', margin: '0 0 24px' } },
  }),
  'gym-power': (c) => ({
    hero: {
      text: 'UNLEASH YOUR POWER',
      subtitle: `${c.businessName} — state-of-the-art equipment, expert trainers, real results.`,
      buttonText: 'Start Free Trial',
      styles: { backgroundColor: '#dc2626', textColor: '#fff', textAlign: 'center', padding: '100px 32px', borderRadius: '8px', margin: '0 0 24px', fontWeight: '800' },
    },
    features: {
      text: 'Membership Benefits',
      items: [
        { title: '24/7 Access', description: 'Train on your schedule — we never close.' },
        { title: 'Personal Training', description: 'Certified trainers to maximize your results.' },
        { title: 'Group Classes', description: 'HIIT, yoga, spin, and more included free.' },
      ],
      styles: { padding: '48px', textAlign: 'center', backgroundColor: '#1f2937', textColor: '#f9fafb', margin: '0 0 24px' },
    },
    testimonial: { quote: 'Lost 30 pounds in 4 months. The trainers and community kept me motivated.', author: 'Mike Johnson', role: 'Member' },
    cta: { text: '7-Day Free Trial', subtitle: 'No commitment. Cancel anytime. Join today.', buttonText: 'Claim Free Trial', styles: { backgroundColor: '#991b1b', textColor: '#fff', padding: '48px', textAlign: 'center', borderRadius: '8px', margin: '0 0 24px' } },
  }),
  'yoga-studio': (c) => ({
    hero: {
      text: 'Find Your Balance',
      subtitle: `${c.businessName} — yoga, meditation, and mindful movement for every body.`,
      buttonText: 'Book a Class',
      styles: { backgroundColor: '#84cc16', textColor: '#14532d', textAlign: 'center', padding: '90px 32px', borderRadius: '24px', margin: '0 0 24px' },
    },
    features: {
      text: 'Classes for Everyone',
      items: [
        { title: 'All Levels Welcome', description: 'Beginner to advanced — find the perfect class for you.' },
        { title: 'Small Groups', description: 'Intimate classes with personalized instructor attention.' },
        { title: 'Mind & Body', description: 'Yoga, pilates, meditation, and breathwork sessions.' },
      ],
      styles: { padding: '48px', textAlign: 'center', backgroundColor: '#ecfccb', margin: '0 0 24px' },
    },
    cta: { text: 'First Class Free', subtitle: 'New students — try any class on us, no strings attached.', buttonText: 'Sign Up Free', styles: { backgroundColor: '#4d7c0f', textColor: '#fff', padding: '48px', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' } },
  }),
  'business-starter': (c) => ({
    hero: {
      text: `Welcome to ${c.businessName}`,
      subtitle: 'Quality products and services you can trust — all in one place.',
      buttonText: c.businessType === 'services' ? 'Book Now' : 'Shop Now',
      styles: { backgroundColor: '#4f46e5', textColor: '#fff', textAlign: 'center', padding: '90px 32px', borderRadius: '16px', margin: '0 0 24px' },
    },
    features: {
      text: 'Why Choose Us',
      items: [
        { title: 'Trusted Quality', description: 'We stand behind every product and service we offer.' },
        { title: 'Great Support', description: 'Friendly team ready to help you every step of the way.' },
        { title: 'Fair Prices', description: 'Competitive pricing without compromising on quality.' },
      ],
    },
    testimonial: { quote: 'Excellent experience from start to finish. Would definitely recommend!', author: 'Happy Customer', role: 'Verified Buyer' },
    cta: { text: 'Get Started Today', subtitle: 'Join thousands of satisfied customers.', buttonText: 'Learn More', styles: { backgroundColor: '#f3f4f6', padding: '48px', textAlign: 'center', borderRadius: '16px', margin: '0 0 24px' } },
  }),
  'creative-bold': (c) => ({
    hero: {
      text: c.businessName,
      subtitle: 'Bold ideas. Beautiful execution. Built for brands that stand out.',
      buttonText: 'Explore',
      styles: { backgroundColor: '#7c3aed', textColor: '#fff', textAlign: 'center', padding: '110px 32px', borderRadius: '24px', margin: '0 0 24px' },
    },
    features: {
      text: 'What We Do',
      items: [
        { title: 'Unique Vision', description: 'We bring creative ideas to life with passion and precision.' },
        { title: 'Collaborative', description: 'Your input shapes every step of the journey.' },
        { title: 'Results Driven', description: 'Beautiful work that achieves real business goals.' },
      ],
      styles: { padding: '48px', textAlign: 'center', margin: '0 0 24px' },
    },
    cta: { text: "Let's Create Something Amazing", subtitle: 'Ready to start your next project?', buttonText: 'Get in Touch', styles: { backgroundColor: '#7c3aed', textColor: '#fff', padding: '56px', textAlign: 'center', borderRadius: '20px', margin: '0 0 24px' } },
  }),
}

function applyBlockContent(block: Block, props: Partial<Block['props']>, styles?: Partial<Block['styles']>) {
  block.props = { ...block.props, ...props }
  if (styles) block.styles = { ...block.styles, ...styles }
}

export function buildTemplateHomeBlocks(config: SiteConfig, templateId: string): Block[] {
  const navItems = buildNavItems(config)
  const contentFn = homeContentByTemplate[templateId] ?? homeContentByTemplate['business-starter']
  const content = contentFn(config)
  const blocks: Block[] = [navbarBlock(config.businessName, navItems)]

  const hero = createBlockFromType('hero', uuid())
  applyBlockContent(hero, {
    text: content.hero.text,
    subtitle: content.hero.subtitle,
    buttonText: content.hero.buttonText,
    buttonLink: '#',
  }, content.hero.styles)
  blocks.push(hero)

  if (content.features) {
    const features = createBlockFromType('features', uuid())
    applyBlockContent(features, { text: content.features.text, features: content.features.items }, content.features.styles)
    blocks.push(features)
  }

  if (content.extras) {
    blocks.push(...content.extras(config))
  }

  if (content.testimonial) {
    const testimonial = createBlockFromType('testimonial', uuid())
    applyBlockContent(
      testimonial,
      { quote: content.testimonial.quote, author: content.testimonial.author, role: content.testimonial.role },
      content.testimonial.styles,
    )
    blocks.push(testimonial)
  }

  if (content.cta) {
    const cta = createBlockFromType('cta', uuid())
    applyBlockContent(
      cta,
      { text: content.cta.text, subtitle: content.cta.subtitle, buttonText: content.cta.buttonText, buttonLink: '#' },
      content.cta.styles,
    )
    blocks.push(cta)
  }

  blocks.push(footerBlock(config.businessName, buildNavItems(config)))
  return blocks
}

export function getTemplateById(id: string): WebsiteTemplate | undefined {
  return websiteTemplates.find((t) => t.id === id)
}

export function getTemplatesForSelection(category: BusinessCategory, businessType: BusinessType): WebsiteTemplate[] {
  return websiteTemplates.filter(
    (t) => t.category === category && t.businessTypes.includes(businessType),
  )
}

export function getDefaultTemplateId(category: BusinessCategory, businessType: BusinessType): string {
  const templates = getTemplatesForSelection(category, businessType)
  return templates.find((t) => t.popular)?.id ?? templates[0]?.id ?? 'business-starter'
}
