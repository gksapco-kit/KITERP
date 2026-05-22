import React, {
  useState, useCallback, useRef, useEffect, useMemo,
} from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Monitor, Tablet, Smartphone, Save, Eye, EyeOff,
  Undo2, Redo2, Plus, Trash2, Copy, ChevronUp, ChevronDown,
  GripVertical, Settings2, Palette, Sparkles, Image as ImageIcon,
  FileText, Layers, Layout, Code, Globe, Search, X, Check,
  Loader2, ChevronRight, MoreVertical, PanelLeft, PanelRight,
  Wand2, AlertTriangle, Download, ExternalLink, RefreshCw,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, Link2,
  Maximize2, Minimize2, Move, Pencil, PlusCircle, Upload,
  Zap, Star, Shield, Phone, Mail, MapPin, Clock, Rocket, CheckCircle2,
  ChevronLeft, BarChart3, Users, ShoppingBag, Heart,
  PlayCircle, Quote, Award, Briefcase, Camera,
  Type, Square, Columns, Video, Map, MessageSquare,
  Hash, Minus, List, ToggleLeft, Radio,
  Database, Plug, RefreshCcw, Package, Wrench, ShoppingCart,
  Store as StoreIcon, ClipboardCopy, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  useSite,
  useUpdateSite,
  usePublishSite, useUnpublishSite, useWebsiteTemplates,
  useAIGenerateText, useAIGenerateImage, useAIGenerateTheme, useAIUrlClone,
  useAIScreenshotToUI, useAIUxReview, useMedia, useUploadMedia, useSaveExternalUrl,
  useAIEnhancePrompt, useAIGenerateSEO, useAISuggestBlocks,
  useAIGenerateSite, useAIApplyGeneratedSite,
  useRedirects, useCreateRedirect, useDeleteRedirect,
  useEnableHeadless, useDisableHeadless,
  useSubmitLiveContact, useSubmitLiveNewsletter,
} from '@/hooks/useWebsites'
import type {
  WebsiteSite, WebsiteBlock, WebsitePage, BlockType, DeviceMode, BuilderPanel,
  StyleConfig, BlockProps,
  LiveResource, LiveItem,
} from '@/types/websites'
import { websiteApi } from '@/api/websites'
import { vendorApi } from '@/api/vendor'
import { useVendorStore } from '@/stores/vendorStore'
import { useMyVendor } from '@/hooks/useVendor'
import { getTemplatePreviewPalette } from '@/lib/templateBlockHighlights'
import CommerceLibraryPreview from '@/components/websites/CommerceLibraryPreview'
import { MediaStudioPanel } from '@/components/websites/MediaStudioPanel'
import {
  buildBuilderDraftPreviewUrl,
  getStorefrontAppOrigin,
  shouldUseLocalStorefrontUrls,
  STOREFRONT_OPEN_IN_BROWSER_BTN_CLASS,
} from '@/lib/storefrontPreviewUrl'
import { mediaUrl } from '@/lib/utils'
import { extractApiError, isBuilderPreviewInfraFailure } from '@/lib/errorMessages'

// ── Block definitions catalog ─────────────────────────────────────────────────

interface BlockDef {
  type: BlockType
  label: string
  icon: React.ElementType
  desc: string
  category: string
  defaultProps: BlockProps
}

const BLOCK_CATALOG: BlockDef[] = [
  // Structure
  { type: 'nav', label: 'Navigation', icon: Layout, desc: 'Top navigation with logo and links', category: 'structure', defaultProps: { brand: 'Your Brand', nav_links: [{ label: 'Home', url: '/' }, { label: 'About', url: '/about' }, { label: 'Contact', url: '/contact' }], cta_label: 'Get Started' } },
  { type: 'footer', label: 'Footer', icon: Layout, desc: 'Site footer with links and copyright', category: 'structure', defaultProps: {
    copyright: '© 2026 Your Company. All rights reserved.',
    show_legal: true,
    footer_columns: [
      { title: 'Company', links: ['About', 'Careers', 'Contact'] },
      { title: 'Product', links: ['Features', 'Pricing', 'Demo'] },
      { title: 'Resources', links: ['Blog', 'Docs', 'Support'] },
      { title: 'Legal', links: ['Terms', 'Privacy', 'Refund'] },
    ],
  } },
  { type: 'announcement_bar', label: 'Announcement Bar', icon: Hash, desc: 'Top banner for promotions', category: 'structure', defaultProps: { text: '🎉 Free shipping on all orders over $50 — Limited time!', color: '#64C3A0', show_close: true } },
  { type: 'marquee_strip', label: 'Marquee strip', icon: Type, desc: 'Scrolling one-line highlights (e.g. shipping, craft)', category: 'structure', defaultProps: { text: 'Made in Portugal,Hand-finished,Free returns,Since 2014' } },
  // Hero
  { type: 'hero', label: 'Hero — Centered', icon: Square, desc: 'Full-width hero with CTA buttons', category: 'hero', defaultProps: { headline: 'Build Something Amazing', subtitle: 'The all-in-one platform that helps you create, launch, and grow.', bg_style: 'gradient', cta_primary: 'Get Started Free', cta_secondary: 'Learn More', layout: 'centered' } },
  { type: 'hero_split', label: 'Hero — Split', icon: Columns, desc: 'Left text, right image hero', category: 'hero', defaultProps: { headline: 'Transform Your Business', subtitle: 'Powerful tools designed to help you succeed.', bg_style: 'minimal', cta_primary: 'Start Today', layout: 'split' } },
  { type: 'hero_minimal', label: 'Hero — Minimal', icon: Type, desc: 'Clean, text-focused hero', category: 'hero', defaultProps: { headline: 'Simple. Powerful. Yours.', subtitle: 'Less complexity, more results.', bg_style: 'minimal', cta_primary: 'Get Started', layout: 'minimal' } },
  // Content
  { type: 'features', label: 'Features Grid', icon: Columns, desc: 'Feature cards in a grid', category: 'content', defaultProps: { title: 'Everything You Need', layout: 'grid-3', features: [{ icon: 'Zap', title: 'Lightning Fast', desc: 'Optimized for performance' }, { icon: 'Shield', title: 'Secure by Default', desc: 'Enterprise-grade security' }, { icon: 'Star', title: 'Award Winning', desc: 'Loved by thousands of users' }] } },
  { type: 'features_alternating', label: 'Features — Alternating', icon: List, desc: 'Alternating image/text sections', category: 'content', defaultProps: { title: 'Why Choose Us', features: [{ title: 'Feature One', desc: 'Detailed description of this feature and how it benefits users.', image_url: '' }, { title: 'Feature Two', desc: 'Another great feature that sets you apart from the competition.', image_url: '' }] } },
  { type: 'stats', label: 'Stats / Numbers', icon: BarChart3, desc: 'Key metrics and achievements', category: 'content', defaultProps: { title: 'By the Numbers', stats: [{ value: '50K+', label: 'Happy Customers' }, { value: '99.9%', label: 'Uptime' }, { value: '4.9★', label: 'Average Rating' }, { value: '24/7', label: 'Support' }] } },
  { type: 'testimonials', label: 'Testimonials', icon: Quote, desc: 'Customer reviews and quotes', category: 'social', defaultProps: { title: 'What Our Customers Say', testimonials: [{ name: 'Sarah Johnson', role: 'CEO', company: 'TechCorp', quote: 'This platform transformed the way we work. Highly recommend!', rating: 5 }, { name: 'Michael Chen', role: 'Founder', company: 'StartupXYZ', quote: 'Incredibly powerful yet surprisingly easy to use.', rating: 5 }] } },
  { type: 'team_grid', label: 'Team Grid', icon: Users, desc: 'Meet the team cards', category: 'about', defaultProps: { title: 'Meet Our Team', columns: 4, members: [{ name: 'Jane Doe', role: 'CEO & Founder', bio: 'Leading the vision and strategy.' }, { name: 'John Smith', role: 'CTO', bio: 'Building the technology.' }] } },
  { type: 'pricing', label: 'Pricing Table', icon: Hash, desc: 'Pricing plans comparison', category: 'conversion', defaultProps: { title: 'Simple, Transparent Pricing', show_annual_toggle: true, plans: [{ name: 'Starter', price: 0, period: 'month', features: ['Up to 5 users', '10GB storage', 'Basic analytics', 'Email support'], cta: 'Start Free' }, { name: 'Pro', price: 49, period: 'month', features: ['Up to 50 users', '100GB storage', 'Advanced analytics', 'Priority support', 'API access'], highlighted: true, cta: 'Start Trial' }, { name: 'Enterprise', price: 'Custom', period: '', features: ['Unlimited users', 'Unlimited storage', 'Custom analytics', 'Dedicated support', 'SLA guarantee'], cta: 'Contact Sales' }] } },
  { type: 'faq', label: 'FAQ / Accordion', icon: MessageSquare, desc: 'Frequently asked questions', category: 'content', defaultProps: { title: 'Frequently Asked Questions', faqs: [{ question: 'How do I get started?', answer: 'Simply sign up for a free account and follow our quick onboarding guide.' }, { question: 'Is there a free trial?', answer: 'Yes! We offer a 14-day free trial with no credit card required.' }, { question: 'Can I cancel anytime?', answer: 'Absolutely. You can cancel your subscription at any time with no penalties.' }] } },
  { type: 'cta', label: 'Call to Action', icon: Zap, desc: 'Bold CTA section to convert visitors', category: 'conversion', defaultProps: { headline: 'Ready to Get Started?', subtitle: 'Join 50,000+ businesses already using our platform.', cta_label: 'Start Free Trial', cta_url: '/signup' } },
  { type: 'contact_form', label: 'Contact Form', icon: Mail, desc: 'Contact form with fields', category: 'contact', defaultProps: { title: 'Get In Touch', email: 'hello@yoursite.com', phone: '+1 (555) 000-0000', address: '123 Main Street, City, State', show_map: false, form_fields: [{ name: 'name', type: 'text', required: true, placeholder: 'Your Name' }, { name: 'email', type: 'email', required: true, placeholder: 'Your Email' }, { name: 'message', type: 'textarea', required: true, placeholder: 'Your Message' }] } },
  { type: 'portfolio_grid', label: 'Portfolio Grid', icon: Camera, desc: 'Filterable work portfolio grid', category: 'portfolio', defaultProps: { title: 'Our Work', columns: 3, filterable: true } },
  { type: 'gallery_masonry', label: 'Gallery Masonry', icon: ImageIcon, desc: 'Masonry image gallery', category: 'media', defaultProps: { title: 'Gallery' } },
  { type: 'blog_grid', label: 'Blog Grid', icon: FileText, desc: 'Latest posts in a grid', category: 'blog', defaultProps: { title: 'Latest Posts', columns: 3 } },
  { type: 'newsletter', label: 'Newsletter', icon: Mail, desc: 'Email capture / subscribe form', category: 'conversion', defaultProps: { title: 'Stay in the Loop', subtitle: 'Get the latest news and updates delivered to your inbox.', cta_label: 'Subscribe' } },
  { type: 'video_embed', label: 'Video Embed', icon: Video, desc: 'YouTube / Vimeo video player', category: 'media', defaultProps: { title: 'Watch Our Demo', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', aspect_ratio: '16:9' } },
  { type: 'map_embed', label: 'Map', icon: Map, desc: 'Embedded map with location', category: 'contact', defaultProps: { title: 'Find Us', address: '123 Main Street, City' } },
  { type: 'trust_logos', label: 'Trust Logos', icon: Award, desc: 'Partner/client logo strip', category: 'social', defaultProps: { title: 'Trusted by Industry Leaders' } },
  { type: 'timeline', label: 'Timeline', icon: Clock, desc: 'Company history or process steps', category: 'about', defaultProps: { title: 'Our Journey', items: [{ year: '2020', title: 'Founded', desc: 'Started with a simple idea.' }, { year: '2022', title: 'Series A', desc: 'Raised $5M to accelerate growth.' }, { year: '2024', title: 'Global Launch', desc: 'Expanded to 50+ countries.' }] } },
  { type: 'rich_text', label: 'Rich Text', icon: Type, desc: 'Formatted text content block', category: 'content', defaultProps: { content: '<h2>Your Heading</h2><p>Add your content here. This block supports <strong>bold</strong>, <em>italic</em>, and other formatting.</p>' } },
  { type: 'image_block', label: 'Image', icon: ImageIcon, desc: 'Single image with optional caption', category: 'media', defaultProps: { image_url: '', caption: 'Image caption' } },
  { type: 'divider', label: 'Divider', icon: Minus, desc: 'Visual separator between sections', category: 'layout', defaultProps: { style: 'line', color: '#e5e7eb', spacing: 40 } },
  { type: 'spacer', label: 'Spacer', icon: Minus, desc: 'Blank vertical spacer', category: 'layout', defaultProps: { height: 80 } },
  { type: 'social_links', label: 'Social Links', icon: Globe, desc: 'Social media icon links', category: 'social', defaultProps: { title: 'Follow Us', social_links: { twitter: 'https://twitter.com', instagram: 'https://instagram.com', linkedin: 'https://linkedin.com' } } },
  { type: 'countdown', label: 'Countdown Timer', icon: Clock, desc: 'Countdown to a date/event', category: 'conversion', get defaultProps() { return { title: 'Launch In', target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() } } },
  { type: 'product_grid', label: 'Product Grid', icon: ShoppingBag, desc: 'Display products from your catalog', category: 'ecommerce', defaultProps: { title: 'Featured Products', columns: 4, show_badges: true } },
  { type: 'menu_grid', label: 'Menu / Catalog', icon: List, desc: 'Restaurant-style menu grid', category: 'food', defaultProps: { title: 'Our Menu', categories: ['Starters', 'Mains', 'Desserts', 'Drinks'] } },
  { type: 'about_split', label: 'About Split', icon: Columns, desc: 'About section with image and text', category: 'about', defaultProps: { title: 'About Us', subtitle: 'Our Story', description: 'We are a passionate team dedicated to creating exceptional experiences.' } },
  { type: 'services_cards', label: 'Services Cards', icon: Briefcase, desc: 'Service offering cards', category: 'content', defaultProps: { title: 'Our Services', columns: 3, features: [{ icon: 'Zap', title: 'Service One', desc: 'Description of this service.' }, { icon: 'Shield', title: 'Service Two', desc: 'Description of this service.' }, { icon: 'Star', title: 'Service Three', desc: 'Description of this service.' }] } },
  { type: 'html_embed', label: 'HTML Embed', icon: Code, desc: 'Custom HTML/widget embed', category: 'advanced', defaultProps: { html: '<p>Add your custom HTML here</p>' } },

  // ERP / live data blocks
  { type: 'live_stock', label: 'Live Stock Ticker', icon: RefreshCw, desc: 'Real-time product stock levels from ERP', category: 'erp', defaultProps: { title: 'Live Inventory', show_count: 6 } },
  { type: 'order_status', label: 'Order Status Lookup', icon: Package, desc: 'Customer-facing order tracking widget', category: 'erp', defaultProps: { title: 'Track Your Order', placeholder: 'Enter order number...' } },
  { type: 'live_quote', label: 'Live Quote Widget', icon: RefreshCcw, desc: 'Auto-generated price quote from catalog', category: 'erp', defaultProps: { title: 'Get an Instant Quote', cta_label: 'Calculate Price' } },

  // Engagement / conversion
  { type: 'booking_widget', label: 'Booking Widget', icon: Clock, desc: 'Calendar-based appointment booking', category: 'widgets', defaultProps: { title: 'Book a Session', subtitle: 'Choose a time that works for you', cta_label: 'Book Now', show_calendar: true, service_name: 'Consultation' } },
  { type: 'booking_slot_picker', label: 'Booking Slot Picker', icon: Clock, desc: 'Step-by-step service / date / time selector', category: 'widgets', defaultProps: { title: 'Book an Appointment', subtitle: 'Select a service and choose your preferred time' } },
  { type: 'ab_test_block', label: 'A/B Test Block', icon: ToggleLeft, desc: 'Show variant A or B to split-test content', category: 'advanced', defaultProps: { variant_a: { headline: 'Version A Headline', cta: 'Click Here A' }, variant_b: { headline: 'Version B Headline', cta: 'Click Here B' }, split: 50 } },
  { type: 'personalization_block', label: 'Personalization Block', icon: Users, desc: 'Show different content by device / location / referral', category: 'advanced', defaultProps: { default_content: 'Default message for all visitors', mobile_content: 'Tap to get started on mobile!', rule: 'device' } },

  // Commerce — P1 business front blocks (must mirror business front BlockRenderer)
  { type: 'product_detail', label: 'Product Detail', icon: ShoppingBag, desc: 'Gallery, variants, and add-to-cart for a single product', category: 'ecommerce', defaultProps: { show_variants: true, show_reviews: true } },
  { type: 'cart_drawer', label: 'Cart Drawer', icon: ShoppingCart, desc: 'Slide-out cart panel with upsells', category: 'erp', defaultProps: { title: 'Your Cart', show_upsells: true } },
  { type: 'checkout_form', label: 'Checkout Form', icon: ShoppingCart, desc: 'Address, shipping, payment fields', category: 'erp', defaultProps: { allow_cod: true, show_tip: false } },
  { type: 'search_bar', label: 'Search Bar', icon: Search, desc: 'Autosuggest product/service search', category: 'ecommerce', defaultProps: { placeholder: 'Search products & services...', show_filters: true } },
  { type: 'product_filters', label: 'Product Filters', icon: List, desc: 'Faceted filter sidebar', category: 'ecommerce', defaultProps: { show_price: true, show_category: true, show_brand: true } },
  { type: 'related_products', label: 'Related Products', icon: ShoppingBag, desc: 'Cross-sell / upsell grid', category: 'ecommerce', defaultProps: { title: 'You May Also Like', count: 4 } },
  { type: 'recently_viewed', label: 'Recently Viewed', icon: Clock, desc: 'Client-side recently viewed items', category: 'ecommerce', defaultProps: { title: 'Recently Viewed', max: 6 } },
  { type: 'coupon_banner', label: 'Coupon Banner', icon: Hash, desc: 'Promotional coupon code display', category: 'erp', defaultProps: { title: 'Use code SAVE10 for 10% off!', show_copy_button: true } },
  { type: 'payment_methods_strip', label: 'Payment Methods', icon: Hash, desc: 'Payment provider logo strip', category: 'erp', defaultProps: { title: 'Secure Payments', methods: ['visa', 'mastercard', 'upi', 'gpay', 'cod'] } },
  { type: 'product_reviews', label: 'Product Reviews', icon: Star, desc: 'Star ratings and review grid', category: 'social', defaultProps: { title: 'Customer Reviews', show_summary: true } },
  { type: 'cookie_consent', label: 'Cookie Consent', icon: Shield, desc: 'GDPR/CCPA cookie consent banner', category: 'advanced', defaultProps: { message: 'We use cookies to improve your experience.', accept_label: 'Accept', decline_label: 'Decline' } },
]


const COMMERCE_LIBRARY_BLOCKS: BlockDef[] = [
  { type: 'product.grid', label: 'Product Grid', icon: ShoppingBag, desc: 'Responsive product listing with grid, list, and carousel layouts.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'product.featured', label: 'Featured Product', icon: ShoppingBag, desc: 'Hero spotlight for a single product with image and CTA.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'product.detail', label: 'Product Detail', icon: ShoppingBag, desc: 'Full product page with gallery, options, and trust badges.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'product.cart', label: 'Mini Cart', icon: ShoppingBag, desc: 'Cart with quantity controls, totals, and shipping summary.', category: 'erp', defaultProps: { variant: 'default' } },
  { type: 'product.categories', label: 'Category Showcase', icon: ShoppingBag, desc: 'Browse products by category with imagery.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'product.carousel', label: 'Product Carousel', icon: ShoppingBag, desc: 'Horizontally scrolling product showcase.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'service.list', label: 'Service List', icon: Briefcase, desc: 'Detailed service rows with features and price.', category: 'content', defaultProps: { variant: 'default' } },
  { type: 'service.grid', label: 'Service Card Grid', icon: Briefcase, desc: 'Service cards laid out in a responsive grid.', category: 'content', defaultProps: { variant: 'default' } },
  { type: 'service.detail', label: 'Service Detail', icon: Briefcase, desc: 'Service page with description, inclusions, and booking sidebar.', category: 'content', defaultProps: { variant: 'default' } },
  { type: 'service.pricing', label: 'Pricing Tiers', icon: Briefcase, desc: 'Three-column pricing comparison with featured plan.', category: 'content', defaultProps: { variant: 'default' } },
  { type: 'menu.categorized', label: 'Categorized Menu', icon: List, desc: 'Restaurant menu grouped by section with prices and dietary tags.', category: 'food', defaultProps: { variant: 'default' } },
  { type: 'menu.item', label: 'Menu Item Detail', icon: List, desc: 'Full-page menu item with photo, dietary, and price.', category: 'food', defaultProps: { variant: 'default' } },
  { type: 'menu.specials', label: 'Daily Specials', icon: List, desc: 'Highlighted limited-time menu items.', category: 'food', defaultProps: { variant: 'default' } },
  { type: 'menu.allergens', label: 'Allergen Legend', icon: List, desc: 'Key for dietary and allergen tags used on the menu.', category: 'food', defaultProps: { variant: 'default' } },
  { type: 'booking.calendar', label: 'Availability Calendar', icon: Clock, desc: 'Month-view calendar showing available, limited, and full days.', category: 'widgets', defaultProps: { variant: 'default' } },
  { type: 'booking.slots', label: 'Time-Slot Picker', icon: Clock, desc: 'Grid of bookable time slots with duration.', category: 'widgets', defaultProps: { variant: 'default' } },
  { type: 'booking.form', label: 'Booking Form', icon: Clock, desc: 'Contact form for collecting customer details.', category: 'widgets', defaultProps: { variant: 'default' } },
  { type: 'booking.summary', label: 'Booking Summary', icon: Clock, desc: 'Confirmation card with details and total.', category: 'widgets', defaultProps: { variant: 'default' } },
  { type: 'product.reviews', label: 'Product Reviews', icon: ShoppingBag, desc: 'Star breakdown plus individual customer reviews.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'product.compare', label: 'Comparison Table', icon: ShoppingBag, desc: 'Side-by-side product comparison with feature rows.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'product.bundle', label: 'Product Bundle', icon: ShoppingBag, desc: 'Frequently bought together with bundle savings.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'product.crossSell', label: 'Cross-sell Row', icon: ShoppingBag, desc: 'Related product recommendations row.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'product.recentlyViewed', label: 'Recently Viewed', icon: ShoppingBag, desc: 'Recall last-viewed products as a horizontal row.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'product.search', label: 'Search Results', icon: ShoppingBag, desc: 'Search bar with results grid and suggestion chips.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'product.filters', label: 'Filters Sidebar', icon: ShoppingBag, desc: 'Faceted filters: checkboxes, color swatches, price range.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'product.wishlist', label: 'Wishlist', icon: ShoppingBag, desc: 'Saved-for-later products in grid or list layout.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'product.notifier', label: 'Stock Notifier', icon: ShoppingBag, desc: 'Email capture for back-in-stock notifications.', category: 'erp', defaultProps: { variant: 'default' } },
  { type: 'product.promo', label: 'Promo Banner', icon: ShoppingBag, desc: 'Sitewide promo with code, banner or card layout.', category: 'erp', defaultProps: { variant: 'default' } },
  { type: 'product.orderTracking', label: 'Order Tracking', icon: ShoppingBag, desc: 'Shipment status, ETA, tracking number, and items.', category: 'erp', defaultProps: { variant: 'default' } },
  { type: 'product.loyalty', label: 'Loyalty Widget', icon: ShoppingBag, desc: 'Member tier, points, progress bar, and perks.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'service.testimonials', label: 'Testimonials', icon: Briefcase, desc: 'Quotes with avatar, role, and rating.', category: 'content', defaultProps: { variant: 'default' } },
  { type: 'service.process', label: 'Process Steps', icon: Briefcase, desc: 'Numbered step-by-step engagement timeline.', category: 'content', defaultProps: { variant: 'default' } },
  { type: 'service.faq', label: 'FAQ', icon: Briefcase, desc: 'Accordion of common questions and answers.', category: 'content', defaultProps: { variant: 'default' } },
  { type: 'service.team', label: 'Team Picker', icon: Briefcase, desc: 'Pick a team member, see availability and rating.', category: 'content', defaultProps: { variant: 'default' } },
  { type: 'service.addons', label: 'Add-ons Selector', icon: Briefcase, desc: 'Multi-select add-ons with running total.', category: 'content', defaultProps: { variant: 'default' } },
  { type: 'menu.wine', label: 'Wine Pairing', icon: List, desc: 'Wines by glass/bottle with pairings and tasting notes.', category: 'food', defaultProps: { variant: 'default' } },
  { type: 'menu.combo', label: 'Combo / Set Menu', icon: List, desc: 'Multi-course set menus with choose-your-own options.', category: 'food', defaultProps: { variant: 'default' } },
  { type: 'menu.nutrition', label: 'Nutrition Table', icon: List, desc: 'Sortable per-serving nutrition information table.', category: 'food', defaultProps: { variant: 'default' } },
  { type: 'booking.resource', label: 'Resource Picker', icon: Clock, desc: 'Pick a room, court, or piece of equipment to book.', category: 'widgets', defaultProps: { variant: 'default' } },
  { type: 'booking.wizard', label: 'Booking Wizard', icon: Clock, desc: 'Multi-step progress indicator for booking flows.', category: 'widgets', defaultProps: { variant: 'default' } },
  { type: 'booking.email', label: 'Confirmation Email', icon: Clock, desc: 'Preview of the booking confirmation email.', category: 'widgets', defaultProps: { variant: 'default' } },
  { type: 'booking.history', label: 'Past Bookings', icon: Clock, desc: 'Customer\'s booking history with status badges.', category: 'widgets', defaultProps: { variant: 'default' } },
  { type: 'commerce.checkout', label: 'Checkout', icon: ShoppingCart, desc: 'Full checkout with shipping, payment, and order summary.', category: 'erp', defaultProps: { variant: 'default' } },
  { type: 'commerce.address', label: 'Address Book', icon: ShoppingCart, desc: 'Saved shipping addresses with select / edit / add.', category: 'erp', defaultProps: { variant: 'default' } },
  { type: 'commerce.orderConfirmation', label: 'Order Confirmation', icon: ShoppingCart, desc: 'Thank-you page with order details and shipping ETA.', category: 'erp', defaultProps: { variant: 'default' } },
  { type: 'commerce.giftCards', label: 'Gift Cards', icon: ShoppingCart, desc: 'Buy a gift card or check an existing balance.', category: 'erp', defaultProps: { variant: 'default' } },
  { type: 'booking.group', label: 'Group Booking', icon: Clock, desc: 'Adult/child counters with min/max party size.', category: 'widgets', defaultProps: { variant: 'default' } },
  { type: 'booking.recurring', label: 'Recurring Booking', icon: Clock, desc: 'Weekly / bi-weekly / monthly series with discount.', category: 'widgets', defaultProps: { variant: 'default' } },
  { type: 'booking.waitlist', label: 'Waitlist', icon: Clock, desc: 'Join waitlist form or current position card.', category: 'widgets', defaultProps: { variant: 'default' } },
  { type: 'state.empty', label: 'Empty State', icon: AlertTriangle, desc: 'Friendly empty placeholders for cart, search, wishlist, and more.', category: 'advanced', defaultProps: { variant: 'default' } },
  { type: 'state.skeleton', label: 'Skeleton Loader', icon: AlertTriangle, desc: 'Loading placeholders shaped like the content they replace.', category: 'advanced', defaultProps: { variant: 'default' } },
  { type: 'state.error', label: 'Error State', icon: AlertTriangle, desc: '404, 500, network, and maintenance error placeholders.', category: 'advanced', defaultProps: { variant: 'default' } },
  { type: 'vertical.propertyListing', label: 'Property Listing', icon: StoreIcon, desc: 'Real estate listings in grid, list, or map layout.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'vertical.propertyDetail', label: 'Property Detail', icon: StoreIcon, desc: 'Full property page with gallery, stats, agent, and mortgage.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'vertical.autoInventory', label: 'Auto Inventory', icon: StoreIcon, desc: 'Vehicle inventory grid with price filter and condition badges.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'vertical.vehicleDetail', label: 'Vehicle Detail', icon: StoreIcon, desc: 'Full vehicle page with specs, highlights, and finance estimate.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'vertical.fitnessSchedule', label: 'Fitness Schedule', icon: StoreIcon, desc: 'Class schedule with intensity, capacity, and reservations.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'vertical.eventListing', label: 'Event Listing', icon: StoreIcon, desc: 'Upcoming events in grid or list, with date and venue.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'vertical.ticketPicker', label: 'Ticket Picker', icon: StoreIcon, desc: 'Tiered ticket selection with seating chart and order summary.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'vertical.courseCatalog', label: 'Course Catalog', icon: StoreIcon, desc: 'Browse courses with rating, level, and price.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'vertical.courseDetail', label: 'Course Detail', icon: StoreIcon, desc: 'Course page with syllabus, outcomes, and pricing card.', category: 'ecommerce', defaultProps: { variant: 'default' } },
]

BLOCK_CATALOG.push(...COMMERCE_LIBRARY_BLOCKS)


// ── Block mini-preview thumbnails (emoji shorthand) ───────────────────────────
const BLOCK_THUMBNAILS: Record<string, string> = {
  nav: '🔝', footer: '⬇️', announcement_bar: '📢', marquee_strip: '💬',
  hero: '🎯', hero_split: '↔️', hero_minimal: '✨',
  features: '⚡', features_alternating: '🔄',
  stats: '📊', testimonials: '💬', team_grid: '👥',
  pricing: '💳', faq: '❓', cta: '🚀',
  contact_form: '✉️', portfolio_grid: '🖼️', gallery_masonry: '🗃️',
  blog_grid: '📝', newsletter: '📧', video_embed: '▶️',
  map_embed: '🗺️', trust_logos: '🏅', timeline: '📅',
  rich_text: '📄', image_block: '🖼️', divider: '──', spacer: '↕️',
  social_links: '🔗', countdown: '⏱️',
  product_grid: '🛍️', menu_grid: '🍽️', about_split: '🏢',
  services_cards: '🎯', html_embed: '💻',
  live_stock: '📦', order_status: '🚚', live_quote: '💬',
  booking_widget: '📅', ab_test_block: '🧪', personalization_block: '🎭',
  coupon_banner: '🏷️', payment_methods_strip: '💳',
  search_bar: '🔍', cookie_consent: '🍪',
  product_detail: '🛒', checkout_form: '💳', product_reviews: '⭐',
  booking_slot_picker: '🗓️',
  cart_drawer: '🛒', product_filters: '🧰',
  related_products: '🛍️', recently_viewed: '⏪',
}

function catalogBlockLabel(block: { block_type: string; label?: string | null }): string {
  if (block.label) return block.label
  const def = BLOCK_CATALOG.find(d => d.type === block.block_type)
  return def?.label || block.block_type.replace(/_/g, ' ')
}

const BLOCK_CATEGORIES = [
  { id: 'all', label: 'All Blocks' },
  { id: 'structure', label: 'Structure' },
  { id: 'hero', label: 'Hero' },
  { id: 'content', label: 'Content' },
  { id: 'social', label: 'Social Proof' },
  { id: 'conversion', label: 'Conversion' },
  { id: 'media', label: 'Media' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
  { id: 'blog', label: 'Blog' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'ecommerce', label: 'Commerce' },
  { id: 'erp', label: 'Live ERP' },
  { id: 'widgets', label: 'Widgets' },
  { id: 'layout', label: 'Layout' },
  { id: 'advanced', label: 'Advanced' },
]

const DEFAULT_STYLE: StyleConfig = {
  primary_color: '#64C3A0',
  secondary_color: '#13624A',
  accent_color: '#f59e0b',
  bg_color: '#ffffff',
  surface_color: '#f9fafb',
  text_color: '#111827',
  font_heading: 'Inter',
  font_body: 'Inter',
  border_radius: 'rounded',
  spacing: 'comfortable',
  animation: 'subtle',
  shadow_style: 'soft',
  button_style: 'filled',
  nav_style: 'default',
  footer_style: 'default',
  container_width: '1280px',
}

/** Export shape matches `GET /vendors/me/websites/:id/export` — paste into `/import` or keep as backup. */
function buildLocalSiteExport(
  site: WebsiteSite | undefined,
  localPages: WebsitePage[],
  localBlocks: Record<string, WebsiteBlock[]>,
  localStyle: StyleConfig,
) {
  return {
    export_version: 1 as const,
    exported_at: new Date().toISOString(),
    site: {
      name: site?.name ?? 'Exported site',
      subdomain: site?.subdomain ?? null,
      description: site?.description ?? null,
      logo_url: site?.logo_url ?? null,
      favicon_url: site?.favicon_url ?? null,
      style_config: localStyle,
      seo_title: site?.seo_title ?? null,
      seo_description: site?.seo_description ?? null,
      language: site?.language ?? 'en',
      currency: site?.currency ?? 'USD',
      pages: localPages.map((p, pIdx) => ({
        title: p.title,
        slug: p.slug,
        page_type: p.page_type,
        is_homepage: !!p.is_homepage,
        show_in_nav: p.show_in_nav !== false,
        seo_title: p.seo_title ?? null,
        seo_description: p.seo_description ?? null,
        sort_order: p.sort_order ?? pIdx,
        blocks: (localBlocks[p.id] ?? []).map((b, bIdx) => ({
          block_type: b.block_type,
          label: b.label ?? null,
          props: b.props ?? {},
          style_overrides: b.style_overrides ?? {},
          visible: b.visible !== false,
          sort_order: b.sort_order ?? bIdx,
        })),
      })),
    },
  }
}

/** Public-site JSON shape (GET /public/sites/by-subdomain/...) for draft browser preview. */
function buildPublicSitePayloadFromLocal(
  site: WebsiteSite,
  localPages: WebsitePage[],
  localBlocks: Record<string, WebsiteBlock[]>,
  localStyle: StyleConfig,
): Record<string, unknown> {
  const pagesSorted = [...localPages].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const pages = pagesSorted.map(page => {
    const blocksRaw = (localBlocks[page.id] ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const blocks = blocksRaw.map(b => ({
      id: b.id,
      page_id: b.page_id || page.id,
      block_type: b.block_type,
      label: b.label,
      props: b.props ?? {},
      style_overrides: b.style_overrides ?? {},
      visible: b.visible !== false,
      visible_on_mobile: b.visible_on_mobile !== false,
      visible_on_tablet: b.visible_on_tablet !== false,
      visible_on_desktop: b.visible_on_desktop !== false,
      animation: b.animation ?? null,
      animation_delay: b.animation_delay ?? 0,
      sort_order: b.sort_order ?? 0,
      visible_branches: ((b.props ?? {}) as { _visible_branches?: string[] })._visible_branches ?? [],
    }))
    return {
      id: page.id,
      site_id: page.site_id || site.id,
      title: page.title,
      slug: page.slug,
      page_type: page.page_type,
      seo_title: page.seo_title,
      seo_description: page.seo_description,
      og_image_url: page.og_image_url,
      layout: page.layout ?? 'full',
      sort_order: page.sort_order ?? 0,
      is_published: true,
      is_homepage: !!page.is_homepage,
      show_in_nav: page.show_in_nav !== false,
      blocks,
    }
  })
  return {
    id: site.id,
    vendor_id: site.vendor_id,
    name: site.name,
    subdomain: site.subdomain,
    custom_domain: site.custom_domain,
    description: site.description,
    favicon_url: site.favicon_url,
    logo_url: site.logo_url,
    style_config: localStyle,
    seo_title: site.seo_title,
    seo_description: site.seo_description,
    seo_keywords: site.seo_keywords,
    og_image_url: site.og_image_url,
    is_published: true,
    status: site.status,
    google_analytics_id: site.google_analytics_id,
    meta_pixel_id: site.meta_pixel_id,
    custom_head_code: site.custom_head_code,
    custom_body_code: site.custom_body_code,
    language: site.language,
    languages_enabled: site.languages_enabled ?? ['en'],
    currency: site.currency,
    currencies_enabled: site.currencies_enabled ?? [site.currency],
    currency_symbol: site.currency_symbol,
    currency_position: site.currency_position,
    location: site.location,
    timezone: site.timezone,
    pages,
    updated_at: new Date().toISOString(),
  }
}

const FONTS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Nunito', 'Poppins',
  'Montserrat', 'Raleway', 'DM Sans', 'Plus Jakarta Sans',
  'Playfair Display', 'Merriweather', 'Lora', 'Crimson Text',
  'Space Grotesk', 'Sora', 'Manrope', 'Outfit',
]

// ── In-block overlay element system ──────────────────────────────────────────

export type OverlayLinkType =
  | 'none'
  | 'url'           // external URL
  | 'page'          // internal website page
  | 'scroll'        // scroll to #anchor on current page
  | 'contact'       // scroll to contact block
  // Live ERP catalog
  | 'product'       // live product detail (/products/{slug})
  | 'service'       // live service detail (/services/{slug})
  | 'category'      // live category page  (/categories/{slug})
  | 'team_member'   // live team member profile (/team/{slug})
  | 'testimonial'   // jump to specific testimonial block
  | 'media'         // direct link to a file in the media library
  // Stores / branches
  | 'store'         // specific physical store / branch (?branch={code})
  | 'store_locator' // all stores / store-locator page (/stores)
  | 'stores_multi'  // subset of specific branches (?branch=a,b,c)
  // Live actions
  | 'booking'       // open booking flow
  | 'quote'         // open quote / inquiry form
  | 'email'         // mailto:
  | 'phone'         // tel:
  | 'whatsapp'      // wa.me/
  // Portal / built-in site routes
  | 'login'         // /login
  | 'register'      // /signup
  | 'account'       // /account
  | 'orders'        // /account/orders
  | 'cart'          // /cart
  | 'checkout'      // /checkout
  | 'wishlist'      // /wishlist
  | 'search'        // /search
  | 'download'      // file download from media lib

export interface BlockOverlayItem {
  id: string
  type: 'text' | 'image' | 'button' | 'box' | 'badge' | 'video'
  x: number   // px from block left
  y: number   // px from block top
  w: number   // px width
  h: number   // px height
  text?: string
  description?: string // tooltip / alt / accessibility + aria-label
  src?: string
  href?: string
  linkType?: OverlayLinkType
  linkTarget?: string            // resolved target (slug / page id / email)
  linkLabel?: string             // human-readable label (e.g. "Espresso · ₹180")
  openInNewTab?: boolean
  fontSize?: number
  fontWeight?: string
  italic?: boolean
  color?: string
  bgColor?: string
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  opacity?: number
  zIndex?: number
  shadow?: boolean
  align?: 'left' | 'center' | 'right'
  objectFit?: 'cover' | 'contain' | 'fill'
}

const OVERLAY_DEFAULTS: Record<string, Partial<BlockOverlayItem>> = {
  text:    { w: 220, h: 60,  text: 'Your text here', fontSize: 18, color: '#111827', bgColor: 'transparent' },
  image:   { w: 300, h: 200, objectFit: 'cover', borderRadius: 8 },
  button:  { w: 160, h: 44,  text: 'Click Here', bgColor: '#64C3A0', color: '#ffffff', borderRadius: 8, fontSize: 14, fontWeight: 'bold' },
  box:     { w: 280, h: 180, bgColor: 'rgba(255,255,255,0.9)', borderRadius: 12, shadow: true, borderColor: 'rgba(124,58,237,0.2)', borderWidth: 2 },
  badge:   { w: 90,  h: 32,  text: 'New', bgColor: '#64C3A0', color: '#ffffff', borderRadius: 999, fontSize: 12, fontWeight: 'bold' },
  video:   { w: 320, h: 200, bgColor: '#000000', borderRadius: 8 },
  // Insert-helpers: reuse the button overlay shape but seed link fields so the
  // link-editor popup opens pre-focused on the right section (URL vs DB).
  link:    { w: 160, h: 44, text: 'Open Link', bgColor: '#64C3A0', color: '#ffffff', borderRadius: 8, fontSize: 14, fontWeight: 'bold', linkType: 'url' },
  db_link: { w: 180, h: 44, text: 'View Product', bgColor: '#0ea5e9', color: '#ffffff', borderRadius: 8, fontSize: 14, fontWeight: 'bold', linkType: 'product' },
  store:   { w: 180, h: 44, text: 'Visit Store', bgColor: '#0f766e', color: '#ffffff', borderRadius: 8, fontSize: 14, fontWeight: 'bold', linkType: 'store' },
}

const OVERLAY_RESIZE_CURSORS: Record<string, string> = {
  n: 'n-resize', ne: 'ne-resize', e: 'e-resize', se: 'se-resize',
  s: 's-resize', sw: 'sw-resize', w: 'w-resize', nw: 'nw-resize',
}
const OVERLAY_HANDLE_POS: Record<string, React.CSSProperties> = {
  n:  { top: -5, left: '50%', transform: 'translateX(-50%)' },
  ne: { top: -5, right: -5 },
  e:  { top: '50%', right: -5, transform: 'translateY(-50%)' },
  se: { bottom: -5, right: -5 },
  s:  { bottom: -5, left: '50%', transform: 'translateX(-50%)' },
  sw: { bottom: -5, left: -5 },
  w:  { top: '50%', left: -5, transform: 'translateY(-50%)' },
  nw: { top: -5, left: -5 },
}

// ── Draggable popup hook ──────────────────────────────────────────────────────
// Attach `headerMouseDown` to any header element and `ref` to the popup root.
// Click-and-drag the header to reposition the popup anywhere on screen.
// Clicks on buttons / inputs inside the header are ignored so close/X still works.

function useDraggablePopup(open: boolean) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  // Reset position whenever the popup opens
  useEffect(() => { if (open) setPos(null) }, [open])

  const headerMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start a drag if the user pressed a button / input inside the header
    if ((e.target as HTMLElement).closest('button, input, textarea, select, a')) return
    if (!ref.current) return
    e.preventDefault(); e.stopPropagation()
    const rect = ref.current.getBoundingClientRect()
    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const popupStartX = rect.left
    const popupStartY = rect.top
    document.body.style.cursor = 'grabbing'

    const onMove = (mv: MouseEvent) => {
      const dx = mv.clientX - startMouseX
      const dy = mv.clientY - startMouseY
      // Keep the popup at least 24px on-screen on all sides
      const vw = window.innerWidth
      const vh = window.innerHeight
      const w = ref.current?.offsetWidth ?? 400
      const h = ref.current?.offsetHeight ?? 300
      setPos({
        x: Math.max(-w + 60, Math.min(vw - 60, popupStartX + dx)),
        y: Math.max(0,       Math.min(vh - 40, popupStartY + dy)),
      })
    }
    const onUp = () => {
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  return { ref, pos, headerMouseDown }
}

// ── Reusable Text Prompt Popup ────────────────────────────────────────────────
// A small styled replacement for window.prompt(). Used for quick edits of text,
// descriptions, alt-text, image URLs, etc., without jarring browser dialogs.

function TextPromptPopup({
  open, anchor, title, subtitle, initialValue, placeholder, multiline, maxLength,
  confirmLabel = 'Save', onSave, onClose,
}: {
  open: boolean
  anchor?: { x: number; y: number } | null
  title: string
  subtitle?: string
  initialValue?: string
  placeholder?: string
  multiline?: boolean
  maxLength?: number
  confirmLabel?: string
  onSave: (v: string) => void
  onClose: () => void
}) {
  const [val, setVal] = useState(initialValue || '')
  const { ref, pos, headerMouseDown } = useDraggablePopup(open)
  useEffect(() => { if (open) setVal(initialValue || '') }, [open, initialValue])

  if (!open) return null

  const commit = () => { onSave(val); onClose() }

  const style: React.CSSProperties = pos
    ? { position: 'fixed', top: pos.y, left: pos.x, zIndex: 100000 }
    : anchor
      ? { position: 'fixed', top: Math.min(anchor.y, (typeof window !== 'undefined' ? window.innerHeight : 768) - 300), left: Math.min(anchor.x, (typeof window !== 'undefined' ? window.innerWidth : 1024) - 400), zIndex: 100000 }
      : { position: 'fixed', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 100000 }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[99999]" onClick={onClose} />
      <div
        ref={ref}
        style={style}
        className="w-[380px] max-w-[92vw] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        <div
          className="px-4 py-3 bg-gradient-to-r from-primary to-emerald-700 text-white flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
          onMouseDown={headerMouseDown}
          title="Drag to move"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Move className="w-3 h-3 opacity-60 shrink-0" />
            <Pencil className="w-4 h-4 shrink-0" />
            <span className="text-sm font-bold truncate">{title}</span>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded hover:bg-white/20 shrink-0">
                <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          {multiline ? (
            <textarea
              autoFocus
              value={val}
              onChange={e => setVal(e.target.value)}
              placeholder={placeholder}
              maxLength={maxLength}
              rows={4}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              onKeyDown={e => {
                if (e.key === 'Escape') onClose()
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit() }
              }}
            />
          ) : (
            <input
              autoFocus
              value={val}
              onChange={e => setVal(e.target.value)}
              placeholder={placeholder}
              maxLength={maxLength}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              onKeyDown={e => {
                if (e.key === 'Escape') onClose()
                if (e.key === 'Enter') { e.preventDefault(); commit() }
              }}
              onFocus={e => e.currentTarget.select()}
            />
          )}
          {maxLength && (
            <div className="text-xs text-gray-400 text-right">{val.length} / {maxLength}</div>
          )}
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="btn-cancel flex-1 py-2 rounded-lg text-xs font-medium text-gray-600 border border-[#ffc954]">Cancel</button>
          <button onClick={commit} className="flex-1 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary/90">{confirmLabel}</button>
        </div>
      </div>
    </>
  )
}

// ── Reusable Link Editor Popup ────────────────────────────────────────────────
// Used both for in-block overlay buttons and for hero-level CTA buttons.
// Supports raw URL, internal page, live product/service/booking/contact, mailto/tel.

interface LinkValue {
  type: OverlayLinkType
  target: string
  label?: string
  openInNewTab?: boolean
}

interface LinkTypeMeta {
  id: OverlayLinkType
  label: string
  desc: string
  icon: React.ElementType
  // Resource type (when applicable) — used to fetch a live picker list
  resource?: LiveResource
  // Predefined route for portal / built-in pages
  route?: string
  // What input prompt to show if no picker
  inputHint?: string
  // Category group for visual organization
  group: 'basic' | 'catalog' | 'people' | 'stores' | 'actions' | 'portal'
  // Mini note shown when this type is selected
  note?: string
}

const LINK_TYPES: LinkTypeMeta[] = [
  // Basic
  { id: 'none',   label: 'No link',        desc: 'Decorative button',          icon: X,            group: 'basic' },
  { id: 'url',    label: 'External URL',   desc: 'Any https:// website',       icon: ExternalLink, group: 'basic', inputHint: 'https://example.com' },
  { id: 'page',   label: 'Site page',      desc: 'One of your website pages',  icon: FileText,     group: 'basic', resource: 'pages' },
  { id: 'scroll', label: 'Page anchor',    desc: 'Scroll to a #section',       icon: ChevronDown,  group: 'basic', inputHint: 'contact' },

  // Live catalog (ERP)
  { id: 'product',      label: 'Product',      desc: 'Live product from catalog',   icon: ShoppingBag, group: 'catalog', resource: 'products' },
  { id: 'service',      label: 'Service',      desc: 'One of your services',        icon: Briefcase,   group: 'catalog', resource: 'services' },
  { id: 'category',     label: 'Category',     desc: 'Category landing page',       icon: Layers,      group: 'catalog', resource: 'categories' },
  { id: 'media',        label: 'Media file',   desc: 'Image/video from library',    icon: ImageIcon,   group: 'catalog', resource: 'media' },
  { id: 'download',     label: 'Download',     desc: 'Force-download media file',   icon: Download,    group: 'catalog', resource: 'media' },

  // People
  { id: 'team_member', label: 'Team member', desc: 'Employee / team profile',       icon: Users,        group: 'people', resource: 'team' },
  { id: 'testimonial', label: 'Testimonial', desc: 'Highlight a review on site',    icon: Quote,        group: 'people', resource: 'testimonials' },

  // Stores / branches (linked via ?branch={code} on the current business front)
  { id: 'store',         label: 'Store / branch',   desc: 'Switch to a specific outlet',  icon: StoreIcon,  group: 'stores', resource: 'stores', note: 'Link this button to one of your physical outlets. Visitors get ?branch={code} appended so inventory, prices and contact info follow that branch.' },
  { id: 'store_locator', label: 'All stores',       desc: 'Store locator — lists every branch', icon: MapPin, group: 'stores', route: '/stores',   note: 'Opens the store-locator page showing every active outlet. Use this for "Find a store near you" type buttons.' },
  { id: 'stores_multi',  label: 'Selected stores',  desc: 'Pick several branches at once', icon: Layers,   group: 'stores', resource: 'stores', note: 'Link to a curated set of outlets. Visitors land on the locator filtered to just the branches you picked (?branch=code1,code2…).' },

  // Live actions
  { id: 'booking',  label: 'Book now',       desc: 'Open booking widget',          icon: Clock,       group: 'actions', route: '/booking',       note: 'Opens the booking flow (requires a Booking block somewhere on this site).' },
  { id: 'quote',    label: 'Get a quote',    desc: 'Open quote request form',      icon: FileText,    group: 'actions', route: '/quote',         note: 'Sends visitor to /quote which creates a CRM lead.' },
  { id: 'contact',  label: 'Contact form',   desc: 'Scroll to contact section',    icon: MessageSquare, group: 'actions', route: '#contact',     note: 'Scrolls to the Contact Form on this page (or /contact).' },
  { id: 'email',    label: 'Email address',  desc: 'Opens email app (mailto:)',    icon: Mail,        group: 'actions', inputHint: 'hello@yourbrand.com' },
  { id: 'phone',    label: 'Phone call',     desc: 'Opens dialer (tel:)',          icon: Phone,       group: 'actions', inputHint: '+1 555 000 0000' },
  { id: 'whatsapp', label: 'WhatsApp',       desc: 'Opens chat (wa.me/)',          icon: MessageSquare, group: 'actions', inputHint: '919876543210' },

  // Portal routes (built into every site)
  { id: 'login',    label: 'Sign in',        desc: 'Customer login page',          icon: Users,       group: 'portal',  route: '/login' },
  { id: 'register', label: 'Create account', desc: 'Customer registration',        icon: Users,       group: 'portal',  route: '/signup' },
  { id: 'account',  label: 'My account',     desc: 'Customer profile / dashboard', icon: Users,       group: 'portal',  route: '/account' },
  { id: 'orders',   label: 'My orders',      desc: 'Customer order history',       icon: Package,     group: 'portal',  route: '/account/orders' },
  { id: 'cart',     label: 'Cart',           desc: 'Shopping cart page',           icon: ShoppingCart, group: 'portal', route: '/cart' },
  { id: 'checkout', label: 'Checkout',       desc: 'Checkout / payment',           icon: ShoppingCart, group: 'portal', route: '/checkout' },
  { id: 'wishlist', label: 'Wishlist',       desc: 'Saved items page',             icon: Heart,       group: 'portal',  route: '/wishlist' },
  { id: 'search',   label: 'Search',         desc: 'Site-wide search',             icon: Search,      group: 'portal',  route: '/search' },
]

const LINK_GROUPS: { id: LinkTypeMeta['group']; label: string; desc: string }[] = [
  { id: 'basic',   label: 'Basic',    desc: 'URLs, anchors, pages' },
  { id: 'catalog', label: 'Catalog',  desc: 'Live products, services, categories, files' },
  { id: 'people',  label: 'People',   desc: 'Team, testimonials' },
  { id: 'stores',  label: 'Stores',   desc: 'Linked physical outlets / branches' },
  { id: 'actions', label: 'Actions',  desc: 'Booking, quotes, email, phone' },
  { id: 'portal',  label: 'Portal',   desc: 'Customer login, account, cart, checkout' },
]

function LinkEditorPopup({
  open, anchor, siteId, value, onSave, onClose,
}: {
  open: boolean
  anchor?: { x: number; y: number } | null
  siteId: string
  value: LinkValue
  onSave: (v: LinkValue) => void
  onClose: () => void
}) {
  const [type, setType] = useState<OverlayLinkType>(value.type || 'none')
  const [target, setTarget] = useState(value.target || '')
  const [label, setLabel] = useState(value.label || '')
  const [openNew, setOpenNew] = useState<boolean>(value.openInNewTab ?? false)
  const [activeGroup, setActiveGroup] = useState<LinkTypeMeta['group']>('basic')
  const [liveCache, setLiveCache] = useState<Partial<Record<LiveResource, LiveItem[]>>>({})
  const [pickerSearch, setPickerSearch] = useState('')
  const [loading, setLoading] = useState(false)
  // For multi-select link types (e.g. stores_multi) we keep the picked codes
  // in their own state so the UI can light up every chosen row while `target`
  // holds the serialized query (`/stores?branch=a,b,c`).
  const [multiSelected, setMultiSelected] = useState<string[]>([])
  const { ref, pos, headerMouseDown } = useDraggablePopup(open)

  useEffect(() => {
    if (!open) return
    setType(value.type || 'none')
    setTarget(value.target || '')
    setLabel(value.label || '')
    setOpenNew(value.openInNewTab ?? false)
    const meta = LINK_TYPES.find(t => t.id === (value.type || 'none'))
    setActiveGroup(meta?.group || 'basic')
    setPickerSearch('')
    // Seed multi-select from existing `?branch=a,b,c` in the saved target
    if (value.type === 'stores_multi' && value.target) {
      const m = value.target.match(/[?&]branch=([^&]+)/)
      setMultiSelected(m ? decodeURIComponent(m[1]).split(',').filter(Boolean) : [])
    } else {
      setMultiSelected([])
    }
  }, [open, value])

  const currentMeta = LINK_TYPES.find(t => t.id === type)
  const resource = currentMeta?.resource

  useEffect(() => {
    if (!open || !siteId || !resource) return
    if (liveCache[resource]) return
    setLoading(true)
    websiteApi.getLive(siteId, resource, { limit: 50 })
      .then(r => setLiveCache(prev => ({ ...prev, [resource]: r.items || [] })))
      .catch(() => setLiveCache(prev => ({ ...prev, [resource]: [] })))
      .finally(() => setLoading(false))
  }, [open, siteId, resource, liveCache])

  if (!open) return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const style: React.CSSProperties = pos
    ? { position: 'fixed', top: pos.y, left: pos.x, zIndex: 100000 }
    : anchor
      ? { position: 'fixed', top: Math.min(anchor.y, vh - 520), left: Math.min(anchor.x, vw - 480), zIndex: 100000 }
      : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 100000 }

  const save = () => {
    // Auto-apply route for predefined types that don't need user input
    let finalTarget = target.trim()
    if (!finalTarget && currentMeta?.route) finalTarget = currentMeta.route
    // Normalize mailto/tel/wa scheme
    if (type === 'email' && finalTarget && !finalTarget.startsWith('mailto:')) finalTarget = `mailto:${finalTarget}`
    if (type === 'phone' && finalTarget && !finalTarget.startsWith('tel:')) finalTarget = `tel:${finalTarget}`
    if (type === 'whatsapp' && finalTarget && !finalTarget.startsWith('http')) finalTarget = `https://wa.me/${finalTarget.replace(/\D/g, '')}`
    if (type === 'scroll' && finalTarget && !finalTarget.startsWith('#')) finalTarget = `#${finalTarget}`
    onSave({ type, target: finalTarget, label, openInNewTab: openNew })
    onClose()
  }

  const pickableList = resource ? (liveCache[resource] || []) : []
  const filteredList = pickerSearch.trim()
    ? pickableList.filter(it =>
        it.title?.toLowerCase().includes(pickerSearch.toLowerCase())
        || it.subtitle?.toLowerCase().includes(pickerSearch.toLowerCase()))
    : pickableList

  // Resolve URL for a live item based on link type
  const resolveLiveUrl = (item: LiveItem): string => {
    if (type === 'page') return item.url || '/'
    if (type === 'media') return item.url || (item.meta as any)?.original_url || ''
    if (type === 'download') {
      const u = item.url || (item.meta as any)?.original_url || ''
      return u ? `${u}${u.includes('?') ? '&' : '?'}download=1` : ''
    }
    if (type === 'testimonial') return `#testimonial-${item.id}`
    if (type === 'team_member') return item.url || `/team/${item.id}`
    if (type === 'category')    return item.url || `/categories/${item.id}`
    if (type === 'store') {
      const code = (item.meta as any)?.code || item.id
      return `?branch=${encodeURIComponent(String(code))}`
    }
    return item.url || `/${type}s/${item.id}`
  }

  // Code token used to identify a store in multi-select / ?branch=… params
  const storeCode = (item: LiveItem): string =>
    String((item.meta as any)?.code || item.id)

  // Toggle a store in/out of the multi-select set and update the serialized
  // target so Save Link captures the union of all picked branches.
  const toggleMultiStore = (item: LiveItem) => {
    const code = storeCode(item)
    setMultiSelected(prev => {
      const has = prev.includes(code)
      const next = has ? prev.filter(c => c !== code) : [...prev, code]
      const joined = next.map(encodeURIComponent).join(',')
      setTarget(next.length === 0 ? '/stores' : `/stores?branch=${joined}`)
      return next
    })
  }

  const typesInGroup = LINK_TYPES.filter(t => t.group === activeGroup)

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[99999]" onClick={onClose} />
      <div
        ref={ref}
        style={style}
        className="w-[460px] max-w-[94vw] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        <div
          className="px-4 py-3 bg-gradient-to-r from-primary to-emerald-700 text-white flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={headerMouseDown}
          title="Drag to move"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Move className="w-3 h-3 opacity-60 shrink-0" />
            <Link2 className="w-4 h-4 shrink-0" />
            <span className="text-sm font-bold truncate">Connect link or ERP item</span>
            {type !== 'none' && currentMeta && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-xs font-medium">{currentMeta.label}</span>
            )}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded hover:bg-white/20 shrink-0">
                <X className="w-4 h-4" />
          </button>
        </div>

        {/* Group tabs */}
        <div className="flex items-stretch border-b border-gray-100 bg-gray-50 shrink-0 overflow-x-auto">
          {LINK_GROUPS.map(g => {
            const active = activeGroup === g.id
            return (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className={cn(
                  'px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2',
                  active ? 'text-primary border-primary bg-white' : 'text-gray-500 border-transparent hover:text-primary hover:bg-white/60'
                )}
                title={g.desc}
              >
                {g.label}
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Type picker grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {typesInGroup.map(opt => {
              const active = type === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    setType(opt.id)
                    // Pre-fill target so the preview/Save link footer isn't
                    // empty while the user is still picking from the list.
                    if (opt.id === 'stores_multi') setTarget('/stores')
                    else setTarget(opt.route || '')
                    setPickerSearch('')
                    // Clear multi-select when switching away from a multi type
                    if (opt.id !== 'stores_multi') setMultiSelected([])
                  }}
                  className={cn(
                    'flex items-start gap-2 px-2.5 py-2 rounded-lg border text-left transition-all',
                    active ? 'border-primary/60 bg-accent ring-1 ring-ring' : 'border-gray-100 hover:border-primary/30 hover:bg-gray-50'
                  )}
                >
                  <opt.icon className={cn('w-4 h-4 shrink-0 mt-0.5', active ? 'text-primary' : 'text-gray-500')} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-gray-800">{opt.label}</div>
                    <div className="text-xs text-gray-400 truncate">{opt.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Note for action-type links */}
          {currentMeta?.note && (
            <div className="p-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-100">
              {currentMeta.note}
            </div>
          )}

          {/* Plain input for URL/email/phone/whatsapp/scroll */}
          {(type === 'url' || type === 'email' || type === 'phone' || type === 'whatsapp' || type === 'scroll') && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">
                {type === 'url' ? 'URL' :
                 type === 'email' ? 'Email address' :
                 type === 'phone' ? 'Phone number' :
                 type === 'whatsapp' ? 'WhatsApp number (with country code)' :
                 'Anchor id (without #)'}
              </label>
              <input
                autoFocus
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder={currentMeta?.inputHint}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {/* ── Stores multi-select — compact dropdown + chips UI ───────── */}
          {type === 'stores_multi' && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wide text-gray-400 block">
                Connected branches
              </label>

              {/* Selected chips row */}
              {multiSelected.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 p-2 border border-primary/30 rounded-xl bg-accent/70 min-h-[36px]">
                  {multiSelected.map(code => {
                    const item = pickableList.find(it => storeCode(it) === code)
                    return (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-white border border-primary/40 text-xs font-medium text-primary shadow-sm"
                      >
                        <StoreIcon className="w-3 h-3 text-primary/70 shrink-0" />
                        {item?.title || code}
                        <button type="button" aria-label="Close"
                          type="button"
                          onClick={() => toggleMultiStore(item || { id: code, title: code, subtitle: null, description: null, image_url: null, price: null, price_formatted: null, rating: null, url: null, meta: { code } })}
                          className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center text-primary/70 hover:bg-red-100 hover:text-red-600 transition-colors"
                        >
                <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400">
                  <StoreIcon className="w-3.5 h-3.5 opacity-40" />
                  No branches selected yet — pick from the dropdown below
                </div>
              )}

              {/* Dropdown selector — styled like the screenshot */}
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-primary/80" />
                </div>
              ) : pickableList.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-xl">
                  No stores found — add branches in KITERP first.
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      placeholder="Search stores…"
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ring bg-white"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-sm divide-y divide-gray-50">
                    {filteredList.map(item => {
                      const picked = multiSelected.includes(storeCode(item))
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleMultiStore(item)}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors',
                            picked ? 'bg-accent' : 'hover:bg-gray-50'
                          )}
                        >
                          <div className={cn(
                            'w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
                            picked ? 'bg-primary border-primary' : 'border-gray-300'
                          )}>
                            {picked && <Check className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={cn('font-semibold truncate', picked ? 'text-primary' : 'text-gray-800')}>
                              {item.title}
                            </div>
                            {item.subtitle && <div className="text-xs text-gray-400 truncate">{item.subtitle}</div>}
                          </div>
                          {(item.meta as any)?.code && (
                            <span className="text-xs font-mono text-gray-400 shrink-0 bg-gray-100 px-1.5 py-0.5 rounded">
                              {(item.meta as any).code}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex justify-between items-center pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const allCodes = pickableList.map(storeCode)
                        setMultiSelected(allCodes)
                        setTarget(`/stores?branch=${allCodes.map(encodeURIComponent).join(',')}`)
                      }}
                      className="text-xs text-primary font-semibold hover:text-primary"
                    >
                      Select all ({pickableList.length})
                    </button>
                    {multiSelected.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setMultiSelected([]); setTarget('/stores') }}
                        className="text-xs text-gray-400 font-semibold hover:text-red-500"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Standard live picker (non-stores_multi types) ─────────── */}
          {resource && type !== 'stores_multi' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  Pick from live {resource}
                </label>
                {pickableList.length > 6 && (
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      placeholder="Search…"
                      className="pl-6 pr-2 py-1 border border-gray-200 rounded-md text-xs w-32 focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                )}
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-primary/80" />
                </div>
              ) : filteredList.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg">
                  {pickerSearch ? 'No matches for ' : 'No live '}<b>{pickerSearch || resource}</b>{pickerSearch ? '.' : ' yet.'}
                  {!pickerSearch && <div className="mt-1 text-xs text-gray-400">Add them inside KITERP first.</div>}
                </div>
              ) : (
                <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-lg p-1 space-y-0.5 bg-gray-50/50">
                  {filteredList.map(item => {
                    const resolved = resolveLiveUrl(item)
                    const picked = target === resolved
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setTarget(resolved); setLabel(item.title) }}
                        className={cn(
                          'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs bg-white',
                          picked ? 'ring-1 ring-ring bg-accent' : 'hover:bg-accent/80'
                        )}
                      >
                        {item.image_url ? (
                          <img src={mediaUrl(item.image_url)} className="w-8 h-8 rounded object-cover shrink-0 bg-gray-100" alt="" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gradient-to-br from-accent to-primary/20 shrink-0 flex items-center justify-center">
                            {currentMeta && <currentMeta.icon className="w-3.5 h-3.5 text-primary/80" />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 truncate">{item.title}</div>
                          <div className="text-xs text-gray-400 truncate">
                            {item.subtitle || <span className="font-mono">{resolved}</span>}
                          </div>
                        </div>
                        {item.price_formatted && <div className="text-xs text-primary font-bold shrink-0">{item.price_formatted}</div>}
                        {picked && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Portal / action routes: show the target for transparency + allow override */}
          {currentMeta?.route && !resource && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Target route</label>
              <input
                value={target || currentMeta.route}
                onChange={e => setTarget(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">Default route for {currentMeta.label}. Customize if your site uses a different path.</p>
            </div>
          )}

          {/* Label override */}
          {type !== 'none' && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1 block">Button label (optional)</label>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Leave blank to keep current button text"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {type !== 'none' && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={openNew}
                onChange={e => setOpenNew(e.target.checked)}
                className="rounded text-primary"
              />
              <span className="text-xs text-gray-700">Open in new tab</span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
          <div className="flex-1 text-xs text-gray-500 truncate font-mono">
            {type === 'none' ? 'No link' : (target || currentMeta?.route || '—')}
          </div>
          <button onClick={onClose} className="btn-cancel px-3 py-2 rounded-lg text-xs font-medium text-gray-600 border border-[#ffc954]">Cancel</button>
          <button onClick={save} className="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary/90 flex items-center gap-1.5">
            <Link2 className="w-3 h-3" /> Save link
          </button>
        </div>
      </div>
    </>
  )
}

// ── Context Menu ──────────────────────────────────────────────────────────────
// A lightweight portal-free menu that can be opened anywhere in the builder
// (canvas block, overlay element). Actions are provided by the caller.

export interface ContextMenuAction {
  id: string
  label: string
  icon?: React.ElementType
  danger?: boolean
  divider?: boolean
  disabled?: boolean
  shortcut?: string
  onSelect?: () => void
  children?: ContextMenuAction[]
}

function ContextMenu({ open, x, y, actions, onClose }: {
  open: boolean
  x: number
  y: number
  actions: ContextMenuAction[]
  onClose: () => void
}) {
  const [submenu, setSubmenu] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    const h = () => onClose()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('click', h)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('click', h)
      window.removeEventListener('keydown', esc)
    }
  }, [open, onClose])

  if (!open) return null
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const left = Math.min(x, vw - 240)
  const top = Math.min(y, vh - Math.max(200, actions.length * 30))

  const renderAction = (a: ContextMenuAction) => {
    if (a.divider) return <div key={a.id} className="my-1 border-t border-gray-100" />
    return (
      <button
        key={a.id}
        disabled={a.disabled}
        onClick={e => {
          e.stopPropagation()
          if (a.children) {
            setSubmenu(submenu === a.id ? null : a.id)
            return
          }
          a.onSelect?.()
          onClose()
        }}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs font-medium rounded-md transition-colors',
          a.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-accent hover:text-primary',
          a.disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent',
        )}
      >
        {a.icon && <a.icon className="w-3.5 h-3.5 shrink-0" />}
        <span className="flex-1">{a.label}</span>
        {a.shortcut && <span className="text-xs text-gray-400 font-mono">{a.shortcut}</span>}
        {a.children && <ChevronRight className="w-3 h-3 text-gray-400" />}
      </button>
    )
  }

  const activeSub = actions.find(a => a.id === submenu)?.children

  return (
    <div
      style={{ position: 'fixed', top, left, zIndex: 100001 }}
      className="w-56 bg-white border border-gray-200 rounded-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100"
      onClick={e => e.stopPropagation()}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation() }}
    >
      {actions.map(renderAction)}
      {activeSub && (
        <div
          style={{ position: 'fixed', top, left: left + 224, zIndex: 100002 }}
          className="w-52 bg-white border border-gray-200 rounded-xl shadow-2xl py-1.5"
          onClick={e => e.stopPropagation()}
        >
          {activeSub.map(renderAction)}
        </div>
      )}
    </div>
  )
}

// ── Inline Editable Text ──────────────────────────────────────────────────────
// Click any text element of a selected block to edit it in-place (Odoo-style).
// Commits on blur / Enter (for headline-style single-line). Preserves styling.

const InlineTextStyleContext = React.createContext<{
  styleForKey: (key: string, base?: React.CSSProperties) => React.CSSProperties
  onActivateKey: (key: string) => void
} | null>(null)

let savedInlineTextSelection: { key: string; range: Range; root: HTMLElement } | null = null

function inferInlineTextStyleKey(onCommit: (v: string) => void): string | null {
  const src = Function.prototype.toString.call(onCommit)
  const commit = src.match(/commitProp\(['"`]([^'"`]+)['"`]/)
  if (commit?.[1]) return commit[1]
  const edit = src.match(/editItem\(['"`]([^'"`]+)['"`]\s*,\s*[^,]+,\s*['"`]([^'"`]+)['"`]/)
  if (edit?.[1] && edit?.[2]) return `${edit[1]}.${edit[2]}`
  return null
}

function hasInlineHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function rememberInlineTextSelection(root: HTMLElement | null, key: string | null) {
  if (!root || !key) return
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return
  if (range.collapsed) return
  savedInlineTextSelection = { key, range: range.cloneRange(), root }
}

function stylePatchToCss(patch: Record<string, unknown>): Partial<CSSStyleDeclaration> {
  const css: Partial<CSSStyleDeclaration> = {}
  if (typeof patch.text_color_override === 'string') css.color = patch.text_color_override
  if (typeof patch.font_size_px === 'number' && patch.font_size_px > 0) css.fontSize = `${Math.round(patch.font_size_px)}px`
  if (typeof patch.text_transform === 'string') css.textTransform = patch.text_transform
  return css
}

function applyInlineTextSelectionStyle(key: string | null | undefined, patch: Record<string, unknown>): boolean {
  if (!key || !savedInlineTextSelection || savedInlineTextSelection.key !== key) return false
  const { range, root } = savedInlineTextSelection
  if (!root.isConnected || range.collapsed) return false
  const css = stylePatchToCss(patch)
  if (!css.color && !css.fontSize && !css.textTransform) return false

  const span = document.createElement('span')
  if (css.color) span.style.color = css.color
  if (css.fontSize) span.style.fontSize = css.fontSize
  if (css.textTransform) span.style.textTransform = css.textTransform
  span.setAttribute('data-inline-style', 'true')

  try {
    const fragment = range.extractContents()
    span.appendChild(fragment)
    range.insertNode(span)
    const nextRange = document.createRange()
    nextRange.selectNodeContents(span)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(nextRange)
    savedInlineTextSelection = { key, range: nextRange.cloneRange(), root }
    root.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  } catch {
    return false
  }
}

function InlineEditableText({
  value,
  placeholder,
  multiline = false,
  editable = true,
  as: Tag = 'span',
  className,
  style,
  onCommit,
  styleKey,
  onActivate,
  onContextMenu,
}: {
  value: string
  placeholder?: string
  multiline?: boolean
  editable?: boolean
  as?: keyof JSX.IntrinsicElements
  className?: string
  style?: React.CSSProperties
  onCommit: (v: string) => void
  styleKey?: string
  onActivate?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLElement | null>(null)
  const styleCtx = React.useContext(InlineTextStyleContext)
  const inferredStyleKey = useMemo(() => styleKey || inferInlineTextStyleKey(onCommit), [styleKey, onCommit])
  const resolvedStyle = inferredStyleKey && styleCtx
    ? styleCtx.styleForKey(inferredStyleKey, style || {})
    : style

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus()
      // place caret at end
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(ref.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [editing])

  const commit = () => {
    const rawHtml = (ref.current?.innerHTML ?? '').trim()
    const rawText = (ref.current?.innerText ?? '').trim()
    const v = hasInlineHtml(rawHtml) ? rawHtml : rawText
    if (v !== value) onCommit(v)
    setEditing(false)
  }

  const commitLive = () => {
    const rawHtml = (ref.current?.innerHTML ?? '').trim()
    const rawText = (ref.current?.innerText ?? '').trim()
    const v = hasInlineHtml(rawHtml) ? rawHtml : rawText
    if (v !== value) onCommit(v)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { (ref.current as HTMLElement)?.blur(); e.preventDefault() }
    if (!multiline && e.key === 'Enter') { (ref.current as HTMLElement)?.blur(); e.preventDefault() }
  }

  const TagComponent = Tag as React.ElementType
  const displayValue = value || (editable ? (placeholder || 'Click to edit') : '')
  const richText = hasInlineHtml(displayValue)
  return (
    <TagComponent
      ref={ref as any}
      data-text-key={inferredStyleKey || undefined}
      contentEditable={editing}
      suppressContentEditableWarning
      spellCheck={editing}
      className={cn(
        className,
        editable && !editing && 'hover:outline hover:outline-1 hover:outline-ring/50 hover:outline-offset-2 cursor-text rounded',
        editing && 'outline outline-2 outline-ring outline-offset-2 rounded bg-white/40'
      )}
      style={{
        ...resolvedStyle,
        cursor: editable ? (editing ? 'text' : 'text') : resolvedStyle?.cursor,
        minWidth: editing ? 40 : undefined,
      }}
      onClick={(e: React.MouseEvent) => {
        if (editing) { e.stopPropagation(); return }
        if (editable) {
          e.stopPropagation()
          if (inferredStyleKey) styleCtx?.onActivateKey(inferredStyleKey)
          onActivate?.()
          setEditing(true)
        }
      }}
      onMouseDown={(e: React.MouseEvent) => { if (editing) e.stopPropagation() }}
      onMouseUp={() => rememberInlineTextSelection(ref.current, inferredStyleKey)}
      onKeyUp={() => rememberInlineTextSelection(ref.current, inferredStyleKey)}
      onInput={commitLive}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      onContextMenu={onContextMenu}
      {...(richText ? { dangerouslySetInnerHTML: { __html: displayValue } } : {})}
    >
      {richText ? null : displayValue}
    </TagComponent>
  )
}

// ── Item Menu Button ─────────────────────────────────────────────────────────
// Small ⋯ dropdown for array items on the canvas (features, plans, faqs, …).
// Provides Duplicate, Move up/down, Delete, plus caller-supplied extras.
function ItemMenuButton({
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
  extras,
}: {
  onDuplicate?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onDelete?: () => void
  extras?: { label: string; onClick: () => void; icon?: React.ReactNode }[]
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const item = (
    label: string,
    onClick: (() => void) | undefined,
    icon: React.ReactNode,
    tone: 'default' | 'danger' = 'default',
  ) => (
    <button
      key={label}
      type="button"
      disabled={!onClick}
      onClick={e => {
        e.stopPropagation()
        if (onClick) { onClick(); setOpen(false) }
      }}
      className={cn(
        'w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded transition-colors text-left',
        !onClick && 'opacity-40 cursor-not-allowed',
        onClick && tone === 'danger' && 'hover:bg-red-50 text-red-600',
        onClick && tone !== 'danger' && 'hover:bg-gray-100 text-gray-700',
      )}
    >
      <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  )

  return (
    <div
      ref={rootRef}
      className="absolute top-1 right-1 z-20 opacity-0 group-hover/item:opacity-100 transition-opacity"
      onClick={e => e.stopPropagation()}
    >
      <button
        type="button"
        title="Item actions"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center shadow-md border text-gray-700 transition-colors',
          open ? 'bg-primary text-white border-primary' : 'bg-white hover:bg-gray-50 border-gray-200',
        )}
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute top-8 right-0 w-44 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-30">
          {item('Duplicate', onDuplicate, <Copy className="w-3 h-3" />)}
          {item('Move up', onMoveUp, <ChevronUp className="w-3 h-3" />)}
          {item('Move down', onMoveDown, <ChevronDown className="w-3 h-3" />)}
          {extras && extras.length > 0 && <div className="my-1 border-t border-gray-100" />}
          {extras?.map(ex => item(ex.label, ex.onClick, ex.icon ?? <Settings2 className="w-3 h-3" />))}
          <div className="my-1 border-t border-gray-100" />
          {item('Delete', onDelete, <Trash2 className="w-3 h-3" />, 'danger')}
        </div>
      )}
    </div>
  )
}

// ── Inline Editable Rich Text (HTML) ─────────────────────────────────────────
// For blocks that store HTML content (e.g. rich_text). When editable, a single
// click focuses the contenteditable area preserving formatting; commits the
// resulting innerHTML on blur.
function InlineEditableRichText({
  html,
  editable = true,
  className,
  style,
  onCommit,
}: {
  html: string
  editable?: boolean
  className?: string
  style?: React.CSSProperties
  onCommit: (html: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus()
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(ref.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [editing])

  const commit = () => {
    const next = ref.current?.innerHTML ?? ''
    if (next !== html) onCommit(next)
    setEditing(false)
  }

  return (
    <div
      ref={ref}
      contentEditable={editing}
      suppressContentEditableWarning
      className={cn(
        className,
        editable && !editing && 'hover:outline hover:outline-1 hover:outline-ring/50 hover:outline-offset-2 rounded cursor-text',
        editing && 'outline outline-2 outline-ring outline-offset-2 rounded bg-white/40'
      )}
      style={style}
      onClick={(e) => {
        if (editing) { e.stopPropagation(); return }
        if (editable) { e.stopPropagation(); setEditing(true) }
      }}
      onMouseDown={(e) => { if (editing) e.stopPropagation() }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Escape') { (ref.current as HTMLElement)?.blur(); e.preventDefault() } }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function OverlayElement({
  item, isSelected, containerRef, onSelect, onUpdate, onDelete,
  onOpenAiForImage, onOpenMediaForImage, onPickLocalImage, onImageFileDrop,
  onEditLink, onContextMenu, onRequestText,
}: {
  item: BlockOverlayItem
  isSelected: boolean
  containerRef: React.RefObject<HTMLDivElement>
  onSelect: () => void
  onUpdate: (u: Partial<BlockOverlayItem>) => void
  onDelete: () => void
  onOpenAiForImage?: () => void
  onOpenMediaForImage?: () => void
  onPickLocalImage?: () => void
  onImageFileDrop?: (file: File) => void
  onEditLink?: (anchor: { x: number; y: number }) => void
  onContextMenu?: (e: React.MouseEvent) => void
  // Open the styled text prompt (title/prompt/placeholder/current value)
  onRequestText?: (opts: {
    title: string
    subtitle?: string
    placeholder?: string
    initialValue?: string
    multiline?: boolean
    maxLength?: number
    anchor?: { x: number; y: number } | null
    onSave: (v: string) => void
  }) => void
}) {
  const [textEditing, setTextEditing] = useState(false)

  const startDrag = useCallback((e: React.MouseEvent) => {
    if (textEditing) return
    e.stopPropagation(); e.preventDefault()
    const startX = e.clientX - item.x
    const startY = e.clientY - item.y
    const container = containerRef.current
    document.body.style.cursor = 'move'
    const onMove = (mv: MouseEvent) => {
      const cw = container?.clientWidth || 800
      const ch = container?.clientHeight || 400
      onUpdate({
        x: Math.max(0, Math.min(cw - item.w, mv.clientX - startX)),
        y: Math.max(0, Math.min(ch - 20, mv.clientY - startY)),
      })
    }
    const onUp = () => { document.body.style.cursor = ''; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [textEditing, item.x, item.y, item.w, containerRef, onUpdate])

  const startResize = useCallback((e: React.MouseEvent, handle: string) => {
    e.stopPropagation(); e.preventDefault()
    const sx = e.clientX, sy = e.clientY
    const ox = item.x, oy = item.y, ow = item.w, oh = item.h
    document.body.style.cursor = OVERLAY_RESIZE_CURSORS[handle]
    const onMove = (mv: MouseEvent) => {
      const dx = mv.clientX - sx, dy = mv.clientY - sy
      let nx = ox, ny = oy, nw = ow, nh = oh
      if (handle.includes('e')) nw = Math.max(40, ow + dx)
      if (handle.includes('w')) { nx = ox + dx; nw = Math.max(40, ow - dx) }
      if (handle.includes('s')) nh = Math.max(20, oh + dy)
      if (handle.includes('n')) { ny = oy + dy; nh = Math.max(20, oh - dy) }
      onUpdate({ x: nx, y: ny, w: nw, h: nh })
    }
    const onUp = () => { document.body.style.cursor = ''; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [item.x, item.y, item.w, item.h, onUpdate])

  const renderContent = () => {
    const commonStyle: React.CSSProperties = {
      width: '100%', height: '100%',
      backgroundColor: item.bgColor || 'transparent',
      borderRadius: item.borderRadius || 0,
      border: item.borderColor ? `${item.borderWidth || 2}px solid ${item.borderColor}` : undefined,
      boxShadow: item.shadow ? '0 8px 32px rgba(0,0,0,0.15)' : undefined,
      opacity: (item.opacity ?? 100) / 100,
      overflow: 'hidden',
    }
    switch (item.type) {
      case 'text':
        return (
          <div
            contentEditable={textEditing}
            suppressContentEditableWarning
            onDoubleClick={e => { e.stopPropagation(); setTextEditing(true) }}
            onBlur={e => { setTextEditing(false); onUpdate({ text: e.currentTarget.innerText }) }}
            style={{ ...commonStyle,
              fontSize: item.fontSize || 16, fontWeight: item.fontWeight || 'normal',
              fontStyle: item.italic ? 'italic' : undefined,
              color: item.color || '#111827', textAlign: item.align || 'left',
              padding: '6px 10px', display: 'flex', alignItems: 'center', wordBreak: 'break-word',
              outline: textEditing ? '2px solid #64C3A0' : 'none', cursor: textEditing ? 'text' : 'move',
            }}
          >
            {item.text || (textEditing ? '' : 'Double-click to edit')}
          </div>
        )
      case 'image':
        return item.src ? (
          <img src={mediaUrl(item.src)} style={{ width: '100%', height: '100%', objectFit: item.objectFit || 'cover', borderRadius: item.borderRadius || 0 }} alt="" draggable={false} />
        ) : (
          <div
            style={{ ...commonStyle, backgroundColor: item.bgColor || '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}
            onClick={e => {
              e.stopPropagation()
              if (onPickLocalImage) onPickLocalImage()
              else if (onRequestText) {
                onRequestText({
                  title: 'Set image URL',
                  subtitle: 'Paste a direct image URL — or close and use AI / Media library instead.',
                  placeholder: 'https://…/image.jpg',
                  onSave: v => { if (v) onUpdate({ src: v }) },
                })
              }
            }}
            onDragOver={onImageFileDrop ? e => { e.preventDefault(); e.stopPropagation() } : undefined}
            onDrop={onImageFileDrop ? e => {
              e.preventDefault(); e.stopPropagation()
              const f = e.dataTransfer.files?.[0]
              if (f) onImageFileDrop(f)
            } : undefined}
          >
            <svg viewBox="0 0 24 24" style={{ width: 28, height: 28, fill: '#9ca3af' }}><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-8.5-5.5l2.5 3.01L18 12l4 5H6l3.5-4.5z"/></svg>
            <span style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>Click to upload — or AI, Lib, URL</span>
          </div>
        )
      case 'button': {
        const hasLink = item.linkType && item.linkType !== 'none' && (item.linkTarget || item.href)
        return (
          <div
            style={{ ...commonStyle, backgroundColor: item.bgColor || '#64C3A0', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
            title={item.description || (hasLink ? `Link → ${item.linkLabel || item.linkTarget}` : 'Click to edit')}
          >
            <span style={{ fontSize: item.fontSize || 14, fontWeight: item.fontWeight || 'bold', color: item.color || '#ffffff' }}>
              {item.text || 'Button'}
            </span>
            {hasLink && (
              <span
                style={{
                  position: 'absolute', top: -8, right: -8, width: 16, height: 16,
                  backgroundColor: '#10b981', color: '#fff',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 'bold', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                }}
                title={`${item.linkType}: ${item.linkLabel || item.linkTarget}`}
              >
                🔗
              </span>
            )}
          </div>
        )
      }
      case 'box':
        return <div style={commonStyle} />
      case 'badge':
        return (
          <div style={{ ...commonStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: item.bgColor || '#64C3A0' }}>
            <span style={{ fontSize: item.fontSize || 12, fontWeight: 'bold', color: item.color || '#ffffff', whiteSpace: 'nowrap' }}>
              {item.text || 'Badge'}
            </span>
          </div>
        )
      case 'video':
        return (
          <div style={{ ...commonStyle, backgroundColor: item.bgColor || '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {item.src ? (
              <video src={item.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls={false} />
            ) : (
              <svg viewBox="0 0 24 24" style={{ width: 36, height: 36, fill: 'rgba(255,255,255,0.7)' }}><path d="M8 5v14l11-7z"/></svg>
            )}
          </div>
        )
      default: return null
    }
  }

  return (
    <div
      style={{
        position: 'absolute', left: item.x, top: item.y, width: item.w, height: item.h,
        zIndex: item.zIndex || 10, cursor: textEditing ? 'text' : 'move', userSelect: 'none',
      }}
      onClick={e => { e.stopPropagation(); onSelect() }}
      onMouseDown={e => { onSelect(); if (!textEditing) startDrag(e) }}
      onContextMenu={e => { if (onContextMenu) { e.preventDefault(); e.stopPropagation(); onSelect(); onContextMenu(e) } }}
      onDoubleClick={e => {
        if (item.type === 'text') { e.stopPropagation(); setTextEditing(true); return }
        if (item.type === 'button' && onEditLink) {
          e.stopPropagation(); e.preventDefault()
          onEditLink({ x: e.clientX, y: e.clientY })
        }
      }}
    >
      {renderContent()}
      {isSelected && !textEditing && (
        <>
          {/* Selection ring */}
          <div style={{ position: 'absolute', inset: -2, border: '2px solid #64C3A0', borderRadius: 3, pointerEvents: 'none', zIndex: 1 }} />
          {/* Resize handles */}
          {Object.keys(OVERLAY_HANDLE_POS).map(h => (
            <div key={h} onMouseDown={e => startResize(e, h)} style={{
              position: 'absolute', width: 10, height: 10,
              backgroundColor: '#64C3A0', border: '2px solid #fff',
              borderRadius: 2, cursor: OVERLAY_RESIZE_CURSORS[h], zIndex: 2,
              ...OVERLAY_HANDLE_POS[h],
            }} />
          ))}
          {/* Delete button — inside top-right corner so it's always clickable
              (putting it at top:-24 puts it behind the BlockDesignBar z-30) */}
          <button onMouseDown={e => { e.stopPropagation(); onDelete() }} style={{
            position: 'absolute', top: 4, right: 4, width: 20, height: 20,
            backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 4,
            cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 5, boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }} title="Delete element (or press Del)">×</button>
          {/* Inline style mini-bar — rendered BELOW the element so it is
              never occluded by the BlockDesignBar which sits at top of block */}
          <div style={{
            position: 'absolute', top: item.h + 6, left: 0, display: 'flex', gap: 2, zIndex: 5,
            backgroundColor: '#1f2937', borderRadius: 6, padding: '2px 6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            {(item.type === 'text' || item.type === 'button' || item.type === 'badge') && (
              <>
                <input type="color" value={item.color || '#111827'}
                  onChange={e => onUpdate({ color: e.target.value })}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 18, height: 18, border: 'none', borderRadius: 3, cursor: 'pointer', padding: 0 }} title="Text color" />
                <input type="number" value={item.fontSize || 16}
                  onChange={e => onUpdate({ fontSize: Number(e.target.value) })}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 32, height: 18, fontSize: 9, border: 'none', borderRadius: 3, textAlign: 'center', backgroundColor: '#374151', color: '#fff' }} title="Font size" />
              </>
            )}
            <input type="color" value={item.bgColor || '#ffffff'}
              onChange={e => onUpdate({ bgColor: e.target.value })}
              onClick={e => e.stopPropagation()}
              style={{ width: 18, height: 18, border: 'none', borderRadius: 3, cursor: 'pointer', padding: 0 }} title="Background" />
            <input type="number" value={item.borderRadius || 0}
              onChange={e => onUpdate({ borderRadius: Number(e.target.value) })}
              onClick={e => e.stopPropagation()}
              style={{ width: 28, height: 18, fontSize: 9, border: 'none', borderRadius: 3, textAlign: 'center', backgroundColor: '#374151', color: '#fff' }} title="Border radius" />
            {(item.type === 'text' || item.type === 'button' || item.type === 'badge') && (
              <button onMouseDown={e => {
                e.stopPropagation()
                if (item.type === 'text') { setTextEditing(true); return }
                if (onRequestText) {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  onRequestText({
                    title: `Edit ${item.type} label`,
                    placeholder: item.type === 'button' ? 'e.g. Book Now' : 'e.g. NEW',
                    initialValue: item.text || '',
                    anchor: { x: rect.left, y: rect.bottom + 4 },
                    onSave: v => onUpdate({ text: v }),
                  })
                }
              }}
                style={{ height: 18, padding: '0 4px', fontSize: 9, backgroundColor: '#64C3A0', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 'bold' }}
                title={item.type === 'text' ? 'Double-click text to edit inline' : 'Edit label'}>
                {item.type === 'text' ? 'Edit' : 'Text'}
              </button>
            )}
            {(item.type === 'button' || item.type === 'badge' || item.type === 'text' || item.type === 'image') && onEditLink && (
              <button
                onMouseDown={e => {
                  e.stopPropagation()
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                  onEditLink({ x: rect.left, y: rect.bottom + 4 })
                }}
                style={{
                  height: 18, padding: '0 5px', fontSize: 9,
                  backgroundColor: item.linkType && item.linkType !== 'none' ? '#10b981' : '#374151',
                  color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 'bold',
                  display: 'flex', alignItems: 'center', gap: 2,
                }}
                title={
                  item.linkType && item.linkType !== 'none'
                    ? `${item.linkType}: ${item.linkLabel || item.linkTarget}`
                    : 'Connect link / ERP item'
                }
              >
                🔗 {item.linkType && item.linkType !== 'none' ? 'Linked' : 'Link'}
              </button>
            )}
            {(item.type === 'button' || item.type === 'badge') && (
              <button
                onMouseDown={e => {
                  e.stopPropagation()
                  if (onRequestText) {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    onRequestText({
                      title: 'Button description',
                      subtitle: 'Shown as tooltip on hover and used for screen-reader labels (aria-label).',
                      placeholder: 'Book a table for 4 guests',
                      initialValue: item.description || '',
                      multiline: true,
                      maxLength: 160,
                      anchor: { x: rect.left, y: rect.bottom + 4 },
                      onSave: v => onUpdate({ description: v }),
                    })
                  }
                }}
                style={{ height: 18, padding: '0 4px', fontSize: 9, backgroundColor: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 'bold' }}
                title="Add a description / tooltip"
              >
                i
              </button>
            )}
            {item.type === 'image' && (
              <>
                {onPickLocalImage && (
                  <button onMouseDown={e => { e.stopPropagation(); onPickLocalImage() }}
                    style={{ height: 18, padding: '0 4px', fontSize: 9, backgroundColor: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 'bold' }}
                    title="Upload from your computer">
                    Up
                  </button>
                )}
                {onOpenAiForImage && (
                  <button onMouseDown={e => { e.stopPropagation(); onOpenAiForImage() }}
                    style={{ height: 18, padding: '0 4px', fontSize: 9, backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 'bold' }}
                    title="Open AI image generator">
                    AI
                  </button>
                )}
                {onOpenMediaForImage && (
                  <button onMouseDown={e => { e.stopPropagation(); onOpenMediaForImage() }}
                    style={{ height: 18, padding: '0 4px', fontSize: 9, backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: 'bold' }}
                    title="Open media library">
                    Lib
                  </button>
                )}
                <button
                  onMouseDown={e => {
                    e.stopPropagation()
                    if (onRequestText) {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      onRequestText({
                        title: 'Set image URL',
                        placeholder: 'https://…/image.jpg',
                        initialValue: item.src || '',
                        anchor: { x: rect.left, y: rect.bottom + 4 },
                        onSave: v => { if (v) onUpdate({ src: v }) },
                      })
                    }
                  }}
                  style={{ height: 18, padding: '0 4px', fontSize: 9, backgroundColor: '#64C3A0', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}>
                  URL
                </button>
              </>
            )}
          </div>
          {/* Dimensions badge */}
          <div style={{
            position: 'absolute', top: item.h + 32, left: 0, fontSize: 9, color: '#9ca3af',
            backgroundColor: 'rgba(31,41,55,0.85)', borderRadius: 3, padding: '1px 5px', pointerEvents: 'none',
          }}>
            {Math.round(item.w)}×{Math.round(item.h)} px
          </div>
        </>
      )}
    </div>
  )
}

function BlockOverlayCanvas({
  overlays, isEditing, onUpdate, onOverlaySelectionChange, onOpenAiImageTools, onOpenMediaLibrary,
  onPickLocalImage, onImageFileDrop, onEditLinkForOverlay, onOverlayContextMenu, onRequestText,
}: {
  overlays: BlockOverlayItem[]
  isEditing: boolean
  onUpdate?: (overlays: BlockOverlayItem[]) => void
  onOverlaySelectionChange?: (selectedId: string | null) => void
  onOpenAiImageTools?: () => void
  onOpenMediaLibrary?: () => void
  onPickLocalImage?: () => void
  onImageFileDrop?: (file: File) => void
  onEditLinkForOverlay?: (item: BlockOverlayItem, anchor: { x: number; y: number }) => void
  onOverlayContextMenu?: (item: BlockOverlayItem, e: React.MouseEvent) => void
  onRequestText?: (opts: {
    title: string
    subtitle?: string
    placeholder?: string
    initialValue?: string
    multiline?: boolean
    maxLength?: number
    anchor?: { x: number; y: number } | null
    onSave: (v: string) => void
  }) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const setSelected = useCallback((id: string | null) => {
    setSelectedId(id)
    onOverlaySelectionChange?.(id)
  }, [onOverlaySelectionChange])

  useEffect(() => {
    if (!isEditing) {
      setSelectedId(null)
      onOverlaySelectionChange?.(null)
    }
  }, [isEditing, onOverlaySelectionChange])

  useEffect(() => {
    if (selectedId && !overlays.some(o => o.id === selectedId)) {
      setSelectedId(null)
      onOverlaySelectionChange?.(null)
    }
  }, [overlays, selectedId, onOverlaySelectionChange])

  const updateItem = useCallback((id: string, updates: Partial<BlockOverlayItem>) => {
    if (!onUpdate) return
    onUpdate(overlays.map(o => o.id === id ? { ...o, ...updates } : o))
  }, [overlays, onUpdate])

  const deleteItem = useCallback((id: string) => {
    if (!onUpdate) return
    onUpdate(overlays.filter(o => o.id !== id))
    setSelected(null)
  }, [overlays, onUpdate, setSelected])

  // Keyboard Delete/Escape for selected overlay element
  useEffect(() => {
    if (!isEditing) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const isInput = tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable
      if (isInput) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.stopPropagation()
        deleteItem(selectedId)
      }
      if (e.key === 'Escape' && selectedId) {
        setSelected(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [isEditing, selectedId, deleteItem, setSelected])

  if (!overlays.length && !isEditing) return null

  const minH = overlays.length > 0 ? Math.max(...overlays.map(o => o.y + o.h + 20)) : 0

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute', inset: 0, zIndex: 15,
        // Container itself never blocks clicks — lets them pass through to the
        // underlying inline-editable text. Each overlay item re-enables pointer
        // events on itself so it's still interactive.
        pointerEvents: 'none',
        minHeight: isEditing && minH > 0 ? minH : undefined,
      }}
      onClick={e => { if (e.target === containerRef.current) setSelected(null) }}
    >
      {overlays.map(item => (
        <div key={item.id} style={{ pointerEvents: isEditing ? 'auto' : 'none' }}>
          <OverlayElement
            item={item}
            isSelected={isEditing && selectedId === item.id}
            containerRef={containerRef as React.RefObject<HTMLDivElement>}
            onSelect={() => setSelected(item.id)}
            onUpdate={updates => updateItem(item.id, updates)}
            onDelete={() => deleteItem(item.id)}
            onOpenAiForImage={item.type === 'image' ? onOpenAiImageTools : undefined}
            onOpenMediaForImage={item.type === 'image' ? onOpenMediaLibrary : undefined}
            onPickLocalImage={item.type === 'image' ? onPickLocalImage : undefined}
            onImageFileDrop={item.type === 'image' ? onImageFileDrop : undefined}
            onEditLink={onEditLinkForOverlay ? (anchor) => onEditLinkForOverlay(item, anchor) : undefined}
            onContextMenu={onOverlayContextMenu ? (e) => onOverlayContextMenu(item, e) : undefined}
            onRequestText={onRequestText}
          />
        </div>
      ))}
    </div>
  )
}

// ── Section shape dividers (Origins) ─────────────────────────────────────────

const SHAPE_SVG_PATHS: Record<string, string> = {
  wave:        'M0,32 C166,64 333,0 500,32 C666,64 833,0 1000,32 L1000,64 L0,64 Z',
  wave_soft:   'M0,48 C250,0 750,64 1000,48 L1000,64 L0,64 Z',
  curve:       'M0,64 Q500,0 1000,64 L1000,64 L0,64 Z',
  curve_deep:  'M0,64 Q500,-32 1000,64 L1000,64 L0,64 Z',
  slant:       'M0,64 L1000,0 L1000,64 Z',
  slant_r:     'M0,0 L1000,64 L0,64 Z',
  arrow_down:  'M0,0 L500,64 L1000,0 L1000,64 L0,64 Z',
  arrow_up:    'M0,64 L500,0 L1000,64 Z',
  zigzag:      'M0,32 L62,0 L125,32 L187,0 L250,32 L312,0 L375,32 L437,0 L500,32 L562,0 L625,32 L687,0 L750,32 L812,0 L875,32 L937,0 L1000,32 L1000,64 L0,64 Z',
  triangle:    'M0,64 L500,0 L1000,64 Z',
  tilt:        'M0,0 L1000,32 L1000,64 L0,64 Z',
}

const SHAPE_OPTIONS = [
  { id: 'none',       label: '⊘ None' },
  { id: 'wave',       label: '〜 Wave' },
  { id: 'wave_soft',  label: '〰 Soft Wave' },
  { id: 'curve',      label: '⌣ Curve' },
  { id: 'curve_deep', label: '⌢ Deep Curve' },
  { id: 'slant',      label: '/ Slant →' },
  { id: 'slant_r',    label: '\\ Slant ←' },
  { id: 'arrow_down', label: '▼ Arrow' },
  { id: 'arrow_up',   label: '▲ Arrow Up' },
  { id: 'zigzag',     label: '⋀ Zigzag' },
  { id: 'triangle',   label: '△ Triangle' },
  { id: 'tilt',       label: '⬡ Tilt' },
]

function SectionShapeDivider({ shape, fillColor, position }: {
  shape: string
  fillColor: string
  position: 'top' | 'bottom'
}) {
  const path = SHAPE_SVG_PATHS[shape]
  if (!path) return null
  return (
    <div
      className="absolute left-0 right-0 pointer-events-none overflow-hidden z-10"
      style={{ height: 64, ...(position === 'bottom' ? { bottom: 0 } : { top: 0 }) }}
    >
      <svg
        viewBox="0 0 1000 64"
        preserveAspectRatio="none"
        className="w-full h-full"
        style={{ transform: position === 'top' ? 'scaleY(-1)' : undefined }}
      >
        <path d={path} fill={fillColor || '#ffffff'} />
      </svg>
    </div>
  )
}

// ── Block canvas preview renderer ─────────────────────────────────────────────

function BlockPreview({
  block, style, isSelected, isEditing,
  onOverlayUpdate, onOverlaySelectionChange,
  onOpenAiImageTools, onOpenMediaLibrary,
  onPickLocalImage, onImageFileDrop,
  onPropsUpdate, onEditLinkForOverlay, onOverlayContextMenu,
  onEditPropLink, onRequestText, onNavigatePage,
  activeTextField, onActiveTextFieldChange,
}: {
  block: WebsiteBlock
  style: StyleConfig
  isSelected: boolean
  isEditing: boolean
  onOverlayUpdate?: (overlays: BlockOverlayItem[]) => void
  onOverlaySelectionChange?: (selectedId: string | null) => void
  onOpenAiImageTools?: () => void
  onOpenMediaLibrary?: () => void
  onPickLocalImage?: () => void
  onImageFileDrop?: (file: File) => void
  // In-block inline editing: commit a block prop update
  onPropsUpdate?: (patch: BlockProps) => void
  // Overlay link editor (per-overlay)
  onEditLinkForOverlay?: (item: BlockOverlayItem, anchor: { x: number; y: number }) => void
  onOverlayContextMenu?: (item: BlockOverlayItem, e: React.MouseEvent) => void
  // Block-level prop link editor (opens LinkEditor to set cta_primary_url, etc.)
  onEditPropLink?: (propKey: string, anchor: { x: number; y: number }) => void
  // Builder-page navigation for links rendered inside the preview nav block.
  onNavigatePage?: (url: string) => void
  activeTextField?: string | null
  onActiveTextFieldChange?: (key: string | null) => void
  // Styled text prompt (replaces native prompt)
  onRequestText?: (opts: {
    title: string
    subtitle?: string
    placeholder?: string
    initialValue?: string
    multiline?: boolean
    maxLength?: number
    anchor?: { x: number; y: number } | null
    onSave: (v: string) => void
  }) => void
}) {
  // Inline edit commit helper — writes to block.props when user edits in-place
  const commitProp = (key: string, value: unknown) => {
    if (!onPropsUpdate) return
    onPropsUpdate({ ...block.props, [key]: value } as BlockProps)
  }

  // Inline edit helper for array items — updates a single field within an array item
  const editItem = (arrayKey: string, idx: number, field: string, value: unknown) => {
    if (!onPropsUpdate) return
    const arr = [...(((block.props as any)[arrayKey] as any[]) || [])]
    arr[idx] = { ...arr[idx], [field]: value }
    onPropsUpdate({ ...block.props, [arrayKey]: arr } as BlockProps)
  }

  // Remove an item from an array prop by index
  const removeItem = (arrayKey: string, idx: number) => {
    if (!onPropsUpdate) return
    const arr = [...(((block.props as any)[arrayKey] as any[]) || [])]
    arr.splice(idx, 1)
    onPropsUpdate({ ...block.props, [arrayKey]: arr } as BlockProps)
  }

  // Append a new item to an array prop
  const addItem = (arrayKey: string, template: any) => {
    if (!onPropsUpdate) return
    const arr = [...(((block.props as any)[arrayKey] as any[]) || [])]
    arr.push(template)
    onPropsUpdate({ ...block.props, [arrayKey]: arr } as BlockProps)
  }

  // Duplicate an existing item (inserts a deep copy right after it)
  const duplicateItem = (arrayKey: string, idx: number) => {
    if (!onPropsUpdate) return
    const arr = [...(((block.props as any)[arrayKey] as any[]) || [])]
    if (idx < 0 || idx >= arr.length) return
    const copy = JSON.parse(JSON.stringify(arr[idx]))
    arr.splice(idx + 1, 0, copy)
    onPropsUpdate({ ...block.props, [arrayKey]: arr } as BlockProps)
  }

  // Move an item up/down in its array by swapping positions
  const moveItem = (arrayKey: string, idx: number, direction: 'up' | 'down') => {
    if (!onPropsUpdate) return
    const arr = [...(((block.props as any)[arrayKey] as any[]) || [])]
    const target = direction === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= arr.length) return
    ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
    onPropsUpdate({ ...block.props, [arrayKey]: arr } as BlockProps)
  }

  // canEdit: true when the block is selected in editing mode with a commit handler
  const canEdit = isEditing && !!onPropsUpdate

  const fieldStyles = ((block.props as any)._field_styles || {}) as Record<string, Record<string, unknown>>
  const styleForField = (key: string, base: React.CSSProperties = {}): React.CSSProperties => {
    const fs = fieldStyles[key] || {}
    return {
      ...base,
      ...(typeof fs.text_color_override === 'string' ? { color: fs.text_color_override } : {}),
      ...(typeof fs.font_size_px === 'number' && fs.font_size_px > 0 ? { fontSize: `${fs.font_size_px}px` } : {}),
      ...(typeof fs.text_transform === 'string' ? { textTransform: fs.text_transform as React.CSSProperties['textTransform'] } : {}),
      ...(activeTextField === key && canEdit ? { outline: '2px solid rgba(124,58,237,0.7)', outlineOffset: 3, borderRadius: 4 } : {}),
    }
  }

  // Shorthand: render an InlineEditableText for a block prop as any HTML element
  const IET = (
    key: string,
    as: keyof JSX.IntrinsicElements,
    className: string,
    style: React.CSSProperties,
    placeholder: string,
    multiline?: boolean,
  ) => (
    <InlineEditableText
      value={((p as any)[key] ?? '') as string}
      placeholder={placeholder}
      multiline={multiline}
      editable={canEdit}
      as={as}
      className={className}
      style={styleForField(key, style)}
      onCommit={v => commitProp(key, v)}
      onActivate={() => onActiveTextFieldChange?.(key)}
    />
  )

  // Floating delete button for a single array item. Positioned absolute at the
  // top-right of the container it's placed in; appears on hover when canEdit.
  const ItemActions = (arrayKey: string, idx: number, label = 'item') => {
    if (!canEdit) return null
    return (
      <button
        type="button"
        title={`Delete ${label}`}
        onClick={e => { e.stopPropagation(); removeItem(arrayKey, idx) }}
        className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-lg flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity"
      >
        ×
      </button>
    )
  }

  // Inline "Add item" button rendered at the end of an array list. Uses the
  // supplied template for the new item's initial shape.
  const AddItemBtn = (arrayKey: string, template: any, label = 'Add item') => {
    if (!canEdit) return null
    return (
      <button
        type="button"
        onClick={e => { e.stopPropagation(); addItem(arrayKey, template) }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-dashed border-primary/40 text-primary hover:border-primary hover:bg-accent text-xs font-medium transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> {label}
      </button>
    )
  }

  // Dropdown menu (⋯) positioned on the top-right of an array item. Offers
  // Duplicate / Move up / Move down / Delete, plus any extra actions supplied
  // by the caller (e.g. "Change icon" for features).
  const ItemMenu = (
    arrayKey: string,
    idx: number,
    total: number,
    extras?: { label: string; onClick: () => void; icon?: React.ReactNode }[],
  ) => {
    if (!canEdit) return null
    return <ItemMenuButton
      onDuplicate={() => duplicateItem(arrayKey, idx)}
      onMoveUp={idx > 0 ? () => moveItem(arrayKey, idx, 'up') : undefined}
      onMoveDown={idx < total - 1 ? () => moveItem(arrayKey, idx, 'down') : undefined}
      onDelete={() => removeItem(arrayKey, idx)}
      extras={extras}
    />
  }

  // CTA button with inline label editing + hover "🔗 Link" chip
  const CTABtn = (
    labelKey: string,
    urlKey: string,
    defaultLabel: string,
    cls: string,
    sty?: React.CSSProperties,
  ) => {
    const rawLabel = ((p as any)[labelKey] as string | undefined) || defaultLabel
    const isLinked = !!((p as any)[urlKey])
    return (
      <div className="relative inline-flex group/ctabtn">
        <button className={cls} style={sty}>
          {canEdit
            ? (
              <InlineEditableText
                value={rawLabel}
                placeholder={defaultLabel}
                editable
                as="span"
                style={styleForField(labelKey)}
                onCommit={v => commitProp(labelKey, v)}
                onActivate={() => onActiveTextFieldChange?.(labelKey)}
              />
            ) : rawLabel
          }
        </button>
        {canEdit && onEditPropLink && (
          <button
            className={cn(
              'absolute -top-5 left-0 px-1.5 py-0.5 rounded text-xs font-bold text-white opacity-0 group-hover/ctabtn:opacity-100 transition-opacity whitespace-nowrap z-20',
              isLinked ? 'bg-emerald-500' : 'bg-gray-500',
            )}
            onMouseDown={e => {
              e.stopPropagation()
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              onEditPropLink(urlKey, { x: rect.left, y: rect.bottom + 4 })
            }}
          >
            🔗 {isLinked ? 'Linked' : 'Link'}
          </button>
        )}
      </div>
    )
  }
  const p = block.props
  const isTemplateBlock = !!(p as any)?._template_block
  /** Site theme only — per-block `_template_style` is not merged so preview matches the live business front. */
  const effectiveStyle: StyleConfig = style
  const ds = (p as any)?.data_source
  const dsType = normalizeSourceType(ds?.type)

  // Resolve the site id from the URL so BlockPreview can hit /live/{resource}
  const { siteId } = useParams<{ siteId: string }>()

  const [liveItems, setLiveItems] = useState<LiveItem[]>([])
  const [liveProfile, setLiveProfile] = useState<LiveItem | null>(null)
  const [livePages, setLivePages] = useState<LiveItem[]>([])
  const [liveKpis, setLiveKpis] = useState<LiveItem[]>([])
  const [liveLoading, setLiveLoading] = useState(false)

  // Unified live-data loader: binds any block to /live/{resource}
  useEffect(() => {
    if (!siteId || !dsType || dsType === 'external_api') return
    let cancelled = false
    setLiveLoading(true)
    websiteApi.getLive(siteId, dsType as LiveResource, { limit: ds?.limit || 12 })
      .then(r => {
        if (cancelled) return
        const items = r.items || []
        const filtered = ds?.selected_ids?.length
          ? items.filter(x => ds.selected_ids.includes(x.id))
          : items
        if (dsType === 'profile') {
          setLiveProfile(filtered[0] || items[0] || null)
        } else if (dsType === 'pages') {
          setLivePages(filtered)
        } else if (dsType === 'kpis') {
          setLiveKpis(filtered)
        } else {
          setLiveItems(filtered)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLiveLoading(false) })
    return () => { cancelled = true }
  }, [siteId, dsType, ds?.limit, JSON.stringify(ds?.selected_ids)])

  // Back-compat aliases used by existing block renderers below
  const liveProducts = dsType === 'products' ? liveItems : []
  const liveServices = dsType === 'services' ? liveItems : []
  const liveTestimonials = dsType === 'testimonials' ? liveItems : []
  const liveTeam = dsType === 'team' ? liveItems : []
  const liveCategories = dsType === 'categories' ? liveItems : []
  const liveMedia = dsType === 'media' ? liveItems : []
  const liveCustomers = dsType === 'customers' ? liveItems : []
  const liveBookings = dsType === 'bookings' ? liveItems : []

  const { primary_color, accent_color, bg_color, text_color, font_heading, font_body, border_radius } = effectiveStyle
  const radiusMap = { sharp: '0px', rounded: '12px', pill: '999px' }
  const r = radiusMap[border_radius] || '12px'

  const ptop = (block.style_overrides?.padding_top as number) ?? ((p as any).padding_top as number) ?? 0
  const pbot = (block.style_overrides?.padding_bottom as number) ?? ((p as any).padding_bottom as number) ?? 0
  const blockShadow = (p as any).block_shadow as string | undefined
  const gradientPreset = (p as any).gradient_preset as string | undefined

  const overrideBg = (p as any).bg_color_override as string | undefined || block.style_overrides?.bg_color as string | undefined
  const textColorOverride = (p as any).text_color_override as string | undefined
  const fontSizePxRaw = (p as any).font_size_px as number | undefined
  const fontSizePx =
    typeof fontSizePxRaw === 'number' && Number.isFinite(fontSizePxRaw) && fontSizePxRaw > 0
      ? Math.round(Math.min(FONT_SIZE_PX_MAX, Math.max(FONT_SIZE_PX_MIN, fontSizePxRaw)))
      : undefined
  const textScale = (p as any).text_scale as number | undefined
  const textTfRaw = (p as any).text_transform as string | undefined
  const textTransformCss =
    textTfRaw && ['uppercase', 'lowercase', 'capitalize'].includes(textTfRaw.toLowerCase())
      ? textTfRaw.toLowerCase()
      : undefined
  const topShape = (p as any).top_shape as string | undefined
  const bottomShape = (p as any).bottom_shape as string | undefined
  const shapeColor = (p as any).shape_color as string | undefined

  const minHeight = (p as any).min_height as number | undefined

  const containerStyle: React.CSSProperties = {
    fontFamily: font_body,
    color: textColorOverride || block.style_overrides?.text_color as string || text_color,
    backgroundColor: overrideBg || 'transparent',
    paddingTop: ptop ? ptop + 'px' : undefined,
    paddingBottom: pbot ? pbot + 'px' : undefined,
    boxShadow: blockShadow && blockShadow !== 'none' ? blockShadow : undefined,
    minHeight: minHeight ? `${minHeight}px` : undefined,
    '--tile-bg': (p as any).tile_bg || 'transparent',
    '--tile-accent': (p as any).tile_accent || primary_color,
    '--tile-text': (p as any).tile_text || text_color,
    '--tile-border': (p as any).tile_border || 'transparent',
  } as React.CSSProperties

  if (!block.visible) {
    return (
      <div className="py-4 px-6 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-center text-sm text-gray-400">
        Hidden block ({block.block_type})
      </div>
    )
  }

  const renderBlock = () => {
    if (block.block_type.includes('.')) {
      return <CommerceLibraryPreview blockType={block.block_type} props={p as Record<string, unknown>} liveItems={liveItems} />
    }

    switch (block.block_type) {
      case 'announcement_bar':
        return (
          <div style={{ backgroundColor: p.color || primary_color, color: '#fff' }} className="py-2.5 px-6 text-center text-sm font-medium flex items-center justify-center gap-2">
            {IET('text', 'span', '', {}, 'Special announcement — Double-click to edit')}
          </div>
        )

      case 'marquee_strip': {
        const raw = (p as any).items ?? (p as any).text ?? ''
        const items = Array.isArray(raw)
          ? raw.map((x: any) => String(x).trim()).filter(Boolean)
          : String(raw).split(',').map(s => s.trim()).filter(Boolean)
        return (
          <div
            className="overflow-hidden border-b py-4"
            style={{ borderColor: `${text_color}18`, backgroundColor: bg_color }}
          >
            <div className="builder-marquee-track whitespace-nowrap" style={{ fontFamily: font_heading }}>
              {items.length === 0 ? (
                <span className="text-sm opacity-60 px-4">Add comma-separated items in Properties → text</span>
              ) : (
                Array.from({ length: 2 }).map((_, dup) => (
                  <span key={dup} className="inline-flex items-center gap-10 mr-10 text-sm opacity-80">
                    {items.map((item, j) => (
                      <span key={`${dup}-${j}`} className="inline-flex items-center gap-4">
                        <span>{item}</span>
                        {j < items.length - 1 ? <span className="opacity-40">·</span> : null}
                      </span>
                    ))}
                  </span>
                ))
              )}
            </div>
          </div>
        )
      }

      case 'nav': {
        const liveBrandLogo = (dsType === 'profile' && (liveProfile?.meta as any)?.logo_url) || null
        const liveBrand = (dsType === 'profile' && (liveProfile?.meta as any)?.business_name) || null
        const navLinksFromPages = dsType === 'pages'
          ? livePages.map(pg => ({ label: pg.title, url: pg.url || '/' }))
          : []
        const displayLinks = navLinksFromPages.length
          ? navLinksFromPages
          : (p.nav_links as any[] || [{ label: 'Home' }, { label: 'About' }, { label: 'Contact' }])
        const logoSrc = p.brand_logo || liveBrandLogo
        const brandName = p.brand || liveBrand || 'Your Brand'
        const navUrl = (link: any) => {
          if (typeof link === 'string') return link.toLowerCase() === 'home' ? '/' : `/${link.toLowerCase().replace(/\s+/g, '-')}`
          if (link.url) return String(link.url)
          const label = String(link.label || '')
          return label.toLowerCase() === 'home' ? '/' : `/${label.toLowerCase().replace(/\s+/g, '-')}`
        }
        // Nav background may be set by the template (e.g. restaurant dark nav)
        const navBg = ((p as any).nav_bg as string) || (effectiveStyle.nav_bg as string) || '#ffffff'
        const _nH = navBg.replace('#', '')
        const _nR = parseInt(_nH.substring(0, 2), 16) || 0
        const _nG = parseInt(_nH.substring(2, 4), 16) || 0
        const _nB = parseInt(_nH.substring(4, 6), 16) || 0
        const navIsDark = (_nR + _nG + _nB) < 382
        const navTextCol = navIsDark ? 'rgba(255,255,255,0.85)' : '#4B5563'
        const navBrandCol = navIsDark ? '#ffffff' : primary_color
        return (
          <div
            className="flex items-center justify-between py-3 px-6 gap-4 relative"
            style={{ backgroundColor: navBg, borderBottom: `1px solid ${navIsDark ? 'rgba(255,255,255,0.08)' : '#f3f4f6'}` }}
          >
            <div className="shrink-0 relative group/logo leading-tight">
              <div className="font-bold text-base" style={{ fontFamily: font_heading, color: navBrandCol }}>
              {logoSrc
                ? (
                  <div className="relative inline-block">
                    <img src={mediaUrl(logoSrc as string)} className="h-8 object-contain" alt="logo" />
                    {canEdit && (
                      <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover/logo:opacity-100 transition-opacity bg-black/40 rounded">
                        <label title="Replace logo" className="cursor-pointer p-1 bg-white/90 rounded text-xs font-bold text-gray-700 hover:bg-white flex items-center gap-0.5">
                          <Upload className="w-3 h-3" />
                          <input type="file" accept="image/*" className="hidden" onChange={async e => {
                            const file = e.target.files?.[0]; e.target.value = ''
                            if (!file || !siteId) return
                            try {
                              const saved = await websiteApi.uploadMedia(siteId, file)
                              commitProp('brand_logo', saved.original_url)
                            } catch { toast.error('Upload failed') }
                          }} />
                        </label>
                        <button type="button" aria-label="Close" title="Remove logo" type="button" onClick={e => { e.stopPropagation(); commitProp('brand_logo', '') }} className="p-1 bg-white/90 rounded text-xs font-bold text-red-600 hover:bg-white">
                <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )
                : (
                  <div className="flex items-center gap-2">
                    <InlineEditableText value={brandName} placeholder="Your Brand" editable={canEdit} as="span" onCommit={v => commitProp('brand', v)} />
                    {canEdit && (
                      <label title="Upload logo" className="cursor-pointer opacity-0 group-hover/logo:opacity-100 transition-opacity p-1 rounded bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-0.5 text-xs font-bold whitespace-nowrap">
                        <Upload className="w-3 h-3" /> Logo
                        <input type="file" accept="image/*" className="hidden" onChange={async e => {
                          const file = e.target.files?.[0]; e.target.value = ''
                          if (!file || !siteId) return
                          try {
                            const saved = await websiteApi.uploadMedia(siteId, file)
                            commitProp('brand_logo', saved.original_url)
                          } catch { toast.error('Upload failed') }
                        }} />
                      </label>
                    )}
                  </div>
                )
              }
              </div>
              {(p as any).tagline ? (
                <div className="text-xs uppercase tracking-[0.18em] opacity-70 mt-0.5" style={{ color: navTextCol }}>
                  <InlineEditableText
                    value={String((p as any).tagline)}
                    placeholder="Tagline"
                    editable={canEdit}
                    as="span"
                    onCommit={v => commitProp('tagline' as any, v)}
                  />
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-4 flex-1 justify-center flex-wrap">
              {displayLinks.slice(0, 8).map((l: any, i: number) => (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={e => {
                    e.stopPropagation()
                    onNavigatePage?.(navUrl(l))
                  }}
                  onKeyDown={e => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    e.stopPropagation()
                    onNavigatePage?.(navUrl(l))
                  }}
                  className="relative group/line flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent transition-colors"
                  title={onNavigatePage ? `Open ${l.label || l}` : undefined}
                >
                  <InlineEditableText
                    value={l.label || l}
                    placeholder="Nav Link"
                    editable={canEdit && !navLinksFromPages.length && !onNavigatePage}
                    as="span"
                    className="text-sm"
                    style={{ color: navTextCol }}
                    onCommit={v => {
                      const links = [...(p.nav_links as any[] || [{ label: 'Home' }, { label: 'About' }, { label: 'Contact' }])]
                      links[i] = { ...links[i], label: v }
                      commitProp('nav_links', links)
                    }}
                  />
                  {canEdit && !navLinksFromPages.length && (
                    <button type="button" title="Remove link"
                      onClick={e => {
                        e.stopPropagation()
                        const links = [...(p.nav_links as any[] || [])]
                        links.splice(i, 1)
                        commitProp('nav_links', links)
                      }}
                      className="opacity-0 group-hover/line:opacity-100 transition-opacity w-4 h-4 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center"
                    >×</button>
                  )}
                </div>
              ))}
              {canEdit && !navLinksFromPages.length && (
                <button type="button"
                  onClick={e => {
                    e.stopPropagation()
                    const links = [...(p.nav_links as any[] || []), { label: 'New Link', url: '/' }]
                    commitProp('nav_links', links)
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-primary hover:bg-accent border border-dashed border-primary/40"
                ><Plus className="w-3 h-3" /> Link</button>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {p.show_search && (
                <button type="button" className="p-2 rounded-lg hover:opacity-70 transition-opacity" style={{ color: navTextCol }} aria-label="Search">
                  <Search className="w-5 h-5" />
                </button>
              )}
              {p.show_cart && (
                <button type="button" className="p-2 rounded-lg hover:opacity-70 transition-opacity relative" style={{ color: navTextCol }} aria-label="Cart">
                  <ShoppingBag className="w-5 h-5" />
                </button>
              )}
              {(p.cta_label || canEdit) && (
                <button style={{ backgroundColor: primary_color, borderRadius: r, color: '#fff' }} className="px-4 py-2 text-sm font-semibold whitespace-nowrap">
                  <InlineEditableText value={(p.cta_label as string) || ''} placeholder="CTA" editable={canEdit} as="span" onCommit={v => commitProp('cta_label', v)} />
                </button>
              )}
            </div>
            {dsType === 'pages' && navLinksFromPages.length > 0 && (
              <div className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live: site pages" />
            )}
          </div>
        )
      }

      case 'hero':
      case 'hero_split':
      case 'hero_minimal': {
        const isSplit = p.layout === 'split' || block.block_type === 'hero_split'
        const isMinimal = block.block_type === 'hero_minimal' || p.bg_style === 'minimal'
        const heroGrad = gradientPreset || ((p as any).gradient_from && (p as any).gradient_to
          ? `linear-gradient(${(p as any).gradient_dir || '135deg'}, ${(p as any).gradient_from}, ${(p as any).gradient_to})`
          : `linear-gradient(135deg, ${primary_color}, ${effectiveStyle.secondary_color})`)
        const heroImageUrl = (p.bg_image_url || ((p as any).bg_style === 'image' ? (p as any).image_url : undefined)) as string | undefined
        const sideImageUrl = ((p as any).image_url || p.bg_image_url) as string | undefined
        const hasSideImage = isSplit && !!sideImageUrl
        const hasBgImg = !!heroImageUrl
        // Split + right column image should NOT reuse full-bleed background (matches business front gallery look).
        const useFullBleedImageBg = hasBgImg && !hasSideImage
        const heroBg = useFullBleedImageBg && p.bg_style === 'gradient'
          ? heroGrad
          : useFullBleedImageBg && p.bg_style === 'dark' ? '#111827'
          : useFullBleedImageBg && hasBgImg ? undefined
          : hasSideImage ? (effectiveStyle.surface_color || bg_color || '#ffffff')
          : p.bg_style === 'gradient' ? heroGrad
          : p.bg_style === 'dark' ? '#111827'
          : isMinimal ? bg_color
          : `linear-gradient(135deg, ${bg_color}, ${effectiveStyle.surface_color})`
        const heroBgImage = useFullBleedImageBg && hasBgImg ? `url(${mediaUrl(heroImageUrl as string)})` : undefined
        const isDark = useFullBleedImageBg && (p.bg_style === 'gradient' || p.bg_style === 'dark' || hasBgImg)
        const heroText = isDark ? '#fff' : text_color
        const heroSubText = isDark ? 'rgba(255,255,255,0.82)' : `${text_color}cc`
        const headlineLine2 = (p as any).headline_line2 as string | undefined
        const eyebrowPlain = !!(p as any).eyebrow_plain
        const squareCta = !!(p as any).cta_square || (effectiveStyle.border_radius as string) === 'none'
        const ctaRadius = squareCta ? 0 : r
        const ctaPadClass = squareCta ? 'px-7 h-12' : 'px-6 py-3'
        const splitSideBySide = isSplit && hasSideImage && !useFullBleedImageBg

        return (
          <div
            style={{
              ...(splitSideBySide
                ? { color: heroText, borderBottom: `1px solid ${text_color}18`, position: 'relative' as const }
                : {
                    background: heroBg,
                    backgroundImage: heroBgImage,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    color: heroText,
                    position: 'relative',
                  }),
            }}
            className={cn(
              splitSideBySide
                ? 'px-0 py-0 flex flex-col md:flex-row md:items-stretch'
                : isSplit
                  ? 'px-8 flex flex-col md:flex-row items-center gap-10 py-16'
                  : 'px-8 py-24',
            )}
          >
            {/* Dark overlay for full-bleed image heroes only */}
            {useFullBleedImageBg && hasBgImg && (
              <div className="absolute inset-0 bg-black/45" style={{ zIndex: 0 }} />
            )}
            <div
              className={cn(
                'space-y-5 relative z-10',
                splitSideBySide && 'flex-1 md:w-1/2 px-6 sm:px-12 py-16 lg:py-28 flex flex-col justify-center max-w-xl md:max-w-none',
                isSplit && !splitSideBySide && 'flex-1 max-w-xl',
                !isSplit && 'text-center max-w-3xl mx-auto',
              )}
              style={{
                zIndex: 1,
                ...(splitSideBySide ? { backgroundColor: effectiveStyle.surface_color || bg_color || '#ffffff' } : {}),
              }}
            >
              {(p.eyebrow || isEditing) && (
                eyebrowPlain ? (
                  <InlineEditableText
                    value={p.eyebrow || ''}
                    placeholder="AUTUMN / WINTER"
                    editable={isEditing}
                    as="div"
                    className="text-xs uppercase tracking-[0.3em] opacity-70 mb-2"
                    style={{ color: heroText }}
                    onCommit={v => commitProp('eyebrow', v)}
                  />
                ) : (
                  <InlineEditableText
                    value={p.eyebrow || ''}
                    placeholder="EYEBROW LABEL"
                    editable={isEditing}
                    as="div"
                    className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : `${accent_color}22`, color: isDark ? '#fff' : accent_color }}
                    onCommit={v => commitProp('eyebrow', v)}
                  />
                )
              )}
              {headlineLine2 || (isEditing && isSplit) ? (
                <h1
                  className={cn(
                    'font-semibold leading-[0.95] text-balance',
                    isSplit
                      ? (headlineLine2 || eyebrowPlain ? 'text-5xl sm:text-6xl lg:text-7xl' : 'text-4xl sm:text-5xl md:text-6xl')
                      : 'text-3xl',
                  )}
                  style={{ fontFamily: font_heading, color: heroText }}
                >
                  <InlineEditableText
                    value={p.headline || ''}
                    placeholder="Quiet luxury,"
                    editable={isEditing}
                    as="span"
                    className="block font-semibold"
                    onCommit={v => commitProp('headline', v)}
                  />
                  <br />
                  <em className="font-normal" style={{ fontStyle: 'italic', color: isDark ? 'rgba(255,255,255,0.95)' : accent_color }}>
                    <InlineEditableText
                      value={headlineLine2 || ''}
                      placeholder="built to last."
                      editable={isEditing}
                      as="span"
                      onCommit={v => commitProp('headline_line2' as any, v)}
                    />
                  </em>
                </h1>
              ) : (
                <InlineEditableText
                  value={p.headline || ''}
                  placeholder="Your Compelling Headline Here"
                  editable={isEditing}
                  as="h1"
                  style={{ fontFamily: font_heading, color: heroText }}
                  className="text-3xl font-extrabold leading-tight"
                  onCommit={v => commitProp('headline', v)}
                />
              )}
              {(p.subtitle || isEditing) && p.subtitle !== p.headline && (
                <InlineEditableText
                  value={p.subtitle || ''}
                  placeholder="Add a punchy subtitle that sells the value"
                  editable={isEditing}
                  multiline
                  as="p"
                  className={cn('text-base leading-relaxed max-w-lg text-pretty', isSplit && !isDark && 'opacity-80')}
                  style={{ color: heroSubText, margin: isSplit ? undefined : '0 auto' }}
                  onCommit={v => commitProp('subtitle', v)}
                />
              )}
              <div className={cn('flex gap-3 flex-wrap pt-1 items-start', !isSplit && 'justify-center')}>
                {(p.cta_primary || isEditing) && (
                  <div className="relative group">
                    <button
                      style={{
                        backgroundColor: isDark ? '#fff' : primary_color,
                        color: isDark ? primary_color : '#fff',
                        borderRadius: ctaRadius,
                      }}
                      className={cn('font-bold text-sm shadow-lg hover:opacity-90 transition-opacity', ctaPadClass)}
                      onDoubleClick={e => {
                        if (isEditing && onEditPropLink) {
                          e.preventDefault(); e.stopPropagation()
                          onEditPropLink('cta_primary', { x: e.clientX, y: e.clientY })
                        }
                      }}
                    >
                      <InlineEditableText
                        value={p.cta_primary || ''}
                        placeholder="Primary CTA"
                        editable={isEditing}
                        as="span"
                        onCommit={v => commitProp('cta_primary', v)}
                      />
                    </button>
                    {isEditing && onEditPropLink && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          onEditPropLink('cta_primary', { x: rect.left, y: rect.bottom + 4 })
                        }}
                        className={cn(
                          'absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs shadow-md transition-opacity',
                          (p as any).cta_primary_url ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-white opacity-0 group-hover:opacity-100'
                        )}
                        title={(p as any).cta_primary_url ? `Linked → ${(p as any).cta_primary_url}` : 'Connect link / ERP item'}
                      >
                        🔗
                      </button>
                    )}
                  </div>
                )}
                {(p.cta_secondary || isEditing) && p.cta_secondary !== p.cta_primary && (
                  <div className="relative group">
                    <button
                      style={{
                        border: `2px solid ${isDark ? 'rgba(255,255,255,0.5)' : `${text_color}99`}`,
                        color: heroText,
                        borderRadius: ctaRadius,
                      }}
                      className={cn('font-semibold text-sm bg-transparent hover:opacity-80 transition-opacity', ctaPadClass)}
                      onDoubleClick={e => {
                        if (isEditing && onEditPropLink) {
                          e.preventDefault(); e.stopPropagation()
                          onEditPropLink('cta_secondary', { x: e.clientX, y: e.clientY })
                        }
                      }}
                    >
                      <InlineEditableText
                        value={p.cta_secondary || ''}
                        placeholder="Secondary CTA"
                        editable={isEditing}
                        as="span"
                        onCommit={v => commitProp('cta_secondary', v)}
                      />
                    </button>
                    {isEditing && onEditPropLink && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          onEditPropLink('cta_secondary', { x: rect.left, y: rect.bottom + 4 })
                        }}
                        className={cn(
                          'absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs shadow-md transition-opacity',
                          (p as any).cta_secondary_url ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-white opacity-0 group-hover:opacity-100'
                        )}
                        title={(p as any).cta_secondary_url ? `Linked → ${(p as any).cta_secondary_url}` : 'Connect link / ERP item'}
                      >
                        🔗
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {isSplit && (
              <div
                className={cn('relative z-10 w-full', splitSideBySide ? 'md:w-1/2 min-h-[420px] md:min-h-[640px]' : 'flex-1 md:w-auto')}
                style={{ zIndex: 1, ...(splitSideBySide ? { backgroundColor: effectiveStyle.surface_color || '#f3f4f6' } : {}) }}
              >
                {(p.image_url || p.bg_image_url) ? (
                  <img
                    src={mediaUrl((p.image_url || p.bg_image_url) as string)}
                    className={cn(
                      'w-full object-cover',
                      splitSideBySide
                        ? 'absolute inset-0 h-full min-h-[420px] md:min-h-[640px]'
                        : cn('shadow-2xl', hasSideImage && !useFullBleedImageBg ? 'rounded-none md:min-h-[420px] min-h-[260px]' : 'rounded-2xl'),
                    )}
                    style={splitSideBySide ? undefined : (hasSideImage && !useFullBleedImageBg ? { maxHeight: '640px' } : { maxHeight: '340px', minHeight: '220px' })}
                    alt=""
                    onError={e => {
                      const el = e.target as HTMLImageElement
                      el.style.display = 'none'
                      const ph = el.nextElementSibling as HTMLElement | null
                      if (ph) ph.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div
                  style={{
                    borderRadius: splitSideBySide ? 0 : '16px',
                    background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)',
                    border: isDark ? '2px dashed rgba(255,255,255,0.3)' : '2px dashed rgba(0,0,0,0.12)',
                    display: (p.image_url || p.bg_image_url) ? 'none' : 'flex',
                  }}
                  className={cn(
                    'items-center justify-center flex-col gap-2',
                    splitSideBySide ? 'absolute inset-0 min-h-[420px] md:min-h-[640px]' : 'w-full h-56',
                  )}
                >
                  <ImageIcon className={cn('w-8 h-8', isDark ? 'text-white/40' : 'text-gray-300')} />
                  <span className={cn('text-sm font-medium', isDark ? 'text-white/50' : 'text-gray-400')}>Add image via Media tab</span>
                </div>
              </div>
            )}
          </div>
        )
      }

      case 'features':
      case 'features_alternating': {
        const cols = (p as any).columns || 3
        const featGap = (p as any).item_gap ?? 20
        const feats = (p.features as any[] || [
          { title: 'Feature One', desc: 'Description of this amazing feature.' },
          { title: 'Feature Two', desc: 'Another key benefit of your product.' },
          { title: 'Feature Three', desc: 'Why customers love working with you.' },
        ]).slice(0, 9)
        const icons = ['⚡', '🎯', '🚀', '💡', '🛡️', '🌟']
        return (
          <div className="py-14 px-8" style={{ backgroundColor: bg_color }}>
            {(p.eyebrow || canEdit) && (
              <div className="text-center mb-3">
                {IET('eyebrow', 'span', 'text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full', { backgroundColor: `${accent_color}22`, color: accent_color }, 'Eyebrow label')}
              </div>
            )}
            {(p.title || canEdit) && IET('title', 'h2', 'text-2xl font-bold text-center mb-3', { fontFamily: font_heading, color: text_color }, 'Section Title')}
            {(p.description || canEdit) && IET('description', 'p', 'text-center mb-10 max-w-xl mx-auto text-sm', { color: `${text_color}99` }, 'Add a description…', true)}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: `${featGap}px` }}>
              {feats.map((f: any, i: number) => (
                <div key={i} style={{ backgroundColor: effectiveStyle.surface_color, borderRadius: r, borderTop: `3px solid ${primary_color}` }} className="p-5 space-y-2.5 shadow-sm relative group/item">
                  {ItemMenu('features', i, feats.length, [
                    {
                      label: 'Change icon',
                      icon: <Sparkles className="w-3 h-3" />,
                      onClick: () => {
                        if (!onRequestText) return
                        onRequestText({
                          title: 'Set feature icon',
                          subtitle: 'Paste an emoji (⚡ 🎯 🚀 💡 🛡️ 🌟) or a short text glyph.',
                          placeholder: '⚡',
                          initialValue: f.icon || '',
                          onSave: v => editItem('features', i, 'icon', v),
                        })
                      },
                    },
                    {
                      label: 'Set image URL',
                      icon: <ImageIcon className="w-3 h-3" />,
                      onClick: () => {
                        if (!onRequestText) return
                        onRequestText({
                          title: 'Feature image',
                          subtitle: 'Paste a direct image URL — leave blank to use the icon instead.',
                          placeholder: 'https://…/image.jpg',
                          initialValue: f.image_url || '',
                          onSave: v => editItem('features', i, 'image_url', v || null),
                        })
                      },
                    },
                    {
                      label: f.link ? 'Edit link' : 'Add link',
                      icon: <Link2 className="w-3 h-3" />,
                      onClick: () => {
                        if (!onRequestText) return
                        onRequestText({
                          title: 'Feature link',
                          subtitle: 'Where should clicking this feature take visitors?',
                          placeholder: 'https://…',
                          initialValue: f.link || '',
                          onSave: v => editItem('features', i, 'link', v || null),
                        })
                      },
                    },
                  ])}
                  {f.image_url
                    ? <img src={mediaUrl(f.image_url)} className="w-full h-28 object-cover rounded-lg mb-2" alt="" />
                    : <div className="text-2xl mb-1">{f.icon || icons[i % icons.length]}</div>
                  }
                  <InlineEditableText value={f.title || ''} placeholder={`Feature ${i + 1}`} editable={canEdit} as="h3"
                    className="font-bold text-sm" style={{ fontFamily: font_heading, color: text_color }}
                    onCommit={v => editItem('features', i, 'title', v)} />
                  <InlineEditableText value={f.desc || ''} placeholder="Describe this feature here." editable={canEdit} multiline as="p"
                    className="text-xs leading-relaxed" style={{ color: `${text_color}99` }}
                    onCommit={v => editItem('features', i, 'desc', v)} />
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="mt-6 text-center">
                {AddItemBtn('features', { title: 'New Feature', desc: 'Describe this feature.', icon: '⚡' }, 'Add feature')}
              </div>
            )}
          </div>
        )
      }

      case 'stats':
      case 'counters':
      case 'impact_stats': {
        const isLive = dsType === 'kpis' && liveKpis.length > 0
        const hiddenIds = ((p as any).hidden_kpi_ids as string[] | undefined) || []
        const liveStats = isLive
          ? liveKpis
              .filter(k => !hiddenIds.includes(k.id))
              .map(k => ({ value: k.title, label: k.subtitle || k.id }))
          : null
        const statsItems: any[] = liveStats || (p.stats as any[] || [
          { value: '10K+', label: 'Happy Customers' },
          { value: '99%', label: 'Satisfaction Rate' },
          { value: '24/7', label: 'Support' },
          { value: '50+', label: 'Countries' },
        ])
        const gridCols = statsItems.length >= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'
        return (
          <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {isLive && (
              <div className="flex items-center justify-center gap-1.5 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-600 font-semibold">Live · your business data</span>
              </div>
            )}
            {(p.title || canEdit) && IET('title', 'h2', 'text-3xl font-bold text-gray-900 mb-10 text-center', { fontFamily: font_heading, color: '#111827' }, 'By the Numbers')}
            <div className={cn('grid gap-8 text-center', gridCols)}>
              {statsItems.map((s: any, i: number) => (
                <div key={i} className="p-6 bg-white rounded-2xl border border-gray-100 relative group/item">
                  {!isLive && ItemActions('stats', i, 'stat')}
                  <InlineEditableText value={s.value || ''} placeholder="99%" editable={canEdit && !isLive} as="div"
                    className="text-4xl font-bold mb-2" style={{ fontFamily: font_heading, color: primary_color }}
                    onCommit={v => editItem('stats', i, 'value', v)} />
                  <InlineEditableText value={s.label || ''} placeholder="Metric label" editable={canEdit && !isLive} as="div"
                    className="text-gray-500 text-sm font-medium"
                    style={{}}
                    onCommit={v => editItem('stats', i, 'label', v)} />
                </div>
              ))}
            </div>
            {!isLive && canEdit && (
              <div className="mt-6 text-center">
                {AddItemBtn('stats', { value: '100+', label: 'New Metric' }, 'Add stat')}
              </div>
            )}
            {!isLive && dsType === 'kpis' && (
              <p className="text-center text-gray-400 text-xs mt-4">Loading live KPIs…</p>
            )}
          </section>
        )
      }

      case 'testimonials':
      case 'testimonials_grid': {
        const isLive = dsType === 'testimonials' && liveTestimonials.length > 0
        const testis: any[] = isLive
          ? liveTestimonials.map(t => ({
              name: t.title,
              role: t.subtitle,
              company: (t.meta as any)?.company,
              quote: t.description,
              rating: t.rating,
              avatar_url: t.image_url,
              _live: true,
            }))
          : (p.testimonials as any[] || [
              { quote: 'This product has completely transformed how we work. Highly recommended!', name: 'Sarah J.', role: 'CEO', rating: 5 },
              { quote: 'Incredible quality and amazing support team. Worth every penny.', name: 'Mike R.', role: 'Designer', rating: 5 },
            ])
        return (
          <div className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {(p.title || canEdit) && IET('title', 'h2', 'text-3xl font-bold text-gray-900 mb-10 text-center', { fontFamily: font_heading, color: '#111827' }, 'What Our Customers Say')}
            {isLive && (
              <div className="flex items-center justify-center gap-1.5 mb-6">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-600 font-semibold">Live · verified reviews (4★+)</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {testis.slice(0, 6).map((t: any, i: number) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 relative group/item">
                  {!t._live && ItemActions('testimonials', i, 'testimonial')}
                  <Quote className="w-8 h-8 opacity-10 absolute top-4 right-4" style={{ color: primary_color }} />
                  {!!t.rating && (
                    <div className="flex gap-0.5 mb-3">
                      {Array.from({ length: 5 }).map((_, si) => (
                        <Star
                          key={si}
                          className={`w-4 h-4 ${si < Math.min(5, t.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                        />
                      ))}
                    </div>
                  )}
                  <InlineEditableText value={t.quote || ''} placeholder="Customer testimonial quote…" editable={canEdit && !t._live} multiline as="p"
                    className="text-gray-600 text-sm leading-relaxed mb-4"
                    style={{}}
                    onCommit={v => editItem('testimonials', i, 'quote', v)} />
                  <div className="flex items-center gap-3">
                    {t.avatar_url
                      ? <img src={mediaUrl(t.avatar_url)} alt={t.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                      : (
                        <div style={{ backgroundColor: primary_color, borderRadius: '50%' }} className="w-10 h-10 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {(t.name || '?')[0].toUpperCase()}
                        </div>
                      )
                    }
                    <div>
                      <InlineEditableText value={t.name || ''} placeholder="Customer Name" editable={canEdit && !t._live} as="div"
                        className="font-semibold text-gray-900 text-sm"
                        style={{}}
                        onCommit={v => editItem('testimonials', i, 'name', v)} />
                      <InlineEditableText value={t.role || ''} placeholder="Role / Company" editable={canEdit && !t._live} as="div"
                        className="text-xs text-gray-400"
                        style={{}}
                        onCommit={v => editItem('testimonials', i, 'role', v)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {!isLive && canEdit && (
              <div className="mt-6 text-center">
                {AddItemBtn('testimonials', { quote: 'Great experience!', name: 'New Customer', role: 'Title', rating: 5 }, 'Add testimonial')}
              </div>
            )}
            {dsType === 'testimonials' && !isLive && (
              <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
                <Database className="w-3 h-3" /> No reviews yet — ask customers to leave one to see them here live.
              </p>
            )}
          </div>
        )
      }

      case 'pricing':
        return (
          <div className="py-16 px-8">
            {(p.title || canEdit) && IET('title', 'h2', 'text-3xl font-bold text-center mb-10', { fontFamily: font_heading }, 'Our Pricing')}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {(p.plans as any[] || []).map((plan: any, i: number) => (
                <div
                  key={i}
                  style={{ borderRadius: r, borderColor: plan.highlighted ? primary_color : '#e5e7eb', backgroundColor: plan.highlighted ? primary_color : bg_color, color: plan.highlighted ? '#fff' : text_color }}
                  className={cn('border-2 p-6 space-y-4 relative group/item', plan.highlighted && 'shadow-xl scale-105')}
                >
                  {ItemActions('plans', i, 'plan')}
                  <InlineEditableText value={plan.name || ''} placeholder="Plan Name" editable={canEdit} as="div"
                    className="font-bold text-lg" style={{ fontFamily: font_heading }}
                    onCommit={v => editItem('plans', i, 'name', v)} />
                  <div className="text-3xl font-extrabold">
                    <InlineEditableText value={String(plan.price ?? '')} placeholder="$0" editable={canEdit} as="span"
                      style={{}}
                      onCommit={v => editItem('plans', i, 'price', v)} />
                    {plan.period && <span className="text-base font-normal opacity-70">/{plan.period}</span>}
                  </div>
                  <ul className="space-y-2 text-sm">
                    {(plan.features || []).slice(0, 10).map((f: string, fi: number) => (
                      <li key={fi} className="flex items-center gap-2 relative group/line">
                        <Check className="w-4 h-4 shrink-0 opacity-70" />
                        <InlineEditableText value={f || ''} placeholder="Feature item" editable={canEdit} as="span"
                          className="flex-1" style={{}}
                          onCommit={v => {
                            const feats = [...(plan.features || [])]
                            feats[fi] = v
                            editItem('plans', i, 'features', feats as any)
                          }} />
                        {canEdit && (
                          <button type="button" title="Remove line"
                            onClick={e => {
                              e.stopPropagation()
                              const feats = [...(plan.features || [])]
                              feats.splice(fi, 1)
                              editItem('plans', i, 'features', feats as any)
                            }}
                            className="opacity-0 group-hover/line:opacity-100 transition-opacity w-4 h-4 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center"
                          >×</button>
                        )}
                      </li>
                    ))}
                    {canEdit && (
                      <li>
                        <button type="button"
                          onClick={e => {
                            e.stopPropagation()
                            const feats = [...(plan.features || []), 'New feature']
                            editItem('plans', i, 'features', feats as any)
                          }}
                          className="text-xs opacity-60 hover:opacity-100 inline-flex items-center gap-1 mt-1"
                        ><Plus className="w-3 h-3" /> Add line</button>
                      </li>
                    )}
                  </ul>
                  <button
                    style={{ borderRadius: r, backgroundColor: plan.highlighted ? '#fff' : primary_color, color: plan.highlighted ? primary_color : '#fff' }}
                    className="w-full py-2.5 font-semibold text-sm"
                  >
                    <InlineEditableText value={plan.cta || ''} placeholder="Get Started" editable={canEdit} as="span"
                      style={{}}
                      onCommit={v => editItem('plans', i, 'cta', v)} />
                  </button>
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="mt-6 text-center">
                {AddItemBtn('plans', { name: 'New Plan', price: '$0', period: 'mo', features: ['Feature one', 'Feature two'], cta: 'Choose' }, 'Add plan')}
              </div>
            )}
          </div>
        )

      case 'faq':
        return (
          <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
            {(p.title || canEdit) && IET('title', 'h2', 'text-3xl font-bold text-gray-900 mb-10 text-center', { fontFamily: font_heading, color: '#111827' }, 'Frequently Asked Questions')}
            <div className="space-y-3">
              {(p.faqs as any[] || []).map((faq: any, i: number) => (
                <details key={i} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden relative group/item">
                  {ItemActions('faqs', i, 'question')}
                  <summary className="list-none cursor-pointer w-full flex items-center justify-between gap-3 px-6 py-4 text-left [&::-webkit-details-marker]:hidden">
                    <InlineEditableText value={faq.question || ''} placeholder={`Question ${i + 1}`} editable={canEdit} as="span"
                      className="font-semibold text-gray-900 text-sm flex-1 min-w-0" style={{}}
                      onCommit={v => editItem('faqs', i, 'question', v)} />
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-6 pb-4 text-gray-600 text-sm leading-relaxed border-t border-gray-50">
                    <InlineEditableText value={faq.answer || ''} placeholder="Answer…" editable={canEdit} multiline as="div"
                      className="pt-3" style={{}}
                      onCommit={v => editItem('faqs', i, 'answer', v)} />
                  </div>
                </details>
              ))}
            </div>
            {canEdit && (
              <div className="mt-6 text-center">
                {AddItemBtn('faqs', { question: 'New question?', answer: 'Answer goes here.' }, 'Add FAQ')}
              </div>
            )}
          </section>
        )

      case 'cta':
        return (
          <section className="py-16 px-4 sm:px-6 lg:px-8">
            <div
              className="max-w-4xl mx-auto text-center rounded-3xl p-12 text-white"
              style={{ background: `linear-gradient(135deg, ${primary_color}, ${effectiveStyle.secondary_color})` }}
            >
              <InlineEditableText
                value={p.headline || ''}
                placeholder="Ready to Get Started?"
                editable={isEditing}
                as="h2"
                style={{ fontFamily: font_heading }}
                className="text-3xl sm:text-4xl font-bold mb-4"
                onCommit={v => commitProp('headline', v)}
              />
              <InlineEditableText
                value={p.subtitle || ''}
                placeholder="Join thousands of satisfied customers."
                editable={isEditing}
                multiline
                as="p"
                className="text-white/80 text-lg mb-8 max-w-xl mx-auto"
                onCommit={v => commitProp('subtitle', v)}
              />
              <div className="inline-block relative group">
                <button
                  style={{ backgroundColor: '#fff', color: primary_color, borderRadius: r }}
                  className="px-8 py-4 font-bold text-base hover:bg-gray-50 transition-all hover:scale-105"
                  onDoubleClick={e => {
                    if (isEditing && onEditPropLink) {
                      e.preventDefault(); e.stopPropagation()
                      onEditPropLink('cta_label', { x: e.clientX, y: e.clientY })
                    }
                  }}
                >
                  <InlineEditableText
                    value={p.cta_label || ''}
                    placeholder="Get Started Free"
                    editable={isEditing}
                    as="span"
                    onCommit={v => commitProp('cta_label', v)}
                  />
                </button>
                {isEditing && onEditPropLink && (
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      onEditPropLink('cta_label', { x: rect.left, y: rect.bottom + 4 })
                    }}
                    className={cn(
                      'absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs shadow-md transition-opacity',
                      (p as any).cta_url ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-white opacity-0 group-hover:opacity-100'
                    )}
                    title={(p as any).cta_url ? `Linked → ${(p as any).cta_url}` : 'Connect link / ERP item'}
                  >
                    🔗
                  </button>
                )}
              </div>
              {p.show_credit_card_note && <p className="text-white/60 text-xs mt-3">No credit card required</p>}
            </div>
          </section>
        )

      case 'team_grid':
      case 'team_list': {
        const teamCols = (p as any).columns || 4
        const teamGap = (p as any).item_gap ?? 24
        const teamSize = (p as any).item_size ?? 160
        const avatarSize = Math.round(teamSize * 0.55)
        const isLive = dsType === 'team' && liveTeam.length > 0
        const members: any[] = isLive
          ? liveTeam.map(t => ({
              name: t.title,
              role: t.subtitle,
              bio: t.description,
              avatar_url: t.image_url,
            }))
          : (p.members as any[] || [])
        const colClass = teamCols <= 2 ? 'grid-cols-1 sm:grid-cols-2' : teamCols === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
        return (
          <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {(p.title || canEdit) && IET('title', 'h2', 'text-3xl font-bold text-gray-900 mb-10 text-center', { fontFamily: font_heading, color: '#111827' }, 'Meet the Team')}
            {isLive && (
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-600 font-semibold">Live · your HR team</span>
              </div>
            )}
            {(p.description || canEdit) && IET('description', 'p', 'text-center text-sm text-gray-500 mb-10 max-w-2xl mx-auto', {}, 'Meet the people behind the work.', true)}
            <div className={cn('grid gap-6 mx-auto', colClass)} style={{ gap: `${teamGap}px`, maxWidth: '1000px' }}>
              {members.map((m: any, i: number) => (
                <div key={i} className="text-center relative group/item p-3">
                  {!isLive && ItemActions('members', i, 'member')}
                  <div
                    style={{
                      width: avatarSize, height: avatarSize,
                      borderRadius: '50%',
                      backgroundColor: primary_color,
                      margin: '0 auto 12px',
                      overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    className="shadow-sm"
                  >
                    {m.avatar_url
                      ? <img src={mediaUrl(m.avatar_url)} className="w-full h-full object-cover" alt={m.name}
                          onError={e => {
                            const el = e.target as HTMLImageElement
                            el.style.display = 'none'
                            const fb = el.nextElementSibling as HTMLElement | null
                            if (fb) fb.style.display = 'flex'
                          }}
                        />
                      : null
                    }
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: avatarSize * 0.35, display: m.avatar_url ? 'none' : 'flex' }}>
                      {(m.name || '?')[0].toUpperCase()}
                    </div>
                  </div>
                  <InlineEditableText value={m.name || ''} placeholder="Name" editable={canEdit && !isLive} as="div"
                    className="font-semibold text-gray-900 text-sm"
                    style={{}}
                    onCommit={v => editItem('members', i, 'name', v)} />
                  <InlineEditableText value={m.role || ''} placeholder="Role / Title" editable={canEdit && !isLive} as="div"
                    className="text-sm text-gray-400 mt-0.5"
                    style={{}}
                    onCommit={v => editItem('members', i, 'role', v)} />
                  {(m.bio || canEdit) && (
                    <InlineEditableText value={m.bio || ''} placeholder="Short bio…" editable={canEdit && !isLive} multiline as="div"
                      className="text-xs mt-1.5 leading-relaxed text-gray-500 max-w-xs mx-auto"
                      style={{}}
                      onCommit={v => editItem('members', i, 'bio', v)} />
                  )}
                </div>
              ))}
            </div>
            {!isLive && canEdit && (
              <div className="mt-6 text-center">
                {AddItemBtn('members', { name: 'New Member', role: 'Role', bio: 'Short bio.' }, 'Add member')}
              </div>
            )}
          </section>
        )
      }

      case 'newsletter':
        return (
          <section className="py-16 px-4 sm:px-6 lg:px-8 text-center" style={{ backgroundColor: `${primary_color}10` }}>
            <div className="max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: primary_color }}>
                <Mail className="w-6 h-6 text-white" />
              </div>
              {IET('title', 'h2', 'text-2xl font-bold text-gray-900 mb-2', { fontFamily: font_heading, color: '#111827' }, 'Stay in the Loop')}
              {IET('subtitle', 'p', 'text-gray-500 mb-6', {}, 'Get the latest updates delivered to your inbox.')}
              <div className="flex gap-2 max-w-md mx-auto">
                <input className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="your@email.com" readOnly />
                {CTABtn('cta_label', 'cta_url', 'Subscribe', 'px-6 py-3 rounded-xl text-white font-semibold text-sm flex items-center gap-2 hover:opacity-90 whitespace-nowrap', { backgroundColor: primary_color })}
              </div>
            </div>
          </section>
        )

      case 'contact_form':
      case 'map_contact': {
        const pmeta: any = liveProfile?.meta || {}
        const liveEmail = dsType === 'profile' ? (pmeta.email || pmeta.support_email) : null
        const livePhone = dsType === 'profile' ? (pmeta.phone || pmeta.support_phone) : null
        const liveAddr  = dsType === 'profile' ? pmeta.address : null
        const emailVal = (p.email as string) || liveEmail || ''
        const phoneVal = (p.phone as string) || livePhone || ''
        const addrVal  = (p.address as string) || liveAddr || ''
        const formFields: any[] = Array.isArray(p.form_fields) && (p.form_fields as any[]).length > 0
          ? (p.form_fields as any[]).slice(0, 6)
          : [
              { name: 'name', type: 'text', placeholder: 'Your Name' },
              { name: 'email', type: 'email', placeholder: 'your@email.com' },
              { name: 'phone', type: 'tel', placeholder: '+1 234 567 8900' },
              { name: 'message', type: 'textarea', placeholder: 'How can we help you?' },
            ]
        return (
          <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            {dsType === 'profile' && liveProfile && (
              <div className="flex items-center justify-center gap-1.5 mb-6">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-600 font-semibold">Live · synced with your vendor profile</span>
              </div>
            )}
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              <div>
                {(p.title || canEdit) && IET('title', 'h2', 'text-3xl font-bold text-gray-900 mb-4', { fontFamily: font_heading, color: '#111827' }, 'Get In Touch')}
                <div className="space-y-4 mt-8">
                  {(emailVal || canEdit) && (
                    <div className="flex items-center gap-3 text-gray-600 text-sm">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${primary_color}15` }}>
                        <Mail className="w-5 h-5" style={{ color: primary_color }} />
                      </div>
                      <span className="min-w-0 break-words">
                        {canEdit && dsType !== 'profile'
                          ? <InlineEditableText value={emailVal} placeholder="you@example.com" editable as="span" style={{}} onCommit={v => commitProp('email', v)} />
                          : (emailVal || '—')}
                      </span>
                    </div>
                  )}
                  {(phoneVal || canEdit) && (
                    <div className="flex items-center gap-3 text-gray-600 text-sm">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${primary_color}15` }}>
                        <Phone className="w-5 h-5" style={{ color: primary_color }} />
                      </div>
                      <span>
                        {canEdit && dsType !== 'profile'
                          ? <InlineEditableText value={phoneVal} placeholder="+1 555 000 0000" editable as="span" style={{}} onCommit={v => commitProp('phone', v)} />
                          : (phoneVal || '—')}
                      </span>
                    </div>
                  )}
                  {(addrVal || canEdit) && (
                    <div className="flex items-center gap-3 text-gray-600 text-sm">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${primary_color}15` }}>
                        <MapPin className="w-5 h-5" style={{ color: primary_color }} />
                      </div>
                      <span className="min-w-0">
                        {canEdit && dsType !== 'profile'
                          ? <InlineEditableText value={addrVal} placeholder="123 Main St, City" editable multiline as="span" style={{}} onCommit={v => commitProp('address', v)} />
                          : (addrVal || '—')}
                      </span>
                    </div>
                  )}
                  {p.show_map && (pmeta.latitude || pmeta.longitude) && (
                    <div className="mt-2 h-40 rounded-2xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center text-xs text-gray-500">
                      <Map className="w-5 h-5 mr-1 shrink-0" style={{ color: primary_color }} />
                      {pmeta.city || ''}{pmeta.state ? `, ${pmeta.state}` : ''}
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm space-y-4">
                {formFields.map((f: any, i: number) => (
                  f.type === 'textarea'
                    ? (
                      <div key={i}>
                        {f.label && <label className="text-xs font-medium text-gray-700 block mb-1">{f.label}</label>}
                        <textarea readOnly className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-ring" placeholder={f.placeholder || f.label} />
                      </div>
                    )
                    : (
                      <div key={i}>
                        {f.label && <label className="text-xs font-medium text-gray-700 block mb-1">{f.label}</label>}
                        <input readOnly className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder={f.placeholder || f.label} type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text'} />
                      </div>
                    )
                ))}
                <button type="button" style={{ backgroundColor: primary_color }} className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity">
                  {canEdit
                    ? <InlineEditableText value={(p as any).submit_label as string || ''} placeholder="Send Message" editable as="span"
                        style={{ color: '#fff' }} onCommit={v => commitProp('submit_label', v)} />
                    : ((p as any).submit_label || 'Send Message')}
                </button>
                {canEdit
                  ? <InlineEditableText value={(p as any).form_hint as string || ''} placeholder="Helper hint…" editable as="p" multiline
                      className="text-xs text-gray-400 text-center" style={{}}
                      onCommit={v => commitProp('form_hint', v)} />
                  : ((p as any).form_hint || <p className="text-xs text-gray-400 text-center">Messages from your published site are captured as CRM leads automatically.</p>)}
              </div>
            </div>
          </section>
        )
      }

      case 'trust_logos':
      case 'partner_logos': {
        const isLive = dsType === 'customers' && liveCustomers.length > 0
        const logos: any[] = isLive
          ? liveCustomers.map(c => ({ name: c.subtitle || c.title, image_url: c.image_url }))
          : ((p as any).logos as any[] || ['ACME Corp', 'TechGiant', 'StartupXYZ', 'Enterprise Co', 'Global Inc'].map(n => ({ name: n })))
        return (
          <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            {(p.title || canEdit) && IET('title', 'p', 'text-center text-sm font-semibold text-gray-400 uppercase tracking-widest mb-8', { color: '#9ca3af' }, 'Trusted By')}
            <div className="flex flex-wrap justify-center gap-8 items-center">
              {logos.slice(0, 8).map((l: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  {l.image_url
                    ? <img src={mediaUrl(l.image_url)} className="h-10 w-auto grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all object-contain" alt={l.name || ''} />
                    : <span className="text-gray-400 font-bold text-sm opacity-60">{l.name}</span>
                  }
                </div>
              ))}
            </div>
            {isLive && (
              <p className="text-center text-xs text-emerald-600 mt-3 font-semibold">Live · your top customers</p>
            )}
          </section>
        )
      }

      case 'footer': {
        // Match StorefrontShell: footer sits on the same page background as main (--sf-bg), not nav/primary slab.
        const tc = (text_color || '#111827').trim()
        const footerBg =
          ((p as any).footer_bg as string | undefined)?.trim()
          || bg_color
          || effectiveStyle.surface_color
          || '#ffffff'
        const footerTitleColor =
          ((p as any).footer_heading as string | undefined)?.trim() || tc
        const footerLinkColor =
          ((p as any).footer_muted as string | undefined)?.trim() || tc
        const footerBorder =
          ((p as any).footer_border as string | undefined)?.trim()
          || (/^#[0-9A-Fa-f]{6}$/i.test(tc) ? `${tc}29` : 'rgba(15, 23, 42, 0.12)')
        const pmeta: any = liveProfile?.meta || {}
        const socialLinks: Record<string, string> = (p.social_links as any) || (dsType === 'profile' ? (pmeta.social_links || {}) : {})
        const year = new Date().getFullYear()
        const copyrightFromProfile = pmeta.business_name
          ? `© ${year} ${pmeta.business_name}. All rights reserved.`
          : ''
        const copyright = ((p.copyright as string) || '').trim() || copyrightFromProfile
        const liveNavLinks = dsType === 'pages' ? livePages : []
        const hasLiveLinks = liveNavLinks.length > 0
        const rawFooterCols = (p as any).footer_columns
        const footerCols: { title: string; links: string[] }[] = Array.isArray(rawFooterCols) && rawFooterCols.length > 0
          ? (rawFooterCols as any[]).map((c: any) => ({
              title: String(c?.title ?? '').trim() || 'Column',
              links: Array.isArray(c?.links) ? (c.links as unknown[]).map(x => String(x ?? '')) : [],
            }))
          : []
        const hasFooterCols = footerCols.length > 0
        const editColLinks = (cols: { title: string; links: string[] }[], colIdx: number, linkIdx: number, value: string) => {
          if (!onPropsUpdate) return
          const next = cols.map(c => ({ title: c.title, links: [...c.links] }))
          next[colIdx].links[linkIdx] = value
          onPropsUpdate({ ...block.props, footer_columns: next } as BlockProps)
        }
        const editColTitle = (cols: { title: string; links: string[] }[], colIdx: number, value: string) => {
          if (!onPropsUpdate) return
          const next = cols.map(c => ({ title: c.title, links: [...c.links] }))
          next[colIdx].title = value
          onPropsUpdate({ ...block.props, footer_columns: next } as BlockProps)
        }
        const removeColLink = (cols: { title: string; links: string[] }[], colIdx: number, linkIdx: number) => {
          if (!onPropsUpdate) return
          const next = cols.map(c => ({ title: c.title, links: [...c.links] }))
          next[colIdx].links.splice(linkIdx, 1)
          onPropsUpdate({ ...block.props, footer_columns: next } as BlockProps)
        }
        const addColLink = (cols: { title: string; links: string[] }[], colIdx: number) => {
          if (!onPropsUpdate) return
          const next = cols.map(c => ({ title: c.title, links: [...c.links] }))
          next[colIdx].links.push('New link')
          onPropsUpdate({ ...block.props, footer_columns: next } as BlockProps)
        }
        const removeCol = (cols: { title: string; links: string[] }[], colIdx: number) => {
          if (!onPropsUpdate) return
          const next = cols.filter((_, i) => i !== colIdx)
          onPropsUpdate({ ...block.props, footer_columns: next } as BlockProps)
        }
        return (
          <div
            className="border-t mt-8 py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-sm"
            style={{ borderColor: footerBorder, backgroundColor: footerBg, color: footerLinkColor }}
          >
            {(hasFooterCols || hasLiveLinks) && (
              <div
                className={cn(
                  'grid grid-cols-2 gap-8',
                  hasFooterCols
                    ? (footerCols.length <= 2 ? 'md:grid-cols-2' : footerCols.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4')
                    : 'md:grid-cols-4',
                )}
              >
                {hasFooterCols ? (
                  <>
                    {footerCols.map((col, colIdx) => (
                      <div key={colIdx} className="relative group/item">
                        {canEdit && (
                          <button type="button" title="Remove column"
                            onClick={e => { e.stopPropagation(); removeCol(footerCols, colIdx) }}
                            className="absolute -top-2 -right-2 z-10 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold shadow-lg flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity"
                          >×</button>
                        )}
                        <InlineEditableText value={col.title || ''} placeholder="Column title" editable={canEdit} as="div"
                          className="text-xs uppercase tracking-[0.18em] opacity-70 mb-3" style={{ color: footerTitleColor }}
                          onCommit={v => editColTitle(footerCols, colIdx, v)} />
                        {col.links.map((l, linkIdx) => (
                          <div key={linkIdx} className="relative group/line flex items-center gap-1 mb-2">
                            <InlineEditableText value={l || ''} placeholder={`Link ${linkIdx + 1}`} editable={canEdit} as="div"
                              className="text-sm opacity-90 flex-1 cursor-pointer hover:opacity-100 transition-opacity" style={{ color: footerLinkColor }}
                              onCommit={v => editColLinks(footerCols, colIdx, linkIdx, v)} />
                            {canEdit && (
                              <button type="button" title="Remove link"
                                onClick={e => { e.stopPropagation(); removeColLink(footerCols, colIdx, linkIdx) }}
                                className="opacity-0 group-hover/line:opacity-100 transition-opacity w-4 h-4 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center"
                              >×</button>
                            )}
                          </div>
                        ))}
                        {canEdit && (
                          <button type="button"
                            onClick={e => { e.stopPropagation(); addColLink(footerCols, colIdx) }}
                            className="text-xs inline-flex items-center gap-1 mt-1 opacity-70 hover:opacity-100"
                            style={{ color: footerLinkColor }}
                          ><Plus className="w-3 h-3" /> Add link</button>
                        )}
                      </div>
                    ))}
                    {canEdit && footerCols.length < 6 && (
                      <div>
                        <button type="button"
                          onClick={e => {
                            e.stopPropagation()
                            const next = [...footerCols, { title: 'New Column', links: ['Link one'] }]
                            onPropsUpdate?.({ ...block.props, footer_columns: next } as BlockProps)
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-dashed text-xs font-medium transition-colors"
                          style={{ borderColor: footerBorder, color: footerLinkColor }}
                        ><Plus className="w-3.5 h-3.5" /> Add column</button>
                      </div>
                    )}
                  </>
                ) : hasLiveLinks ? (
                  <>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] opacity-70 mb-3" style={{ color: footerTitleColor }}>Pages</div>
                      {liveNavLinks.slice(0, 6).map(pg => (
                        <div key={pg.id} className="text-sm mb-2 opacity-90 cursor-pointer hover:opacity-100" style={{ color: footerLinkColor }}>{pg.title}</div>
                      ))}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] opacity-70 mb-3" style={{ color: footerTitleColor }}>Contact</div>
                      {pmeta.email && <div className="text-sm mb-2 opacity-90" style={{ color: footerLinkColor }}>{pmeta.email}</div>}
                      {pmeta.phone && <div className="text-sm mb-2 opacity-90" style={{ color: footerLinkColor }}>{pmeta.phone}</div>}
                      {pmeta.address && <div className="text-sm mb-2 opacity-90" style={{ color: footerLinkColor }}>{pmeta.address}</div>}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] opacity-70 mb-3" style={{ color: footerTitleColor }}>Follow</div>
                      {Object.entries(socialLinks).filter(([, url]) => !!url).slice(0, 5).map(([k]) => (
                        <div key={k} className="text-sm mb-2 capitalize opacity-90 cursor-pointer hover:opacity-100" style={{ color: footerLinkColor }}>{k}</div>
                      ))}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] opacity-70 mb-3" style={{ color: footerTitleColor }}>Legal</div>
                      {['Terms', 'Privacy', 'Refund'].map(l => (
                        <div key={l} className="text-sm mb-2 opacity-90 cursor-pointer hover:opacity-100" style={{ color: footerLinkColor }}>{l}</div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            )}
            {!hasFooterCols && !hasLiveLinks && canEdit && (
              <div className="mb-8 text-center text-sm opacity-90" style={{ color: footerLinkColor }}>
                <p className="mb-3">This footer has no columns yet. Add <span className="font-semibold opacity-100" style={{ color: footerTitleColor }}>footer columns</span> in the properties panel, or use <span className="font-semibold opacity-100" style={{ color: footerTitleColor }}>Add column</span> below.</p>
                <button type="button"
                  onClick={e => {
                    e.stopPropagation()
                    onPropsUpdate?.({ ...block.props, footer_columns: [{ title: 'New Column', links: ['Link one'] }] } as BlockProps)
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-dashed text-xs font-medium"
                  style={{ borderColor: footerBorder, color: footerTitleColor }}
                ><Plus className="w-3.5 h-3.5" /> Add first column</button>
              </div>
            )}
            <div
              className={cn(
                'text-xs text-center opacity-70',
                (hasFooterCols || hasLiveLinks || copyright) ? 'mt-10 pt-6' : 'pt-2',
              )}
              style={
                (hasFooterCols || hasLiveLinks || copyright)
                  ? { borderTop: `1px solid ${footerBorder}`, color: footerLinkColor }
                  : { color: footerLinkColor }
              }
            >
              {canEdit
                ? (
                  <InlineEditableText
                    value={copyright}
                    placeholder="Copyright line"
                    editable
                    onCommit={v => commitProp('copyright', v)}
                    as="span"
                  />
                )
                : (copyright || null)}
            </div>
          </div>
        )
      }

      case 'video_embed':
        return (
          <div className="py-16 px-8">
            {(p.title || canEdit) && IET('title', 'h2', 'text-3xl font-bold text-center mb-8', { fontFamily: font_heading }, 'Watch Our Story')}
            <div className="max-w-3xl mx-auto aspect-video bg-gray-900 rounded-2xl flex items-center justify-center">
              <PlayCircle className="w-16 h-16 text-white opacity-60" />
            </div>
          </div>
        )

      case 'timeline':
        return (
          <div className="py-16 px-8 max-w-2xl mx-auto">
            {(p.title || canEdit) && IET('title', 'h2', 'text-3xl font-bold text-center mb-10', { fontFamily: font_heading }, 'Our Journey')}
            <div className="space-y-6 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-gray-200">
              {((p as any).items || []).map((item: any, i: number) => (
                <div key={i} className="pl-10 relative group/item">
                  {ItemActions('items', i, 'milestone')}
                  <div style={{ backgroundColor: primary_color }} className="absolute left-0 top-1 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold">{i + 1}</div>
                  <InlineEditableText value={item.year || ''} placeholder="Year" editable={canEdit} as="div"
                    className="text-xs text-gray-400 mb-1" style={{}}
                    onCommit={v => editItem('items', i, 'year', v)} />
                  <InlineEditableText value={item.title || ''} placeholder={`Milestone ${i + 1}`} editable={canEdit} as="div"
                    className="font-semibold text-sm" style={{}}
                    onCommit={v => editItem('items', i, 'title', v)} />
                  <InlineEditableText value={item.desc || ''} placeholder="Description…" editable={canEdit} multiline as="div"
                    className="text-xs text-gray-500" style={{}}
                    onCommit={v => editItem('items', i, 'desc', v)} />
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="mt-6 text-center">
                {AddItemBtn('items', { year: String(new Date().getFullYear()), title: 'New Milestone', desc: 'Describe the milestone.' }, 'Add milestone')}
              </div>
            )}
          </div>
        )

      case 'divider':
        return <div className="px-8 py-4"><hr style={{ borderColor: (p as any).color || '#e5e7eb' }} /></div>

      case 'spacer':
        return <div style={{ height: (p as any).height || 80 }} />

      case 'rich_text':
        return (
          <div className="py-12 px-8 max-w-3xl mx-auto">
            <InlineEditableRichText
              html={(p as any).content || '<p>Your rich text content goes here.</p>'}
              editable={canEdit}
              className="prose prose-sm max-w-none"
              style={{ fontFamily: font_body, color: text_color }}
              onCommit={v => commitProp('content', v)}
            />
          </div>
        )

      case 'image_block':
        return (
          <div className="py-8 px-8">
            {p.image_url
              ? <img src={mediaUrl(p.image_url as string)} className="w-full object-cover max-h-96" style={{ borderRadius: r }} alt="" />
              : <div style={{ borderRadius: r, backgroundColor: effectiveStyle.surface_color }} className="w-full h-48 flex items-center justify-center text-gray-400">
                <ImageIcon className="w-10 h-10" />
              </div>
            }
            {((p as any).caption || canEdit) && IET('caption', 'p', 'text-center text-xs text-gray-400 mt-2', {}, 'Image caption…')}
          </div>
        )

      case 'about_split':
      case 'about_timeline': {
        const pmeta: any = liveProfile?.meta || {}
        const isLive = dsType === 'profile' && !!liveProfile
        const title = (p.title as string) || (isLive ? (pmeta.business_name || 'About Us') : 'About Us')
        const desc  = (p.description as string) || (isLive ? (pmeta.description || '') : '') || 'Tell your story here.'
        const img   = (p.image_url as string) || pmeta.banner_url || pmeta.logo_url || ''
        const statement = (p as any).layout === 'statement' || (p as any).variant === 'centered'
        if (statement) {
          return (
            <div className="border-t py-20 sm:py-24 px-6 max-w-4xl mx-auto text-center" style={{ borderColor: `${text_color}18`, backgroundColor: bg_color }}>
              {(p.subtitle || canEdit) && (
                <div className="text-xs uppercase tracking-[0.3em] opacity-70 mb-3" style={{ color: text_color }}>
                  <InlineEditableText value={(p.subtitle as string) || ''} placeholder="Our craft" editable={canEdit} as="span" onCommit={v => commitProp('subtitle', v)} />
                </div>
              )}
              {IET('title', 'h2', 'text-3xl sm:text-4xl md:text-5xl mb-6 text-balance', { fontFamily: font_heading, color: text_color }, title)}
              {IET('description', 'p', 'opacity-80 max-w-2xl mx-auto text-pretty text-base leading-relaxed', { color: text_color }, desc, true)}
              {isLive && (
                <div className="flex items-center justify-center gap-1.5 mt-6 text-xs text-emerald-600 font-semibold">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live · synced with your vendor profile
                </div>
              )}
            </div>
          )
        }
        return (
          <div className="py-16 px-8 flex gap-12 items-center max-w-5xl mx-auto">
            <div style={{ borderRadius: r, backgroundColor: effectiveStyle.surface_color }} className="flex-1 h-64 flex items-center justify-center text-gray-300 overflow-hidden">
              {img
                ? <img src={mediaUrl(img)} className="w-full h-full object-cover" alt={title} />
                : <ImageIcon className="w-12 h-12" />
              }
            </div>
            <div className="flex-1 space-y-4">
              {(p.eyebrow || canEdit) && IET('eyebrow', 'div', 'text-xs font-medium uppercase tracking-wide', { color: primary_color }, 'Our Story')}
              {IET('title', 'h2', 'text-3xl font-bold', { fontFamily: font_heading }, 'About Us')}
              {IET('description', 'p', 'text-gray-500 text-sm leading-relaxed', {}, 'Tell your story here.', true)}
              {isLive && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live · synced with your vendor profile
                </div>
              )}
            </div>
          </div>
        )
      }

      case 'product_grid': {
        const cols = p.columns || 4
        const isLive = dsType === 'products'
        const editorialPg = (p as any).layout === 'editorial'
        const fallback: LiveItem[] = Array.from({ length: cols }).map((_, i) => ({
          id: `ph-${i}`,
          title: `Product ${i + 1}`,
          subtitle: null,
          description: null,
          image_url: null,
          price: null,
          price_formatted: '₹999',
          rating: null,
          url: null,
          meta: { is_featured: false },
        }))
        const displayProducts =
          isLive && liveProducts.length > 0
            ? liveProducts
            : (isTemplateBlock && !editorialPg ? [] : fallback)
        if (editorialPg) {
          const gridCls = cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'
          const useSpotlight = (p as any).featured_spotlight !== false && displayProducts.length >= 1
          const featuredOne = useSpotlight ? displayProducts[0] : null
          const gridList = useSpotlight ? displayProducts.slice(1) : displayProducts
          return (
            <div className="py-16 sm:py-20 px-6 sm:px-12 max-w-7xl mx-auto" style={{ backgroundColor: effectiveStyle.surface_color }}>
              <div className="flex items-end justify-between mb-10 gap-4">
                {(p.title || canEdit) && IET('title', 'h2', 'text-3xl sm:text-4xl', { fontFamily: font_heading, color: text_color }, 'New arrivals')}
                <span className="text-sm underline opacity-80" style={{ color: text_color }}>View all</span>
              </div>
              {isLive && liveProducts.length > 0 && (
                <div className="flex items-center gap-1.5 mb-6">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-600 font-semibold">Live · your product catalog</span>
                </div>
              )}
              {featuredOne && (
                <div
                  className="border-y mb-16 sm:mb-20 -mx-6 sm:-mx-12 px-6 sm:px-12"
                  style={{ borderColor: `${text_color}18`, backgroundColor: bg_color }}
                >
                  <div className="max-w-7xl mx-auto py-16 sm:py-20 grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
                    <div className="aspect-[4/5] relative overflow-hidden bg-gray-100">
                      {featuredOne.image_url
                        ? <img src={mediaUrl(featuredOne.image_url)} className="absolute inset-0 w-full h-full object-cover" alt={featuredOne.title} />
                        : <div className="absolute inset-0 flex items-center justify-center"><ShoppingBag className="w-12 h-12 text-gray-300" /></div>}
                    </div>
                    <div>
                      <span className="text-xs uppercase tracking-[0.3em] opacity-70" style={{ color: text_color }}>
                        Featured{(featuredOne as any).brand != null && String((featuredOne as any).brand).trim() !== '' ? ` · ${(featuredOne as any).brand}` : ''}
                      </span>
                      <h3 className="text-3xl sm:text-4xl lg:text-5xl mt-3 mb-4 text-balance" style={{ fontFamily: font_heading, color: text_color }}>
                        {featuredOne.title || 'Featured'}
                      </h3>
                      {featuredOne.meta?.rating != null && (
                        <div className="flex items-center gap-2 mb-6 text-sm opacity-80" style={{ color: text_color }}>
                          <Star className="h-4 w-4 fill-current shrink-0" />
                          <span>{String(featuredOne.meta.rating)}</span>
                        </div>
                      )}
                      <p className="text-base opacity-80 mb-8 max-w-lg leading-relaxed" style={{ color: text_color }}>
                        {(featuredOne as any).description || featuredOne.subtitle || 'Highlight a hero SKU — connect live catalog data to replace this placeholder.'}
                      </p>
                      <div className="text-2xl mb-8" style={{ fontFamily: font_heading, color: text_color }}>
                        {featuredOne.price_formatted || (featuredOne.price != null ? `₹${featuredOne.price}` : '—')}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          style={{ backgroundColor: primary_color, color: '#fff' }}
                          className="h-12 px-8 text-xs font-bold uppercase tracking-[0.2em] rounded-none"
                        >
                          Add to cart
                        </button>
                        <button
                          type="button"
                          style={{ border: `1px solid ${text_color}99`, color: text_color }}
                          className="h-12 w-12 rounded-none bg-transparent flex items-center justify-center"
                          aria-label="Wishlist"
                        >
                          <Heart className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className={cn('grid gap-x-6 gap-y-12', gridCls)}>
                {gridList.map((prod: any, i: number) => (
                  <div key={prod?.id || i} className="group">
                    <div className="aspect-[4/5] relative overflow-hidden mb-4 bg-gray-100">
                      {prod?.image_url
                        ? <img src={mediaUrl(prod.image_url)} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={prod?.title} />
                        : <div className="absolute inset-0 flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-gray-300" /></div>}
                      {p.show_badges && prod?.meta?.is_featured && (
                        <span style={{ backgroundColor: primary_color, color: '#fff' }} className="absolute top-3 left-3 text-xs uppercase tracking-[0.2em] px-2 py-1">Featured</span>
                      )}
                      <div
                        className="absolute bottom-3 left-3 right-3 h-10 text-xs uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-semibold"
                        style={{ backgroundColor: text_color, color: bg_color }}
                      >
                        Quick add
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate" style={{ color: text_color }}>{prod?.title || `Product ${i + 1}`}</div>
                        {prod?.subtitle && <div className="text-xs opacity-60 truncate">{prod.subtitle}</div>}
                      </div>
                      <span className="text-sm shrink-0" style={{ color: text_color }}>{prod?.price_formatted || (prod?.price != null ? `₹${prod.price}` : '₹999')}</span>
                    </div>
                  </div>
                ))}
              </div>
              {(isLive || isTemplateBlock) && liveProducts.length === 0 && !liveLoading && (
                <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
                  <Database className="w-3 h-3" /> No products yet — add some in your catalog and they will appear here.
                </p>
              )}
            </div>
          )
        }
        return (
          <div className="py-16 px-8" style={{ backgroundColor: effectiveStyle.surface_color }}>
            {(p.title || canEdit) && IET('title', 'h2', 'text-3xl font-bold text-center mb-2', { fontFamily: font_heading }, 'Our Products')}
            {isLive && liveProducts.length > 0 && (
              <div className="flex items-center justify-center gap-1.5 mb-6">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-600 font-semibold">Live · your product catalog</span>
              </div>
            )}
            <div className={cn('grid gap-4 max-w-5xl mx-auto', cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4')}>
              {displayProducts.map((prod: any, i: number) => (
                <div key={prod?.id || i} style={{ borderRadius: r, backgroundColor: bg_color }} className="overflow-hidden shadow-sm">
                  <div className="h-36 bg-gray-100 relative overflow-hidden flex items-center justify-center">
                    {prod?.image_url
                      ? <img src={mediaUrl(prod.image_url)} className="w-full h-full object-cover" alt={prod.title} />
                      : <ShoppingBag className="w-8 h-8 text-gray-300" />
                    }
                    {p.show_badges && prod?.meta?.is_featured && (
                      <span style={{ backgroundColor: accent_color }} className="absolute top-2 left-2 text-xs text-white font-bold px-1.5 py-0.5 rounded">Featured</span>
                    )}
                    {p.show_badges && prod?.meta?.offer_label && (
                      <span style={{ backgroundColor: '#ef4444' }} className="absolute top-2 right-2 text-xs text-white font-bold px-1.5 py-0.5 rounded">{prod.meta.offer_label}</span>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-semibold text-xs truncate">{prod?.title || `Product ${i + 1}`}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{prod?.price_formatted || (prod?.price != null ? `₹${prod.price}` : '₹999')}</div>
                    {prod?.meta?.stock_status === 'out_of_stock'
                      ? <div className="text-xs text-red-500 font-semibold mt-1">Out of stock</div>
                      : <button style={{ backgroundColor: primary_color, borderRadius: r, color: '#fff' }} className="mt-2 px-3 py-1.5 text-xs font-medium w-full">Add to Cart</button>
                    }
                  </div>
                </div>
              ))}
            </div>
            {(isLive || isTemplateBlock) && liveProducts.length === 0 && !liveLoading && (
              <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
                <Database className="w-3 h-3" /> No products yet — add some in your catalog and they'll appear here.
              </p>
            )}
          </div>
        )
      }

      case 'services_cards':
      case 'services_list': {
        const isLive = dsType === 'services' && liveServices.length > 0
        const feats: any[] = isLive
          ? liveServices.map(s => ({
              title: s.title,
              desc: s.description || s.subtitle || '',
              icon: 'Wrench',
              price: s.price_formatted || (s.price != null ? `₹${s.price}` : null),
              image_url: s.image_url,
              duration: (s.meta as any)?.duration_minutes,
            }))
          : (p.features as any[] || [])
        const cols = p.columns || 3
        return (
          <div className="py-16 px-8">
            {(p.title || canEdit) && IET('title', 'h2', 'text-3xl font-bold text-center mb-2', { fontFamily: font_heading, color: text_color }, 'Our Services')}
            {isLive && (
              <div className="flex items-center justify-center gap-1.5 mb-6">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-600 font-semibold">Live · your services catalog</span>
              </div>
            )}
            <div className={cn('grid gap-6', cols === 2 ? 'grid-cols-2' : cols === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-3')}>
              {feats.slice(0, 9).map((f: any, i: number) => (
                <div key={i} style={{ backgroundColor: effectiveStyle.surface_color, borderRadius: r }} className="p-6 space-y-3 relative group/item">
                  {!isLive && ItemActions('features', i, 'service')}
                  {f.image_url && <img src={mediaUrl(f.image_url)} className="w-full h-28 object-cover rounded-lg" alt={f.title} />}
                  {!f.image_url && <div style={{ color: primary_color }} className="text-2xl">⚡</div>}
                  <InlineEditableText value={f.title || ''} placeholder={`Service ${i + 1}`} editable={canEdit && !f._live && !isLive} as="h3"
                    className="font-bold text-base" style={{ fontFamily: font_heading }}
                    onCommit={v => editItem('features', i, 'title', v)} />
                  <InlineEditableText value={f.desc || ''} placeholder="Describe this service." editable={canEdit && !f._live && !isLive} multiline as="p"
                    className="text-sm text-gray-500"
                    style={{}}
                    onCommit={v => editItem('features', i, 'desc', v)} />
                  {f.duration && <div className="text-xs text-gray-400">{f.duration} min</div>}
                  {f.price && <div style={{ color: primary_color }} className="text-xs font-bold">From {f.price}</div>}
                </div>
              ))}
            </div>
            {!isLive && canEdit && (
              <div className="mt-6 text-center">
                {AddItemBtn('features', { title: 'New Service', desc: 'Describe this service.' }, 'Add service')}
              </div>
            )}
            {dsType === 'services' && !isLive && !liveLoading && (
              <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
                <Database className="w-3 h-3" /> No services yet — add some and they'll appear here live.
              </p>
            )}
          </div>
        )
      }

      case 'booking_widget': {
        const isLive = dsType === 'services' && liveServices.length > 0
        return (
          <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
            <div className="text-center mb-10">
              {(p.title || canEdit) && IET('title', 'h2', 'text-3xl font-bold text-gray-900 mb-2', { fontFamily: font_heading, color: '#111827' }, 'Book a Session')}
              {(p.subtitle || canEdit) && IET('subtitle', 'p', 'text-gray-500', {}, 'Choose a time that works for you')}
            </div>
            {isLive && (
              <div className="flex items-center justify-center gap-1.5 mb-6">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-600 font-semibold">Live · your services</span>
              </div>
            )}
            {isLive ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveServices.slice(0, 6).map(s => (
                  <div key={s.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow text-left">
                    <div className="font-semibold text-gray-900 mb-1">{s.title}</div>
                    {(s.meta as any)?.duration_minutes && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                        <Clock className="w-3 h-3" />
                        {Number((s.meta as any).duration_minutes)} min
                      </p>
                    )}
                    {s.price_formatted && <p className="font-bold mb-3" style={{ color: primary_color }}>{s.price_formatted}</p>}
                    <span className="text-sm font-semibold inline-flex items-center gap-1" style={{ color: primary_color }}>
                      Book <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center">
                {CTABtn('cta_label', 'cta_url', 'Book Now', 'inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold hover:opacity-90 transition-all', { backgroundColor: primary_color })}
              </div>
            )}
          </section>
        )
      }

      case 'live_stock': {
        const isLive = dsType === 'products' && liveProducts.length > 0
        const showCount = (p.show_count as number) || 6
        const stockItems: any[] = isLive
          ? liveProducts.slice(0, showCount)
          : Array.from({ length: showCount }).map((_, i) => ({
              id: `ph-${i}`, title: `Product ${i + 1}`, image_url: null,
              meta: { quantity: Math.floor(Math.random() * 200) + 10, stock_status: 'in_stock' },
              price_formatted: '₹999',
            }))
        return (
          <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
            {(p.title || canEdit) && IET('title', 'h3', 'text-xl font-bold text-gray-900 mb-4', { fontFamily: font_heading, color: '#111827' }, 'Live Inventory')}
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-emerald-600 font-semibold">{isLive ? 'Live · your inventory' : 'Live preview (connect products for real stock)'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 font-semibold text-gray-600">Product</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-600">Price</th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-600">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {stockItems.map((item: any, i: number) => {
                    const qty = item?.meta?.quantity
                    const status = item?.meta?.stock_status
                    return (
                      <tr key={item.id || i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <div className="font-medium text-gray-900 flex items-center gap-2 min-w-0">
                            {item.image_url
                              ? <img src={mediaUrl(item.image_url)} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                              : (
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${primary_color}15` }}>
                                  <Package className="w-4 h-4" style={{ color: primary_color }} />
                                </div>
                              )}
                            <span className="truncate">{item.title}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-semibold" style={{ color: primary_color }}>{item.price_formatted || '—'}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full',
                            status === 'out_of_stock' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600')}>
                            {status === 'out_of_stock' ? 'Out' : qty != null ? `${qty} left` : 'In Stock'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      }

      case 'order_status':
        return (
          <div className="py-16 px-8 text-center" style={{ backgroundColor: effectiveStyle.surface_color }}>
            {(p.title || canEdit) && IET('title', 'h2', 'text-2xl font-bold mb-2', { fontFamily: font_heading, color: text_color }, 'Track Your Order')}
            {((p as any).subtitle || canEdit) && IET('subtitle', 'p', 'text-sm text-gray-500 mb-6', {}, 'Enter your order number to see the latest status')}
            <div className="max-w-sm mx-auto space-y-3">
              <div className="flex gap-2">
                <input
                  readOnly
                  placeholder={(p.placeholder as string) || 'Order number...'}
                  style={{ borderRadius: r, borderColor: `${primary_color}44` }}
                  className="flex-1 px-4 py-2.5 border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button style={{ backgroundColor: primary_color, borderRadius: r, color: '#fff' }} className="px-4 py-2.5 text-sm font-semibold">
                  Track
                </button>
              </div>
              <div style={{ borderRadius: r, border: `1px solid ${primary_color}22` }} className="p-4 bg-white shadow-sm text-left">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-600">Order #12345</span>
                  <span style={{ backgroundColor: `${primary_color}15`, color: primary_color }} className="text-xs font-bold px-2 py-0.5 rounded-full">In Transit</span>
                </div>
                {['Order Placed', 'Processing', 'Shipped', 'Delivered'].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <div style={{ backgroundColor: i < 3 ? primary_color : '#e5e7eb', borderRadius: '50%' }} className="w-2 h-2 shrink-0" />
                    <span className={`text-xs ${i < 3 ? 'text-gray-700 font-semibold' : 'text-gray-400'}`}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 'live_quote':
        return (
          <div className="py-16 px-8 text-center" style={{ backgroundColor: effectiveStyle.surface_color }}>
            {(p.title || canEdit) && IET('title', 'h2', 'text-2xl font-bold mb-2', { fontFamily: font_heading, color: text_color }, 'Get an Instant Quote')}
            {((p as any).subtitle || canEdit) && IET('subtitle', 'p', 'text-sm text-gray-500 mb-6', {}, 'Select your requirements and get an instant quote')}
            <div className="max-w-sm mx-auto space-y-3">
              {['Service Type', 'Quantity', 'Delivery Window'].map(label => (
                <div key={label} className="text-left space-y-1">
                  <label className="text-xs font-medium text-gray-600">{label}</label>
                  <select style={{ borderRadius: r }} className="w-full px-3 py-2 border border-gray-200 text-sm">
                    <option>Select...</option>
                  </select>
                </div>
              ))}
              {CTABtn('cta_label', 'cta_url', 'Calculate Price', 'w-full py-3 text-sm font-bold mt-2', { backgroundColor: primary_color, borderRadius: r, color: '#fff' })}
            </div>
          </div>
        )

      case 'ab_test_block': {
        const va = (p as any).variant_a || {}
        return (
          <div className="py-8 px-8 relative" style={{ backgroundColor: bg_color }}>
            <div className="absolute top-2 right-2 flex gap-1">
              <span className="text-xs bg-primary text-white px-2 py-0.5 rounded font-bold">A/B Test</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold">Variant A — {(p as any).split || 50}%</span>
            </div>
            <div className="text-center">
              <h2 style={{ fontFamily: font_heading, color: text_color }} className="text-2xl font-bold mb-4">{va.headline || 'Variant A Headline'}</h2>
              <button style={{ backgroundColor: primary_color, borderRadius: r, color: '#fff' }} className="px-6 py-2.5 text-sm font-semibold">
                {va.cta || 'Click Here A'}
              </button>
            </div>
          </div>
        )
      }

      case 'personalization_block': {
        return (
          <div className="py-8 px-8 relative" style={{ backgroundColor: bg_color }}>
            <div className="absolute top-2 right-2">
              <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded font-bold">Personalized</span>
            </div>
            <div className="text-center space-y-2">
              <p style={{ color: text_color }} className="text-sm font-semibold">{(p as any).default_content || 'Default message for all visitors'}</p>
              <p className="text-xs text-gray-400">
                Rule: <strong>{(p as any).rule || 'device'}</strong> — configure in Properties panel
              </p>
            </div>
          </div>
        )
      }

      case 'menu_grid':
      case 'menu_list': {
        // Live-data powered: group products by category. Falls back to manual items.
        const isLiveProducts = dsType === 'products' && liveProducts.length > 0
        const isLiveCategories = dsType === 'categories' && liveCategories.length > 0
        const groups: { category: string; items: { title: string; price?: string | null; image_url?: string | null; desc?: string | null }[] }[] = []
        if (isLiveProducts) {
          const bucket: Record<string, any[]> = {}
          for (const it of liveProducts) {
            const cat = (it.meta as any)?.category || 'Menu'
            bucket[cat] = bucket[cat] || []
            bucket[cat].push({
              title: it.title, price: it.price_formatted, image_url: it.image_url, desc: it.subtitle || it.description,
            })
          }
          for (const [cat, items] of Object.entries(bucket)) groups.push({ category: cat, items })
        } else if (isLiveCategories) {
          for (const c of liveCategories) groups.push({ category: c.title, items: [{ title: c.subtitle || '', desc: '' }] })
        } else if (!isTemplateBlock) {
          for (const cat of ((p as any).categories as string[] || ['Starters', 'Mains', 'Desserts'])) {
            groups.push({ category: cat, items: [{ title: 'Sample Item', price: '₹199', desc: 'Short description.' }] })
          }
        }
        return (
          <div className="py-16 px-8" style={{ backgroundColor: effectiveStyle.surface_color }}>
            {(p.title || canEdit) && IET('title', 'h2', 'text-3xl font-bold text-center mb-4', { fontFamily: font_heading, color: text_color }, 'Our Menu')}
            {(isLiveProducts || isLiveCategories) && (
              <div className="flex items-center justify-center gap-1.5 mb-6">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-600 font-semibold">Live · {isLiveProducts ? 'products by category' : 'your catalog categories'}</span>
              </div>
            )}
            <div className="max-w-5xl mx-auto space-y-8">
              {groups.slice(0, 6).map((g, gi) => (
                <div key={gi}>
                  <h3 className="font-bold text-sm uppercase tracking-wide mb-3" style={{ color: primary_color }}>{g.category}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {g.items.slice(0, 8).map((it, ii) => (
                      <div key={ii} style={{ backgroundColor: bg_color, borderRadius: r }} className="p-4 flex items-center gap-3 shadow-sm">
                        {it.image_url
                          ? <img src={mediaUrl(it.image_url)} alt={it.title} className="w-14 h-14 rounded object-cover shrink-0" />
                          : <div style={{ backgroundColor: `${primary_color}15`, borderRadius: r }} className="w-14 h-14 shrink-0 flex items-center justify-center"><Package className="w-5 h-5" style={{ color: primary_color }} /></div>
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold text-sm truncate">{it.title}</div>
                            {it.price && <div className="text-xs font-bold" style={{ color: primary_color }}>{it.price}</div>}
                          </div>
                          {it.desc && <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">{it.desc}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {isTemplateBlock && groups.length === 0 && !liveLoading && (
              <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
                <Database className="w-3 h-3" /> No products available yet.
              </p>
            )}
          </div>
        )
      }

      case 'gallery_masonry':
      case 'gallery_grid':
      case 'image_gallery': {
        const isLive = (dsType === 'media' && liveMedia.length > 0) || (dsType === 'products' && liveProducts.length > 0)
        const images: { src: string | null; alt: string }[] = dsType === 'media' && liveMedia.length > 0
          ? liveMedia.map(m => ({ src: m.image_url || m.url, alt: m.title }))
          : dsType === 'products' && liveProducts.length > 0
            ? liveProducts.filter(x => !!x.image_url).map(x => ({ src: x.image_url, alt: x.title }))
            : ((p as any).images as any[] || Array.from({ length: 8 }).map(() => ({ src: null as string | null, alt: '' })))
        const gridCols = (p as any).columns || 4
        return (
          <div className="py-14 px-8" style={{ backgroundColor: bg_color }}>
            {(p.title || canEdit) && IET('title', 'h2', 'text-2xl font-bold text-center mb-4', { fontFamily: font_heading }, 'Gallery')}
            {isLive && (
              <div className="flex items-center justify-center gap-1.5 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-600 font-semibold">Live · {dsType === 'media' ? 'your site media' : 'product images'}</span>
              </div>
            )}
            <div className={cn('grid gap-2 max-w-5xl mx-auto')} style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
              {images.slice(0, 12).map((img, i) => (
                <div key={i} className={cn('overflow-hidden', block.block_type === 'gallery_masonry' && (i % 3 === 0) ? 'row-span-2' : '')} style={{ borderRadius: r, backgroundColor: effectiveStyle.surface_color, aspectRatio: '1 / 1' }}>
                  {img.src
                    ? <img src={mediaUrl(img.src)} className="w-full h-full object-cover" alt={img.alt} />
                    : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-6 h-6 text-gray-300" /></div>
                  }
                </div>
              ))}
            </div>
          </div>
        )
      }

      case 'portfolio_grid': {
        const isLive = dsType === 'media' && liveMedia.length > 0
        const items: any[] = isLive
          ? liveMedia.map(m => ({ title: m.title, image_url: m.image_url || m.url }))
          : ((p as any).projects as any[] || Array.from({ length: 6 }).map((_, i) => ({ title: `Project ${i + 1}`, image_url: null })))
        const cols = (p as any).columns || 3
        return (
          <div className="py-16 px-8">
            {(p.title || canEdit) && IET('title', 'h2', 'text-3xl font-bold text-center mb-4', { fontFamily: font_heading }, 'Our Portfolio')}
            {isLive && (
              <div className="flex items-center justify-center gap-1.5 mb-6">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-600 font-semibold">Live · your site media library</span>
              </div>
            )}
            <div className="grid gap-4 max-w-5xl mx-auto" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {items.slice(0, cols * 2).map((it: any, i: number) => (
                <div key={i} style={{ borderRadius: r, backgroundColor: effectiveStyle.surface_color, aspectRatio: '4 / 3' }} className="overflow-hidden relative group">
                  {it.image_url
                    ? <img src={mediaUrl(it.image_url)} className="w-full h-full object-cover" alt={it.title} />
                    : <div className="w-full h-full flex items-center justify-center"><Camera className="w-8 h-8 text-gray-300" /></div>
                  }
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end p-3">
                    <div className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">{it.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      }

      case 'category_cards': {
        const isLive = dsType === 'categories' && liveCategories.length > 0
        const editorial = (p as any).layout === 'editorial'
        const cats: any[] = isLive
          ? liveCategories.map(c => ({
            title: c.title,
            subtitle: c.subtitle,
            count: (c.meta as any)?.count,
            image_url: (c.meta as any)?.image_url || (c as any).image_url,
          }))
          : ((p as any).categories as any[] || [{ title: 'Category A' }, { title: 'Category B' }, { title: 'Category C' }])
        const cols = (p as any).columns || 3
        if (editorial) {
          const eyebrow = (p as any).eyebrow as string | undefined
          return (
            <div className="py-16 sm:py-20 px-6 sm:px-12 max-w-7xl mx-auto" style={{ backgroundColor: bg_color }}>
              <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
                <div>
                  {(eyebrow || canEdit) && (
                    <div className="text-xs uppercase tracking-[0.3em] opacity-70" style={{ color: text_color }}>
                      <InlineEditableText
                        value={eyebrow || ''}
                        placeholder="Shop by category"
                        editable={canEdit}
                        as="span"
                        onCommit={v => commitProp('eyebrow' as any, v)}
                      />
                    </div>
                  )}
                  {(p.title || canEdit) && IET('title', 'h2', 'text-3xl sm:text-4xl md:text-5xl mt-2', { fontFamily: font_heading, color: text_color }, 'The edit')}
                </div>
                <span className="text-sm underline opacity-80 cursor-default" style={{ color: text_color }}>View all</span>
              </div>
              {isLive && (
                <div className="flex items-center gap-1.5 mb-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-600 font-semibold">Live · your catalog categories</span>
                </div>
              )}
              <div className="grid md:grid-cols-3 gap-1">
                {cats.slice(0, 9).map((c: any, i: number) => (
                  <div key={i} className="group relative aspect-[4/5] overflow-hidden cursor-pointer" style={{ borderRadius: r === '9999px' ? 0 : undefined }}>
                    {c.image_url
                      ? <img src={mediaUrl(c.image_url)} alt={c.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      : <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 p-6 text-white">
                      <h3 className="text-2xl font-semibold" style={{ fontFamily: font_heading }}>{c.title}</h3>
                      <span className="text-xs uppercase tracking-[0.2em] text-white/80">Shop now →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        }
        return (
          <div className="py-14 px-8" style={{ backgroundColor: bg_color }}>
            {(p.title || canEdit) && IET('title', 'h2', 'text-2xl font-bold text-center mb-4', { fontFamily: font_heading, color: text_color }, 'Browse Categories')}
            {isLive && (
              <div className="flex items-center justify-center gap-1.5 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-600 font-semibold">Live · your catalog categories</span>
              </div>
            )}
            <div className="grid gap-4 max-w-4xl mx-auto" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {cats.slice(0, 9).map((c: any, i: number) => (
                <div key={i} style={{ borderRadius: r, background: `linear-gradient(135deg, ${primary_color}, ${effectiveStyle.secondary_color})` }} className="p-6 text-white text-center shadow-md">
                  <div className="font-bold text-base">{c.title}</div>
                  {c.count != null && <div className="text-xs opacity-80 mt-1">{c.count} items</div>}
                </div>
              ))}
            </div>
          </div>
        )
      }

      case 'blog_grid':
      case 'blog_featured':
      case 'blog_list': {
        const posts: any[] = (p.posts as any[] || []).length
          ? (p.posts as any[])
          : isTemplateBlock
            ? []
            : Array.from({ length: 3 }).map((_, i) => ({ title: `Post ${i + 1}`, excerpt: 'Short preview of the post content.', date: new Date().toDateString() }))
        const cols = (p as any).columns || 3
        return (
          <div className="py-14 px-8" style={{ backgroundColor: bg_color }}>
            {(p.title || canEdit) && IET('title', 'h2', 'text-2xl font-bold text-center mb-8', { fontFamily: font_heading, color: text_color }, 'Latest Articles')}
            <div className="grid gap-5 max-w-5xl mx-auto" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {posts.slice(0, 6).map((post: any, i: number) => (
                <div key={i} style={{ backgroundColor: effectiveStyle.surface_color, borderRadius: r }} className="overflow-hidden shadow-sm">
                  <div className="h-32 bg-gray-100 flex items-center justify-center">
                    {post.image_url
                      ? <img src={mediaUrl(post.image_url)} className="w-full h-full object-cover" alt={post.title} />
                      : <FileText className="w-8 h-8 text-gray-300" />
                    }
                  </div>
                  <div className="p-4">
                    <div className="text-xs text-gray-400 mb-1">{post.date || ''}</div>
                    <div className="font-semibold text-sm mb-1 line-clamp-2">{post.title}</div>
                    <div className="text-xs text-gray-500 line-clamp-2">{post.excerpt}</div>
                  </div>
                </div>
              ))}
            </div>
            {isTemplateBlock ? (
              <p className="text-center text-xs text-gray-400 mt-4">
                Once you mark a page as page type <b>"blog"</b> in the editor, it will show up here.
              </p>
            ) : (
              <p className="text-center text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
                <Database className="w-3 h-3" /> Edit posts in the Properties panel or connect a CMS via External API
              </p>
            )}
          </div>
        )
      }

      case 'map_embed': {
        const pmeta: any = liveProfile?.meta || {}
        const lat = (p.map_lat as number | undefined) ?? pmeta.latitude
        const lng = (p.map_lng as number | undefined) ?? pmeta.longitude
        const addr = (p.address as string) || pmeta.address || ''
        const hasMapLocation = !!addr || (!!lat && !!lng)
        const mapSrc = lat && lng
          ? `https://www.openstreetmap.org/export/embed.html?bbox=${Number(lng) - 0.01},${Number(lat) - 0.01},${Number(lng) + 0.01},${Number(lat) + 0.01}&layer=mapnik&marker=${lat},${lng}`
          : addr
            ? `https://www.google.com/maps?q=${encodeURIComponent(addr)}&output=embed`
            : null
        return (
          <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${primary_color}15` }}>
                <MapPin className="w-5 h-5" style={{ color: primary_color }} />
              </div>
              {(p.title || canEdit) && IET('title', 'h2', 'text-2xl font-bold text-gray-900', { fontFamily: font_heading, color: '#111827' }, 'Find Us')}
            </div>
            {!!addr && <p className="text-gray-500 mb-6 flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 shrink-0" />{addr}</p>}
            {mapSrc ? (
              <div className="w-full h-80 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
                <iframe
                  src={mapSrc}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Map preview"
                />
              </div>
            ) : (
              <div className="w-full h-80 rounded-2xl bg-gray-100 flex flex-col items-center justify-center text-gray-400 px-4 text-center">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Add an address to show the map</p>
                {dsType === 'profile' && liveProfile && !hasMapLocation && (
                  <p className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    Set address in your vendor profile
                  </p>
                )}
              </div>
            )}
            {dsType === 'profile' && liveProfile && hasMapLocation && mapSrc && (
              <p className="text-center text-xs text-emerald-600 font-semibold mt-3 flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Live from your vendor profile
              </p>
            )}
          </section>
        )
      }

      case 'social_links': {
        const pmeta: any = liveProfile?.meta || {}
        const links: Record<string, string> = (p.links as any) || (p.social_links as any) || (dsType === 'profile' ? (pmeta.social_links || {}) : {})
        const entries = Object.entries(links).filter(([, url]) => !!url)
        const display = entries.length ? entries : [['twitter', '#'], ['instagram', '#'], ['linkedin', '#']] as [string, string][]
        return (
          <section className="py-12 px-4 sm:px-6 lg:px-8 text-center">
            {(p.title || canEdit) && IET('title', 'h3', 'text-lg font-semibold text-gray-700 mb-4', { color: '#374151' }, 'Follow Us')}
            <div className="flex justify-center gap-3 flex-wrap">
              {display.map(([k, url], i) => (
                <a
                  key={i}
                  href={url || '#'}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 hover:border-primary/40 transition-colors text-sm font-medium text-gray-600 hover:text-primary"
                  onClick={e => { if (url === '#') e.preventDefault() }}
                >
                  <Globe className="w-4 h-4 shrink-0" />
                  <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                </a>
              ))}
            </div>
            {entries.length > 0 && dsType === 'profile' && (
              <p className="text-center text-xs text-emerald-600 mt-3 font-semibold">Live · from your vendor profile</p>
            )}
          </section>
        )
      }

      case 'countdown': {
        const target = (p as any).target_date ? new Date((p as any).target_date) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        const diff = Math.max(0, target.getTime() - Date.now())
        const days = Math.floor(diff / 86400000)
        const hours = Math.floor((diff % 86400000) / 3600000)
        const mins = Math.floor((diff % 3600000) / 60000)
        const secs = Math.floor((diff % 60000) / 1000)
        return (
          <div className="py-16 px-8 text-center" style={{ backgroundColor: primary_color }}>
            {(p.title || canEdit) && IET('title', 'h2', 'text-2xl font-bold text-white mb-8', {}, 'Offer Ends In')}
            <div className="flex items-center justify-center gap-6">
              {[{ v: days, l: 'Days' }, { v: hours, l: 'Hours' }, { v: mins, l: 'Mins' }, { v: secs, l: 'Secs' }].map(({ v, l }) => (
                <div key={l} className="flex flex-col items-center">
                  <div className="text-4xl font-black text-white bg-white/20 rounded-xl w-16 h-16 flex items-center justify-center">{String(v).padStart(2, '0')}</div>
                  <div className="text-xs text-white/70 mt-1 uppercase tracking-widest">{l}</div>
                </div>
              ))}
            </div>
          </div>
        )
      }

      case 'coupon_banner':
        return (
          <div className="py-6 px-8" style={{ background: `linear-gradient(135deg, ${primary_color}15, ${accent_color}15)`, borderTop: `3px dashed ${accent_color}` }}>
            <div className="flex items-center justify-between flex-wrap gap-4 max-w-3xl mx-auto">
              <div>
                {(p.title || canEdit) && IET('title', 'p', 'font-bold text-base', { color: text_color }, 'Use code SAVE10 for 10% off!')}
              </div>
              <div style={{ backgroundColor: accent_color, borderRadius: r }} className="px-4 py-2 text-sm font-black text-white tracking-widest cursor-pointer">
                {IET('code', 'span', '', {}, 'SAVE10')}
              </div>
            </div>
          </div>
        )

      case 'payment_methods_strip':
        return (
          <div className="py-6 px-8 text-center" style={{ backgroundColor: effectiveStyle.surface_color }}>
            {(p.title || canEdit) && IET('title', 'p', 'text-xs font-medium text-gray-400 uppercase tracking-widest mb-3', {}, 'Secure Payments')}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {(['Visa', 'MC', 'UPI', 'GPay', 'COD'] as string[]).map((m: string) => (
                <div key={m} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-500 bg-white">{m}</div>
              ))}
            </div>
          </div>
        )

      case 'search_bar':
        return (
          <div className="py-8 px-8">
            <div className="max-w-xl mx-auto flex gap-2">
              <div className="flex-1 h-11 border-2 rounded-xl px-4 flex items-center text-sm text-gray-400" style={{ borderColor: `${primary_color}40` }}>
                {IET('placeholder', 'span', '', {}, 'Search products & services…')}
              </div>
              <div style={{ backgroundColor: primary_color, borderRadius: r }} className="px-5 h-11 flex items-center text-white text-sm font-semibold">
                Search
              </div>
            </div>
          </div>
        )

      case 'cookie_consent':
        return (
          <div className="mx-4 mb-4 rounded-xl border border-gray-200 bg-white shadow-lg px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-gray-500 flex-1">
              {IET('message', 'span', '', {}, 'We use cookies to improve your experience.')}
            </p>
            <div className="flex gap-2">
              <div className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 cursor-pointer">Decline</div>
              <div style={{ backgroundColor: primary_color, borderRadius: r }} className="px-3 py-1.5 text-xs text-white font-semibold cursor-pointer">Accept</div>
            </div>
          </div>
        )

      case 'product_detail':
        return (
          <div className="py-12 px-8 max-w-4xl mx-auto">
            <div className="grid grid-cols-2 gap-8 items-start">
              <div style={{ borderRadius: r, backgroundColor: effectiveStyle.surface_color }} className="aspect-square flex items-center justify-center">
                <ShoppingBag className="w-16 h-16 text-gray-200" />
              </div>
              <div className="space-y-4">
                <h2 className="text-2xl font-bold" style={{ fontFamily: font_heading }}>Product Name</h2>
                <div className="text-2xl font-black" style={{ color: primary_color }}>₹999</div>
                <p className="text-sm text-gray-500">Product description goes here. Add this block to a product page.</p>
                <div className="flex gap-2">
                  <div style={{ backgroundColor: primary_color, borderRadius: r }} className="flex-1 h-11 flex items-center justify-center text-white font-semibold text-sm">Add to Cart</div>
                </div>
                <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live · connected to your product catalog
                </div>
              </div>
            </div>
          </div>
        )

      case 'checkout_form':
        return (
          <div className="py-12 px-8 max-w-xl mx-auto">
            {(p.title || canEdit) && IET('title', 'h2', 'text-xl font-bold mb-6 text-center', { fontFamily: font_heading }, 'Checkout')}
            <div className="space-y-3">
              {['Full Name', 'Email Address', 'Phone Number', 'Delivery Address'].map(f => (
                <div key={f} className="h-11 border border-gray-200 rounded-lg px-4 flex items-center text-sm text-gray-400">{f}</div>
              ))}
              <div style={{ backgroundColor: primary_color, borderRadius: r }} className="h-12 flex items-center justify-center text-white font-bold text-sm">Place Order</div>
            </div>
          </div>
        )

      case 'product_reviews': {
        const reviews = (liveTestimonials || []).slice(0, 3).map((t: any) => ({
          name: t.title || 'Customer', rating: t.rating || 5, text: t.description || ''
        }))
        const display = reviews.length ? reviews : [
          { name: 'Happy Customer', rating: 5, text: 'Excellent quality and fast delivery!' },
          { name: 'Verified Buyer', rating: 4, text: 'Great product, highly recommended.' },
        ]
        return (
          <div className="py-12 px-8" style={{ backgroundColor: effectiveStyle.surface_color }}>
            {(p.title || canEdit) && IET('title', 'h2', 'text-2xl font-bold text-center mb-6', { fontFamily: font_heading }, 'Customer Reviews')}
            <div className="space-y-4 max-w-2xl mx-auto">
              {display.map((r: any, i: number) => (
                <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div style={{ backgroundColor: primary_color }} className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold">{r.name[0]}</div>
                    <div>
                      <div className="text-sm font-semibold">{r.name}</div>
                      <div className="flex">{Array.from({ length: 5 }).map((_, s) => (
                        <span key={s} style={{ color: s < r.rating ? accent_color : '#d1d5db' }} className="text-xs">★</span>
                      ))}</div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">{r.text || 'Great product!'}</p>
                </div>
              ))}
            </div>
            {reviews.length > 0 && <p className="text-center text-xs text-emerald-600 mt-4 font-semibold">Live · from your verified reviews</p>}
          </div>
        )
      }

      case 'booking_slot_picker':
        return (
          <div className="py-12 px-8 max-w-xl mx-auto text-center">
            {(p.title || canEdit) && IET('title', 'h2', 'text-2xl font-bold mb-2', { fontFamily: font_heading }, 'Book an Appointment')}
            {(p.subtitle || canEdit) && IET('subtitle', 'p', 'text-sm text-gray-400 mb-8', {}, 'Select a service and choose your preferred time')}
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-xl p-4 text-left">
                <div className="text-xs font-medium text-gray-400 uppercase mb-2">1. Select Service</div>
                <div className="h-10 bg-gray-50 rounded-lg border border-gray-200 flex items-center px-3 text-sm text-gray-400">Choose a service…</div>
              </div>
              <div className="border border-gray-200 rounded-xl p-4 text-left">
                <div className="text-xs font-medium text-gray-400 uppercase mb-2">2. Pick a Date</div>
                <div className="grid grid-cols-7 gap-1">{Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="text-xs text-center py-1.5 rounded cursor-pointer hover:bg-accent" style={i === 2 ? { backgroundColor: primary_color, color: '#fff', borderRadius: r } : { color: text_color }}>{i + 15}</div>
                ))}</div>
              </div>
              <div style={{ backgroundColor: primary_color, borderRadius: r }} className="h-11 flex items-center justify-center text-white font-semibold text-sm">
                {IET('cta_label', 'span', '', {}, 'Confirm Booking')}
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 mt-4 text-xs text-emerald-600 font-semibold">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live · connects to your services
            </div>
          </div>
        )

      case 'offer_banner':
      case 'promo_strip': {
        const bannerBg = (p.bg_color as string) || primary_color
        const bannerTextColor = (p.text_color as string) || '#ffffff'
        const bannerSubtext = (p.subtitle as string) || (p.discount as string) || (p.code ? `Code: ${p.code}` : '') || ''
        return (
          <div style={{ backgroundColor: bannerBg, color: bannerTextColor }} className="py-4 px-8 text-center">
            <div className="font-bold text-base" style={{ fontFamily: font_heading }}>
              {IET('headline', 'span', '', {}, (p.headline as string) || '🎉 Special Offer — Limited Time')}
            </div>
            {bannerSubtext && (
              <div className="text-sm mt-0.5 opacity-90">{bannerSubtext}</div>
            )}
          </div>
        )
      }

      case 'demo_video': {
        const videoUrl = (p.video_url || p.src || p.embed_url) as string | undefined
        return (
          <div className="py-12 px-8 text-center">
            {(p.title || p.headline) && (
              <h2 className="text-xl font-bold mb-4" style={{ fontFamily: font_heading, color: text_color }}>
                {IET('title', 'span', '', {}, (p.title || p.headline) as string)}
              </h2>
            )}
            <div className="aspect-video max-w-3xl mx-auto rounded-xl overflow-hidden bg-gray-900 flex items-center justify-center" style={{ borderRadius: r }}>
              {videoUrl
                ? <iframe src={videoUrl} className="w-full h-full" allow="autoplay; fullscreen" title="video" />
                : <div className="text-white/60 text-4xl">▶</div>
              }
            </div>
          </div>
        )
      }

      case 'html_embed': {
        const html = (p.html as string) || ''
        return (
          <div className="py-6 px-8">
            {html
              ? <div dangerouslySetInnerHTML={{ __html: html }} />
              : <div className="py-8 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg" style={{ borderRadius: r }}>
                  <div className="text-2xl mb-1">{'</>'}</div>
                  <div className="text-sm font-medium">HTML Embed — add your HTML in the properties panel</div>
                </div>
            }
          </div>
        )
      }

      default:
        return (
          <div style={{ backgroundColor: effectiveStyle.surface_color, borderRadius: r }} className="py-12 px-8 text-center text-gray-500 mx-8">
            <div className="text-2xl mb-2">🧩</div>
            <div className="font-semibold text-sm">{catalogBlockLabel(block)}</div>
            <div className="text-xs text-gray-400 mt-1">Edit this section in the properties panel</div>
          </div>
        )
    }
  }

  const hasShape = (topShape && topShape !== 'none') || (bottomShape && bottomShape !== 'none')
  const overlays: BlockOverlayItem[] = ((p as any).overlays as BlockOverlayItem[]) || []
  const needsRelative = hasShape || overlays.length > 0 || isEditing
  const bid = `b${block.id.replace(/-/g, '')}`
  const fieldStyleCss = Object.entries(fieldStyles).map(([key, fs]) => {
    const selectorKey = key.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return `
      [data-bid="${bid}"] [data-text-key="${selectorKey}"] {
        ${typeof fs.text_color_override === 'string' ? `color: ${fs.text_color_override} !important;` : ''}
        ${typeof fs.font_size_px === 'number' && fs.font_size_px > 0 ? `font-size: ${Math.round(fs.font_size_px)}px !important;` : ''}
        ${typeof fs.text_transform === 'string' ? `text-transform: ${fs.text_transform} !important;` : ''}
      }
    `
  }).join('\n')
  const inlineTextStyleValue = useMemo(() => ({
    styleForKey: styleForField,
    onActivateKey: (key: string) => onActiveTextFieldChange?.(key),
  }), [styleForField, onActiveTextFieldChange])

  return (
    <InlineTextStyleContext.Provider value={inlineTextStyleValue}>
      <div
        data-bid={bid}
        style={{ ...containerStyle, position: needsRelative ? 'relative' : undefined }}
        className="w-full"
      >
        {/* Inject CSS overrides so text color, px/em size, and case work despite Tailwind specificity */}
        {(textColorOverride || fontSizePx || textScale || textTransformCss || fieldStyleCss) && (
          <style>{`
            [data-bid="${bid}"] {
              ${textTransformCss ? `text-transform: ${textTransformCss} !important;` : ''}
            }
            [data-bid="${bid}"] h1,
            [data-bid="${bid}"] h2,
            [data-bid="${bid}"] h3,
            [data-bid="${bid}"] h4,
            [data-bid="${bid}"] p,
            [data-bid="${bid}"] li,
            [data-bid="${bid}"] blockquote {
              ${textColorOverride ? `color: ${textColorOverride} !important;` : ''}
              ${fontSizePx ? `font-size: ${fontSizePx}px !important;` : textScale ? `font-size: ${textScale}em !important;` : ''}
            }
            [data-bid="${bid}"] span.block-text {
              ${textColorOverride ? `color: ${textColorOverride} !important;` : ''}
            }
            ${overrideBg ? `
              [data-bid="${bid}"] .builder-block-content > * {
                background-color: ${overrideBg} !important;
                background-image: none !important;
              }
            ` : ''}
            ${fieldStyleCss}
          `}</style>
        )}
        {topShape && topShape !== 'none' && (
          <SectionShapeDivider shape={topShape} fillColor={shapeColor || '#ffffff'} position="top" />
        )}
        <div className="builder-block-content">
          {renderBlock()}
        </div>
        {/* Overlay elements (draggable within block) */}
        <BlockOverlayCanvas
          overlays={overlays}
          isEditing={isEditing && !!onOverlayUpdate}
          onUpdate={onOverlayUpdate}
          onOverlaySelectionChange={onOverlaySelectionChange}
          onOpenAiImageTools={onOpenAiImageTools}
          onOpenMediaLibrary={onOpenMediaLibrary}
          onPickLocalImage={onPickLocalImage}
          onImageFileDrop={onImageFileDrop}
          onEditLinkForOverlay={onEditLinkForOverlay}
          onOverlayContextMenu={onOverlayContextMenu}
          onRequestText={onRequestText}
        />
        {bottomShape && bottomShape !== 'none' && (
          <SectionShapeDivider shape={bottomShape} fillColor={shapeColor || '#ffffff'} position="bottom" />
        )}
      </div>
    </InlineTextStyleContext.Provider>
  )
}

// ── Gradient & Shadow presets ─────────────────────────────────────────────────

const GRADIENT_PRESETS = [
  { label: 'Mint Spice',  value: 'linear-gradient(135deg,#64C3A0,#13624A)' },
  { label: 'Ocean',         value: 'linear-gradient(135deg,#0ea5e9,#6366f1)' },
  { label: 'Sunset',        value: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
  { label: 'Forest',        value: 'linear-gradient(135deg,#10b981,#065f46)' },
  { label: 'Rose',          value: 'linear-gradient(135deg,#fb7185,#e11d48)' },
  { label: 'Gold',          value: 'linear-gradient(135deg,#fbbf24,#d97706)' },
  { label: 'Night Sky',     value: 'linear-gradient(135deg,#1e1b4b,#312e81,#13624A)' },
  { label: 'Aurora',        value: 'linear-gradient(135deg,#34d399,#3b82f6,#64C3A0)' },
  { label: 'Peach',         value: 'linear-gradient(135deg,#fdba74,#fb923c,#f97316)' },
  { label: 'Electric',      value: 'linear-gradient(135deg,#06b6d4,#64C3A0)' },
  { label: 'Candy',         value: 'linear-gradient(135deg,#f472b6,#fb7185,#fbbf24)' },
  { label: 'Dusk',          value: 'linear-gradient(160deg,#0f0c29,#302b63,#24243e)' },
  { label: 'Lime Burst',    value: 'linear-gradient(135deg,#84cc16,#10b981)' },
  { label: 'Fire',          value: 'linear-gradient(135deg,#ef4444,#f97316,#fbbf24)' },
  { label: 'Ice',           value: 'linear-gradient(135deg,#e0f2fe,#bfdbfe,#c7d2fe)' },
  { label: 'Midnight',      value: 'linear-gradient(135deg,#0f172a,#1e293b)' },
]

const SHADOW_PRESETS = [
  { label: 'None',     value: 'none' },
  { label: 'Soft',     value: '0 4px 24px 0 rgba(0,0,0,0.08)' },
  { label: 'Medium',   value: '0 8px 40px 0 rgba(0,0,0,0.16)' },
  { label: 'Harsh',    value: '4px 4px 0px 0px rgba(0,0,0,0.85)' },
  { label: 'Glow Vio', value: '0 0 40px 10px rgba(124,58,237,0.35)' },
  { label: 'Glow Blue',value: '0 0 40px 10px rgba(59,130,246,0.35)' },
  { label: 'Glow Pink',value: '0 0 40px 10px rgba(251,113,133,0.35)' },
  { label: 'Inner',    value: 'inset 0 2px 16px 0 rgba(0,0,0,0.12)' },
]

// ── Sub-item schema registry ─────────────────────────────────────────────────

type ItemFieldType = 'text' | 'textarea' | 'image' | 'number' | 'boolean' | 'emoji' | 'select'
interface ItemField { key: string; label: string; type: ItemFieldType; options?: string[] }
interface ItemSchema { arrayKey: string; itemLabel: string; defaultItem: Record<string, any>; fields: ItemField[] }

const ITEM_SCHEMAS: Record<string, ItemSchema> = {
  team_grid: {
    arrayKey: 'members', itemLabel: 'Member',
    defaultItem: { name: 'New Member', role: 'Role', bio: '', avatar_url: '' },
    fields: [
      { key: 'avatar_url', label: 'Photo', type: 'image' },
      { key: 'name',       label: 'Name',  type: 'text' },
      { key: 'role',       label: 'Role',  type: 'text' },
      { key: 'bio',        label: 'Bio',   type: 'textarea' },
    ],
  },
  features: {
    arrayKey: 'features', itemLabel: 'Feature',
    defaultItem: { title: 'New Feature', desc: 'Description', icon: '✨', image_url: '' },
    fields: [
      { key: 'image_url', label: 'Image',       type: 'image' },
      { key: 'icon',      label: 'Icon Emoji',  type: 'emoji' },
      { key: 'title',     label: 'Title',       type: 'text' },
      { key: 'desc',      label: 'Description', type: 'textarea' },
    ],
  },
  services_cards: {
    arrayKey: 'features', itemLabel: 'Service',
    defaultItem: { title: 'New Service', desc: 'Description', icon: '🛠️', image_url: '' },
    fields: [
      { key: 'image_url', label: 'Image',       type: 'image' },
      { key: 'icon',      label: 'Icon Emoji',  type: 'emoji' },
      { key: 'title',     label: 'Title',       type: 'text' },
      { key: 'desc',      label: 'Description', type: 'textarea' },
    ],
  },
  testimonials: {
    arrayKey: 'testimonials', itemLabel: 'Review',
    defaultItem: { quote: 'Great product!', name: 'Customer Name', role: 'Role', company: '', rating: 5, avatar_url: '' },
    fields: [
      { key: 'avatar_url', label: 'Photo',   type: 'image' },
      { key: 'name',       label: 'Name',    type: 'text' },
      { key: 'role',       label: 'Role',    type: 'text' },
      { key: 'company',    label: 'Company', type: 'text' },
      { key: 'rating',     label: 'Stars',   type: 'select', options: ['1','2','3','4','5'] },
      { key: 'quote',      label: 'Quote',   type: 'textarea' },
    ],
  },
  pricing: {
    arrayKey: 'plans', itemLabel: 'Plan',
    defaultItem: { name: 'New Plan', price: 0, period: 'mo', cta: 'Get Started', highlighted: false, features: [] },
    fields: [
      { key: 'name',        label: 'Plan Name',     type: 'text' },
      { key: 'price',       label: 'Price',         type: 'text' },
      { key: 'period',      label: 'Period',        type: 'text' },
      { key: 'cta',         label: 'Button Label',  type: 'text' },
      { key: 'highlighted', label: 'Featured Plan', type: 'boolean' },
    ],
  },
  faq: {
    arrayKey: 'faqs', itemLabel: 'FAQ',
    defaultItem: { q: 'New question?', a: 'Answer here.' },
    fields: [
      { key: 'q', label: 'Question', type: 'text' },
      { key: 'a', label: 'Answer',   type: 'textarea' },
    ],
  },
  gallery: {
    arrayKey: 'images', itemLabel: 'Image',
    defaultItem: { url: '', caption: '', alt: '' },
    fields: [
      { key: 'url',     label: 'Image URL', type: 'image' },
      { key: 'caption', label: 'Caption',   type: 'text' },
      { key: 'alt',     label: 'Alt Text',  type: 'text' },
    ],
  },
  trust_logos: {
    arrayKey: 'logos', itemLabel: 'Logo',
    defaultItem: { name: 'Brand', image_url: '' },
    fields: [
      { key: 'image_url', label: 'Logo Image', type: 'image' },
      { key: 'name',      label: 'Brand Name', type: 'text' },
      { key: 'url',       label: 'Link URL',   type: 'text' },
    ],
  },
}

// ── Inline Media Picker ───────────────────────────────────────────────────────

function InlineMediaPicker({
  siteId, value, onChange, label = 'Image',
}: {
  siteId: string
  value: string
  onChange: (url: string) => void
  label?: string
}) {
  const { data: mediaList = [] } = useMedia(siteId)
  const uploadMedia = useUploadMedia(siteId)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'library' | 'url'>('library')
  const [urlInput, setUrlInput] = useState(value || '')
  const fileRef = useRef<HTMLInputElement>(null)
  const resolved = value ? mediaUrl(value) : ''

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const saved = await uploadMedia.mutateAsync(file)
      onChange(saved.original_url)
      setOpen(false)
      toast.success('Uploaded!')
    } catch { toast.error('Upload failed') }
    e.target.value = ''
  }

  return (
    <div className="relative">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">{label}</label>

      {/* Image thumbnail / trigger */}
      <div
        onClick={() => setOpen(o => !o)}
        className={cn(
          'relative w-full h-24 rounded-xl overflow-hidden border-2 border-dashed cursor-pointer transition-all group',
          resolved ? 'border-primary/40' : 'border-gray-200 hover:border-primary/40'
        )}
      >
        {resolved ? (
          <>
            <img src={resolved} className="w-full h-full object-cover" alt=""
              onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3' }} />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-bold">Change Image</span>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onChange('') }}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >✕</button>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400">
            <ImageIcon className="w-6 h-6 opacity-40" />
            <span className="text-xs">Click to add image</span>
          </div>
        )}
      </div>

      {/* Dropdown picker */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {(['library', 'url'] as const).map(t => (
              <button key={t}
                onClick={() => setTab(t)}
                className={cn('flex-1 py-2 text-xs font-bold transition-colors',
                  tab === t ? 'text-primary border-b-2 border-primary bg-accent' : 'text-gray-500 hover:text-gray-700')}
              >
                {t === 'library' ? 'Media Library' : 'Paste URL'}
              </button>
            ))}
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="px-2 text-gray-400 hover:text-gray-700">
                <X className="w-3 h-3" /></button>
          </div>

          {tab === 'library' ? (
            <div className="p-2 space-y-2">
              {/* Upload button */}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadMedia.isPending}
                className="w-full py-1.5 border border-dashed border-primary/40 rounded-lg text-xs text-primary font-bold hover:bg-accent flex items-center justify-center gap-1"
              >
                {uploadMedia.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Upload New
              </button>
              {/* Library grid */}
              {mediaList.length === 0 ? (
                <div className="py-4 text-center text-xs text-gray-400">No media yet. Upload an image.</div>
              ) : (
                <div className="grid grid-cols-4 gap-1 max-h-40 overflow-y-auto">
                  {mediaList.map(m => {
                    const src = mediaUrl(m.original_url)
                    return (
                      <button
                        key={m.id}
                        onClick={() => { onChange(m.original_url); setOpen(false) }}
                        className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-all"
                      >
                        <img src={src} className="w-full h-full object-cover" alt={m.filename}
                          onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3' }} />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-2">
              <input
                type="text"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => { if (urlInput) { onChange(urlInput); setOpen(false) } }}
                className="w-full py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90"
              >
                Use This URL
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-item Editor ───────────────────────────────────────────────────────────

function SubItemEditor({
  schema, items, siteId, onUpdate, onPreview,
  columns, gap, itemSize,
  onColumnsChange, onGapChange, onItemSizeChange,
}: {
  schema: ItemSchema
  items: any[]
  siteId: string
  onUpdate: (items: any[]) => void
  onPreview: (items: any[]) => void
  columns: number
  gap: number
  itemSize: number
  onColumnsChange: (n: number) => void
  onGapChange: (n: number) => void
  onItemSizeChange: (n: number) => void
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  const updateItem = (idx: number, patch: Partial<any>) => {
    const next = items.map((it, i) => i === idx ? { ...it, ...patch } : it)
    onPreview(next)
    onUpdate(next)
  }

  const addItem = () => {
    const next = [...items, { ...schema.defaultItem }]
    onUpdate(next)
    setExpanded(e => new Set([...e, next.length - 1]))
  }

  const duplicateItem = (idx: number) => {
    const next = [...items.slice(0, idx + 1), { ...items[idx] }, ...items.slice(idx + 1)]
    onUpdate(next)
  }

  const deleteItem = (idx: number) => {
    if (items.length <= 1) { toast.error('Cannot delete last item'); return }
    const next = items.filter((_, i) => i !== idx)
    onUpdate(next)
  }

  const handleDragStart = (idx: number) => setDragging(idx)
  const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setOver(idx) }
  const handleDrop = (idx: number) => {
    if (dragging === null || dragging === idx) { setDragging(null); setOver(null); return }
    const next = [...items]
    const [moved] = next.splice(dragging, 1)
    next.splice(idx, 0, moved)
    onUpdate(next)
    setDragging(null); setOver(null)
  }

  return (
    <div className="space-y-3">
      {/* Layout controls */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-3 border border-gray-100">
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Layout & Spacing</div>

        {/* Columns */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Columns</span>
            <span className="text-xs font-mono text-primary font-bold">{columns}</span>
          </div>
          <div className="flex gap-1">
            {[1,2,3,4,5,6].map(n => (
              <button key={n}
                onClick={() => onColumnsChange(n)}
                className={cn('flex-1 py-1.5 rounded text-xs font-bold border transition-colors',
                  columns === n ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40')}
              >{n}</button>
            ))}
          </div>
        </div>

        {/* Gap */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Gap between items</span>
            <div className="flex items-center gap-1">
              <input
                type="number" min={0} max={80} step={4}
                value={gap}
                onChange={e => onGapChange(Math.max(0, Number(e.target.value)))}
                className="w-12 px-1 py-0.5 border border-gray-200 rounded text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-xs text-gray-400">px</span>
            </div>
          </div>
          <input type="range" min={0} max={80} step={4} value={gap}
            onChange={e => onGapChange(Number(e.target.value))}
            className="w-full accent-primary h-1.5" />
        </div>

        {/* Item size */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Card size</span>
            <span className="text-xs font-mono text-primary font-bold">{itemSize}px</span>
          </div>
          <input type="range" min={80} max={320} step={8} value={itemSize}
            onChange={e => onItemSizeChange(Number(e.target.value))}
            className="w-full accent-primary h-1.5" />
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            {schema.itemLabel}s ({items.length})
          </span>
          <button
            onClick={addItem}
            className="flex items-center gap-0.5 px-2 py-1 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add {schema.itemLabel}
          </button>
        </div>

        {items.map((item, idx) => {
          const isExpanded = expanded.has(idx)
          const isDraggingOver = over === idx
          const title = item.name || item.title || item.q || `${schema.itemLabel} ${idx + 1}`
          const imgKey = schema.fields.find(f => f.type === 'image')?.key
          const thumb = imgKey && item[imgKey] ? mediaUrl(item[imgKey]) : null

          return (
            <div
              key={idx}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={() => { setDragging(null); setOver(null) }}
              className={cn(
                'rounded-xl border-2 overflow-hidden transition-all',
                isDraggingOver ? 'border-primary/60 bg-accent' : 'border-gray-100 bg-white',
                dragging === idx && 'opacity-40'
              )}
            >
              {/* Item header */}
              <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(e => {
                  const n = new Set(e)
                  n.has(idx) ? n.delete(idx) : n.add(idx)
                  return n
                })}
              >
                <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab shrink-0" />
                {/* Thumbnail */}
                {thumb ? (
                  <img src={thumb} className="w-7 h-7 rounded-lg object-cover shrink-0 border border-gray-100" alt="" />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-xs">{(title[0] || '?').toUpperCase()}</span>
                  </div>
                )}
                <span className="text-xs font-medium text-gray-700 flex-1 truncate">{title}</span>
                <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => duplicateItem(idx)}
                    className="p-1 text-gray-400 hover:text-primary transition-colors"
                    title="Duplicate"
                  ><Copy className="w-3 h-3" /></button>
                  <button
                    onClick={() => deleteItem(idx)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete"
                  ><Trash2 className="w-3 h-3" /></button>
                </div>
                <ChevronRight className={cn('w-3.5 h-3.5 text-gray-400 transition-transform shrink-0', isExpanded && 'rotate-90')} />
              </div>

              {/* Expanded fields */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-gray-100 bg-gray-50">
                  {schema.fields.map(field => {
                    if (field.type === 'image') return (
                      <InlineMediaPicker
                        key={field.key}
                        siteId={siteId}
                        value={item[field.key] || ''}
                        label={field.label}
                        onChange={url => updateItem(idx, { [field.key]: url })}
                      />
                    )
                    if (field.type === 'boolean') return (
                      <label key={field.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!item[field.key]}
                          onChange={e => updateItem(idx, { [field.key]: e.target.checked })}
                          className="rounded accent-primary w-4 h-4"
                        />
                        <span className="text-xs font-medium text-gray-700">{field.label}</span>
                      </label>
                    )
                    if (field.type === 'select') return (
                      <div key={field.key} className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{field.label}</label>
                        <div className="flex gap-1">
                          {(field.options || []).map(opt => (
                            <button key={opt}
                              onClick={() => updateItem(idx, { [field.key]: Number(opt) || opt })}
                              className={cn('flex-1 py-1 rounded border text-xs font-bold transition-colors',
                                String(item[field.key]) === opt ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40')}
                            >{opt}</button>
                          ))}
                        </div>
                      </div>
                    )
                    if (field.type === 'emoji') return (
                      <div key={field.key} className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{field.label}</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {['✨','⚡','🚀','🎯','💡','🛡️','🔥','💎','🌟','🎨','🔧','📱','🌍','❤️','🏆'].map(e => (
                            <button key={e}
                              onClick={() => updateItem(idx, { [field.key]: e })}
                              className={cn('w-8 h-8 rounded-lg text-base border-2 transition-all hover:scale-110',
                                item[field.key] === e ? 'border-primary bg-accent' : 'border-transparent bg-white hover:border-primary/30')}
                            >{e}</button>
                          ))}
                          <input
                            value={item[field.key] || ''}
                            onChange={e => updateItem(idx, { [field.key]: e.target.value })}
                            className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
                            placeholder="or type"
                          />
                        </div>
                      </div>
                    )
                    if (field.type === 'textarea') return (
                      <div key={field.key} className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{field.label}</label>
                        <textarea
                          value={item[field.key] || ''}
                          onChange={e => updateItem(idx, { [field.key]: e.target.value })}
                          rows={2}
                          className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring resize-y leading-relaxed"
                        />
                      </div>
                    )
                    // default: text / number
                    return (
                      <div key={field.key} className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{field.label}</label>
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={item[field.key] || ''}
                          onChange={e => updateItem(idx, { [field.key]: e.target.value })}
                          className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Props Editor ──────────────────────────────────────────────────────────────

const FIELD_CONTEXTS: Record<string, string> = {
  headline:     'a short, punchy, benefit-driven headline (max 8 words)',
  subtitle:     'a 1-2 sentence compelling subtitle that expands the headline',
  title:        'a clear, engaging section title',
  description:  'a 2-3 sentence descriptive paragraph that persuades the reader',
  eyebrow:      'a short eyebrow label (2-4 words in uppercase)',
  cta_primary:  'a strong action-oriented primary CTA button label (2-4 words)',
  cta_secondary:'a softer secondary CTA label (2-4 words)',
  cta_label:    'a compelling CTA button label (2-4 words)',
  brand:        'a memorable brand name',
  text:         'an engaging short text for this section',
}

// ── Stable InputRow component (outside PropsEditor to avoid remount on re-render) ──
interface InputRowProps {
  blockId: string
  fieldKey: string
  label: string
  serverValue: string
  multiline?: boolean
  placeholder?: string
  linkTarget?: string
  queued: number
  hasHistory: boolean
  isGenerating: boolean
  onCommit: (val: string) => void
  onPreview: (val: string) => void
  onAI: () => void
  onUndo: () => void
  onLink?: (anchor: { x: number; y: number }) => void
}

function PropsInputRow({
  blockId, fieldKey, label, serverValue, multiline, placeholder,
  linkTarget, queued, hasHistory, isGenerating, onCommit, onPreview, onAI, onUndo, onLink,
}: InputRowProps) {
  const [localVal, setLocalVal] = useState(serverValue)
  const isEditingRef = useRef(false)

  // Sync external changes (block switch, AI overwrite, undo) into local state,
  // but never while the user is actively typing — otherwise a stale server
  // value echo would wipe out their in-progress keystrokes.
  useEffect(() => {
    if (isEditingRef.current) return
    setLocalVal(serverValue)
  }, [blockId, fieldKey, serverValue])

  const handleChange = (val: string) => {
    isEditingRef.current = true
    setLocalVal(val)
    onPreview(val)          // instant canvas update while typing
  }

  const handleBlur = () => {
    isEditingRef.current = false
    onCommit(localVal)      // persist to API on blur
  }

  const handleFocus = () => {
    isEditingRef.current = true
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring bg-white text-gray-800 placeholder-gray-400 leading-relaxed"

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-gray-700 flex-1 select-none">{label}</label>
        {hasHistory && (
          <button
            onMouseDown={e => { e.preventDefault(); onUndo() }}
            className="p-0.5 text-gray-400 hover:text-amber-500 transition-colors"
            title="Undo AI change"
          >
            <Undo2 className="w-3 h-3" />
          </button>
        )}
        {onLink && (
          <button
            onMouseDown={e => {
              e.preventDefault()
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              onLink({ x: rect.left, y: rect.bottom + 6 })
            }}
            className={cn(
              'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold transition-all border',
              linkTarget
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-white text-gray-500 border-gray-200 hover:text-primary hover:border-primary/40 hover:bg-accent',
            )}
            title={linkTarget ? `Linked to ${linkTarget}` : 'Insert link'}
          >
            <Link2 className="w-3 h-3" />
            {linkTarget ? 'Linked' : 'Link'}
          </button>
        )}
        <button
          onMouseDown={e => { e.preventDefault(); onAI() }}
          disabled={isGenerating}
          className={cn(
            'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold transition-all',
            queued > 0
              ? 'bg-primary text-white shadow-sm'
              : 'text-primary hover:bg-accent border border-primary/30'
          )}
          title={queued > 0 ? `Apply next suggestion (${queued} more queued)` : 'Generate with AI'}
        >
          {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {queued > 0 ? `Next (${queued})` : 'AI'}
        </button>
      </div>

      {multiline ? (
        <textarea
          value={localVal}
          onChange={e => handleChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          rows={3}
          className={cn(inputClass, 'resize-y min-h-[72px]')}
        />
      ) : (
        <input
          type="text"
          value={localVal}
          onChange={e => handleChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
    </div>
  )
}

// ── Block Quick Presets ───────────────────────────────────────────────────────
const BLOCK_QUICK_PRESETS: Record<string, { label: string; desc?: string; props: Record<string, any> }[]> = {
  hero: [
    { label: '🌊 Gradient Dark', desc: 'Violet/indigo gradient', props: { bg_style: 'gradient', gradient_preset: 'Violet → Indigo', overlay: true } },
    { label: '📷 Image Full', desc: 'Full-bleed image BG', props: { bg_style: 'image', overlay: true } },
    { label: '⬜ Clean Light', desc: 'White minimal', props: { bg_style: 'minimal', overlay: false } },
    { label: '🖤 Dark Bold', desc: 'Dark dramatic', props: { bg_style: 'solid', bg_color: '#0f172a', overlay: false } },
  ],
  hero_split: [
    { label: '🌊 Gradient Left', props: { bg_style: 'gradient', layout: 'split' } },
    { label: '⬜ White Clean', props: { bg_style: 'minimal', layout: 'split' } },
    { label: '📷 Image Right', desc: 'Image on right side', props: { bg_style: 'minimal', layout: 'split' } },
  ],
  features: [
    { label: '3-Col Grid', desc: 'Classic 3-column', props: { layout: 'grid-3', columns: 3 } },
    { label: '4-Col Grid', desc: 'Compact 4-column', props: { layout: 'grid-4', columns: 4 } },
    { label: '2-Col List', desc: 'Icon + text rows', props: { layout: 'grid-2', columns: 2 } },
  ],
  stats: [
    { label: '4 Stats Dark', props: { bg_style: 'dark', columns: 4 } },
    { label: '3 Stats Light', props: { bg_style: 'light', columns: 3 } },
    { label: '3 Stats Gradient', props: { bg_style: 'gradient', columns: 3 } },
  ],
  testimonials: [
    { label: '3-Col Cards', props: { layout: 'grid', columns: 3 } },
    { label: 'Masonry', props: { layout: 'masonry', columns: 2 } },
    { label: 'Centered Quote', props: { layout: 'centered', columns: 1 } },
  ],
  cta: [
    { label: '🔥 Bold Gradient', props: { bg_style: 'gradient' } },
    { label: '🖤 Dark Premium', props: { bg_style: 'dark' } },
    { label: '⬜ Light Minimal', props: { bg_style: 'light' } },
  ],
  pricing: [
    { label: '3-Plan Standard', props: { columns: 3, show_annual_toggle: true } },
    { label: '2-Plan Simple', props: { columns: 2, show_annual_toggle: false } },
  ],
  team_grid: [
    { label: '4-Col Cards', props: { columns: 4, card_style: 'card' } },
    { label: '3-Col Large', props: { columns: 3, card_style: 'card' } },
    { label: '5-Col Compact', props: { columns: 5, card_style: 'minimal' } },
  ],
  nav: [
    { label: '🔵 Transparent', props: { nav_style: 'transparent' } },
    { label: '⬜ White Solid', props: { nav_style: 'white' } },
    { label: '🖤 Dark Bar', props: { nav_style: 'dark' } },
  ],
}


// ── P3.4 Per-breakpoint block style overrides ─────────────────────────────────
type Breakpoint = 'desktop' | 'tablet' | 'mobile'

interface BreakpointStyleOverrides {
  desktop?: Record<string, unknown>
  tablet?: Record<string, unknown>
  mobile?: Record<string, unknown>
  [key: string]: unknown
}

function BlockBreakpointStyles({
  styleOverrides,
  onChange,
}: {
  styleOverrides: BreakpointStyleOverrides
  onChange: (overrides: BreakpointStyleOverrides) => void
}) {
  const [bp, setBp] = React.useState<Breakpoint>('desktop')

  const bpStyle = (styleOverrides[bp] || {}) as Record<string, unknown>

  const updateBpProp = (key: string, value: unknown) => {
    onChange({
      ...styleOverrides,
      [bp]: { ...bpStyle, [key]: value },
    })
  }

  const STYLE_FIELDS: { key: string; label: string; type: 'color' | 'range' | 'select'; options?: string[]; min?: number; max?: number; step?: number }[] = [
    { key: 'bg_color', label: 'Background', type: 'color' },
    { key: 'text_color', label: 'Text Color', type: 'color' },
    { key: 'padding_top', label: 'Padding Top', type: 'range', min: 0, max: 120, step: 4 },
    { key: 'padding_bottom', label: 'Padding Bottom', type: 'range', min: 0, max: 120, step: 4 },
    { key: 'font_size', label: 'Font Size', type: 'select', options: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'] },
  ]

  return (
    <div className="space-y-2 pt-1 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">Block Styles</label>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
          {(['desktop', 'tablet', 'mobile'] as Breakpoint[]).map(b => (
            <button
              key={b}
              onClick={() => setBp(b)}
              className={cn('px-2 py-1 font-medium transition-colors', bp === b ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50')}
            >
              {b === 'desktop' ? '🖥' : b === 'tablet' ? '📱' : '📲'}
            </button>
          ))}
        </div>
      </div>
      {STYLE_FIELDS.map(({ key, label, type, options, min, max, step }) => (
        <div key={key} className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
          {type === 'color' && (
            <input
              type="color"
              value={(bpStyle[key] as string) || '#ffffff'}
              onChange={e => updateBpProp(key, e.target.value)}
              className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
            />
          )}
          {type === 'range' && (
            <>
              <input type="range" min={min} max={max} step={step}
                value={(bpStyle[key] as number) ?? 0}
                onChange={e => updateBpProp(key, Number(e.target.value))}
                className="flex-1 accent-primary h-1" />
              <span className="text-xs text-gray-400 w-8 text-right">{(bpStyle[key] as number) ?? 0}</span>
            </>
          )}
          {type === 'select' && (
            <select
              value={(bpStyle[key] as string) || 'base'}
              onChange={e => updateBpProp(key, e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1"
            >
              {options!.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
        </div>
      ))}
      {Object.keys(styleOverrides[bp] || {}).length > 0 && (
        <button
          onClick={() => onChange({ ...styleOverrides, [bp]: {} })}
          className="text-xs text-red-400 hover:text-red-600"
        >✕ Reset {bp} styles</button>
      )}
    </div>
  )
}


// ── P3.2 Branch Visibility Selector ──────────────────────────────────────────
function BranchVisibilitySelector({
  visibleBranches,
  onChange,
}: {
  visibleBranches: string[] | null
  onChange: (branches: string[] | null) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [branches, setBranches] = React.useState<{code: string; name: string}[]>([])

  React.useEffect(() => {
    // Load store branches from live resource
    fetch('/api/v1/vendors/me/websites/live-preview/stores')
      .catch(() => null)
      .then(r => r?.json().catch(() => null))
      .then((data: any) => {
        if (Array.isArray(data?.items)) {
          setBranches(data.items.map((s: any) => ({ code: s.code || s.id, name: s.name })))
        }
      })
  }, [])

  const allSelected = visibleBranches === null
  const selectedSet = new Set(visibleBranches ?? [])

  const toggle = (code: string) => {
    const next = new Set(selectedSet)
    if (next.has(code)) next.delete(code); else next.add(code)
    onChange(next.size === branches.length ? null : Array.from(next))
  }

  return (
    <div className="pt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-primary hover:text-primary flex items-center gap-1"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
        {allSelected ? 'All branches' : `${selectedSet.size} branch${selectedSet.size !== 1 ? 'es' : ''}`}
        <svg className={`w-3 h-3 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="mt-1.5 p-2 bg-white rounded-lg border border-gray-200 shadow-sm space-y-1 max-h-36 overflow-y-auto">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={allSelected}
              onChange={() => onChange(null)}
              className="rounded accent-primary" />
            <span className="text-xs text-gray-600">All branches</span>
          </label>
          {branches.map(b => (
            <label key={b.code} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={allSelected || selectedSet.has(b.code)}
                onChange={() => toggle(b.code)}
                className="rounded accent-primary" />
              <span className="text-xs text-gray-600">{b.name} ({b.code})</span>
            </label>
          ))}
          {branches.length === 0 && (
            <p className="text-xs text-gray-400">No branch stores found</p>
          )}
        </div>
      )}
    </div>
  )
}


function PropsEditor({
  block, onUpdate, onPreview, siteId, pages, onAddPage, onEditPropLink,
}: {
  block: WebsiteBlock
  onUpdate: (props: Partial<BlockProps>) => void
  onPreview: (props: Partial<BlockProps>) => void
  siteId: string
  pages?: WebsitePage[]
  onAddPage?: () => void
  onEditPropLink?: (propKey: string, anchor: { x: number; y: number }) => void
}) {
  const p = block.props
  const aiText = useAIGenerateText(siteId)

  // Per-field AI state
  const [fieldSuggestions, setFieldSuggestions] = useState<Record<string, string[]>>({})
  const [fieldHistory, setFieldHistory] = useState<Record<string, string>>({})
  const [fieldLoading, setFieldLoading] = useState<Record<string, boolean>>({})

  // Spacing sliders — read from block.props (where onUpdate writes)
  const [paddingTop, setPaddingTop] = useState<number>((p as any).padding_top ?? 0)
  const [paddingBottom, setPaddingBottom] = useState<number>((p as any).padding_bottom ?? 0)

  // Sync spacing when block changes
  useEffect(() => {
    setPaddingTop((p as any).padding_top ?? 0)
    setPaddingBottom((p as any).padding_bottom ?? 0)
  }, [block.id, (p as any).padding_top, (p as any).padding_bottom])

  // Smart Design state
  const [smartLoading, setSmartLoading] = useState(false)

  // ── Per-field AI handler ────────────────────────────────────────────────
  const handleFieldAI = useCallback(async (fieldKey: string) => {
    const existing = fieldSuggestions[fieldKey] || []
    const currentVal = (p as any)[fieldKey] || ''

    // If we already have queued suggestions, apply the next one
    if (existing.length > 0) {
      const [next, ...rest] = existing
      setFieldHistory(h => ({ ...h, [fieldKey]: currentVal }))
      onUpdate({ [fieldKey]: next })
      setFieldSuggestions(s => ({ ...s, [fieldKey]: rest }))
      if (rest.length === 0) toast.success('Showing last suggestion. Click AI again to generate more.')
      return
    }

    // Generate a fresh batch
    setFieldLoading(l => ({ ...l, [fieldKey]: true }))
    try {
      const context = FIELD_CONTEXTS[fieldKey] || `the "${fieldKey}" text`
      const blockDesc = block.label || block.block_type.replace(/_/g, ' ')
      const prompt = `For a "${blockDesc}" website section, generate ${context}. The current value is: "${currentVal || 'empty'}". Return ONLY the text, nothing else.`
      const res = await aiText.mutateAsync({ prompt, field: fieldKey })
      // Queue: show first immediately, keep rest
      const alts = [res.result, ...(res.alternatives || [])].filter(Boolean)
      if (alts.length > 0) {
        setFieldHistory(h => ({ ...h, [fieldKey]: currentVal }))
        onUpdate({ [fieldKey]: alts[0] })
        setFieldSuggestions(s => ({ ...s, [fieldKey]: alts.slice(1) }))
        if (alts.length > 1) toast.success(`Applied! ${alts.length - 1} more suggestion${alts.length > 2 ? 's' : ''} queued — click AI again`)
        else toast.success('AI text applied!')
      }
    } catch { toast.error('AI suggestion failed') }
    setFieldLoading(l => ({ ...l, [fieldKey]: false }))
  }, [p, block, fieldSuggestions, aiText, onUpdate])

  const handleFieldUndo = useCallback((fieldKey: string) => {
    const prev = fieldHistory[fieldKey]
    if (prev !== undefined) {
      onUpdate({ [fieldKey]: prev })
      setFieldHistory(h => { const n = { ...h }; delete n[fieldKey]; return n })
      toast.success('Reverted to previous value')
    }
  }, [fieldHistory, onUpdate])

  // ── Smart Design AI ─────────────────────────────────────────────────────
  const handleSmartDesign = useCallback(async () => {
    setSmartLoading(true)
    try {
      const blockType = block.block_type
      const designs: Record<string, any>[] = [
        // Gradient hero
        { bg_style: 'gradient', gradient_preset: GRADIENT_PRESETS[Math.floor(Math.random() * 6)].value },
        // Dark with glow
        { bg_style: 'dark', block_shadow: SHADOW_PRESETS[4].value },
        // Colorful split
        { bg_style: 'split', bg_color: '#f3fbf7', block_shadow: SHADOW_PRESETS[1].value },
      ]
      const picked = designs[Math.floor(Math.random() * designs.length)]
      // Also generate fresh headline/title
      const textFields = ['headline', 'title', 'subtitle'].filter(k => (p as any)[k] !== undefined)
      const updates: any = { ...picked }
      if (textFields.length > 0) {
        const res = await aiText.mutateAsync({
          prompt: `For a "${block.block_type}" website section, write an engaging ${textFields[0]}. Be creative, concise, and compelling.`,
          field: textFields[0],
        })
        updates[textFields[0]] = res.result
        if (textFields[1] && res.alternatives?.[0]) updates[textFields[1]] = res.alternatives[0]
      }
      onUpdate(updates)
      toast.success('✨ Smart Design applied!')
    } catch { toast.error('Smart Design failed') }
    setSmartLoading(false)
  }, [block, p, aiText, onUpdate])

  // ── InputRow — render helper that inlines PropsInputRow ───────────────
  // CRITICAL: this is NOT a React component. Declaring a component inside
  // PropsEditor would create a fresh component type on every render, forcing
  // React to unmount PropsInputRow on every keystroke (breaks typing / focus).
  // We call this as a plain function `inputRow({...})` in JSX so that React
  // only sees the stable, module-level PropsInputRow at the call site.
  const inputRow = (opts: {
    label: string; fieldKey: string; multiline?: boolean; placeholder?: string
  }) => (
    <PropsInputRow
      key={opts.fieldKey}
      blockId={block.id}
      fieldKey={opts.fieldKey}
      label={opts.label}
      serverValue={String((p as any)[opts.fieldKey] ?? '')}
      multiline={opts.multiline}
      placeholder={opts.placeholder}
      linkTarget={String((p as any)[
        opts.fieldKey === 'cta_label'
          ? 'cta_url'
          : opts.fieldKey.endsWith('_url')
            ? opts.fieldKey
            : `${opts.fieldKey}_url`
      ] ?? '')}
      queued={(fieldSuggestions[opts.fieldKey] || []).length}
      hasHistory={fieldHistory[opts.fieldKey] !== undefined}
      isGenerating={!!fieldLoading[opts.fieldKey]}
      onCommit={val => onUpdate({ [opts.fieldKey]: val })}
      onPreview={val => onPreview({ [opts.fieldKey]: val })}
      onAI={() => handleFieldAI(opts.fieldKey)}
      onUndo={() => handleFieldUndo(opts.fieldKey)}
      onLink={onEditPropLink ? anchor => onEditPropLink(opts.fieldKey, anchor) : undefined}
    />
  )

  // ── Fields ──────────────────────────────────────────────────────────────
  const commonFields = (
    <div className="space-y-3">
      {p.headline    !== undefined && inputRow({ label: 'Headline',      fieldKey: 'headline',      placeholder: 'Your compelling headline…' })}
      {p.subtitle    !== undefined && inputRow({ label: 'Subtitle',      fieldKey: 'subtitle',      multiline: true, placeholder: 'Expand your headline here…' })}
      {p.title       !== undefined && inputRow({ label: 'Title',         fieldKey: 'title',         placeholder: 'Section title…' })}
      {p.description !== undefined && inputRow({ label: 'Description',   fieldKey: 'description',   multiline: true, placeholder: 'Describe this section…' })}
      {p.eyebrow     !== undefined && inputRow({ label: 'Eyebrow',       fieldKey: 'eyebrow',       placeholder: 'TAGLINE' })}
      {p.cta_primary !== undefined && inputRow({ label: 'Primary CTA',   fieldKey: 'cta_primary',   placeholder: 'Get Started' })}
      {p.cta_primary !== undefined && inputRow({ label: '↳ Primary link', fieldKey: 'cta_primary_url',   placeholder: '/signup or /products/my-product' })}
      {p.cta_secondary!== undefined && inputRow({ label: 'Secondary CTA',fieldKey: 'cta_secondary', placeholder: 'Learn More' })}
      {p.cta_secondary!== undefined && inputRow({ label: '↳ Secondary link', fieldKey: 'cta_secondary_url', placeholder: '/about or https://...' })}
      {p.cta_label   !== undefined && inputRow({ label: 'CTA Label',     fieldKey: 'cta_label',     placeholder: 'Click Here' })}
      {p.cta_label   !== undefined && inputRow({ label: '↳ CTA link',    fieldKey: 'cta_url',       placeholder: '/signup or /contact' })}
      {p.brand       !== undefined && inputRow({ label: 'Brand Name',    fieldKey: 'brand',         placeholder: 'Your Brand' })}
      {p.text        !== undefined && inputRow({ label: 'Text',          fieldKey: 'text',          multiline: true, placeholder: 'Enter text…' })}
      {p.copyright   !== undefined && inputRow({ label: 'Copyright',     fieldKey: 'copyright',     placeholder: '© 2026 Your Company' })}
    </div>
  )

  const bgStyleField = p.bg_style !== undefined && (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-600">Background Style</label>
      <div className="grid grid-cols-5 gap-1">
        {['gradient','minimal','image','dark','split'].map(s => (
          <button
            key={s}
            onClick={() => onUpdate({ bg_style: s as any })}
            className={cn(
              'py-1.5 text-xs font-bold rounded border transition-colors',
              p.bg_style === s ? 'bg-primary text-white border-primary' : 'text-gray-500 border-gray-200 hover:border-primary/40'
            )}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
    </div>
  )

  // Gradient presets (shown when bg_style=gradient)
  const gradientField = p.bg_style === 'gradient' && (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-600">Gradient Preset</label>
      <div className="grid grid-cols-4 gap-1.5">
        {GRADIENT_PRESETS.map(g => (
          <button
            key={g.label}
            onClick={() => onUpdate({ gradient_preset: g.value } as any)}
            title={g.label}
            className={cn(
              'aspect-square rounded-lg border-2 transition-all',
              (p as any).gradient_preset === g.value ? 'border-primary scale-105' : 'border-transparent hover:border-primary/40'
            )}
            style={{ background: g.value }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="text-xs text-gray-500">From</label>
          <input type="color" value={(p as any).gradient_from || '#64C3A0'}
            onChange={e => onUpdate({ gradient_from: e.target.value } as any)}
            className="w-full h-8 rounded border border-gray-200 cursor-pointer p-0.5" />
        </div>
        <div>
          <label className="text-xs text-gray-500">To</label>
          <input type="color" value={(p as any).gradient_to || '#13624A'}
            onChange={e => onUpdate({ gradient_to: e.target.value } as any)}
            className="w-full h-8 rounded border border-gray-200 cursor-pointer p-0.5" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">Direction</label>
        <select
          value={(p as any).gradient_dir || '135deg'}
          onChange={e => onUpdate({ gradient_dir: e.target.value } as any)}
          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs"
        >
          {[['135deg','↘ Diagonal'],['to right','→ Horizontal'],['to bottom','↓ Vertical'],['to top right','↗ Top-Right'],['circle at center','◉ Radial']].map(([v,l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
    </div>
  )

  // ImagePickerField — used for any image-bearing block prop
  const ImagePickerField = useCallback(({ label, fieldKey, hint }: { label: string; fieldKey: string; hint?: string }) => {
    const currentUrl = (p as any)[fieldKey] as string | undefined
    const resolved = currentUrl ? mediaUrl(currentUrl) : ''
    const [imgOk, setImgOk] = useState(true)
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <label className="text-xs font-medium text-gray-600 flex-1">{label}</label>
          {currentUrl && (
            <button onClick={() => onUpdate({ [fieldKey]: '' })} className="text-xs text-red-400 hover:text-red-600">✕ Clear</button>
          )}
        </div>
        {/* Large image preview or drop zone */}
        <div
          className={cn(
            'relative rounded-xl overflow-hidden border-2 transition-all',
            currentUrl && resolved && imgOk
              ? 'border-primary/30 bg-gray-100'
              : 'border-dashed border-gray-200 bg-gray-50 flex items-center justify-center'
          )}
          style={{ minHeight: currentUrl && resolved && imgOk ? undefined : '96px' }}
        >
          {currentUrl && resolved ? (
            <>
              <img
                key={resolved}
                src={resolved}
                className="w-full object-cover"
                style={{ maxHeight: '140px', display: imgOk ? undefined : 'none' }}
                alt=""
                onLoad={() => setImgOk(true)}
                onError={() => setImgOk(false)}
              />
              {!imgOk && (
                <div className="w-full h-24 flex flex-col items-center justify-center text-gray-400 gap-1">
                  <ImageIcon className="w-6 h-6 opacity-40" />
                  <span className="text-xs">Cannot preview (URL may be invalid)</span>
                </div>
              )}
              <div className="absolute top-1.5 right-1.5 flex gap-1">
                <button
                  onClick={() => { navigator.clipboard.writeText(resolved); toast.success('URL copied!') }}
                  className="p-1 bg-black/50 rounded text-white hover:bg-black/70"
                  title="Copy URL"
                ><Copy className="w-3 h-3" /></button>
              </div>
            </>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center gap-1.5 text-gray-400 w-full">
              <ImageIcon className="w-7 h-7 opacity-30" />
              <span className="text-xs text-center">No image set<br />Upload in Media tab → Use in Block</span>
            </div>
          )}
        </div>
        {/* URL input */}
        <input
          key={`${block.id}-${fieldKey}`}
          defaultValue={currentUrl || ''}
          onBlur={e => { onUpdate({ [fieldKey]: e.target.value }); setImgOk(true) }}
          placeholder="Paste URL or use Media tab →"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring font-mono"
        />
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    )
  }, [block.id, p, onUpdate])

  // Always show bg image for any hero block, AND always show image_url for split heroes
  const isHeroBlock = ['hero', 'hero_split', 'hero_minimal'].includes(block.block_type)
  const isSplitHero = block.block_type === 'hero_split' || p.layout === 'split'

  const bgImageField = (p.bg_style === 'image' || isHeroBlock) && (
    <ImagePickerField
      label={isSplitHero ? 'Background Image (full bg)' : 'Background Image'}
      fieldKey="bg_image_url"
      hint={isSplitHero ? 'For full-bleed background. Use "Image URL" below for the right panel.' : undefined}
    />
  )

  // For split heroes, always show a dedicated right-panel image picker
  const splitImageField = isSplitHero && (
    <ImagePickerField
      label="Right Panel Image ★"
      fieldKey="image_url"
      hint="This image appears on the right side of the split hero."
    />
  )

  const imageUrlField = !isSplitHero && p.image_url !== undefined && (
    <ImagePickerField label="Image" fieldKey="image_url" />
  )

  const layoutField = p.layout !== undefined && (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-600">Layout</label>
      <div className="grid grid-cols-3 gap-1">
        {['centered','split','minimal','left','right','full'].map(l => (
          <button key={l}
            onClick={() => onUpdate({ layout: l })}
            className={cn('py-1.5 text-xs font-bold rounded border transition-colors',
              p.layout === l ? 'bg-primary text-white border-primary' : 'text-gray-500 border-gray-200 hover:border-primary/40')}
          >{l.charAt(0).toUpperCase() + l.slice(1)}</button>
        ))}
      </div>
    </div>
  )

  // Sub-item schema detection
  const itemSchema = ITEM_SCHEMAS[block.block_type]
  const [subColumns, setSubColumns] = useState<number>((p as any).columns ?? itemSchema?.fields.length ?? 3)
  const [subGap, setSubGap] = useState<number>((p as any).item_gap ?? 24)
  const [subItemSize, setSubItemSize] = useState<number>((p as any).item_size ?? 160)

  return (
    <div className="space-y-4 p-4">
      {/* Header + Smart Design */}
      <div className="flex items-center gap-2">
        <div className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-bold uppercase flex-1">{block.label || block.block_type}</div>
        <button
          onClick={handleSmartDesign}
          disabled={smartLoading}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-primary to-info text-white text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          title="AI: Generate smart design for this block"
        >
          {smartLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
          Smart Design
        </button>
      </div>

      {/* Quick Block Presets */}
      {BLOCK_QUICK_PRESETS[block.block_type] && (
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Quick Presets</label>
          <div className="grid grid-cols-2 gap-1.5">
            {BLOCK_QUICK_PRESETS[block.block_type].map((preset, i) => (
              <button
                key={i}
                onClick={() => { onUpdate(preset.props as any); toast.success(`"${preset.label}" preset applied!`) }}
                className="py-2 px-3 rounded-xl border border-gray-200 hover:border-primary/40 hover:bg-accent text-left transition-all group"
              >
                <div className="text-xs font-bold text-gray-700 group-hover:text-primary">{preset.label}</div>
                {preset.desc && <div className="text-xs text-gray-400 mt-0.5">{preset.desc}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Whole-block click target */}
      {onEditPropLink && (
        <div className="rounded-xl border border-primary/20 bg-accent/80 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="w-7 h-7 rounded-lg bg-white border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Link2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-gray-800">Block link</div>
              <p className="text-xs text-gray-500 leading-snug">
                Make this whole block clickable. Buttons and form fields inside the block still keep their own clicks.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={e => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              onEditPropLink('block_link', { x: rect.left, y: rect.bottom + 6 })
            }}
            className={cn(
              'w-full py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors',
              (p as any).block_link_url
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-white text-primary border-primary/30 hover:bg-accent',
            )}
            title={(p as any).block_link_url ? `Linked to ${(p as any).block_link_url}` : 'Insert block link'}
          >
            <Link2 className="w-3.5 h-3.5" />
            {(p as any).block_link_url ? `Linked: ${(p as any).block_link_url}` : 'Insert block link'}
          </button>
        </div>
      )}

      {/* ── Nav block — Logo ── */}
      {block.block_type === 'nav' && (
        <div className="space-y-2 pb-2 border-b border-gray-100">
          <label className="text-xs font-medium text-gray-600">Brand Logo</label>
          <ImagePickerField label="Logo Image" fieldKey="brand_logo" />
          {p.brand_logo && (
            <button
              type="button"
              onClick={() => onUpdate({ brand_logo: '' } as any)}
              className="text-xs text-red-500 hover:text-red-700 font-semibold"
            >
              ✕ Remove logo (show text instead)
            </button>
          )}
          {!p.brand_logo && (
            <p className="text-xs text-gray-400">Upload a logo to replace the brand name text. SVG or PNG with transparent background works best.</p>
          )}
        </div>
      )}

      {/* ── Nav block — Page management ── */}
      {block.block_type === 'nav' && pages && pages.length > 0 && (
        <div className="space-y-2 pb-1 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 flex-1">Pages in Nav</label>
            <button
              onClick={() => {
                const synced = pages.map(pg => ({ label: pg.title, url: `/${pg.slug}` }))
                onUpdate({ nav_links: synced } as any)
                toast.success('Nav synced with all pages!')
              }}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary font-semibold"
            >
              <RefreshCw className="w-3 h-3" /> Sync All
            </button>
            {onAddPage && (
              <button
                onClick={onAddPage}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary font-semibold"
              >
                <Plus className="w-3 h-3" /> New Page
              </button>
            )}
          </div>
          <div className="space-y-1">
            {pages.map(pg => {
              const navLinks: any[] = (p.nav_links as any[]) || []
              const isInNav = navLinks.some((l: any) => l.url === `/${pg.slug}` || l.url === pg.slug || l.url === `/${pg.slug}/`)
              return (
                <div key={pg.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-700 truncate">{pg.title}</div>
                    <div className="text-xs text-gray-400 font-mono">/{pg.slug}</div>
                  </div>
                  <button
                    onClick={() => {
                      if (isInNav) {
                        onUpdate({ nav_links: navLinks.filter((l: any) => l.url !== `/${pg.slug}` && l.url !== pg.slug) } as any)
                      } else {
                        onUpdate({ nav_links: [...navLinks, { label: pg.title, url: `/${pg.slug}` }] } as any)
                        toast.success(`"${pg.title}" added to nav`)
                      }
                    }}
                    className={cn(
                      'shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors',
                      isInNav
                        ? 'bg-primary/10 text-primary border-primary/40 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-primary/60 hover:bg-accent hover:text-primary'
                    )}
                  >
                    {isInNav ? '✓ In Nav' : '+ Add'}
                  </button>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400">Toggle pages above or use "Sync All" to rebuild nav from all pages.</p>
        </div>
      )}

      {/* Show "New Page" button for nav blocks even when no pages yet */}
      {block.block_type === 'nav' && (!pages || pages.length === 0) && onAddPage && (
        <div className="pb-2 border-b border-gray-100">
          <button
            onClick={onAddPage}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-primary/30 rounded-xl text-xs text-primary font-semibold hover:border-primary/60 hover:bg-accent transition-colors"
          >
            <Plus className="w-4 h-4" /> Add your first page
          </button>
        </div>
      )}

      {commonFields}

      {/* Sub-item editor for list blocks */}
      {itemSchema && (
        <div className="pt-1 border-t border-gray-100">
          <SubItemEditor
            schema={itemSchema}
            items={(p as any)[itemSchema.arrayKey] || []}
            siteId={siteId}
            onUpdate={items => onUpdate({ [itemSchema.arrayKey]: items } as any)}
            onPreview={items => onPreview({ [itemSchema.arrayKey]: items } as any)}
            columns={subColumns}
            gap={subGap}
            itemSize={subItemSize}
            onColumnsChange={n => { setSubColumns(n); onUpdate({ columns: n } as any) }}
            onGapChange={n => { setSubGap(n); onUpdate({ item_gap: n } as any) }}
            onItemSizeChange={n => { setSubItemSize(n); onUpdate({ item_size: n } as any) }}
          />
        </div>
      )}

      {bgStyleField}
      {gradientField}
      {splitImageField}
      {bgImageField}
      {imageUrlField}
      {layoutField}

      {/* Shadow / decoration */}
      <div className="space-y-1.5 pt-1 border-t border-gray-100">
        <label className="text-xs font-medium text-gray-600">Block Shadow</label>
        <div className="grid grid-cols-4 gap-1">
          {SHADOW_PRESETS.map(sh => (
            <button
              key={sh.label}
              onClick={() => onUpdate({ block_shadow: sh.value } as any)}
              title={sh.label}
              className={cn(
                'py-2 rounded-lg border text-xs font-bold transition-all text-center',
                (p as any).block_shadow === sh.value ? 'border-primary bg-accent text-primary' : 'border-gray-200 text-gray-500 hover:border-primary/40'
              )}
              style={{ boxShadow: sh.value === 'none' ? undefined : sh.value }}
            >
              {sh.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section Spacing */}
      <div className="space-y-3 pt-1 border-t border-gray-100">
        <label className="text-xs font-medium text-gray-600">Section Spacing</label>
        {([
          { label: 'Padding Top', key: 'padding_top', val: paddingTop, set: setPaddingTop },
          { label: 'Padding Bottom', key: 'padding_bottom', val: paddingBottom, set: setPaddingBottom },
        ] as const).map(({ label, key, val, set }) => (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">{label}</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0} max={320} step={4}
                  value={val}
                  onChange={e => {
                    const n = Math.max(0, Math.min(320, Number(e.target.value) || 0))
                    set(n)
                    onUpdate({ [key]: n } as any)
                  }}
                  className="w-14 px-1.5 py-0.5 border border-gray-200 rounded text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-xs text-gray-400">px</span>
              </div>
            </div>
            <div className="relative">
              <input
                type="range" min={0} max={320} step={4}
                value={val}
                onChange={e => {
                  const n = Number(e.target.value)
                  set(n)
                  onUpdate({ [key]: n } as any)
                }}
                className="w-full accent-primary h-2 rounded-full cursor-pointer"
              />
              {/* Tick marks at key positions */}
              <div className="flex justify-between mt-0.5 px-0.5">
                {[0, 80, 160, 240, 320].map(v => (
                  <span key={v} className="text-[8px] text-gray-300 font-mono">{v}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Origins / Section Shape Dividers */}
      <div className="space-y-3 pt-1 border-t border-gray-100">
        <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
          <svg viewBox="0 0 20 10" className="w-4 h-4 fill-current text-primary/80"><path d="M0,10 C5,0 10,10 15,3 C17,1 18,5 20,4 L20,10 Z"/></svg>
          Origins (Section Shapes)
        </label>
        <div className="space-y-2.5">
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1.5">Top Edge Shape</div>
            <div className="grid grid-cols-3 gap-1">
              {SHAPE_OPTIONS.map(({ id, label }) => (
                <button key={`top-${id}`}
                  onClick={() => onUpdate({ top_shape: id === 'none' ? null : id } as any)}
                  className={cn('py-1.5 px-1 text-xs font-medium rounded border transition-colors text-center truncate',
                    ((p as any).top_shape || 'none') === id
                      ? 'bg-primary text-white border-primary'
                      : 'text-gray-500 border-gray-200 hover:border-primary/40')}
                >{label}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1.5">Bottom Edge Shape</div>
            <div className="grid grid-cols-3 gap-1">
              {SHAPE_OPTIONS.map(({ id, label }) => (
                <button key={`bot-${id}`}
                  onClick={() => onUpdate({ bottom_shape: id === 'none' ? null : id } as any)}
                  className={cn('py-1.5 px-1 text-xs font-medium rounded border transition-colors text-center truncate',
                    ((p as any).bottom_shape || 'none') === id
                      ? 'bg-primary text-white border-primary'
                      : 'text-gray-500 border-gray-200 hover:border-primary/40')}
                >{label}</button>
              ))}
            </div>
          </div>
          {(((p as any).top_shape && (p as any).top_shape !== 'none') || ((p as any).bottom_shape && (p as any).bottom_shape !== 'none')) && (
            <div className="flex items-center gap-2 pt-0.5">
              <input type="color"
                value={(p as any).shape_color || '#ffffff'}
                onChange={e => onUpdate({ shape_color: e.target.value } as any)}
                className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 shrink-0"
              />
              <div>
                <div className="text-xs font-medium text-gray-700">Shape Fill Color</div>
                <div className="text-xs text-gray-400">Match next section's background</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composition — Tile highlights, font scale, color overrides */}
      <div className="space-y-3 pt-1 border-t border-gray-100">
        <label className="text-xs font-medium text-gray-600">Composition</label>


        {/* Font size px: step + preset (same as canvas bar) */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-gray-500">Font size (px)</div>
          <div className="inline-flex w-full max-w-sm items-center gap-1 rounded-lg border border-gray-700 bg-gray-900 p-1">
            <button
              type="button"
              className="flex flex-1 h-8 items-center justify-center gap-1 rounded text-white hover:bg-gray-800"
              onClick={() => {
                const cur = (p as any).font_size_px as number | undefined
                const base = typeof cur === 'number' && cur > 0 ? Math.round(cur) : FONT_SIZE_PX_FALLBACK
                const next = Math.min(FONT_SIZE_PX_MAX, Math.max(FONT_SIZE_PX_MIN, base + FONT_SIZE_PX_STEP))
                onUpdate({ font_size_px: next, text_scale: null } as any)
              }}
            >
              <span className="text-xs font-bold">A</span>
              <ChevronUp className="w-3 h-3 text-sky-400" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              className="flex flex-1 h-8 items-center justify-center gap-1 rounded text-white hover:bg-gray-800"
              onClick={() => {
                const cur = (p as any).font_size_px as number | undefined
                const base = typeof cur === 'number' && cur > 0 ? Math.round(cur) : FONT_SIZE_PX_FALLBACK
                const next = Math.min(FONT_SIZE_PX_MAX, Math.max(FONT_SIZE_PX_MIN, base - FONT_SIZE_PX_STEP))
                onUpdate({ font_size_px: next, text_scale: null } as any)
              }}
            >
              <span className="text-xs font-bold">A</span>
              <ChevronDown className="w-3 h-3 text-sky-400" strokeWidth={2.5} />
            </button>
            <select
              className="h-8 min-w-[4.5rem] flex-[1.2] rounded border border-gray-600 bg-gray-950 px-2 text-xs font-medium text-white outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
              value={
                typeof (p as any).font_size_px === 'number' && (p as any).font_size_px > 0 && Number.isFinite((p as any).font_size_px)
                  ? String(Math.round((p as any).font_size_px))
                  : ''
              }
              onChange={e => {
                const v = e.target.value
                if (!v) onUpdate({ font_size_px: null } as any)
                else onUpdate({ font_size_px: Math.round(Number(v)), text_scale: null } as any)
              }}
            >
              <option value="">Auto</option>
              {FONT_SIZE_PX_CHOICES.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-400">Px sizing overrides XS–2X scale. Auto uses theme + scale only.</p>
        </div>

        {/* Text case — same options as the canvas typography menu */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-gray-500">Text case</div>
          <div className="rounded-lg border border-gray-200 bg-gray-900 overflow-hidden">
            {TEXT_CASE_MENU_ROWS.map(row => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  const patch = buildTextCasePropsPatch(p as Record<string, unknown>, row.id)
                  onUpdate(patch as any)
                  if (row.id === 'sentence' || row.id === 'toggle') {
                    toast.success(row.id === 'sentence' ? 'Sentence case applied' : 'Toggle case applied')
                  }
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs transition-colors border-b border-gray-800 last:border-b-0',
                  currentTextCaseMenuId(p as any) === row.id
                    ? 'bg-primary text-white'
                    : 'text-gray-100 hover:bg-gray-800',
                )}
              >
                {row.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400">Default clears CSS case. Sentence / toggle rewrite stored text (skips URLs and nav links).</p>
        </div>

        {/* Text color override */}
        <div className="flex items-center gap-2">
          <input type="color"
            value={(p as any).text_color_override || '#111827'}
            onChange={e => onUpdate({ text_color_override: e.target.value } as any)}
            className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-700">Section Text Color</div>
            <div className="text-xs text-gray-400">Override theme for this block</div>
          </div>
          {(p as any).text_color_override && (
            <button onClick={() => onUpdate({ text_color_override: null } as any)} className="text-xs text-red-400 hover:text-red-600 shrink-0">✕ Clear</button>
          )}
        </div>

        {/* Background color override */}
        <div className="flex items-center gap-2">
          <input type="color"
            value={(p as any).bg_color_override || '#ffffff'}
            onChange={e => onUpdate({ bg_color_override: e.target.value } as any)}
            className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-700">Block Background</div>
            <div className="text-xs text-gray-400">Override background color</div>
          </div>
          {(p as any).bg_color_override && (
            <button onClick={() => onUpdate({ bg_color_override: null } as any)} className="text-xs text-red-400 hover:text-red-600 shrink-0">✕ Clear</button>
          )}
        </div>

        {/* Tile / card colors */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1.5">Tile / Card Highlights</div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'tile_bg',     label: 'Tile BG',    hint: 'Card background' },
              { key: 'tile_accent', label: 'Accent',     hint: 'Highlight color'  },
              { key: 'tile_text',   label: 'Tile Text',  hint: 'Text in cards'    },
              { key: 'tile_border', label: 'Border',     hint: 'Card border'      },
            ] as const).map(({ key, label, hint }) => (
              <div key={key} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                <input type="color"
                  value={(p as any)[key] || '#ffffff'}
                  onChange={e => onUpdate({ [key]: e.target.value } as any)}
                  className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0.5 shrink-0"
                />
                <div>
                  <div className="text-xs font-medium text-gray-700">{label}</div>
                  <div className="text-xs text-gray-400">{hint}</div>
                </div>
              </div>
            ))}
          </div>
          {((p as any).tile_bg || (p as any).tile_accent || (p as any).tile_text || (p as any).tile_border) && (
            <button
              onClick={() => onUpdate({ tile_bg: null, tile_accent: null, tile_text: null, tile_border: null } as any)}
              className="mt-1.5 text-xs text-red-400 hover:text-red-600"
            >✕ Clear all tile colors</button>
          )}
        </div>
      </div>

      {/* Visibility */}
      <div className="space-y-2 pt-1 border-t border-gray-100">
        <label className="text-xs font-medium text-gray-600">Visibility</label>
        {[
          { key: 'visible', label: 'Visible' },
          { key: 'visible_on_mobile', label: 'Show on Mobile' },
          { key: 'visible_on_tablet', label: 'Show on Tablet' },
          { key: 'visible_on_desktop', label: 'Show on Desktop' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(block as any)[key]}
              onChange={e => onUpdate({ [key]: e.target.checked } as any)}
              className="rounded accent-primary"
            />
            <span className="text-xs text-gray-600">{label}</span>
          </label>
        ))}

        {/* P3.2 Branch-scoped visibility */}
        <BranchVisibilitySelector
          visibleBranches={(block as any).visible_branches ?? null}
          onChange={branches => onUpdate({ visible_branches: branches } as any)}
        />
      </div>

      {/* P3.4 Per-breakpoint style overrides */}
      <BlockBreakpointStyles
        styleOverrides={(block.style_overrides || {}) as any}
        onChange={overrides => onUpdate({ style_overrides: overrides } as any)}
      />

      {/* Animation */}
      <div className="space-y-2 pt-1 border-t border-gray-100">
        <label className="text-xs font-medium text-gray-600">Scroll Animation</label>
        <div className="grid grid-cols-4 gap-1">
          {[
            { id: 'none', label: '⊘ None' },
            { id: 'fade-in', label: '✨ Fade' },
            { id: 'slide-up', label: '⬆ Slide Up' },
            { id: 'slide-down', label: '⬇ Slide Down' },
            { id: 'slide-left', label: '◀ From Left' },
            { id: 'slide-right', label: '▶ From Right' },
            { id: 'zoom-in', label: '🔍 Zoom' },
            { id: 'flip', label: '🔄 Flip' },
          ].map(a => (
            <button key={a.id}
              onClick={() => onUpdate({ animation: a.id === 'none' ? null : a.id } as any)}
              className={cn('py-1.5 px-1 text-xs font-medium rounded-lg border transition-colors text-center',
                (block.animation || 'none') === a.id ? 'bg-primary text-white border-primary' : 'text-gray-500 border-gray-200 hover:border-primary/40')}
            >{a.label}</button>
          ))}
        </div>
        {block.animation && block.animation !== 'none' && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-500 w-16 shrink-0">Delay (ms)</label>
              <input type="range" min={0} max={1000} step={100} defaultValue={block.animation_delay || 0}
                onChange={e => onUpdate({ animation_delay: Number(e.target.value) } as any)}
                className="flex-1 accent-primary h-1" />
              <span className="text-xs text-gray-500 w-10 text-right">{block.animation_delay || 0}ms</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Style Panel ───────────────────────────────────────────────────────────────

const SITE_THEME_PRESETS = [
  {
    label: 'Violet Pro',
    colors: { primary_color: '#64C3A0', secondary_color: '#13624A', accent_color: '#f59e0b', bg_color: '#f3fbf7', surface_color: '#ffffff', text_color: '#1e1b4b' },
  },
  {
    label: 'Ocean Blue',
    colors: { primary_color: '#0ea5e9', secondary_color: '#0369a1', accent_color: '#06b6d4', bg_color: '#f0f9ff', surface_color: '#ffffff', text_color: '#0c4a6e' },
  },
  {
    label: 'Midnight',
    colors: { primary_color: '#6366f1', secondary_color: '#4338ca', accent_color: '#a78bfa', bg_color: '#0f172a', surface_color: '#1e293b', text_color: '#f1f5f9' },
  },
  {
    label: 'Coral Warm',
    colors: { primary_color: '#f97316', secondary_color: '#ea580c', accent_color: '#fbbf24', bg_color: '#fff7ed', surface_color: '#ffffff', text_color: '#431407' },
  },
  {
    label: 'Forest',
    colors: { primary_color: '#10b981', secondary_color: '#065f46', accent_color: '#34d399', bg_color: '#f0fdf4', surface_color: '#ffffff', text_color: '#064e3b' },
  },
  {
    label: 'Rose Glam',
    colors: { primary_color: '#e11d48', secondary_color: '#9f1239', accent_color: '#fb7185', bg_color: '#fff1f2', surface_color: '#ffffff', text_color: '#4c0519' },
  },
  {
    label: 'Steel Dark',
    colors: { primary_color: '#64748b', secondary_color: '#334155', accent_color: '#38bdf8', bg_color: '#1e293b', surface_color: '#334155', text_color: '#f8fafc' },
  },
  {
    label: 'Candy Pop',
    colors: { primary_color: '#d946ef', secondary_color: '#a21caf', accent_color: '#f59e0b', bg_color: '#fdf4ff', surface_color: '#ffffff', text_color: '#4a044e' },
  },
]

function StylePanel({
  style, onChange, siteId,
}: { style: StyleConfig; onChange: (s: Partial<StyleConfig>) => void; siteId: string }) {
  const [gradientTab, setGradientTab] = useState<'presets' | 'custom'>('presets')
  const [styleDetailsExpanded, setStyleDetailsExpanded] = useState(true)
  const aiTheme = useAIGenerateTheme(siteId)

  const handleAITheme = async () => {
    try {
      const res = await aiTheme.mutateAsync({ brand_description: 'Generate a beautiful, vibrant and modern color theme', mood: 'modern and colorful' })
      if (res.primary_color) onChange({
        primary_color: res.primary_color,
        secondary_color: res.secondary_color || res.primary_color,
        accent_color: res.accent_color || '#f59e0b',
        bg_color: res.bg_color || '#fafafa',
        text_color: res.text_color || '#111111',
      })
      toast.success('AI theme applied!')
    } catch { toast.error('AI theme failed') }
  }

  return (
    <div className="p-4 space-y-5">

      <CheckoutStyleSection style={style} onChange={onChange} />

      <div className="pt-1 border-t border-gray-100">
        <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Theme and appearance</div>
        <div className="flex gap-1.5 p-0.5 rounded-xl bg-gray-100 mb-2">
          <button
            type="button"
            onClick={() => setStyleDetailsExpanded(false)}
            className={cn(
              'flex-1 py-2 text-xs font-medium rounded-lg transition-all',
              !styleDetailsExpanded ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            Fewer
          </button>
          <button
            type="button"
            onClick={() => setStyleDetailsExpanded(true)}
            className={cn(
              'flex-1 py-2 text-xs font-medium rounded-lg transition-all',
              styleDetailsExpanded ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            Expanded
          </button>
        </div>
        {!styleDetailsExpanded && (
          <p className="text-xs text-gray-400 leading-snug mb-0">Presets, colors, typography, spacing, and dark mode are hidden. Choose Expanded to edit them.</p>
        )}
      </div>

      {styleDetailsExpanded && (
      <>
      {/* Theme presets */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-xs font-bold uppercase tracking-wide text-gray-400 flex-1">Theme Presets</div>
          <button
            onClick={handleAITheme}
            disabled={aiTheme.isPending}
            className="flex items-center gap-0.5 px-2 py-1 rounded text-xs font-bold bg-gradient-to-r from-primary to-info text-white hover:opacity-90 disabled:opacity-50"
          >
            {aiTheme.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Wand2 className="w-2.5 h-2.5" />}
            AI Theme
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {SITE_THEME_PRESETS.map(t => (
            <button
              key={t.label}
              onClick={() => onChange(t.colors as any)}
              title={t.label}
              className="rounded-lg overflow-hidden border-2 border-transparent hover:border-primary/60 transition-all"
            >
              <div className="h-8 grid grid-cols-3">
                <div style={{ background: t.colors.primary_color }} />
                <div style={{ background: t.colors.accent_color }} />
                <div style={{ background: t.colors.bg_color, border: '1px solid #e5e7eb' }} />
              </div>
              <div className="text-xs font-medium text-gray-500 text-center py-0.5 bg-white">{t.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Colors</div>
        <div className="space-y-2">
          {[
            { key: 'primary_color', label: 'Primary' },
            { key: 'secondary_color', label: 'Secondary' },
            { key: 'accent_color', label: 'Accent' },
            { key: 'bg_color', label: 'Background' },
            { key: 'surface_color', label: 'Surface' },
            { key: 'text_color', label: 'Text' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="color"
                value={(style as any)[key] || '#000000'}
                onChange={e => onChange({ [key]: e.target.value } as any)}
                className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700">{label}</div>
                <div className="text-xs text-gray-400 font-mono">{(style as any)[key]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Site-wide gradient background */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Site Gradient</div>
        <div className="flex gap-1 mb-2">
          {(['presets','custom'] as const).map(t => (
            <button key={t}
              onClick={() => setGradientTab(t)}
              className={cn('flex-1 py-1 text-xs font-bold rounded border transition-colors',
                gradientTab === t ? 'bg-primary text-white border-primary' : 'text-gray-500 border-gray-200')}
            >{t === 'presets' ? 'Presets' : 'Custom'}</button>
          ))}
        </div>
        {gradientTab === 'presets' ? (
          <div className="grid grid-cols-4 gap-1.5">
            {GRADIENT_PRESETS.map(g => (
              <button
                key={g.label}
                onClick={() => onChange({ site_gradient: g.value } as any)}
                title={g.label}
                className={cn('h-10 rounded-lg border-2 transition-all',
                  (style as any).site_gradient === g.value ? 'border-primary scale-105 shadow-lg' : 'border-transparent hover:border-primary/40')}
                style={{ background: g.value }}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">From Color</label>
                <input type="color" value={(style as any).gradient_from || '#64C3A0'}
                  onChange={e => onChange({ gradient_from: e.target.value } as any)}
                  className="w-full h-9 rounded border border-gray-200 cursor-pointer p-0.5" />
              </div>
              <div>
                <label className="text-xs text-gray-500">To Color</label>
                <input type="color" value={(style as any).gradient_to || '#13624A'}
                  onChange={e => onChange({ gradient_to: e.target.value } as any)}
                  className="w-full h-9 rounded border border-gray-200 cursor-pointer p-0.5" />
              </div>
            </div>
            <select
              value={(style as any).gradient_dir || '135deg'}
              onChange={e => onChange({ gradient_dir: e.target.value } as any)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs"
            >
              {[['135deg','↘ Diagonal'],['to right','→ Horizontal'],['to bottom','↓ Vertical'],['to top right','↗ Top-Right']].map(([v,l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <div
              className="h-10 rounded-lg border border-gray-200"
              style={{ background: `linear-gradient(${(style as any).gradient_dir || '135deg'}, ${(style as any).gradient_from || '#64C3A0'}, ${(style as any).gradient_to || '#13624A'})` }}
            />
          </div>
        )}
        {(style as any).site_gradient && (
          <button
            onClick={() => onChange({ site_gradient: '' } as any)}
            className="mt-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >✕ Remove gradient</button>
        )}
      </div>

      {/* Shadows */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Global Shadow Style</div>
        <div className="grid grid-cols-4 gap-1">
          {SHADOW_PRESETS.map(sh => (
            <button
              key={sh.label}
              onClick={() => onChange({ shadow_style: sh.value } as any)}
              title={sh.label}
              className={cn('py-2 rounded-lg border text-xs font-bold transition-all text-center',
                (style as any).shadow_style === sh.value ? 'border-primary bg-accent text-primary' : 'border-gray-200 text-gray-500 hover:border-primary/40'
              )}
              style={{ boxShadow: sh.value === 'none' ? undefined : sh.value }}
            >
              {sh.label}
            </button>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Typography</div>
        <div className="space-y-2">
          {[{ key: 'font_heading', label: 'Heading Font' }, { key: 'font_body', label: 'Body Font' }].map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{label}</label>
              <select
                value={(style as any)[key]}
                onChange={e => onChange({ [key]: e.target.value } as any)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
                style={{ fontFamily: (style as any)[key] }}
              >
                {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Shape & Spacing */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Shape & Spacing</div>
        <div className="space-y-3">
          {[
            { label: 'Border Radius', key: 'border_radius', opts: ['sharp','rounded','pill'] },
            { label: 'Spacing', key: 'spacing', opts: ['compact','comfortable','spacious'] },
            { label: 'Button Style', key: 'button_style', opts: ['filled','outline','ghost','gradient'] },
            { label: 'Card Style', key: 'card_style', opts: ['flat','raised','outlined','glass'] },
            { label: 'Animation', key: 'animation', opts: ['none','subtle','expressive'] },
          ].map(({ label, key, opts }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{label}</label>
              <div className="grid grid-cols-4 gap-1">
                {opts.map(v => (
                  <button
                    key={v}
                    onClick={() => onChange({ [key]: v } as any)}
                    className={cn('py-1.5 text-xs font-bold rounded border transition-colors',
                      (style as any)[key] === v ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'
                    )}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* P3.9 Brand Kit — Typography Scale */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Typography Scale</div>
        <div className="space-y-2">
          {[
            { key: 'font_family_heading', label: 'Heading Font', opts: ['Inter', 'Merriweather', 'Playfair Display', 'Space Grotesk', 'Syne', 'DM Serif Display', 'Outfit'] },
            { key: 'font_family_body', label: 'Body Font', opts: ['Inter', 'Lato', 'Open Sans', 'Nunito', 'Roboto', 'Source Sans Pro', 'DM Sans'] },
          ].map(({ key, label, opts }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 mb-1 block">{label}</label>
              <select
                value={(style as any)[key] || opts[0]}
                onChange={e => onChange({ [key]: e.target.value } as any)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5"
              >
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          {[
            { key: 'font_size_base', label: 'Base Size', min: 12, max: 20, step: 1, unit: 'px' },
            { key: 'font_scale_ratio', label: 'Scale Ratio', min: 100, max: 140, step: 5, unit: '%' },
            { key: 'letter_spacing', label: 'Letter Spacing', min: -2, max: 4, step: 1, unit: 'px' },
            { key: 'line_height', label: 'Line Height', min: 120, max: 200, step: 10, unit: '%' },
          ].map(({ key, label, min, max, step, unit }) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
              <input type="range" min={min} max={max} step={step}
                value={(style as any)[key] || (min + max) / 2}
                onChange={e => onChange({ [key]: Number(e.target.value) } as any)}
                className="flex-1 accent-primary h-1" />
              <span className="text-xs text-gray-400 w-12 text-right">{(style as any)[key] || (min + max) / 2}{unit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* P3.9 Dark Mode Token */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Dark Mode</div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(style as any).dark_mode_enabled || false}
            onChange={e => onChange({ dark_mode_enabled: e.target.checked } as any)}
            className="rounded accent-primary"
          />
          <span className="text-xs text-gray-600">Enable dark mode toggle for visitors</span>
        </label>
        {(style as any).dark_mode_enabled && (
          <div className="mt-2 space-y-2">
            {[
              { key: 'dark_bg_color', label: 'Dark BG' },
              { key: 'dark_surface_color', label: 'Dark Surface' },
              { key: 'dark_text_color', label: 'Dark Text' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  type="color"
                  value={(style as any)[key] || '#1a1a2e'}
                  onChange={e => onChange({ [key]: e.target.value } as any)}
                  className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5 flex-shrink-0"
                />
                <span className="text-xs text-gray-600">{label}</span>
                <span className="text-xs text-gray-400 font-mono ml-auto">{(style as any)[key] || '#1a1a2e'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      </>
      )}

    </div>
  )
}

// ── Checkout Style Section ────────────────────────────────────────────────────

const CHECKOUT_LAYOUT_OPTS: { id: 'two-column' | 'wizard' | 'accordion'; label: string; desc: string }[] = [
  { id: 'two-column', label: 'Two-column', desc: 'Form left, order summary right' },
  { id: 'wizard',     label: 'Wizard',     desc: 'Step-by-step guided flow' },
  { id: 'accordion',  label: 'Accordion',  desc: 'Collapsible sections on one page' },
]

const CHECKOUT_TOKEN_FIELDS: { key: string; label: string }[] = [
  { key: '--brand-primary',    label: 'Brand color (HSL)' },
  { key: '--surface',          label: 'Surface BG (HSL)' },
  { key: '--surface-muted',    label: 'Muted surface (HSL)' },
  { key: '--text',             label: 'Text (HSL)' },
  { key: '--radius-md',        label: 'Radius (e.g. 10px)' },
  { key: '--font-heading',     label: 'Heading font' },
  { key: '--font-body',        label: 'Body font' },
]

function CheckoutStyleSection({
  style,
  onChange,
}: {
  style: StyleConfig
  onChange: (s: Partial<StyleConfig>) => void
}) {
  const [open, setOpen] = React.useState(false)
  const current = (style as any).checkout_layout as string | undefined
  const overrides: Record<string, string> = (style as any).checkout_token_overrides ?? {}

  function setTokenOverride(key: string, value: string) {
    const next = { ...overrides }
    if (value.trim()) {
      next[key] = value.trim()
    } else {
      delete next[key]
    }
    onChange({ checkout_token_overrides: next } as any)
  }

  return (
    <div className="pt-1">
      <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Checkout layout</div>

      {/* Layout picker */}
      <div className="mb-4">
        <div className="text-xs font-medium text-gray-500 mb-2">Page Layout</div>
        <div className="space-y-1.5">
          {CHECKOUT_LAYOUT_OPTS.map(o => (
            <button
              key={o.id}
              onClick={() => onChange({ checkout_layout: o.id } as any)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all',
                current === o.id || (!current && o.id === 'two-column')
                  ? 'border-primary bg-accent'
                  : 'border-gray-200 hover:border-primary/40 bg-white',
              )}
            >
              <div>
                <div className={cn('text-xs font-medium', current === o.id || (!current && o.id === 'two-column') ? 'text-primary' : 'text-gray-700')}>{o.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{o.desc}</div>
              </div>
              {(current === o.id || (!current && o.id === 'two-column')) && (
                <div className="w-3.5 h-3.5 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <svg className="w-2 h-2 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced token overrides */}
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wide"
        >
          <span>Advanced Checkout Tokens</span>
          <svg className={cn('w-3.5 h-3.5 transition-transform', open ? 'rotate-180' : '')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-gray-400 leading-relaxed">
              Override individual checkout CSS variables. Colors should be HSL triplets like <code className="bg-gray-100 px-1 rounded">222 47% 11%</code>. Leave blank to inherit from Style panel.
            </p>
            {CHECKOUT_TOKEN_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs font-medium text-gray-500 block mb-0.5">{label}</label>
                <input
                  type="text"
                  placeholder={`e.g. ${key === '--radius-md' ? '10px' : key.includes('font') ? 'Inter' : '222 47% 11%'}`}
                  value={overrides[key] ?? ''}
                  onChange={e => setTokenOverride(key, e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-primary/60 focus:outline-none font-mono"
                />
              </div>
            ))}
            {Object.keys(overrides).length > 0 && (
              <button
                onClick={() => onChange({ checkout_token_overrides: {} } as any)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                ✕ Clear all overrides
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Data Source Panel ─────────────────────────────────────────────────────────

// Full catalog of live KITERP data feeds any block can be bound to.
// `id` maps to the /live/{resource} endpoint on the backend.
const DATA_SOURCES: {
  id: LiveResource | 'external_api'
  label: string
  icon: React.ElementType
  desc: string
  blockTypes: string[]
  selectable: boolean       // if true, the panel shows an item picker
}[] = [
  { id: 'products',     label: 'Products',      icon: Package,      desc: 'Your product catalog',                    blockTypes: ['product_grid', 'menu_grid', 'live_stock', 'live_quote', 'gallery_masonry', 'product_detail', 'related_products', 'cart_drawer'], selectable: true  },
  { id: 'services',     label: 'Services',      icon: Wrench,       desc: 'Your service offerings',                  blockTypes: ['services_cards', 'booking_widget', 'booking_slot_picker', 'menu_grid'], selectable: true  },
  { id: 'testimonials', label: 'Testimonials',  icon: Quote,        desc: 'Verified customer reviews (4★+)',         blockTypes: ['testimonials', 'product_reviews'], selectable: false },
  { id: 'team',         label: 'Team',          icon: Users,        desc: 'Active employees & roles',                blockTypes: ['team_grid'], selectable: false },
  { id: 'kpis',         label: 'Business KPIs', icon: BarChart3,    desc: 'Live stats: orders, revenue, rating',     blockTypes: ['stats', 'counters', 'impact_stats'], selectable: false },
  { id: 'profile',      label: 'Vendor Profile',icon: Briefcase,    desc: 'Brand, address, contact, socials',        blockTypes: ['contact_form', 'map_embed', 'footer', 'nav', 'about_split', 'social_links'], selectable: false },
  { id: 'pages',        label: 'Site Pages',    icon: Layout,       desc: 'Published pages for nav & footer links',  blockTypes: ['nav', 'footer'], selectable: false },
  { id: 'categories',   label: 'Categories',    icon: List,         desc: 'Product & service categories',            blockTypes: ['menu_grid', 'category_cards', 'product_filters'], selectable: false },
  { id: 'customers',    label: 'Customers',     icon: Users,        desc: 'Top customers for social proof',          blockTypes: ['trust_logos'], selectable: false },
  { id: 'orders',       label: 'Orders',        icon: ShoppingCart, desc: 'Recent orders (for admin widgets)',       blockTypes: ['stats'], selectable: false },
  { id: 'bookings',     label: 'Bookings',      icon: Clock,        desc: 'Upcoming / recent bookings',              blockTypes: ['booking_widget'], selectable: false },
  { id: 'media',        label: 'Site Media',    icon: ImageIcon,    desc: 'Images & videos uploaded to this site',   blockTypes: ['gallery_masonry', 'portfolio_grid'], selectable: false },
  { id: 'external_api', label: 'External API',  icon: Plug,         desc: 'Custom REST endpoint',                    blockTypes: [], selectable: false },
]

// Map block type -> default live data source to auto-bind on drag-drop.
// A block dropped into the canvas is immediately wired to real KITERP data;
// the user can override/disconnect in the Data panel.
const BLOCK_AUTO_SOURCE: Record<string, LiveResource> = {
  product_grid:    'products',
  product_detail:  'products',
  related_products:'products',
  cart_drawer:     'products',
  live_stock:      'products',
  live_quote:      'products',
  services_cards:  'services',
  services_list:   'services',
  booking_slot_picker: 'services',
  menu_grid:       'products',
  testimonials:    'testimonials',
  product_reviews: 'testimonials',
  testimonials_grid:'testimonials',
  team_grid:       'team',
  team_list:       'team',
  stats:           'kpis',
  counters:        'kpis',
  impact_stats:    'kpis',
  contact_form:    'profile',
  map_embed:       'profile',
  footer:          'pages',
  nav:             'pages',
  about_split:     'profile',
  social_links:    'profile',
  category_cards:  'categories',
  product_filters: 'categories',
  gallery_masonry: 'media',
  portfolio_grid:  'media',
  booking_widget:  'services',
  trust_logos:     'customers',
}

// Back-compat: some older blocks persisted `internal_*` source ids.
function normalizeSourceType(t: unknown): LiveResource | 'external_api' | null {
  if (typeof t !== 'string') return null
  if (t.startsWith('internal_')) return t.slice(9) as LiveResource
  return t as LiveResource | 'external_api'
}

function DataSourcePanel({
  siteId,
  block,
  onUpdate,
}: {
  siteId: string
  block: WebsiteBlock | null
  onUpdate: (ds: any) => void
}) {
  const ds = (block?.props as any)?.data_source || null
  const normalizedDsType = normalizeSourceType(ds?.type)
  const [apiUrl, setApiUrl] = useState(ds?.url || '')
  const [apiMethod, setApiMethod] = useState(ds?.method || 'GET')
  const [apiHeaders, setApiHeaders] = useState<{key:string;value:string}[]>(ds?.headers || [])
  const [apiField, setApiField] = useState(ds?.data_field || '')
  const [preview, setPreview] = useState<any[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [liveItems, setLiveItems] = useState<LiveItem[]>([])
  const [loadingInternal, setLoadingInternal] = useState(false)

  // Live preview for the currently-connected internal source
  useEffect(() => {
    if (!siteId || !normalizedDsType || normalizedDsType === 'external_api') {
      setLiveItems([])
      return
    }
    refreshInternal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, normalizedDsType])

  const refreshInternal = async () => {
    if (!normalizedDsType || normalizedDsType === 'external_api') return
    setLoadingInternal(true)
    try {
      const r = await websiteApi.getLive(siteId, normalizedDsType as LiveResource, { limit: 30 })
      setLiveItems(r.items || [])
    } catch { /* silently */ }
    setLoadingInternal(false)
  }

  const handleSelectInternal = (sourceId: LiveResource) => {
    onUpdate({ type: sourceId, selected_ids: [], auto: false })
  }

  const handleToggleItem = (id: string) => {
    const current = ds?.selected_ids || []
    const next = current.includes(id) ? current.filter((x: string) => x !== id) : [...current, id]
    onUpdate({ ...ds, type: normalizedDsType, selected_ids: next })
  }

  const handleAutoConnect = () => {
    if (!block) return
    const suggestion = BLOCK_AUTO_SOURCE[block.block_type as string]
    if (!suggestion) {
      toast.info('No automatic source for this block. Pick one from the list below.')
      return
    }
    onUpdate({ type: suggestion, auto: true })
    toast.success(`Connected to ${DATA_SOURCES.find(s => s.id === suggestion)?.label || suggestion}`)
  }

  const handleTestApi = async () => {
    if (!apiUrl) return
    setLoadingPreview(true)
    setPreview([])
    try {
      const headers: Record<string, string> = {}
      apiHeaders.forEach(h => { if (h.key) headers[h.key] = h.value })
      const resp = await fetch(apiUrl, { method: apiMethod, headers })
      const json = await resp.json()
      const items = apiField ? json[apiField] : (Array.isArray(json) ? json : [json])
      setPreview((items || []).slice(0, 5))
    } catch (e: any) {
      toast.error('API test failed: ' + e.message)
    }
    setLoadingPreview(false)
  }

  const handleSaveApi = () => {
    onUpdate({ type: 'external_api', url: apiUrl, method: apiMethod, headers: apiHeaders, data_field: apiField })
    toast.success('Data source saved')
  }

  if (!block) {
    return (
      <div className="flex flex-col items-center justify-center h-48 p-6 text-center text-gray-400">
        <Database className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">Select a block to connect data</p>
      </div>
    )
  }

  // Recommended + other sources. Recommended = listed explicitly or matches block type.
  const recommended = DATA_SOURCES.filter(s =>
    s.id !== 'external_api' && s.blockTypes.some(t => t === block.block_type),
  )
  const others = DATA_SOURCES.filter(s =>
    s.id !== 'external_api' && !recommended.some(r => r.id === s.id),
  )
  const activeSource = DATA_SOURCES.find(s => s.id === normalizedDsType)
  const canPickItems = activeSource?.selectable

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Database className="w-4 h-4 text-primary/80" />
        <span className="text-xs font-bold text-gray-700">Data Connections</span>
      </div>
      <p className="text-xs text-gray-400">Connect <strong>{block.label || block.block_type}</strong> to live KITERP data or any external API.</p>

      {/* Auto-connect CTA (if block has a suggested source and isn't already connected) */}
      {BLOCK_AUTO_SOURCE[block.block_type as string] && !ds?.type && (
        <button
          onClick={handleAutoConnect}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-primary to-emerald-700 text-white text-xs font-bold hover:opacity-90 transition-opacity"
        >
          <Zap className="w-3.5 h-3.5" />
          Auto-connect to {DATA_SOURCES.find(s => s.id === BLOCK_AUTO_SOURCE[block.block_type as string])?.label}
        </button>
      )}

      {/* Current connection badge */}
      {normalizedDsType && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-emerald-700 font-semibold truncate">
            {ds.auto ? 'Auto-connected: ' : 'Connected: '}
            {DATA_SOURCES.find(s => s.id === normalizedDsType)?.label || normalizedDsType}
          </span>
          <span className="ml-auto text-xs text-emerald-600 font-semibold">{liveItems.length} live</span>
          <button onClick={() => onUpdate(null)} className="text-xs text-red-500 hover:text-red-700">Disconnect</button>
        </div>
      )}

      {/* Recommended sources */}
      {recommended.length > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Recommended for this block</div>
          <div className="space-y-1.5">
            {recommended.map(source => (
              <button
                key={source.id}
                onClick={() => handleSelectInternal(source.id as LiveResource)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all',
                  normalizedDsType === source.id
                    ? 'border-primary/40 bg-accent'
                    : 'border-emerald-100 hover:border-primary/30 hover:bg-accent/70 bg-emerald-50/30'
                )}
              >
                <source.icon className="w-4 h-4 text-primary/80 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-700">{source.label}</div>
                  <div className="text-xs text-gray-400">{source.desc}</div>
                </div>
                {normalizedDsType === source.id && <Check className="w-3.5 h-3.5 text-primary/80" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All other internal sources */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">All KITERP Data</div>
        <div className="space-y-1.5">
          {others.map(source => (
            <button
              key={source.id}
              onClick={() => handleSelectInternal(source.id as LiveResource)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all',
                normalizedDsType === source.id
                  ? 'border-primary/40 bg-accent'
                  : 'border-gray-100 hover:border-primary/30 hover:bg-gray-50'
              )}
            >
              <source.icon className="w-4 h-4 text-gray-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700">{source.label}</div>
                <div className="text-xs text-gray-400">{source.desc}</div>
              </div>
              {normalizedDsType === source.id && <Check className="w-3.5 h-3.5 text-primary/80" />}
            </button>
          ))}
        </div>
      </div>

      {/* Limit control */}
      {normalizedDsType && normalizedDsType !== 'external_api' && normalizedDsType !== 'profile' && (
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase tracking-wide text-gray-400">Item Limit</label>
          <input
            type="number"
            min={1} max={50}
            value={ds?.limit || 12}
            onChange={e => onUpdate({ ...ds, type: normalizedDsType, limit: Math.max(1, Math.min(50, Number(e.target.value) || 12)) })}
            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs"
          />
        </div>
      )}

      {/* Item selector (for selectable resources) */}
      {canPickItems && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-400">
              Pick Items {(ds?.selected_ids?.length || 0) > 0 ? `(${ds.selected_ids.length})` : '(all)'}
            </div>
            <button onClick={refreshInternal} className="text-xs text-primary/80 flex items-center gap-1">
              <RefreshCcw className="w-3 h-3" /> Refresh
            </button>
          </div>
          {loadingInternal ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-primary/80" />
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-100 rounded-lg p-2">
              {liveItems.map(item => (
                <label key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(ds?.selected_ids || []).includes(item.id)}
                    onChange={() => handleToggleItem(item.id)}
                    className="rounded text-primary"
                  />
                  {item.image_url && (
                    <img src={mediaUrl(item.image_url)} className="w-7 h-7 rounded object-cover shrink-0" alt="" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-700 truncate">{item.title}</div>
                    {item.price_formatted && (
                      <div className="text-xs text-gray-400">{item.price_formatted}</div>
                    )}
                  </div>
                </label>
              ))}
              {liveItems.length === 0 && (
                <p className="text-xs text-center text-gray-400 py-3">No items found</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Read-only live preview for non-selectable sources */}
      {!canPickItems && normalizedDsType && normalizedDsType !== 'external_api' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-400">Live Preview</div>
            <button onClick={refreshInternal} className="text-xs text-primary/80 flex items-center gap-1">
              <RefreshCcw className="w-3 h-3" /> Refresh
            </button>
          </div>
          {loadingInternal ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary/80" /></div>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-100 rounded-lg p-2">
              {liveItems.slice(0, 10).map(item => (
                <div key={item.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 text-xs">
                  {item.image_url && <img src={mediaUrl(item.image_url)} className="w-6 h-6 rounded object-cover shrink-0" alt="" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-700 truncate">{item.title}</div>
                    {item.subtitle && <div className="text-xs text-gray-400 truncate">{item.subtitle}</div>}
                  </div>
                  {item.rating != null && <div className="text-xs text-amber-500">{'★'.repeat(Math.min(5, item.rating))}</div>}
                </div>
              ))}
              {liveItems.length === 0 && <p className="text-xs text-center text-gray-400 py-3">No items yet.</p>}
            </div>
          )}
        </div>
      )}

      {/* External API */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">External API</div>
        <div className="space-y-2.5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">URL</label>
            <input
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              placeholder="https://api.example.com/products"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Method</label>
            <select
              value={apiMethod}
              onChange={e => setApiMethod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
            >
              {['GET', 'POST'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">Headers</label>
              <button
                onClick={() => setApiHeaders(prev => [...prev, { key: '', value: '' }])}
                className="text-xs text-primary/80 hover:text-primary"
              >
                + Add
              </button>
            </div>
            {apiHeaders.map((h, i) => (
              <div key={i} className="flex gap-1">
                <input
                  value={h.key}
                  onChange={e => setApiHeaders(prev => prev.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                  placeholder="Key"
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs"
                />
                <input
                  value={h.value}
                  onChange={e => setApiHeaders(prev => prev.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                  placeholder="Value"
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs"
                />
                <button onClick={() => setApiHeaders(prev => prev.filter((_, j) => j !== i))} className="text-red-400 px-1">×</button>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Data field path</label>
            <input
              value={apiField}
              onChange={e => setApiField(e.target.value)}
              placeholder="e.g. data.items or results"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleTestApi}
              disabled={!apiUrl || loadingPreview}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
            >
              {loadingPreview ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plug className="w-3 h-3" />}
              Test
            </button>
            <button
              onClick={handleSaveApi}
              disabled={!apiUrl}
              className="flex-1 py-2 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Save
            </button>
          </div>
          {preview.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-bold text-gray-400">Preview ({preview.length} items)</div>
              <div className="max-h-32 overflow-y-auto border border-gray-100 rounded-lg p-2 space-y-1">
                {preview.map((item, i) => (
                  <div key={i} className="text-xs text-gray-600 font-mono bg-gray-50 rounded px-2 py-1 truncate">
                    {JSON.stringify(item).slice(0, 80)}…
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Block Design Bar (inline canvas floating toolbar) ─────────────────────────

const QUICK_INSERT_TYPES = [
  { type: 'hero',        label: '🚀 Hero' },
  { type: 'features',    label: '⚡ Features' },
  { type: 'cta',         label: '🎯 CTA' },
  { type: 'rich_text',   label: '📝 Text' },
  { type: 'image_block', label: '🖼 Image' },
  { type: 'video_embed', label: '▶ Video' },
  { type: 'stats',       label: '📊 Stats' },
  { type: 'testimonials',label: '💬 Reviews' },
  { type: 'contact_form',label: '✉ Contact' },
  { type: 'divider',     label: '— Divider' },
  { type: 'spacer',      label: '⬜ Spacer' },
  { type: 'newsletter',  label: '📧 Newsletter' },
] as const

const CANVAS_ANIM_OPTIONS = [
  { id: 'none',        label: '⊘', title: 'No animation' },
  { id: 'fade-in',     label: '✨', title: 'Fade In' },
  { id: 'slide-up',    label: '⬆', title: 'Slide Up' },
  { id: 'slide-down',  label: '⬇', title: 'Slide Down' },
  { id: 'slide-left',  label: '◀', title: 'Slide from Left' },
  { id: 'slide-right', label: '▶', title: 'Slide from Right' },
  { id: 'zoom-in',     label: '🔍', title: 'Zoom In' },
  { id: 'flip',        label: '🔄', title: 'Flip' },
]

const ELEMENT_INSERT_TYPES = [
  { type: 'text',    label: '📝 Text Box',         desc: 'Editable text overlay' },
  { type: 'image',   label: '🖼 Image',             desc: 'Draggable image layer' },
  { type: 'button',  label: '🔘 Button',            desc: 'Clickable button element' },
  { type: 'box',     label: '⬜ Box / Card',        desc: 'Styled container shape' },
  { type: 'badge',   label: '🏷 Badge',             desc: 'Label or tag chip' },
  { type: 'video',   label: '▶ Video',              desc: 'Video media layer' },
  { type: 'link',    label: '🔗 Link',              desc: 'Button that opens a URL or internal page' },
  { type: 'db_link', label: '🔌 Connect to Data',  desc: 'Link to a product, service, team member, category…' },
  { type: 'store',   label: '🏬 Connect to Store',  desc: 'Switch to a specific physical outlet / branch' },
] as const

// ── Typography toolbar: font scale + text case (canvas bar & properties panel) ─
const FONT_SCALE_STEPS: [string, number][] = [
  ['XS', 0.75], ['S', 0.875], ['M', 1], ['L', 1.125], ['XL', 1.25], ['2X', 1.5],
]

/** Pixel presets for the numeric dropdown (Figma/Word-style). */
const FONT_SIZE_PX_CHOICES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72] as const
const FONT_SIZE_PX_MIN = 8
const FONT_SIZE_PX_MAX = 72
const FONT_SIZE_PX_STEP = 1
const FONT_SIZE_PX_FALLBACK = 16

const TEXT_CASE_CSS = ['uppercase', 'lowercase', 'capitalize'] as const
type TextCaseCss = (typeof TEXT_CASE_CSS)[number]
type TextCaseMenuId = 'default' | 'sentence' | TextCaseCss | 'toggle'

function toSentenceCase(s: string): string {
  const t = s.trim().toLowerCase()
  if (!t) return s
  return t.replace(/(^|[.!?]\s+)(\w)/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
}

function toToggleCase(s: string): string {
  return [...s].map(c => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase())).join('')
}

const TEXT_CASE_SKIP_KEYS = new Set([
  'data_source', 'overlays', 'nav_links', 'social_links', 'form_fields', 'html',
  'gradient_preset',
])

function shouldSkipStringCase(val: string, key: string): boolean {
  const t = val.trim()
  if (!t) return true
  if (/^https?:\/\//i.test(t) || /^www\./i.test(t)) return true
  if (/^#[0-9a-f]{3,8}$/i.test(t)) return true
  const lk = key.toLowerCase()
  if ((lk.includes('url') || lk.endsWith('_url')) && t.length > 3) return true
  if ((lk === 'email' || lk === 'phone') && (t.includes('@') || /^\+?[\d\s().-]{8,}$/.test(t))) return true
  return false
}

/** Walk props and rewrite user-facing strings (skips URLs, nav config, embed HTML, etc.). */
function mapPropsStringsDeep(
  props: Record<string, unknown>,
  mode: 'sentence' | 'toggle',
): Record<string, unknown> {
  const fn = mode === 'sentence' ? toSentenceCase : toToggleCase
  const visit = (val: unknown, key: string): unknown => {
    if (typeof val === 'string') {
      if (shouldSkipStringCase(val, key)) return val
      return fn(val)
    }
    if (Array.isArray(val)) return val.map((el, i) => visit(el, `${key}[${i}]`))
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const o = val as Record<string, unknown>
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(o)) {
        if (TEXT_CASE_SKIP_KEYS.has(k)) {
          out[k] = v
          continue
        }
        out[k] = visit(v, k)
      }
      return out
    }
    return val
  }
  return visit({ ...props }, 'root') as Record<string, unknown>
}

function buildTextCasePropsPatch(
  current: Record<string, unknown>,
  cmd: TextCaseMenuId,
): Partial<BlockProps> {
  if (cmd === 'default') return { text_transform: null }
  if (cmd === 'uppercase' || cmd === 'lowercase' || cmd === 'capitalize') {
    return { text_transform: cmd }
  }
  if (cmd === 'sentence' || cmd === 'toggle') {
    const mode = cmd === 'sentence' ? 'sentence' : 'toggle'
    return { text_transform: null, ...mapPropsStringsDeep(current, mode) } as Partial<BlockProps>
  }
  return {}
}

function currentTextCaseMenuId(props: Record<string, unknown>): TextCaseMenuId {
  const t = (props.text_transform as string | undefined)?.toLowerCase()
  if (t && (TEXT_CASE_CSS as readonly string[]).includes(t)) return t as TextCaseCss
  return 'default'
}

const TEXT_CASE_MENU_ROWS: { id: TextCaseMenuId; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'sentence', label: 'Sentence case.' },
  { id: 'lowercase', label: 'lowercase' },
  { id: 'uppercase', label: 'UPPERCASE' },
  { id: 'capitalize', label: 'Capitalize Each Word' },
  { id: 'toggle', label: 'tOGGLE cASE' },
]

function BlockDesignBar({ block, onUpdate, onInsertAfter, onOpenLinkEditorForOverlay, activeTextField, onUndo, onRedo, canUndo, canRedo }: {
  block: WebsiteBlock
  onUpdate: (p: Partial<BlockProps>) => void
  onInsertAfter: (type: string) => void
  activeTextField?: string | null
  onOpenLinkEditorForOverlay?: (item: BlockOverlayItem, anchor: { x: number; y: number }) => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
}) {
  const [showInsert, setShowInsert] = useState(false)
  const [showBlocks, setShowBlocks] = useState(false)
  const [showAnim, setShowAnim] = useState(false)
  const [showShapes, setShowShapes] = useState(false)
  const [showCase, setShowCase] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const p = block.props
  const fieldStyles = ((p as any)._field_styles || {}) as Record<string, Record<string, unknown>>
  const activeFieldStyle = activeTextField ? (fieldStyles[activeTextField] || {}) : null

  const updateTextStyle = (patch: Record<string, unknown>) => {
    if (activeTextField && applyInlineTextSelectionStyle(activeTextField, patch)) {
      return
    }
    if (!activeTextField) {
      onUpdate(patch as any)
      return
    }
    onUpdate({
      _field_styles: {
        ...fieldStyles,
        [activeTextField]: {
          ...(fieldStyles[activeTextField] || {}),
          ...patch,
        },
      },
    } as any)
  }

  const typographySource = activeFieldStyle || (p as Record<string, unknown>)

  // Close any open dropdown when clicking outside the bar
  useEffect(() => {
    if (!showInsert && !showBlocks && !showAnim && !showShapes && !showCase) return
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setShowInsert(false); setShowBlocks(false); setShowAnim(false); setShowShapes(false); setShowCase(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showInsert, showBlocks, showAnim, showShapes, showCase])

  const addOverlayElement = (type: string, anchor?: { x: number; y: number }) => {
    const defaults = OVERLAY_DEFAULTS[type] || {}
    const currentOverlays: BlockOverlayItem[] = ((p as any).overlays as BlockOverlayItem[]) || []
    // "link", "db_link" and "store" are insert helpers — they render as a
    // standard button overlay but pre-seed link fields and auto-open the
    // link editor so the user lands directly on the right tab.
    const overlayType = (type === 'link' || type === 'db_link' || type === 'store') ? 'button' : type
    const newId = `ov-${Date.now()}`
    const newItem: BlockOverlayItem = {
      id: newId,
      type: overlayType as any,
      x: 20 + currentOverlays.length * 12,
      y: 20 + currentOverlays.length * 12,
      w: (defaults as any).w || 200,
      h: (defaults as any).h || 80,
      ...defaults,
    }
    onUpdate({ overlays: [...currentOverlays, newItem] } as any)
    setShowInsert(false)
    if ((type === 'link' || type === 'db_link' || type === 'store') && onOpenLinkEditorForOverlay) {
      onOpenLinkEditorForOverlay(newItem, anchor || { x: window.innerWidth / 2, y: 200 })
    }
  }

  const overlayCount = ((p as any).overlays as any[] || []).length

  return (
    <div
      ref={barRef}
      className="absolute top-0 left-0 right-0 z-[80] flex min-h-[38px] items-center gap-1.5 overflow-x-auto overflow-y-visible border-t-2 border-primary border-b border-primary/30 bg-white px-2 py-1.5 pr-[20rem] shadow-sm"
      onClick={e => e.stopPropagation()}
    >
      {/* INSERT ELEMENT — primary action: adds elements WITHIN the block */}
      <div className="relative">
        <button
          onClick={() => { setShowInsert(v => !v); setShowBlocks(false); setShowAnim(false); setShowShapes(false); setShowCase(false) }}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors',
            showInsert ? 'bg-primary/90 text-white' : 'bg-primary text-white hover:bg-primary/90'
          )}
        >
          <Plus className="w-3 h-3" /> Insert
          {overlayCount > 0 && (
            <span className="bg-white text-primary rounded-full px-1 text-[8px] font-black ml-0.5">{overlayCount}</span>
          )}
        </button>
        {showInsert && (
          <div className="absolute top-8 left-0 z-[200] bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden w-56">
            <div className="px-3 py-2 bg-accent border-b border-primary/20">
              <div className="text-xs font-bold text-primary">Insert inside this section</div>
              <div className="text-xs text-primary/80 mt-0.5">Elements are draggable & resizable within the block</div>
            </div>
            <div className="p-2 space-y-0.5">
              {ELEMENT_INSERT_TYPES.map(({ type, label, desc }) => (
                <button key={type}
                  onMouseDown={e => {
                    e.stopPropagation()
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    addOverlayElement(type, { x: rect.right + 8, y: rect.top })
                  }}
                  className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-accent transition-colors group"
                >
                  <span className="text-base leading-none mt-0.5">{label.split(' ')[0]}</span>
                  <div>
                    <div className="text-xs font-medium text-gray-800 group-hover:text-primary">{label.slice(label.indexOf(' ') + 1)}</div>
                    <div className="text-xs text-gray-400">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
            {overlayCount > 0 && (
              <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">{overlayCount} element{overlayCount !== 1 ? 's' : ''} in this section</span>
                <button
                  onMouseDown={e => { e.stopPropagation(); onUpdate({ overlays: [] } as any); setShowInsert(false) }}
                  className="text-xs text-red-400 hover:text-red-600 font-semibold"
                >Clear all</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ADD BLOCK — secondary: add new section after this one */}
      <div className="relative">
        <button
          onClick={() => { setShowBlocks(v => !v); setShowInsert(false); setShowAnim(false); setShowShapes(false); setShowCase(false) }}
          className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-300 text-gray-600 text-xs font-medium hover:border-primary/60 hover:bg-accent transition-colors"
          title="Add a new block section after this one"
        >
          <Layers className="w-3 h-3" /> Block
        </button>
        {showBlocks && (
          <div className="absolute top-8 left-0 z-[200] bg-white border border-gray-200 rounded-xl shadow-2xl p-2 grid grid-cols-2 gap-0.5 w-44">
            <div className="col-span-2 text-xs font-bold text-gray-400 uppercase tracking-wide px-2 py-1">Add section after this</div>
            {QUICK_INSERT_TYPES.map(({ type, label }) => (
              <button key={type}
                onMouseDown={e => { e.stopPropagation(); onInsertAfter(type); setShowBlocks(false) }}
                className="text-left px-2 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-accent hover:text-primary transition-colors"
              >{label}</button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-gray-200 shrink-0" />

      {/* A↑ / A↓ + px dropdown (design-tool style); clears em scale when used */}
      <div
        className="inline-flex items-center gap-0.5 rounded-lg border border-gray-700 bg-gray-900 p-0.5 shrink-0 shadow-sm"
        title="Font size in pixels"
      >
        <button
          type="button"
          className="flex h-6 items-center gap-0.5 rounded px-1.5 text-white hover:bg-gray-800"
          onClick={() => {
            const cur = (typographySource as any).font_size_px as number | undefined
            const base = typeof cur === 'number' && cur > 0 ? Math.round(cur) : FONT_SIZE_PX_FALLBACK
            const next = Math.min(FONT_SIZE_PX_MAX, Math.max(FONT_SIZE_PX_MIN, base + FONT_SIZE_PX_STEP))
            updateTextStyle({ font_size_px: next, text_scale: null })
          }}
        >
          <span className="text-xs font-bold leading-none">A</span>
          <ChevronUp className="w-2.5 h-2.5 text-sky-400 shrink-0" strokeWidth={2.75} />
        </button>
        <button
          type="button"
          className="flex h-6 items-center gap-0.5 rounded px-1.5 text-white hover:bg-gray-800"
          onClick={() => {
            const cur = (typographySource as any).font_size_px as number | undefined
            const base = typeof cur === 'number' && cur > 0 ? Math.round(cur) : FONT_SIZE_PX_FALLBACK
            const next = Math.min(FONT_SIZE_PX_MAX, Math.max(FONT_SIZE_PX_MIN, base - FONT_SIZE_PX_STEP))
            updateTextStyle({ font_size_px: next, text_scale: null })
          }}
        >
          <span className="text-xs font-bold leading-none">A</span>
          <ChevronDown className="w-2.5 h-2.5 text-sky-400 shrink-0" strokeWidth={2.75} />
        </button>
        <div className="w-px h-4 self-center bg-gray-600 mx-0.5 shrink-0" />
        <select
          className="h-6 min-w-[3.5rem] cursor-pointer rounded border-0 bg-gray-900 py-0 pl-1.5 pr-1 text-xs font-medium text-white outline-none focus-visible:ring-1 focus-visible:ring-sky-500"
          value={
            typeof (typographySource as any).font_size_px === 'number' && (typographySource as any).font_size_px > 0 && Number.isFinite((typographySource as any).font_size_px)
              ? String(Math.round((typographySource as any).font_size_px))
              : ''
          }
          onChange={e => {
            const v = e.target.value
            if (!v) updateTextStyle({ font_size_px: null })
            else updateTextStyle({ font_size_px: Math.round(Number(v)), text_scale: null })
          }}
          onClick={e => e.stopPropagation()}
        >
          <option value="">Auto</option>
          {FONT_SIZE_PX_CHOICES.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div className="relative shrink-0">
        <button
          type="button"
          title="Text case"
          onClick={() => {
            setShowCase(v => !v)
            setShowInsert(false); setShowBlocks(false); setShowAnim(false); setShowShapes(false)
          }}
          className={cn(
            'flex items-center gap-0.5 h-6 px-1.5 rounded-lg border text-xs font-bold transition-colors',
            showCase || currentTextCaseMenuId(typographySource as any) !== 'default'
              ? 'border-primary bg-accent text-primary'
              : 'border-gray-200 text-gray-600 hover:border-primary/40 hover:bg-accent',
          )}
        >
          Aa
          <ChevronDown className="w-3 h-3 opacity-70" />
        </button>
        {showCase && (
          <div
            className="absolute top-8 left-0 z-[200] min-w-[220px] rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-2xl"
            onMouseDown={e => e.stopPropagation()}
          >
            {TEXT_CASE_MENU_ROWS.map(row => (
              <button
                key={row.id}
                type="button"
                className={cn(
                  'w-full text-left px-3 py-2 text-xs transition-colors',
                  currentTextCaseMenuId(typographySource as any) === row.id
                    ? 'bg-primary text-white'
                    : 'text-gray-100 hover:bg-gray-800',
                )}
                onMouseDown={e => {
                  e.stopPropagation()
                  if (activeTextField) {
                    if (row.id === 'sentence' || row.id === 'toggle') {
                      const currentVal = (p as any)[activeTextField]
                      if (typeof currentVal === 'string') {
                        onUpdate({
                          [activeTextField]: row.id === 'sentence' ? toSentenceCase(currentVal) : toToggleCase(currentVal),
                          _field_styles: {
                            ...fieldStyles,
                            [activeTextField]: { ...(fieldStyles[activeTextField] || {}), text_transform: null },
                          },
                        } as any)
                      } else {
                        updateTextStyle({ text_transform: null })
                      }
                    } else {
                      updateTextStyle(buildTextCasePropsPatch({} as Record<string, unknown>, row.id) as Record<string, unknown>)
                    }
                  } else {
                    const patch = buildTextCasePropsPatch(p as Record<string, unknown>, row.id)
                    onUpdate(patch as any)
                  }
                  setShowCase(false)
                  if (row.id === 'sentence' || row.id === 'toggle') {
                    toast.success(row.id === 'sentence' ? 'Sentence case applied to section text' : 'Toggle case applied to section text')
                  }
                }}
              >
                {row.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-gray-200 shrink-0" />

      {/* TEXT COLOR */}
      <div className="flex items-center gap-1" title="Text color">
        <Type className="w-3 h-3 text-gray-400 shrink-0" />
        <input type="color"
          value={(typographySource as any).text_color_override || '#111827'}
          onChange={e => updateTextStyle({ text_color_override: e.target.value })}
          className="w-6 h-6 rounded border border-gray-200 cursor-pointer p-0 shrink-0"
        />
      </div>

      {/* BACKGROUND COLOR */}
      <div className="flex items-center gap-1" title="Block background">
        <Square className="w-3 h-3 text-gray-400 shrink-0" />
        <input type="color"
          value={(p as any).bg_color_override || '#ffffff'}
          onChange={e => onUpdate({ bg_color_override: e.target.value } as any)}
          className="w-6 h-6 rounded border border-gray-200 cursor-pointer p-0 shrink-0"
        />
      </div>

      <div className="w-px h-4 bg-gray-200 shrink-0" />

      {/* ANIMATION */}
      <div className="relative">
        <button
          onClick={() => { setShowAnim(v => !v); setShowInsert(false); setShowShapes(false); setShowCase(false) }}
          title="Scroll animation"
          className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors border',
            block.animation && block.animation !== 'none'
              ? 'bg-blue-100 text-blue-700 border-blue-200'
              : 'text-gray-500 border-gray-200 hover:border-primary/40 hover:bg-accent')}
        >
          <Zap className="w-3 h-3" />
          {block.animation && block.animation !== 'none' ? block.animation.replace('-', ' ') : 'Anim'}
        </button>
        {showAnim && (
          <div className="absolute top-8 left-0 z-[200] bg-white border border-gray-200 rounded-xl shadow-2xl p-2">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Scroll Animation</div>
            <div className="grid grid-cols-4 gap-1 w-36">
              {CANVAS_ANIM_OPTIONS.map(({ id, label, title }) => (
                <button key={id}
                  onMouseDown={e => { e.stopPropagation(); onUpdate({ animation: id === 'none' ? null : id } as any); setShowAnim(false) }}
                  title={title}
                  className={cn('w-8 h-8 text-sm rounded-lg border transition-colors flex items-center justify-center',
                    (block.animation || 'none') === id
                      ? 'bg-primary text-white border-primary'
                      : 'text-gray-600 border-gray-200 hover:border-primary/40 hover:bg-accent')}
                >{label}</button>
              ))}
            </div>
            {block.animation && block.animation !== 'none' && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-xs text-gray-500 shrink-0">Delay</label>
                <input type="range" min={0} max={1000} step={100}
                  defaultValue={block.animation_delay || 0}
                  onChange={e => onUpdate({ animation_delay: Number(e.target.value) } as any)}
                  className="flex-1 accent-primary h-1"
                />
                <span className="text-xs text-gray-500 w-10">{block.animation_delay || 0}ms</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-gray-200 shrink-0" />

      {/* SHAPES / ORIGINS */}
      <div className="relative">
        <button
          onClick={() => { setShowShapes(v => !v); setShowInsert(false); setShowAnim(false); setShowCase(false) }}
          title="Section shape dividers"
          className={cn('flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors border',
            ((p as any).top_shape && (p as any).top_shape !== 'none') || ((p as any).bottom_shape && (p as any).bottom_shape !== 'none')
              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
              : 'text-gray-500 border-gray-200 hover:border-primary/40 hover:bg-accent')}
        >
          <svg viewBox="0 0 20 10" className="w-4 h-3 fill-current"><path d="M0,10 C5,0 10,10 15,3 C17,1 18,5 20,4 L20,10 Z"/></svg>
          Origins
        </button>
        {showShapes && (
          <>
            <div className="absolute top-8 left-0 z-[200] bg-white border border-gray-200 rounded-xl shadow-2xl p-3 w-72">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Top Edge Shape</div>
              <div className="grid grid-cols-3 gap-1 mb-3">
                {SHAPE_OPTIONS.map(({ id, label }) => (
                  <button key={`db-top-${id}`}
                    onClick={() => onUpdate({ top_shape: id === 'none' ? null : id } as any)}
                    className={cn('py-1 px-1 text-xs font-medium rounded border transition-colors text-center truncate',
                      ((p as any).top_shape || 'none') === id
                        ? 'bg-primary text-white border-primary'
                        : 'text-gray-500 border-gray-200 hover:border-primary/40')}
                  >{label}</button>
                ))}
              </div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Bottom Edge Shape</div>
              <div className="grid grid-cols-3 gap-1 mb-3">
                {SHAPE_OPTIONS.map(({ id, label }) => (
                  <button key={`db-bot-${id}`}
                    onClick={() => onUpdate({ bottom_shape: id === 'none' ? null : id } as any)}
                    className={cn('py-1 px-1 text-xs font-medium rounded border transition-colors text-center truncate',
                      ((p as any).bottom_shape || 'none') === id
                        ? 'bg-primary text-white border-primary'
                        : 'text-gray-500 border-gray-200 hover:border-primary/40')}
                  >{label}</button>
                ))}
              </div>
              {(((p as any).top_shape && (p as any).top_shape !== 'none') || ((p as any).bottom_shape && (p as any).bottom_shape !== 'none')) && (
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <input type="color"
                    value={(p as any).shape_color || '#ffffff'}
                    onChange={e => onUpdate({ shape_color: e.target.value } as any)}
                    className="w-8 h-8 rounded border border-gray-200 cursor-pointer p-0.5"
                  />
                  <span className="text-xs text-gray-600">Shape fill color</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* FONT LABEL */}
      <div className="flex items-center gap-1 ml-1" title="Font family (change in Style panel)">
        <span className="text-xs text-gray-400">Font</span>
        <span className="text-xs font-medium text-gray-600">→ Style tab</span>
      </div>

      {/* Block label */}
      <div className="ml-auto text-xs text-gray-400 font-mono truncate max-w-[80px]">
        {block.label || block.block_type}
      </div>

      {/* Undo / Redo — mirrored from top toolbar for quick access while editing a block */}
      {(onUndo || onRedo) && (
        <>
          <div className="w-px h-4 bg-gray-200 shrink-0" />
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              disabled={!canUndo}
              onClick={onUndo}
              title="Undo (Ctrl+Z)"
              className={cn(
                'flex items-center justify-center w-6 h-6 rounded transition-colors',
                canUndo ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed',
              )}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={onRedo}
              title="Redo (Ctrl+Y)"
              className={cn(
                'flex items-center justify-center w-6 h-6 rounded transition-colors',
                canRedo ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed',
              )}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Builder ──────────────────────────────────────────────────────────────

export default function WebsiteBuilder() {
  const { siteId } = useParams<{ siteId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isTemplateMode = searchParams.get('templateMode') === 'true'
  const templateModeName = searchParams.get('templateName') ?? 'Template'
  const queryClient = useQueryClient()
  const { data: site, isLoading } = useSite(siteId || null)
  useMyVendor()
  const { vendor: myVendor } = useVendorStore()
  const publishSite = usePublishSite(siteId!)
  const unpublishSite = useUnpublishSite(siteId!)
  const updateSite = useUpdateSite(siteId!)
  const overlayLayerUpload = useUploadMedia(siteId!)
  const { data: templates = [] } = useWebsiteTemplates()

  // State
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [activeTextTarget, setActiveTextTarget] = useState<{ blockId: string; fieldKey: string } | null>(null)
  const [device, setDevice] = useState<DeviceMode>('desktop')
  const [leftPanel, setLeftPanel] = useState<'blocks' | 'pages' | 'layers' | 'templates'>(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('templateMode') === 'true') return 'templates'
    return 'blocks'
  })
  const [templateListSearch, setTemplateListSearch] = useState('')
  const [templatePanelSelectedId, setTemplatePanelSelectedId] = useState<string | null>(null)
  const [applyingTemplateInline, setApplyingTemplateInline] = useState(false)
  const [isApplyingToStore, setIsApplyingToStore] = useState(false)
  const [clearingTemplateSandbox, setClearingTemplateSandbox] = useState(false)
  const [resettingCanvasFromServer, setResettingCanvasFromServer] = useState(false)
  const [rightPanel, setRightPanel] = useState<'props' | 'style' | 'ai' | 'media' | 'data' | 'seo' | 'settings'>('props')
  const [blockSearch, setBlockSearch] = useState('')
  const [blockCategory, setBlockCategory] = useState('all')
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [showFullPreview, setShowFullPreview] = useState(false)
  /** Full-screen preview: real business front iframe (draft token) vs legacy BlockPreview fallback. */
  const [sfOverlayToken, setSfOverlayToken] = useState<string | null>(null)
  const [sfOverlayVendorSlug, setSfOverlayVendorSlug] = useState<string | null>(null)
  const [sfOverlayPublishedFallback, setSfOverlayPublishedFallback] = useState(false)
  const [sfOverlayLoading, setSfOverlayLoading] = useState(false)
  const [sfOverlayBlockFallback, setSfOverlayBlockFallback] = useState(false)
  const [leftWidth, setLeftWidth] = useState(260)
  const [rightWidth, setRightWidth] = useState(288)
  const isResizingLeft = useRef(false)
  const isResizingRight = useRef(false)
  /** Avoid showing the previous site's blocks when `siteId` in the URL changes without a full remount. */
  const prevEditorSiteIdRef = useRef<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveFlash, setSaveFlash] = useState(false)       // brief green flash on success
  const [styleDirty, setStyleDirty] = useState(false)     // unsaved style changes
  const [blocksDirty, setBlocksDirty] = useState(false)   // unsaved block props / reorder
  const blocksDirtyRef = useRef(false)   // mirror for use inside useEffect([site]) without dependency
  const styleDirtyRef = useRef(false)    // mirror for style dirty flag
  const [openingBrowserPreview, setOpeningBrowserPreview] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [storePopover, setStorePopover] = useState(false)
  // ── Block delete confirmation ("arm then confirm") ─────────────────────────
  // First click sets armedDeleteId; a second click within 2s confirms deletion.
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null)
  const armedDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // ── Block-level saving indicator ───────────────────────────────────────────
  const [savingBlockId, setSavingBlockId] = useState<string | null>(null)
  /** Selected in-canvas image overlay (for AI / Media apply). */
  const [overlayImageTarget, setOverlayImageTarget] = useState<{ blockId: string; overlayId: string } | null>(null)
  const [aiImageGenFocusKey, setAiImageGenFocusKey] = useState(0)
  const overlayImageUploadRef = useRef<HTMLInputElement>(null)

  // ── Link editor (opened from CTA buttons / overlay buttons) ────────────────
  const [linkEditor, setLinkEditor] = useState<
    | null
    | {
        anchor: { x: number; y: number }
        value: LinkValue
        save: (v: LinkValue) => void
      }
  >(null)

  // ── Context menu (right-click block / overlay) ─────────────────────────────
  const [contextMenu, setContextMenu] = useState<
    | null
    | { x: number; y: number; actions: ContextMenuAction[] }
  >(null)

  // ── Styled text prompt (replaces all native window.prompt calls) ───────────
  const [textPrompt, setTextPrompt] = useState<
    | null
    | {
        title: string
        subtitle?: string
        placeholder?: string
        initialValue?: string
        multiline?: boolean
        maxLength?: number
        confirmLabel?: string
        anchor?: { x: number; y: number } | null
        onSave: (v: string) => void
      }
  >(null)

  const openTextPrompt = useCallback((opts: {
    title: string
    subtitle?: string
    placeholder?: string
    initialValue?: string
    multiline?: boolean
    maxLength?: number
    confirmLabel?: string
    anchor?: { x: number; y: number } | null
    onSave: (v: string) => void
  }) => setTextPrompt(opts), [])

  // ── UNDO / REDO ────────────────────────────────────────────────────────────
  const historyStack = useRef<Record<string, WebsiteBlock[]>[]>([])
  const historyIndex = useRef(-1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const pushHistory = useCallback((blocks: Record<string, WebsiteBlock[]>) => {
    // Trim forward history
    historyStack.current = historyStack.current.slice(0, historyIndex.current + 1)
    historyStack.current.push(JSON.parse(JSON.stringify(blocks)))
    historyIndex.current = historyStack.current.length - 1
    setCanUndo(historyIndex.current > 0)
    setCanRedo(false)
  }, [])

  const localBlocksRef = useRef<Record<string, WebsiteBlock[]>>({})

  /** One undo step per burst of prop edits (e.g. typing in a text field). */
  const historyBurstRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; primed: boolean }>({ timer: null, primed: false })
  const scheduleEditorHistorySnapshot = useCallback(() => {
    if (!historyBurstRef.current.primed) {
      pushHistory(JSON.parse(JSON.stringify(localBlocksRef.current)))
      historyBurstRef.current.primed = true
    }
    if (historyBurstRef.current.timer) clearTimeout(historyBurstRef.current.timer)
    historyBurstRef.current.timer = setTimeout(() => {
      historyBurstRef.current.primed = false
      historyBurstRef.current.timer = null
    }, 450)
  }, [pushHistory])

  const handleUndo = useCallback(() => {
    if (historyIndex.current <= 0) return
    historyIndex.current -= 1
    const snapshot = historyStack.current[historyIndex.current]
    if (snapshot) {
      setLocalBlocks(snapshot)
      setBlocksDirty(true)
      setCanUndo(historyIndex.current > 0)
      setCanRedo(true)
    }
  }, [])

  const handleRedo = useCallback(() => {
    if (historyIndex.current >= historyStack.current.length - 1) return
    historyIndex.current += 1
    const snapshot = historyStack.current[historyIndex.current]
    if (snapshot) {
      setLocalBlocks(snapshot)
      setBlocksDirty(true)
      setCanUndo(true)
      setCanRedo(historyIndex.current < historyStack.current.length - 1)
    }
  }, [])
  const [localStyle, setLocalStyle] = useState<StyleConfig>(DEFAULT_STYLE)
  const [isDraggingOver, setIsDraggingOver] = useState<string | null>(null)
  const [draggingBlockIdx, setDraggingBlockIdx] = useState<number | null>(null)
  const [draggingNewBlock, setDraggingNewBlock] = useState<BlockDef | null>(null)

  // ── LOCAL BLOCK STATE (optimistic, real-time) ─────────────────────────────
  // Keyed by pageId → array of blocks. Updated immediately on every action.
  const [localBlocks, setLocalBlocks] = useState<Record<string, WebsiteBlock[]>>({})
  // Keep ref in sync so callbacks that close over it always see the latest state.
  useEffect(() => {
    localBlocksRef.current = localBlocks
  }, [localBlocks])
  useEffect(() => { blocksDirtyRef.current = blocksDirty }, [blocksDirty])
  useEffect(() => { styleDirtyRef.current = styleDirty }, [styleDirty])
  // Track pages locally too (for adds/deletes without refresh)
  const [localPages, setLocalPages] = useState<WebsitePage[]>([])

  useEffect(() => {
    if (!siteId) return
    if (prevEditorSiteIdRef.current === siteId) return
    prevEditorSiteIdRef.current = siteId
    setLocalBlocks({})
    setLocalPages([])
    setActivePageId(null)
    setSelectedBlockId(null)
    setActiveTextTarget(null)
    setBlocksDirty(false)
    historyStack.current = []
    historyIndex.current = -1
    setCanUndo(false)
    setCanRedo(false)
    setLocalStyle({ ...DEFAULT_STYLE })
  }, [siteId])

  const invalidateSite = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['websites', siteId] })
  }, [queryClient, siteId])

  /** Load a template onto the canvas — no publish, user edits first then clicks Apply in toolbar. */
  const handleApplySelectedTemplate = useCallback(async (templateId: string) => {
    if (!siteId) return
    setApplyingTemplateInline(true)
    try {
      const next = await websiteApi.applyTemplate(siteId, templateId)
      queryClient.setQueryData(['websites', siteId], next)
      await queryClient.invalidateQueries({ queryKey: ['websites'], exact: true })
      toast.success('Template loaded — make any edits then click Apply to go live.')
      setTemplatePanelSelectedId(templateId)
    } catch {
      toast.error('Failed to load template')
      setTemplatePanelSelectedId(null)
    } finally {
      setApplyingTemplateInline(false)
    }
  }, [siteId, queryClient])

  // handleApplyToStore is defined after handleSaveCanvas — see below

  const handleClearTemplateSandbox = useCallback(async () => {
    if (!siteId || !isTemplateMode) return
    setClearingTemplateSandbox(true)
    setTemplatePanelSelectedId(null)
    try {
      const next = await websiteApi.ensureBlankSite(siteId)
      queryClient.setQueryData(['websites', siteId], next)
      await queryClient.invalidateQueries({ queryKey: ['websites'], exact: true })
      toast.success('Cleared — blank site')
    } catch {
      toast.error('Could not clear site')
    } finally {
      setClearingTemplateSandbox(false)
    }
  }, [siteId, isTemplateMode, queryClient])

  const hydrateEditorFromSite = useCallback((nextSite: WebsiteSite) => {
    setLocalStyle({ ...DEFAULT_STYLE, ...(nextSite.style_config as any) })
    setLocalPages(nextSite.pages)
    const nextBlocks: Record<string, WebsiteBlock[]> = {}
    nextSite.pages.forEach(page => {
      nextBlocks[page.id] = page.blocks.slice().sort((a, b) => a.sort_order - b.sort_order)
    })
    setLocalBlocks(nextBlocks)
    const homepage = nextSite.pages.find(p => p.is_homepage) || nextSite.pages[0]
    setActivePageId(homepage?.id ?? null)
    setSelectedBlockId(null)
    setActiveTextTarget(null)
    setBlocksDirty(false)
    historyStack.current = [JSON.parse(JSON.stringify(nextBlocks))]
    historyIndex.current = 0
    setCanUndo(false)
    setCanRedo(false)
  }, [])

  const handleCopyTemplateJson = useCallback(async () => {
    try {
      const payload = buildLocalSiteExport(site, localPages, localBlocks, localStyle)
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      toast.success('Site JSON copied — compatible with Import, or save as a backup.')
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }, [site, localPages, localBlocks, localStyle])

  const handleResetCanvasFromServer = useCallback(() => {
    if (!siteId) return
    openTextPrompt({
      title: 'Reload from server?',
      subtitle: 'Unsaved canvas and style changes will be lost. This cannot be undone.',
      placeholder: '',
      confirmLabel: 'Reload',
      onSave: async () => {
        setResettingCanvasFromServer(true)
        try {
          const fresh = await websiteApi.getSite(siteId)
          queryClient.setQueryData(['websites', siteId], fresh)
          hydrateEditorFromSite(fresh)
          setStyleDirty(false)
          setBlocksDirty(false)
          toast.success('Canvas reset to last saved version')
        } catch {
          toast.error('Could not reload site')
        } finally {
          setResettingCanvasFromServer(false)
        }
      },
    })
  }, [siteId, queryClient, hydrateEditorFromSite, openTextPrompt])

  // Sync from server → local. After AI/template replace, page IDs change; drop stale keys and fix active tab.
  // Guard: skip overwriting localBlocks/localStyle when the user has unsaved edits — a background
  // refetch (e.g. on window-focus) must not silently discard in-flight changes.
  useEffect(() => {
    if (site) {
      if (!styleDirtyRef.current) {
        setLocalStyle({ ...DEFAULT_STYLE, ...(site.style_config as any) })
      }
      setLocalPages(site.pages)
      if (!blocksDirtyRef.current) {
        setLocalBlocks(() => {
          const next: Record<string, WebsiteBlock[]> = {}
          site.pages.forEach(page => {
            const serverBlocks = page.blocks.slice().sort((a, b) => a.sort_order - b.sort_order)
            next[page.id] = serverBlocks
          })
          return next
        })
      }
      const ids = new Set(site.pages.map(p => p.id))
      setActivePageId(cur => {
        if (cur && ids.has(cur)) return cur
        if (site.pages.length === 0) return null
        const homepage = site.pages.find(p => p.is_homepage) || site.pages[0]
        return homepage.id
      })
    }
  }, [site])

  const prefillParam = searchParams.get('prefillTemplateId')
  const expectBlankParam = searchParams.get('expectBlank') === '1'
  // Template sandbox: wipe server + cache before stripping URL params. Do not wait for the
  // templates list (avoids a window where stale blocks flash). Invalid template ids still get a blank site.
  useEffect(() => {
    if (!isTemplateMode || !siteId) return
    if (!prefillParam && !expectBlankParam) return

    let cancelled = false
    ;(async () => {
      try {
        const next = await websiteApi.ensureBlankSite(siteId)
        if (cancelled) return
        queryClient.setQueryData(['websites', siteId], next)
      } catch {
        if (!cancelled) toast.error('Could not prepare a blank template workspace')
        return
      }
      if (cancelled) return
      setLeftPanel('templates')
      if (prefillParam) setTemplatePanelSelectedId(prefillParam)
      setSearchParams(prev => {
        const n = new URLSearchParams(prev)
        n.delete('prefillTemplateId')
        n.delete('expectBlank')
        return n
      }, { replace: true })
    })()
    return () => { cancelled = true }
  }, [isTemplateMode, siteId, prefillParam, expectBlankParam, queryClient, setSearchParams])

  // ── PANEL RESIZE HANDLERS ──────────────────────────────────────────────────
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isResizingLeft.current) {
        const newW = Math.min(480, Math.max(180, e.clientX))
        setLeftWidth(newW)
      }
      if (isResizingRight.current) {
        const newW = Math.min(560, Math.max(220, window.innerWidth - e.clientX))
        setRightWidth(newW)
      }
    }
    const onMouseUp = () => {
      if (isResizingLeft.current || isResizingRight.current) {
        isResizingLeft.current = false
        isResizingRight.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // ── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────────
  // Use a stable ref so the keydown listener doesn't need to re-register every
  // render and never hits the temporal dead-zone of handlers defined later.
  const kbHandlersRef = useRef({
    handleUndo,
    handleRedo,
    handleDeleteBlock: (_id: string) => {},
    handleDuplicateBlock: (_id: string) => {},
    handleMoveBlock: (_id: string, _dir: 'up' | 'down') => {},
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable
      if (isInput) return

      const { handleDeleteBlock: del, handleDuplicateBlock: dup, handleMoveBlock: move } = kbHandlersRef.current
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key === 'z') { e.preventDefault(); handleUndo(); return }
      if (ctrl && (e.key === 'y' || e.key === 'Z')) { e.preventDefault(); handleRedo(); return }
      if (ctrl && e.key === 'd') {
        e.preventDefault()
        if (selectedBlockId) dup(selectedBlockId)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId) {
        e.preventDefault()
        // Del key arms the confirmation; pressing again within 2.5s confirms.
        del(selectedBlockId)
        return
      }
      if (e.key === 'Escape') { setSelectedBlockId(null); return }
      if (e.key === 'ArrowUp' && selectedBlockId && activePageId) {
        e.preventDefault()
        const blocks = localBlocks[activePageId] || []
        const idx = blocks.findIndex(b => b.id === selectedBlockId)
        if (idx > 0) move(selectedBlockId, 'up')
        return
      }
      if (e.key === 'ArrowDown' && selectedBlockId && activePageId) {
        e.preventDefault()
        const blocks = localBlocks[activePageId] || []
        const idx = blocks.findIndex(b => b.id === selectedBlockId)
        if (idx < blocks.length - 1) move(selectedBlockId, 'down')
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlockId, activePageId, localBlocks, handleUndo, handleRedo])

  const activePage = useMemo(() =>
    localPages.find(p => p.id === activePageId) || null
  , [localPages, activePageId])

  const activeBlocks = useMemo(() =>
    (localBlocks[activePageId || ''] || []).slice().sort((a, b) => a.sort_order - b.sort_order)
  , [localBlocks, activePageId])

  const selectedBlock = useMemo(() =>
    activeBlocks.find(b => b.id === selectedBlockId) || null
  , [activeBlocks, selectedBlockId])

  useEffect(() => {
    setOverlayImageTarget(null)
  }, [selectedBlockId])

  const applyToImageLayer = useMemo(() => {
    if (!selectedBlock || !overlayImageTarget || overlayImageTarget.blockId !== selectedBlock.id) return false
    const overlays = ((selectedBlock.props as any).overlays as BlockOverlayItem[]) || []
    return !!overlays.find(o => o.id === overlayImageTarget.overlayId && o.type === 'image')
  }, [selectedBlock, overlayImageTarget])

  const onOverlayLayerPicked = useCallback((overlayId: string | null) => {
    if (!selectedBlockId) {
      setOverlayImageTarget(null)
      return
    }
    setOverlayImageTarget(overlayId ? { blockId: selectedBlockId, overlayId } : null)
  }, [selectedBlockId])

  const openAiImageFromCanvas = useCallback(() => {
    setRightCollapsed(false)
    setRightPanel('ai')
    setAiImageGenFocusKey(k => k + 1)
  }, [])

  const openMediaFromCanvas = useCallback(() => {
    setRightCollapsed(false)
    setRightPanel('media')
  }, [])

  const filteredBlocks = useMemo(() => {
    let list = BLOCK_CATALOG
    if (blockCategory !== 'all') list = list.filter(b => b.category === blockCategory)
    if (blockSearch) list = list.filter(b => b.label.toLowerCase().includes(blockSearch.toLowerCase()) || b.desc.toLowerCase().includes(blockSearch.toLowerCase()))
    return list
  }, [blockCategory, blockSearch])

  // ── BLOCK OPERATIONS (all optimistic) ────────────────────────────────────

  const inferCommerceAutoSource = (blockType: string): LiveResource | undefined => {
    if (blockType.startsWith('product.')) return blockType.includes('categories') || blockType.includes('filters') ? 'categories' : 'products'
    if (blockType.startsWith('service.')) {
      if (blockType.includes('testimonial')) return 'testimonials'
      if (blockType.includes('team')) return 'team'
      return 'services'
    }
    if (blockType.startsWith('menu.')) return 'products'
    if (blockType.startsWith('booking.')) return 'bookings'
    if (blockType.startsWith('commerce.')) return 'products'
    return undefined
  }

  const handleAddBlock = useCallback(async (def: BlockDef, insertAtIdx = -1) => {
    if (!activePageId) return
    const tempId = `temp-${Date.now()}`
    const currentBlocks = localBlocks[activePageId] || []
    const maxOrder = currentBlocks.length > 0 ? Math.max(...currentBlocks.map(b => b.sort_order)) : -1
    const sort_order = insertAtIdx >= 0 ? insertAtIdx : maxOrder + 1

    // Auto-bind drag-dropped blocks to live KITERP data so they "just work".
    // The user can disconnect / override inside the Data panel later.
    const autoSource = BLOCK_AUTO_SOURCE[def.type as string] || inferCommerceAutoSource(def.type)
    const initialProps: BlockProps = autoSource
      ? { ...def.defaultProps, data_source: { type: autoSource, auto: true } } as BlockProps
      : { ...def.defaultProps }

    const tempBlock: WebsiteBlock = {
      id: tempId, page_id: activePageId,
      block_type: def.type, label: def.label,
      props: initialProps, style_overrides: {},
      visible: true, visible_on_mobile: true, visible_on_tablet: true, visible_on_desktop: true,
      animation: null as any, animation_delay: 0, sort_order,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }

    // 1. Immediately show in canvas + push history
    const next = { ...localBlocks, [activePageId]: [...(localBlocks[activePageId] || []), tempBlock].map((b, i) => ({ ...b, sort_order: i })) }
    setLocalBlocks(next)
    pushHistory(next)
    setSelectedBlockId(tempId)
    setRightPanel('props')
    setRightCollapsed(false)

    // 2. Persist in background
    try {
      const saved = await websiteApi.createBlock(siteId!, activePageId, {
        block_type: def.type, label: def.label,
        props: initialProps, style_overrides: {},
        visible: true, visible_on_mobile: true, visible_on_tablet: true, visible_on_desktop: true,
        sort_order,
      } as any)
      // Replace temp block with real saved block
      setLocalBlocks(prev => ({
        ...prev,
        [activePageId]: (prev[activePageId] || []).map(b => b.id === tempId ? saved : b),
      }))
      setSelectedBlockId(saved.id)
      toast.success(`${def.label} added`)
    } catch {
      // Roll back
      setLocalBlocks(prev => ({
        ...prev,
        [activePageId]: (prev[activePageId] || []).filter(b => b.id !== tempId),
      }))
      setSelectedBlockId(null)
      toast.error('Failed to add block')
    }
  }, [activePageId, localBlocks, siteId])

  // Preview-only update — instant canvas update, no API call (used while typing)
  const handlePreviewBlockProps = useCallback((blockId: string, propsUpdate: Partial<BlockProps>) => {
    if (!activePageId) return
    setLocalBlocks(prev => {
      const blocks = prev[activePageId] || []
      const block = blocks.find(b => b.id === blockId)
      if (!block) return prev
      const mergedProps = { ...block.props, ...propsUpdate }
      return {
        ...prev,
        [activePageId]: blocks.map(b => b.id === blockId ? { ...b, props: mergedProps } : b),
      }
    })
  }, [activePageId])

  // Update block props — immediate UI; server sync on explicit Save
  const handleUpdateBlockProps = useCallback((blockId: string, propsUpdate: Partial<BlockProps>) => {
    if (!activePageId) return
    scheduleEditorHistorySnapshot()
    setBlocksDirty(true)
    setLocalBlocks(prev => {
      const blocks = prev[activePageId] || []
      const block = blocks.find(b => b.id === blockId)
      if (!block) return prev
      const mergedProps: BlockProps = { ...block.props, ...propsUpdate }
      const topLevel: Partial<WebsiteBlock> = {}
      const TOP_KEYS = ['visible', 'visible_on_mobile', 'visible_on_tablet', 'visible_on_desktop', 'animation', 'animation_delay'] as const
      TOP_KEYS.forEach(k => {
        if (k in propsUpdate) {
          (topLevel as any)[k] = (propsUpdate as any)[k]
          delete (mergedProps as any)[k]
        }
      })
      return {
        ...prev,
        [activePageId]: blocks.map(b =>
          b.id === blockId ? { ...b, props: mergedProps, ...topLevel } : b,
        ),
      }
    })
  }, [activePageId, scheduleEditorHistorySnapshot])

  // ── Image / media apply ───────────────────────────────────────────────────
  // Top-level image field for simple blocks
  const BLOCK_IMAGE_FIELD: Record<string, string> = {
    hero: 'bg_image_url', hero_split: 'bg_image_url', hero_minimal: 'bg_image_url',
    nav: 'brand_logo',
    about_split: 'image_url', about_timeline: 'image_url',
    image_block: 'image_url',
    video_embed: 'thumbnail_url',
    product_grid: 'cover_image_url',
    cta: 'bg_image_url',
  }
  // Array-item blocks: apply image to first item (or add one)
  const BLOCK_ARRAY_IMAGE: Record<string, { arrayKey: string; itemField: string; defaultTitle?: string }> = {
    team_grid:            { arrayKey: 'members',      itemField: 'avatar_url',  defaultTitle: 'Team Member' },
    team_list:            { arrayKey: 'members',      itemField: 'avatar_url',  defaultTitle: 'Team Member' },
    testimonials:         { arrayKey: 'testimonials', itemField: 'avatar_url',  defaultTitle: 'Customer' },
    testimonials_grid:    { arrayKey: 'testimonials', itemField: 'avatar_url',  defaultTitle: 'Customer' },
    features:             { arrayKey: 'features',     itemField: 'image_url',   defaultTitle: 'Feature' },
    features_alternating: { arrayKey: 'features',     itemField: 'image_url',   defaultTitle: 'Feature' },
    services_cards:       { arrayKey: 'features',     itemField: 'image_url',   defaultTitle: 'Service' },
    services_list:        { arrayKey: 'features',     itemField: 'image_url',   defaultTitle: 'Service' },
    trust_logos:          { arrayKey: 'logos',        itemField: 'image_url',   defaultTitle: 'Partner' },
    partner_logos:        { arrayKey: 'logos',        itemField: 'image_url',   defaultTitle: 'Partner' },
    gallery_masonry:      { arrayKey: 'images',       itemField: 'src' },
    gallery_grid:         { arrayKey: 'images',       itemField: 'src' },
    image_gallery:        { arrayKey: 'images',       itemField: 'src' },
    portfolio_grid:       { arrayKey: 'projects',     itemField: 'image_url',   defaultTitle: 'Project' },
    category_cards:       { arrayKey: 'categories',   itemField: 'image_url',   defaultTitle: 'Category' },
    blog_grid:            { arrayKey: 'posts',        itemField: 'image_url',   defaultTitle: 'Post' },
    blog_featured:        { arrayKey: 'posts',        itemField: 'image_url',   defaultTitle: 'Post' },
    blog_list:            { arrayKey: 'posts',        itemField: 'image_url',   defaultTitle: 'Post' },
    menu_grid:            { arrayKey: 'categories',   itemField: 'image_url',   defaultTitle: 'Category' },
    menu_list:            { arrayKey: 'categories',   itemField: 'image_url',   defaultTitle: 'Category' },
    pricing:              { arrayKey: 'plans',        itemField: 'image_url',   defaultTitle: 'Plan' },
  }

  const applyMediaUrlToSelection = useCallback((url: string) => {
    if (!selectedBlock || !activePageId) {
      toast.error('Select a block first')
      return
    }

    // 1) Overlay image target (drag-and-drop canvas layer)
    if (overlayImageTarget && overlayImageTarget.blockId === selectedBlock.id) {
      const overlays = ((selectedBlock.props as any).overlays as BlockOverlayItem[]) || []
      const target = overlays.find(o => o.id === overlayImageTarget.overlayId && o.type === 'image')
      if (target) {
        handleUpdateBlockProps(selectedBlock.id, {
          overlays: overlays.map(o => o.id === overlayImageTarget.overlayId ? { ...o, src: url } : o),
        } as any)
        toast.success('Image applied to layer!')
        return
      }
    }

    // 2) Array-item blocks (testimonials, team, features, gallery, etc.)
    const arrayCfg = BLOCK_ARRAY_IMAGE[selectedBlock.block_type]
    if (arrayCfg) {
      const arr: any[] = ((selectedBlock.props as any)[arrayCfg.arrayKey] as any[] | undefined) || []
      if (arr.length > 0) {
        // Apply to first item; user can reorder/select in Props panel
        const updated = arr.map((item, idx) =>
          idx === 0 ? { ...item, [arrayCfg.itemField]: url } : item)
        handleUpdateBlockProps(selectedBlock.id, { [arrayCfg.arrayKey]: updated } as any)
        toast.success(`Image applied to first item. Use Properties → Items to update others.`)
      } else {
        // No items yet — create one with the image
        const newItem: Record<string, any> = { [arrayCfg.itemField]: url }
        if (arrayCfg.defaultTitle) newItem.title = arrayCfg.defaultTitle
        if (arrayCfg.itemField === 'avatar_url') newItem.name = arrayCfg.defaultTitle || 'Person'
        if (arrayCfg.itemField === 'src') delete newItem.title
        handleUpdateBlockProps(selectedBlock.id, { [arrayCfg.arrayKey]: [newItem] } as any)
        toast.success('Image added as new item.')
      }
      return
    }

    // 3) Simple top-level field
    const field = BLOCK_IMAGE_FIELD[selectedBlock.block_type]
      ?? (selectedBlock.block_type.includes('hero') || selectedBlock.block_type.includes('banner')
          ? 'bg_image_url'
          : 'image_url')
    handleUpdateBlockProps(selectedBlock.id, { [field]: url } as any)
    toast.success('Image applied to block!')
  }, [selectedBlock, activePageId, overlayImageTarget, handleUpdateBlockProps])

  const uploadImageFileToSelection = useCallback(async (file: File) => {
    if (!siteId) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please use an image file (JPG, PNG, WebP, …)')
      return
    }
    if (!selectedBlock) {
      toast.error('Select a block on the canvas first')
      return
    }
    try {
      const saved = await overlayLayerUpload.mutateAsync(file)
      applyMediaUrlToSelection(saved.original_url)
    } catch {
      toast.error('Upload failed — try a smaller file or check your connection')
    }
  }, [siteId, selectedBlock, overlayLayerUpload, applyMediaUrlToSelection])

  const openOverlayImageFilePicker = useCallback(() => {
    overlayImageUploadRef.current?.click()
  }, [])

  const handleOverlayImageFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await uploadImageFileToSelection(file)
  }, [uploadImageFileToSelection])

  // Delete block — optimistic, with arm-then-confirm UX
  // First call arms the confirmation; second call (or context-menu path with
  // `force=true`) actually deletes. The arm auto-expires after 2.5 s.
  const handleDeleteBlock = useCallback(async (blockId: string, force = false) => {
    if (!activePageId) return

    if (!force && armedDeleteId !== blockId) {
      // Arm: show red confirm state on the button
      if (armedDeleteTimer.current) clearTimeout(armedDeleteTimer.current)
      setArmedDeleteId(blockId)
      armedDeleteTimer.current = setTimeout(() => setArmedDeleteId(null), 2500)
      return
    }

    // Confirmed — actually delete
    if (armedDeleteTimer.current) clearTimeout(armedDeleteTimer.current)
    setArmedDeleteId(null)

    const backup = localBlocks[activePageId] || []
    pushHistory(localBlocks)
    const next = { ...localBlocks, [activePageId]: backup.filter(b => b.id !== blockId) }
    setLocalBlocks(next)
    if (selectedBlockId === blockId) setSelectedBlockId(null)
    try {
      await websiteApi.deleteBlock(siteId!, activePageId, blockId)
      toast.success('Block deleted — Ctrl+Z to undo')
    } catch {
      setLocalBlocks(prev => ({ ...prev, [activePageId]: backup }))
      toast.error('Delete failed — try again')
    }
  }, [activePageId, localBlocks, siteId, selectedBlockId, armedDeleteId])

  // Duplicate block — optimistic
  const handleDuplicateBlock = useCallback(async (blockId: string) => {
    if (!activePageId) return
    const original = (localBlocks[activePageId] || []).find(b => b.id === blockId)
    if (!original) return
    const tempId = `temp-dup-${Date.now()}`
    const dupBlock = { ...original, id: tempId, sort_order: original.sort_order + 0.5 }
    setLocalBlocks(prev => ({
      ...prev,
      [activePageId]: [...(prev[activePageId] || []), dupBlock].map((b, i) => ({ ...b, sort_order: i })),
    }))
    setSelectedBlockId(tempId)
    try {
      const saved = await websiteApi.duplicateBlock(siteId!, activePageId, blockId)
      setLocalBlocks(prev => ({
        ...prev,
        [activePageId]: (prev[activePageId] || []).map(b => b.id === tempId ? saved : b),
      }))
      setSelectedBlockId(saved.id)
      toast.success('Block duplicated')
    } catch {
      setLocalBlocks(prev => ({
        ...prev,
        [activePageId]: (prev[activePageId] || []).filter(b => b.id !== tempId),
      }))
      toast.error('Failed to duplicate')
    }
  }, [activePageId, localBlocks, siteId])

  // ── Open link editor for a block prop (e.g. hero cta_primary) ──────────────
  const openLinkEditorForProp = useCallback((blockId: string, propKey: string, anchor: { x: number; y: number }) => {
    if (!activePageId) return
    const block = (localBlocks[activePageId] || []).find(b => b.id === blockId)
    if (!block) return
    const p = block.props as any
    const resolved = (() => {
      if (propKey === 'cta_label' || propKey === 'cta_url') {
        return { labelPropKey: 'cta_label', urlKey: 'cta_url', metaKey: 'cta' }
      }
      if (propKey.endsWith('_url')) {
        const labelPropKey = propKey.replace(/_url$/, '')
        return { labelPropKey, urlKey: propKey, metaKey: labelPropKey }
      }
      return { labelPropKey: propKey, urlKey: `${propKey}_url`, metaKey: propKey }
    })()
    const { labelPropKey, urlKey, metaKey } = resolved
    const typeKey = `${metaKey}_link_type`
    const legacyTypeKey = `${labelPropKey}_link_type`
    const labelKey = `${metaKey}_link_label`
    const legacyLabelKey = `${labelPropKey}_link_label`
    const newTabKey = `${metaKey}_link_new_tab`
    const legacyNewTabKey = `${labelPropKey}_link_new_tab`
    // Use the actual CTA button text (propKey) as the authoritative label so
    // the link editor and the inline text field always start from the same value.
    const currentValue: LinkValue = {
      type: (p?.[typeKey] as OverlayLinkType) || (p?.[legacyTypeKey] as OverlayLinkType) || (p?.[urlKey] ? 'url' : 'none'),
      target: p?.[urlKey] || '',
      label: (p?.[labelPropKey] as string) || (p?.[labelKey] as string) || (p?.[legacyLabelKey] as string) || '',
      openInNewTab: !!(p?.[newTabKey] ?? p?.[legacyNewTabKey]),
    }
    setLinkEditor({
      anchor,
      value: currentValue,
      save: (v) => {
        handleUpdateBlockProps(blockId, {
          [urlKey]: v.target,
          [typeKey]: v.type,
          // Write label back to both the button text prop AND the link label
          ...(v.label && p?.[labelPropKey] !== undefined ? { [labelPropKey]: v.label } : {}),
          ...(v.label ? { [labelKey]: v.label } : {}),
          [newTabKey]: v.openInNewTab,
        } as any)
      },
    })
  }, [activePageId, localBlocks, handleUpdateBlockProps])

  // ── Open link editor for an overlay item (button / text / image / badge) ───
  const openLinkEditorForOverlay = useCallback((blockId: string, item: BlockOverlayItem, anchor: { x: number; y: number }) => {
    if (!activePageId) return
    // Use item.text as the authoritative button label so the link editor
    // and the "Edit button text" popup always start from the same value.
    const currentValue: LinkValue = {
      type: item.linkType || (item.href ? 'url' : 'none'),
      target: item.linkTarget || item.href || '',
      label: item.text || item.linkLabel || '',
      openInNewTab: !!item.openInNewTab,
    }
    setLinkEditor({
      anchor,
      value: currentValue,
      save: (v) => {
        const block = (localBlocks[activePageId] || []).find(b => b.id === blockId)
        if (!block) return
        const overlays: BlockOverlayItem[] = ((block.props as any).overlays as BlockOverlayItem[]) || []
        const next = overlays.map(o => o.id === item.id ? {
          ...o,
          linkType: v.type,
          linkTarget: v.target,
          // Keep text (displayed label) and linkLabel in sync
          text: v.label || o.text,
          linkLabel: v.label || o.linkLabel,
          href: v.target,
          openInNewTab: v.openInNewTab,
        } : o)
        handleUpdateBlockProps(blockId, { overlays: next } as any)
      },
    })
  }, [activePageId, localBlocks, handleUpdateBlockProps])

  // ── Context menus ────────────────────────────────────────────────────────
  // Opened via right-click on either a canvas block or an overlay element.

  // Primary text field for each block type (used by "Edit content" context menu action)
  const BLOCK_PRIMARY_TEXT: Record<string, { field: string; label: string; multiline?: boolean }> = {
    hero: { field: 'headline', label: 'Headline' },
    hero_split: { field: 'headline', label: 'Headline' },
    hero_minimal: { field: 'headline', label: 'Headline' },
    cta: { field: 'headline', label: 'Headline' },
    announcement_bar: { field: 'text', label: 'Message' },
    marquee_strip: { field: 'text', label: 'Marquee (comma-separated)', multiline: true },
    footer: { field: 'copyright', label: 'Copyright' },
    rich_text: { field: 'content', label: 'Content', multiline: true },
    image_block: { field: 'caption', label: 'Caption' },
    nav: { field: 'brand', label: 'Brand Name' },
  }
  const getBlockPrimaryText = (bt: string) =>
    BLOCK_PRIMARY_TEXT[bt] ?? { field: 'title', label: 'Title' }

  const openBlockContextMenu = useCallback((block: WebsiteBlock, e: React.MouseEvent) => {
    setSelectedBlockId(block.id)
    const suggested = BLOCK_AUTO_SOURCE[block.block_type as string]
    const rawDs = (block.props as any)?.data_source
    const dsType = normalizeSourceType(rawDs?.type)
    const dsLabel = dsType ? DATA_SOURCES.find(s => s.id === dsType)?.label : null
    const actions: ContextMenuAction[] = [
      {
        id: 'edit',
        label: 'Edit content',
        icon: Pencil,
        onSelect: () => {
          setRightPanel('props')
          setRightCollapsed(false)
          // Open the styled text prompt so the user can immediately type
          const { field, label, multiline } = getBlockPrimaryText(block.block_type)
          const currentVal = ((block.props as any)[field] ?? '') as string
          openTextPrompt({
            title: `Edit ${block.label || block.block_type}`,
            subtitle: `Field: ${label}`,
            placeholder: `Type your ${label.toLowerCase()}…`,
            initialValue: currentVal,
            multiline,
            confirmLabel: 'Save',
            onSave: v => handleUpdateBlockProps(block.id, { [field]: v } as any),
          })
        },
      },
      {
        id: 'style',
        label: 'Style / design',
        icon: Palette,
        onSelect: () => { setRightPanel('style'); setRightCollapsed(false) },
      },
      dsType ? {
        id: 'data',
        label: `Connected → ${dsLabel}`,
        icon: Database,
        onSelect: () => { setRightPanel('data'); setRightCollapsed(false) },
      } : (suggested ? {
        id: 'connect',
        label: `⚡ Connect to ${DATA_SOURCES.find(s => s.id === suggested)?.label}`,
        icon: Plug,
        onSelect: () => {
          handleUpdateBlockProps(block.id, { data_source: { type: suggested, auto: true } } as any)
          toast.success(`Connected to ${DATA_SOURCES.find(s => s.id === suggested)?.label}`)
        },
      } : {
        id: 'data-picker',
        label: 'Connect to live data…',
        icon: Database,
        onSelect: () => { setRightPanel('data'); setRightCollapsed(false) },
      }),
      { id: 'div1', label: '', divider: true },
      {
        id: 'media',
        label: 'Add image / media',
        icon: ImageIcon,
        onSelect: () => { setRightPanel('media'); setRightCollapsed(false) },
      },
      {
        id: 'ai',
        label: 'AI tools (text/image)',
        icon: Sparkles,
        onSelect: () => { setRightPanel('ai'); setRightCollapsed(false) },
      },
      { id: 'div2', label: '', divider: true },
      {
        id: 'up',
        label: 'Move up',
        icon: ChevronUp,
        shortcut: '↑',
        onSelect: () => handleMoveBlock(block.id, 'up'),
      },
      {
        id: 'down',
        label: 'Move down',
        icon: ChevronDown,
        shortcut: '↓',
        onSelect: () => handleMoveBlock(block.id, 'down'),
      },
      {
        id: 'dup',
        label: 'Duplicate',
        icon: Copy,
        shortcut: 'Ctrl+D',
        onSelect: () => handleDuplicateBlock(block.id),
      },
      {
        id: 'toggle',
        label: block.visible === false ? 'Show block' : 'Hide block',
        icon: block.visible === false ? Eye : EyeOff,
        onSelect: () => handleUpdateBlockProps(block.id, { visible: !(block.visible !== false) } as any),
      },
      { id: 'div3', label: '', divider: true },
      {
        id: 'delete',
        label: 'Delete block',
        icon: Trash2,
        shortcut: 'Del',
        danger: true,
        onSelect: () => handleDeleteBlock(block.id, true),
      },
    ]
    setContextMenu({ x: e.clientX, y: e.clientY, actions })
  }, [handleUpdateBlockProps, handleDeleteBlock, handleDuplicateBlock, openTextPrompt])

  const openOverlayContextMenu = useCallback((blockId: string, item: BlockOverlayItem, e: React.MouseEvent) => {
    if (!activePageId) return
    const isLinkable = item.type === 'button' || item.type === 'badge' || item.type === 'text' || item.type === 'image'
    const actions: ContextMenuAction[] = [
      ...(item.type === 'text' || item.type === 'button' || item.type === 'badge' ? [{
        id: 'edit-text',
        label: 'Edit text…',
        icon: Pencil,
        onSelect: () => {
          openTextPrompt({
            title: `Edit ${item.type} text`,
            placeholder: item.type === 'button' ? 'e.g. Book Now' : item.type === 'badge' ? 'e.g. NEW' : 'Type your text…',
            initialValue: item.text || '',
            multiline: item.type === 'text',
            anchor: { x: e.clientX, y: e.clientY },
            onSave: v => {
              const block = (localBlocks[activePageId] || []).find(b => b.id === blockId)
              if (!block) return
              const overlays: BlockOverlayItem[] = ((block.props as any).overlays as BlockOverlayItem[]) || []
              handleUpdateBlockProps(blockId, {
                overlays: overlays.map(o => o.id === item.id ? { ...o, text: v } : o),
              } as any)
            },
          })
        },
      }] : []),
      ...(isLinkable ? [{
        id: 'link',
        label: item.linkType && item.linkType !== 'none' ? `Edit link (${item.linkType})` : 'Connect to link / ERP item',
        icon: Link2,
        onSelect: () => openLinkEditorForOverlay(blockId, item, { x: e.clientX, y: e.clientY }),
      }] : []),
      ...((item.type === 'button' || item.type === 'badge') ? [{
        id: 'describe',
        label: item.description ? 'Edit description…' : 'Add description…',
        icon: FileText,
        onSelect: () => {
          openTextPrompt({
            title: 'Button description',
            subtitle: 'Shown as tooltip on hover and used for screen-reader labels (aria-label).',
            placeholder: 'Book a table for 4 guests',
            initialValue: item.description || '',
            multiline: true,
            maxLength: 160,
            anchor: { x: e.clientX, y: e.clientY },
            onSave: v => {
              const block = (localBlocks[activePageId] || []).find(b => b.id === blockId)
              if (!block) return
              const overlays: BlockOverlayItem[] = ((block.props as any).overlays as BlockOverlayItem[]) || []
              handleUpdateBlockProps(blockId, {
                overlays: overlays.map(o => o.id === item.id ? { ...o, description: v } : o),
              } as any)
            },
          })
        },
      }] : []),
      ...(item.type === 'image' ? [{
        id: 'replace-img',
        label: 'Replace image…',
        icon: ImageIcon,
        onSelect: () => {
          openTextPrompt({
            title: 'Replace image',
            subtitle: 'Paste a direct image URL — or close and use AI / Media library instead.',
            placeholder: 'https://…/image.jpg',
            initialValue: item.src || '',
            anchor: { x: e.clientX, y: e.clientY },
            onSave: v => {
              if (!v) return
              const block = (localBlocks[activePageId] || []).find(b => b.id === blockId)
              if (!block) return
              const overlays: BlockOverlayItem[] = ((block.props as any).overlays as BlockOverlayItem[]) || []
              handleUpdateBlockProps(blockId, {
                overlays: overlays.map(o => o.id === item.id ? { ...o, src: v } : o),
              } as any)
            },
          })
        },
      }] : []),
      { id: 'div1', label: '', divider: true },
      {
        id: 'bring-front',
        label: 'Bring to front',
        icon: ChevronUp,
        onSelect: () => {
          const block = (localBlocks[activePageId] || []).find(b => b.id === blockId)
          if (!block) return
          const overlays: BlockOverlayItem[] = ((block.props as any).overlays as BlockOverlayItem[]) || []
          const maxZ = Math.max(10, ...overlays.map(o => o.zIndex || 10))
          handleUpdateBlockProps(blockId, {
            overlays: overlays.map(o => o.id === item.id ? { ...o, zIndex: maxZ + 1 } : o),
          } as any)
        },
      },
      {
        id: 'send-back',
        label: 'Send to back',
        icon: ChevronDown,
        onSelect: () => {
          const block = (localBlocks[activePageId] || []).find(b => b.id === blockId)
          if (!block) return
          const overlays: BlockOverlayItem[] = ((block.props as any).overlays as BlockOverlayItem[]) || []
          const minZ = Math.min(10, ...overlays.map(o => o.zIndex || 10))
          handleUpdateBlockProps(blockId, {
            overlays: overlays.map(o => o.id === item.id ? { ...o, zIndex: minZ - 1 } : o),
          } as any)
        },
      },
      {
        id: 'dup-overlay',
        label: 'Duplicate',
        icon: Copy,
        onSelect: () => {
          const block = (localBlocks[activePageId] || []).find(b => b.id === blockId)
          if (!block) return
          const overlays: BlockOverlayItem[] = ((block.props as any).overlays as BlockOverlayItem[]) || []
          const copy: BlockOverlayItem = {
            ...item,
            id: `ov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            x: item.x + 16,
            y: item.y + 16,
          }
          handleUpdateBlockProps(blockId, { overlays: [...overlays, copy] } as any)
        },
      },
      { id: 'div2', label: '', divider: true },
      {
        id: 'delete',
        label: 'Delete element',
        icon: Trash2,
        danger: true,
        onSelect: () => {
          const block = (localBlocks[activePageId] || []).find(b => b.id === blockId)
          if (!block) return
          const overlays: BlockOverlayItem[] = ((block.props as any).overlays as BlockOverlayItem[]) || []
          handleUpdateBlockProps(blockId, { overlays: overlays.filter(o => o.id !== item.id) } as any)
        },
      },
    ]
    setContextMenu({ x: e.clientX, y: e.clientY, actions })
  }, [activePageId, localBlocks, handleUpdateBlockProps, openLinkEditorForOverlay, openTextPrompt])

  // Reorder — local only until Save (same as block prop edits)
  const applyReorder = useCallback((reordered: WebsiteBlock[]) => {
    if (!activePageId) return
    pushHistory(JSON.parse(JSON.stringify(localBlocksRef.current)))
    const numbered = reordered.map((b, i) => ({ ...b, sort_order: i }))
    setLocalBlocks(prev => ({ ...prev, [activePageId]: numbered }))
    setBlocksDirty(true)
  }, [activePageId, pushHistory])

  // Drag handlers
  const handleDragStartBlock = (idx: number) => setDraggingBlockIdx(idx)
  const handleDragOverBlock = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setIsDraggingOver(activeBlocks[idx]?.id || null)
  }
  const handleDropOnBlock = useCallback(async (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    setIsDraggingOver(null)
    if (draggingNewBlock) {
      await handleAddBlock(draggingNewBlock, targetIdx)
      setDraggingNewBlock(null)
      return
    }
    if (draggingBlockIdx === null || draggingBlockIdx === targetIdx) { setDraggingBlockIdx(null); return }
    const reordered = [...activeBlocks]
    const [moved] = reordered.splice(draggingBlockIdx, 1)
    reordered.splice(targetIdx, 0, moved)
    await applyReorder(reordered)
    setDraggingBlockIdx(null)
  }, [draggingBlockIdx, draggingNewBlock, activeBlocks, handleAddBlock, applyReorder])

  const handleDropOnCanvas = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(null)
    if (draggingNewBlock) {
      await handleAddBlock(draggingNewBlock)
      setDraggingNewBlock(null)
    }
    setDraggingBlockIdx(null)
  }, [draggingNewBlock, handleAddBlock])

  // Move block up/down — optimistic
  const handleMoveBlock = useCallback(async (blockId: string, dir: 'up' | 'down') => {
    const idx = activeBlocks.findIndex(b => b.id === blockId)
    if (idx < 0) return
    const newIdx = dir === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= activeBlocks.length) return
    const reordered = [...activeBlocks]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(newIdx, 0, moved)
    await applyReorder(reordered)
  }, [activeBlocks, applyReorder])

  // Insert a block after the currently selected block
  const handleAddBlockAfter = useCallback(async (blockType: string) => {
    if (!activePageId) return
    const def = BLOCK_CATALOG.find(d => d.type === blockType)
    if (!def) return
    const currentIdx = activeBlocks.findIndex(b => b.id === selectedBlockId)
    const insertIdx = currentIdx >= 0 ? currentIdx + 1 : activeBlocks.length
    await handleAddBlock(def, insertIdx)
  }, [activePageId, activeBlocks, selectedBlockId, handleAddBlock])

  // Keep keyboard-shortcut ref in sync with latest handlers (avoids TDZ on init)
  kbHandlersRef.current.handleDeleteBlock = handleDeleteBlock
  kbHandlersRef.current.handleDuplicateBlock = handleDuplicateBlock
  kbHandlersRef.current.handleMoveBlock = handleMoveBlock

  const persistAllBlocksToServer = useCallback(async () => {
    if (!siteId) return
    const replacements: { pageId: string; tempId: string; saved: WebsiteBlock }[] = []

    // Persist each page's blocks concurrently; within a page blocks are batched
    // in parallel too (creates and updates fire together, then reorder once).
    await Promise.all(localPages.map(async (page) => {
      const blocks = (localBlocks[page.id] || []).map((b, i) => ({ ...b, sort_order: i }))
      if (!blocks.length) return

      const pageReplacements: { tempId: string; saved: WebsiteBlock }[] = []
      const persistedBlocks: WebsiteBlock[] = []

      // Fire all creates + updates in parallel
      await Promise.all(blocks.map(async (b) => {
        if (b.id.startsWith('temp-')) {
          const saved = await websiteApi.createBlock(siteId, page.id, {
            block_type: b.block_type,
            label: b.label,
            props: b.props,
            style_overrides: b.style_overrides || {},
            visible: b.visible,
            visible_on_mobile: b.visible_on_mobile,
            visible_on_tablet: b.visible_on_tablet,
            visible_on_desktop: b.visible_on_desktop,
            animation: b.animation,
            animation_delay: b.animation_delay,
            sort_order: b.sort_order,
          } as any)
          pageReplacements.push({ tempId: b.id, saved })
          persistedBlocks.push(saved)
        } else {
          await websiteApi.updateBlock(siteId, page.id, b.id, {
            props: b.props,
            style_overrides: b.style_overrides || {},
            label: b.label,
            visible: b.visible,
            visible_on_mobile: b.visible_on_mobile,
            visible_on_tablet: b.visible_on_tablet,
            visible_on_desktop: b.visible_on_desktop,
            animation: b.animation,
            animation_delay: b.animation_delay,
            sort_order: b.sort_order,
          } as any)
          persistedBlocks.push(b)
        }
      }))

      // Reorder after all creates/updates for this page have resolved.
      // Sort by the block's own sort_order so the order is deterministic
      // regardless of which Promise resolved first.
      if (persistedBlocks.length) {
        const ordered = [...persistedBlocks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        await websiteApi.reorderBlocks(
          siteId,
          page.id,
          ordered.map((b, i) => ({ id: b.id, sort_order: i })),
        )
      }

      for (const r of pageReplacements) {
        replacements.push({ pageId: page.id, ...r })
      }
    }))

    if (replacements.length) {
      setLocalBlocks(prev => {
        let next = prev
        for (const { pageId, tempId, saved } of replacements) {
          next = {
            ...next,
            [pageId]: (next[pageId] || []).map(b => b.id === tempId ? saved : b),
          }
        }
        return next
      })
      const selectedReplacement = replacements.find(r => r.tempId === selectedBlockId)
      if (selectedReplacement) setSelectedBlockId(selectedReplacement.saved.id)
    }
  }, [siteId, localPages, localBlocks, selectedBlockId])

  const persistAllPagesToServer = useCallback(async () => {
    if (!siteId) return
    if (localPages.length) {
      await websiteApi.reorderPages(
        siteId,
        localPages.map((page, i) => ({ id: page.id, sort_order: i })),
      )
    }
    for (const [idx, page] of localPages.entries()) {
      await websiteApi.updatePage(siteId, page.id, {
        title: page.title,
        slug: page.slug,
        page_type: page.page_type,
        seo_title: page.seo_title,
        seo_description: page.seo_description,
        og_image_url: page.og_image_url,
        layout: page.layout,
        sort_order: idx,
        is_published: page.is_published !== false,
        is_homepage: !!page.is_homepage,
        show_in_nav: page.show_in_nav !== false,
      } as any)
    }
  }, [siteId, localPages])

  // Save styles + all pending block edits / order
  const handleSaveCanvas = useCallback(async () => {
    if (isSaving) return
    if (!styleDirty && !blocksDirty) return
    if (!siteId) return
    const saveBlocks = blocksDirty
    const saveStyle = styleDirty
    setIsSaving(true)
    try {
      if (saveBlocks) await persistAllBlocksToServer()
      if (saveStyle) await websiteApi.updateSite(siteId, { style_config: localStyle as any })
      setStyleDirty(false)
      setBlocksDirty(false)
      setLastSavedAt(new Date())
      setSaveFlash(true)
      setTimeout(() => setSaveFlash(false), 1800)
      toast.success(saveBlocks && saveStyle ? 'Canvas and styles saved' : saveBlocks ? 'Canvas saved' : 'Styles saved')
    } catch {
      toast.error('Save failed — check your connection')
    }
    setIsSaving(false)
  }, [siteId, localStyle, isSaving, styleDirty, blocksDirty, persistAllBlocksToServer])

  /** Save current canvas + publish to make the loaded template live on the store. */
  const handleApplyToStore = useCallback(async () => {
    if (!siteId || isApplyingToStore) return
    setIsApplyingToStore(true)
    try {
      // Only persist if there are pending local changes — avoids redundant API
      // calls when the user clicks Apply immediately after loading a template.
      if (blocksDirty || localPages.some(p => p.id && !p.id.startsWith('temp-'))) {
        await persistAllPagesToServer()
      }
      if (blocksDirty) {
        await persistAllBlocksToServer()
      }
      if (styleDirty) {
        await websiteApi.updateSite(siteId, { style_config: localStyle as any })
      }
      await websiteApi.publishSite(siteId)
      await queryClient.invalidateQueries({ queryKey: ['websites', siteId] })
      await queryClient.invalidateQueries({ queryKey: ['websites'], exact: true })
      setStyleDirty(false)
      setBlocksDirty(false)
      blocksDirtyRef.current = false
      styleDirtyRef.current = false
      setLastSavedAt(new Date())
      setSaveFlash(true)
      setTimeout(() => setSaveFlash(false), 1800)
      toast.success(`✅ Applied — your business front is now live with ${localPages.length} page${localPages.length !== 1 ? 's' : ''}.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Apply failed: ${msg}`)
      console.error('[Apply to Store]', err)
    } finally {
      setIsApplyingToStore(false)
    }
  }, [siteId, isApplyingToStore, blocksDirty, styleDirty, persistAllPagesToServer, persistAllBlocksToServer, localStyle, localPages, queryClient])

  // Add page — optimistic (uses styled prompt)
  const handleAddPage = useCallback(() => {
    openTextPrompt({
      title: 'Create new page',
      subtitle: 'This page is added to your site\'s navigation. You can reorder and rename it later.',
      placeholder: 'e.g. About Us, Services, Contact…',
      confirmLabel: 'Create page',
      onSave: async (title) => {
        if (!title?.trim()) return
        const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        try {
          const page = await websiteApi.createPage(siteId!, { title, slug, page_type: 'custom', sort_order: localPages.length } as any)
          setLocalPages(prev => [...prev, page])
          setLocalBlocks(prev => ({ ...prev, [page.id]: [] }))
          setActivePageId(page.id)
          toast.success('Page created')
        } catch { toast.error('Failed to create page') }
      },
    })
  }, [siteId, localPages, openTextPrompt])

  // Delete page
  const handleDeletePage = useCallback((pageId: string, pageTitle: string) => {
    openTextPrompt({
      title: `Delete "${pageTitle}"?`,
      subtitle: 'This will permanently remove the page and all its blocks. This cannot be undone.',
      placeholder: '',
      confirmLabel: 'Delete page',
      onSave: async () => {
        const backup = localPages
        setLocalPages(prev => prev.filter(p => p.id !== pageId))
        if (activePageId === pageId) {
          const remaining = localPages.filter(p => p.id !== pageId)
          setActivePageId(remaining[0]?.id || null)
        }
        try {
          await websiteApi.deletePage(siteId!, pageId)
          toast.success('Page deleted')
        } catch {
          setLocalPages(backup)
          toast.error('Failed to delete page')
        }
      },
    })
  }, [siteId, localPages, activePageId, openTextPrompt])

  // ── Preflight check before first publish ────────────────────────────────────
  const [preflightOpen, setPreflightOpen] = useState(false)

  const runPreflight = () => {
    const issues: string[] = []
    const allBlocks = Object.values(localBlocks).flat()

    if (!site?.seo_title && !site?.name) issues.push('Missing site title — set it in SEO tab')
    if (!site?.seo_description) issues.push('Missing meta description — set it in SEO tab')
    if (!site?.favicon_url) issues.push('No favicon uploaded — add one in Site settings')

    const hasHomepage = localPages.some(p => p.is_homepage)
    if (!hasHomepage) issues.push('No homepage set — mark a page as home in Pages panel')

    localPages.forEach(page => {
      const pageBlocks = localBlocks[page.id] || []
      if (pageBlocks.length === 0) issues.push(`Page "${page.title}" has no blocks — add content or delete the page`)
      if (!page.seo_description) issues.push(`Page "${page.title}" is missing a meta description`)
    })

    const images = allBlocks.flatMap(b => {
      const p = b.props as any
      return [p.image_url, p.hero_image, p.bg_image_url].filter(Boolean)
    })
    const imgsWithoutAlt = images.filter(() => false) // alt is embedded in block props; skip for now

    if (!allBlocks.some(b => b.block_type === 'nav')) issues.push('No Navigation block — visitors won\'t have a menu')
    if (!allBlocks.some(b => b.block_type === 'footer')) issues.push('No Footer block — add contact/copyright info')

    return issues
  }

  // Publish
  const handlePublish = async () => {
    const wasPublished = site?.is_published

    // Run preflight for first publish
    if (!wasPublished) {
      const issues = runPreflight()
      if (issues.length > 0) {
        setPreflightOpen(true)
        return
      }
    }

    // Save any pending canvas / style changes before publishing so the live
    // site always reflects what the user sees in the builder.
    if (styleDirty || blocksDirty) {
      try {
        await persistAllPagesToServer()
        await persistAllBlocksToServer()
        if (styleDirty) await websiteApi.updateSite(siteId!, { style_config: localStyle as any })
        setStyleDirty(false)
        setBlocksDirty(false)
        setLastSavedAt(new Date())
      } catch {
        toast.error('Could not save changes before publishing — fix the connection and try again.')
        return
      }
    }

    try {
      await (wasPublished ? unpublishSite : publishSite).mutateAsync()
      invalidateSite()
      if (wasPublished) {
        toast.success('Site unpublished — visitors will no longer see it.')
      } else if (siteTestUrl) {
        toast.success(
          <span className="flex flex-col gap-1">
            <span className="font-semibold">🎉 Site published!</span>
            <span className="text-xs flex items-center gap-1.5">
              <span className="text-primary/50 font-mono">{siteTestUrl}</span>
              <button
                className="underline text-white"
                onClick={async () => { await navigator.clipboard.writeText(siteTestUrl).catch(() => {}); toast.success('URL copied!') }}
              >
                Copy
              </button>
              <a href={siteTestUrl} target="_blank" rel="noopener noreferrer" className="underline text-white">Open ↗</a>
            </span>
          </span>,
          { duration: 8000 }
        )
      } else {
        toast.success('Site published! Set a subdomain to get the live URL.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(`Publish failed: ${msg}`)
      console.error('[Publish]', err)
    }
  }

  // Store test URL — business front /store/:slug resolves vendors via GET /catalog/vendor/{slug} (Vendor.slug),
  // not wb_sites.subdomain. In dev, always use the logged-in vendor's catalog slug so links don't 404.
  const vendorCatalogSlug = myVendor?.slug?.trim() ?? null
  const siteTestUrl = site
    ? site.custom_domain
      ? `https://${site.custom_domain}`
      : shouldUseLocalStorefrontUrls()
        ? (vendorCatalogSlug
            ? `${getStorefrontAppOrigin()}/store/${encodeURIComponent(vendorCatalogSlug)}`
            : null)
        : site.subdomain
          ? `https://${site.subdomain.trim()}.kiterp.com`
          : null
    : null

  const handleViewStore = useCallback(async () => {
    if (siteTestUrl) {
      setStorePopover(v => !v)
    } else {
      openTextPrompt({
        title: 'Set a test domain',
        subtitle: 'Your store will be live at {subdomain}.kiterp.com',
        placeholder: 'my-store-name',
        confirmLabel: 'Save & Get Link',
        onSave: async (sub) => {
          if (!sub?.trim()) return
          const slug = sub.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
          try {
            await updateSite.mutateAsync({ subdomain: slug } as any)
            const v = await vendorApi.getMyVendor().catch(() => null)
            const catalogSlug = v?.slug?.trim() || slug
            const url = shouldUseLocalStorefrontUrls()
              ? `${getStorefrontAppOrigin()}/store/${encodeURIComponent(catalogSlug)}`
              : `https://${slug}.kiterp.com`
            await navigator.clipboard.writeText(url).catch(() => {})
            toast.success(`Test link ready — ${url}`)
          } catch {
            toast.error('Could not set subdomain — it may already be taken')
          }
        },
      })
    }
  }, [siteTestUrl, openTextPrompt, updateSite])

  const handleOpenBrowserPreview = useCallback(async () => {
    if (!siteId || !site) return
    // /store/:vendorSlug must match Vendor.slug (catalog), never wb_sites.subdomain alone.
    let vendorSlug = myVendor?.slug?.trim() ?? ''
    if (!vendorSlug) {
      try {
        const v = await vendorApi.getMyVendor()
        vendorSlug = v.slug?.trim() ?? ''
      } catch {
        /* noop */
      }
    }
    if (!vendorSlug) {
      toast.error('Could not resolve your vendor store slug. Open the dashboard home once, then try again.')
      return
    }
    setOpeningBrowserPreview(true)
    try {
      const payload = buildPublicSitePayloadFromLocal(site, localPages, localBlocks, localStyle)
      const { preview_token } = await websiteApi.createBuilderPreview(siteId, {
        payload,
        label: `Preview ${new Date().toLocaleString()}`,
      })
      const url = buildBuilderDraftPreviewUrl(vendorSlug, preview_token, activePage?.slug)
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) toast.error('Pop-up blocked — allow pop-ups to open the draft preview.')
    } catch (err) {
      console.error('[BrowserPreview] failed:', err)
      // When the API DB has no wb_builder_previews table, still open something useful if we have a business front URL.
      if (siteTestUrl && isBuilderPreviewInfraFailure(err)) {
        const pageSlug = activePage?.slug?.trim()
        const path =
          pageSlug && pageSlug.length > 0 && pageSlug.toLowerCase() !== 'home'
            ? `/${pageSlug.replace(/^\/+/, '')}`
            : ''
        const fallbackUrl = `${String(siteTestUrl).replace(/\/$/, '')}${path}`
        const opened = window.open(fallbackUrl, '_blank', 'noopener,noreferrer')
        if (opened) {
          toast.warning(
            'Draft snapshot preview is not available on this server (run alembic upgrade web006 on the database your API uses, then restart the API). Opened your published business front instead — click Save first if you need the latest edits there.',
          )
        } else {
          toast.error('Pop-up blocked — allow pop-ups to open the business front.')
        }
      } else {
        toast.error(extractApiError(err, 'Browser preview'))
      }
    } finally {
      setOpeningBrowserPreview(false)
    }
  }, [siteId, site, myVendor, localPages, localBlocks, localStyle, activePage, siteTestUrl])

  const startStorefrontOverlayPreview = useCallback(async () => {
    if (!siteId || !site) {
      setSfOverlayBlockFallback(true)
      setSfOverlayLoading(false)
      return
    }
    setSfOverlayLoading(true)
    setSfOverlayBlockFallback(false)
    setSfOverlayPublishedFallback(false)
    setSfOverlayToken(null)
    setSfOverlayVendorSlug(null)
    let vendorSlug = myVendor?.slug?.trim() ?? ''
    if (!vendorSlug) {
      try {
        const v = await vendorApi.getMyVendor()
        vendorSlug = v.slug?.trim() ?? ''
      } catch {
        /* noop */
      }
    }
    if (!vendorSlug) {
      toast.error('Could not resolve your vendor store slug.')
      setSfOverlayBlockFallback(true)
      setSfOverlayLoading(false)
      return
    }
    try {
      const payload = buildPublicSitePayloadFromLocal(site, localPages, localBlocks, localStyle)
      const { preview_token } = await websiteApi.createBuilderPreview(siteId, {
        payload,
        label: `Builder preview ${new Date().toLocaleString()}`,
      })
      setSfOverlayVendorSlug(vendorSlug)
      setSfOverlayToken(preview_token)
    } catch (err) {
      if (isBuilderPreviewInfraFailure(err)) {
        if (siteTestUrl) {
          setSfOverlayVendorSlug(vendorSlug)
          setSfOverlayPublishedFallback(true)
          toast.warning(
            'Draft snapshot preview is not available on this server. Showing your published business front in the overlay — run DB migrations for builder previews if you need unsaved draft parity.',
          )
        } else {
          setSfOverlayBlockFallback(true)
          toast.warning(
            'Draft preview is not available and no local business front URL is configured — showing builder canvas preview.',
          )
        }
      } else {
        toast.error(extractApiError(err, 'Preview'))
        setSfOverlayBlockFallback(true)
      }
    } finally {
      setSfOverlayLoading(false)
    }
  }, [siteId, site, myVendor?.slug, localPages, localBlocks, localStyle, siteTestUrl])

  const startStorefrontOverlayPreviewRef = useRef(startStorefrontOverlayPreview)
  startStorefrontOverlayPreviewRef.current = startStorefrontOverlayPreview

  useEffect(() => {
    if (!showFullPreview) {
      setSfOverlayToken(null)
      setSfOverlayVendorSlug(null)
      setSfOverlayPublishedFallback(false)
      setSfOverlayBlockFallback(false)
      setSfOverlayLoading(false)
      return
    }
    void startStorefrontOverlayPreviewRef.current()
    // Intentionally only when the overlay opens/closes — avoids refetching on every local edit while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFullPreview])

  const storefrontOverlayIframeSrc = useMemo(() => {
    if (!showFullPreview || sfOverlayBlockFallback || sfOverlayLoading) return null
    if (sfOverlayPublishedFallback && siteTestUrl) {
      const pageSlug = activePage?.slug?.trim()
      const path =
        pageSlug && pageSlug.length > 0 && pageSlug.toLowerCase() !== 'home'
          ? `/${pageSlug.replace(/^\/+/, '')}`
          : ''
      return `${String(siteTestUrl).replace(/\/$/, '')}${path}`
    }
    if (sfOverlayToken && sfOverlayVendorSlug && !sfOverlayPublishedFallback) {
      return buildBuilderDraftPreviewUrl(sfOverlayVendorSlug, sfOverlayToken, activePage?.slug)
    }
    return null
  }, [
    showFullPreview,
    sfOverlayBlockFallback,
    sfOverlayLoading,
    sfOverlayPublishedFallback,
    siteTestUrl,
    sfOverlayToken,
    sfOverlayVendorSlug,
    activePage?.slug,
  ])

  // Update data source on selected block
  const handleUpdateDataSource = useCallback((ds: any) => {
    if (!selectedBlockId || !activePageId) return
    const block = (localBlocks[activePageId] || []).find(b => b.id === selectedBlockId)
    if (!block) return
    handleUpdateBlockProps(selectedBlockId, { data_source: ds } as any)
  }, [selectedBlockId, activePageId, localBlocks, handleUpdateBlockProps])

  // Device widths
  const deviceWidth = device === 'mobile' ? '390px' : device === 'tablet' ? '768px' : '100%'

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary/80" />
      </div>
    )
  }

  if (!site) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-gray-500">Site not found</p>
          <Button className="mt-4" onClick={() => navigate('/websites')}>Back to Sites</Button>
        </div>
      </div>
    )
  }

  const allBlocks = Object.values(localBlocks).flat()
  const connectableBlocks = activeBlocks.filter(b => BLOCK_AUTO_SOURCE[b.block_type as string])
  const disconnectedBlocks = connectableBlocks.filter(b => !normalizeSourceType((b.props as any)?.data_source?.type))
  const hasCommerceBlock = allBlocks.some(b => [
    'product_grid', 'services_cards', 'booking_widget', 'booking_slot_picker',
    'live_quote', 'contact_form', 'checkout_form', 'cart_drawer',
  ].includes(b.block_type as string))
  const seoReady = !!(site.seo_title || site.name) && !!site.seo_description && localPages.every(p => !!p.seo_description)
  const brandReady = !!((site as any).logo_url || (site as any).favicon_url || (site as any).og_image_url)
  const setupItems = [
    {
      id: 'pages',
      label: 'Pages',
      desc: `${localPages.length} page${localPages.length !== 1 ? 's' : ''}`,
      done: localPages.length > 0,
      icon: FileText,
      action: () => { setLeftPanel('pages'); setLeftCollapsed(false) },
    },
    {
      id: 'commerce',
      label: 'Store blocks',
      desc: hasCommerceBlock ? 'Sales sections added' : 'Add product/service blocks',
      done: hasCommerceBlock,
      icon: ShoppingCart,
      action: () => { setLeftPanel('blocks'); setBlockCategory('ecommerce'); setLeftCollapsed(false) },
    },
    {
      id: 'data',
      label: 'Live data',
      desc: disconnectedBlocks.length ? `${disconnectedBlocks.length} block${disconnectedBlocks.length !== 1 ? 's' : ''} on this page not connected` : 'Current page connected',
      done: disconnectedBlocks.length === 0,
      icon: Database,
      action: () => {
        if (disconnectedBlocks.length > 0) {
          disconnectedBlocks.forEach(b => {
            const src = BLOCK_AUTO_SOURCE[b.block_type as string]
            if (src) handleUpdateBlockProps(b.id, { data_source: { type: src, auto: true } } as any)
          })
          toast.success(`Connected ${disconnectedBlocks.length} block${disconnectedBlocks.length !== 1 ? 's' : ''} to live data`)
        } else {
          setRightPanel('data'); setRightCollapsed(false)
        }
      },
    },
    {
      id: 'seo',
      label: 'SEO',
      desc: seoReady ? 'Ready for search' : 'Add title/descriptions',
      done: seoReady,
      icon: Search,
      action: () => { setRightPanel('seo'); setRightCollapsed(false) },
    },
    {
      id: 'brand',
      label: 'Branding',
      desc: brandReady ? 'Logo/share image set' : 'Logo, favicon, share image',
      done: brandReady,
      icon: Palette,
      action: () => { setRightPanel('settings'); setRightCollapsed(false) },
    },
    {
      id: 'publish',
      label: 'Publish',
      desc: site.is_published ? 'Live' : siteTestUrl ? 'Preview link ready' : 'Set link and publish',
      done: !!site.is_published,
      icon: Rocket,
      action: handleViewStore,
    },
  ]
  const completedSetup = setupItems.filter(i => i.done).length

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-100 z-[100]" style={{ fontFamily: 'Inter, sans-serif' }}>
      <input
        ref={overlayImageUploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleOverlayImageFileInputChange}
      />

      {/* Global Link Editor popup (for CTA buttons / overlay buttons) */}
      {linkEditor && (
        <LinkEditorPopup
          open={true}
          anchor={linkEditor.anchor}
          siteId={siteId!}
          value={linkEditor.value}
          onSave={linkEditor.save}
          onClose={() => setLinkEditor(null)}
        />
      )}

      {/* Global right-click Context Menu */}
      {contextMenu && (
        <ContextMenu
          open={true}
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenu.actions}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Pre-publish preflight modal */}
      {preflightOpen && (() => {
        const issues = runPreflight()
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
                  <div>
                    <h2 className="font-bold text-gray-900">Review before publishing</h2>
                    <p className="text-sm text-gray-500">{issues.length} issue{issues.length !== 1 ? 's' : ''} found</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <ul className="space-y-2 mb-6 max-h-64 overflow-y-auto">
                  {issues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-amber-500 shrink-0 mt-0.5">⚠</span>
                      {issue}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPreflightOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Fix Issues
                  </button>
                  <button
                    onClick={async () => {
                      setPreflightOpen(false)
                      try {
                        if (styleDirty || blocksDirty) {
                          await persistAllPagesToServer()
                          await persistAllBlocksToServer()
                          if (styleDirty) await websiteApi.updateSite(siteId!, { style_config: localStyle as any })
                          setStyleDirty(false)
                          setBlocksDirty(false)
                          setLastSavedAt(new Date())
                        }
                        await publishSite.mutateAsync()
                        invalidateSite()
                        toast.success('Site published!')
                      } catch { toast.error('Publish failed') }
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
                  >
                    Publish Anyway
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Styled text prompt (replaces native window.prompt) */}
      {textPrompt && (
        <TextPromptPopup
          open={true}
          anchor={textPrompt.anchor || null}
          title={textPrompt.title}
          subtitle={textPrompt.subtitle}
          placeholder={textPrompt.placeholder}
          initialValue={textPrompt.initialValue}
          multiline={textPrompt.multiline}
          maxLength={textPrompt.maxLength}
          confirmLabel={textPrompt.confirmLabel}
          onSave={(v) => { textPrompt.onSave(v); setTextPrompt(null) }}
          onClose={() => setTextPrompt(null)}
        />
      )}

      {/* ── Full Page Preview Overlay ─────────────────────────────────── */}
      {showFullPreview && (
        <div className="fixed inset-0 z-[300] flex flex-col bg-gray-950" onClick={() => setShowFullPreview(false)}>
          {/* Preview chrome */}
          <div className="flex items-center gap-3 px-5 h-12 bg-gray-900 border-b border-gray-800 shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Eye className="w-4 h-4 text-primary/70 shrink-0" />
              <span className="text-sm font-bold text-white truncate">{site.name}</span>
              <span className="text-gray-400 text-xs">—</span>
              <span className="text-gray-400 text-xs font-medium">{activePage?.title || 'Home'}</span>
            </div>
            {/* Device switcher */}
            <div className="flex items-center bg-gray-800 rounded-lg p-0.5">
              {([['desktop', Monitor, '100%'], ['tablet', Tablet, '768px'], ['mobile', Smartphone, '390px']] as [DeviceMode, React.ElementType, string][]).map(([d, Icon, label]) => (
                <button
                  key={d}
                  onClick={() => setDevice(d)}
                  title={label}
                  className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded text-xs transition-colors', device === d ? 'bg-primary text-white' : 'text-gray-400 hover:text-white')}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-gray-700" />
            {/* Page switcher */}
            <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar max-w-xs">
              {localPages.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setActivePageId(p.id); setSelectedBlockId(null) }}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                    activePageId === p.id ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800',
                  )}
                >
                  {p.title}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-gray-700" />
            <button
              type="button"
              disabled={sfOverlayLoading}
              onClick={() => void startStorefrontOverlayPreview()}
              title="Reload preview from your current unsaved edits (new draft snapshot)"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium transition-colors',
                sfOverlayLoading && 'opacity-60 cursor-not-allowed',
              )}
            >
              {sfOverlayLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Refresh
            </button>
            <div className="w-px h-5 bg-gray-700" />
            <button type="button" aria-label="Close"
              onClick={() => setShowFullPreview(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium transition-colors"
            >
                <X className="w-3.5 h-3.5" /> Exit Preview
            </button>
          </div>

          {/* Scrollable preview canvas — iframe uses the same business front draft URL as “Open in browser”. */}
          <div className="flex-1 overflow-auto bg-gray-800 flex justify-center py-6">
            <div
              className="bg-white shadow-2xl rounded-xl overflow-hidden transition-all duration-300 flex flex-col"
              style={{
                width: device === 'desktop' ? '100%' : device === 'tablet' ? 768 : 390,
                maxWidth: '100%',
                minHeight: 'min(100%, calc(100vh - 3rem))',
              }}
             onClick={e => e.stopPropagation()}>
              {sfOverlayLoading && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-gray-500 text-sm">
                  <Loader2 className="w-8 h-8 animate-spin text-primary/80" />
                  <span>Loading business front preview…</span>
                </div>
              )}
              {!sfOverlayLoading && storefrontOverlayIframeSrc && (
                <iframe
                  key={storefrontOverlayIframeSrc}
                  title="Business front preview"
                  src={storefrontOverlayIframeSrc}
                  className="w-full flex-1 border-0 bg-white"
                  style={{ minHeight: 'calc(100vh - 7rem)' }}
                />
              )}
              {!sfOverlayLoading && sfOverlayBlockFallback && (
                <>
                  {activeBlocks.filter(b => b.visible !== false).map(block => (
                    <BlockPreview
                      key={block.id}
                      block={block}
                      style={localStyle}
                      isSelected={false}
                      isEditing={false}
                    />
                  ))}
                  {activeBlocks.filter(b => b.visible !== false).length === 0 && (
                    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                      No blocks on this page yet.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Top Toolbar ──────────────────────────────────────────────── */}
      <header className="bg-gray-900 text-white shrink-0 z-10 shadow-md">
        {/* Row 1: main controls */}
        <div className="flex items-center gap-3 px-5 h-14 border-b border-gray-800">
          {/* Back */}
          <button onClick={() => navigate('/websites')} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs font-medium transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4" /> Sites
          </button>
          <div className="w-px h-5 bg-gray-700 shrink-0" />

          {/* Site name */}
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 text-primary/70 shrink-0" />
            <span className="text-sm font-bold truncate max-w-[180px]">{site.name}</span>
            {isTemplateMode ? (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold tracking-wide bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 whitespace-nowrap">
                Template Edit — {templateModeName}
              </span>
            ) : (
              <span className={cn('text-xs px-2 py-0.5 rounded-full font-bold tracking-wide', site.is_published ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40' : 'bg-gray-700 text-gray-400')}>
                {site.is_published ? 'Live' : 'Draft'}
              </span>
            )}
          </div>

          <div className="flex-1" />

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 bg-gray-800 rounded-lg p-1">
            <button onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" className={cn('p-1.5 rounded transition-colors', canUndo ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-500/40 cursor-not-allowed')}>
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" className={cn('p-1.5 rounded transition-colors', canRedo ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-500/40 cursor-not-allowed')}>
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Device switcher */}
          <div className="flex items-center bg-gray-800 rounded-lg p-1">
            {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as [DeviceMode, React.ElementType][]).map(([d, Icon]) => (
              <button
                key={d}
                onClick={() => setDevice(d)}
                className={cn('p-1.5 rounded transition-colors', device === d ? 'bg-primary text-white shadow-sm' : 'text-gray-400 hover:text-white')}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* Full Preview — same business front app as “Open in browser”, embedded at the selected device width */}
          <button
            type="button"
            onClick={() => {
              setSfOverlayToken(null)
              setSfOverlayVendorSlug(null)
              setSfOverlayPublishedFallback(false)
              setSfOverlayBlockFallback(false)
              setSfOverlayLoading(true)
              setShowFullPreview(true)
            }}
            title="Full-screen preview — real business front (draft snapshot), same rendering as Open in browser"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>

          <button
            type="button"
            disabled={openingBrowserPreview}
            onClick={() => void handleOpenBrowserPreview()}
            title="Open draft on the business front in a new tab (same link rules as template gallery — uses VITE_STOREFRONT_URL or :3002 in dev)"
            className={cn(
              STOREFRONT_OPEN_IN_BROWSER_BTN_CLASS,
              openingBrowserPreview && 'opacity-70 cursor-wait hover:bg-accent',
            )}
          >
            {openingBrowserPreview ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : (
              <ExternalLink className="w-3.5 h-3.5" />
            )}
            Open in browser
          </button>

          <div className="w-px h-5 bg-gray-700 shrink-0" />

          {/* Submissions inbox */}
          <button
            onClick={() => navigate(`/websites/${siteId}/submissions`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors"
            title="View form & booking submissions from your site"
          >
            <Mail className="w-3.5 h-3.5" /> Inbox
          </button>

          {/* AI */}
          <button
            onClick={() => { setRightPanel('ai'); setRightCollapsed(false) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary to-info text-white text-xs font-bold hover:opacity-90 transition-opacity shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" /> AI Studio
          </button>

          {/* Save style */}
          <div className="relative flex flex-col items-center">
            <button
              onClick={handleSaveCanvas}
              disabled={isSaving || (!styleDirty && !blocksDirty)}
              title={lastSavedAt ? `Last saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Save canvas and style settings'}
              className={cn(
                'relative flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white text-xs font-bold transition-all duration-300 select-none',
                saveFlash
                  ? 'bg-emerald-500 scale-105 shadow-lg shadow-emerald-500/30'
                  : styleDirty || blocksDirty
                    ? 'bg-gradient-to-r from-primary to-emerald-700 hover:from-primary/90 hover:to-emerald-800 shadow-md shadow-primary/30 animate-pulse'
                    : 'bg-gray-700 hover:bg-gray-600',
                isSaving && 'opacity-80 cursor-not-allowed'
              )}
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saveFlash ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saveFlash ? 'Saved!' : isSaving ? 'Saving…' : 'Save'}
              {(styleDirty || blocksDirty) && !isSaving && !saveFlash && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 border-2 border-gray-900 animate-pulse" />
              )}
            </button>
            {lastSavedAt && !styleDirty && !blocksDirty && !isSaving && (
              <span className="absolute -bottom-4 text-xs text-gray-500 whitespace-nowrap">
                {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* Apply — always available; saves canvas + publishes current site/template */}
          <button
            type="button"
            disabled={isApplyingToStore || applyingTemplateInline}
            onClick={() => void handleApplyToStore()}
            title="Save current canvas and publish it to your live store"
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm',
              isApplyingToStore
                ? 'bg-emerald-600 opacity-70 cursor-wait text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-white ring-2 ring-emerald-400/40',
            )}
          >
            {isApplyingToStore
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Applying…</>
              : <><Check className="w-3.5 h-3.5" /> Apply</>
            }
          </button>

          {/* Publish */}
          <button
            onClick={handlePublish}
            className={cn(
              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm',
              site.is_published ? 'bg-emerald-700 hover:bg-emerald-600 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            )}
          >
            {site.is_published ? <><EyeOff className="w-3.5 h-3.5" /> Unpublish</> : <><Globe className="w-3.5 h-3.5" /> Publish</>}
          </button>

          {/* View Store / Test Link */}
          <div className="relative">
            <button
              onClick={handleViewStore}
              title={siteTestUrl ?? 'Set a subdomain to get a test link'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {siteTestUrl ? 'View Store' : 'Get Link'}
            </button>

          {storePopover && siteTestUrl && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setStorePopover(false)} />
              <div className="absolute right-0 top-10 z-50 bg-white text-gray-800 rounded-xl shadow-2xl border border-gray-200 w-80 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-400">
                    {site.is_published ? '✅ Live URL' : '🔒 Preview URL (not live)'}
                  </div>
                  {site.is_published && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">PUBLISHED</span>
                  )}
                </div>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
                  <Globe className="w-3.5 h-3.5 text-primary/80 shrink-0" />
                  <span className="text-xs text-primary font-mono truncate flex-1">{siteTestUrl}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(siteTestUrl).catch(() => {})
                      toast.success('Link copied to clipboard!')
                      setStorePopover(false)
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy URL
                  </button>
                  <button
                    onClick={() => { window.open(siteTestUrl, '_blank'); setStorePopover(false) }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open ↗
                  </button>
                </div>
                {!site.is_published && (
                  <p className="text-xs text-amber-600 mt-2 text-center">⚠ Publish the site first so visitors can see it live.</p>
                )}
              </div>
            </>
          )}
        </div>
        </div>{/* end row 1 */}

        {/* Row 2: Page tabs */}
        <div className="flex items-center gap-1 px-5 h-10 bg-gray-800/60 border-t border-gray-800 overflow-x-auto hide-scrollbar">
          {localPages.map(page => (
            <button
              key={page.id}
              onClick={() => { setActivePageId(page.id); setSelectedBlockId(null) }}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                activePageId === page.id
                  ? 'bg-primary text-white shadow-sm shadow-primary/40'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/70'
              )}
            >
              <FileText className="w-3 h-3 shrink-0" />
              {page.title}
              {page.is_homepage && (
                <span className={cn('text-xs rounded px-1 font-bold', activePageId === page.id ? 'bg-white/20 text-white' : 'bg-gray-700 text-gray-400')}>
                  Home
                </span>
              )}
            </button>
          ))}
          <button
            onClick={handleAddPage}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-gray-500 hover:bg-gray-700/70 hover:text-gray-300 transition-colors whitespace-nowrap ml-1"
          >
            <Plus className="w-3 h-3" /> Add Page
          </button>
        </div>
      </header>

      {/* ── Main Layout ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
        <aside
          className={cn('flex flex-col bg-white border-r border-gray-200 shrink-0', leftCollapsed ? 'w-10' : '')}
          style={leftCollapsed ? undefined : { width: leftWidth }}
        >
          {leftCollapsed ? (
            <button onClick={() => setLeftCollapsed(false)} className="flex-1 flex items-center justify-center hover:bg-gray-50 text-gray-400 hover:text-gray-600">
              <PanelLeft className="w-4 h-4" />
            </button>
          ) : (
            <>
              {/* Left panel tabs */}
              <div className="flex items-center border-b border-gray-100 shrink-0">
                {([
                  { id: 'blocks' as const, icon: Layout, label: 'Blocks' },
                  { id: 'pages' as const, icon: FileText, label: 'Pages' },
                  { id: 'layers' as const, icon: Layers, label: 'Layers' },
                  { id: 'templates' as const, icon: Sparkles, label: 'Templates' },
                ] as const).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setLeftPanel(id)}
                      title={label}
                      className={cn('flex-1 py-2.5 flex flex-col items-center gap-0.5 text-xs font-medium transition-colors', leftPanel === id ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600')}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  ))}
                <button onClick={() => setLeftCollapsed(true)} className="px-2 py-2.5 text-gray-300 hover:text-gray-500">
                  <ChevronLeft className="w-3 h-3" />
                </button>
              </div>

              {/* Template edit mode banner */}
              {isTemplateMode && (
                <div className="mx-3 mt-2 mb-1 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-semibold leading-snug shrink-0">
                  <span className="font-extrabold">Template edit mode</span>
                  <br />
                  <span className="font-normal opacity-80">
                    Sandbox for editing templates. Choose a template in the Templates tab to load its full layout on the canvas. Use Blocks, Layers, and Pages like the normal builder. Clear all resets this sandbox.
                  </span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {/* BLOCKS panel */}
                {leftPanel === 'blocks' && (
                  <div className="p-3 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                      <input
                        value={blockSearch}
                        onChange={e => setBlockSearch(e.target.value)}
                        placeholder="Search blocks..."
                        className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {BLOCK_CATEGORIES.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setBlockCategory(cat.id)}
                          className={cn('px-2 py-0.5 rounded text-xs font-medium transition-colors', blockCategory === cat.id ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-100')}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1 pt-1">
                      {filteredBlocks.map(def => {
                        const liveSource = BLOCK_AUTO_SOURCE[def.type as string]
                        const liveLabel = liveSource ? DATA_SOURCES.find(s => s.id === liveSource)?.label : null
                        return (
                          <div
                            key={def.type}
                            draggable
                            onDragStart={() => setDraggingNewBlock(def)}
                            onDragEnd={() => setDraggingNewBlock(null)}
                            onClick={() => handleAddBlock(def)}
                            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-gray-100 hover:border-primary/30 hover:bg-accent cursor-grab active:cursor-grabbing transition-all group"
                            title={liveLabel ? `Auto-connects to ${liveLabel} on drop` : def.desc}
                          >
                            {/* Thumbnail / emoji preview */}
                            <div className="w-9 h-9 rounded-lg bg-gray-50 group-hover:bg-primary/15 border border-gray-200 group-hover:border-primary/30 flex items-center justify-center shrink-0 transition-colors text-lg leading-none">
                              {BLOCK_THUMBNAILS[def.type as string] || '▭'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-gray-700 group-hover:text-primary truncate">{def.label}</span>
                                {liveSource && (
                                  <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[8px] font-bold bg-emerald-100 text-emerald-700 shrink-0">
                                    <Zap className="w-2 h-2" />LIVE
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-400 truncate">
                                {liveLabel ? <>Auto-binds to <span className="text-emerald-600 font-semibold">{liveLabel}</span></> : def.desc}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* PAGES panel */}
                {leftPanel === 'pages' && (
                  <div className="p-3 space-y-2">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
                      {localPages.length} page{localPages.length !== 1 ? 's' : ''}
                    </div>
                    {localPages.map(page => {
                      const navBlock = activeBlocks.find(b => b.block_type === 'nav')
                      const navLinks: any[] = (navBlock?.props?.nav_links as any[]) || []
                      const isInNav = navLinks.some((l: any) => l.url === `/${page.slug}` || l.url === page.slug)
                      const pageTypeLabel = page.page_type === 'landing' ? '🚀' : page.page_type === 'blog' ? '📝' : page.page_type === 'product' ? '🛍️' : '📄'
                      return (
                        <div
                          key={page.id}
                          onClick={() => { setActivePageId(page.id); setSelectedBlockId(null) }}
                          className={cn('flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group', activePageId === page.id ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50 text-gray-700')}
                        >
                          <span className="text-base shrink-0 leading-none" title={page.page_type || 'page'}>{pageTypeLabel}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium truncate">{page.title}</span>
                              {page.is_homepage && <span className="text-[8px] bg-primary/20 text-primary rounded px-1 font-bold shrink-0">HOME</span>}
                            </div>
                            <div className="text-xs text-gray-400 font-mono">/{page.slug}</div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Set as homepage */}
                            {!page.is_homepage && (
                              <button
                                title="Set as homepage"
                                onClick={e => {
                                  e.stopPropagation()
                                  websiteApi.updatePage(siteId!, page.id, { is_homepage: true } as any)
                                    .then(() => {
                                      setLocalPages(prev => prev.map(p => ({ ...p, is_homepage: p.id === page.id })))
                                      toast.success(`"${page.title}" set as homepage`)
                                    })
                                    .catch(() => toast.error('Failed to set homepage'))
                                }}
                                className="p-1 hover:bg-primary/15 hover:text-primary rounded text-xs font-bold transition-colors"
                              >
                                🏠
                              </button>
                            )}
                            {/* Toggle in nav */}
                            {navBlock && (
                              <button
                                title={isInNav ? 'Remove from nav' : 'Add to nav menu'}
                                onClick={e => {
                                  e.stopPropagation()
                                  const updatedLinks = isInNav
                                    ? navLinks.filter((l: any) => l.url !== `/${page.slug}` && l.url !== page.slug)
                                    : [...navLinks, { label: page.title, url: `/${page.slug}` }]
                                  handleUpdateBlockProps(navBlock.id, { nav_links: updatedLinks } as any)
                                }}
                                className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded border transition-colors',
                                  isInNav
                                    ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
                                    : 'text-gray-400 border-gray-200 hover:bg-accent hover:text-primary hover:border-primary/40'
                                )}
                              >
                                {isInNav ? '✓ Nav' : '+ Nav'}
                              </button>
                            )}
                            {/* Duplicate */}
                            <button
                              title="Duplicate page"
                              onClick={async e => {
                                e.stopPropagation()
                                try {
                                  const slug = `${page.slug}-copy`
                                  const newPage = await websiteApi.createPage(siteId!, { title: `${page.title} (Copy)`, slug, page_type: page.page_type, sort_order: localPages.length } as any)
                                  // Copy blocks
                                  const currentBlocks = localBlocks[page.id] || []
                                  for (const block of currentBlocks) {
                                    await websiteApi.createBlock(siteId!, newPage.id, {
                                      block_type: block.block_type, label: block.label, props: block.props, sort_order: block.sort_order,
                                    } as any)
                                  }
                                  setLocalPages(prev => [...prev, newPage])
                                  setLocalBlocks(prev => ({ ...prev, [newPage.id]: [] }))
                                  setActivePageId(newPage.id)
                                  toast.success(`"${page.title}" duplicated`)
                                } catch { toast.error('Failed to duplicate page') }
                              }}
                              className="p-1 hover:bg-gray-100 rounded transition-colors"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            {/* Delete */}
                            <button
                              onClick={e => { e.stopPropagation(); handleDeletePage(page.id, page.title) }}
                              className="p-1 hover:bg-red-100 hover:text-red-600 rounded transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                    <button onClick={handleAddPage} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-primary/30 text-xs text-primary font-semibold hover:bg-accent hover:border-primary/60 transition-colors mt-1">
                      <Plus className="w-3.5 h-3.5" /> Add New Page
                    </button>
                    <p className="text-xs text-gray-400 text-center pt-1">
                      {isTemplateMode
                        ? 'Template sandbox — add or reorder pages anytime. Hover a row for homepage, nav, duplicate, delete.'
                        : 'Hover a page for actions. Use 🏠 to set homepage, + Nav to add to nav.'}
                    </p>
                  </div>
                )}

                {/* LAYERS panel */}
                {leftPanel === 'layers' && (
                  <div className="p-3 space-y-1">
                    <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
                      {activePage?.title || 'Select a page'} — {activeBlocks.length} blocks
                    </div>
                    {activeBlocks.map((block, idx) => (
                      <div
                        key={block.id}
                        onClick={() => { setSelectedBlockId(block.id); setRightPanel('props'); setRightCollapsed(false) }}
                        className={cn('flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors group text-xs', selectedBlockId === block.id ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-gray-50 text-gray-600')}
                      >
                        <GripVertical className="w-3 h-3 text-gray-300 shrink-0" />
                        <div className="flex-1 truncate">{catalogBlockLabel(block)}</div>
                        {!block.visible && <EyeOff className="w-3 h-3 text-gray-300 shrink-0" />}
                      </div>
                    ))}
                    {activeBlocks.length === 0 && (
                      <div className="text-center py-8 text-gray-400 text-xs">
                        No blocks yet.<br />Add blocks from the Blocks panel.
                      </div>
                    )}
                  </div>
                )}

                {/* TEMPLATES panel — template edit: click row loads template for editing; Clear all resets sandbox */}
                {leftPanel === 'templates' && (
                  <div className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wide leading-tight pt-0.5">
                        Website Templates
                      </div>
                      {isTemplateMode && (
                        <button
                          type="button"
                          disabled={!siteId || applyingTemplateInline || clearingTemplateSandbox}
                          onClick={() => { void handleClearTemplateSandbox() }}
                          className={cn(
                            'shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors',
                            siteId && !applyingTemplateInline && !clearingTemplateSandbox
                              ? 'border-gray-200 text-gray-700 hover:bg-gray-50'
                              : 'border-gray-100 text-gray-300 cursor-not-allowed',
                          )}
                        >
                          {clearingTemplateSandbox ? 'Clearing…' : 'Clear all'}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 leading-snug">
                      Click a template to load it on the canvas. Edit freely, then click <strong className="text-primary">Apply</strong> in the toolbar to publish it live.
                    </p>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        value={templateListSearch}
                        onChange={e => setTemplateListSearch(e.target.value)}
                        placeholder="Search templates…"
                        className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {(() => {
                        const q = templateListSearch.trim().toLowerCase()
                        const filteredTpl = templates
                          .filter(t => {
                            if (!q) return true
                            return `${t.name || ''} ${t.description || ''} ${t.category || ''}`.toLowerCase().includes(q)
                          })
                          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                        if (templates.length > 0 && filteredTpl.length === 0) {
                          return <p className="text-xs text-gray-400 text-center py-4">No templates match your search.</p>
                        }
                        const tplBusy = applyingTemplateInline || clearingTemplateSandbox
                        return filteredTpl.map(tpl => {
                          const pageCount = tpl.page_count ?? tpl.pages?.length ?? 0
                          const palette = getTemplatePreviewPalette(tpl)
                          const sel = templatePanelSelectedId === tpl.id
                          const isLoadingThis = sel && applyingTemplateInline
                          return (
                            <button
                              key={tpl.id}
                              type="button"
                              disabled={!siteId || tplBusy}
                              onClick={() => {
                                if (!siteId || tplBusy) return
                                void handleApplySelectedTemplate(tpl.id)
                              }}
                              className={cn(
                                'w-full text-left flex gap-2 p-2 rounded-xl border transition-colors',
                                sel
                                  ? 'border-primary bg-accent/70 ring-1 ring-primary/25'
                                  : 'border-gray-100 hover:border-primary/30 hover:bg-accent/70',
                                (!siteId || tplBusy) && 'opacity-60 cursor-not-allowed',
                              )}
                              title="Click to load this template on the canvas"
                            >
                              <div className="w-14 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-gray-100 relative">
                                {tpl.thumbnail ? (
                                  <img src={tpl.thumbnail} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-accent to-primary/20" />
                                )}
                                {isLoadingThis && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium text-gray-800 truncate">{tpl.name}</span>
                                  {sel && !isLoadingThis && (
                                    <span className="shrink-0 text-[8px] px-1.5 py-0.5 rounded-full bg-primary text-white font-bold leading-none">Loaded</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {tpl.category && (
                                    <span className="text-xs text-primary font-medium truncate">{tpl.category}</span>
                                  )}
                                  <span className="text-xs text-gray-400">{pageCount} pg</span>
                                </div>
                                <span className="inline-flex -space-x-0.5 mt-1">
                                  {palette.slice(0, 4).map((c, i) => (
                                    <span key={`${c}-${i}`} className="w-2 h-2 rounded-full border border-white ring-1 ring-gray-100" style={{ backgroundColor: c }} />
                                  ))}
                                </span>
                              </div>
                            </button>
                          )
                        })
                      })()}
                    </div>
                    {templates.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-6">No templates loaded.</p>
                    )}
                  </div>
                )}

              </div>
            </>
          )}
        </aside>

        {/* ── LEFT RESIZE HANDLE ──────────────────────────────────────── */}
        {!leftCollapsed && (
          <div
            className="w-1 shrink-0 bg-transparent hover:bg-primary/50 active:bg-accent cursor-col-resize transition-colors group relative z-20"
            onMouseDown={e => {
              e.preventDefault()
              isResizingLeft.current = true
              document.body.style.cursor = 'col-resize'
              document.body.style.userSelect = 'none'
            }}
            title="Drag to resize panel"
          >
            <div className="absolute inset-y-0 -left-0.5 -right-0.5 group-hover:bg-primary/50/30" />
          </div>
        )}

        {/* ── CANVAS ──────────────────────────────────────────────────── */}
        <main
          className="flex-1 overflow-auto bg-gray-100"
          onDragOver={e => e.preventDefault()}
          onDrop={handleDropOnCanvas}
        >
          {/* Canvas toolbar */}
          <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-gray-100 text-xs text-gray-500 sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="font-bold text-gray-800 text-[13px]">{activePage?.title || 'Select a page'}</span>
              <span className="text-gray-200">|</span>
              <span className="text-gray-400">{activeBlocks.length} block{activeBlocks.length !== 1 ? 's' : ''}</span>

              {/* Live-data connection stats */}
              {(() => {
                const connectable = activeBlocks.filter(b => BLOCK_AUTO_SOURCE[b.block_type as string])
                const connected = connectable.filter(b => normalizeSourceType((b.props as any)?.data_source?.type))
                const disconnected = connectable.filter(b => !normalizeSourceType((b.props as any)?.data_source?.type))
                if (connectable.length === 0) return null
                return (
                  <>
                    <span className="text-gray-300">•</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {connected.length}/{connectable.length} Live
                    </span>
                    {disconnected.length > 0 && (
                      <button
                        onClick={() => {
                          disconnected.forEach(b => {
                            const src = BLOCK_AUTO_SOURCE[b.block_type as string]
                            if (src) handleUpdateBlockProps(b.id, { data_source: { type: src, auto: true } } as any)
                          })
                          toast.success(`Connected ${disconnected.length} block${disconnected.length !== 1 ? 's' : ''} to live data`)
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gradient-to-r from-primary to-emerald-700 text-white font-bold text-xs hover:opacity-90 transition-opacity shadow-sm"
                        title="Auto-connect remaining blocks to KITERP live data"
                      >
                        <Zap className="w-2.5 h-2.5" />
                        Connect {disconnected.length}
                      </button>
                    )}
                  </>
                )
              })()}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {device !== 'desktop' && (
                <span className="text-primary font-medium">{device === 'mobile' ? '390px' : '768px'}</span>
              )}
              <button
                type="button"
                disabled={
                  !siteId
                  || applyingTemplateInline
                  || clearingTemplateSandbox
                  || resettingCanvasFromServer
                }
                onClick={() => { void handleCopyTemplateJson() }}
                title="Copy site JSON (current canvas and style). Use Import elsewhere or keep as backup."
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors',
                  siteId && !applyingTemplateInline && !clearingTemplateSandbox && !resettingCanvasFromServer
                    ? 'border-primary/30 text-primary bg-accent/80 hover:bg-accent'
                    : 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50/50',
                )}
              >
                <ClipboardCopy className="w-3 h-3 shrink-0" /> Copy template
              </button>
              <button
                type="button"
                disabled={!canUndo}
                onClick={handleUndo}
                title="Undo last block change (Ctrl+Z)"
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors',
                  canUndo
                    ? 'border-gray-200 text-gray-700 hover:bg-gray-50 bg-white'
                    : 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50/50',
                )}
              >
                <Undo2 className="w-3 h-3 shrink-0" /> Undo
              </button>
              <button
                type="button"
                disabled={
                  !siteId
                  || resettingCanvasFromServer
                  || applyingTemplateInline
                  || clearingTemplateSandbox
                }
                onClick={() => { void handleResetCanvasFromServer() }}
                title="Reload last saved site from the server (discards unsaved canvas and style changes)"
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border transition-colors',
                  siteId && !resettingCanvasFromServer && !applyingTemplateInline && !clearingTemplateSandbox
                    ? 'border-gray-200 text-gray-700 hover:bg-gray-50 bg-white'
                    : 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50/50',
                )}
              >
                {resettingCanvasFromServer ? (
                  <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3 shrink-0" />
                )}
                Reset
              </button>
              {selectedBlockId && (
                <button type="button" aria-label="Close" onClick={() => setSelectedBlockId(null)} className="flex items-center gap-1 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors">
                <X className="w-3 h-3" /> Deselect
                </button>
              )}
            </div>
          </div>

          {/* Store owner setup assistant — keeps hidden features visible */}
          <div className="px-4 py-2 bg-white border-b border-gray-200 hidden">
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
              <div className="shrink-0 flex items-center gap-1.5 pr-1 text-xs font-bold text-gray-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary/80" />
                Setup {completedSetup}/{setupItems.length}
              </div>
              {setupItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  className={cn(
                    'shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border text-left transition-all',
                    item.done
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
                  )}
                  title={item.desc}
                >
                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-xs font-bold leading-tight">{item.label}</span>
                    <span className="block text-xs opacity-75 leading-tight truncate max-w-[120px]">{item.desc}</span>
                  </span>
                  {item.done ? <Check className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas area */}
          <div
            className="p-4 min-h-full flex justify-center"
            style={{
              background: 'repeating-linear-gradient(0deg,transparent,transparent 24px,rgba(99,102,241,0.04) 24px,rgba(99,102,241,0.04) 25px),repeating-linear-gradient(90deg,transparent,transparent 24px,rgba(99,102,241,0.04) 24px,rgba(99,102,241,0.04) 25px)',
              backgroundColor: '#f3f4f6',
            }}
          >
            <div
              style={{ width: deviceWidth, maxWidth: '100%' }}
              className="bg-white shadow-2xl rounded-xl overflow-hidden transition-all duration-300 min-h-[600px]"
            >
              {!activePage ? (
                <div className="flex items-center justify-center h-full text-gray-400 py-32">
                  <div className="text-center">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Select a page to start building</p>
                  </div>
                </div>
              ) : activeBlocks.length === 0 ? (
                <div
                  className="flex items-center justify-center py-20 border-2 border-dashed border-primary/30 m-8 rounded-2xl"
                  onDragOver={e => e.preventDefault()}
                  onDrop={handleDropOnCanvas}
                >
                  <div className="text-center max-w-md">
                    <Plus className="w-12 h-12 mx-auto mb-3 text-primary/50" />
                    <p className="text-sm text-gray-500 font-medium">Drop blocks here or click to add</p>
                    <p className="text-xs text-gray-400 mt-1">Drag from the left panel</p>
                    <div className="flex flex-col items-center gap-2 mt-5">
                      <button
                        onClick={async () => {
                          const starter: BlockType[] = [
                            'nav', 'hero', 'stats', 'product_grid', 'services_cards',
                            'testimonials', 'team_grid', 'contact_form', 'footer',
                          ]
                          for (const t of starter) {
                            const def = BLOCK_CATALOG.find(d => d.type === t)
                            if (def) await handleAddBlock(def)
                          }
                          toast.success('Live ERP Starter Pack added — all blocks auto-connected to your KITERP data!')
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity shadow-lg"
                      >
                        <Zap className="w-4 h-4" />
                        Add Live ERP Starter Pack
                      </button>
                      <p className="text-xs text-gray-400">
                        9 blocks auto-wired to your products, services, team, stats & CRM
                      </p>
                      <button
                        onClick={() => setLeftPanel('blocks')}
                        className="mt-2 px-4 py-2 border border-primary/40 text-primary text-xs font-medium rounded-lg hover:bg-accent transition-colors"
                      >
                        Or browse all blocks
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {activeBlocks.map((block, idx) => (
                    <div
                      key={block.id}
                      draggable
                      onDragStart={() => handleDragStartBlock(idx)}
                      onDragOver={e => handleDragOverBlock(e, idx)}
                      onDrop={e => handleDropOnBlock(e, idx)}
                      onDragEnd={() => { setDraggingBlockIdx(null); setIsDraggingOver(null) }}
                      onClick={() => { setSelectedBlockId(block.id); setActiveTextTarget(null); setRightPanel('props'); setRightCollapsed(false) }}
                      onContextMenu={e => { e.preventDefault(); openBlockContextMenu(block, e) }}
                      className={cn(
                        'relative group transition-all cursor-pointer',
                        selectedBlockId === block.id
                          ? savingBlockId === block.id
                            ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-gray-100'
                            : 'ring-2 ring-ring ring-offset-1 ring-offset-gray-100'
                          : 'hover:ring-1 hover:ring-ring hover:ring-offset-1',
                        isDraggingOver === block.id && 'border-t-4 border-primary/60',
                        !block.visible && 'opacity-40'
                      )}
                      style={{
                        // Ensure blocks are visible on white backgrounds; footer is page end — no extra chrome
                        outline:
                          selectedBlockId !== block.id && block.block_type !== 'footer'
                            ? '1px dashed rgba(100,100,200,0.15)'
                            : undefined,
                        minHeight: block.block_type === 'footer' ? undefined : '48px',
                      }}
                    >
                      {/* ── Design Bar (full-width inline toolbar, shown when selected) */}
                      {selectedBlockId === block.id && (
                        <BlockDesignBar
                          block={block}
                          onUpdate={updates => handleUpdateBlockProps(block.id, updates)}
                          onInsertAfter={type => handleAddBlockAfter(type)}
                          onOpenLinkEditorForOverlay={(item, anchor) => openLinkEditorForOverlay(block.id, item, anchor)}
                          activeTextField={activeTextTarget?.blockId === block.id ? activeTextTarget.fieldKey : null}
                          onUndo={handleUndo}
                          onRedo={handleRedo}
                          canUndo={canUndo}
                          canRedo={canRedo}
                        />
                      )}

                      {/* Block toolbar (top-right hover/select actions) */}
                      <div className={cn(
                        'absolute z-[140] flex items-center gap-1 rounded-lg border border-white/10 bg-gray-950/95 px-2 py-1 text-white shadow-lg shadow-black/20 backdrop-blur transition-all',
                        selectedBlockId === block.id
                          ? 'top-1.5 right-2 opacity-100'
                          : 'top-1 right-1 opacity-0 group-hover:opacity-100'
                      )}>
                        {(() => {
                          const rawDs = (block.props as any)?.data_source
                          const dsType = normalizeSourceType(rawDs?.type)
                          const suggested = BLOCK_AUTO_SOURCE[block.block_type as string]
                          const label = dsType ? DATA_SOURCES.find(s => s.id === dsType)?.label : null
                          if (dsType) {
                            return (
                              <button
                                onClick={e => { e.stopPropagation(); setSelectedBlockId(block.id); setRightPanel('data'); setRightCollapsed(false) }}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors text-xs font-bold"
                                title={`Connected to ${label}. Click to edit data source.`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                LIVE · {label}
                              </button>
                            )
                          }
                          if (suggested) {
                            return (
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  handleUpdateBlockProps(block.id, { data_source: { type: suggested, auto: true } } as any)
                                  toast.success(`Connected to ${DATA_SOURCES.find(s => s.id === suggested)?.label}`)
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent/30 text-primary-foreground/85 hover:bg-accent/50 transition-colors text-xs font-bold"
                                title={`One-click connect to ${DATA_SOURCES.find(s => s.id === suggested)?.label}`}
                              >
                                <Zap className="w-2.5 h-2.5" />
                                CONNECT
                              </button>
                            )
                          }
                          return null
                        })()}
                        <button onClick={e => { e.stopPropagation(); setSelectedBlockId(block.id); setRightPanel('data'); setRightCollapsed(false) }} className="p-0.5 text-gray-400 hover:text-white" title="Data source">
                          <Database className="w-3 h-3" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleMoveBlock(block.id, 'up') }} className="p-0.5 text-gray-400 hover:text-white" title="Move up">
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleMoveBlock(block.id, 'down') }} className="p-0.5 text-gray-400 hover:text-white" title="Move down">
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleDuplicateBlock(block.id) }} className="p-0.5 text-gray-400 hover:text-white" title="Duplicate (Ctrl+D)">
                          <Copy className="w-3 h-3" />
                        </button>
                        {/* Delete — arm then confirm (prevents accidental deletion) */}
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteBlock(block.id) }}
                          title={armedDeleteId === block.id ? 'Click again to confirm delete' : 'Delete block (click twice to confirm)'}
                          className={cn(
                            'flex items-center gap-0.5 rounded px-1 transition-all duration-200',
                            armedDeleteId === block.id
                              ? 'bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 animate-pulse'
                              : 'p-0.5 text-gray-400 hover:text-red-400'
                          )}
                        >
                          <Trash2 className="w-3 h-3" />
                          {armedDeleteId === block.id && 'Delete?'}
                        </button>
                        <GripVertical className="w-3 h-3 text-gray-500 cursor-grab" />
                      </div>

                      {/* Block label chip + saving indicator */}
                      <div className={cn(
                        'absolute bottom-1 left-1 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-primary/80 text-white transition-opacity pointer-events-none',
                        selectedBlockId === block.id ? 'opacity-0' : 'opacity-0 group-hover:opacity-70'
                      )}>
                        {catalogBlockLabel(block)}
                      </div>
                      {savingBlockId === block.id && (
                        <div className="absolute bottom-1 right-1 z-20 flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/90 text-white text-xs font-bold pointer-events-none">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Saving…
                        </div>
                      )}

                      {/* Canvas preview — offset top padding when design bar is showing */}
                      <div style={selectedBlockId === block.id ? { paddingTop: 40 } : undefined}>
                        <BlockPreview
                          block={block}
                          style={localStyle}
                          isSelected={selectedBlockId === block.id}
                          isEditing={selectedBlockId === block.id}
                          onOverlayUpdate={selectedBlockId === block.id
                            ? (overlays) => handleUpdateBlockProps(block.id, { overlays } as any)
                            : undefined}
                          onOverlaySelectionChange={block.id === selectedBlockId ? onOverlayLayerPicked : undefined}
                          onOpenAiImageTools={block.id === selectedBlockId ? openAiImageFromCanvas : undefined}
                          onOpenMediaLibrary={block.id === selectedBlockId ? openMediaFromCanvas : undefined}
                          onPickLocalImage={block.id === selectedBlockId ? openOverlayImageFilePicker : undefined}
                          onImageFileDrop={block.id === selectedBlockId ? uploadImageFileToSelection : undefined}
                          onPropsUpdate={block.id === selectedBlockId
                            ? (patch) => handleUpdateBlockProps(block.id, patch as any)
                            : undefined}
                          onEditLinkForOverlay={block.id === selectedBlockId
                            ? (item, anchor) => openLinkEditorForOverlay(block.id, item, anchor)
                            : undefined}
                          onOverlayContextMenu={block.id === selectedBlockId
                            ? (item, e) => { e.preventDefault(); e.stopPropagation(); openOverlayContextMenu(block.id, item, e) }
                            : undefined}
                          onEditPropLink={block.id === selectedBlockId
                            ? (propKey, anchor) => openLinkEditorForProp(block.id, propKey, anchor)
                            : undefined}
                          onRequestText={block.id === selectedBlockId ? openTextPrompt : undefined}
                          onNavigatePage={(url) => {
                            const cleanUrl = (url || '/').split('?')[0].split('#')[0]
                            const slug = cleanUrl === '/' ? '' : cleanUrl.replace(/^\/+|\/+$/g, '')
                            const target = localPages.find(p => (
                              (p.is_homepage && (cleanUrl === '/' || slug === 'home')) ||
                              p.slug.replace(/^\/+|\/+$/g, '') === slug
                            ))
                            if (target) {
                              setActivePageId(target.id)
                              setSelectedBlockId(null)
                            } else {
                              toast.info(`No builder page found for "${url}". Add it from the Pages panel or update the nav link.`)
                            }
                          }}
                          activeTextField={activeTextTarget?.blockId === block.id ? activeTextTarget.fieldKey : null}
                          onActiveTextFieldChange={(fieldKey) => setActiveTextTarget(fieldKey ? { blockId: block.id, fieldKey } : null)}
                        />
                      </div>

                      {/* ── Section height resize handle (drag bottom edge) ── */}
                      {selectedBlockId === block.id && (
                        <div
                          title="Drag to resize section height"
                          className="absolute bottom-0 left-0 right-0 h-3 z-20 flex items-center justify-center cursor-ns-resize group/resize hover:bg-primary/10 transition-colors"
                          onMouseDown={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            const startY = e.clientY
                            const startH = (block.props as any).min_height || 0
                            document.body.style.cursor = 'ns-resize'
                            const onMove = (mv: MouseEvent) => {
                              const newH = Math.max(0, startH + (mv.clientY - startY))
                              handleUpdateBlockProps(block.id, { min_height: Math.round(newH) } as any)
                            }
                            const onUp = () => {
                              document.body.style.cursor = ''
                              document.removeEventListener('mousemove', onMove)
                              document.removeEventListener('mouseup', onUp)
                            }
                            document.addEventListener('mousemove', onMove)
                            document.addEventListener('mouseup', onUp)
                          }}
                        >
                          <div className="w-12 h-1 rounded-full bg-primary/50/60 group-hover/resize:bg-accent group-hover/resize:w-20 transition-all" />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Drop zone at end — omit when page ends with footer so the footer isn’t visually stacked under a dashed “slot” */}
                  {activeBlocks[activeBlocks.length - 1]?.block_type !== 'footer' && (
                    <div
                      className="flex items-center justify-center py-6 border-2 border-dashed border-gray-200 hover:border-primary/40 m-4 rounded-xl transition-colors cursor-pointer"
                      onClick={() => setLeftPanel('blocks')}
                      onDragOver={e => e.preventDefault()}
                      onDrop={handleDropOnCanvas}
                    >
                      <span className="text-xs text-gray-400 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Drop block here or click to browse
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>

        {/* ── RIGHT RESIZE HANDLE ─────────────────────────────────────── */}
        {!rightCollapsed && (
          <div
            className="w-1 shrink-0 bg-transparent hover:bg-primary/50 active:bg-accent cursor-col-resize transition-colors group relative z-20"
            onMouseDown={e => {
              e.preventDefault()
              isResizingRight.current = true
              document.body.style.cursor = 'col-resize'
              document.body.style.userSelect = 'none'
            }}
            title="Drag to resize panel"
          >
            <div className="absolute inset-y-0 -left-0.5 -right-0.5 group-hover:bg-primary/50/30" />
          </div>
        )}

        {/* ── RIGHT PANEL ──────────────────────────────────────────────── */}
        <aside
          className={cn('flex flex-col bg-white border-l border-gray-200 shrink-0', rightCollapsed ? 'w-10' : '')}
          style={rightCollapsed ? undefined : { width: rightWidth }}
        >
          {rightCollapsed ? (
            <button onClick={() => setRightCollapsed(false)} className="flex-1 flex items-center justify-center hover:bg-gray-50 text-gray-400 hover:text-gray-600">
              <PanelRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              {/* Right panel tabs */}
              <div className="flex items-center border-b border-gray-100 shrink-0">
                <button onClick={() => setRightCollapsed(true)} className="px-2 py-2.5 text-gray-300 hover:text-gray-500">
                  <ChevronRight className="w-3 h-3" />
                </button>
                {([
                  { id: 'props' as const, icon: Settings2, label: 'Edit', hint: 'Text' },
                  { id: 'style' as const, icon: Palette, label: 'Style', hint: 'Design' },
                  { id: 'seo' as const, icon: Search, label: 'SEO', hint: 'Google' },
                  { id: 'data' as const, icon: Database, label: 'Data', hint: 'Live' },
                  { id: 'ai' as const, icon: Sparkles, label: 'AI', hint: 'Assist' },
                  { id: 'media' as const, icon: ImageIcon, label: 'Media', hint: 'Images' },
                  { id: 'settings' as const, icon: Globe, label: 'Site', hint: 'Settings' },
                ] as const).map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setRightPanel(id)}
                    title={label}
                    className={cn('flex-1 py-2 flex flex-col items-center gap-0.5 text-xs font-medium transition-colors', rightPanel === id ? 'text-primary border-b-2 border-primary bg-accent' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50')}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="leading-none">{label}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto">
                {rightPanel === 'props' && (
                  selectedBlock ? (
                    <PropsEditor
                      block={selectedBlock}
                      onUpdate={updates => handleUpdateBlockProps(selectedBlock.id, updates)}
                      onPreview={updates => handlePreviewBlockProps(selectedBlock.id, updates)}
                      siteId={siteId!}
                      pages={localPages}
                      onAddPage={handleAddPage}
                      onEditPropLink={(propKey, anchor) => openLinkEditorForProp(selectedBlock.id, propKey, anchor)}
                    />
                  ) : (
                    <div className="p-4 space-y-4">
                      <div className="text-center py-8">
                        <MousePointerIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm font-semibold text-gray-700">Select a block to edit</p>
                        <p className="text-xs text-gray-400 mt-1">Click any block on the canvas to see its settings here.</p>
                      </div>
                      <div className="pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => { setRightPanel('ai'); setRightCollapsed(false) }}
                          className="w-full py-2 rounded-xl bg-primary hover:bg-primary/90 text-xs font-medium text-white flex items-center justify-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> AI Help
                        </button>
                      </div>
                    </div>
                  )
                )}

                {rightPanel === 'data' && (
                  <DataSourcePanel
                    siteId={siteId!}
                    block={selectedBlock}
                    onUpdate={handleUpdateDataSource}
                  />
                )}

                {rightPanel === 'style' && (
                  <div>
                    <StylePanel style={localStyle} onChange={s => { setLocalStyle(prev => ({ ...prev, ...s })); setStyleDirty(true) }} siteId={siteId!} />
                    <div className="px-4 pb-4">
                      <button
                        onClick={handleSaveCanvas}
                        disabled={isSaving || (!styleDirty && !blocksDirty)}
                        className={cn(
                          'w-full py-2.5 rounded-xl text-white text-xs font-medium flex items-center justify-center gap-2 transition-all duration-300',
                          saveFlash
                            ? 'bg-emerald-500 scale-[1.02]'
                            : styleDirty || blocksDirty
                              ? 'bg-gradient-to-r from-primary to-emerald-700 hover:from-primary/90 hover:to-emerald-800 shadow-md'
                              : 'bg-gray-300 text-gray-600 cursor-default'
                        )}
                      >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveFlash ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        {saveFlash ? 'Saved!' : isSaving ? 'Saving…' : styleDirty || blocksDirty ? 'Save canvas & styles' : 'No unsaved changes'}
                      </button>
                      {lastSavedAt && (
                        <p className="text-xs text-gray-400 text-center mt-1.5">
                          Last saved at {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {rightPanel === 'ai' && (
                  <AIStudioPanel
                    siteId={siteId!}
                    siteName={site?.name}
                    activePage={activePage}
                    activeBlocks={activeBlocks}
                    selectedBlock={selectedBlock}
                    focusImageGenKey={aiImageGenFocusKey}
                    applyToImageLayer={applyToImageLayer}
                    openTextPrompt={openTextPrompt}
                    onAddBlocks={async (blocks) => {
                      for (const b of blocks) {
                        const def = BLOCK_CATALOG.find(d => d.type === b.block_type)
                        if (def) await handleAddBlock(def)
                      }
                    }}
                    onApplyStyle={async (styleCfg) => {
                      setLocalStyle(prev => ({ ...prev, ...styleCfg }))
                      setStyleDirty(true)
                      await websiteApi.updateSite(siteId!, { style_config: { ...localStyle, ...styleCfg } as any })
                      setStyleDirty(false)
                      setLastSavedAt(new Date())
                      toast.success('Theme applied!')
                    }}
                    onApplyImage={applyMediaUrlToSelection}
                  />
                )}

                {rightPanel === 'media' && (
                  <MediaStudioPanel
                    siteId={siteId!}
                    selectedBlock={selectedBlock}
                    applyToImageLayer={applyToImageLayer}
                    onApplyUrl={applyMediaUrlToSelection}
                  />
                )}

                {rightPanel === 'seo' && (
                  <SEOPanel
                    siteId={siteId!}
                    activePage={activePage}
                    site={site}
                    onSavePage={(data) => {
                      if (!activePage) return
                      websiteApi.updatePage(siteId!, activePage.id, data as any)
                        .then(() => toast.success('SEO saved!'))
                        .catch(() => toast.error('Save failed'))
                    }}
                    onSaveSite={(data) => {
                      websiteApi.updateSite(siteId!, data as any)
                        .then(() => toast.success('Site SEO saved!'))
                        .catch(() => toast.error('Save failed'))
                    }}
                  />
                )}

                {rightPanel === 'settings' && site && (
                  <SiteSettingsPanel siteId={siteId!} site={site} />
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

// ── Site Settings Panel ───────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'en', label: 'English' }, { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' }, { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' }, { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية' }, { code: 'hi', label: 'हिंदी' },
  { code: 'zh', label: '中文' }, { code: 'ja', label: '日本語' },
]

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar' }, { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' }, { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' }, { code: 'AED', symbol: 'AED', label: 'UAE Dirham' },
  { code: 'SAR', symbol: 'SAR', label: 'Saudi Riyal' }, { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' }, { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar' },
]

function SiteSettingsPanel({ siteId, site }: { siteId: string; site: WebsiteSite }) {
  const [tab, setTab] = useState<'i18n' | 'analytics' | 'redirects' | 'headless'>('i18n')

  const [lang, setLang] = useState((site as any).language || 'en')
  const [currency, setCurrency] = useState((site as any).currency || 'USD')
  const [currSymbol, setCurrSymbol] = useState((site as any).currency_symbol || '$')
  const [currPos, setCurrPos] = useState((site as any).currency_position || 'before')
  const [location, setLocation] = useState((site as any).location || '')
  const [timezone, setTimezone] = useState((site as any).timezone || 'UTC')
  const [savingI18n, setSavingI18n] = useState(false)

  // Branding + analytics state — surfaces tracking IDs and the favicon
  // that previously had no UI but were honoured on the business front.
  const [faviconUrl, setFaviconUrl] = useState((site as any).favicon_url || '')
  const [logoUrl, setLogoUrl] = useState((site as any).logo_url || '')
  const [ogImageUrl, setOgImageUrl] = useState((site as any).og_image_url || '')
  const [gaId, setGaId] = useState((site as any).google_analytics_id || '')
  const [pixelId, setPixelId] = useState((site as any).meta_pixel_id || '')
  const [headCode, setHeadCode] = useState((site as any).custom_head_code || '')
  const [bodyCode, setBodyCode] = useState((site as any).custom_body_code || '')
  const [savingAnalytics, setSavingAnalytics] = useState(false)

  const handleSaveAnalytics = async () => {
    setSavingAnalytics(true)
    try {
      await websiteApi.updateSite(siteId, {
        favicon_url: faviconUrl || null,
        logo_url: logoUrl || null,
        og_image_url: ogImageUrl || null,
        google_analytics_id: gaId.trim() || null,
        meta_pixel_id: pixelId.trim() || null,
        custom_head_code: headCode || null,
        custom_body_code: bodyCode || null,
      } as any)
      toast.success('Saved!')
    } catch {
      toast.error('Save failed')
    } finally {
      setSavingAnalytics(false)
    }
  }

  // Redirect state
  const { data: redirects = [] } = useRedirects(siteId)
  const createRedirect = useCreateRedirect(siteId)
  const deleteRedirect = useDeleteRedirect(siteId)
  const [newFrom, setNewFrom] = useState('')
  const [newTo, setNewTo] = useState('')
  const [newCode, setNewCode] = useState<301 | 302>(301)

  // Headless state
  const enableHeadless = useEnableHeadless(siteId)
  const disableHeadless = useDisableHeadless(siteId)
  const siteHeadless = (site as any).headless_enabled as boolean
  const headlessToken = (site as any).headless_token as string | null

  const handleSaveI18n = async () => {
    setSavingI18n(true)
    try {
      await websiteApi.updateSite(siteId, {
        language: lang, currency, currency_symbol: currSymbol,
        currency_position: currPos as any, location, timezone,
      } as any)
      toast.success('Settings saved!')
    } catch { toast.error('Save failed') }
    setSavingI18n(false)
  }

  const handleAddRedirect = async () => {
    if (!newFrom || !newTo) { toast.error('Both paths are required'); return }
    try {
      await createRedirect.mutateAsync({ from_path: newFrom, to_path: newTo, status_code: newCode, is_active: true })
      setNewFrom(''); setNewTo('')
      toast.success('Redirect added!')
    } catch { toast.error('Failed to add redirect') }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center border-b border-gray-100 shrink-0 px-1 py-1 gap-0.5">
        {([
          { id: 'i18n', label: 'Language' },
          { id: 'analytics', label: 'Branding & Analytics' },
          { id: 'redirects', label: 'Redirects' },
          { id: 'headless', label: 'Headless API' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors', tab === t.id ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100')}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* I18N TAB */}
        {tab === 'i18n' && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Primary Language</label>
              <select value={lang} onChange={e => setLang(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs">
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label} ({l.code})</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Currency</label>
              <select value={currency} onChange={e => {
                const c = CURRENCIES.find(x => x.code === e.target.value)
                setCurrency(e.target.value)
                if (c) setCurrSymbol(c.symbol)
              }} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs">
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label} ({c.symbol})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Symbol</label>
                <input value={currSymbol} onChange={e => setCurrSymbol(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Position</label>
                <select value={currPos} onChange={e => setCurrPos(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs">
                  <option value="before">Before (₹999)</option>
                  <option value="after">After (999₹)</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Location / Region</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Mumbai, India" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Timezone</label>
              <input value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="e.g. Asia/Kolkata" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs" />
            </div>
            <div className="pt-1 border-t border-gray-100">
              <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">Preview</div>
              <p className="text-xs text-gray-600">
                A product priced at <strong>1000</strong> will show as:{' '}
                <strong>{currPos === 'before' ? `${currSymbol}1,000` : `1,000${currSymbol}`}</strong>
              </p>
            </div>
            <button onClick={handleSaveI18n} disabled={savingI18n} className="w-full py-2 bg-primary text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90">
              {savingI18n ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Settings
            </button>
          </>
        )}

        {/* BRANDING & ANALYTICS TAB */}
        {tab === 'analytics' && (
          <>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Branding</p>
                <p className="text-xs text-gray-400 mb-2">
                  Used in the browser tab, search results and social-share previews.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Favicon URL</label>
                <input
                  value={faviconUrl}
                  onChange={e => setFaviconUrl(e.target.value)}
                  placeholder="https://cdn.example.com/favicon.png"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs"
                />
                {faviconUrl && (
                  <div className="flex items-center gap-2 pt-1">
                    <img src={faviconUrl} alt="" className="w-5 h-5 rounded border border-gray-200" />
                    <span className="text-xs text-gray-400">Preview</span>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Logo URL</label>
                <input
                  value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                  placeholder="https://cdn.example.com/logo.png"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Default OG / Share Image URL</label>
                <input
                  value={ogImageUrl}
                  onChange={e => setOgImageUrl(e.target.value)}
                  placeholder="https://cdn.example.com/og-cover.jpg"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs"
                />
                <p className="text-xs text-gray-400">
                  Recommended 1200×630. Pages without their own OG image fall back to this one.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 space-y-3">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Analytics</p>
                <p className="text-xs text-gray-400">
                  Tracking only fires after visitors accept your cookie banner.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Google Analytics 4 ID</label>
                <input
                  value={gaId}
                  onChange={e => setGaId(e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Meta (Facebook) Pixel ID</label>
                <input
                  value={pixelId}
                  onChange={e => setPixelId(e.target.value)}
                  placeholder="1234567890123456"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Custom &lt;head&gt; code</label>
                <textarea
                  value={headCode}
                  onChange={e => setHeadCode(e.target.value)}
                  rows={5}
                  placeholder="<!-- GTM, verification meta tags, etc. -->"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono resize-y"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Custom &lt;body&gt; code</label>
                <textarea
                  value={bodyCode}
                  onChange={e => setBodyCode(e.target.value)}
                  rows={3}
                  placeholder="<!-- Chat widget script, GTM noscript, etc. -->"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono resize-y"
                />
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2">
                Custom code is rendered as-is. Only paste snippets from sources you trust.
              </p>
            </div>

            <button
              onClick={handleSaveAnalytics}
              disabled={savingAnalytics}
              className="w-full py-2 bg-primary text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90"
            >
              {savingAnalytics ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Branding & Analytics
            </button>
          </>
        )}

        {/* REDIRECTS TAB */}
        {tab === 'redirects' && (
          <>
            <p className="text-xs text-gray-500">Set up URL redirects so old links always point to the right page.</p>
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">From Path</label>
                <input value={newFrom} onChange={e => setNewFrom(e.target.value)} placeholder="/old-page" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">To Path</label>
                <input value={newTo} onChange={e => setNewTo(e.target.value)} placeholder="/new-page or https://..." className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs" />
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase">Type</label>
                  <select value={newCode} onChange={e => setNewCode(Number(e.target.value) as 301 | 302)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs">
                    <option value={301}>301 Permanent</option>
                    <option value={302}>302 Temporary</option>
                  </select>
                </div>
                <button onClick={handleAddRedirect} disabled={createRedirect.isPending} className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-xl flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {redirects.length === 0 && <p className="text-xs text-gray-400 text-center py-4">No redirects yet</p>}
              {(redirects as any[]).map((r: any) => (
                <div key={r.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl text-xs">
                  <span className={cn('shrink-0 px-1.5 py-0.5 rounded font-bold', r.status_code === 301 ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600')}>{r.status_code}</span>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="truncate text-gray-600">{r.from_path}</div>
                    <div className="truncate text-gray-400">→ {r.to_path}</div>
                  </div>
                  <span className="text-gray-400 shrink-0">{r.hit_count} hits</span>
                  <button onClick={() => deleteRedirect.mutateAsync(r.id).catch(() => toast.error('Failed'))} className="text-red-400 hover:text-red-600 shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* HEADLESS TAB */}
        {tab === 'headless' && (
          <>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-700">Headless API Mode</p>
                  <p className="text-xs text-gray-500">Expose your site content as a JSON API for custom frontends (Next.js, Vue, mobile).</p>
                </div>
                <div className={cn('w-8 h-5 rounded-full shrink-0 transition-colors cursor-pointer flex items-center', siteHeadless ? 'bg-primary' : 'bg-gray-300')}
                  onClick={() => siteHeadless ? disableHeadless.mutateAsync().catch(() => {}) : enableHeadless.mutateAsync().catch(() => {})}>
                  <div className={cn('w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5', siteHeadless ? 'translate-x-3' : 'translate-x-0')} />
                </div>
              </div>
              {siteHeadless && headlessToken && (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">API Token</div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-white border border-gray-200 px-2 py-1.5 rounded-lg font-mono truncate">{headlessToken}</code>
                    <button onClick={() => { navigator.clipboard.writeText(headlessToken); toast.success('Token copied!') }} className="shrink-0 p-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-xs font-bold text-gray-500 mt-2">Endpoint</div>
                  <code className="block text-xs bg-white border border-gray-200 px-2 py-1.5 rounded-lg font-mono break-all">
                    GET /api/v1/public/sites/{(site as any).subdomain || '{subdomain}'}<br/>
                    Authorization: Bearer {headlessToken.slice(0, 12)}...
                  </code>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sitemap</div>
              <button onClick={async () => {
                try {
                  const xml = await websiteApi.getSitemap(siteId)
                  const blob = new Blob([xml as any], { type: 'application/xml' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = 'sitemap.xml'; a.click()
                  toast.success('Sitemap downloaded!')
                } catch { toast.error('Failed to generate sitemap') }
              }} className="w-full py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2">
                <Download className="w-3.5 h-3.5" /> Download sitemap.xml
              </button>
              <p className="text-xs text-gray-400">Upload this file to your domain root or submit it to Google Search Console.</p>
            </div>

            {/* P2.6 robots.txt editor */}
            <RobotsTxtEditor siteId={siteId} site={site} />
          </>
        )}
      </div>
    </div>
  )
}


// ── P2.6 Robots.txt editor ────────────────────────────────────────────────────
function RobotsTxtEditor({ siteId, site }: { siteId: string; site: WebsiteSite }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState<string>(
    (site.style_config as any)?.robots_txt || ''
  )
  const [saving, setSaving] = useState(false)

  const defaultRobots = `User-agent: *\nAllow: /\n\nSitemap: https://${site.subdomain || 'yoursite'}.kiterp.com/sitemap.xml`

  const save = async () => {
    setSaving(true)
    try {
      await websiteApi.updateSite(siteId, {
        style_config: { ...(site.style_config || {}), robots_txt: value }
      } as any)
      toast.success('robots.txt saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2 pt-2 border-t border-gray-100">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-xs font-bold text-gray-500 uppercase tracking-wide"
      >
        <span>robots.txt Editor</span>
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="space-y-2">
          <textarea
            rows={8}
            value={value || defaultRobots}
            onChange={e => setValue(e.target.value)}
            placeholder={defaultRobots}
            className="w-full text-xs font-mono border border-gray-200 rounded-lg p-2 resize-y focus:ring-1 focus:ring-ring focus:border-primary/60 outline-none"
          />
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save robots.txt'}
          </button>
          <p className="text-xs text-gray-400">
            This is served at your domain's /robots.txt. The sitemap URL is automatically appended if not present.
          </p>
        </div>
      )}
    </div>
  )
}


// ── SEO Panel ─────────────────────────────────────────────────────────────────

function SEOPanel({
  siteId, activePage, site, onSavePage, onSaveSite,
}: {
  siteId: string
  activePage: WebsitePage | null
  site: WebsiteSite
  onSavePage: (data: Record<string, string>) => void
  onSaveSite: (data: Record<string, string>) => void
}) {
  const [tab, setTab] = useState<'page' | 'site'>('page')
  const [seoTitle, setSeoTitle] = useState(activePage?.seo_title || '')
  const [seoDesc, setSeoDesc] = useState(activePage?.seo_description || '')
  const [ogImage, setOgImage] = useState(activePage?.og_image_url || '')
  const [siteTitle, setSiteTitle] = useState((site as any).seo_title || '')
  const [siteDesc, setSiteDesc] = useState((site as any).seo_description || '')
  const [siteKw, setSiteKw] = useState((site as any).seo_keywords || '')
  const [aiResult, setAiResult] = useState<any>(null)
  const aiSEO = useAIGenerateSEO(siteId)
  const suggestBlocks = useAISuggestBlocks(siteId)
  const [suggestResult, setSuggestResult] = useState<any>(null)

  // Sync when page changes
  useEffect(() => {
    setSeoTitle(activePage?.seo_title || '')
    setSeoDesc(activePage?.seo_description || '')
    setOgImage(activePage?.og_image_url || '')
  }, [activePage?.id])

  const handleAIGenerate = async () => {
    if (!activePage) return
    try {
      const r = await aiSEO.mutateAsync({
        page_title: activePage.title,
        page_type: activePage.page_type,
        site_description: (site as any).description || site.name,
      })
      setAiResult(r)
      toast.success('SEO generated by AI!')
    } catch {
      toast.error('AI SEO generation failed')
    }
  }

  const applyAI = () => {
    if (!aiResult) return
    setSeoTitle(aiResult.seo_title)
    setSeoDesc(aiResult.seo_description)
    setAiResult(null)
  }

  const handleSuggestBlocks = async () => {
    if (!activePage) return
    try {
      const r = await suggestBlocks.mutateAsync({
        page_type: activePage.page_type,
        industry: (site as any).description ? undefined : 'general',
      })
      setSuggestResult(r)
    } catch {
      toast.error('Block suggestion failed')
    }
  }

  const titleLen = seoTitle.length
  const descLen = seoDesc.length

  return (
    <div className="p-4 space-y-4">
      {/* Tab switcher */}
      <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
        {(['page', 'site'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors', tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {t === 'page' ? '📄 This Page' : '🌐 Site-wide'}
          </button>
        ))}
      </div>

      {tab === 'page' && activePage && (
        <div className="space-y-3">
          {/* AI generate */}
          <button
            onClick={handleAIGenerate}
            disabled={aiSEO.isPending}
            className="w-full py-2 bg-gradient-to-r from-primary to-info text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            {aiSEO.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate SEO with AI
          </button>

          {/* AI result preview */}
          {aiResult && (
            <div className="p-3 bg-accent border border-primary/30 rounded-xl space-y-2">
              <div className="text-xs font-bold text-primary uppercase tracking-wide">AI Suggestion</div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-700">Title: {aiResult.seo_title}</p>
                <p className="text-xs text-gray-600 line-clamp-2">{aiResult.seo_description}</p>
                <p className="text-xs text-primary">Focus: <strong>{aiResult.focus_keyword}</strong></p>
              </div>
              <div className="flex gap-2">
                <button onClick={applyAI} className="flex-1 py-1.5 bg-primary text-white text-xs font-bold rounded-lg">Apply</button>
                <button onClick={() => setAiResult(null)} className="px-3 py-1.5 bg-white border border-gray-200 text-gray-500 text-xs rounded-lg">Dismiss</button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs font-medium text-gray-700">SEO Title</label>
              <span className={cn('text-xs', titleLen > 60 ? 'text-red-500' : titleLen > 50 ? 'text-amber-500' : 'text-gray-400')}>{titleLen}/60</span>
            </div>
            <input value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder={`${activePage.title} | ${site.name}`} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs font-medium text-gray-700">Meta Description</label>
              <span className={cn('text-xs', descLen > 160 ? 'text-red-500' : descLen > 140 ? 'text-amber-500' : 'text-gray-400')}>{descLen}/160</span>
            </div>
            <textarea value={seoDesc} onChange={e => setSeoDesc(e.target.value)} placeholder="Describe this page in 150-160 characters..." rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">OG / Social Image URL</label>
            <input value={ogImage} onChange={e => setOgImage(e.target.value)} placeholder="https://... or /uploads/..." className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
            {ogImage && <img src={mediaUrl(ogImage)} className="w-full h-20 object-cover rounded-xl border border-gray-100 mt-1" alt="OG preview" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
          </div>

          {/* SERP preview */}
          <div className="p-3 bg-white border border-gray-200 rounded-xl">
            <div className="text-xs text-gray-400 mb-1.5 font-semibold uppercase tracking-wide">Search Preview</div>
            <div className="text-xs text-blue-700 font-semibold truncate">{seoTitle || `${activePage.title} | ${site.name}`}</div>
            <div className="text-xs text-green-700">{(site as any).custom_domain || `${site.name?.toLowerCase().replace(/\s/g, '')}.site`}/{activePage.slug}</div>
            <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{seoDesc || 'No meta description set. Add one to improve search ranking.'}</div>
          </div>

          <button
            onClick={() => onSavePage({ seo_title: seoTitle, seo_description: seoDesc, og_image_url: ogImage })}
            className="w-full py-2 bg-gray-800 text-white text-xs font-bold rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-3.5 h-3.5" /> Save Page SEO
          </button>

          {/* AI Block Suggestions */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary/80" /> AI Layout Suggestions
            </div>
            <button onClick={handleSuggestBlocks} disabled={suggestBlocks.isPending} className="w-full py-2 border border-primary/30 text-primary text-xs font-medium rounded-xl hover:bg-accent flex items-center justify-center gap-2">
              {suggestBlocks.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Suggest Blocks for this Page
            </button>
            {suggestResult && (
              <div className="space-y-1.5">
                <p className="text-xs text-gray-500 italic">{suggestResult.reasoning}</p>
                <div className="space-y-1">
                  {suggestResult.blocks?.map((b: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                      <span className="text-xs font-bold text-primary shrink-0">{i + 1}.</span>
                      <div>
                        <div className="text-xs font-medium text-gray-700">{b.label}</div>
                        <div className="text-xs text-gray-400">{b.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'site' && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Site SEO Title</label>
            <input value={siteTitle} onChange={e => setSiteTitle(e.target.value)} placeholder={site.name} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Site Meta Description</label>
            <textarea value={siteDesc} onChange={e => setSiteDesc(e.target.value)} placeholder="Overall site description for search engines..." rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Keywords (comma-separated)</label>
            <input value={siteKw} onChange={e => setSiteKw(e.target.value)} placeholder="keyword1, keyword2, keyword3..." className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button
            onClick={() => onSaveSite({ seo_title: siteTitle, seo_description: siteDesc, seo_keywords: siteKw })}
            className="w-full py-2 bg-gray-800 text-white text-xs font-bold rounded-xl hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-3.5 h-3.5" /> Save Site SEO
          </button>
        </div>
      )}
    </div>
  )
}


// ── AI Studio Panel ───────────────────────────────────────────────────────────

type TextPromptOpts = {
  title: string
  subtitle?: string
  placeholder?: string
  initialValue?: string
  multiline?: boolean
  maxLength?: number
  confirmLabel?: string
  anchor?: { x: number; y: number } | null
  onSave: (v: string) => void
}

function AIStudioPanel({
  siteId, siteName, activePage, activeBlocks, selectedBlock, focusImageGenKey = 0, applyToImageLayer = false,
  onAddBlocks, onApplyStyle, onApplyImage, openTextPrompt,
}: {
  siteId: string
  siteName?: string | null
  activePage: WebsitePage | null
  activeBlocks: WebsiteBlock[]
  selectedBlock: WebsiteBlock | null
  focusImageGenKey?: number
  applyToImageLayer?: boolean
  onAddBlocks: (blocks: { block_type: string; props: BlockProps }[]) => Promise<void>
  onApplyStyle: (style: Partial<StyleConfig>) => Promise<void>
  onApplyImage: (url: string) => void
  openTextPrompt: (opts: TextPromptOpts) => void
}) {
  const [tab, setTab] = useState<'generate' | 'text' | 'screenshot' | 'clone' | 'review' | 'image' | 'theme'>('generate')
  const [prompt, setPrompt] = useState('')
  const [tone, setTone] = useState('professional')
  const [result, setResult] = useState('')
  const [alternatives, setAlternatives] = useState<string[]>([])
  const [url, setUrl] = useState('')
  const [brandDesc, setBrandDesc] = useState('')
  const [industry, setIndustry] = useState('')
  const [mood, setMood] = useState('professional')
  const [uxReview, setUxReview] = useState<any>(null)
  const [cloneResult, setCloneResult] = useState<any>(null)
  const [screenshotResult, setScreenshotResult] = useState<any>(null)
  const [themeResult, setThemeResult] = useState<any>(null)
  // Generate site state
  const [genBizDesc, setGenBizDesc] = useState('')
  const [genNiche, setGenNiche] = useState('')
  const [genTone, setGenTone] = useState('professional')
  const [genIncludePricing, setGenIncludePricing] = useState(true)
  const [genIncludeBlog, setGenIncludeBlog] = useState(false)
  const [genResult, setGenResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const aiText = useAIGenerateText(siteId)
  const aiUrlClone = useAIUrlClone(siteId)
  const aiScreenshot = useAIScreenshotToUI(siteId)
  const aiUxReview = useAIUxReview(siteId)
  const aiTheme = useAIGenerateTheme(siteId)
  const aiGenSite = useAIGenerateSite(siteId)
  const aiApplyGenSite = useAIApplyGeneratedSite(siteId)

  const isLoading = aiText.isPending || aiUrlClone.isPending || aiScreenshot.isPending || aiUxReview.isPending || aiTheme.isPending || aiGenSite.isPending

  useEffect(() => {
    if (focusImageGenKey > 0) setTab('image')
  }, [focusImageGenKey])

  const tabs = [
    { id: 'generate',   label: '✨ Generate' },
    { id: 'text',       label: 'Text' },
    { id: 'screenshot', label: 'Screenshot' },
    { id: 'clone',      label: 'Clone URL' },
    { id: 'review',     label: 'UX Review' },
    { id: 'image',      label: 'Image Gen' },
    { id: 'theme',      label: 'Theme' },
  ] as const

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-3 border-b border-gray-100">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn('px-2.5 py-1 rounded-lg text-xs font-medium transition-colors', tab === t.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* GENERATE SITE */}
        {tab === 'generate' && (
          <>
            <div className="p-3 bg-gradient-to-r from-accent to-info/15 border border-primary/20 rounded-xl">
              <p className="text-xs font-medium text-primary mb-0.5">One-Prompt Site Generator</p>
              <p className="text-xs text-primary">Describe your business and AI builds the full site structure, copy, and theme instantly.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Business Description *</label>
              <textarea
                value={genBizDesc}
                onChange={e => setGenBizDesc(e.target.value)}
                placeholder="E.g. We are a boutique law firm in Dubai specialising in corporate and IP law for tech startups..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs h-24 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Niche (optional)</label>
                <input value={genNiche} onChange={e => setGenNiche(e.target.value)} placeholder="saas, restaurant, law..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Tone</label>
                <select value={genTone} onChange={e => setGenTone(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs">
                  {[
                    { id: 'professional', label: '💼 Professional' },
                    { id: 'friendly',     label: '😊 Friendly' },
                    { id: 'bold',         label: '⚡ Bold' },
                    { id: 'luxury',       label: '💎 Luxury' },
                    { id: 'gen_z',        label: '🔥 Gen Z' },
                    { id: 'empathetic',   label: '💙 Empathetic' },
                    { id: 'persuasive',   label: '🎯 Persuasive' },
                    { id: 'corporate',    label: '🏢 Corporate' },
                  ].map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={genIncludePricing} onChange={e => setGenIncludePricing(e.target.checked)} className="rounded text-primary" />
                Include Pricing page
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={genIncludeBlog} onChange={e => setGenIncludeBlog(e.target.checked)} className="rounded text-primary" />
                Include Blog page
              </label>
            </div>
            <button
              onClick={async () => {
                if (!genBizDesc.trim()) { toast.error('Please describe your business'); return }
                try {
                  const r = await aiGenSite.mutateAsync({
                    business_description: genBizDesc,
                    niche: genNiche || undefined,
                    tone: genTone,
                    include_pricing: genIncludePricing,
                    include_blog: genIncludeBlog,
                  })
                  setGenResult(r)
                  toast.success(`AI generated ${r.pages.length} pages!`)
                } catch { toast.error('Site generation failed') }
              }}
              disabled={!genBizDesc || isLoading}
              className="w-full py-2.5 bg-gradient-to-r from-primary to-info text-white text-xs font-bold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {aiGenSite.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiGenSite.isPending ? 'Generating your site...' : 'Generate Full Site with AI'}
            </button>

            {genResult && (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-xs font-bold text-emerald-600 mb-1">AI Generated Site Preview</div>
                  <p className="text-xs font-bold text-gray-800">{genResult.site_name}</p>
                  <p className="text-xs text-gray-500 italic">{genResult.tagline}</p>
                  <p className="text-xs text-gray-500 mt-1">{genResult.summary}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {genResult.pages?.map((pg: any) => (
                      <span key={pg.slug} className="text-xs bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 font-semibold">{pg.title}</span>
                    ))}
                  </div>
                  <div className="flex gap-1 mt-2">
                    {genResult.style_config?.primary_color && (
                      <div style={{ backgroundColor: genResult.style_config.primary_color }} className="w-5 h-5 rounded" title="Primary" />
                    )}
                    {genResult.style_config?.accent_color && (
                      <div style={{ backgroundColor: genResult.style_config.accent_color }} className="w-5 h-5 rounded" title="Accent" />
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    openTextPrompt({
                      title: `Apply AI site to "${siteName || 'this site'}"?`,
                      subtitle: 'This will replace ALL existing pages and blocks with the AI-generated layout.',
                      placeholder: '',
                      confirmLabel: 'Apply AI site',
                      onSave: async () => {
                        try {
                          await aiApplyGenSite.mutateAsync(genResult)
                          setGenResult(null)
                          toast.success('AI site applied! Your pages have been rebuilt.')
                        } catch { toast.error('Failed to apply site') }
                      },
                    })
                  }}
                  disabled={aiApplyGenSite.isPending}
                  className="w-full py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 flex items-center justify-center gap-2"
                >
                  {aiApplyGenSite.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Apply to Site (replaces pages)
                </button>
                <button onClick={() => setGenResult(null)} className="w-full py-1.5 border border-gray-200 text-gray-500 text-xs rounded-xl hover:bg-gray-50">
                  Discard
                </button>
              </div>
            )}
          </>
        )}

        {/* TEXT GEN */}
        {tab === 'text' && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Tone</label>
              <select value={tone} onChange={e => setTone(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs">
                {[
                  { id: 'professional', label: '💼 Professional' },
                  { id: 'friendly',     label: '😊 Friendly' },
                  { id: 'bold',         label: '⚡ Bold' },
                  { id: 'minimalist',   label: '⬜ Minimalist' },
                  { id: 'luxury',       label: '💎 Luxury' },
                  { id: 'gen_z',        label: '🔥 Gen Z' },
                  { id: 'empathetic',   label: '💙 Empathetic' },
                  { id: 'casual',       label: '😎 Casual' },
                  { id: 'persuasive',   label: '🎯 Persuasive' },
                  { id: 'corporate',    label: '🏢 Corporate' },
                ].map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">What do you need?</label>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="E.g. A catchy headline for a SaaS product landing page..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs h-20 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={async () => {
                try {
                  const r = await aiText.mutateAsync({ prompt, tone: tone as any })
                  setResult(r.result)
                  setAlternatives(r.alternatives)
                } catch { toast.error('AI text generation failed') }
              }}
              disabled={!prompt || isLoading}
              className="w-full py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Generate Text
            </button>
            {result && (
              <div className="space-y-2">
                <div className="p-3 bg-accent border border-primary/20 rounded-lg">
                  <p className="text-xs text-gray-700">{result}</p>
                  <button onClick={() => { navigator.clipboard.writeText(result); toast.success('Copied!') }} className="mt-2 text-xs text-primary hover:underline">Copy</button>
                </div>
                {alternatives.map((alt, i) => (
                  <div key={i} className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
                    <p className="text-xs text-gray-600">{alt}</p>
                    <button onClick={() => { navigator.clipboard.writeText(alt); toast.success('Copied!') }} className="mt-2 text-xs text-primary hover:underline">Copy</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* SCREENSHOT */}
        {tab === 'screenshot' && (
          <>
            <div className="text-xs text-gray-500 leading-relaxed">
              Upload a screenshot of any website. AI will analyze the layout and generate matching editable blocks.
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = async ev => {
                  const b64 = (ev.target?.result as string).split(',')[1]
                  try {
                    const r = await aiScreenshot.mutateAsync({ imageBase64: b64 })
                    setScreenshotResult(r)
                    toast.success('Screenshot analyzed!')
                  } catch { toast.error('Analysis failed') }
                }
                reader.readAsDataURL(file)
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="w-full py-8 border-2 border-dashed border-primary/30 rounded-xl flex flex-col items-center gap-2 text-primary/80 hover:bg-accent transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
              <span className="text-xs font-medium">{isLoading ? 'Analyzing...' : 'Upload Screenshot'}</span>
              <span className="text-xs text-gray-400">PNG, JPG, WebP</span>
            </button>
            {screenshotResult && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">
                    Detected: {screenshotResult.website_type} ({Math.round(screenshotResult.confidence * 100)}% confidence)
                  </span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {screenshotResult.detected_colors?.map((c: string) => (
                    <div key={c} style={{ backgroundColor: c }} className="w-5 h-5 rounded" title={c} />
                  ))}
                </div>
                <div className="text-xs text-gray-500">{screenshotResult.detected_sections?.join(', ')}</div>
                <button
                  onClick={() => { onAddBlocks(screenshotResult.suggested_blocks); toast.success(`${screenshotResult.suggested_blocks.length} blocks added!`) }}
                  className="w-full py-2 bg-primary text-white text-xs font-medium rounded-lg"
                >
                  Apply {screenshotResult.suggested_blocks?.length} Blocks to Page
                </button>
              </div>
            )}
          </>
        )}

        {/* URL CLONE */}
        {tab === 'clone' && (
          <>
            <div className="text-xs text-gray-500 leading-relaxed">
              Paste any website URL. AI extracts its design language — colors, fonts, layout — and generates a similar structure.
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Website URL</label>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={async () => {
                try {
                  const r = await aiUrlClone.mutateAsync({ url })
                  setCloneResult(r)
                  toast.success('Site analyzed!')
                } catch { toast.error('Clone analysis failed') }
              }}
              disabled={!url || isLoading}
              className="w-full py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
              Analyze & Clone Style
            </button>
            {cloneResult && (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs font-bold text-gray-400 mb-2">Detected Color Palette</div>
                  <div className="flex gap-1">
                    {cloneResult.color_palette?.map((c: string) => (
                      <div key={c} style={{ backgroundColor: c }} className="w-6 h-6 rounded" title={c} />
                    ))}
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">{cloneResult.layout_notes}</div>
                <button onClick={() => onApplyStyle(cloneResult.style_config)} className="w-full py-2 bg-primary text-white text-xs font-medium rounded-lg">
                  Apply Style to Site
                </button>
                <button onClick={() => onAddBlocks(cloneResult.detected_blocks)} className="w-full py-2 bg-primary text-white text-xs font-medium rounded-lg">
                  Add Detected Blocks
                </button>
              </div>
            )}
          </>
        )}

        {/* UX REVIEW */}
        {tab === 'review' && (
          <>
            <div className="text-xs text-gray-500">AI analyzes your site for UX, SEO, contrast, CTAs, and conversion issues.</div>
            <button
              onClick={async () => {
                try {
                  const r = await aiUxReview.mutateAsync(activePage?.id)
                  setUxReview(r)
                } catch { toast.error('Review failed') }
              }}
              disabled={isLoading}
              className="w-full py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Run AI UX Review
            </button>
            {uxReview && (
              <div className="space-y-3">
                {/* Score */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={cn('text-3xl font-extrabold', uxReview.score >= 80 ? 'text-emerald-600' : uxReview.score >= 60 ? 'text-amber-600' : 'text-red-600')}>{uxReview.score}</div>
                  <div>
                    <div className="text-xs font-medium">UX Score</div>
                    <div className="text-xs text-gray-400">{uxReview.score >= 80 ? 'Great!' : uxReview.score >= 60 ? 'Good, some improvements' : 'Needs work'}</div>
                  </div>
                </div>
                {/* Issues */}
                {uxReview.issues?.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Issues</div>
                    {uxReview.issues.map((issue: any, i: number) => (
                      <div key={i} className={cn('flex gap-2 p-2 rounded-lg mb-1 text-xs', issue.severity === 'high' ? 'bg-red-50 text-red-700' : issue.severity === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-600')}>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{issue.message}</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Strengths */}
                {uxReview.strengths?.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Strengths</div>
                    {uxReview.strengths.map((s: string, i: number) => (
                      <div key={i} className="flex gap-2 p-2 rounded-lg mb-1 text-xs bg-emerald-50 text-emerald-700">
                        <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />{s}
                      </div>
                    ))}
                  </div>
                )}
                {/* Suggestions */}
                {uxReview.suggestions?.length > 0 && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1.5">Suggestions</div>
                    {uxReview.suggestions.slice(0, 5).map((s: any, i: number) => (
                      <div key={i} className="flex gap-2 p-2 rounded-lg mb-1 text-xs bg-blue-50 text-blue-700">
                        <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" />{s.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* IMAGE GEN */}
        {tab === 'image' && (
          <ImageGenPanel
            siteId={siteId}
            selectedBlock={selectedBlock}
            applyToImageLayer={applyToImageLayer}
            onApplyImage={onApplyImage}
          />
        )}

        {/* THEME GEN */}
        {tab === 'theme' && (
          <>
            <div className="text-xs text-gray-500">Describe your brand and AI generates a complete matching theme.</div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600">Brand Description</label>
              <textarea
                value={brandDesc}
                onChange={e => setBrandDesc(e.target.value)}
                placeholder="We are a sustainable fashion brand targeting eco-conscious millennials..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs h-20 resize-none focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Industry</label>
                <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="Fashion, SaaS..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Mood</label>
                <select value={mood} onChange={e => setMood(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs">
                  {['professional', 'playful', 'luxury', 'minimal', 'bold'].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  const r = await aiTheme.mutateAsync({ brand_description: brandDesc, industry, mood })
                  setThemeResult(r)
                } catch { toast.error('Theme generation failed') }
              }}
              disabled={!brandDesc || isLoading}
              className="w-full py-2 bg-primary text-white text-xs font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              Generate Theme
            </button>
            {themeResult && (
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">{themeResult.mood_description}</div>
                <div>
                  <div className="text-xs font-bold text-gray-400 mb-1.5">Color Palette</div>
                  <div className="flex gap-1">
                    {themeResult.color_palette?.map((c: string) => (
                      <div key={c} style={{ backgroundColor: c }} className="w-7 h-7 rounded-lg" title={c} />
                    ))}
                  </div>
                </div>
                <div className="text-xs">
                  <span className="font-semibold">Heading:</span> {themeResult.font_pairing?.heading} &nbsp;|&nbsp;
                  <span className="font-semibold">Body:</span> {themeResult.font_pairing?.body}
                </div>
                <button onClick={() => onApplyStyle(themeResult.style_config)} className="w-full py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90">
                  Apply This Theme
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Image Gen Panel ───────────────────────────────────────────────────────────

const IMAGE_STYLES = [
  { id: 'photorealistic', label: '📷 Photo', emoji: '📷', desc: 'Ultra-realistic professional photograph, studio quality' },
  { id: '3d',             label: '🎨 3D',    emoji: '🎨', desc: 'Octane/Blender 3D render, dramatic lighting' },
  { id: 'illustration',   label: '✏️ Illustr', emoji: '✏️', desc: 'Professional vector digital illustration' },
  { id: 'cinematic',      label: '🎬 Cinema', emoji: '🎬', desc: 'Film-like, golden hour, anamorphic lens' },
  { id: 'minimalist',     label: '⬜ Minimal', emoji: '⬜', desc: 'Clean, lots of white space, Scandinavian' },
  { id: 'abstract',       label: '🌊 Abstract', emoji: '🌊', desc: 'Flowing shapes, rich gradients, artistic' },
  { id: 'watercolor',     label: '🎨 Watercolor', emoji: '🎨', desc: 'Soft brush strokes, organic watercolor' },
  { id: 'flat',           label: '📐 Flat',  emoji: '📐', desc: 'Flat design, bold colors, icon-quality' },
  { id: 'glassmorphism',  label: '💎 Glass', emoji: '💎', desc: 'Frosted glass, translucent, vivid gradients' },
  { id: 'neon',           label: '💡 Neon',  emoji: '💡', desc: 'Neon glow, dark BG, cyberpunk-inspired' },
]

const BLOCK_CONTEXT_MAP: Record<string, { context: string; prompts: string[] }> = {
  hero: {
    context: 'hero',
    prompts: [
      'Stunning aerial city view at dusk with vibrant lights',
      'Professional team celebrating success in a modern office',
      'Abstract flowing gradient mesh in violet and blue tones',
      'Minimalist product flat lay on clean white marble',
      'Dramatic mountain landscape with golden sunlight rays',
    ],
  },
  hero_split: {
    context: 'hero',
    prompts: [
      'Confident professional woman smiling in bright studio',
      'Sleek product on clean white background with soft shadow',
      'Happy diverse team collaborating around a table',
      'Modern smartphone with glowing UI on neutral background',
    ],
  },
  team_grid: {
    context: 'team',
    prompts: [
      'Professional headshot of a smiling person in modern office',
      'Confident executive in a suit against a blurred office background',
      'Friendly professional with natural daylight portrait',
    ],
  },
  about_split: {
    context: 'about',
    prompts: [
      'Team working together in a bright creative studio',
      'Founder at work in a modern loft office with plants',
      'Authentic business meeting with warmth and collaboration',
    ],
  },
  features: {
    context: 'background',
    prompts: [
      'Subtle geometric pattern on white background, very light',
      'Soft abstract gradient background, professional website',
      'Clean isometric 3D icons floating on white background',
    ],
  },
  cta: {
    context: 'background',
    prompts: [
      'Bold vibrant gradient background, violet to blue, professional',
      'Dark sophisticated background with subtle texture',
      'Abstract background with glowing neon lines on dark surface',
    ],
  },
}

const IMAGE_QUICK_PROMPTS_BY_CAT = {
  'Popular': [
    'Professional team in a bright modern open office, natural light',
    'Abstract gradient background, violet to indigo, smooth curves',
    'Sleek product showcase on marble surface, professional photography',
    'City skyline at sunset with dramatic warm golden light',
    'Clean minimal workspace with laptop, coffee, and plants',
  ],
  'Business': [
    'Confident business professionals shaking hands in glass office',
    'Modern coworking space with people working on laptops',
    'Board meeting with diverse team around a white table',
    'Executive portrait, professional suit, blurred office background',
  ],
  'Creative': [
    'Colorful paint brushes and art supplies on wooden table',
    'Creative studio with mood boards and design tools',
    'Abstract digital art with flowing neon lights on dark background',
    'Vibrant mural on a textured brick wall, urban art',
  ],
  'E-Commerce': [
    'Product flat lay on white background, professional studio lighting',
    'Luxury perfume bottle on marble with roses and soft shadows',
    'Fashion clothing on minimalist white rack, editorial style',
    'Food photography, gourmet dish on dark slate, top down view',
  ],
  'Nature & Life': [
    'Breathtaking mountain vista with misty clouds at dawn',
    'Tropical beach with turquoise water and white sand, aerial view',
    'Lush green forest path with sunlight filtering through trees',
    'Fresh vegetables and herbs on wooden farmhouse table',
  ],
}

const ASPECT_RATIOS = [
  { id: '16:9', label: '16:9', hint: 'Hero / Banner' },
  { id: '3:2',  label: '3:2',  hint: 'Blog / Card' },
  { id: '1:1',  label: '1:1',  hint: 'Product / Avatar' },
  { id: '9:16', label: '9:16', hint: 'Story / Portrait' },
]

function ImageGenPanel({
  siteId, selectedBlock, applyToImageLayer = false, onApplyImage,
}: {
  siteId: string
  selectedBlock: WebsiteBlock | null
  applyToImageLayer?: boolean
  onApplyImage: (url: string) => void
}) {
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState('photorealistic')
  const [ratio, setRatio] = useState('16:9')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [results, setResults] = useState<{ url: string; prompt: string; saved?: boolean }[]>([])
  const [activeResult, setActiveResult] = useState<{ url: string; prompt: string; saved?: boolean } | null>(null)
  const [history, setHistory] = useState<{ url: string; prompt: string; saved?: boolean }[]>([])
  const [promptCat, setPromptCat] = useState<keyof typeof IMAGE_QUICK_PROMPTS_BY_CAT>('Popular')
  const [enhancedPrompt, setEnhancedPrompt] = useState('')
  const aiImage = useAIGenerateImage(siteId)
  const aiEnhance = useAIEnhancePrompt(siteId)
  const saveUrl = useSaveExternalUrl(siteId)
  const { refetch: refetchMedia } = useMedia(siteId)

  // Auto-detect context from selected block
  const blockCtx = selectedBlock ? BLOCK_CONTEXT_MAP[selectedBlock.block_type] : null

  const handleEnhance = async () => {
    if (!prompt.trim()) return
    try {
      const r = await aiEnhance.mutateAsync({
        prompt,
        style,
        block_context: blockCtx?.context,
      })
      setEnhancedPrompt(r.enhanced_prompt)
      toast.success('Prompt enhanced!')
    } catch {
      toast.error('Could not enhance prompt')
    }
  }

  const handleGenerate = async (useEnhanced = false) => {
    const finalPrompt = useEnhanced && enhancedPrompt ? enhancedPrompt : prompt
    if (!finalPrompt.trim()) return
    setResults([])
    try {
      const r = await aiImage.mutateAsync({
        prompt: finalPrompt,
        style,
        aspectRatio: ratio,
      })
      const url = mediaUrl(r.url)
      const item = { url, prompt: finalPrompt, saved: (r as any).saved === true }
      setResults([item])
      setActiveResult(item)
      setHistory(h => [item, ...h.slice(0, 29)])
      if (item.saved) {
        refetchMedia()
        toast.success('Image generated & saved to media library!')
      } else {
        toast.success('Image generated!')
      }
    } catch {
      toast.error('Image generation failed. Check your connection and try again.')
    }
  }

  const handleSaveToLibrary = async (url: string, p: string) => {
    try {
      await saveUrl.mutateAsync({ url, label: p })
      refetchMedia()
      setHistory(h => h.map(i => i.url === url ? { ...i, saved: true } : i))
      if (activeResult?.url === url) setActiveResult(prev => prev ? { ...prev, saved: true } : null)
      toast.success('Saved to media library!')
    } catch {
      toast.error('Could not save to library')
    }
  }

  return (
    <div className="space-y-3">
      {/* Context hint */}
      {blockCtx && (
        <div className="px-3 py-2 bg-accent border border-primary/20 rounded-lg flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary/80 shrink-0" />
          <span className="text-xs text-primary">
            Showing suggestions for <strong>{selectedBlock?.block_type?.replace(/_/g, ' ')}</strong> block
          </span>
        </div>
      )}

      {/* Prompt + Enhance */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-700">Image Description</label>
          <button
            onClick={handleEnhance}
            disabled={!prompt.trim() || aiEnhance.isPending}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 disabled:opacity-40 transition-colors"
          >
            {aiEnhance.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
            Enhance with AI
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={e => { setPrompt(e.target.value); setEnhancedPrompt('') }}
          placeholder="Describe the image… e.g. 'Professional woman in a modern office with natural lighting'"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs h-[72px] resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
        {/* Enhanced prompt preview */}
        {enhancedPrompt && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1 text-xs font-bold text-amber-600 uppercase tracking-wide">
              <Wand2 className="w-3 h-3" /> AI-Enhanced Prompt
            </div>
            <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">{enhancedPrompt}</p>
            <div className="flex gap-1.5">
              <button
                onClick={() => handleGenerate(true)}
                disabled={aiImage.isPending}
                className="flex-1 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> Generate Enhanced
              </button>
              <button onClick={() => { setPrompt(enhancedPrompt); setEnhancedPrompt('') }} className="px-2 py-1.5 bg-white border border-amber-200 text-amber-600 text-xs rounded-lg hover:bg-amber-50">
                Use as prompt
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts by category */}
      <div>
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          {(blockCtx ? ['Context', ...Object.keys(IMAGE_QUICK_PROMPTS_BY_CAT)] : Object.keys(IMAGE_QUICK_PROMPTS_BY_CAT)).map(cat => (
            <button
              key={cat}
              onClick={() => setPromptCat(cat === 'Context' ? 'Popular' : cat as any)}
              className={cn('px-2 py-0.5 rounded-full text-xs font-bold transition-colors', (cat === 'Context' && blockCtx) || promptCat === cat ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="space-y-0.5">
          {(blockCtx ? blockCtx.prompts : IMAGE_QUICK_PROMPTS_BY_CAT[promptCat] || []).map((qp, i) => (
            <button
              key={i}
              onClick={() => { setPrompt(qp); setEnhancedPrompt('') }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-accent hover:text-primary text-xs text-gray-600 transition-colors border border-transparent hover:border-primary/30 truncate"
            >
              {qp}
            </button>
          ))}
        </div>
      </div>

      {/* Style picker */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1.5 block">Visual Style</label>
        <div className="grid grid-cols-5 gap-1">
          {IMAGE_STYLES.map(s => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              title={s.desc}
              className={cn(
                'py-2 px-1 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-0.5',
                style === s.id
                  ? 'bg-primary text-white border-primary shadow-md'
                  : 'text-gray-500 border-gray-200 hover:border-primary/40 hover:bg-accent'
              )}
            >
              <span className="text-sm leading-none">{s.emoji}</span>
              <span className="leading-none truncate w-full text-center">{s.label.split(' ')[1]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Aspect ratio */}
      <div>
        <label className="text-xs font-medium text-gray-700 mb-1.5 block">Aspect Ratio</label>
        <div className="grid grid-cols-4 gap-1">
          {ASPECT_RATIOS.map(ar => (
            <button
              key={ar.id}
              onClick={() => setRatio(ar.id)}
              title={ar.hint}
              className={cn(
                'py-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-0.5',
                ratio === ar.id ? 'bg-primary text-white border-primary' : 'text-gray-500 border-gray-200 hover:border-primary/40'
              )}
            >
              <span>{ar.id}</span>
              <span className={cn('text-[8px] font-normal', ratio === ar.id ? 'text-primary-foreground/85' : 'text-gray-400')}>{ar.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Advanced: negative prompt */}
      <div>
        <button onClick={() => setShowAdvanced(v => !v)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
          <ChevronRight className={cn('w-3 h-3 transition-transform', showAdvanced && 'rotate-90')} /> Advanced options
        </button>
        {showAdvanced && (
          <div className="mt-1.5 space-y-1.5">
            <label className="text-xs font-medium text-gray-600">Negative Prompt (what to avoid)</label>
            <input
              value={negativePrompt}
              onChange={e => setNegativePrompt(e.target.value)}
              placeholder="blurry, low quality, watermark, text..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}
      </div>

      {/* Generate button */}
      <button
        onClick={() => handleGenerate(false)}
        disabled={!prompt.trim() || aiImage.isPending}
        className="w-full py-3 bg-gradient-to-r from-primary via-primary to-info text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40"
      >
        {aiImage.isPending ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Generating… (15-30s)</>
        ) : (
          <><Sparkles className="w-4 h-4" /> Generate Image</>
        )}
      </button>

      {/* Result preview */}
      {activeResult && (
        <div className="rounded-2xl border-2 border-primary/30 overflow-hidden bg-white shadow-lg">
          <div className="relative">
            <img
              src={activeResult.url}
              className="w-full object-cover"
              style={{ maxHeight: 220 }}
              alt="AI Generated"
              onError={e => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${Math.random()}/640/360` }}
            />
            <div className="absolute top-2 left-2 flex gap-1">
              <div className="bg-black/60 text-white text-xs font-bold px-2 py-0.5 rounded-full">AI Generated</div>
              {activeResult.saved && (
                <div className="bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <Check className="w-2.5 h-2.5" /> Saved
                </div>
              )}
            </div>
          </div>
          <div className="p-3 space-y-2">
            <p className="text-xs text-gray-500 line-clamp-2 italic">"{activeResult.prompt}"</p>
            <div className="flex gap-2">
              <button
                onClick={() => onApplyImage(activeResult.url)}
                className="flex-1 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                {!selectedBlock ? 'Select a Block First' : applyToImageLayer ? 'Apply to Image Layer' : 'Apply to Block'}
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(activeResult.url); toast.success('URL copied!') }}
                className="px-3 py-2 bg-gray-100 text-gray-600 text-xs rounded-xl hover:bg-gray-200 transition-colors"
                title="Copy URL"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            {!activeResult.saved && (
              <button
                onClick={() => handleSaveToLibrary(activeResult.url, activeResult.prompt)}
                disabled={saveUrl.isPending}
                className="w-full py-1.5 border border-emerald-200 text-emerald-600 text-xs font-medium rounded-xl hover:bg-emerald-50 flex items-center justify-center gap-1.5 transition-colors"
              >
                {saveUrl.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                Save to Media Library
              </button>
            )}
            {selectedBlock && applyToImageLayer && (
              <p className="text-xs text-emerald-700 text-center bg-emerald-50 py-1.5 rounded-lg">
                Applying to the selected image layer on the canvas
              </p>
            )}
            {!selectedBlock && (
              <p className="text-xs text-amber-600 text-center bg-amber-50 py-1.5 rounded-lg">
                ← Click a block on the canvas to apply this image
              </p>
            )}
          </div>
        </div>
      )}

      {/* History grid */}
      {history.length > 1 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-400">History ({history.length})</span>
            <button onClick={() => setHistory([])} className="text-xs text-gray-400 hover:text-red-400">Clear</button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {history.map((img, i) => (
              <div
                key={i}
                className={cn(
                  'group relative aspect-video rounded-xl overflow-hidden border-2 transition-all cursor-pointer',
                  activeResult?.url === img.url ? 'border-primary shadow-md' : 'border-transparent hover:border-primary/40'
                )}
                onClick={() => setActiveResult(img)}
              >
                <img src={img.url} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-1">
                  <button onClick={e => { e.stopPropagation(); onApplyImage(img.url) }} className="px-2 py-1 bg-primary rounded text-xs font-bold text-white">Use</button>
                  {!img.saved && <button onClick={e => { e.stopPropagation(); handleSaveToLibrary(img.url, img.prompt) }} className="px-2 py-1 bg-white rounded text-xs font-bold text-gray-700">Save</button>}
                </div>
                {img.saved && <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Tiny icon component to avoid import conflict
function MousePointerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
    </svg>
  )
}
