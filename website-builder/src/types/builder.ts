export type BlockType =
  // Basic
  | 'heading'
  | 'paragraph'
  | 'richText'
  | 'button'
  | 'buttonLink'
  | 'iconButton'
  | 'divider'
  | 'spacer'
  | 'container'
  | 'badge'
  | 'tags'
  | 'image'
  // Hero
  | 'hero'
  | 'heroBgImage'
  | 'heroVideo'
  | 'heroGradient'
  | 'heroSplit'
  | 'heroCta'
  | 'heroBannerSlider'
  // Banners
  | 'promoBanner'
  | 'announcementBanner'
  | 'gradientBanner'
  | 'imageBanner'
  | 'couponBanner'
  | 'flashSaleBanner'
  | 'splitCategoryBanner'
  | 'offerStripBanner'
  | 'trustStripBanner'
  | 'groceryDealBanner'
  | 'fashionPromoBanner'
  // Cards
  | 'cardGrid'
  | 'categoryTabs'
  | 'categoryStack'
  | 'cardListView'
  | 'blogCard'
  | 'productCard'
  | 'teamCard'
  | 'featureCard'
  | 'pricingCard'
  | 'testimonialCard'
  // Layouts
  | 'gridSection'
  | 'masonryGrid'
  | 'flexLayout'
  | 'twoColumn'
  | 'threeColumn'
  | 'featureGrid'
  | 'features'
  // Forms
  | 'contactForm'
  | 'multiStepForm'
  | 'newsletterForm'
  | 'formInput'
  | 'formTextarea'
  | 'formSelect'
  | 'formCheckbox'
  | 'formRadio'
  | 'formFileUpload'
  | 'searchBar'
  // Media
  | 'gallery'
  | 'lookbook'
  | 'carousel'
  | 'imageTitleSlider'
  | 'slider'
  | 'videoEmbed'
  | 'beforeAfterSlide'
  | 'lightbox'
  | 'productVideoGallery'
  | 'productRating'
  | 'shippingReturnsInfo'
  | 'paymentMethods'
  | 'secureCheckout'
  | 'statsCounter'
  | 'howItWorks'
  | 'timeline'
  | 'emptyState'
  | 'errorState'
  | 'successState'
  | 'maintenanceScreen'
  | 'notFoundPage'
  | 'comingSoon'
  | 'sessionExpired'
  | 'pollVoting'
  | 'mentionsTagging'
  | 'livePresence'
  | 'userProfileCard'
  | 'stepper'
  | 'offCanvasMenu'
  | 'floatingActionButton'
  | 'wishlist'
  | 'recentlyViewed'
  | 'frequentlyBoughtTogether'
  | 'infiniteScroll'
  | 'bundleBuilder'
  | 'cartDrawer'
  | 'productTabs'
  | 'progressBar'
  | 'skeletonLoader'
  | 'simpleLoader'
  | 'countdownTimer'
  | 'pricingMatrix'
  | 'dataTable'
  | 'mapEmbed'
  // Navigation
  | 'navbar'
  | 'mobileMenu'
  | 'sidebar'
  | 'footer'
  | 'footerMinimal'
  | 'legalDocument'
  | 'breadcrumbs'
  // Social
  | 'testimonial'
  | 'reviews'
  | 'commentsSection'
  | 'faqAccordion'
  | 'teamMembers'
  | 'logosSection'
  // Ecommerce / legacy
  | 'cta'
  | 'contact'
  | 'productListing'
  | 'serviceListing'
  | 'cartWidget'
  | 'checkoutWidget'
  | 'miniCart'
  | 'backToTop'
  | 'toastNotification'
  | 'cookieBanner'
  | 'modal'
  | 'chatFloat'
  | 'stickyAddToCart'
  | 'addToCartButton'
  | 'pricingTable'
  | 'productShowcase'
  | 'featuresComparison'
  | 'checkoutCta'

export type TextAlign = 'left' | 'center' | 'right'
export type BlockCategory =
  | 'basic'
  | 'hero'
  | 'banners'
  | 'cards'
  | 'layouts'
  | 'forms'
  | 'media'
  | 'navigation'
  | 'social'
  | 'ecommerce'
  | 'widgets'
  | 'sections'
  | 'footer'
  | 'layout'

export type BusinessType = 'products' | 'services' | 'both'
export type BusinessCategory =
  | 'fashion' | 'electronics' | 'food' | 'beauty' | 'health'
  | 'education' | 'consulting' | 'real-estate' | 'fitness' | 'other'

export type PageKind =
  | 'home'
  | 'products'
  | 'services'
  | 'cart'
  | 'checkout'
  | 'contact'
  | 'privacy'
  | 'terms'
  | 'custom'

export interface SiteConfig {
  businessName: string
  businessType: BusinessType
  category: BusinessCategory
  templateId?: string
  /** User-saved template this site was loaded from — Save updates it instead of creating a copy */
  savedTemplateSourceId?: string
}

export interface CatalogProduct {
  id: string
  name: string
  price: number
  imageUrl: string
  description: string
}

export interface CatalogService {
  id: string
  name: string
  price: number
  duration?: string
  imageUrl: string
  description: string
}

export interface CartItem {
  id: string
  itemId: string
  itemType: 'product' | 'service'
  name: string
  price: number
  quantity: number
  imageUrl: string
}

/** Per-item typography & colors (cards, list rows, etc.) */
export interface ItemContentStyle {
  titleColor?: string
  descriptionColor?: string
  textColor?: string
  fontSize?: string
  fontWeight?: string
  lineHeight?: string
  letterSpacing?: string
}

export interface CardItem {
  id?: string
  title: string
  description?: string
  contentStyle?: ItemContentStyle
  imageUrl?: string
  /** Per-item video (YouTube embed or direct embed URL) */
  videoUrl?: string
  price?: string
  badge?: string
  buttonText?: string
  link?: string
  role?: string
  quote?: string
  author?: string
  rating?: number
}

export interface FaqItem {
  id?: string
  question: string
  answer: string
}

/** Progress bar items (steps or stacked rows) */
export interface ProgressBarItem {
  id?: string
  label: string
  value?: number
  completed?: boolean
  enabled?: boolean
}

/** Product detail tabs (description, specs, reviews, etc.) */
export interface ProductTabItem {
  id?: string
  label: string
  content?: string
  enabled?: boolean
}

/** How it works — step section */
export interface HowItWorksStep {
  id?: string
  title: string
  description?: string
  icon?: 'search' | 'cart' | 'credit-card' | 'truck' | 'package' | 'check' | 'user' | 'settings'
  enabled?: boolean
}

export interface TimelineEventItem {
  id?: string
  date?: string
  title: string
  description?: string
  tag?: string
  imageUrl?: string
  enabled?: boolean
}

/** Stats counter section */
export interface StatCounterItem {
  id?: string
  value: string
  label: string
  prefix?: string
  suffix?: string
  description?: string
  icon?: 'users' | 'globe' | 'star' | 'headphones' | 'trending' | 'award' | 'zap'
  enabled?: boolean
}

/** Secure checkout / trust badges */
export interface TrustBadgeItem {
  id?: string
  title: string
  description?: string
  icon?: 'lock' | 'shield' | 'truck' | 'refresh' | 'award' | 'check' | 'credit-card' | 'headphones'
  enabled?: boolean
}

/** Payment methods strip — checkout trust */
export interface PaymentMethodItem {
  id?: string
  name: string
  brandColor?: string
  textColor?: string
  enabled?: boolean
}

/** Shipping & returns info block sections */
export interface PolicyInfoSection {
  id?: string
  title: string
  description?: string
  icon?: 'truck' | 'package' | 'refresh' | 'shield' | 'clock'
  items: string[]
}

export interface TestimonialItem {
  id?: string
  quote: string
  author: string
  contentStyle?: ItemContentStyle
  role?: string
  rating?: number
  imageUrl?: string
}

export interface CommentItem {
  id?: string
  author: string
  avatarUrl?: string
  date?: string
  body: string
  likes?: number
  isAuthor?: boolean
  replies?: CommentItem[]
  enabled?: boolean
}

export interface PricingMatrixPlan {
  id?: string
  name: string
  price: string
  period?: string
  description?: string
  buttonText?: string
  buttonLink?: string
  highlighted?: boolean
  badge?: string
  enabled?: boolean
}

export interface PricingMatrixRow {
  id?: string
  feature: string
  hint?: string
  cells: string[]
  enabled?: boolean
}

export interface DataTableColumn {
  id?: string
  label: string
  align?: 'left' | 'center' | 'right'
  width?: string
  enabled?: boolean
}

export interface DataTableRow {
  id?: string
  cells: string[]
  enabled?: boolean
}

export interface LightboxItem {
  id?: string
  imageUrl: string
  title?: string
  caption?: string
  alt?: string
  enabled?: boolean
}

export interface ProfileStatItem {
  id?: string
  label: string
  value: string
  enabled?: boolean
}

export interface TeamMemberItem {
  id?: string
  name: string
  role: string
  contentStyle?: ItemContentStyle
  bio?: string
  imageUrl?: string
  email?: string
  socialLink?: string
}

export interface LogoItem {
  id?: string
  name: string
  imageUrl?: string
  /** contain = fit inside tile; cover = fill tile */
  imageFit?: 'contain' | 'cover'
  /** Focal point when imageFit is cover */
  imagePosition?: string
  /** Zoom 50–200 (%) */
  imageZoom?: number
  link?: string
  /** Show brand name under the card */
  showTitle?: boolean
  /** Optional background photo — fills the brand card edge-to-edge */
  backgroundImage?: string
  /** @deprecated — migrated to backgroundImage */
  useTileBackground?: boolean
  tileBackgroundImage?: string
}

export type FormFieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select'

export interface FormFieldItem {
  id?: string
  label: string
  type: FormFieldType | string
  placeholder?: string
  required?: boolean
  options?: string[]
}

export interface FormStepItem {
  id?: string
  title: string
  description?: string
  fields?: FormFieldItem[]
  enabled?: boolean
}

export interface PollOptionItem {
  id?: string
  label: string
  votes?: number
  enabled?: boolean
}

export interface MentionItem {
  id?: string
  name: string
  handle: string
  avatarUrl?: string
  role?: string
  enabled?: boolean
}

export interface PresenceUserItem {
  id?: string
  name: string
  avatarUrl?: string
  status?: 'online' | 'away' | 'busy' | 'offline'
  enabled?: boolean
}

export interface StepperStepItem {
  id?: string
  title: string
  description?: string
  enabled?: boolean
}

export interface OffCanvasLinkItem {
  id?: string
  label: string
  link?: string
  enabled?: boolean
}

export interface FabActionItem {
  id?: string
  label: string
  link?: string
  enabled?: boolean
}

export interface TabCategory {
  id: string
  label: string
  items: CardItem[]
}

export interface NavbarNavLink {
  id: string
  label: string
  link?: string
}

export interface FooterLink {
  label: string
  url: string
}

export interface FooterColumn {
  title: string
  links: FooterLink[]
}

export interface FooterSocialLink {
  platform: string
  url: string
}

export type PageBackgroundMode = 'solid' | 'gradient'

export interface PageBackground {
  mode: PageBackgroundMode
  backgroundColor?: string
  gradientFrom?: string
  gradientTo?: string
}

export interface Page {
  id: string
  name: string
  slug: string
  kind: PageKind
  blocks: Block[]
  background?: PageBackground
  /** When true, canvas and live site use dark styling for this page */
  darkMode?: boolean
}

export type BlockBackgroundMode = 'solid' | 'gradient'

export interface BlockStyles {
  backgroundMode?: BlockBackgroundMode
  backgroundColor?: string
  textColor?: string
  titleColor?: string
  subtitleColor?: string
  padding?: string
  margin?: string
  borderRadius?: string
  textAlign?: TextAlign
  fontSize?: string
  fontWeight?: string
  fontFamily?: string
  lineHeight?: string
  letterSpacing?: string
  backgroundImage?: string
  gradientFrom?: string
  gradientTo?: string
  overlayOpacity?: number
  boxShadow?: string
  /** When true, removes decorative shadows on this block (including built-in Tailwind shadow classes). */
  hideShadow?: boolean
  borderWidth?: string
  borderColor?: string
  borderStyle?: string
  animation?: string
  hideOnMobile?: boolean
  hideOnDesktop?: boolean
  maxWidth?: string
  /** Block size (canvas resize handle or style panel) */
  height?: string
  width?: string
  /** Max width for section subtitle text (e.g. 600px, 80%) */
  subtitleWidth?: string
}

export type HeroBackgroundMode = 'color' | 'image' | 'gradient' | 'video'

export interface BlockProps {
  visible?: boolean
  /** Hero/banner blocks: which background style is active (only one applies) */
  heroBackgroundMode?: HeroBackgroundMode
  text?: string
  subtitle?: string
  excerpt?: string
  html?: string
  buttonText?: string
  buttonText2?: string
  buttonLink?: string
  buttonLink2?: string
  imageUrl?: string
  imageAlt?: string
  videoUrl?: string
  icon?: string
  badge?: string
  badges?: string[]
  tags?: string[]
  items?: string[]
  features?: { title: string; description: string }[]
  cards?: CardItem[]
  tabCategories?: TabCategory[]
  /** Category stack block rows */
  stackCategories?: TabCategory[]
  stackSeeAllLabel?: string
  /** Optional section CTA (cards grid, product listing, etc.) */
  showViewAllButton?: boolean
  viewAllButtonText?: string
  viewAllButtonLink?: string
  /** Shared height for all card/product images in the section (e.g. 176px) */
  cardImageHeight?: string
  /** Hero / banner section minimum height (background or image column) */
  heroSectionHeight?: string
  /** Horizontal placement of inner content (hero, banner, slider) */
  heroContentAlignX?: 'start' | 'center' | 'end'
  /** Vertical placement of inner content (hero, banner, slider) */
  heroContentAlignY?: 'start' | 'center' | 'end'
  faqItems?: FaqItem[]
  logos?: string[]
  email?: string
  phone?: string
  companyName?: string
  /** Navbar block */
  navbarLinks?: NavbarNavLink[]
  navbarShowLogo?: boolean
  navbarLogoUrl?: string
  navbarShowLinks?: boolean
  navbarShowSearch?: boolean
  navbarSearchPlaceholder?: string
  navbarShowLogin?: boolean
  navbarLoginText?: string
  navbarLoginLink?: string
  navbarShowCart?: boolean
  /** Legal document block: privacy vs terms styling */
  legalVariant?: 'privacy' | 'terms'
  quote?: string
  author?: string
  role?: string
  rating?: number
  height?: string
  columns?: number
  gap?: string
  showPrices?: boolean
  linkedItemId?: string
  linkedItemType?: 'product' | 'service'
  pricingPlans?: { name: string; price: string; features: string[] }[]
  formFields?: FormFieldItem[]
  submitNote?: string
  placeholder?: string
  label?: string
  options?: string[]
  checked?: boolean
  showSearchButton?: boolean
  /** Back to top button */
  showBackToTopIcon?: boolean
  backToTopPosition?: 'bottom-right' | 'bottom-left' | 'bottom-center'
  /** Notification toast */
  toastVariant?: 'success' | 'error' | 'warning' | 'info'
  toastPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
  showToastIcon?: boolean
  showToastClose?: boolean
  toastAutoShow?: boolean
  /** Cookie consent banner */
  cookieBannerLayout?: 'bar' | 'floating'
  cookieBannerPosition?: 'bottom-left' | 'bottom-right' | 'bottom-center'
  showCookieReject?: boolean
  showCookiePolicyLink?: boolean
  cookiePolicyLinkText?: string
  /** Modal dialog */
  modalLayout?: 'classic' | 'glass' | 'sheet' | 'split'
  modalIcon?: 'none' | 'gift' | 'sparkles' | 'bell' | 'percent' | 'mail'
  modalAutoShow?: boolean
  showModalClose?: boolean
  showModalBackdrop?: boolean
  modalBackdropBlur?: boolean
  showModalSecondary?: boolean
  modalOverlayOpacity?: number
  modalTriggerText?: string
  /** Chat / WhatsApp float button */
  chatFloatProvider?: 'whatsapp' | 'custom'
  chatPhoneNumber?: string
  chatPrefillMessage?: string
  chatUrl?: string
  chatFloatPosition?: 'bottom-right' | 'bottom-left'
  chatFloatVariant?: 'icon' | 'pill' | 'bubble'
  chatGreeting?: string
  showChatPulse?: boolean
  showChatIcon?: boolean
  /** Product rating block */
  reviewCount?: number
  showReviewCount?: boolean
  showNumericScore?: boolean
  showRatingBreakdown?: boolean
  ratingBreakdown?: { stars: number; percent: number }[]
  productRatingLayout?: 'compact' | 'detailed'
  starSize?: 'sm' | 'md' | 'lg'
  /** Shipping & returns info */
  policySections?: PolicyInfoSection[]
  /** Payment methods strip */
  paymentMethods?: PaymentMethodItem[]
  paymentMethodsLayout?: 'card' | 'inline' | 'compact'
  showSecureBadge?: boolean
  secureText?: string
  /** Secure checkout / trust badges */
  trustBadges?: TrustBadgeItem[]
  secureCheckoutLayout?: 'grid' | 'row' | 'banner' | 'compact'
  showSecureHighlight?: boolean
  highlightTitle?: string
  highlightSubtitle?: string
  /** Stats counter */
  statItems?: StatCounterItem[]
  statsCounterLayout?: 'grid' | 'row' | 'banner' | 'minimal'
  statsDivider?: boolean
  /** How it works steps */
  howItWorksSteps?: HowItWorksStep[]
  howItWorksLayout?: 'horizontal' | 'vertical' | 'cards' | 'minimal'
  showStepNumbers?: boolean
  /** Timeline */
  timelineEvents?: TimelineEventItem[]
  timelineLayout?: 'vertical' | 'alternating' | 'horizontal' | 'compact'
  timelineTheme?: 'light' | 'premium' | 'dark'
  showTimelineDates?: boolean
  showTimelineConnector?: boolean
  showTimelineTags?: boolean
  /** State / status screens */
  stateScreenLayout?: 'centered' | 'card' | 'split'
  stateScreenTheme?: 'light' | 'dark' | 'brand'
  showStateIcon?: boolean
  stateCode?: string
  stateMeta?: string
  /** Product detail tabs */
  productTabs?: ProductTabItem[]
  productTabsLayout?: 'underline' | 'pills' | 'boxed'
  /** Progress bar */
  progressPercent?: number
  progressLabel?: string
  progressValueLabel?: string
  progressCurrent?: string
  progressTarget?: string
  showProgressPercent?: boolean
  showProgressValue?: boolean
  progressBarLayout?: 'bar' | 'goal' | 'steps' | 'stacked'
  progressBarHeight?: 'sm' | 'md' | 'lg'
  progressBarColor?: string
  progressItems?: ProgressBarItem[]
  /** Skeleton loader placeholders */
  skeletonLoaderLayout?: 'card' | 'text' | 'profile' | 'list' | 'grid'
  skeletonLineCount?: number
  skeletonRowCount?: number
  skeletonColumnCount?: number
  skeletonAnimation?: 'shimmer' | 'pulse' | 'none'
  skeletonRounded?: 'sm' | 'md' | 'lg'
  /** Simple animated loader */
  simpleLoaderStyle?: 'spinner' | 'dots' | 'ring' | 'bars'
  simpleLoaderSize?: 'sm' | 'md' | 'lg'
  simpleLoaderColor?: string
  simpleLoaderAlign?: 'left' | 'center' | 'right'
  showLoaderLabel?: boolean
  /** Comments section */
  commentItems?: CommentItem[]
  commentsLayout?: 'stacked' | 'cards' | 'threaded' | 'compact'
  showCommentForm?: boolean
  showCommentAvatars?: boolean
  showCommentLikes?: boolean
  showReplyButton?: boolean
  commentFormPosition?: 'top' | 'bottom'
  commentFormPlaceholder?: string
  commentFormButtonText?: string
  /** Before / after image slider */
  beforeImageUrl?: string
  afterImageUrl?: string
  beforeImageAlt?: string
  afterImageAlt?: string
  beforeLabel?: string
  afterLabel?: string
  beforeAfterPosition?: number
  beforeAfterOrientation?: 'horizontal' | 'vertical'
  beforeAfterAspect?: '16/9' | '4/3' | '1/1' | '3/4'
  beforeAfterTheme?: 'premium' | 'minimal' | 'bold'
  showBeforeAfterLabels?: boolean
  beforeAfterHandleStyle?: 'bar' | 'circle' | 'pill'
  /** Countdown timer */
  countdownTargetDate?: string
  countdownLayout?: 'cards' | 'inline' | 'banner' | 'compact'
  countdownTheme?: 'premium' | 'minimal' | 'dark'
  showCountdownDays?: boolean
  showCountdownHours?: boolean
  showCountdownMinutes?: boolean
  showCountdownSeconds?: boolean
  countdownExpiredText?: string
  countdownDayLabel?: string
  countdownHourLabel?: string
  countdownMinuteLabel?: string
  countdownSecondLabel?: string
  /** Pricing comparison matrix */
  pricingMatrixPlans?: PricingMatrixPlan[]
  pricingMatrixRows?: PricingMatrixRow[]
  pricingMatrixLayout?: 'table' | 'cards' | 'compact'
  pricingMatrixTheme?: 'premium' | 'minimal' | 'dark'
  showPricingMatrixCta?: boolean
  /** Data table */
  dataTableColumns?: DataTableColumn[]
  dataTableRows?: DataTableRow[]
  dataTableLayout?: 'classic' | 'striped' | 'compact'
  dataTableTheme?: 'light' | 'dark' | 'premium'
  showDataTableBorder?: boolean
  showDataTableHover?: boolean
  dataTableStickyHeader?: boolean
  /** Lightbox gallery */
  lightboxItems?: LightboxItem[]
  lightboxGridLayout?: 'grid' | 'masonry' | 'featured' | 'filmstrip'
  lightboxThumbTheme?: 'light' | 'dark' | 'minimal'
  lightboxOverlay?: 'blur' | 'solid' | 'gradient'
  showLightboxCaption?: boolean
  showLightboxCounter?: boolean
  showLightboxThumbnails?: boolean
  showLightboxZoomHint?: boolean
  /** Multi-step form */
  multiStepFormSteps?: FormStepItem[]
  multiStepFormLayout?: 'numbered' | 'tabs' | 'minimal' | 'sidebar'
  multiStepFormTheme?: 'light' | 'premium' | 'dark'
  showMultiStepProgress?: boolean
  showMultiStepLabels?: boolean
  multiStepBackText?: string
  multiStepNextText?: string
  multiStepSubmitText?: string
  multiStepSuccessTitle?: string
  multiStepSuccessMessage?: string
  /** Polls & voting */
  pollOptions?: PollOptionItem[]
  pollLayout?: 'bars' | 'cards' | 'list'
  pollTheme?: 'light' | 'premium' | 'dark'
  showPollResults?: boolean
  showPollVoteCount?: boolean
  pollTotalVotes?: number
  /** Mentions & tagging */
  mentionItems?: MentionItem[]
  mentionsLayout?: 'composer' | 'chips' | 'list'
  mentionsTheme?: 'light' | 'premium' | 'dark'
  showMentionAvatars?: boolean
  mentionComposerText?: string
  /** Live presence */
  presenceUsers?: PresenceUserItem[]
  presenceLayout?: 'stack' | 'list' | 'compact'
  presenceTheme?: 'light' | 'premium' | 'dark'
  showPresencePulse?: boolean
  presenceOnlineCount?: number
  presenceStatusText?: string
  /** Stepper */
  stepperSteps?: StepperStepItem[]
  stepperLayout?: 'horizontal' | 'vertical' | 'dots' | 'progress'
  stepperTheme?: 'light' | 'premium' | 'dark'
  stepperCurrentStep?: number
  showStepperLabels?: boolean
  showStepperDescriptions?: boolean
  /** Off-canvas menu */
  offCanvasLinks?: OffCanvasLinkItem[]
  offCanvasSide?: 'left' | 'right'
  offCanvasTheme?: 'light' | 'dark'
  offCanvasPreviewOpen?: boolean
  /** Floating action button */
  fabPosition?: 'bottom-right' | 'bottom-left' | 'bottom-center'
  fabVariant?: 'icon' | 'extended'
  fabIcon?: 'plus' | 'cart' | 'message' | 'edit'
  fabTheme?: 'brand' | 'dark' | 'light'
  fabActions?: FabActionItem[]
  showFabMenu?: boolean
  /** Wishlist */
  wishlistLayout?: 'grid' | 'list'
  wishlistTheme?: 'light' | 'premium'
  showWishlistPrices?: boolean
  /** Recently viewed */
  recentlyViewedLayout?: 'scroll' | 'grid'
  recentlyViewedTheme?: 'light' | 'premium'
  showRecentlyViewedPrices?: boolean
  /** Frequently bought together */
  bundleLayout?: 'horizontal' | 'stacked'
  bundleTheme?: 'light' | 'premium'
  bundleMainProductId?: string
  showBundleSavings?: boolean
  bundleSavingsPercent?: number
  bundleSavingsLabel?: string
  /** Infinite scroll */
  infiniteScrollInitialCount?: number
  infiniteScrollLoadCount?: number
  infiniteScrollTrigger?: 'button' | 'scroll'
  infiniteScrollColumns?: number
  showInfiniteScrollLoader?: boolean
  showInfiniteScrollPrices?: boolean
  /** Bundle builder */
  bundleBuilderMinItems?: number
  bundleBuilderMaxItems?: number
  bundleBuilderDiscountPercent?: number
  showBundleBuilderSavings?: boolean
  bundleBuilderPreviewSelectedIds?: string[]
  /** Cart drawer */
  cartDrawerSide?: 'left' | 'right'
  cartDrawerTheme?: 'light' | 'dark'
  cartDrawerPreviewOpen?: boolean
  showCartDrawerCheckout?: boolean
  showCartDrawerSubtotal?: boolean
  /** User profile card */
  userProfileLayout?: 'centered' | 'horizontal' | 'compact'
  userProfileTheme?: 'light' | 'premium' | 'dark'
  profileUsername?: string
  profileRole?: string
  profileBio?: string
  profileLocation?: string
  profileBadge?: string
  profileStats?: ProfileStatItem[]
  showProfileStats?: boolean
  showProfileActions?: boolean
  showProfileLocation?: boolean
  showProfileRole?: boolean
  showProfileAvatar?: boolean
  showProfileBadge?: boolean
  /** Sticky add-to-cart bar */
  productPrice?: string
  compareAtPrice?: string
  showStickyAtcImage?: boolean
  showStickyAtcQuantity?: boolean
  stickyAtcRevealOnScroll?: boolean
  stickyAtcScrollThreshold?: number
  /** Coupon / promo banners */
  couponCode?: string
  endsAt?: string
  overlayOpacity?: number
  alignment?: TextAlign
  /** Map embed block */
  location?: string
  mapEmbedUrl?: string
  mapHeight?: string
  showDirectionsLink?: boolean
  /** Footer blocks */
  tagline?: string
  address?: string
  footerColumns?: FooterColumn[]
  socialLinks?: FooterSocialLink[]
  legalLinks?: FooterLink[]
  showNewsletter?: boolean
  newsletterTitle?: string
  newsletterPlaceholder?: string
  /** Image title slider (category strip) */
  showImageTitleSliderArrows?: boolean
  showImageTitleSliderBadges?: boolean
  imageTitleSliderItemSize?: 'sm' | 'md' | 'lg'
  /** Carousel block (legacy slider uses same props) */
  showSlideTitle?: boolean
  showSlideCaption?: boolean
  showSlideArrows?: boolean
  showSlideDots?: boolean
  showSlideCounter?: boolean
  /** Gallery block */
  showGalleryTitle?: boolean
  showGalleryCaption?: boolean
  showGalleryLightbox?: boolean
  galleryLayout?: 'overlay' | 'below'
  /** Lookbook block */
  showLookbookTitle?: boolean
  showLookbookCaption?: boolean
  showLookbookBadge?: boolean
  lookbookLayout?: 'editorial' | 'grid' | 'strip'
  /** Product video gallery block */
  showProductVideoTitle?: boolean
  showProductVideoCaption?: boolean
  /** Card list view block */
  showListImage?: boolean
  showListBadge?: boolean
  showListPrice?: boolean
  showListButton?: boolean
  /** Testimonials block */
  testimonialItems?: TestimonialItem[]
  testimonialLayout?: 'featured' | 'manualSlider' | 'featuredAuto' | 'carousel' | 'grid' | 'autoSlider'
  testimonialAutoSlide?: boolean
  showTestimonialRating?: boolean
  showTestimonialAvatar?: boolean
  /** Team members block */
  teamMembers?: TeamMemberItem[]
  teamLayout?: 'grid' | 'manualSlider' | 'autoSlider'
  showTeamBio?: boolean
  showTeamEmail?: boolean
  showTeamSocial?: boolean
  /** Logos section block */
  logoItems?: LogoItem[]
  logosGrayscale?: boolean
  logosLayout?: 'manualSlider' | 'autoSlider'
  /** White rounded tiles for every brand (section-wide) */
  logosShowBrandTile?: boolean
  /** Show brand name under each tile (section-wide) */
  logosShowBrandNames?: boolean
  /** Shared slider timing (testimonials, team, logos) */
  sliderIntervalSeconds?: number
  /** Image & Text hero (heroSplit) */
  splitImageSide?: 'left' | 'right'
  /** Product listing block */
  products?: CatalogProduct[]
  showAddToCart?: boolean
  /** Container block */
  containerLayout?: ContainerLayout
  containerGap?: 'sm' | 'md' | 'lg'
  containerLabel?: string
  /** Default alignment for all children (container block) */
  containerAlignX?: ContainerAlign
  containerAlignY?: ContainerAlign
  /** Columns to span inside a parent container (1–3) */
  containerSpan?: 1 | 2 | 3
  /** Per-child alignment override (inherits container when unset) */
  containerChildAlignX?: ContainerAlign
  containerChildAlignY?: ContainerAlign
}

export type ContainerLayout = 'column' | 'row' | 'grid'

/** Horizontal or vertical alignment inside a container cell */
export type ContainerAlign = 'stretch' | 'start' | 'center' | 'end'

export interface Block {
  id: string
  type: BlockType
  props: BlockProps
  styles: BlockStyles
  /** Nested blocks when type is `container` */
  children?: Block[]
}

export interface BlockDefinition {
  type: BlockType
  label: string
  category: BlockCategory
  icon: string
  defaultProps: BlockProps
  defaultStyles: BlockStyles
}

export type EditorMode = 'edit' | 'preview'
