import { z } from "zod";
import {
  ShoppingBag,
  LayoutGrid,
  GalleryHorizontal,
  Star,
  Package,
  ShoppingCart,
  Tag,
  Briefcase,
  List,
  CreditCard,
  Sparkles,
  UtensilsCrossed,
  Soup,
  Flame,
  HelpCircle,
  Calendar,
  Clock,
  ClipboardList,
  CalendarCheck,
  MessageSquare,
  Columns3,
  Boxes,
  History,
  Search as SearchIcon,
  SlidersHorizontal,
  Heart,
  Bell,
  BadgePercent,
  Truck,
  Award,
  Quote,
  ListChecks,
  Users,
  PlusCircle,
  Wine,
  UtensilsCrossed as UtensilsIcon,
  Activity,
  Building2,
  Workflow,
  Mail,
  CalendarRange,
  CreditCard as CreditCardIcon,
  MapPin,
  CheckCircle2,
  Gift,
  Wallet,
  Users as UsersIcon,
  Repeat,
  Hourglass,
  Inbox,
  Loader2,
  AlertTriangle,
  Home as HomeIcon,
  Building,
  Car,
  Dumbbell,
  Ticket,
  GraduationCap,
  PlayCircle,
} from "lucide-react";

import type { BlockDefinition, BlockCategory } from "./types";

import { ProductGrid, ProductList, ProductCarousel } from "./products/ProductGrid";
import { FeaturedProduct } from "./products/FeaturedProduct";
import { ProductDetail } from "./products/ProductDetail";
import { MiniCart } from "./products/MiniCart";
import { CategoryShowcase } from "./products/CategoryShowcase";

import { ServiceList, ServiceCardGrid, ServiceDetail } from "./services/ServiceBlocks";
import { PricingTiers } from "./services/PricingTiers";

import {
  CategorizedMenu,
  MenuItemDetail,
  DailySpecials,
  AllergenLegend,
} from "./menu/MenuBlocks";

import {
  AvailabilityCalendar,
  TimeSlotPicker,
  BookingForm,
  BookingSummary,
} from "./bookings/BookingBlocks";

import {
  ProductReviews,
  ComparisonTable,
  ProductBundle,
  ProductRow,
  SearchResults,
  FiltersSidebar,
  WishlistBlock,
  StockNotifier,
  PromoBanner,
  OrderTracking,
  LoyaltyWidget,
} from "./products/ProductExtras";

import {
  Testimonials,
  ProcessSteps,
  FAQBlock,
  TeamPicker,
  AddonsSelector,
} from "./services/ServiceExtras";

import { WinePairing, ComboMenu, NutritionTable } from "./menu/MenuExtras";

import {
  ResourcePicker,
  BookingWizard,
  ConfirmationEmail,
  PastBookings,
} from "./bookings/BookingExtras";

import {
  Checkout,
  AddressBook,
  OrderConfirmation,
  GiftCards,
} from "./commerce/CheckoutBlocks";

import {
  GroupBooking,
  RecurringBooking,
  WaitlistBlock,
} from "./bookings/BookingGapBlocks";

import { EmptyState, SkeletonLoader, ErrorState } from "./states/StateBlocks";

import { PropertyListing, PropertyDetail } from "./verticals/RealEstateBlocks";
import { AutoInventory, VehicleDetail } from "./verticals/AutoBlocks";
import { FitnessScheduler } from "./verticals/FitnessBlocks";
import { EventListing, TicketPicker } from "./verticals/EventBlocks";
import { CourseCatalog, CourseDetail } from "./verticals/CourseBlocks";

/* ---------- Products ---------- */

const productGridProps = z.object({
  columns: z.number().min(2).max(5).default(3),
  showPrice: z.boolean().default(true),
  showTags: z.boolean().default(true),
  showRating: z.boolean().default(false),
  title: z.string().default("Shop our latest"),
  cta: z.string().default("Add to cart"),
});

const productListPageBlock: BlockDefinition = {
  id: "product.grid",
  slug: "products/grid",
  category: "products",
  name: "Product Grid",
  description: "Responsive product listing with grid, list, and carousel layouts.",
  icon: LayoutGrid,
  isLive: true,
  propsSchema: productGridProps,
  defaultProps: productGridProps.parse({}),
  variants: [
    { id: "grid", name: "Grid", description: "Responsive grid layout", Component: ProductGrid },
    { id: "carousel", name: "Carousel", description: "Horizontal scroll", Component: ProductCarousel },
    { id: "list", name: "List", description: "Detailed list rows", Component: ProductList },
  ],
};

const featuredProductProps = z.object({
  productId: z.string().default("p6"),
  layout: z.enum(["imageLeft", "imageRight"]).default("imageLeft"),
  background: z.enum(["muted", "accent", "transparent"]).default("muted"),
  cta: z.string().default("Shop now"),
  showCompareAt: z.boolean().default(true),
});

const featuredProductBlock: BlockDefinition = {
  id: "product.featured",
  slug: "products/featured",
  category: "products",
  name: "Featured Product",
  description: "Hero spotlight for a single product with image and CTA.",
  icon: Star,
  isLive: true,
  propsSchema: featuredProductProps,
  defaultProps: featuredProductProps.parse({}),
  variants: [
    { id: "imageLeft", name: "Image left", Component: (p) => <FeaturedProduct {...p} layout="imageLeft" /> },
    { id: "imageRight", name: "Image right", Component: (p) => <FeaturedProduct {...p} layout="imageRight" /> },
  ],
};

const productDetailProps = z.object({
  productId: z.string().default("p1"),
  showRating: z.boolean().default(true),
  showTrustBadges: z.boolean().default(true),
  cta: z.string().default("Add to cart"),
});

const productDetailBlock: BlockDefinition = {
  id: "product.detail",
  slug: "products/detail",
  category: "products",
  name: "Product Detail",
  description: "Full product page with gallery, options, and trust badges.",
  icon: Package,
  propsSchema: productDetailProps,
  defaultProps: productDetailProps.parse({}),
  variants: [
    { id: "split", name: "Split", Component: (p) => <ProductDetail {...p} layout="split" /> },
    { id: "stacked", name: "Stacked", Component: (p) => <ProductDetail {...p} layout="stacked" /> },
  ],
};

const miniCartProps = z.object({
  showImages: z.boolean().default(true),
  showShipping: z.boolean().default(true),
  cta: z.string().default("Checkout"),
});

const miniCartBlock: BlockDefinition = {
  id: "product.cart",
  slug: "products/cart",
  category: "products",
  name: "Mini Cart",
  description: "Cart with quantity controls, totals, and shipping summary.",
  icon: ShoppingCart,
  propsSchema: miniCartProps,
  defaultProps: miniCartProps.parse({}),
  variants: [
    { id: "drawer", name: "Drawer", Component: (p) => <MiniCart {...p} layout="drawer" /> },
    { id: "page", name: "Page", Component: (p) => <MiniCart {...p} layout="page" /> },
  ],
};

const categoryProps = z.object({
  showCount: z.boolean().default(true),
  title: z.string().default("Shop by category"),
});

const categoryBlock: BlockDefinition = {
  id: "product.categories",
  slug: "products/categories",
  category: "products",
  name: "Category Showcase",
  description: "Browse products by category with imagery.",
  icon: Tag,
  propsSchema: categoryProps,
  defaultProps: categoryProps.parse({}),
  variants: [
    { id: "grid", name: "Grid", Component: (p) => <CategoryShowcase {...p} /> },
    { id: "carousel", name: "Carousel", Component: (p) => <CategoryShowcase {...p} /> },
  ],
};

const carouselProps = z.object({
  showPrice: z.boolean().default(true),
  showTags: z.boolean().default(true),
  showRating: z.boolean().default(false),
  title: z.string().default("Featured this week"),
  cta: z.string().default("Add"),
});

const productCarouselBlock: BlockDefinition = {
  id: "product.carousel",
  slug: "products/carousel",
  category: "products",
  name: "Product Carousel",
  description: "Horizontally scrolling product showcase.",
  icon: GalleryHorizontal,
  propsSchema: carouselProps,
  defaultProps: carouselProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: ProductCarousel }],
};

/* ---------- Services ---------- */

const serviceListProps = z.object({
  showFeatures: z.boolean().default(true),
  showImage: z.boolean().default(true),
  cta: z.string().default("Book now"),
  title: z.string().default("Our services"),
});

const serviceListBlock: BlockDefinition = {
  id: "service.list",
  slug: "services/list",
  category: "services",
  name: "Service List",
  description: "Detailed service rows with features and price.",
  icon: List,
  isLive: true,
  propsSchema: serviceListProps,
  defaultProps: serviceListProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: ServiceList }],
};

const serviceGridProps = z.object({
  columns: z.number().min(2).max(4).default(3),
  showFeatures: z.boolean().default(true),
  cta: z.string().default("Learn more"),
  title: z.string().default("Services we offer"),
});

const serviceGridBlock: BlockDefinition = {
  id: "service.grid",
  slug: "services/grid",
  category: "services",
  name: "Service Card Grid",
  description: "Service cards laid out in a responsive grid.",
  icon: Briefcase,
  propsSchema: serviceGridProps,
  defaultProps: serviceGridProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: ServiceCardGrid }],
};

const serviceDetailProps = z.object({
  serviceId: z.string().default("s1"),
  cta: z.string().default("Book this service"),
  showFeatures: z.boolean().default(true),
});

const serviceDetailBlock: BlockDefinition = {
  id: "service.detail",
  slug: "services/detail",
  category: "services",
  name: "Service Detail",
  description: "Service page with description, inclusions, and booking sidebar.",
  icon: Sparkles,
  propsSchema: serviceDetailProps,
  defaultProps: serviceDetailProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: ServiceDetail }],
};

const pricingProps = z.object({
  highlightMiddle: z.boolean().default(true),
  cta: z.string().default("Get started"),
  title: z.string().default("Pick your plan"),
  subtitle: z.string().default("Simple pricing. Upgrade or downgrade anytime."),
});

const pricingBlock: BlockDefinition = {
  id: "service.pricing",
  slug: "services/pricing",
  category: "services",
  name: "Pricing Tiers",
  description: "Three-column pricing comparison with featured plan.",
  icon: CreditCard,
  propsSchema: pricingProps,
  defaultProps: pricingProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: PricingTiers }],
};

/* ---------- Menu ---------- */

const menuProps = z.object({
  showImages: z.boolean().default(true),
  title: z.string().default("Menu"),
});

const menuBlock: BlockDefinition = {
  id: "menu.categorized",
  slug: "menu/categorized",
  category: "menu",
  name: "Categorized Menu",
  description: "Restaurant menu grouped by section with prices and dietary tags.",
  icon: UtensilsCrossed,
  isLive: true,
  propsSchema: menuProps,
  defaultProps: menuProps.parse({}),
  variants: [
    { id: "single", name: "Single column", Component: (p) => <CategorizedMenu {...p} layout="single" /> },
    { id: "twoColumn", name: "Two column", Component: (p) => <CategorizedMenu {...p} layout="twoColumn" /> },
  ],
};

const menuItemProps = z.object({
  itemId: z.string().default("m2"),
});

const menuItemBlock: BlockDefinition = {
  id: "menu.item",
  slug: "menu/item",
  category: "menu",
  name: "Menu Item Detail",
  description: "Full-page menu item with photo, dietary, and price.",
  icon: Soup,
  propsSchema: menuItemProps,
  defaultProps: menuItemProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: MenuItemDetail }],
};

const specialsProps = z.object({
  title: z.string().default("Today's specials"),
});

const specialsBlock: BlockDefinition = {
  id: "menu.specials",
  slug: "menu/specials",
  category: "menu",
  name: "Daily Specials",
  description: "Highlighted limited-time menu items.",
  icon: Flame,
  propsSchema: specialsProps,
  defaultProps: specialsProps.parse({}),
  variants: [
    { id: "row", name: "Row", Component: (p) => <DailySpecials {...p} layout="row" /> },
    { id: "stacked", name: "Stacked", Component: (p) => <DailySpecials {...p} layout="stacked" /> },
  ],
};

const allergenProps = z.object({
  compact: z.boolean().default(false),
});

const allergenBlock: BlockDefinition = {
  id: "menu.allergens",
  slug: "menu/allergens",
  category: "menu",
  name: "Allergen Legend",
  description: "Key for dietary and allergen tags used on the menu.",
  icon: HelpCircle,
  propsSchema: allergenProps,
  defaultProps: allergenProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: AllergenLegend }],
};

/* ---------- Bookings ---------- */

const calendarProps = z.object({
  showLegend: z.boolean().default(true),
  title: z.string().default("Choose a date"),
});

const calendarBlock: BlockDefinition = {
  id: "booking.calendar",
  slug: "bookings/calendar",
  category: "bookings",
  name: "Availability Calendar",
  description: "Month-view calendar showing available, limited, and full days.",
  icon: Calendar,
  isLive: true,
  propsSchema: calendarProps,
  defaultProps: calendarProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: AvailabilityCalendar }],
};

const slotProps = z.object({
  columns: z.number().min(3).max(6).default(4),
  showDuration: z.boolean().default(true),
  cta: z.string().default("Continue"),
});

const slotBlock: BlockDefinition = {
  id: "booking.slots",
  slug: "bookings/slots",
  category: "bookings",
  name: "Time-Slot Picker",
  description: "Grid of bookable time slots with duration.",
  icon: Clock,
  propsSchema: slotProps,
  defaultProps: slotProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: TimeSlotPicker }],
};

const formProps = z.object({
  showNotes: z.boolean().default(true),
  showPhone: z.boolean().default(true),
  cta: z.string().default("Confirm booking"),
});

const formBlock: BlockDefinition = {
  id: "booking.form",
  slug: "bookings/form",
  category: "bookings",
  name: "Booking Form",
  description: "Contact form for collecting customer details.",
  icon: ClipboardList,
  propsSchema: formProps,
  defaultProps: formProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: BookingForm }],
};

const summaryProps = z.object({
  showLocation: z.boolean().default(true),
  showPrice: z.boolean().default(true),
  cta: z.string().default("Pay & confirm"),
});

const summaryBlock: BlockDefinition = {
  id: "booking.summary",
  slug: "bookings/summary",
  category: "bookings",
  name: "Booking Summary",
  description: "Confirmation card with details and total.",
  icon: CalendarCheck,
  propsSchema: summaryProps,
  defaultProps: summaryProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: BookingSummary }],
};

/* ---------- Products (extras) ---------- */

const reviewsProps = z.object({
  productId: z.string().default("p1"),
  showBreakdown: z.boolean().default(true),
  showHelpful: z.boolean().default(true),
  title: z.string().default("Customer reviews"),
});

const reviewsBlock: BlockDefinition = {
  id: "product.reviews",
  slug: "products/reviews",
  category: "products",
  name: "Product Reviews",
  description: "Star breakdown plus individual customer reviews.",
  icon: MessageSquare,
  isLive: true,
  propsSchema: reviewsProps,
  defaultProps: reviewsProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: ProductReviews }],
};

const compareProps = z.object({
  productIds: z.array(z.string()).default(["p1", "p2", "p3", "p7"]),
  highlightDifferences: z.boolean().default(true),
});

const compareBlock: BlockDefinition = {
  id: "product.compare",
  slug: "products/compare",
  category: "products",
  name: "Comparison Table",
  description: "Side-by-side product comparison with feature rows.",
  icon: Columns3,
  propsSchema: compareProps,
  defaultProps: compareProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: ComparisonTable }],
};

const bundleProps = z.object({
  title: z.string().default("Frequently bought together"),
  cta: z.string().default("Add bundle to cart"),
});

const bundleBlock: BlockDefinition = {
  id: "product.bundle",
  slug: "products/bundle",
  category: "products",
  name: "Product Bundle",
  description: "Frequently bought together with bundle savings.",
  icon: Boxes,
  propsSchema: bundleProps,
  defaultProps: bundleProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: ProductBundle }],
};

const rowProps = z.object({
  title: z.string().default(""),
  showPrice: z.boolean().default(true),
});

const crossSellBlock: BlockDefinition = {
  id: "product.crossSell",
  slug: "products/cross-sell",
  category: "products",
  name: "Cross-sell Row",
  description: "\"You might also like\" — related products row.",
  icon: Sparkles,
  propsSchema: rowProps,
  defaultProps: rowProps.parse({}),
  variants: [
    { id: "crossSell", name: "Cross-sell", Component: (p) => <ProductRow {...p} variant="crossSell" /> },
    { id: "recentlyViewed", name: "Recently viewed", Component: (p) => <ProductRow {...p} variant="recentlyViewed" /> },
  ],
};

const recentlyViewedBlock: BlockDefinition = {
  id: "product.recentlyViewed",
  slug: "products/recently-viewed",
  category: "products",
  name: "Recently Viewed",
  description: "Recall last-viewed products as a horizontal row.",
  icon: History,
  propsSchema: rowProps,
  defaultProps: rowProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: (p) => <ProductRow {...p} variant="recentlyViewed" /> }],
};

const searchProps = z.object({
  showSuggestions: z.boolean().default(true),
});

const searchBlock: BlockDefinition = {
  id: "product.search",
  slug: "products/search",
  category: "products",
  name: "Search Results",
  description: "Search bar with results grid and suggestion chips.",
  icon: SearchIcon,
  propsSchema: searchProps,
  defaultProps: searchProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: SearchResults }],
};

const filtersProps = z.object({
  showActiveCount: z.boolean().default(true),
});

const filtersBlock: BlockDefinition = {
  id: "product.filters",
  slug: "products/filters",
  category: "products",
  name: "Filters Sidebar",
  description: "Faceted filters: checkboxes, color swatches, price range.",
  icon: SlidersHorizontal,
  propsSchema: filtersProps,
  defaultProps: filtersProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: FiltersSidebar }],
};

const wishlistProps = z.object({
  layout: z.enum(["grid", "list"]).default("grid"),
});

const wishlistBlockDef: BlockDefinition = {
  id: "product.wishlist",
  slug: "products/wishlist",
  category: "products",
  name: "Wishlist",
  description: "Saved-for-later products in grid or list layout.",
  icon: Heart,
  propsSchema: wishlistProps,
  defaultProps: wishlistProps.parse({}),
  variants: [
    { id: "grid", name: "Grid", Component: (p) => <WishlistBlock {...p} layout="grid" /> },
    { id: "list", name: "List", Component: (p) => <WishlistBlock {...p} layout="list" /> },
  ],
};

const notifierProps = z.object({
  productId: z.string().default("p4"),
  cta: z.string().default("Notify me when available"),
});

const notifierBlock: BlockDefinition = {
  id: "product.notifier",
  slug: "products/stock-notifier",
  category: "products",
  name: "Stock Notifier",
  description: "Email capture for back-in-stock notifications.",
  icon: Bell,
  propsSchema: notifierProps,
  defaultProps: notifierProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: StockNotifier }],
};

const promoProps = z.object({
  promoId: z.string().default("promo1"),
});

const promoBlock: BlockDefinition = {
  id: "product.promo",
  slug: "products/promo-banner",
  category: "products",
  name: "Promo Banner",
  description: "Sitewide promo with code, banner or card layout.",
  icon: BadgePercent,
  propsSchema: promoProps,
  defaultProps: promoProps.parse({}),
  variants: [
    { id: "banner", name: "Banner", Component: (p) => <PromoBanner {...p} layout="banner" /> },
    { id: "card", name: "Card", Component: (p) => <PromoBanner {...p} layout="card" /> },
  ],
};

const orderTrackProps = z.object({
  showItems: z.boolean().default(true),
});

const orderTrackBlock: BlockDefinition = {
  id: "product.orderTracking",
  slug: "products/order-tracking",
  category: "products",
  name: "Order Tracking",
  description: "Shipment status, ETA, tracking number, and items.",
  icon: Truck,
  propsSchema: orderTrackProps,
  defaultProps: orderTrackProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: OrderTracking }],
};

const loyaltyProps = z.object({
  showPerks: z.boolean().default(true),
});

const loyaltyBlock: BlockDefinition = {
  id: "product.loyalty",
  slug: "products/loyalty",
  category: "products",
  name: "Loyalty Widget",
  description: "Member tier, points, progress bar, and perks.",
  icon: Award,
  propsSchema: loyaltyProps,
  defaultProps: loyaltyProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: LoyaltyWidget }],
};

/* ---------- Services (extras) ---------- */

const testimonialProps = z.object({
  showRating: z.boolean().default(true),
  title: z.string().default("What clients say"),
});

const testimonialBlock: BlockDefinition = {
  id: "service.testimonials",
  slug: "services/testimonials",
  category: "services",
  name: "Testimonials",
  description: "Quotes with avatar, role, and rating.",
  icon: Quote,
  isLive: true,
  propsSchema: testimonialProps,
  defaultProps: testimonialProps.parse({}),
  variants: [
    { id: "grid", name: "Grid", Component: (p) => <Testimonials {...p} layout="grid" /> },
    { id: "carousel", name: "Carousel", Component: (p) => <Testimonials {...p} layout="carousel" /> },
    { id: "spotlight", name: "Spotlight", Component: (p) => <Testimonials {...p} layout="spotlight" /> },
  ],
};

const processStepSchema = z.object({
  id: z.string().optional(),
  title: z.string().default(""),
  description: z.string().default(""),
});

const processProps = z.object({
  title: z.string().default("How we work together"),
  steps: z.array(processStepSchema).optional(),
});

const processBlock: BlockDefinition = {
  id: "service.process",
  slug: "services/process",
  category: "services",
  name: "Process Steps",
  description: "Numbered step-by-step engagement timeline.",
  icon: ListChecks,
  propsSchema: processProps,
  defaultProps: processProps.parse({}),
  variants: [
    { id: "horizontal", name: "Horizontal", Component: (p) => <ProcessSteps {...p} layout="horizontal" /> },
    { id: "vertical", name: "Vertical", Component: (p) => <ProcessSteps {...p} layout="vertical" /> },
    { id: "cards", name: "Cards", Component: (p) => <ProcessSteps {...p} layout="cards" /> },
  ],
};

const faqItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const faqProps = z.object({
  title: z.string().default("Frequently asked"),
  faqs: z.array(faqItemSchema).default([
    {
      question: "How quickly can we get started?",
      answer:
        "Most engagements kick off within a week. Strategy sessions can usually be booked the same week if a slot is open.",
    },
    {
      question: "Do you offer payment plans?",
      answer:
        "Projects over $1,500 can be split into 2 or 3 milestone payments. Just ask before invoicing.",
    },
    {
      question: "What's your revision policy?",
      answer:
        "Each package includes one round of revisions. Additional rounds are billed at our hourly rate, agreed in advance.",
    },
    {
      question: "Can you work with our existing team?",
      answer:
        "Absolutely. We slot into Slack, Linear, or Notion and adapt our cadence to your stand-ups.",
    },
  ]),
});

const faqBlock: BlockDefinition = {
  id: "service.faq",
  slug: "services/faq",
  category: "services",
  name: "FAQ",
  description: "Accordion of common questions and answers.",
  icon: HelpCircle,
  propsSchema: faqProps,
  defaultProps: faqProps.parse({}),
  variants: [
    { id: "single", name: "Single column", Component: (p) => <FAQBlock {...p} layout="single" /> },
    { id: "twoColumn", name: "Two column", Component: (p) => <FAQBlock {...p} layout="twoColumn" /> },
  ],
};

const teamProps = z.object({
  showAvailability: z.boolean().default(true),
  cta: z.string().default("Book with"),
  title: z.string().default("Choose a practitioner"),
});

const teamBlock: BlockDefinition = {
  id: "service.team",
  slug: "services/team",
  category: "services",
  name: "Team Picker",
  description: "Pick a team member, see availability and rating.",
  icon: Users,
  propsSchema: teamProps,
  defaultProps: teamProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: TeamPicker }],
};

const addonsProps = z.object({
  cta: z.string().default("Continue"),
  title: z.string().default("Enhance your package"),
});

const addonsBlock: BlockDefinition = {
  id: "service.addons",
  slug: "services/addons",
  category: "services",
  name: "Add-ons Selector",
  description: "Multi-select add-ons with running total.",
  icon: PlusCircle,
  propsSchema: addonsProps,
  defaultProps: addonsProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: AddonsSelector }],
};

/* ---------- Menu (extras) ---------- */

const wineProps = z.object({
  showNotes: z.boolean().default(true),
  showBottle: z.boolean().default(true),
  title: z.string().default("By the glass & bottle"),
});

const wineBlock: BlockDefinition = {
  id: "menu.wine",
  slug: "menu/wine-pairing",
  category: "menu",
  name: "Wine Pairing",
  description: "Wines by glass/bottle with pairings and tasting notes.",
  icon: Wine,
  isLive: true,
  propsSchema: wineProps,
  defaultProps: wineProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: WinePairing }],
};

const comboProps = z.object({
  cta: z.string().default("Order combo"),
});

const comboBlock: BlockDefinition = {
  id: "menu.combo",
  slug: "menu/combo",
  category: "menu",
  name: "Combo / Set Menu",
  description: "Multi-course set menus with choose-your-own options.",
  icon: UtensilsIcon,
  propsSchema: comboProps,
  defaultProps: comboProps.parse({}),
  variants: [
    { id: "grid", name: "Grid", Component: (p) => <ComboMenu {...p} layout="grid" /> },
    { id: "stacked", name: "Stacked", Component: (p) => <ComboMenu {...p} layout="stacked" /> },
  ],
};

const nutritionProps = z.object({
  showSodium: z.boolean().default(true),
  compact: z.boolean().default(false),
});

const nutritionBlock: BlockDefinition = {
  id: "menu.nutrition",
  slug: "menu/nutrition",
  category: "menu",
  name: "Nutrition Table",
  description: "Sortable per-serving nutrition information table.",
  icon: Activity,
  propsSchema: nutritionProps,
  defaultProps: nutritionProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: NutritionTable }],
};

/* ---------- Bookings (extras) ---------- */

const resourceProps = z.object({
  showFeatures: z.boolean().default(true),
  showPrice: z.boolean().default(true),
  cta: z.string().default("Reserve"),
  header_title: z.string().optional(),
  header_subtitle: z.string().optional(),
});

const resourceBlock: BlockDefinition = {
  id: "booking.resource",
  slug: "bookings/resource",
  category: "bookings",
  name: "Resource Picker",
  description: "Pick a room, court, or piece of equipment to book.",
  icon: Building2,
  isLive: true,
  propsSchema: resourceProps,
  defaultProps: resourceProps.parse({}),
  variants: [
    { id: "grid", name: "Grid", Component: (p) => <ResourcePicker {...p} layout="grid" /> },
    { id: "list", name: "List", Component: (p) => <ResourcePicker {...p} layout="list" /> },
    { id: "compact", name: "Compact grid", Component: (p) => <ResourcePicker {...p} layout="compact" /> },
  ],
};

const wizardStepSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  description: z.string().optional(),
});

const wizardProps = z.object({
  showLabels: z.boolean().default(true),
  header_title: z.string().optional(),
  header_subtitle: z.string().optional(),
  steps: z.array(wizardStepSchema).optional(),
  // Which step (0-based index into the active step list) shows as "current" — earlier
  // steps render as done, later ones as upcoming. Leave unset to use the built-in demo default.
  current_step: z.number().int().min(0).optional(),
});

const wizardBlock: BlockDefinition = {
  id: "booking.wizard",
  slug: "bookings/wizard",
  category: "bookings",
  name: "Booking Wizard",
  description: "Multi-step progress indicator for booking flows.",
  icon: Workflow,
  isLive: true,
  propsSchema: wizardProps,
  defaultProps: wizardProps.parse({}),
  variants: [
    { id: "horizontal", name: "Horizontal", Component: (p) => <BookingWizard {...p} layout="horizontal" /> },
    { id: "horizontal-compact", name: "Horizontal Compact", Component: (p) => <BookingWizard {...p} layout="horizontal" showLabels={false} /> },
    { id: "vertical", name: "Vertical", Component: (p) => <BookingWizard {...p} layout="vertical" /> },
    { id: "vertical-compact", name: "Vertical Compact", Component: (p) => <BookingWizard {...p} layout="vertical" showLabels={false} /> },
  ],
};

const emailProps = z.object({
  showHeader: z.boolean().default(true),
});

const emailBlock: BlockDefinition = {
  id: "booking.email",
  slug: "bookings/confirmation-email",
  category: "bookings",
  name: "Confirmation Email",
  description: "Preview of the booking confirmation email.",
  icon: Mail,
  propsSchema: emailProps,
  defaultProps: emailProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: ConfirmationEmail }],
};

const pastProps = z.object({
  filter: z.enum(["all", "upcoming", "completed", "cancelled"]).default("all"),
  showRebook: z.boolean().default(true),
  title: z.string().default("Your bookings"),
});

const pastBlock: BlockDefinition = {
  id: "booking.history",
  slug: "bookings/history",
  category: "bookings",
  name: "Past Bookings",
  description: "Customer's booking history with status badges.",
  icon: CalendarRange,
  propsSchema: pastProps,
  defaultProps: pastProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: PastBookings }],
};

/* ---------- Commerce: checkout flow ---------- */

const checkoutProps = z.object({
  showPromo: z.boolean().default(true),
  cta: z.string().default("Place order"),
});
const checkoutBlock: BlockDefinition = {
  id: "commerce.checkout",
  slug: "commerce/checkout",
  category: "commerce",
  name: "Checkout",
  description: "Full checkout with shipping, payment, and order summary.",
  icon: CreditCardIcon,
  isLive: true,
  propsSchema: checkoutProps,
  defaultProps: checkoutProps.parse({}),
  variants: [
    { id: "twoColumn", name: "Two column", Component: (p) => <Checkout {...p} layout="twoColumn" /> },
    { id: "stacked", name: "Stacked", Component: (p) => <Checkout {...p} layout="stacked" /> },
  ],
};

const addressProps = z.object({
  showPhone: z.boolean().default(true),
});
const addressBlock: BlockDefinition = {
  id: "commerce.address",
  slug: "commerce/address",
  category: "commerce",
  name: "Address Book",
  description: "Saved shipping addresses with select / edit / add.",
  icon: MapPin,
  propsSchema: addressProps,
  defaultProps: addressProps.parse({}),
  variants: [
    { id: "list", name: "List", Component: (p) => <AddressBook {...p} layout="list" /> },
    { id: "grid", name: "Grid", Component: (p) => <AddressBook {...p} layout="grid" /> },
  ],
};

const orderConfirmProps = z.object({
  showItems: z.boolean().default(true),
  showShipping: z.boolean().default(true),
  cta: z.string().default("Track your order"),
});
const orderConfirmBlock: BlockDefinition = {
  id: "commerce.orderConfirmation",
  slug: "commerce/order-confirmation",
  category: "commerce",
  name: "Order Confirmation",
  description: "Thank-you page with order details and shipping ETA.",
  icon: CheckCircle2,
  isLive: true,
  propsSchema: orderConfirmProps,
  defaultProps: orderConfirmProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: OrderConfirmation }],
};

const giftCardProps = z.object({
  cta: z.string().default("Buy gift card"),
});
const giftCardBlock: BlockDefinition = {
  id: "commerce.giftCards",
  slug: "commerce/gift-cards",
  category: "commerce",
  name: "Gift Cards",
  description: "Buy a gift card or check an existing balance.",
  icon: Gift,
  propsSchema: giftCardProps,
  defaultProps: giftCardProps.parse({}),
  variants: [
    { id: "shop", name: "Shop", Component: (p) => <GiftCards {...p} layout="shop" /> },
    { id: "balance", name: "Balance", Component: (p) => <GiftCards {...p} layout="balance" /> },
  ],
};

/* ---------- Bookings: gap blocks ---------- */

const groupBookProps = z.object({
  showAddons: z.boolean().default(true),
  cta: z.string().default("Reserve for group"),
});
const groupBookBlock: BlockDefinition = {
  id: "booking.group",
  slug: "bookings/group",
  category: "bookings",
  name: "Group Booking",
  description: "Adult/child counters with min/max party size.",
  icon: UsersIcon,
  propsSchema: groupBookProps,
  defaultProps: groupBookProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: GroupBooking }],
};

const recurringProps = z.object({
  showUpcoming: z.boolean().default(true),
  cta: z.string().default("Confirm series"),
});
const recurringBlock: BlockDefinition = {
  id: "booking.recurring",
  slug: "bookings/recurring",
  category: "bookings",
  name: "Recurring Booking",
  description: "Weekly / bi-weekly / monthly series with discount.",
  icon: Repeat,
  propsSchema: recurringProps,
  defaultProps: recurringProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: RecurringBooking }],
};

const waitlistProps = z.object({
  showOthers: z.boolean().default(true),
  cta: z.string().default("Join waitlist"),
});
const waitlistBlock: BlockDefinition = {
  id: "booking.waitlist",
  slug: "bookings/waitlist",
  category: "bookings",
  name: "Waitlist",
  description: "Join waitlist form or current position card.",
  icon: Hourglass,
  propsSchema: waitlistProps,
  defaultProps: waitlistProps.parse({}),
  variants: [
    { id: "joined", name: "Joined", Component: (p) => <WaitlistBlock {...p} layout="joined" /> },
    { id: "join", name: "Join form", Component: (p) => <WaitlistBlock {...p} layout="join" /> },
  ],
};

/* ---------- States: empty / skeleton / error ---------- */

const emptyProps = z.object({
  preset: z
    .enum(["emptyCart", "noResults", "emptyWishlist", "noBookings", "noOrders", "outOfStock"])
    .default("emptyCart"),
  size: z.enum(["sm", "md", "lg"]).default("md"),
  showSecondary: z.boolean().default(true),
});
const emptyBlock: BlockDefinition = {
  id: "state.empty",
  slug: "states/empty",
  category: "states",
  name: "Empty State",
  description: "Friendly empty placeholders for cart, search, wishlist, and more.",
  icon: Inbox,
  isLive: true,
  propsSchema: emptyProps,
  defaultProps: emptyProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: EmptyState }],
};

const skeletonProps = z.object({
  preset: z.enum(["productGrid", "productList", "detail", "cart", "calendar", "table"]).default("productGrid"),
  count: z.number().min(2).max(12).default(6),
});
const skeletonBlock: BlockDefinition = {
  id: "state.skeleton",
  slug: "states/skeleton",
  category: "states",
  name: "Skeleton Loader",
  description: "Loading placeholders shaped like the content they replace.",
  icon: Loader2,
  isLive: true,
  propsSchema: skeletonProps,
  defaultProps: skeletonProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: SkeletonLoader }],
};

const errorProps = z.object({
  preset: z
    .enum(["generic", "network", "notFound", "serverError", "forbidden", "maintenance"])
    .default("generic"),
  layout: z.enum(["full", "card"]).default("full"),
  showSecondary: z.boolean().default(true),
});
const errorBlock: BlockDefinition = {
  id: "state.error",
  slug: "states/error",
  category: "states",
  name: "Error State",
  description: "404, 500, network, and maintenance error placeholders.",
  icon: AlertTriangle,
  isLive: true,
  propsSchema: errorProps,
  defaultProps: errorProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: ErrorState }],
};

/* ---------- Verticals: real estate ---------- */

const propertyListingProps = z.object({
  columns: z.number().min(2).max(4).default(3),
  showAgent: z.boolean().default(true),
  cta: z.string().default("View details"),
});
const propertyListingBlock: BlockDefinition = {
  id: "vertical.propertyListing",
  slug: "verticals/property-listing",
  category: "verticals",
  name: "Property Listing",
  description: "Real estate listings in grid, list, or map layout.",
  icon: HomeIcon,
  isLive: true,
  propsSchema: propertyListingProps,
  defaultProps: propertyListingProps.parse({}),
  variants: [
    { id: "grid", name: "Grid", Component: (p) => <PropertyListing {...p} layout="grid" /> },
    { id: "list", name: "List", Component: (p) => <PropertyListing {...p} layout="list" /> },
    { id: "map", name: "Map", Component: (p) => <PropertyListing {...p} layout="map" /> },
  ],
};

const propertyDetailProps = z.object({
  propertyId: z.string().default("re1"),
  cta: z.string().default("Schedule tour"),
});
const propertyDetailBlock: BlockDefinition = {
  id: "vertical.propertyDetail",
  slug: "verticals/property-detail",
  category: "verticals",
  name: "Property Detail",
  description: "Full property page with gallery, stats, agent, and mortgage.",
  icon: Building,
  propsSchema: propertyDetailProps,
  defaultProps: propertyDetailProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: PropertyDetail }],
};

/* ---------- Verticals: auto ---------- */

const autoInventoryProps = z.object({
  showFilters: z.boolean().default(true),
  cta: z.string().default("View vehicle"),
});
const autoInventoryBlock: BlockDefinition = {
  id: "vertical.autoInventory",
  slug: "verticals/auto-inventory",
  category: "verticals",
  name: "Auto Inventory",
  description: "Vehicle inventory grid with price filter and condition badges.",
  icon: Car,
  isLive: true,
  propsSchema: autoInventoryProps,
  defaultProps: autoInventoryProps.parse({}),
  variants: [
    { id: "grid", name: "Grid", Component: (p) => <AutoInventory {...p} layout="grid" /> },
    { id: "list", name: "List", Component: (p) => <AutoInventory {...p} layout="list" /> },
  ],
};

const vehicleDetailProps = z.object({
  vehicleId: z.string().default("v1"),
  cta: z.string().default("Schedule test drive"),
});
const vehicleDetailBlock: BlockDefinition = {
  id: "vertical.vehicleDetail",
  slug: "verticals/vehicle-detail",
  category: "verticals",
  name: "Vehicle Detail",
  description: "Full vehicle page with specs, highlights, and finance estimate.",
  icon: Car,
  propsSchema: vehicleDetailProps,
  defaultProps: vehicleDetailProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: VehicleDetail }],
};

/* ---------- Verticals: fitness ---------- */

const fitnessProps = z.object({
  showInstructor: z.boolean().default(true),
  cta: z.string().default("Reserve"),
});
const fitnessBlock: BlockDefinition = {
  id: "vertical.fitnessSchedule",
  slug: "verticals/fitness-schedule",
  category: "verticals",
  name: "Fitness Schedule",
  description: "Class schedule with intensity, capacity, and reservations.",
  icon: Dumbbell,
  isLive: true,
  propsSchema: fitnessProps,
  defaultProps: fitnessProps.parse({}),
  variants: [
    { id: "schedule", name: "Schedule", Component: (p) => <FitnessScheduler {...p} layout="schedule" /> },
    { id: "grid", name: "Grid", Component: (p) => <FitnessScheduler {...p} layout="grid" /> },
  ],
};

/* ---------- Verticals: events ---------- */

const eventListingProps = z.object({
  showTag: z.boolean().default(true),
  cta: z.string().default("Get tickets"),
});
const eventListingBlock: BlockDefinition = {
  id: "vertical.eventListing",
  slug: "verticals/event-listing",
  category: "verticals",
  name: "Event Listing",
  description: "Upcoming events in grid or list, with date and venue.",
  icon: CalendarRange,
  propsSchema: eventListingProps,
  defaultProps: eventListingProps.parse({}),
  variants: [
    { id: "grid", name: "Grid", Component: (p) => <EventListing {...p} layout="grid" /> },
    { id: "list", name: "List", Component: (p) => <EventListing {...p} layout="list" /> },
  ],
};

const ticketProps = z.object({
  showSeating: z.boolean().default(true),
  cta: z.string().default("Continue to checkout"),
});
const ticketBlock: BlockDefinition = {
  id: "vertical.ticketPicker",
  slug: "verticals/ticket-picker",
  category: "verticals",
  name: "Ticket Picker",
  description: "Tiered ticket selection with seating chart and order summary.",
  icon: Ticket,
  isLive: true,
  propsSchema: ticketProps,
  defaultProps: ticketProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: TicketPicker }],
};

/* ---------- Verticals: courses ---------- */

const courseCatalogProps = z.object({
  columns: z.number().min(2).max(4).default(3),
  showInstructor: z.boolean().default(true),
  cta: z.string().default("Enroll"),
});
const courseCatalogBlock: BlockDefinition = {
  id: "vertical.courseCatalog",
  slug: "verticals/course-catalog",
  category: "verticals",
  name: "Course Catalog",
  description: "Browse courses with rating, level, and price.",
  icon: GraduationCap,
  isLive: true,
  propsSchema: courseCatalogProps,
  defaultProps: courseCatalogProps.parse({}),
  variants: [
    { id: "grid", name: "Grid", Component: (p) => <CourseCatalog {...p} layout="grid" /> },
    { id: "list", name: "List", Component: (p) => <CourseCatalog {...p} layout="list" /> },
  ],
};

const courseDetailProps = z.object({
  showOutcomes: z.boolean().default(true),
  cta: z.string().default("Enroll for"),
});
const courseDetailBlock: BlockDefinition = {
  id: "vertical.courseDetail",
  slug: "verticals/course-detail",
  category: "verticals",
  name: "Course Detail",
  description: "Course page with syllabus, outcomes, and pricing card.",
  icon: PlayCircle,
  propsSchema: courseDetailProps,
  defaultProps: courseDetailProps.parse({}),
  variants: [{ id: "default", name: "Default", Component: CourseDetail }],
};

/* ---------- Registry ---------- */

export const blocks: BlockDefinition[] = [
  // Products — core
  productListPageBlock,
  productCarouselBlock,
  featuredProductBlock,
  productDetailBlock,
  miniCartBlock,
  categoryBlock,
  // Products — extras
  reviewsBlock,
  compareBlock,
  bundleBlock,
  crossSellBlock,
  recentlyViewedBlock,
  searchBlock,
  filtersBlock,
  wishlistBlockDef,
  notifierBlock,
  promoBlock,
  orderTrackBlock,
  loyaltyBlock,
  // Services — core
  serviceListBlock,
  serviceGridBlock,
  serviceDetailBlock,
  pricingBlock,
  // Services — extras
  testimonialBlock,
  processBlock,
  faqBlock,
  teamBlock,
  addonsBlock,
  // Menu — core
  menuBlock,
  menuItemBlock,
  specialsBlock,
  allergenBlock,
  // Menu — extras
  wineBlock,
  comboBlock,
  nutritionBlock,
  // Bookings — core
  calendarBlock,
  slotBlock,
  formBlock,
  summaryBlock,
  // Bookings — extras
  resourceBlock,
  wizardBlock,
  emailBlock,
  pastBlock,
  // Bookings — gaps
  groupBookBlock,
  recurringBlock,
  waitlistBlock,
  // Commerce — checkout flow
  checkoutBlock,
  addressBlock,
  orderConfirmBlock,
  giftCardBlock,
  // Verticals
  propertyListingBlock,
  propertyDetailBlock,
  autoInventoryBlock,
  vehicleDetailBlock,
  fitnessBlock,
  eventListingBlock,
  ticketBlock,
  courseCatalogBlock,
  courseDetailBlock,
  // States
  emptyBlock,
  skeletonBlock,
  errorBlock,
];

export function getBlocksByCategory(category: BlockCategory) {
  return blocks.filter((b) => b.category === category);
}

export function findBlockBySlug(slug: string) {
  return blocks.find((b) => b.slug === slug);
}

// Re-export icons used by sidebar marker icons
export { ShoppingBag };
