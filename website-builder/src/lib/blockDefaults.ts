import type { BlockDefinition, BlockType, BlockCategory } from '../types/builder'
import { defaultCardGridCards } from './cardDefaults'
import { defaultCardListViewProps } from './cardListDefaults'
import { defaultLogosBlockProps } from './logosDefaults'
import { defaultProductListingProps } from './productDefaults'
import { defaultTeamBlockProps } from './teamDefaults'
import { defaultTestimonialBlockProps } from './testimonialDefaults'
import { defaultContactFormProps } from './contactFormDefaults'
import { defaultMultiStepFormProps } from './multiStepFormDefaults'
import { defaultMapEmbedProps } from './mapDefaults'
import { defaultFaqProps } from './faqDefaults'
import { defaultCarouselBlockProps } from './carouselDefaults'
import { defaultImageTitleSliderProps } from './imageTitleSliderDefaults'
import { defaultGalleryBlockProps } from './galleryDefaults'
import { defaultProductVideoGalleryProps } from './productVideoGalleryDefaults'
import { defaultProductRatingProps } from './productRatingDefaults'
import { defaultShippingReturnsInfoProps } from './shippingReturnsDefaults'
import { defaultPaymentMethodsProps } from './paymentMethodsDefaults'
import { defaultSecureCheckoutProps } from './secureCheckoutDefaults'
import { defaultStatsCounterProps } from './statsCounterDefaults'
import { defaultHowItWorksProps } from './howItWorksDefaults'
import { defaultTimelineProps } from './timelineDefaults'
import { defaultStateScreenProps, STATE_SCREEN_PALETTE, STATE_SCREEN_TYPES } from './stateScreenConfig'
import { defaultProductTabsProps } from './productTabsDefaults'
import { defaultChatFloatProps } from './chatFloatDefaults'
import { defaultStickyAddToCartProps } from './stickyAddToCartDefaults'
import { defaultProgressBarProps } from './progressBarDefaults'
import { defaultSkeletonLoaderProps } from './skeletonLoaderDefaults'
import { defaultSimpleLoaderProps } from './simpleLoaderDefaults'
import { defaultModalProps } from './modalDefaults'
import { defaultCommentsSectionProps } from './commentsSectionDefaults'
import { defaultPollVotingProps } from './pollVotingDefaults'
import { defaultMentionsTaggingProps } from './mentionsTaggingDefaults'
import { defaultLivePresenceProps } from './livePresenceDefaults'
import { defaultUserProfileCardProps } from './userProfileCardDefaults'
import { defaultStepperProps } from './stepperDefaults'
import { defaultOffCanvasMenuProps } from './offCanvasMenuDefaults'
import { defaultFabProps } from './fabDefaults'
import { defaultWishlistProps } from './wishlistDefaults'
import { defaultRecentlyViewedProps } from './recentlyViewedDefaults'
import { defaultFrequentlyBoughtTogetherProps } from './frequentlyBoughtTogetherDefaults'
import { defaultInfiniteScrollProps } from './infiniteScrollDefaults'
import { defaultBundleBuilderProps } from './bundleBuilderDefaults'
import { defaultCartDrawerProps } from './cartDrawerDefaults'
import { defaultBeforeAfterSlideProps } from './beforeAfterSlideDefaults'
import { defaultLightboxProps } from './lightboxDefaults'
import { defaultCountdownTimerProps } from './countdownTimerDefaults'
import { defaultPricingMatrixProps } from './pricingMatrixDefaults'
import { defaultDataTableProps } from './dataTableDefaults'
import { defaultLookbookProps } from './lookbookDefaults'
import { createFullFooterProps, createMinimalFooterProps } from './footerDefaults'
import { defaultNavbarProps } from './navbarDefaults'
import { defaultCategoryStackProps } from './categoryStackDefaults'
import { defaultCategoryTabsProps } from './tabsDefaults'
import { defaultHeroBannerSliderProps } from './bannerSliderDefaults'
import {
  defaultCouponBannerProps,
  defaultFashionPromoBannerProps,
  defaultFlashSaleBannerProps,
  defaultGroceryDealBannerProps,
  defaultOfferStripBannerProps,
  defaultSplitCategoryBannerProps,
  defaultTrustStripBannerProps,
} from './commerceBannerDefaults'

const IMG = 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80'
const HERO_IMG = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&q=80'

function d(
  type: BlockType,
  label: string,
  category: BlockCategory,
  icon: string,
  defaultProps: BlockDefinition['defaultProps'] = {},
  defaultStyles: BlockDefinition['defaultStyles'] = { margin: '0 0 16px' },
): BlockDefinition {
  return { type, label, category, icon, defaultProps: { visible: true, ...defaultProps }, defaultStyles }
}

const GRADIENT_BLOCK_STYLES = {
  gradientFrom: '#4f46e5',
  gradientTo: '#7c3aed',
  backgroundMode: 'gradient' as const,
}

const sharedHero = {
  text: 'Build Something Amazing',
  subtitle: 'Create beautiful websites without writing a single line of code.',
  buttonText: 'Get Started',
  buttonLink: '#products',
}

export const allBlockDefinitions: BlockDefinition[] = [
  // BASIC
  d('heading', 'Heading', 'basic', 'Type', { text: 'Your Heading' }, { fontSize: '36px', fontWeight: '700', margin: '0 0 16px' }),
  d('paragraph', 'Paragraph', 'basic', 'AlignLeft', { text: 'Add your content here. Double-click to edit inline.' }, { fontSize: '16px', textColor: '#4b5563' }),
  d('richText', 'Rich Text', 'basic', 'FileText', { html: '<p>Rich <strong>text</strong> content with formatting.</p>' }),
  d('button', 'Button', 'basic', 'MousePointerClick', { text: 'Click Me', buttonLink: '#products' }, { textAlign: 'left' }),
  d('buttonLink', 'Button with Link', 'basic', 'Link', { text: 'Learn More', buttonLink: '#contact' }),
  d('iconButton', 'Icon Button', 'basic', 'Circle', { text: 'Shop Now', icon: '🛒', buttonLink: '#products' }),
  d('divider', 'Divider', 'basic', 'Minus', {}, { margin: '24px 0' }),
  d('spacer', 'Spacer', 'layout', 'MoveVertical', { height: '48px' }, {}),
  d(
    'skeletonLoader',
    'Skeleton Loader',
    'basic',
    'Loader2',
    defaultSkeletonLoaderProps(),
    { padding: '24px', margin: '0 0 24px' },
  ),
  d(
    'simpleLoader',
    'Simple Loader',
    'basic',
    'RefreshCw',
    defaultSimpleLoaderProps(),
    { padding: '32px 24px', margin: '0 0 24px' },
  ),
  d(
    'container',
    'Container',
    'layout',
    'Layers',
    { containerLabel: 'Section', containerLayout: 'row', containerGap: 'md', visible: true },
    { padding: '24px', margin: '0 0 24px', borderRadius: '12px', backgroundColor: '#f9fafb' },
  ),
  d('badge', 'Badge', 'basic', 'Award', { badge: 'New', text: 'Featured' }),
  d('tags', 'Tags', 'basic', 'Tags', { tags: ['Design', 'Dev', 'Marketing'] }),
  d('image', 'Image', 'media', 'Image', { imageUrl: IMG, imageAlt: 'Image' }, { borderRadius: '12px' }),

  // HERO (solid / gradient / photo via Background mode in properties)
  d('hero', 'Hero', 'hero', 'Sparkles', { ...sharedHero, heroBackgroundMode: 'color' }, { backgroundColor: '#4f46e5', gradientFrom: '#4f46e5', gradientTo: '#ec4899', textColor: '#fff', textAlign: 'center', padding: '80px 32px', borderRadius: '16px' }),
  d('heroSplit', 'Image & Text', 'hero', 'Columns', { ...sharedHero, imageUrl: HERO_IMG, splitImageSide: 'right' }, { padding: '48px 24px' }),
  d('heroCta', 'CTA Hero', 'hero', 'Zap', { text: 'Ready to Start?', subtitle: 'Join thousands of happy customers today.', buttonText: 'Start Free Trial', buttonText2: 'Contact Sales', buttonLink: '#products', buttonLink2: '#contact', heroBackgroundMode: 'color' }, { backgroundColor: '#111827', textColor: '#fff', textAlign: 'center', padding: '72px 32px', borderRadius: '16px' }),
  d('heroBannerSlider', 'Banner Slider', 'hero', 'GalleryHorizontal', defaultHeroBannerSliderProps(), { textColor: '#fff', textAlign: 'center', margin: '0 0 24px', borderRadius: '16px' }),

  // BANNERS
  d('promoBanner', 'Promo Banner', 'banners', 'Megaphone', { text: 'Summer Sale — 40% Off', subtitle: 'Limited time only. Shop now!', buttonText: 'Shop Sale', buttonLink: '#products', heroBackgroundMode: 'image', imageUrl: HERO_IMG, overlayOpacity: 0.4 }, { padding: '48px 32px', textAlign: 'center', textColor: '#fff', borderRadius: '12px' }),
  d('announcementBanner', 'Announcement', 'banners', 'Bell', { text: '🎉 Free shipping on orders over $50', badge: 'New' }, { backgroundColor: '#fef3c7', padding: '12px 24px', textAlign: 'center' }),
  d('gradientBanner', 'Gradient Banner', 'banners', 'Rainbow', { text: 'Launch Week', subtitle: 'Exclusive deals all week long', buttonText: 'Explore', buttonLink: '#', heroBackgroundMode: 'gradient' }, { gradientFrom: '#6366f1', gradientTo: '#a855f7', textColor: '#fff', padding: '40px', textAlign: 'center', borderRadius: '12px' }),
  d('imageBanner', 'Image Banner', 'banners', 'PanelTop', { text: 'Discover More', subtitle: 'Curated collections for you', buttonText: 'View', heroBackgroundMode: 'image', imageUrl: HERO_IMG, overlayOpacity: 0.5 }, { padding: '64px 32px', textAlign: 'left', textColor: '#fff' }),
  d('couponBanner', 'Coupon Banner', 'banners', 'Ticket', defaultCouponBannerProps(), { margin: '0 0 24px', padding: '0', borderRadius: '16px' }),
  d('flashSaleBanner', 'Flash Sale', 'banners', 'Timer', defaultFlashSaleBannerProps(), { margin: '0 0 24px', borderRadius: '12px' }),
  d('splitCategoryBanner', 'Category Split', 'banners', 'Columns2', defaultSplitCategoryBannerProps(), { margin: '0 0 24px' }),
  d('offerStripBanner', 'Offer Strip', 'banners', 'Tag', defaultOfferStripBannerProps(), { margin: '0 0 16px', borderRadius: '12px' }),
  d('groceryDealBanner', 'Grocery Deals', 'banners', 'ShoppingBag', defaultGroceryDealBannerProps(), { margin: '0 0 24px', borderRadius: '16px' }),
  d('fashionPromoBanner', 'Fashion Promo', 'banners', 'Sparkles', defaultFashionPromoBannerProps(), { margin: '0 0 24px', borderRadius: '16px' }),
  d('trustStripBanner', 'Trust Strip', 'banners', 'ShieldCheck', defaultTrustStripBannerProps(), { margin: '0 0 24px', padding: '0' }),

  // CARDS
  d(
    'cardGrid',
    'Cards',
    'cards',
    'LayoutGrid',
    { text: 'What We Offer', subtitle: 'Explore our highlights', columns: 3, cards: defaultCardGridCards(), showViewAllButton: false, viewAllButtonText: 'View all', viewAllButtonLink: '#services', cardImageHeight: '176px' },
    { padding: '48px 24px', margin: '0 0 24px' },
  ),
  d('cardListView', 'Card List View', 'cards', 'Rows', defaultCardListViewProps(), { padding: '48px 24px', margin: '0 0 24px' }),
  d(
    'categoryTabs',
    'Category Tabs',
    'cards',
    'Table',
    defaultCategoryTabsProps(),
    { padding: '48px 24px', margin: '0 0 24px' },
  ),

  d(
    'categoryStack',
    'Category Stack',
    'cards',
    'Rows',
    defaultCategoryStackProps(),
    { padding: '48px 24px', margin: '0 0 24px' },
  ),

  // FORMS
  d('contactForm', 'Contact Form', 'forms', 'Mail', defaultContactFormProps(), { padding: '48px 24px', margin: '0 0 24px' }),
  d(
    'multiStepForm',
    'Multi-Step Form',
    'forms',
    'Layers',
    defaultMultiStepFormProps(),
    { ...GRADIENT_BLOCK_STYLES, padding: '48px 24px', margin: '0 0 32px', textAlign: 'center' },
  ),
  d('newsletterForm', 'Newsletter', 'forms', 'Inbox', { text: 'Subscribe', subtitle: 'Get updates in your inbox', placeholder: 'Enter your email' }, { padding: '32px', textAlign: 'center', backgroundColor: '#eef2ff', borderRadius: '12px' }),
  d('formInput', 'Input Field', 'forms', 'TextCursor', { label: 'Label', placeholder: 'Enter text...' }),
  d('formTextarea', 'Textarea', 'forms', 'AlignLeft', { label: 'Message', placeholder: 'Write here...' }),
  d('formSelect', 'Select', 'forms', 'ChevronDown', { label: 'Choose option', options: ['Option 1', 'Option 2', 'Option 3'] }),
  d('formCheckbox', 'Checkbox', 'forms', 'CheckSquare', { label: 'I agree to terms', checked: false }),
  d('formRadio', 'Radio Group', 'forms', 'CircleDot', { label: 'Select plan', options: ['Basic', 'Pro', 'Enterprise'] }),
  d('formFileUpload', 'File Upload', 'forms', 'Upload', { label: 'Upload file', text: 'Drag & drop or click to upload' }),
  d('searchBar', 'Search Bar', 'forms', 'Search', { placeholder: 'Search…', showSearchButton: true, buttonText: 'Search' }, { margin: '0 0 16px', borderWidth: '1px', borderColor: '#e5e7eb', borderRadius: '8px' }),

  // MEDIA
  d('gallery', 'Gallery', 'media', 'Images', defaultGalleryBlockProps(), { padding: '48px 24px', margin: '0 0 24px' }),
  d('lookbook', 'Lookbook', 'media', 'LayoutGrid', defaultLookbookProps(), { padding: '48px 24px', margin: '0 0 32px' }),
  d('carousel', 'Carousel', 'media', 'GalleryHorizontal', defaultCarouselBlockProps()),
  d('imageTitleSlider', 'Image Title Slider', 'media', 'Images', defaultImageTitleSliderProps(), { padding: '32px 24px', margin: '0 0 24px' }),
  d('videoEmbed', 'Video Embed', 'media', 'Play', { videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', text: 'Watch our story' }, { borderRadius: '12px' }),
  d(
    'beforeAfterSlide',
    'Before / After Slide',
    'media',
    'SplitSquareHorizontal',
    defaultBeforeAfterSlideProps(),
    { ...GRADIENT_BLOCK_STYLES, padding: '32px 0', margin: '0 0 32px', borderRadius: '20px', textAlign: 'center' },
  ),
  d(
    'lightbox',
    'Lightbox',
    'media',
    'Maximize2',
    defaultLightboxProps(),
    { ...GRADIENT_BLOCK_STYLES, padding: '48px 24px', margin: '0 0 32px', textAlign: 'center' },
  ),
  d(
    'productVideoGallery',
    'Product Video Gallery',
    'ecommerce',
    'Video',
    defaultProductVideoGalleryProps(),
    { padding: '40px 24px', margin: '0 0 32px', borderRadius: '0' },
  ),
  d(
    'productRating',
    'Product Rating',
    'ecommerce',
    'Star',
    defaultProductRatingProps(),
    { padding: '24px', margin: '0 0 24px', borderRadius: '16px', backgroundColor: '#ffffff' },
  ),
  d(
    'shippingReturnsInfo',
    'Shipping & Returns',
    'ecommerce',
    'Package',
    defaultShippingReturnsInfoProps(),
    { padding: '48px 24px', margin: '0 0 24px' },
  ),
  d(
    'paymentMethods',
    'Payment Methods',
    'ecommerce',
    'CreditCard',
    defaultPaymentMethodsProps(),
    { padding: '32px 24px', margin: '0 0 24px', borderRadius: '16px', backgroundColor: '#ffffff' },
  ),
  d(
    'secureCheckout',
    'Secure Checkout',
    'ecommerce',
    'ShieldCheck',
    defaultSecureCheckoutProps(),
    { padding: '48px 24px', margin: '0 0 24px', borderRadius: '16px', backgroundColor: '#ffffff' },
  ),
  d(
    'statsCounter',
    'Stats Counter',
    'sections',
    'Award',
    defaultStatsCounterProps(),
    { padding: '48px 24px', margin: '0 0 24px' },
  ),
  d(
    'howItWorks',
    'How It Works',
    'sections',
    'Layers',
    defaultHowItWorksProps(),
    { padding: '48px 24px', margin: '0 0 24px' },
  ),
  d(
    'timeline',
    'Timeline',
    'sections',
    'History',
    defaultTimelineProps(),
    { ...GRADIENT_BLOCK_STYLES, padding: '48px 24px', margin: '0 0 32px', textAlign: 'center' },
  ),
  ...STATE_SCREEN_TYPES.map((type) => {
    const meta = STATE_SCREEN_PALETTE[type]
    return d(type, meta.label, meta.category, meta.icon, defaultStateScreenProps(type), {
      ...GRADIENT_BLOCK_STYLES,
      padding: '0',
      margin: '0 0 24px',
      textAlign: 'center',
    })
  }),
  d(
    'productTabs',
    'Product Tabs',
    'ecommerce',
    'FileText',
    defaultProductTabsProps(),
    { padding: '32px 24px', margin: '0 0 24px', borderRadius: '16px', backgroundColor: '#ffffff' },
  ),
  d(
    'progressBar',
    'Progress Bar',
    'sections',
    'SlidersHorizontal',
    defaultProgressBarProps(),
    { padding: '32px 24px', margin: '0 0 24px', backgroundColor: '#4f46e5' },
  ),
  d(
    'countdownTimer',
    'Countdown Timer',
    'sections',
    'Timer',
    defaultCountdownTimerProps(),
    { ...GRADIENT_BLOCK_STYLES, padding: '48px 24px', margin: '0 0 24px', textAlign: 'center' },
  ),
  d(
    'pricingMatrix',
    'Pricing Matrix',
    'sections',
    'Grid3x3',
    defaultPricingMatrixProps(),
    { ...GRADIENT_BLOCK_STYLES, padding: '48px 24px', margin: '0 0 32px', textAlign: 'center' },
  ),
  d(
    'dataTable',
    'Data Table',
    'sections',
    'Table',
    defaultDataTableProps(),
    { ...GRADIENT_BLOCK_STYLES, padding: '48px 24px', margin: '0 0 32px', textAlign: 'left' },
  ),
  d('mapEmbed', 'Map', 'media', 'MapPin', defaultMapEmbedProps(), { padding: '48px 24px', margin: '0 0 24px' }),

  // NAVIGATION
  d(
    'navbar',
    'Navbar',
    'navigation',
    'Menu',
    defaultNavbarProps('My Website'),
    { padding: '0', backgroundColor: 'transparent', margin: '0', boxShadow: 'none' },
  ),
  d('mobileMenu', 'Mobile Menu', 'navigation', 'Smartphone', { items: ['Home', 'Products', 'Cart', 'Contact'] }, { padding: '16px', backgroundColor: '#f9fafb' }),
  d('sidebar', 'Sidebar', 'navigation', 'PanelLeft', { items: ['Dashboard', 'Settings', 'Profile', 'Logout'] }, { padding: '24px', backgroundColor: '#1f2937', textColor: '#fff' }),
  d('breadcrumbs', 'Breadcrumbs', 'navigation', 'ChevronRight', { items: ['Home', 'Products', 'Item'] }),

  // FOOTER
  d(
    'footer',
    'Site Footer',
    'footer',
    'PanelBottom',
    createFullFooterProps('My Website', ['Home', 'Products', 'Contact']),
    { padding: '0', backgroundColor: '#111827', textColor: '#9ca3af', margin: '0', boxShadow: 'none' },
  ),
  d(
    'footerMinimal',
    'Simple Footer',
    'footer',
    'Minus',
    createMinimalFooterProps('My Website'),
    { padding: '0', backgroundColor: '#111827', textColor: '#9ca3af', textAlign: 'center', margin: '0', boxShadow: 'none' },
  ),

  // SOCIAL
  d('testimonial', 'Testimonials', 'social', 'Quote', defaultTestimonialBlockProps(), { padding: '48px 24px', margin: '0 0 24px' }),
  d('faqAccordion', 'FAQ', 'sections', 'HelpCircle', defaultFaqProps(), {
    padding: '64px 24px',
    margin: '0 0 24px',
    backgroundColor: '#f8fafc',
  }),
  d('teamMembers', 'Team Members', 'social', 'Users', defaultTeamBlockProps(), { padding: '48px 24px', margin: '0 0 24px' }),
  d(
    'commentsSection',
    'Comments Section',
    'social',
    'MessagesSquare',
    defaultCommentsSectionProps(),
    { padding: '24px 0', margin: '0 0 32px' },
  ),
  d('pollVoting', 'Polls & Voting', 'social', 'BarChart2', defaultPollVotingProps(), { padding: '48px 24px', margin: '0 0 32px' }),
  d('mentionsTagging', 'Mentions & Tagging', 'social', 'AtSign', defaultMentionsTaggingProps(), { padding: '48px 24px', margin: '0 0 32px' }),
  d('livePresence', 'Live Presence', 'social', 'CircleDot', defaultLivePresenceProps(), { padding: '48px 24px', margin: '0 0 24px' }),
  d('userProfileCard', 'User Profile Card', 'social', 'UserCircle', defaultUserProfileCardProps(), {
    padding: '48px 24px',
    margin: '0 0 32px',
    gradientFrom: '#4f46e5',
    gradientTo: '#7c3aed',
  }),
  d('stepper', 'Stepper', 'sections', 'ListOrdered', defaultStepperProps(), { padding: '48px 24px', margin: '0 0 32px', textAlign: 'center' }),
  d(
    'logosSection',
    'Trusted By',
    'social',
    'Building',
    defaultLogosBlockProps(),
    {
      padding: '48px 32px',
      margin: '0 0 24px',
      backgroundMode: 'gradient',
      gradientFrom: '#2dd4bf',
      gradientTo: '#059669',
      textColor: '#ffffff',
      borderRadius: '12px',
    },
  ),

  // ECOMMERCE
  d('productListing', 'Product Listing', 'ecommerce', 'ShoppingBag', defaultProductListingProps(), { padding: '48px 24px', margin: '0 0 24px' }),
  d('wishlist', 'Wishlist', 'ecommerce', 'Heart', defaultWishlistProps(), { padding: '48px 24px', margin: '0 0 32px' }),
  d('recentlyViewed', 'Recently Viewed', 'ecommerce', 'History', defaultRecentlyViewedProps(), { padding: '48px 24px', margin: '0 0 32px' }),
  d('frequentlyBoughtTogether', 'Frequently Bought Together', 'ecommerce', 'Package', defaultFrequentlyBoughtTogetherProps(), { padding: '48px 24px', margin: '0 0 32px' }),
  d('infiniteScroll', 'Infinite Scroll', 'ecommerce', 'RefreshCw', defaultInfiniteScrollProps(), { padding: '48px 24px', margin: '0 0 32px' }),
  d('bundleBuilder', 'Bundle Builder', 'ecommerce', 'Layers', defaultBundleBuilderProps(), { padding: '48px 24px', margin: '0 0 32px' }),
  d('cartWidget', 'Cart', 'widgets', 'ShoppingCart', { text: 'Your Cart' }),
  d('checkoutWidget', 'Checkout', 'widgets', 'CreditCard', { text: 'Checkout' }),
  d('miniCart', 'Mini Cart', 'widgets', 'ShoppingCart', { text: 'Cart' }),
  d('cartDrawer', 'Cart Drawer', 'widgets', 'PanelRight', defaultCartDrawerProps(), { margin: '0', padding: '16px' }),
  d(
    'backToTop',
    'Back to Top',
    'widgets',
    'ArrowUp',
    { buttonText: 'Back to top', showBackToTopIcon: true, backToTopPosition: 'bottom-right' },
    {
      backgroundColor: '#4f46e5',
      textColor: '#ffffff',
      borderRadius: '9999px',
      padding: '12px 20px',
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
      margin: '0',
    },
  ),
  d(
    'cookieBanner',
    'Cookie Banner',
    'widgets',
    'Cookie',
    {
      text: 'We use cookies to improve your experience and analyze site traffic.',
      subtitle: 'By clicking Accept, you agree to our use of cookies.',
      buttonText: 'Accept all',
      buttonText2: 'Reject',
      buttonLink: '#privacy',
      cookiePolicyLinkText: 'Privacy policy',
      cookieBannerLayout: 'bar',
      cookieBannerPosition: 'bottom-center',
      showCookieReject: true,
      showCookiePolicyLink: true,
    },
    {
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      gradientFrom: '#4f46e5',
      padding: '20px 24px',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
      margin: '0',
    },
  ),
  d(
    'toastNotification',
    'Notification Toast',
    'widgets',
    'Bell',
    {
      text: 'Added to cart',
      subtitle: '2 items · View cart to checkout',
      toastVariant: 'success',
      toastPosition: 'top-right',
      showToastIcon: true,
      showToastClose: true,
      toastAutoShow: true,
    },
    {
      backgroundColor: '#ffffff',
      textColor: '#111827',
      borderRadius: '12px',
      padding: '14px 16px',
      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.12)',
      margin: '0',
      maxWidth: '360px',
    },
  ),
  d(
    'modal',
    'Modal Dialog',
    'widgets',
    'AppWindow',
    defaultModalProps(),
    {
      backgroundColor: '#ffffff',
      textColor: '#111827',
      gradientFrom: '#7c3aed',
      gradientTo: '#a855f7',
      borderRadius: '20px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      margin: '0',
    },
  ),
  d(
    'chatFloat',
    'Chat / WhatsApp',
    'widgets',
    'MessageCircle',
    defaultChatFloatProps(),
    {
      backgroundColor: '#25D366',
      textColor: '#ffffff',
      borderRadius: '9999px',
      padding: '14px',
      boxShadow: '0 4px 20px rgba(37, 211, 102, 0.45)',
      margin: '0',
    },
  ),
  d(
    'offCanvasMenu',
    'Off-Canvas Menu',
    'widgets',
    'PanelLeft',
    defaultOffCanvasMenuProps(),
    { margin: '0', padding: '16px' },
  ),
  d(
    'floatingActionButton',
    'Floating Action Button',
    'widgets',
    'PlusCircle',
    defaultFabProps(),
    {
      backgroundColor: '#4f46e5',
      textColor: '#ffffff',
      borderRadius: '9999px',
      margin: '0',
    },
  ),
  d(
    'stickyAddToCart',
    'Sticky Add to Cart',
    'widgets',
    'ShoppingCart',
    defaultStickyAddToCartProps(),
    {
      backgroundColor: '#111827',
      textColor: '#ffffff',
      borderRadius: '12px',
      margin: '0',
    },
  ),
  d('addToCartButton', 'Add to Cart Btn', 'widgets', 'Plus', { buttonText: 'Add to Cart', linkedItemType: 'product' }),
  d('pricingTable', 'Pricing Table', 'ecommerce', 'Tags', { text: 'Plans', pricingPlans: [{ name: 'Basic', price: '$19', features: ['5 projects'] }, { name: 'Pro', price: '$49', features: ['Unlimited'] }] }),
  d('productShowcase', 'Product Showcase', 'ecommerce', 'Package', { text: 'Featured Product', excerpt: 'Our bestseller', imageUrl: IMG, buttonText: 'Buy Now', badge: 'Best Seller' }),
  d('featuresComparison', 'Features Compare', 'ecommerce', 'Table', { text: 'Compare Plans', features: [{ title: 'Storage', description: '10GB vs 100GB' }, { title: 'Support', description: 'Email vs Priority' }] }),
  d('checkoutCta', 'Checkout CTA', 'ecommerce', 'ShoppingCart', { text: 'Complete Your Order', subtitle: 'Secure checkout', buttonText: 'Go to Checkout', buttonLink: '#checkout' }, { backgroundColor: '#4f46e5', textColor: '#fff', padding: '40px', textAlign: 'center', borderRadius: '12px' }),
]

/** Kept for existing pages/templates — hidden from the component palette */
const legacyBlockDefinitions: BlockDefinition[] = [
  /** Programmatic legal pages only — not shown in component palette */
  d(
    'legalDocument',
    'Legal Document',
    'basic',
    'FileText',
    {
      text: 'Privacy Policy',
      subtitle: '',
      html: '<p>Legal content goes here.</p>',
      legalVariant: 'privacy',
    },
    { padding: '0', margin: '0' },
  ),
  /** Merged into Carousel — still renders/edits for existing pages */
  d('slider', 'Slider', 'media', 'SlidersHorizontal', defaultCarouselBlockProps()),
  d('gridSection', 'Grid Section', 'layouts', 'LayoutGrid', { text: 'Our Work', columns: 3, cards: [{ title: 'Project 1', description: 'Description', imageUrl: IMG }, { title: 'Project 2', description: 'Description', imageUrl: IMG }, { title: 'Project 3', description: 'Description', imageUrl: IMG }] }, { padding: '32px 16px' }),
  d('masonryGrid', 'Masonry Grid', 'layouts', 'Grid3x3', { columns: 3, cards: [{ title: 'Item A', description: 'Text', imageUrl: IMG }, { title: 'Item B', description: 'Text', imageUrl: IMG }] }),
  d('flexLayout', 'Flex Layout', 'layouts', 'Rows', { text: 'Flexible Row', cards: [{ title: 'Left', description: 'Content' }, { title: 'Right', description: 'Content' }] }),
  d('twoColumn', '2-Column Section', 'layouts', 'Columns2', { text: 'Two Columns', subtitle: 'Side by side content', imageUrl: IMG }),
  d('threeColumn', '3-Column Section', 'layouts', 'Columns3', { text: 'Three Columns', features: [{ title: 'Col 1', description: 'Text' }, { title: 'Col 2', description: 'Text' }, { title: 'Col 3', description: 'Text' }] }),
  d('cta', 'Call to Action', 'ecommerce', 'Megaphone', { text: 'Ready?', subtitle: 'Start today', buttonText: 'Get Started', buttonLink: '#products' }, { padding: '48px', textAlign: 'center', backgroundColor: '#f3f4f6', borderRadius: '16px' }),
  d('serviceListing', 'Service Listing', 'ecommerce', 'Wrench', { text: 'Services', columns: 2, showPrices: true }),
  d('reviews', 'Reviews', 'social', 'Star', { text: 'Customer Reviews', cards: [{ title: 'John', author: 'John', quote: 'Great!', rating: 5 }, { title: 'Lisa', author: 'Lisa', quote: 'Love it!', rating: 5 }] }),
  d('featureGrid', 'Feature Grid', 'layouts', 'LayoutGrid', { text: 'Features', features: [{ title: 'Fast', description: 'Lightning quick' }, { title: 'Secure', description: 'Bank-level security' }, { title: 'Simple', description: 'Easy to use' }] }, { padding: '40px 24px', textAlign: 'center' }),
  d('features', 'Features Grid', 'sections', 'LayoutGrid', { text: 'Why Choose Us', features: [{ title: 'Easy', description: 'Drag and drop' }, { title: 'Modern', description: 'Beautiful design' }, { title: 'No Code', description: 'Anyone can build' }] }, { padding: '48px', textAlign: 'center' }),
  d('contact', 'Contact Section', 'sections', 'Mail', { text: 'Get in Touch', subtitle: 'Reach out anytime', email: 'hello@example.com', phone: '+1 555-123-4567' }, { padding: '48px', textAlign: 'center' }),
]

export const blockRegistry = Object.fromEntries(
  [...allBlockDefinitions, ...legacyBlockDefinitions].map((def) => [def.type, def]),
) as Record<BlockType, BlockDefinition>

export const blockCategories: { id: BlockCategory; label: string }[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'hero', label: 'Hero Sections' },
  { id: 'banners', label: 'Banners' },
  { id: 'cards', label: 'Cards' },
  { id: 'forms', label: 'Forms' },
  { id: 'media', label: 'Media' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'footer', label: 'Footer' },
  { id: 'social', label: 'Social' },
  { id: 'ecommerce', label: 'Ecommerce' },
  { id: 'widgets', label: 'Widgets' },
  { id: 'sections', label: 'Sections' },
  { id: 'layout', label: 'Layout' },
]
