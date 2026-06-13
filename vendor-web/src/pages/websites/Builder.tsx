import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import { FormColumnLabel } from '@/components/common/FieldLabel'
import { registerEscapeHandler } from '@/lib/escapeCloseRegistry'
import { dismissBuilderEscapeLayer, type BuilderEscapeActions, type BuilderEscapeUiState } from '@/lib/builderEscapeDismiss'
import React, {
  useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo,
} from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import {
  ArrowLeft, Monitor, Tablet, Smartphone, Save, Eye, EyeOff,
  Undo2, Redo2, Plus, Trash2, Copy, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown,
  GripVertical, Settings2, Palette, Sparkles, Image as ImageIcon,
  FileText, Layers, Layout, Code, Globe, Search, X, Check,
  Loader2, ChevronRight, MoreVertical, MoreHorizontal, History, Lightbulb, PanelLeft, PanelRight,
  Wand2, AlertTriangle, Download, ExternalLink, RefreshCw,
  Bold, Italic, Link2,
  Maximize2, Minimize2, Move, Pencil, PlusCircle, Upload,
  ZoomIn, ZoomOut,
  Zap, Star, Shield, Phone, Mail, MapPin, Clock, CheckCircle2,
  ChevronLeft, BarChart3, Users, ShoppingBag, Heart,
  PlayCircle, Quote, Award, Briefcase, Camera,
  Type, Square, Columns, Video, Map as MapIcon, MessageSquare,
  Hash, Minus, List, ToggleLeft, Radio, Info,
  Database, Plug, RefreshCcw, Package, Wrench, ShoppingCart,
  Store as StoreIcon, ClipboardCopy, ClipboardPaste, RotateCcw, SlidersHorizontal, Paintbrush, Scissors, Eraser, Pin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  useSite,
  useUpdateSite,
  useWebsiteTemplates,
  useAIGenerateTheme, useMedia, useUploadMedia, useSaveExternalUrl,
  useAIGenerateSEO, useAISuggestBlocks,
  useRedirects, useCreateRedirect, useDeleteRedirect,
  useEnableHeadless, useDisableHeadless,
} from '@/hooks/useWebsites'
import type {
  WebsiteSite, WebsiteBlock, WebsitePage, BlockType, DeviceMode, BuilderPanel,
  PageStyleOverrides,
  PageTrashItem,
  StyleConfig, BlockProps,
  LiveResource, LiveItem,
  SiteListItem,
} from '@/types/websites'
import { resolveUniqueSiteName, suggestSiteCopyName } from '@/lib/websiteSiteNames'
import { websiteApi } from '@/api/websites'
import { vendorApi } from '@/api/vendor'
import { useVendorStore } from '@/stores/vendorStore'
import { useMyVendor, useStores } from '@/hooks/useVendor'
import { getTemplatePreviewPalette } from '@/lib/templateBlockHighlights'
import { BUSINESS_UNIT_STORE_LABEL } from '@/lib/businessUnitLabels'
import { formatStoreCode } from '@/lib/verification'
import { BuilderCanvasProviders } from '@/components/websites/BuilderCanvasProviders'
import { CanvasHScrollbar } from '@/components/websites/CanvasHScrollbar'
import { BuilderCanvasPageRenderer, mergePageStyle } from '@/components/websites/BuilderCanvasPageRenderer'
import {
  BuilderSectionOverlay,
  BuilderSectionPaddingHandles,
} from '@/components/websites/BuilderSectionOverlay'
import {
  FontSizePxControl,
  FontFamilyControl,
  TextCaseList,
  TextFieldAlignGrid,
  LayoutTransformPositionGroup,
  FieldPositionNudge,
  type LayoutTransformScope,
  ColorIdentPickerRow,
  LineSpacingMenuContent,
  LineSpacingToolbarButton,
  TypographyCompositionFields,
  typographyToolbarBox,
  type TextAlignH,
  type TextAlignV,
} from '@/components/websites/TypographyCompositionControls'
import { ScrollAnimationControls } from '@/components/websites/ScrollAnimationControls'
import { animationOptionLabel } from '@storefront/lib/builderScrollAnimations'
import {
  BuilderCanvasInlineTextEdit,
  type InlineTextEditSession,
} from '@/components/websites/BuilderCanvasInlineTextEdit'
import {
  listSectionTextFields,
  buildPropPatchFromFieldKey,
  insertActiveCanvasLineBreak,
  getCanvasFieldComputedFontSizePx,
  getCanvasFieldComputedFormatPaintStyle,
  resolveToolbarTypographyDisplay,
  runCanvasTextClipboardAction,
} from '@/lib/builderCanvasTextEdit'
import {
  runCanvasTextClearAction,
  TEXT_CLEAR_MENU,
  type TextClearAction,
} from '@/lib/builderCanvasTextClear'
import {
  editableFieldKeys,
  primaryTextFieldKey,
  toggleTextFieldInTarget,
  type ActiveTextTarget,
} from '@/lib/builderTextSelection'
import { isCanvasFieldClickTarget, resolveCanvasFieldKeyFromTarget } from '@storefront/lib/builderMultiSelect'
import {
  FONT_SIZE_PX_MAX,
  FONT_SIZE_PX_MIN,
  FONT_SIZE_PX_STEP,
  FONT_SIZE_PX_FALLBACK,
  PARAGRAPH_SPACE_MAX_PX,
  PARAGRAPH_SPACE_STEP_PX,
  buildTextCasePropsPatch,
  currentTextCaseMenuId,
  toSentenceCase,
  toToggleCase,
} from '@/lib/builderTypography'
import { buildBuilderPublicSite } from '@/lib/builderPublicSite'
import {
  extractFormatPaintStyle,
  extractFormatPaintStyleFromElement,
  extractFormatPaintStyleFromRange,
  formatPaintStyleSummary,
  hasFormatPaintStyle,
  buildFormatPaintPropsPatch,
  resolveFormatPaintStyle,
  type FormatPaintStyle,
} from '@/lib/builderFormatPainter'
import { MediaStudioPanel } from '@/components/websites/MediaStudioPanel'
import { MediaClipPicker } from '@/components/websites/MediaClipPicker'
import { DesignBarDropdownPortal } from '@/components/websites/DesignBarDropdownPortal'
import { VisualDesignBarTools } from '@/components/websites/VisualDesignBarTools'
import { OverlayIconPicker } from '@/components/websites/OverlayIconPicker'
import { OverlayTransformControls } from '@/components/websites/OverlayTransformControls'
import { SectionImageControls } from '@/components/websites/SectionImageControls'
import type { OverlayLayerItem } from '@/lib/builderOverlayVisual'
import { overlayImageImgStyle } from '@storefront/lib/overlayImageStyle'
import { builderOverlayIconLabel, overlayIconRenderSize, resolveBuilderOverlayIcon } from '@storefront/lib/builderOverlayIcons'
import { SHADOW_PRESETS, SHAPE_OPTIONS } from '@/lib/builderVisualPresets'
import { blockSupportsMediaClip } from '@storefront/lib/mediaClip'
import {
  sectionPrimaryImageField,
  sectionSupportsBgStyle,
  sectionSupportsContentGroupTransform,
  sectionSupportsEdgeShapes,
  sectionSupportsMediaClip,
} from '@storefront/lib/designBarCapabilities'
import {
  canvasImageArraySlots,
  canvasImageStyleField,
  toggleCanvasImageSlot,
  type ActiveCanvasImageTarget,
} from '@storefront/lib/canvasImageTarget'
import { MediaDesignBarTools } from '@/components/websites/MediaDesignBarTools'
import { SingleImagePreview } from '@/components/common/CatalogMediaLightbox'
import { SectionLayoutPickerModal } from '@/components/websites/SectionLayoutPickerModal'
import { BuilderTipsButton } from '@/components/websites/BuilderTipsButton'
import { BuilderCommandPalette, type CommandPaletteBlockDef } from '@/components/websites/BuilderCommandPalette'
import {
  BuilderWelcomePanel,
  dismissBuilderWelcome,
  readBuilderWelcomeDismissed,
} from '@/components/websites/BuilderWelcomePanel'
import {
  BuilderSpacingCoachMark,
  dismissBuilderSpacingTip,
  readBuilderSpacingTipDismissed,
} from '@/components/websites/BuilderSpacingCoachMark'
import {
  SectionEditorRibbon,
  resolveSectionEditorTab,
  type SectionEditorTabId,
} from '@/components/websites/SectionEditorRibbon'
import { SectionPanelGroup } from '@/components/websites/SectionPanelGroup'
import {
  applyCategoryImagesToBlockProps,
  blockSupportsGalleryCategory,
  finalizeCategoryLayoutProps,
  suggestImageCategoryForBlock,
} from '@/lib/blockGalleryImages'
import {
  buildBlockColorStyleCss,
  hasTileColorOverrides,
  TILE_COLOR_BLOCK_TYPES,
  tileColorSwatch,
  type BlockColorProps,
  type ThemeColors,
} from '@/lib/blockColorOverrides'
import { getSectionLayoutOptions, findActiveSectionLayoutOption, findBestSectionLayoutOption, findActiveLayoutIndex, getCycledSectionLayoutOption } from '@/lib/sectionLayoutPresets'
import {
  BLOCK_AUTO_SOURCE,
  DATA_SOURCES,
  normalizeSourceType,
  applyDataSourceToBlockProps,
  getRecommendedDataSources,
  getOtherDataSources,
  BLOCK_REQUIRED_DATA_SOURCE,
  type LayoutPickerDataSourceChoice,
} from '@/lib/blockDataSources'
import { mergeLayoutBlockProps } from '@/lib/layoutBlockProps'
import { heroUsesBackgroundImage, heroUsesSideImage, resolveBlockPrimaryImageField } from '@/lib/heroLayoutUtils'
import {
  buildVendorDraftPreviewUrl,
  navigateDraftPreviewTab,
  prepareDraftPreviewTab,
  BUILDER_CRISP_LABEL,
  getStorefrontAppOrigin,
  shouldUseLocalStorefrontUrls,
  STOREFRONT_PREVIEW_IN_BROWSER_BTN_CLASS,
} from '@/lib/storefrontPreviewUrl'
import { mediaUrl } from '@/lib/utils'
import { extractApiError, isBuilderPreviewInfraFailure } from '@/lib/errorMessages'
import { buildDraftPreviewCatalogUrl, parseCatalogStorePath, parseStorefrontEmbedRoute } from '@/lib/catalogStorePaths'
import { recallDraftPreviewToken } from '@/lib/draftPreviewNavigation'
import {
  isLiveTeamDataSource,
  shouldUseLiveTeam,
  liveItemToPropMember,
  teamPropMembers,
} from '@/lib/teamGridContent'
import { broadcastPreviewTabError, clearPendingPreviewTabError, clearPendingPreviewTabNavigate, pushDraftPreviewUpdate, rememberDraftPreviewSession } from '@/lib/draftPreviewSync'
import {
  WELLNESS_CATEGORY_FALLBACK_IMAGES,
  WELLNESS_DEFAULT_CATEGORY_TITLES,
} from '@storefront/lib/wellnessCategoryStyle'
import { IMAGE_SHAPE_OPTIONS } from '@storefront/lib/sectionItemLayout'
import { buildFieldStylesCss, fieldTextStyle, CONTENT_GROUP_FIELD_KEY, FIELD_OFFSET_STEP_PX, hasInlineHtml, readFieldOffset, readFlipFlag, readRotateDeg } from '@storefront/lib/fieldTextStyles'
import { BUILDER_FONT_FAMILIES, ensureBuilderFontLoaded } from '@storefront/lib/builderFontFamilies'
import {
  applyInlineTextSelectionStyle,
  applyInlineTextStyleAtPoint,
  applyPatchToLastStyledSpan,
  BUILDER_DESIGN_BAR_CHROME_ATTR,
  BUILDER_TYPOGRAPHY_TOOLBAR_ATTR,
  ensureInlineTextSelectionTracking,
  getInlineStyledElementAtSelection,
  getLastInlineStyledSpan,
  getSavedInlineTextSelection,
  getSelectionFontSizePx,
  hasActiveInlineTextSelection,
  pinInlineTextSelectionBeforeToolbarAction,
  restoreSavedInlineSelection,
} from '@storefront/lib/builderInlineTextSelection'
import { mergeBlockSectionStyles, readRawBlockStyleOverrides, resolveBreakpointStyleOverrides } from '@storefront/lib/blockStyleOverrides'

// ?? Block definitions catalog ?????????????????????????????????????????????????

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
  { type: 'nav', label: 'Navigation', icon: Layout, desc: 'Top navigation with logo and links', category: 'structure', defaultProps: { brand: 'My Store', brand_logo: '', show_logo: true, show_brand_name: true, show_nav_links: true, nav_links_source: 'site_pages', nav_links: [{ label: 'Home', url: '/' }, { label: 'Shop', url: '/products' }, { label: 'Contact', url: '/contact' }], show_search: true, show_cart: true, show_login: true, cta_label: 'Shop now' } },
  { type: 'footer', label: 'Footer', icon: Layout, desc: 'Site footer with links and copyright', category: 'structure', defaultProps: {
    copyright: '? 2026 My Store. All rights reserved.',
    show_legal: true,
    footer_columns: [
      { title: 'Shop', links: ['All products', 'Categories', 'Offers'] },
      { title: 'Help', links: ['Contact', 'Shipping', 'Returns'] },
      { title: 'About', links: ['Our story', 'Visit us', 'Careers'] },
      { title: 'Legal', links: ['Terms', 'Privacy', 'Refund policy'] },
    ],
  } },
  { type: 'announcement_bar', label: 'Announcement Bar', icon: Hash, desc: 'Top banner for promotions', category: 'structure', defaultProps: { text: 'Free delivery on orders over ?499 ? shop our latest arrivals today.', color: '#274832', show_close: true } },
  { type: 'marquee_strip', label: 'Marquee strip', icon: Type, desc: 'Scrolling one-line highlights (e.g. shipping, craft)', category: 'structure', defaultProps: { text: 'Free shipping,Easy returns,Fresh daily,Handpicked quality,Secure checkout,Local & trusted' } },
  // Hero
  { type: 'hero', label: 'Hero ? Centered', icon: Square, desc: 'Full-width hero with CTA buttons', category: 'hero', defaultProps: { headline: 'Welcome to Our Store', subtitle: 'Thoughtfully chosen products and friendly service ? everything you need in one place.', bg_style: 'gradient', cta_primary: 'Shop now', cta_secondary: 'Learn more', layout: 'centered' } },
  { type: 'hero_split', label: 'Hero ? Split', icon: Columns, desc: 'Left text, right image hero', category: 'hero', defaultProps: { headline: 'Discover what we offer', headline_line2: 'made for everyday life', subtitle: 'Browse our collection ? quality you can see, service you can trust.', bg_style: 'minimal', cta_primary: 'Shop bestsellers', cta_secondary: 'Browse categories', layout: 'split', eyebrow: 'Welcome', eyebrow_plain: true } },
  { type: 'hero_minimal', label: 'Hero ? Minimal', icon: Type, desc: 'Clean, text-focused hero', category: 'hero', defaultProps: { headline: 'Simple. Beautiful. Yours.', subtitle: 'A clean start for your brand ? edit this headline to match your store.', bg_style: 'minimal', cta_primary: 'Get started', layout: 'minimal' } },
  // Content
  { type: 'features', label: 'Features Grid', icon: Columns, desc: 'Feature cards in a grid', category: 'content', defaultProps: { title: 'Why shop with us', layout: 'grid-3', features: [{ icon: 'Truck', title: 'Fast delivery', desc: 'Quick, reliable shipping to your door' }, { icon: 'Shield', title: 'Secure checkout', desc: 'Safe payments and protected orders' }, { icon: 'Heart', title: 'Quality guaranteed', desc: 'Handpicked products we stand behind' }] } },
  { type: 'features_alternating', label: 'Features ? Alternating', icon: List, desc: 'Alternating image/text sections', category: 'content', defaultProps: { title: 'Why Choose Us', layout: 'stacked', image_position: 'left', features: [{ title: 'Fresh & quality', desc: 'We source carefully so every order meets our standards.', image_url: '' }, { title: 'Friendly support', desc: 'Questions? Our team is happy to help before and after you buy.', image_url: '' }] } },
  { type: 'stats', label: 'Stats / Numbers', icon: BarChart3, desc: 'Key metrics and achievements', category: 'content', defaultProps: { title: 'Trusted by our community', stats: [{ value: '2K+', label: 'Happy customers' }, { value: '500+', label: 'Products' }, { value: '4.8?', label: 'Average rating' }, { value: '24/7', label: 'Online ordering' }] } },
  { type: 'testimonials', label: 'Testimonials', icon: Quote, desc: 'Customer reviews and quotes', category: 'social', defaultProps: { title: 'What our customers say', testimonials: [{ name: 'Priya Sharma', role: 'Regular customer', company: '', quote: 'Great quality and fast delivery ? I order every week!', rating: 5 }, { name: 'James Wilson', role: 'Local buyer', company: '', quote: 'Easy to shop and the team was very helpful.', rating: 5 }] } },
  { type: 'team_grid', label: 'Team Grid', icon: Users, desc: 'Meet the team cards', category: 'about', defaultProps: { title: 'Meet our team', columns: 4, members: [{ name: 'Alex Morgan', role: 'Store owner', bio: 'Passionate about great products and service.' }, { name: 'Sam Rivera', role: 'Customer care', bio: 'Here to help with orders and questions.' }] } },
  { type: 'pricing', label: 'Pricing Table', icon: Hash, desc: 'Pricing plans comparison', category: 'conversion', defaultProps: { title: 'Our packages', show_annual_toggle: false, plans: [{ name: 'Starter', price: 299, period: 'order', features: ['Curated selection', 'Standard delivery', 'Email support'], cta: 'Order now' }, { name: 'Popular', price: 599, period: 'order', features: ['Best value bundle', 'Priority delivery', 'Phone support', 'Gift wrap'], highlighted: true, cta: 'Order now' }, { name: 'Premium', price: 999, period: 'order', features: ['Full collection access', 'Same-day delivery', 'Dedicated support', 'Custom requests'], cta: 'Contact us' }] } },
  { type: 'faq', label: 'FAQ / Accordion', icon: MessageSquare, desc: 'Frequently asked questions', category: 'content', defaultProps: { title: 'Common questions', faqs: [{ question: 'How do I place an order?', answer: 'Browse our products, add items to your cart, and checkout securely online.' }, { question: 'What are your delivery times?', answer: 'Most orders arrive within 2?5 business days. Local delivery may be faster.' }, { question: 'Can I return an item?', answer: 'Yes ? unused items can be returned within 14 days. Contact us to start a return.' }] } },
  { type: 'cta', label: 'Call to Action', icon: Zap, desc: 'Bold CTA section to convert visitors', category: 'conversion', defaultProps: { headline: 'Ready to shop?', subtitle: 'Browse our collection and find something you will love today.', cta_label: 'Start shopping', cta_url: '/products' } },
  { type: 'contact_form', label: 'Contact Form', icon: Mail, desc: 'Contact form with fields', category: 'contact', defaultProps: { title: 'Get in touch', layout: 'split', full_page: false, email: '', phone: '', address: '', show_map: false, form_fields: [{ name: 'name', type: 'text', required: true, placeholder: 'Your name' }, { name: 'email', type: 'email', required: true, placeholder: 'Your email' }, { name: 'message', type: 'textarea', required: true, placeholder: 'How can we help?' }] } },
  { type: 'portfolio_grid', label: 'Portfolio Grid', icon: Camera, desc: 'Filterable work portfolio grid', category: 'portfolio', defaultProps: { title: 'Our Work', columns: 3, filterable: true } },
  { type: 'gallery_masonry', label: 'Gallery Masonry', icon: ImageIcon, desc: 'Masonry image gallery', category: 'media', defaultProps: { title: 'Gallery', layout: 'masonry', columns: 3, images: [] } },
  { type: 'blog_grid', label: 'Blog Grid', icon: FileText, desc: 'Latest posts in a grid', category: 'blog', defaultProps: { title: 'Latest Posts', columns: 3 } },
  { type: 'newsletter', label: 'Newsletter', icon: Mail, desc: 'Email capture / subscribe form', category: 'conversion', defaultProps: { title: 'Stay in the Loop', subtitle: 'Get the latest news and updates delivered to your inbox.', cta_label: 'Subscribe' } },
  { type: 'video_embed', label: 'Video Embed', icon: Video, desc: 'YouTube / Vimeo video player', category: 'media', defaultProps: { title: 'Watch our story', video_url: '', aspect_ratio: '16:9' } },
  { type: 'map_embed', label: 'Map', icon: MapIcon, desc: 'Embedded map with location', category: 'contact', defaultProps: { title: 'Visit us', address: '' } },
  { type: 'trust_logos', label: 'Trust Logos', icon: Award, desc: 'Partner/client logo strip', category: 'social', defaultProps: { title: 'Trusted by our partners' } },
  { type: 'timeline', label: 'Timeline', icon: Clock, desc: 'Company history or process steps', category: 'about', defaultProps: { title: 'Our story', items: [{ year: '2020', title: 'We opened our doors', desc: 'Started as a small local shop with a big vision.' }, { year: '2022', title: 'Growing together', desc: 'Expanded our range and welcomed thousands of customers.' }, { year: '2024', title: 'Online store launch', desc: 'Now you can shop with us anytime, anywhere.' }] } },
  { type: 'rich_text', label: 'Rich Text', icon: Type, desc: 'Formatted text content block', category: 'content', defaultProps: { content: '<h2>Your Heading</h2><p>Add your content here. This block supports <strong>bold</strong>, <em>italic</em>, and other formatting.</p>' } },
  { type: 'image_block', label: 'Image', icon: ImageIcon, desc: 'Single image with optional caption', category: 'media', defaultProps: { image_url: '', caption: 'Image caption' } },
  { type: 'divider', label: 'Divider', icon: Minus, desc: 'Visual separator between sections', category: 'layout', defaultProps: { style: 'line', color: '#e5e7eb', spacing: 40 } },
  { type: 'spacer', label: 'Spacer', icon: Minus, desc: 'Blank vertical spacer', category: 'layout', defaultProps: { height: 80 } },
  { type: 'social_links', label: 'Social Links', icon: Globe, desc: 'Social media icon links', category: 'social', defaultProps: { title: 'Follow Us', social_links: { twitter: 'https://twitter.com', instagram: 'https://instagram.com', linkedin: 'https://linkedin.com' } } },
  { type: 'countdown', label: 'Countdown Timer', icon: Clock, desc: 'Countdown to a date/event', category: 'conversion', get defaultProps() { return { title: 'Launch In', target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() } } },
  { type: 'product_grid', label: 'Product Grid', icon: ShoppingBag, desc: 'Display products from your catalog', category: 'ecommerce', defaultProps: { title: 'Featured Products', columns: 4, show_badges: true } },
  { type: 'category_cards', label: 'Category Cards', icon: Layers, desc: 'Animated wellness mosaic ? circles, squares & portraits', category: 'ecommerce', defaultProps: {
    title: 'Shop by category',
    eyebrow: 'Explore',
    layout: 'wellness',
    columns: 3,
    categories: WELLNESS_DEFAULT_CATEGORY_TITLES.map((title, i) => ({
      title,
      image_url: WELLNESS_CATEGORY_FALLBACK_IMAGES[i % WELLNESS_CATEGORY_FALLBACK_IMAGES.length],
    })),
  } },
  { type: 'menu_grid', label: 'Menu / Catalog', icon: List, desc: 'Restaurant-style menu grid', category: 'food', defaultProps: { title: 'Our Menu', categories: ['Starters', 'Mains', 'Desserts', 'Drinks'] } },
  { type: 'about_split', label: 'About Split', icon: Columns, desc: 'About section with image and text', category: 'about', defaultProps: { title: 'About us', subtitle: 'Our story', description: 'Tell customers who you are, what you sell, and why they can trust you.' } },
  { type: 'services_cards', label: 'Services Cards', icon: Briefcase, desc: 'Service offering cards', category: 'content', defaultProps: { title: 'Our services', columns: 3, features: [{ icon: 'Zap', title: 'Consultation', desc: 'Expert advice tailored to your needs.' }, { icon: 'Shield', title: 'Installation', desc: 'Professional setup you can rely on.' }, { icon: 'Star', title: 'Support', desc: 'Friendly help after you buy.' }] } },
  { type: 'html_embed', label: 'HTML Embed', icon: Code, desc: 'Custom HTML/widget embed', category: 'advanced', defaultProps: { html: '<p>Add your custom HTML here</p>' } },

  // ERP / live data blocks
  { type: 'live_stock', label: 'Live Stock Ticker', icon: RefreshCw, desc: 'Real-time product stock levels from your catalog', category: 'erp', defaultProps: { title: 'In stock now', show_count: 6 } },
  { type: 'order_status', label: 'Order Status Lookup', icon: Package, desc: 'Customer-facing order tracking widget', category: 'erp', defaultProps: { title: 'Track Your Order', placeholder: 'Enter order number...' } },
  { type: 'live_quote', label: 'Live Quote Widget', icon: RefreshCcw, desc: 'Auto-generated price quote from catalog', category: 'erp', defaultProps: { title: 'Get an Instant Quote', cta_label: 'Calculate Price' } },

  // Engagement / conversion
  { type: 'booking_widget', label: 'Booking Widget', icon: Clock, desc: 'Calendar-based appointment booking', category: 'widgets', defaultProps: { title: 'Book a Session', subtitle: 'Choose a time that works for you', cta_label: 'Book Now', show_calendar: true, service_name: 'Consultation' } },
  { type: 'booking_slot_picker', label: 'Booking Slot Picker', icon: Clock, desc: 'Step-by-step service / date / time selector', category: 'widgets', defaultProps: { title: 'Book an Appointment', subtitle: 'Select a service and choose your preferred time' } },
  { type: 'ab_test_block', label: 'A/B Test Block', icon: ToggleLeft, desc: 'Show variant A or B to split-test content', category: 'advanced', defaultProps: { variant_a: { headline: 'Version A Headline', cta: 'Click Here A' }, variant_b: { headline: 'Version B Headline', cta: 'Click Here B' }, split: 50 } },
  { type: 'personalization_block', label: 'Personalization Block', icon: Users, desc: 'Show different content by device / location / referral', category: 'advanced', defaultProps: { default_content: 'Default message for all visitors', mobile_content: 'Tap to get started on mobile!', rule: 'device' } },

  // Commerce ? P1 business front blocks (must mirror business front BlockRenderer)
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


// ?? Block mini-preview thumbnails (emoji shorthand) ???????????????????????????
const BLOCK_THUMBNAILS: Record<string, string> = {
  nav: '??', footer: '??', announcement_bar: '??', marquee_strip: '??',
  hero: '??', hero_split: '??', hero_minimal: '?',
  features: '?', features_alternating: '??',
  stats: '??', testimonials: '??', team_grid: '??',
  pricing: '??', faq: '?', cta: '??',
  contact_form: '??', portfolio_grid: '???', gallery_masonry: '???',
  blog_grid: '??', newsletter: '??', video_embed: '??',
  map_embed: '???', trust_logos: '??', timeline: '??',
  rich_text: '??', image_block: '???', divider: '??', spacer: '??',
  social_links: '??', countdown: '??',
  product_grid: '???', menu_grid: '???', about_split: '??',
  services_cards: '??', html_embed: '??',
  live_stock: '??', order_status: '??', live_quote: '??',
  booking_widget: '??', ab_test_block: '??', personalization_block: '??',
  coupon_banner: '???', payment_methods_strip: '??',
  search_bar: '??', cookie_consent: '??',
  product_detail: '??', checkout_form: '??', product_reviews: '?',
  booking_slot_picker: '???',
  cart_drawer: '??', product_filters: '??',
  related_products: '???', recently_viewed: '?',
}

function catalogBlockLabel(block: { block_type: string; label?: string | null }): string {
  if (block.label) return block.label
  const def = getBlockCatalogDef(block.block_type)
  return def?.label || block.block_type.replace(/_/g, ' ')
}

function getBlockCatalogDef(blockType: string): BlockDef | undefined {
  return BLOCK_CATALOG.find(d => d.type === blockType)
    ?? COMMERCE_LIBRARY_BLOCKS.find(d => d.type === blockType)
}

const BLOCK_CATEGORIES = [
  { id: 'all', label: 'All Sections' },
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
  { id: 'erp', label: 'Store features' },
  { id: 'widgets', label: 'Widgets' },
  { id: 'layout', label: 'Layout' },
  { id: 'advanced', label: 'Advanced' },
]

const DEFAULT_STYLE: StyleConfig = {
  primary_color: '#274832',
  secondary_color: '#4A7A58',
  accent_color: '#E07A5F',
  bg_color: '#F9F9F5',
  surface_color: '#FFFFFF',
  text_color: '#182E20',
  font_heading: 'DM Serif Display',
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

function mergePageStyleConfig(siteStyle: StyleConfig, pageId: string | null | undefined): StyleConfig {
  return mergePageStyle(siteStyle, pageId)
}

/** Export shape matches `GET /vendors/me/websites/:id/export` ? paste into `/import` or keep as backup. */
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
  return buildBuilderPublicSite(site, localPages, localBlocks, localStyle) as unknown as Record<string, unknown>
}

const FONTS = [...BUILDER_FONT_FAMILIES]

// ?? In-block overlay element system ??????????????????????????????????????????

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
  type: 'text' | 'image' | 'button' | 'box' | 'badge' | 'icon' | 'video'
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
  linkLabel?: string             // human-readable label (e.g. "Espresso ? ?180")
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
  /** When `'none'`, fill is transparent so the block/page background shows through. */
  bgFill?: 'solid' | 'none'
  /** Lucide icon id when type is `icon`. */
  iconName?: string
}

function isOverlayNoFill(item: BlockOverlayItem): boolean {
  return item.bgFill === 'none' || item.bgColor === 'transparent'
}

function resolveOverlayBackground(item: BlockOverlayItem, fallback: string): string {
  if (isOverlayNoFill(item)) return 'transparent'
  return item.bgColor || fallback
}

function resolveOverlayBorder(item: BlockOverlayItem): string | undefined {
  const w = item.borderWidth ?? 0
  if (w <= 0) return undefined
  return `${w}px solid ${item.borderColor || '#111827'}`
}

function defaultOverlayFillColor(type: BlockOverlayItem['type']): string {
  return (OVERLAY_DEFAULTS[type] as Partial<BlockOverlayItem> | undefined)?.bgColor
    || OVERLAY_DEFAULTS.button?.bgColor
    || '#64C3A0'
}

const OVERLAY_DEFAULTS: Record<string, Partial<BlockOverlayItem>> = {
  text:    { w: 220, h: 60,  text: 'Your text here', fontSize: 18, color: '#111827', bgColor: 'transparent' },
  image:   { w: 300, h: 200, objectFit: 'cover', borderRadius: 8 },
  button:  { w: 160, h: 44,  text: 'Click Here', bgColor: '#64C3A0', color: '#ffffff', borderRadius: 8, fontSize: 14, fontWeight: 'bold' },
  box:     { w: 280, h: 180, bgColor: 'rgba(255,255,255,0.9)', borderRadius: 12, shadow: true, borderColor: 'rgba(124,58,237,0.2)', borderWidth: 2 },
  badge:   { w: 90,  h: 32,  text: 'New', bgColor: '#64C3A0', color: '#ffffff', borderRadius: 999, fontSize: 12, fontWeight: 'bold' },
  icon:    { w: 56,  h: 56,  iconName: 'star', color: '#111827', bgColor: 'transparent', bgFill: 'none', fontSize: 32 },
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

// ?? Draggable popup hook ??????????????????????????????????????????????????????
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

// ?? Reusable Text Prompt Popup ????????????????????????????????????????????????
// A small styled replacement for window.prompt(). Used for quick edits of text,
// descriptions, alt-text, image URLs, etc., without jarring browser dialogs.

function TextPromptPopup({
  open, anchor, title, subtitle, initialValue, placeholder, multiline, maxLength,
  helpText, minLength,
  confirmLabel = 'Save', secondaryLabel, confirmOnly, destructive,
  onSave, onSecondary, onClose,
}: {
  open: boolean
  anchor?: { x: number; y: number } | null
  title: string
  subtitle?: string
  initialValue?: string
  placeholder?: string
  multiline?: boolean
  maxLength?: number
  helpText?: string
  minLength?: number
  confirmLabel?: string
  secondaryLabel?: string
  confirmOnly?: boolean
  destructive?: boolean
  onSave: (v: string) => void | Promise<void>
  onSecondary?: () => void | Promise<void>
  onClose: () => void
}) {
  const [val, setVal] = useState(initialValue || '')
  const [submitting, setSubmitting] = useState(false)
  const { ref, pos, headerMouseDown } = useDraggablePopup(open)
  useEscapeToClose(onClose, open)
  useEffect(() => { if (open) setVal(initialValue || '') }, [open, initialValue])

  if (!open) return null

  const canSubmit = !minLength || val.trim().length >= minLength
  const commit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      await onSave(val)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const commitSecondary = async () => {
    if (!onSecondary || submitting) return
    setSubmitting(true)
    try {
      await onSecondary()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

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
        data-builder-floating-ui
        style={style}
        className="w-[380px] max-w-[92vw] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        <div
          className={cn(
            'px-4 py-3 text-white flex items-center justify-between cursor-grab active:cursor-grabbing select-none',
            destructive
              ? 'bg-gradient-to-r from-red-600 to-red-700'
              : 'bg-gradient-to-r from-primary to-emerald-700',
          )}
          onMouseDown={headerMouseDown}
          title="Drag to move"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Move className="w-3 h-3 opacity-60 shrink-0" />
            {destructive ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Pencil className="w-4 h-4 shrink-0" />}
            <span className="text-sm font-bold truncate">{title}</span>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded hover:bg-white/20 shrink-0">
                <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {subtitle && (
            <p className={cn('text-sm leading-relaxed', confirmOnly ? 'text-gray-700' : 'text-xs text-gray-500')}>
              {subtitle}
            </p>
          )}
          {!confirmOnly && (multiline ? (
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
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) { e.preventDefault(); commit() }
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
                if (e.key === 'Enter' && canSubmit) { e.preventDefault(); commit() }
              }}
              onFocus={e => e.currentTarget.select()}
            />
          ))}
          {!confirmOnly && helpText && (
            <p className={cn('text-xs', canSubmit ? 'text-gray-400' : 'text-amber-600')}>{helpText}</p>
          )}
          {!confirmOnly && maxLength && (
            <div className="text-xs text-gray-400 text-right">{val.length} / {maxLength}</div>
          )}
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} disabled={submitting} className="btn-cancel flex-1 py-2 rounded-lg text-xs font-medium text-gray-600 border border-[#ffc954] disabled:opacity-50">Cancel</button>
          {secondaryLabel && onSecondary && (
            <button
              onClick={() => { void commitSecondary() }}
              disabled={submitting}
              className="flex-1 py-2 rounded-lg text-xs font-bold text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {secondaryLabel}
            </button>
          )}
          <button
            onClick={() => { void commit() }}
            disabled={!canSubmit || submitting}
            className={cn(
              'flex-1 py-2 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5',
              (!canSubmit || submitting) && 'bg-gray-200 text-gray-400 cursor-not-allowed',
              canSubmit && !submitting && destructive && 'bg-red-600 text-white hover:bg-red-700',
              canSubmit && !submitting && !destructive && 'bg-primary text-white hover:bg-primary/90',
            )}
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}

// ?? Reusable Link Editor Popup ????????????????????????????????????????????????
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
  // Resource type (when applicable) ? used to fetch a live picker list
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
  { id: 'store_locator', label: 'All stores',       desc: 'Store locator ? lists every branch', icon: MapPin, group: 'stores', route: '/stores',   note: 'Opens the store-locator page showing every active outlet. Use this for "Find a store near you" type buttons.' },
  { id: 'stores_multi',  label: 'Selected stores',  desc: 'Pick several branches at once', icon: Layers,   group: 'stores', resource: 'stores', note: 'Link to a curated set of outlets. Visitors land on the locator filtered to just the branches you picked (?branch=code1,code2?).' },

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
  useEscapeToClose(onClose, open)

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

  // Code token used to identify a store in multi-select / ?branch=? params
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
        data-builder-floating-ui
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
            <span className="text-sm font-bold truncate">Connect link or product</span>
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

          {/* ?? Stores multi-select ? compact dropdown + chips UI ????????? */}
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
                  No branches selected yet ? pick from the dropdown below
                </div>
              )}

              {/* Dropdown selector ? styled like the screenshot */}
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-primary/80" />
                </div>
              ) : pickableList.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-xl">
                  No stores found ? add a branch in Settings first.
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      placeholder="Search stores?"
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

          {/* ?? Standard live picker (non-stores_multi types) ??????????? */}
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
                      placeholder="Search?"
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
                  {!pickerSearch && <div className="mt-1 text-xs text-gray-400">Add products or services in your catalog first.</div>}
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
            {type === 'none' ? 'No link' : (target || currentMeta?.route || '?')}
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

// ?? Context Menu ??????????????????????????????????????????????????????????????
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
  useEscapeToClose(onClose, open)
  useEffect(() => {
    if (!open) return
    const h = () => onClose()
    window.addEventListener('click', h)
    return () => {
      window.removeEventListener('click', h)
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
      data-builder-floating-ui
      style={{ position: 'fixed', top, left, zIndex: 100001 }}
      className="w-56 bg-white border border-gray-200 rounded-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto"
      onClick={e => e.stopPropagation()}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation() }}
    >
      {actions.map(renderAction)}
      {activeSub && (
        <div
          style={{ position: 'fixed', top, left: left + 224, zIndex: 100002 }}
          className="w-52 bg-white border border-gray-200 rounded-xl shadow-2xl py-1.5 max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {activeSub.map(renderAction)}
        </div>
      )}
    </div>
  )
}



/** Page row actions in the Pages sidebar ? always visible menu with labeled options. */
function PageActionsMenu({
  page,
  pageCount,
  onSetHomepage,
  onDuplicate,
  onDelete,
}: {
  page: WebsitePage
  pageCount: number
  onSetHomepage: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const canDelete = pageCount > 1 && isPersistedPageId(page.id)
  const deleteHint = pageCount <= 1
    ? 'Your site needs at least one page.'
    : !isPersistedPageId(page.id)
      ? 'Save this page before moving it to trash.'
      : page.is_homepage
        ? 'Homepage will move to the next page automatically.'
        : null

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const menuItem = (
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
        'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left',
        !onClick && 'opacity-45 cursor-not-allowed text-gray-400',
        onClick && tone === 'danger' && 'hover:bg-red-50 text-red-600',
        onClick && tone !== 'danger' && 'hover:bg-gray-50 text-gray-700',
      )}
    >
      <span className="w-4 h-4 flex items-center justify-center shrink-0">{icon}</span>
      <span>{label}</span>
    </button>
  )

  return (
    <div ref={rootRef} className="relative shrink-0" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        title={`Page actions ? ${page.title}`}
        aria-label={`Page actions for ${page.title}`}
        aria-expanded={open}
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className={cn(
          'h-7 px-2 rounded-lg flex items-center gap-1 text-[11px] font-semibold border transition-colors',
          open
            ? 'bg-primary text-white border-primary shadow-sm'
            : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40 hover:text-primary hover:bg-accent/40',
        )}
      >
        <MoreVertical className="w-3.5 h-3.5" />
        <span>Actions</span>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1.5 z-40">
          {!page.is_homepage && menuItem('Set as homepage', onSetHomepage, <span className="text-sm leading-none">??</span>)}
          {menuItem('Duplicate page', onDuplicate, <Copy className="w-3.5 h-3.5" />)}
          <div className="my-1 border-t border-gray-100" />
          {menuItem('Move to trash', canDelete ? onDelete : undefined, <Trash2 className="w-3.5 h-3.5" />, 'danger')}
          {deleteHint && (
            <p className="px-3 pt-1 pb-0.5 text-[10px] leading-snug text-gray-400">{deleteHint}</p>
          )}
        </div>
      )}
    </div>
  )
}

/** Trashed pages ? recoverable for 7 days before permanent removal. */
function DeletedPagesPanel({
  items,
  onRestore,
  onRefresh,
  loading,
  alwaysShow = false,
}: {
  items: PageTrashItem[]
  onRestore: (id: string, title: string) => void
  onRefresh?: () => void | Promise<void>
  loading?: boolean
  /** When true, show the section even if trash is empty (Page tab). */
  alwaysShow?: boolean
}) {
  if (!alwaysShow && !loading && items.length === 0) return null

  return (
    <div className={cn('rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 space-y-2', alwaysShow ? 'mt-1' : 'mt-2')}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 min-w-0">
          <Trash2 className="w-3 h-3 shrink-0" />
          Recently deleted
          {items.length > 0 && (
            <span className="rounded-full bg-amber-200/80 px-1.5 py-0.5 text-[9px] font-bold tabular-nums">
              {items.length}
            </span>
          )}
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={loading}
            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-[10px] font-semibold text-amber-900 hover:bg-amber-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
            Refresh
          </button>
        )}
      </div>
      <p className="text-[10px] text-amber-900/70 leading-snug">
        Pages stay here for 7 days, then are removed permanently.
      </p>
      {loading && items.length === 0 && (
        <p className="text-[10px] text-gray-500 flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading deleted pages?
        </p>
      )}
      {!loading && items.length === 0 && (
        <p className="text-[10px] text-gray-500 leading-snug">
          No deleted pages right now. Use <strong>Move to trash</strong> above to remove a page ? it will appear here.
        </p>
      )}
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map(item => (
            <li key={item.id} className="flex items-center gap-2 rounded-lg border border-amber-100 bg-white px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-gray-800 truncate" title={item.title}>{item.title}</div>
                <div className="text-[10px] text-gray-500">
                  {item.days_remaining <= 0
                    ? 'Purging soon'
                    : `${item.days_remaining} day${item.days_remaining === 1 ? '' : 's'} left to restore`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRestore(item.id, item.title)}
                className="shrink-0 inline-flex items-center gap-1 rounded-md border border-primary/30 bg-accent px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}


/** Clicks on builder popovers / overlay UI must not clear overlay selection. */
const BUILDER_OVERLAY_UI_SELECTOR =
  '[data-overlay-root],[data-overlay-toolbar],[data-builder-section-image],[data-builder-section-toolbar],[data-builder-floating-ui],[data-block-design-bar],[data-block-design-bar-dropdown]'

/** Fixed width ? layout never reflows when link state or labels change. */
const OVERLAY_TOOLBAR_WIDTH_PX = 320

/** Shared classes ? light default, `dark:` when dashboard theme is dark (html.dark). */
const overlayToolbarUi = {
  panel:
    'border-gray-200 bg-white/95 text-gray-900 shadow-lg dark:border-gray-600/90 dark:bg-gray-900/95 dark:text-gray-100',
  section:
    'border-gray-200 bg-gray-50/90 dark:border-gray-700/70 dark:bg-gray-800/50',
  sectionTitle: 'text-gray-500 dark:text-gray-500',
  fieldLabel: 'text-gray-500 dark:text-gray-500',
  hint: 'text-gray-500 dark:text-gray-400',
  hintEmphasis: 'font-semibold text-gray-700 dark:text-gray-300',
  input:
    'border-gray-300 bg-white text-gray-900 focus:border-sky-500 focus:ring-sky-500/40 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:border-sky-400 dark:focus:ring-sky-400/50',
  swatch: 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500',
  segmentTrack: 'border-gray-200 bg-gray-100 dark:border-gray-600 dark:bg-gray-900',
  segmentInactive:
    'text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/80 dark:hover:text-gray-200',
  footer: 'border-gray-200 text-gray-500 dark:border-gray-700/80 dark:text-gray-400',
  previewSwatch: 'border-gray-300 dark:border-gray-600',
  actionMuted: 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500',
} as const

function OverlayToolbarField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className={cn('truncate text-[10px] font-semibold uppercase tracking-wider leading-none', overlayToolbarUi.fieldLabel)}>
        {label}
      </span>
      <div className="flex min-h-8 min-w-0 items-center">{children}</div>
    </div>
  )
}

function OverlayToolbarSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-lg border px-2 py-2', overlayToolbarUi.section)}>
      <p className={cn('mb-2 text-[10px] font-semibold uppercase tracking-wider', overlayToolbarUi.sectionTitle)}>{title}</p>
      {children}
    </div>
  )
}

function OverlayToolbarColorSwatch({
  value,
  onChange,
  onStopBubble,
  title,
}: {
  value: string
  onChange: (color: string) => void
  onStopBubble: (e: React.SyntheticEvent) => void
  title: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onMouseDown={onStopBubble}
      className={cn('relative h-8 w-full min-w-0 overflow-hidden rounded-md border', overlayToolbarUi.swatch)}
      title={title}
    >
      <span
        className="absolute inset-0"
        style={{ backgroundColor: value }}
        aria-hidden
      />
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        onMouseDown={onStopBubble}
        onClick={onStopBubble}
        className="sr-only"
        tabIndex={-1}
      />
    </button>
  )
}

/** Local draft while typing so the field can be cleared before committing. */
function OverlayToolbarNumberInput({
  label,
  value,
  min,
  max,
  fallback,
  onCommit,
  onStopBubble,
}: {
  label: string
  value: number
  min: number
  max: number
  fallback: number
  onCommit: (n: number) => void
  onStopBubble: (e: React.SyntheticEvent) => void
}) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = useCallback(() => {
    const trimmed = draft.trim()
    if (trimmed === '') {
      setDraft(String(fallback))
      onCommit(fallback)
      return
    }
    const n = Number(trimmed)
    if (!Number.isFinite(n)) {
      setDraft(String(value))
      return
    }
    const clamped = Math.min(max, Math.max(min, Math.round(n)))
    setDraft(String(clamped))
    onCommit(clamped)
  }, [draft, fallback, max, min, onCommit, value])

  return (
    <OverlayToolbarField label={label}>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={e => setDraft(e.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={e => {
          onStopBubble(e)
          if (e.key === 'Enter') {
            e.preventDefault()
            ;(e.currentTarget as HTMLInputElement).blur()
          }
        }}
        onMouseDown={onStopBubble}
        onClick={onStopBubble}
        onDoubleClick={onStopBubble}
        className={cn(
          'h-8 w-full min-w-0 rounded-md border text-center text-xs font-semibold focus:outline-none focus:ring-2',
          overlayToolbarUi.input,
        )}
        title={`${label} (px) ? press Enter to apply`}
      />
    </OverlayToolbarField>
  )
}

function OverlayEditToolbar({
  item,
  onUpdate,
  blockBackgroundColor,
  onEditLink,
  onRequestText,
  onStartTextEdit,
  onOpenAiForImage,
  onOpenMediaForImage,
  onPickLocalImage,
  onBringToFront,
  onSendToBack,
}: {
  item: BlockOverlayItem
  onUpdate: (u: Partial<BlockOverlayItem>) => void
  /** Block/section background ? used for ?No fill? preview hint in toolbar. */
  blockBackgroundColor?: string
  onEditLink?: (anchor: { x: number; y: number }) => void
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
  onStartTextEdit?: () => void
  onOpenAiForImage?: () => void
  onOpenMediaForImage?: () => void
  onPickLocalImage?: () => void
  onBringToFront?: () => void
  onSendToBack?: () => void
}) {
  const hasTextControls = item.type === 'text' || item.type === 'button' || item.type === 'badge'
  const isImage = item.type === 'image'
  const isIcon = item.type === 'icon'
  const hasLink = item.type === 'button' || item.type === 'badge' || item.type === 'text' || isImage || isIcon
  const isLinked = !!(item.linkType && item.linkType !== 'none')
  const placeToolbarAbove = item.h > 220
  const toolbarTop = placeToolbarAbove ? 0 : item.h + 8
  const showCanvasToolbar = true

  const stopToolbarEvent = (e: React.SyntheticEvent) => {
    e.stopPropagation()
    e.nativeEvent.stopImmediatePropagation()
  }

  const openTextEditor = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (item.type === 'text') {
      onStartTextEdit?.()
      return
    }
    if (!onRequestText) return
    const rect = e.currentTarget.getBoundingClientRect()
    onRequestText({
      title: `Edit ${item.type} label`,
      placeholder: item.type === 'button' ? 'e.g. Book Now' : 'e.g. NEW',
      initialValue: item.text || '',
      anchor: { x: rect.left, y: rect.bottom + 6 },
      onSave: v => onUpdate({ text: v }),
    })
  }

  const openLinkEditor = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    e.preventDefault()
    if (!onEditLink) return
    const rect = e.currentTarget.getBoundingClientRect()
    onEditLink({ x: rect.left, y: rect.bottom + 6 })
  }

  const openDescription = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!onRequestText) return
    const rect = e.currentTarget.getBoundingClientRect()
    onRequestText({
      title: 'Button description',
      subtitle: 'Shown as tooltip on hover and used for screen-reader labels.',
      placeholder: 'Book a table for 4 guests',
      initialValue: item.description || '',
      multiline: true,
      maxLength: 160,
      anchor: { x: rect.left, y: rect.bottom + 6 },
      onSave: v => onUpdate({ description: v }),
    })
  }

  const toolbarBtn =
    'flex h-8 w-full min-w-0 items-center justify-center rounded-lg transition-colors'

  if (!showCanvasToolbar) return null

  return (
    <div
      data-overlay-toolbar
      role="toolbar"
      aria-label="Overlay element options"
      className={cn(
        'absolute left-0 z-[25] box-border overflow-hidden rounded-xl border p-2.5 backdrop-blur-sm',
        overlayToolbarUi.panel,
      )}
      style={{
        top: toolbarTop,
        width: OVERLAY_TOOLBAR_WIDTH_PX,
        ...(placeToolbarAbove ? { transform: 'translateY(calc(-100% - 8px))' } : {}),
      }}
      onMouseDown={stopToolbarEvent}
      onPointerDown={stopToolbarEvent}
      onClick={stopToolbarEvent}
      onDoubleClick={stopToolbarEvent}
    >
      <div className="space-y-2">
        <OverlayToolbarSection title="Position & size">
          <OverlayTransformControls
            item={item}
            onUpdate={onUpdate}
            onBringToFront={onBringToFront}
            onSendToBack={onSendToBack}
            variant="toolbar"
            onStopBubble={stopToolbarEvent}
          />
        </OverlayToolbarSection>

        {/* Typography */}
        {hasTextControls && (
          <OverlayToolbarSection title="Text">
            <div className="grid grid-cols-2 gap-2">
              <OverlayToolbarField label="Color">
                <OverlayToolbarColorSwatch
                  value={item.color || '#111827'}
                  onChange={color => onUpdate({ color })}
                  onStopBubble={stopToolbarEvent}
                  title="Text color"
                />
              </OverlayToolbarField>
              <OverlayToolbarNumberInput
                label="Size (px)"
                value={item.fontSize ?? 16}
                min={8}
                max={120}
                fallback={16}
                onCommit={n => onUpdate({ fontSize: n })}
                onStopBubble={stopToolbarEvent}
              />
            </div>
          </OverlayToolbarSection>
        )}

        {isIcon && (
          <OverlayToolbarSection title="Icon">
            <div className="grid grid-cols-2 gap-2">
              <OverlayToolbarField label="Icon">
                <div onMouseDown={stopToolbarEvent} onClick={stopToolbarEvent}>
                  <OverlayIconPicker
                    value={item.iconName}
                    onChange={iconName => onUpdate({ iconName })}
                  />
                </div>
              </OverlayToolbarField>
              <OverlayToolbarField label="Color">
                <OverlayToolbarColorSwatch
                  value={item.color || '#111827'}
                  onChange={color => onUpdate({ color })}
                  onStopBubble={stopToolbarEvent}
                  title="Icon color"
                />
              </OverlayToolbarField>
              <OverlayToolbarNumberInput
                label="Size (px)"
                value={item.fontSize ?? 32}
                min={12}
                max={160}
                fallback={32}
                onCommit={n => onUpdate({ fontSize: n })}
                onStopBubble={stopToolbarEvent}
              />
            </div>
          </OverlayToolbarSection>
        )}

        {isImage && (
          <OverlayToolbarSection title="Image">
            <div className="grid grid-cols-2 gap-1.5">
              {onPickLocalImage ? (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onPickLocalImage() }}
                  className={cn(toolbarBtn, 'gap-1 bg-sky-600 text-white hover:bg-sky-500 text-[10px] font-semibold')}
                  title="Upload image"
                >
                  <Upload className="h-3.5 w-3.5 shrink-0" />
                  Upload
                </button>
              ) : null}
              {onOpenMediaForImage ? (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onOpenMediaForImage() }}
                  className={cn(toolbarBtn, 'gap-1 bg-emerald-600 text-white hover:bg-emerald-500 text-[10px] font-semibold')}
                  title="Media library"
                >
                  <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                  Library
                </button>
              ) : null}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <OverlayToolbarNumberInput
                label="Zoom %"
                value={item.imageScale ?? 100}
                min={25}
                max={400}
                fallback={100}
                onCommit={n => onUpdate({ imageScale: n })}
                onStopBubble={stopToolbarEvent}
              />
              <OverlayToolbarNumberInput
                label="Radius"
                value={item.borderRadius ?? 0}
                min={0}
                max={999}
                fallback={0}
                onCommit={n => onUpdate({ borderRadius: n })}
                onStopBubble={stopToolbarEvent}
              />
              <OverlayToolbarField label="Shadow">
                <button
                  type="button"
                  onClick={() => onUpdate({ shadow: !item.shadow })}
                  className={cn(
                    toolbarBtn,
                    'text-[10px] font-semibold',
                    item.shadow ? 'bg-primary text-white' : overlayToolbarUi.actionMuted,
                  )}
                >
                  {item.shadow ? 'On' : 'Off'}
                </button>
              </OverlayToolbarField>
              <OverlayToolbarNumberInput
                label="Opacity %"
                value={item.opacity ?? 100}
                min={10}
                max={100}
                fallback={100}
                onCommit={n => onUpdate({ opacity: n })}
                onStopBubble={stopToolbarEvent}
              />
            </div>
          </OverlayToolbarSection>
        )}

      {(hasTextControls || isIcon || isImage || (hasLink && onEditLink) || ((item.type === 'button' || item.type === 'badge') && onRequestText)) && (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {hasTextControls ? (
            <button
              type="button"
              onClick={openTextEditor}
              className={cn(toolbarBtn, 'bg-primary text-primary-foreground hover:bg-primary/90')}
              title={item.type === 'text' ? 'Edit text (double-click)' : 'Edit label'}
            >
              <Type className="h-4 w-4 shrink-0" />
            </button>
          ) : <div className="h-8" aria-hidden />}
          {hasLink && onEditLink ? (
            <button
              type="button"
              data-overlay-link-btn
              onClick={openLinkEditor}
              className={cn(
                toolbarBtn,
                isLinked ? 'bg-emerald-600 text-white hover:bg-emerald-500' : overlayToolbarUi.actionMuted,
              )}
              title={
                isLinked
                  ? `Linked: ${item.linkType} ? ${item.linkLabel || item.linkTarget}`
                  : 'Add link'
              }
            >
              <Link2 className="h-4 w-4 shrink-0" />
            </button>
          ) : (isImage ? null : <div className="h-8" aria-hidden />)}
          {(item.type === 'button' || item.type === 'badge') && onRequestText ? (
            <button
              type="button"
              onClick={openDescription}
              className={cn(toolbarBtn, 'bg-sky-600 text-white hover:bg-sky-500')}
              title="Description / tooltip"
            >
              <Info className="h-4 w-4 shrink-0" />
            </button>
          ) : <div className="h-8" aria-hidden />}
        </div>
      )}
      </div>
    </div>
  )
}

function OverlayElement({
  item, isSelected, containerRef, blockBackgroundColor, onSelect, onUpdate, onDelete,
  onOpenAiForImage, onOpenMediaForImage, onPickLocalImage, onImageFileDrop,
  onEditLink, onContextMenu, onRequestText, onBringToFront, onSendToBack,
}: {
  item: BlockOverlayItem
  isSelected: boolean
  containerRef: React.RefObject<HTMLDivElement>
  blockBackgroundColor?: string
  onSelect: () => void
  onUpdate: (u: Partial<BlockOverlayItem>) => void
  onDelete: () => void
  onOpenAiForImage?: () => void
  onOpenMediaForImage?: () => void
  onPickLocalImage?: () => void
  onImageFileDrop?: (file: File) => void
  onEditLink?: (anchor: { x: number; y: number }) => void
  onContextMenu?: (e: React.MouseEvent) => void
  onBringToFront?: () => void
  onSendToBack?: () => void
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
  const textRef = useRef<HTMLDivElement | null>(null)
  const dragMovedRef = useRef(false)

  useEffect(() => {
    const el = textRef.current
    if (!el || textEditing) return
    const display = item.text || 'Double-click to edit'
    if (el.textContent !== display) el.textContent = display
  }, [item.text, textEditing])

  useEffect(() => {
    if (!textEditing || !textRef.current) return
    if (!item.text && textRef.current.textContent === 'Double-click to edit') {
      textRef.current.textContent = ''
    }
    textRef.current.focus()
  }, [textEditing, item.text])

  useEffect(() => {
    if (item.type !== 'text') return
    const root = document.querySelector(`[data-overlay-id="${CSS.escape(item.id)}"]`)
    if (!root) return
    const handler = () => setTextEditing(true)
    root.addEventListener('builder-overlay-start-text-edit', handler)
    return () => root.removeEventListener('builder-overlay-start-text-edit', handler)
  }, [item.id, item.type])

  const startDrag = useCallback((e: React.MouseEvent) => {
    if (textEditing) return
    if ((e.target as HTMLElement).closest('[data-overlay-toolbar],[data-overlay-delete]')) return
    e.stopPropagation(); e.preventDefault()
    dragMovedRef.current = false
    const startX = e.clientX - item.x
    const startY = e.clientY - item.y
    const originX = e.clientX
    const originY = e.clientY
    const container = containerRef.current
    document.body.style.cursor = 'move'
    const onMove = (mv: MouseEvent) => {
      if (Math.abs(mv.clientX - originX) > 3 || Math.abs(mv.clientY - originY) > 3) {
        dragMovedRef.current = true
      }
      const cw = container?.clientWidth || 800
      const ch = container?.clientHeight || 400
      onUpdate({
        x: Math.max(0, Math.min(cw - item.w, mv.clientX - startX)),
        y: Math.max(0, Math.min(ch - 20, mv.clientY - startY)),
      })
    }
    const onUp = () => {
      document.body.style.cursor = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
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
    const fillFallback = defaultOverlayFillColor(item.type)
    const commonStyle: React.CSSProperties = {
      width: '100%', height: '100%',
      backgroundColor: resolveOverlayBackground(item, item.type === 'text' ? 'transparent' : fillFallback),
      borderRadius: item.borderRadius || 0,
      border: resolveOverlayBorder(item),
      boxShadow: item.shadow ? '0 8px 32px rgba(0,0,0,0.15)' : undefined,
      opacity: (item.opacity ?? 100) / 100,
      overflow: 'hidden',
    }
    switch (item.type) {
      case 'text':
        return (
          <div
            ref={textRef}
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
          />
        )
      case 'image':
        return item.src ? (
          <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: item.borderRadius || 0 }}>
            <img src={mediaUrl(item.src)} style={overlayImageImgStyle(item)} alt="" draggable={false} />
          </div>
        ) : (
          <div
            style={{ ...commonStyle, backgroundColor: resolveOverlayBackground(item, '#f3f4f6'), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'move' }}
            onDragOver={onImageFileDrop ? e => { e.preventDefault(); e.stopPropagation() } : undefined}
            onDrop={onImageFileDrop ? e => {
              e.preventDefault(); e.stopPropagation()
              const f = e.dataTransfer.files?.[0]
              if (f) onImageFileDrop(f)
            } : undefined}
          >
            <svg viewBox="0 0 24 24" style={{ width: 28, height: 28, fill: '#9ca3af' }}><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-8.5-5.5l2.5 3.01L18 12l4 5H6l3.5-4.5z"/></svg>
            <span style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>Right-click to upload or replace</span>
          </div>
        )
      case 'button': {
        const hasLink = item.linkType && item.linkType !== 'none' && (item.linkTarget || item.href)
        return (
          <div
            data-overlay-content
            style={{ ...commonStyle, backgroundColor: resolveOverlayBackground(item, '#64C3A0'), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
            title={item.description || (hasLink ? `Link ? ${item.linkLabel || item.linkTarget}` : 'Click to edit')}
          >
            <span style={{ fontSize: item.fontSize || 14, fontWeight: item.fontWeight || 'bold', color: item.color || '#ffffff' }}>
              {item.text || 'Button'}
            </span>
            {/* Link badge hidden while selected ? toolbar shows Linked / Add link instead */}
            {hasLink && !isSelected && (
              <span
                className="pointer-events-none absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white shadow-sm"
                title={`${item.linkType}: ${item.linkLabel || item.linkTarget}`}
                aria-hidden
              >
                <Link2 className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
        )
      }
      case 'box':
        return <div style={commonStyle} />
      case 'badge':
        return (
          <div style={{ ...commonStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: resolveOverlayBackground(item, '#64C3A0') }}>
            <span style={{ fontSize: item.fontSize || 12, fontWeight: 'bold', color: item.color || '#ffffff', whiteSpace: 'nowrap' }}>
              {item.text || 'Badge'}
            </span>
          </div>
        )
      case 'icon': {
        const IconGlyph = resolveBuilderOverlayIcon(item.iconName)
        const iconPx = overlayIconRenderSize(item)
        return (
          <div
            style={{
              ...commonStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: resolveOverlayBackground(item, 'transparent'),
            }}
            title={item.description || builderOverlayIconLabel(item.iconName)}
          >
            <IconGlyph size={iconPx} color={item.color || '#111827'} strokeWidth={2} aria-hidden />
          </div>
        )
      }
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
      data-overlay-root
      data-overlay-id={item.id}
      style={{
        position: 'absolute', left: item.x, top: item.y, width: item.w, height: item.h,
        zIndex: item.zIndex || 10, cursor: textEditing ? 'text' : 'move', userSelect: 'none',
      }}
      onClick={e => {
        e.stopPropagation()
        if (dragMovedRef.current || isSelected) return
        onSelect()
      }}
      onMouseDown={e => {
        const t = e.target as HTMLElement
        if (t.closest('[data-overlay-toolbar],[data-overlay-delete],[data-overlay-resize-handle]')) return
        if (t.closest('input,textarea,select')) return
        if (!isSelected) onSelect()
        if (!textEditing) startDrag(e)
      }}
      onContextMenu={e => { if (onContextMenu) { e.preventDefault(); e.stopPropagation(); onSelect(); onContextMenu(e) } }}
      onDoubleClick={e => {
        if ((e.target as HTMLElement).closest('[data-overlay-toolbar],[data-overlay-delete]')) return
        if (item.type === 'text') { e.stopPropagation(); setTextEditing(true) }
        if (item.type === 'image') {
          e.stopPropagation()
          onPickLocalImage?.()
        }
      }}
    >
      {renderContent()}
      {isSelected && !textEditing && (
        <>
          <OverlayEditToolbar
            item={item}
            onUpdate={onUpdate}
            blockBackgroundColor={blockBackgroundColor}
            onEditLink={onEditLink}
            onRequestText={onRequestText}
            onStartTextEdit={() => setTextEditing(true)}
            onOpenAiForImage={onOpenAiForImage}
            onOpenMediaForImage={onOpenMediaForImage}
            onPickLocalImage={onPickLocalImage}
            onBringToFront={onBringToFront}
            onSendToBack={onSendToBack}
          />
          {/* Selection ring */}
          <div style={{ position: 'absolute', inset: -2, border: '2px solid #64C3A0', borderRadius: 3, pointerEvents: 'none', zIndex: 1 }} />
          {/* Resize handles */}
          {Object.keys(OVERLAY_HANDLE_POS).map(h => (
            <div
              key={h}
              data-overlay-resize-handle
              onMouseDown={e => startResize(e, h)}
              style={{
                position: 'absolute', width: 10, height: 10,
                backgroundColor: '#fff', border: '2px solid #64C3A0',
                borderRadius: 2, cursor: OVERLAY_RESIZE_CURSORS[h], zIndex: 2,
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                ...OVERLAY_HANDLE_POS[h],
              }}
            />
          ))}
          {/* Delete ? kept inside the box so it stays above the block design bar */}
          <button
            type="button"
            data-overlay-delete
            onMouseDown={e => { e.stopPropagation(); onDelete() }}
            className="absolute top-1.5 right-1.5 z-[26] flex h-7 w-7 items-center justify-center rounded-md bg-red-500 text-sm font-bold leading-none text-white shadow-md hover:bg-red-600"
            title="Delete element (Del)"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )
}

function BlockOverlayCanvas({
  blockId,
  overlays, isEditing, blockBackgroundColor, onUpdate, onOverlaySelectionChange, selectedOverlayId: controlledSelectedId,
  onOpenAiImageTools, onOpenMediaLibrary,
  onPickLocalImage, onImageFileDrop, onEditLinkForOverlay, onOverlayContextMenu, onRequestText,
}: {
  blockId?: string
  overlays: BlockOverlayItem[]
  isEditing: boolean
  blockBackgroundColor?: string
  onUpdate?: (overlays: BlockOverlayItem[]) => void
  onOverlaySelectionChange?: (selectedId: string | null, blockId?: string | null) => void
  /** When set, canvas selection follows parent state (ribbon / context menu). */
  selectedOverlayId?: string | null
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
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isControlled = controlledSelectedId !== undefined
  const selectedId = isControlled ? controlledSelectedId : internalSelectedId

  const setSelected = useCallback((id: string | null) => {
    if (!isControlled) setInternalSelectedId(id)
    onOverlaySelectionChange?.(id, blockId ?? null)
  }, [isControlled, onOverlaySelectionChange, blockId])

  useEffect(() => {
    if (!isEditing) {
      if (!isControlled) setInternalSelectedId(null)
      onOverlaySelectionChange?.(null)
    }
  }, [isEditing, isControlled, onOverlaySelectionChange])

  useEffect(() => {
    if (selectedId && !overlays.some(o => o.id === selectedId)) {
      if (!isControlled) setInternalSelectedId(null)
      onOverlaySelectionChange?.(null)
    }
  }, [overlays, selectedId, isControlled, onOverlaySelectionChange])

  const updateItem = useCallback((id: string, updates: Partial<BlockOverlayItem>) => {
    if (!onUpdate) return
    onUpdate(overlays.map(o => o.id === id ? { ...o, ...updates } : o))
  }, [overlays, onUpdate])

  const deleteItem = useCallback((id: string) => {
    if (!onUpdate) return
    onUpdate(overlays.filter(o => o.id !== id))
    setSelected(null)
  }, [overlays, onUpdate, setSelected])

  // Click outside overlay / toolbar / builder popups ? clear selection
  useEffect(() => {
    if (!isEditing || !selectedId) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (target.closest(BUILDER_OVERLAY_UI_SELECTOR)) return
      setSelected(null)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [isEditing, selectedId, setSelected])

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

  const minH = overlays.length > 0 ? Math.max(...overlays.map(o => o.y + o.h + 240)) : 0

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute', inset: 0, zIndex: 78,
        // Container itself never blocks clicks ? lets them pass through to the
        // underlying inline-editable text. Each overlay item re-enables pointer
        // events on itself so it's still interactive.
        pointerEvents: 'none',
        minHeight: isEditing && minH > 0 ? minH : undefined,
      }}
      onClick={e => { if (e.target === containerRef.current) setSelected(null) }}
    >
      {overlays.map(item => (
        <div key={item.id} className={isEditing ? 'pointer-events-auto' : 'pointer-events-none'}>
          <OverlayElement
            item={item}
            isSelected={isEditing && selectedId === item.id}
            containerRef={containerRef as React.RefObject<HTMLDivElement>}
            blockBackgroundColor={blockBackgroundColor}
            onSelect={() => setSelected(item.id)}
            onUpdate={updates => updateItem(item.id, updates)}
            onDelete={() => deleteItem(item.id)}
            onOpenAiForImage={item.type === 'image' ? onOpenAiImageTools : undefined}
            onOpenMediaForImage={item.type === 'image' && onOpenMediaLibrary
              ? () => { onOverlaySelectionChange?.(item.id); onOpenMediaLibrary() }
              : undefined}
            onPickLocalImage={item.type === 'image' && onPickLocalImage
              ? () => { onOverlaySelectionChange?.(item.id); onPickLocalImage() }
              : undefined}
            onImageFileDrop={item.type === 'image' ? onImageFileDrop : undefined}
            onEditLink={onEditLinkForOverlay ? (anchor) => onEditLinkForOverlay(item, anchor) : undefined}
            onContextMenu={onOverlayContextMenu ? (e) => onOverlayContextMenu(item, e) : undefined}
            onRequestText={onRequestText}
            onBringToFront={() => {
              const maxZ = Math.max(10, ...overlays.map(o => o.zIndex || 10))
              updateItem(item.id, { zIndex: maxZ + 1 })
            }}
            onSendToBack={() => {
              const minZ = Math.min(10, ...overlays.map(o => o.zIndex || 10))
              updateItem(item.id, { zIndex: minZ - 1 })
            }}
          />
        </div>
      ))}
    </div>
  )
}

/** Floating section chrome (reorder, duplicate, delete) ? can minimize to a hover ball. */
function BuilderSectionChromeToolbar({
  block,
  blockIdx,
  selected,
  minimized,
  pinned,
  onMinimize,
  onTogglePin,
  positionClassName,
  dsConnectedLabel,
  dsSuggestedLabel,
  onConnectSuggestedDataSource,
  onOpenDataPanel,
  onMoveBlock,
  onDuplicate,
  onDelete,
  onReorderPointerDown,
  onOpenLayoutPicker,
  onCycleLayout,
}: {
  block: WebsiteBlock
  blockIdx: number
  selected: boolean
  minimized: boolean
  pinned: boolean
  onMinimize: () => void
  onTogglePin: () => void
  positionClassName: string
  dsConnectedLabel: string | null
  dsSuggestedLabel: string | null
  onConnectSuggestedDataSource: () => void
  onOpenDataPanel: () => void
  onMoveBlock: (dir: 'top' | 'up' | 'down' | 'bottom') => void
  onDuplicate: () => void
  onDelete: () => void
  onReorderPointerDown: (e: React.PointerEvent) => void
  onOpenLayoutPicker: () => void
  onCycleLayout: (dir: 'prev' | 'next') => void
}) {
  const showLayout = getSectionLayoutOptions(block.block_type).length > 0
  const iconBtn = 'p-1.5 text-gray-400 hover:text-white transition-colors'

  const dataSourceTitle = dsConnectedLabel
    ? `Connected to ${dsConnectedLabel} ? click to edit`
    : dsSuggestedLabel
      ? `Connect to ${dsSuggestedLabel}`
      : 'Data source'

  const toolbarBody = (
    <>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onMinimize() }}
        className={cn(iconBtn, 'hover:text-amber-300 shrink-0')}
        title={
          minimized && pinned
            ? 'Close toolbar'
            : minimized
              ? 'Restore toolbar'
              : 'Minimize to hover ball'
        }
      >
        <X className="w-6 h-6" />
      </button>
      <div
        role="button"
        tabIndex={0}
        onPointerDown={onReorderPointerDown}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation() }}
        title="Drag to move this section on the page (order only ? not the same as changing style)"
        className="p-1.5 text-gray-400 hover:text-white cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
      >
        <GripVertical className="w-7 h-7 pointer-events-none" />
      </div>
      <button type="button" onClick={e => { e.stopPropagation(); onMoveBlock('top') }} className={iconBtn} title="Move section to top of page">
        <ChevronsUp className="w-7 h-7" />
      </button>
      <button type="button" onClick={e => { e.stopPropagation(); onMoveBlock('up') }} className={iconBtn} title="Move section up on the page">
        <ChevronUp className="w-7 h-7" />
      </button>
      <button type="button" onClick={e => { e.stopPropagation(); onMoveBlock('down') }} className={iconBtn} title="Move section down on the page">
        <ChevronDown className="w-7 h-7" />
      </button>
      <button type="button" onClick={e => { e.stopPropagation(); onMoveBlock('bottom') }} className={iconBtn} title="Move section to bottom of page">
        <ChevronsDown className="w-7 h-7" />
      </button>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          if (dsSuggestedLabel && !dsConnectedLabel) onConnectSuggestedDataSource()
          else onOpenDataPanel()
        }}
        className={cn(
          iconBtn,
          'relative rounded-md shrink-0',
          dsConnectedLabel && 'text-emerald-300 bg-emerald-500/20 ring-1 ring-emerald-400/30 hover:text-emerald-200 hover:bg-emerald-500/30',
          dsSuggestedLabel && !dsConnectedLabel && 'text-amber-200 bg-accent/25 ring-1 ring-accent/40 hover:text-amber-100 hover:bg-accent/40',
        )}
        title={dataSourceTitle}
      >
        <Database className="w-7 h-7" />
        {dsConnectedLabel ? (
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
        ) : dsSuggestedLabel ? (
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
        ) : null}
      </button>
      {showLayout ? (
        <SectionLayoutControls
          block={block}
          currentProps={(block.props ?? {}) as Record<string, unknown>}
          compact
          onOpenLayoutPicker={onOpenLayoutPicker}
          onCycleLayout={onCycleLayout}
        />
      ) : null}
      <button type="button" onClick={e => { e.stopPropagation(); onDuplicate() }} className={iconBtn} title="Duplicate (Ctrl+D)">
        <Copy className="w-7 h-7" />
      </button>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="Delete section"
        className={cn(iconBtn, 'hover:text-red-400')}
      >
        <Trash2 className="w-7 h-7" />
      </button>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onTogglePin() }}
        className={cn(
          iconBtn,
          pinned && 'text-primary bg-primary/15 ring-1 ring-primary/40 rounded-md hover:text-primary',
        )}
        title={pinned ? 'Unpin ? collapse to hover ball' : 'Pin toolbar open'}
      >
        <Pin className={cn('w-5 h-5', pinned && 'fill-current')} />
      </button>
    </>
  )

  const panelClass =
    'flex items-center gap-1.5 rounded-xl border border-white/10 bg-gray-950/95 px-3 py-2.5 text-white shadow-lg shadow-black/20 backdrop-blur'

  if (minimized) {
    const stayOpen = pinned
    return (
      <div
        data-builder-overlay={block.id}
        data-builder-section-toolbar
        className={cn(
          'absolute z-[85] pointer-events-auto',
          stayOpen ? 'flex items-center gap-1.5' : 'group/section-chrome',
          positionClassName,
        )}
        onClick={e => e.stopPropagation()}
      >
        {!stayOpen ? (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-gray-950/95 text-gray-300 shadow-lg shadow-black/30 backdrop-blur ring-1 ring-white/10 transition-all hover:scale-110 hover:text-white hover:ring-primary/40"
            title="Section tools ? hover to expand"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        ) : null}
        <div
          className={cn(
            panelClass,
            stayOpen
              ? 'relative shrink-0'
              : cn(
                  'absolute right-0 top-0 origin-top-right',
                  'scale-[0.94] opacity-0 pointer-events-none transition-all duration-150',
                  'group-hover/section-chrome:scale-100 group-hover/section-chrome:opacity-100 group-hover/section-chrome:pointer-events-auto',
                ),
          )}
        >
          {toolbarBody}
        </div>
      </div>
    )
  }

  return (
    <div
      data-builder-overlay={block.id}
      data-builder-section-toolbar
      className={cn(panelClass, 'absolute z-[85] pointer-events-auto transition-all', positionClassName)}
      onClick={e => e.stopPropagation()}
    >
      {toolbarBody}
    </div>
  )
}


function buildNavLinksFromPages(pages: WebsitePage[]): { label: string; url: string }[] {
  const sorted = [...pages]
    .filter(p => p.show_in_nav !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const seenUrls = new Set<string>()
  const links: { label: string; url: string }[] = []

  for (const pg of sorted) {
    let url = pg.is_homepage
      ? '/'
      : `/${String(pg.slug).replace(/^\/+/, '').replace(/\/+$/, '')}`
    if (url === '/home') url = '/'
    if (seenUrls.has(url)) continue
    seenUrls.add(url)

    const label = pg.is_homepage ? 'Home' : (pg.title?.trim() || pg.slug || 'Page')
    links.push({ label, url })
  }

  return links
}

function findPageIdForBlock(
  blocksMap: Record<string, WebsiteBlock[]>,
  pages: WebsitePage[],
  blockId: string,
  preferPageId?: string | null,
): string | null {
  if (preferPageId && (blocksMap[preferPageId] || []).some(b => b.id === blockId)) {
    return preferPageId
  }
  for (const page of pages) {
    if ((blocksMap[page.id] || []).some(b => b.id === blockId)) return page.id
  }
  return null
}

function uniquePageSlug(base: string, pages: WebsitePage[]): string {
  const slugBase = base.replace(/^\/+/, '').replace(/\/+$/, '') || 'page'
  const taken = new Set(pages.map(p => p.slug))
  if (!taken.has(slugBase)) return slugBase
  let n = 2
  while (taken.has(`${slugBase}-${n}`)) n += 1
  return `${slugBase}-${n}`
}

/** One homepage, unique slugs ? fixes duplicate Home tabs after generate/merge. */
function normalizeSitePages(pages: WebsitePage[]): WebsitePage[] {
  const sorted = [...pages].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  let hasHomepage = false
  const seenSlugs = new Set<string>()
  const out: WebsitePage[] = []
  for (const page of sorted) {
    let p = { ...page }
    if (p.is_homepage) {
      if (hasHomepage) p = { ...p, is_homepage: false }
      else hasHomepage = true
    }
    let slug = (p.slug || '').trim().toLowerCase() || 'page'
    if (seenSlugs.has(slug)) {
      slug = uniquePageSlug(slug, out)
      p = { ...p, slug }
    }
    seenSlugs.add(slug.toLowerCase())
    out.push(p)
  }
  if (!hasHomepage && out.length > 0) {
    out[0] = { ...out[0], is_homepage: true }
  }
  return out
}

function isPersistedPageId(pageId: string): boolean {
  return Boolean(pageId) && !pageId.startsWith('temp-')
}

function countPersistedPages(pages: WebsitePage[]): number {
  return pages.filter(p => isPersistedPageId(p.id)).length
}

function navLinksEqual(
  a: { label: string; url: string }[],
  b: { label: string; url: string }[],
): boolean {
  return a.length === b.length && a.every((link, i) =>
    link.label === b[i]?.label && link.url === b[i]?.url,
  )
}

function syncNavLinksInBlockMap(
  blocksByPage: Record<string, WebsiteBlock[]>,
  pages: WebsitePage[],
): Record<string, WebsiteBlock[]> {
  if (!pages.length) return blocksByPage
  const synced = buildNavLinksFromPages(pages)
  let anyChanged = false
  const next: Record<string, WebsiteBlock[]> = {}
  for (const [pageId, blocks] of Object.entries(blocksByPage)) {
    next[pageId] = blocks.map(block => {
      if (block.block_type !== 'nav') return block
      if ((block.props as { nav_links_source?: string })?.nav_links_source === 'manual') return block
      const current = ((block.props as any)?.nav_links as { label?: string; url?: string }[] | undefined) || []
      const normalized = current.map(l => ({
        label: String(l?.label ?? ''),
        url: String(l?.url ?? '/'),
      }))
      if (navLinksEqual(normalized, synced)) return block
      anyChanged = true
      return {
        ...block,
        props: { ...block.props, nav_links: synced },
      }
    })
  }
  return anyChanged ? next : blocksByPage
}

function pagesNavKey(pages: WebsitePage[]): string {
  return pages
    .map(p => `${p.id}:${p.slug}:${p.title}:${p.show_in_nav}:${p.is_homepage}`)
    .join('|')
}

const GLOBAL_STRUCTURE_BLOCK_TYPES = new Set(['announcement_bar', 'nav', 'footer'])

/** After layout apply / structure edits, ignore server block hydration for this long. */
const SKIP_SERVER_HYDRATE_MS = 30_000

function structureLayoutFingerprint(props: Record<string, unknown> | undefined): string {
  if (!props) return ''
  return [
    props.nav_style,
    props.nav_layout,
    props.nav_glass,
    props.nav_elevated,
    props.nav_compact,
    props.footer_style,
    props.layout,
    props.variant,
    props.color,
    props.nav_bg,
    props.footer_bg,
    props.bg_style,
    props.bg_color,
    props.gradient_preset,
    props.columns,
    props.image_position,
    props.card_style,
    props.overlay,
  ].map(v => String(v ?? '')).join('|')
}

function syncSiteQueryBlocks(
  site: WebsiteSite,
  blocksByPage: Record<string, WebsiteBlock[]>,
): WebsiteSite {
  return {
    ...site,
    pages: site.pages.map(page => ({
      ...page,
      blocks: (blocksByPage[page.id] || page.blocks).map(b => ({ ...b })),
    })),
  }
}

function getPreferredBlockInsertIndex(
  blockType: string,
  blocks: WebsiteBlock[],
  explicitIdx = -1,
): number {
  const len = blocks.length
  if (explicitIdx >= 0) {
    return Math.max(0, Math.min(explicitIdx, len))
  }
  if (blockType === 'announcement_bar') return 0
  if (blockType === 'nav') {
    let idx = 0
    while (idx < len && blocks[idx].block_type === 'announcement_bar') idx += 1
    return idx
  }
  if (blockType === 'footer') return len
  const footerIdx = blocks.findIndex(b => b.block_type === 'footer')
  return footerIdx >= 0 ? footerIdx : len
}

function insertBlockAtIndex(
  blocks: WebsiteBlock[],
  block: WebsiteBlock,
  blockType: string,
  explicitIdx = -1,
): WebsiteBlock[] {
  const insertAt = getPreferredBlockInsertIndex(blockType, blocks, explicitIdx)
  const next = [...blocks]
  next.splice(insertAt, 0, block)
  return next.map((b, i) => ({ ...b, sort_order: i }))
}

/** Stable sort by sort_order (ties keep current array order). */
function sortPageBlocks(blocks: WebsiteBlock[]): WebsiteBlock[] {
  return blocks
    .slice()
    .map((b, i) => ({ b, i }))
    .sort((a, b) => {
      const d = (a.b.sort_order ?? 0) - (b.b.sort_order ?? 0)
      return d !== 0 ? d : a.i - b.i
    })
    .map(({ b }) => b)
}

/** First/last index where regular content blocks may be placed (between header shell and footer). */
function getContentMoveBounds(blocks: WebsiteBlock[]): { min: number; max: number } {
  let min = 0
  while (min < blocks.length && (blocks[min].block_type === 'announcement_bar' || blocks[min].block_type === 'nav')) {
    min += 1
  }
  let max = blocks.length - 1
  while (max >= min && blocks[max].block_type === 'footer') {
    max -= 1
  }
  return { min, max: Math.max(min, max) }
}

function computeBlockMoveIndex(
  blocks: WebsiteBlock[],
  fromIdx: number,
  dir: 'up' | 'down' | 'top' | 'bottom',
): number | null {
  if (fromIdx < 0 || fromIdx >= blocks.length) return null
  const block = blocks[fromIdx]

  if (GLOBAL_STRUCTURE_BLOCK_TYPES.has(block.block_type)) {
    let explicitIdx = -1
    if (dir === 'top' || dir === 'up') explicitIdx = Math.max(0, fromIdx - 1)
    else if (dir === 'bottom' || dir === 'down') explicitIdx = Math.min(blocks.length - 1, fromIdx + 1)
    const relocated = relocateExistingStructureBlock(blocks, block.block_type, explicitIdx)
    if (!relocated) return null
    const newIdx = relocated.findIndex(b => b.id === block.id)
    return newIdx >= 0 && newIdx !== fromIdx ? newIdx : null
  }

  const { min, max } = getContentMoveBounds(blocks)
  if (fromIdx < min || fromIdx > max) return null

  switch (dir) {
    case 'up':
      return fromIdx > min ? fromIdx - 1 : null
    case 'down':
      return fromIdx < max ? fromIdx + 1 : null
    case 'top':
      return fromIdx !== min ? min : null
    case 'bottom':
      return fromIdx !== max ? max : null
    default:
      return null
  }
}

function reorderBlockByIndex(blocks: WebsiteBlock[], fromIdx: number, toIdx: number): WebsiteBlock[] {
  if (fromIdx < 0 || toIdx < 0 || fromIdx >= blocks.length || toIdx >= blocks.length || fromIdx === toIdx) {
    return blocks
  }
  const reordered = [...blocks]
  const [moved] = reordered.splice(fromIdx, 1)
  reordered.splice(toIdx, 0, moved)
  return reordered.map((b, i) => ({ ...b, sort_order: i }))
}

/** Move an existing structure block (nav, announcement, footer) to its canonical slot. */
function relocateExistingStructureBlock(
  blocks: WebsiteBlock[],
  blockType: string,
  explicitIdx = -1,
): WebsiteBlock[] | null {
  const idx = blocks.findIndex(b => b.block_type === blockType)
  if (idx < 0) return null
  const block = blocks[idx]
  const rest = blocks.filter((_, i) => i !== idx)
  const insertAt = getPreferredBlockInsertIndex(blockType, rest, explicitIdx)
  if (insertAt === idx) return null
  const next = [...rest]
  next.splice(insertAt, 0, block)
  return next.map((b, i) => ({ ...b, sort_order: i }))
}

function ensureStructureBlocksOnAllPages(
  blocksByPage: Record<string, WebsiteBlock[]>,
  pages: WebsitePage[],
  sourceBlock: WebsiteBlock,
  blockType: string,
): Record<string, WebsiteBlock[]> {
  if (!GLOBAL_STRUCTURE_BLOCK_TYPES.has(blockType)) return blocksByPage
  let next = { ...blocksByPage }
  for (const page of pages) {
    const blocks = next[page.id] || []
    const relocated = relocateExistingStructureBlock(blocks, blockType, -1)
    if (relocated) {
      next = { ...next, [page.id]: relocated }
      continue
    }
    if (blocks.some(b => b.block_type === blockType)) continue
    const clone: WebsiteBlock = {
      ...sourceBlock,
      id: `temp-${blockType}-${page.id}-${Date.now()}`,
      page_id: page.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    next = { ...next, [page.id]: insertBlockAtIndex(blocks, clone, blockType, -1) }
  }
  return next
}

/** Copy global structure blocks (nav / footer / announcement) onto a newly created page. */
function seedStructureBlocksForNewPage(
  blocksByPage: Record<string, WebsiteBlock[]>,
  pages: WebsitePage[],
  newPageId: string,
): WebsiteBlock[] {
  let pageBlocks: WebsiteBlock[] = []
  for (const type of ['announcement_bar', 'nav', 'footer'] as const) {
    let source: WebsiteBlock | undefined
    for (const page of pages) {
      if (page.id === newPageId) continue
      source = (blocksByPage[page.id] || []).find(b => b.block_type === type)
      if (source) break
    }
    if (!source) continue
    const clone: WebsiteBlock = {
      ...source,
      id: `temp-${type}-${newPageId}-${Date.now()}`,
      page_id: newPageId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    pageBlocks = insertBlockAtIndex(pageBlocks, clone, type, -1)
  }
  return pageBlocks
}

function normalizeAllStructureBlocks(
  blocksByPage: Record<string, WebsiteBlock[]>,
  pages: WebsitePage[],
): Record<string, WebsiteBlock[]> {
  let next = { ...blocksByPage }
  for (const page of pages) {
    let pageBlocks = (next[page.id] || []).slice().sort((a, b) => a.sort_order - b.sort_order)
    for (const type of ['announcement_bar', 'nav', 'footer'] as const) {
      const relocated = relocateExistingStructureBlock(pageBlocks, type, -1)
      if (relocated) pageBlocks = relocated
    }
    next = { ...next, [page.id]: pageBlocks }
  }
  return next
}

/** Find a global structure block (nav / footer / announcement bar) on any page. */
function findStructureBlockInMap(
  blocksByPage: Record<string, WebsiteBlock[]>,
  pages: WebsitePage[],
  blockType: string,
  preferredBlockId?: string,
): { block: WebsiteBlock; pageId: string } | undefined {
  if (preferredBlockId) {
    for (const page of pages) {
      const found = (blocksByPage[page.id] || []).find(b => b.id === preferredBlockId)
      if (found?.block_type === blockType) return { block: found, pageId: page.id }
    }
  }
  for (const page of pages) {
    const found = (blocksByPage[page.id] || []).find(b => b.block_type === blockType)
    if (found) return { block: found, pageId: page.id }
  }
  return undefined
}

/** Apply layout props to a structure block on every page (add missing clones). */
function applyStructureLayoutToAllPages(
  blocksByPage: Record<string, WebsiteBlock[]>,
  pages: WebsitePage[],
  blockType: string,
  def: { label: string },
  finalProps: BlockProps,
  activePageId: string,
  sourceBlock: WebsiteBlock,
): Record<string, WebsiteBlock[]> {
  const stamp = new Date().toISOString()
  let next: Record<string, WebsiteBlock[]> = { ...blocksByPage }
  for (const page of pages) {
    next[page.id] = (next[page.id] || []).map(b =>
      b.block_type === blockType ? { ...b, props: finalProps, updated_at: stamp } : b,
    )
  }
  const template: WebsiteBlock = {
    ...sourceBlock,
    block_type: blockType as WebsiteBlock['block_type'],
    label: sourceBlock.label || def.label,
    props: finalProps,
    updated_at: stamp,
  }
  next = ensureStructureBlocksOnAllPages(next, pages, template, blockType)
  for (const page of pages) {
    next[page.id] = (next[page.id] || []).map(b =>
      b.block_type === blockType ? { ...b, props: finalProps, updated_at: stamp } : b,
    )
  }
  return next
}



// ?? Gradient & Shadow presets ?????????????????????????????????????????????????

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

// SHADOW_PRESETS imported from @/lib/builderVisualPresets

// ?? Sub-item schema registry ?????????????????????????????????????????????????

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
    defaultItem: { title: 'New Feature', desc: 'Description', icon: '?', image_url: '' },
    fields: [
      { key: 'image_url', label: 'Image',       type: 'image' },
      { key: 'icon',      label: 'Icon Emoji',  type: 'emoji' },
      { key: 'title',     label: 'Title',       type: 'text' },
      { key: 'desc',      label: 'Description', type: 'textarea' },
    ],
  },
  services_cards: {
    arrayKey: 'features', itemLabel: 'Service',
    defaultItem: { title: 'New Service', desc: 'Description', icon: '???', image_url: '' },
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
    defaultItem: { question: 'New question?', answer: 'Answer here.' },
    fields: [
      { key: 'question', label: 'Question', type: 'text' },
      { key: 'answer', label: 'Answer',   type: 'textarea' },
    ],
  },
  gallery_masonry: {
    arrayKey: 'images', itemLabel: 'Image',
    defaultItem: { src: '', caption: '', alt: '' },
    fields: [
      { key: 'src',     label: 'Image URL', type: 'image' },
      { key: 'caption', label: 'Caption',   type: 'text' },
      { key: 'alt',     label: 'Alt Text',  type: 'text' },
    ],
  },
  stats: {
    arrayKey: 'stats', itemLabel: 'Stat',
    defaultItem: { value: '100+', label: 'Metric label' },
    fields: [
      { key: 'value', label: 'Value', type: 'text' },
      { key: 'label', label: 'Label', type: 'text' },
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

/** Block types whose tile thumbnails respect `image_shape` (square / rounded / circle). */
const IMAGE_SHAPE_BLOCK_TYPES = new Set([
  'features',
  'features_alternating',
  'services_cards',
  'services_list',
  'team_grid',
  'gallery_masonry',
  'gallery',
  'gallery_grid',
  'image_gallery',
  'portfolio_grid',
  'category_cards',
  'product_grid',
  'menu_grid',
  'related_products',
  'blog_grid',
  'blog_featured',
  'blog_list',
  'testimonials',
  'testimonials_grid',
  'image_block',
])

/** Product/service catalog blocks with shared Grid & spacing controls on the Layout tab. */
interface CatalogGridBlockConfig {
  columnMin: number
  defaultColumns: number
  itemCountLabel: string
  itemCountKeys: string[]
  showColumns: boolean
  showImageHeight: boolean
  showCardStyle: boolean
  showProductToggles: boolean
  showServiceToggles: boolean
}

const CATALOG_GRID_BLOCK_CONFIG: Record<string, CatalogGridBlockConfig> = {
  product_grid: {
    columnMin: 2, defaultColumns: 4, itemCountLabel: 'Products shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: true, showCardStyle: true, showProductToggles: true, showServiceToggles: false,
  },
  menu_grid: {
    columnMin: 1, defaultColumns: 2, itemCountLabel: 'Items shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: true, showCardStyle: true, showProductToggles: true, showServiceToggles: false,
  },
  related_products: {
    columnMin: 2, defaultColumns: 4, itemCountLabel: 'Products shown', itemCountKeys: ['show_count', 'count'],
    showColumns: true, showImageHeight: true, showCardStyle: true, showProductToggles: true, showServiceToggles: false,
  },
  category_cards: {
    columnMin: 2, defaultColumns: 3, itemCountLabel: 'Categories shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: true, showCardStyle: true, showProductToggles: false, showServiceToggles: false,
  },
  services_cards: {
    columnMin: 2, defaultColumns: 3, itemCountLabel: 'Services shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: true, showCardStyle: true, showProductToggles: false, showServiceToggles: true,
  },
  services_list: {
    columnMin: 1, defaultColumns: 1, itemCountLabel: 'Services shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: true, showCardStyle: true, showProductToggles: false, showServiceToggles: true,
  },
  recently_viewed: {
    columnMin: 2, defaultColumns: 6, itemCountLabel: 'Items shown', itemCountKeys: ['max', 'show_count'],
    showColumns: true, showImageHeight: true, showCardStyle: true, showProductToggles: false, showServiceToggles: false,
  },
  live_stock: {
    columnMin: 2, defaultColumns: 4, itemCountLabel: 'Products shown', itemCountKeys: ['show_count'],
    showColumns: false, showImageHeight: false, showCardStyle: false, showProductToggles: false, showServiceToggles: false,
  },
  // Commerce kit ? product blocks
  'product.grid': {
    columnMin: 2, defaultColumns: 4, itemCountLabel: 'Products shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: true, showCardStyle: true, showProductToggles: true, showServiceToggles: false,
  },
  'product.carousel': {
    columnMin: 2, defaultColumns: 4, itemCountLabel: 'Products shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: true, showCardStyle: true, showProductToggles: true, showServiceToggles: false,
  },
  'product.categories': {
    columnMin: 2, defaultColumns: 4, itemCountLabel: 'Categories shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: true, showCardStyle: false, showProductToggles: false, showServiceToggles: false,
  },
  'product.crossSell': {
    columnMin: 2, defaultColumns: 4, itemCountLabel: 'Products shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: true, showCardStyle: true, showProductToggles: true, showServiceToggles: false,
  },
  'product.recentlyViewed': {
    columnMin: 2, defaultColumns: 6, itemCountLabel: 'Items shown', itemCountKeys: ['show_count', 'max'],
    showColumns: true, showImageHeight: true, showCardStyle: true, showProductToggles: true, showServiceToggles: false,
  },
  'product.search': {
    columnMin: 2, defaultColumns: 3, itemCountLabel: 'Results shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: true, showCardStyle: true, showProductToggles: true, showServiceToggles: false,
  },
  'product.wishlist': {
    columnMin: 2, defaultColumns: 3, itemCountLabel: 'Items shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: true, showCardStyle: true, showProductToggles: true, showServiceToggles: false,
  },
  // Commerce kit ? service blocks
  'service.list': {
    columnMin: 1, defaultColumns: 1, itemCountLabel: 'Services shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: true, showCardStyle: true, showProductToggles: false, showServiceToggles: true,
  },
  'service.grid': {
    columnMin: 2, defaultColumns: 3, itemCountLabel: 'Services shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: true, showCardStyle: true, showProductToggles: false, showServiceToggles: true,
  },
  // Commerce kit ? vertical listing blocks
  'vertical.propertyListing': {
    columnMin: 2, defaultColumns: 3, itemCountLabel: 'Listings shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: false, showCardStyle: false, showProductToggles: true, showServiceToggles: false,
  },
  'vertical.autoInventory': {
    columnMin: 2, defaultColumns: 3, itemCountLabel: 'Vehicles shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: false, showCardStyle: false, showProductToggles: true, showServiceToggles: false,
  },
  'vertical.eventListing': {
    columnMin: 2, defaultColumns: 4, itemCountLabel: 'Events shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: false, showCardStyle: false, showProductToggles: true, showServiceToggles: false,
  },
  'vertical.courseCatalog': {
    columnMin: 2, defaultColumns: 3, itemCountLabel: 'Courses shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: false, showCardStyle: false, showProductToggles: true, showServiceToggles: false,
  },
}

const CATALOG_GRID_BLOCK_TYPES = new Set(Object.keys(CATALOG_GRID_BLOCK_CONFIG))

function getCatalogGridBlockConfig(blockType: string): CatalogGridBlockConfig {
  return CATALOG_GRID_BLOCK_CONFIG[blockType] ?? CATALOG_GRID_BLOCK_CONFIG.product_grid
}

const CATALOG_GRID_COLUMN_MAX = 12

function catalogColumnOptionsFor(blockType: string): number[] {
  const min = getCatalogGridBlockConfig(blockType).columnMin
  return Array.from({ length: CATALOG_GRID_COLUMN_MAX - min + 1 }, (_, i) => min + i)
}

const CATALOG_GRID_NUM_INPUT =
  'w-[4.5rem] shrink-0 px-2 py-1.5 border border-gray-300 rounded-md text-xs font-mono text-center bg-white text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30'

const CATALOG_CARD_STYLE_OPTIONS = [
  { id: 'default', label: 'Standard' },
  { id: 'compact', label: 'Compact' },
  { id: 'minimal', label: 'Minimal' },
] as const

function CatalogGridScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5 -mx-0.5 px-0.5">
      {children}
    </div>
  )
}

function CatalogGridChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors whitespace-nowrap',
        active
          ? 'bg-primary text-white border-primary shadow-sm'
          : 'bg-white text-gray-700 border-gray-200 hover:border-primary/40',
      )}
    >
      {children}
    </button>
  )
}

function CatalogGridSliderField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix?: string
  onChange: (n: number) => void
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => onChange(clamp(Number(e.target.value) || min))}
            className={CATALOG_GRID_NUM_INPUT}
          />
          {suffix ? <span className="text-xs text-gray-500 w-4">{suffix}</span> : null}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(clamp(Number(e.target.value)))}
        className="w-full accent-primary h-2 rounded-full cursor-pointer"
      />
    </div>
  )
}

function CatalogGridLayoutControls({
  blockType,
  props: p,
  onUpdate,
  onPreview,
}: {
  blockType: string
  props: Record<string, unknown>
  onUpdate: (props: Partial<BlockProps>) => void
  onPreview: (props: Partial<BlockProps>) => void
}) {
  const patch = (next: Record<string, unknown>) => {
    onPreview(next as Partial<BlockProps>)
    onUpdate(next as Partial<BlockProps>)
  }

  const config = getCatalogGridBlockConfig(blockType)
  const colMin = config.columnMin
  const colMax = CATALOG_GRID_COLUMN_MAX
  const columns = Math.min(colMax, Math.max(colMin, Number(p.columns ?? config.defaultColumns) || colMin))
  const gap = Math.min(80, Math.max(0, Number(p.item_gap ?? 24) || 0))
  const imageHeightPct = Math.min(100, Math.max(40, Number(p.image_height_pct ?? 100) || 100))
  const cardPadding = Math.min(32, Math.max(4, Number(p.card_padding ?? 16) || 16))
  const showCount = Math.min(50, Math.max(1, Number(
    config.itemCountKeys.map(k => p[k]).find(v => v != null && v !== '') ?? 12,
  ) || 12))
  const cardStyle = String(p.card_style ?? 'default')
  const showStock = p.show_stock !== false
  const showAddButton = p.show_add_button !== false
  const showBookLink = p.show_book_link !== false && p.show_add_button !== false
  const showBadges = p.show_badges !== false
  const columnOptions = catalogColumnOptionsFor(blockType)
  const dataSource = (p.data_source && typeof p.data_source === 'object')
    ? (p.data_source as Record<string, unknown>)
    : undefined

  const patchShowCount = (n: number) => {
    const nextDs = dataSource?.type
      ? { ...dataSource, limit: n }
      : dataSource
    const countPatch: Record<string, unknown> = { show_count: n }
    for (const key of config.itemCountKeys) {
      countPatch[key] = n
    }
    patch(nextDs ? { ...countPatch, data_source: nextDs } : countPatch)
  }

  return (
    <div className="bg-gray-50 rounded-xl p-3 space-y-4 border border-gray-100">
      {config.showColumns && (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-600">Columns</span>
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              min={colMin}
              max={colMax}
              step={1}
              value={columns}
              onChange={e => patch({ columns: Math.min(colMax, Math.max(colMin, Number(e.target.value) || colMin)) })}
              className={CATALOG_GRID_NUM_INPUT}
            />
          </div>
        </div>
        <CatalogGridScrollRow>
          {columnOptions.map(n => (
            <CatalogGridChip key={n} active={columns === n} onClick={() => patch({ columns: n })}>
              {n}
            </CatalogGridChip>
          ))}
        </CatalogGridScrollRow>
        <p className="text-[11px] text-gray-400 leading-snug">
          Swipe for more column counts. More columns = narrower cards.
        </p>
      </div>
      )}

      {config.showImageHeight && (
      <CatalogGridSliderField
        label="Image height"
        value={imageHeightPct}
        min={40}
        max={100}
        step={2}
        suffix="%"
        onChange={n => patch({ image_height_pct: n })}
      />
      )}

      <CatalogGridSliderField
        label="Card padding"
        value={cardPadding}
        min={4}
        max={32}
        step={2}
        suffix="px"
        onChange={n => patch({ card_padding: n })}
      />

      <CatalogGridSliderField
        label="Gap between cards"
        value={gap}
        min={0}
        max={80}
        step={4}
        suffix="px"
        onChange={n => patch({ item_gap: n })}
      />

      <CatalogGridSliderField
        label={config.itemCountLabel}
        value={showCount}
        min={1}
        max={50}
        step={1}
        onChange={patchShowCount}
      />

      {config.showCardStyle && (
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-gray-600 block">Card style</span>
        <CatalogGridScrollRow>
          {CATALOG_CARD_STYLE_OPTIONS.map(opt => (
            <CatalogGridChip
              key={opt.id}
              active={cardStyle === opt.id}
              onClick={() => patch({ card_style: opt.id, compact: opt.id === 'compact' })}
            >
              {opt.label}
            </CatalogGridChip>
          ))}
        </CatalogGridScrollRow>
      </div>
      )}

      {(config.showProductToggles || config.showServiceToggles) && (
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-gray-600 block">Display options</span>
        <CatalogGridScrollRow>
          {config.showProductToggles && (
            <>
              <CatalogGridChip active={showBadges} onClick={() => patch({ show_badges: !showBadges })}>
                Badges
              </CatalogGridChip>
              <CatalogGridChip active={showStock} onClick={() => patch({ show_stock: !showStock })}>
                Stock label
              </CatalogGridChip>
              <CatalogGridChip active={showAddButton} onClick={() => patch({ show_add_button: !showAddButton })}>
                Add button
              </CatalogGridChip>
            </>
          )}
          {config.showServiceToggles && (
            <CatalogGridChip active={showBookLink} onClick={() => patch({ show_book_link: !showBookLink })}>
              Book link
            </CatalogGridChip>
          )}
        </CatalogGridScrollRow>
      </div>
      )}
    </div>
  )
}

// ?? Inline Media Picker ???????????????????????????????????????????????????????

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
  const [panel, setPanel] = useState<'none' | 'library' | 'url'>('none')
  const [urlInput, setUrlInput] = useState(value || '')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setUrlInput(value || '')
  }, [value])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const saved = await uploadMedia.mutateAsync(file)
      onChange(saved.original_url)
      setPanel('none')
      toast.success('Image uploaded!')
    } catch { toast.error('Upload failed') }
    e.target.value = ''
  }

  const actionBtn = 'flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border text-[10px] font-bold transition-colors'

  return (
    <div className="space-y-2">
      {label ? (
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block">{label}</label>
      ) : null}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      {value ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-primary/30 h-28 bg-gray-100">
          <img src={mediaUrl(value)} className="w-full h-full object-cover" alt="" />
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 h-28 flex flex-col items-center justify-center gap-1 text-gray-400 bg-gray-50">
          <ImageIcon className="w-6 h-6 opacity-40" />
          <span className="text-xs">No image selected</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadMedia.isPending}
          className={cn(actionBtn, 'border-primary/30 text-primary bg-accent/40 hover:bg-accent')}
        >
          {uploadMedia.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Upload className="w-4 h-4" />}
          Upload
        </button>
        <button
          type="button"
          onClick={() => setPanel(p => p === 'library' ? 'none' : 'library')}
          className={cn(actionBtn, panel === 'library' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}
        >
          <ImageIcon className="w-4 h-4" />
          Library
        </button>
        <button
          type="button"
          onClick={() => {
            setUrlInput(value || '')
            setPanel(p => p === 'url' ? 'none' : 'url')
          }}
          className={cn(actionBtn, panel === 'url' ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}
        >
          <Link2 className="w-4 h-4" />
          URL
        </button>
      </div>

      {panel === 'library' && (
        <div className="rounded-xl border border-gray-200 bg-white p-2 space-y-2">
          {mediaList.length === 0 ? (
            <p className="py-3 text-center text-xs text-gray-400">No media yet ? use Upload above first.</p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 max-h-44 overflow-y-auto">
              {mediaList.map(m => {
                const src = mediaUrl(m.original_url)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { onChange(m.original_url); setPanel('none'); toast.success('Image selected') }}
                    className={cn(
                      'aspect-square rounded-lg overflow-hidden border-2 transition-all',
                      value === m.original_url ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-primary',
                    )}
                  >
                    <img src={src} className="w-full h-full object-cover" alt={m.filename}
                      onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3' }} />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {panel === 'url' && (
        <div className="rounded-xl border border-gray-200 bg-white p-2 space-y-2">
          <input
            type="text"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
          <button
            type="button"
            onClick={() => {
              if (!urlInput.trim()) return
              onChange(urlInput.trim())
              setPanel('none')
              toast.success('Image URL applied')
            }}
            className="w-full py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90"
          >
            Use This URL
          </button>
        </div>
      )}
    </div>
  )
}

// ?? Sub-item Editor ???????????????????????????????????????????????????????????

function SubItemEditor({
  schema, items, siteId, onUpdate, onPreview,
  columns, gap, itemSize,
  onColumnsChange, onGapChange, onItemSizeChange,
  readOnly = false,
  connectedBanner,
  onSwitchToManual,
  sections = 'all',
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
  readOnly?: boolean
  connectedBanner?: React.ReactNode
  onSwitchToManual?: () => void
  /** Split layout vs item list across ribbon tabs */
  sections?: 'all' | 'layout' | 'items'
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

  const showLayoutSection = sections === 'all' || sections === 'layout'
  const showItemsSection = sections === 'all' || sections === 'items'

  return (
    <div className="space-y-3">
      {showLayoutSection && (
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
      )}

      {showItemsSection && connectedBanner}

      {showItemsSection && (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            {schema.itemLabel}s ({items.length}){readOnly ? ' ? from People' : ''}
          </span>
          {!readOnly && (
          <button
            onClick={addItem}
            className="flex items-center gap-0.5 px-2 py-1 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add {schema.itemLabel}
          </button>
          )}
          {readOnly && onSwitchToManual && (
            <button
              type="button"
              onClick={onSwitchToManual}
              className="px-2 py-1 text-xs font-semibold text-primary border border-primary/30 rounded-lg hover:bg-accent transition-colors"
            >
              Use custom list
            </button>
          )}
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
              draggable={!readOnly}
              onDragStart={() => !readOnly && handleDragStart(idx)}
              onDragOver={e => !readOnly && handleDragOver(e, idx)}
              onDrop={() => !readOnly && handleDrop(idx)}
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
                <GripVertical className={cn('w-3.5 h-3.5 shrink-0', readOnly ? 'text-gray-200' : 'text-gray-300 cursor-grab')} />
                {/* Thumbnail */}
                {thumb ? (
                  <img src={thumb} className="w-7 h-7 rounded-lg object-cover shrink-0 border border-gray-100" alt="" />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-xs">{(title[0] || '?').toUpperCase()}</span>
                  </div>
                )}
                <span className="text-xs font-medium text-gray-700 flex-1 truncate">{title}</span>
                {!readOnly && (
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
                )}
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
                        onChange={readOnly ? () => {} : url => updateItem(idx, { [field.key]: url })}
                      />
                    )
                    if (field.type === 'boolean') return (
                      <label key={field.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!item[field.key]}
                          disabled={readOnly}
                          onChange={e => !readOnly && updateItem(idx, { [field.key]: e.target.checked })}
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
                              disabled={readOnly}
                              onClick={() => !readOnly && updateItem(idx, { [field.key]: Number(opt) || opt })}
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
                          {['?','?','??','??','??','???','??','??','??','??','??','??','??','??','??'].map(e => (
                            <button key={e}
                              disabled={readOnly}
                              onClick={() => !readOnly && updateItem(idx, { [field.key]: e })}
                              className={cn('w-8 h-8 rounded-lg text-base border-2 transition-all hover:scale-110',
                                item[field.key] === e ? 'border-primary bg-accent' : 'border-transparent bg-white hover:border-primary/30')}
                            >{e}</button>
                          ))}
                          <input
                            value={item[field.key] || ''}
                            readOnly={readOnly}
                            onChange={e => !readOnly && updateItem(idx, { [field.key]: e.target.value })}
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
                          readOnly={readOnly}
                          onChange={e => !readOnly && updateItem(idx, { [field.key]: e.target.value })}
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
                          readOnly={readOnly}
                          onChange={e => !readOnly && updateItem(idx, { [field.key]: e.target.value })}
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
      )}
    </div>
  )
}

// ?? Props Editor ??????????????????????????????????????????????????????????????

function PropsCollapsible({
  title,
  preview,
  accent,
  children,
}: {
  title: string
  preview?: string
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <details
      className={cn(
        'group rounded-lg border overflow-hidden transition-colors',
        accent
          ? 'border-primary/30 bg-primary/5 shadow-sm'
          : 'border-gray-200 bg-white shadow-sm hover:border-gray-300',
      )}
    >
      <summary
        className={cn(
          'list-none cursor-pointer flex items-center gap-2 px-3 py-2.5 transition-colors [&::-webkit-details-marker]:hidden',
          accent ? 'hover:bg-primary/10' : 'hover:bg-gray-50/80',
        )}
      >
        <span
          className={cn(
            'text-xs font-semibold shrink-0',
            accent ? 'text-primary' : 'text-gray-800',
          )}
        >
          {title}
        </span>
        <div className="flex-1 min-w-0" />
        {preview && (
          <span
            className={cn(
              'shrink-0 max-w-[45%] truncate rounded-full px-2 py-0.5 text-[10px] font-medium',
              preview === 'Empty'
                ? 'bg-gray-50 text-gray-300 italic'
                : accent
                  ? 'bg-primary/15 text-primary'
                  : 'bg-gray-100 text-gray-500',
            )}
          >
            {preview}
          </span>
        )}
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 shrink-0 transition-transform group-open:rotate-180',
            accent ? 'text-primary' : 'text-gray-400',
          )}
        />
      </summary>
      <div className="px-3 pb-3 pt-2 border-t border-gray-100 bg-gray-50/40 space-y-2">
        {children}
      </div>
    </details>
  )
}

// ?? Stable InputRow component (outside PropsEditor to avoid remount on re-render) ??
interface InputRowProps {
  blockId: string
  fieldKey: string
  label: string
  serverValue: string
  multiline?: boolean
  placeholder?: string
  linkTarget?: string
  onCommit: (val: string) => void
  onPreview: (val: string) => void
  onLink?: (anchor: { x: number; y: number }) => void
}

function PropsInputRow({
  blockId, fieldKey, label, serverValue, multiline, placeholder,
  linkTarget, onCommit, onPreview, onLink,
}: InputRowProps) {
  const [localVal, setLocalVal] = useState(serverValue)
  const isEditingRef = useRef(false)

  // Sync external changes (block switch, AI overwrite, undo) into local state,
  // but never while the user is actively typing ? otherwise a stale server
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
  const preview = localVal.trim() || 'Empty'

  return (
    <PropsCollapsible title={label} preview={preview}>
      {onLink && (
        <div className="flex items-center gap-1.5 justify-end">
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
        </div>
      )}

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
    </PropsCollapsible>
  )
}

// ?? Block Quick Presets (see @/lib/sectionLayoutPresets) ???????????????????????

// ?? P3.4 Per-breakpoint block style overrides ?????????????????????????????????
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
    <PropsCollapsible
      title="Block Styles"
      preview={Object.keys(styleOverrides).length ? `${Object.keys(styleOverrides).length} breakpoint(s)` : 'Default'}
    >
      <div className="flex items-center justify-end">
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs">
          {(['desktop', 'tablet', 'mobile'] as Breakpoint[]).map(b => (
            <button
              key={b}
              onClick={() => setBp(b)}
              className={cn('px-2 py-1 font-medium transition-colors', bp === b ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-50')}
            >
              {b === 'desktop' ? '??' : b === 'tablet' ? '??' : '??'}
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
        >? Reset {bp} styles</button>
      )}
    </PropsCollapsible>
  )
}


// ?? P3.2 Branch Visibility Selector ??????????????????????????????????????????
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

function BlockImagePickerField({
  blockId,
  label,
  fieldKey,
  hint,
  currentUrl,
  onUpdate,
  siteId,
}: {
  blockId: string
  label: string
  fieldKey: string
  hint?: string
  currentUrl?: string
  onUpdate: (props: Partial<BlockProps>) => void
  siteId?: string
}) {
  const [imgOk, setImgOk] = useState(true)

  if (siteId) {
    return (
      <div className="space-y-2">
        {(label || currentUrl) && (
          <div className="flex items-center gap-1.5">
            {label ? <label className="text-xs font-medium text-gray-600 flex-1">{label}</label> : <div className="flex-1" />}
            {currentUrl && (
              <button type="button" onClick={() => onUpdate({ [fieldKey]: '' })} className="text-xs text-red-400 hover:text-red-600">? Clear</button>
            )}
          </div>
        )}
        <InlineMediaPicker
          siteId={siteId}
          value={currentUrl || ''}
          onChange={url => onUpdate({ [fieldKey]: url })}
          label=""
        />
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    )
  }

  const resolved = currentUrl ? mediaUrl(currentUrl) : ''
  return (
    <div className="space-y-2">
      {(label || currentUrl) && (
        <div className="flex items-center gap-1.5">
          {label ? <label className="text-xs font-medium text-gray-600 flex-1">{label}</label> : <div className="flex-1" />}
          {currentUrl && (
            <button type="button" onClick={() => onUpdate({ [fieldKey]: '' })} className="text-xs text-red-400 hover:text-red-600">? Clear</button>
          )}
        </div>
      )}
      <div
        className={cn(
          'relative rounded-xl overflow-hidden border-2 transition-all',
          currentUrl && resolved && imgOk
            ? 'border-primary/30 bg-gray-100'
            : 'border-dashed border-gray-200 bg-gray-50 flex items-center justify-center',
        )}
        style={{ minHeight: currentUrl && resolved && imgOk ? undefined : '96px' }}
      >
        {currentUrl && resolved ? (
          <>
            <img
              key={resolved}
              src={resolved}
              className="hidden"
              alt=""
              onLoad={() => setImgOk(true)}
              onError={() => setImgOk(false)}
            />
            {imgOk ? (
              <SingleImagePreview
                url={currentUrl}
                alt=""
                resolveUrl={mediaUrl}
                className="w-full"
                imgClassName="w-full object-cover max-h-[140px]"
                viewOnlyTitle="View image"
              >
                <div className="absolute top-1.5 right-1.5 z-10 flex gap-1">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(resolved); toast.success('URL copied!') }}
                    className="p-1 bg-black/50 rounded text-white hover:bg-black/70"
                    title="Copy URL"
                  ><Copy className="w-3 h-3" /></button>
                </div>
              </SingleImagePreview>
            ) : (
              <div className="w-full h-24 flex flex-col items-center justify-center text-gray-400 gap-1">
                <ImageIcon className="w-6 h-6 opacity-40" />
                <span className="text-xs">Cannot preview (URL may be invalid)</span>
              </div>
            )}
          </>
        ) : (
          <div className="py-6 flex flex-col items-center justify-center gap-1.5 text-gray-400 w-full">
            <ImageIcon className="w-7 h-7 opacity-30" />
            <span className="text-xs text-center">No image set<br />Paste a URL below</span>
          </div>
        )}
      </div>
      <input
        key={`${blockId}-${fieldKey}`}
        defaultValue={currentUrl || ''}
        onBlur={e => { onUpdate({ [fieldKey]: e.target.value }); setImgOk(true) }}
        placeholder="Paste image URL?"
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-ring font-mono"
      />
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}


// ?? Section layout controls (Edit panel + toolbar) ???????????????????????????

function SectionLayoutControls({
  block,
  currentProps,
  onOpenLayoutPicker,
  onCycleLayout,
  compact = false,
}: {
  block: WebsiteBlock
  currentProps: Record<string, unknown>
  onOpenLayoutPicker: () => void
  onCycleLayout: (direction: 'prev' | 'next') => void
  compact?: boolean
}) {
  const layoutOptions = getSectionLayoutOptions(block.block_type)
  if (layoutOptions.length === 0) return null

  const activeLayout = findActiveSectionLayoutOption(currentProps, layoutOptions)
    ?? findBestSectionLayoutOption(currentProps, layoutOptions)
    ?? layoutOptions[findActiveLayoutIndex(currentProps, block.block_type)]
  const activeIdx = findActiveLayoutIndex(currentProps, block.block_type)
  const canCycle = layoutOptions.length > 1

  if (compact) {
    return (
      <div className="inline-flex items-center rounded-md bg-gray-800/80 border border-gray-700/80 overflow-hidden">
        <button
          type="button"
          disabled={!canCycle}
          onClick={e => { e.stopPropagation(); onCycleLayout('prev') }}
          title="Previous style ? same section, different look (does not move it on the page)"
          className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onOpenLayoutPicker() }}
          title={`Change section style ? ${activeLayout?.label || 'Current'} (not page position)`}
          className="px-2 py-1.5 text-gray-300 hover:text-white border-x border-gray-700/80"
        >
          <Layout className="w-7 h-7" />
        </button>
        <button
          type="button"
          disabled={!canCycle}
          onClick={e => { e.stopPropagation(); onCycleLayout('next') }}
          title="Next style ? same section, different look (does not move it on the page)"
          className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/8 to-white p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wide text-primary">
            {block.label || block.block_type}
          </div>
          <div className="text-sm font-semibold text-gray-900 truncate mt-0.5">
            {activeLayout?.label || 'Default layout'}
          </div>
          {activeLayout?.desc && (
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{activeLayout.desc}</p>
          )}
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-gray-400 tabular-nums">
          {activeIdx + 1}/{layoutOptions.length}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canCycle}
          onClick={() => onCycleLayout('prev')}
          title="Previous style (same section, different look)"
          className={cn(
            'shrink-0 p-2 rounded-lg border transition-colors',
            canCycle
              ? 'border-gray-200 bg-white text-gray-600 hover:border-primary/40 hover:text-primary'
              : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed',
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onOpenLayoutPicker}
          className="flex-1 min-w-0 py-2 px-3 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm"
        >
          Change style
        </button>
        <button
          type="button"
          disabled={!canCycle}
          onClick={() => onCycleLayout('next')}
          title="Next style (same section, different look)"
          className={cn(
            'shrink-0 p-2 rounded-lg border transition-colors',
            canCycle
              ? 'border-gray-200 bg-white text-gray-600 hover:border-primary/40 hover:text-primary'
              : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed',
          )}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[11px] text-gray-400 leading-snug">
        <strong className="font-semibold text-gray-600">Change style</strong> picks a different look for this section.
        <strong className="font-semibold text-gray-600"> Move ??</strong> on the floating toolbar changes where it sits on the page.
        {layoutOptions.length > 1 ? ` ${layoutOptions.length} styles available.` : ''}
      </p>
    </div>
  )
}

function PropsEditor({
  block, onUpdate, onPreview, siteId, pages, onAddPage, onEditPropLink, themeColors,
  onOpenLayoutPicker, onCycleLayout,
}: {
  block: WebsiteBlock
  onUpdate: (props: Partial<BlockProps>) => void
  onPreview: (props: Partial<BlockProps>) => void
  siteId: string
  pages?: WebsitePage[]
  onAddPage?: () => void
  onEditPropLink?: (propKey: string, anchor: { x: number; y: number }) => void
  themeColors: ThemeColors
  onOpenLayoutPicker?: () => void
  onCycleLayout?: (direction: 'prev' | 'next') => void
}) {
  const p = block.props
  const showTileColors = TILE_COLOR_BLOCK_TYPES.has(block.block_type)
  const tileSwatchDefaults = {
    tile_bg: themeColors.surface_color || themeColors.bg_color || '#ffffff',
    tile_accent: themeColors.primary_color,
    tile_text: themeColors.text_color,
    tile_border: `${themeColors.primary_color}33`,
  }

  // Spacing sliders ? read from block.props (where onUpdate writes)
  const [paddingTop, setPaddingTop] = useState<number>((p as any).padding_top ?? 0)
  const [paddingBottom, setPaddingBottom] = useState<number>((p as any).padding_bottom ?? 0)

  // Sync spacing when block changes
  useEffect(() => {
    setPaddingTop((p as any).padding_top ?? 0)
    setPaddingBottom((p as any).padding_bottom ?? 0)
  }, [block.id, (p as any).padding_top, (p as any).padding_bottom])

  const itemSchema = ITEM_SCHEMAS[block.block_type]
    ?? (block.block_type === 'features_alternating' ? ITEM_SCHEMAS.features : undefined)
    ?? (block.block_type === 'services_list' ? ITEM_SCHEMAS.services_cards : undefined)
    ?? (['stats', 'counters', 'impact_stats'].includes(block.block_type) ? ITEM_SCHEMAS.stats : undefined)
  const [subColumns, setSubColumns] = useState<number>((p as any).columns ?? itemSchema?.fields.length ?? 3)
  const [subGap, setSubGap] = useState<number>((p as any).item_gap ?? 24)
  const [subItemSize, setSubItemSize] = useState<number>((p as any).item_size ?? 160)
  const isCatalogGridBlock = CATALOG_GRID_BLOCK_TYPES.has(block.block_type)
  const [teamLiveItems, setTeamLiveItems] = useState<LiveItem[]>([])

  useEffect(() => {
    setSubColumns((p as any).columns ?? itemSchema?.fields.length ?? 3)
    setSubGap((p as any).item_gap ?? 24)
    setSubItemSize((p as any).item_size ?? 160)
  }, [block.id, (p as any).columns, (p as any).item_gap, (p as any).item_size, itemSchema?.fields.length])

  const isTeamBlock = block.block_type === 'team_grid' || block.block_type === 'team_list'
  useEffect(() => {
    if (!isTeamBlock || !siteId) {
      setTeamLiveItems([])
      return
    }
    void websiteApi.getLive(siteId, 'team', { limit: 50 })
      .then(r => setTeamLiveItems(r.items ?? []))
      .catch(() => setTeamLiveItems([]))
  }, [isTeamBlock, siteId, block.id, (p as any).data_source])

  const teamUseLive = isTeamBlock && shouldUseLiveTeam(p as Record<string, unknown>, teamLiveItems)
  const subEditorItems = isTeamBlock && teamUseLive
    ? teamLiveItems.map(liveItemToPropMember)
    : (itemSchema ? ((p as any)[itemSchema.arrayKey] || []) : [])

  const [editorTab, setEditorTab] = useState<SectionEditorTabId>('content')
  useEffect(() => {
    setEditorTab('content')
  }, [block.id])

  const teamConnectedBanner = teamUseLive ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 leading-snug">
      <span className="font-semibold">Connected to your People list.</span>{' '}
      Names and roles come from HR. Layout controls below still apply on the canvas.
      Click <span className="font-semibold">Use custom list</span> to edit members here instead.
    </div>
  ) : isTeamBlock && isLiveTeamDataSource(p as Record<string, unknown>) && teamLiveItems.length > 0 ? (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600 leading-snug">
      Using your custom member list. Disconnect Team in the Store data tab to pull from People again.
    </div>
  ) : undefined

  const renderSubItemEditor = (sections: 'layout' | 'items') => itemSchema ? (
    <SubItemEditor
      schema={itemSchema}
      items={subEditorItems}
      siteId={siteId}
      sections={sections}
      readOnly={teamUseLive}
      connectedBanner={teamConnectedBanner}
      onSwitchToManual={teamUseLive ? () => {
        const members = teamLiveItems.length > 0
          ? teamLiveItems.map(liveItemToPropMember)
          : teamPropMembers(p as Record<string, unknown>)
        onUpdate({ use_manual_members: true, members } as any)
      } : undefined}
      onUpdate={items => onUpdate({ [itemSchema.arrayKey]: items, use_manual_members: true } as any)}
      onPreview={items => onPreview({ [itemSchema.arrayKey]: items, use_manual_members: true } as any)}
      columns={subColumns}
      gap={subGap}
      itemSize={subItemSize}
      onColumnsChange={n => {
        setSubColumns(n)
        onPreview({ columns: n } as any)
        onUpdate({ columns: n } as any)
      }}
      onGapChange={n => {
        setSubGap(n)
        onPreview({ item_gap: n } as any)
        onUpdate({ item_gap: n } as any)
      }}
      onItemSizeChange={n => {
        setSubItemSize(n)
        onPreview({ item_size: n } as any)
        onUpdate({ item_size: n } as any)
      }}
    />
  ) : null

  // ?? InputRow ? render helper that inlines PropsInputRow ???????????????
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
      onCommit={val => onUpdate({ [opts.fieldKey]: val })}
      onPreview={val => onPreview({ [opts.fieldKey]: val })}
      onLink={onEditPropLink ? anchor => onEditPropLink(opts.fieldKey, anchor) : undefined}
    />
  )

  // ?? Fields ??????????????????????????????????????????????????????????????
  const commonFields = (
    <div className="space-y-2">
      {p.headline    !== undefined && inputRow({ label: 'Headline',      fieldKey: 'headline',      placeholder: 'Your compelling headline?' })}
      {p.subtitle    !== undefined && inputRow({ label: 'Subtitle',      fieldKey: 'subtitle',      multiline: true, placeholder: 'Expand your headline here?' })}
      {p.title       !== undefined && inputRow({ label: 'Title',         fieldKey: 'title',         placeholder: 'Section title?' })}
      {p.description !== undefined && inputRow({ label: 'Description',   fieldKey: 'description',   multiline: true, placeholder: 'Describe this section?' })}
      {p.eyebrow     !== undefined && inputRow({ label: 'Eyebrow',       fieldKey: 'eyebrow',       placeholder: 'TAGLINE' })}
      {p.cta_primary !== undefined && inputRow({ label: 'Primary CTA',   fieldKey: 'cta_primary',   placeholder: 'Get Started' })}
      {p.cta_primary !== undefined && inputRow({ label: '? Primary link', fieldKey: 'cta_primary_url',   placeholder: '/signup or /products/my-product' })}
      {p.cta_secondary!== undefined && inputRow({ label: 'Secondary CTA',fieldKey: 'cta_secondary', placeholder: 'Learn More' })}
      {p.cta_secondary!== undefined && inputRow({ label: '? Secondary link', fieldKey: 'cta_secondary_url', placeholder: '/about or https://...' })}
      {p.cta_label   !== undefined && inputRow({ label: 'CTA Label',     fieldKey: 'cta_label',     placeholder: 'Click Here' })}
      {p.cta_label   !== undefined && inputRow({ label: '? CTA link',    fieldKey: 'cta_url',       placeholder: '/signup or /contact' })}
      {p.brand       !== undefined && inputRow({ label: 'Brand Name',    fieldKey: 'brand',         placeholder: 'Your Brand' })}
      {p.text        !== undefined && inputRow({ label: 'Text',          fieldKey: 'text',          multiline: true, placeholder: 'Enter text?' })}
      {p.copyright   !== undefined && inputRow({ label: 'Copyright',     fieldKey: 'copyright',     placeholder: '? 2026 Your Company' })}
    </div>
  )

  const bgStyleField = p.bg_style !== undefined && (
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
  )

  // Gradient presets (shown when bg_style=gradient)
  const gradientField = p.bg_style === 'gradient' && (
    <div className="space-y-1.5">
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
          {[['135deg','? Diagonal'],['to right','? Horizontal'],['to bottom','? Vertical'],['to top right','? Top-Right'],['circle at center','? Radial']].map(([v,l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
    </div>
  )

  const imagePicker = (label: string, fieldKey: string, hint?: string) => (
    <PropsCollapsible
      title={label}
      preview={(p as any)[fieldKey] ? 'Image set' : undefined}
    >
      <BlockImagePickerField
        blockId={block.id}
        label=""
        fieldKey={fieldKey}
        hint={hint}
        siteId={siteId}
        currentUrl={(p as any)[fieldKey] as string | undefined}
        onUpdate={onUpdate}
      />
    </PropsCollapsible>
  )

  // One image control per section ? match canvas wiring (heroLayoutUtils).
  const blockProps = p as Record<string, unknown>
  const isHeroBlock = ['hero', 'hero_split', 'hero_minimal'].includes(block.block_type)
  const usesSideImage = isHeroBlock && heroUsesSideImage(block.block_type, blockProps)
  const usesBgImage = isHeroBlock && heroUsesBackgroundImage(block.block_type, blockProps)

  const heroImageField = isHeroBlock && (usesSideImage || usesBgImage) && imagePicker(
    usesSideImage ? 'Hero Image' : 'Background Image',
    usesSideImage ? 'image_url' : 'bg_image_url',
    usesSideImage
      ? 'Shown beside the headline in split layouts.'
      : 'Full-bleed photo behind the hero text.',
  )

  const bgImageField = !isHeroBlock && p.bg_style === 'image' && imagePicker(
    'Background Image',
    'bg_image_url',
  )

  const imageUrlField = !isHeroBlock && p.image_url !== undefined && imagePicker('Image', 'image_url')

  const layoutField = p.layout !== undefined && !getSectionLayoutOptions(block.block_type).length && (
    <div className="grid grid-cols-3 gap-1">
        {['centered','split','minimal','left','right','full'].map(l => (
          <button key={l}
            onClick={() => onUpdate({ layout: l })}
            className={cn('py-1.5 text-xs font-bold rounded border transition-colors',
              p.layout === l ? 'bg-primary text-white border-primary' : 'text-gray-500 border-gray-200 hover:border-primary/40')}
          >{l.charAt(0).toUpperCase() + l.slice(1)}</button>
        ))}
    </div>
  )

  const sectionLayoutCount = getSectionLayoutOptions(block.block_type).length
  const hasImageShape = IMAGE_SHAPE_BLOCK_TYPES.has(block.block_type)
  const hasMediaClip = blockSupportsMediaClip(block.block_type)
  const hasMediaPanel = isHeroBlock || p.bg_style === 'image' || p.image_url !== undefined || block.block_type === 'nav'

  const ribbonTabs = useMemo(() => ([
    { id: 'content' as SectionEditorTabId, label: 'Content', icon: Type },
    { id: 'layout' as SectionEditorTabId, label: 'Layout', icon: Layout },
    { id: 'design' as SectionEditorTabId, label: 'Design', icon: Palette },
    { id: 'media' as SectionEditorTabId, label: 'Media', icon: ImageIcon, hidden: !hasMediaPanel },
    { id: 'more' as SectionEditorTabId, label: 'More', icon: SlidersHorizontal },
  ]), [hasMediaPanel])

  useEffect(() => {
    setEditorTab(prev => resolveSectionEditorTab(ribbonTabs, prev))
  }, [block.id, ribbonTabs])

  const sectionBgOverride = (p as any).bg_color_override as string | undefined
  const sectionTextOverride = (p as any).text_color_override as string | undefined
  const sectionBgFallback = themeColors.bg_color || '#ffffff'
  const sectionTextFallback = themeColors.text_color || '#111827'

  const sectionColorField = (
    key: 'bg_color_override' | 'text_color_override',
    label: string,
    fallback: string,
    override: string | undefined,
  ) => (
    <div key={key} className="flex items-center gap-2">
      <input
        type="color"
        value={override || fallback}
        onChange={e => {
          onPreview({ [key]: e.target.value } as any)
          onUpdate({ [key]: e.target.value } as any)
        }}
        className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-700">{label}</div>
        <div className="text-xs text-gray-400 font-mono truncate">
          {override || 'Page default'}
        </div>
      </div>
      {override != null && override !== '' && (
        <button
          type="button"
          onClick={() => {
            onPreview({ [key]: null } as any)
            onUpdate({ [key]: null } as any)
          }}
          className="text-[10px] text-gray-400 hover:text-red-500 shrink-0"
          title="Use page default"
        >
          Reset
        </button>
      )}
    </div>
  )

  const sectionColorsPanel = (
    <SectionPanelGroup
      title="Section colors"
      description="Overrides this section only. Page Edit sets the page default."
    >
      <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50/60 p-2.5">
        {sectionColorField('bg_color_override', 'Section background', sectionBgFallback, sectionBgOverride)}
        {sectionColorField('text_color_override', 'Section text', sectionTextFallback, sectionTextOverride)}
      </div>
    </SectionPanelGroup>
  )

  const imageShapePicker = hasImageShape && (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tile image shape</span>
        <span className="text-[10px] text-gray-400">All cards in section</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {IMAGE_SHAPE_OPTIONS.map(opt => {
          const active = String((p as any).image_shape ?? (block.block_type === 'team_grid' ? 'circle' : 'rounded')) === opt.value
          const previewClass = opt.value === 'circle'
            ? 'rounded-full'
            : opt.value === 'square'
              ? 'rounded-sm'
              : 'rounded-lg'
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onPreview({ image_shape: opt.value } as any)
                onUpdate({ image_shape: opt.value } as any)
              }}
              className={cn(
                'flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg border text-xs font-semibold transition-colors',
                active
                  ? 'border-primary bg-white text-primary shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40',
              )}
            >
              <span className={cn('w-8 h-8 bg-primary/20 border border-primary/30', previewClass)} aria-hidden />
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )

  const mediaClipPicker = hasMediaClip && (
    <MediaClipPicker
      value={(p as any).media_clip}
      embedded
      onChange={clip => {
        onPreview({ media_clip: clip } as any)
        onUpdate({ media_clip: clip } as any)
      }}
    />
  )

  const mediaClipPanel = hasMediaClip && (
    <SectionPanelGroup
      title="Media clip frames"
      description="Crop photos and video with angled or organic shapes. Hover a tile for the full name."
    >
      {mediaClipPicker}
    </SectionPanelGroup>
  )

  return (
    <div className="flex flex-col min-h-0">
      <div className="shrink-0 px-3 py-2 border-b border-gray-100 bg-white">
        <p className="text-xs font-bold text-gray-900 truncate">{block.label || block.block_type}</p>
        <p className="text-[10px] text-gray-400">Section settings ? colors, layout, and content</p>
      </div>

      <div className="shrink-0 px-3 pt-3 pb-3 border-b border-gray-200 bg-gray-50/40">
        {sectionColorsPanel}
      </div>

      <SectionEditorRibbon tabs={ribbonTabs} active={editorTab} onChange={setEditorTab} />

      <div className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0 bg-gray-50/30">
        {editorTab === 'content' && (
          <>
      {commonFields}

      {onEditPropLink && (
        <PropsCollapsible
          title="Block link"
          preview={(p as any).block_link_url ? String((p as any).block_link_url) : 'Not linked'}
        >
          <p className="text-xs text-gray-500 leading-snug">
            Make this whole block clickable. Buttons and form fields inside the block still keep their own clicks.
          </p>
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
        </PropsCollapsible>
      )}

      {block.block_type === 'nav' && (
        <PropsCollapsible title="Header elements" preview="Logo ? links ? actions">
          {[
            { key: 'show_nav_links', label: 'Show page links' },
            { key: 'show_search', label: 'Show search' },
            { key: 'show_cart', label: 'Show cart' },
            { key: 'show_login', label: 'Show account / sign in' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(p as any)[key] !== false}
                onChange={e => onUpdate({ [key]: e.target.checked } as any)}
                className="rounded accent-primary"
              />
              <span className="text-xs text-gray-600">{label}</span>
            </label>
          ))}
        </PropsCollapsible>
      )}

      {block.block_type === 'nav' && (
        <PropsCollapsible
          title="Navigation links"
          preview={(p.nav_links_source as string) === 'manual' ? 'Manual links' : `${pages?.length ?? 0} site page${(pages?.length ?? 0) === 1 ? '' : 's'}`}
        >
          <div className="space-y-2">
            <label className="text-xs text-gray-500">Link source</label>
            <select
              value={(p.nav_links_source as string) || 'site_pages'}
              onChange={e => onUpdate({ nav_links_source: e.target.value } as any)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs"
            >
              <option value="site_pages">Site pages (auto-sync)</option>
              <option value="manual">Manual links</option>
            </select>
          </div>

          {(p.nav_links_source as string) === 'manual' ? (
            <div className="space-y-2 mt-2">
              {((p.nav_links as { label?: string; url?: string }[]) || []).map((link, i) => (
                <div key={i} className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    value={link.label || ''}
                    placeholder="Label"
                    onChange={e => {
                      const links = [...((p.nav_links as { label: string; url: string }[]) || [])]
                      links[i] = { ...links[i], label: e.target.value }
                      onUpdate({ nav_links: links } as any)
                    }}
                    className="flex-1 min-w-0 px-2 py-1 border border-gray-200 rounded text-xs"
                  />
                  <input
                    type="text"
                    value={link.url || ''}
                    placeholder="/about"
                    onChange={e => {
                      const links = [...((p.nav_links as { label: string; url: string }[]) || [])]
                      links[i] = { ...links[i], url: e.target.value }
                      onUpdate({ nav_links: links } as any)
                    }}
                    className="flex-1 min-w-0 px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const links = [...((p.nav_links as { label: string; url: string }[]) || [])]
                      links.splice(i, 1)
                      onUpdate({ nav_links: links } as any)
                    }}
                    className="p-1 text-red-400 hover:text-red-600"
                    aria-label="Remove link"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => onUpdate({
                  nav_links: [...((p.nav_links as { label: string; url: string }[]) || []), { label: 'New Link', url: '/' }],
                } as any)}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary font-semibold"
              >
                <Plus className="w-3 h-3" /> Add link
              </button>
            </div>
          ) : pages && pages.length > 0 ? (
            <>
              {onAddPage && (
                <button
                  onClick={onAddPage}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary font-semibold"
                >
                  <Plus className="w-3 h-3" /> New Page
                </button>
              )}
              <div className="space-y-1">
                {[...pages]
                  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                  .map(pg => (
                    <div key={pg.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-700 truncate">{pg.title}</div>
                        <div className="text-xs text-gray-400 font-mono">{pg.is_homepage ? '/' : `/${pg.slug}`}</div>
                      </div>
                      <span className={cn(
                        'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border',
                        pg.show_in_nav !== false
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200',
                      )}>
                        {pg.show_in_nav !== false ? 'In nav' : 'Hidden'}
                      </span>
                    </div>
                  ))}
              </div>
              <p className="text-xs text-gray-400">Pages with ?In nav? appear automatically. Toggle visibility in the Pages panel.</p>
            </>
          ) : onAddPage ? (
            <button
              onClick={onAddPage}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-primary/30 rounded-xl text-xs text-primary font-semibold hover:border-primary/60 hover:bg-accent transition-colors"
            >
              <Plus className="w-4 h-4" /> Add your first page
            </button>
          ) : null}
        </PropsCollapsible>
      )}

      {itemSchema && (
        <PropsCollapsible title={itemSchema.itemLabel || 'Items'} preview={`${subEditorItems.length} item(s)`}>
          {renderSubItemEditor('items')}
        </PropsCollapsible>
      )}
          </>
        )}

        {editorTab === 'layout' && (
          <>
      {sectionLayoutCount > 0 && onOpenLayoutPicker && onCycleLayout ? (
        <SectionLayoutControls
          block={block}
          currentProps={p as Record<string, unknown>}
          onOpenLayoutPicker={onOpenLayoutPicker}
          onCycleLayout={onCycleLayout}
        />
      ) : null}

      {imageShapePicker}

      {layoutField && (
        <PropsCollapsible title="Layout variant" preview={String(p.layout || '')}>
          {layoutField}
        </PropsCollapsible>
      )}

      {itemSchema && !isCatalogGridBlock && (
        <PropsCollapsible title="Grid & spacing" preview={`${subColumns} col ? ${subGap}px gap`}>
          {renderSubItemEditor('layout')}
        </PropsCollapsible>
      )}

      {isCatalogGridBlock && (
        <PropsCollapsible
          title="Grid & spacing"
          preview={`${(() => {
            const cfg = getCatalogGridBlockConfig(block.block_type)
            const cols = Math.min(CATALOG_GRID_COLUMN_MAX, Math.max(cfg.columnMin, Number((p as any).columns ?? cfg.defaultColumns) || cfg.defaultColumns))
            return cfg.showColumns ? `${cols} col ? ${Number((p as any).image_height_pct ?? 100)}% img` : `${Number((p as any).show_count ?? 12)} items`
          })()}`}
        >
          <CatalogGridLayoutControls
            blockType={block.block_type}
            props={p as Record<string, unknown>}
            onUpdate={onUpdate}
            onPreview={onPreview}
          />
        </PropsCollapsible>
      )}

      <PropsCollapsible title="Section Spacing" preview={`?${paddingTop}px ?${paddingBottom}px`}>
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
                onInput={e => {
                  const n = Number((e.target as HTMLInputElement).value)
                  set(n)
                  onPreview({ [key]: n } as any)
                }}
                onChange={e => {
                  const n = Number(e.target.value)
                  set(n)
                  onUpdate({ [key]: n } as any)
                }}
                className="w-full accent-primary h-2 rounded-full cursor-pointer"
              />
              <div className="flex justify-between mt-0.5 px-0.5">
                {[0, 80, 160, 240, 320].map(v => (
                  <span key={v} className="text-[8px] text-gray-300 font-mono">{v}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </PropsCollapsible>

      <PropsCollapsible
        title="Origins (Section Shapes)"
        preview={[
          (p as any).top_shape && (p as any).top_shape !== 'none' ? `Top: ${(p as any).top_shape}` : null,
          (p as any).bottom_shape && (p as any).bottom_shape !== 'none' ? `Bottom: ${(p as any).bottom_shape}` : null,
        ].filter(Boolean).join(' ? ') || 'None'}
      >
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
      </PropsCollapsible>
          </>
        )}

        {editorTab === 'design' && (
          <>
      <SectionPanelGroup
        title="Section appearance"
        description="Background treatment, shadow, and typography for this block."
      >
        <div className="space-y-2">
          {bgStyleField && (
            <PropsCollapsible title="Background style" preview={String(p.bg_style || 'minimal')}>
              {bgStyleField}
            </PropsCollapsible>
          )}
          {gradientField && (
            <PropsCollapsible title="Gradient preset" preview={(p as any).gradient_preset ? 'Custom' : 'Default'}>
              {gradientField}
            </PropsCollapsible>
          )}
          <PropsCollapsible
            title="Block shadow"
            preview={SHADOW_PRESETS.find(sh => sh.value === ((p as any).block_shadow ?? 'none'))?.label || 'None'}
          >
            <div className="grid grid-cols-4 gap-1.5">
              {SHADOW_PRESETS.map(sh => (
                <button
                  key={sh.label}
                  onClick={() => {
                    onPreview({ block_shadow: sh.value } as any)
                    onUpdate({ block_shadow: sh.value } as any)
                  }}
                  title={sh.label}
                  className={cn(
                    'py-2 rounded-lg border text-xs font-bold transition-all text-center bg-white',
                    ((p as any).block_shadow ?? 'none') === sh.value
                      ? 'border-primary bg-accent text-primary'
                      : 'border-gray-200 text-gray-500 hover:border-primary/40',
                  )}
                  style={{ boxShadow: sh.value === 'none' ? undefined : sh.value }}
                >
                  {sh.label}
                </button>
              ))}
            </div>
          </PropsCollapsible>
          <PropsCollapsible
            title="Text & sizing"
            preview={
              typeof (p as any).font_size_px === 'number' && (p as any).font_size_px > 0
                ? `${Math.round((p as any).font_size_px)}px`
                : 'Auto'
            }
          >
            <TypographyCompositionFields
              fontSizePx={(p as any).font_size_px as number | undefined}
              onFontSizeChange={px => onUpdate({ font_size_px: px, text_scale: null } as any)}
              textCaseId={currentTextCaseMenuId(p as any)}
              onTextCaseSelect={id => {
                const patch = buildTextCasePropsPatch(p as Record<string, unknown>, id)
                onUpdate(patch as any)
                if (id === 'sentence' || id === 'toggle') {
                  toast.success(id === 'sentence' ? 'Sentence case applied' : 'Toggle case applied')
                }
              }}
              textAlign={(p as any).text_align as string | undefined}
              verticalAlign={(p as any).vertical_align as string | undefined}
              textWrap={(p as any).text_wrap as boolean | undefined}
              onTextAlignChange={align => onUpdate({ text_align: align } as any)}
              onVerticalAlignChange={align => onUpdate({ vertical_align: align } as any)}
              onTextWrapChange={wrap => onUpdate({ text_wrap: wrap } as any)}
            />
          </PropsCollapsible>
        </div>
      </SectionPanelGroup>

      {showTileColors && (
        <SectionPanelGroup
          title="Card colors"
          description="Tint tiles and cards inside this section ? not the section backdrop."
        >
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'tile_bg' as const, label: 'Card background', hint: 'Tile / card fill' },
              { key: 'tile_accent' as const, label: 'Accent', hint: 'Highlights & top bar' },
              { key: 'tile_text' as const, label: 'Card text', hint: 'Titles & body in cards' },
              { key: 'tile_border' as const, label: 'Border', hint: 'Card outline' },
            ] as const).map(({ key, label, hint }) => (
              <div key={key} className="flex items-center gap-2 p-2.5 bg-gray-50/80 rounded-lg border border-gray-100">
                <input type="color"
                  value={tileColorSwatch((p as any)[key], tileSwatchDefaults[key])}
                  onChange={e => onUpdate({ [key]: e.target.value } as any)}
                  className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-gray-700">{label}</div>
                  <div className="text-[10px] text-gray-400 truncate">{hint}</div>
                </div>
                {(p as any)[key] && (
                  <button
                    type="button"
                    onClick={() => onUpdate({ [key]: null } as any)}
                    className="text-[10px] text-red-400 hover:text-red-600 shrink-0"
                  >?</button>
                )}
              </div>
            ))}
          </div>
          {hasTileColorOverrides(p as BlockColorProps) && (
            <button
              type="button"
              onClick={() => onUpdate({ tile_bg: null, tile_accent: null, tile_text: null, tile_border: null } as any)}
              className="mt-2 text-xs text-red-400 hover:text-red-600"
            >Clear all card colors</button>
          )}
        </SectionPanelGroup>
      )}

      {mediaClipPanel}
          </>
        )}

        {editorTab === 'media' && (
          <>
      {mediaClipPanel ?? mediaClipPicker}
      {heroImageField}
      {bgImageField}
      {imageUrlField}
      {block.block_type === 'nav' && (
        <PropsCollapsible title="Logo & brand" preview={p.brand_logo ? 'Logo + name' : (p.brand as string) || 'Text only'}>
          <BlockImagePickerField
            blockId={block.id}
            label="Logo image"
            fieldKey="brand_logo"
            siteId={siteId}
            currentUrl={p.brand_logo as string | undefined}
            onUpdate={onUpdate}
          />
          {p.brand_logo && (
            <button
              type="button"
              onClick={() => onUpdate({ brand_logo: '' } as any)}
              className="text-xs text-red-500 hover:text-red-700 font-semibold"
            >
              Remove logo image
            </button>
          )}
          <p className="text-xs text-gray-400 leading-snug">
            Pick from your media gallery or upload. Brand name is edited under Content.
          </p>
          {[
            { key: 'show_logo', label: 'Show logo image', disabled: !p.brand_logo },
            { key: 'show_brand_name', label: 'Show brand name' },
          ].map(({ key, label, disabled }) => (
            <label key={key} className={cn('flex items-center gap-2', disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={(p as any)[key] !== false}
                onChange={e => onUpdate({ [key]: e.target.checked } as any)}
                className="rounded accent-primary"
              />
              <span className="text-xs text-gray-600">{label}</span>
            </label>
          ))}
        </PropsCollapsible>
      )}
          </>
        )}

        {editorTab === 'more' && (
          <>
      <PropsCollapsible title="Visibility" preview={(block as any).visible === false ? 'Hidden' : 'Visible'}>
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

        <BranchVisibilitySelector
          visibleBranches={(block as any).visible_branches ?? null}
          onChange={branches => onUpdate({ visible_branches: branches } as any)}
        />
      </PropsCollapsible>

      <BlockBreakpointStyles
        styleOverrides={readRawBlockStyleOverrides(block) as any}
        onChange={overrides => onUpdate({ style_overrides: overrides } as any)}
      />

      <PropsCollapsible title="Scroll Animation" preview={animationOptionLabel(block.animation)}>
        <ScrollAnimationControls
          variant="panel"
          animation={block.animation}
          animationDelay={block.animation_delay || 0}
          onAnimationChange={id => onUpdate({ animation: id === 'none' ? null : id } as any)}
          onDelayChange={ms => onUpdate({ animation_delay: ms } as any)}
        />
      </PropsCollapsible>
          </>
        )}
      </div>
    </div>
  )
}

// ?? Style Panel ???????????????????????????????????????????????????????????????

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

function PagePanel({
  pages,
  activePageId,
  siteStyle,
  onPageStyleChange,
  onClearPageStyle,
  onDeletePage,
  onDuplicatePage,
  onSetHomepage,
  trashedPages = [],
  trashLoading = false,
  onRestorePage,
  onRefreshTrash,
}: {
  pages: WebsitePage[]
  activePageId: string | null
  siteStyle: StyleConfig
  onPageStyleChange: (pageId: string, patch: PageStyleOverrides) => void
  onClearPageStyle: (pageId: string) => void
  onDeletePage?: (pageId: string, pageTitle: string) => void
  onDuplicatePage?: (page: WebsitePage) => void
  onSetHomepage?: (page: WebsitePage) => void
  trashedPages?: PageTrashItem[]
  trashLoading?: boolean
  onRestorePage?: (pageId: string, pageTitle: string) => void
  onRefreshTrash?: () => void | Promise<void>
}) {
  const activePage = pages.find(p => p.id === activePageId) || null
  const pageOverrides = activePageId ? (siteStyle.page_styles?.[activePageId] || {}) : {}
  const effective = activePageId ? mergePageStyleConfig(siteStyle, activePageId) : siteStyle
  const hasOverrides = Object.keys(pageOverrides).length > 0
  const persistedPageCount = countPersistedPages(pages)
  const canDelete = persistedPageCount > 1 && Boolean(activePage && isPersistedPageId(activePage.id))
  const deleteBlockedReason = persistedPageCount <= 1
    ? 'Your site needs at least one page.'
    : activePage && !isPersistedPageId(activePage.id)
      ? 'Save this page before moving it to trash.'
      : null

  const colorField = (key: keyof PageStyleOverrides, label: string, fallback: string) => (
    <div key={key} className="flex items-center gap-2">
      <input
        type="color"
        value={(pageOverrides[key] as string) || (effective[key as keyof StyleConfig] as string) || fallback}
        onChange={e => activePageId && onPageStyleChange(activePageId, { [key]: e.target.value })}
        className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-700">{label}</div>
        <div className="text-xs text-gray-400 font-mono truncate">
          {(pageOverrides[key] as string) || 'Site default'}
        </div>
      </div>
      {pageOverrides[key] != null && activePageId && (
        <button
          type="button"
          onClick={() => onPageStyleChange(activePageId, { [key]: undefined } as PageStyleOverrides)}
          className="text-[10px] text-gray-400 hover:text-red-500 shrink-0"
          title="Use site default"
        >
          Reset
        </button>
      )}
    </div>
  )

  return (
    <div className="p-4 space-y-5">
      {!activePage ? (
        <p className="text-xs text-gray-400 text-center py-6">Select a page to edit its appearance.</p>
      ) : (
        <>
          <div className="rounded-xl bg-accent/60 border border-primary/15 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-primary truncate">{activePage.title}</div>
                <div className="text-[10px] text-primary/70 mt-0.5 font-mono">/{activePage.slug}</div>
              </div>
              {activePage.is_homepage && (
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                  Homepage
                </span>
              )}
            </div>
            <div className="text-[10px] text-primary/70 mt-1">Styles below apply to this page only</div>
          </div>

          {(onDeletePage || onDuplicatePage || onSetHomepage) && (
            <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 space-y-2">
              <div className="text-xs font-bold text-gray-700">Manage page</div>
              <div className="flex flex-wrap gap-2">
                {!activePage.is_homepage && onSetHomepage && (
                  <button
                    type="button"
                    onClick={() => onSetHomepage(activePage)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm leading-none">??</span>
                    Set as homepage
                  </button>
                )}
                {onDuplicatePage && (
                  <button
                    type="button"
                    onClick={() => onDuplicatePage(activePage)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Duplicate
                  </button>
                )}
              </div>
              {onDeletePage && (
                canDelete ? (
                  <>
                    {activePage.is_homepage && (
                      <p className="text-[11px] text-gray-500 leading-snug px-1 mb-2">
                        The next page in your list will become the new homepage.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeletePage(activePage.id, activePage.title)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-red-200 bg-white text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Move to trash
                    </button>
                  </>
                ) : (
                  <p className="text-[11px] text-gray-500 leading-snug px-1">{deleteBlockedReason}</p>
                )
              )}
            </div>
          )}

          <SectionPanelGroup
            title="Page colors"
            description="Defaults for every section on this page unless a section overrides them."
          >
            <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50/60 p-2.5">
              {colorField('bg_color', 'Background', siteStyle.bg_color)}
              {colorField('surface_color', 'Surface / cards', siteStyle.surface_color)}
              {colorField('text_color', 'Text', siteStyle.text_color)}
            </div>
          </SectionPanelGroup>

          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Typography</div>
            <div className="space-y-2">
              {([
                { key: 'font_heading' as const, label: 'Heading font' },
                { key: 'font_body' as const, label: 'Body font' },
              ]).map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">{label}</label>
                  <select
                    value={(pageOverrides[key] as string) || (effective[key] as string)}
                    onChange={e => onPageStyleChange(activePage.id, { [key]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
                    style={{ fontFamily: (pageOverrides[key] as string) || (effective[key] as string) }}
                  >
                    {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                  </select>
                </div>
              ))}
              {([
                { key: 'font_size_base' as const, label: 'Body size', min: 12, max: 22, fallback: siteStyle.font_size_base || 16 },
                { key: 'font_size_heading' as const, label: 'Heading size', min: 24, max: 56, fallback: siteStyle.font_size_heading || 40 },
              ]).map(({ key, label, min, max, fallback }) => {
                const val = (pageOverrides[key] as number | undefined) ?? fallback
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={1}
                      value={val}
                      onChange={e => onPageStyleChange(activePage.id, { [key]: Number(e.target.value) })}
                      className="flex-1 accent-primary h-1"
                    />
                    <span className="text-xs text-gray-400 w-10 text-right tabular-nums">{val}px</span>
                  </div>
                )
              })}
            </div>
          </div>

          {hasOverrides && (
            <button
              type="button"
              onClick={() => onClearPageStyle(activePage.id)}
              className="w-full py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Reset page to site defaults
            </button>
          )}
        </>
      )}

      {onRestorePage && (
        <div className="pt-4 mt-2 border-t border-gray-100">
          <DeletedPagesPanel
            alwaysShow
            items={trashedPages}
            loading={trashLoading}
            onRestore={onRestorePage}
            onRefresh={onRefreshTrash}
          />
        </div>
      )}
    </div>
  )
}

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

      <div className="pt-1">
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
              {[['135deg','? Diagonal'],['to right','? Horizontal'],['to bottom','? Vertical'],['to top right','? Top-Right']].map(([v,l]) => (
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
          >? Remove gradient</button>
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

      {/* P3.9 Brand Kit ? Typography Scale */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Typography Scale</div>
        <div className="space-y-2">
          {[
            { key: 'font_family_heading', label: 'Heading Font', opts: FONTS },
            { key: 'font_family_body', label: 'Body Font', opts: FONTS },
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

// ?? Data Source Panel ?????????????????????????????????????????????????????????

const DATA_SOURCE_ICONS: Record<string, React.ElementType> = {
  products: Package,
  services: Wrench,
  testimonials: Quote,
  team: Users,
  kpis: BarChart3,
  profile: Briefcase,
  pages: Layout,
  categories: List,
  customers: Users,
  orders: ShoppingCart,
  bookings: Clock,
  media: ImageIcon,
  external_api: Plug,
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
        <p className="text-sm font-medium">Select a section on the page</p>
        <p className="text-xs mt-1">Then link it to your products, services, or other store content.</p>
      </div>
    )
  }

  // Recommended + other sources for this block type.
  const recommended = getRecommendedDataSources(block.block_type)
  const others = getOtherDataSources(block.block_type)
  const activeSource = DATA_SOURCES.find(s => s.id === normalizedDsType)
  const canPickItems = activeSource?.selectable
  const connectionRequired = BLOCK_REQUIRED_DATA_SOURCE.has(block.block_type)

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-xl border border-primary/20 bg-accent/40 px-3 py-2.5 text-[11px] text-gray-600 leading-snug">
        <strong className="font-semibold text-gray-800">Store data</strong> pulls real products, services, and reviews into this section automatically ? so your site stays up to date without re-typing everything.
      </div>
      <div className="flex items-center gap-2 mb-1">
        <Database className="w-4 h-4 text-primary/80" />
        <span className="text-xs font-bold text-gray-700">Connect to your store</span>
      </div>
      <p className="text-xs text-gray-400">Link <strong>{block.label || block.block_type}</strong> to live catalog data or an external feed.</p>

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
          {!connectionRequired && (
            <button onClick={() => onUpdate(null)} className="text-xs text-red-500 hover:text-red-700">Disconnect</button>
          )}
        </div>
      )}

      {/* Recommended sources */}
      {recommended.length > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Recommended for this section</div>
          <div className="space-y-1.5">
            {recommended.map(source => {
              const SourceIcon = DATA_SOURCE_ICONS[source.id] || Database
              return (
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
                <SourceIcon className="w-4 h-4 text-primary/80 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-700">{source.label}</div>
                  <div className="text-xs text-gray-400">{source.desc}</div>
                </div>
                {normalizedDsType === source.id && <Check className="w-3.5 h-3.5 text-primary/80" />}
              </button>
            )})}
          </div>
        </div>
      )}

      {/* All other internal sources */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Your store data</div>
        <div className="space-y-1.5">
          {others.map(source => {
            const SourceIcon = DATA_SOURCE_ICONS[source.id] || Database
            return (
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
              <SourceIcon className="w-4 h-4 text-gray-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700">{source.label}</div>
                <div className="text-xs text-gray-400">{source.desc}</div>
              </div>
              {normalizedDsType === source.id && <Check className="w-3.5 h-3.5 text-primary/80" />}
            </button>
          )})}
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
                  {item.rating != null && <div className="text-xs text-amber-500">{'?'.repeat(Math.min(5, item.rating))}</div>}
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
                <button onClick={() => setApiHeaders(prev => prev.filter((_, j) => j !== i))} className="text-red-400 px-1">?</button>
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
                    {JSON.stringify(item).slice(0, 80)}?
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

// ?? Block Design Bar (inline canvas floating toolbar) ?????????????????????????

// ?? Typography toolbar: font scale + text case (canvas bar & properties panel) ?
const FONT_SCALE_STEPS: [string, number][] = [
  ['XS', 0.75], ['S', 0.875], ['M', 1], ['L', 1.125], ['XL', 1.25], ['2X', 1.5],
]

const DESIGN_BAR_TABS = ['general', 'visual', 'media'] as const
type DesignBarTabId = (typeof DESIGN_BAR_TABS)[number]

const CANVAS_DESIGN_WIDTH: Record<DeviceMode, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 390,
}
const DEVICE_SWITCHER: { mode: DeviceMode; Icon: typeof Monitor; label: string; num: string; sizeLabel: string }[] = [
  { mode: 'desktop', Icon: Monitor, label: 'Desktop', num: '1', sizeLabel: '1440px' },
  { mode: 'tablet', Icon: Tablet, label: 'Tablet', num: '2', sizeLabel: '768px' },
  { mode: 'mobile', Icon: Smartphone, label: 'Phone', num: '3', sizeLabel: '390px phone' },
]
const CANVAS_ZOOM_MIN = 0.25
const CANVAS_ZOOM_MAX = 3
const CANVAS_ZOOM_STEP = 0.1
/** Horizontal inset on the canvas scroll area (keep 0 for edge-to-edge fit). */
const CANVAS_VIEWPORT_PAD_PX = 0

function BuilderShortcutKbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex min-h-[1rem] min-w-[1.1rem] items-center justify-center rounded border border-gray-200 bg-gray-50 px-1 text-[9px] font-mono font-semibold text-gray-500 leading-none shadow-sm',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

function BlockDesignBar({ block, onUpdate, onInsertAfter, onOpenLinkEditorForOverlay, activeTextField, activeTextFields = [], onActivateTextField, onEditText, onEscapeDismiss, onUndo, onRedo, canUndo, canRedo, formatPaintActive, formatPaintSticky, onFormatPaintStart, onFormatPaintCancel, selectedOverlayId, canvasImageField, canvasImageSlots, onSectionImagePick, onSectionImageLibrary, onFocusPrimaryImage, onSelectOverlay, blockBackgroundColor, onOverlayPickImage, onOverlayOpenLibrary, onOverlaySetImageUrl, onOverlayEditText, onOverlayEditDescription, floating = false, docked = false }: {
  block: WebsiteBlock
  onUpdate: (p: Partial<BlockProps>) => void
  onInsertAfter: (type: string) => void
  activeTextField?: string | null
  activeTextFields?: string[]
  onActivateTextField?: (fieldKey: string) => void
  onEditText?: () => void
  onEscapeDismiss?: () => void
  onOpenLinkEditorForOverlay?: (item: BlockOverlayItem, anchor: { x: number; y: number }) => void
  selectedOverlayId?: string | null
  /** Built-in section image field (image_url, bg_image_url) when clicked on canvas. */
  canvasImageField?: string | null
  /** Card / gallery slots selected ? toolbar applies to all when length > 1. */
  canvasImageSlots?: { arrayKey: string; index: number; itemField: string }[]
  onSectionImagePick?: () => void
  onSectionImageLibrary?: () => void
  onFocusPrimaryImage?: () => void
  onSelectOverlay?: (overlayId: string | null) => void
  blockBackgroundColor?: string
  onOverlayPickImage?: () => void
  onOverlayOpenLibrary?: () => void
  onOverlaySetImageUrl?: () => void
  onOverlayEditText?: () => void
  onOverlayEditDescription?: () => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  formatPaintActive?: boolean
  formatPaintSticky?: boolean
  onFormatPaintStart?: (style: FormatPaintStyle, sticky: boolean) => void
  onFormatPaintCancel?: () => void
  /** When true, bar is not absolutely positioned inside the canvas block. */
  floating?: boolean
  /** Fixed strip below the canvas toolbar (stable; does not overlap page content). */
  docked?: boolean
}) {
  const [designBarTab, setDesignBarTab] = useState<DesignBarTabId>('general')
  const [showCase, setShowCase] = useState(false)
  const [showClear, setShowClear] = useState(false)
  const [showLineSpacing, setShowLineSpacing] = useState(false)
  const [transformScope, setTransformScope] = useState<LayoutTransformScope>('section')
  const [typographyDisplayTick, setTypographyDisplayTick] = useState(0)
  const barRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const caseBtnRef = useRef<HTMLButtonElement>(null)
  const lineSpacingBtnRef = useRef<HTMLButtonElement>(null)
  const clearBtnRef = useRef<HTMLButtonElement>(null)
  const formatPaintClickTimerRef = useRef<number | null>(null)
  const p = block.props
  const blockSupportsMediaClip = sectionSupportsMediaClip(block.block_type)
  const supportsContentGroup = sectionSupportsContentGroupTransform(String(block.block_type))
  const primaryImageField = sectionPrimaryImageField(String(block.block_type), p as Record<string, unknown>)
  const fieldStyles = ((p as any)._field_styles || {}) as Record<string, Record<string, unknown>>
  const selectedEditableFields = activeTextFields.filter(k => k !== CONTENT_GROUP_FIELD_KEY)
  const multiFieldSelection = selectedEditableFields.length > 1
  const activeFieldStyle = activeTextField && activeTextField !== CONTENT_GROUP_FIELD_KEY
    ? (fieldStyles[activeTextField] || {})
    : null

  useEffect(() => {
    if (multiFieldSelection || (activeTextField && activeTextField !== CONTENT_GROUP_FIELD_KEY)) {
      setTransformScope('field')
    } else if (supportsContentGroup) setTransformScope('group')
    else setTransformScope('section')
  }, [activeTextField, multiFieldSelection, supportsContentGroup, block.id])

  useEffect(() => {
    if (!activeTextField || activeTextField === CONTENT_GROUP_FIELD_KEY) return
    let raf = 0
    const bump = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setTypographyDisplayTick(n => n + 1))
    }
    document.addEventListener('selectionchange', bump)
    const blockEl = document.querySelector(`[data-block-id="${CSS.escape(block.id)}"]`)
    blockEl?.addEventListener('builder-inline-text-commit', bump)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('selectionchange', bump)
      blockEl?.removeEventListener('builder-inline-text-commit', bump)
    }
  }, [activeTextField, block.id])

  const overlays = ((p as Record<string, unknown>).overlays as BlockOverlayItem[]) || []
  // Keep the active tab when switching sections (General / Visual / Media).
  const selectedOverlay = selectedOverlayId
    ? overlays.find(o => o.id === selectedOverlayId) ?? null
    : null

  const updateSelectedOverlay = (patch: Partial<OverlayLayerItem>) => {
    if (!selectedOverlayId) return
    onUpdate({
      overlays: overlays.map(o => (o.id === selectedOverlayId ? { ...o, ...patch } : o)),
    } as Partial<BlockProps>)
  }

  const bringSelectedOverlayFront = () => {
    if (!selectedOverlayId) return
    const maxZ = Math.max(10, ...overlays.map(o => o.zIndex || 10))
    updateSelectedOverlay({ zIndex: maxZ + 1 })
  }

  const sendSelectedOverlayBack = () => {
    if (!selectedOverlayId) return
    const minZ = Math.min(10, ...overlays.map(o => o.zIndex || 10))
    updateSelectedOverlay({ zIndex: minZ - 1 })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable
      if (isInput) return
      if (multiFieldSelection) return
      if (activeTextField && activeTextField !== CONTENT_GROUP_FIELD_KEY) return
      // Layer or section image selected on General ? arrow keys adjust, not switch tabs
      if ((selectedOverlay || canvasImageField) && designBarTab === 'general') return
      e.preventDefault()
      const idx = DESIGN_BAR_TABS.indexOf(designBarTab)
      const nextIdx = e.key === 'ArrowLeft'
        ? (idx - 1 + DESIGN_BAR_TABS.length) % DESIGN_BAR_TABS.length
        : (idx + 1) % DESIGN_BAR_TABS.length
      setDesignBarTab(DESIGN_BAR_TABS[nextIdx])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTextField, multiFieldSelection, designBarTab, selectedOverlay, canvasImageField])

  const patchSelectedFieldStyles = (patch: Record<string, unknown>, keys = selectedEditableFields) => {
    if (!keys.length) return
    const nextStyles = { ...fieldStyles }
    keys.forEach(k => {
      nextStyles[k] = { ...(fieldStyles[k] || {}), ...patch }
    })
    onUpdate({ _field_styles: nextStyles } as Partial<BlockProps>)
  }

  const transformValues = transformScope === 'section'
    ? {
        flipH: (p as any).section_flip_h,
        flipV: (p as any).section_flip_v,
        rotateDeg: (p as any).section_rotate_deg,
      }
    : transformScope === 'group'
      ? {
          flipH: (p as any).content_flip_h,
          flipV: (p as any).content_flip_v,
          rotateDeg: (p as any).content_rotate_deg,
        }
      : {
          flipH: (activeFieldStyle as any)?.flip_h,
          flipV: (activeFieldStyle as any)?.flip_v,
          rotateDeg: (activeFieldStyle as any)?.rotate_deg,
        }

  const applyTransform = (patch: { flip_h?: boolean | null; flip_v?: boolean | null; rotate_deg?: number | null }) => {
    if (transformScope === 'section') {
      onUpdate({
        ...(patch.flip_h !== undefined ? { section_flip_h: patch.flip_h } : {}),
        ...(patch.flip_v !== undefined ? { section_flip_v: patch.flip_v } : {}),
        ...(patch.rotate_deg !== undefined ? { section_rotate_deg: patch.rotate_deg } : {}),
      } as Partial<BlockProps>)
      return
    }
    if (transformScope === 'group') {
      onUpdate({
        ...(patch.flip_h !== undefined ? { content_flip_h: patch.flip_h } : {}),
        ...(patch.flip_v !== undefined ? { content_flip_v: patch.flip_v } : {}),
        ...(patch.rotate_deg !== undefined ? { content_rotate_deg: patch.rotate_deg } : {}),
      } as Partial<BlockProps>)
      onActivateTextField?.(CONTENT_GROUP_FIELD_KEY)
      return
    }
    if (!activeTextField || activeTextField === CONTENT_GROUP_FIELD_KEY) return
    if (multiFieldSelection) {
      patchSelectedFieldStyles(patch)
      return
    }
    updateTextStyle(patch)
  }

  const resetTransform = () => {
    applyTransform({ flip_h: null, flip_v: null, rotate_deg: null })
  }

  const updateTextStyle = (patch: Record<string, unknown>, opts?: { fontSizeDelta?: number }) => {
    const savedSelection = getSavedInlineTextSelection()
    const fieldKey = savedSelection?.key || activeTextField || null
    let stylePatch = { ...patch }
    const isFieldLayoutStyle =
      'text_align' in stylePatch ||
      'vertical_align' in stylePatch ||
      'text_wrap' in stylePatch ||
      'line_height_ratio' in stylePatch ||
      'paragraph_space_before_px' in stylePatch ||
      'paragraph_space_after_px' in stylePatch ||
      'field_offset_x' in stylePatch ||
      'field_offset_y' in stylePatch ||
      'flip_h' in stylePatch ||
      'flip_v' in stylePatch ||
      'rotate_deg' in stylePatch

    if (opts?.fontSizeDelta != null) {
      if (hasActiveInlineTextSelection(fieldKey)) {
        restoreSavedInlineSelection()
        const activeRange = getSavedInlineTextSelection()?.range
        const px = activeRange ? getSelectionFontSizePx(activeRange) : FONT_SIZE_PX_FALLBACK
        stylePatch = {
          ...stylePatch,
          font_size_px: Math.min(
            FONT_SIZE_PX_MAX,
            Math.max(FONT_SIZE_PX_MIN, px + opts.fontSizeDelta),
          ),
          text_scale: null,
        }
      } else if (fieldKey) {
        const styledSpan = getLastInlineStyledSpan()
        if (styledSpan && styledSpan.key === fieldKey && styledSpan.span.isConnected) {
          const px = parseFloat(window.getComputedStyle(styledSpan.span).fontSize)
          const base = px > 0 && Number.isFinite(px) ? Math.round(px) : FONT_SIZE_PX_FALLBACK
          stylePatch = {
            ...stylePatch,
            font_size_px: Math.min(
              FONT_SIZE_PX_MAX,
              Math.max(FONT_SIZE_PX_MIN, base + opts.fontSizeDelta),
            ),
            text_scale: null,
          }
        } else {
          const cur = (typographySource as any).font_size_px as number | undefined
          let base = typeof cur === 'number' && cur > 0 ? Math.round(cur) : null
          if (base == null && fieldKey) {
            base = getCanvasFieldComputedFontSizePx(block.id, fieldKey) ?? FONT_SIZE_PX_FALLBACK
          } else if (base == null) {
            base = FONT_SIZE_PX_FALLBACK
          }
          stylePatch = {
            ...stylePatch,
            font_size_px: Math.min(
              FONT_SIZE_PX_MAX,
              Math.max(FONT_SIZE_PX_MIN, base + opts.fontSizeDelta),
            ),
            text_scale: null,
          }
        }
      } else {
        const cur = (typographySource as any).font_size_px as number | undefined
        let base = typeof cur === 'number' && cur > 0 ? Math.round(cur) : null
        if (base == null) {
          base = FONT_SIZE_PX_FALLBACK
        }
        stylePatch = {
          ...stylePatch,
          font_size_px: Math.min(
            FONT_SIZE_PX_MAX,
            Math.max(FONT_SIZE_PX_MIN, base + opts.fontSizeDelta),
          ),
          text_scale: null,
        }
      }
    }

    if (fieldKey && hasActiveInlineTextSelection(fieldKey) && !isFieldLayoutStyle) {
      if (applyInlineTextSelectionStyle(fieldKey, stylePatch)) return
    }

    if (fieldKey && !isFieldLayoutStyle && applyPatchToLastStyledSpan(fieldKey, stylePatch)) return

    if (!activeTextField) {
      onUpdate(stylePatch as any)
      return
    }
    const batchKeys = !savedSelection?.key && selectedEditableFields.length > 1
      ? selectedEditableFields
      : null
    if (batchKeys) {
      if (opts?.fontSizeDelta != null) {
        const nextStyles = { ...fieldStyles }
        batchKeys.forEach(k => {
          const cur = (fieldStyles[k] as any)?.font_size_px as number | undefined
          let base = typeof cur === 'number' && cur > 0 ? Math.round(cur) : FONT_SIZE_PX_FALLBACK
          if (base === FONT_SIZE_PX_FALLBACK) {
            base = getCanvasFieldComputedFontSizePx(block.id, k) ?? FONT_SIZE_PX_FALLBACK
          }
          nextStyles[k] = {
            ...(fieldStyles[k] || {}),
            font_size_px: Math.min(
              FONT_SIZE_PX_MAX,
              Math.max(FONT_SIZE_PX_MIN, base + opts.fontSizeDelta),
            ),
            text_scale: null,
          }
        })
        onUpdate({ _field_styles: nextStyles } as Partial<BlockProps>)
        return
      }
      patchSelectedFieldStyles(stylePatch, batchKeys)
      return
    }
    onUpdate({
      _field_styles: {
        ...fieldStyles,
        [activeTextField]: {
          ...(fieldStyles[activeTextField] || {}),
          ...stylePatch,
        },
      },
    } as any)
  }

  const typographySource = activeTextField && activeTextField !== CONTENT_GROUP_FIELD_KEY
    ? { ...(p as Record<string, unknown>), ...(fieldStyles[activeTextField] || {}) }
    : activeTextField === CONTENT_GROUP_FIELD_KEY
      ? {
          field_offset_x: (p as any).content_offset_x,
          field_offset_y: (p as any).content_offset_y,
          flip_h: (p as any).content_flip_h,
          flip_v: (p as any).content_flip_v,
          rotate_deg: (p as any).content_rotate_deg,
        }
      : (p as Record<string, unknown>)

  void typographyDisplayTick
  const toolbarLiveTypography = resolveToolbarTypographyDisplay(
    block.id,
    p as Record<string, unknown>,
    activeTextField ?? null,
  )
  const toolbarFontFamily = toolbarLiveTypography.font_family
  const toolbarTypography = {
    ...typographySource,
    ...(toolbarLiveTypography.font_size_px != null
      ? { font_size_px: toolbarLiveTypography.font_size_px }
      : {}),
    ...(toolbarLiveTypography.text_color_override
      ? { text_color_override: toolbarLiveTypography.text_color_override }
      : {}),
  }

  const startFormatPaint = (sticky: boolean) => {
    if (formatPaintActive) {
      onFormatPaintCancel?.()
      return
    }

    const fieldKey = activeTextField && activeTextField !== CONTENT_GROUP_FIELD_KEY
      ? activeTextField
      : activeTextField === CONTENT_GROUP_FIELD_KEY
        ? CONTENT_GROUP_FIELD_KEY
        : null

    if (!fieldKey && !activeTextField) {
      toast.info('Click a text field on the canvas first ? headline, subtitle, or button label.')
      return
    }

    const selectionRange =
      fieldKey && fieldKey !== CONTENT_GROUP_FIELD_KEY && hasActiveInlineTextSelection(fieldKey)
        ? getSavedInlineTextSelection()?.range ?? null
        : null

    if (selectionRange && !selectionRange.collapsed) {
      const fromSelection = extractFormatPaintStyleFromRange(selectionRange)
      if (hasFormatPaintStyle(fromSelection)) {
        onFormatPaintStart?.(fromSelection, sticky)
        toast.success(
          sticky
            ? `Formatting copied (${formatPaintStyleSummary(fromSelection)}). Click text to apply.`
            : `Format copied (${formatPaintStyleSummary(fromSelection)}). Click one text field to apply.`,
        )
        return
      }
    }

    const styledAtCaret =
      fieldKey && fieldKey !== CONTENT_GROUP_FIELD_KEY
        ? getInlineStyledElementAtSelection(fieldKey)
        : null
    if (styledAtCaret) {
      const fromCaret = extractFormatPaintStyleFromElement(styledAtCaret)
      if (hasFormatPaintStyle(fromCaret)) {
        onFormatPaintStart?.(fromCaret, sticky)
        toast.success(
          sticky
            ? `Formatting copied (${formatPaintStyleSummary(fromCaret)}). Click text to apply.`
            : `Format copied (${formatPaintStyleSummary(fromCaret)}). Click one text field to apply.`,
        )
        return
      }
    }

    const lastStyledSpan = getLastInlineStyledSpan()
    if (
      fieldKey && fieldKey !== CONTENT_GROUP_FIELD_KEY
      && lastStyledSpan?.key === fieldKey
      && lastStyledSpan.span.isConnected
    ) {
      const fromSpan = extractFormatPaintStyleFromElement(lastStyledSpan.span)
      if (hasFormatPaintStyle(fromSpan)) {
        onFormatPaintStart?.(fromSpan, sticky)
        toast.success(
          sticky
            ? `Formatting copied (${formatPaintStyleSummary(fromSpan)}). Click text to apply.`
            : `Format copied (${formatPaintStyleSummary(fromSpan)}). Click one text field to apply.`,
        )
        return
      }
    }

    const computed =
      fieldKey && fieldKey !== CONTENT_GROUP_FIELD_KEY
        ? getCanvasFieldComputedFormatPaintStyle(block.id, fieldKey)
        : null

    const style = resolveFormatPaintStyle({
      blockProps: p as Record<string, unknown>,
      fieldKey,
      selectionRange,
      computed,
    })

    if (!hasFormatPaintStyle(style)) {
      toast.info('No formatting to copy ? select text or apply font, color, or alignment from the toolbar first.')
      return
    }
    onFormatPaintStart?.(style, sticky)
    toast.success(
      sticky
        ? `Formatting copied (${formatPaintStyleSummary(style)}). Click text to apply.`
        : `Format copied (${formatPaintStyleSummary(style)}). Click one text field to apply.`,
    )
  }

  useEffect(() => {
    if (!showCase && !showClear && !showLineSpacing) return
    return registerEscapeHandler(() => {
      setShowCase(false)
      setShowClear(false)
      setShowLineSpacing(false)
    })
  }, [showCase, showClear, showLineSpacing])

  useEffect(() => {
    return () => {
      if (formatPaintClickTimerRef.current) window.clearTimeout(formatPaintClickTimerRef.current)
    }
  }, [])

  // Close any open dropdown when clicking outside the bar (dropdown is portalled to body)
  useEffect(() => {
    if (!showCase && !showLineSpacing) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (barRef.current?.contains(t) || dropdownRef.current?.contains(t)) return
      setShowCase(false)
      setShowLineSpacing(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCase, showLineSpacing])

  const addOverlayElement = (
    type: string,
    anchor?: { x: number; y: number },
    initialPatch?: Partial<BlockOverlayItem>,
  ) => {
    const defaults = OVERLAY_DEFAULTS[type] || {}
    const currentOverlays: BlockOverlayItem[] = ((p as any).overlays as BlockOverlayItem[]) || []
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
      ...initialPatch,
    }
    onUpdate({ overlays: [...currentOverlays, newItem] } as any)
    onSelectOverlay?.(newId)
    if ((type === 'link' || type === 'db_link' || type === 'store') && onOpenLinkEditorForOverlay) {
      onOpenLinkEditorForOverlay(newItem, anchor || { x: window.innerWidth / 2, y: 200 })
    }
  }

  const overlayCount = ((p as any).overlays as any[] || []).length

  const runTextClipboard = (action: 'cut' | 'copy' | 'paste') => {
    if (!runCanvasTextClipboardAction(action, block.id, activeTextField ?? null)) {
      toast.info('Click a text field on the canvas first ? headline, subtitle, or button label.')
    }
  }

  const runTextClear = (action: TextClearAction) => {
    const keys = selectedEditableFields.length > 0
      ? selectedEditableFields
      : activeTextField && activeTextField !== CONTENT_GROUP_FIELD_KEY
        ? [activeTextField]
        : []
    if (!keys.length) {
      toast.info('Click a text field on the canvas first.')
      return
    }
    const result = runCanvasTextClearAction(action, block, keys)
    if (!result || Object.keys(result.propsPatch).length === 0) {
      toast.info('Nothing to clear.')
      return
    }
    onUpdate(result.propsPatch as Partial<BlockProps>)
    setShowClear(false)
    const label = TEXT_CLEAR_MENU.find(row => row.id === action)?.label ?? 'Cleared'
    toast.success(
      result.usedSelection ? `${label} on selected text` : `${label} on ${keys.length > 1 ? `${keys.length} fields` : 'text field'}`,
    )
  }

  return (
    <div className="flex flex-col shrink-0" data-block-design-bar>
      <div
        className="flex items-center gap-0.5 px-2 py-0.5 border-b border-gray-100 bg-gray-50/90"
        role="tablist"
        aria-label="Section design tools"
      >
        {([
          { id: 'general' as const, label: 'General' },
          { id: 'visual' as const, label: 'Visual' },
          { id: 'media' as const, label: 'Media' },
        ]).map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={designBarTab === tab.id}
            onClick={() => setDesignBarTab(tab.id)}
            className={cn(
              'px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors',
              designBarTab === tab.id
                ? 'bg-white text-primary border border-primary/25 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/70',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    <div
      ref={barRef}
      role="tabpanel"
      aria-label={
        designBarTab === 'general'
          ? 'General tools'
          : designBarTab === 'visual'
            ? 'Visual tools'
            : 'Media tools'
      }
      className={cn(
        'z-[80] flex min-h-[2.25rem] gap-0 overflow-x-auto overflow-y-visible bg-white px-1 py-0.5',
        'items-center',
        docked
          ? 'relative w-full border-b border-primary/20'
          : floating
            ? 'relative w-full rounded-t-lg border-t-2 border-primary border-b border-primary/30 shadow-sm'
            : 'absolute top-0 left-0 right-0 border-t-2 border-primary border-b border-primary/30 shadow-sm',
      )}
      onClick={e => e.stopPropagation()}
    >
      {designBarTab === 'general' && (
        <>
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
      {/* Edit + clipboard */}
      <div className="flex shrink-0 items-center gap-0.5">
        <div className="flex h-14 w-[3.75rem] shrink-0 gap-px">
          <button
            type="button"
            onClick={() => onEditText?.()}
            title="Edit section text (E)"
            className="flex h-full min-w-0 flex-1 items-center justify-center gap-0.5 rounded-md border border-gray-200 px-0.5 text-xs font-medium leading-none text-gray-700 transition-colors hover:border-primary/40 hover:bg-accent"
          >
            <Pencil className="h-3.5 w-3.5 shrink-0" />
            <BuilderShortcutKbd className="min-w-[0.85rem] px-0.5 text-[8px]">E</BuilderShortcutKbd>
          </button>
          <button
            type="button"
            title={
              formatPaintActive
                ? 'Copy formatting active ? click text to apply'
                : 'Format painter ? copy this text style. Click once: apply once. Double-click: apply to multiple fields.'
            }
            onMouseDown={e => {
              pinInlineTextSelectionBeforeToolbarAction()
              e.preventDefault()
            }}
            onClick={() => {
              if (formatPaintClickTimerRef.current) window.clearTimeout(formatPaintClickTimerRef.current)
              formatPaintClickTimerRef.current = window.setTimeout(() => {
                startFormatPaint(false)
                formatPaintClickTimerRef.current = null
              }, 220)
            }}
            onDoubleClick={e => {
              e.preventDefault()
              if (formatPaintClickTimerRef.current) {
                window.clearTimeout(formatPaintClickTimerRef.current)
                formatPaintClickTimerRef.current = null
              }
              startFormatPaint(true)
            }}
            className={cn(
              'flex h-full min-w-0 flex-1 items-center justify-center rounded-md border transition-colors',
              formatPaintActive
                ? formatPaintSticky
                  ? 'border-amber-400 bg-amber-100 text-amber-800 shadow-sm'
                  : 'border-primary bg-primary/15 text-primary shadow-sm'
                : 'border-gray-200 text-gray-600 hover:border-primary/40 hover:bg-accent',
            )}
          >
            <Paintbrush className={cn('h-3.5 w-3.5 shrink-0', formatPaintActive && 'text-amber-700')} />
          </button>
        </div>

        <div
          {...{ [BUILDER_DESIGN_BAR_CHROME_ATTR]: true }}
          className="flex h-14 w-7 shrink-0 flex-col divide-y divide-gray-200 overflow-hidden rounded-md border border-gray-200"
          onMouseDown={e => {
            pinInlineTextSelectionBeforeToolbarAction()
            e.preventDefault()
          }}
        >
          <button
            type="button"
            title="Cut (Ctrl+X)"
            onClick={() => runTextClipboard('cut')}
            className="flex flex-1 items-center justify-center text-gray-700 transition-colors hover:bg-accent"
          >
            <Scissors className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="Copy (Ctrl+C)"
            onClick={() => runTextClipboard('copy')}
            className="flex flex-1 items-center justify-center text-gray-700 transition-colors hover:bg-accent"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            type="button"
            title="Paste (Ctrl+V)"
            onClick={() => runTextClipboard('paste')}
            className="flex flex-1 items-center justify-center text-gray-700 transition-colors hover:bg-accent"
          >
            <ClipboardPaste className="h-3 w-3" />
          </button>
        </div>

        <div className="relative shrink-0">
          <button
            ref={clearBtnRef}
            type="button"
            title="Clear text, formatting, or links"
            onClick={() => {
              setShowClear(v => !v)
              setShowCase(false)
              setShowLineSpacing(false)
            }}
            className={cn(
              'flex h-14 w-7 flex-col items-center justify-center gap-0 rounded-md border border-gray-200 text-gray-700 transition-colors hover:bg-accent',
              showClear && 'border-primary/40 bg-primary/10 text-primary',
            )}
          >
            <Eraser className="h-3.5 w-3.5 shrink-0" />
            <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-70" />
          </button>
          <DesignBarDropdownPortal
            open={showClear}
            anchorRef={clearBtnRef}
            menuRef={dropdownRef}
            className="min-w-[240px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
              <div className="text-xs font-bold text-gray-800">Clear</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Selection, field, or multiple fields</div>
            </div>
            <div className="py-1">
              {TEXT_CLEAR_MENU.map(row => (
                <button
                  key={row.id}
                  type="button"
                  onMouseDown={e => {
                    pinInlineTextSelectionBeforeToolbarAction()
                    e.preventDefault()
                  }}
                  onClick={() => runTextClear(row.id)}
                  className={cn(
                    'flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-accent',
                    row.dividerBefore && 'border-t border-gray-100 mt-1 pt-2',
                  )}
                >
                  <Eraser className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-gray-800">
                      {row.label}
                      {row.shortcut ? (
                        <span className="ml-1 text-[10px] font-normal text-gray-400">({row.shortcut})</span>
                      ) : null}
                    </div>
                    <div className="text-[10px] leading-snug text-gray-500">{row.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </DesignBarDropdownPortal>
        </div>
      </div>

      <div className="w-px h-10 bg-gray-200 shrink-0" />

      {!selectedOverlay ? (
      <div
        {...{ [BUILDER_TYPOGRAPHY_TOOLBAR_ATTR]: true }}
        className={typographyToolbarBox}
        onMouseDown={e => {
          pinInlineTextSelectionBeforeToolbarAction()
          e.preventDefault()
        }}
      >
        <div className="flex shrink-0 items-start border-r border-gray-200">
          <div className="flex h-14 w-[6.25rem] shrink-0 flex-col">
            <FontFamilyControl
              stacked
              size="compact"
              value={toolbarFontFamily}
              onChange={font => updateTextStyle({ font_family: font })}
            />
            <FontSizePxControl
              embedded
              stacked
              size="compact"
              valuePx={(toolbarTypography as any).font_size_px as number | undefined}
              onStep={delta => updateTextStyle({}, { fontSizeDelta: delta })}
              onChange={px => {
                updateTextStyle({ text_scale: null, font_size_px: px })
              }}
            />
          </div>
          <ColorIdentPickerRow
            vertical
            size="compact"
            textColor={(toolbarTypography as any).text_color_override || '#111827'}
            backgroundColor={(p as any).bg_color_override || '#ffffff'}
            onTextColorChange={c => updateTextStyle({ text_color_override: c })}
            onBackgroundColorChange={c => onUpdate({ bg_color_override: c } as any)}
            showBackgroundPicker={false}
            trailing={
              <>
                <button
                  ref={caseBtnRef}
                  type="button"
                  title="Text case"
                  onClick={() => {
                    setShowCase(v => !v)
                    setShowLineSpacing(false)
                  }}
                  className={cn(
                    'flex h-full w-full items-center justify-center gap-0 px-0 text-[9px] font-bold leading-none transition-colors',
                    showCase || currentTextCaseMenuId(typographySource as any) !== 'default'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-white text-gray-700 hover:bg-gray-50',
                  )}
                >
                  Aa
                  <ChevronDown className="w-2 h-2 opacity-70 shrink-0" />
                </button>
                <DesignBarDropdownPortal
                  open={showCase}
                  anchorRef={caseBtnRef}
                  menuRef={dropdownRef}
                  className="min-w-[220px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl"
                >
                  <TextCaseList
                    size="compact"
                    activeId={currentTextCaseMenuId(typographySource as any)}
                    onSelect={rowId => {
                      if (activeTextField) {
                        if (rowId === 'sentence' || rowId === 'toggle') {
                          const currentVal = (p as any)[activeTextField]
                          if (typeof currentVal === 'string') {
                            onUpdate({
                              [activeTextField]: rowId === 'sentence' ? toSentenceCase(currentVal) : toToggleCase(currentVal),
                              _field_styles: {
                                ...fieldStyles,
                                [activeTextField]: { ...(fieldStyles[activeTextField] || {}), text_transform: null },
                              },
                            } as any)
                          } else {
                            updateTextStyle({ text_transform: null })
                          }
                        } else {
                          updateTextStyle(buildTextCasePropsPatch({} as Record<string, unknown>, rowId) as Record<string, unknown>)
                        }
                      } else {
                        const patch = buildTextCasePropsPatch(p as Record<string, unknown>, rowId)
                        onUpdate(patch as any)
                      }
                      setShowCase(false)
                      if (rowId === 'sentence' || rowId === 'toggle') {
                        toast.success(rowId === 'sentence' ? 'Sentence case applied to section text' : 'Toggle case applied to section text')
                      }
                    }}
                  />
                </DesignBarDropdownPortal>
              </>
            }
          />
        </div>

        <TextFieldAlignGrid
          embedded
          size="compact"
          textAlign={(typographySource as any).text_align as string | undefined}
          verticalAlign={(typographySource as any).vertical_align as string | undefined}
          textWrap={(typographySource as any).text_wrap as boolean | undefined}
          onTextAlignChange={(align: TextAlignH) => updateTextStyle({ text_align: align })}
          onVerticalAlignChange={(align: TextAlignV) => updateTextStyle({ vertical_align: align })}
          onTextWrapChange={wrap => updateTextStyle({ text_wrap: wrap })}
          wrapColumnExtra={
            <>
              <LineSpacingToolbarButton
                ref={lineSpacingBtnRef}
                stacked
                size="compact"
                lineHeightRatio={(typographySource as any).line_height_ratio as number | undefined}
                active={showLineSpacing || (typographySource as any).line_height_ratio != null}
                onClick={() => {
                  setShowLineSpacing(v => !v)
                  setShowCase(false)
                }}
              />
              <DesignBarDropdownPortal
                open={showLineSpacing}
                anchorRef={lineSpacingBtnRef}
                menuRef={dropdownRef}
              >
                <LineSpacingMenuContent
                  size="compact"
                  lineHeightRatio={(typographySource as any).line_height_ratio as number | undefined}
                  spaceBeforePx={Number((typographySource as any).paragraph_space_before_px) || 0}
                  spaceAfterPx={
                    (typographySource as any).paragraph_space_after_px != null
                      ? Number((typographySource as any).paragraph_space_after_px)
                      : null
                  }
                  onLineHeightChange={ratio => {
                    updateTextStyle({ line_height_ratio: ratio })
                    if (ratio == null) setShowLineSpacing(false)
                  }}
                  onAddSpaceBefore={() => {
                    const cur = Number((typographySource as any).paragraph_space_before_px) || 0
                    updateTextStyle({
                      paragraph_space_before_px: Math.min(PARAGRAPH_SPACE_MAX_PX, cur + PARAGRAPH_SPACE_STEP_PX),
                    })
                  }}
                  onRemoveSpaceBefore={() => {
                    const cur = Number((typographySource as any).paragraph_space_before_px) || 0
                    const next = Math.max(0, cur - PARAGRAPH_SPACE_STEP_PX)
                    updateTextStyle({ paragraph_space_before_px: next === 0 ? null : next })
                  }}
                  onAddSpaceAfter={() => {
                    const raw = (typographySource as any).paragraph_space_after_px
                    const cur = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : 0
                    updateTextStyle({
                      paragraph_space_after_px: Math.min(PARAGRAPH_SPACE_MAX_PX, cur + PARAGRAPH_SPACE_STEP_PX),
                    })
                  }}
                  onRemoveSpaceAfter={() => {
                    const raw = (typographySource as any).paragraph_space_after_px
                    const cur = raw != null && Number.isFinite(Number(raw)) ? Number(raw) : 0
                    const next = Math.max(0, cur - PARAGRAPH_SPACE_STEP_PX)
                    updateTextStyle({ paragraph_space_after_px: next === 0 ? null : next })
                  }}
                  onInsertLineBreak={() => {
                    if (!insertActiveCanvasLineBreak(block.id, activeTextField ?? null)) {
                      toast.info('Click a headline or subtitle on the canvas first, then use Insert line break ? or press Enter while typing.')
                      return
                    }
                    setShowLineSpacing(false)
                  }}
                />
              </DesignBarDropdownPortal>
            </>
          }
        />
      </div>
      ) : null}

      {selectedOverlay ? (
        <div className="flex shrink-0 flex-col self-center overflow-hidden rounded-md border border-gray-200 bg-white px-0.5 py-0.5">
          <div className="border-b border-gray-200 px-1.5 py-px text-center text-[7px] font-bold uppercase tracking-wide text-primary/80">
            Layer ? position & size
          </div>
          <OverlayTransformControls
            item={selectedOverlay}
            onUpdate={updateSelectedOverlay}
            onBringToFront={bringSelectedOverlayFront}
            onSendToBack={sendSelectedOverlayBack}
            variant="compact"
          />
        </div>
      ) : canvasImageField ? (
        <div className="flex shrink-0 flex-col self-center rounded-md border border-gray-200 bg-white px-0.5 py-0.5">
          <div className="border-b border-gray-200 px-1.5 py-px text-center text-[7px] font-bold uppercase tracking-wide text-primary/80">
            {canvasImageSlots && canvasImageSlots.length > 1
              ? `${canvasImageSlots.length} card images`
              : canvasImageSlots?.length
                ? 'Card image'
                : 'Section image'}
          </div>
          <SectionImageControls
            imageField={canvasImageField}
            arraySlots={canvasImageSlots}
            blockProps={p as Record<string, unknown>}
            blockType={String(block.block_type)}
            onUpdate={patch => onUpdate(patch as Partial<BlockProps>)}
            onPickImage={onSectionImagePick}
            onOpenLibrary={onSectionImageLibrary}
          />
        </div>
      ) : (
      <LayoutTransformPositionGroup
        scopeMode={transformScope}
        showGroup={supportsContentGroup}
        nudgeDisabled={
          transformScope === 'section'
          || (transformScope === 'group' && !supportsContentGroup)
          || (transformScope === 'field' && !activeTextField && !multiFieldSelection)
        }
        onScopeChange={mode => {
          setTransformScope(mode)
          if (mode === 'group') onActivateTextField?.(CONTENT_GROUP_FIELD_KEY)
          else if (mode === 'field' && activeTextField === CONTENT_GROUP_FIELD_KEY) {
            onActivateTextField?.('headline')
          }
        }}
        size="transformPad"
        keyboardShortcuts={transformScope !== 'section'}
        titleLabel={
          transformScope === 'group'
            ? 'All content position'
            : transformScope === 'field'
              ? 'Field position'
              : 'Position ? choose All or 1?'
        }
        offsetX={
          transformScope === 'group'
            ? readFieldOffset((p as any).content_offset_x)
            : readFieldOffset((typographySource as any).field_offset_x)
        }
        offsetY={
          transformScope === 'group'
            ? readFieldOffset((p as any).content_offset_y)
            : readFieldOffset((typographySource as any).field_offset_y)
        }
        onNudge={(dx, dy) => {
          if (transformScope === 'group') {
            const curX = readFieldOffset((p as any).content_offset_x)
            const curY = readFieldOffset((p as any).content_offset_y)
            const nextX = readFieldOffset(curX + dx)
            const nextY = readFieldOffset(curY + dy)
            onUpdate({
              content_offset_x: nextX === 0 ? null : nextX,
              content_offset_y: nextY === 0 ? null : nextY,
            } as Partial<BlockProps>)
            onActivateTextField?.(CONTENT_GROUP_FIELD_KEY)
            return
          }
          if (transformScope !== 'field') return
          if (!activeTextField || activeTextField === CONTENT_GROUP_FIELD_KEY) return
          if (multiFieldSelection) {
            const nextStyles = { ...fieldStyles }
            selectedEditableFields.forEach(k => {
              const fs = (fieldStyles[k] || {}) as Record<string, unknown>
              const curX = readFieldOffset(fs.field_offset_x)
              const curY = readFieldOffset(fs.field_offset_y)
              const nextX = readFieldOffset(curX + dx)
              const nextY = readFieldOffset(curY + dy)
              nextStyles[k] = {
                ...fs,
                field_offset_x: nextX === 0 ? null : nextX,
                field_offset_y: nextY === 0 ? null : nextY,
              }
            })
            onUpdate({ _field_styles: nextStyles } as Partial<BlockProps>)
            return
          }
          const curX = readFieldOffset((typographySource as any).field_offset_x)
          const curY = readFieldOffset((typographySource as any).field_offset_y)
          const nextX = readFieldOffset(curX + dx)
          const nextY = readFieldOffset(curY + dy)
          updateTextStyle({
            field_offset_x: nextX === 0 ? null : nextX,
            field_offset_y: nextY === 0 ? null : nextY,
          })
        }}
        onReset={() => {
          if (transformScope === 'group') {
            onUpdate({ content_offset_x: null, content_offset_y: null } as Partial<BlockProps>)
            onActivateTextField?.(CONTENT_GROUP_FIELD_KEY)
            return
          }
          if (transformScope !== 'field') return
          updateTextStyle({ field_offset_x: null, field_offset_y: null })
        }}
        flipProps={{
          flipH: transformValues.flipH,
          flipV: transformValues.flipV,
          rotateDeg: transformValues.rotateDeg,
          disabled: transformScope === 'field' && !activeTextField,
          onChange: applyTransform,
          onReset: resetTransform,
        }}
      />
      )}
      </div>

      <div className="flex shrink-0 items-center gap-1 border-l border-gray-200 pl-1">
        <span className="hidden md:inline text-[10px] text-gray-400 font-mono truncate max-w-[5rem]" title={block.label || block.block_type}>
          {block.label || block.block_type}
        </span>
        {(onUndo || onRedo) && (
          <div className="flex items-center gap-px shrink-0">
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
        )}
      </div>
        </>
      )}

      {designBarTab === 'visual' && canvasImageField && !selectedOverlay ? (
        <div className="flex shrink-0 flex-col self-center rounded-md border border-gray-200 bg-white px-0.5 py-0.5">
          <div className="border-b border-gray-200 px-1.5 py-px text-center text-[7px] font-bold uppercase tracking-wide text-primary/80">
            {canvasImageSlots && canvasImageSlots.length > 1
              ? `${canvasImageSlots.length} card images`
              : canvasImageSlots?.length
                ? 'Card image'
                : 'Section image'}
          </div>
          <SectionImageControls
            imageField={canvasImageField}
            arraySlots={canvasImageSlots}
            blockProps={p as Record<string, unknown>}
            blockType={String(block.block_type)}
            onUpdate={patch => onUpdate(patch as Partial<BlockProps>)}
            onPickImage={onSectionImagePick}
            onOpenLibrary={onSectionImageLibrary}
          />
        </div>
      ) : null}

      {designBarTab === 'visual' && (
        <VisualDesignBarTools
          blockType={String(block.block_type)}
          blockProps={p as Record<string, unknown>}
          blockAnimation={block.animation}
          blockAnimationDelay={block.animation_delay}
          blockSupportsMediaClip={blockSupportsMediaClip}
          overlayCount={overlayCount}
          selectedOverlay={selectedOverlay}
          blockBackgroundColor={blockBackgroundColor}
          onUpdate={onUpdate}
          onUpdateOverlay={selectedOverlay ? updateSelectedOverlay : undefined}
          onAddOverlay={addOverlayElement}
          onClearOverlays={() => onUpdate({ overlays: [] } as Partial<BlockProps>)}
          onOverlayPickImage={onOverlayPickImage}
          onOverlayOpenLibrary={onOverlayOpenLibrary}
          onOverlaySetImageUrl={onOverlaySetImageUrl}
          onOverlayEditLink={
            selectedOverlay && onOpenLinkEditorForOverlay
              ? () => onOpenLinkEditorForOverlay(selectedOverlay, { x: window.innerWidth / 2, y: 200 })
              : undefined
          }
          onOverlayEditText={selectedOverlay ? onOverlayEditText : undefined}
          onOverlayEditDescription={selectedOverlay ? onOverlayEditDescription : undefined}
          onOverlayBringToFront={selectedOverlay ? bringSelectedOverlayFront : undefined}
          onOverlaySendToBack={selectedOverlay ? sendSelectedOverlayBack : undefined}
        />
      )}

      {designBarTab === 'media' && (
        <MediaDesignBarTools
          blockType={String(block.block_type)}
          blockProps={p as Record<string, unknown>}
          primaryImageField={primaryImageField}
          canvasImageField={canvasImageField}
          onUpdate={onUpdate}
          onOpenMediaLibrary={onSectionImageLibrary}
          onPickImage={onSectionImagePick}
          onFocusPrimaryImage={onFocusPrimaryImage}
        />
      )}
    </div>
    </div>
  )
}

// ?? Main Builder ??????????????????????????????????????????????????????????????

const AUTO_SAVE_DELAY_MS = 2500

type AutoSaveStatus = 'synced' | 'pending' | 'saving' | 'error'

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
  const updateSite = useUpdateSite(siteId!)
  const overlayLayerUpload = useUploadMedia(siteId!)
  const { data: templates = [] } = useWebsiteTemplates()
  const { data: storesData } = useStores({ limit: 200 })
  const businessUnits = storesData?.stores ?? []
  const hasMultipleBusinessUnits = businessUnits.length > 1

  // State
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null)
  const [minimizedSectionToolbars, setMinimizedSectionToolbars] = useState<Set<string>>(() => new Set())
  const [pinnedSectionToolbars, setPinnedSectionToolbars] = useState<Set<string>>(() => new Set())
  const minimizeSectionToolbar = useCallback((blockId: string) => {
    setMinimizedSectionToolbars(prev => {
      const next = new Set(prev)
      next.add(blockId)
      return next
    })
  }, [])
  const expandSectionToolbar = useCallback((blockId: string) => {
    setMinimizedSectionToolbars(prev => {
      const next = new Set(prev)
      next.delete(blockId)
      return next
    })
  }, [])
  const unpinSectionToolbar = useCallback((blockId: string) => {
    setPinnedSectionToolbars(prev => {
      if (!prev.has(blockId)) return prev
      const next = new Set(prev)
      next.delete(blockId)
      return next
    })
  }, [])
  const togglePinSectionToolbar = useCallback((blockId: string) => {
    setPinnedSectionToolbars(prev => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      return next
    })
  }, [])
  const [activeTextTarget, setActiveTextTarget] = useState<ActiveTextTarget | null>(null)
  const [formatPaintBrush, setFormatPaintBrush] = useState<{ style: FormatPaintStyle; sticky: boolean } | null>(null)
  const applyFormatPaintTargetRef = useRef<(
    blockId: string,
    fieldKey: string | null,
    opts?: { clientX?: number; clientY?: number },
  ) => boolean>(() => false)
  const openInlineTextEditForSelectedRef = useRef<(anchorX?: number, anchorY?: number) => void>(() => {})
  const dismissBuilderUiRef = useRef<() => void>(() => {})
  const [inlineTextEdit, setInlineTextEdit] = useState<InlineTextEditSession | null>(null)
  const inlineTextEditRef = useRef<InlineTextEditSession | null>(null)
  useEffect(() => { inlineTextEditRef.current = inlineTextEdit }, [inlineTextEdit])

  useEffect(() => {
    ensureInlineTextSelectionTracking()
  }, [])

  useEffect(() => {
    const blockId = inlineTextEdit?.blockId
    if (!blockId) return
    const el = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`) as HTMLElement | null
    if (!el) return
    el.setAttribute('data-builder-inline-edit-target', 'true')
    return () => el.removeAttribute('data-builder-inline-edit-target')
  }, [inlineTextEdit?.blockId])
  const [device, setDevice] = useState<DeviceMode>('desktop')
  const [leftPanel, setLeftPanel] = useState<'blocks' | 'pages' | 'templates' | 'media' | 'settings' | 'seo'>(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('templateMode') === 'true') return 'templates'
    return 'blocks'
  })
  const [templateListSearch, setTemplateListSearch] = useState('')
  const [templatePanelSelectedId, setTemplatePanelSelectedId] = useState<string | null>(null)
  const [applyingTemplateInline, setApplyingTemplateInline] = useState(false)
  const [isApplyingToStore, setIsApplyingToStore] = useState(false)
  const [applyPopoverOpen, setApplyPopoverOpen] = useState(false)
  const [applyPickerStep, setApplyPickerStep] = useState<'root' | 'units'>('root')
  const [appliedStoreIds, setAppliedStoreIds] = useState<string[]>([])
  const applyPopoverRef = useRef<HTMLDivElement>(null)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [changeHistoryOpen, setChangeHistoryOpen] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const [deviceDropdownOpen, setDeviceDropdownOpen] = useState(false)
  const deviceDropdownRef = useRef<HTMLDivElement>(null)
  const [customDeviceWidths, setCustomDeviceWidths] = useState<Record<DeviceMode, number>>({
    desktop: CANVAS_DESIGN_WIDTH.desktop,
    tablet: CANVAS_DESIGN_WIDTH.tablet,
    mobile: CANVAS_DESIGN_WIDTH.mobile,
  })
  const [deviceWidthDraft, setDeviceWidthDraft] = useState<string | null>(null)
  // Bottom page bar: Excel-style windowing + overflow menu
  const [pageWindowStart, setPageWindowStart] = useState(0)
  const [pageMenuOpen, setPageMenuOpen] = useState(false)
  const pageOverflowRef = useRef<HTMLDivElement>(null)
  const pageTabsViewportRef = useRef<HTMLDivElement>(null)
  /** How many tabs (from pageWindowStart) actually fit on screen ? measured. */
  const [visibleTabCount, setVisibleTabCount] = useState(99)
  const [clearingTemplateSandbox, setClearingTemplateSandbox] = useState(false)
  const [resettingCanvasFromServer, setResettingCanvasFromServer] = useState(false)
  const [rightPanel, setRightPanel] = useState<'props' | 'page' | 'style' | 'data'>('props')
  const [sidebarDraggedIdx, setSidebarDraggedIdx] = useState<number | null>(null)
  const [sidebarDragOverIdx, setSidebarDragOverIdx] = useState<number | null>(null)
  const [sectionSearch, setSectionSearch] = useState('')
  const [sectionCategory, setSectionCategory] = useState('all')
  const [builderWelcomeDismissed, setBuilderWelcomeDismissed] = useState(() => readBuilderWelcomeDismissed())
  const [builderSpacingTipDismissed, setBuilderSpacingTipDismissed] = useState(() => readBuilderSpacingTipDismissed())

  const restoreBuilderCoachMarks = useCallback(() => {
    setBuilderWelcomeDismissed(false)
    setBuilderSpacingTipDismissed(false)
    setLeftPanel('blocks')
    setLeftCollapsed(false)
  }, [])
  const [sectionLayoutPicker, setSectionLayoutPicker] = useState<{
    def: BlockDef
    insertAtIdx: number
    targetBlockId?: string
    /** When set, the new section replaces this block at the same position (not append). */
    replaceBlockId?: string
    /** When true, always insert a new section ? never apply layout to an existing block of the same type. */
    insertOnly?: boolean
  } | null>(null)
  const [expandedSectionPages, setExpandedSectionPages] = useState<Set<string>>(() => new Set())
  const [sidebarDraggedPageId, setSidebarDraggedPageId] = useState<string | null>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [leftWidth, setLeftWidth] = useState(288)
  const [rightWidth, setRightWidth] = useState(288)
  const isResizingLeft = useRef(false)
  const isResizingRight = useRef(false)
  /** Avoid showing the previous site's blocks when `siteId` in the URL changes without a full remount. */
  const prevEditorSiteIdRef = useRef<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const isSavingRef = useRef(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('synced')
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [saveFlash, setSaveFlash] = useState(false)       // brief green flash on success
  const [styleDirty, setStyleDirty] = useState(false)     // unsaved style changes
  const [blocksDirty, setBlocksDirty] = useState(false)   // unsaved block props / reorder
  const blocksDirtyRef = useRef(false)   // mirror for use inside useEffect([site]) without dependency
  /** After an immediate layout save, skip server?local block hydration briefly so refetches cannot revert the canvas. */
  const skipServerHydrateRef = useRef(0)
  const styleDirtyRef = useRef(false)    // mirror for style dirty flag
  const [openingBrowserPreview, setOpeningBrowserPreview] = useState(false)
  const [trashedPages, setTrashedPages] = useState<PageTrashItem[]>([])
  const [trashLoading, setTrashLoading] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [storePopover, setStorePopover] = useState(false)
  // ?? Block-level saving indicator ???????????????????????????????????????????
  const [savingBlockId, setSavingBlockId] = useState<string | null>(null)
  /** Selected in-canvas image overlay (for AI / Media apply). */
  const [overlayImageTarget, setOverlayImageTarget] = useState<{ blockId: string; overlayId: string } | null>(null)
  const overlayImageTargetRef = useRef<{ blockId: string; overlayId: string } | null>(null)
  const skipCanvasImageClearRef = useRef(false)
  const selectedBlockIdRef = useRef<string | null>(null)
  useEffect(() => { overlayImageTargetRef.current = overlayImageTarget }, [overlayImageTarget])
  useEffect(() => { selectedBlockIdRef.current = selectedBlockId }, [selectedBlockId])
  /** Selected canvas image slot(s) ? Shift/Ctrl+click for multi (Media + design bar). */
  const [canvasImageTarget, setCanvasImageTarget] = useState<ActiveCanvasImageTarget | null>(null)
  const overlayImageUploadRef = useRef<HTMLInputElement>(null)

  // ?? Link editor (opened from CTA buttons / overlay buttons) ????????????????
  const [linkEditor, setLinkEditor] = useState<
    | null
    | {
        anchor: { x: number; y: number }
        value: LinkValue
        save: (v: LinkValue) => void
      }
  >(null)

  // ?? Context menu (right-click block / overlay) ?????????????????????????????
  const [contextMenu, setContextMenu] = useState<
    | null
    | { x: number; y: number; actions: ContextMenuAction[] }
  >(null)

  // ?? Styled text prompt (replaces all native window.prompt calls) ???????????
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
        secondaryLabel?: string
        helpText?: string
        minLength?: number
        confirmOnly?: boolean
        destructive?: boolean
        anchor?: { x: number; y: number } | null
        onSave: (v: string) => void | Promise<void>
        onSecondary?: () => void | Promise<void>
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
    secondaryLabel?: string
    helpText?: string
    minLength?: number
    confirmOnly?: boolean
    destructive?: boolean
    anchor?: { x: number; y: number } | null
    onSave: (v: string) => void | Promise<void>
    onSecondary?: () => void | Promise<void>
  }) => setTextPrompt(opts), [])

  // ?? UNDO / REDO ????????????????????????????????????????????????????????????
  const historyStack = useRef<Record<string, WebsiteBlock[]>[]>([])
  const historyIndex = useRef(-1)
  /** Timestamp for each history snapshot (parallel to historyStack). */
  const historyMeta = useRef<number[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  /** Bumped whenever history changes so the Change history panel re-renders. */
  const [historyVersion, setHistoryVersion] = useState(0)

  const pushHistory = useCallback((blocks: Record<string, WebsiteBlock[]>) => {
    // Trim forward history
    historyStack.current = historyStack.current.slice(0, historyIndex.current + 1)
    historyMeta.current = historyMeta.current.slice(0, historyIndex.current + 1)
    historyStack.current.push(JSON.parse(JSON.stringify(blocks)))
    historyMeta.current.push(Date.now())
    historyIndex.current = historyStack.current.length - 1
    setCanUndo(historyIndex.current > 0)
    setCanRedo(false)
    setHistoryVersion(v => v + 1)
  }, [])

  /** Jump the canvas to a specific history snapshot (used by Change history). */
  const restoreHistoryTo = useCallback((index: number) => {
    if (index < 0 || index >= historyStack.current.length) return
    const snapshot = historyStack.current[index]
    if (!snapshot) return
    historyIndex.current = index
    setLocalBlocks(JSON.parse(JSON.stringify(snapshot)))
    setBlocksDirty(true)
    setCanUndo(historyIndex.current > 0)
    setCanRedo(historyIndex.current < historyStack.current.length - 1)
    setHistoryVersion(v => v + 1)
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
      setHistoryVersion(v => v + 1)
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
      setHistoryVersion(v => v + 1)
    }
  }, [])
  const [localStyle, setLocalStyle] = useState<StyleConfig>(DEFAULT_STYLE)
  const [dropTarget, setDropTarget] = useState<{ idx: number; before: boolean } | null>(null)
  const [draggingBlockIdx, setDraggingBlockIdx] = useState<number | null>(null)
  const draggingBlockIdxRef = useRef<number | null>(null)
  const canvasMainRef = useRef<HTMLElement | null>(null)

  const scrollCanvasToBlock = useCallback((blockId: string) => {
    requestAnimationFrame(() => {
      const root = canvasMainRef.current
      const el = builderPageRootRef.current?.querySelector(
        `[data-block-id="${CSS.escape(blockId)}"]`,
      ) as HTMLElement | null
      if (!root || !el) {
        document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      const rootRect = root.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const elCenterY = elRect.top + elRect.height / 2 - rootRect.top + root.scrollTop
      root.scrollTo({ top: Math.max(0, elCenterY - root.clientHeight / 2), behavior: 'smooth' })
    })
  }, [])

  /** After reorder, scroll the canvas so the block stays at the same screen Y (toolbar under cursor). */
  const compensateCanvasScrollForBlockMove = useCallback((blockId: string, anchorTop: number) => {
    const adjust = () => {
      const root = canvasMainRef.current
      const el = builderPageRootRef.current?.querySelector(
        `[data-block-id="${CSS.escape(blockId)}"]`,
      ) as HTMLElement | null
      if (!root || !el) return
      const delta = el.getBoundingClientRect().top - anchorTop
      if (Math.abs(delta) > 0.5) root.scrollTop += delta
    }
    requestAnimationFrame(() => requestAnimationFrame(adjust))
  }, [])

  const layoutThemeFallback = useCallback(() => ({
    text_color: localStyle.text_color || '#111827',
    bg_color: localStyle.bg_color || '#ffffff',
    surface_color: localStyle.surface_color || '#f9fafb',
    primary_color: localStyle.primary_color || '#64C3A0',
  }), [localStyle])

  const canvasViewportRef = useRef<HTMLDivElement | null>(null)
  const canvasPreviewInnerRef = useRef<HTMLDivElement | null>(null)
  const builderPageRootRef = useRef<HTMLDivElement | null>(null)
  const dragAutoScrollRafRef = useRef<number | null>(null)
  const dragPointerYRef = useRef(0)
  const [draggingNewBlock, setDraggingNewBlock] = useState<BlockDef | null>(null)

  const CANVAS_SCROLL_EDGE = 80
  const CANVAS_SCROLL_MAX_STEP = 18

  const autoScrollCanvasForDrag = useCallback((clientY: number) => {
    const el = canvasMainRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (clientY < rect.top + CANVAS_SCROLL_EDGE) {
      const intensity = (rect.top + CANVAS_SCROLL_EDGE - clientY) / CANVAS_SCROLL_EDGE
      el.scrollTop -= Math.ceil(CANVAS_SCROLL_MAX_STEP * (0.5 + intensity))
    } else if (clientY > rect.bottom - CANVAS_SCROLL_EDGE) {
      const intensity = (clientY - (rect.bottom - CANVAS_SCROLL_EDGE)) / CANVAS_SCROLL_EDGE
      el.scrollTop += Math.ceil(CANVAS_SCROLL_MAX_STEP * (0.5 + intensity))
    }
  }, [])

  const stopDragAutoScroll = useCallback(() => {
    if (dragAutoScrollRafRef.current !== null) {
      cancelAnimationFrame(dragAutoScrollRafRef.current)
      dragAutoScrollRafRef.current = null
    }
  }, [])

  // ?? LOCAL BLOCK STATE (optimistic, real-time) ?????????????????????????????
  // Keyed by pageId ? array of blocks. Updated immediately on every action.
  const [localBlocks, setLocalBlocks] = useState<Record<string, WebsiteBlock[]>>({})
  // Keep ref in sync so callbacks that close over it always see the latest state.
  useEffect(() => {
    localBlocksRef.current = localBlocks
  }, [localBlocks])
  useEffect(() => { blocksDirtyRef.current = blocksDirty }, [blocksDirty])
  useEffect(() => { styleDirtyRef.current = styleDirty }, [styleDirty])

  /** Apply block map to canvas + ref immediately; optionally mirror into React Query site cache. */
  const commitLocalBlocks = useCallback((
    next: Record<string, WebsiteBlock[]>,
    opts?: { syncQuery?: boolean },
  ) => {
    localBlocksRef.current = next
    setLocalBlocks(next)
    if (opts?.syncQuery !== false && siteId && site) {
      queryClient.setQueryData<WebsiteSite>(['websites', siteId], old =>
        old ? syncSiteQueryBlocks(old, next) : old,
      )
    }
  }, [siteId, site, queryClient])

  useEffect(() => {
    if (!siteId) {
      setAppliedStoreIds([])
      return
    }
    try {
      const raw = localStorage.getItem(`wb-applied-stores-${siteId}`)
      const parsed = raw ? JSON.parse(raw) : []
      setAppliedStoreIds(Array.isArray(parsed) ? parsed.filter((x: unknown) => typeof x === 'string') : [])
    } catch {
      setAppliedStoreIds([])
    }
  }, [siteId])

  useEffect(() => {
    if (!applyPopoverOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (applyPopoverRef.current?.contains(e.target as Node)) return
      setApplyPopoverOpen(false)
      setApplyPickerStep('root')
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [applyPopoverOpen])

  useEffect(() => {
    if (!moreMenuOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (moreMenuRef.current?.contains(e.target as Node)) return
      setMoreMenuOpen(false)
      setChangeHistoryOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [moreMenuOpen])

  useEffect(() => {
    if (!deviceDropdownOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (deviceDropdownRef.current?.contains(e.target as Node)) return
      setDeviceDropdownOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [deviceDropdownOpen])


  useEffect(() => {
    if (!pageMenuOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      if (pageOverflowRef.current?.contains(e.target as Node)) return
      setPageMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [pageMenuOpen])

  // Track pages locally too (for adds/deletes without refresh)
  const [localPages, setLocalPages] = useState<WebsitePage[]>([])
  const localPagesRef = useRef<WebsitePage[]>([])
  useEffect(() => {
    localPagesRef.current = localPages
  }, [localPages])

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
    historyMeta.current = []
    historyIndex.current = -1
    setCanUndo(false)
    setCanRedo(false)
    setHistoryVersion(v => v + 1)
    setLocalStyle({ ...DEFAULT_STYLE })
  }, [siteId])

  const invalidateSite = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['websites', siteId] })
  }, [queryClient, siteId])

  const hydrateEditorFromSite = useCallback((nextSite: WebsiteSite) => {
    navSyncBootRef.current = true
    pagesNavKeyRef.current = pagesNavKey(nextSite.pages)
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    setAutoSaveStatus('synced')
    setLocalStyle({ ...DEFAULT_STYLE, ...(nextSite.style_config as any) })
    setLocalPages(normalizeSitePages(nextSite.pages))
    const nextBlocks: Record<string, WebsiteBlock[]> = {}
    nextSite.pages.forEach(page => {
      nextBlocks[page.id] = page.blocks.slice().sort((a, b) => a.sort_order - b.sort_order)
    })
    const normalized = normalizeAllStructureBlocks(nextBlocks, nextSite.pages)
    setLocalBlocks(syncNavLinksInBlockMap(normalized, nextSite.pages))
    const homepage = nextSite.pages.find(p => p.is_homepage) || nextSite.pages[0]
    setActivePageId(homepage?.id ?? null)
    setSelectedBlockId(null)
    setActiveTextTarget(null)
    setStyleDirty(false)
    setBlocksDirty(false)
    blocksDirtyRef.current = false
    styleDirtyRef.current = false
    historyStack.current = [JSON.parse(JSON.stringify(syncNavLinksInBlockMap(normalized, nextSite.pages)))]
    historyMeta.current = [Date.now()]
    historyIndex.current = 0
    setHistoryVersion(v => v + 1)
    setCanUndo(false)
    setCanRedo(false)
  }, [])

  /** After trash/restore ? refresh pages + blocks without wiping undo history. */
  const syncEditorPagesFromSite = useCallback((fresh: WebsiteSite, focusPageId?: string | null) => {
    const normalized = normalizeSitePages(fresh.pages)
    localPagesRef.current = normalized
    setLocalPages(normalized)
    const nextBlocks: Record<string, WebsiteBlock[]> = {}
    normalized.forEach(page => {
      nextBlocks[page.id] = (page.blocks || []).slice().sort((a, b) => a.sort_order - b.sort_order)
    })
    const synced = syncNavLinksInBlockMap(normalizeAllStructureBlocks(nextBlocks, normalized), normalized)
    localBlocksRef.current = synced
    setLocalBlocks(synced)
    queryClient.setQueryData<WebsiteSite>(['websites', siteId!], { ...fresh, pages: normalized })
    const nextActive = focusPageId && normalized.some(p => p.id === focusPageId)
      ? focusPageId
      : normalized.find(p => p.is_homepage)?.id ?? normalized[0]?.id ?? null
    setActivePageId(nextActive)
    setSelectedBlockId(null)
    return normalized
  }, [queryClient, siteId])

  /** Load a template onto the canvas ? no publish, user edits first then clicks Apply in toolbar. */
  const handleApplySelectedTemplate = useCallback(async (templateId: string) => {
    if (!siteId) return
    setApplyingTemplateInline(true)
    try {
      const next = await websiteApi.applyTemplate(siteId, templateId)
      queryClient.setQueryData(['websites', siteId], next)
      // Must hydrate locally ? site sync effect skips blocks when blocksDirty is true,
      // but pages still update, which leaves the canvas empty (0 blocks) with new tabs.
      hydrateEditorFromSite(next)
      setStyleDirty(false)
      setBlocksDirty(false)
      blocksDirtyRef.current = false
      styleDirtyRef.current = false
      await queryClient.invalidateQueries({ queryKey: ['websites'], exact: true })
      const blockCount = next.pages.reduce((n, p) => n + (p.blocks?.length ?? 0), 0)
      toast.success(
        blockCount > 0
          ? `Template loaded (${blockCount} blocks) ? edit then Apply to go live.`
          : 'Template loaded (pages only) ? add blocks from the left panel.',
      )
      setTemplatePanelSelectedId(templateId)
    } catch {
      toast.error('Failed to load template')
      setTemplatePanelSelectedId(null)
    } finally {
      setApplyingTemplateInline(false)
    }
  }, [siteId, queryClient, hydrateEditorFromSite])

  // handleApplyToStore is defined after handleSaveCanvas ? see below

  const handleClearTemplateSandbox = useCallback(async () => {
    if (!siteId || !isTemplateMode) return
    openTextPrompt({
      title: 'Clear template sandbox?',
      subtitle: 'All pages and sections in this template workspace will be removed. This cannot be undone.',
      confirmLabel: 'Clear all',
      confirmOnly: true,
      destructive: true,
      onSave: async () => {
        setClearingTemplateSandbox(true)
        setTemplatePanelSelectedId(null)
        try {
          const next = await websiteApi.ensureBlankSite(siteId)
          queryClient.setQueryData(['websites', siteId], next)
          hydrateEditorFromSite(next)
          setStyleDirty(false)
          setBlocksDirty(false)
          blocksDirtyRef.current = false
          styleDirtyRef.current = false
          await queryClient.invalidateQueries({ queryKey: ['websites'], exact: true })
          toast.success('Cleared ? blank site')
        } catch {
          toast.error('Could not clear site')
        } finally {
          setClearingTemplateSandbox(false)
        }
      },
    })
  }, [siteId, isTemplateMode, queryClient, hydrateEditorFromSite, openTextPrompt])

  const handleCopyTemplateSaveAs = useCallback(() => {
    if (!siteId) return
    const existingNames = (queryClient.getQueryData<SiteListItem[]>(['websites']) ?? []).map(s => s.name)
    const defaultName = suggestSiteCopyName(site?.name?.trim() || 'Site', existingNames)
    openTextPrompt({
      title: 'Copy template / Save As',
      subtitle: 'Save a copy of this site as a new website. It will appear in your Website Builder list.',
      placeholder: 'Website name',
      initialValue: defaultName,
      confirmLabel: 'Save copy',
      minLength: 1,
      onSave: async (name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        const finalName = resolveUniqueSiteName(trimmed, existingNames)
        try {
          const payload = buildLocalSiteExport(site, localPages, localBlocks, localStyle)
          const newSite = await websiteApi.importSite({
            ...payload,
            site: { ...payload.site, name: finalName },
          })
          queryClient.setQueryData(['websites', newSite.id], newSite)
          await queryClient.invalidateQueries({ queryKey: ['websites'], exact: true })
          if (finalName !== trimmed) {
            toast.success(`Name already in use — saved as "${finalName}"`)
          } else {
            toast.success(`"${finalName}" saved — find it in Website Builder`)
          }
          navigate('/websites')
        } catch {
          toast.error('Could not save template copy')
        }
      },
    })
  }, [siteId, site, localPages, localBlocks, localStyle, openTextPrompt, queryClient, navigate])

  const handleResetCanvasFromServer = useCallback(() => {
    if (!siteId) return
    openTextPrompt({
      title: 'Reset canvas?',
      subtitle: 'Unsaved canvas and style changes will be lost. This reloads the last saved version from the server.',
      confirmLabel: 'Reset to server',
      secondaryLabel: 'Restore a version',
      confirmOnly: true,
      destructive: true,
      onSecondary: async () => {
        setMoreMenuOpen(true)
        setChangeHistoryOpen(true)
      },
      onSave: async () => {
        setResettingCanvasFromServer(true)
        try {
          const fresh = await websiteApi.getSite(siteId)
          queryClient.setQueryData(['websites', siteId], fresh)
          hydrateEditorFromSite(fresh)
          setStyleDirty(false)
          setBlocksDirty(false)
          blocksDirtyRef.current = false
          styleDirtyRef.current = false
          toast.success('Canvas reset to last saved version')
        } catch {
          toast.error('Could not reload site')
        } finally {
          setResettingCanvasFromServer(false)
        }
      },
    })
  }, [siteId, queryClient, hydrateEditorFromSite, openTextPrompt])

  // Sync from server ? local. After AI/template replace, page IDs change; drop stale keys and fix active tab.
  // Guard: skip overwriting localBlocks/localStyle when the user has unsaved edits ? a background
  // refetch (e.g. on window-focus) must not silently discard in-flight changes.
  // Exception: when server page IDs no longer match local keys (template/AI replace), always resync blocks.
  useEffect(() => {
    if (site) {
      const serverPageIds = new Set(site.pages.map(p => p.id))
      const localPageIds = new Set(Object.keys(localBlocksRef.current))
      const pageStructureReplaced =
        serverPageIds.size !== localPageIds.size
        || [...serverPageIds].some(id => !localPageIds.has(id))

      if (!styleDirtyRef.current || pageStructureReplaced) {
        setLocalStyle({ ...DEFAULT_STYLE, ...(site.style_config as any) })
        if (pageStructureReplaced) setStyleDirty(false)
      }
      // Merge server pages with local-only pages (e.g. just created) so refetches cannot drop tabs.
      setLocalPages(prev => {
        if (pageStructureReplaced) {
          const merged = normalizeSitePages(
            [...site.pages].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
          )
          localPagesRef.current = merged
          return merged
        }
        const mergedMap = new Map<string, WebsitePage>()
        for (const p of site.pages) mergedMap.set(p.id, p)
        for (const p of prev) {
          if (!mergedMap.has(p.id) && p.id.startsWith('temp-')) mergedMap.set(p.id, p)
        }
        const merged = normalizeSitePages([...mergedMap.values()].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)))
        localPagesRef.current = merged
        return merged
      })
      const skipHydrate = skipServerHydrateRef.current > 0
        && Date.now() - skipServerHydrateRef.current < SKIP_SERVER_HYDRATE_MS
      const shouldHydrateBlocks = !skipHydrate && (!blocksDirtyRef.current || pageStructureReplaced)
      if (shouldHydrateBlocks) {
        navSyncBootRef.current = true
        pagesNavKeyRef.current = pagesNavKey(site.pages)
        setLocalBlocks(() => {
          const next: Record<string, WebsiteBlock[]> = {}
          site.pages.forEach(page => {
            const serverBlocks = page.blocks.slice().sort((a, b) => a.sort_order - b.sort_order)
            next[page.id] = serverBlocks
          })
          const normalized = normalizeAllStructureBlocks(next, site.pages)
          return syncNavLinksInBlockMap(normalized, site.pages)
        })
      }
      if (pageStructureReplaced) {
        setBlocksDirty(false)
        blocksDirtyRef.current = false
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current)
          autoSaveTimerRef.current = null
        }
        setAutoSaveStatus('synced')
        historyStack.current = [
          JSON.parse(JSON.stringify(
            syncNavLinksInBlockMap(
              normalizeAllStructureBlocks(
                Object.fromEntries(
                  site.pages.map(page => [
                    page.id,
                    page.blocks.slice().sort((a, b) => a.sort_order - b.sort_order),
                  ]),
                ),
                site.pages,
              ),
              site.pages,
            ),
          )),
        ]
        historyMeta.current = [Date.now()]
        historyIndex.current = 0
        setCanUndo(false)
        setCanRedo(false)
        setHistoryVersion(v => v + 1)
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

  // ?? PANEL RESIZE HANDLERS ??????????????????????????????????????????????????
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

  // ?? KEYBOARD SHORTCUTS ?????????????????????????????????????????????????????
  // Use a stable ref so the keydown listener doesn't need to re-register every
  // render and never hits the temporal dead-zone of handlers defined later.
  const kbHandlersRef = useRef({
    handleUndo,
    handleRedo,
    handleDeleteBlock: (_id: string) => {},
    confirmDeleteBlock: (_id: string, _opts?: { pageId?: string }) => {},
    handleDuplicateBlock: (_id: string) => {},
    handleMoveBlock: (_id: string, _dir: 'up' | 'down' | 'top' | 'bottom') => {},
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable
      if (isInput) return

      const { handleDuplicateBlock: dup, handleMoveBlock: move } = kbHandlersRef.current
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.key === 'k') { e.preventDefault(); setCommandPaletteOpen(v => !v); return }
      if (ctrl && e.key === 'z') { e.preventDefault(); handleUndo(); return }
      if (ctrl && (e.key === 'y' || e.key === 'Z')) { e.preventDefault(); handleRedo(); return }
      if (ctrl && e.key === 'd') {
        e.preventDefault()
        if (selectedBlockId) dup(selectedBlockId)
        return
      }
      if ((e.key === 'e' || e.key === 'E') && !ctrl && selectedBlockId) {
        e.preventDefault()
        openInlineTextEditForSelectedRef.current()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId) {
        e.preventDefault()
        kbHandlersRef.current.confirmDeleteBlock(selectedBlockId)
        return
      }
      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
      if (arrowKeys.includes(e.key) && selectedBlockId && activePageId) {
        const pageBlocks = localBlocks[activePageId] || []
        const selBlock = pageBlocks.find(b => b.id === selectedBlockId)
        const heroPosition = selBlock && /^hero(_split|_minimal)?$/.test(String(selBlock.block_type))
        const fieldPosition = activeTextTarget?.blockId === selectedBlockId
          && editableFieldKeys(activeTextTarget).length > 0
        if (heroPosition || fieldPosition) {
          // FieldPositionNudge listens in capture phase ? skip section reorder.
          return
        }
      }
      if (e.key === 'ArrowUp' && selectedBlockId && activePageId) {
        e.preventDefault()
        move(selectedBlockId, 'up')
        return
      }
      if (e.key === 'ArrowDown' && selectedBlockId && activePageId) {
        e.preventDefault()
        move(selectedBlockId, 'down')
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlockId, activePageId, localBlocks, handleUndo, handleRedo, activeTextTarget])

  const activePage = useMemo(() =>
    localPages.find(p => p.id === activePageId) || null
  , [localPages, activePageId])

  const canvasStyle = useMemo(
    () => mergePageStyleConfig(localStyle, activePageId),
    [localStyle, activePageId],
  )

  const builderPublicSite = useMemo(() => {
    if (!site) return null
    return buildBuilderPublicSite(site, localPages, localBlocks, localStyle)
  }, [site, localPages, localBlocks, localStyle])

  const builderVendorSlug = myVendor?.slug?.trim() || site?.subdomain?.trim() || ''

  const openCatalogPreviewFromBuilder = useCallback(async (url: string) => {
    if (!siteId || !site) return
    let previewToken = recallDraftPreviewToken()
    if (!previewToken) {
      clearPendingPreviewTabNavigate()
      clearPendingPreviewTabError()
      prepareDraftPreviewTab()
      try {
        const payload = buildPublicSitePayloadFromLocal(site, localPages, localBlocks, localStyle)
        const { preview_token } = await websiteApi.createBuilderPreview(siteId, {
          payload,
          label: 'Preview',
        })
        rememberDraftPreviewSession(siteId, preview_token)
        previewToken = preview_token
      } catch (err) {
        toast.error(extractApiError(err, 'Could not open preview'))
        broadcastPreviewTabError(extractApiError(err, 'Preview failed'))
        return
      }
    }
    const pageSlug = activePage?.slug
    const catalogPreviewUrl = buildDraftPreviewCatalogUrl(previewToken, url, pageSlug)
    if (!catalogPreviewUrl) return
    const delivered = navigateDraftPreviewTab(catalogPreviewUrl)
    if (delivered) {
      toast.success('Product / service detail opened in preview')
    } else {
      window.open(catalogPreviewUrl, '_blank', 'noopener,noreferrer')
      toast.success('Preview opened in a new tab')
    }
  }, [siteId, site, localPages, localBlocks, localStyle, activePage?.slug])

  const handleNavigateBuilderPage = useCallback((url: string) => {
    const raw = (url || '/').trim()
    const pathOnly = raw.split('?')[0].split('#')[0]
    const normalized = pathOnly.startsWith('/') ? raw : `/${raw}`

    if (parseStorefrontEmbedRoute(normalized) || parseCatalogStorePath(pathOnly)) {
      void openCatalogPreviewFromBuilder(normalized)
      return
    }

    const cleanUrl = pathOnly
    const slug = cleanUrl === '/' ? '' : cleanUrl.replace(/^\/+|\/+$/g, '')
    const target = localPages.find(p => (
      (p.is_homepage && (cleanUrl === '/' || slug === 'home')) ||
      p.slug.replace(/^\/+|\/+$/g, '') === slug
    ))
    if (target) {
      setActivePageId(target.id)
      setSelectedBlockId(null)
    } else {
      toast.info(`No builder page found for "${pathOnly}". Add it from the Pages panel or update the nav link.`)
    }
  }, [localPages, openCatalogPreviewFromBuilder])

  const handleCanvasTextFieldActivate = useCallback((
    blockId: string,
    fieldKey: string,
    opts?: { additive?: boolean; clientX?: number; clientY?: number },
  ) => {
    if (formatPaintBrush && applyFormatPaintTargetRef.current(blockId, fieldKey, opts)) return
    setSelectedBlockId(blockId)
    setOverlayImageTarget(null)
    setCanvasImageTarget(null)
    setActiveTextTarget(prev => toggleTextFieldInTarget(prev, blockId, fieldKey, opts?.additive ?? false))
    setRightPanel('props')
    setRightCollapsed(false)
  }, [formatPaintBrush])

  const handleCanvasBlockSelectCapture = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const fieldKey = resolveCanvasFieldKeyFromTarget(e.target)
    const isFieldClick = isCanvasFieldClickTarget(e.target)

    if (target.closest('[data-overlay-root],[data-overlay-toolbar],[data-builder-section-image],[data-builder-section-toolbar],[data-section-padding-handle],[data-section-min-height-handle]')) return
    if (target.closest('[contenteditable="true"], [data-builder-inline-edit-target="true"]')) return

    const blockRoot = target.closest('[data-block-id]') as HTMLElement | null
    if (!blockRoot) return
    const id = blockRoot.getAttribute('data-block-id')
    if (!id) return

    if (formatPaintBrush) {
      if (isFieldClick || fieldKey) {
        e.preventDefault()
        e.stopPropagation()
        applyFormatPaintTargetRef.current(id, fieldKey, { clientX: e.clientX, clientY: e.clientY })
        return
      }
    }

    if (isFieldClick) {
      const additive = e.shiftKey || e.metaKey || e.ctrlKey
      // First click selects the whole section (so the padding handles show); only
      // drill into the text field once its section is already selected. This keeps
      // a single click on a section consistent with the Escape hierarchy
      // (text target -> section). Additive (shift/?/ctrl) clicks still drill in so
      // multi-field selection keeps working.
      if (selectedBlockId === id || additive) return
      e.preventDefault()
      e.stopPropagation()
      setSelectedBlockId(id)
      setOverlayImageTarget(null)
      setCanvasImageTarget(null)
      setActiveTextTarget(null)
      setRightPanel('props')
      setRightCollapsed(false)
      return
    }

    if ((e.target as HTMLElement).closest('a, button, input, textarea, select, label, [role="button"]')) return

    setSelectedBlockId(id)
    setOverlayImageTarget(null)
    setCanvasImageTarget(null)
    setActiveTextTarget(null)
    setRightPanel('props')
    setRightCollapsed(false)
  }, [formatPaintBrush, selectedBlockId])

  const handleCanvasBlockHover = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const overlay = target.closest('[data-builder-overlay]') as HTMLElement | null
    if (overlay) {
      const oid = overlay.getAttribute('data-builder-overlay')
      setHoveredBlockId(prev => (prev === oid ? prev : oid))
      return
    }
    const blockRoot = target.closest('[data-block-id]') as HTMLElement | null
    const id = blockRoot?.getAttribute('data-block-id') || null
    setHoveredBlockId(prev => (prev === id ? prev : id))
  }, [])

  const handleCanvasBlockHoverLeave = useCallback(() => {
    setHoveredBlockId(null)
  }, [])

  const handleCanvasNavClickCapture = useCallback((e: React.MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
    if (!anchor || !canvasPreviewInnerRef.current?.contains(anchor)) return
    const href = anchor.getAttribute('href')
    if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return
    e.preventDefault()
    e.stopPropagation()
    handleNavigateBuilderPage(href)
  }, [handleNavigateBuilderPage])

  const handlePageStyleChange = useCallback((pageId: string, patch: PageStyleOverrides) => {
    setLocalStyle(prev => {
      const current = { ...(prev.page_styles?.[pageId] || {}) }
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === '') delete (current as Record<string, unknown>)[k]
        else (current as Record<string, unknown>)[k] = v
      }
      const page_styles = { ...(prev.page_styles || {}) }
      if (Object.keys(current).length === 0) delete page_styles[pageId]
      else page_styles[pageId] = current
      return { ...prev, page_styles }
    })
    setStyleDirty(true)
  }, [])

  const handleClearPageStyle = useCallback((pageId: string) => {
    setLocalStyle(prev => {
      if (!prev.page_styles?.[pageId]) return prev
      const page_styles = { ...prev.page_styles }
      delete page_styles[pageId]
      return { ...prev, page_styles }
    })
    setStyleDirty(true)
    toast.success('Page styles reset to site defaults')
  }, [])

  const activeBlocks = useMemo(() =>
    sortPageBlocks(localBlocks[activePageId || ''] || [])
  , [localBlocks, activePageId])

  const canvasBlocksRevision = useMemo(
    () => activeBlocks.map((b, i) => `${i}:${b.sort_order}:${b.id}:${b.updated_at}:${structureLayoutFingerprint(b.props as Record<string, unknown>)}`).join('|'),
    [activeBlocks],
  )

  const sectionSearchLower = sectionSearch.trim().toLowerCase()

  const sortedSitePages = useMemo(
    () => [...localPages].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [localPages],
  )

  // Keep the bottom page-bar window valid as pages are added/removed.
  useEffect(() => {
    setPageWindowStart(prev => Math.min(prev, Math.max(0, sortedSitePages.length - 1)))
  }, [sortedSitePages.length])

  // Measure how many page tabs fit so the "?" menu only lists what's off-screen.
  useLayoutEffect(() => {
    const el = pageTabsViewportRef.current
    if (!el) return
    const measure = () => {
      const tabs = Array.from(el.children) as HTMLElement[]
      if (tabs.length === 0) {
        setVisibleTabCount(0)
        return
      }
      const right = el.getBoundingClientRect().right
      let count = 0
      for (const tab of tabs) {
        if (tab.getBoundingClientRect().right <= right + 1) count += 1
        else break
      }
      setVisibleTabCount(Math.max(1, count))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [sortedSitePages, pageWindowStart, leftWidth, rightWidth, leftCollapsed, rightCollapsed])

  const pageSectionGroups = useMemo(() => (
    sortedSitePages.map(page => {
      const blocks = (localBlocks[page.id] || []).slice().sort((a, b) => a.sort_order - b.sort_order)
      const entries = blocks.map((block, idx) => ({ block, idx }))
      return { page, entries, totalBlocks: blocks.length }
    })
  ), [sortedSitePages, localBlocks])

  const filteredCatalogBlocks = useMemo(() => {
    let list = BLOCK_CATALOG
    if (sectionCategory !== 'all') list = list.filter(b => b.category === sectionCategory)
    if (sectionSearchLower) {
      list = list.filter(b =>
        b.label.toLowerCase().includes(sectionSearchLower)
        || b.desc.toLowerCase().includes(sectionSearchLower),
      )
    }
    return list
  }, [sectionCategory, sectionSearchLower])

  const selectedBlock = useMemo(() => {
    if (!selectedBlockId) return null
    for (const pageId of Object.keys(localBlocks)) {
      const found = localBlocks[pageId]?.find(b => b.id === selectedBlockId)
      if (found) return found
    }
    return null
  }, [localBlocks, selectedBlockId])

  useEffect(() => {
    if (!activePageId) return
    setExpandedSectionPages(prev => {
      if (prev.has(activePageId)) return prev
      return new Set([...prev, activePageId])
    })
  }, [activePageId])

  const navSyncBootRef = useRef(true)
  const pagesNavKeyRef = useRef('')
  useEffect(() => {
    navSyncBootRef.current = true
    pagesNavKeyRef.current = ''
  }, [siteId])

  useEffect(() => {
    if (!sortedSitePages.length) return
    const navKey = pagesNavKey(sortedSitePages)
    const pagesChanged = navKey !== pagesNavKeyRef.current
    pagesNavKeyRef.current = navKey
    setLocalBlocks(prev => {
      const next = syncNavLinksInBlockMap(prev, sortedSitePages)
      if (next !== prev && pagesChanged && !navSyncBootRef.current) {
        setBlocksDirty(true)
        blocksDirtyRef.current = true
      }
      return next
    })
    navSyncBootRef.current = false
  }, [sortedSitePages])

  useEffect(() => {
    setOverlayImageTarget(null)
  }, [selectedBlockId])

  const applyToImageLayer = useMemo(() => {
    if (!selectedBlock || !overlayImageTarget || overlayImageTarget.blockId !== selectedBlock.id) return false
    const overlays = ((selectedBlock.props as any).overlays as BlockOverlayItem[]) || []
    return !!overlays.find(o => o.id === overlayImageTarget.overlayId && o.type === 'image')
  }, [selectedBlock, overlayImageTarget])

  const mediaApplyTargetDescription = useMemo(() => {
    if (!selectedBlockId || !selectedBlock) return null
    if (applyToImageLayer) return 'image layer on canvas'
    if (canvasImageTarget?.blockId === selectedBlockId) {
      const slots = canvasImageTarget.slots
      if (slots.length > 1) return `${slots.length} selected photos`
      const slot = slots[0]
      if (slot?.arrayKey != null && slot.index != null) {
        return `photo slot ${slot.index + 1}`
      }
      return 'section photo'
    }
    return selectedBlock.label || selectedBlock.block_type.replace(/_/g, ' ')
  }, [selectedBlockId, selectedBlock, applyToImageLayer, canvasImageTarget])

  const onOverlayLayerPicked = useCallback((overlayId: string | null, blockId?: string | null) => {
    const bid = blockId ?? selectedBlockId
    if (!bid) {
      setOverlayImageTarget(null)
      setCanvasImageTarget(null)
      return
    }
    if (blockId && blockId !== selectedBlockId) {
      setSelectedBlockId(blockId)
    }
    setOverlayImageTarget(overlayId ? { blockId: bid, overlayId } : null)
    if (overlayId) {
      setCanvasImageTarget(null)
      setActiveTextTarget(null)
    }
  }, [selectedBlockId])

  const handleSectionImageActivate = useCallback((
    blockId: string,
    field: string,
    opts?: { arrayKey?: string; index?: number; itemField?: string; additive?: boolean },
  ) => {
    // First click on an unselected section selects the section itself (so the
    // padding handles show); the image is only entered once its section is already
    // selected. Mirrors the text-field behaviour and the Escape hierarchy.
    if (selectedBlockId !== blockId && !opts?.additive) {
      setSelectedBlockId(blockId)
      setOverlayImageTarget(null)
      setCanvasImageTarget(null)
      setActiveTextTarget(null)
      setRightPanel('props')
      setRightCollapsed(false)
      return
    }
    skipCanvasImageClearRef.current = true
    if (blockId !== selectedBlockId) setSelectedBlockId(blockId)
    setOverlayImageTarget(null)
    setActiveTextTarget(null)
    setCanvasImageTarget(prev => toggleCanvasImageSlot(prev, blockId, field, opts))
  }, [selectedBlockId])

  useEffect(() => {
    if (skipCanvasImageClearRef.current) {
      skipCanvasImageClearRef.current = false
      return
    }
    setCanvasImageTarget(null)
  }, [selectedBlockId])

  const openMediaFromCanvas = useCallback(() => {
    setLeftCollapsed(false)
    setLeftPanel('media')
  }, [])

  // ?? BLOCK OPERATIONS (all optimistic) ????????????????????????????????????


  const persistStructureLayoutNow = useCallback(async (
    def: BlockDef,
    nextProps: BlockProps,
    blocksSnapshot: Record<string, WebsiteBlock[]>,
  ) => {
    if (!siteId) return
    const updates: { pageId: string; tempId?: string; saved?: WebsiteBlock }[] = []
    await Promise.all(localPagesRef.current.map(async page => {
      const block = (blocksSnapshot[page.id] || []).find(b => b.block_type === def.type)
      if (!block) return
      if (block.id.startsWith('temp-')) {
        const saved = await websiteApi.createBlock(siteId, page.id, {
          block_type: def.type,
          label: block.label || def.label,
          props: nextProps,
          style_overrides: block.style_overrides || {},
          visible: block.visible !== false,
          visible_on_mobile: block.visible_on_mobile !== false,
          visible_on_tablet: block.visible_on_tablet !== false,
          visible_on_desktop: block.visible_on_desktop !== false,
          animation: block.animation,
          animation_delay: block.animation_delay ?? 0,
          sort_order: block.sort_order ?? 0,
        } as any)
        updates.push({ pageId: page.id, tempId: block.id, saved })
      } else {
        await websiteApi.updateBlock(siteId, page.id, block.id, { props: nextProps } as any)
      }
    }))
    if (updates.length) {
      setLocalBlocks(prev => {
        let next = { ...prev }
        for (const { pageId, tempId, saved } of updates) {
          if (!tempId || !saved) continue
          next[pageId] = (next[pageId] || []).map(b => b.id === tempId ? saved : b)
        }
        localBlocksRef.current = next
        if (siteId && site) {
          queryClient.setQueryData<WebsiteSite>(['websites', siteId], old =>
            old ? syncSiteQueryBlocks(old, next) : old,
          )
        }
        return next
      })
    } else if (siteId && site) {
      queryClient.setQueryData<WebsiteSite>(['websites', siteId], old =>
        old ? syncSiteQueryBlocks(old, blocksSnapshot) : old,
      )
    }
    skipServerHydrateRef.current = Date.now()
    setBlocksDirty(false)
    blocksDirtyRef.current = false
    setLastSavedAt(new Date())
    setAutoSaveStatus('synced')
  }, [siteId, site, queryClient])

  const persistSingleBlockPropsNow = useCallback(async (
    pageId: string,
    blockId: string,
    nextProps: BlockProps,
    blocksSnapshot: Record<string, WebsiteBlock[]>,
  ) => {
    if (!siteId) return
    const block = (blocksSnapshot[pageId] || []).find(b => b.id === blockId)
    if (!block) return
    if (blockId.startsWith('temp-')) {
      const saved = await websiteApi.createBlock(siteId, pageId, {
        block_type: block.block_type,
        label: block.label,
        props: nextProps,
        style_overrides: block.style_overrides || {},
        visible: block.visible !== false,
        visible_on_mobile: block.visible_on_mobile !== false,
        visible_on_tablet: block.visible_on_tablet !== false,
        visible_on_desktop: block.visible_on_desktop !== false,
        animation: block.animation,
        animation_delay: block.animation_delay ?? 0,
        sort_order: block.sort_order ?? 0,
      } as any)
      setLocalBlocks(prev => ({
        ...prev,
        [pageId]: (prev[pageId] || []).map(b => b.id === blockId ? saved : b),
      }))
      if (saved.id !== blockId) {
        setSelectedBlockId(saved.id)
        scrollCanvasToBlock(saved.id)
      }
    } else {
      await websiteApi.updateBlock(siteId, pageId, blockId, { props: nextProps } as any)
    }
    skipServerHydrateRef.current = Date.now()
    setBlocksDirty(false)
    blocksDirtyRef.current = false
    setLastSavedAt(new Date())
    setAutoSaveStatus('synced')
  }, [siteId, scrollCanvasToBlock])

  const applyLayoutToBlock = useCallback(async (
    blockId: string,
    def: BlockDef,
    propsOverride: Partial<BlockProps>,
    imageCategoryId?: string,
    dataSourceChoice?: LayoutPickerDataSourceChoice,
  ) => {
    if (!activePageId || !siteId) return false
    const isStructure = GLOBAL_STRUCTURE_BLOCK_TYPES.has(def.type)
    const prev = localBlocksRef.current
    const pages = localPagesRef.current

    skipServerHydrateRef.current = Date.now()
    setBlocksDirty(true)
    blocksDirtyRef.current = true

    const structureHit = isStructure
      ? findStructureBlockInMap(prev, pages, def.type, blockId)
      : undefined
    let targetPageId = activePageId
    let targetBlock: WebsiteBlock | undefined
    let resolvedBlockId = blockId

    if (isStructure && structureHit) {
      targetBlock = structureHit.block
      targetPageId = structureHit.pageId
      resolvedBlockId = structureHit.block.id
    } else {
      for (const page of pages) {
        const found = (prev[page.id] || []).find(b => b.id === blockId)
        if (found) {
          targetBlock = found
          targetPageId = page.id
          break
        }
      }
    }

    if (!targetBlock || targetBlock.block_type !== def.type) {
      setBlocksDirty(false)
      blocksDirtyRef.current = false
      return false
    }

    const resolvedCategoryId = imageCategoryId || suggestImageCategoryForBlock(def.category, site)
    const finalProps = finalizeCategoryLayoutProps(
      def.type,
      applyCategoryImagesToBlockProps(
        def.type,
        mergeLayoutBlockProps(
          def.type,
          def.defaultProps,
          targetBlock.props,
          propsOverride,
          layoutThemeFallback(),
        ) as Record<string, unknown>,
        resolvedCategoryId,
        { forceRefresh: true },
      ),
    ) as BlockProps
    const mergedFinalProps: BlockProps = applyDataSourceToBlockProps(
      def.type,
      {
        ...finalProps,
        _image_category_id: resolvedCategoryId,
      },
      dataSourceChoice,
    ) as BlockProps

    let nextMap: Record<string, WebsiteBlock[]>
    if (isStructure) {
      nextMap = applyStructureLayoutToAllPages(
        prev,
        pages,
        def.type,
        def,
        mergedFinalProps,
        activePageId,
        targetBlock,
      )
    } else {
      nextMap = {
        ...prev,
        [targetPageId]: (prev[targetPageId] || []).map(b =>
          b.id === resolvedBlockId
            ? { ...b, props: mergedFinalProps, updated_at: new Date().toISOString() }
            : b,
        ),
      }
    }

    const focusId = isStructure
      ? (nextMap[activePageId] || []).find(b => b.block_type === def.type)?.id ?? resolvedBlockId
      : resolvedBlockId

    commitLocalBlocks(nextMap)

    pushHistory(nextMap)
    setSelectedBlockId(focusId)
    setRightPanel('props')
    setRightCollapsed(false)
    scrollCanvasToBlock(focusId)
    setSavingBlockId(focusId)
    setAutoSaveStatus('saving')
    toast.success(`${def.label} layout applied`)

    try {
      if (isStructure) {
        await persistStructureLayoutNow(def, mergedFinalProps, nextMap)
      } else {
        await persistSingleBlockPropsNow(targetPageId, resolvedBlockId, mergedFinalProps, nextMap)
      }
    } catch {
      setBlocksDirty(true)
      blocksDirtyRef.current = true
      setAutoSaveStatus('error')
      toast.error('Layout shown on canvas ? save failed, click Save to retry')
    } finally {
      setSavingBlockId(null)
    }
    return true
  }, [
    activePageId, siteId, site, layoutThemeFallback,
    scrollCanvasToBlock, pushHistory, persistStructureLayoutNow, persistSingleBlockPropsNow,
    commitLocalBlocks,
  ])

  const handleAddBlock = useCallback(async (
    def: BlockDef,
    insertAtIdx = -1,
    propsOverride?: Partial<BlockProps>,
    imageCategoryId?: string,
    replaceBlockId?: string,
    dataSourceChoice?: LayoutPickerDataSourceChoice,
  ) => {
    if (!activePageId) return
    const blocksMap = localBlocksRef.current
    const pages = localPagesRef.current
    let currentBlocks = (blocksMap[activePageId] || []).slice().sort((a, b) => a.sort_order - b.sort_order)
    let effectiveInsertIdx = insertAtIdx
    let replacedBlockId: string | undefined
    if (replaceBlockId) {
      const replaceIdx = currentBlocks.findIndex(b => b.id === replaceBlockId)
      if (replaceIdx >= 0) {
        replacedBlockId = replaceBlockId
        effectiveInsertIdx = replaceIdx
        currentBlocks = currentBlocks.filter(b => b.id !== replaceBlockId)
      }
    }
    const isStructure = GLOBAL_STRUCTURE_BLOCK_TYPES.has(def.type)

    if (isStructure) {
      const existingOnPage = currentBlocks.find(b => b.block_type === def.type)
      const existingAnyPage = existingOnPage ?? (() => {
        for (const page of pages) {
          const hit = (blocksMap[page.id] || []).find(b => b.block_type === def.type)
          if (hit) return hit
        }
        return undefined
      })()

      if (existingAnyPage && propsOverride && Object.keys(propsOverride).length > 0) {
        await applyLayoutToBlock(existingAnyPage.id, def, propsOverride, imageCategoryId)
        return
      }

      const relocated = relocateExistingStructureBlock(currentBlocks, def.type, insertAtIdx)
      if (relocated) {
        let nextMap: Record<string, WebsiteBlock[]> = { ...blocksMap, [activePageId]: relocated }
        for (const page of pages) {
          if (page.id === activePageId) continue
          const pb = (nextMap[page.id] || []).slice().sort((a, b) => a.sort_order - b.sort_order)
          const pageRelocated = relocateExistingStructureBlock(pb, def.type, -1)
          if (pageRelocated) nextMap = { ...nextMap, [page.id]: pageRelocated }
        }
        commitLocalBlocks(nextMap)
        pushHistory(nextMap)
        const existing = relocated.find(b => b.block_type === def.type)!
        setSelectedBlockId(existing.id)
        setRightPanel('props')
        setRightCollapsed(false)
        setBlocksDirty(true)
        blocksDirtyRef.current = true
        toast.success(`${def.label} moved to the ${def.type === 'footer' ? 'bottom' : 'top'}`)
        return
      }
    }

    const tempId = `temp-${Date.now()}`
    const insertAt = getPreferredBlockInsertIndex(def.type, currentBlocks, effectiveInsertIdx)
    const sort_order = insertAt

    // Auto-bind drag-dropped blocks to live KITERP data so they "just work".
    // The user can disconnect / override inside the Data panel later.
    const resolvedCategoryId = imageCategoryId || suggestImageCategoryForBlock(def.category, site)
    const useCategoryImages = blockSupportsGalleryCategory(def.type)
    const mergedDefaults = finalizeCategoryLayoutProps(
      def.type,
      applyCategoryImagesToBlockProps(
        def.type,
        mergeLayoutBlockProps(
          def.type,
          def.defaultProps,
          undefined,
          propsOverride || {},
          layoutThemeFallback(),
        ) as Record<string, unknown>,
        resolvedCategoryId,
        { forceRefresh: true },
      ),
    )
    const initialProps: BlockProps = applyDataSourceToBlockProps(
      def.type,
      {
        ...mergedDefaults,
        ...(useCategoryImages ? { _image_category_id: resolvedCategoryId } : {}),
      },
      dataSourceChoice ?? (
        useCategoryImages && !BLOCK_REQUIRED_DATA_SOURCE.has(def.type)
          ? { connect: false, sourceType: null }
          : undefined
      ),
    ) as BlockProps

    const tempBlock: WebsiteBlock = {
      id: tempId, page_id: activePageId,
      block_type: def.type, label: def.label,
      props: initialProps, style_overrides: {},
      visible: true, visible_on_mobile: true, visible_on_tablet: true, visible_on_desktop: true,
      animation: null as any, animation_delay: 0, sort_order,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }

    let pageBlocks = insertBlockAtIndex(currentBlocks, tempBlock, def.type, effectiveInsertIdx)
    let next = { ...blocksMap, [activePageId]: pageBlocks }
    if (isStructure) {
      next = applyStructureLayoutToAllPages(
        next,
        pages,
        def.type,
        def,
        initialProps,
        activePageId,
        tempBlock,
      )
      pageBlocks = next[activePageId] || pageBlocks
    }

    skipServerHydrateRef.current = Date.now()
    setBlocksDirty(true)
    blocksDirtyRef.current = true
    // 1. Immediately show in canvas + push history
    commitLocalBlocks(next)
    pushHistory(next)
    setSelectedBlockId(tempId)
    setRightPanel('props')
    setRightCollapsed(false)
    scrollCanvasToBlock(tempId)

    // 2. Persist in background (active page first; clones on other pages save with Save/Apply)
    try {
      const saved = await websiteApi.createBlock(siteId!, activePageId, {
        block_type: def.type, label: def.label,
        props: initialProps, style_overrides: {},
        visible: true, visible_on_mobile: true, visible_on_tablet: true, visible_on_desktop: true,
        sort_order: pageBlocks.findIndex(b => b.id === tempId),
      } as any)
      setLocalBlocks(prev => {
        let updated: Record<string, WebsiteBlock[]> = {
          ...prev,
          [activePageId]: (prev[activePageId] || []).map(b => b.id === tempId ? saved : b),
        }
        if (isStructure) {
          updated = ensureStructureBlocksOnAllPages(updated, localPagesRef.current, saved, def.type)
        }
        localBlocksRef.current = updated
        if (site) {
          queryClient.setQueryData<WebsiteSite>(['websites', siteId!], old =>
            old ? syncSiteQueryBlocks(old, updated) : old,
          )
        }
        return updated
      })
      setSelectedBlockId(saved.id)
      scrollCanvasToBlock(saved.id)
      if (replacedBlockId && !replacedBlockId.startsWith('temp-')) {
        try {
          await websiteApi.deleteBlock(siteId!, activePageId, replacedBlockId)
        } catch {
          toast.error('New section saved ? could not remove the old section; delete it manually.')
        }
      }
      toast.success(
        replacedBlockId
          ? `${def.label} replaced selected section`
          : isStructure && pages.length > 1
            ? `${def.label} added ? synced to all pages`
            : `${def.label} added`,
      )
    } catch {
      // Roll back
      setLocalBlocks(prev => ({
        ...prev,
        [activePageId]: (prev[activePageId] || []).filter(b => b.id !== tempId),
      }))
      setSelectedBlockId(null)
      toast.error('Failed to add block')
    }
  }, [activePageId, siteId, site, pushHistory, layoutThemeFallback, scrollCanvasToBlock, applyLayoutToBlock, commitLocalBlocks, queryClient])

  const openSectionLayoutPicker = useCallback((
    def: BlockDef,
    insertAtIdx = -1,
    targetBlockId?: string,
    options?: { insertOnly?: boolean; replaceBlockId?: string },
  ) => {
    const explicitReplaceId = options?.replaceBlockId
    const insertOnly = options?.insertOnly === true || (insertAtIdx >= 0 && !explicitReplaceId)
    let resolvedTargetId = targetBlockId
    let resolvedInsertIdx = insertAtIdx
    let replaceBlockId: string | undefined = explicitReplaceId

    if (explicitReplaceId && activePageId) {
      const pageBlocks = (localBlocksRef.current[activePageId] || []).slice().sort((a, b) => a.sort_order - b.sort_order)
      const replaceIdx = pageBlocks.findIndex(b => b.id === explicitReplaceId)
      if (replaceIdx >= 0) resolvedInsertIdx = replaceIdx
      resolvedTargetId = undefined
    }

    if (activePageId && selectedBlockId && !insertOnly && !explicitReplaceId) {
      const pageBlocks = (localBlocksRef.current[activePageId] || []).slice().sort((a, b) => a.sort_order - b.sort_order)
      const selectedIdx = pageBlocks.findIndex(b => b.id === selectedBlockId)
      const selected = selectedIdx >= 0 ? pageBlocks[selectedIdx] : undefined

      if (selected) {
        if (!resolvedTargetId && selected.block_type === def.type) {
          resolvedTargetId = selectedBlockId
        } else if (
          insertAtIdx < 0
          && !resolvedTargetId
          && selected.block_type !== def.type
          && !GLOBAL_STRUCTURE_BLOCK_TYPES.has(selected.block_type)
          && !GLOBAL_STRUCTURE_BLOCK_TYPES.has(def.type)
        ) {
          resolvedInsertIdx = selectedIdx
          replaceBlockId = selectedBlockId
        }
      }
    }

    if (!resolvedTargetId && !insertOnly && GLOBAL_STRUCTURE_BLOCK_TYPES.has(def.type)) {
      resolvedTargetId = findStructureBlockInMap(localBlocksRef.current, localPagesRef.current, def.type)?.block.id
    }
    setSectionLayoutPicker({
      def,
      insertAtIdx: resolvedInsertIdx,
      targetBlockId: resolvedTargetId,
      replaceBlockId,
      insertOnly,
    })
  }, [activePageId, selectedBlockId])

  const shouldOpenLayoutPickerForBlock = useCallback((def: BlockDef) =>
    getSectionLayoutOptions(def.type).length > 1,
  [])

  const layoutPickerCurrentProps = useMemo(() => {
    if (!sectionLayoutPicker || !activePageId) return undefined
    const blockId = sectionLayoutPicker.targetBlockId
      ?? ((localBlocks[activePageId] || []).find(b => b.id === selectedBlockId && b.block_type === sectionLayoutPicker.def.type)?.id)
      ?? (GLOBAL_STRUCTURE_BLOCK_TYPES.has(sectionLayoutPicker.def.type)
        ? (() => {
            for (const page of localPages) {
              const hit = (localBlocks[page.id] || []).find(b => b.block_type === sectionLayoutPicker.def.type)
              if (hit) return hit.id
            }
            return undefined
          })()
        : undefined)
    if (!blockId) return undefined
    for (const page of localPages) {
      const block = (localBlocks[page.id] || []).find(b => b.id === blockId)
      if (block?.block_type === sectionLayoutPicker.def.type) {
        return block.props as Record<string, unknown>
      }
    }
    return undefined
  }, [sectionLayoutPicker, activePageId, selectedBlockId, localBlocks, localPages])

  const openLayoutPickerForBlock = useCallback((block: WebsiteBlock) => {
    const def = BLOCK_CATALOG.find(d => d.type === block.block_type)
    if (!def) return
    openSectionLayoutPicker(def, -1, block.id)
  }, [openSectionLayoutPicker])

  const cycleBlockLayout = useCallback(async (block: WebsiteBlock, direction: 'prev' | 'next') => {
    const def = BLOCK_CATALOG.find(d => d.type === block.block_type)
    if (!def || !site) return
    const option = getCycledSectionLayoutOption(block.props as Record<string, unknown>, block.block_type, direction)
    if (!option) return
    const categoryId = (block.props as Record<string, unknown>)?._image_category_id as string | undefined
      || suggestImageCategoryForBlock(def.category, site)
    await applyLayoutToBlock(block.id, def, option.props as Partial<BlockProps>, categoryId)
  }, [applyLayoutToBlock, site])

  const handleSelectSectionLayout = useCallback(async (
    propsOverride: Partial<BlockProps>,
    imageCategoryId: string,
    dataSourceChoice: LayoutPickerDataSourceChoice,
  ) => {
    if (!sectionLayoutPicker) return
    const { def, insertAtIdx, targetBlockId, replaceBlockId, insertOnly } = sectionLayoutPicker
    setSectionLayoutPicker(null)

    if (replaceBlockId) {
      await handleAddBlock(def, insertAtIdx, propsOverride, imageCategoryId, replaceBlockId, dataSourceChoice)
      return
    }

    if (Object.keys(propsOverride).length === 0) {
      await handleAddBlock(def, insertAtIdx, propsOverride, imageCategoryId, replaceBlockId, dataSourceChoice)
      return
    }

    const isStructure = GLOBAL_STRUCTURE_BLOCK_TYPES.has(def.type)
    const pages = localPagesRef.current
    const structureHit = isStructure
      ? findStructureBlockInMap(localBlocksRef.current, pages, def.type, targetBlockId)
      : undefined

    if (!insertOnly) {
      let applyTargetId = targetBlockId
      if (!applyTargetId && activePageId && selectedBlockId) {
        const selected = (localBlocksRef.current[activePageId] || []).find(b => b.id === selectedBlockId)
        if (selected?.block_type === def.type) applyTargetId = selectedBlockId
      }
      if (!applyTargetId && structureHit) applyTargetId = structureHit.block.id

      if (applyTargetId) {
        const applied = await applyLayoutToBlock(applyTargetId, def, propsOverride, imageCategoryId, dataSourceChoice)
        if (applied) return
      }

      // Re-use the selected block on this page when changing layout (avoid duplicate "added" blocks).
      if (!applyTargetId && activePageId && selectedBlockId) {
        const selected = (localBlocksRef.current[activePageId] || []).find(b => b.id === selectedBlockId)
        if (selected?.block_type === def.type) {
          const applied = await applyLayoutToBlock(selected.id, def, propsOverride, imageCategoryId, dataSourceChoice)
          if (applied) return
        }
      }
    }

    if (isStructure) {
      await handleAddBlock(def, -1, propsOverride, imageCategoryId, undefined, dataSourceChoice)
      return
    }

    await handleAddBlock(def, insertAtIdx, propsOverride, imageCategoryId, replaceBlockId, dataSourceChoice)
  }, [sectionLayoutPicker, handleAddBlock, applyLayoutToBlock, activePageId, selectedBlockId])

  // Preview-only update ? instant canvas update, no API call (used while typing)
  const handlePreviewBlockProps = useCallback((blockId: string, propsUpdate: Partial<BlockProps>) => {
    const pages = localPagesRef.current
    const pageId = findPageIdForBlock(localBlocksRef.current, pages, blockId, activePageId)
    if (!pageId) return
    setLocalBlocks(prev => {
      const blocks = prev[pageId] || []
      const block = blocks.find(b => b.id === blockId)
      if (!block) return prev
      const mergedProps = { ...block.props, ...propsUpdate }
      return {
        ...prev,
        [pageId]: blocks.map(b => b.id === blockId ? { ...b, props: mergedProps } : b),
      }
    })
  }, [activePageId])

  // Update block props ? immediate UI; server sync on explicit Save
  const handleUpdateBlockProps = useCallback((blockId: string, propsUpdate: Partial<BlockProps>) => {
    const pages = localPagesRef.current
    const pageId = findPageIdForBlock(localBlocksRef.current, pages, blockId, activePageId)
    if (!pageId) return
    scheduleEditorHistorySnapshot()
    setBlocksDirty(true)
    blocksDirtyRef.current = true
    setLocalBlocks(prev => {
      const blocks = prev[pageId] || []
      const block = blocks.find(b => b.id === blockId)
      if (!block) return prev
      const mergedProps: BlockProps = { ...block.props, ...propsUpdate }
      const topLevel: Partial<WebsiteBlock> = {}
      const TOP_KEYS = [
        'visible', 'visible_on_mobile', 'visible_on_tablet', 'visible_on_desktop',
        'animation', 'animation_delay', 'style_overrides', 'visible_branches',
      ] as const
      TOP_KEYS.forEach(k => {
        if (k in propsUpdate) {
          (topLevel as any)[k] = (propsUpdate as any)[k]
          delete (mergedProps as any)[k]
        }
      })
      return {
        ...prev,
        [pageId]: blocks.map(b =>
          b.id === blockId ? { ...b, props: mergedProps, ...topLevel } : b,
        ),
      }
    })
  }, [activePageId, scheduleEditorHistorySnapshot])

  const handleCanvasTextFieldCommit = useCallback((blockId: string, fieldKey: string, value: string) => {
    const pageId = findPageIdForBlock(localBlocksRef.current, localPagesRef.current, blockId, activePageId)
    const block = pageId ? (localBlocksRef.current[pageId] || []).find(b => b.id === blockId) : null
    const patch = buildPropPatchFromFieldKey(
      fieldKey,
      value,
      (block?.props ?? {}) as Record<string, unknown>,
    )
    handleUpdateBlockProps(blockId, patch as Partial<BlockProps>)
    setActiveTextTarget(prev => {
      if (prev?.blockId === blockId && prev.fieldKeys.includes(fieldKey)) return prev
      return { blockId, fieldKeys: [fieldKey] }
    })
  }, [activePageId, handleUpdateBlockProps])

  const preserveTextTargetAfterStylePatch = useCallback((
    blockId: string,
    fieldKey: string,
  ) => {
    setActiveTextTarget(prev => {
      if (fieldKey === CONTENT_GROUP_FIELD_KEY) {
        return { blockId, fieldKeys: [CONTENT_GROUP_FIELD_KEY] }
      }
      if (prev?.blockId === blockId && prev.fieldKeys.includes(fieldKey)) {
        return prev
      }
      return { blockId, fieldKeys: [fieldKey] }
    })
  }, [])

  const handleCanvasTextFieldStylePatch = useCallback((
    blockId: string,
    fieldKey: string,
    patch: Record<string, unknown>,
  ) => {
    if (fieldKey === CONTENT_GROUP_FIELD_KEY) {
      handleUpdateBlockProps(blockId, {
        ...(patch.field_offset_x !== undefined ? { content_offset_x: patch.field_offset_x } : {}),
        ...(patch.field_offset_y !== undefined ? { content_offset_y: patch.field_offset_y } : {}),
        ...(patch.content_offset_x !== undefined ? { content_offset_x: patch.content_offset_x } : {}),
        ...(patch.content_offset_y !== undefined ? { content_offset_y: patch.content_offset_y } : {}),
        ...(patch.flip_h !== undefined ? { content_flip_h: patch.flip_h } : {}),
        ...(patch.flip_v !== undefined ? { content_flip_v: patch.flip_v } : {}),
        ...(patch.rotate_deg !== undefined ? { content_rotate_deg: patch.rotate_deg } : {}),
      } as Partial<BlockProps>)
      preserveTextTargetAfterStylePatch(blockId, CONTENT_GROUP_FIELD_KEY)
      return
    }
    const pageId = findPageIdForBlock(localBlocksRef.current, localPagesRef.current, blockId, activePageId)
    const block = pageId ? (localBlocksRef.current[pageId] || []).find(b => b.id === blockId) : null
    const fieldStyles = ((block?.props ?? {}) as Record<string, unknown>)._field_styles as Record<string, Record<string, unknown>> || {}
    handleUpdateBlockProps(blockId, {
      _field_styles: {
        ...fieldStyles,
        [fieldKey]: {
          ...(fieldStyles[fieldKey] || {}),
          ...patch,
        },
      },
    } as Partial<BlockProps>)
    preserveTextTargetAfterStylePatch(blockId, fieldKey)
  }, [activePageId, handleUpdateBlockProps, preserveTextTargetAfterStylePatch])

  const handleCanvasTextFieldBatchStylePatch = useCallback((
    blockId: string,
    patchesByField: Record<string, Record<string, unknown>>,
  ) => {
    const keys = Object.keys(patchesByField)
    if (!keys.length) return
    const pageId = findPageIdForBlock(localBlocksRef.current, localPagesRef.current, blockId, activePageId)
    const block = pageId ? (localBlocksRef.current[pageId] || []).find(b => b.id === blockId) : null
    const fieldStyles = ((block?.props ?? {}) as Record<string, unknown>)._field_styles as Record<string, Record<string, unknown>> || {}
    const nextStyles = { ...fieldStyles }
    keys.forEach(k => {
      nextStyles[k] = { ...(fieldStyles[k] || {}), ...patchesByField[k] }
    })
    handleUpdateBlockProps(blockId, { _field_styles: nextStyles } as Partial<BlockProps>)
    setActiveTextTarget(prev => {
      const allSelected = prev?.blockId === blockId && keys.every(k => prev.fieldKeys.includes(k))
      if (allSelected) return prev
      const merged = prev?.blockId === blockId
        ? [...new Set([...prev.fieldKeys.filter(k => k !== CONTENT_GROUP_FIELD_KEY), ...keys])]
        : keys
      return merged.length ? { blockId, fieldKeys: merged } : { blockId, fieldKeys: keys }
    })
  }, [activePageId, handleUpdateBlockProps])

  const applyFormatPaintTarget = useCallback((
    blockId: string,
    fieldKey: string | null,
    opts?: { clientX?: number; clientY?: number },
  ) => {
    if (!formatPaintBrush) return false
    const pageId = findPageIdForBlock(localBlocksRef.current, localPagesRef.current, blockId, activePageId)
    const block = pageId ? (localBlocksRef.current[pageId] || []).find(b => b.id === blockId) : null
    if (!block) return false

    if (typeof formatPaintBrush.style.font_family === 'string') {
      ensureBuilderFontLoaded(formatPaintBrush.style.font_family)
    }

    const stylePatch = formatPaintBrush.style as Record<string, unknown>

    if (fieldKey && fieldKey !== CONTENT_GROUP_FIELD_KEY) {
      const fieldEl = document.querySelector(
        `[data-block-id="${CSS.escape(blockId)}"] [data-text-key="${CSS.escape(fieldKey)}"]`,
      ) as HTMLElement | null

      if (
        fieldEl
        && typeof opts?.clientX === 'number'
        && typeof opts?.clientY === 'number'
        && !hasActiveInlineTextSelection(fieldKey)
      ) {
        if (applyInlineTextStyleAtPoint(fieldKey, fieldEl, stylePatch, opts.clientX, opts.clientY)) {
          setSelectedBlockId(blockId)
          setOverlayImageTarget(null)
          setActiveTextTarget({ blockId, fieldKeys: [fieldKey] })
          setRightPanel('props')
          setRightCollapsed(false)
          if (!formatPaintBrush.sticky) setFormatPaintBrush(null)
          toast.success('Formatting applied to word')
          return true
        }
      }

      if (hasActiveInlineTextSelection(fieldKey)) {
        if (applyInlineTextSelectionStyle(fieldKey, stylePatch)) {
          setSelectedBlockId(blockId)
          setOverlayImageTarget(null)
          setActiveTextTarget({ blockId, fieldKeys: [fieldKey] })
          setRightPanel('props')
          setRightCollapsed(false)
          if (!formatPaintBrush.sticky) setFormatPaintBrush(null)
          toast.success('Formatting applied to selected text')
          return true
        }
      }
    }

    const patch = buildFormatPaintPropsPatch(
      block.props as Record<string, unknown>,
      fieldKey,
      formatPaintBrush.style,
    )
    if (Object.keys(patch).length === 0) return false
    handleUpdateBlockProps(blockId, patch as Partial<BlockProps>)
    setSelectedBlockId(blockId)
    setOverlayImageTarget(null)
    if (fieldKey) setActiveTextTarget({ blockId, fieldKeys: [fieldKey] })
    else setActiveTextTarget(null)
    setRightPanel('props')
    setRightCollapsed(false)
    if (!formatPaintBrush.sticky) setFormatPaintBrush(null)
    toast.success(fieldKey ? 'Formatting applied to text field' : 'Formatting applied to section')
    return true
  }, [formatPaintBrush, activePageId, handleUpdateBlockProps])

  applyFormatPaintTargetRef.current = applyFormatPaintTarget

  const builderEscapeUiRef = useRef<BuilderEscapeUiState>({
    formatPaintActive: false,
    armedDeleteActive: false,
    overlayImageActive: false,
    canvasImageActive: false,
    applyPopoverOpen: false,
    storePopoverOpen: false,
    hasActiveTextTarget: false,
    hasSelectedBlock: false,
  })
  const builderEscapeActionsRef = useRef<BuilderEscapeActions>({
    clearFormatPaint: () => {},
    clearArmedDelete: () => {},
    clearOverlayImage: () => {},
    clearCanvasImage: () => {},
    closeApplyPopover: () => {},
    closeStorePopover: () => {},
    clearActiveTextTarget: () => {},
    clearSelectedBlock: () => {},
  })

  builderEscapeUiRef.current = {
    formatPaintActive: Boolean(formatPaintBrush),
    armedDeleteActive: false,
    overlayImageActive: Boolean(overlayImageTarget),
    canvasImageActive: Boolean(canvasImageTarget),
    applyPopoverOpen,
    storePopoverOpen: storePopover,
    hasActiveTextTarget: Boolean(activeTextTarget),
    hasSelectedBlock: Boolean(selectedBlockId),
  }

  builderEscapeActionsRef.current = {
    clearFormatPaint: () => setFormatPaintBrush(null),
    clearArmedDelete: () => {},
    clearOverlayImage: () => setOverlayImageTarget(null),
    clearCanvasImage: () => setCanvasImageTarget(null),
    closeApplyPopover: () => {
      setApplyPopoverOpen(false)
      setApplyPickerStep('root')
    },
    closeStorePopover: () => setStorePopover(false),
    clearActiveTextTarget: () => setActiveTextTarget(null),
    clearSelectedBlock: () => setSelectedBlockId(null),
  }

  useLayoutEffect(() => {
    return registerEscapeHandler(() => {
      dismissBuilderEscapeLayer(builderEscapeUiRef.current, builderEscapeActionsRef.current)
    })
  }, [])

  useEffect(() => {
    const root = builderPageRootRef.current
    if (!root) return
    const onInlineCommit = (e: Event) => {
      const target = e.target as HTMLElement
      const fieldKey = target.getAttribute('data-text-key')
      if (!fieldKey) return
      const blockRoot = target.closest('[data-block-id]') as HTMLElement | null
      const blockId = blockRoot?.getAttribute('data-block-id')
      if (!blockId) return
      const html = target.innerHTML.trim()
      const text = (target.innerText ?? '').trim()
      const value = hasInlineHtml(html) ? html : text
      handleUpdateBlockProps(blockId, { [fieldKey]: value } as Partial<BlockProps>)
    }
    root.addEventListener('builder-inline-text-commit', onInlineCommit)
    return () => root.removeEventListener('builder-inline-text-commit', onInlineCommit)
  }, [handleUpdateBlockProps, activePageId, canvasBlocksRevision])

  // ?? Image / media apply ???????????????????????????????????????????????????
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

  const applyMediaUrlToSelection = useCallback((
    url: string,
    opts?: { blockId?: string; overlayTarget?: { blockId: string; overlayId: string } | null },
  ) => {
    const pageId = activePageId
    if (!pageId) {
      toast.error('Select a block first')
      return
    }
    const blockId = opts?.blockId ?? selectedBlockIdRef.current
    if (!blockId) {
      toast.error('Select a block first')
      return
    }
    const block = (localBlocksRef.current[pageId] || []).find(b => b.id === blockId)
    if (!block) {
      toast.error('Select a block first')
      return
    }

    const overlayTarget = opts?.overlayTarget !== undefined
      ? opts.overlayTarget
      : overlayImageTargetRef.current

    // 1) Overlay layer target (inserted image / video on canvas)
    if (overlayTarget && overlayTarget.blockId === blockId) {
      const overlays = ((block.props as Record<string, unknown>).overlays as BlockOverlayItem[]) || []
      const target = overlays.find(o => o.id === overlayTarget.overlayId)
      if (target) {
        handleUpdateBlockProps(blockId, {
          overlays: overlays.map(o => (
            o.id === overlayTarget.overlayId
              ? {
                  ...o,
                  src: url,
                  ...(o.type === 'video' ? {} : { type: 'image' as const }),
                }
              : o
          )),
        } as Partial<BlockProps>)
        toast.success('Image applied to layer!')
        return
      }
    }

    // 2) Canvas image target (clicked image on preview)
    if (canvasImageTarget && canvasImageTarget.blockId === blockId) {
      const arraySlots = canvasImageArraySlots(canvasImageTarget, blockId)
      if (arraySlots.length > 0) {
        const { arrayKey, itemField } = arraySlots[0]
        const arr = [...(((block.props as Record<string, unknown>)[arrayKey] as unknown[]) || [])]
        for (const slot of arraySlots) {
          while (arr.length <= slot.index) arr.push({ [itemField]: null })
          arr[slot.index] = {
            ...(arr[slot.index] as Record<string, unknown>),
            [itemField]: url,
          }
        }
        handleUpdateBlockProps(blockId, { [arrayKey]: arr } as Partial<BlockProps>)
        toast.success(
          arraySlots.length > 1
            ? `Image applied to ${arraySlots.length} photos`
            : 'Image updated',
        )
        return
      }
      const propSlot = canvasImageTarget.slots.find(s => s.propField)
      if (propSlot?.propField) {
        handleUpdateBlockProps(blockId, { [propSlot.propField]: url } as Partial<BlockProps>)
        toast.success('Image updated')
        return
      }
    }

    // 3) Array-item blocks (testimonials, team, features, gallery, etc.)
    const arrayCfg = BLOCK_ARRAY_IMAGE[block.block_type]
    if (arrayCfg) {
      const selectedSlots = (
        canvasImageTarget
        && canvasImageTarget.blockId === blockId
      )
        ? canvasImageArraySlots(canvasImageTarget, blockId).filter(s => s.arrayKey === arrayCfg.arrayKey)
        : []
      const targetIndices = new Set(
        selectedSlots.length > 0 ? selectedSlots.map(s => s.index) : [0],
      )
      const maxTargetIdx = Math.max(...targetIndices, 0)
      let arr: Record<string, unknown>[] = ((block.props as Record<string, unknown>)[arrayCfg.arrayKey] as Record<string, unknown>[] | undefined) || []
      if (arr.length > 0) {
        while (arr.length <= maxTargetIdx) {
          const filler: Record<string, any> = { [arrayCfg.itemField]: null }
          if (arrayCfg.defaultTitle) filler.title = arrayCfg.defaultTitle
          if (arrayCfg.itemField === 'avatar_url') filler.name = arrayCfg.defaultTitle || 'Person'
          arr.push(filler)
        }
        const updated = arr.map((item, idx) =>
          targetIndices.has(idx) ? { ...item, [arrayCfg.itemField]: url } : item)
        handleUpdateBlockProps(blockId, { [arrayCfg.arrayKey]: updated } as Partial<BlockProps>)
        toast.success(
          targetIndices.size > 1
            ? `Image applied to ${targetIndices.size} slots`
            : targetIndices.has(0) && targetIndices.size === 1 && !canvasImageTarget
              ? `Image applied to first item. Click an image on the canvas to target another slot.`
              : `Image applied to slot ${maxTargetIdx + 1}`,
        )
      } else {
        // No items yet ? create one with the image
        const newItem: Record<string, unknown> = { [arrayCfg.itemField]: url }
        if (arrayCfg.defaultTitle) newItem.title = arrayCfg.defaultTitle
        if (arrayCfg.itemField === 'avatar_url') newItem.name = arrayCfg.defaultTitle || 'Person'
        if (arrayCfg.itemField === 'src') delete newItem.title
        handleUpdateBlockProps(blockId, { [arrayCfg.arrayKey]: [newItem] } as Partial<BlockProps>)
        toast.success('Image added as new item.')
      }
      return
    }

    // 4) Simple top-level field (hero split ? image_url, full-bleed hero ? bg_image_url, etc.)
    const field = resolveBlockPrimaryImageField(
      block.block_type,
      (block.props ?? {}) as Record<string, unknown>,
      BLOCK_IMAGE_FIELD,
    )
    handleUpdateBlockProps(blockId, { [field]: url } as Partial<BlockProps>)
    toast.success('Image applied to block!')
  }, [activePageId, canvasImageTarget, handleUpdateBlockProps])

  const uploadImageFileToSelection = useCallback(async (file: File) => {
    if (!siteId) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please use an image file (JPG, PNG, WebP, ?)')
      return
    }
    if (!selectedBlockIdRef.current) {
      toast.error('Select a block on the canvas first')
      return
    }
    const capturedBlockId = selectedBlockIdRef.current
    const capturedOverlayTarget = overlayImageTargetRef.current
    try {
      const saved = await overlayLayerUpload.mutateAsync(file)
      const uploadedUrl = saved.original_url || (saved as { url?: string }).url || ''
      applyMediaUrlToSelection(uploadedUrl, {
        blockId: capturedBlockId,
        overlayTarget: capturedOverlayTarget,
      })
    } catch {
      toast.error('Upload failed ? try a smaller file or check your connection')
    }
  }, [siteId, overlayLayerUpload, applyMediaUrlToSelection])

  const openOverlayImageFilePicker = useCallback(() => {
    overlayImageUploadRef.current?.click()
  }, [])

  const openOverlayImageUrlPrompt = useCallback(() => {
    if (!selectedBlock || !overlayImageTarget || overlayImageTarget.blockId !== selectedBlock.id) return
    const overlays = ((selectedBlock.props as Record<string, unknown>).overlays as BlockOverlayItem[]) || []
    const item = overlays.find(o => o.id === overlayImageTarget.overlayId && o.type === 'image')
    if (!item) return
    openTextPrompt({
      title: 'Set image URL',
      placeholder: 'https://?/image.jpg',
      initialValue: item.src || '',
      onSave: v => {
        if (!v) return
        handleUpdateBlockProps(selectedBlock.id, {
          overlays: overlays.map(o => (o.id === item.id ? { ...o, src: v } : o)),
        } as BlockProps)
      },
    })
  }, [selectedBlock, overlayImageTarget, openTextPrompt, handleUpdateBlockProps])

  const startOverlayLayerTextEdit = useCallback((overlayId: string) => {
    document
      .querySelector(`[data-overlay-id="${CSS.escape(overlayId)}"]`)
      ?.dispatchEvent(new CustomEvent('builder-overlay-start-text-edit', { bubbles: true }))
  }, [])

  const openOverlayTextEdit = useCallback(() => {
    if (!selectedBlock || !overlayImageTarget || overlayImageTarget.blockId !== selectedBlock.id) return
    const overlays = ((selectedBlock.props as Record<string, unknown>).overlays as BlockOverlayItem[]) || []
    const item = overlays.find(o => o.id === overlayImageTarget.overlayId)
    if (!item) return
    if (item.type === 'text') {
      startOverlayLayerTextEdit(item.id)
      return
    }
    if (item.type === 'button' || item.type === 'badge') {
      openTextPrompt({
        title: `Edit ${item.type} label`,
        placeholder: item.type === 'button' ? 'e.g. Book Now' : 'e.g. NEW',
        initialValue: item.text || '',
        onSave: v => {
          handleUpdateBlockProps(selectedBlock.id, {
            overlays: overlays.map(o => (o.id === item.id ? { ...o, text: v } : o)),
          } as BlockProps)
        },
      })
    }
  }, [selectedBlock, overlayImageTarget, openTextPrompt, handleUpdateBlockProps, startOverlayLayerTextEdit])

  const openOverlayDescriptionEdit = useCallback(() => {
    if (!selectedBlock || !overlayImageTarget || overlayImageTarget.blockId !== selectedBlock.id) return
    const overlays = ((selectedBlock.props as Record<string, unknown>).overlays as BlockOverlayItem[]) || []
    const item = overlays.find(o => o.id === overlayImageTarget.overlayId)
    if (!item || (item.type !== 'button' && item.type !== 'badge')) return
    openTextPrompt({
      title: 'Button description',
      subtitle: 'Shown as tooltip on hover and used for screen-reader labels.',
      placeholder: 'Book a table for 4 guests',
      initialValue: item.description || '',
      multiline: true,
      maxLength: 160,
      onSave: v => {
        handleUpdateBlockProps(selectedBlock.id, {
          overlays: overlays.map(o => (o.id === item.id ? { ...o, description: v } : o)),
        } as BlockProps)
      },
    })
  }, [selectedBlock, overlayImageTarget, openTextPrompt, handleUpdateBlockProps])

  const handleOverlayImageFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) await uploadImageFileToSelection(file)
  }, [uploadImageFileToSelection])

  // Delete block ? optimistic; callers show a confirmation dialog before invoking with force.
  const handleDeleteBlock = useCallback(async (
    blockId: string,
    options?: { pageId?: string; force?: boolean },
  ) => {
    if (options?.force !== true) return

    const pages = localPagesRef.current
    const prev = localBlocksRef.current

    // Resolve which page owns this block.
    let pageId = options?.pageId ?? activePageId ?? undefined
    if (!pageId) {
      for (const page of pages) {
        if ((prev[page.id] || []).some(b => b.id === blockId)) {
          pageId = page.id
          break
        }
      }
    }
    if (!pageId) return

    const pageBlocks = prev[pageId] || []
    const target = pageBlocks.find(b => b.id === blockId)
      ?? pages.flatMap(p => prev[p.id] || []).find(b => b.id === blockId)
    if (!target) return

    const wasDirtyBeforeDelete = blocksDirtyRef.current
    const isStructure = GLOBAL_STRUCTURE_BLOCK_TYPES.has(target.block_type)
    const backup = JSON.parse(JSON.stringify(prev)) as Record<string, WebsiteBlock[]>

    let nextMap: Record<string, WebsiteBlock[]> = { ...prev }
    if (isStructure) {
      for (const page of pages) {
        nextMap[page.id] = (nextMap[page.id] || []).filter(b => b.block_type !== target.block_type)
      }
    } else {
      nextMap[pageId] = (nextMap[pageId] || []).filter(b => b.id !== blockId)
    }

    skipServerHydrateRef.current = Date.now()
    setBlocksDirty(true)
    blocksDirtyRef.current = true
    commitLocalBlocks(nextMap)
    pushHistory(nextMap)
    if (selectedBlockId === blockId) setSelectedBlockId(null)

    const deleteJobs: { pageId: string; blockId: string }[] = []
    if (isStructure) {
      for (const page of pages) {
        const hit = (backup[page.id] || []).find(b => b.block_type === target.block_type)
        if (hit && !hit.id.startsWith('temp-')) deleteJobs.push({ pageId: page.id, blockId: hit.id })
      }
    } else if (!blockId.startsWith('temp-')) {
      deleteJobs.push({ pageId, blockId })
    }

    try {
      await Promise.all(deleteJobs.map(({ pageId: pid, blockId: bid }) =>
        websiteApi.deleteBlock(siteId!, pid, bid),
      ))
      skipServerHydrateRef.current = Date.now()
      if (site) {
        queryClient.setQueryData<WebsiteSite>(['websites', siteId!], old =>
          old ? syncSiteQueryBlocks(old, nextMap) : old,
        )
      }
      if (!wasDirtyBeforeDelete) {
        setBlocksDirty(false)
        blocksDirtyRef.current = false
      }
      toast.success(isStructure ? `${target.label || target.block_type} removed from all pages` : 'Section deleted ? Ctrl+Z to undo')
    } catch {
      commitLocalBlocks(backup)
      pushHistory(backup)
      setBlocksDirty(true)
      blocksDirtyRef.current = true
      toast.error('Delete failed ? try again')
    }
  }, [activePageId, siteId, site, selectedBlockId, commitLocalBlocks, pushHistory, queryClient])

  const confirmDeleteBlock = useCallback((
    blockId: string,
    options?: { pageId?: string },
  ) => {
    const pages = localPagesRef.current
    const prev = localBlocksRef.current
    let pageId = options?.pageId ?? activePageId ?? undefined
    if (!pageId) {
      for (const page of pages) {
        if ((prev[page.id] || []).some(b => b.id === blockId)) {
          pageId = page.id
          break
        }
      }
    }
    const target = pageId
      ? (prev[pageId] || []).find(b => b.id === blockId)
      : pages.flatMap(p => prev[p.id] || []).find(b => b.id === blockId)
    if (!target) return

    const label = catalogBlockLabel(target)
    const isStructure = GLOBAL_STRUCTURE_BLOCK_TYPES.has(target.block_type)
    openTextPrompt({
      title: `Delete ${label}?`,
      subtitle: isStructure
        ? 'This site-wide section (nav, footer, or announcement bar) will be removed from every page. You can undo with Ctrl+Z.'
        : 'This section will be removed from the page. You can undo with Ctrl+Z.',
      confirmLabel: 'Delete',
      confirmOnly: true,
      destructive: true,
      onSave: async () => {
        await handleDeleteBlock(blockId, { pageId, force: true })
      },
    })
  }, [activePageId, openTextPrompt, handleDeleteBlock])

  // Duplicate block ? optimistic
  const handleDuplicateBlock = useCallback(async (blockId: string) => {
    const pages = localPagesRef.current
    const blocksMap = localBlocksRef.current
    const pageId = findPageIdForBlock(blocksMap, pages, blockId, activePageId)
    if (!pageId) return
    const original = (blocksMap[pageId] || []).find(b => b.id === blockId)
    if (!original) return
    const tempId = `temp-dup-${Date.now()}`
    const dupBlock = { ...original, id: tempId, sort_order: original.sort_order + 0.5 }
    setLocalBlocks(prev => ({
      ...prev,
      [pageId]: [...(prev[pageId] || []), dupBlock].map((b, i) => ({ ...b, sort_order: i })),
    }))
    setSelectedBlockId(tempId)
    setBlocksDirty(true)
    blocksDirtyRef.current = true
    try {
      const saved = blockId.startsWith('temp-')
        ? await websiteApi.createBlock(siteId!, pageId, {
            block_type: original.block_type,
            label: original.label,
            props: original.props,
            sort_order: original.sort_order + 1,
            visible: original.visible !== false,
            visible_on_mobile: original.visible_on_mobile !== false,
            visible_on_tablet: original.visible_on_tablet !== false,
            visible_on_desktop: original.visible_on_desktop !== false,
          } as any)
        : await websiteApi.duplicateBlock(siteId!, pageId, blockId)
      setLocalBlocks(prev => ({
        ...prev,
        [pageId]: (prev[pageId] || []).map(b => b.id === tempId ? saved : b),
      }))
      setSelectedBlockId(saved.id)
      toast.success('Block duplicated')
    } catch {
      setLocalBlocks(prev => ({
        ...prev,
        [pageId]: (prev[pageId] || []).filter(b => b.id !== tempId),
      }))
      toast.error(blockId.startsWith('temp-') ? 'Save the section first, then duplicate' : 'Failed to duplicate')
    }
  }, [activePageId, siteId])

  // ?? Open link editor for a block prop (e.g. hero cta_primary) ??????????????
  const openLinkEditorForProp = useCallback((blockId: string, propKey: string, anchor: { x: number; y: number }) => {
    const pages = localPagesRef.current
    const blocksMap = localBlocksRef.current
    const pageId = findPageIdForBlock(blocksMap, pages, blockId, activePageId)
    if (!pageId) return
    const block = (blocksMap[pageId] || []).find(b => b.id === blockId)
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
  }, [activePageId, handleUpdateBlockProps])

  // ?? Open link editor for an overlay item (button / text / image / badge) ???
  const openLinkEditorForOverlay = useCallback((blockId: string, item: BlockOverlayItem, anchor: { x: number; y: number }) => {
    const pages = localPagesRef.current
    const pageId = findPageIdForBlock(localBlocksRef.current, pages, blockId, activePageId)
    if (!pageId) return
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
        const block = (localBlocksRef.current[pageId] || []).find(b => b.id === blockId)
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
  }, [activePageId, handleUpdateBlockProps])

  // ?? Context menus ????????????????????????????????????????????????????????
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

  const openInlineTextEditForBlock = useCallback((
    block: WebsiteBlock,
    initialFieldKey: string,
    clickX: number,
    clickY: number,
  ) => {
    const fields = listSectionTextFields(block.props as Record<string, unknown>, block.block_type as string)
    if (fields.length === 0) {
      toast.message('No editable text fields on this section')
      return
    }
    const fieldKey = fields.some(f => f.fieldKey === initialFieldKey)
      ? initialFieldKey
      : fields[0].fieldKey

    setSelectedBlockId(block.id)
    setOverlayImageTarget(null)
    setActiveTextTarget({ blockId: block.id, fieldKeys: [fieldKey] })
    setRightPanel('props')
    setRightCollapsed(false)
    setInlineTextEdit({
      blockId: block.id,
      fields,
      initialFieldKey: fieldKey,
      clickX,
      clickY,
    })
  }, [])

  openInlineTextEditForSelectedRef.current = (anchorX?: number, anchorY?: number) => {
    if (!selectedBlockId) return
    const pageId = findPageIdForBlock(localBlocksRef.current, localPagesRef.current, selectedBlockId, activePageId)
    const block = pageId ? (localBlocksRef.current[pageId] || []).find(b => b.id === selectedBlockId) : null
    if (!block) return
    const fields = listSectionTextFields(block.props as Record<string, unknown>, block.block_type as string)
    if (fields.length === 0) {
      toast.info('This section has no editable text fields')
      return
    }
    const fieldKey =
      activeTextTarget?.blockId === block.id
        ? primaryTextFieldKey(activeTextTarget) ?? fields[0].fieldKey
        : fields[0].fieldKey
    openInlineTextEditForBlock(
      block,
      fieldKey,
      anchorX ?? Math.round(window.innerWidth / 2),
      anchorY ?? 140,
    )
  }

  dismissBuilderUiRef.current = () => {
    dismissBuilderEscapeLayer(builderEscapeUiRef.current, builderEscapeActionsRef.current)
  }

  const openBlockContextMenu = useCallback((block: WebsiteBlock, e: React.MouseEvent) => {
    setSelectedBlockId(block.id)
    const suggested = BLOCK_AUTO_SOURCE[block.block_type as string]
    const rawDs = (block.props as any)?.data_source
    const dsType = normalizeSourceType(rawDs?.type)
    const dsLabel = dsType ? DATA_SOURCES.find(s => s.id === dsType)?.label : null
    const actions: ContextMenuAction[] = [
      {
        id: 'props',
        label: 'Block properties (side panel)',
        icon: SlidersHorizontal,
        onSelect: () => { setRightPanel('props'); setRightCollapsed(false) },
      },
      {
        id: 'edit',
        label: 'Edit text?',
        icon: Pencil,
        shortcut: 'E',
        onSelect: () => {
          const { field } = getBlockPrimaryText(block.block_type)
          openInlineTextEditForBlock(block, field, e.clientX, e.clientY)
        },
      },
      {
        id: 'style',
        label: 'Style & colors (side panel)',
        icon: Palette,
        onSelect: () => { setRightPanel('style'); setRightCollapsed(false) },
      },
      ...(getSectionLayoutOptions(block.block_type).length > 0 ? [{
        id: 'layout',
        label: 'Change section style',
        icon: Layout,
        onSelect: () => openLayoutPickerForBlock(block),
      }] : []),
      dsType ? {
        id: 'data',
        label: `Connected ? ${dsLabel}`,
        icon: Database,
        onSelect: () => { setRightPanel('data'); setRightCollapsed(false) },
      } : (suggested ? {
        id: 'connect',
        label: `? Connect to ${DATA_SOURCES.find(s => s.id === suggested)?.label}`,
        icon: Plug,
        onSelect: () => {
          handleUpdateBlockProps(block.id, { data_source: { type: suggested, auto: true } } as any)
          toast.success(`Connected to ${DATA_SOURCES.find(s => s.id === suggested)?.label}`)
        },
      } : {
        id: 'data-picker',
        label: 'Connect to live data?',
        icon: Database,
        onSelect: () => { setRightPanel('data'); setRightCollapsed(false) },
      }),
      { id: 'div1', label: '', divider: true },
      {
        id: 'media',
        label: 'Images & media upload',
        icon: ImageIcon,
        onSelect: () => { setLeftPanel('media'); setLeftCollapsed(false) },
      },
      { id: 'div2', label: '', divider: true },
      {
        id: 'up',
        label: 'Move section up on page',
        icon: ChevronUp,
        shortcut: '?',
        onSelect: () => handleMoveBlock(block.id, 'up'),
      },
      {
        id: 'down',
        label: 'Move section down on page',
        icon: ChevronDown,
        shortcut: '?',
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
        label: block.visible === false ? 'Show section' : 'Hide section',
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
        onSelect: () => confirmDeleteBlock(block.id),
      },
    ]
    setContextMenu({ x: e.clientX, y: e.clientY, actions })
  }, [handleUpdateBlockProps, confirmDeleteBlock, handleDuplicateBlock, openInlineTextEditForBlock, openLayoutPickerForBlock])

  const handleCanvasBlockContextMenuCapture = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-kiterp-modal]')) return
    if (target.closest('[data-overlay-root],[data-overlay-toolbar]')) return
    const blockRoot = target.closest('[data-block-id]') as HTMLElement | null
    if (!blockRoot) return
    const id = blockRoot.getAttribute('data-block-id')
    if (!id) return
    const block = activeBlocks.find(b => b.id === id)
    if (!block) return
    e.preventDefault()
    e.stopPropagation()
    openBlockContextMenu(block, e)
  }, [activeBlocks, openBlockContextMenu])

  const handleInlineTextFieldSave = useCallback((fieldKey: string, value: string) => {
    const s = inlineTextEditRef.current
    if (!s) return
    const pageId = findPageIdForBlock(localBlocksRef.current, localPagesRef.current, s.blockId, activePageId)
    const block = pageId
      ? (localBlocksRef.current[pageId] || []).find(b => b.id === s.blockId)
      : undefined
    const patch = buildPropPatchFromFieldKey(
      fieldKey,
      value,
      (block?.props ?? {}) as Record<string, unknown>,
    )
    handleUpdateBlockProps(s.blockId, patch as Partial<BlockProps>)
    setActiveTextTarget({ blockId: s.blockId, fieldKeys: [fieldKey] })
    setInlineTextEdit(prev => {
      if (!prev) return prev
      return {
        ...prev,
        fields: prev.fields.map(f => (f.fieldKey === fieldKey ? { ...f, value } : f)),
      }
    })
  }, [handleUpdateBlockProps, activePageId])

  const openOverlayContextMenu = useCallback((blockId: string, item: BlockOverlayItem, e: React.MouseEvent) => {
    if (!activePageId) return
    setSelectedBlockId(blockId)
    onOverlayLayerPicked(item.id, blockId)
    const isLinkable = item.type === 'button' || item.type === 'badge' || item.type === 'text' || item.type === 'image'
    const actions: ContextMenuAction[] = [
      ...(item.type === 'text' || item.type === 'button' || item.type === 'badge' ? [{
        id: 'edit-text',
        label: 'Edit text?',
        icon: Pencil,
        onSelect: () => {
          openTextPrompt({
            title: `Edit ${item.type} text`,
            placeholder: item.type === 'button' ? 'e.g. Book Now' : item.type === 'badge' ? 'e.g. NEW' : 'Type your text?',
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
        label: item.linkType && item.linkType !== 'none' ? `Edit link (${item.linkType})` : 'Connect link or product',
        icon: Link2,
        onSelect: () => openLinkEditorForOverlay(blockId, item, { x: e.clientX, y: e.clientY }),
      }] : []),
      ...((item.type === 'button' || item.type === 'badge') ? [{
        id: 'describe',
        label: item.description ? 'Edit description?' : 'Add description?',
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
      ...(item.type === 'image' ? [
        {
          id: 'upload-img',
          label: 'Upload image?',
          icon: Upload,
          onSelect: () => {
            onOverlayLayerPicked(item.id, blockId)
            openOverlayImageFilePicker()
          },
        },
        {
          id: 'library-img',
          label: 'Choose from library?',
          icon: ImageIcon,
          onSelect: () => {
            onOverlayLayerPicked(item.id, blockId)
            openMediaFromCanvas()
          },
        },
        {
          id: 'replace-img',
          label: 'Replace image?',
          icon: Link2,
          onSelect: () => {
            openTextPrompt({
              title: 'Replace image',
              subtitle: 'Paste a direct image URL.',
              placeholder: 'https://?/image.jpg',
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
        },
      ] : []),
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
          onOverlayLayerPicked(copy.id, blockId)
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
          if (overlayImageTarget?.blockId === blockId && overlayImageTarget.overlayId === item.id) {
            onOverlayLayerPicked(null, blockId)
          }
        },
      },
    ]
    setContextMenu({ x: e.clientX, y: e.clientY, actions })
  }, [activePageId, localBlocks, handleUpdateBlockProps, openLinkEditorForOverlay, openTextPrompt, openOverlayImageFilePicker, openMediaFromCanvas, onOverlayLayerPicked, overlayImageTarget])

  // Reorder ? local only until Save (same as block prop edits)
  const applyReorderForPage = useCallback((pageId: string, reordered: WebsiteBlock[]) => {
    if (!pageId) return
    pushHistory(JSON.parse(JSON.stringify(localBlocksRef.current)))
    const numbered = reordered.map((b, i) => ({ ...b, sort_order: i }))
    setLocalBlocks(prev => ({ ...prev, [pageId]: numbered }))
    setBlocksDirty(true)
  }, [pushHistory])

  const applyReorder = useCallback((reordered: WebsiteBlock[]) => {
    if (!activePageId) return
    applyReorderForPage(activePageId, reordered)
  }, [activePageId, applyReorderForPage])

  const computeBlockInsertIndex = useCallback((from: number, targetIdx: number, before: boolean) => {
    let insertAt = before ? targetIdx : targetIdx + 1
    if (from < insertAt) insertAt -= 1
    return insertAt
  }, [])

  const reorderBlocksByIndex = useCallback((from: number, targetIdx: number, before: boolean) => {
    if (from < 0 || targetIdx < 0 || from >= activeBlocks.length || targetIdx >= activeBlocks.length) return null
    const insertAt = computeBlockInsertIndex(from, targetIdx, before)
    if (insertAt === from) return null
    const reordered = [...activeBlocks]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(insertAt, 0, moved)
    return reordered
  }, [activeBlocks, computeBlockInsertIndex])

  const clearBlockDragState = useCallback(() => {
    draggingBlockIdxRef.current = null
    setDraggingBlockIdx(null)
    setDropTarget(null)
    stopDragAutoScroll()
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [stopDragAutoScroll])

  const findBlockDropTargetFromPointer = useCallback((clientY: number) => {
    const nodes = document.querySelectorAll<HTMLElement>('[data-block-index]')
    if (nodes.length === 0) return { idx: 0, before: true }

    const entries = Array.from(nodes).map(el => ({
      idx: Number(el.dataset.blockIndex),
      rect: el.getBoundingClientRect(),
    }))

    for (const { idx, rect } of entries) {
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return { idx, before: clientY < rect.top + rect.height / 2 }
      }
    }

    if (clientY < entries[0].rect.top) {
      return { idx: entries[0].idx, before: true }
    }

    const last = entries[entries.length - 1]
    if (clientY > last.rect.bottom) {
      return { idx: last.idx, before: false }
    }

    for (let i = 0; i < entries.length - 1; i++) {
      const a = entries[i]
      const b = entries[i + 1]
      if (clientY > a.rect.bottom && clientY < b.rect.top) {
        return { idx: b.idx, before: true }
      }
    }

    let bestIdx = entries[0].idx
    let bestBefore = true
    let bestDist = Infinity
    for (const { idx, rect } of entries) {
      const mid = rect.top + rect.height / 2
      const dist = Math.abs(clientY - mid)
      if (dist < bestDist) {
        bestDist = dist
        bestBefore = clientY < mid
        bestIdx = idx
      }
    }
    return { idx: bestIdx, before: bestBefore }
  }, [])

  const updateDropTargetFromPointer = useCallback((clientY: number) => {
    dragPointerYRef.current = clientY
    autoScrollCanvasForDrag(clientY)
    setDropTarget(findBlockDropTargetFromPointer(clientY))
  }, [autoScrollCanvasForDrag, findBlockDropTargetFromPointer])

  const startDragAutoScrollLoop = useCallback(() => {
    stopDragAutoScroll()
    const tick = () => {
      autoScrollCanvasForDrag(dragPointerYRef.current)
      if (draggingBlockIdxRef.current !== null) {
        setDropTarget(findBlockDropTargetFromPointer(dragPointerYRef.current))
        dragAutoScrollRafRef.current = requestAnimationFrame(tick)
      }
    }
    dragAutoScrollRafRef.current = requestAnimationFrame(tick)
  }, [autoScrollCanvasForDrag, findBlockDropTargetFromPointer, stopDragAutoScroll])

  const handleBlockReorderPointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    draggingBlockIdxRef.current = idx
    setDraggingBlockIdx(idx)
    dragPointerYRef.current = e.clientY
    setDropTarget({ idx, before: true })
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    startDragAutoScrollLoop()

    const pointerId = e.pointerId
    const onMove = (mv: PointerEvent) => {
      if (mv.pointerId !== pointerId) return
      updateDropTargetFromPointer(mv.clientY)
    }
    const onUp = (mv: PointerEvent) => {
      if (mv.pointerId !== pointerId) return
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      const from = draggingBlockIdxRef.current
      const target = findBlockDropTargetFromPointer(mv.clientY)
      if (from !== null) {
        const reordered = reorderBlocksByIndex(from, target.idx, target.before)
        if (reordered) applyReorder(reordered)
      }
      clearBlockDragState()
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
  }, [applyReorder, clearBlockDragState, findBlockDropTargetFromPointer, reorderBlocksByIndex, startDragAutoScrollLoop, updateDropTargetFromPointer])

  // Drag handlers (HTML5 ? used for new blocks from the left panel catalog)
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = draggingNewBlock ? 'copy' : 'move'
    dragPointerYRef.current = e.clientY
    autoScrollCanvasForDrag(e.clientY)
    if (draggingNewBlock || draggingBlockIdxRef.current !== null) {
      setDropTarget(findBlockDropTargetFromPointer(e.clientY))
    }
  }, [autoScrollCanvasForDrag, draggingNewBlock, findBlockDropTargetFromPointer])

  const handleDragOverBlock = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = draggingNewBlock ? 'copy' : 'move'
    dragPointerYRef.current = e.clientY
    autoScrollCanvasForDrag(e.clientY)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const before = e.clientY < rect.top + rect.height / 2
    setDropTarget({ idx, before })
  }
  const handleDropOnBlock = useCallback(async (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (draggingNewBlock) {
      const before = dropTarget?.idx === targetIdx ? dropTarget.before : true
      let insertIdx = before ? targetIdx : targetIdx + 1
      insertIdx = Math.max(0, Math.min(insertIdx, activeBlocks.length))
      if (shouldOpenLayoutPickerForBlock(draggingNewBlock)) {
        openSectionLayoutPicker(draggingNewBlock, insertIdx)
        setDraggingNewBlock(null)
        setDropTarget(null)
        return
      }
      await handleAddBlock(draggingNewBlock, insertIdx)
      setDraggingNewBlock(null)
      setDropTarget(null)
      return
    }
    const from = draggingBlockIdxRef.current
    if (from === null) { clearBlockDragState(); return }
    const before = dropTarget?.idx === targetIdx ? dropTarget.before : true
    const reordered = reorderBlocksByIndex(from, targetIdx, before)
    if (reordered) await applyReorder(reordered)
    clearBlockDragState()
  }, [draggingNewBlock, dropTarget, activeBlocks, handleAddBlock, applyReorder, reorderBlocksByIndex, clearBlockDragState, shouldOpenLayoutPickerForBlock, openSectionLayoutPicker])

  const handleDropOnCanvas = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDropTarget(null)
    if (draggingNewBlock) {
      if (shouldOpenLayoutPickerForBlock(draggingNewBlock)) {
        openSectionLayoutPicker(draggingNewBlock, activeBlocks.length)
        setDraggingNewBlock(null)
        return
      }
      await handleAddBlock(draggingNewBlock)
      setDraggingNewBlock(null)
      return
    }
    const from = draggingBlockIdxRef.current
    if (from !== null && activeBlocks.length > 0) {
      const reordered = [...activeBlocks]
      const [moved] = reordered.splice(from, 1)
      reordered.push(moved)
      await applyReorder(reordered)
    }
    clearBlockDragState()
  }, [draggingNewBlock, activeBlocks, handleAddBlock, applyReorder, clearBlockDragState, shouldOpenLayoutPickerForBlock, openSectionLayoutPicker])

  // Move block up/down/top/bottom ? optimistic (content blocks stay between nav and footer)
  const handleMoveBlock = useCallback((blockId: string, dir: 'up' | 'down' | 'top' | 'bottom') => {
    const pageId = activePageId
    if (!pageId) return
    const blocks = sortPageBlocks(localBlocksRef.current[pageId] || [])
    const fromIdx = blocks.findIndex(b => b.id === blockId)
    const toIdx = computeBlockMoveIndex(blocks, fromIdx, dir)
    if (toIdx == null) return
    const blockEl = builderPageRootRef.current?.querySelector(
      `[data-block-id="${CSS.escape(blockId)}"]`,
    ) as HTMLElement | null
    const anchorTop = blockEl?.getBoundingClientRect().top
    applyReorderForPage(pageId, reorderBlockByIndex(blocks, fromIdx, toIdx))
    if (anchorTop != null) compensateCanvasScrollForBlockMove(blockId, anchorTop)
  }, [activePageId, applyReorderForPage, compensateCanvasScrollForBlockMove])

  const handleMoveBlockOnPage = useCallback((pageId: string, blockId: string, dir: 'up' | 'down' | 'top' | 'bottom') => {
    const blocks = sortPageBlocks(localBlocksRef.current[pageId] || [])
    const fromIdx = blocks.findIndex(b => b.id === blockId)
    const toIdx = computeBlockMoveIndex(blocks, fromIdx, dir)
    if (toIdx == null) return
    const samePage = activePageId === pageId
    const blockEl = samePage
      ? builderPageRootRef.current?.querySelector(
        `[data-block-id="${CSS.escape(blockId)}"]`,
      ) as HTMLElement | null
      : null
    const anchorTop = blockEl?.getBoundingClientRect().top
    applyReorderForPage(pageId, reorderBlockByIndex(blocks, fromIdx, toIdx))
    if (!samePage) setActivePageId(pageId)
    if (samePage && anchorTop != null) {
      compensateCanvasScrollForBlockMove(blockId, anchorTop)
    } else {
      scrollCanvasToBlock(blockId)
    }
  }, [applyReorderForPage, activePageId, compensateCanvasScrollForBlockMove, scrollCanvasToBlock])

  const onSidebarSectionDragStart = (pageId: string, idx: number) => {
    setSidebarDraggedPageId(pageId)
    setSidebarDraggedIdx(idx)
  }
  const onSidebarSectionDragOver = (e: React.DragEvent, pageId: string, idx: number) => {
    e.preventDefault()
    if (sidebarDraggedPageId === pageId) setSidebarDragOverIdx(idx)
  }
  const onSidebarSectionDragEnd = () => {
    setSidebarDraggedPageId(null)
    setSidebarDraggedIdx(null)
    setSidebarDragOverIdx(null)
  }
  const onSidebarSectionDrop = (e: React.DragEvent, pageId: string, idx: number) => {
    e.preventDefault()
    if (sidebarDraggedPageId !== pageId || sidebarDraggedIdx === null || sidebarDraggedIdx === idx) {
      onSidebarSectionDragEnd()
      return
    }
    const blocks = (localBlocks[pageId] || []).slice().sort((a, b) => a.sort_order - b.sort_order)
    const reordered = [...blocks]
    const [moved] = reordered.splice(sidebarDraggedIdx, 1)
    reordered.splice(idx, 0, moved)
    applyReorderForPage(pageId, reordered)
    onSidebarSectionDragEnd()
  }
  const toggleBlockVisibility = (blockId: string, pageId: string) => {
    const block = (localBlocks[pageId] || []).find(b => b.id === blockId)
    if (!block) return
    handleUpdateBlockProps(blockId, { visible: block.visible === false } as Partial<BlockProps>)
  }

  const toggleSectionPageExpanded = (pageId: string) => {
    setExpandedSectionPages(prev => {
      const next = new Set(prev)
      if (next.has(pageId)) next.delete(pageId)
      else next.add(pageId)
      return next
    })
  }

  const selectPageSection = (pageId: string, blockId: string) => {
    setActivePageId(pageId)
    setSelectedBlockId(blockId)
    setRightPanel('props')
    setRightCollapsed(false)
  }

  const openSectionsPanel = useCallback(() => {
    setLeftPanel('blocks')
    setLeftCollapsed(false)
  }, [])

  // Insert a block after the currently selected block
  const handleAddBlockAfter = useCallback((blockType: string) => {
    if (!activePageId) return
    const def = BLOCK_CATALOG.find(d => d.type === blockType)
    if (!def) return
    const currentIdx = activeBlocks.findIndex(b => b.id === selectedBlockId)
    const insertIdx = currentIdx >= 0 ? currentIdx + 1 : activeBlocks.length
    openSectionLayoutPicker(def, insertIdx)
  }, [activePageId, activeBlocks, selectedBlockId, openSectionLayoutPicker])

  // "Add Section" panel: always INSERT a new section (after the selected block,
  // or at the end). Confirm when the page already has that section type.
  const handleAddSectionFromPanel = useCallback((def: BlockDef) => {
    if (!activePageId) return
    const currentIdx = activeBlocks.findIndex(b => b.id === selectedBlockId)
    const insertIdx = currentIdx >= 0 ? currentIdx + 1 : activeBlocks.length

    const proceed = () => {
      openSectionLayoutPicker(def, insertIdx, undefined, { insertOnly: true })
    }

    const replace = () => {
      const replaceId = (selectedSameType && selectedBlockId)
        ? selectedBlockId
        : activeBlocks.find(b => b.block_type === def.type)?.id
      if (!replaceId) return
      const replaceIdx = activeBlocks.findIndex(b => b.id === replaceId)
      openSectionLayoutPicker(def, replaceIdx >= 0 ? replaceIdx : 0, undefined, { replaceBlockId: replaceId })
    }

    const isStructure = GLOBAL_STRUCTURE_BLOCK_TYPES.has(def.type)
    const existingCount = activeBlocks.filter(b => b.block_type === def.type).length
    const selectedSameType = selectedBlockId
      ? activeBlocks.find(b => b.id === selectedBlockId)?.block_type === def.type
      : false

    if (!isStructure && (existingCount > 0 || selectedSameType)) {
      openTextPrompt({
        title: `Add another ${def.label}?`,
        subtitle: existingCount > 0
          ? `This page already has ${existingCount} ${def.label} section${existingCount > 1 ? 's' : ''}. Add another below, or replace one with a new layout.`
          : `You already have a ${def.label} section selected. Add another below it, or replace it with a new layout.`,
        confirmLabel: 'Add section',
        secondaryLabel: 'Replace',
        confirmOnly: true,
        onSecondary: async () => { replace() },
        onSave: async () => { proceed() },
      })
      return
    }

    proceed()
  }, [activePageId, activeBlocks, selectedBlockId, openSectionLayoutPicker, openTextPrompt])

  // Keep keyboard-shortcut ref in sync with latest handlers (avoids TDZ on init)
  kbHandlersRef.current.handleDeleteBlock = handleDeleteBlock
  kbHandlersRef.current.confirmDeleteBlock = confirmDeleteBlock
  kbHandlersRef.current.handleDuplicateBlock = handleDuplicateBlock
  kbHandlersRef.current.handleMoveBlock = handleMoveBlock

  const persistAllBlocksToServer = useCallback(async () => {
    if (!siteId) return
    const replacements: { pageId: string; tempId: string; saved: WebsiteBlock }[] = []
    const pages = [...localPagesRef.current].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const blocksToPersist = syncNavLinksInBlockMap(localBlocksRef.current, pages)

    await Promise.all(pages.map(async (page) => {
      const blocks = (blocksToPersist[page.id] || []).map((b, i) => ({ ...b, sort_order: i }))
      if (!blocks.length) return

      const pageReplacements: { tempId: string; saved: WebsiteBlock }[] = []
      const persistedBlocks: WebsiteBlock[] = []

      await Promise.all(blocks.map(async (b) => {
        if (b.id.startsWith('temp-')) {
          const existingSameType = GLOBAL_STRUCTURE_BLOCK_TYPES.has(b.block_type)
            ? blocks.find(x => x.block_type === b.block_type && !x.id.startsWith('temp-') && x.id !== b.id)
            : undefined
          if (existingSameType) {
            await websiteApi.updateBlock(siteId, page.id, existingSameType.id, {
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
            pageReplacements.push({ tempId: b.id, saved: { ...existingSameType, ...b, id: existingSameType.id } })
            persistedBlocks.push({ ...existingSameType, ...b, id: existingSameType.id })
            return
          }
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
          try {
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
          } catch (err) {
            if (!isAxiosError(err) || err.response?.status !== 404) throw err
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
            return
          }
          persistedBlocks.push(b)
        }
      }))

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
        localBlocksRef.current = next
        return next
      })
      const selectedReplacement = replacements.find(r => r.tempId === selectedBlockId)
      if (selectedReplacement) setSelectedBlockId(selectedReplacement.saved.id)
    }

    skipServerHydrateRef.current = Date.now()
    if (site) {
      const snapshot = localBlocksRef.current
      queryClient.setQueryData<WebsiteSite>(['websites', siteId], old =>
        old ? syncSiteQueryBlocks(old, snapshot) : old,
      )
    }
  }, [siteId, site, selectedBlockId, queryClient])

  const persistAllPagesToServer = useCallback(async () => {
    if (!siteId) return
    const realPages = localPages.filter(p => p.id && !p.id.startsWith('temp-'))
    if (realPages.length) {
      await websiteApi.reorderPages(
        siteId,
        realPages.map((page, i) => ({ id: page.id, sort_order: i })),
      )
    }
    for (const [idx, page] of realPages.entries()) {
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
  const handleSaveCanvas = useCallback(async (opts?: { silent?: boolean }) => {
    if (isSavingRef.current) return
    if (!styleDirty && !blocksDirty) return
    if (!siteId) return
    const saveBlocks = blocksDirty
    const saveStyle = styleDirty
    setIsSaving(true)
    isSavingRef.current = true
    setAutoSaveStatus('saving')
    try {
      if (saveBlocks) await persistAllBlocksToServer()
      if (saveStyle) await websiteApi.updateSite(siteId, { style_config: localStyle as any })
      setStyleDirty(false)
      setBlocksDirty(false)
      blocksDirtyRef.current = false
      styleDirtyRef.current = false
      skipServerHydrateRef.current = Date.now()
      setLastSavedAt(new Date())
      setAutoSaveStatus('synced')
      if (site) {
        const pages = localPagesRef.current
        const pageSlug = activePageId
          ? pages.find(p => p.id === activePageId)?.slug
          : undefined
        void pushDraftPreviewUpdate(
          siteId,
          buildPublicSitePayloadFromLocal(site, pages, localBlocksRef.current, localStyle),
          pageSlug,
        ).catch(() => { /* preview tab closed or not open */ })
      }
      if (!opts?.silent) {
        setSaveFlash(true)
        setTimeout(() => setSaveFlash(false), 1800)
        toast.success(saveBlocks && saveStyle ? 'Canvas and styles saved' : saveBlocks ? 'Canvas saved' : 'Styles saved')
      }
    } catch {
      setAutoSaveStatus('error')
      toast.error(opts?.silent ? 'Auto-save failed ? check your connection' : 'Save failed ? check your connection')
    }
    setIsSaving(false)
    isSavingRef.current = false
  }, [siteId, localStyle, styleDirty, blocksDirty, persistAllBlocksToServer, site, activePageId])

  const handleSaveCanvasRef = useRef(handleSaveCanvas)
  useEffect(() => { handleSaveCanvasRef.current = handleSaveCanvas }, [handleSaveCanvas])

  const autoSaveStorageKey = siteId ? `wb-autosave-enabled-${siteId}` : null

  useEffect(() => {
    if (!autoSaveStorageKey) return
    const stored = localStorage.getItem(autoSaveStorageKey)
    setAutoSaveEnabled(stored !== '0')
  }, [autoSaveStorageKey])

  const toggleAutoSave = useCallback(() => {
    setAutoSaveEnabled(prev => {
      const next = !prev
      if (autoSaveStorageKey) {
        localStorage.setItem(autoSaveStorageKey, next ? '1' : '0')
      }
      if (!next && autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
      toast.success(next ? 'Auto-save turned on' : 'Auto-save turned off ? use Save draft')
      return next
    })
  }, [autoSaveStorageKey])

  // Debounced auto-save when canvas or style changes
  useEffect(() => {
    if (!siteId || !autoSaveEnabled || (!blocksDirty && !styleDirty)) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
      if (!autoSaveEnabled && (blocksDirty || styleDirty)) {
        setAutoSaveStatus('pending')
      } else if (!blocksDirty && !styleDirty) {
        setAutoSaveStatus('synced')
      }
      return
    }

    setAutoSaveStatus(prev => (prev === 'saving' ? prev : 'pending'))

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null
      if (isSavingRef.current) return
      void handleSaveCanvasRef.current({ silent: true })
    }, AUTO_SAVE_DELAY_MS)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
      }
    }
  }, [blocksDirty, styleDirty, siteId, autoSaveEnabled])

  // Keep open browser preview in sync while editing (before auto-save completes).
  useEffect(() => {
    if (!siteId || !site || (!blocksDirty && !styleDirty)) return
    const timer = setTimeout(() => {
      const pages = localPagesRef.current
      const pageSlug = activePageId
        ? pages.find(p => p.id === activePageId)?.slug
        : undefined
      void pushDraftPreviewUpdate(
        siteId,
        buildPublicSitePayloadFromLocal(site, pages, localBlocksRef.current, localStyle),
        pageSlug,
      ).catch(() => { /* preview tab not open */ })
    }, 3500)
    return () => clearTimeout(timer)
  }, [blocksDirty, styleDirty, siteId, site, activePageId, localStyle])

  /** Save current canvas + publish to make the loaded template live on the store. */
  const handleApplyToStore = useCallback(async (opts?: { storeIds?: string[] }) => {
    if (!siteId || isApplyingToStore) return
    setIsApplyingToStore(true)
    setApplyPopoverOpen(false)
    setApplyPickerStep('root')
    const targetStoreIds = opts?.storeIds ?? (
      businessUnits.length === 1 ? [businessUnits[0].id] : businessUnits.map(s => s.id)
    )
    try {
      // Only persist if there are pending local changes ? avoids redundant API
      // calls when the user clicks Apply immediately after loading a template.
      if (blocksDirty || styleDirty) {
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
      if (targetStoreIds.length > 0) {
        setAppliedStoreIds(targetStoreIds)
        localStorage.setItem(`wb-applied-stores-${siteId}`, JSON.stringify(targetStoreIds))
      }
      const appliedNames = businessUnits
        .filter(s => targetStoreIds.includes(s.id))
        .map(s => s.name)
      const scopeLabel = appliedNames.length === 0
        ? 'your store'
        : appliedNames.length === businessUnits.length && businessUnits.length > 1
          ? `all ${appliedNames.length} ${BUSINESS_UNIT_STORE_LABEL}s`
          : appliedNames.join(', ')
      toast.success(`? Applied ? live on ${scopeLabel} with ${localPages.length} page${localPages.length !== 1 ? 's' : ''}.`)
    } catch (err) {
      toast.error(extractApiError(err, 'Apply to store'))
      console.error('[Apply to Store]', err)
    } finally {
      setIsApplyingToStore(false)
    }
  }, [siteId, isApplyingToStore, blocksDirty, styleDirty, persistAllPagesToServer, persistAllBlocksToServer, localStyle, localPages, queryClient, businessUnits])

  const isSiteApplied = Boolean(
    site?.is_published && !blocksDirty && !styleDirty && !isApplyingToStore,
  )

  const hasSaveChanges = styleDirty || blocksDirty
  const isCanvasSaved = !hasSaveChanges && !isSaving

  const autoSaveStatusLabel = useMemo(() => {
    if (!autoSaveEnabled) {
      if (hasSaveChanges) return 'Unsaved changes'
      if (lastSavedAt) {
        return `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      }
      return 'Auto-save off'
    }
    if (autoSaveStatus === 'pending') return 'Unsaved changes…'
    if (autoSaveStatus === 'saving' || isSaving) return 'Auto-saving…'
    if (autoSaveStatus === 'error') return 'Auto-save failed'
    if (lastSavedAt) {
      return `Auto-saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }
    return 'Auto-save on'
  }, [autoSaveEnabled, autoSaveStatus, hasSaveChanges, isSaving, lastSavedAt])

  const openApplyOptions = useCallback(() => {
    setApplyPickerStep('root')
    setApplyPopoverOpen(true)
  }, [])

  const handleApplyButtonClick = useCallback(() => {
    if (isApplyingToStore || applyingTemplateInline) return
    if (hasMultipleBusinessUnits) {
      openApplyOptions()
      return
    }
    void handleApplyToStore(
      businessUnits.length === 1 ? { storeIds: [businessUnits[0].id] } : undefined,
    )
  }, [isApplyingToStore, applyingTemplateInline, hasMultipleBusinessUnits, openApplyOptions, handleApplyToStore, businessUnits])

  const handleApplyAllBusinessUnits = useCallback(() => {
    void handleApplyToStore({ storeIds: businessUnits.map(s => s.id) })
  }, [handleApplyToStore, businessUnits])

  const handleApplySingleBusinessUnit = useCallback((storeId: string) => {
    void handleApplyToStore({ storeIds: [storeId] })
  }, [handleApplyToStore])

  // Add page — optimistic (uses styled prompt)
  const handleAddPage = useCallback(() => {
    openTextPrompt({
      title: 'Create new page',
      subtitle: 'This page is added to your site\'s navigation. You can reorder and rename it later.',
      placeholder: 'e.g. About Us, Services, Contact…',
      confirmLabel: 'Create page',
      onSave: async (title) => {
        if (!title?.trim()) return
        const slug = uniquePageSlug(
          title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'page',
          localPagesRef.current,
        )
        try {
          const page = await websiteApi.createPage(siteId!, { title, slug, page_type: 'custom', sort_order: localPagesRef.current.length } as any)
          skipServerHydrateRef.current = Date.now()
          setBlocksDirty(true)
          blocksDirtyRef.current = true
          const nextPages = [...localPagesRef.current, page]
          localPagesRef.current = nextPages
          setLocalPages(nextPages)
          const seededBlocks = seedStructureBlocksForNewPage(localBlocksRef.current, nextPages, page.id)
          const nextBlocks = { ...localBlocksRef.current, [page.id]: seededBlocks }
          commitLocalBlocks(nextBlocks)
          if (site) {
            queryClient.setQueryData<WebsiteSite>(['websites', siteId!], old => {
              if (!old) return old
              return {
                ...old,
                pages: [...old.pages, { ...page, blocks: seededBlocks }],
              }
            })
          }
          setActivePageId(page.id)
          toast.success('Page created')
        } catch { toast.error('Failed to create page') }
      },
    })
  }, [siteId, site, openTextPrompt, commitLocalBlocks, queryClient])

  // Delete page (soft delete — 7-day trash)
  const loadTrashedPages = useCallback(async (): Promise<PageTrashItem[]> => {
    if (!siteId) return []
    setTrashLoading(true)
    try {
      const items = await websiteApi.listTrashedPages(siteId)
      setTrashedPages(items)
      return items
    } catch (err) {
      setTrashedPages([])
      toast.error(extractApiError(err, 'Could not load deleted pages'))
      return []
    } finally {
      setTrashLoading(false)
    }
  }, [siteId])

  useEffect(() => {
    void loadTrashedPages()
  }, [loadTrashedPages])

  useEffect(() => {
    if (rightPanel === 'page' && siteId) {
      void loadTrashedPages()
    }
  }, [rightPanel, siteId, loadTrashedPages])

  const handleDeletePage = useCallback((pageId: string, pageTitle: string) => {
    const target = localPages.find(p => p.id === pageId)
    if (!target) return
    if (!isPersistedPageId(pageId)) {
      toast.error('Save this page first before moving it to trash.')
      return
    }
    if (countPersistedPages(localPages) <= 1) {
      toast.error('Your site needs at least one page.')
      return
    }
    const isHome = target.is_homepage
    openTextPrompt({
      title: `Move "${pageTitle}" to trash?`,
      subtitle: isHome
        ? 'This is your homepage. It stays in trash for 7 days and the next page becomes home automatically.'
        : 'The page stays in Recently deleted for 7 days. Restore anytime before then — after 7 days it is removed permanently.',
      confirmLabel: 'Move to trash',
      confirmOnly: true,
      destructive: true,
      onSave: async () => {
        const backupPages = localPages
        const backupBlocks = localBlocksRef.current
        const backupActivePageId = activePageId
        try {
          await websiteApi.deletePage(siteId!, pageId)
          const fresh = await websiteApi.getSite(siteId!)
          syncEditorPagesFromSite(fresh)
          const trash = await loadTrashedPages()
          if (!trash.some(p => p.id === pageId)) {
            toast.error('Page was removed but did not appear in Recently deleted. Click Refresh below or reload the builder.')
            return
          }
          toast.success(
            isHome
              ? `"${pageTitle}" moved to trash — another page is now home`
              : `"${pageTitle}" moved to trash — restore within 7 days in Recently deleted`,
          )
        } catch (err) {
          setLocalPages(backupPages)
          setLocalBlocks(backupBlocks)
          localBlocksRef.current = backupBlocks
          setActivePageId(backupActivePageId)
          toast.error(extractApiError(err, 'Failed to move page to trash'))
        }
      },
    })
  }, [siteId, localPages, activePageId, openTextPrompt, loadTrashedPages, syncEditorPagesFromSite])

  const handleRestorePage = useCallback(async (pageId: string, pageTitle: string) => {
    if (!siteId) return
    const trashed = trashedPages.find(p => p.id === pageId)
    try {
      const restored = await websiteApi.restorePage(siteId, pageId)
      const fresh = await websiteApi.getSite(siteId)
      syncEditorPagesFromSite(fresh, restored.id)
      setTrashedPages(prev => prev.filter(p => p.id !== pageId))
      if (trashed && restored.slug !== trashed.slug) {
        toast.success(`"${pageTitle}" restored as /${restored.slug} (original slug was in use)`)
      } else {
        toast.success(`"${pageTitle}" restored`)
      }
      void loadTrashedPages()
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to restore page'))
      void loadTrashedPages()
    }
  }, [siteId, trashedPages, syncEditorPagesFromSite, loadTrashedPages])

  const handleDuplicatePage = useCallback(async (page: WebsitePage) => {
    if (!siteId) return
    try {
      const slug = uniquePageSlug(`${page.slug}-copy`, localPagesRef.current)
      const newPage = await websiteApi.createPage(siteId, {
        title: `${page.title} (Copy)`,
        slug,
        page_type: page.page_type,
        sort_order: localPagesRef.current.length,
      } as any)
      const currentBlocks = localBlocksRef.current[page.id] || []
      const duplicatedBlocks: WebsiteBlock[] = []
      for (const block of currentBlocks) {
        const saved = await websiteApi.createBlock(siteId, newPage.id, {
          block_type: block.block_type,
          label: block.label,
          props: block.props,
          sort_order: block.sort_order,
          visible: block.visible !== false,
          visible_on_mobile: block.visible_on_mobile !== false,
          visible_on_tablet: block.visible_on_tablet !== false,
          visible_on_desktop: block.visible_on_desktop !== false,
        } as any)
        duplicatedBlocks.push(saved)
      }
      skipServerHydrateRef.current = Date.now()
      const nextPages = [...localPagesRef.current, newPage]
      localPagesRef.current = nextPages
      setLocalPages(nextPages)
      const nextBlocks = {
        ...localBlocksRef.current,
        [newPage.id]: duplicatedBlocks.sort((a, b) => a.sort_order - b.sort_order),
      }
      commitLocalBlocks(nextBlocks)
      if (site) {
        queryClient.setQueryData<WebsiteSite>(['websites', siteId], old => {
          if (!old) return old
          return {
            ...old,
            pages: [...old.pages, { ...newPage, blocks: nextBlocks[newPage.id] }],
          }
        })
      }
      setActivePageId(newPage.id)
      setSelectedBlockId(null)
      toast.success(`"${page.title}" duplicated`)
    } catch {
      toast.error('Failed to duplicate page')
    }
  }, [siteId, site, commitLocalBlocks, queryClient])

  const handleSetHomepage = useCallback(async (page: WebsitePage) => {
    if (!siteId || page.is_homepage) return
    try {
      await websiteApi.updatePage(siteId, page.id, { is_homepage: true } as any)
      setLocalPages(prev => prev.map(p => ({ ...p, is_homepage: p.id === page.id })))
      toast.success(`"${page.title}" set as homepage`)
    } catch {
      toast.error('Failed to set homepage')
    }
  }, [siteId])

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
    clearPendingPreviewTabNavigate()
    clearPendingPreviewTabError()
    const previewTab = prepareDraftPreviewTab()
    setOpeningBrowserPreview(true)
    try {
      const payload = buildPublicSitePayloadFromLocal(site, localPages, localBlocks, localStyle)
      const { preview_token } = await websiteApi.createBuilderPreview(siteId, {
        payload,
        label: `Preview ${new Date().toLocaleString()}`,
      })
      rememberDraftPreviewSession(siteId, preview_token)
      const url = buildVendorDraftPreviewUrl(preview_token, activePage?.slug)
      const delivered = navigateDraftPreviewTab(url)
      if (!delivered) {
        try {
          await navigator.clipboard.writeText(url)
          toast.error('Pop-up blocked. Preview link copied — paste it into a new tab.', { duration: 8000 })
        } catch {
          toast.error(`Could not open preview tab. Open this URL manually: ${url}`, { duration: 12000 })
        }
      } else if (!previewTab) {
        toast.message('Preview opened in a new tab', { duration: 3000 })
      }
    } catch (err) {
      console.error('[BrowserPreview] failed:', err)
      let message: string
      if (isBuilderPreviewInfraFailure(err)) {
        message = 'Draft preview is not available on this server (run alembic upgrade web006 on the database your API uses, then restart the API). Preview opens on localhost:3001 only.'
      } else {
        message = extractApiError(err, 'Browser preview')
      }
      toast.error(message)
      // Stop the opened preview tab from hanging on "Preparing…" forever.
      broadcastPreviewTabError(message)
    } finally {
      setOpeningBrowserPreview(false)
    }
  }, [siteId, site, myVendor, localPages, localBlocks, localStyle, activePage, siteTestUrl])

  // Update data source on selected block
  const handleUpdateDataSource = useCallback((ds: any) => {
    if (!selectedBlockId || !activePageId) return
    const block = (localBlocks[activePageId] || []).find(b => b.id === selectedBlockId)
    if (!block) return
    handleUpdateBlockProps(selectedBlockId, { data_source: ds } as any)
  }, [selectedBlockId, activePageId, localBlocks, handleUpdateBlockProps])

  // Device widths + canvas fit/zoom
  const designWidthPx = customDeviceWidths[device]
  const [canvasFitScale, setCanvasFitScale] = useState(1)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [canvasPreviewHeight, setCanvasPreviewHeight] = useState(600)
  const effectiveCanvasScale = canvasFitScale * canvasZoom

  const clampCanvasZoom = useCallback((z: number) => (
    Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, Math.round(z * 100) / 100))
  ), [])

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [liveTime, setLiveTime] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  /** Editable zoom field: null when not editing, otherwise the in-progress text. */
  const [zoomInputDraft, setZoomInputDraft] = useState<string | null>(null)
  const commitZoomInput = useCallback((raw: string) => {
    const pct = parseInt(raw.replace(/[^0-9]/g, ''), 10)
    if (Number.isFinite(pct) && pct > 0 && canvasFitScale > 0) {
      setCanvasZoom(clampCanvasZoom((pct / 100) / canvasFitScale))
    }
    setZoomInputDraft(null)
  }, [canvasFitScale, clampCanvasZoom])

  useEffect(() => {
    setCanvasZoom(1)
  }, [device])

  useLayoutEffect(() => {
    const main = canvasMainRef.current
    if (!main) return
    const recalcScale = () => {
      const available = Math.max(0, main.clientWidth - CANVAS_VIEWPORT_PAD_PX)
      if (available <= 0) return
      const next = available / designWidthPx
      setCanvasFitScale(prev => (Math.abs(prev - next) < 0.0001 ? prev : next))
    }
    recalcScale()
    const raf = requestAnimationFrame(recalcScale)
    const ro = new ResizeObserver(recalcScale)
    ro.observe(main)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [designWidthPx, leftCollapsed, rightCollapsed, leftWidth, rightWidth, isLoading, site, activePageId])

  useLayoutEffect(() => {
    const main = canvasMainRef.current
    if (!main) return
    main.scrollLeft = 0
    // Keep preview fitted when side panels resize (user can zoom again after).
    setCanvasZoom(1)
  }, [canvasFitScale, designWidthPx, leftCollapsed, rightCollapsed, leftWidth, rightWidth])

  useLayoutEffect(() => {
    const inner = canvasPreviewInnerRef.current
    if (!inner) return
    let raf = 0
    const recalcHeight = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const next = Math.max(600, Math.ceil(inner.scrollHeight))
        setCanvasPreviewHeight(prev => (prev === next ? prev : next))
      })
    }
    recalcHeight()
    const ro = new ResizeObserver(recalcHeight)
    ro.observe(inner)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [activePageId, device, canvasBlocksRevision])

  const scaledCanvasWidth = Math.round(designWidthPx * effectiveCanvasScale)

  useLayoutEffect(() => {
    const main = canvasMainRef.current
    if (!main) return
    const maxScrollLeft = Math.max(0, scaledCanvasWidth + CANVAS_VIEWPORT_PAD_PX - main.clientWidth)
    if (main.scrollLeft > maxScrollLeft) main.scrollLeft = maxScrollLeft
  }, [scaledCanvasWidth, leftCollapsed, rightCollapsed, leftWidth, rightWidth])

  const prevCanvasZoomRef = useRef(canvasZoom)
  useLayoutEffect(() => {
    const main = canvasMainRef.current
    if (!main) return
    const maxScrollLeft = Math.max(0, scaledCanvasWidth + CANVAS_VIEWPORT_PAD_PX - main.clientWidth)
    if (prevCanvasZoomRef.current !== canvasZoom && maxScrollLeft > 0) {
      main.scrollLeft = maxScrollLeft / 2
    }
    prevCanvasZoomRef.current = canvasZoom
  }, [canvasZoom, scaledCanvasWidth])

  // The canvas uses overflow-x:hidden (no native horizontal bar), so translate
  // horizontal trackpad swipes / shift+wheel into programmatic horizontal scroll.
  // Vertical wheel still scrolls natively (overflow-y:auto).
  useEffect(() => {
    const main = canvasMainRef.current
    if (!main) return
    const onWheel = (e: WheelEvent) => {
      // Ctrl/Cmd + wheel = zoom (trackpad pinch dispatches ctrlKey wheel events).
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setCanvasZoom(z => clampCanvasZoom(z - e.deltaY * 0.01))
        return
      }
      const maxScrollLeft = main.scrollWidth - main.clientWidth
      if (maxScrollLeft <= 0) return
      // Horizontal intent: trackpad deltaX, or Shift + vertical wheel.
      const horizontal =
        Math.abs(e.deltaX) > Math.abs(e.deltaY)
          ? e.deltaX
          : e.shiftKey
            ? e.deltaY
            : 0
      if (horizontal === 0) return
      const next = Math.max(0, Math.min(maxScrollLeft, main.scrollLeft + horizontal))
      if (next !== main.scrollLeft) {
        main.scrollLeft = next
        e.preventDefault()
      }
    }
    main.addEventListener('wheel', onWheel, { passive: false })
    return () => main.removeEventListener('wheel', onWheel)
  }, [clampCanvasZoom])

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

  const connectableBlocks = activeBlocks.filter(b => BLOCK_AUTO_SOURCE[b.block_type as string])
  const disconnectedBlocks = connectableBlocks.filter(b => !normalizeSourceType((b.props as any)?.data_source?.type))
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

      <BuilderCanvasInlineTextEdit
        session={inlineTextEdit}
        onSaveField={handleInlineTextFieldSave}
        onClose={() => setInlineTextEdit(null)}
      />

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
          secondaryLabel={textPrompt.secondaryLabel}
          helpText={textPrompt.helpText}
          minLength={textPrompt.minLength}
          confirmOnly={textPrompt.confirmOnly}
          destructive={textPrompt.destructive}
          onSave={async (v) => { await textPrompt.onSave(v) }}
          onSecondary={textPrompt.onSecondary ? async () => { await textPrompt.onSecondary!() } : undefined}
          onClose={() => setTextPrompt(null)}
        />
      )}

      {sectionLayoutPicker && site && (
        <SectionLayoutPickerModal
          def={sectionLayoutPicker.def}
          defaultImageCategoryId={
            (layoutPickerCurrentProps?._image_category_id as string | undefined)
            || suggestImageCategoryForBlock(sectionLayoutPicker.def.category, site)
          }
          currentProps={layoutPickerCurrentProps}
          onSelect={(propsOverride, imageCategoryId, dataSourceChoice) => {
            void handleSelectSectionLayout(propsOverride, imageCategoryId, dataSourceChoice)
          }}
          onClose={() => setSectionLayoutPicker(null)}
        />
      )}

      {/* ── Command Palette ─────────────────────────────────────────── */}
      <BuilderCommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        activeBlocks={activeBlocks.map(b => ({
          id: b.id,
          label: (b.props as any)?.headline || (b.props as any)?.title || (b.props as any)?.brand || b.block_type,
          blockType: b.block_type,
        }))}
        pages={localPages}
        activePageId={activePageId}
        blockCatalog={[...BLOCK_CATALOG] as CommandPaletteBlockDef[]}
        selectedBlockId={selectedBlockId}
        canUndo={canUndo}
        canRedo={canRedo}
        device={device}
        onSelectBlock={(id) => {
          setSelectedBlockId(id)
          setLeftCollapsed(true)
        }}
        onNavigatePage={(id) => {
          setActivePageId(id)
        }}
        onAddSection={(def) => {
          handleAddSectionFromPanel(def as any)
          setLeftCollapsed(true)
        }}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={() => void handleSaveCanvas()}
        onPreview={() => void handleOpenBrowserPreview()}
        onDuplicateBlock={(id) => handleDuplicateBlock(id)}
        onDeleteBlock={(id) => confirmDeleteBlock(id)}
        onDeselectBlock={() => setSelectedBlockId(null)}
        onSetDevice={setDevice}
        onSetZoom={(z) => setCanvasZoom(z)}
        onFitZoom={() => { setCanvasZoom(1); if (canvasMainRef.current) canvasMainRef.current.scrollLeft = 0 }}
        onOpenPanel={(panel) => {
          setLeftPanel(panel)
          setLeftCollapsed(false)
        }}
        onOpenRightPanel={(panel) => {
          setRightPanel(panel)
          setRightCollapsed(false)
        }}
        onOpenHelp={() => { restoreBuilderCoachMarks() }}
      />

      {/* ── Top Toolbar ──────────────────────────────────────────────── */}
      <header className="relative z-40 shrink-0 bg-gray-900 text-white shadow-lg isolate">
        {/* Row 1: scrollable controls + pinned actions (actions stay outside overflow so rings/popovers aren't clipped) */}
        <div className="relative z-20 flex items-stretch border-b border-gray-800 bg-gray-900">
          <div className="min-w-0 flex-1 overflow-x-auto hide-scrollbar overscroll-x-contain">
            <div className="flex items-center gap-2 sm:gap-2.5 px-3 sm:pl-5 py-1 min-w-max">
          {/* Back */}
          <button onClick={() => navigate('/websites')} className={cn('flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors', BUILDER_CRISP_LABEL)}>
            <ArrowLeft className="w-4 h-4" /> Sites
          </button>
          <div className="w-px h-5 bg-gray-700 shrink-0" />

          {/* Site name */}
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="w-4 h-4 text-primary/70 shrink-0" />
            <span className="text-sm font-semibold truncate max-w-[180px] antialiased">{site.name}</span>
            {isTemplateMode ? (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold leading-none antialiased bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 whitespace-nowrap">
                Template Edit — {templateModeName}
              </span>
            ) : (
              <div className="flex flex-col gap-0.5">
                <div
                  className="flex items-center gap-1.5"
                  title={
                    !autoSaveEnabled
                      ? 'Auto-save is off — use Save to keep changes'
                      : autoSaveStatus === 'error'
                        ? 'Auto-save failed — use Save to retry'
                        : `Changes auto-save after ${AUTO_SAVE_DELAY_MS / 1000}s of inactivity`
                  }
                >
                  {autoSaveStatus === 'saving' || isSaving ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" />
                  ) : autoSaveStatus === 'error' ? (
                    <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />
                  ) : autoSaveStatus === 'pending' || (hasSaveChanges && !autoSaveEnabled) ? (
                    <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                  )}
                  <span className={cn(
                    'truncate text-[10px] font-medium leading-none antialiased sm:text-[11px]',
                    autoSaveStatus === 'error' ? 'text-amber-300' : (autoSaveStatus === 'pending' || (hasSaveChanges && !autoSaveEnabled)) ? 'text-amber-200' : 'text-gray-400',
                  )}>
                    {autoSaveStatusLabel}
                  </span>
                </div>
                <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-semibold leading-none antialiased', site.is_published ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40' : 'bg-gray-700 text-gray-400')}>
                  {site.is_published ? 'Live for customers' : 'Not live yet'}
                </span>
              </div>
            )}
          </div>

          {/* Draft save cluster: toggle + save */}
          <div className="flex shrink-0 items-center gap-1.5">
              {/* Toggle + Save merged group */}
              <div className={cn(
                'relative inline-flex h-6 shrink-0 items-stretch overflow-hidden rounded-full border transition-colors',
                hasSaveChanges && !isSaving
                  ? 'border-amber-400/50 bg-amber-500/10'
                  : saveFlash
                    ? 'border-emerald-400/40 bg-emerald-500/10'
                    : 'border-white/30 bg-gray-900/40',
              )}>
                <button
                  type="button"
                  onClick={toggleAutoSave}
                  title={autoSaveEnabled ? 'Turn auto-save off' : 'Turn auto-save on'}
                  aria-pressed={autoSaveEnabled}
                  aria-label={autoSaveEnabled ? 'Auto-save on' : 'Auto-save off'}
                  className="relative inline-flex w-12 shrink-0 items-center hover:bg-white/10 transition-colors"
                >
                  <span
                    className={cn(
                      'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-all duration-200 ease-out',
                      autoSaveEnabled ? 'right-0.5' : 'left-0.5',
                    )}
                  />
                  <span className={cn(
                    'relative z-10 w-full text-[9px] font-semibold tracking-wide text-white',
                    autoSaveEnabled ? 'pl-1.5 pr-5 text-left' : 'pl-5 pr-1.5 text-right',
                  )}>
                    {autoSaveEnabled ? 'On' : 'Off'}
                  </span>
                </button>

                <span className="w-px self-stretch bg-white/20" aria-hidden />

                <button
                  type="button"
                  onClick={hasSaveChanges ? () => void handleSaveCanvas() : undefined}
                  disabled={isSaving || !hasSaveChanges}
                  title={
                    hasSaveChanges
                      ? 'Save draft (does not publish to customers)'
                      : lastSavedAt
                        ? `Draft saved at ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : 'Draft saved'
                  }
                  aria-label={isSaving ? 'Saving draft' : hasSaveChanges ? 'Save draft' : 'Draft saved'}
                  className={cn(
                    'relative inline-flex items-center gap-1.5 px-2 text-[11px] font-semibold leading-none antialiased whitespace-nowrap transition-colors',
                    hasSaveChanges && !isSaving
                      ? 'text-amber-100 hover:bg-amber-500/20'
                      : saveFlash
                        ? 'text-emerald-200'
                        : 'text-gray-400',
                    (isSaving || !hasSaveChanges) && !saveFlash && 'cursor-default opacity-70',
                  )}
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : saveFlash || isCanvasSaved ? (
                    <Check className="h-3.5 w-3.5 shrink-0 stroke-[1.75]" />
                  ) : (
                    <Save className="h-3.5 w-3.5 shrink-0 stroke-[1.75]" />
                  )}
                  {isSaving ? 'Saving…' : saveFlash || isCanvasSaved ? 'Saved' : 'Save'}
                  {hasSaveChanges && !isSaving && !saveFlash && (
                    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                  )}
                </button>
              </div>
            </div>

              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
                className={cn(
                  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors',
                  canUndo
                    ? 'border-gray-600 text-gray-200 hover:text-white hover:bg-gray-700 bg-gray-800'
                    : 'border-gray-700/60 text-gray-500/50 cursor-not-allowed bg-gray-800/60',
                )}
              >
                <Undo2 className="w-3.5 h-3.5 shrink-0" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
                className={cn(
                  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-colors',
                  canRedo
                    ? 'border-gray-600 text-gray-200 hover:text-white hover:bg-gray-700 bg-gray-800'
                    : 'border-gray-700/60 text-gray-500/50 cursor-not-allowed bg-gray-800/60',
                )}
              >
                <Redo2 className="w-3.5 h-3.5 shrink-0" />
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
                title="Reset to last saved site from the server (discards unsaved canvas and style changes)"
                className={cn(
                  'inline-flex h-6 shrink-0 items-center gap-1 rounded-lg border px-2 text-[11px] font-semibold leading-none antialiased whitespace-nowrap transition-colors',
                  siteId && !resettingCanvasFromServer && !applyingTemplateInline && !clearingTemplateSandbox
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700/70 bg-gray-800/50'
                    : 'border-gray-600 text-gray-500 cursor-not-allowed bg-gray-800/50',
                )}
              >
                {resettingCanvasFromServer ? (
                  <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3 shrink-0" />
                )}
                Reset
              </button>

              <button
                type="button"
                aria-label="Deselect section"
                aria-hidden={!selectedBlockId}
                tabIndex={selectedBlockId ? 0 : -1}
                onClick={() => setSelectedBlockId(null)}
                className={cn(
                  'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold leading-none antialiased text-gray-300 bg-gray-700/60 hover:bg-gray-700 transition-colors',
                  !selectedBlockId && 'invisible pointer-events-none',
                )}
              >
                <X className="w-3 h-3 shrink-0" /> Deselect
                <BuilderShortcutKbd className="border-gray-600 bg-gray-800 text-gray-400 shadow-none">Esc</BuilderShortcutKbd>
              </button>

              <div className="inline-flex h-6 shrink-0 items-center gap-0.5 rounded-lg border border-gray-600 bg-gray-900/50 px-1">
                <button
                  type="button"
                  title="Zoom out"
                  disabled={canvasZoom <= CANVAS_ZOOM_MIN}
                  onClick={() => setCanvasZoom(z => clampCanvasZoom(z - CANVAS_ZOOM_STEP))}
                  className="p-1 rounded hover:bg-gray-700 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <div className="flex shrink-0 items-center">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Zoom percentage"
                    title="Type a zoom %, then press Enter"
                    value={zoomInputDraft ?? String(Math.round(effectiveCanvasScale * 100))}
                    onChange={e => setZoomInputDraft(e.target.value.replace(/[^0-9]/g, ''))}
                    onFocus={e => {
                      setZoomInputDraft(String(Math.round(effectiveCanvasScale * 100)))
                      requestAnimationFrame(() => e.target.select())
                    }}
                    onBlur={e => commitZoomInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); commitZoomInput((e.target as HTMLInputElement).value) }
                      if (e.key === 'Escape') { e.preventDefault(); setZoomInputDraft(null); (e.target as HTMLInputElement).blur() }
                    }}
                    className="w-8 shrink-0 bg-transparent text-center text-[12px] font-semibold leading-none tabular-nums text-gray-200 outline-none antialiased"
                  />
                  <span className="text-[12px] font-semibold leading-none text-gray-400">%</span>
                </div>
                <button
                  type="button"
                  title="Zoom in"
                  disabled={canvasZoom >= CANVAS_ZOOM_MAX}
                  onClick={() => setCanvasZoom(z => clampCanvasZoom(z + CANVAS_ZOOM_STEP))}
                  className="p-1 rounded hover:bg-gray-700 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Reset zoom to fit width"
                  onClick={() => {
                    setCanvasZoom(1)
                    const main = canvasMainRef.current
                    if (main) main.scrollLeft = 0
                  }}
                  aria-hidden={canvasZoom === 1}
                  tabIndex={canvasZoom === 1 ? -1 : 0}
                  className={cn(
                    'ml-0.5 shrink-0 rounded border-l border-gray-600 pl-1.5 pr-1 text-[11px] font-semibold leading-none text-primary hover:bg-gray-700 antialiased',
                    canvasZoom === 1 && 'invisible pointer-events-none',
                  )}
                >
                  Fit
                </button>
              </div>

              {/* Command palette trigger */}
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                title="Search sections, pages, commands… (⌘K)"
                className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-lg border border-gray-600 bg-gray-800/60 px-2 text-[11px] font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
              >
                <Search className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline text-gray-500">Search…</span>
                <kbd className="rounded border border-gray-700 bg-gray-900 px-1 py-px text-[9px] font-semibold text-gray-500">⌘K</kbd>
              </button>

              {/* Live clock */}
              <span
                className="hidden md:inline-flex h-6 shrink-0 items-center rounded-lg border border-gray-700 bg-gray-900/50 px-2 text-[11px] font-semibold leading-none tabular-nums text-gray-400"
                title="Current time"
              >
                {liveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>

            </div>
          </div>

          {/* Pinned actions — outside overflow-x-auto so dropdowns aren't clipped */}
          <div className="flex shrink-0 items-center gap-1.5 border-l border-gray-800 px-2.5">
            {/* Device dropdown */}
            <div className="relative shrink-0" ref={deviceDropdownRef}>
              {(() => {
                const active = DEVICE_SWITCHER.find(d => d.mode === device) ?? DEVICE_SWITCHER[0]
                return (
                  <button
                    type="button"
                    onClick={() => setDeviceDropdownOpen(v => !v)}
                    title={`${active.label} view (${customDeviceWidths[device]}px) — click to switch`}
                    aria-haspopup="listbox"
                    aria-expanded={deviceDropdownOpen}
                    className={cn(
                      'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors',
                      deviceDropdownOpen
                        ? 'border-primary/50 bg-primary/15 text-primary'
                        : 'border-gray-600 bg-gray-800 text-gray-200 hover:text-white hover:bg-gray-700',
                    )}
                  >
                    <active.Icon className="w-3 h-3 shrink-0" />
                  </button>
                )
              })()}

              {deviceDropdownOpen && (
                <div className="absolute right-0 top-full z-[300] mt-1 w-44 rounded-xl border border-gray-200 bg-white py-1 text-gray-800 shadow-2xl">
                  {DEVICE_SWITCHER.map(({ mode, Icon, label }) => (
                    <button
                      key={mode}
                      type="button"
                      role="option"
                      aria-selected={device === mode}
                      onClick={() => { setDevice(mode); setDeviceDropdownOpen(false) }}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-semibold transition-colors',
                        device === mode ? 'bg-primary/5 text-primary' : 'text-gray-700 hover:bg-gray-50',
                      )}
                    >
                      <Icon className={cn('w-3.5 h-3.5 shrink-0', device === mode ? 'text-primary' : 'text-gray-400')} />
                      <span className="flex-1">{label}
                        <span className="block text-[10px] font-normal text-gray-400">{customDeviceWidths[mode]}px</span>
                      </span>
                      {device === mode && <Check className="w-3 h-3 shrink-0 text-primary" />}
                    </button>
                  ))}

                  <div className="border-t border-gray-100 px-3 py-2.5">
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
                      Canvas width (px)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={320}
                        max={2560}
                        step={1}
                        value={deviceWidthDraft ?? customDeviceWidths[device]}
                        onChange={e => setDeviceWidthDraft(e.target.value)}
                        onBlur={e => {
                          const val = parseInt(e.target.value, 10)
                          if (!isNaN(val) && val >= 320 && val <= 2560) {
                            setCustomDeviceWidths(prev => ({ ...prev, [device]: val }))
                          }
                          setDeviceWidthDraft(null)
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                          if (e.key === 'Escape') { setDeviceWidthDraft(null); (e.target as HTMLInputElement).blur() }
                        }}
                        onClick={e => e.stopPropagation()}
                        placeholder="e.g. 1440"
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-800 outline-none focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        title="Reset to default"
                        onClick={e => {
                          e.stopPropagation()
                          setCustomDeviceWidths(prev => ({ ...prev, [device]: CANVAS_DESIGN_WIDTH[device] }))
                          setDeviceWidthDraft(null)
                        }}
                        className="shrink-0 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-1.5 text-[10px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                      >
                        ↺
                      </button>
                    </div>
                    <p className="mt-1 text-[9px] text-gray-400">320 – 2560 px · Enter to apply</p>
                  </div>
                </div>
              )}
            </div>

            <button
                type="button"
                disabled={openingBrowserPreview}
                onClick={() => void handleOpenBrowserPreview()}
                title="Preview your draft in the browser (same host as this tab, vendor-web only)"
                className={cn(
                  STOREFRONT_PREVIEW_IN_BROWSER_BTN_CLASS,
                  'py-1 text-[11px] sm:text-[12px]',
                  openingBrowserPreview && 'opacity-70 cursor-wait hover:bg-accent/95',
                )}
              >
                {openingBrowserPreview ? (
                  <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-primary" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                )}
                Preview
              </button>

              {/* More: publish, view store, history, copy template */}
              <div className="relative shrink-0" ref={moreMenuRef}>
                <button
                  type="button"
                  onClick={() => { setMoreMenuOpen(v => !v); setChangeHistoryOpen(false) }}
                  title="More — publish, view store, change history"
                  aria-haspopup="menu"
                  aria-expanded={moreMenuOpen}
                  className={cn(
                    'inline-flex h-6 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-semibold leading-none antialiased whitespace-nowrap transition-colors sm:text-[12px]',
                    moreMenuOpen
                      ? 'border-primary/50 bg-primary/15 text-primary'
                      : 'border-gray-600 text-gray-200 hover:text-white hover:bg-gray-700 bg-gray-800',
                  )}
                >
                  <MoreHorizontal className="h-3.5 w-3.5 shrink-0" />
                  More
                  <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', moreMenuOpen && 'rotate-180')} />
                </button>

                {moreMenuOpen && (
                  <div className="absolute right-0 top-full z-[300] mt-1.5 w-72 rounded-xl border border-gray-200 bg-white text-gray-800 shadow-2xl">
                    <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      Publish &amp; share
                    </p>

                    {/* Publish store (with multi-unit picker) */}
                    <div className="relative" ref={applyPopoverRef}>
                      <button
                        type="button"
                        disabled={isApplyingToStore || applyingTemplateInline}
                        onClick={handleApplyButtonClick}
                        title={
                          isSiteApplied
                            ? 'Your store is live — publish latest changes again'
                            : 'Save and publish this design so customers can see it on your store'
                        }
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs font-semibold text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isApplyingToStore ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
                        ) : (
                          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                        )}
                        <span className="flex-1">
                          {isApplyingToStore ? 'Publishing…' : isSiteApplied ? 'Live on store' : 'Publish store'}
                          <span className="block text-[10px] font-normal text-gray-400">
                            Make this design live for customers
                          </span>
                        </span>
                      </button>

                      {applyPopoverOpen && hasMultipleBusinessUnits && (
                        <div className="absolute right-0 top-full z-[320] mt-1 w-72 rounded-xl border border-gray-200 bg-white text-gray-800 shadow-2xl overflow-hidden">
                          {applyPickerStep === 'root' ? (
                            <div className="p-2 space-y-1">
                              <p className="px-2 pt-1 pb-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                {isSiteApplied ? 'Apply again' : 'Choose scope'}
                              </p>
                              <button
                                type="button"
                                onClick={() => void handleApplyAllBusinessUnits()}
                                className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                              >
                                Apply for all {BUSINESS_UNIT_STORE_LABEL}s
                                <span className="block text-[10px] font-normal text-gray-400 mt-0.5">
                                  {businessUnits.length} units
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setApplyPickerStep('units')}
                                className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
                              >
                                Choose single {BUSINESS_UNIT_STORE_LABEL}
                                <span className="block text-[10px] font-normal text-gray-400 mt-0.5">
                                  Pick one store to apply to
                                </span>
                              </button>
                              {isSiteApplied && appliedStoreIds.length > 0 && (
                                <p className="px-2 pt-1 text-[10px] text-gray-400 leading-snug">
                                  Currently applied to{' '}
                                  {businessUnits.filter(s => appliedStoreIds.includes(s.id)).map(s => s.name).join(', ') || 'selected units'}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                              <button
                                type="button"
                                onClick={() => setApplyPickerStep('root')}
                                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" /> Back
                              </button>
                              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                Select {BUSINESS_UNIT_STORE_LABEL}
                              </p>
                              {businessUnits.map(unit => (
                                <button
                                  key={unit.id}
                                  type="button"
                                  onClick={() => handleApplySingleBusinessUnit(unit.id)}
                                  className={cn(
                                    'w-full text-left px-3 py-2 rounded-lg text-xs transition-colors',
                                    appliedStoreIds.includes(unit.id)
                                      ? 'bg-emerald-50 text-emerald-800 font-semibold hover:bg-emerald-100'
                                      : 'hover:bg-gray-50 font-medium text-gray-700',
                                  )}
                                >
                                  <span className="block truncate">{unit.name}</span>
                                  <span className="block text-[10px] font-normal text-gray-400 mt-0.5">
                                    {formatStoreCode(unit)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* View store / get link (with store popover) */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={handleViewStore}
                        title={siteTestUrl ?? 'Set a subdomain to get a test link'}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
                        <span className="flex-1">
                          {siteTestUrl ? 'View store' : 'Get link'}
                          <span className="block text-[10px] font-normal text-gray-400">
                            {siteTestUrl ? 'Open or copy your store link' : 'Set a subdomain to get a link'}
                          </span>
                        </span>
                      </button>

                      {storePopover && siteTestUrl && (
                        <div className="absolute right-0 top-full z-[320] mt-1 w-80 rounded-xl border border-gray-200 bg-white text-gray-800 shadow-2xl p-4">
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
                        </div>
                      )}
                    </div>

                    <div className="my-1 border-t border-gray-100" />
                    <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      Tools
                    </p>

                    {/* Copy template / Save As */}
                    <button
                      type="button"
                      disabled={
                        !siteId
                        || applyingTemplateInline
                        || clearingTemplateSandbox
                        || resettingCanvasFromServer
                      }
                      onClick={() => { setMoreMenuOpen(false); handleCopyTemplateSaveAs() }}
                      title="Save a copy of this site as a new website in Website Builder"
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ClipboardCopy className="h-4 w-4 shrink-0 text-primary" />
                      <span className="flex-1">
                        Copy template / Save As
                        <span className="block text-[10px] font-normal text-gray-400">
                          Duplicate this site under a new name
                        </span>
                      </span>
                    </button>

                    {/* Change history (restore previous edits) */}
                    <button
                      type="button"
                      onClick={() => setChangeHistoryOpen(v => !v)}
                      aria-expanded={changeHistoryOpen}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <History className="h-4 w-4 shrink-0 text-primary" />
                      <span className="flex-1">
                        Change history
                        <span className="block text-[10px] font-normal text-gray-400">
                          Restore a previous version of this session
                        </span>
                      </span>
                      <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform', changeHistoryOpen && 'rotate-180')} />
                    </button>

                    {changeHistoryOpen && (
                      <div className="max-h-60 overflow-y-auto border-t border-gray-100 bg-gray-50/60" data-history-version={historyVersion}>
                        {historyStack.current.length === 0 ? (
                          <p className="px-3 py-4 text-center text-[11px] text-gray-400">
                            No changes recorded yet. Edits you make will appear here.
                          </p>
                        ) : (
                          historyStack.current.map((_, i) => {
                            const idx = historyStack.current.length - 1 - i
                            const ts = historyMeta.current[idx]
                            const isCurrent = idx === historyIndex.current
                            const label = idx === 0
                              ? 'Opened'
                              : idx === historyStack.current.length - 1
                                ? 'Latest edit'
                                : `Edit ${idx}`
                            return (
                              <button
                                key={idx}
                                type="button"
                                disabled={isCurrent}
                                onClick={() => { restoreHistoryTo(idx); setChangeHistoryOpen(false); setMoreMenuOpen(false) }}
                                className={cn(
                                  'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                                  isCurrent ? 'cursor-default bg-primary/5' : 'hover:bg-white',
                                )}
                              >
                                <span className={cn(
                                  'h-1.5 w-1.5 shrink-0 rounded-full',
                                  isCurrent ? 'bg-primary' : 'bg-gray-300',
                                )} />
                                <span className="flex-1 min-w-0">
                                  <span className="block truncate text-[11px] font-semibold text-gray-700">
                                    {label}
                                    {isCurrent && <span className="ml-1.5 text-[9px] font-bold uppercase text-primary">Current</span>}
                                  </span>
                                  <span className="block text-[10px] font-normal text-gray-400">
                                    {ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `Step ${idx + 1}`}
                                  </span>
                                </span>
                                {!isCurrent && (
                                  <span className="shrink-0 text-[10px] font-semibold text-primary">Restore</span>
                                )}
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Help / Tips — after More */}
              <BuilderTipsButton
                isPublished={site.is_published}
                onRestoreCoachMarks={restoreBuilderCoachMarks}
                className="h-6 w-6"
              />
          </div>
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
            <button
              type="button"
              onClick={() => setLeftCollapsed(false)}
              title="Open panel — Sections, Pages, Templates, Media, Site"
              className="flex-1 flex flex-col items-center justify-center gap-2 py-3 hover:bg-gray-50 text-gray-400 hover:text-gray-600"
            >
              <PanelLeft className="w-4 h-4" />
              <span className="text-[9px] font-semibold writing-mode-vertical text-center leading-tight px-0.5" style={{ writingMode: 'vertical-rl' }}>
                Sections
              </span>
            </button>
          ) : (
            <>
              {/* Left panel tabs */}
              <div className="flex items-center border-b border-gray-100 shrink-0 overflow-x-auto hide-scrollbar">
                {([
                  { id: 'blocks' as const, icon: Layout, label: 'Sections' },
                  { id: 'pages' as const, icon: FileText, label: 'Pages' },
                  { id: 'templates' as const, icon: Sparkles, label: 'Templates' },
                  { id: 'media' as const, icon: ImageIcon, label: 'Media' },
                  { id: 'settings' as const, icon: Globe, label: 'Site' },
                  { id: 'seo' as const, icon: Search, label: 'SEO' },
                ] as const).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setLeftPanel(id)}
                      title={label}
                      className={cn(
                        'min-w-[3.25rem] shrink-0 py-2 px-1 flex flex-col items-center gap-0.5 text-[10px] font-medium transition-colors',
                        leftPanel === id ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600',
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </button>
                  ))}
                <button onClick={() => setLeftCollapsed(true)} className="ml-auto px-2 py-2.5 text-gray-300 hover:text-gray-500 shrink-0">
                  <ChevronLeft className="w-3 h-3" />
                </button>
              </div>

              <BuilderWelcomePanel
                dismissed={builderWelcomeDismissed}
                onDismiss={() => {
                  dismissBuilderWelcome()
                  setBuilderWelcomeDismissed(true)
                }}
                onRestore={() => {
                  restoreBuilderCoachMarks()
                }}
              />

              {/* Template edit mode banner */}
              {isTemplateMode && (
                <div className="mx-3 mt-2 mb-1 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-semibold leading-snug shrink-0">
                  <span className="font-extrabold">Template edit mode</span>
                  <br />
                  <span className="font-normal opacity-80">
                    Sandbox for editing templates. Choose a template in the Templates tab to load its full layout on the canvas. Use Sections and Pages like the normal builder. Clear all resets this sandbox.
                  </span>
                </div>
              )}

              <div className={cn('flex-1 min-h-0', leftPanel === 'blocks' || leftPanel === 'pages' ? 'flex flex-col' : 'overflow-y-auto')}>
                {/* SECTIONS panel — sticky search/filter + add-section catalog */}
                {leftPanel === 'blocks' && (
                  <>
                    <div className="shrink-0 px-3 pt-3 pb-2.5 space-y-2 border-b border-gray-100 bg-white z-10">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <input
                          value={sectionSearch}
                          onChange={e => setSectionSearch(e.target.value)}
                          placeholder="Search sections to add..."
                          className="w-full pl-8 pr-8 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                        />
                        {sectionSearch && (
                          <button
                            type="button"
                            onClick={() => setSectionSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
                            title="Clear search"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <select
                          value={sectionCategory}
                          onChange={e => setSectionCategory(e.target.value)}
                          className="w-full appearance-none pl-3 pr-8 py-2 text-xs border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                          aria-label="Filter section category"
                        >
                          {BLOCK_CATEGORIES.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                      <div>
                        <FormColumnLabel className="tracking-wide px-1 mb-2">Add Section{sectionSearchLower || sectionCategory !== 'all' ? ` · ${filteredCatalogBlocks.length}` : ''}</FormColumnLabel>
                        <p className="text-[11px] text-gray-400 px-1 mb-2 leading-snug">
                          Click to add a section after your selection (or at the end).
                          <strong className="font-medium text-gray-500"> Move ↑↓</strong> reorders on the page;
                          <strong className="font-medium text-gray-500"> style icon</strong> changes how it looks.
                        </p>
                        <div className="space-y-0.5">
                          {filteredCatalogBlocks.map(def => (
                            <button
                              key={def.type}
                              type="button"
                              draggable
                              onDragStart={() => setDraggingNewBlock(def)}
                              onDragEnd={() => setDraggingNewBlock(null)}
                              onClick={() => handleAddSectionFromPanel(def)}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl border border-dashed border-gray-200 hover:border-primary/40 hover:bg-accent text-left transition-colors cursor-grab active:cursor-grabbing"
                              title={def.desc}
                            >
                              <Plus className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                              <def.icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="text-xs text-gray-700 font-medium leading-tight truncate flex-1 min-w-0">{def.label}</span>
                            </button>
                          ))}
                          {filteredCatalogBlocks.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-3 px-1">No sections match your search or filter.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* PAGES panel — pages with expandable sections */}
                {leftPanel === 'pages' && (
                  <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                    <div className="px-1 mb-1">
                      <FormColumnLabel className="tracking-wide">{localPages.length} page{localPages.length !== 1 ? 's' : ''}</FormColumnLabel>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                        Open <strong className="font-semibold text-gray-500">Actions</strong> on a page to duplicate or delete it.
                      </p>
                    </div>
                    {pageSectionGroups.map(({ page, entries, totalBlocks }) => {
                      const isExpanded = expandedSectionPages.has(page.id)
                      const isActivePage = activePageId === page.id
                      const pageTypeLabel = page.page_type === 'landing' ? '🚀' : page.page_type === 'blog' ? '📝' : page.page_type === 'product' ? '🛍️' : '📄'
                      return (
                        <div
                          key={page.id}
                          className={cn(
                            'rounded-xl border overflow-hidden transition-colors group/page',
                            isActivePage ? 'border-primary/30 bg-primary/[0.03]' : 'border-gray-100 bg-white',
                          )}
                        >
                          <div className="flex items-center gap-0.5 px-1 py-1">
                            <button
                              type="button"
                              onClick={() => toggleSectionPageExpanded(page.id)}
                              className="p-0.5 hover:bg-gray-100 rounded shrink-0"
                              title={isExpanded ? 'Collapse sections' : 'Expand sections'}
                              aria-expanded={isExpanded}
                            >
                              <ChevronDown
                                className={cn(
                                  'w-3 h-3 text-gray-500 transition-transform',
                                  isExpanded ? 'rotate-0' : '-rotate-90',
                                )}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActivePageId(page.id)
                                setSelectedBlockId(null)
                                if (!isExpanded) {
                                  setExpandedSectionPages(prev => new Set([...prev, page.id]))
                                }
                              }}
                              className="flex items-center gap-1.5 flex-1 min-w-0 text-left py-0.5 px-0.5 rounded-lg hover:bg-gray-50/80 transition-colors"
                            >
                              <span className="text-xs shrink-0 leading-none" title={page.page_type || 'page'}>{pageTypeLabel}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 min-w-0">
                                  <span className={cn('text-xs font-semibold leading-tight truncate', isActivePage ? 'text-primary' : 'text-gray-800')}>
                                    {page.title}
                                  </span>
                                  {page.is_homepage && (
                                    <span className="text-[8px] bg-primary/15 text-primary rounded px-1 font-bold shrink-0">HOME</span>
                                  )}
                                </div>
                                <span className="text-[10px] text-gray-400 font-mono leading-none">/{page.slug}</span>
                              </div>
                            </button>
                            <span className="text-[10px] font-medium text-gray-400 shrink-0 tabular-nums px-1">
                              {totalBlocks}
                            </span>
                            <PageActionsMenu
                              page={page}
                              pageCount={countPersistedPages(localPages)}
                              onSetHomepage={() => { void handleSetHomepage(page) }}
                              onDuplicate={() => { void handleDuplicatePage(page) }}
                              onDelete={() => handleDeletePage(page.id, page.title)}
                            />
                          </div>

                          {isExpanded && (
                            <div className="px-1.5 pb-1.5 space-y-0.5 border-t border-gray-100 pt-1">
                              {entries.map(({ block, idx }) => {
                                const def = getBlockCatalogDef(block.block_type)
                                const Icon = def?.icon ?? Square
                                const label = catalogBlockLabel(block)
                                const isSelected = selectedBlockId === block.id
                                const isVisible = block.visible !== false
                                const isDragTarget = sidebarDraggedPageId === page.id && sidebarDragOverIdx === idx && sidebarDraggedIdx !== idx
                                return (
                                  <div
                                    key={block.id}
                                    draggable
                                    onDragStart={() => onSidebarSectionDragStart(page.id, idx)}
                                    onDragOver={e => onSidebarSectionDragOver(e, page.id, idx)}
                                    onDrop={e => onSidebarSectionDrop(e, page.id, idx)}
                                    onDragEnd={onSidebarSectionDragEnd}
                                    className={cn(
                                      'flex items-center gap-1.5 px-2 py-1.5 rounded-xl border transition-colors cursor-default group',
                                      isSelected
                                        ? 'border-primary/50 bg-accent ring-1 ring-primary/20'
                                        : isDragTarget
                                          ? 'border-primary/40 bg-accent'
                                          : 'border-gray-100 bg-white hover:border-primary/30 hover:bg-accent/70',
                                      sidebarDraggedPageId === page.id && sidebarDraggedIdx === idx ? 'opacity-40' : 'opacity-100',
                                      !isVisible && !isSelected && 'opacity-60',
                                    )}
                                  >
                                    <GripVertical className="w-3 h-3 text-gray-300 cursor-grab shrink-0" />
                                    <button
                                      type="button"
                                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                                      onClick={() => selectPageSection(page.id, block.id)}
                                      title={label}
                                    >
                                      <div className={cn(
                                        'w-5 h-5 rounded-md flex items-center justify-center shrink-0',
                                        isSelected ? 'bg-primary' : isVisible ? 'bg-primary/10' : 'bg-gray-100',
                                      )}>
                                        <Icon className={cn('w-3 h-3', isSelected ? 'text-white' : isVisible ? 'text-primary' : 'text-gray-400')} />
                                      </div>
                                      <span className={cn(
                                        'text-xs font-medium leading-tight truncate',
                                        isVisible ? 'text-gray-700' : 'text-gray-400',
                                      )}>
                                        {label}
                                      </span>
                                    </button>
                                    <div className={cn(
                                      'flex items-center gap-0 shrink-0 transition-opacity',
                                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                                    )}>
                                      <button type="button" onClick={() => handleMoveBlockOnPage(page.id, block.id, 'up')} className="p-0.5 hover:bg-gray-100 rounded" title="Move up">
                                        <ChevronUp className="w-3 h-3 text-gray-400" />
                                      </button>
                                      <button type="button" onClick={() => handleMoveBlockOnPage(page.id, block.id, 'down')} className="p-0.5 hover:bg-gray-100 rounded" title="Move down">
                                        <ChevronDown className="w-3 h-3 text-gray-400" />
                                      </button>
                                      <button type="button" onClick={() => confirmDeleteBlock(block.id, { pageId: page.id })} className="p-0.5 hover:bg-red-50 rounded" title="Remove section">
                                        <Trash2 className="w-3 h-3 text-red-400" />
                                      </button>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => toggleBlockVisibility(block.id, page.id)}
                                      className="shrink-0 p-0.5"
                                      title={isVisible ? 'Hide section' : 'Show section'}
                                    >
                                      {isVisible
                                        ? <Eye className="w-3.5 h-3.5 text-primary/70 hover:text-primary" />
                                        : <EyeOff className="w-3.5 h-3.5 text-amber-400 hover:text-amber-600" />}
                                    </button>
                                  </div>
                                )
                              })}
                              {totalBlocks === 0 && (
                                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-2 py-2 text-center space-y-1.5">
                                  <p className="text-[11px] text-gray-500 leading-tight">No sections on this page yet.</p>
                                  <div className="flex flex-col items-stretch gap-1">
                                    <button
                                      type="button"
                                      onClick={openSectionsPanel}
                                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-primary rounded-lg hover:opacity-90 transition-opacity shadow-sm"
                                    >
                                      Browse all sections
                                    </button>
                                    <button
                                      type="button"
                                      onClick={openSectionsPanel}
                                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary border border-primary/30 rounded-lg hover:bg-accent transition-colors"
                                    >
                                      <Layout className="w-3.5 h-3.5" />
                                      Add Section
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {localPages.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4 px-1">No pages yet.</p>
                    )}
                    <button onClick={handleAddPage} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-primary/30 text-xs text-primary font-semibold hover:bg-accent hover:border-primary/60 transition-colors mt-1">
                      <Plus className="w-3.5 h-3.5" /> Add New Page
                    </button>
                    {activePage && localPages.length > 0 && (
                      <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 space-y-2">
                        <div className="text-[11px] font-semibold text-gray-700 truncate" title={activePage.title}>
                          Current page: {activePage.title}
                        </div>
                        {countPersistedPages(localPages) <= 1 ? (
                          <p className="text-[10px] leading-snug text-gray-500">Your site needs at least one page.</p>
                        ) : !isPersistedPageId(activePage.id) ? (
                          <p className="text-[10px] leading-snug text-gray-500">Save this page before moving it to trash.</p>
                        ) : (
                          <>
                            {activePage.is_homepage && (
                              <p className="text-[10px] leading-snug text-gray-500 mb-2">
                                This is the homepage. The next page becomes home when you move it to trash.
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeletePage(activePage.id, activePage.title)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-red-200 bg-white text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Move to trash
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 text-center pt-1 leading-snug">
                      Use <strong>Actions</strong> on any page for homepage, duplicate, or delete. Expand a page to manage its sections.
                    </p>
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
                        const canvasBlockCount = Object.values(localBlocks).reduce((n, arr) => n + arr.length, 0)
                        return filteredTpl.map(tpl => {
                          const pageCount = tpl.page_count ?? tpl.pages?.length ?? 0
                          const palette = getTemplatePreviewPalette(tpl)
                          const sel = templatePanelSelectedId === tpl.id
                          const isLoadingThis = sel && applyingTemplateInline
                          const showLoadedBadge = sel && !isLoadingThis && canvasBlockCount > 0
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
                                  {showLoadedBadge && (
                                    <span className="shrink-0 text-[8px] px-1.5 py-0.5 rounded-full bg-primary text-white font-bold leading-none">Loaded</span>
                                  )}
                                  {sel && !isLoadingThis && !showLoadedBadge && (
                                    <span className="shrink-0 text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/90 text-white font-bold leading-none">Selected</span>
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

                {leftPanel === 'media' && (
                  <MediaStudioPanel
                    siteId={siteId!}
                    selectedBlock={selectedBlock}
                    applyToImageLayer={applyToImageLayer}
                    applyTargetDescription={mediaApplyTargetDescription}
                    onApplyUrl={applyMediaUrlToSelection}
                  />
                )}

                {leftPanel === 'settings' && site && (
                  <SiteSettingsPanel siteId={siteId!} site={site} />
                )}

                {leftPanel === 'seo' && site && (
                  <SEOPanel
                    siteId={siteId!}
                    activePage={activePage}
                    site={site}
                    onSavePage={(data) => {
                      if (!activePage) return
                      websiteApi.updatePage(siteId!, activePage.id, data as any)
                        .then(updated => {
                          setLocalPages(prev => prev.map(p =>
                            p.id === activePage.id ? { ...p, ...data, ...updated } : p,
                          ))
                          queryClient.setQueryData<WebsiteSite>(['websites', siteId!], old => {
                            if (!old) return old
                            return { ...old, pages: old.pages.map(p => p.id === activePage.id ? { ...p, ...data, ...updated } : p) }
                          })
                          toast.success('SEO settings saved!')
                        })
                        .catch(() => toast.error('Save failed'))
                    }}
                    onSaveSite={(data) => {
                      websiteApi.updateSite(siteId!, data as any)
                        .then(updated => {
                          queryClient.setQueryData<WebsiteSite>(['websites', siteId!], old =>
                            old ? { ...old, ...data, ...updated } : old,
                          )
                          toast.success('Site SEO settings saved!')
                        })
                        .catch(() => toast.error('Save failed'))
                    }}
                  />
                )}

              </div>
            </>
          )}
        </aside>

        {/* ── LEFT RESIZE HANDLE ──────────────────────────────────────── */}
        {!leftCollapsed && (
          <div
            className="w-px shrink-0 bg-transparent hover:bg-gray-500 active:bg-gray-600 cursor-col-resize transition-colors group relative z-20"
            onMouseDown={e => {
              e.preventDefault()
              isResizingLeft.current = true
              document.body.style.cursor = 'col-resize'
              document.body.style.userSelect = 'none'
            }}
            title="Drag to resize panel"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {/* ── CANVAS ──────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-gray-100">
          <BuilderSpacingCoachMark
            visible={Boolean(selectedBlockId)}
            dismissed={builderSpacingTipDismissed}
            onDismiss={() => {
              dismissBuilderSpacingTip()
              setBuilderSpacingTipDismissed(true)
            }}
          />
          {selectedBlockId && (() => {
            const block = activeBlocks.find(b => b.id === selectedBlockId)
            if (!block) return null
            const canvasFieldKeys = activeTextTarget?.blockId === block.id
              ? editableFieldKeys(activeTextTarget)
              : []
            const multiFieldSelectionOnBlock = canvasFieldKeys.length > 1
            const selectedCount = canvasFieldKeys.length
            return (
              <div className="shrink-0 z-10 bg-white border-b border-gray-200 shadow-sm">
                <div className="flex items-center justify-between gap-2 px-3 py-1 bg-accent/40 border-b border-primary/10">
                  <span className="text-[11px] font-medium text-primary/90 truncate">
                    {formatPaintBrush
                      ? `Copy formatting — click text to apply (${formatPaintStyleSummary(formatPaintBrush.style)})${formatPaintBrush.sticky ? ' · apply to several' : ''}`
                      : overlayImageTarget?.blockId === block.id && overlayImageTarget.overlayId
                        ? 'Decorative layer selected — use the toolbar below to move, resize, or style it'
                        : canvasImageTarget?.blockId === block.id && canvasImageStyleField(canvasImageTarget, block.id)
                          ? (() => {
                              const slots = canvasImageArraySlots(canvasImageTarget, block.id)
                              if (slots.length > 1) {
                                return `${slots.length} photos selected — toolbar changes apply to all`
                              }
                              return slots.length
                                ? 'Photo selected — zoom and crop in General / Visual, or replace in Media'
                                : 'Section photo selected — adjust zoom, position, or height in the toolbar below'
                            })()
                          : multiFieldSelectionOnBlock
                          ? `${selectedCount} text areas selected — toolbar applies to all`
                          : `${catalogBlockLabel(block)} selected — double-click text to edit, or use the toolbar below`}
                  </span>
                  <span className="hidden sm:inline text-[10px] text-gray-400 shrink-0">
                    Toolbar tabs: General · Media · Visual
                  </span>
                </div>
                <BlockDesignBar
                  docked
                  block={block}
                  onUpdate={updates => handleUpdateBlockProps(block.id, updates)}
                  onInsertAfter={type => handleAddBlockAfter(type)}
                  onOpenLinkEditorForOverlay={(item, anchor) => openLinkEditorForOverlay(block.id, item, anchor)}
                  selectedOverlayId={overlayImageTarget?.blockId === block.id ? overlayImageTarget.overlayId : null}
                  canvasImageField={canvasImageStyleField(canvasImageTarget, block.id)}
                  canvasImageSlots={canvasImageArraySlots(canvasImageTarget, block.id)}
                  onSectionImagePick={openOverlayImageFilePicker}
                  onSectionImageLibrary={openMediaFromCanvas}
                  onFocusPrimaryImage={(() => {
                    const field = sectionPrimaryImageField(String(block.block_type), (block.props ?? {}) as Record<string, unknown>)
                    return field ? () => handleSectionImageActivate(block.id, field) : undefined
                  })()}
                  onSelectOverlay={onOverlayLayerPicked}
                  blockBackgroundColor={
                    ((block.props as Record<string, unknown>).bg_color_override as string | undefined)
                    || canvasStyle.bg_color
                    || canvasStyle.surface_color
                    || '#ffffff'
                  }
                  onOverlayPickImage={openOverlayImageFilePicker}
                  onOverlayOpenLibrary={openMediaFromCanvas}
                  onOverlaySetImageUrl={openOverlayImageUrlPrompt}
                  onOverlayEditText={openOverlayTextEdit}
                  onOverlayEditDescription={openOverlayDescriptionEdit}
                  activeTextField={activeTextTarget?.blockId === block.id ? primaryTextFieldKey(activeTextTarget) : null}
                  activeTextFields={activeTextTarget?.blockId === block.id ? activeTextTarget.fieldKeys : []}
                  onActivateTextField={fieldKey => handleCanvasTextFieldActivate(block.id, fieldKey)}
                  formatPaintActive={Boolean(formatPaintBrush)}
                  formatPaintSticky={formatPaintBrush?.sticky ?? false}
                  onFormatPaintStart={(style, sticky) => setFormatPaintBrush({ style, sticky })}
                  onFormatPaintCancel={() => setFormatPaintBrush(null)}
                  onEditText={() => openInlineTextEditForSelectedRef.current()}
                  onEscapeDismiss={() => dismissBuilderUiRef.current()}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  canUndo={canUndo}
                  canRedo={canRedo}
                />
              </div>
            )
          })()}

          {/* Scrollable canvas preview */}
          <div
            ref={canvasMainRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            onDragOver={handleCanvasDragOver}
            onDrop={handleDropOnCanvas}
          >

          {/* Canvas area — scales full design width to fit available editor space */}
          <div
            ref={canvasViewportRef}
            className="w-full max-w-full min-h-full box-border py-3"
            style={{
              background: 'repeating-linear-gradient(0deg,transparent,transparent 24px,rgba(99,102,241,0.04) 24px,rgba(99,102,241,0.04) 25px),repeating-linear-gradient(90deg,transparent,transparent 24px,rgba(99,102,241,0.04) 24px,rgba(99,102,241,0.04) 25px)',
              backgroundColor: '#f3f4f6',
            }}
          >
            <div
              className="relative shrink-0"
              style={{
                width: scaledCanvasWidth,
                height: Math.round(canvasPreviewHeight * effectiveCanvasScale),
              }}
            >
              <div
                ref={canvasPreviewInnerRef}
                data-page-canvas="true"
                onClickCapture={handleCanvasNavClickCapture}
                style={{
                  width: designWidthPx,
                  transform: `scale(${effectiveCanvasScale})`,
                  transformOrigin: 'top left',
                }}
                className="shadow-lg rounded-none min-h-[600px] overflow-visible"
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
                    <Layout className="w-12 h-12 mx-auto mb-3 text-primary/40" />
                    <p className="text-sm text-gray-500 font-medium">This page has no sections yet</p>
                    <p className="text-xs text-gray-400 mt-1">Pick a section from the catalog or drag one here</p>
                    <div className="flex flex-col items-center gap-2 mt-5">
                      <button
                        type="button"
                        onClick={openSectionsPanel}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity shadow-lg"
                      >
                        Browse all sections
                      </button>
                      <button
                        type="button"
                        onClick={openSectionsPanel}
                        className="flex items-center gap-2 px-4 py-2.5 border border-primary/40 text-primary text-xs font-semibold rounded-lg hover:bg-accent transition-colors"
                      >
                        <Layout className="w-4 h-4" />
                        Add Section
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <BuilderCanvasProviders
                  siteId={siteId!}
                  vendorSlug={builderVendorSlug || 'preview'}
                  siteName={site?.name}
                  onNavigate={handleNavigateBuilderPage}
                  activeBlockId={selectedBlockId}
                  activeCanvasImageTarget={canvasImageTarget}
                  blockPropsForImage={(() => {
                    const imageBlockId = canvasImageTarget?.blockId ?? selectedBlockId
                    if (!imageBlockId) return null
                    return (activeBlocks.find(b => b.id === imageBlockId)?.props ?? null) as Record<string, unknown> | null
                  })()}
                  onSectionImageActivate={handleSectionImageActivate}
                  activeTextField={primaryTextFieldKey(activeTextTarget)}
                  activeTextFields={activeTextTarget?.fieldKeys ?? []}
                  onTextFieldActivate={handleCanvasTextFieldActivate}
                  onTextFieldCommit={handleCanvasTextFieldCommit}
                  onTextFieldStylePatch={handleCanvasTextFieldStylePatch}
                  onTextFieldBatchStylePatch={handleCanvasTextFieldBatchStylePatch}
                >
                <>
                  <div
                    ref={builderPageRootRef}
                    className={cn('relative', formatPaintBrush && 'builder-format-paint-active')}
                    onClickCapture={handleCanvasBlockSelectCapture}
                    onContextMenuCapture={handleCanvasBlockContextMenuCapture}
                    onMouseMove={handleCanvasBlockHover}
                    onMouseLeave={handleCanvasBlockHoverLeave}
                  >
                    {builderPublicSite && (
                      <BuilderCanvasPageRenderer
                        publicSite={builderPublicSite}
                        blocks={activeBlocks}
                        pageId={activePageId}
                        revision={canvasBlocksRevision}
                      />
                    )}

                    {activeBlocks.map((block, idx) => (
                      <BuilderSectionOverlay
                        key={block.id}
                        blockId={block.id}
                        containerRef={builderPageRootRef}
                        scrollRootRef={canvasMainRef}
                        revision={canvasBlocksRevision}
                        selected={selectedBlockId === block.id}
                        imageSelected={
                          selectedBlockId === block.id
                          && Boolean(canvasImageStyleField(canvasImageTarget, block.id))
                        }
                        saving={savingBlockId === block.id}
                        visible={block.visible !== false}
                        dropBefore={dropTarget?.idx === idx && dropTarget.before}
                        dropAfter={dropTarget?.idx === idx && !dropTarget.before}
                        dragging={draggingBlockIdx === idx}
                        interactive={draggingBlockIdx !== null || draggingNewBlock}
                        onContextMenu={e => { e.preventDefault(); openBlockContextMenu(block, e) }}
                        onDragOver={e => handleDragOverBlock(e, idx)}
                        onDrop={e => handleDropOnBlock(e, idx)}
                      >
                        <BuilderSectionChromeToolbar
                          block={block}
                          blockIdx={idx}
                          selected={selectedBlockId === block.id}
                          minimized={minimizedSectionToolbars.has(block.id)}
                          pinned={pinnedSectionToolbars.has(block.id)}
                          onMinimize={() => {
                            if (pinnedSectionToolbars.has(block.id)) {
                              unpinSectionToolbar(block.id)
                              minimizeSectionToolbar(block.id)
                              return
                            }
                            if (minimizedSectionToolbars.has(block.id)) {
                              expandSectionToolbar(block.id)
                            } else {
                              minimizeSectionToolbar(block.id)
                            }
                          }}
                          onTogglePin={() => togglePinSectionToolbar(block.id)}
                          positionClassName={cn(
                            'top-2 right-2',
                            selectedBlockId === block.id || hoveredBlockId === block.id
                              ? 'opacity-100'
                              : 'opacity-0 group-hover:opacity-100',
                          )}
                          dsConnectedLabel={(() => {
                            const rawDs = (block.props as Record<string, unknown>)?.data_source
                            const dsType = normalizeSourceType((rawDs as { type?: string })?.type)
                            return dsType ? DATA_SOURCES.find(s => s.id === dsType)?.label ?? null : null
                          })()}
                          dsSuggestedLabel={(() => {
                            const rawDs = (block.props as Record<string, unknown>)?.data_source
                            const dsType = normalizeSourceType((rawDs as { type?: string })?.type)
                            const suggested = BLOCK_AUTO_SOURCE[block.block_type as string]
                            if (dsType || !suggested) return null
                            return DATA_SOURCES.find(s => s.id === suggested)?.label ?? null
                          })()}
                          onConnectSuggestedDataSource={() => {
                            const suggested = BLOCK_AUTO_SOURCE[block.block_type as string]
                            if (!suggested) return
                            handleUpdateBlockProps(block.id, { data_source: { type: suggested, auto: true } } as BlockProps)
                            toast.success(`Connected to ${DATA_SOURCES.find(s => s.id === suggested)?.label}`)
                          }}
                          onOpenDataPanel={() => {
                            setSelectedBlockId(block.id)
                            setRightPanel('data')
                            setRightCollapsed(false)
                          }}
                          onMoveBlock={dir => handleMoveBlock(block.id, dir)}
                          onDuplicate={() => handleDuplicateBlock(block.id)}
                          onDelete={() => confirmDeleteBlock(block.id)}
                          onReorderPointerDown={e => handleBlockReorderPointerDown(e, idx)}
                          onOpenLayoutPicker={() => openLayoutPickerForBlock(block)}
                          onCycleLayout={dir => { void cycleBlockLayout(block, dir) }}
                        />

                        {selectedBlockId === block.id && (
                          <div
                            role="button"
                            tabIndex={0}
                            onPointerDown={e => handleBlockReorderPointerDown(e, idx)}
                            onClick={e => e.stopPropagation()}
                            title="Drag to reorder section"
                            className="absolute left-0 top-0 bottom-0 z-[76] w-5 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none bg-primary/5 hover:bg-primary/15 border-r border-primary/25 pointer-events-auto"
                          >
                            <GripVertical className="w-3.5 h-3.5 text-primary/70 pointer-events-none" />
                          </div>
                        )}

                        <div className={cn(
                          'absolute bottom-1 left-1 z-[74] flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold bg-primary/80 text-white transition-opacity pointer-events-none',
                          selectedBlockId === block.id ? 'opacity-0' : 'opacity-0 group-hover:opacity-70',
                        )}>
                          {catalogBlockLabel(block)}
                        </div>
                        {savingBlockId === block.id && (
                          <div className="absolute bottom-1 right-1 z-[74] flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/90 text-white text-xs font-bold pointer-events-none">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" /> Saving…
                          </div>
                        )}

                        <BlockOverlayCanvas
                          blockId={block.id}
                          overlays={(((block.props as Record<string, unknown>).overlays as BlockOverlayItem[]) || [])}
                          isEditing={selectedBlockId === block.id}
                          blockBackgroundColor={
                            ((block.props as Record<string, unknown>).bg_color_override as string | undefined)
                            || canvasStyle.bg_color
                            || canvasStyle.surface_color
                            || '#ffffff'
                          }
                          onUpdate={selectedBlockId === block.id
                            ? (overlays) => handleUpdateBlockProps(block.id, { overlays } as BlockProps)
                            : undefined}
                          onOverlaySelectionChange={block.id === selectedBlockId ? onOverlayLayerPicked : undefined}
                          selectedOverlayId={
                            block.id === selectedBlockId && overlayImageTarget?.blockId === block.id
                              ? overlayImageTarget.overlayId
                              : null
                          }
                          onOpenAiImageTools={undefined}
                          onOpenMediaLibrary={block.id === selectedBlockId ? openMediaFromCanvas : undefined}
                          onPickLocalImage={block.id === selectedBlockId ? openOverlayImageFilePicker : undefined}
                          onImageFileDrop={block.id === selectedBlockId ? uploadImageFileToSelection : undefined}
                          onEditLinkForOverlay={block.id === selectedBlockId
                            ? (item, anchor) => openLinkEditorForOverlay(block.id, item, anchor)
                            : undefined}
                          onOverlayContextMenu={block.id === selectedBlockId
                            ? (item, e) => { e.preventDefault(); e.stopPropagation(); openOverlayContextMenu(block.id, item, e) }
                            : undefined}
                          onRequestText={block.id === selectedBlockId ? openTextPrompt : undefined}
                        />

                        {selectedBlockId === block.id && (
                          <BuilderSectionPaddingHandles
                            blockId={block.id}
                            containerRef={builderPageRootRef}
                            scrollRootRef={canvasMainRef}
                            revision={canvasBlocksRevision}
                            paddingTop={Number((block.props as Record<string, unknown>).padding_top ?? 0)}
                            paddingBottom={Number((block.props as Record<string, unknown>).padding_bottom ?? 0)}
                            canvasScale={effectiveCanvasScale}
                            suppressed={
                              Boolean(canvasImageStyleField(canvasImageTarget, block.id))
                              || activeTextTarget?.blockId === block.id
                            }
                            onPaddingPreview={patch => handlePreviewBlockProps(block.id, patch as BlockProps)}
                            onPaddingCommit={patch => handleUpdateBlockProps(block.id, patch as BlockProps)}
                          />
                        )}

                        {selectedBlockId === block.id
                          && Number((block.props as Record<string, unknown>).min_height ?? 0) > 0
                          && !canvasImageStyleField(canvasImageTarget, block.id)
                          && activeTextTarget?.blockId !== block.id && (
                          <div
                            data-section-min-height-handle
                            title="Minimum section height (not padding) — drag or clear in Layout → More"
                            className="absolute bottom-1 right-2 z-[55] flex h-4 w-4 items-center justify-center rounded border-2 border-amber-400 bg-white shadow-sm cursor-ns-resize pointer-events-auto hover:bg-amber-50"
                            onMouseDown={e => {
                              e.preventDefault()
                              e.stopPropagation()
                              const startY = e.clientY
                              const startH = (block.props as Record<string, unknown>).min_height as number || 0
                              const scale = effectiveCanvasScale > 0 ? effectiveCanvasScale : 1
                              document.body.style.cursor = 'ns-resize'
                              const onMove = (mv: MouseEvent) => {
                                const newH = Math.max(0, startH + (mv.clientY - startY) / scale)
                                handleUpdateBlockProps(block.id, { min_height: Math.round(newH) } as BlockProps)
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
                            <span className="block h-0.5 w-2 rounded-full bg-ring/70" />
                          </div>
                        )}
                      </BuilderSectionOverlay>
                    ))}
                  </div>

                  {/* Drop zone at end — omit when page ends with footer so the footer isn’t visually stacked under a dashed “slot” */}
                  {activeBlocks[activeBlocks.length - 1]?.block_type !== 'footer' && (
                    <div
                      className={cn(
                        'flex items-center justify-center py-6 border-2 border-dashed m-4 rounded-xl transition-colors cursor-pointer',
                        draggingBlockIdx !== null || draggingNewBlock
                          ? 'border-primary/60 bg-primary/5'
                          : 'border-gray-200 hover:border-primary/40',
                      )}
                      onClick={() => setLeftPanel('blocks')}
                      onDragOver={e => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = draggingNewBlock ? 'copy' : 'move'
                        if (activeBlocks.length > 0) {
                          setDropTarget({ idx: activeBlocks.length - 1, before: false })
                        }
                      }}
                      onDrop={handleDropOnCanvas}
                    >
                      <span className="text-xs text-gray-400 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Drop block here or click to browse
                      </span>
                    </div>
                  )}
                </>
                </BuilderCanvasProviders>
              )}
              </div>
            </div>
          </div>
          </div>

          {/* Bottom page bar — Excel-style: arrows page through tabs, "…" lists what's off-screen */}
          {(() => {
            const hiddenPages = sortedSitePages.filter(
              (_, idx) => idx < pageWindowStart || idx >= pageWindowStart + visibleTabCount,
            )
            const canPageLeft = pageWindowStart > 0
            const canPageRight = pageWindowStart + visibleTabCount < sortedSitePages.length
            const showNav = canPageLeft || canPageRight || hiddenPages.length > 0
            return (
              <div className="shrink-0 z-10 flex items-center gap-1.5 border-t border-gray-200 bg-white px-3 py-1.5">
                {showNav && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setPageWindowStart(i => Math.max(0, i - 1))}
                      disabled={!canPageLeft}
                      title="Show previous pages"
                      aria-label="Show previous pages"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPageWindowStart(i => Math.min(sortedSitePages.length - 1, i + 1))}
                      disabled={!canPageRight}
                      title="Show more pages"
                      aria-label="Show more pages"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div ref={pageTabsViewportRef} className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                  {sortedSitePages.slice(pageWindowStart).map(page => {
                    const isActive = page.id === activePageId
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => { setActivePageId(page.id); setSelectedBlockId(null) }}
                        title={page.is_homepage ? `${page.title} (home page)` : page.title}
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold leading-none transition-colors',
                          isActive
                            ? 'border-primary/50 bg-primary/10 text-primary'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                        )}
                      >
                        <FileText className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-primary' : 'text-gray-400')} />
                        <span className="max-w-[140px] truncate">{page.title}</span>
                        {page.is_homepage && (
                          <span className={cn(
                            'shrink-0 rounded px-1 text-[9px] font-bold leading-none',
                            isActive ? 'bg-primary/20 text-primary' : 'bg-gray-100 text-gray-500',
                          )}>
                            Home
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {hiddenPages.length > 0 && (
                  <div className="relative shrink-0" ref={pageOverflowRef}>
                    <button
                      type="button"
                      onClick={() => setPageMenuOpen(v => !v)}
                      title={`${hiddenPages.length} more page${hiddenPages.length === 1 ? '' : 's'}`}
                      aria-label="More pages"
                      aria-haspopup="menu"
                      aria-expanded={pageMenuOpen}
                      className={cn(
                        'inline-flex h-6 items-center justify-center gap-1 rounded-md px-1.5 text-[11px] font-semibold leading-none transition-colors',
                        pageMenuOpen ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
                      )}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      {hiddenPages.length}
                    </button>

                    {pageMenuOpen && (
                      <div className="absolute bottom-full right-0 z-[300] mb-1.5 max-h-72 w-56 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 text-gray-800 shadow-2xl">
                        <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                          More pages ({hiddenPages.length})
                        </p>
                        {hiddenPages.map(page => {
                          const idx = sortedSitePages.findIndex(p => p.id === page.id)
                          const isActive = page.id === activePageId
                          return (
                            <button
                              key={page.id}
                              type="button"
                              onClick={() => {
                                setActivePageId(page.id)
                                setSelectedBlockId(null)
                                setPageWindowStart(idx)
                                setPageMenuOpen(false)
                              }}
                              className={cn(
                                'flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition-colors',
                                isActive ? 'bg-primary/5 text-primary' : 'text-gray-700 hover:bg-gray-50',
                              )}
                            >
                              <FileText className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-primary' : 'text-gray-400')} />
                              <span className="flex-1 truncate">{page.title}</span>
                              {page.is_homepage && (
                                <span className="shrink-0 rounded bg-gray-100 px-1 text-[9px] font-bold leading-none text-gray-500">Home</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddPage}
                  title="Create a new page"
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-gray-300 px-2.5 py-1 text-[11px] font-semibold leading-none text-gray-500 transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" /> Create Page
                </button>

                {/* Horizontal scrollbar for panning the zoomed canvas (~3in wide) */}
                <CanvasHScrollbar
                  targetRef={canvasMainRef}
                  refreshKey={`${scaledCanvasWidth}-${device}`}
                  className="ml-1.5 w-[288px] shrink-0 border-l border-gray-300 pl-1.5"
                />
              </div>
            )
          })()}
        </main>

        {/* ── RIGHT RESIZE HANDLE ─────────────────────────────────────── */}
        {!rightCollapsed && (
          <div
            className="w-px shrink-0 bg-transparent hover:bg-gray-500 active:bg-gray-600 cursor-col-resize transition-colors group relative z-20"
            onMouseDown={e => {
              e.preventDefault()
              isResizingRight.current = true
              document.body.style.cursor = 'col-resize'
              document.body.style.userSelect = 'none'
            }}
            title="Drag to resize panel"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
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
              <div className="flex items-center border-b border-gray-100 shrink-0 overflow-x-auto hide-scrollbar">
                <button onClick={() => setRightCollapsed(true)} className="px-2 py-2.5 text-gray-300 hover:text-gray-500 shrink-0">
                  <ChevronRight className="w-3 h-3" />
                </button>
                {([
                  { id: 'props' as const, icon: Settings2, label: 'Section Edit', hint: 'Text, colors, and layout for the selected section' },
                  { id: 'page' as const, icon: FileText, label: 'Page Edit', hint: 'Page-wide colors and fonts (switch pages in the left Pages panel)' },
                  { id: 'style' as const, icon: Palette, label: 'Style', hint: 'Site fonts and colors' },
                  { id: 'data' as const, icon: Database, label: 'Store data', hint: 'Connect sections to products, services, and catalog' },
                ] as const).map(({ id, icon: Icon, label, hint }) => (
                  <button
                    key={id}
                    onClick={() => setRightPanel(id)}
                    title={hint}
                    className={cn(
                      'min-w-[4.25rem] shrink-0 py-2 px-1 flex flex-col items-center gap-0.5 transition-colors antialiased subpixel-antialiased',
                      rightPanel === id ? 'text-primary border-b-2 border-primary bg-accent' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] font-semibold leading-none">{label}</span>
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
                      onOpenLayoutPicker={() => openLayoutPickerForBlock(selectedBlock)}
                      onCycleLayout={dir => { void cycleBlockLayout(selectedBlock, dir) }}
                      themeColors={{
                        primary_color: canvasStyle.primary_color || '#64C3A0',
                        text_color: canvasStyle.text_color || '#111827',
                        surface_color: canvasStyle.surface_color || '#f9fafb',
                        bg_color: canvasStyle.bg_color || '#ffffff',
                      }}
                    />
                  ) : (
                    <div className="p-4 space-y-4">
                      <div className="text-center py-8">
                        <MousePointerIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm font-semibold text-gray-700">Select a section on the canvas</p>
                        <p className="text-xs text-gray-400 mt-1">Section colors, layout, and content appear in Section Edit.</p>
                      </div>
                    </div>
                  )
                )}

                {rightPanel === 'page' && (
                  <PagePanel
                    pages={sortedSitePages}
                    activePageId={activePageId}
                    siteStyle={localStyle}
                    onPageStyleChange={handlePageStyleChange}
                    onClearPageStyle={handleClearPageStyle}
                    onDeletePage={handleDeletePage}
                    onDuplicatePage={page => { void handleDuplicatePage(page) }}
                    onSetHomepage={page => { void handleSetHomepage(page) }}
                    trashedPages={trashedPages}
                    trashLoading={trashLoading}
                    onRestorePage={handleRestorePage}
                    onRefreshTrash={loadTrashedPages}
                  />
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
                        type="button"
                        onClick={hasSaveChanges ? () => void handleSaveCanvas() : undefined}
                        disabled={isSaving || !hasSaveChanges}
                        className={cn(
                          'w-full py-2.5 rounded-xl text-white flex items-center justify-center gap-2 transition-colors duration-200',
                          BUILDER_CRISP_LABEL,
                          saveFlash
                            ? 'bg-emerald-500'
                            : hasSaveChanges
                              ? 'bg-gradient-to-r from-primary to-emerald-700 hover:from-primary/90 hover:to-emerald-800 shadow-md'
                              : 'bg-emerald-600 ring-2 ring-emerald-300/40 cursor-default',
                        )}
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : saveFlash || isCanvasSaved ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {isSaving ? 'Saving…' : saveFlash || isCanvasSaved ? 'Saved' : 'Save canvas & styles'}
                      </button>
                      <p className="mt-1.5 text-center text-xs text-gray-400">
                        {autoSaveEnabled
                          ? (lastSavedAt
                            ? `Auto-saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : 'Auto-save enabled')
                          : 'Auto-save off — use Save draft in the toolbar'}
                      </p>
                    </div>
                  </div>
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
  const showHeadlessTab = import.meta.env.DEV || siteHeadless

  useEffect(() => {
    if (tab === 'headless' && !showHeadlessTab) setTab('i18n')
  }, [tab, showHeadlessTab])

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
          ...(showHeadlessTab ? [{ id: 'headless' as const, label: 'Headless API' }] : []),
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
                  onClick={() => {
                    const toggle = () => {
                      if (siteHeadless) {
                        disableHeadless.mutateAsync()
                          .then(() => toast.success('Headless API disabled'))
                          .catch(() => toast.error('Could not disable headless API'))
                      } else {
                        enableHeadless.mutateAsync()
                          .then(() => toast.success('Headless API enabled'))
                          .catch(() => toast.error('Could not enable headless API'))
                      }
                    }
                    void toggle()
                  }}>
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
      <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2.5 text-[11px] text-gray-600 leading-snug">
        <strong className="font-semibold text-gray-800">Search listing</strong> controls the title and short description people see in Google and when your link is shared on social media.
      </div>

      {/* Tab switcher */}
      <div className="flex bg-gray-100 rounded-xl p-0.5 gap-0.5">
        {(['page', 'site'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors', tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            {t === 'page' ? '📄 This page' : '🌐 Whole site'}
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
            Write search text with AI
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
              <label className="text-xs font-medium text-gray-700">Title in Google results</label>
              <span className={cn('text-xs', titleLen > 60 ? 'text-red-500' : titleLen > 50 ? 'text-amber-500' : 'text-gray-400')}>{titleLen}/60</span>
            </div>
            <input value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder={`${activePage.title} | ${site.name}`} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <label className="text-xs font-medium text-gray-700">Short summary for Google</label>
              <span className={cn('text-xs', descLen > 160 ? 'text-red-500' : descLen > 140 ? 'text-amber-500' : 'text-gray-400')}>{descLen}/160</span>
            </div>
            <textarea value={seoDesc} onChange={e => setSeoDesc(e.target.value)} placeholder="Describe this page in 150-160 characters..." rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Share image (social media preview)</label>
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
            <Save className="w-3.5 h-3.5" /> Save search settings
          </button>

          {/* AI section suggestions */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <div className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary/80" /> AI section ideas
            </div>
            <button onClick={handleSuggestBlocks} disabled={suggestBlocks.isPending} className="w-full py-2 border border-primary/30 text-primary text-xs font-medium rounded-xl hover:bg-accent flex items-center justify-center gap-2">
              {suggestBlocks.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Suggest sections for this page
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
            <label className="text-xs font-medium text-gray-700">Default title in Google</label>
            <input value={siteTitle} onChange={e => setSiteTitle(e.target.value)} placeholder={site.name} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Default summary for Google</label>
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
            <Save className="w-3.5 h-3.5" /> Save site search settings
          </button>
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
