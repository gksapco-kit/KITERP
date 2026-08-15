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
  Loader2, ChevronRight, MoreVertical, MoreHorizontal, History, Lightbulb, PanelLeft, PanelRight, PanelLeftClose, PanelRightClose,
  AlertTriangle, Download, ExternalLink, RefreshCw,
  Bold, Italic, Link2,
  Minimize2, Move, Pencil, PlusCircle, Upload,
  ZoomIn, ZoomOut,
  Zap, Star, Shield, Phone, Mail, MapPin, Clock, CheckCircle2,
  ChevronLeft, BarChart3, Users, ShoppingBag, Heart, Home,
  PlayCircle, Quote, Award, Briefcase, Camera,
  Type, Square, Columns, Video, Map as MapIcon, MessageSquare,
  Hash, Minus, List, ToggleLeft, Radio, Info,
  Plug, RefreshCcw, Package, ShoppingCart,
  Store as StoreIcon, ClipboardCopy, ClipboardPaste, RotateCcw, SlidersHorizontal, Paintbrush, Scissors, Eraser, Pin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  collectOverlayTargets,
  snapOverlayDrag,
  snapOverlayResize,
  type OverlayGuideLine,
} from '@/lib/overlayAlignmentSnap'
import { placeAnchoredPanel, placeContextMenu } from '@/lib/builderFloatingUiPlacement'
import {
  useSite,
  useUpdateSite,
  useWebsiteTemplates,
  useMedia, useUploadMedia, useSaveExternalUrl,
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
import { useAuthStore } from '@/stores/authStore'
import { useMyVendor, useStores, vendorKeys } from '@/hooks/useVendor'
import { isBuilderSiteAssignedToAnyStore } from '@/lib/builderDraftTemplateSites'
import { mergeWebsiteStyleConfig, readSiteStyleMetadata, resolveSiteWebsiteScope } from '@/lib/websiteCreateWizardPresets'
import {
  resolveSiteStoreLink,
  resolveStorefrontLinkMode,
  resolveStorefrontTemplateMode,
  buildCustomerStoreLink,
  customerLinkForStore,
  storefrontUrlNeedsBranch,
} from '@/lib/liveStorefrontUrl'
import { getTemplatePreviewPalette } from '@/lib/templateBlockHighlights'
import { BuilderCanvasProviders } from '@/components/websites/BuilderCanvasProviders'
import { MapLocationPicker, readMapBlockCoord } from '@/components/maps/MapLocationPicker'
import { CanvasHScrollbar } from '@/components/websites/CanvasHScrollbar'
import { BuilderCanvasPageRenderer, mergePageStyle } from '@/components/websites/BuilderCanvasPageRenderer'
import {
  BuilderSectionOverlay,
  BuilderSectionPaddingHandles,
  BuilderSectionChromePortal,
  useBuilderSectionBox,
  useSectionChromeToolbarDrag,
} from '@/components/websites/BuilderSectionOverlay'
import { SectionSizeControl } from '@/components/websites/SectionSizeControl'
import {
  TypographyFontStack,
  TextCaseList,
  TextFieldAlignGrid,
  LayoutTransformPositionGroup,
  FieldPositionNudge,
  type LayoutTransformScope,
  ColorIdentPickerRow,
  LineSpacingMenuContent,
  LineSpacingToolbarButton,
  typographyToolbarBox,
  type TextAlignH,
  type TextAlignV,
} from '@/components/websites/TypographyCompositionControls'
import {
  generalDesignBarCluster,
  generalDesignBarGrid2x2,
  generalDesignBarGridCell,
  generalDesignBarInsertStack,
  generalDesignBarDeleteCell,
  generalDesignBarInnerBtn,
  DESIGN_BAR_SOFT_ACTIVE,
  DESIGN_BAR_SOFT_DIVIDE,
  DESIGN_BAR_SOFT_INNER_BORDER,
  designBarTabSlot,
  designBarTabClass,
  designBarTabHeader,
  designBarTabList,
  designBarTabPanel,
  designBarRoot,
  visualActionBtn,
  visualToolbarRow,
} from '@/components/websites/designBarVisualUi'
import { ScrollAnimationControls } from '@/components/websites/ScrollAnimationControls'
import { StoreContentGroupTabs } from '@/components/websites/StoreContentGroupTabs'
import { animationOptionLabel } from '@storefront/lib/builderScrollAnimations'
import { blockTypeSupportsBlockLink } from '@storefront/lib/blockLinkPolicy'
import { isDirectVideoFile } from '@storefront/lib/videoEmbed'
import { defaultMarqueeItems, marqueeItemsForEditor, marqueeItemsToLegacyText, parseMarqueeItems, patchMarqueeBlockItems, patchMarqueeBlockItemsFromRaw } from '@storefront/lib/marqueeItems'
import {
  PAYMENT_METHOD_KEYS,
  PAYMENT_METHOD_LABELS,
  paymentMethodLabel,
  paymentMethodsForEditor,
  paymentMethodsFromEditor,
} from '@storefront/lib/paymentMethodCatalog'
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
  buildDeleteBlockElementPatch,
  resolveDeleteBlockElementTarget,
} from '@/lib/builderCanvasElementDelete'
import {
  showBlockFieldPatch,
  canDeleteBlockField,
  isBlockFieldHidden,
  supportsBlockElementDelete,
  listDeletableHiddenFields,
  fieldLabelForKey,
} from '@storefront/lib/blockHiddenFields'
import {
  cloneOverlayForPaste,
  consumeOverlayClipboardAfterPaste,
  getOverlayClipboard,
  hasOverlayClipboard,
  setOverlayClipboard,
} from '@/lib/builderOverlayClipboard'
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
import { resolveWebsiteStoreLink } from '@/lib/websiteStoreAssignment'
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
import { DesignBarDropdownPortal } from '@/components/websites/DesignBarDropdownPortal'
import { VisualDesignBarTools } from '@/components/websites/VisualDesignBarTools'
import { VisualsDesignBarMenu } from '@/components/websites/MediaDesignBarTools'
import { OverlayIconPicker } from '@/components/websites/OverlayIconPicker'
import { OverlayTypographyToolbar } from '@/components/websites/OverlayTypographyToolbar'
import { RichTextWysiwygField } from '@/components/websites/RichTextWysiwygField'
import { SectionImageControls } from '@/components/websites/SectionImageControls'
import { InsertLayerButton } from '@/components/websites/InsertLayerButton'
import {
  overlayHasFillControls,
  overlayHasLinkControl,
  overlayHasTextControls,
  overlayLayerTypeLabel,
  type OverlayLayerItem,
} from '@/lib/builderOverlayVisual'
import { overlayImageImgStyle } from '@storefront/lib/overlayImageStyle'
import {
  OVERLAY_AXIS_MAX,
  OVERLAY_MIN_H_PERCENT,
  OVERLAY_MIN_W_PERCENT,
  normalizeOverlayBox,
  overlayIsBelowProductBand,
  overlayPositionStyle,
  overlayPositionStyleForViewport,
  overlayUsesPercent,
  pxToOverlayPercent,
  type OverlayImageBoundsPct,
} from '@storefront/lib/blockOverlays'
import { builderOverlayIconLabel, overlayIconRenderSize, resolveBuilderOverlayIcon } from '@storefront/lib/builderOverlayIcons'
import { SHAPE_OPTIONS } from '@/lib/builderVisualPresets'
import {
  buildSectionImagePropsPatch,
  sectionPrimaryImageField,
  sectionSupportsContentGroupTransform,
  sectionSupportsEdgeShapes,
  isGlobalStructureBlock,
} from '@storefront/lib/designBarCapabilities'
import {
  readSectionImageFocal,
} from '@storefront/lib/sectionImageStyle'
import {
  canvasImageArraySlots,
  canvasImageStyleField,
  slotKey,
  toggleCanvasImageSlot,
  type ActiveCanvasImageTarget,
  type CanvasImageSlot,
} from '@storefront/lib/canvasImageTarget'
import { SingleImagePreview } from '@/components/common/CatalogMediaLightbox'
import { useImageSourcePicker } from '@/components/common/ImageSourcePicker'
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
import { builderLinkBtn, builderLinkBtnIcon, builderPanelUi } from '@/components/websites/builderPanelUi'
import { discoverSectionLinkTargets, SECTION_CTA_LABEL_KEYS, resolveSocialLinkPanelEntries, countConfiguredSocialLinks } from '@/lib/sectionLinksPanel'
import { BuilderSiteInputParametersModal } from '@/components/websites/BuilderSiteInputParametersModal'
import { BuilderStylePanel } from '@/components/websites/BuilderStylePanel'
import { NavBrandDisplayControls } from '@/components/websites/NavBrandDisplayControls'
import { navBrandDisplayPreview } from '@storefront/lib/navBrandStyle'
import {
  NAV_HEADER_BAR_SIZE_RANGE,
  resolveNavHeaderBarSizeForEditor,
} from '@storefront/lib/navBlockLayout'
import { BuilderStepSlider } from '@/components/websites/BuilderStepSlider'
import {
  PanelBgStylePicker,
  PanelChip,
  PanelChipScroll,
  PanelChipWrap,
  PanelColorRow,
  PanelFieldLabel,
  PanelGroupEyebrow,
  PanelSliderRow,
} from '@/components/websites/BuilderPanelFields'
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
  STORE_CONTENT_GROUPS,
  BLOCK_REQUIRED_DATA_SOURCE,
  isProductSyncedBlock,
  isCategorySyncedBlock,
  isPlansSyncedBlock,
  isPropertiesSyncedBlock,
  isCoursesSyncedBlock,
  isFitnessSyncedBlock,
  isVehiclesSyncedBlock,
  isEventsSyncedBlock,
  isRecurringSyncedBlock,
  isTestimonialsSyncedBlock,
  isWizardSyncedBlock,
  isResourceSyncedBlock,
  type LayoutPickerDataSourceChoice,
} from '@/lib/blockDataSources'
import { mergeLayoutBlockProps } from '@/lib/layoutBlockProps'
import { heroUsesBackgroundImage, heroUsesSideImage, normalizeHeroSideImageProps, resolveBlockPrimaryImageField } from '@/lib/heroLayoutUtils'
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
import { normalizeStorefrontCatalogHref, parseCatalogStorePath, parseStorefrontEmbedRoute } from '@/lib/catalogStorePaths'
import { DraftCatalogPreview } from '@/components/websites/DraftCatalogPreview'
import { findBuilderPageForNavPath } from '@storefront/lib/previewNavRouting'
import { isVendorBlogEnabled } from '@storefront/lib/catalogNavCapabilities'
import { recallDraftPreviewToken } from '@/lib/draftPreviewNavigation'
import {
  isLiveTeamDataSource,
  shouldUseLiveTeam,
  liveItemToPropMember,
  teamPropMembers,
} from '@/lib/teamGridContent'
import { broadcastPreviewTabError, clearPendingPreviewTabError, clearPendingPreviewTabNavigate, PREVIEW_NAV_MESSAGE_TYPE, pushDraftPreviewUpdate, rememberDraftPreviewSession } from '@/lib/draftPreviewSync'
import { IMAGE_SHAPE_OPTIONS, imageShapeRadiusClass, type ImageShape } from '@storefront/lib/sectionItemLayout'
import {
  CATALOG_IMAGE_ASPECT_OPTIONS,
  CATALOG_IMAGE_OBJECT_FIT_OPTIONS,
} from '@storefront/lib/catalogCardLayout'
import {
  TILE_BACKDROP_OPTIONS,
  TILE_OVERLAY_CLIP_OPTIONS,
  TILE_OVERLAY_STYLE_OPTIONS,
} from '@storefront/lib/catalogTileShapePresentation'
import { CATALOG_ADD_BUTTON_STYLE_OPTIONS, parseCatalogAddButtonStyle } from '@storefront/lib/catalogAddButtonStyle'
import { buildFieldStylesCss, fieldTextStyle, CONTENT_GROUP_FIELD_KEY, FIELD_OFFSET_STEP_PX, hasInlineHtml, isInlinePositionField, readFieldOffset, readFlipFlag, readRotateDeg } from '@storefront/lib/fieldTextStyles'
import { BUILDER_FONT_FAMILIES, ensureBuilderFontLoaded, builderFontPreviewStyle } from '@storefront/lib/builderFontFamilies'
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
import {
  patchBreakpointSectionSpacing,
  readRawBlockStyleOverrides,
  resolveBlockSectionSpacing,
} from '@storefront/lib/blockStyleOverrides'

// ?? Block definitions catalog ?????????????????????????????????????????????????

interface BlockDef {
  type: BlockType
  label: string
  icon: React.ElementType
  desc: string
  category: string
  defaultProps: BlockProps
}

const CATEGORY_CARDS_DEFAULTS = {
  title: 'Shop by category',
  eyebrow: 'Explore',
  layout: 'grid',
  columns: 3,
  show_count: 12,
  item_gap: 24,
  card_padding: 16,
  image_height_pct: 100,
  card_style: 'default',
  data_source: { type: 'categories', auto: true },
} as unknown as BlockProps

const DEFAULT_SERVICE_FAQ_ITEMS = [
  { question: 'How quickly can we get started?', answer: 'Most engagements kick off within a week. Strategy sessions can usually be booked the same week if a slot is open.' },
  { question: 'Do you offer payment plans?', answer: 'Projects over $1,500 can be split into 2 or 3 milestone payments. Just ask before invoicing.' },
  { question: "What's your revision policy?", answer: 'Each package includes one round of revisions. Additional rounds are billed at our hourly rate, agreed in advance.' },
  { question: 'Can you work with our existing team?', answer: 'Absolutely. We slot into Slack, Linear, or Notion and adapt our cadence to your stand-ups.' },
]

// Default editable content for vertical library blocks (mirrors storefront mock so the
// section shows real-looking items the vendor can edit / add / delete). Images left blank —
// the storefront generates a gradient placeholder until a real image is uploaded.
const DEFAULT_COURSE_CATALOG_ITEMS = [
  { id: 'c1', title: 'Foundations of Modern Ceramics', instructor: 'Naomi Reyes', level: 'Beginner', duration: '6 weeks', lessons: 24, rating: 4.9, reviews: 412, price: 189, currency: 'USD', category: 'Craft', description: 'Wheel throwing, hand-building, and your first three glazed pieces.', image: '' },
  { id: 'c2', title: 'Photography for Small Brands', instructor: 'Theo Park', level: 'Intermediate', duration: '4 weeks', lessons: 16, rating: 4.8, reviews: 287, price: 149, currency: 'USD', category: 'Photography', description: 'Build a product photo system that scales without a studio.', image: '' },
  { id: 'c3', title: 'Bread & Pastry Fundamentals', instructor: 'Élodie Marin', level: 'Beginner', duration: '8 weeks', lessons: 32, rating: 4.9, reviews: 538, price: 229, currency: 'USD', category: 'Cooking', description: "From sourdough to laminated doughs — recipes you'll keep.", image: '' },
  { id: 'c4', title: 'Watercolor Botanicals', instructor: 'Priya Anand', level: 'Beginner', duration: '5 weeks', lessons: 20, rating: 4.7, reviews: 196, price: 129, currency: 'USD', category: 'Art', description: 'Loose, expressive florals with a forgiving wet-on-wet technique.', image: '' },
]

const DEFAULT_COURSE_SYLLABUS_ITEMS = [
  { week: 1, title: 'Materials, tools, and your studio setup', lessons: 4, duration: '1h 50m' },
  { week: 2, title: 'Hand-building: pinch, coil, and slab', lessons: 5, duration: '2h 20m' },
  { week: 3, title: 'Centering & throwing your first cylinder', lessons: 4, duration: '2h 05m' },
  { week: 4, title: 'Trimming, foot rings, and refinement', lessons: 3, duration: '1h 35m' },
  { week: 5, title: 'Surface, slip, and sgraffito', lessons: 4, duration: '1h 50m' },
  { week: 6, title: 'Glazing, firing, and finishing your three pieces', lessons: 4, duration: '2h 10m' },
]

const DEFAULT_COURSE_OUTCOMES_ITEMS = [
  'Throw a balanced cylinder, bowl, and mug',
  'Mix and apply two reliable glazes',
  'Run a small home or shared studio safely',
]

const DEFAULT_COURSE_PERK_ITEMS = [
  { icon: 'clock', text: '6 weeks of lessons' },
  { icon: 'video', text: '24 on-demand videos' },
  { icon: 'award', text: 'Certificate of completion' },
  { icon: 'users', text: 'Access to private community' },
]

const DEFAULT_EVENT_LISTING_ITEMS = [
  { id: 'ev1', title: 'Field Notes — A Night of Ambient', date: 'Jun 5, 2026', venue: 'The Greene Room, Brooklyn', fromPrice: 35, currency: 'USD', tag: 'Music', image: '' },
  { id: 'ev2', title: 'Spring Pop-Up Market', date: 'Jun 12 – 13, 2026', venue: 'Industry City', fromPrice: 0, currency: 'USD', tag: 'Free', image: '' },
  { id: 'ev3', title: 'Tasting: Natural Wines of the Loire', date: 'Jun 18, 2026', venue: 'Cellar No. 9', fromPrice: 55, currency: 'USD', tag: 'Food & Drink', image: '' },
  { id: 'ev4', title: 'Sketch Club: Life Drawing', date: 'Jun 22, 2026', venue: 'Atelier West', fromPrice: 18, currency: 'USD', tag: 'Workshop', image: '' },
]

const DEFAULT_TICKET_TIER_ITEMS = [
  { id: 'ga', name: 'General Admission', price: 35, currency: 'USD', perks: 'Standing room\nAccess to all sets', remaining: 124, popular: false },
  { id: 'seated', name: 'Reserved Seating', price: 65, currency: 'USD', perks: 'Reserved seat\nDrink ticket included\nEarly entry', remaining: 38, popular: true },
  { id: 'vip', name: 'VIP Lounge', price: 145, currency: 'USD', perks: 'Lounge access\nMeet & greet\nSigned poster\n2 drink tickets', remaining: 6, popular: false },
]

const DEFAULT_RECURRING_PRESET_ITEMS = [
  { id: 'weekly', name: 'Weekly', description: 'Every week, same day', discount_pct: 0 },
  { id: 'biweekly', name: 'Every 2 weeks', description: 'Save 10%', discount_pct: 10 },
  { id: 'monthly', name: 'Monthly', description: 'Once per month', discount_pct: 0 },
]

const DEFAULT_FITNESS_CLASS_ITEMS = [
  { id: 'fc1', name: 'Sunrise Vinyasa', instructor: 'Maya Lin', type: 'Yoga', duration: 60, intensity: 2, date: 'Mon, May 4', time: '6:30 AM', capacity: 24, booked: 18, studio: 'Studio A', price: 22, currency: 'USD' },
  { id: 'fc2', name: 'Power Cycle 45', instructor: 'Jordan Park', type: 'Cycle', duration: 45, intensity: 5, date: 'Mon, May 4', time: '7:00 AM', capacity: 32, booked: 32, studio: 'Cycle Room', price: 26, currency: 'USD' },
  { id: 'fc3', name: 'Strength Foundations', instructor: 'Kai Brooks', type: 'Strength', duration: 50, intensity: 4, date: 'Mon, May 4', time: '12:15 PM', capacity: 16, booked: 9, studio: 'Lifting Floor', price: 28, currency: 'USD' },
  { id: 'fc4', name: 'Reformer Pilates', instructor: 'Sara Holm', type: 'Pilates', duration: 55, intensity: 3, date: 'Mon, May 4', time: '5:30 PM', capacity: 10, booked: 7, studio: 'Studio B', price: 34, currency: 'USD' },
  { id: 'fc5', name: 'HIIT & Conditioning', instructor: 'Devon Wright', type: 'HIIT', duration: 45, intensity: 5, date: 'Mon, May 4', time: '6:30 PM', capacity: 20, booked: 14, studio: 'Studio C', price: 24, currency: 'USD' },
  { id: 'fc6', name: 'Boxing Basics', instructor: 'Rico Alvarez', type: 'Boxing', duration: 60, intensity: 4, date: 'Mon, May 4', time: '7:30 PM', capacity: 14, booked: 11, studio: 'Ring', price: 30, currency: 'USD' },
]

const DEFAULT_PROPERTY_LISTING_ITEMS = [
  { id: 're1', title: 'Sunlit Park Slope Brownstone', address: '127 Carroll St, Brooklyn, NY', price: 1895000, currency: 'USD', beds: 4, baths: 3, sqft: 2400, type: 'house', status: 'new', agent: 'Sasha Reed', image: '' },
  { id: 're2', title: 'Modern Loft with River Views', address: '88 Front St #5B, DUMBO', price: 1290000, currency: 'USD', beds: 2, baths: 2, sqft: 1450, type: 'loft', status: 'for-sale', agent: 'Marcus Cole', image: '' },
  { id: 're3', title: 'Turnkey Craftsman Bungalow', address: '412 Maple Ave, Austin, TX', price: 549000, currency: 'USD', beds: 3, baths: 2, sqft: 1820, type: 'house', status: 'open-house', agent: 'Priya Anand', image: '' },
  { id: 're4', title: 'Downtown Two-Bed Condo', address: '900 5th Ave #12C, Seattle, WA', price: 725000, currency: 'USD', beds: 2, baths: 2, sqft: 1120, type: 'condo', status: 'pending', agent: 'Devon Wright', image: '' },
]

const DEFAULT_AUTO_INVENTORY_ITEMS = [
  { id: 'v1', year: 2025, make: 'Rivian', model: 'R1S', trim: 'Adventure', price: 84900, currency: 'USD', mileage: 12, fuel: 'Electric', transmission: 'Auto', bodyStyle: 'SUV', exteriorColor: 'Forest Green', condition: 'New', image: '' },
  { id: 'v2', year: 2023, make: 'Toyota', model: 'Camry', trim: 'XLE', price: 28900, currency: 'USD', mileage: 18400, fuel: 'Hybrid', transmission: 'Auto', bodyStyle: 'Sedan', exteriorColor: 'Midnight Black', condition: 'Certified', image: '' },
  { id: 'v3', year: 2022, make: 'Ford', model: 'F-150', trim: 'Lariat', price: 41500, currency: 'USD', mileage: 26800, fuel: 'Gas', transmission: 'Auto', bodyStyle: 'Truck', exteriorColor: 'Oxford White', condition: 'Used', image: '' },
  { id: 'v4', year: 2024, make: 'Honda', model: 'Civic', trim: 'Sport', price: 24900, currency: 'USD', mileage: 6200, fuel: 'Gas', transmission: 'Manual', bodyStyle: 'Hatchback', exteriorColor: 'Rallye Red', condition: 'Certified', image: '' },
]

const DEFAULT_VEHICLE_HIGHLIGHT_ITEMS = [
  { text: 'One-owner, clean title' },
  { text: 'Free CARFAX history report' },
  { text: 'Multi-point safety inspection' },
  { text: 'Remaining factory warranty' },
  { text: 'Apple CarPlay & Android Auto' },
  { text: 'Heated front seats' },
]

/** Only this account can show/hide platform “Powered by” branding. */
const POWERED_BY_ADMIN_EMAIL = 'admin@kiterp.com'
const DEFAULT_POWERED_BY_TEXT = 'Powered By @ KITERP.com'
const DEFAULT_POWERED_BY_URL = 'https://kiterp.com/'
function canEditPoweredByOption(email?: string | null): boolean {
  return (email || '').trim().toLowerCase() === POWERED_BY_ADMIN_EMAIL
}

const BLOCK_CATALOG: BlockDef[] = [
  // Structure
  { type: 'nav', label: 'Navigation', icon: Layout, desc: 'Top navigation with logo and links', category: 'structure', defaultProps: { brand: 'My Store', brand_logo: '', show_logo: true, show_brand_name: true, brand_layout: 'horizontal', logo_size: 52, logo_shape: 'original', logo_fit: 'contain', brand_gap: 8, brand_name_size: 'md', show_nav_links: true, nav_links_source: 'site_pages', nav_links: [{ label: 'Shop', url: '/products' }, { label: 'Contact', url: '/contact' }], show_search: true, show_cart: true, show_login: true, cta_label: 'Get started' } },
  { type: 'footer', label: 'Footer', icon: Layout, desc: 'Site footer with links and copyright', category: 'structure', defaultProps: {
    brand: '',
    description: '',
    copyright: '? 2026 My Store. All rights reserved.',
    show_legal: true,
    show_social: true,
    show_powered_by: true,
    powered_by_text: 'Powered By @ KITERP.com',
    powered_by_text_url: 'https://kiterp.com/',
    powered_by_text_link_new_tab: true,
    social_links: {
      whatsapp: '',
      twitter: '',
      facebook: '',
      instagram: '',
      youtube: '',
    },
    footer_columns: [
      { title: 'Shop', links: ['All products', 'Categories', 'Offers'] },
      { title: 'Help', links: ['Contact', 'Shipping', 'Returns'] },
      { title: 'About', links: ['Our story', 'Visit us', 'Careers'] },
      { title: 'Legal', links: ['Terms', 'Privacy', 'Refund policy'] },
    ],
  } },
  { type: 'announcement_bar', label: 'Announcement Bar', icon: Hash, desc: 'Top banner for promotions', category: 'structure', defaultProps: { text: 'Free delivery on orders over ?499 ? shop our latest arrivals today.', color: '#274832', show_close: true } },
  { type: 'marquee_strip', label: 'Marquee strip', icon: Type, desc: 'Scrolling highlights with text and/or images', category: 'structure', defaultProps: { items: defaultMarqueeItems(), text: marqueeItemsToLegacyText(defaultMarqueeItems()), item_gap: 40 } },
  // Hero
  { type: 'hero', label: 'Hero ? Centered', icon: Square, desc: 'Full-width hero with CTA buttons', category: 'hero', defaultProps: { headline: 'Welcome to Our Store', subtitle: 'Thoughtfully chosen products and friendly service ? everything you need in one place.', bg_style: 'gradient', cta_primary: 'Shop now', cta_secondary: 'Learn more', layout: 'centered' } },
  { type: 'hero_split', label: 'Hero ? Split', icon: Columns, desc: 'Left text, right image hero', category: 'hero', defaultProps: { headline: 'Discover what we offer', headline_line2: 'made for everyday life', subtitle: 'Browse our collection ? quality you can see, service you can trust.', bg_style: 'minimal', cta_primary: 'Shop bestsellers', cta_secondary: 'Browse categories', layout: 'split', eyebrow: 'Welcome', eyebrow_plain: true } },
  { type: 'hero_minimal', label: 'Hero ? Minimal', icon: Type, desc: 'Clean, text-focused hero', category: 'hero', defaultProps: { headline: 'Simple. Beautiful. Yours.', subtitle: 'A clean start for your brand ? edit this headline to match your store.', bg_style: 'minimal', cta_primary: 'Get started', layout: 'minimal' } },
  // Content
  { type: 'features', label: 'Features Grid', icon: Columns, desc: 'Feature cards in a grid', category: 'content', defaultProps: { title: 'Why shop with us', layout: 'grid-3', features: [{ icon: 'Truck', title: 'Fast delivery', desc: 'Quick, reliable shipping to your door' }, { icon: 'Shield', title: 'Secure checkout', desc: 'Safe payments and protected orders' }, { icon: 'Heart', title: 'Quality guaranteed', desc: 'Handpicked products we stand behind' }] } },
  { type: 'features_alternating', label: 'Features ? Alternating', icon: List, desc: 'Alternating image/text sections', category: 'content', defaultProps: { title: 'Why Choose Us', layout: 'stacked', image_position: 'left', features: [{ title: 'Fresh & quality', desc: 'We source carefully so every order meets our standards.', image_url: '' }, { title: 'Friendly support', desc: 'Questions? Our team is happy to help before and after you buy.', image_url: '' }] } },
  { type: 'about_split', label: 'Our Story', icon: Columns, desc: 'Story left, photo right — Who We Are about section', category: 'about', defaultProps: { title: 'Who We Are', subtitle: 'Our Story', description: 'Tell customers who you are, what you sell, and why they can trust you.', layout: 'split', image_position: 'right' } },
  { type: 'stats', label: 'Stats / Numbers', icon: BarChart3, desc: 'Key metrics and achievements', category: 'content', defaultProps: { title: 'Trusted by our community', stats: [{ value: '2K+', label: 'Happy customers' }, { value: '500+', label: 'Products' }, { value: '4.8?', label: 'Average rating' }, { value: '24/7', label: 'Online ordering' }] } },
  { type: 'testimonials', label: 'Testimonials', icon: Quote, desc: 'Customer reviews and quotes', category: 'social', defaultProps: { title: 'What our customers say', testimonials: [{ name: 'Priya Sharma', role: 'Regular customer', company: '', quote: 'Great quality and fast delivery ? I order every week!', rating: 5 }, { name: 'James Wilson', role: 'Local buyer', company: '', quote: 'Easy to shop and the team was very helpful.', rating: 5 }] } },
  { type: 'team_grid', label: 'Team Grid', icon: Users, desc: 'Meet the team cards', category: 'about', defaultProps: { title: 'Meet our team', columns: 3, image_shape: 'circle', members: [{ name: 'Alex Morgan', role: 'Store owner', bio: 'Passionate about great products and service.' }, { name: 'Sam Rivera', role: 'Customer care', bio: 'Here to help with orders and questions.' }, { name: 'Jordan Lee', role: 'Operations', bio: 'Keeping shelves stocked and delivery on track.' }] } },
  { type: 'pricing', label: 'Pricing Table', icon: Hash, desc: 'Pricing plans comparison', category: 'conversion', defaultProps: { title: 'Our packages', show_annual_toggle: false, data_source: { type: 'plans', auto: true } } },
  { type: 'faq', label: 'FAQ / Accordion', icon: MessageSquare, desc: 'Frequently asked questions', category: 'content', defaultProps: { title: 'Common questions', faqs: [{ question: 'How do I place an order?', answer: 'Browse our products, add items to your cart, and checkout securely online.' }, { question: 'What are your delivery times?', answer: 'Most orders arrive within 2?5 business days. Local delivery may be faster.' }, { question: 'Can I return an item?', answer: 'Yes ? unused items can be returned within 14 days. Contact us to start a return.' }] } },
  { type: 'cta', label: 'Call to Action', icon: Zap, desc: 'Bold CTA section to convert visitors', category: 'conversion', defaultProps: { headline: 'Ready to shop?', subtitle: 'Browse our collection and find something you will love today.', cta_label: 'Start shopping', cta_url: '/products' } },
  { type: 'contact_form', label: 'Contact Form', icon: Mail, desc: 'Contact form with fields', category: 'contact', defaultProps: { title: 'Get in touch', layout: 'split', full_page: false, email: '', phone: '', address: '', show_map: false, form_fields: [{ name: 'name', type: 'text', required: true, placeholder: 'Your name' }, { name: 'email', type: 'email', required: true, placeholder: 'Your email' }, { name: 'message', type: 'textarea', required: true, placeholder: 'How can we help?' }] } },
  { type: 'portfolio_grid', label: 'Portfolio Grid', icon: Camera, desc: 'Filterable work portfolio grid', category: 'portfolio', defaultProps: { title: 'Our Work', columns: 3, filterable: true } },
  { type: 'gallery_masonry', label: 'Gallery Masonry', icon: ImageIcon, desc: 'Masonry image gallery', category: 'media', defaultProps: { title: 'Gallery', layout: 'masonry', columns: 3, images: [] } },
  { type: 'video_gallery', label: 'Video multiple', icon: Video, desc: 'YouTube / Vimeo / Instagram video grid with layouts', category: 'media', defaultProps: { title: 'Video gallery', layout: 'grid', columns: 3, videos: [{ video_url: '', title: '', caption: '' }, { video_url: '', title: '', caption: '' }, { video_url: '', title: '', caption: '' }] } },
  { type: 'blog_grid', label: 'Blog Grid', icon: FileText, desc: 'Latest posts in a grid', category: 'blog', defaultProps: { title: 'Latest Posts', columns: 3, show_count: 12, image_height_pct: 56 } },
  { type: 'newsletter', label: 'Newsletter', icon: Mail, desc: 'Email capture / subscribe form', category: 'conversion', defaultProps: { title: 'Stay in the Loop', subtitle: 'Get the latest news and updates delivered to your inbox.', cta_label: 'Subscribe' } },
  { type: 'video_embed', label: 'Video single', icon: Video, desc: 'YouTube / Vimeo / Instagram video player', category: 'media', defaultProps: { title: 'Watch our story', video_url: '', aspect_ratio: '16:9' } },
  { type: 'map_embed', label: 'Map', icon: MapIcon, desc: 'Embedded map with location', category: 'contact', defaultProps: { title: 'Visit us', address: '', lat: null, lng: null } },
  { type: 'trust_logos', label: 'Trust Logos', icon: Award, desc: 'Partner/client logo strip', category: 'social', defaultProps: { title: 'Trusted by our partners' } },
  { type: 'timeline', label: 'Timeline', icon: Clock, desc: 'Company history or process steps', category: 'about', defaultProps: { title: 'Our story', items: [{ year: '2020', title: 'We opened our doors', desc: 'Started as a small local shop with a big vision.' }, { year: '2022', title: 'Growing together', desc: 'Expanded our range and welcomed thousands of customers.' }, { year: '2024', title: 'Online store launch', desc: 'Now you can shop with us anytime, anywhere.' }] } },
  { type: 'rich_text', label: 'Rich Text', icon: Type, desc: 'Formatted text content block', category: 'content', defaultProps: { content: '<h2>Your Heading</h2><p>Add your content here. This block supports <strong>bold</strong>, <em>italic</em>, and other formatting.</p>' } },
  { type: 'image_block', label: 'Image', icon: ImageIcon, desc: 'Single image with optional caption', category: 'media', defaultProps: { image_url: '', caption: 'Image caption' } },
  { type: 'divider', label: 'Divider', icon: Minus, desc: 'Visual separator between sections', category: 'layout', defaultProps: { style: 'line', color: '#e5e7eb', spacing: 40 } },
  { type: 'spacer', label: 'Spacer', icon: Minus, desc: 'Blank vertical spacer', category: 'layout', defaultProps: { height: 80 } },
  { type: 'social_links', label: 'Social Links', icon: Globe, desc: 'Social media icon links', category: 'social', defaultProps: { title: 'Follow Us', social_links: { twitter: 'https://twitter.com', instagram: 'https://instagram.com', linkedin: 'https://linkedin.com' } } },
  { type: 'countdown', label: 'Countdown Timer', icon: Clock, desc: 'Countdown to a date/event', category: 'conversion', get defaultProps() { return { title: 'Launch In', target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() } } },
  { type: 'category_cards', label: 'Category Cards', icon: Layers, desc: 'Shop-by-category grid — synced from Categories', category: 'ecommerce', defaultProps: CATEGORY_CARDS_DEFAULTS },
  { type: 'menu_grid', label: 'Menu / Catalog', icon: List, desc: 'Restaurant-style menu grid', category: 'food', defaultProps: { title: 'Our Menu', categories: ['Starters', 'Mains', 'Desserts', 'Drinks'] } },
  { type: 'services_cards', label: 'Services Cards', icon: Briefcase, desc: 'Service offering cards', category: 'content', defaultProps: { title: 'Our services', columns: 3, features: [{ icon: 'Zap', title: 'Consultation', desc: 'Expert advice tailored to your needs.' }, { icon: 'Shield', title: 'Installation', desc: 'Professional setup you can rely on.' }, { icon: 'Star', title: 'Support', desc: 'Friendly help after you buy.' }] } },
  { type: 'rental_grid', label: 'Rental Assets Grid', icon: Package, desc: 'Rental asset catalog cards — synced from Sales → Rental Assets', category: 'ecommerce', defaultProps: { title: 'Rentals', columns: 3 } },
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
  // product_detail / product_reviews omitted from Add Section — use commerce product.detail / product.reviews
  { type: 'cart_drawer', label: 'Cart Drawer', icon: ShoppingCart, desc: 'Slide-out cart panel with upsells', category: 'erp', defaultProps: { title: 'Your Cart', show_upsells: true } },
  { type: 'checkout_form', label: 'Checkout Form', icon: ShoppingCart, desc: 'Address, shipping, payment fields', category: 'erp', defaultProps: { allow_cod: true, show_tip: false } },
  { type: 'search_bar', label: 'Search Bar', icon: Search, desc: 'Autosuggest product/service search', category: 'ecommerce', defaultProps: { placeholder: 'Search products & services...', show_filters: true } },
  { type: 'product_filters', label: 'Product Filters', icon: List, desc: 'Faceted filter sidebar', category: 'ecommerce', defaultProps: { show_price: true, show_category: true, show_brand: true } },
  { type: 'related_products', label: 'Related Products', icon: ShoppingBag, desc: 'Cross-sell / upsell grid', category: 'ecommerce', defaultProps: { title: 'You May Also Like', count: 4 } },
  { type: 'recently_viewed', label: 'Recently Viewed', icon: Clock, desc: 'Client-side recently viewed items', category: 'ecommerce', defaultProps: { title: 'Recently Viewed', max: 6 } },
  { type: 'coupon_banner', label: 'Coupon Banner', icon: Hash, desc: 'Promotional coupon code display', category: 'erp', defaultProps: { title: 'Use code SAVE10 for 10% off!', show_copy_button: true } },
  { type: 'payment_methods_strip', label: 'Payment Methods', icon: Hash, desc: 'Payment provider logo strip', category: 'erp', defaultProps: { title: 'Secure Payments', methods: [{ method: 'visa' }, { method: 'mastercard' }, { method: 'upi' }, { method: 'google_pay' }, { method: 'cod' }] } },
  { type: 'cookie_consent', label: 'Cookie Consent', icon: Shield, desc: 'GDPR/CCPA cookie consent banner', category: 'advanced', defaultProps: { message: 'We use cookies to improve your experience.', accept_label: 'Accept', decline_label: 'Decline' } },
]



const COMMERCE_LIBRARY_BLOCKS: BlockDef[] = [
  { type: 'product.grid', label: 'Product Grid', icon: ShoppingBag, desc: 'Responsive product listing with grid, list, and carousel layouts.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'product.featured', label: 'Featured Product', icon: ShoppingBag, desc: 'Hero spotlight for a single product with image and CTA.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  // product.detail omitted from Add Section — native /products/:slug PDP covers this
  { type: 'product.cart', label: 'Mini Cart', icon: ShoppingBag, desc: 'Cart with quantity controls, totals, and shipping summary.', category: 'erp', defaultProps: { variant: 'default' } },
  { type: 'product.categories', label: 'Category Showcase', icon: ShoppingBag, desc: 'Shop-by-category grid — synced from Categories', category: 'ecommerce', defaultProps: { variant: 'grid', layout: 'grid', title: 'Shop by category', columns: 4, data_source: { type: 'categories', auto: true } } },
  { type: 'product.carousel', label: 'Product Carousel', icon: ShoppingBag, desc: 'Horizontally scrolling product showcase.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'service.list', label: 'Service List', icon: Briefcase, desc: 'Detailed service rows with features and price.', category: 'content', defaultProps: { variant: 'default' } },
  { type: 'service.grid', label: 'Service Card Grid', icon: Briefcase, desc: 'Service cards laid out in a responsive grid.', category: 'content', defaultProps: { variant: 'default' } },
  { type: 'service.detail', label: 'Service Detail', icon: Briefcase, desc: 'Service page with description, inclusions, and booking sidebar.', category: 'content', defaultProps: { variant: 'default' } },
  { type: 'service.pricing', label: 'Pricing Tiers', icon: Briefcase, desc: 'Three-column pricing comparison with featured plan.', category: 'content', defaultProps: { title: 'Our packages', subtitle: 'Choose the plan that fits you', show_annual_toggle: false, data_source: { type: 'plans', auto: true } } },
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
  { type: 'service.process', label: 'Process Steps', icon: Briefcase, desc: 'Numbered step-by-step engagement timeline.', category: 'content', defaultProps: { variant: 'horizontal', layout: 'horizontal', title: 'How we work together', steps: [
    { title: 'Discover', description: '30-min intake call, brand questionnaire, and audit of current materials.' },
    { title: 'Define', description: 'Workshop to align on positioning, audience, and visual direction.' },
    { title: 'Design', description: 'Two concept directions presented, refined into one polished system.' },
    { title: 'Deliver', description: 'Final assets, source files, and a guidelines doc handed off.' },
  ] } },
  { type: 'service.faq', label: 'FAQ', icon: Briefcase, desc: 'Accordion of common questions and answers.', category: 'content', defaultProps: { variant: 'default', title: 'Frequently asked', faqs: DEFAULT_SERVICE_FAQ_ITEMS } },
  { type: 'service.team', label: 'Team Picker', icon: Briefcase, desc: 'Pick a team member, see availability and rating.', category: 'content', defaultProps: { variant: 'grid', layout: 'grid', title: 'Choose a practitioner', members: [
    { name: 'Elena Ruiz', role: 'Lead Strategist', bio: '12 years building brand systems for hospitality and DTC.', rating: 4.9, reviews: 87, available: true, nextAvailable: 'Today, 3:30 PM' },
    { name: 'Jordan Chen', role: 'Senior Designer', bio: 'Identity, packaging, and editorial. Loves a tight grid.', rating: 4.8, reviews: 64, available: true, nextAvailable: 'Tomorrow, 10:00 AM' },
    { name: 'Priya Shah', role: 'Creative Director', bio: 'Leads the studio. Heavy on positioning and verbal identity.', rating: 5.0, reviews: 42, available: false, nextAvailable: 'Next Monday' },
  ] as BlockProps['members'] } },
  { type: 'service.addons', label: 'Add-ons Selector', icon: Briefcase, desc: 'Multi-select add-ons with running total.', category: 'content', defaultProps: { variant: 'default' } },
  { type: 'menu.wine', label: 'Wine Pairing', icon: List, desc: 'Wines by glass/bottle with pairings and tasting notes.', category: 'food', defaultProps: { variant: 'default' } },
  { type: 'menu.combo', label: 'Combo / Set Menu', icon: List, desc: 'Multi-course set menus with choose-your-own options.', category: 'food', defaultProps: { variant: 'default' } },
  { type: 'menu.nutrition', label: 'Nutrition Table', icon: List, desc: 'Sortable per-serving nutrition information table.', category: 'food', defaultProps: { variant: 'default' } },
  { type: 'booking.resource', label: 'Resource Picker', icon: Clock, desc: 'Synced with Sales → Resources. Pick a room, court, or piece of equipment to book.', category: 'widgets', defaultProps: { variant: 'grid' } },
  { type: 'booking.wizard', label: 'Booking Wizard', icon: Clock, desc: 'Multi-step progress indicator for booking flows. Steps sync from Sales → Booking Wizard.', category: 'widgets', defaultProps: { variant: 'horizontal', showLabels: true } },
  { type: 'booking.email', label: 'Confirmation Email', icon: Clock, desc: 'Preview of the booking confirmation email.', category: 'widgets', defaultProps: { variant: 'default' } },
  { type: 'booking.history', label: 'Past Bookings', icon: Clock, desc: 'Customer\'s booking history with status badges.', category: 'widgets', defaultProps: { variant: 'default' } },
  { type: 'commerce.checkout', label: 'Checkout', icon: ShoppingCart, desc: 'Full checkout with shipping, payment, and order summary.', category: 'erp', defaultProps: { variant: 'default' } },
  { type: 'commerce.address', label: 'Address Book', icon: ShoppingCart, desc: 'Saved shipping addresses with select / edit / add.', category: 'erp', defaultProps: { variant: 'default' } },
  { type: 'commerce.orderConfirmation', label: 'Order Confirmation', icon: ShoppingCart, desc: 'Thank-you page with order details and shipping ETA.', category: 'erp', defaultProps: { variant: 'default' } },
  { type: 'commerce.giftCards', label: 'Gift Cards', icon: ShoppingCart, desc: 'Buy a gift card or check an existing balance.', category: 'erp', defaultProps: { variant: 'default' } },
  { type: 'booking.group', label: 'Group Booking', icon: Clock, desc: 'Adult/child counters with min/max party size.', category: 'widgets', defaultProps: { variant: 'default' } },
  { type: 'booking.recurring', label: 'Recurring Booking', icon: Clock, desc: 'Weekly / bi-weekly / monthly series with discount.', category: 'widgets', defaultProps: {
    variant: 'default',
    image_url: '',
    title: 'Weekly Yoga · Vinyasa Flow',
    startDate: 'Mon, May 4',
    time: '7:30 AM · 60 min',
    pricePerSession: 22,
    currency: 'USD',
    defaultSessionCount: 8,
    minSessions: 2,
    maxSessions: 24,
    showUpcoming: true,
    cta: 'Confirm series',
    presets: DEFAULT_RECURRING_PRESET_ITEMS,
  } },
  { type: 'booking.waitlist', label: 'Waitlist', icon: Clock, desc: 'Join waitlist form or current position card.', category: 'widgets', defaultProps: { variant: 'default' } },
  { type: 'state.empty', label: 'Empty State', icon: AlertTriangle, desc: 'Friendly empty placeholders for cart, search, wishlist, and more.', category: 'advanced', defaultProps: {
    variant: 'default',
    preset: 'emptyCart',
    size: 'md',
    title: 'Your cart is empty',
    description: "Looks like you haven't added anything yet. Browse our latest arrivals.",
    cta: 'Start shopping',
    cta_url: '',
    secondary_cta: 'View wishlist',
    secondary_cta_url: '',
    showSecondary: true,
  } },
  { type: 'state.skeleton', label: 'Skeleton Loader', icon: AlertTriangle, desc: 'Loading placeholders shaped like the content they replace.', category: 'advanced', defaultProps: { variant: 'default', preset: 'productGrid', count: 6 } },
  { type: 'state.error', label: 'Error State', icon: AlertTriangle, desc: '404, 500, network, and maintenance error placeholders.', category: 'advanced', defaultProps: {
    variant: 'default',
    preset: 'generic',
    error_code: 'Oops',
    title: 'Something went wrong',
    description: 'We hit an unexpected snag. Try again, or contact support if it persists.',
    cta: 'Try again',
    cta_url: '',
    secondary_cta: 'Go back',
    secondary_cta_url: '',
    showSecondary: true,
  } },
  { type: 'vertical.propertyListing', label: 'Property Listing', icon: StoreIcon, desc: 'Real estate listings in grid, list, or map layout.', category: 'ecommerce', defaultProps: { variant: 'default', header_title: 'Featured listings', header_subtitle: '', refine_label: 'Refine search', cta: 'View details', showAgent: true, properties: DEFAULT_PROPERTY_LISTING_ITEMS } },
  { type: 'vertical.propertyDetail', label: 'Property Detail', icon: StoreIcon, desc: 'Full property page with gallery, stats, agent, and mortgage.', category: 'ecommerce', defaultProps: { variant: 'default' } },
  { type: 'vertical.autoInventory', label: 'Auto Inventory', icon: StoreIcon, desc: 'Vehicle inventory grid with price filter and condition badges.', category: 'ecommerce', defaultProps: { variant: 'default', header_title: 'Available inventory', header_subtitle: '', cta: 'View vehicle', showFilters: true, vehicles: DEFAULT_AUTO_INVENTORY_ITEMS } },
  { type: 'vertical.vehicleDetail', label: 'Vehicle Detail', icon: StoreIcon, desc: 'Full vehicle page with specs, highlights, and finance estimate.', category: 'ecommerce', defaultProps: {
    variant: 'default',
    image_url: '',
    condition: 'New',
    year: 2025,
    make: 'Rivian',
    model: 'R1S',
    trim: 'Adventure',
    exteriorColor: 'Forest Green',
    bodyStyle: 'SUV',
    mileage: 12,
    fuel: 'Electric',
    transmission: 'Auto',
    price: 84900,
    currency: 'USD',
    location_note: 'Located at our Williamsburg showroom · Available for delivery',
    cta: 'Schedule test drive',
    highlights: DEFAULT_VEHICLE_HIGHLIGHT_ITEMS,
  } },
  { type: 'vertical.fitnessSchedule', label: 'Fitness Schedule', icon: StoreIcon, desc: 'Class schedule with intensity, capacity, and reservations.', category: 'ecommerce', defaultProps: { variant: 'default', classes: DEFAULT_FITNESS_CLASS_ITEMS } },
  { type: 'vertical.eventListing', label: 'Event Listing', icon: StoreIcon, desc: 'Upcoming events in grid or list, with date and venue.', category: 'ecommerce', defaultProps: { variant: 'default', header_title: 'Upcoming events', header_subtitle: '', all_events_label: 'All events', cta: 'Get tickets', showTag: true, events: DEFAULT_EVENT_LISTING_ITEMS } },
  { type: 'vertical.ticketPicker', label: 'Ticket Picker', icon: StoreIcon, desc: 'Tiered ticket selection with seating chart and order summary.', category: 'ecommerce', defaultProps: { variant: 'default', title: 'Field Notes — A Night of Ambient', tagline: 'An intimate evening of live electronic & strings', image_url: '', date: 'Friday, June 5, 2026', doors: '7:30 PM', start: '8:30 PM', end: '11:00 PM', venue: 'The Greene Room', address: '418 Atlantic Ave, Brooklyn', venue_capacity: 500, order_title: 'Your order', age_note: '21+ event · ID required at door', seating_title: 'Seating chart', max_per_order: 8, cta: 'Continue to checkout', showSeating: true, tiers: DEFAULT_TICKET_TIER_ITEMS } },
  { type: 'vertical.courseCatalog', label: 'Course Catalog', icon: StoreIcon, desc: 'Browse courses with rating, level, and price.', category: 'ecommerce', defaultProps: { variant: 'default', header_title: 'Featured courses', header_subtitle: '', all_courses_label: 'All courses', cta: 'Enroll', showInstructor: true, courses: DEFAULT_COURSE_CATALOG_ITEMS } },
  { type: 'vertical.courseDetail', label: 'Course Detail', icon: StoreIcon, desc: 'Course page with syllabus, outcomes, and pricing card.', category: 'ecommerce', defaultProps: {
    variant: 'default',
    title: 'Foundations of Modern Ceramics',
    instructor: 'Naomi Reyes',
    level: 'Beginner',
    category: 'Craft',
    description: 'Wheel throwing, hand-building, and your first three glazed pieces.',
    image_url: '',
    duration: '6 weeks',
    lessons: 24,
    rating: 4.9,
    reviews: 412,
    price: 189,
    currency: 'USD',
    enrolled_label: '2,400+ enrolled',
    cta: 'Enroll for',
    preview_cta: 'Try free preview',
    syllabus: DEFAULT_COURSE_SYLLABUS_ITEMS,
    outcomes: DEFAULT_COURSE_OUTCOMES_ITEMS,
    perks: DEFAULT_COURSE_PERK_ITEMS,
  } },
]

BLOCK_CATALOG.push(...COMMERCE_LIBRARY_BLOCKS)


// ?? Block mini-preview thumbnails (emoji shorthand) ???????????????????????????
const BLOCK_THUMBNAILS: Record<string, string> = {
  nav: '??', footer: '??', announcement_bar: '??', marquee_strip: '??',
  hero: '??', hero_split: '??', hero_minimal: '?',
  features: '?', features_alternating: '??',
  stats: '??', testimonials: '??', team_grid: '??',
  pricing: '??', faq: '?', cta: '??',
  contact_form: '??', portfolio_grid: '???', gallery_masonry: '???', video_gallery: '??',
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
  vendorSlug?: string | null,
): Record<string, unknown> {
  return buildBuilderPublicSite(site, localPages, localBlocks, localStyle, vendorSlug) as unknown as Record<string, unknown>
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
  /** Horizontal offset — percent of section width when coordUnit is `percent`, else px. */
  x: number
  /** Vertical offset — percent of section height when coordUnit is `percent`, else px. */
  y: number
  w: number
  h: number
  /** When `'percent'`, x/y/w/h are 0–100 and stay sticky to the section on resize. */
  coordUnit?: 'percent' | 'px'
  text?: string
  description?: string // tooltip / alt / accessibility + aria-label
  src?: string
  href?: string
  linkType?: OverlayLinkType
  linkTarget?: string            // resolved target (slug / page id / email)
  linkLabel?: string             // human-readable label (e.g. "Espresso ? ?180")
  openInNewTab?: boolean
  fontSize?: number
  fontFamily?: string
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
  /** Zoom within layer frame (25–400, default 100). */
  imageScale?: number
  objectFit?: 'cover' | 'contain' | 'fill'
  /** When `'none'`, fill is transparent so the block/page background shows through. */
  bgFill?: 'solid' | 'none'
  /** Lucide icon id when type is `icon`. */
  iconName?: string
}

function overlayTextFontStyle(item: BlockOverlayItem): React.CSSProperties {
  if (!item.fontFamily) return {}
  ensureBuilderFontLoaded(item.fontFamily)
  return builderFontPreviewStyle(item.fontFamily)
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
  text:    { w: 28, h: 8,  text: 'Your text here', fontSize: 18, color: '#111827', bgColor: 'transparent' },
  image:   { w: 35, h: 22, objectFit: 'cover', borderRadius: 8 },
  button:  { w: 18, h: 6,  text: 'Click Here', bgColor: '#64C3A0', color: '#ffffff', borderRadius: 8, fontSize: 14, fontWeight: 'bold' },
  box:     { w: 32, h: 20, bgColor: 'rgba(255,255,255,0.9)', borderRadius: 12, shadow: true, borderColor: 'rgba(124,58,237,0.2)', borderWidth: 2 },
  badge:   { w: 12, h: 5,  text: 'New', bgColor: '#64C3A0', color: '#ffffff', borderRadius: 999, fontSize: 12, fontWeight: 'bold' },
  icon:    { w: 8,  h: 8,  iconName: 'star', color: '#111827', bgColor: 'transparent', bgFill: 'none', fontSize: 32 },
  video:   { w: 38, h: 22, bgColor: '#000000', borderRadius: 8 },
  // Insert-helpers: reuse the button overlay shape but seed link fields so the
  // link-editor popup opens pre-focused on the right section (URL vs DB).
  link:    { w: 18, h: 6, text: 'Open Link', bgColor: '#64C3A0', color: '#ffffff', borderRadius: 8, fontSize: 14, fontWeight: 'bold', linkType: 'url' },
  db_link: { w: 20, h: 6, text: 'View Product', bgColor: '#0ea5e9', color: '#ffffff', borderRadius: 8, fontSize: 14, fontWeight: 'bold', linkType: 'product' },
  store:   { w: 20, h: 6, text: 'Visit Store', bgColor: '#0f766e', color: '#ffffff', borderRadius: 8, fontSize: 14, fontWeight: 'bold', linkType: 'store' },
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

/** Undo CSS scale/zoom on the overlay canvas so pointer coords match stored x/y/w/h. */
function overlayContainerScale(container: HTMLElement): { scaleX: number; scaleY: number } {
  const rect = container.getBoundingClientRect()
  const scaleX = container.offsetWidth > 0 ? rect.width / container.offsetWidth : 1
  const scaleY = container.offsetHeight > 0 ? rect.height / container.offsetHeight : 1
  return { scaleX: scaleX || 1, scaleY: scaleY || 1 }
}

function pointerToOverlayLocal(
  clientX: number,
  clientY: number,
  container: HTMLElement | null | undefined,
): { x: number; y: number } {
  if (!container) return { x: 0, y: 0 }
  const rect = container.getBoundingClientRect()
  const { scaleX, scaleY } = overlayContainerScale(container)
  return {
    x: (clientX - rect.left) / scaleX,
    y: (clientY - rect.top) / scaleY,
  }
}

/** Pointer position as 0–100 percent of the overlay canvas (responsive coords). */
function pointerToOverlayPercent(
  clientX: number,
  clientY: number,
  container: HTMLElement | null | undefined,
): { x: number; y: number } {
  if (!container) return { x: 0, y: 0 }
  const local = pointerToOverlayLocal(clientX, clientY, container)
  const cw = container.clientWidth || 1
  const ch = container.clientHeight || 1
  return {
    x: Math.max(0, Math.min(OVERLAY_AXIS_MAX, Math.round((local.x / cw) * 100))),
    y: Math.max(0, Math.min(OVERLAY_AXIS_MAX, Math.round((local.y / ch) * 100))),
  }
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

// ?? Ready Page Picker Modal ?????????????????????????????????????????????????????

type ReadyPageItem = {
  slug: string
  title: string
  page_type: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

function ReadyPagePickerModal({
  open,
  pages,
  onSelect,
  onClose,
}: {
  open: boolean
  pages: ReadyPageItem[]
  onSelect: (slug: string, title: string, pageType: string) => void
  onClose: () => void
}) {
  const { ref, pos, headerMouseDown } = useDraggablePopup(open)
  const [fixedPlacement, setFixedPlacement] = useState<{ top: number; left: number } | null>(null)
  useEscapeToClose(onClose, open)

  useEffect(() => {
    if (!open) { setFixedPlacement(null); return }
    const panelW = 420
    const panelH = Math.min(520, window.innerHeight - 48)
    setFixedPlacement({
      left: Math.max(12, (window.innerWidth - panelW) / 2),
      top: Math.max(12, (window.innerHeight - panelH) / 2),
    })
  }, [open])

  if (!open) return null

  const style: React.CSSProperties = pos
    ? { position: 'fixed', top: pos.y, left: pos.x, zIndex: 100020 }
    : fixedPlacement
      ? { position: 'fixed', top: fixedPlacement.top, left: fixedPlacement.left, zIndex: 100020 }
      : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 100020 }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-[99999]" onClick={onClose} />
      <div
        ref={ref}
        data-builder-floating-ui
        style={style}
        className="w-[420px] max-w-[92vw] bg-card border border-border text-foreground rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-4 py-3 bg-gradient-to-r from-primary to-emerald-700 text-white flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
          onMouseDown={headerMouseDown}
          title="Drag to move"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Move className="w-3 h-3 opacity-60 shrink-0" />
            <Layout className="w-4 h-4 shrink-0" />
            <span className="text-sm font-bold">Add a Ready Page</span>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 rounded hover:bg-white/20 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-header */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-xs text-gray-500">
            Select a pre-built page to add to your site. Only pages you haven't added yet are shown.
          </p>
        </div>

        {/* Page grid */}
        <div className="px-3 pb-3 pt-2 grid grid-cols-2 gap-2 max-h-[360px] overflow-y-auto">
          {pages.map(rp => (
            <button
              key={rp.slug}
              type="button"
              onClick={() => onSelect(rp.slug, rp.title, rp.page_type)}
              className="flex flex-col items-start gap-2 rounded-xl border border-gray-200 bg-white hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-sm p-3 text-left transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors shrink-0">
                <rp.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900 group-hover:text-primary transition-colors leading-snug">
                  {rp.title}
                </p>
                <p className="text-[10px] text-gray-400 leading-snug mt-0.5">{rp.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
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
  /** Frozen once when opened — avoids jumping when obstacle detection sees this panel. */
  const [fixedPlacement, setFixedPlacement] = useState<{ top: number; left: number } | null>(null)
  useEscapeToClose(onClose, open)
  useEffect(() => { if (open) setVal(initialValue || '') }, [open, initialValue])

  useEffect(() => {
    if (!open) {
      setFixedPlacement(null)
      return
    }
    const panelW = 380
    const panelH = multiline ? 280 : 240
    if (anchor) {
      setFixedPlacement(placeContextMenu(anchor, panelW, panelH))
      return
    }
    const vw = window.innerWidth
    const vh = window.innerHeight
    setFixedPlacement({
      left: Math.max(12, (vw - panelW) / 2),
      top: Math.min(vh * 0.32, vh - panelH - 12),
    })
  }, [open, anchor?.x, anchor?.y, multiline])

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
    ? { position: 'fixed', top: pos.y, left: pos.x, zIndex: 100020 }
    : fixedPlacement
      ? { position: 'fixed', top: fixedPlacement.top, left: fixedPlacement.left, zIndex: 100020 }
      : { position: 'fixed', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 100020 }

  const textFieldProps = {
    spellCheck: false,
    autoComplete: 'off' as const,
    autoCorrect: 'off' as const,
    autoCapitalize: 'off' as const,
    'data-ms-editor': 'false',
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[99999]" onClick={onClose} />
      <div
        ref={ref}
        data-builder-floating-ui
        style={style}
        className="w-[380px] max-w-[92vw] bg-card border border-border text-foreground rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
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
              {...textFieldProps}
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
              {...textFieldProps}
              onKeyDown={e => {
                if (e.key === 'Escape') onClose()
                if (e.key === 'Enter' && canSubmit) { e.preventDefault(); commit() }
              }}
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
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-lg border border-gray-300 bg-white py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
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

/** Link picker tabs — Ext API is store-data only. */
const LINK_PICKER_GROUPS = STORE_CONTENT_GROUPS.filter(g => g.id !== 'ext_api')

/** Link picker group tabs (Ext API is live-content only, via layout picker). */
const LINK_GROUPS = LINK_PICKER_GROUPS.map(g => ({
  ...g,
  desc: g.id === 'basic' ? 'URLs, anchors, pages'
    : g.id === 'catalog' ? 'Live products, services, categories, files'
    : g.id === 'people' ? 'Team, testimonials'
    : g.id === 'stores' ? 'Linked physical outlets / branches'
    : g.id === 'actions' ? 'Booking, quotes, email, phone'
    : 'Customer login, account, cart, checkout',
}))

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
    // External URLs: a bare domain ("example.com") would otherwise be treated as an
    // internal store path on the storefront. Prepend a scheme so it resolves as a
    // real external link, while leaving site-relative paths and anchors untouched.
    if (type === 'url' && finalTarget
      && !/^(https?:|mailto:|tel:)/i.test(finalTarget)
      && !finalTarget.startsWith('/')
      && !finalTarget.startsWith('#')
      && !finalTarget.startsWith('//')) {
      finalTarget = `https://${finalTarget}`
    }
    // Don't persist a catalog/page/media pick that hasn't actually selected a target,
    // which would render as a dead link on the published site.
    if (currentMeta?.resource && !finalTarget) return
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
        className="w-[460px] max-w-[94vw] bg-card border border-border text-foreground rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
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
        <StoreContentGroupTabs
          activeGroup={activeGroup}
          onGroupChange={(group) => {
            if (group === 'ext_api') return
            setActiveGroup(group as LinkTypeMeta['group'])
          }}
          groups={LINK_GROUPS}
          className="shrink-0 rounded-none border-x-0 border-t-0"
        />

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
                    // External website links default to opening in a new tab.
                    if (opt.id === 'url') setOpenNew(true)
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
  const { ref, pos, headerMouseDown } = useDraggablePopup(open)
  useEscapeToClose(onClose, open)

  useEffect(() => {
    if (open) setSubmenu(null)
  }, [open, x, y])

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      onClose()
    }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [open, onClose, ref])

  if (!open) return null
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const menuWidth = 224
  const menuHeight = Math.min(Math.max(200, (actions.length + 1) * 34 + 56), vh - 24)
  const initial = placeContextMenu({ x, y }, menuWidth, menuHeight)
  const menuLeft = pos?.x ?? initial.left
  const menuTop = pos?.y ?? initial.top

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
      ref={ref}
      data-builder-floating-ui
      style={{ position: 'fixed', top: menuTop, left: menuLeft, zIndex: 100015 }}
      className="w-56 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-100"
      onClick={e => e.stopPropagation()}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation() }}
    >
      <div
        className="flex cursor-grab select-none items-center gap-1.5 border-b border-gray-100 bg-gray-50/90 px-2 py-1.5 active:cursor-grabbing"
        onMouseDown={headerMouseDown}
        title="Drag to move this menu"
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          Actions
        </span>
        <button
          type="button"
          aria-label="Close menu"
          title="Close"
          onClick={e => {
            e.stopPropagation()
            onClose()
          }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="max-h-[min(70vh,420px)] overflow-y-auto py-1.5">
        {actions.map(renderAction)}
      </div>

      <div className="border-t border-border bg-muted/25 px-1.5 py-1.5">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation()
            onClose()
          }}
          className="flex w-full items-center justify-center rounded-md px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>

      {activeSub && (
        <div
          style={{ position: 'fixed', top: menuTop, left: menuLeft + menuWidth + 4, zIndex: 100016 }}
          className="w-52 max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 bg-white py-1.5 shadow-2xl"
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
  totalPages,
  pageIndex,
  onRename,
  onSetHomepage,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
}: {
  page: WebsitePage
  pageCount: number
  totalPages: number
  pageIndex: number
  onRename: () => void
  onSetHomepage: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const canMoveUp = pageIndex > 0
  const canMoveDown = pageIndex < totalPages - 1
  const canDelete = pageCount > 1 && isPersistedPageId(page.id)
  const deleteHint = pageCount <= 1
    ? 'Your site needs at least one page.'
    : !isPersistedPageId(page.id)
      ? 'Save this page before moving it to trash.'
      : page.is_homepage
        ? 'Homepage will move to the next page automatically.'
        : null

  useEffect(() => {
    if (!open || !buttonRef.current) return
    const update = () => {
      const rect = buttonRef.current!.getBoundingClientRect()
      const menuWidth = 208
      setMenuPos({
        top: rect.bottom + 4,
        left: Math.max(8, rect.right - menuWidth),
      })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
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

  const menu = open ? (
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 100020 }}
      className="w-52 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl py-1.5"
      onMouseDown={e => e.stopPropagation()}
    >
      {menuItem('Rename page', onRename, <Pencil className="w-3.5 h-3.5" />)}
      {!page.is_homepage && menuItem('Set as homepage', onSetHomepage, <span className="text-sm leading-none">??</span>)}
      {menuItem('Move up', canMoveUp ? onMoveUp : undefined, <ChevronUp className="w-3.5 h-3.5" />)}
      {menuItem('Move down', canMoveDown ? onMoveDown : undefined, <ChevronDown className="w-3.5 h-3.5" />)}
      {menuItem('Duplicate page', onDuplicate, <Copy className="w-3.5 h-3.5" />)}
      <div className="my-1 border-t border-gray-100" />
      {menuItem('Move to trash', canDelete ? onDelete : undefined, <Trash2 className="w-3.5 h-3.5" />, 'danger')}
      {deleteHint && (
        <p className="px-3 pt-1 pb-0.5 text-[10px] leading-snug text-gray-400">{deleteHint}</p>
      )}
    </div>
  ) : null

  return (
    <div ref={rootRef} className="relative shrink-0" onClick={e => e.stopPropagation()}>
      <button
        ref={buttonRef}
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
      {menu && createPortal(menu, document.body)}
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
  variant = 'panel',
}: {
  items: PageTrashItem[]
  onRestore: (id: string, title: string) => void
  onRefresh?: () => void | Promise<void>
  loading?: boolean
  /** When true, show the section even if trash is empty. */
  alwaysShow?: boolean
  /** `menu` — embedded under More → Tools; `panel` — standalone amber card. */
  variant?: 'panel' | 'menu'
}) {
  const isMenu = variant === 'menu'
  if (!alwaysShow && !loading && items.length === 0) return null

  return (
    <div
      className={cn(
        isMenu
          ? builderPanelUi.trashSectionBody
          : cn(builderPanelUi.trashPanelStandalone, 'space-y-1 p-2', alwaysShow ? 'mt-0' : 'mt-1'),
      )}
    >
      {!isMenu && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-foreground">
            <Trash2 className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
            Deleted
            {items.length > 0 && (
              <span className={builderPanelUi.amberBadge}>
                {items.length}
              </span>
            )}
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={loading}
              className={builderPanelUi.btnGhost}
            >
              <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
            </button>
          )}
        </div>
      )}
      {!isMenu && items.length > 0 && (
        <p className={cn(builderPanelUi.hint, 'text-foreground/70')}>
          Restore within 7 days.
        </p>
      )}
      {isMenu && (
        <p className={builderPanelUi.hint}>
          Pages stay here for 7 days, then are removed permanently.
        </p>
      )}
      {isMenu && onRefresh && (
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={loading}
          className={builderPanelUi.btnGhost}
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          Refresh
        </button>
      )}
      {loading && items.length === 0 && (
        <p className={cn(builderPanelUi.hint, 'flex items-center gap-1.5')}>
          <Loader2 className="w-3 h-3 animate-spin" /> Loading deleted pages…
        </p>
      )}
      {!loading && items.length === 0 && (
        <p className={builderPanelUi.hint}>
          {isMenu
            ? 'No deleted pages right now. Use Move to trash on a page to remove it — it will appear here.'
            : <>No deleted pages right now. Use <strong className="font-semibold text-foreground">Move to trash</strong> above to remove a page — it will appear here.</>}
        </p>
      )}
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map(item => (
            <li key={item.id} className={builderPanelUi.trashListItem}>
              <div className="min-w-0 flex-1">
                <div className={builderPanelUi.trashItemTitle} title={item.title}>{item.title}</div>
                <div className={builderPanelUi.trashItemMeta}>
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
  '[data-overlay-root],[data-overlay-toolbar],[data-builder-section-image],[data-builder-section-toolbar],[data-builder-floating-ui],[data-block-design-bar],[data-block-design-bar-dropdown],[data-kiterp-modal]'

/** Fixed width — layout never reflows when link state or labels change. */
const OVERLAY_TOOLBAR_WIDTH_PX = 336

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
  compact = false,
}: {
  label: string
  children: React.ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn('flex min-w-0 flex-col', compact ? 'gap-0.5' : 'gap-1', className)}>
      <span className={cn(
        'truncate font-semibold uppercase tracking-wider leading-none',
        compact ? 'text-[9px]' : 'text-[10px]',
        overlayToolbarUi.fieldLabel,
      )}>
        {label}
      </span>
      <div className={cn('flex min-w-0 items-center', compact ? 'min-h-7' : 'min-h-8')}>{children}</div>
    </div>
  )
}

function OverlayToolbarSection({
  title,
  children,
  compact = false,
}: {
  title: string
  children: React.ReactNode
  compact?: boolean
}) {
  return (
    <div className={cn('rounded-lg border', compact ? 'px-1.5 py-1' : 'px-2 py-2', overlayToolbarUi.section)}>
      <p className={cn(
        'font-semibold uppercase tracking-wider',
        compact ? 'mb-1 text-[9px]' : 'mb-2 text-[10px]',
        overlayToolbarUi.sectionTitle,
      )}>
        {title}
      </p>
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
  step = 1,
  onCommit,
  onStopBubble,
}: {
  label: string
  value: number
  min: number
  max: number
  fallback: number
  step?: number
  onCommit: (n: number) => void
  onStopBubble: (e: React.SyntheticEvent) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const stepperCell =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'

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

  const bump = (delta: number) => {
    const base = Number(draft)
    const current = Number.isFinite(base) ? base : value
    const clamped = Math.min(max, Math.max(min, Math.round(current + delta)))
    setDraft(String(clamped))
    onCommit(clamped)
  }

  return (
    <OverlayToolbarField label={label}>
      <div className="flex w-full min-w-0 items-center gap-0.5">
        <button
          type="button"
          className={stepperCell}
          onMouseDown={onStopBubble}
          onClick={() => bump(-step)}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-3 w-3" />
        </button>
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
            'h-7 min-w-0 flex-1 rounded-md border text-center text-[11px] font-semibold tabular-nums focus:outline-none focus:ring-2',
            overlayToolbarUi.input,
          )}
          title={`${label} — use −/+ or type a value`}
        />
        <button
          type="button"
          className={stepperCell}
          onMouseDown={onStopBubble}
          onClick={() => bump(step)}
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
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
  onDismiss,
  containerRef,
  siblings,
  onShowGuides,
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
  onDismiss?: () => void
  containerRef?: React.RefObject<HTMLDivElement>
  siblings?: BlockOverlayItem[]
  onShowGuides?: (guides: OverlayGuideLine[]) => void
}) {
  const hasTextControls = item.type === 'text' || item.type === 'button' || item.type === 'badge'
  const isImage = item.type === 'image'
  const isVideo = item.type === 'video'
  const isIcon = item.type === 'icon'
  const hasLink = item.type === 'button' || item.type === 'badge' || item.type === 'text' || isImage || isIcon
  const isLinked = !!(item.linkType && item.linkType !== 'none')
  const showCanvasToolbar = true

  // Floating, free-moving panel: it is rendered to <body> via a portal and
  // positioned with its own viewport coordinates so it is NOT tied to the
  // inserted element. The user can drag it anywhere by its header handle.
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null)
  const [containerSize, setContainerSize] = useState({ w: 800, h: 400 })

  useLayoutEffect(() => {
    const el = containerRef?.current
    if (!el) return
    const update = () => setContainerSize({ w: el.clientWidth || 800, h: el.clientHeight || 400 })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, item.id])

  const siblingBoxes = useMemo(
    () => (siblings ?? []).map(o => ({ x: o.x, y: o.y, w: o.w, h: o.h })),
    [siblings],
  )

  // Seed the initial position next to the selected element (once per selection).
  useEffect(() => {
    const width = OVERLAY_TOOLBAR_WIDTH_PX
    const margin = 12
    const host = document.querySelector(`[data-overlay-id="${CSS.escape(item.id)}"]`)
    const rect = host?.getBoundingClientRect()
    let left: number
    let top: number
    if (rect) {
      if (rect.right + margin + width <= window.innerWidth) {
        left = rect.right + margin
        top = rect.top
      } else if (rect.left - margin - width >= 0) {
        left = rect.left - margin - width
        top = rect.top
      } else {
        left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left))
        top = rect.bottom + margin
      }
    } else {
      left = window.innerWidth - width - 24
      top = 96
    }
    left = Math.max(8, Math.min(window.innerWidth - width - 8, left))
    top = Math.max(8, Math.min(window.innerHeight - 80, top))
    setPanelPos({ top, left })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  const textPromptAnchor = useCallback((): { x: number; y: number } => {
    const panel = panelRef.current
    if (panel) {
      const rect = panel.getBoundingClientRect()
      return { x: Math.max(12, rect.left - OVERLAY_TOOLBAR_WIDTH_PX - 24), y: rect.top }
    }
    return { x: window.innerWidth / 2 - 190, y: window.innerHeight / 3 }
  }, [])

  const startPanelDrag = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const panel = panelRef.current
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    const onMove = (mv: MouseEvent) => {
      const w = panel.offsetWidth
      const left = Math.max(8, Math.min(window.innerWidth - w - 8, mv.clientX - offsetX))
      const top = Math.max(8, Math.min(window.innerHeight - 40, mv.clientY - offsetY))
      setPanelPos({ top, left })
    }
    const onUp = () => {
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

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
    onRequestText({
      title: `Edit ${item.type} text`,
      placeholder: item.type === 'button' ? 'e.g. Book Now' : 'e.g. NEW',
      initialValue: item.text || '',
      anchor: textPromptAnchor(),
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
    onRequestText({
      title: 'Button description',
      subtitle: 'Shown as tooltip on hover and used for screen-reader labels.',
      placeholder: 'Book a table for 4 guests',
      initialValue: item.description || '',
      multiline: true,
      maxLength: 160,
      anchor: textPromptAnchor(),
      onSave: v => onUpdate({ description: v }),
    })
  }

  const toolbarBtn =
    'flex h-7 w-full min-w-0 items-center justify-center rounded-lg transition-colors'

  if (!showCanvasToolbar || !panelPos) return null

  return createPortal(
    <div
      ref={panelRef}
      data-overlay-toolbar
      data-builder-floating-ui
      role="toolbar"
      aria-label="Overlay element options"
      className={cn(
        'fixed z-[100010] box-border flex flex-col overflow-visible rounded-xl border backdrop-blur-sm',
        overlayToolbarUi.panel,
      )}
      style={{
        top: panelPos.top,
        left: panelPos.left,
        width: OVERLAY_TOOLBAR_WIDTH_PX,
      }}
      onMouseDown={stopToolbarEvent}
      onPointerDown={stopToolbarEvent}
      onClick={stopToolbarEvent}
      onDoubleClick={stopToolbarEvent}
    >
      {/* Draggable header ? lets the user move this panel anywhere on screen,
          independent of the element it edits. */}
      <div
        data-overlay-toolbar-handle
        onMouseDown={startPanelDrag}
        className={cn(
          'flex cursor-move select-none items-center gap-1.5 border-b px-2 py-1',
          overlayToolbarUi.footer,
        )}
        title="Drag to move this panel"
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-70" />
        <span className="text-[11px] font-semibold capitalize">{item.type} settings</span>
        <div className="ml-auto flex items-center gap-1">
          <Move className="h-3.5 w-3.5 shrink-0 opacity-50" />
          {onDismiss ? (
            <button
              type="button"
              aria-label="Close settings"
              title="Close"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation()
                onDismiss()
              }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200/80 hover:text-gray-800 dark:hover:bg-gray-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="space-y-1 p-2">
        {/* Position, size & align are owned by the docked Visual tab. This floating
            panel keeps only the advanced fine-tuning controls (precise numeric
            inputs, link/description) so nothing is duplicated. */}

        {/* Typography */}
        {hasTextControls && (
          <OverlayToolbarSection title="Text" compact>
            <OverlayTypographyToolbar
              item={{ align: 'left', ...item }}
              blockBackgroundColor={blockBackgroundColor}
              onUpdate={onUpdate}
              onStopBubble={stopToolbarEvent}
            />
          </OverlayToolbarSection>
        )}

        {isIcon && (
          <OverlayToolbarSection title="Icon" compact>
            <OverlayTypographyToolbar
              item={{ align: 'left', ...item }}
              blockBackgroundColor={blockBackgroundColor}
              onUpdate={onUpdate}
              onStopBubble={stopToolbarEvent}
              showAlign={false}
            />
            <div className="mt-1" onMouseDown={stopToolbarEvent} onClick={stopToolbarEvent}>
              <OverlayIconPicker
                value={item.iconName}
                onChange={iconName => onUpdate({ iconName })}
              />
            </div>
          </OverlayToolbarSection>
        )}

        {isImage && (
          <OverlayToolbarSection title="Image" compact>
            <div className={cn('grid gap-1', hasLink && onEditLink ? 'grid-cols-3' : 'grid-cols-2')}>
              {onPickLocalImage ? (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onPickLocalImage() }}
                  className={cn(toolbarBtn, 'gap-1 bg-sky-600 text-white hover:bg-sky-500 text-[9px] font-semibold')}
                  title="Upload image"
                >
                  <Upload className="h-3 w-3 shrink-0" />
                  Upload
                </button>
              ) : null}
              {onOpenMediaForImage ? (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onOpenMediaForImage() }}
                  className={cn(toolbarBtn, 'gap-1 bg-emerald-600 text-white hover:bg-emerald-500 text-[9px] font-semibold')}
                  title="Media library"
                >
                  <ImageIcon className="h-3 w-3 shrink-0" />
                  Library
                </button>
              ) : null}
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
                      ? `Linked: ${item.linkType} — ${item.linkLabel || item.linkTarget}`
                      : 'Add link'
                  }
                >
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                </button>
              ) : null}
            </div>
            <div className="mt-1 grid grid-cols-4 gap-1">
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
              <OverlayToolbarField label="Shadow" compact>
                <button
                  type="button"
                  onClick={() => onUpdate({ shadow: !item.shadow })}
                  className={cn(
                    toolbarBtn,
                    'text-[9px] font-semibold',
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

        {isVideo && (
          <OverlayToolbarSection title="Video" compact>
            <div className={cn('grid gap-1', onPickLocalImage && onOpenMediaForImage ? 'grid-cols-2' : 'grid-cols-1')}>
              {onPickLocalImage ? (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onPickLocalImage() }}
                  className={cn(toolbarBtn, 'gap-1 bg-sky-600 text-white hover:bg-sky-500 text-[9px] font-semibold')}
                  title="Upload video"
                >
                  <Upload className="h-3 w-3 shrink-0" />
                  Upload
                </button>
              ) : null}
              {onOpenMediaForImage ? (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onOpenMediaForImage() }}
                  className={cn(toolbarBtn, 'gap-1 bg-emerald-600 text-white hover:bg-emerald-500 text-[9px] font-semibold')}
                  title="Media library"
                >
                  <Video className="h-3 w-3 shrink-0" />
                  Library
                </button>
              ) : null}
            </div>
            {onRequestText ? (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  onRequestText({
                    title: 'Set video URL',
                    subtitle: 'Paste a direct link to an MP4, WebM, or other video file.',
                    placeholder: 'https://…/video.mp4',
                    initialValue: item.src || '',
                    anchor: textPromptAnchor(),
                    onSave: v => { if (v) onUpdate({ src: v }) },
                  })
                }}
                className={cn(toolbarBtn, 'mt-1 gap-1 bg-primary text-primary-foreground hover:bg-primary/90 text-[9px] font-semibold')}
                title="Set video from URL"
              >
                <Link2 className="h-3 w-3 shrink-0" />
                URL
              </button>
            ) : null}
            <div className="mt-1 grid grid-cols-3 gap-1">
              <OverlayToolbarNumberInput
                label="Radius"
                value={item.borderRadius ?? 0}
                min={0}
                max={999}
                fallback={0}
                onCommit={n => onUpdate({ borderRadius: n })}
                onStopBubble={stopToolbarEvent}
              />
              <OverlayToolbarField label="Shadow" compact>
                <button
                  type="button"
                  onClick={() => onUpdate({ shadow: !item.shadow })}
                  className={cn(
                    toolbarBtn,
                    'text-[9px] font-semibold',
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

      {(hasTextControls || isIcon || ((item.type === 'button' || item.type === 'badge') && onRequestText) || (hasLink && onEditLink && !isImage && !isVideo)) && (
        <div className="grid grid-cols-3 gap-1">
          {hasTextControls ? (
            <button
              type="button"
              onClick={openTextEditor}
              className={cn(toolbarBtn, 'bg-primary text-primary-foreground hover:bg-primary/90')}
              title={item.type === 'text' ? 'Edit text (double-click)' : 'Edit label'}
            >
              <Type className="h-4 w-4 shrink-0" />
            </button>
          ) : <div className="h-7" aria-hidden />}
          {hasLink && onEditLink && !isImage && !isVideo ? (
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
          ) : (isImage || isVideo ? null : <div className="h-7" aria-hidden />)}
          {(item.type === 'button' || item.type === 'badge') && onRequestText ? (
            <button
              type="button"
              onClick={openDescription}
              className={cn(toolbarBtn, 'bg-sky-600 text-white hover:bg-sky-500')}
              title="Description / tooltip"
            >
              <Info className="h-4 w-4 shrink-0" />
            </button>
          ) : <div className="h-7" aria-hidden />}
        </div>
      )}
      </div>
    </div>,
    document.body,
  )
}

function OverlayElement({
  item, isSelected, settingsPanelOpen = false, onCloseSettingsPanel,
  containerRef, blockBackgroundColor, siblings, onDragGuides, onSelect, onUpdate, onDelete,
  onOpenAiForImage, onOpenMediaForImage, onPickLocalImage, onImageFileDrop,
  onEditLink, onContextMenu, onRequestText, onBringToFront, onSendToBack, onDismiss,
  mobilePreview = false,
  imageBounds = null,
  stackIndex,
  stackCount,
}: {
  item: BlockOverlayItem
  isSelected: boolean
  settingsPanelOpen?: boolean
  onCloseSettingsPanel?: () => void
  containerRef: React.RefObject<HTMLDivElement>
  blockBackgroundColor?: string
  /** Other overlays on the same canvas — used as alignment snap targets. */
  siblings?: BlockOverlayItem[]
  /** Publish live alignment guide lines while dragging/resizing ([] to clear). */
  onDragGuides?: (guides: OverlayGuideLine[], unit?: 'percent' | 'px') => void
  onSelect: () => void
  onUpdate: (u: Partial<BlockOverlayItem>) => void
  onDelete: () => void
  onOpenAiForImage?: () => void
  onOpenMediaForImage?: () => void
  onPickLocalImage?: () => void
  onImageFileDrop?: (file: File, overlayTarget?: { blockId: string; overlayId: string }) => void
  onEditLink?: (anchor: { x: number; y: number }) => void
  onContextMenu?: (e: React.MouseEvent) => void
  onBringToFront?: () => void
  onSendToBack?: () => void
  onDismiss?: () => void
  /**
   * When true (mobile device preview), below-product overlays pin onto the
   * image. Drag/resize of desktop coords is locked while pinned.
   */
  mobilePreview?: boolean
  imageBounds?: OverlayImageBoundsPct | null
  stackIndex?: number
  stackCount?: number
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
    const container = containerRef.current
    const cw = container?.clientWidth || 800
    const ch = container?.clientHeight || 400
    let live = item
    if (!overlayUsesPercent(item) && container) {
      const migrated = {
        ...pxToOverlayPercent(item, cw, ch),
        coordUnit: 'percent' as const,
      }
      onUpdate(migrated)
      live = { ...item, ...migrated }
    }
    const usePercent = overlayUsesPercent(live)
    const startPointer = usePercent
      ? pointerToOverlayPercent(e.clientX, e.clientY, container)
      : pointerToOverlayLocal(e.clientX, e.clientY, container)
    const grabOffsetX = startPointer.x - live.x
    const grabOffsetY = startPointer.y - live.y
    const originX = e.clientX
    const originY = e.clientY
    document.body.style.cursor = 'move'
    const snapW = usePercent ? OVERLAY_AXIS_MAX : cw
    const snapH = usePercent ? OVERLAY_AXIS_MAX : ch
    const onMove = (mv: MouseEvent) => {
      if (Math.abs(mv.clientX - originX) > 3 || Math.abs(mv.clientY - originY) > 3) {
        dragMovedRef.current = true
      }
      const pointer = usePercent
        ? pointerToOverlayPercent(mv.clientX, mv.clientY, container)
        : pointerToOverlayLocal(mv.clientX, mv.clientY, container)
      const maxX = usePercent ? OVERLAY_AXIS_MAX - live.w : cw - live.w
      const maxY = usePercent ? OVERLAY_AXIS_MAX - OVERLAY_MIN_H_PERCENT : ch - 20
      const rawX = Math.max(0, Math.min(maxX, pointer.x - grabOffsetX))
      const rawY = Math.max(0, Math.min(maxY, pointer.y - grabOffsetY))
      const normalizedSiblings = (siblings ?? []).map(s =>
        normalizeOverlayBox(s, cw, ch),
      )
      const targets = collectOverlayTargets(normalizedSiblings, snapW, snapH)
      const snapped = snapOverlayDrag({ x: rawX, y: rawY, w: live.w, h: live.h }, targets)
      onDragGuides?.(snapped.guides, usePercent ? 'percent' : 'px')
      onUpdate({
        x: Math.max(0, Math.min(maxX, snapped.x)),
        y: Math.max(0, Math.min(maxY, snapped.y)),
        ...(usePercent ? { coordUnit: 'percent' as const } : {}),
      })
    }
    const onUp = () => {
      document.body.style.cursor = ''
      onDragGuides?.([])
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [textEditing, item, containerRef, onUpdate, siblings, onDragGuides])

  const startResize = useCallback((e: React.MouseEvent, handle: string) => {
    e.stopPropagation(); e.preventDefault()
    const sx = e.clientX, sy = e.clientY
    const container = containerRef.current
    const cw = container?.clientWidth || 800
    const ch = container?.clientHeight || 400
    let live = item
    if (!overlayUsesPercent(item) && container) {
      const migrated = {
        ...pxToOverlayPercent(item, cw, ch),
        coordUnit: 'percent' as const,
      }
      onUpdate(migrated)
      live = { ...item, ...migrated }
    }
    const usePercent = overlayUsesPercent(live)
    const ox = live.x, oy = live.y, ow = live.w, oh = live.h
    const { scaleX, scaleY } = container ? overlayContainerScale(container) : { scaleX: 1, scaleY: 1 }
    const minW = usePercent ? OVERLAY_MIN_W_PERCENT : 40
    const minH = usePercent ? OVERLAY_MIN_H_PERCENT : 20
    const snapW = usePercent ? OVERLAY_AXIS_MAX : cw
    const snapH = usePercent ? OVERLAY_AXIS_MAX : ch
    document.body.style.cursor = OVERLAY_RESIZE_CURSORS[handle]
    const onMove = (mv: MouseEvent) => {
      const dx = usePercent
        ? ((mv.clientX - sx) / scaleX / cw) * 100
        : (mv.clientX - sx) / scaleX
      const dy = usePercent
        ? ((mv.clientY - sy) / scaleY / ch) * 100
        : (mv.clientY - sy) / scaleY
      let nx = ox, ny = oy, nw = ow, nh = oh
      if (handle.includes('e')) nw = Math.max(minW, ow + dx)
      if (handle.includes('w')) { nx = ox + dx; nw = Math.max(minW, ow - dx) }
      if (handle.includes('s')) nh = Math.max(minH, oh + dy)
      if (handle.includes('n')) { ny = oy + dy; nh = Math.max(minH, oh - dy) }
      const normalizedSiblings = (siblings ?? []).map(s =>
        normalizeOverlayBox(s, cw, ch),
      )
      const targets = collectOverlayTargets(normalizedSiblings, snapW, snapH)
      const snapped = snapOverlayResize({ x: nx, y: ny, w: nw, h: nh }, targets, handle, minW, minH)
      onDragGuides?.(snapped.guides, usePercent ? 'percent' : 'px')
      onUpdate({
        x: snapped.x,
        y: snapped.y,
        w: snapped.w,
        h: snapped.h,
        ...(usePercent ? { coordUnit: 'percent' as const } : {}),
      })
    }
    const onUp = () => { document.body.style.cursor = ''; onDragGuides?.([]); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [item, containerRef, onUpdate, siblings, onDragGuides])

  const renderContent = () => {
    const fillFallback = defaultOverlayFillColor(item.type)
    const isTextLike = item.type === 'text' || item.type === 'badge' || item.type === 'button'
    // Square corners on text chips — high borderRadius becomes a clipped circle on mobile.
    const cornerRadius = isTextLike ? 0 : (item.borderRadius || 0)
    const commonStyle: React.CSSProperties = {
      width: '100%', height: '100%',
      backgroundColor: resolveOverlayBackground(item, item.type === 'text' ? 'transparent' : fillFallback),
      borderRadius: cornerRadius,
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
            data-overlay-text-chip
            contentEditable={textEditing}
            suppressContentEditableWarning
            onDoubleClick={e => { e.stopPropagation(); setTextEditing(true) }}
            onBlur={e => { setTextEditing(false); onUpdate({ text: e.currentTarget.innerText }) }}
            style={{ ...commonStyle,
              fontSize: item.fontSize || 16, fontWeight: item.fontWeight || 'normal',
              fontStyle: item.italic ? 'italic' : undefined,
              color: item.color || '#111827', textAlign: item.align || 'center',
              padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              whiteSpace: mobilePreview ? 'nowrap' : 'normal',
              overflowWrap: 'normal', wordBreak: 'normal', lineHeight: 1.25,
              outline: textEditing ? '2px solid #64C3A0' : 'none', cursor: textEditing ? 'text' : 'move',
              ...overlayTextFontStyle(item),
            }}
          />
        )
      case 'image':
        return item.src ? (
          <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: item.borderRadius || 0 }}>
            <img src={mediaUrl(item.src)} style={overlayImageImgStyle(item) as unknown as React.CSSProperties} alt="" draggable={false} />
          </div>
        ) : (
          <div
            style={{ ...commonStyle, backgroundColor: resolveOverlayBackground(item, '#f3f4f6'), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: isSelected ? 'pointer' : 'move' }}
            onDragOver={onImageFileDrop ? e => { e.preventDefault(); e.stopPropagation() } : undefined}
            onDrop={onImageFileDrop ? e => {
              e.preventDefault(); e.stopPropagation()
              const f = e.dataTransfer.files?.[0]
              if (f) onImageFileDrop(f)
            } : undefined}
          >
            <svg viewBox="0 0 24 24" style={{ width: 28, height: 28, fill: '#9ca3af' }}><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zm-8.5-5.5l2.5 3.01L18 12l4 5H6l3.5-4.5z"/></svg>
            <span style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '0 8px', lineHeight: 1.35 }}>
              Click to upload · drop image · or right-click for options
            </span>
          </div>
        )
      case 'button': {
        const hasLink = item.linkType && item.linkType !== 'none' && (item.linkTarget || item.href)
        return (
          <div
            data-overlay-content
            style={{ ...commonStyle, backgroundColor: resolveOverlayBackground(item, '#64C3A0'), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
            title={item.description || (hasLink ? `Link — ${item.linkLabel || item.linkTarget}` : 'Double-click to connect link')}
          >
            <span style={{ fontSize: item.fontSize || 14, fontWeight: item.fontWeight || 'bold', fontStyle: item.italic ? 'italic' : undefined, color: item.color || '#ffffff', ...overlayTextFontStyle(item) }}>
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
            <span style={{ fontSize: item.fontSize || 12, fontWeight: item.fontWeight || 'bold', fontStyle: item.italic ? 'italic' : undefined, color: item.color || '#ffffff', whiteSpace: 'nowrap', ...overlayTextFontStyle(item) }}>
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
          <div
            style={{ ...commonStyle, backgroundColor: item.bgColor || '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onDragOver={onImageFileDrop ? e => { e.preventDefault(); e.stopPropagation() } : undefined}
            onDrop={onImageFileDrop ? e => {
              e.preventDefault(); e.stopPropagation()
              const f = e.dataTransfer.files?.[0]
              if (f) onImageFileDrop(f)
            } : undefined}
          >
            {item.src ? (
              <video src={mediaUrl(item.src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls={false} />
            ) : (
              <>
                <svg viewBox="0 0 24 24" style={{ width: 36, height: 36, fill: 'rgba(255,255,255,0.7)' }}><path d="M8 5v14l11-7z"/></svg>
                {isSelected ? (
                  <span style={{ position: 'absolute', fontSize: 11, color: 'rgba(255,255,255,0.75)', textAlign: 'center', padding: '0 8px', lineHeight: 1.35 }}>
                    Click to upload · drop video · or use settings
                  </span>
                ) : null}
              </>
            )}
          </div>
        )
      default: return null
    }
  }

  const containerEl = containerRef.current
  const pinToImage = Boolean(mobilePreview && stackCount != null && stackCount > 0)
  const isTextLikeOverlay = item.type === 'text' || item.type === 'badge' || item.type === 'button'
  const positionStyle = overlayPositionStyleForViewport(item, {
    mobile: pinToImage,
    containerWidthPx: containerEl?.clientWidth,
    containerHeightPx: containerEl?.clientHeight,
    imageBounds,
    stackIndex,
    stackCount,
  })
  // Mobile preview uses a display-only pin layout — don't drag/resize desktop coords while pinned.
  const lockDesktopCoords = pinToImage
  const mobileTextChipStyle: React.CSSProperties = mobilePreview && isTextLikeOverlay
    ? {
        width: 'max-content',
        maxWidth: 'min(92vw, 20rem)',
        height: 'auto',
        minHeight: 0,
      }
    : {}

  return (
    <div
      data-overlay-root
      data-overlay-id={item.id}
      data-overlay-text-chip={isTextLikeOverlay ? 'true' : undefined}
      data-overlay-mobile-on-image={pinToImage ? 'true' : undefined}
      style={{
        ...positionStyle,
        ...mobileTextChipStyle,
        zIndex: item.zIndex || 10,
        cursor: textEditing ? 'text' : lockDesktopCoords ? 'default' : 'move',
        userSelect: 'none',
      }}
      onClick={e => {
        e.stopPropagation()
        if (dragMovedRef.current) return
        if (!isSelected) {
          onSelect()
          return
        }
        if (item.type === 'image' && !item.src && onPickLocalImage) {
          onPickLocalImage()
        }
        if (item.type === 'video' && !item.src && onPickLocalImage) {
          onPickLocalImage()
        }
      }}
      onMouseDown={e => {
        const t = e.target as HTMLElement
        if (t.closest('[data-overlay-toolbar],[data-overlay-delete],[data-overlay-resize-handle]')) return
        if (t.closest('input,textarea,select')) return
        if (!isSelected) onSelect()
        if (lockDesktopCoords) return
        // Empty image/video layers use click/drop to upload — skip drag so the click isn't eaten.
        if (!textEditing && !((item.type === 'image' || item.type === 'video') && !item.src)) startDrag(e)
      }}
      onContextMenu={e => { if (onContextMenu) { e.preventDefault(); e.stopPropagation(); onSelect(); onContextMenu(e) } }}
      onDoubleClick={e => {
        if ((e.target as HTMLElement).closest('[data-overlay-toolbar],[data-overlay-delete]')) return
        if (item.type === 'text') { e.stopPropagation(); setTextEditing(true) }
        if (item.type === 'image') {
          e.stopPropagation()
          onPickLocalImage?.()
        }
        if (item.type === 'video') {
          e.stopPropagation()
          onPickLocalImage?.()
        }
        if ((item.type === 'button' || item.type === 'badge') && onEditLink) {
          e.stopPropagation()
          onEditLink({ x: e.clientX, y: e.clientY })
        }
      }}
    >
      {renderContent()}
      {isSelected && settingsPanelOpen && !textEditing ? (
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
          onDismiss={onCloseSettingsPanel ?? onDismiss}
          containerRef={containerRef}
          siblings={siblings}
          onShowGuides={onDragGuides}
        />
      ) : null}
      {isSelected && !textEditing ? (
        <>
          {/* Selection ring */}
          <div style={{ position: 'absolute', inset: -2, border: '2px solid #64C3A0', borderRadius: 3, pointerEvents: 'none', zIndex: 1 }} />
          {/* Resize handles — hidden in mobile pin preview (coords are desktop-only). */}
          {!lockDesktopCoords && Object.keys(OVERLAY_HANDLE_POS).map(h => (
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
          {/* Delete — above the top-right corner so it does not cover layer content */}
          <button
            type="button"
            data-overlay-delete
            onMouseDown={e => { e.stopPropagation(); onDelete() }}
            className="absolute right-0 bottom-full z-[26] mb-1 flex h-7 w-7 items-center justify-center rounded-md bg-red-500 text-sm font-bold leading-none text-white shadow-md hover:bg-red-600"
            title="Delete element (Del)"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : null}
    </div>
  )
}

function BlockOverlayCanvas({
  blockId,
  overlays, isEditing, blockBackgroundColor, onUpdate, onOverlaySelectionChange, selectedOverlayId: controlledSelectedId,
  settingsPanelOverlayId,
  onCloseSettingsPanel,
  onOpenAiImageTools, onOpenMediaLibrary,
  onPickLocalImage, onImageFileDrop, onEditLinkForOverlay, onOverlayContextMenu, onRequestText,
  mobilePreview = false,
}: {
  blockId?: string
  overlays: BlockOverlayItem[]
  isEditing: boolean
  blockBackgroundColor?: string
  onUpdate?: (overlays: BlockOverlayItem[]) => void
  onOverlaySelectionChange?: (selectedId: string | null, blockId?: string | null) => void
  /** When set, canvas selection follows parent state (ribbon / context menu). */
  selectedOverlayId?: string | null
  /** Overlay id whose floating settings panel is open (context menu only). */
  settingsPanelOverlayId?: string | null
  onCloseSettingsPanel?: () => void
  onOpenAiImageTools?: () => void
  onOpenMediaLibrary?: () => void
  onPickLocalImage?: (overlayTarget?: { blockId: string; overlayId: string }) => void
  onImageFileDrop?: (file: File, overlayTarget?: { blockId: string; overlayId: string }) => void
  onEditLinkForOverlay?: (item: BlockOverlayItem, anchor: { x: number; y: number }) => void
  onOverlayContextMenu?: (item: BlockOverlayItem, e: React.MouseEvent) => void
  /** Mobile device preview — pin below-product overlays onto the image. */
  mobilePreview?: boolean
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
  const [dragGuides, setDragGuides] = useState<OverlayGuideLine[]>([])
  const [dragGuideUnit, setDragGuideUnit] = useState<'percent' | 'px'>('percent')
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

  const [imageBounds, setImageBounds] = useState<OverlayImageBoundsPct | null>(null)

  useEffect(() => {
    if (!mobilePreview) {
      setImageBounds(null)
      return
    }
    const canvas = containerRef.current
    if (!canvas) return

    const measure = () => {
      const block = (canvas.closest('[data-block-id], [data-bid], [data-sf-bid]') as HTMLElement | null)
        ?? canvas.parentElement
      if (!block) return
      const candidates = Array.from(
        block.querySelectorAll<HTMLElement>(
          '[data-builder-section-image], .about-split-image-frame, img',
        ),
      ).filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width >= 48 && r.height >= 48
      })
      if (!candidates.length) {
        setImageBounds(null)
        return
      }
      const img = candidates.reduce((best, el) => {
        const a = el.getBoundingClientRect()
        const b = best.getBoundingClientRect()
        return a.width * a.height > b.width * b.height ? el : best
      })
      const canvasRect = canvas.getBoundingClientRect()
      const imgRect = img.getBoundingClientRect()
      if (canvasRect.width <= 0 || canvasRect.height <= 0) return
      setImageBounds({
        left: ((imgRect.left - canvasRect.left) / canvasRect.width) * 100,
        top: ((imgRect.top - canvasRect.top) / canvasRect.height) * 100,
        width: (imgRect.width / canvasRect.width) * 100,
        height: (imgRect.height / canvasRect.height) * 100,
      })
    }

    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(canvas)
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [mobilePreview, overlays.length])

  const belowBandStack = useMemo(() => {
    if (!mobilePreview || !overlays.length) return new Map<string, { index: number; count: number }>()
    const ch = containerRef.current?.clientHeight || 0
    const band = overlays
      .filter((o) => overlayIsBelowProductBand(o, ch || undefined))
      .slice()
      .sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0))
    const map = new Map<string, { index: number; count: number }>()
    band.forEach((item, index) => {
      map.set(item.id, { index, count: band.length })
    })
    return map
  }, [mobilePreview, overlays])

  if (!isEditing) return null

  const minH = overlays.some(o => !overlayUsesPercent(o))
    ? Math.max(...overlays.filter(o => !overlayUsesPercent(o)).map(o => o.y + o.h + 240))
    : 0

  return (
    <div
      ref={containerRef}
      data-overlay-canvas
      data-overlay-mobile={mobilePreview ? 'true' : undefined}
      style={{
        position: 'absolute', inset: 0, zIndex: 78,
        // Container itself never blocks clicks ? lets them pass through to the
        // underlying inline-editable text. Each overlay item re-enables pointer
        // events on itself so it's still interactive.
        pointerEvents: 'none',
        minHeight: isEditing && minH > 0 && !mobilePreview ? minH : undefined,
        overflow: mobilePreview ? 'hidden' : undefined,
      }}
      onClick={e => { if (e.target === containerRef.current) setSelected(null) }}
    >
      {overlays.map(item => {
        const stack = belowBandStack.get(item.id)
        return (
        <div key={item.id} className={isEditing ? 'pointer-events-auto' : 'pointer-events-none'}>
          <OverlayElement
            item={item}
            isSelected={isEditing && selectedId === item.id}
            settingsPanelOpen={settingsPanelOverlayId === item.id}
            onCloseSettingsPanel={onCloseSettingsPanel}
            containerRef={containerRef as React.RefObject<HTMLDivElement>}
            blockBackgroundColor={blockBackgroundColor}
            siblings={overlays.filter(o => o.id !== item.id)}
            mobilePreview={mobilePreview}
            imageBounds={imageBounds}
            stackIndex={stack?.index}
            stackCount={stack?.count}
            onDragGuides={(guides, unit) => {
              setDragGuides(guides)
              if (unit) setDragGuideUnit(unit)
            }}
            onSelect={() => setSelected(item.id)}
            onUpdate={updates => updateItem(item.id, updates)}
            onDelete={() => deleteItem(item.id)}
            onOpenAiForImage={item.type === 'image' ? onOpenAiImageTools : undefined}
            onOpenMediaForImage={(item.type === 'image' || item.type === 'video') && onOpenMediaLibrary
              ? () => { onOverlaySelectionChange?.(item.id); onOpenMediaLibrary() }
              : undefined}
            onPickLocalImage={(item.type === 'image' || item.type === 'video') && onPickLocalImage && blockId
              ? () => {
                  onOverlaySelectionChange?.(item.id, blockId)
                  onPickLocalImage({ blockId, overlayId: item.id })
                }
              : undefined}
            onImageFileDrop={(item.type === 'image' || item.type === 'video') && onImageFileDrop && blockId
              ? (file) => {
                  onOverlaySelectionChange?.(item.id, blockId)
                  onImageFileDrop(file, { blockId, overlayId: item.id })
                }
              : undefined}
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
            onDismiss={onCloseSettingsPanel}
          />
        </div>
        )
      })}
      {/* Figma-style alignment guides shown live while dragging / resizing. */}
      {isEditing && dragGuides.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-[90] overflow-visible" aria-hidden>
          {dragGuides.map((guide, index) =>
            guide.axis === 'x' ? (
              <div
                key={`x-${index}-${guide.value}`}
                className="absolute w-px bg-fuchsia-500 shadow-[0_0_0_1px_rgba(255,255,255,0.85)]"
                style={{
                  left: dragGuideUnit === 'percent' ? `${guide.value}%` : guide.value,
                  top: dragGuideUnit === 'percent' ? `${guide.start}%` : guide.start,
                  height: dragGuideUnit === 'percent'
                    ? `${Math.max(0.5, guide.end - guide.start)}%`
                    : Math.max(1, guide.end - guide.start),
                  zIndex: 95,
                }}
              />
            ) : (
              <div
                key={`y-${index}-${guide.value}`}
                className="absolute h-px bg-fuchsia-500 shadow-[0_0_0_1px_rgba(255,255,255,0.85)]"
                style={{
                  top: dragGuideUnit === 'percent' ? `${guide.value}%` : guide.value,
                  left: dragGuideUnit === 'percent' ? `${guide.start}%` : guide.start,
                  width: dragGuideUnit === 'percent'
                    ? `${Math.max(0.5, guide.end - guide.start)}%`
                    : Math.max(1, guide.end - guide.start),
                  zIndex: 95,
                }}
              />
            ),
          )}
        </div>
      ) : null}
    </div>
  )
}

function blockHasConfiguredLinks(block: WebsiteBlock): boolean {
  const p = (block.props || {}) as Record<string, unknown>
  if (blockTypeSupportsBlockLink(block.block_type) && String(p.block_link_url || '').trim()) return true
  for (const key of ['cta_url', 'cta_primary_url', 'cta_secondary_url']) {
    if (String(p[key] || '').trim()) return true
  }
  const social = p.social_links
  if (social && typeof social === 'object') {
    if (Object.values(social as Record<string, unknown>).some(v => String(v ?? '').trim())) return true
  }
  if (discoverSectionLinkTargets(block.block_type, p).some(t => Boolean(t.url))) return true
  if (countConfiguredSocialLinks(block.block_type, p) > 0) return true
  const overlays = Array.isArray(p.overlays) ? (p.overlays as BlockOverlayItem[]) : []
  return overlays.some(o => !!(o.linkType && o.linkType !== 'none'))
}

/** Floating section chrome (reorder, duplicate, delete) — can minimize to a hover ball. */
function BuilderSectionChromeToolbar({
  block,
  blockIdx,
  selected,
  minimized,
  pinned,
  visible,
  containerRef,
  scrollRootRef,
  canvasRevision,
  onMinimize,
  onTogglePin,
  onOpenLinksPanel,
  onMoveBlock,
  onDuplicate,
  onDelete,
  onOpenLayoutPicker,
  onCycleLayout,
}: {
  block: WebsiteBlock
  blockIdx: number
  selected: boolean
  minimized: boolean
  pinned: boolean
  visible: boolean
  containerRef: React.RefObject<HTMLElement | null>
  scrollRootRef?: React.RefObject<HTMLElement | null>
  canvasRevision?: string
  onMinimize: () => void
  onTogglePin: () => void
  onOpenLinksPanel: () => void
  onMoveBlock: (dir: 'top' | 'up' | 'down' | 'bottom') => void
  onDuplicate: () => void
  onDelete: () => void
  onOpenLayoutPicker: () => void
  onCycleLayout: (dir: 'prev' | 'next') => void
}) {
  /** After X / minimize, suppress CSS hover-expand until pointer leaves the chrome. */
  const [hoverPanelDismissed, setHoverPanelDismissed] = useState(false)

  useEffect(() => {
    if (!minimized) setHoverPanelDismissed(false)
  }, [minimized])

  const handleMinimizeClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setHoverPanelDismissed(true)
    if (minimized && !pinned) return
    onMinimize()
  }

  const handleChromeMouseLeave = () => {
    setHoverPanelDismissed(false)
  }

  const sectionBox = useBuilderSectionBox(block.id, containerRef, canvasRevision, scrollRootRef, 1)
  const compactSection = (sectionBox?.height ?? 999) < 56
  const effectiveMinimized = minimized || (compactSection && !pinned)

  const showLayout = getSectionLayoutOptions(block.block_type).length > 0
  const iconBtn = 'p-0.5 text-gray-400/90 hover:text-white transition-colors'
  const dragHandleBtn = cn(
    iconBtn,
    'mr-0.5 shrink-0 cursor-grab border-r border-white/10 pr-1 active:cursor-grabbing',
  )
  const hasLinks = blockHasConfiguredLinks(block)
  const { dragOffset, dragging, portalRef, beginDrag } = useSectionChromeToolbarDrag(block.id, scrollRootRef)

  const toolbarBody = (
    <>
      <button
        type="button"
        onMouseDown={beginDrag}
        className={dragHandleBtn}
        title="Drag to move toolbar anywhere on screen"
        aria-label="Drag to reposition toolbar"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={handleMinimizeClick}
        className={cn(iconBtn, 'hover:text-amber-300 shrink-0')}
        title={
          effectiveMinimized
            ? 'Close toolbar'
            : 'Minimize to hover ball'
        }
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <span className="max-w-[140px] truncate px-1 text-[11px] font-semibold text-white/95" title={catalogBlockLabel(block)}>
        {catalogBlockLabel(block)}
      </span>
      <button type="button" onClick={e => { e.stopPropagation(); onMoveBlock('top') }} className={iconBtn} title="Move section to top of page">
        <ChevronsUp className="w-4 h-4" />
      </button>
      <button type="button" onClick={e => { e.stopPropagation(); onMoveBlock('up') }} className={iconBtn} title="Move section up on the page">
        <ChevronUp className="w-4 h-4" />
      </button>
      <button type="button" onClick={e => { e.stopPropagation(); onMoveBlock('down') }} className={iconBtn} title="Move section down on the page">
        <ChevronDown className="w-4 h-4" />
      </button>
      <button type="button" onClick={e => { e.stopPropagation(); onMoveBlock('bottom') }} className={iconBtn} title="Move section to bottom of page">
        <ChevronsDown className="w-4 h-4" />
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
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onOpenLinksPanel()
        }}
        className={cn(
          iconBtn,
          'relative rounded-md shrink-0',
          hasLinks && 'text-sky-300 bg-sky-500/20 ring-1 ring-sky-400/30 hover:text-sky-200 hover:bg-sky-500/30',
        )}
        title={hasLinks ? 'Section has links — open Links panel' : 'Link buttons & URLs (Links panel)'}
      >
        <Link2 className="w-4 h-4" />
        {hasLinks ? (
          <span className="absolute top-0.5 right-0.5 h-1 w-1 rounded-full bg-sky-400" aria-hidden />
        ) : null}
      </button>
      <button type="button" onClick={e => { e.stopPropagation(); onDuplicate() }} className={iconBtn} title="Duplicate (Ctrl+D)">
        <Copy className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="Delete section"
        className={cn(iconBtn, 'hover:text-red-400')}
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onTogglePin() }}
        className={cn(
          iconBtn,
          pinned && 'text-primary bg-primary/15 ring-1 ring-primary/40 rounded-md hover:text-primary',
        )}
        title={pinned ? 'Unpin — collapse to hover ball' : 'Pin toolbar open'}
      >
        <Pin className={cn('w-3.5 h-3.5', pinned && 'fill-current')} />
      </button>
    </>
  )

  const panelClass =
    'flex items-center gap-0.5 rounded-lg border border-white/12 bg-gray-900/80 px-1.5 py-1 text-white shadow-lg shadow-black/20 backdrop-blur-md'

  const stayOpen = pinned
  const chromeContent = effectiveMinimized ? (
    <div
      data-builder-overlay={block.id}
      data-builder-section-toolbar
      data-builder-floating-ui
      className={cn(
        stayOpen ? 'flex items-center gap-1' : 'group/section-chrome relative',
        dragging && 'pointer-events-auto',
      )}
      onClick={e => e.stopPropagation()}
      onMouseLeave={handleChromeMouseLeave}
    >
      {!stayOpen ? (
        <div
          className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-full border border-white/12 bg-gray-900/80 text-gray-200 shadow-lg shadow-black/20 backdrop-blur-md ring-1 ring-white/10 transition-all hover:scale-110 hover:text-white hover:ring-primary/40 active:cursor-grabbing"
          title="Drag to move anywhere — hover to expand tools"
          onMouseDown={beginDrag}
        >
          <GripVertical className="h-3 w-3" />
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
                !dragging && !hoverPanelDismissed &&
                  'group-hover/section-chrome:scale-100 group-hover/section-chrome:opacity-100 group-hover/section-chrome:pointer-events-auto',
              ),
        )}
      >
        {toolbarBody}
      </div>
    </div>
  ) : (
    <div
      data-builder-overlay={block.id}
      data-builder-section-toolbar
      data-builder-floating-ui
      className={panelClass}
      onClick={e => e.stopPropagation()}
      onMouseLeave={handleChromeMouseLeave}
    >
      {toolbarBody}
    </div>
  )

  return (
    <BuilderSectionChromePortal
      blockId={block.id}
      containerRef={containerRef}
      revision={canvasRevision}
      scrollRootRef={scrollRootRef}
      visible={visible}
      dragOffset={dragOffset}
      portalRef={portalRef}
    >
      {chromeContent}
    </BuilderSectionChromePortal>
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

    const label = pg.title?.trim() || (pg.is_homepage ? 'Home' : pg.slug) || 'Page'
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

function findCanvasBlockType(
  blocksMap: Record<string, WebsiteBlock[]>,
  pages: WebsitePage[],
  blockId: string,
  preferPageId?: string | null,
): string | null {
  const pageId = findPageIdForBlock(blocksMap, pages, blockId, preferPageId)
  if (!pageId) return null
  return blocksMap[pageId]?.find(b => b.id === blockId)?.block_type ?? null
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

/** Strip non-JSON values (undefined, NaN, functions) before PATCH payloads. */
function sanitizeForApiJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, v) => {
    if (typeof v === 'number' && !Number.isFinite(v)) return null
    return v
  })) as T
}

function blockPayloadForApi(block: WebsiteBlock) {
  const props = sanitizeForApiJson(block.props ?? {})
  return {
    props,
    style_overrides: sanitizeForApiJson(block.style_overrides || {}),
    label: block.label,
    visible: block.visible,
    visible_on_mobile: block.visible_on_mobile,
    visible_on_tablet: block.visible_on_tablet,
    visible_on_desktop: block.visible_on_desktop,
    animation: block.animation,
    animation_delay: block.animation_delay,
    sort_order: block.sort_order,
  }
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

function blocksByPageFingerprint(blocksByPage: Record<string, WebsiteBlock[]>): string {
  return JSON.stringify(
    Object.entries(blocksByPage)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([pageId, blocks]) => [
        pageId,
        blocks.map(b => `${b.id}:${b.block_type}:${b.sort_order}`).join(','),
      ]),
  )
}

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

function resolveHomePage(pages: WebsitePage[]): WebsitePage | undefined {
  return pages.find(p => p.is_homepage) || pages[0]
}

/** Nav / announcement / footer live on the homepage only — strip duplicates elsewhere. */
function ensureStructureBlockOnHomepage(
  blocksByPage: Record<string, WebsiteBlock[]>,
  pages: WebsitePage[],
  sourceBlock: WebsiteBlock,
  blockType: string,
): Record<string, WebsiteBlock[]> {
  if (!GLOBAL_STRUCTURE_BLOCK_TYPES.has(blockType)) return blocksByPage
  const home = resolveHomePage(pages)
  if (!home) return blocksByPage

  let next = { ...blocksByPage }
  for (const page of pages) {
    if (page.id === home.id) continue
    const blocks = next[page.id] || []
    const filtered = blocks.filter(b => b.block_type !== blockType)
    if (filtered.length !== blocks.length) {
      next[page.id] = filtered.map((b, i) => ({ ...b, sort_order: i }))
    }
  }

  const homeBlocks = next[home.id] || []
  const relocated = relocateExistingStructureBlock(homeBlocks, blockType, -1)
  if (relocated) {
    next[home.id] = relocated
    return next
  }
  if (homeBlocks.some(b => b.block_type === blockType)) return next

  const clone: WebsiteBlock = {
    ...sourceBlock,
    id: `temp-${blockType}-${home.id}-${Date.now()}`,
    page_id: home.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  next[home.id] = insertBlockAtIndex(homeBlocks, clone, blockType, -1)
  return next
}

/** New pages are content-only; homepage nav/footer is injected at preview/live time. */
function seedStructureBlocksForNewPage(
  _blocksByPage: Record<string, WebsiteBlock[]>,
  _pages: WebsitePage[],
  _newPageId: string,
): WebsiteBlock[] {
  return []
}

function consolidateStructureBlocksOnHomepage(
  blocksByPage: Record<string, WebsiteBlock[]>,
  pages: WebsitePage[],
): Record<string, WebsiteBlock[]> {
  const home = resolveHomePage(pages)
  if (!home) return blocksByPage

  let next: Record<string, WebsiteBlock[]> = { ...blocksByPage }

  for (const type of ['announcement_bar', 'nav', 'footer'] as const) {
    let canonical: WebsiteBlock | undefined = (next[home.id] || []).find(b => b.block_type === type)
    if (!canonical) {
      for (const page of pages) {
        canonical = (next[page.id] || []).find(b => b.block_type === type)
        if (canonical) break
      }
    }

    for (const page of pages) {
      if (page.id === home.id) continue
      const blocks = next[page.id] || []
      const filtered = blocks.filter(b => b.block_type !== type)
      if (filtered.length !== blocks.length) {
        next[page.id] = filtered.map((b, i) => ({ ...b, sort_order: i }))
      }
    }

    if (!canonical) continue

    let homeBlocks = (next[home.id] || []).filter(b => b.block_type !== type)
    homeBlocks = insertBlockAtIndex(
      homeBlocks,
      { ...canonical, page_id: home.id },
      type,
      -1,
    )
    const relocated = relocateExistingStructureBlock(homeBlocks, type, -1)
    next[home.id] = relocated || homeBlocks
  }

  return next
}

/** @deprecated alias — structure blocks are consolidated on the homepage. */
function normalizeAllStructureBlocks(
  blocksByPage: Record<string, WebsiteBlock[]>,
  pages: WebsitePage[],
): Record<string, WebsiteBlock[]> {
  return consolidateStructureBlocksOnHomepage(blocksByPage, pages)
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
  const home = resolveHomePage(pages)
  if (home) {
    const homeBlock = (blocksByPage[home.id] || []).find(b => b.block_type === blockType)
    if (homeBlock) return { block: homeBlock, pageId: home.id }
  }
  for (const page of pages) {
    const found = (blocksByPage[page.id] || []).find(b => b.block_type === blockType)
    if (found) return { block: found, pageId: page.id }
  }
  return undefined
}

/** Apply layout props to the homepage structure block (single source of truth). */
function applyStructureLayoutToAllPages(
  blocksByPage: Record<string, WebsiteBlock[]>,
  pages: WebsitePage[],
  blockType: string,
  def: { label: string },
  finalProps: BlockProps,
  _activePageId: string,
  sourceBlock: WebsiteBlock,
): Record<string, WebsiteBlock[]> {
  const stamp = new Date().toISOString()
  const template: WebsiteBlock = {
    ...sourceBlock,
    block_type: blockType as WebsiteBlock['block_type'],
    label: sourceBlock.label || def.label,
    props: finalProps,
    updated_at: stamp,
  }
  let next = ensureStructureBlockOnHomepage(blocksByPage, pages, template, blockType)
  const home = resolveHomePage(pages)
  if (home) {
    next[home.id] = (next[home.id] || []).map(b =>
      b.block_type === blockType ? { ...b, props: finalProps, updated_at: stamp } : b,
    )
  }
  return consolidateStructureBlocksOnHomepage(next, pages)
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

// ?? Sub-item schema registry ?????????????????????????????????????????????????

type ItemFieldType = 'text' | 'textarea' | 'image' | 'video' | 'number' | 'boolean' | 'emoji' | 'select'
interface ItemField { key: string; label: string; type: ItemFieldType; options?: string[]; optionLabels?: Record<string, string> }
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
    defaultItem: { name: 'New Plan', price: 0, period: 'mo', cta: 'Get Started', cta_url: '/contact', highlighted: false, features: [] },
    fields: [
      { key: 'name',        label: 'Plan Name',     type: 'text' },
      { key: 'price',       label: 'Price',         type: 'text' },
      { key: 'period',      label: 'Period',        type: 'text' },
      { key: 'cta',         label: 'Button Label',  type: 'text' },
      { key: 'cta_url',     label: 'Button Link',   type: 'text' },
      { key: 'highlighted', label: 'Featured Plan', type: 'boolean' },
    ],
  },
  faq: {
    arrayKey: 'faqs', itemLabel: 'Question',
    defaultItem: { question: 'New question?', answer: 'Answer here.', image_url: '' },
    fields: [
      { key: 'question',  label: 'Question', type: 'text' },
      { key: 'answer',    label: 'Answer',   type: 'textarea' },
      { key: 'image_url', label: 'Answer image (optional)', type: 'image' },
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
  portfolio_grid: {
    arrayKey: 'projects', itemLabel: 'Project',
    defaultItem: { title: 'New Project', category: 'Category', image_url: '', url: '' },
    fields: [
      { key: 'image_url', label: 'Image',                type: 'image' },
      { key: 'title',     label: 'Project Title',        type: 'text' },
      { key: 'category',  label: 'Category / Tag',       type: 'text' },
      { key: 'url',       label: 'Project Link (optional)', type: 'text' },
    ],
  },
  video_gallery: {
    arrayKey: 'videos', itemLabel: 'Video',
    defaultItem: { video_url: '', title: '', caption: '' },
    fields: [
      { key: 'video_url', label: 'Video', type: 'video' },
      { key: 'title',     label: 'Title',     type: 'text' },
      { key: 'caption',   label: 'Caption',   type: 'textarea' },
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
  'service.process': {
    arrayKey: 'steps', itemLabel: 'Step',
    defaultItem: { title: 'New step', description: 'Describe this step.' },
    fields: [
      { key: 'title',       label: 'Title',       type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  'service.team': {
    arrayKey: 'members', itemLabel: 'Team member',
    defaultItem: { name: 'New team member', role: 'Specialist', bio: 'Short bio about this team member.', avatar: '', rating: 4.8, reviews: 0, available: true, nextAvailable: 'Today' },
    fields: [
      { key: 'avatar',        label: 'Photo',                  type: 'image' },
      { key: 'name',          label: 'Name',                   type: 'text' },
      { key: 'role',          label: 'Role / Title',           type: 'text' },
      { key: 'bio',           label: 'Bio',                    type: 'textarea' },
      { key: 'rating',        label: 'Rating (0-5)',           type: 'number' },
      { key: 'reviews',       label: 'Review count',           type: 'number' },
      { key: 'available',     label: 'Available for booking',  type: 'boolean' },
      { key: 'nextAvailable', label: 'Next available slot',    type: 'text' },
    ],
  },
  timeline: {
    arrayKey: 'items', itemLabel: 'Milestone',
    defaultItem: { year: '2024', title: 'New milestone', desc: 'Describe this step.', image_url: '' },
    fields: [
      { key: 'image_url', label: 'Image', type: 'image' },
      { key: 'year', label: 'Year / label', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'desc', label: 'Description', type: 'textarea' },
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
    // Logos default to "contain" so varied aspect ratios are not cropped by the section-image toolbar.
    defaultItem: { name: 'Brand', image_url: '', image_fit: 'contain' },
    fields: [
      { key: 'image_url', label: 'Logo Image', type: 'image' },
      { key: 'name',      label: 'Brand Name', type: 'text' },
      { key: 'url',       label: 'Link URL',   type: 'text' },
    ],
  },
  marquee_strip: {
    arrayKey: 'items', itemLabel: 'Item',
    defaultItem: { label: 'New highlight', url: '' },
    fields: [
      { key: 'image_url', label: 'Image', type: 'image' },
      { key: 'label', label: 'Text', type: 'text' },
      { key: 'url', label: 'Link', type: 'text' },
    ],
  },
  payment_methods_strip: {
    arrayKey: 'methods', itemLabel: 'Payment method',
    defaultItem: { method: 'visa' },
    fields: [
      {
        key: 'method',
        label: 'Provider',
        type: 'select',
        options: [...PAYMENT_METHOD_KEYS],
        optionLabels: PAYMENT_METHOD_LABELS,
      },
    ],
  },
  // ── Vertical library blocks (static content, editable here) ──────────────────
  'vertical.courseCatalog': {
    arrayKey: 'courses', itemLabel: 'Course',
    defaultItem: { id: '', title: 'New course', instructor: 'Instructor name', level: 'Beginner', duration: '4 weeks', lessons: 12, rating: 4.8, reviews: 0, price: 99, currency: 'USD', category: 'Category', description: 'Short course description.', image: '' },
    fields: [
      { key: 'image',       label: 'Image',       type: 'image' },
      { key: 'title',       label: 'Title',       type: 'text' },
      { key: 'instructor',  label: 'Instructor',  type: 'text' },
      { key: 'category',    label: 'Category',    type: 'text' },
      { key: 'level',       label: 'Level',       type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] },
      { key: 'duration',    label: 'Duration',    type: 'text' },
      { key: 'lessons',     label: 'Lessons',     type: 'number' },
      { key: 'price',       label: 'Price',       type: 'number' },
      { key: 'rating',      label: 'Rating',      type: 'number' },
      { key: 'reviews',     label: 'Reviews',     type: 'number' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  'vertical.courseDetail': {
    arrayKey: 'syllabus', itemLabel: 'Week',
    defaultItem: { week: 1, title: 'New topic', lessons: 3, duration: '1h' },
    fields: [
      { key: 'week',     label: 'Week #',   type: 'number' },
      { key: 'title',    label: 'Topic',    type: 'text' },
      { key: 'lessons',  label: 'Lessons',  type: 'number' },
      { key: 'duration', label: 'Duration', type: 'text' },
    ],
  },
  'vertical.eventListing': {
    arrayKey: 'events', itemLabel: 'Event',
    defaultItem: { id: '', title: 'New event', date: 'Jun 1, 2026', venue: 'Venue name', fromPrice: 0, currency: 'USD', tag: 'Event', image: '' },
    fields: [
      { key: 'image',     label: 'Image',                type: 'image' },
      { key: 'title',     label: 'Title',                type: 'text' },
      { key: 'date',      label: 'Date',                 type: 'text' },
      { key: 'venue',     label: 'Venue',                type: 'text' },
      { key: 'fromPrice', label: 'From price (0 = Free)', type: 'number' },
      { key: 'tag',       label: 'Tag',                  type: 'text' },
    ],
  },
  'vertical.ticketPicker': {
    arrayKey: 'tiers', itemLabel: 'Ticket tier',
    defaultItem: { id: '', name: 'New tier', price: 0, currency: 'USD', perks: 'First perk\nSecond perk', remaining: 100, popular: false },
    fields: [
      { key: 'name',      label: 'Tier name',          type: 'text' },
      { key: 'price',     label: 'Price',              type: 'number' },
      { key: 'perks',     label: 'Perks (one per line)', type: 'textarea' },
      { key: 'remaining', label: 'Remaining',          type: 'number' },
      { key: 'popular',   label: 'Mark as popular',    type: 'boolean' },
    ],
  },
  'vertical.fitnessSchedule': {
    arrayKey: 'classes', itemLabel: 'Class',
    defaultItem: { id: '', name: 'New class', instructor: 'Instructor', type: 'Yoga', duration: 60, intensity: 3, date: 'Mon, May 4', time: '6:00 AM', capacity: 20, booked: 0, studio: 'Studio A', price: 20, currency: 'USD' },
    fields: [
      { key: 'name',       label: 'Class name',    type: 'text' },
      { key: 'instructor', label: 'Instructor',    type: 'text' },
      { key: 'type',       label: 'Type',          type: 'select', options: ['Yoga', 'HIIT', 'Cycle', 'Pilates', 'Strength', 'Boxing'] },
      { key: 'time',       label: 'Time',          type: 'text' },
      { key: 'duration',   label: 'Duration (min)', type: 'number' },
      { key: 'intensity',  label: 'Intensity',     type: 'select', options: ['1', '2', '3', '4', '5'] },
      { key: 'capacity',   label: 'Capacity',      type: 'number' },
      { key: 'booked',     label: 'Booked',        type: 'number' },
      { key: 'studio',     label: 'Studio',        type: 'text' },
      { key: 'price',      label: 'Price',         type: 'number' },
    ],
  },
  'vertical.vehicleDetail': {
    arrayKey: 'highlights', itemLabel: 'Highlight',
    defaultItem: { text: 'New highlight' },
    fields: [
      { key: 'text', label: 'Highlight', type: 'text' },
    ],
  },
  'booking.recurring': {
    arrayKey: 'presets', itemLabel: 'Frequency option',
    defaultItem: { id: '', name: 'Weekly', description: 'Every week, same day', discount_pct: 0 },
    fields: [
      { key: 'name',         label: 'Name',         type: 'text' },
      { key: 'description',  label: 'Description',  type: 'text' },
      { key: 'discount_pct', label: 'Discount %',   type: 'number' },
    ],
  },
  'vertical.propertyListing': {
    arrayKey: 'properties', itemLabel: 'Property',
    defaultItem: { id: '', title: 'New listing', address: '', price: 250000, currency: 'USD', beds: 2, baths: 1, sqft: 900, type: 'house', status: 'for-sale', agent: '', image: '' },
    fields: [
      { key: 'image',   label: 'Photo',    type: 'image' },
      { key: 'title',   label: 'Title',    type: 'text' },
      { key: 'address', label: 'Address',  type: 'text' },
      { key: 'status',  label: 'Status',   type: 'select', options: ['for-sale', 'for-rent', 'new', 'open-house', 'pending'] },
      { key: 'type',    label: 'Type',     type: 'select', options: ['house', 'condo', 'loft', 'townhouse', 'pg'] },
      { key: 'price',   label: 'Price',    type: 'number' },
      { key: 'currency', label: 'Currency', type: 'text' },
      { key: 'beds',    label: 'Beds',     type: 'number' },
      { key: 'baths',   label: 'Baths',    type: 'number' },
      { key: 'sqft',    label: 'Sq ft',    type: 'number' },
      { key: 'agent',   label: 'Agent',    type: 'text' },
    ],
  },
  'vertical.autoInventory': {
    arrayKey: 'vehicles', itemLabel: 'Vehicle',
    defaultItem: { id: '', year: 2024, make: 'New', model: 'Vehicle', trim: '', price: 25000, currency: 'USD', mileage: 0, fuel: 'Gas', transmission: 'Auto', bodyStyle: 'Sedan', exteriorColor: '', condition: 'Used', image: '' },
    fields: [
      { key: 'image',        label: 'Photo',        type: 'image' },
      { key: 'year',         label: 'Year',         type: 'number' },
      { key: 'make',         label: 'Make',         type: 'text' },
      { key: 'model',        label: 'Model',        type: 'text' },
      { key: 'trim',         label: 'Trim',         type: 'text' },
      { key: 'condition',    label: 'Condition',    type: 'select', options: ['New', 'Certified', 'Used'] },
      { key: 'price',        label: 'Price',        type: 'number' },
      { key: 'currency',     label: 'Currency',     type: 'text' },
      { key: 'mileage',      label: 'Mileage',      type: 'number' },
      { key: 'fuel',         label: 'Fuel',         type: 'select', options: ['Gas', 'Hybrid', 'Electric', 'Diesel'] },
      { key: 'transmission', label: 'Transmission', type: 'select', options: ['Auto', 'Manual'] },
      { key: 'bodyStyle',    label: 'Body style',   type: 'text' },
      { key: 'exteriorColor', label: 'Exterior color', type: 'text' },
    ],
  },
}

const ITEM_SCHEMA_ALIASES: Partial<Record<string, keyof typeof ITEM_SCHEMAS>> = {
  features_alternating: 'features',
  services_list: 'services_cards',
  'service.faq': 'faq',
  'service.pricing': 'pricing',
  testimonials_grid: 'testimonials',
}

/** Sidebar heading for expandable item lists (clearer than raw itemLabel). */
function itemListSectionTitle(blockType: string, itemSchema: ItemSchema): string {
  const titles: Record<string, string> = {
    faq: 'Questions',
    'service.faq': 'Questions',
    timeline: 'Milestones',
    stats: 'Stats',
    testimonials: 'Reviews',
    testimonials_grid: 'Reviews',
    pricing: 'Plans',
    'service.pricing': 'Plans',
    features: 'Features',
    services_cards: 'Services',
    team_grid: 'Team members',
    trust_logos: 'Logos',
    marquee_strip: 'Marquee items',
    payment_methods_strip: 'Payment methods',
    gallery_masonry: 'Images',
    gallery: 'Images',
    video_gallery: 'Videos',
    portfolio_grid: 'Projects',
    'vertical.fitnessSchedule': 'Classes',
    'vertical.courseCatalog': 'Courses',
    'vertical.vehicleDetail': 'Highlights',
    'vertical.autoInventory': 'Vehicles',
    'vertical.propertyListing': 'Properties',
    'booking.recurring': 'Frequency options',
    'service.process': 'Steps',
    'service.team': 'Team members',
  }
  return titles[blockType] || `${itemSchema.itemLabel}s`
}

/** Block types whose item list should start expanded in the Content tab. */
const ITEM_LIST_DEFAULT_OPEN = new Set([
  'faq', 'service.faq', 'timeline', 'stats', 'testimonials', 'testimonials_grid', 'pricing', 'service.pricing', 'features', 'features_alternating',
  'services_cards', 'services_list', 'team_grid', 'trust_logos', 'marquee_strip', 'payment_methods_strip',
  'gallery_masonry', 'gallery', 'gallery_grid', 'video_gallery',
  'vertical.fitnessSchedule', 'vertical.ticketPicker', 'vertical.courseCatalog', 'vertical.vehicleDetail', 'vertical.autoInventory', 'vertical.propertyListing', 'booking.recurring',
  'service.process', 'service.team',
])

/** Block types with their own dedicated Title/Description fields in a custom content panel — skip the generic duplicates below. */
const TITLE_DESC_HANDLED_ELSEWHERE = new Set([
  'vertical.courseDetail',
  'vertical.ticketPicker',
  'booking.recurring',
  'booking.wizard',
  'booking.resource',
  'state.error',
  'state.empty',
])

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
  'video_gallery',
  'image_gallery',
  'portfolio_grid',
  'category_cards',
  'product_grid',
  'menu_grid',
  'related_products',
  'testimonials',
  'testimonials_grid',
  'marquee_strip',
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
    showColumns: true, showImageHeight: false, showCardStyle: false, showProductToggles: false, showServiceToggles: false,
  },
  'vertical.autoInventory': {
    columnMin: 2, defaultColumns: 3, itemCountLabel: 'Vehicles shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: false, showCardStyle: false, showProductToggles: false, showServiceToggles: false,
  },
  'vertical.eventListing': {
    columnMin: 2, defaultColumns: 4, itemCountLabel: 'Events shown', itemCountKeys: ['show_count'],
    // Product toggles (Badges/Stock/Add button) don't map to this block's real props — it has its own
    // "Show event tag" checkbox and button-label field in the Content tab instead.
    showColumns: true, showImageHeight: false, showCardStyle: false, showProductToggles: false, showServiceToggles: false,
  },
  'vertical.courseCatalog': {
    columnMin: 2, defaultColumns: 3, itemCountLabel: 'Courses shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: false, showCardStyle: false, showProductToggles: false, showServiceToggles: false,
  },
  blog_grid: {
    columnMin: 1, defaultColumns: 3, itemCountLabel: 'Posts shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: false, showCardStyle: true, showProductToggles: false, showServiceToggles: false,
  },
  blog_featured: {
    columnMin: 1, defaultColumns: 3, itemCountLabel: 'Posts shown', itemCountKeys: ['show_count'],
    showColumns: true, showImageHeight: false, showCardStyle: true, showProductToggles: false, showServiceToggles: false,
  },
  blog_list: {
    columnMin: 1, defaultColumns: 1, itemCountLabel: 'Posts shown', itemCountKeys: ['show_count'],
    showColumns: false, showImageHeight: false, showCardStyle: true, showProductToggles: false, showServiceToggles: false,
  },
}

const CATALOG_GRID_BLOCK_TYPES = new Set(Object.keys(CATALOG_GRID_BLOCK_CONFIG))

function getCatalogGridBlockConfig(blockType: string): CatalogGridBlockConfig {
  return CATALOG_GRID_BLOCK_CONFIG[blockType] ?? CATALOG_GRID_BLOCK_CONFIG.product_grid
}

const CATALOG_GRID_COLUMN_MAX = 12
// Max items a single catalog section can show. Kept in lockstep with the backend
// live endpoint cap and the storefront block clamp. Sane ceiling for one section —
// large catalogs should use a dedicated listing page with pagination, not 1000s
// of cards rendered in a single block.
const CATALOG_GRID_COUNT_MAX = 200

function catalogColumnOptionsFor(blockType: string): number[] {
  const min = getCatalogGridBlockConfig(blockType).columnMin
  return Array.from({ length: CATALOG_GRID_COLUMN_MAX - min + 1 }, (_, i) => min + i)
}

const CATALOG_CARD_STYLE_OPTIONS = [
  { id: 'default', label: 'Standard' },
  { id: 'compact', label: 'Compact' },
  { id: 'minimal', label: 'Minimal' },
] as const

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
  return (
    <PanelSliderRow
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      unit={suffix}
      onCommit={onChange}
    />
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
    const merged = { ...next }
    if (blockType === 'category_cards' && p.layout === 'wellness') {
      const layoutKeys = ['image_height_pct', 'image_width_pct', 'image_aspect', 'image_object_fit', 'card_padding', 'item_gap', 'card_style', 'columns', 'compact']
      if (Object.keys(next).some(k => layoutKeys.includes(k))) {
        merged.layout = 'grid'
      }
    }
    onPreview(merged as Partial<BlockProps>)
    onUpdate(merged as Partial<BlockProps>)
  }

  const config = getCatalogGridBlockConfig(blockType)
  const colMin = config.columnMin
  const colMax = CATALOG_GRID_COLUMN_MAX
  const columns = Math.min(colMax, Math.max(colMin, Number(p.columns ?? config.defaultColumns) || colMin))
  const gap = Math.min(80, Math.max(0, Number(p.item_gap ?? 12) || 0))
  const imageHeightPct = Math.min(100, Math.max(40, Number(p.image_height_pct ?? 100) || 100))
  const imageWidthPct = Math.min(100, Math.max(40, Number(p.image_width_pct ?? 100) || 100))
  const cardPadding = Math.min(32, Math.max(4, Number(p.card_padding ?? 10) || 10))
  const showCount = Math.min(CATALOG_GRID_COUNT_MAX, Math.max(1, Number(
    config.itemCountKeys.map(k => p[k]).find(v => v != null && v !== '') ?? 12,
  ) || 12))
  const cardStyle = String(p.card_style ?? 'default')
  const imageAspect = String(p.image_aspect ?? 'auto')
  const imageObjectFit = String(p.image_object_fit ?? 'cover')
  const cardBorderRadius = p.card_border_radius
  const radiusAuto = cardBorderRadius == null || cardBorderRadius === ''
  const showStock = p.show_stock !== false
  const showAddButton = p.show_add_button !== false
  const showBookLink = p.show_book_link !== false && p.show_add_button !== false
  const addButtonStyle = parseCatalogAddButtonStyle(p.add_button_style)
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
    <div className="space-y-2">
      {config.showColumns && (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <PanelFieldLabel>Columns</PanelFieldLabel>
          <input
            type="number"
            min={colMin}
            max={colMax}
            step={1}
            value={columns}
            onChange={e => patch({ columns: Math.min(colMax, Math.max(colMin, Number(e.target.value) || colMin)) })}
            className="w-9 rounded border border-border bg-background px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums"
          />
        </div>
        <PanelChipScroll>
          {columnOptions.map(n => (
            <PanelChip key={n} active={columns === n} onClick={() => patch({ columns: n })}>
              {n}
            </PanelChip>
          ))}
        </PanelChipScroll>
      </div>
      )}

      {config.showImageHeight && imageAspect === 'auto' && (
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

      <div className="space-y-1">
        <PanelFieldLabel>Image aspect</PanelFieldLabel>
        <PanelChipWrap>
          {CATALOG_IMAGE_ASPECT_OPTIONS.map(opt => (
            <PanelChip
              key={opt.value}
              active={imageAspect === opt.value}
              onClick={() => patch({
                image_aspect: opt.value,
                ...(opt.value === 'full' ? { image_object_fit: 'contain' } : {}),
              })}
            >
              {opt.label}
            </PanelChip>
          ))}
        </PanelChipWrap>
        {imageAspect === 'full' && (
          <p className="text-[10px] leading-snug text-muted-foreground">
            Shows the complete image at its natural size — nothing is cropped.
          </p>
        )}
      </div>

      <CatalogGridSliderField
        label="Image width"
        value={imageWidthPct}
        min={40}
        max={100}
        step={2}
        suffix="%"
        onChange={n => patch({ image_width_pct: n })}
      />

      {imageAspect !== 'full' && (
      <div className="space-y-1">
        <PanelFieldLabel>Image fit</PanelFieldLabel>
        <PanelChipWrap>
          {CATALOG_IMAGE_OBJECT_FIT_OPTIONS.map(opt => (
            <PanelChip
              key={opt.value}
              active={imageObjectFit === opt.value}
              onClick={() => patch({ image_object_fit: opt.value })}
            >
              {opt.label}
            </PanelChip>
          ))}
        </PanelChipWrap>
      </div>
      )}

      <div className="space-y-1">
        <PanelFieldLabel>Card corner radius</PanelFieldLabel>
        <PanelChipWrap>
          <PanelChip active={radiusAuto} onClick={() => patch({ card_border_radius: null })}>
            Auto
          </PanelChip>
          {[0, 8, 12, 16, 24].map(n => (
            <PanelChip
              key={n}
              active={!radiusAuto && Number(cardBorderRadius) === n}
              onClick={() => patch({ card_border_radius: n })}
            >
              {n}px
            </PanelChip>
          ))}
        </PanelChipWrap>
        {!radiusAuto && (
          <CatalogGridSliderField
            label="Custom radius"
            value={Math.min(32, Math.max(0, Number(cardBorderRadius) || 0))}
            min={0}
            max={32}
            step={1}
            suffix="px"
            onChange={n => patch({ card_border_radius: n })}
          />
        )}
      </div>

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
        max={CATALOG_GRID_COUNT_MAX}
        step={1}
        onChange={patchShowCount}
      />

      {config.showCardStyle && (
      <div className="space-y-1">
        <PanelFieldLabel>Card style</PanelFieldLabel>
        <PanelChipWrap>
          {CATALOG_CARD_STYLE_OPTIONS.map(opt => (
            <PanelChip
              key={opt.id}
              active={cardStyle === opt.id}
              onClick={() => patch({ card_style: opt.id, compact: opt.id === 'compact' })}
            >
              {opt.label}
            </PanelChip>
          ))}
        </PanelChipWrap>
      </div>
      )}

      {(config.showProductToggles || config.showServiceToggles) && (
      <div className="space-y-1">
        <PanelFieldLabel>Display options</PanelFieldLabel>
        <PanelChipWrap>
          {config.showProductToggles && (
            <>
              <PanelChip active={showBadges} onClick={() => patch({ show_badges: !showBadges })}>
                Badges
              </PanelChip>
              <PanelChip active={showStock} onClick={() => patch({ show_stock: !showStock })}>
                Stock label
              </PanelChip>
              <PanelChip active={showAddButton} onClick={() => patch({ show_add_button: !showAddButton })}>
                Add button
              </PanelChip>
            </>
          )}
          {config.showServiceToggles && (
            <PanelChip active={showBookLink} onClick={() => patch({ show_book_link: !showBookLink })}>
              Book link
            </PanelChip>
          )}
        </PanelChipWrap>
        {config.showProductToggles && showAddButton && (
          <div className="space-y-1 pt-1">
            <PanelFieldLabel>Add button style</PanelFieldLabel>
            <PanelChipWrap>
              {CATALOG_ADD_BUTTON_STYLE_OPTIONS.map(opt => (
                <PanelChip
                  key={opt.value}
                  active={addButtonStyle === opt.value}
                  onClick={() => patch({ add_button_style: opt.value })}
                >
                  {opt.label}
                </PanelChip>
              ))}
            </PanelChipWrap>
          </div>
        )}
      </div>
      )}
    </div>
  )
}

// ?? Inline Media Picker ???????????????????????????????????????????????????????

function InlineMediaPicker({
  siteId, value, onChange, label = 'Image', onFocus,
}: {
  siteId: string
  value: string
  onChange: (url: string) => void
  label?: string
  onFocus?: () => void
}) {
  const { data: mediaList = [] } = useMedia(siteId)
  const uploadMedia = useUploadMedia(siteId)
  const [panel, setPanel] = useState<'none' | 'library' | 'url'>('none')
  const [urlInput, setUrlInput] = useState(value || '')
  const [previewOk, setPreviewOk] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const resolvedPreview = value ? mediaUrl(value) : ''

  useEffect(() => {
    setUrlInput(value || '')
    setPreviewOk(true)
  }, [value])

  const notifyFocus = () => { onFocus?.() }

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
          {resolvedPreview && previewOk ? (
            <img
              key={resolvedPreview}
              src={resolvedPreview}
              className="w-full h-full object-cover"
              alt=""
              onLoad={() => setPreviewOk(true)}
              onError={() => setPreviewOk(false)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1 px-3 text-center text-gray-500">
              <ImageIcon className="w-6 h-6 opacity-40" />
              <span className="text-[11px] leading-snug">
                {value ? 'Image saved — preview unavailable (check URL or backend)' : 'No image selected'}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-gray-200 h-28 flex flex-col items-center justify-center gap-1 text-gray-400 bg-gray-50">
          <ImageIcon className="w-6 h-6 opacity-40" />
          <span className="text-xs">No image selected</span>
        </div>
      )}

      {value ? (
        <button
          type="button"
          onClick={() => { notifyFocus(); onChange(''); setPanel('none') }}
          className="text-xs font-semibold text-red-500 hover:text-red-700"
        >
          Remove image
        </button>
      ) : null}

      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => { notifyFocus(); fileRef.current?.click() }}
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
          onClick={() => { notifyFocus(); setPanel(p => p === 'library' ? 'none' : 'library') }}
          className={cn(actionBtn, panel === 'library' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}
        >
          <ImageIcon className="w-4 h-4" />
          Library
        </button>
        <button
          type="button"
          onClick={() => {
            notifyFocus()
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

/** Always-visible URL + upload controls for Video single (`video_embed`). */
function VideoEmbedSourceEditor({
  blockId,
  siteId,
  videoUrl,
  onPreview,
  onCommit,
}: {
  blockId: string
  siteId: string
  videoUrl: string
  onPreview: (url: string) => void
  onCommit: (url: string) => void
}) {
  const [localVal, setLocalVal] = useState(videoUrl)
  const isEditingRef = useRef(false)

  useEffect(() => {
    if (isEditingRef.current) return
    setLocalVal(videoUrl)
  }, [blockId, videoUrl])

  return (
    <div className="rounded-xl border border-border bg-card p-2.5 space-y-2">
      <p className="text-[11px] font-semibold text-foreground">Video</p>
      <p className="text-[10px] text-muted-foreground leading-snug">
        Paste a YouTube, Vimeo, or Instagram post/reel link, or upload a file below.
      </p>
      <div className="space-y-1">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Video URL</label>
        <input
          type="text"
          value={localVal}
          onChange={e => {
            isEditingRef.current = true
            setLocalVal(e.target.value)
            onPreview(e.target.value)
          }}
          onFocus={() => { isEditingRef.current = true }}
          onBlur={() => {
            isEditingRef.current = false
            onCommit(localVal)
          }}
          placeholder="YouTube / Vimeo / Instagram link"
          className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <InlineVideoPicker
        siteId={siteId}
        value={videoUrl}
        onChange={url => {
          setLocalVal(url)
          isEditingRef.current = false
          onPreview(url)
          onCommit(url)
        }}
      />
    </div>
  )
}

/** Upload / pick a video file from the device or media library (for the Video Embed block). */
function InlineVideoPicker({
  siteId, value, onChange,
}: {
  siteId: string
  value: string
  onChange: (url: string) => void
}) {
  const { data: mediaList = [] } = useMedia(siteId)
  const uploadMedia = useUploadMedia(siteId)
  const [showLibrary, setShowLibrary] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoMedia = mediaList.filter(m => m.file_type === 'video')
  const isDirect = value ? isDirectVideoFile(value) : false

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const saved = await uploadMedia.mutateAsync(file)
      onChange(saved.original_url)
      setShowLibrary(false)
      toast.success('Video uploaded!')
    } catch {
      toast.error('Upload failed — use MP4, WebM or MOV up to 50 MB')
    }
    e.target.value = ''
  }

  const actionBtn = 'flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-[11px] font-bold transition-colors'

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/*" className="hidden" onChange={handleUpload} />

      {isDirect && (
        <div className="relative overflow-hidden rounded-xl border-2 border-primary/30 bg-black">
          <video src={mediaUrl(value)} className="h-28 w-full bg-black object-contain" controls preload="metadata" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploadMedia.isPending}
          className={cn(actionBtn, 'border-primary/30 text-primary bg-accent/40 hover:bg-accent')}
        >
          {uploadMedia.isPending
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Upload className="w-3.5 h-3.5" />}
          Upload from device
        </button>
        <button
          type="button"
          onClick={() => setShowLibrary(v => !v)}
          className={cn(actionBtn, showLibrary ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}
        >
          <Video className="w-3.5 h-3.5" />
          Library
        </button>
      </div>

      {isDirect && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="text-xs font-semibold text-red-500 hover:text-red-700"
        >
          Remove uploaded video
        </button>
      )}

      {showLibrary && (
        <div className="rounded-xl border border-gray-200 bg-white p-2 space-y-2">
          {videoMedia.length === 0 ? (
            <p className="py-3 text-center text-xs text-gray-400">No uploaded videos yet — use Upload from device above.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
              {videoMedia.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { onChange(m.original_url); setShowLibrary(false); toast.success('Video selected') }}
                  className={cn(
                    'overflow-hidden rounded-lg border-2 bg-black transition-all',
                    value === m.original_url ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-primary',
                  )}
                  title={m.filename}
                >
                  <video src={mediaUrl(m.original_url)} className="h-16 w-full object-contain" preload="metadata" muted />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground leading-snug">
        Upload an MP4, WebM or MOV (max 50 MB), or paste a YouTube, Vimeo, or Instagram link above.
      </p>
    </div>
  )
}

// ?? Generic text-list editor (add / edit / delete each row) ???????????????????

function TextListEditor({
  items, placeholder, addLabel = 'Add item', onChange,
}: {
  items: string[]
  placeholder?: string
  addLabel?: string
  onChange: (items: string[]) => void
}) {
  return (
    <div className="space-y-1.5">
      {items.map((text, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            type="text"
            value={text}
            placeholder={placeholder}
            onChange={e => {
              const next = [...items]
              next[i] = e.target.value
              onChange(next)
            }}
            className="flex-1 min-w-0 px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors shrink-0"
            title="Delete"
          ><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="flex items-center gap-1 text-xs text-primary hover:text-primary font-semibold"
      >
        <Plus className="w-3 h-3" /> {addLabel}
      </button>
    </div>
  )
}

const PERK_ICON_OPTIONS = [
  { id: 'clock', label: 'Clock' },
  { id: 'video', label: 'Video' },
  { id: 'award', label: 'Award' },
  { id: 'users', label: 'Users' },
]

function PerkListEditor({
  items, onChange,
}: {
  items: { icon?: string; text: string }[]
  onChange: (items: { icon?: string; text: string }[]) => void
}) {
  return (
    <div className="space-y-2">
      {items.map((perk, i) => (
        <div key={i} className="flex items-center gap-1.5 rounded-lg border border-gray-100 bg-white p-2">
          <Select
            value={perk.icon ?? 'clock'}
            onChange={v => {
              const next = [...items]
              next[i] = { ...next[i], icon: v }
              onChange(next)
            }}
            options={PERK_ICON_OPTIONS.map(opt => ({ value: opt.id, label: opt.label }))}
            wrapperClassName="shrink-0"
            className="px-1.5 py-2 border border-gray-200 rounded-lg text-xs bg-white"
          />
          <input
            type="text"
            value={perk.text}
            placeholder="Certificate of completion"
            onChange={e => {
              const next = [...items]
              next[i] = { ...next[i], text: e.target.value }
              onChange(next)
            }}
            className="flex-1 min-w-0 px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors shrink-0"
            title="Delete"
          ><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { icon: 'clock', text: '' }])}
        className="flex items-center gap-1 text-xs text-primary hover:text-primary font-semibold"
      >
        <Plus className="w-3 h-3" /> Add item
      </button>
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
  onArrayItemImageFocus,
  onEditPropLink,
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
  onArrayItemImageFocus?: (index: number, itemField: string, arrayKey: string) => void
  onEditPropLink?: (propKey: string, anchor: { x: number; y: number }) => void
  /** Split layout vs item list across ribbon tabs */
  sections?: 'all' | 'layout' | 'items'
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  const imageField = schema.fields.find(f => f.type === 'image')

  const notifyItemImageFocus = (idx: number) => {
    if (!onArrayItemImageFocus || !imageField) return
    onArrayItemImageFocus(idx, imageField.key, schema.arrayKey)
  }

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
      <div className="space-y-2">
        <PanelGroupEyebrow>Layout & spacing</PanelGroupEyebrow>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <PanelFieldLabel>Columns</PanelFieldLabel>
            <span className="text-[11px] font-bold tabular-nums text-primary">{columns}</span>
          </div>
          <PanelChipWrap>
            {[1, 2, 3, 4, 5, 6].map(n => (
              <PanelChip key={n} active={columns === n} onClick={() => onColumnsChange(n)}>
                {n}
              </PanelChip>
            ))}
          </PanelChipWrap>
        </div>

        <PanelSliderRow
          label="Gap between items"
          value={gap}
          min={0}
          max={80}
          step={4}
          unit="px"
          onCommit={onGapChange}
        />

        <PanelSliderRow
          label="Card size"
          value={itemSize}
          min={80}
          max={480}
          step={8}
          unit="px"
          onCommit={onItemSizeChange}
        />
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
          const title = item.question || item.label || item.name || item.title || item.q || item.value || item.quote || item.desc
            || (item.method ? paymentMethodLabel(String(item.method)) : '')
            || `${schema.itemLabel} ${idx + 1}`
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
                  const willExpand = !n.has(idx)
                  if (willExpand) {
                    n.add(idx)
                    notifyItemImageFocus(idx)
                  } else {
                    n.delete(idx)
                  }
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
                    className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete"
                  ><Trash2 className="w-3.5 h-3.5" /></button>
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
                        onFocus={() => notifyItemImageFocus(idx)}
                        onChange={readOnly ? () => {} : url => updateItem(idx, { [field.key]: url })}
                      />
                    )
                    if (field.type === 'video') return (
                      <div key={field.key} className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{field.label}</label>
                        <input
                          type="text"
                          value={item[field.key] || ''}
                          readOnly={readOnly}
                          onChange={e => !readOnly && updateItem(idx, { [field.key]: e.target.value })}
                          placeholder="YouTube / Vimeo / Instagram link"
                          className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        {!readOnly && (
                          <InlineVideoPicker
                            siteId={siteId}
                            value={item[field.key] || ''}
                            onChange={url => updateItem(idx, { [field.key]: url })}
                          />
                        )}
                      </div>
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
                    if (field.type === 'select') {
                      const opts = field.options || []
                      const useDropdown = opts.length > 4
                      return (
                      <div key={field.key} className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{field.label}</label>
                        {useDropdown ? (
                          <Select
                            value={String(item[field.key] ?? opts[0] ?? '')}
                            disabled={readOnly}
                            onChange={v => !readOnly && updateItem(idx, { [field.key]: v })}
                            options={opts.map(opt => ({ value: opt, label: field.optionLabels?.[opt] ?? opt }))}
                            className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        ) : (
                        <div className="flex gap-1 flex-wrap">
                          {opts.map(opt => (
                            <button key={opt}
                              disabled={readOnly}
                              onClick={() => !readOnly && updateItem(idx, { [field.key]: Number(opt) || opt })}
                              className={cn('flex-1 min-w-[2.5rem] py-1 px-2 rounded border text-xs font-bold transition-colors',
                                String(item[field.key]) === opt ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40')}
                            >{field.optionLabels?.[opt] ?? opt}</button>
                          ))}
                        </div>
                        )}
                      </div>
                      )
                    }
                    if (field.type === 'emoji') return (
                      <div key={field.key} className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{field.label}</label>
                        <div className="flex gap-1.5 flex-wrap">
                          {['✨','⚡','🚀','🎯','💡','🛡️','🔥','💎','🌟','🎨','🔧','📱','🌍','❤️','🏆'].map(e => (
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
                    const isLinkField = (field.key === 'url' || field.key === 'cta_url' || field.key === 'href') && onEditPropLink
                    return (
                      <div key={field.key} className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">{field.label}</label>
                        <div className={isLinkField ? 'flex items-center gap-1' : undefined}>
                          <input
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={item[field.key] || ''}
                            readOnly={readOnly}
                            onChange={e => !readOnly && updateItem(idx, { [field.key]: e.target.value })}
                            placeholder={isLinkField ? '/page or https://...' : undefined}
                            className={cn(
                              'px-2.5 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-ring',
                              isLinkField ? 'flex-1 min-w-0 font-mono' : 'w-full',
                            )}
                          />
                          {isLinkField && !readOnly && (
                            <button
                              type="button"
                              title={item[field.key] ? `Linked: ${item[field.key]}` : 'Insert link'}
                              onClick={e => {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                onEditPropLink(`${schema.arrayKey}.${idx}.${field.key}`, { x: rect.left, y: rect.bottom + 6 })
                              }}
                              className={cn(
                                'shrink-0 p-2 rounded-lg border transition-colors',
                                item[field.key]
                                  ? 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                                  : 'text-primary border-primary/30 hover:bg-accent',
                              )}
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
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
  defaultOpen,
  headerActions,
  children,
}: {
  title: string
  preview?: string
  accent?: boolean
  defaultOpen?: boolean
  headerActions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        'group transition-colors',
        accent
          ? 'rounded-lg border border-primary/30 bg-primary/5 shadow-sm overflow-hidden'
          : builderPanelUi.collapsible,
      )}
    >
      <summary
        className={cn(
          'list-none cursor-pointer flex items-center gap-2 px-2.5 py-2 transition-colors [&::-webkit-details-marker]:hidden',
          accent ? 'hover:bg-primary/10' : builderPanelUi.collapsibleSummary,
        )}
      >
        <span
          className={cn(
            'text-xs font-semibold shrink-0',
            accent ? 'text-primary' : builderPanelUi.collapsibleTitle,
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
                ? 'bg-muted/50 text-muted-foreground/60 italic'
                : accent
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {preview}
          </span>
        )}
        {headerActions}
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 shrink-0 transition-transform group-open:rotate-180',
            accent ? 'text-primary' : 'text-gray-400',
          )}
        />
      </summary>
      <div className={builderPanelUi.collapsibleBody}>
        {children}
      </div>
    </details>
  )
}

/** Single-open accordion row — expanded body has no max-height or inner scroll. */
function PropsAccordionSection({
  id,
  activeId,
  onActivate,
  title,
  preview,
  children,
}: {
  id: string
  activeId: string | null
  onActivate: (id: string) => void
  title: string
  preview?: string
  children: React.ReactNode
}) {
  const open = activeId === id
  return (
    <div
      className={cn(
        builderPanelUi.collapsible,
        'shrink-0 transition-colors',
        open && 'border-primary/25 ring-1 ring-primary/10',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onActivate(id)}
        className={cn(
          'flex w-full items-center gap-1.5 px-2.5 py-2 text-left transition-colors',
          builderPanelUi.collapsibleSummary,
          open && 'bg-muted/35',
        )}
      >
        <span className={cn(builderPanelUi.collapsibleTitle, 'shrink-0 text-[11px]')}>{title}</span>
        <div className="min-w-0 flex-1" />
        {preview ? (
          <span className="max-w-[50%] shrink-0 truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {preview}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180 text-primary',
          )}
        />
      </button>
      {open ? (
        <div className={builderPanelUi.accordionBody}>
          {children}
        </div>
      ) : null}
    </div>
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
  rows?: number
  mono?: boolean
  linkTarget?: string
  onCommit: (val: string) => void
  onPreview: (val: string) => void
  onLink?: (anchor: { x: number; y: number }) => void
  onDelete?: () => void
}

function PropsInputRow({
  blockId, fieldKey, label, serverValue, multiline, placeholder, rows, mono,
  linkTarget, onCommit, onPreview, onLink, onDelete,
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

  const deleteAction = onDelete ? (
    <button
      type="button"
      onClick={e => {
        e.preventDefault()
        e.stopPropagation()
        onDelete()
      }}
      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-100 transition-colors shrink-0"
      title={`Remove ${label} from this section`}
    >
      <Trash2 className="h-3 w-3" />
    </button>
  ) : null

  return (
    <PropsCollapsible title={label} preview={preview} headerActions={deleteAction}>
      {onLink && (
        <div className="flex items-center gap-1.5 justify-end">
          <button
            type="button"
            onMouseDown={e => {
              e.preventDefault()
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              onLink({ x: rect.left, y: rect.bottom + 6 })
            }}
            className={builderLinkBtn(!!linkTarget, 'sm')}
            title={linkTarget ? `Linked to ${linkTarget}` : 'Insert link'}
          >
            <span className={builderLinkBtnIcon(!!linkTarget, 'sm')}>
              <Link2 className="h-2.5 w-2.5" />
            </span>
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
          rows={rows ?? 3}
          className={cn(inputClass, 'resize-y min-h-[72px]', mono && 'font-mono text-[11px] leading-snug')}
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
  previewDevice,
  onPreviewDeviceChange,
}: {
  styleOverrides: BreakpointStyleOverrides
  onChange: (overrides: BreakpointStyleOverrides) => void
  previewDevice?: DeviceMode
  onPreviewDeviceChange?: (device: DeviceMode) => void
}) {
  const bp = (previewDevice ?? 'desktop') as Breakpoint
  const setBp = (next: Breakpoint) => {
    onPreviewDeviceChange?.(next)
  }

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
              {b === 'desktop' ? 'Desktop' : b === 'tablet' ? 'Tablet' : 'Mobile'}
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
            <BuilderStepSlider
              className="flex-1"
              value={(bpStyle[key] as number) ?? 0}
              min={min!}
              max={max!}
              step={step!}
              onChange={v => updateBpProp(key, v)}
              sliderClassName="h-1"
            />
          )}
          {type === 'select' && (
            <Select
              value={(bpStyle[key] as string) || 'base'}
              onChange={v => updateBpProp(key, v)}
              options={options!.map(o => ({ value: o, label: o }))}
              wrapperClassName="flex-1"
              className="text-xs border border-gray-200 rounded px-1.5 py-1"
            />
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
  onSelectLayoutIndex,
  compact = false,
  embedded = false,
}: {
  block: WebsiteBlock
  currentProps: Record<string, unknown>
  onOpenLayoutPicker: () => void
  onCycleLayout: (direction: 'prev' | 'next') => void
  onSelectLayoutIndex?: (index: number) => void
  compact?: boolean
  embedded?: boolean
}) {
  const layoutOptions = getSectionLayoutOptions(block.block_type)
  if (layoutOptions.length === 0) return null

  const activeLayout = findActiveSectionLayoutOption(currentProps, layoutOptions)
    ?? findBestSectionLayoutOption(currentProps, layoutOptions)
    ?? layoutOptions[findActiveLayoutIndex(currentProps, block.block_type)]
  const activeIdx = findActiveLayoutIndex(currentProps, block.block_type)
  const canCycle = layoutOptions.length > 1

  if (compact) {
    const compactBtn =
      'p-0.5 text-gray-400/90 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
    return (
      <div className="inline-flex shrink-0 items-center overflow-hidden rounded-md border border-white/10 bg-gray-800/60">
        <button
          type="button"
          disabled={!canCycle}
          onClick={e => { e.stopPropagation(); onCycleLayout('prev') }}
          title="Previous style ? same section, different look (does not move it on the page)"
          className={compactBtn}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onOpenLayoutPicker() }}
          title={`Change section style ? ${activeLayout?.label || 'Current'} (not page position)`}
          className={cn(compactBtn, 'border-x border-white/10 px-0.5 text-gray-300')}
        >
          <Layout className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          disabled={!canCycle}
          onClick={e => { e.stopPropagation(); onCycleLayout('next') }}
          title="Next style ? same section, different look (does not move it on the page)"
          className={compactBtn}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  if (embedded) {
    const sectionName = catalogBlockLabel(block)
    return (
      <div className="@container space-y-2">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <div className={builderPanelUi.eyebrow}>{sectionName}</div>
            <p className="mt-1 truncate text-[11px] font-semibold leading-tight text-foreground">
              {activeLayout?.label || 'Default layout'}
            </p>
            {activeLayout?.desc ? (
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                {activeLayout.desc}
              </p>
            ) : null}
          </div>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-muted-foreground">
            {activeIdx + 1}/{layoutOptions.length}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            disabled={!canCycle}
            onClick={() => onCycleLayout('prev')}
            title="Previous style"
            aria-label="Previous style"
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors',
              canCycle
                ? 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary'
                : 'cursor-not-allowed border-border/50 bg-muted/30 text-muted-foreground/35',
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onOpenLayoutPicker}
            title={`Browse all ${layoutOptions.length} styles`}
            className="h-7 min-w-0 flex-1 truncate rounded-md bg-primary px-2 text-[10px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Change style
          </button>
          <button
            type="button"
            disabled={!canCycle}
            onClick={() => onCycleLayout('next')}
            title="Next style"
            aria-label="Next style"
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors',
              canCycle
                ? 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary'
                : 'cursor-not-allowed border-border/50 bg-muted/30 text-muted-foreground/35',
            )}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        {layoutOptions.length > 1 ? (
          <div className="flex flex-wrap gap-1">
            {layoutOptions.map((opt, idx) => {
              const active = idx === activeIdx
              return (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.desc || opt.label}
                  onClick={() => {
                    if (active) return
                    if (onSelectLayoutIndex) onSelectLayoutIndex(idx)
                    else onCycleLayout(idx > activeIdx ? 'next' : 'prev')
                  }}
                  className={cn(
                    'max-w-full truncate rounded border px-1.5 py-0.5 text-[9px] font-semibold leading-tight transition-colors',
                    active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/35 hover:text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn(builderPanelUi.cardSurface, 'p-3 space-y-3')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={builderPanelUi.eyebrow}>
            {block.label || block.block_type}
          </div>
          <div className="text-sm font-semibold text-foreground truncate mt-1">
            {activeLayout?.label || 'Default layout'}
          </div>
          {activeLayout?.desc && (
            <p className={cn(builderPanelUi.hint, 'mt-1')}>{activeLayout.desc}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground tabular-nums">
          {activeIdx + 1}/{layoutOptions.length}
        </span>
      </div>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          disabled={!canCycle}
          onClick={() => onCycleLayout('prev')}
          title="Previous style"
          className={cn(
            'shrink-0 flex items-center justify-center w-9 rounded-lg border transition-colors',
            canCycle
              ? 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-muted/40'
              : 'border-border/60 bg-muted/30 text-muted-foreground/40 cursor-not-allowed',
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onOpenLayoutPicker}
          className="flex-1 min-w-0 py-2.5 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm"
        >
          Change style
        </button>
        <button
          type="button"
          disabled={!canCycle}
          onClick={() => onCycleLayout('next')}
          title="Next style"
          className={cn(
            'shrink-0 flex items-center justify-center w-9 rounded-lg border transition-colors',
            canCycle
              ? 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-muted/40'
              : 'border-border/60 bg-muted/30 text-muted-foreground/40 cursor-not-allowed',
          )}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <p className={builderPanelUi.hint}>
        Swaps the section look on the canvas. Use <span className="font-semibold text-foreground/80">Move ↑↓</span> on the toolbar to reorder sections.
        {layoutOptions.length > 1 ? ` ${layoutOptions.length} styles available.` : ''}
      </p>
    </div>
  )
}

function SectionSpacingField({
  label,
  value,
  min,
  max,
  step,
  unit,
  hint,
  onPreview,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  hint?: string
  onPreview: (n: number) => void
  onCommit: (n: number) => void
}) {
  return (
    <PanelSliderRow
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      unit={unit}
      hint={hint}
      onPreview={onPreview}
      onCommit={onCommit}
    />
  )
}

function SectionSpacingBreakpointTabs({
  active,
  onChange,
}: {
  active: DeviceMode
  onChange: (bp: DeviceMode) => void
}) {
  const tabs: { id: DeviceMode; label: string; Icon: typeof Monitor }[] = [
    { id: 'desktop', label: 'Desktop', Icon: Monitor },
    { id: 'tablet', label: 'Tablet', Icon: Tablet },
    { id: 'mobile', label: 'Phone', Icon: Smartphone },
  ]
  return (
    <div className="flex rounded-md border border-border/50 bg-muted/20 p-0.5">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          title={`Edit spacing for ${label}`}
          onClick={() => onChange(id)}
          className={cn(
            'flex min-w-0 flex-1 items-center justify-center gap-1 rounded px-1.5 py-1 text-[10px] font-semibold transition-colors',
            active === id ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted/60',
          )}
        >
          <Icon className="h-3 w-3 shrink-0" />
          <span className="hidden truncate @[220px]:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}

function isoToDatetimeLocal(iso: string | undefined | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function datetimeLocalToIso(value: string): string {
  if (!value.trim()) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

function formatCountdownEndLabel(iso: string | undefined | null): string {
  if (!iso) return 'Not set'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Invalid date'
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function PropsEditor({
  block, onUpdate, onPreview, siteId, pages, onAddPage, onEditPropLink, themeColors,
  onOpenLayoutPicker, onCycleLayout, onSelectLayoutIndex, onArrayItemImageFocus,
  previewDevice, onPreviewDeviceChange,
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
  onSelectLayoutIndex?: (index: number) => void
  onArrayItemImageFocus?: (arrayKey: string, index: number, itemField: string) => void
  previewDevice: DeviceMode
  onPreviewDeviceChange?: (device: DeviceMode) => void
}) {
  const navigate = useNavigate()
  const vendor = useVendorStore(s => s.vendor)
  const canEditPoweredBy = canEditPoweredByOption(useAuthStore(s => s.user?.email))
  const p = block.props
  const showTileColors = TILE_COLOR_BLOCK_TYPES.has(block.block_type)
  const mapDefaultCenter =
    vendor?.latitude != null && vendor?.longitude != null
      ? { lat: vendor.latitude, lng: vendor.longitude }
      : undefined
  const isMapLocationBlock = block.block_type === 'map_embed' || block.block_type === 'map_contact'
  const tileSwatchDefaults = {
    tile_bg: themeColors.surface_color || themeColors.bg_color || '#ffffff',
    tile_accent: themeColors.primary_color,
    tile_text: themeColors.text_color,
    tile_border: `${themeColors.primary_color}33`,
  }

  // Spacing sliders — effective values follow canvas device preview (desktop / tablet / phone).
  const spacingBp = previewDevice
  const effectiveSectionSpacing = resolveBlockSectionSpacing(block, spacingBp)
  const [paddingTop, setPaddingTop] = useState<number>(effectiveSectionSpacing.paddingTop)
  const [paddingBottom, setPaddingBottom] = useState<number>(effectiveSectionSpacing.paddingBottom)
  const [sectionScale, setSectionScale] = useState<number>(effectiveSectionSpacing.sectionScale)

  const pushSectionSpacing = (
    patch: { padding_top?: number; padding_bottom?: number; section_scale?: number },
    preview: boolean,
  ) => {
    const merged = patchBreakpointSectionSpacing(block, spacingBp, patch)
    const payload = {
      ...merged.props,
      style_overrides: merged.style_overrides,
    } as Partial<BlockProps>
    if (preview) onPreview(payload)
    else onUpdate(payload)
  }

  // Sync spacing when block or preview device changes
  useEffect(() => {
    const eff = resolveBlockSectionSpacing(block, spacingBp)
    setPaddingTop(eff.paddingTop)
    setPaddingBottom(eff.paddingBottom)
    setSectionScale(eff.sectionScale)
  }, [block.id, block.props, block.style_overrides, spacingBp])

  const itemSchema = ITEM_SCHEMAS[block.block_type]
    ?? (ITEM_SCHEMA_ALIASES[block.block_type] ? ITEM_SCHEMAS[ITEM_SCHEMA_ALIASES[block.block_type]!] : undefined)
    ?? (['stats', 'counters', 'impact_stats'].includes(block.block_type) ? ITEM_SCHEMAS.stats : undefined)
  const defaultItemGap = block.block_type === 'marquee_strip' ? 40 : 24
  const [subColumns, setSubColumns] = useState<number>((p as any).columns ?? itemSchema?.fields.length ?? 3)
  const [subGap, setSubGap] = useState<number>((p as any).item_gap ?? defaultItemGap)
  const [subItemSize, setSubItemSize] = useState<number>((p as any).item_size ?? 160)
  const isCatalogGridBlock = CATALOG_GRID_BLOCK_TYPES.has(block.block_type)
  const [teamLiveItems, setTeamLiveItems] = useState<LiveItem[]>([])

  useEffect(() => {
    setSubColumns((p as any).columns ?? itemSchema?.fields.length ?? 3)
    setSubGap((p as any).item_gap ?? defaultItemGap)
    setSubItemSize((p as any).item_size ?? 160)
  }, [block.id, block.block_type, (p as any).columns, (p as any).item_gap, (p as any).item_size, itemSchema?.fields.length, defaultItemGap])

  const isTeamBlock = block.block_type === 'team_grid' || block.block_type === 'team_list'
  const isBlogBlock = block.block_type === 'blog_grid' || block.block_type === 'blog_featured' || block.block_type === 'blog_list'
  const isProductBlock = isProductSyncedBlock(block.block_type)
  const isCategoryBlock = isCategorySyncedBlock(block.block_type)
  const isPlansBlock = isPlansSyncedBlock(block.block_type)
  const isPropertiesBlock = isPropertiesSyncedBlock(block.block_type)
  const isPropertyDetailBlock = block.block_type === 'vertical.propertyDetail'
  const isCoursesBlock = isCoursesSyncedBlock(block.block_type)
  const isCourseDetailBlock = block.block_type === 'vertical.courseDetail'
  const isFitnessBlock = isFitnessSyncedBlock(block.block_type)
  const isVehiclesBlock = isVehiclesSyncedBlock(block.block_type)
  const isVehicleDetailBlock = block.block_type === 'vertical.vehicleDetail'
  const isEventsBlock = isEventsSyncedBlock(block.block_type)
  const isEventListingBlock = block.block_type === 'vertical.eventListing'
  const isRecurringBlock = isRecurringSyncedBlock(block.block_type)
  const isTestimonialsBlock = isTestimonialsSyncedBlock(block.block_type)
  const isWizardBlock = isWizardSyncedBlock(block.block_type)
  const isResourceBlock = isResourceSyncedBlock(block.block_type)
  const [blogLiveItems, setBlogLiveItems] = useState<LiveItem[]>([])
  const [productLiveItems, setProductLiveItems] = useState<LiveItem[]>([])
  const [categoryLiveItems, setCategoryLiveItems] = useState<LiveItem[]>([])
  const [plansLiveItems, setPlansLiveItems] = useState<LiveItem[]>([])
  const [propertiesLiveItems, setPropertiesLiveItems] = useState<LiveItem[]>([])
  const [coursesLiveItems, setCoursesLiveItems] = useState<LiveItem[]>([])
  const [fitnessLiveItems, setFitnessLiveItems] = useState<LiveItem[]>([])
  const [vehiclesLiveItems, setVehiclesLiveItems] = useState<LiveItem[]>([])
  const [eventsLiveItems, setEventsLiveItems] = useState<LiveItem[]>([])
  const [recurringLiveItems, setRecurringLiveItems] = useState<LiveItem[]>([])
  const [testimonialsLiveItems, setTestimonialsLiveItems] = useState<LiveItem[]>([])
  const [wizardLiveItems, setWizardLiveItems] = useState<LiveItem[]>([])
  const [resourceLiveItems, setResourceLiveItems] = useState<LiveItem[]>([])

  useEffect(() => {
    if (!isBlogBlock) return
    const dsType = (p as Record<string, unknown>).data_source as { type?: string } | undefined
    if (!dsType || dsType.type === 'pages') {
      onUpdate({ data_source: { type: 'blog', auto: true } } as Partial<BlockProps>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate legacy blog blocks once per selection
  }, [block.id, block.block_type, isBlogBlock])

  useEffect(() => {
    if (!isProductBlock) return
    const dsType = (p as Record<string, unknown>).data_source as { type?: string } | undefined
    if (!dsType || dsType.type !== 'products') {
      onUpdate({ data_source: { type: 'products', auto: true } } as Partial<BlockProps>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate legacy product blocks once per selection
  }, [block.id, block.block_type, isProductBlock])

  useEffect(() => {
    if (!isCategoryBlock) return
    const raw = p as Record<string, unknown>
    const dsType = raw.data_source as { type?: string } | undefined
    const patch: Record<string, unknown> = {}
    if (!dsType || dsType.type !== 'categories') {
      patch.data_source = { type: 'categories', auto: true }
      // Drop template placeholder tiles — only live Categories app entries should render.
      if (Array.isArray(raw.categories) && raw.categories.length > 0) {
        patch.categories = []
      }
    }
    if (block.block_type === 'product.categories') {
      const variant = String(raw.variant ?? '')
      const layout = String(raw.layout ?? '')
      if (variant === 'default' || !layout) {
        patch.variant = 'grid'
        patch.layout = 'grid'
        patch.columns = Number(raw.columns) || 4
      }
    }
    if (Object.keys(patch).length > 0) {
      onUpdate(patch as Partial<BlockProps>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate legacy category blocks once per selection
  }, [block.id, block.block_type, isCategoryBlock])

  useEffect(() => {
    if (!isPlansBlock) return
    const dsType = (p as Record<string, unknown>).data_source as { type?: string } | undefined
    if (!dsType || dsType.type !== 'plans') {
      onUpdate({ data_source: { type: 'plans', auto: true } } as Partial<BlockProps>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate legacy pricing blocks once per selection
  }, [block.id, block.block_type, isPlansBlock])

  useEffect(() => {
    if (!isPropertiesBlock) return
    const dsType = (p as Record<string, unknown>).data_source as { type?: string } | undefined
    if (!dsType || dsType.type !== 'properties') {
      onUpdate({ data_source: { type: 'properties', auto: true } } as Partial<BlockProps>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate legacy property listing blocks once per selection
  }, [block.id, block.block_type, isPropertiesBlock])

  useEffect(() => {
    if (!isCoursesBlock) return
    const dsType = (p as Record<string, unknown>).data_source as { type?: string } | undefined
    if (!dsType || dsType.type !== 'courses') {
      onUpdate({ data_source: { type: 'courses', auto: true } } as Partial<BlockProps>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate legacy course catalog blocks once per selection
  }, [block.id, block.block_type, isCoursesBlock])

  useEffect(() => {
    if (!isFitnessBlock) return
    const dsType = (p as Record<string, unknown>).data_source as { type?: string } | undefined
    if (!dsType || dsType.type !== 'fitness_classes') {
      onUpdate({ data_source: { type: 'fitness_classes', auto: true } } as Partial<BlockProps>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate legacy fitness schedule blocks once per selection
  }, [block.id, block.block_type, isFitnessBlock])

  useEffect(() => {
    if (!isVehiclesBlock) return
    const dsType = (p as Record<string, unknown>).data_source as { type?: string } | undefined
    if (!dsType || dsType.type !== 'vehicles') {
      onUpdate({ data_source: { type: 'vehicles', auto: true } } as Partial<BlockProps>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate legacy auto inventory blocks once per selection
  }, [block.id, block.block_type, isVehiclesBlock])

  useEffect(() => {
    if (!isRecurringBlock) return
    const dsType = (p as Record<string, unknown>).data_source as { type?: string } | undefined
    // Repairs blocks created before 'booking.recurring' had a dedicated auto-source entry, which
    // fell back to the generic 'bookings' resource and never showed the synced plans.
    if (!dsType || dsType.type !== 'recurring_plans') {
      onUpdate({ data_source: { type: 'recurring_plans', auto: true } } as Partial<BlockProps>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate legacy recurring booking blocks once per selection
  }, [block.id, block.block_type, isRecurringBlock])

  useEffect(() => {
    if (!isTestimonialsBlock) return
    const dsType = (p as Record<string, unknown>).data_source as { type?: string } | undefined
    // testimonials/testimonials_grid always sync — Sales → Testimonials, falling back to verified
    // reviews server-side — so legacy blocks without (or with a stale) data_source get connected too.
    if (!dsType || dsType.type !== 'testimonials') {
      onUpdate({ data_source: { type: 'testimonials', auto: true } } as Partial<BlockProps>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate legacy testimonials blocks once per selection
  }, [block.id, block.block_type, isTestimonialsBlock])

  useEffect(() => {
    if (!isWizardBlock) return
    const dsType = (p as Record<string, unknown>).data_source as { type?: string } | undefined
    // Repairs blocks created before 'booking.wizard' had a dedicated auto-source entry, which
    // fell back to the generic 'bookings' resource and never showed the synced steps.
    if (!dsType || dsType.type !== 'booking_wizard_steps') {
      onUpdate({ data_source: { type: 'booking_wizard_steps', auto: true } } as Partial<BlockProps>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate legacy booking wizard blocks once per selection
  }, [block.id, block.block_type, isWizardBlock])

  useEffect(() => {
    if (!isResourceBlock) return
    const dsType = (p as Record<string, unknown>).data_source as { type?: string } | undefined
    // Repairs blocks created before 'booking.resource' had a dedicated auto-source entry, which
    // fell back to the generic 'bookings' resource and never showed the synced resources.
    if (!dsType || dsType.type !== 'booking_resources') {
      onUpdate({ data_source: { type: 'booking_resources', auto: true } } as Partial<BlockProps>)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- migrate legacy resource picker blocks once per selection
  }, [block.id, block.block_type, isResourceBlock])

  useEffect(() => {
    if (!isTeamBlock || !siteId) {
      setTeamLiveItems([])
      return
    }
    void websiteApi.getLive(siteId, 'team', { limit: 50 })
      .then(r => setTeamLiveItems(r.items ?? []))
      .catch(() => setTeamLiveItems([]))
  }, [isTeamBlock, siteId, block.id, (p as any).data_source])

  useEffect(() => {
    if (!isBlogBlock || !siteId) {
      setBlogLiveItems([])
      return
    }
    void websiteApi.getLive(siteId, 'blog', { limit: 50 })
      .then(r => setBlogLiveItems(r.items ?? []))
      .catch(() => setBlogLiveItems([]))
  }, [isBlogBlock, siteId, block.id])

  useEffect(() => {
    if (!isProductBlock || !siteId) {
      setProductLiveItems([])
      return
    }
    void websiteApi.getLive(siteId, 'products', { limit: 50 })
      .then(r => setProductLiveItems(r.items ?? []))
      .catch(() => setProductLiveItems([]))
  }, [isProductBlock, siteId, block.id])

  useEffect(() => {
    if (!isCategoryBlock || !siteId) {
      setCategoryLiveItems([])
      return
    }
    void websiteApi.getLive(siteId, 'categories', { limit: 50 })
      .then(r => setCategoryLiveItems(r.items ?? []))
      .catch(() => setCategoryLiveItems([]))
  }, [isCategoryBlock, siteId, block.id])

  useEffect(() => {
    if (!isPlansBlock || !siteId) {
      setPlansLiveItems([])
      return
    }
    void websiteApi.getLive(siteId, 'plans', { limit: 50 })
      .then(r => setPlansLiveItems(r.items ?? []))
      .catch(() => setPlansLiveItems([]))
  }, [isPlansBlock, siteId, block.id])

  useEffect(() => {
    if (!(isPropertiesBlock || isPropertyDetailBlock) || !siteId) {
      setPropertiesLiveItems([])
      return
    }
    void websiteApi.getLive(siteId, 'properties', { limit: 50 })
      .then(r => setPropertiesLiveItems(r.items ?? []))
      .catch(() => setPropertiesLiveItems([]))
  }, [isPropertiesBlock, isPropertyDetailBlock, siteId, block.id])

  useEffect(() => {
    if (!isPropertyDetailBlock || !propertiesLiveItems.length) return
    const currentId = String((p as any).propertyId ?? '')
    const activeItems = propertiesLiveItems.filter(item => item.meta?.is_active !== false)
    const current = propertiesLiveItems.find(item => item.id === currentId)
    // Hidden listings never render on the storefront/preview — steer selection to an active one.
    if (current && current.meta?.is_active !== false) return
    const fallback = activeItems[0] ?? propertiesLiveItems[0]
    if (fallback && fallback.id !== currentId) onUpdate({ propertyId: fallback.id } as any)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- default to first active listing once loaded
  }, [isPropertyDetailBlock, propertiesLiveItems, block.id])

  useEffect(() => {
    if (!(isCoursesBlock || isCourseDetailBlock) || !siteId) {
      setCoursesLiveItems([])
      return
    }
    void websiteApi.getLive(siteId, 'courses', { limit: 50 })
      .then(r => setCoursesLiveItems(r.items ?? []))
      .catch(() => setCoursesLiveItems([]))
  }, [isCoursesBlock, isCourseDetailBlock, siteId, block.id])

  useEffect(() => {
    if (!isCourseDetailBlock || !coursesLiveItems.length) return
    const currentId = String((p as any).courseId ?? '')
    const activeItems = coursesLiveItems.filter(item => item.meta?.is_active !== false)
    const current = coursesLiveItems.find(item => item.id === currentId)
    // Hidden courses never render on the storefront/preview — steer selection to an active one.
    if (current && current.meta?.is_active !== false) return
    const fallback = activeItems[0] ?? coursesLiveItems[0]
    if (fallback && fallback.id !== currentId) onUpdate({ courseId: fallback.id } as any)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- default to first active course once loaded
  }, [isCourseDetailBlock, coursesLiveItems, block.id])

  useEffect(() => {
    if (!isFitnessBlock || !siteId) {
      setFitnessLiveItems([])
      return
    }
    void websiteApi.getLive(siteId, 'fitness_classes', { limit: 50 })
      .then(r => setFitnessLiveItems(r.items ?? []))
      .catch(() => setFitnessLiveItems([]))
  }, [isFitnessBlock, siteId, block.id])

  useEffect(() => {
    if (!(isVehiclesBlock || isVehicleDetailBlock) || !siteId) {
      setVehiclesLiveItems([])
      return
    }
    void websiteApi.getLive(siteId, 'vehicles', { limit: 50 })
      .then(r => setVehiclesLiveItems(r.items ?? []))
      .catch(() => setVehiclesLiveItems([]))
  }, [isVehiclesBlock, isVehicleDetailBlock, siteId, block.id])

  useEffect(() => {
    if (!isEventsBlock || !siteId) {
      setEventsLiveItems([])
      return
    }
    void websiteApi.getLive(siteId, 'events', { limit: 50 })
      .then(r => setEventsLiveItems(r.items ?? []))
      .catch(() => setEventsLiveItems([]))
  }, [isEventsBlock, siteId, block.id])

  useEffect(() => {
    if (!isRecurringBlock || !siteId) {
      setRecurringLiveItems([])
      return
    }
    void websiteApi.getLive(siteId, 'recurring_plans', { limit: 50 })
      .then(r => setRecurringLiveItems(r.items ?? []))
      .catch(() => setRecurringLiveItems([]))
  }, [isRecurringBlock, siteId, block.id])

  useEffect(() => {
    if (!isTestimonialsBlock || !siteId) {
      setTestimonialsLiveItems([])
      return
    }
    void websiteApi.getLive(siteId, 'testimonials', { limit: 50 })
      .then(r => setTestimonialsLiveItems(r.items ?? []))
      .catch(() => setTestimonialsLiveItems([]))
  }, [isTestimonialsBlock, siteId, block.id])

  useEffect(() => {
    if (!isWizardBlock || !siteId) {
      setWizardLiveItems([])
      return
    }
    void websiteApi.getLive(siteId, 'booking_wizard_steps', { limit: 50 })
      .then(r => setWizardLiveItems(r.items ?? []))
      .catch(() => setWizardLiveItems([]))
  }, [isWizardBlock, siteId, block.id])

  useEffect(() => {
    if (!isResourceBlock || !siteId) {
      setResourceLiveItems([])
      return
    }
    void websiteApi.getLive(siteId, 'booking_resources', { limit: 50 })
      .then(r => setResourceLiveItems(r.items ?? []))
      .catch(() => setResourceLiveItems([]))
  }, [isResourceBlock, siteId, block.id])

  const publishedBlogCount = blogLiveItems.filter(item => item.meta?.is_published !== false).length
  const draftBlogCount = blogLiveItems.filter(item => item.meta?.is_published === false).length
  const activeProductCount = productLiveItems.filter(item => item.meta?.is_active !== false).length
  const activeCategoryCount = categoryLiveItems.length
  const activePlansCount = plansLiveItems.filter(item => item.meta?.is_active !== false).length
  const activePropertiesCount = propertiesLiveItems.filter(item => item.meta?.is_active !== false).length
  const activeCoursesCount = coursesLiveItems.filter(item => item.meta?.is_active !== false).length
  const activeFitnessCount = fitnessLiveItems.filter(item => item.meta?.is_active !== false).length
  const activeVehiclesCount = vehiclesLiveItems.filter(item => item.meta?.is_active !== false).length
  const activeEventsCount = eventsLiveItems.filter(item => item.meta?.is_active !== false).length
  const activeRecurringCount = recurringLiveItems.filter(item => item.meta?.is_active !== false).length
  const curatedTestimonialsCount = testimonialsLiveItems.filter(item => item.meta?.review_type === undefined).length
  const isTestimonialsFromReviews = testimonialsLiveItems.length > 0 && curatedTestimonialsCount === 0
  const activeWizardSteps = wizardLiveItems.filter(item => item.meta?.is_active !== false)
  const activeWizardStepsCount = activeWizardSteps.length
  const isWizardFromDefaultTemplate = wizardLiveItems.length > 0 && wizardLiveItems.every(item => item.meta?.is_default_template === true)
  const activeResourcesCount = resourceLiveItems.filter(item => item.meta?.is_active !== false).length
  const isResourceFromDefaultTemplate = resourceLiveItems.length > 0 && resourceLiveItems.every(item => item.meta?.is_default_template === true)

  const websiteBlogEnabled = isVendorBlogEnabled(vendor?.settings)
  const blogManagerBanner = isBlogBlock ? (
    <div className={cn(
      'rounded-xl border px-3 py-2.5 text-xs leading-snug space-y-2',
      websiteBlogEnabled
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : 'border-amber-200 bg-amber-50 text-amber-950',
    )}>
      {!websiteBlogEnabled && (
        <p>
          <span className="font-semibold">Blog is hidden on the live website.</span>{' '}
          The Blog menu will not show until you turn on <span className="font-semibold">Show on website</span> in Blog Manager.
        </p>
      )}
      <p>
        <span className="font-semibold">Synced with Blog Manager.</span>{' '}
        Posts you create and publish there appear here automatically.
      </p>
      <p className={websiteBlogEnabled ? 'text-emerald-800' : 'text-amber-800'}>
        {blogLiveItems.length === 0
          ? 'No posts yet — add your first post in Blog Manager.'
          : `${publishedBlogCount} published${draftBlogCount ? ` · ${draftBlogCount} draft${draftBlogCount === 1 ? '' : 's'} visible in builder preview` : ''}`}
      </p>
      <a
        href="/blog"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
      >
        Open Blog Manager →
      </a>
    </div>
  ) : undefined

  const productManagerBanner = isProductBlock ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 leading-snug space-y-2">
      <p>
        <span className="font-semibold">Synced with Products.</span>{' '}
        Products you manage in Inventory → Products appear here automatically.
      </p>
      <p className="text-emerald-800">
        {productLiveItems.length === 0
          ? 'No products yet — add your first product in Products.'
          : `${activeProductCount} active product${activeProductCount === 1 ? '' : 's'} available${productLiveItems.length > activeProductCount ? ` · ${productLiveItems.length - activeProductCount} hidden` : ''}`}
      </p>
      <button
        type="button"
        onClick={() => navigate('/products')}
        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
      >
        Open Products →
      </button>
    </div>
  ) : undefined

  const categoryManagerBanner = isCategoryBlock ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 leading-snug space-y-2">
      <p>
        <span className="font-semibold">Synced with Categories.</span>{' '}
        Category tiles in this showcase come from your catalog automatically.
      </p>
      <p className="text-emerald-800">
        {activeCategoryCount === 0
          ? 'No categories yet — add your first category in Categories.'
          : `${activeCategoryCount} active categor${activeCategoryCount === 1 ? 'y' : 'ies'} available`}
      </p>
      <button
        type="button"
        onClick={() => navigate('/categories')}
        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
      >
        Open Categories →
      </button>
    </div>
  ) : undefined

  const plansManagerBanner = isPlansBlock ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 leading-snug space-y-2">
      <p>
        <span className="font-semibold">Synced with Pricing Plans.</span>{' '}
        Plans you manage in Sales → Pricing Plans appear here automatically.
      </p>
      <p className="text-emerald-800">
        {plansLiveItems.length === 0
          ? 'No plans yet — add your first plan in Pricing Plans.'
          : `${activePlansCount} active plan${activePlansCount === 1 ? '' : 's'} shown${plansLiveItems.length > activePlansCount ? ` · ${plansLiveItems.length - activePlansCount} hidden (not shown here or on storefront)` : ''}`}
      </p>
      <a
        href="/sales/plans"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
      >
        Open Pricing Plans →
      </a>
    </div>
  ) : undefined

  const propertiesManagerBanner = isPropertiesBlock ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 leading-snug space-y-2">
      <p>
        <span className="font-semibold">Synced with Property Listings.</span>{' '}
        Listings you manage in Sales → Property Listings appear here automatically.
      </p>
      <p className="text-emerald-800">
        {propertiesLiveItems.length === 0
          ? 'No listings yet — add your first listing in Property Listings.'
          : `${activePropertiesCount} active listing${activePropertiesCount === 1 ? '' : 's'} shown${propertiesLiveItems.length > activePropertiesCount ? ` · ${propertiesLiveItems.length - activePropertiesCount} hidden (not shown here or on storefront)` : ''}`}
      </p>
      <a
        href="/sales/properties"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
      >
        Open Property Listings →
      </a>
    </div>
  ) : undefined

  const coursesManagerBanner = isCoursesBlock ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 leading-snug space-y-2">
      <p>
        <span className="font-semibold">Synced with Course Catalog.</span>{' '}
        Courses you manage in Sales → Course Catalog appear here automatically.
      </p>
      <p className="text-emerald-800">
        {coursesLiveItems.length === 0
          ? 'No courses yet — add your first course in Course Catalog.'
          : `${activeCoursesCount} active course${activeCoursesCount === 1 ? '' : 's'} shown${coursesLiveItems.length > activeCoursesCount ? ` · ${coursesLiveItems.length - activeCoursesCount} hidden (not shown here or on storefront)` : ''}`}
      </p>
      <a
        href="/sales/courses"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
      >
        Open Course Catalog →
      </a>
    </div>
  ) : undefined

  const fitnessManagerBanner = isFitnessBlock ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 leading-snug space-y-2">
      <p>
        <span className="font-semibold">Synced with Fitness Schedule.</span>{' '}
        Classes you manage in Sales → Fitness Schedule appear here automatically.
      </p>
      <p className="text-emerald-800">
        {fitnessLiveItems.length === 0
          ? 'No classes yet — add your first class in Fitness Schedule.'
          : `${activeFitnessCount} active class${activeFitnessCount === 1 ? '' : 'es'} shown${fitnessLiveItems.length > activeFitnessCount ? ` · ${fitnessLiveItems.length - activeFitnessCount} hidden (not shown here or on storefront)` : ''}`}
      </p>
      <a
        href="/sales/fitness-classes"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
      >
        Open Fitness Schedule →
      </a>
    </div>
  ) : undefined

  const vehiclesManagerBanner = (isVehiclesBlock || isVehicleDetailBlock) ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 leading-snug space-y-2">
      <p>
        <span className="font-semibold">Synced with Vehicle Inventory.</span>{' '}
        Vehicles you manage in Sales → Vehicle Inventory appear here automatically.
      </p>
      <p className="text-emerald-800">
        {vehiclesLiveItems.length === 0
          ? 'No vehicles yet — showing a demo vehicle below. Add your first vehicle in Vehicle Inventory to connect this page.'
          : isVehicleDetailBlock
          ? `Every active vehicle gets its own full detail card on this page — ${activeVehiclesCount} shown${vehiclesLiveItems.length > activeVehiclesCount ? ` · ${vehiclesLiveItems.length - activeVehiclesCount} hidden (not shown here or on storefront)` : ''}.`
          : `${activeVehiclesCount} active vehicle${activeVehiclesCount === 1 ? '' : 's'} shown${vehiclesLiveItems.length > activeVehiclesCount ? ` · ${vehiclesLiveItems.length - activeVehiclesCount} hidden (not shown here or on storefront)` : ''}`}
      </p>
      <a
        href="/sales/vehicles"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
      >
        Open Vehicle Inventory →
      </a>
    </div>
  ) : undefined

  const eventsManagerBanner = isEventsBlock ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 leading-snug space-y-2">
      <p>
        <span className="font-semibold">Synced with Ticketed Events.</span>{' '}
        Events you manage in Sales → Ticketed Events appear here automatically.
      </p>
      <p className="text-emerald-800">
        {eventsLiveItems.length === 0
          ? isEventListingBlock
            ? 'No events yet — showing demo events below. Add your first event in Ticketed Events to connect this page.'
            : 'No events yet — showing a demo event below. Add your first event in Ticketed Events to connect this page.'
          : isEventListingBlock
          ? `${activeEventsCount} active event${activeEventsCount === 1 ? '' : 's'} shown${eventsLiveItems.length > activeEventsCount ? ` · ${eventsLiveItems.length - activeEventsCount} hidden (not shown here or on storefront)` : ''}`
          : `Every active event gets its own full ticket picker on this page — ${activeEventsCount} shown${eventsLiveItems.length > activeEventsCount ? ` · ${eventsLiveItems.length - activeEventsCount} hidden (not shown here or on storefront)` : ''}.`}
      </p>
      <a
        href="/sales/events"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
      >
        Open Ticketed Events →
      </a>
    </div>
  ) : undefined

  const recurringManagerBanner = isRecurringBlock ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 leading-snug space-y-2">
      <p>
        <span className="font-semibold">Synced with Recurring Bookings.</span>{' '}
        Plans you manage in Sales → Recurring Bookings appear here automatically.
      </p>
      <p className="text-emerald-800">
        {recurringLiveItems.length === 0
          ? 'No recurring plans yet — showing a demo plan below. Add your first plan in Recurring Bookings to connect this page.'
          : `Every active plan gets its own full booking widget on this page — ${activeRecurringCount} shown${recurringLiveItems.length > activeRecurringCount ? ` · ${recurringLiveItems.length - activeRecurringCount} hidden (not shown here or on storefront)` : ''}.`}
      </p>
      <a
        href="/sales/recurring-bookings"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
      >
        Open Recurring Bookings →
      </a>
    </div>
  ) : undefined

  const testimonialsManagerBanner = isTestimonialsBlock ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 leading-snug space-y-2">
      <p>
        <span className="font-semibold">Synced with Testimonials.</span>{' '}
        Quotes you curate in Sales → Testimonials appear here automatically.
      </p>
      <p className="text-emerald-800">
        {testimonialsLiveItems.length === 0
          ? 'No testimonials or reviews yet — showing demo quotes below. Add your first testimonial in Sales → Testimonials to connect this page.'
          : isTestimonialsFromReviews
          ? `No curated testimonials yet — showing ${testimonialsLiveItems.length} verified 4★+ review${testimonialsLiveItems.length === 1 ? '' : 's'}. Add a testimonial in Sales → Testimonials to take full control of what's shown.`
          : `${curatedTestimonialsCount} curated testimonial${curatedTestimonialsCount === 1 ? '' : 's'} shown.`}
      </p>
      <a
        href="/sales/testimonials"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
      >
        Open Testimonials →
      </a>
    </div>
  ) : undefined

  const wizardManagerBanner = isWizardBlock ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 leading-snug space-y-2">
      <p>
        <span className="font-semibold">Synced with Booking Wizard.</span>{' '}
        Steps you manage in Sales → Booking Wizard appear here automatically.
      </p>
      <p className="text-emerald-800">
        {isWizardFromDefaultTemplate
          ? `No steps configured yet — showing the default ${activeWizardStepsCount}-step flow below. Add your own steps in Booking Wizard to take full control.`
          : `${activeWizardStepsCount} active step${activeWizardStepsCount === 1 ? '' : 's'} shown${wizardLiveItems.length > activeWizardStepsCount ? ` · ${wizardLiveItems.length - activeWizardStepsCount} hidden (not shown here or on storefront)` : ''}.`}
      </p>
      <a
        href="/sales/booking-wizard"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
      >
        Open Booking Wizard →
      </a>
    </div>
  ) : undefined

  const resourceManagerBanner = isResourceBlock ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 leading-snug space-y-2">
      <p>
        <span className="font-semibold">Synced with Resources.</span>{' '}
        Rooms, tables, courts, or equipment you manage in Sales → Resources appear here automatically.
      </p>
      <p className="text-emerald-800">
        {isResourceFromDefaultTemplate
          ? `No resources configured yet — showing ${activeResourcesCount} demo resource${activeResourcesCount === 1 ? '' : 's'} below. Add your own in Resources to take full control.`
          : `${activeResourcesCount} active resource${activeResourcesCount === 1 ? '' : 's'} shown${resourceLiveItems.length > activeResourcesCount ? ` · ${resourceLiveItems.length - activeResourcesCount} hidden (not shown here or on storefront)` : ''}.`}
      </p>
      <a
        href="/sales/booking-resources"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
      >
        Open Resources →
      </a>
    </div>
  ) : undefined

  const teamUseLive = isTeamBlock && shouldUseLiveTeam(p as Record<string, unknown>, teamLiveItems)
  const subEditorItems = block.block_type === 'marquee_strip'
    ? marqueeItemsForEditor(p as Record<string, unknown>)
    : block.block_type === 'payment_methods_strip'
    ? paymentMethodsForEditor(p as Record<string, unknown>)
    : isTeamBlock && teamUseLive
    ? teamLiveItems.map(liveItemToPropMember)
    : (itemSchema ? ((p as any)[itemSchema.arrayKey] || []) : [])

  const [editorTab, setEditorTab] = useState<SectionEditorTabId>('content')
  const [layoutAccordionOpen, setLayoutAccordionOpen] = useState<string | null>(null)
  useEffect(() => {
    setEditorTab('content')
  }, [block.id])

  // Seed missing array props (e.g. template FAQ blocks with title only) from catalog defaults.
  useEffect(() => {
    if (!itemSchema) return
    const key = itemSchema.arrayKey
    if ((p as Record<string, unknown>)[key] !== undefined) return
    const catalogDef = BLOCK_CATALOG.find(b => b.type === block.block_type)
    const defaultItems = catalogDef?.defaultProps?.[key as keyof BlockProps]
    if (!Array.isArray(defaultItems) || defaultItems.length === 0) return
    onUpdate({ [key]: defaultItems } as Partial<BlockProps>)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per selected block
  }, [block.id, block.block_type, itemSchema?.arrayKey])

  const teamConnectedBanner = teamUseLive ? (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900 leading-snug">
      <span className="font-semibold">Connected to your People list.</span>{' '}
      Names and roles come from HR. Layout controls below still apply on the canvas.
      Click <span className="font-semibold">Use custom list</span> to edit members here instead.
    </div>
  ) : isTeamBlock && isLiveTeamDataSource(p as Record<string, unknown>) && teamLiveItems.length > 0 ? (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600 leading-snug">
      Using your custom member list. Re-add the section with live data off to pull from People again.
    </div>
  ) : undefined

  const persistSubEditorItems = (items: any[]) => {
    if (block.block_type === 'marquee_strip') {
      onUpdate(patchMarqueeBlockItems(items) as Partial<BlockProps>)
      return
    }
    const patch: Record<string, unknown> = block.block_type === 'payment_methods_strip'
      ? { methods: paymentMethodsFromEditor(items) }
      : { [itemSchema!.arrayKey]: items }
    if (isTeamBlock) {
      onUpdate({ ...patch, use_manual_members: true } as any)
      return
    }
    onUpdate(patch as any)
  }

  const previewSubEditorItems = (items: any[]) => {
    if (block.block_type === 'marquee_strip') {
      onPreview(patchMarqueeBlockItems(items) as Partial<BlockProps>)
      return
    }
    const patch: Record<string, unknown> = block.block_type === 'payment_methods_strip'
      ? { methods: paymentMethodsFromEditor(items) }
      : { [itemSchema!.arrayKey]: items }
    if (isTeamBlock) {
      onPreview({ ...patch, use_manual_members: true } as any)
      return
    }
    onPreview(patch as any)
  }

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
      onUpdate={persistSubEditorItems}
      onPreview={previewSubEditorItems}
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
      onArrayItemImageFocus={onArrayItemImageFocus
        ? (index, itemField, arrayKey) => onArrayItemImageFocus(arrayKey, index, itemField)
        : undefined}
      onEditPropLink={onEditPropLink}
    />
  ) : null

  // ?? InputRow ? render helper that inlines PropsInputRow ???????????????
  // CRITICAL: this is NOT a React component. Declaring a component inside
  // PropsEditor would create a fresh component type on every render, forcing
  // React to unmount PropsInputRow on every keystroke (breaks typing / focus).
  // We call this as a plain function `inputRow({...})` in JSX so that React
  // only sees the stable, module-level PropsInputRow at the call site.
  const inputRow = (opts: {
    label: string; fieldKey: string; multiline?: boolean; placeholder?: string; linkable?: boolean
    rows?: number; mono?: boolean; deletable?: boolean
  }) => {
    const elementDeleteBlock = supportsBlockElementDelete(block.block_type)
    if (elementDeleteBlock && isBlockFieldHidden(p as Record<string, unknown>, opts.fieldKey)) {
      return null
    }
    const canDelete = opts.deletable !== false
      && elementDeleteBlock
      && canDeleteBlockField(block.block_type, opts.fieldKey)
    return (
    <PropsInputRow
      key={opts.fieldKey}
      blockId={block.id}
      fieldKey={opts.fieldKey}
      label={opts.label}
      serverValue={String((p as any)[opts.fieldKey] ?? '')}
      multiline={opts.multiline}
      placeholder={opts.placeholder}
      rows={opts.rows}
      mono={opts.mono}
      linkTarget={String((p as any)[
        opts.fieldKey === 'cta_label'
          ? 'cta_url'
          : opts.fieldKey.endsWith('_url')
            ? opts.fieldKey
            : `${opts.fieldKey}_url`
      ] ?? '')}
      onCommit={val => onUpdate({ [opts.fieldKey]: val })}
      onPreview={val => onPreview({ [opts.fieldKey]: val })}
      onLink={onEditPropLink && opts.linkable !== false ? anchor => onEditPropLink(opts.fieldKey, anchor) : undefined}
      onDelete={canDelete ? () => {
        const patch = buildDeleteBlockElementPatch(block, { kind: 'field', fieldKey: opts.fieldKey })
        if (patch) onUpdate(patch as Partial<BlockProps>)
      } : undefined}
    />
  )}

  const elementDeleteHint = supportsBlockElementDelete(block.block_type) ? (
    <p className="text-[10px] text-muted-foreground leading-snug px-0.5">
      Open any field below and use <span className="font-semibold text-foreground">Remove</span> to hide it on the page.
      Or click the element on the canvas, then <span className="font-semibold text-foreground">Delete</span> in the toolbar above the preview.
    </p>
  ) : null

  // ?? Fields ??????????????????????????????????????????????????????????????
  const commonFields = (
    <div className="space-y-2">
      {elementDeleteHint}
      {p.headline    !== undefined && inputRow({ label: 'Headline',      fieldKey: 'headline',      placeholder: 'Your compelling headline?' })}
      {p.headline_line2 !== undefined && inputRow({ label: 'Headline line 2', fieldKey: 'headline_line2', placeholder: 'Second headline line' })}
      {p.subtitle    !== undefined && inputRow({ label: 'Subtitle',      fieldKey: 'subtitle',      multiline: true, placeholder: 'Expand your headline here?' })}
      {p.title       !== undefined && !TITLE_DESC_HANDLED_ELSEWHERE.has(block.block_type) && inputRow({ label: 'Title',         fieldKey: 'title',         placeholder: 'Section title?' })}
      {block.block_type === 'video_embed' && siteId && (
        <VideoEmbedSourceEditor
          blockId={block.id}
          siteId={siteId}
          videoUrl={String((p as any).video_url ?? '')}
          onPreview={url => onPreview({ video_url: url } as Partial<BlockProps>)}
          onCommit={url => onUpdate({ video_url: url } as Partial<BlockProps>)}
        />
      )}
      {p.video_url !== undefined && block.block_type !== 'video_embed' && inputRow({
        label: 'Video URL',
        fieldKey: 'video_url',
        placeholder: 'YouTube, Vimeo, or Instagram link',
        linkable: false,
      })}
      {(p.message !== undefined || block.block_type === 'cookie_consent') && inputRow({
        label: 'Message',
        fieldKey: 'message',
        multiline: true,
        placeholder: 'We use cookies to improve your experience…',
        linkable: false,
      })}
      {(p.accept_label !== undefined || block.block_type === 'cookie_consent') && inputRow({
        label: 'Accept button',
        fieldKey: 'accept_label',
        placeholder: 'Accept',
        linkable: false,
      })}
      {(p.decline_label !== undefined || block.block_type === 'cookie_consent') && inputRow({
        label: 'Decline button',
        fieldKey: 'decline_label',
        placeholder: 'Decline',
        linkable: false,
      })}
      {(p.policy_url !== undefined || block.block_type === 'cookie_consent') && inputRow({
        label: 'Privacy policy link',
        fieldKey: 'policy_url',
        placeholder: '/privacy or https://…',
        linkable: false,
      })}
      {p.description !== undefined && !TITLE_DESC_HANDLED_ELSEWHERE.has(block.block_type) && block.block_type !== 'footer' && inputRow({ label: 'Description',   fieldKey: 'description',   multiline: true, placeholder: 'Describe this section?' })}
      {p.eyebrow     !== undefined && inputRow({ label: 'Tagline',       fieldKey: 'eyebrow',       placeholder: 'Small text above headline (e.g. Welcome)' })}
      {p.cta_primary !== undefined && inputRow({ label: 'Primary CTA',   fieldKey: 'cta_primary',   placeholder: 'Get Started' })}
      {p.cta_primary !== undefined && inputRow({ label: '? Primary link', fieldKey: 'cta_primary_url',   placeholder: '/signup or /products/my-product' })}
      {p.cta_secondary!== undefined && inputRow({ label: 'Secondary CTA',fieldKey: 'cta_secondary', placeholder: 'Learn More' })}
      {p.cta_secondary!== undefined && inputRow({ label: '? Secondary link', fieldKey: 'cta_secondary_url', placeholder: '/about or https://...' })}
      {p.cta_label   !== undefined && block.block_type !== 'nav' && inputRow({ label: 'CTA Label',     fieldKey: 'cta_label',     placeholder: 'Click Here' })}
      {p.cta_label   !== undefined && block.block_type !== 'nav' && inputRow({ label: 'CTA link',      fieldKey: 'cta_url',       placeholder: '/signup or /contact' })}
      {p.brand       !== undefined && block.block_type !== 'nav' && block.block_type !== 'footer' && inputRow({ label: 'Brand Name',    fieldKey: 'brand',         placeholder: 'Your Brand' })}
      {p.text        !== undefined && block.block_type !== 'marquee_strip' && inputRow({ label: 'Text',          fieldKey: 'text',          multiline: true, placeholder: 'Enter text?' })}
      {(p.html !== undefined || block.block_type === 'html_embed') && inputRow({
        label: 'HTML code',
        fieldKey: 'html',
        multiline: true,
        rows: 10,
        mono: true,
        placeholder: '<div>Custom HTML, iframes, or embed snippets</div>',
        linkable: false,
      })}
      {p.copyright   !== undefined && block.block_type !== 'footer' && inputRow({ label: 'Copyright',     fieldKey: 'copyright',     placeholder: '? 2026 Your Company' })}
    </div>
  )

  const bgStyleField = p.bg_style !== undefined && (
    <PanelBgStylePicker
      value={String(p.bg_style || 'minimal')}
      onChange={id => onUpdate({ bg_style: id } as any)}
    />
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
        <Select
          value={(p as any).gradient_dir || '135deg'}
          onChange={v => onUpdate({ gradient_dir: v } as any)}
          options={[
            { value: '135deg', label: '? Diagonal' },
            { value: 'to right', label: '? Horizontal' },
            { value: 'to bottom', label: '? Vertical' },
            { value: 'to top right', label: '? Top-Right' },
            { value: 'circle at center', label: '? Radial' },
          ]}
          className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs"
        />
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
  const hasMediaPanel = isHeroBlock || p.bg_style === 'image' || p.image_url !== undefined || block.block_type === 'nav' || block.block_type === 'video_embed'

  useEffect(() => {
    setLayoutAccordionOpen(sectionLayoutCount > 0 ? 'style' : 'spacing')
  }, [block.id, sectionLayoutCount])

  useEffect(() => {
    if (editorTab === 'layout' && layoutAccordionOpen === null) {
      setLayoutAccordionOpen(sectionLayoutCount > 0 ? 'style' : 'spacing')
    }
  }, [editorTab, layoutAccordionOpen, sectionLayoutCount])

  const activateLayoutAccordion = (id: string) => {
    setLayoutAccordionOpen(prev => (prev === id ? null : id))
  }

  const layoutStylePreview = (() => {
    const options = getSectionLayoutOptions(block.block_type)
    if (options.length === 0) return undefined
    const active = findActiveSectionLayoutOption(p as Record<string, unknown>, options)
      ?? findBestSectionLayoutOption(p as Record<string, unknown>, options)
      ?? options[findActiveLayoutIndex(p as Record<string, unknown>, block.block_type)]
    return active?.label || 'Default'
  })()

  const navHeaderBarSize = block.block_type === 'nav'
    ? resolveNavHeaderBarSizeForEditor(
      p as Record<string, unknown>,
      (p as any).nav_compact === true || String((p as any).nav_style ?? '') === 'compact',
    )
    : null
  const hasExplicitHeaderBarSize = block.block_type === 'nav'
    && Number.isFinite(Number((p as any).header_bar_size ?? (p as any).header_bar_height))

  const sectionImageFieldForSpacing =
    isHeroBlock
      ? (usesSideImage ? 'image_url' : usesBgImage ? 'bg_image_url' : null)
      : p.bg_style === 'image'
        ? 'bg_image_url'
        : (p.image_url !== undefined ? 'image_url' : null)
  const sectionImageFocal = sectionImageFieldForSpacing
    ? readSectionImageFocal(sectionImageFieldForSpacing, blockProps)
    : { x: 50, y: 50 }
  const sectionImageAligned =
    sectionImageFieldForSpacing != null
    && (sectionImageFocal.x !== 50 || sectionImageFocal.y !== 50)

  const sectionSpacingPreview = [
    previewDevice !== 'desktop' ? `${previewDevice}` : null,
    sectionScale !== 1 ? `${Math.round(sectionScale * 100)}% size` : null,
    sectionImageAligned ? `pos ${sectionImageFocal.x}/${sectionImageFocal.y}` : null,
    hasExplicitHeaderBarSize && navHeaderBarSize != null ? `${navHeaderBarSize}px bar` : null,
    `${paddingTop}px top`,
    `${paddingBottom}px bottom`,
  ].filter(Boolean).join(' · ')

  const sectionShapesPreview = [
    (p as any).top_shape && (p as any).top_shape !== 'none' ? `Top: ${(p as any).top_shape}` : null,
    (p as any).bottom_shape && (p as any).bottom_shape !== 'none' ? `Bottom: ${(p as any).bottom_shape}` : null,
  ].filter(Boolean).join(' · ') || 'None'

  const catalogGridPreview = (() => {
    if (!isCatalogGridBlock) return ''
    const cfg = getCatalogGridBlockConfig(block.block_type)
    const cols = Math.min(CATALOG_GRID_COLUMN_MAX, Math.max(cfg.columnMin, Number((p as any).columns ?? cfg.defaultColumns) || cfg.defaultColumns))
    return cfg.showColumns ? `${cols} col · ${Number((p as any).image_width_pct ?? 100)}%w · ${String((p as any).image_aspect ?? 'auto') === 'full' ? 'full' : `${Number((p as any).image_height_pct ?? 100)}%`} img` : `${Number((p as any).show_count ?? 12)} items`
  })()

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

  const sectionAndCardColorsPanel = (
    <SectionPanelGroup
      title="Colors"
      description="Section and card colors for this block."
    >
      <div className="space-y-2">
        <PanelGroupEyebrow>Section</PanelGroupEyebrow>
        <div className="grid grid-cols-1 @[240px]:grid-cols-2 gap-1.5">
          <PanelColorRow
            label="Section background"
            hint="Section backdrop"
            value={sectionBgOverride || sectionBgFallback}
            fallback={sectionBgFallback}
            onChange={c => {
              onPreview({ bg_color_override: c } as any)
              onUpdate({ bg_color_override: c } as any)
            }}
            onReset={sectionBgOverride ? () => {
              onPreview({ bg_color_override: null } as any)
              onUpdate({ bg_color_override: null } as any)
            } : undefined}
          />
          <PanelColorRow
            label="Section text"
            hint="Section typography"
            value={sectionTextOverride || sectionTextFallback}
            fallback={sectionTextFallback}
            onChange={c => {
              onPreview({ text_color_override: c } as any)
              onUpdate({ text_color_override: c } as any)
            }}
            onReset={sectionTextOverride ? () => {
              onPreview({ text_color_override: null } as any)
              onUpdate({ text_color_override: null } as any)
            } : undefined}
          />
        </div>
        {showTileColors && (
          <div className="space-y-1.5 border-t border-border/50 pt-2">
            <PanelGroupEyebrow>Cards & tiles</PanelGroupEyebrow>
            <div className="grid grid-cols-1 @[240px]:grid-cols-2 gap-1.5">
              {([
                { key: 'tile_bg' as const, label: 'Card background', hint: 'Tile / card fill' },
                { key: 'tile_accent' as const, label: 'Accent', hint: 'Highlights & top bar' },
                { key: 'tile_text' as const, label: 'Card text', hint: 'Titles & body in cards' },
                { key: 'tile_border' as const, label: 'Border', hint: 'Card outline' },
              ] as const).map(({ key, label, hint }) => (
                <PanelColorRow
                  key={key}
                  label={label}
                  hint={hint}
                  value={tileColorSwatch((p as any)[key], tileSwatchDefaults[key])}
                  fallback={tileSwatchDefaults[key]}
                  onChange={c => onUpdate({ [key]: c } as any)}
                  onReset={(p as any)[key] ? () => onUpdate({ [key]: null } as any) : undefined}
                />
              ))}
            </div>
            {hasTileColorOverrides(p as BlockColorProps) && (
              <button
                type="button"
                onClick={() => onUpdate({ tile_bg: null, tile_accent: null, tile_text: null, tile_border: null } as any)}
                className="text-[10px] font-semibold text-destructive/80 hover:text-destructive"
              >
                Clear all card colors
              </button>
            )}
          </div>
        )}
      </div>
    </SectionPanelGroup>
  )

  const imageShapePicker = hasImageShape && (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className={builderPanelUi.hint}>Applies to all cards in this section.</p>
        <div className="grid grid-cols-4 @[260px]:grid-cols-5 gap-1">
          {IMAGE_SHAPE_OPTIONS.map(opt => {
            const active = String((p as any).image_shape ?? (block.block_type === 'team_grid' ? 'circle' : 'rounded')) === opt.value
            const previewClass = imageShapeRadiusClass(opt.value as ImageShape)
            return (
              <button
                key={opt.value}
                type="button"
                title={opt.label}
                onClick={() => {
                  onPreview({ image_shape: opt.value } as any)
                  onUpdate({ image_shape: opt.value } as any)
                }}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-md border px-0.5 py-1 text-[9px] font-semibold leading-tight transition-colors',
                  active
                    ? 'border-primary bg-card text-primary shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                )}
              >
                <span className={cn('h-5 w-5 border border-primary/30 bg-primary/20', previewClass)} aria-hidden />
                <span className="w-full truncate text-center">{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {isCatalogGridBlock ? (
        <div className="space-y-2 border-t border-border/60 pt-2">
          <PanelFieldLabel>Overlay style</PanelFieldLabel>
          <PanelChipWrap>
            {TILE_OVERLAY_STYLE_OPTIONS.map(opt => (
              <PanelChip
                key={opt.value}
                active={String((p as any).tile_overlay_style ?? 'gradient') === opt.value}
                onClick={() => {
                  onPreview({ tile_overlay_style: opt.value } as any)
                  onUpdate({ tile_overlay_style: opt.value } as any)
                }}
              >
                {opt.label}
              </PanelChip>
            ))}
          </PanelChipWrap>
          <p className="text-[10px] text-muted-foreground leading-snug">
            For circle and custom shapes, use Auto or To shape so gradients follow the tile — not the square box.
          </p>

          <PanelFieldLabel>Clip overlay to shape</PanelFieldLabel>
          <PanelChipWrap>
            {TILE_OVERLAY_CLIP_OPTIONS.map(opt => (
              <PanelChip
                key={opt.value}
                active={String((p as any).tile_overlay_clip ?? 'auto') === opt.value}
                onClick={() => {
                  onPreview({ tile_overlay_clip: opt.value } as any)
                  onUpdate({ tile_overlay_clip: opt.value } as any)
                }}
              >
                {opt.label}
              </PanelChip>
            ))}
          </PanelChipWrap>

          <PanelFieldLabel>Corner backdrop</PanelFieldLabel>
          <PanelChipWrap>
            {TILE_BACKDROP_OPTIONS.map(opt => (
              <PanelChip
                key={opt.value}
                active={String((p as any).tile_backdrop ?? 'default') === opt.value}
                onClick={() => {
                  onPreview({ tile_backdrop: opt.value } as any)
                  onUpdate({ tile_backdrop: opt.value } as any)
                }}
              >
                {opt.label}
              </PanelChip>
            ))}
          </PanelChipWrap>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Transparent or Match section removes gray squares behind circular tiles.
          </p>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 py-2.5 border-b border-border bg-card">
        <p className="text-xs font-bold text-foreground truncate">{block.label || block.block_type}</p>
        <p className={builderPanelUi.hint}>Section settings — layout, design, and content</p>
        <button
          type="button"
          className="mt-1.5 flex w-full min-w-0 items-center gap-1 rounded border border-border/80 bg-muted/40 px-1.5 py-1 text-left font-mono text-[9px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
          title="Copy CSS selector for Custom CSS (Page Edit)"
          onClick={() => {
            const sel = `[data-block-id="${block.id}"]`
            void navigator.clipboard?.writeText(sel).then(
              () => toast.success('CSS selector copied'),
              () => toast.message(sel),
            )
          }}
        >
          <span className="min-w-0 flex-1 truncate">{`[data-block-id="${block.id}"]`}</span>
          <span className="shrink-0 text-[8px] font-sans font-semibold uppercase tracking-wide text-primary">Copy</span>
        </button>
      </div>

      <SectionEditorRibbon tabs={ribbonTabs} active={editorTab} onChange={setEditorTab} />

      <div className={cn(builderPanelUi.panelScroll, 'p-2 space-y-2 bg-muted/15')}>
        {editorTab === 'content' && (
          <>
      {blogManagerBanner}
      {productManagerBanner}
      {categoryManagerBanner}
      {plansManagerBanner}
      {propertiesManagerBanner}
      {coursesManagerBanner}
      {fitnessManagerBanner}
      {vehiclesManagerBanner}
      {eventsManagerBanner}
      {recurringManagerBanner}
      {testimonialsManagerBanner}
      {wizardManagerBanner}
      {resourceManagerBanner}
      {supportsBlockElementDelete(block.block_type) && (() => {
        const hidden = listDeletableHiddenFields(block.block_type, p as Record<string, unknown>)
        if (!hidden.length) return null
        return (
          <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 p-2.5 space-y-2">
            <p className="text-[11px] font-semibold text-foreground">Hidden elements</p>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Deleted parts of this section — restore to show them again on the canvas.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {hidden.map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onUpdate(showBlockFieldPatch(p as Record<string, unknown>, key) as Partial<BlockProps>)}
                  className="rounded-md border border-amber-300/80 bg-white px-2 py-1 text-[10px] font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                >
                  Restore {fieldLabelForKey(key)}
                </button>
              ))}
            </div>
          </div>
        )
      })()}
      {block.block_type === 'rich_text' && p.content !== undefined && (
        <div className="rounded-xl border border-border bg-card p-2.5 space-y-2">
          <p className="text-[11px] font-semibold text-foreground">Content</p>
          <RichTextWysiwygField
            blockId={block.id}
            serverValue={String(p.content ?? '')}
            onCommit={val => onUpdate({ content: val } as Partial<BlockProps>)}
            onPreview={val => onPreview({ content: val } as Partial<BlockProps>)}
          />
        </div>
      )}
      {(p.target_date !== undefined || block.block_type === 'countdown') && (
        <div className="rounded-xl border border-border bg-card p-2.5 space-y-2">
          <p className="text-[11px] font-semibold text-foreground">Countdown end date & time</p>
          <p className="text-[10px] text-muted-foreground leading-snug">
            When the timer reaches zero, it stays at 00:00:00:00.
          </p>
          <input
            type="datetime-local"
            value={isoToDatetimeLocal(String(p.target_date ?? ''))}
            onChange={e => {
              const iso = datetimeLocalToIso(e.target.value)
              const patch = { target_date: iso } as Partial<BlockProps>
              onPreview(patch)
              onUpdate(patch)
            }}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-[10px] text-muted-foreground">
            Ends: <span className="font-medium text-foreground">{formatCountdownEndLabel(String(p.target_date ?? ''))}</span>
          </p>
        </div>
      )}
      {block.block_type === 'nav' && (
        <PropsCollapsible
          title="Logo & brand"
          preview={
            (p as any).brand_logo
              ? `${navBrandDisplayPreview(p as Record<string, unknown>)} · ${(p.brand as string) || 'Brand'}`
              : (p as any).show_logo !== false
                ? `${navBrandDisplayPreview(p as Record<string, unknown>)} · name`
                : (p.brand as string) || 'Text only'
          }
        >
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
              onClick={() => onUpdate({ brand_logo: '' } as Partial<BlockProps>)}
              className="text-xs text-red-500 hover:text-red-700 font-semibold"
            >
              Remove logo image
            </button>
          )}
          {inputRow({ label: 'Brand name', fieldKey: 'brand', placeholder: 'Your store name' })}
          <NavBrandDisplayControls props={p as Record<string, unknown>} onUpdate={onUpdate} />
          <p className="text-xs text-gray-400 leading-snug">
            Pick from your media gallery or upload, or click the logo slot on the canvas. Visibility toggles are under <span className="font-semibold text-gray-600">Header elements</span> below.
          </p>
        </PropsCollapsible>
      )}
      {commonFields}

      {isMapLocationBlock && (
        <PropsCollapsible
          title="Map location"
          preview={(() => {
            const lat = readMapBlockCoord((p as any).lat)
            const lng = readMapBlockCoord((p as any).lng)
            const addr = String((p as any).address ?? '').trim()
            if (lat != null && lng != null) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
            if (addr) return addr.length > 42 ? `${addr.slice(0, 42)}…` : addr
            return 'Not set'
          })()}
          defaultOpen
        >
          <MapLocationPicker
            address={String((p as any).address ?? '')}
            lat={readMapBlockCoord((p as any).lat)}
            lng={readMapBlockCoord((p as any).lng)}
            defaultCenter={mapDefaultCenter}
            onChange={next => onUpdate({ address: next.address, lat: next.lat, lng: next.lng } as Partial<BlockProps>)}
            onPreview={next => onPreview({ address: next.address, lat: next.lat, lng: next.lng } as Partial<BlockProps>)}
          />
        </PropsCollapsible>
      )}

      {onEditPropLink && blockTypeSupportsBlockLink(block.block_type) && (
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
            className={cn(builderLinkBtn(!!(p as any).block_link_url), 'w-full justify-center')}
            title={(p as any).block_link_url ? `Linked to ${(p as any).block_link_url}` : 'Insert block link'}
          >
            <span className={builderLinkBtnIcon(!!(p as any).block_link_url)}>
              <Link2 className="h-2.5 w-2.5" />
            </span>
            {(p as any).block_link_url ? `Linked: ${(p as any).block_link_url}` : 'Insert block link'}
          </button>
        </PropsCollapsible>
      )}

      {block.block_type === 'nav' && (
        <PropsCollapsible
          title="Header elements"
          preview={[
            (p as any).show_logo !== false ? 'Logo' : null,
            (p as any).show_nav_links !== false ? 'links' : null,
            (p as any).cta_label ? 'CTA' : 'actions',
          ].filter(Boolean).join(' · ')}
        >
          {[
            { key: 'show_logo', label: 'Show logo image' },
            { key: 'show_brand_name', label: 'Show brand name' },
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
          <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
            {inputRow({ label: 'CTA button', fieldKey: 'cta_label', placeholder: 'Get started (leave empty to hide)' })}
            {inputRow({ label: 'CTA link', fieldKey: 'cta_url', placeholder: '/products or /contact' })}
          </div>
        </PropsCollapsible>
      )}

      {block.block_type === 'footer' && (
        <PropsCollapsible
          title="Footer content"
          preview={[
            (p as any).brand ? String((p as any).brand) : 'Brand',
            (p as any).copyright ? 'copyright' : null,
          ].filter(Boolean).join(' · ')}
          defaultOpen
        >
          {inputRow({ label: 'Brand name', fieldKey: 'brand', placeholder: 'Your store name' })}
          {inputRow({ label: 'Description', fieldKey: 'description', multiline: true, placeholder: 'Short site description (optional)' })}
          {inputRow({ label: 'Copyright', fieldKey: 'copyright', placeholder: '© 2026 Your Company. All rights reserved.' })}
          <p className="text-[10px] text-muted-foreground leading-snug">
            Double-click text on the footer canvas to edit inline, or use the fields above.
          </p>
        </PropsCollapsible>
      )}

      {block.block_type === 'footer' && (
        <PropsCollapsible
          title="Footer elements"
          preview={[
            (p as any).show_social !== false ? 'Social' : null,
            (p as any).show_legal !== false ? 'Legal' : null,
            (p as any).show_newsletter ? 'Newsletter' : null,
            canEditPoweredBy && (p as any).powered_by_admin_disabled !== true ? 'Powered by' : null,
          ].filter(Boolean).join(' · ') || 'Minimal'}
        >
          {[
            { key: 'show_social', label: 'Show social icons' },
            { key: 'show_legal', label: 'Show legal links' },
            { key: 'show_newsletter', label: 'Show newsletter signup' },
            ...(canEditPoweredBy
              ? [{ key: 'show_powered_by', label: 'Show “Powered By @ KITERP.com”' }]
              : []),
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={
                  key === 'show_powered_by'
                    ? (p as any).powered_by_admin_disabled !== true
                    : key === 'show_newsletter'
                      ? (p as any)[key] === true
                      : (p as any)[key] !== false
                }
                onChange={e => {
                  if (key === 'show_powered_by') {
                    if (e.target.checked) {
                      onUpdate({
                        show_powered_by: true,
                        powered_by_admin_disabled: false,
                        powered_by_text: String((p as any).powered_by_text || '').trim() || DEFAULT_POWERED_BY_TEXT,
                        powered_by_text_url: String((p as any).powered_by_text_url || '').trim() || DEFAULT_POWERED_BY_URL,
                        powered_by_text_link_new_tab: (p as any).powered_by_text_link_new_tab !== false,
                      } as any)
                    } else {
                      onUpdate({
                        show_powered_by: false,
                        powered_by_admin_disabled: true,
                      } as any)
                    }
                    return
                  }
                  onUpdate({ [key]: e.target.checked } as any)
                }}
                className="rounded accent-primary"
              />
              <span className="text-xs text-gray-600">{label}</span>
            </label>
          ))}
          {canEditPoweredBy && (p as any).powered_by_admin_disabled !== true && (
            <div className="mt-2">
              {inputRow({
                label: 'Powered by text',
                fieldKey: 'powered_by_text',
                placeholder: DEFAULT_POWERED_BY_TEXT,
              })}
              <p className="text-[10px] text-muted-foreground leading-snug mt-1">
                Platform branding — shown on every site by default. Click opens{' '}
                <span className="font-semibold text-foreground">{DEFAULT_POWERED_BY_URL}</span>.
                Only this account can hide it.
              </p>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground leading-snug mt-1">
            Layout styles (Dark, Mega, Brand, etc.) are under <span className="font-semibold text-foreground">Layout → Section style</span>.
          </p>
        </PropsCollapsible>
      )}

      {block.block_type === 'footer' && (() => {
        type FooterLink = string | { label?: string; href?: string; url?: string }
        type FooterColumn = { title?: string; links?: FooterLink[] }
        const cols = [...((p.footer_columns as FooterColumn[] | undefined) || [])]
        const linkLabel = (link: FooterLink) => (typeof link === 'string' ? link : (link.label ?? ''))
        const linkHref = (link: FooterLink) => (typeof link === 'string' ? '' : (link.href ?? link.url ?? ''))
        const setCols = (next: FooterColumn[]) => onUpdate({ footer_columns: next } as any)
        return (
          <PropsCollapsible
            title="Footer columns"
            preview={cols.length ? `${cols.length} column${cols.length === 1 ? '' : 's'}` : 'No columns'}
            defaultOpen
          >
            <p className="text-xs text-gray-400 leading-snug mb-2">
              Column titles and link labels also edit on the canvas. Use the link picker for URLs.
            </p>
            <div className="space-y-3">
              {cols.map((col, colIdx) => (
                <div key={colIdx} className="rounded-lg border border-gray-100 bg-gray-50/80 p-2 space-y-2">
                  <div className="flex gap-1.5 items-center">
                    <input
                      type="text"
                      value={col.title || ''}
                      placeholder="Column title"
                      onChange={e => {
                        const next = cols.map((c, i) => i === colIdx ? { ...c, title: e.target.value } : c)
                        setCols(next)
                      }}
                      className="flex-1 min-w-0 px-2 py-1 border border-gray-200 rounded text-xs font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setCols(cols.filter((_, i) => i !== colIdx))}
                      className="p-1 text-red-400 hover:text-red-600 shrink-0"
                      aria-label="Remove column"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {(col.links || []).map((link, linkIdx) => (
                    <div key={linkIdx} className="flex gap-1.5 items-center pl-1">
                      <input
                        type="text"
                        value={linkLabel(link)}
                        placeholder="Link label"
                        onChange={e => {
                          const nextLinks = [...(col.links || [])]
                          const prev = nextLinks[linkIdx]
                          nextLinks[linkIdx] = typeof prev === 'string'
                            ? e.target.value
                            : { ...prev, label: e.target.value }
                          const next = cols.map((c, i) => i === colIdx ? { ...c, links: nextLinks } : c)
                          setCols(next)
                        }}
                        className="flex-1 min-w-0 px-2 py-1 border border-gray-200 rounded text-xs"
                      />
                      <input
                        type="text"
                        value={linkHref(link)}
                        placeholder="/page"
                        onChange={e => {
                          const nextLinks = [...(col.links || [])]
                          const prev = nextLinks[linkIdx]
                          const label = linkLabel(prev)
                          nextLinks[linkIdx] = { label, href: e.target.value }
                          const next = cols.map((c, i) => i === colIdx ? { ...c, links: nextLinks } : c)
                          setCols(next)
                        }}
                        className="flex-1 min-w-0 px-2 py-1 border border-gray-200 rounded text-xs font-mono"
                      />
                      {onEditPropLink && (
                        <button
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault()
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            onEditPropLink(`footer_columns.${colIdx}.links.${linkIdx}.href`, { x: rect.left, y: rect.bottom + 6 })
                          }}
                          className="shrink-0 p-1.5 rounded border border-gray-200 text-gray-500 hover:text-primary hover:border-primary/40"
                          title="Open link picker"
                        >
                          <Link2 className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const nextLinks = (col.links || []).filter((_, i) => i !== linkIdx)
                          const next = cols.map((c, i) => i === colIdx ? { ...c, links: nextLinks } : c)
                          setCols(next)
                        }}
                        className="p-1 text-red-400 hover:text-red-600 shrink-0"
                        aria-label="Remove link"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const next = cols.map((c, i) => i === colIdx
                        ? { ...c, links: [...(c.links || []), 'New link'] }
                        : c)
                      setCols(next)
                    }}
                    className="flex items-center gap-1 text-[11px] text-primary font-semibold pl-1"
                  >
                    <Plus className="w-3 h-3" /> Add link
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCols([...cols, { title: 'New column', links: [] }])}
              className="mt-2 flex items-center gap-1 text-xs text-primary hover:text-primary font-semibold"
            >
              <Plus className="w-3 h-3" /> Add column
            </button>
          </PropsCollapsible>
        )
      })()}

      {(block.block_type === 'footer' && p.show_social !== false) || block.block_type === 'social_links' ? (
        <PropsCollapsible
          title="Social media"
          preview={Object.values((p.social_links as Record<string, string>) || {}).filter(Boolean).length
            ? `${Object.values((p.social_links as Record<string, string>) || {}).filter(Boolean).length} linked`
            : 'Click icons on canvas to add URLs'}
        >
          <p className="text-xs text-gray-400 leading-snug mb-2">
            {block.block_type === 'footer'
              ? 'Click a social icon on the footer canvas, or edit URLs here.'
              : 'Click a social chip on the canvas, use the Links tab, or edit URLs here.'}
          </p>
          {(
            block.block_type === 'social_links'
              ? [
                  { key: 'whatsapp', label: 'WhatsApp', placeholder: '+91 98765 43210' },
                  { key: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/your-page' },
                  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/your-page' },
                  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/your-page' },
                  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/your-page' },
                  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@your-page' },
                ]
              : [
                  { key: 'whatsapp', label: 'WhatsApp', placeholder: '+91 98765 43210' },
                  { key: 'twitter', label: 'Twitter / X', placeholder: 'https://x.com/your-page' },
                  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/your-page' },
                  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/your-page' },
                  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@your-page' },
                ]
          ).map(({ key, label, placeholder }) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-20 shrink-0 text-xs text-gray-500">{label}</span>
              <input
                type="text"
                value={String((p.social_links as Record<string, string> | undefined)?.[key] || '')}
                placeholder={placeholder}
                onChange={e => {
                  const next = { ...((p.social_links as Record<string, string>) || {}) }
                  const val = e.target.value.trim()
                  if (val) next[key] = val
                  else delete next[key]
                  onUpdate({ social_links: next } as any)
                }}
                className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded text-xs font-mono"
              />
              {onEditPropLink && (
                <button
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault()
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    onEditPropLink(`social_links.${key}`, { x: rect.left, y: rect.bottom + 6 })
                  }}
                  className="shrink-0 p-1.5 rounded border border-gray-200 text-gray-500 hover:text-primary hover:border-primary/40"
                  title="Open link picker"
                >
                  <Link2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </PropsCollapsible>
      ) : null}

      {block.block_type === 'nav' && (
        <PropsCollapsible
          title="Navigation links"
          preview={(p.nav_links_source as string) === 'manual' ? 'Manual links' : `${pages?.length ?? 0} site page${(pages?.length ?? 0) === 1 ? '' : 's'}`}
        >
          <div className="space-y-2">
            <label className="text-xs text-gray-500">Link source</label>
            <Select
              value={(p.nav_links_source as string) || 'site_pages'}
              onChange={v => onUpdate({ nav_links_source: v } as any)}
              options={[
                { value: 'site_pages', label: 'Site pages (auto-sync)' },
                { value: 'manual', label: 'Manual links' },
              ]}
              className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs"
            />
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

      {block.block_type === 'vertical.ticketPicker' && (
        <PropsCollapsible title="Section header" preview="Title, subtitle above the page" defaultOpen>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Shown above the ticket picker(s) on the page. Everything else — order summary, seating chart, checkout button — comes from each event in Ticketed Events once connected.
            </p>
            {inputRow({ label: 'Section title', fieldKey: 'header_title', placeholder: eventsLiveItems.length > 0 ? 'Upcoming events' : 'Leave empty to hide' })}
            {inputRow({ label: 'Section subtitle', fieldKey: 'header_subtitle', placeholder: 'Leave empty to auto-show event count' })}
          </div>
        </PropsCollapsible>
      )}

      {isEventsBlock && eventsLiveItems.length > 0 && (
        <PropsCollapsible
          title="Events"
          preview={isEventListingBlock ? `${activeEventsCount} event card${activeEventsCount === 1 ? '' : 's'}` : `${activeEventsCount} full ticket picker${activeEventsCount === 1 ? '' : 's'}`}
          defaultOpen
        >
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              {isEventListingBlock
                ? "Every active event from Ticketed Events appears here as a card (image, date, venue, from-price), linked in the order they're sorted there. Manage each event's details there."
                : "Every active event from Ticketed Events gets its own full ticket picker (info, tiers, seating chart, order summary, checkout button) on this page, stacked in the order they're sorted there. Manage each event's details there."}
            </p>
            <a
              href="/sales/events"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              Open Ticketed Events →
            </a>
          </div>
        </PropsCollapsible>
      )}

      {block.block_type === 'vertical.ticketPicker' && eventsLiveItems.length === 0 && (
        <PropsCollapsible title="Event details" preview="Image, tagline, date, venue" defaultOpen>
          <div className="space-y-2">
            <InlineMediaPicker
              siteId={siteId}
              value={String((p as any).image_url ?? '')}
              label="Event banner image"
              onChange={url => onUpdate({ image_url: url } as any)}
            />
            {inputRow({ label: 'Event title', fieldKey: 'title', placeholder: 'Field Notes — A Night of Ambient' })}
            {inputRow({ label: 'Tagline', fieldKey: 'tagline', placeholder: 'An intimate evening of live electronic & strings' })}
            {inputRow({ label: 'Date', fieldKey: 'date', placeholder: 'Friday, June 5, 2026' })}
            {inputRow({ label: 'Doors', fieldKey: 'doors', placeholder: '7:30 PM' })}
            {inputRow({ label: 'Start', fieldKey: 'start', placeholder: '8:30 PM' })}
            {inputRow({ label: 'End time', fieldKey: 'end', placeholder: '11:00 PM' })}
            {inputRow({ label: 'Venue', fieldKey: 'venue', placeholder: 'The Greene Room' })}
            {inputRow({ label: 'Address', fieldKey: 'address', placeholder: '418 Atlantic Ave, Brooklyn' })}
            {inputRow({ label: 'Maximum seats', fieldKey: 'venue_capacity', placeholder: '500' })}
          </div>
        </PropsCollapsible>
      )}

      {block.block_type === 'vertical.ticketPicker' && eventsLiveItems.length === 0 && (
        <PropsCollapsible title="Order summary" preview="Titles, notes, checkout button" defaultOpen>
          <div className="space-y-2">
            {inputRow({ label: 'Order summary title', fieldKey: 'order_title', placeholder: 'Your order' })}
            {inputRow({ label: 'Max tickets per order', fieldKey: 'max_per_order', placeholder: '8', deletable: false })}
            {inputRow({ label: 'Age restriction note', fieldKey: 'age_note', placeholder: '21+ event · ID required at door' })}
            {inputRow({ label: 'Seating chart title', fieldKey: 'seating_title', placeholder: 'Seating chart' })}
            {inputRow({ label: 'Checkout button', fieldKey: 'cta', placeholder: 'Continue to checkout' })}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={(p as any).showSeating !== false}
                onChange={e => onUpdate({ showSeating: e.target.checked } as any)}
                className="rounded accent-primary w-4 h-4"
              />
              <span className="text-xs font-medium text-gray-700">Show seating chart</span>
            </label>
          </div>
        </PropsCollapsible>
      )}

      {block.block_type === 'vertical.eventListing' && (
        <PropsCollapsible title="Section header" preview="Title, subtitle, buttons" defaultOpen>
          <div className="space-y-2">
            {inputRow({ label: 'Section title', fieldKey: 'header_title', placeholder: 'Upcoming events' })}
            {inputRow({ label: 'Section subtitle', fieldKey: 'header_subtitle', placeholder: 'Leave empty to auto-show event count' })}
            {inputRow({ label: "'All events' button", fieldKey: 'all_events_label', placeholder: 'All events' })}
            {inputRow({ label: 'Ticket button', fieldKey: 'cta', placeholder: 'Get tickets' })}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={(p as any).showTag !== false}
                onChange={e => onUpdate({ showTag: e.target.checked } as any)}
                className="rounded accent-primary w-4 h-4"
              />
              <span className="text-xs font-medium text-gray-700">Show event tag badge</span>
            </label>
          </div>
        </PropsCollapsible>
      )}

      {block.block_type === 'vertical.courseCatalog' && (
        <PropsCollapsible title="Section header" preview="Title, subtitle, buttons" defaultOpen>
          <div className="space-y-2">
            {inputRow({ label: 'Section title', fieldKey: 'header_title', placeholder: 'Featured courses' })}
            {inputRow({ label: 'Section subtitle', fieldKey: 'header_subtitle', placeholder: 'Leave empty to auto-show course count' })}
            {inputRow({ label: "'All courses' button", fieldKey: 'all_courses_label', placeholder: 'All courses' })}
            {inputRow({ label: 'Enroll button', fieldKey: 'cta', placeholder: 'Enroll' })}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={(p as any).showInstructor !== false}
                onChange={e => onUpdate({ showInstructor: e.target.checked } as any)}
                className="rounded accent-primary w-4 h-4"
              />
              <span className="text-xs font-medium text-gray-700">Show instructor name</span>
            </label>
          </div>
        </PropsCollapsible>
      )}

      {block.block_type === 'vertical.fitnessSchedule' && (
        <PropsCollapsible title="Section header" preview="Title, subtitle, buttons" defaultOpen>
          <div className="space-y-2">
            {inputRow({ label: 'Section title', fieldKey: 'header_title', placeholder: "Today's classes" })}
            {inputRow({ label: 'Section subtitle', fieldKey: 'header_subtitle', placeholder: 'Leave empty to auto-show class count' })}
            {inputRow({ label: 'Reserve button', fieldKey: 'cta', placeholder: 'Reserve' })}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={(p as any).showInstructor !== false}
                onChange={e => onUpdate({ showInstructor: e.target.checked } as any)}
                className="rounded accent-primary w-4 h-4"
              />
              <span className="text-xs font-medium text-gray-700">Show instructor name</span>
            </label>
          </div>
        </PropsCollapsible>
      )}

      {isCourseDetailBlock && (
        <PropsCollapsible title="Course" preview="Which course to show" defaultOpen>
          <div className="space-y-2">
            {coursesLiveItems.length === 0 ? (
              <p className="text-[11px] text-muted-foreground leading-snug">
                No courses in Sales → Course Catalog yet — showing a demo course. Add one there to connect this page.
              </p>
            ) : (
              <>
                <label className="block text-xs font-medium text-gray-700">Course</label>
                <Select
                  value={String((p as any).courseId ?? '')}
                  onChange={v => onUpdate({ courseId: v } as any)}
                  options={coursesLiveItems.map(item => ({
                    value: item.id ?? '',
                    label: `${item.title}${item.meta?.is_active === false ? ' (Hidden — won\u2019t show)' : ''}`,
                  }))}
                  className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs"
                />
                {(p as any).courseId && coursesLiveItems.find(item => item.id === (p as any).courseId)?.meta?.is_active === false && (
                  <p className="text-[11px] text-amber-700 leading-snug">
                    This course is hidden in Course Catalog, so a different active course is shown instead.
                  </p>
                )}
              </>
            )}
            <a
              href="/sales/courses"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              Open Course Catalog →
            </a>
          </div>
        </PropsCollapsible>
      )}

      {block.block_type === 'vertical.courseDetail' && coursesLiveItems.length === 0 && (
        <PropsCollapsible title="Course details" preview="Image, title, instructor, pricing" defaultOpen>
          <div className="space-y-2">
            <InlineMediaPicker
              siteId={siteId}
              value={String((p as any).image_url ?? '')}
              label="Course banner image"
              onChange={url => onUpdate({ image_url: url } as any)}
            />
            {inputRow({ label: 'Title', fieldKey: 'title', placeholder: 'Foundations of Modern Ceramics' })}
            {inputRow({ label: 'Description', fieldKey: 'description', multiline: true, placeholder: 'Wheel throwing, hand-building, and your first three glazed pieces.' })}
            {inputRow({ label: 'Instructor', fieldKey: 'instructor', placeholder: 'Naomi Reyes' })}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Level</label>
              <div className="flex gap-1.5">
                {['Beginner', 'Intermediate', 'Advanced'].map(lvl => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onUpdate({ level: lvl } as any)}
                    className={cn(
                      'flex-1 py-1.5 px-2 rounded-lg border text-xs font-semibold transition-colors',
                      (((p as any).level as string) ?? 'Beginner') === lvl
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40',
                    )}
                  >{lvl}</button>
                ))}
              </div>
            </div>
            {inputRow({ label: 'Category', fieldKey: 'category', placeholder: 'Craft' })}
            {inputRow({ label: 'Duration', fieldKey: 'duration', placeholder: '6 weeks' })}
            {inputRow({ label: 'Lessons', fieldKey: 'lessons', placeholder: '24', deletable: false })}
            {inputRow({ label: 'Rating', fieldKey: 'rating', placeholder: '4.9', deletable: false })}
            {inputRow({ label: 'Reviews', fieldKey: 'reviews', placeholder: '412', deletable: false })}
            {inputRow({ label: 'Price', fieldKey: 'price', placeholder: '189', deletable: false })}
            {inputRow({ label: 'Currency', fieldKey: 'currency', placeholder: 'USD', deletable: false })}
            {inputRow({ label: 'Enrolled note', fieldKey: 'enrolled_label', placeholder: '2,400+ enrolled' })}
            {inputRow({ label: 'Enroll button', fieldKey: 'cta', placeholder: 'Enroll for' })}
            {inputRow({ label: 'Preview button', fieldKey: 'preview_cta', placeholder: 'Try free preview' })}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={(p as any).showOutcomes !== false}
                onChange={e => onUpdate({ showOutcomes: e.target.checked } as any)}
                className="rounded accent-primary w-4 h-4"
              />
              <span className="text-xs font-medium text-gray-700">Show learning outcomes</span>
            </label>
          </div>
        </PropsCollapsible>
      )}

      {block.block_type === 'vertical.courseDetail' && coursesLiveItems.length === 0 && (
        <PropsCollapsible title="Learning outcomes" preview={`${(((p as any).outcomes as string[]) || []).length} item(s)`} defaultOpen>
          <TextListEditor
            items={((p as any).outcomes as string[]) || []}
            placeholder="Throw a balanced cylinder, bowl, and mug"
            addLabel="Add outcome"
            onChange={next => onUpdate({ outcomes: next } as any)}
          />
        </PropsCollapsible>
      )}

      {block.block_type === 'vertical.courseDetail' && coursesLiveItems.length === 0 && (
        <PropsCollapsible title="What's included" preview={`${(((p as any).perks as { text: string }[]) || []).length} item(s)`} defaultOpen>
          <PerkListEditor
            items={((p as any).perks as { icon?: string; text: string }[]) || []}
            onChange={next => onUpdate({ perks: next } as any)}
          />
        </PropsCollapsible>
      )}

      {isPropertyDetailBlock && (
        <PropsCollapsible title="Listing" preview="Which property to show" defaultOpen>
          <div className="space-y-2">
            {propertiesLiveItems.length === 0 ? (
              <p className="text-[11px] text-muted-foreground leading-snug">
                No listings in Sales → Property Listings yet — showing a demo listing. Add one there to connect this page.
              </p>
            ) : (
              <>
                <label className="block text-xs font-medium text-gray-700">Property</label>
                <Select
                  value={String((p as any).propertyId ?? '')}
                  onChange={v => onUpdate({ propertyId: v } as any)}
                  options={propertiesLiveItems.map(item => ({
                    value: item.id ?? '',
                    label: `${item.title}${item.meta?.is_active === false ? ' (Hidden — won\u2019t show)' : ''}`,
                  }))}
                  className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs"
                />
                {(p as any).propertyId && propertiesLiveItems.find(item => item.id === (p as any).propertyId)?.meta?.is_active === false && (
                  <p className="text-[11px] text-amber-700 leading-snug">
                    This listing is hidden in Property Listings, so a different active listing is shown instead.
                  </p>
                )}
              </>
            )}
            {inputRow({ label: 'Tour button', fieldKey: 'cta', placeholder: 'Schedule tour' })}
            <a
              href="/sales/properties"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              Open Property Listings →
            </a>
          </div>
        </PropsCollapsible>
      )}

      {block.block_type === 'vertical.propertyListing' && (
        <PropsCollapsible title="Section header" preview="Title, subtitle, buttons" defaultOpen>
          <div className="space-y-2">
            {inputRow({ label: 'Section title', fieldKey: 'header_title', placeholder: 'Featured listings' })}
            {inputRow({ label: 'Section subtitle', fieldKey: 'header_subtitle', placeholder: 'Leave empty to auto-show listing count' })}
            {inputRow({ label: "'Refine search' button", fieldKey: 'refine_label', placeholder: 'Refine search' })}
            {inputRow({ label: 'Agent button', fieldKey: 'cta', placeholder: 'View details' })}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={(p as any).showAgent !== false}
                onChange={e => onUpdate({ showAgent: e.target.checked } as any)}
                className="rounded accent-primary w-4 h-4"
              />
              <span className="text-xs font-medium text-gray-700">Show listing agent</span>
            </label>
          </div>
        </PropsCollapsible>
      )}

      {block.block_type === 'state.empty' && (
        <PropsCollapsible title="Empty message" preview="Icon, title, description, buttons" defaultOpen>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Empty state type (icon)</label>
              <Select
                value={(p as any).preset ?? 'emptyCart'}
                onChange={v => onUpdate({ preset: v } as any)}
                options={[
                  { value: 'emptyCart', label: 'Empty cart' },
                  { value: 'noResults', label: 'No search results' },
                  { value: 'emptyWishlist', label: 'Empty wishlist' },
                  { value: 'noBookings', label: 'No bookings' },
                  { value: 'noOrders', label: 'No orders' },
                  { value: 'outOfStock', label: 'Out of stock' },
                ]}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-white"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">Only changes the icon — edit the text below directly.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Size</label>
              <div className="flex gap-1.5">
                {(['sm', 'md', 'lg'] as const).map(sz => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onUpdate({ size: sz } as any)}
                    className={cn(
                      'flex-1 py-1.5 px-2 rounded-lg border text-xs font-semibold transition-colors uppercase',
                      (((p as any).size as string) ?? 'md') === sz
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40',
                    )}
                  >{sz}</button>
                ))}
              </div>
            </div>
            {inputRow({ label: 'Title', fieldKey: 'title', placeholder: 'Your cart is empty' })}
            {inputRow({ label: 'Description', fieldKey: 'description', multiline: true, placeholder: "Looks like you haven't added anything yet." })}
            {inputRow({ label: 'Primary button', fieldKey: 'cta', placeholder: 'Start shopping' })}
            {inputRow({ label: 'Secondary button', fieldKey: 'secondary_cta', placeholder: 'View wishlist' })}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={(p as any).showSecondary !== false}
                onChange={e => onUpdate({ showSecondary: e.target.checked } as any)}
                className="rounded accent-primary w-4 h-4"
              />
              <span className="text-xs font-medium text-gray-700">Show secondary button</span>
            </label>
          </div>
        </PropsCollapsible>
      )}

      {block.block_type === 'state.skeleton' && (
        <PropsCollapsible title="Skeleton shape" preview="Content type, item count" defaultOpen>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Content type</label>
              <Select
                value={(p as any).preset ?? 'productGrid'}
                onChange={v => onUpdate({ preset: v } as any)}
                options={[
                  { value: 'productGrid', label: 'Product grid' },
                  { value: 'productList', label: 'Product list' },
                  { value: 'detail', label: 'Detail page' },
                  { value: 'cart', label: 'Cart' },
                  { value: 'calendar', label: 'Calendar' },
                  { value: 'table', label: 'Table' },
                ]}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-white"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">Shape of the loading placeholder — pick whatever this section replaces while it loads.</p>
            </div>
            {(((p as any).preset ?? 'productGrid') === 'productGrid' || ((p as any).preset ?? 'productGrid') === 'productList' || (p as any).preset === 'cart' || (p as any).preset === 'table') && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Item count</label>
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={Number((p as any).count ?? 6)}
                  onChange={e => onUpdate({ count: Math.max(2, Math.min(12, Number(e.target.value) || 6)) } as any)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs"
                />
              </div>
            )}
          </div>
        </PropsCollapsible>
      )}

      {block.block_type === 'state.error' && (
        <PropsCollapsible title="Error message" preview="Code, title, description, buttons" defaultOpen>
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Error type (icon)</label>
              <Select
                value={(p as any).preset ?? 'generic'}
                onChange={v => onUpdate({ preset: v } as any)}
                options={[
                  { value: 'generic', label: 'Generic error' },
                  { value: 'network', label: 'Network / offline' },
                  { value: 'notFound', label: '404 not found' },
                  { value: 'serverError', label: '500 server error' },
                  { value: 'forbidden', label: '403 forbidden' },
                  { value: 'maintenance', label: 'Maintenance' },
                ]}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs bg-white"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">Only changes the icon — edit the text below directly.</p>
            </div>
            {inputRow({ label: 'Code / eyebrow', fieldKey: 'error_code', placeholder: 'Oops' })}
            {inputRow({ label: 'Title', fieldKey: 'title', placeholder: 'Something went wrong' })}
            {inputRow({ label: 'Description', fieldKey: 'description', multiline: true, placeholder: 'We hit an unexpected snag. Try again, or contact support if it persists.' })}
            {inputRow({ label: 'Primary button', fieldKey: 'cta', placeholder: 'Try again' })}
            {inputRow({ label: 'Secondary button', fieldKey: 'secondary_cta', placeholder: 'Go back' })}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={(p as any).showSecondary !== false}
                onChange={e => onUpdate({ showSecondary: e.target.checked } as any)}
                className="rounded accent-primary w-4 h-4"
              />
              <span className="text-xs font-medium text-gray-700">Show secondary button</span>
            </label>
          </div>
        </PropsCollapsible>
      )}

      {block.block_type === 'vertical.autoInventory' && (
        <PropsCollapsible title="Section header" preview="Title, subtitle, filter" defaultOpen>
          <div className="space-y-2">
            {inputRow({ label: 'Section title', fieldKey: 'header_title', placeholder: 'Available inventory' })}
            {inputRow({ label: 'Section subtitle', fieldKey: 'header_subtitle', placeholder: 'Leave empty to auto-show vehicle count' })}
            {inputRow({ label: 'View vehicle button', fieldKey: 'cta', placeholder: 'View vehicle' })}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={(p as any).showFilters !== false}
                onChange={e => onUpdate({ showFilters: e.target.checked } as any)}
                className="rounded accent-primary w-4 h-4"
              />
              <span className="text-xs font-medium text-gray-700">Show price filter slider</span>
            </label>
          </div>
        </PropsCollapsible>
      )}

      {isVehicleDetailBlock && (
        <PropsCollapsible title="Section header" preview="Title, subtitle above the page" defaultOpen>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Shown above the vehicle detail card(s) on the page. Everything else — specs, pricing, test-drive button — comes from each vehicle in Vehicle Inventory once connected.
            </p>
            {inputRow({ label: 'Section title', fieldKey: 'header_title', placeholder: vehiclesLiveItems.length > 0 ? 'Available vehicles' : 'Leave empty to hide' })}
            {inputRow({ label: 'Section subtitle', fieldKey: 'header_subtitle', placeholder: 'Leave empty to auto-show vehicle count' })}
          </div>
        </PropsCollapsible>
      )}

      {isVehicleDetailBlock && vehiclesLiveItems.length > 0 && (
        <PropsCollapsible title="Vehicles" preview={`${activeVehiclesCount} full detail card${activeVehiclesCount === 1 ? '' : 's'}`} defaultOpen>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Every active vehicle from Vehicle Inventory gets its own full spec/highlights/pricing card (including its own test-drive button label) on this page, stacked in the order they're sorted there. Manage each vehicle's details there.
            </p>
            <a
              href="/sales/vehicles"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              Open Vehicle Inventory →
            </a>
          </div>
        </PropsCollapsible>
      )}

      {block.block_type === 'vertical.vehicleDetail' && vehiclesLiveItems.length === 0 && (
        <PropsCollapsible title="Vehicle details" preview="Photo, spec, pricing" defaultOpen>
          <div className="space-y-2">
            <InlineMediaPicker
              siteId={siteId}
              value={String((p as any).image_url ?? '')}
              label="Vehicle photo"
              onChange={url => onUpdate({ image_url: url } as any)}
            />
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Condition</label>
              <div className="flex gap-1.5">
                {['New', 'Certified', 'Used'].map(cond => (
                  <button
                    key={cond}
                    type="button"
                    onClick={() => onUpdate({ condition: cond } as any)}
                    className={cn(
                      'flex-1 py-1.5 px-2 rounded-lg border text-xs font-semibold transition-colors',
                      (((p as any).condition as string) ?? 'New') === cond
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40',
                    )}
                  >{cond}</button>
                ))}
              </div>
            </div>
            {inputRow({ label: 'Year', fieldKey: 'year', placeholder: '2025', deletable: false })}
            {inputRow({ label: 'Make', fieldKey: 'make', placeholder: 'Rivian', deletable: false })}
            {inputRow({ label: 'Model', fieldKey: 'model', placeholder: 'R1S', deletable: false })}
            {inputRow({ label: 'Trim', fieldKey: 'trim', placeholder: 'Adventure' })}
            {inputRow({ label: 'Exterior color', fieldKey: 'exteriorColor', placeholder: 'Forest Green' })}
            {inputRow({ label: 'Body style', fieldKey: 'bodyStyle', placeholder: 'SUV' })}
            {inputRow({ label: 'Mileage', fieldKey: 'mileage', placeholder: '12', deletable: false })}
            {inputRow({ label: 'Fuel type', fieldKey: 'fuel', placeholder: 'Electric' })}
            {inputRow({ label: 'Transmission', fieldKey: 'transmission', placeholder: 'Auto' })}
            {inputRow({ label: 'Price', fieldKey: 'price', placeholder: '84900', deletable: false })}
            {inputRow({ label: 'Currency', fieldKey: 'currency', placeholder: 'USD', deletable: false })}
            {inputRow({ label: 'Stock number', fieldKey: 'stock_number', placeholder: 'AC-V1-2025' })}
            {inputRow({ label: 'Location note', fieldKey: 'location_note', multiline: true, placeholder: 'Located at our Williamsburg showroom · Available for delivery' })}
            {inputRow({ label: 'Test-drive button', fieldKey: 'cta', placeholder: 'Schedule test drive' })}
          </div>
        </PropsCollapsible>
      )}

      {isRecurringBlock && (
        <PropsCollapsible title="Section header" preview="Title, subtitle above the page" defaultOpen>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Shown above the recurring booking widget(s) on the page. Everything else — frequency options, pricing, upcoming sessions — comes from each plan in Recurring Bookings once connected.
            </p>
            {inputRow({ label: 'Section title', fieldKey: 'header_title', placeholder: recurringLiveItems.length > 0 ? 'Book your sessions' : 'Leave empty to hide' })}
            {inputRow({ label: 'Section subtitle', fieldKey: 'header_subtitle', placeholder: 'Leave empty to auto-show plan count' })}
          </div>
        </PropsCollapsible>
      )}

      {isRecurringBlock && recurringLiveItems.length > 0 && (
        <PropsCollapsible title="Recurring plans" preview={`${activeRecurringCount} full booking widget${activeRecurringCount === 1 ? '' : 's'}`} defaultOpen>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Every active plan from Recurring Bookings gets its own full booking widget (frequency picker, session counter, upcoming sessions, price summary) on this page, stacked in the order they're sorted there. Manage each plan's details there.
            </p>
            <a
              href="/sales/recurring-bookings"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              Open Recurring Bookings →
            </a>
          </div>
        </PropsCollapsible>
      )}

      {isRecurringBlock && recurringLiveItems.length === 0 && (
        <PropsCollapsible title="Recurring plan details" preview="Service, schedule, pricing" defaultOpen>
          <div className="space-y-2">
            <InlineMediaPicker
              siteId={siteId}
              value={String((p as any).image_url ?? '')}
              label="Plan banner image"
              onChange={url => onUpdate({ image_url: url } as any)}
            />
            {inputRow({ label: 'Service name', fieldKey: 'title', placeholder: 'Weekly Yoga · Vinyasa Flow' })}
            {inputRow({ label: 'Start date', fieldKey: 'startDate', placeholder: 'Mon, May 4' })}
            {inputRow({ label: 'Time', fieldKey: 'time', placeholder: '7:30 AM · 60 min' })}
            {inputRow({ label: 'Price per session', fieldKey: 'pricePerSession', placeholder: '22', deletable: false })}
            {inputRow({ label: 'Currency', fieldKey: 'currency', placeholder: 'USD', deletable: false })}
            {inputRow({ label: 'Default sessions', fieldKey: 'defaultSessionCount', placeholder: '8', deletable: false })}
            {inputRow({ label: 'Min sessions', fieldKey: 'minSessions', placeholder: '2', deletable: false })}
            {inputRow({ label: 'Max sessions', fieldKey: 'maxSessions', placeholder: '24', deletable: false })}
            {inputRow({ label: 'Confirm button', fieldKey: 'cta', placeholder: 'Confirm series' })}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={(p as any).showUpcoming !== false}
                onChange={e => onUpdate({ showUpcoming: e.target.checked } as any)}
                className="rounded accent-primary w-4 h-4"
              />
              <span className="text-xs font-medium text-gray-700">Show upcoming sessions list</span>
            </label>
          </div>
        </PropsCollapsible>
      )}

      {isWizardBlock && (
        <PropsCollapsible title="Section header" preview="Title, subtitle above the wizard" defaultOpen>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Shown above the step indicator. The steps themselves — labels and descriptions — are managed in Sales → Booking Wizard, not here.
            </p>
            {inputRow({ label: 'Section title', fieldKey: 'header_title', placeholder: 'New booking' })}
            {inputRow({ label: 'Section subtitle', fieldKey: 'header_subtitle', placeholder: 'Leave empty to hide' })}
          </div>
        </PropsCollapsible>
      )}

      {isWizardBlock && (
        <PropsCollapsible title="Wizard steps" preview={`${activeWizardStepsCount} step${activeWizardStepsCount === 1 ? '' : 's'}`} defaultOpen>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Every active step from Booking Wizard appears here, in order. Add, edit, reorder, or delete steps there.
            </p>
            <a
              href="/sales/booking-wizard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              Open Booking Wizard →
            </a>
          </div>
        </PropsCollapsible>
      )}

      {isWizardBlock && (
        <PropsCollapsible
          title="Current step status"
          preview={typeof (p as any).current_step === 'number' && activeWizardSteps[(p as any).current_step] ? `Step ${(p as any).current_step + 1}: ${activeWizardSteps[(p as any).current_step].title}` : 'Auto (demo default)'}
        >
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Choose which step should show as done / current / upcoming in this section — e.g. to show visitors
              "you are here" on an order-confirmation or status page. Leave on Auto to keep the built-in interactive
              demo (visitors can click Back / Continue).
            </p>
            <Select
              value={typeof (p as any).current_step === 'number' ? String((p as any).current_step) : ''}
              onChange={v => onUpdate({ current_step: v === '' ? undefined : Number(v) } as any)}
              options={[
                { value: '', label: 'Auto (demo default)' },
                ...activeWizardSteps.map((item, idx) => ({
                  value: String(idx),
                  label: `${idx + 1}. ${item.title || `Step ${idx + 1}`}`,
                })),
              ]}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            />
          </div>
        </PropsCollapsible>
      )}

      {isResourceBlock && (
        <PropsCollapsible title="Section header" preview="Title, subtitle above the resources" defaultOpen>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Shown above the resource cards. The resources themselves — name, description, price, features — are
              managed in Sales → Resources, not here.
            </p>
            {inputRow({ label: 'Section title', fieldKey: 'header_title', placeholder: 'Pick a resource' })}
            {inputRow({ label: 'Section subtitle', fieldKey: 'header_subtitle', placeholder: 'Leave empty to hide' })}
          </div>
        </PropsCollapsible>
      )}

      {isResourceBlock && (
        <PropsCollapsible title="Resources" preview={`${activeResourcesCount} resource${activeResourcesCount === 1 ? '' : 's'}`} defaultOpen>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground leading-snug">
              Every active resource from Resources appears here, in order. Add, edit, reorder, or delete resources there.
            </p>
            <a
              href="/sales/booking-resources"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              Open Resources →
            </a>
          </div>
        </PropsCollapsible>
      )}

      {isResourceBlock && (
        <PropsCollapsible title="Display options" preview={`${(p as any).showFeatures !== false ? 'Features on' : 'Features off'} · ${(p as any).showPrice !== false ? 'Price on' : 'Price off'}`}>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(p as any).showFeatures !== false}
                onChange={e => onUpdate({ showFeatures: e.target.checked } as any)}
                className="rounded accent-primary w-4 h-4"
              />
              <span className="text-xs font-medium text-gray-700">Show feature tags</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(p as any).showPrice !== false}
                onChange={e => onUpdate({ showPrice: e.target.checked } as any)}
                className="rounded accent-primary w-4 h-4"
              />
              <span className="text-xs font-medium text-gray-700">Show price per hour</span>
            </label>
            {inputRow({ label: 'Reserve button', fieldKey: 'cta', placeholder: 'Reserve' })}
          </div>
        </PropsCollapsible>
      )}

      {itemSchema && !isCategoryBlock && !isPlansBlock && !isPropertiesBlock && !isCoursesBlock && !isFitnessBlock && !isVehiclesBlock && !(isEventsBlock && eventsLiveItems.length > 0) && !(isRecurringBlock && recurringLiveItems.length > 0) && !(isTestimonialsBlock && testimonialsLiveItems.length > 0) && (
        <PropsCollapsible
          title={itemListSectionTitle(block.block_type, itemSchema)}
          preview={`${subEditorItems.length} item(s)`}
          defaultOpen={ITEM_LIST_DEFAULT_OPEN.has(block.block_type)}
        >
          {renderSubItemEditor('items')}
        </PropsCollapsible>
      )}

      {block.block_type === 'marquee_strip' && hasImageShape && (
        <PropsCollapsible
          title="Item image shape"
          preview={String((p as any).image_shape ?? 'rounded')}
          defaultOpen={false}
        >
          <p className="text-[10px] text-muted-foreground leading-snug mb-2">
            Applies to every marquee item that has an image (rounded, circle, pill, etc.).
          </p>
          {imageShapePicker}
        </PropsCollapsible>
      )}
          </>
        )}

        {editorTab === 'layout' && (
          <div className="flex flex-col gap-1.5">
            {sectionLayoutCount > 0 && onOpenLayoutPicker && onCycleLayout ? (
              <PropsAccordionSection
                id="style"
                activeId={layoutAccordionOpen}
                onActivate={activateLayoutAccordion}
                title="Section style"
                preview={layoutStylePreview}
              >
                <SectionLayoutControls
                  embedded
                  block={block}
                  currentProps={p as Record<string, unknown>}
                  onOpenLayoutPicker={onOpenLayoutPicker}
                  onCycleLayout={onCycleLayout}
                  onSelectLayoutIndex={onSelectLayoutIndex}
                />
              </PropsAccordionSection>
            ) : null}

            {hasImageShape ? (
              <PropsAccordionSection
                id="image-shape"
                activeId={layoutAccordionOpen}
                onActivate={activateLayoutAccordion}
                title={block.block_type === 'marquee_strip' ? 'Item image shape' : 'Tile image shape'}
                preview={String((p as any).image_shape ?? (block.block_type === 'team_grid' ? 'circle' : 'rounded'))}
              >
                {imageShapePicker}
              </PropsAccordionSection>
            ) : null}

            {layoutField ? (
              <PropsAccordionSection
                id="layout-variant"
                activeId={layoutAccordionOpen}
                onActivate={activateLayoutAccordion}
                title="Layout variant"
                preview={String(p.layout || '')}
              >
                {layoutField}
              </PropsAccordionSection>
            ) : null}

            {block.block_type === 'marquee_strip' ? (
              <PropsAccordionSection
                id="marquee-spacing"
                activeId={layoutAccordionOpen}
                onActivate={activateLayoutAccordion}
                title="Item spacing"
                preview={`${subGap}px between items`}
              >
                <PanelSliderRow
                  label="Space between items"
                  value={subGap}
                  min={8}
                  max={120}
                  step={4}
                  unit="px"
                  onCommit={n => {
                    setSubGap(n)
                    onPreview({ item_gap: n } as any)
                    onUpdate({ item_gap: n } as any)
                  }}
                />
              </PropsAccordionSection>
            ) : null}

            {itemSchema && !isCatalogGridBlock && block.block_type !== 'marquee_strip' && block.block_type !== 'timeline' && block.block_type !== 'service.faq' && block.block_type !== 'service.process' && block.block_type !== 'service.team' && block.block_type !== 'payment_methods_strip' ? (
              <PropsAccordionSection
                id="grid"
                activeId={layoutAccordionOpen}
                onActivate={activateLayoutAccordion}
                title="Grid & spacing"
                preview={`${subColumns} col · ${subGap}px gap`}
              >
                {renderSubItemEditor('layout')}
              </PropsAccordionSection>
            ) : null}

            {isCatalogGridBlock ? (
              <PropsAccordionSection
                id="grid"
                activeId={layoutAccordionOpen}
                onActivate={activateLayoutAccordion}
                title="Grid & spacing"
                preview={catalogGridPreview}
              >
                <CatalogGridLayoutControls
                  blockType={block.block_type}
                  props={p as Record<string, unknown>}
                  onUpdate={onUpdate}
                  onPreview={onPreview}
                />
              </PropsAccordionSection>
            ) : null}

            <PropsAccordionSection
              id="spacing"
              activeId={layoutAccordionOpen}
              onActivate={activateLayoutAccordion}
              title="Section spacing"
              preview={sectionSpacingPreview}
            >
              <SectionSpacingBreakpointTabs
                active={previewDevice}
                onChange={bp => onPreviewDeviceChange?.(bp)}
              />
              <SectionSpacingField
                label="Section size"
                value={Math.round(sectionScale * 100)}
                min={50}
                max={200}
                step={5}
                unit="%"
                hint="Scales content and spacing for this device."
                onPreview={v => {
                  const n = Number((v / 100).toFixed(2))
                  setSectionScale(n)
                  pushSectionSpacing({ section_scale: n }, true)
                }}
                onCommit={v => {
                  const n = Number((v / 100).toFixed(2))
                  setSectionScale(n)
                  pushSectionSpacing({ section_scale: n }, false)
                }}
              />
              {block.block_type === 'nav' && navHeaderBarSize != null ? (
                <div className="space-y-2 border-t border-border/50 pt-2">
                  <SectionSpacingField
                    label="Header bar size"
                    value={navHeaderBarSize}
                    min={NAV_HEADER_BAR_SIZE_RANGE.min}
                    max={NAV_HEADER_BAR_SIZE_RANGE.max}
                    step={NAV_HEADER_BAR_SIZE_RANGE.step}
                    unit="px"
                    hint="Only changes nav bar height. Does not affect Section size."
                    onPreview={n => onPreview({ header_bar_size: n })}
                    onCommit={n => onUpdate({ header_bar_size: n })}
                  />
                </div>
              ) : null}
              <div className="space-y-2 border-t border-border/50 pt-2">
                <SectionSpacingField
                  label="Top padding"
                  value={paddingTop}
                  min={0}
                  max={320}
                  step={4}
                  unit="px"
                  onPreview={n => {
                    setPaddingTop(n)
                    pushSectionSpacing({ padding_top: n }, true)
                  }}
                  onCommit={n => {
                    setPaddingTop(n)
                    pushSectionSpacing({ padding_top: n }, false)
                  }}
                />
                <SectionSpacingField
                  label="Bottom padding"
                  value={paddingBottom}
                  min={0}
                  max={320}
                  step={4}
                  unit="px"
                  onPreview={n => {
                    setPaddingBottom(n)
                    pushSectionSpacing({ padding_bottom: n }, true)
                  }}
                  onCommit={n => {
                    setPaddingBottom(n)
                    pushSectionSpacing({ padding_bottom: n }, false)
                  }}
                />
              </div>
            </PropsAccordionSection>

            <PropsAccordionSection
              id="shapes"
              activeId={layoutAccordionOpen}
              onActivate={activateLayoutAccordion}
              title="Origins (section shapes)"
              preview={sectionShapesPreview}
            >
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Top edge shape</div>
                <div className="grid grid-cols-3 gap-1">
                  {SHAPE_OPTIONS.map(({ id, label }) => (
                    <button
                      key={`top-${id}`}
                      type="button"
                      onClick={() => onUpdate({ top_shape: id === 'none' ? null : id } as any)}
                      className={cn(
                        'truncate rounded border px-1 py-1.5 text-center text-xs font-medium transition-colors',
                        ((p as any).top_shape || 'none') === id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/40',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Bottom edge shape</div>
                <div className="grid grid-cols-3 gap-1">
                  {SHAPE_OPTIONS.map(({ id, label }) => (
                    <button
                      key={`bot-${id}`}
                      type="button"
                      onClick={() => onUpdate({ bottom_shape: id === 'none' ? null : id } as any)}
                      className={cn(
                        'truncate rounded border px-1 py-1.5 text-center text-xs font-medium transition-colors',
                        ((p as any).bottom_shape || 'none') === id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/40',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {(((p as any).top_shape && (p as any).top_shape !== 'none') || ((p as any).bottom_shape && (p as any).bottom_shape !== 'none')) && (
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="color"
                    value={(p as any).shape_color || '#ffffff'}
                    onChange={e => onUpdate({ shape_color: e.target.value } as any)}
                    className={builderPanelUi.colorInput}
                  />
                  <div>
                    <div className="text-xs font-medium text-foreground">Shape fill color</div>
                    <div className={builderPanelUi.hint}>Match the next section background</div>
                  </div>
                </div>
              )}
            </PropsAccordionSection>
          </div>
        )}

        {editorTab === 'design' && (
          <>
      {sectionAndCardColorsPanel}

      {block.block_type === 'footer' && (
        <SectionPanelGroup
          title="Footer colors"
          description="Background and text colors for this footer."
        >
          <div className="grid grid-cols-1 @[240px]:grid-cols-2 gap-1.5">
            {([
              { key: 'footer_bg' as const, label: 'Background', fallback: themeColors.surface_color || '#f9fafb' },
              { key: 'footer_heading' as const, label: 'Headings', fallback: themeColors.text_color || '#111827' },
              { key: 'footer_muted' as const, label: 'Links & muted text', fallback: '#64748b' },
              { key: 'footer_border' as const, label: 'Border', fallback: '#e2e8f0' },
            ]).map(({ key, label, fallback }) => (
              <PanelColorRow
                key={key}
                label={label}
                value={String((p as any)[key] || fallback)}
                fallback={fallback}
                onChange={c => {
                  onPreview({ [key]: c } as any)
                  onUpdate({ [key]: c } as any)
                }}
                onReset={(p as any)[key] ? () => {
                  onPreview({ [key]: null } as any)
                  onUpdate({ [key]: null } as any)
                } : undefined}
              />
            ))}
          </div>
        </SectionPanelGroup>
      )}

      {(bgStyleField || gradientField) && (
        <SectionPanelGroup
          title="Section appearance"
          description="Background style for this block."
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
          </div>
        </SectionPanelGroup>
      )}
          </>
        )}

        {editorTab === 'media' && (
          <>
      {block.block_type === 'video_embed' && siteId && (
        <VideoEmbedSourceEditor
          blockId={block.id}
          siteId={siteId}
          videoUrl={String((p as any).video_url ?? '')}
          onPreview={url => onPreview({ video_url: url } as Partial<BlockProps>)}
          onCommit={url => onUpdate({ video_url: url } as Partial<BlockProps>)}
        />
      )}
      {heroImageField}
      {isHeroBlock && usesBgImage && (
        <PropsCollapsible
          title="Banner carousel"
          preview={(p as any).banner_carousel === false ? 'Off' : 'On'}
        >
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(p as any).banner_carousel !== false}
              onChange={e => onUpdate({ banner_carousel: e.target.checked } as any)}
              className="rounded accent-primary"
            />
            <span className="text-xs text-gray-600">Rotate multiple banners</span>
          </label>
          <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
            When on, your hero image and store banners from Settings cycle automatically. Turn off to keep only the primary image.
          </p>
        </PropsCollapsible>
      )}
      {bgImageField}
      {imageUrlField}
      {block.block_type === 'nav' && (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground leading-snug">
          Logo image and brand visibility are under <span className="font-semibold text-foreground">Content → Logo &amp; brand</span>.
        </p>
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
              checked={(block as any)[key] !== false}
              onChange={e => onUpdate({ [key]: e.target.checked } as any)}
              className="rounded accent-primary"
            />
            <span className="text-xs text-gray-600">{label}</span>
          </label>
        ))}

        <BranchVisibilitySelector
          visibleBranches={((block.props ?? {}) as any)._visible_branches ?? null}
          onChange={branches => onUpdate({ _visible_branches: branches } as any)}
        />
      </PropsCollapsible>

      <BlockBreakpointStyles
        styleOverrides={readRawBlockStyleOverrides(block) as any}
        onChange={overrides => onUpdate({ style_overrides: overrides } as any)}
        previewDevice={previewDevice}
        onPreviewDeviceChange={onPreviewDeviceChange}
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
    <div key={key} className="flex items-center gap-1.5">
      <input
        type="color"
        value={(pageOverrides[key] as string) || (effective[key as keyof StyleConfig] as string) || fallback}
        onChange={e => activePageId && onPageStyleChange(activePageId, { [key]: e.target.value })}
        className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-border bg-background p-0.5"
      />
      <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-foreground">{label}</span>
      <span className="shrink-0 text-[9px] text-muted-foreground font-mono">
        {(pageOverrides[key] as string) ? 'Custom' : 'Default'}
      </span>
      {pageOverrides[key] != null && activePageId && (
        <button
          type="button"
          onClick={() => onPageStyleChange(activePageId, { [key]: undefined } as PageStyleOverrides)}
          className="shrink-0 text-[9px] text-muted-foreground hover:text-destructive"
          title="Use site default"
        >
          ×
        </button>
      )}
    </div>
  )

  return (
    <div className="min-h-0 flex-1 overflow-hidden p-3 space-y-2">
      {!activePage ? (
        <p className={cn(builderPanelUi.hintXs, 'text-center py-4')}>Select a page to edit its appearance.</p>
      ) : (
        <>
          <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-primary/25 bg-accent/45 px-2 py-1">
            <span className="truncate text-[10px] font-semibold text-primary">
              {activePage.title}
            </span>
            <span className="shrink-0 font-mono text-[10px] font-medium text-gray-600 dark:text-gray-300">
              /{activePage.slug}
            </span>
          </div>

          {(onDeletePage || onDuplicatePage || onSetHomepage) && (
            <div className={cn(builderPanelUi.cardSurfaceMuted, 'space-y-1.5 p-2')}>
              <div className="flex flex-wrap gap-1.5">
                {!activePage.is_homepage && onSetHomepage && (
                  <button
                    type="button"
                    onClick={() => onSetHomepage(activePage)}
                    className={cn(builderPanelUi.btnSecondary, 'flex-1 justify-center px-2 py-1.5 text-[10px]')}
                  >
                    <Home className="h-3 w-3" />
                    Homepage
                  </button>
                )}
                {onDuplicatePage && (
                  <button
                    type="button"
                    onClick={() => onDuplicatePage(activePage)}
                    className={cn(builderPanelUi.btnSecondary, 'flex-1 justify-center px-2 py-1.5 text-[10px]')}
                  >
                    <Copy className="h-3 w-3" />
                    Duplicate
                  </button>
                )}
                {onDeletePage && canDelete && (
                  <button
                    type="button"
                    onClick={() => onDeletePage(activePage.id, activePage.title)}
                    title={activePage.is_homepage ? 'The next page in your list will become the new homepage.' : undefined}
                    className={cn(builderPanelUi.btnDanger, 'flex-1 px-2 py-1.5 text-[10px]')}
                  >
                    <Trash2 className="h-3 w-3" />
                    Trash
                  </button>
                )}
              </div>
              {onDeletePage && !canDelete && (
                <p className={cn(builderPanelUi.hint, 'px-0.5')}>{deleteBlockedReason}</p>
              )}
            </div>
          )}

          <div>
            <div className={cn(builderPanelUi.eyebrow, 'mb-1')}>Page colors</div>
            <div className={cn(builderPanelUi.mutedSurface, 'space-y-1 p-2')}>
              {colorField('bg_color', 'Background', siteStyle.bg_color)}
              {colorField('surface_color', 'Surface', siteStyle.surface_color)}
              {colorField('text_color', 'Text', siteStyle.text_color)}
            </div>
          </div>

          <div>
            <div className={cn(builderPanelUi.eyebrow, 'mb-1')}>Typography</div>
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { key: 'font_heading' as const, label: 'Headings' },
                  { key: 'font_body' as const, label: 'Body' },
                ]).map(({ key, label }) => (
                  <div key={key} className="min-w-0">
                    <label className="mb-0.5 block text-[9px] font-medium text-muted-foreground">{label}</label>
                    <div style={{ fontFamily: (pageOverrides[key] as string) || (effective[key] as string) }}>
                      <Select
                        value={(pageOverrides[key] as string) || (effective[key] as string)}
                        onChange={v => onPageStyleChange(activePage.id, { [key]: v })}
                        options={FONTS.map(f => ({ value: f, label: f }))}
                        className="w-full rounded-md border border-border bg-background px-1.5 py-1 text-[10px] text-foreground"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {([
                { key: 'font_size_base' as const, label: 'Body', min: 12, max: 22, fallback: siteStyle.font_size_base || 16 },
                { key: 'font_size_heading' as const, label: 'Heading', min: 24, max: 56, fallback: siteStyle.font_size_heading || 40 },
              ]).map(({ key, label, min, max, fallback }) => {
                const val = (pageOverrides[key] as number | undefined) ?? fallback
                return (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className={cn(builderPanelUi.hint, 'w-12 shrink-0')}>{label}</span>
                    <BuilderStepSlider
                      className="min-w-0 flex-1"
                      value={val}
                      min={min}
                      max={max}
                      step={1}
                      onChange={next => onPageStyleChange(activePage.id, { [key]: next })}
                      formatValue={v => `${v}px`}
                      sliderClassName="h-1"
                      buttonSize="sm"
                    />
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className={cn(builderPanelUi.eyebrow, 'mb-0')}>Custom CSS</div>
              {pageOverrides.custom_css != null && pageOverrides.custom_css !== '' && (
                <button
                  type="button"
                  onClick={() => onPageStyleChange(activePage.id, { custom_css: undefined })}
                  className="shrink-0 text-[9px] text-muted-foreground hover:text-destructive"
                  title="Clear custom CSS"
                >
                  Clear
                </button>
              )}
            </div>
            <textarea
              value={pageOverrides.custom_css || ''}
              onChange={e => onPageStyleChange(activePage.id, { custom_css: e.target.value })}
              spellCheck={false}
              rows={8}
              placeholder={`.builder-page .builder-block {\n  /* your styles */\n}\n\n[data-block-id="…"] h1 {\n  color: #111;\n}`}
              className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[10px] leading-relaxed text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
              title="Applied immediately on this page. Target .builder-page, .builder-block, or [data-block-id=&quot;…&quot;]."
            />
            <p className={cn(builderPanelUi.hint, 'mt-1 px-0.5')}>
              Applies live on this page. Use class names or{' '}
              <span className="font-mono text-[9px]">[data-block-id="…"]</span>
              {' '}(section id is on each block in the canvas).
            </p>
          </div>

          {hasOverrides && (
            <button
              type="button"
              onClick={() => onClearPageStyle(activePage.id)}
              className={cn(builderPanelUi.btnSecondary, 'w-full justify-center py-1.5 text-[10px] font-medium')}
            >
              Reset page to site defaults
            </button>
          )}
        </>
      )}

      {onRestorePage && (trashLoading || trashedPages.length > 0) && (
        <DeletedPagesPanel
          items={trashedPages}
          loading={trashLoading}
          onRestore={onRestorePage}
          onRefresh={onRefreshTrash}
        />
      )}
    </div>
  )
}

/** Linkable CTA label fields — url props are discovered via sectionLinksPanel. */
const LINK_PANEL_PROP_KEYS = new Set(SECTION_CTA_LABEL_KEYS)

type LinksPanelSelection =
  | { kind: 'overlay'; id: string }
  | { kind: 'prop'; key: string }
  | { kind: 'block' }

function linksPanelRowClass(selected: boolean, linked = false) {
  return cn(
    'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer',
    selected
      ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20'
      : linked
        ? 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/30'
        : 'border-border bg-card hover:border-primary/35 hover:bg-accent/40',
  )
}

/** Right-panel "Links" tab — opens the Connect link / product popup for the section's buttons. */
function SectionLinksPanel({
  block,
  selectedLink,
  onSelectOverlay,
  onSelectPropLink,
  onSelectBlockLink,
  onEditPropLink,
  onEditOverlayLink,
}: {
  block: WebsiteBlock | null
  selectedLink?: LinksPanelSelection | null
  onSelectOverlay?: (overlayId: string) => void
  onSelectPropLink?: (propKey: string) => void
  onSelectBlockLink?: () => void
  onEditPropLink: (propKey: string, anchor: { x: number; y: number }) => void
  onEditOverlayLink?: (item: BlockOverlayItem, anchor: { x: number; y: number }) => void
}) {
  if (!block) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-6 text-center text-muted-foreground">
        <Link2 className="mb-3 h-9 w-9 opacity-30" />
        <p className="text-sm font-medium text-foreground">Select a section</p>
        <p className="mt-1 text-xs">Then link its buttons to pages, products, or any URL.</p>
      </div>
    )
  }

  const p = (block.props || {}) as Record<string, any>
  const allowBlockLink = blockTypeSupportsBlockLink(block.block_type)
  const socialLinkEntries = resolveSocialLinkPanelEntries(block.block_type, p)
  const overlays: BlockOverlayItem[] = Array.isArray(p.overlays) ? p.overlays : []
  const linkableOverlays = overlays.filter(o => overlayHasLinkControl(o))
  const sectionLinkTargets = discoverSectionLinkTargets(block.block_type, p)
  const sectionLinksByGroup = sectionLinkTargets.reduce<Record<string, typeof sectionLinkTargets>>((acc, target) => {
    const g = target.group || 'Links'
    if (!acc[g]) acc[g] = []
    acc[g].push(target)
    return acc
  }, {})
  const sectionLinkGroupNames = Object.keys(sectionLinksByGroup)
  const selectedOverlay = selectedLink?.kind === 'overlay'
    ? linkableOverlays.find(o => o.id === selectedLink.id) ?? null
    : null
  const blockLinkTarget = allowBlockLink ? String(p.block_link_url || '').trim() : ''
  const blockLinked = !!blockLinkTarget

  const linkAnchor = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: rect.left - 360, y: rect.top }
  }

  const editProp = (propKey: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onEditPropLink(propKey, linkAnchor(e))
  }

  const editOverlay = (item: BlockOverlayItem) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onEditOverlayLink?.(item, linkAnchor(e))
  }

  const openQuickLink = (e: React.MouseEvent<HTMLButtonElement>) => {
    const anchor = linkAnchor(e)
    if (selectedOverlay && onEditOverlayLink) {
      onEditOverlayLink(selectedOverlay, anchor)
      return
    }
    if (allowBlockLink) {
      onEditPropLink('block_link', anchor)
      return
    }
    if (linkableOverlays.length > 0 && onEditOverlayLink) {
      onEditOverlayLink(linkableOverlays[0], anchor)
      return
    }
    if (sectionLinkTargets.length > 0) {
      onEditPropLink(sectionLinkTargets[0].propKey, anchor)
      return
    }
    if (socialLinkEntries.length > 0) {
      onEditPropLink(`social_links.${socialLinkEntries[0].platform}`, anchor)
    }
  }

  const hasQuickLinkTarget = allowBlockLink || linkableOverlays.length > 0 || sectionLinkTargets.length > 0 || socialLinkEntries.length > 0

  const quickLinkActive = selectedOverlay
    ? !!(selectedOverlay.linkType && selectedOverlay.linkType !== 'none')
    : allowBlockLink
      ? blockLinked
      : false

  const isOverlaySelected = (id: string) => selectedLink?.kind === 'overlay' && selectedLink.id === id
  const isPropSelected = (key: string) => selectedLink?.kind === 'prop' && selectedLink.key === key
  const isSectionLinkSelected = (target: { propKey: string; selectKey?: string }) =>
    selectedLink?.kind === 'prop'
    && (selectedLink.key === target.propKey || selectedLink.key === target.selectKey)
  const isBlockSelected = selectedLink?.kind === 'block'

  const totalLinks =
    (blockLinked ? 1 : 0) +
    linkableOverlays.filter(o => !!(o.linkType && o.linkType !== 'none')).length +
    socialLinkEntries.filter(e => Boolean(e.url)).length +
    sectionLinkTargets.filter(t => Boolean(t.url)).length

  const quickLinkTitle = selectedOverlay
    ? (quickLinkActive ? `Linked: ${selectedOverlay.linkLabel || selectedOverlay.linkTarget || selectedOverlay.text}` : 'Link selected layer')
    : allowBlockLink
      ? (blockLinked ? `Section linked: ${blockLinkTarget}` : 'Link whole section')
      : 'Link element'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Panel header */}
      <div className="shrink-0 border-b border-border bg-card px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <Link2 className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold text-foreground">
              {block.label || block.block_type}
            </p>
            <p className={cn('text-[10px]', totalLinks > 0 ? 'text-emerald-600 font-medium' : 'text-muted-foreground')}>
              {totalLinks > 0 ? `${totalLinks} link${totalLinks !== 1 ? 's' : ''} configured` : 'No links configured yet'}
            </p>
          </div>
          {hasQuickLinkTarget && (
          <button
            type="button"
            title={quickLinkTitle}
            onClick={openQuickLink}
            className={builderLinkBtn(quickLinkActive)}
          >
            <span className={builderLinkBtnIcon(quickLinkActive)}>
              <Link2 className="h-2.5 w-2.5" />
            </span>
            <span>{quickLinkActive ? 'Linked' : 'Link'}</span>
          </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-4">

        {/* How-to hint — only when nothing is linked yet */}
        {totalLinks === 0 && (
          <p className="text-[10px] text-muted-foreground/70 leading-snug px-0.5">
            Click <span className="font-medium text-foreground/80">Link</span> above or <span className="font-medium text-foreground/80">Add</span> next to any element below.
          </p>
        )}

        {/* Section link — promo sections only */}
        {allowBlockLink && (
        <div className="space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Section</p>
          {blockLinked ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelectBlockLink?.()}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectBlockLink?.() } }}
              className={linksPanelRowClass(isBlockSelected, true)}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Link2 className="h-3 w-3 text-emerald-700" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold text-foreground">Whole section</div>
                <div className="truncate text-[10px] text-emerald-700 font-medium">{blockLinkTarget}</div>
              </div>
              <button
                type="button"
                onClick={editProp('block_link')}
                className="shrink-0 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-semibold text-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                Edit
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-0.5 py-1">
              <Link2 className="h-3 w-3 shrink-0 text-muted-foreground/40" />
              <p className="text-[10px] text-muted-foreground/70">No link on this section</p>
            </div>
          )}
        </div>
        )}

        {/* Canvas overlay layers */}
        {linkableOverlays.length > 0 && (
          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Canvas layers</p>
            {linkableOverlays.map(item => {
              const label = String(item.text || item.linkLabel || overlayLayerTypeLabel(String(item.type))).trim()
              const target = String(item.linkTarget || item.href || '').trim()
              const isLinked = !!(item.linkType && item.linkType !== 'none')
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectOverlay?.(item.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectOverlay?.(item.id) } }}
                  className="flex w-full items-center gap-2 px-0.5 py-1 rounded hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <Link2 className={cn('h-3 w-3 shrink-0', isLinked ? 'text-emerald-600' : 'text-muted-foreground/40')} />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-semibold text-foreground">{label}</span>
                    {isLinked && <span className="ml-1.5 text-[10px] text-emerald-600 font-medium truncate">{target || 'Connected'}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={editOverlay(item)}
                    className={cn(
                      'shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors',
                      isLinked
                        ? 'text-emerald-700 hover:text-emerald-900'
                        : 'text-primary hover:text-primary/70',
                    )}
                  >
                    {isLinked ? 'Edit' : 'Add'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Section-discovered links (buttons, footer columns, nav, plans, marquee, …) */}
        {sectionLinkGroupNames.map(groupName => (
          <div key={groupName} className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{groupName}</p>
            {sectionLinksByGroup[groupName].map(target => {
              const isLinked = Boolean(target.url)
              return (
                <div
                  key={target.propKey}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectPropLink?.(target.selectKey ?? target.propKey)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectPropLink?.(target.selectKey ?? target.propKey)
                    }
                  }}
                  className="flex w-full items-center gap-2 px-0.5 py-1 rounded hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <Link2 className={cn('h-3 w-3 shrink-0', isLinked ? 'text-emerald-600' : 'text-muted-foreground/40')} />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-semibold text-foreground">{target.label}</span>
                    {isLinked && (
                      <span className="ml-1.5 text-[10px] text-emerald-600 font-medium truncate">{target.url}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={editProp(target.propKey)}
                    className={cn(
                      'shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors',
                      isLinked
                        ? 'text-emerald-700 hover:text-emerald-900'
                        : 'text-primary hover:text-primary/70',
                    )}
                  >
                    {isLinked ? 'Edit' : 'Add'}
                  </button>
                </div>
              )
            })}
          </div>
        ))}

        {/* Social links */}
        {socialLinkEntries.length > 0 && (
          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Social links</p>
            {socialLinkEntries.map(({ platform, label, url }) => {
              const isLinked = Boolean(url)
              return (
                <div
                  key={platform}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectPropLink?.(`social_links.${platform}`)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectPropLink?.(`social_links.${platform}`) } }}
                  className="flex w-full items-center gap-2 px-0.5 py-1 rounded hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <ExternalLink className={cn('h-3 w-3 shrink-0', isLinked ? 'text-emerald-600' : 'text-muted-foreground/40')} />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-semibold text-foreground">{label}</span>
                    {isLinked && <span className="ml-1.5 text-[10px] text-emerald-600 font-medium truncate">{url}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={editProp(`social_links.${platform}`)}
                    className={cn(
                      'shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold transition-colors',
                      isLinked
                        ? 'text-emerald-700 hover:text-emerald-900'
                        : 'text-primary hover:text-primary/70',
                    )}
                  >
                    {isLinked ? 'Edit' : 'Add'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state — nothing linkable on this block */}
        {!blockLinked && linkableOverlays.length === 0 && socialLinkEntries.length === 0 && sectionLinkTargets.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/50 bg-muted/10 px-4 py-5 text-center">
            <Layers className="h-5 w-5 text-muted-foreground/30" />
            <p className="text-[10px] text-muted-foreground/60 leading-snug">
              No linkable elements — add a button or overlay in the canvas.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ?? Block Design Bar (inline canvas floating toolbar) ?????????????????????????

// ?? Typography toolbar: font scale + text case (canvas bar & properties panel) ?
const FONT_SCALE_STEPS: [string, number][] = [
  ['XS', 0.75], ['S', 0.875], ['M', 1], ['L', 1.125], ['XL', 1.25], ['2X', 1.5],
]

const DESIGN_BAR_TABS = ['general', 'visual'] as const
// 'image' is a contextual tab — only present while a section/card image is selected.
type DesignBarTabId = (typeof DESIGN_BAR_TABS)[number] | 'image'

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

// ?? Structure shell (nav / footer / announcement) — quick toolbar ??????????????????

const structureShellToggleClass = (on: boolean) => cn(
  'rounded-md border px-2 py-1 text-[10px] font-semibold leading-none whitespace-nowrap transition-colors',
  on ? 'border-primary/50 bg-primary/10 text-primary' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
)

function StructureShellLayoutQuickControls({
  block,
  onOpenLayoutPicker,
  onCycleLayout,
}: {
  block: WebsiteBlock
  onOpenLayoutPicker: () => void
  onCycleLayout: (direction: 'prev' | 'next') => void
}) {
  const layoutOptions = getSectionLayoutOptions(block.block_type)
  if (layoutOptions.length === 0) return null
  const activeLayout = findActiveSectionLayoutOption(block.props as Record<string, unknown>, layoutOptions)
    ?? findBestSectionLayoutOption(block.props as Record<string, unknown>, layoutOptions)
    ?? layoutOptions[findActiveLayoutIndex(block.props as Record<string, unknown>, block.block_type)]
  const canCycle = layoutOptions.length > 1
  const btn = 'p-1 text-gray-500 hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
  return (
    <div className="inline-flex shrink-0 items-center overflow-hidden rounded-md border border-gray-200 bg-white">
      <button type="button" disabled={!canCycle} onClick={() => onCycleLayout('prev')} className={btn} title="Previous footer/header style">
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onOpenLayoutPicker}
        className={cn(btn, 'flex items-center gap-1 border-x border-gray-200 px-1.5 text-[10px] font-semibold text-gray-700')}
        title={`Change section style — ${activeLayout?.label || 'Current'}`}
      >
        <Layout className="w-3.5 h-3.5" />
        {activeLayout?.label?.split(/\s+/)[0] || 'Style'}
      </button>
      <button type="button" disabled={!canCycle} onClick={() => onCycleLayout('next')} className={btn} title="Next footer/header style">
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function StructureShellDesignBarTools({
  blockType,
  blockProps,
  block,
  onUpdate,
  onOpenSectionEdit,
  onFocusLogo,
  onOpenLayoutPicker,
  onCycleLayout,
}: {
  blockType: string
  blockProps: Record<string, unknown>
  block?: WebsiteBlock
  onUpdate: (patch: Partial<BlockProps>) => void
  onOpenSectionEdit?: () => void
  onFocusLogo?: () => void
  onOpenLayoutPicker?: () => void
  onCycleLayout?: (direction: 'prev' | 'next') => void
}) {
  const canEditPoweredBy = canEditPoweredByOption(useAuthStore(s => s.user?.email))

  if (blockType === 'nav') {
    const toggles = [
      { key: 'show_logo', label: 'Logo' },
      { key: 'show_brand_name', label: 'Name' },
      { key: 'show_nav_links', label: 'Page links' },
      { key: 'show_search', label: 'Search' },
      { key: 'show_cart', label: 'Cart' },
      { key: 'show_login', label: 'Account' },
    ] as const
    const linkSource = (blockProps.nav_links_source as string) || 'site_pages'
    return (
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 px-1">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-400">Show</span>
        {toggles.map(({ key, label }) => {
          const on = blockProps[key] !== false
          return (
            <button
              key={key}
              type="button"
              title={`${on ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
              onClick={() => onUpdate({ [key]: !on } as Partial<BlockProps>)}
              className={structureShellToggleClass(on)}
            >
              {label}
            </button>
          )
        })}
        <span className="hidden sm:inline h-5 w-px shrink-0 bg-gray-200" aria-hidden />
        <label className="flex min-w-0 items-center gap-1">
          <span className="shrink-0 text-[10px] font-semibold text-gray-500">Links</span>
          <Select
            value={linkSource}
            onChange={v => onUpdate({ nav_links_source: v } as Partial<BlockProps>)}
            options={[
              { value: 'site_pages', label: 'Site pages' },
              { value: 'manual', label: 'Manual' },
            ]}
            wrapperClassName="max-w-[8.5rem]"
            className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-[10px] font-medium text-gray-700"
            aria-label="Navigation link source"
          />
        </label>
        <label className="flex min-w-0 items-center gap-1">
          <span className="shrink-0 text-[10px] font-semibold text-gray-500">CTA</span>
          <input
            type="text"
            value={String(blockProps.cta_label ?? '')}
            placeholder="Button label"
            onChange={e => onUpdate({ cta_label: e.target.value } as Partial<BlockProps>)}
            className="h-7 w-24 min-w-0 rounded-md border border-gray-200 px-2 text-[11px] text-gray-800 sm:w-28"
            title="Header call-to-action button label (leave empty to hide)"
          />
        </label>
        <label className="flex min-w-0 items-center gap-1">
          <span className="shrink-0 text-[10px] font-semibold text-gray-500">Link</span>
          <input
            type="text"
            value={String(blockProps.cta_url ?? '')}
            placeholder="/products"
            onChange={e => onUpdate({ cta_url: e.target.value } as Partial<BlockProps>)}
            className="h-7 w-24 min-w-0 rounded-md border border-gray-200 px-2 text-[11px] font-mono text-gray-800 sm:w-28"
            title="Header call-to-action URL"
          />
        </label>
        {onFocusLogo ? (
          <button
            type="button"
            onClick={onFocusLogo}
            className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-gray-200 px-2 text-[10px] font-semibold text-gray-700 hover:bg-gray-50"
            title="Select logo on canvas"
          >
            <ImageIcon className="h-3 w-3" />
            Logo
          </button>
        ) : null}
        {block && onOpenLayoutPicker && onCycleLayout ? (
          <StructureShellLayoutQuickControls
            block={block}
            onOpenLayoutPicker={onOpenLayoutPicker}
            onCycleLayout={onCycleLayout}
          />
        ) : null}
        {onOpenSectionEdit ? (
          <button
            type="button"
            onClick={onOpenSectionEdit}
            className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 text-[10px] font-semibold text-primary hover:bg-primary/15"
          >
            <Settings2 className="h-3 w-3" />
            Section Edit
          </button>
        ) : null}
      </div>
    )
  }

  if (blockType === 'announcement_bar') {
    return (
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 px-1">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[10px] font-semibold text-gray-500">Banner text</span>
          <input
            type="text"
            value={String(blockProps.text ?? '')}
            onChange={e => onUpdate({ text: e.target.value } as Partial<BlockProps>)}
            className="h-7 min-w-[12rem] flex-1 rounded-md border border-gray-200 px-2 text-[11px] text-gray-800"
            placeholder="Promotion message…"
          />
        </label>
        {onOpenSectionEdit ? (
          <button
            type="button"
            onClick={onOpenSectionEdit}
            className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 text-[10px] font-semibold text-primary hover:bg-primary/15"
          >
            <Settings2 className="h-3 w-3" />
            More options
          </button>
        ) : null}
      </div>
    )
  }

  if (blockType === 'footer') {
    const toggles = [
      { key: 'show_social', label: 'Social' },
      { key: 'show_legal', label: 'Legal' },
      { key: 'show_newsletter', label: 'Newsletter' },
      ...(canEditPoweredBy
        ? [{ key: 'show_powered_by' as const, label: 'Powered by' }]
        : []),
    ]
    return (
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 px-1">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-gray-400">Show</span>
        {toggles.map(({ key, label }) => {
          const on = key === 'show_powered_by'
            ? blockProps.powered_by_admin_disabled !== true
            : key === 'show_newsletter'
              ? blockProps[key] === true
              : blockProps[key] !== false
          return (
            <button
              key={key}
              type="button"
              title={`${on ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
              onClick={() => {
                if (key === 'show_powered_by') {
                  if (!on) {
                    onUpdate({
                      show_powered_by: true,
                      powered_by_admin_disabled: false,
                      powered_by_text: String(blockProps.powered_by_text || '').trim() || DEFAULT_POWERED_BY_TEXT,
                      powered_by_text_url: String(blockProps.powered_by_text_url || '').trim() || DEFAULT_POWERED_BY_URL,
                      powered_by_text_link_new_tab: blockProps.powered_by_text_link_new_tab !== false,
                    } as Partial<BlockProps>)
                  } else {
                    onUpdate({
                      show_powered_by: false,
                      powered_by_admin_disabled: true,
                    } as Partial<BlockProps>)
                  }
                  return
                }
                onUpdate({ [key]: !on } as Partial<BlockProps>)
              }}
              className={structureShellToggleClass(on)}
            >
              {label}
            </button>
          )
        })}
        {block && onOpenLayoutPicker && onCycleLayout ? (
          <StructureShellLayoutQuickControls
            block={block}
            onOpenLayoutPicker={onOpenLayoutPicker}
            onCycleLayout={onCycleLayout}
          />
        ) : null}
        {onOpenSectionEdit ? (
          <button
            type="button"
            onClick={onOpenSectionEdit}
            className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 text-[10px] font-semibold text-primary hover:bg-primary/15"
          >
            <Settings2 className="h-3 w-3" />
            Section Edit
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
      <span className="min-w-0 text-[11px] leading-snug text-gray-600">
        Structure sections are configured in <strong className="font-semibold text-gray-800">Section Edit</strong> (right panel) — not with typography tools.
      </span>
      {onOpenSectionEdit ? (
        <button
          type="button"
          onClick={onOpenSectionEdit}
          className="shrink-0 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/15"
        >
          Open Section Edit
        </button>
      ) : null}
    </div>
  )
}

function BlockDesignBar({ block, onUpdate, onInsertAfter, onOpenLinkEditorForOverlay, activeTextField, activeTextFields = [], onActivateTextField, onEditText, onEscapeDismiss, onUndo, onRedo, canUndo, canRedo, formatPaintActive, formatPaintSticky, onFormatPaintStart, onFormatPaintCancel, selectedOverlayId, canvasImageField, canvasImageSlots, onSectionImagePick, onSectionImageLibrary, onFocusPrimaryImage, onSelectOverlay, blockBackgroundColor, onOverlayPickImage, onOverlayOpenLibrary, onOverlaySetImageUrl, onOverlayEditText, onOverlayEditDescription, onOverlayClipboard, onOpenSectionEdit, onOpenLayoutPicker, onCycleLayout, floating = false, docked = false, selectionHint }: {
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
  /** Cut / copy / paste the selected overlay layer (within or across sections). */
  onOverlayClipboard?: (action: 'cut' | 'copy' | 'paste') => boolean
  onOpenSectionEdit?: () => void
  onOpenLayoutPicker?: () => void
  onCycleLayout?: (direction: 'prev' | 'next') => void
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
  /** Context hint shown beside General / Visual / Media tabs when docked. */
  selectionHint?: string
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
  const blockType = String(block.block_type)
  const isStructureShell = isGlobalStructureBlock(blockType)
  const structureQuickEdit = isStructureShell && !selectedOverlayId && !activeTextField && !canvasImageField
  const supportsContentGroup = sectionSupportsContentGroupTransform(blockType)
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
    bump()
    return () => cancelAnimationFrame(raf)
  }, [activeTextField, block.id, selectedOverlayId])

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
  const overlayTextLayer =
    selectedOverlay && overlayHasTextControls(selectedOverlay) ? selectedOverlay : null
  const deleteTarget = resolveDeleteBlockElementTarget(
    blockType,
    activeTextField,
    canvasImageField ?? null,
    canvasImageSlots,
  )
  const [overlayCanvasSize, setOverlayCanvasSize] = useState({ w: 800, h: 400 })

  useLayoutEffect(() => {
    if (!selectedOverlay) return
    const canvas = document.querySelector(
      `[data-block-id="${CSS.escape(block.id)}"] [data-overlay-canvas]`,
    ) as HTMLElement | null
    if (!canvas) return
    const update = () => {
      setOverlayCanvasSize({
        w: canvas.clientWidth || 800,
        h: canvas.clientHeight || 400,
      })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [block.id, selectedOverlay?.id])

  const overlaySiblingBoxes = useMemo(
    () => overlays
      .filter(o => o.id !== selectedOverlay?.id)
      .map(o => normalizeOverlayBox(o, overlayCanvasSize.w, overlayCanvasSize.h)),
    [overlays, selectedOverlay?.id, overlayCanvasSize.w, overlayCanvasSize.h],
  )

  const overlaySnapContainer = useMemo(() => {
    if (selectedOverlay && overlayUsesPercent(selectedOverlay)) {
      return { w: OVERLAY_AXIS_MAX, h: OVERLAY_AXIS_MAX }
    }
    return overlayCanvasSize
  }, [selectedOverlay, overlayCanvasSize])

  const updateSelectedOverlay = (patch: Partial<OverlayLayerItem>) => {
    if (!selectedOverlayId) return
    onUpdate({
      overlays: overlays.map(o => {
        if (o.id !== selectedOverlayId) return o
        let next = { ...o, ...patch }
        const touchesGeometry = patch.x !== undefined
          || patch.y !== undefined
          || patch.w !== undefined
          || patch.h !== undefined
        if (touchesGeometry && !overlayUsesPercent(o)) {
          next = {
            ...next,
            ...pxToOverlayPercent(next, overlayCanvasSize.w, overlayCanvasSize.h),
            coordUnit: 'percent',
          }
        }
        return next
      }),
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
      // Layer or section image selected ? arrow keys adjust, not switch tabs
      if ((selectedOverlay || canvasImageField) && (designBarTab === 'general' || designBarTab === 'image')) return
      if (designBarTab === 'image') return
      e.preventDefault()
      const idx = DESIGN_BAR_TABS.indexOf(designBarTab as (typeof DESIGN_BAR_TABS)[number])
      const nextIdx = e.key === 'ArrowLeft'
        ? (idx - 1 + DESIGN_BAR_TABS.length) % DESIGN_BAR_TABS.length
        : (idx + 1) % DESIGN_BAR_TABS.length
      setDesignBarTab(DESIGN_BAR_TABS[nextIdx])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTextField, multiFieldSelection, designBarTab, selectedOverlay, canvasImageField])

  // Open the contextual Image tab when an image gets selected; fall back to General
  // when it is deselected so we never leave the user on an empty Image tab.
  const imageTabActive = !!canvasImageField && !selectedOverlay
  const prevImageTabActiveRef = useRef(false)
  useEffect(() => {
    if (imageTabActive && !prevImageTabActiveRef.current) {
      setDesignBarTab('image')
    } else if (!imageTabActive && designBarTab === 'image') {
      setDesignBarTab('general')
    }
    prevImageTabActiveRef.current = imageTabActive
  }, [imageTabActive, designBarTab])

  // Switch to Visual on first layer select so layout tools are visible; General stays available for typography.
  const prevOverlaySelectedRef = useRef(false)
  useEffect(() => {
    const layerSelected = !!selectedOverlay
    if (layerSelected && !prevOverlaySelectedRef.current) {
      setDesignBarTab('visual')
    }
    prevOverlaySelectedRef.current = layerSelected
  }, [selectedOverlay])

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

    if (overlayTextLayer) {
      if (opts?.fontSizeDelta != null) {
        const fallback = overlayTextLayer.type === 'badge' ? 12 : overlayTextLayer.type === 'button' ? 14 : 16
        const cur = overlayTextLayer.fontSize ?? fallback
        updateSelectedOverlay({
          fontSize: Math.min(120, Math.max(8, cur + opts.fontSizeDelta)),
        })
        return
      }
      const overlayPatch: Partial<BlockOverlayItem> = {}
      if ('font_family' in stylePatch) {
        const v = stylePatch.font_family
        overlayPatch.fontFamily = typeof v === 'string' && v ? v : undefined
      }
      if ('font_size_px' in stylePatch && stylePatch.font_size_px != null) {
        overlayPatch.fontSize = Number(stylePatch.font_size_px)
      }
      if ('text_color_override' in stylePatch && stylePatch.text_color_override) {
        overlayPatch.color = String(stylePatch.text_color_override)
      }
      if ('text_align' in stylePatch && stylePatch.text_align) {
        overlayPatch.align = stylePatch.text_align as BlockOverlayItem['align']
      }
      if ('field_bg_color' in stylePatch && stylePatch.field_bg_color) {
        overlayPatch.bgColor = String(stylePatch.field_bg_color)
        overlayPatch.bgFill = 'solid'
      }
      if (Object.keys(overlayPatch).length > 0) updateSelectedOverlay(overlayPatch)
      return
    }

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
      const fontSizeDelta = opts?.fontSizeDelta
      if (fontSizeDelta != null) {
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
              Math.max(FONT_SIZE_PX_MIN, base + fontSizeDelta),
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

  const typographySource = overlayTextLayer
    ? {
        font_family: overlayTextLayer.fontFamily,
        font_size_px: overlayTextLayer.fontSize,
        text_color_override: overlayTextLayer.color,
        text_align: overlayTextLayer.align,
        field_bg_color: isOverlayNoFill(overlayTextLayer) ? undefined : overlayTextLayer.bgColor,
      }
    : activeTextField && activeTextField !== CONTENT_GROUP_FIELD_KEY
    ? resolveFormatPaintStyle({
        blockProps: p as Record<string, unknown>,
        fieldKey: activeTextField,
        computed: getCanvasFieldComputedFormatPaintStyle(block.id, activeTextField),
      })
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
  const isCtaField = Boolean(activeTextField && isInlinePositionField(activeTextField))
  const toolbarFontFamily = overlayTextLayer
    ? (overlayTextLayer.fontFamily ?? undefined)
    : toolbarLiveTypography.font_family
  const toolbarTypography = {
    ...typographySource,
    ...(toolbarLiveTypography.font_family ? { font_family: toolbarLiveTypography.font_family } : {}),
    ...(toolbarLiveTypography.font_size_px != null
      ? { font_size_px: toolbarLiveTypography.font_size_px }
      : {}),
    ...(toolbarLiveTypography.text_color_override
      ? { text_color_override: toolbarLiveTypography.text_color_override }
      : {}),
    ...(toolbarLiveTypography.text_align ? { text_align: toolbarLiveTypography.text_align } : {}),
    ...(toolbarLiveTypography.vertical_align ? { vertical_align: toolbarLiveTypography.vertical_align } : {}),
    ...(toolbarLiveTypography.text_wrap != null ? { text_wrap: toolbarLiveTypography.text_wrap } : {}),
    ...(toolbarLiveTypography.line_height_ratio != null
      ? { line_height_ratio: toolbarLiveTypography.line_height_ratio }
      : {}),
    ...(toolbarLiveTypography.field_bg_color ? { field_bg_color: toolbarLiveTypography.field_bg_color } : {}),
    ...(toolbarLiveTypography.field_border_color
      ? { field_border_color: toolbarLiveTypography.field_border_color }
      : {}),
  }

  const toolbarTextColor =
    overlayTextLayer
      ? (overlayTextLayer.color || '#111827')
      : toolbarLiveTypography.text_color_override
    || (toolbarTypography as Record<string, unknown>).text_color_override as string | undefined
    || '#111827'
  const toolbarBgColor = overlayTextLayer && overlayHasFillControls(overlayTextLayer)
    ? (isOverlayNoFill(overlayTextLayer)
      ? (blockBackgroundColor || '#ffffff')
      : (overlayTextLayer.bgColor || defaultOverlayFillColor(overlayTextLayer.type)))
    : isCtaField
    ? (toolbarLiveTypography.field_bg_color
      || (toolbarTypography as Record<string, unknown>).field_bg_color as string | undefined
      || blockBackgroundColor
      || '#ffffff')
    : ((p as Record<string, unknown>).bg_color_override as string | undefined
      || blockBackgroundColor
      || '#ffffff')

  const applyToolbarTextColor = (color: string) => {
    if (selectedOverlay && (overlayHasTextControls(selectedOverlay) || selectedOverlay.type === 'icon')) {
      updateSelectedOverlay({ color })
      return
    }
    updateTextStyle({ text_color_override: color })
  }

  const applyToolbarBackgroundColor = (color: string) => {
    if (selectedOverlay && overlayHasFillControls(selectedOverlay)) {
      updateSelectedOverlay({ bgFill: 'solid', bgColor: color })
      return
    }
    if (isCtaField && activeTextField) {
      updateTextStyle({ field_bg_color: color })
      return
    }
    onUpdate({ bg_color_override: color } as Partial<BlockProps>)
  }

  const inheritedOverlayStyle = (overlayType: BlockOverlayItem['type']): Partial<BlockOverlayItem> => {
    const patch: Partial<BlockOverlayItem> = {}
    const fontPx = (toolbarTypography as Record<string, unknown>).font_size_px
    if (overlayHasTextControls({ type: overlayType } as BlockOverlayItem) || overlayType === 'icon') {
      patch.color = toolbarTextColor
      if (toolbarFontFamily) patch.fontFamily = toolbarFontFamily
      if (typeof fontPx === 'number' && Number.isFinite(fontPx) && fontPx > 0) {
        patch.fontSize = Math.round(fontPx)
      }
    }
    if (overlayType === 'text') {
      patch.bgFill = 'none'
      patch.bgColor = 'transparent'
    } else if (overlayHasFillControls({ type: overlayType } as BlockOverlayItem)) {
      patch.bgFill = 'solid'
      patch.bgColor = overlayType === 'button' || overlayType === 'badge'
        ? toolbarBgColor
        : overlayType === 'box'
          ? toolbarBgColor
          : (OVERLAY_DEFAULTS[overlayType]?.bgColor ?? toolbarBgColor)
      if ((overlayType === 'button' || overlayType === 'badge') && patch.color === patch.bgColor) {
        patch.color = '#ffffff'
      }
    }
    return patch
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

  const addOverlayElement = (
    type: string,
    anchor?: { x: number; y: number },
    initialPatch?: Partial<OverlayLayerItem>,
  ) => {
    const defaults = OVERLAY_DEFAULTS[type] || {}
    const currentOverlays: BlockOverlayItem[] = ((p as any).overlays as BlockOverlayItem[]) || []
    const overlayType = (type === 'link' || type === 'db_link' || type === 'store') ? 'button' : type
    const newId = `ov-${Date.now()}`
    const newItem = {
      id: newId,
      type: overlayType as BlockOverlayItem['type'],
      x: 4 + currentOverlays.length * 2,
      y: 4 + currentOverlays.length * 2,
      w: (defaults as any).w || 20,
      h: (defaults as any).h || 8,
      coordUnit: 'percent' as const,
      ...defaults,
      ...inheritedOverlayStyle(overlayType as BlockOverlayItem['type']),
      ...initialPatch,
    } as BlockOverlayItem
    onUpdate({ overlays: [...currentOverlays, newItem] } as any)
    onSelectOverlay?.(newId)
    if ((type === 'link' || type === 'db_link' || type === 'store') && onOpenLinkEditorForOverlay) {
      onOpenLinkEditorForOverlay(newItem, anchor || { x: window.innerWidth / 2, y: 200 })
    }
  }

  const overlayCount = ((p as any).overlays as any[] || []).length

  const runTextClipboard = (action: 'cut' | 'copy' | 'paste') => {
    if (selectedOverlay && onOverlayClipboard?.(action)) return
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

  const runDeleteElement = () => {
    const patch = buildDeleteBlockElementPatch(block, deleteTarget)
    if (!patch) {
      toast.info('Select a text field or image to delete.')
      return
    }
    onUpdate(patch as Partial<BlockProps>)
    toast.success('Element removed from section')
    onEscapeDismiss?.()
  }

  const structureShellTools = structureQuickEdit ? (
    <StructureShellDesignBarTools
      blockType={blockType}
      blockProps={p as Record<string, unknown>}
      block={block}
      onUpdate={onUpdate}
      onOpenSectionEdit={onOpenSectionEdit}
      onFocusLogo={blockType === 'nav' && onFocusPrimaryImage ? onFocusPrimaryImage : undefined}
      onOpenLayoutPicker={onOpenLayoutPicker}
      onCycleLayout={onCycleLayout}
    />
  ) : null

  return (
    <div className={designBarRoot} data-block-design-bar>
      <div
        className={designBarTabHeader}
        role="tablist"
        aria-label="Section design tools"
      >
        <div className={designBarTabList}>
        {(([
          { id: 'general', label: 'General' },
          { id: 'visual', label: 'Visual' },
          ...(canvasImageField && !selectedOverlay
            ? [{
                id: 'image',
                label: canvasImageSlots && canvasImageSlots.length > 1
                  ? `${canvasImageSlots.length} images`
                  : canvasImageSlots?.length
                    ? 'Card image'
                    : 'Section image',
              }]
            : []),
        ]) as { id: DesignBarTabId; label: string }[]).map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={designBarTab === tab.id}
            onClick={() => setDesignBarTab(tab.id)}
            className={designBarTabClass(designBarTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
        </div>
        {docked && selectionHint ? (
          <span className="min-w-0 flex-1 truncate border-l border-gray-200 pl-2 text-[11px] font-medium text-primary/90">
            {selectionHint}
          </span>
        ) : null}
      </div>
    <div
      ref={barRef}
      role="tabpanel"
      aria-label={
        designBarTab === 'general'
          ? 'General tools'
          : designBarTab === 'visual'
            ? 'Visual tools'
            : designBarTab === 'image'
              ? 'Image tools'
              : 'Section tools'
      }
      className={cn(
        designBarTabPanel,
        docked
          ? 'relative border-b border-primary/20'
          : floating
            ? 'relative rounded-t-lg border-t-2 border-primary border-b border-primary/30 shadow-sm'
            : 'absolute top-0 left-0 right-0 border-t-2 border-primary border-b border-primary/30 shadow-sm',
      )}
      onClick={e => e.stopPropagation()}
    >
      {designBarTab === 'general' && (
        <div className={designBarTabSlot}>
      <div className={visualToolbarRow}>
      {!structureQuickEdit ? (
      <div className={cn(generalDesignBarInsertStack, deleteTarget && 'w-[4.5rem]')}>
        <InsertLayerButton
          embedded
          stackedBelow={!!deleteTarget}
          overlayCount={overlayCount}
          onAddOverlay={addOverlayElement}
          onClearOverlays={() => onUpdate({ overlays: [] } as Partial<BlockProps>)}
        />
        {deleteTarget ? (
          <button
            type="button"
            title="Delete selected element from section"
            onClick={runDeleteElement}
            className={generalDesignBarDeleteCell}
          >
            <Trash2 className="h-3 w-3 shrink-0" />
            <span>Delete</span>
          </button>
        ) : null}
      </div>
      ) : null}
      {structureQuickEdit ? (
        structureShellTools
      ) : (
      <>
      <div className={generalDesignBarGrid2x2}>
        <button
          type="button"
          onClick={() => {
            if (overlayTextLayer) {
              onOverlayEditText?.()
              return
            }
            onEditText?.()
          }}
          title={overlayTextLayer ? 'Edit button label' : 'Edit section text (E)'}
          className={cn(generalDesignBarGridCell, 'border-b border-r px-0.5', DESIGN_BAR_SOFT_INNER_BORDER)}
        >
          <Pencil className="h-3 w-3 shrink-0" />
        </button>
        <div className={cn('relative min-h-0 border-b', DESIGN_BAR_SOFT_INNER_BORDER)}>
          <button
            ref={caseBtnRef}
            type="button"
            title="Text case"
            onClick={() => {
              setShowCase(v => !v)
              setShowLineSpacing(false)
            }}
            className={cn(
              generalDesignBarGridCell,
              'flex-col gap-0 px-0 text-[10px] font-bold leading-none',
              showCase || currentTextCaseMenuId(typographySource as any) !== 'default'
                ? DESIGN_BAR_SOFT_ACTIVE
                : undefined,
            )}
          >
            Aa
            <ChevronDown className="h-2 w-2 shrink-0 opacity-70" />
          </button>
          <DesignBarDropdownPortal
            open={showCase}
            anchorRef={caseBtnRef}
            menuRef={dropdownRef}
            onClose={() => setShowCase(false)}
            className="min-w-[220px] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl"
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
        </div>
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
            generalDesignBarGridCell,
            'border-r',
            DESIGN_BAR_SOFT_INNER_BORDER,
            formatPaintActive
              ? formatPaintSticky
                ? 'bg-amber-100 text-amber-800'
                : 'bg-primary/15 text-primary'
              : undefined,
          )}
        >
          <Paintbrush className={cn('h-3.5 w-3.5 shrink-0', formatPaintActive && 'text-amber-700')} />
        </button>
        <div className="relative min-h-0">
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
              generalDesignBarGridCell,
              'flex-col gap-0 px-0',
              showClear && 'bg-accent',
            )}
          >
            <Eraser className="h-3.5 w-3.5 shrink-0" />
            <ChevronDown className="h-2 w-2 shrink-0 opacity-70" />
          </button>
          <DesignBarDropdownPortal
            open={showClear}
            anchorRef={clearBtnRef}
            menuRef={dropdownRef}
            onClose={() => setShowClear(false)}
            className="min-w-[240px] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl"
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

      {(selectedOverlay || !overlayTextLayer) ? (
      <div
        {...{ [BUILDER_DESIGN_BAR_CHROME_ATTR]: true }}
        className={cn(generalDesignBarCluster, 'w-9 flex-col divide-y', DESIGN_BAR_SOFT_DIVIDE)}
        onMouseDown={e => {
          pinInlineTextSelectionBeforeToolbarAction()
          e.preventDefault()
        }}
      >
        <button
          type="button"
          title={selectedOverlay ? 'Cut layer (Ctrl+X)' : 'Cut (Ctrl+X)'}
          onClick={() => runTextClipboard('cut')}
          className={generalDesignBarInnerBtn}
        >
          <Scissors className="h-3 w-3" />
        </button>
        <button
          type="button"
          title={selectedOverlay ? 'Copy layer (Ctrl+C)' : 'Copy (Ctrl+C)'}
          onClick={() => runTextClipboard('copy')}
          className={generalDesignBarInnerBtn}
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          type="button"
          title={selectedOverlay ? 'Paste layer (Ctrl+V)' : 'Paste (Ctrl+V)'}
          onClick={() => runTextClipboard('paste')}
          className={generalDesignBarInnerBtn}
        >
          <ClipboardPaste className="h-3 w-3" />
        </button>
      </div>
      ) : null}

      <div
        {...{ [BUILDER_TYPOGRAPHY_TOOLBAR_ATTR]: true }}
        className={typographyToolbarBox}
        onMouseDown={e => {
          pinInlineTextSelectionBeforeToolbarAction()
          e.preventDefault()
        }}
      >
        <div className="flex shrink-0 items-stretch border-r border-gray-200">
          <TypographyFontStack
            fontFamily={toolbarFontFamily}
            onFontFamilyChange={font => updateTextStyle({ font_family: font })}
            fontSizePx={(toolbarTypography as any).font_size_px as number | undefined}
            onFontSizeStep={delta => updateTextStyle({}, { fontSizeDelta: delta })}
            onFontSizeChange={px => {
              updateTextStyle({ text_scale: null, font_size_px: px })
            }}
          />
          <ColorIdentPickerRow
            designBar
            size="compact"
            textColor={toolbarTextColor}
            backgroundColor={toolbarBgColor}
            onTextColorChange={applyToolbarTextColor}
            onBackgroundColorChange={applyToolbarBackgroundColor}
            showBackgroundPicker={isCtaField || !!overlayTextLayer || !selectedOverlay}
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
                onClose={() => setShowLineSpacing(false)}
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

      {!overlayTextLayer ? (
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
      ) : null}

      <span className="hidden @[720px]/designbar:inline shrink-0 text-[10px] text-gray-400 font-mono truncate max-w-[5rem]" title={overlayTextLayer ? overlayLayerTypeLabel(String(overlayTextLayer.type)) : (block.label || block.block_type)}>
        {overlayTextLayer ? overlayLayerTypeLabel(String(overlayTextLayer.type)) : (block.label || block.block_type)}
      </span>
      </>
      )}
      </div>
        </div>
      )}

      {designBarTab === 'image' && canvasImageField && !selectedOverlay ? (
        <div className={designBarTabSlot}>
          <div className={cn(visualToolbarRow, 'gap-1 px-1')}>
          <VisualsDesignBarMenu
            blockType={String(block.block_type)}
            blockProps={p as Record<string, unknown>}
            primaryImageField={primaryImageField}
            canvasImageField={canvasImageField}
            onUpdate={onUpdate}
            onPickImage={onSectionImagePick}
            onOpenMediaLibrary={onSectionImageLibrary}
            onFocusPrimaryImage={onFocusPrimaryImage}
          />
          <SectionImageControls
            imageField={canvasImageField}
            arraySlots={canvasImageSlots}
            blockProps={p as Record<string, unknown>}
            blockType={String(block.block_type)}
            onUpdate={patch => onUpdate(patch as Partial<BlockProps>)}
          />
          </div>
        </div>
      ) : null}

      {designBarTab === 'visual' && (
        structureQuickEdit ? (
          structureShellTools
        ) : (
        <VisualDesignBarTools
          blockType={String(block.block_type)}
          blockProps={p as Record<string, unknown>}
          blockAnimation={block.animation}
          blockAnimationDelay={block.animation_delay}
          overlayCount={overlayCount}
          selectedOverlay={selectedOverlay}
          overlaySiblings={overlaySiblingBoxes}
          overlayContainerWidth={overlaySnapContainer.w}
          overlayContainerHeight={overlaySnapContainer.h}
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
          primaryImageField={primaryImageField}
          canvasImageField={canvasImageField}
          onSectionImagePick={onSectionImagePick}
          onSectionImageLibrary={onSectionImageLibrary}
          onFocusPrimaryImage={onFocusPrimaryImage}
        />
        )
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
  const websiteBlogEnabled = isVendorBlogEnabled(myVendor?.settings)
  const { data: builderStoresData } = useStores({ limit: 200 })
  const builderStores = builderStoresData?.stores ?? []
  const isExternalSite = useMemo(() => {
    if (!site) return false
    const meta = readSiteStyleMetadata(site.style_config as Record<string, unknown>)
    const siteRecord = site as typeof site & {
      website_store_scope?: string | null
      website_store_id?: string | null
      website_home_store_id?: string | null
    }
    return resolveSiteWebsiteScope(
      {
        website_store_scope: siteRecord.website_store_scope ?? meta.website_store_scope,
        website_store_id: siteRecord.website_store_id ?? meta.website_store_id,
        website_home_store_id: siteRecord.website_home_store_id ?? meta.website_home_store_id,
        business_type: meta.business_type,
        selling_mode: meta.selling_mode,
      },
      builderStores.length,
    ) === 'external'
  }, [site, builderStores.length])
  const updateSite = useUpdateSite(siteId!)
  const overlayLayerUpload = useUploadMedia(siteId!)
  const { data: templates = [] } = useWebsiteTemplates()

  // State
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [minimizedSectionToolbars, setMinimizedSectionToolbars] = useState<Set<string>>(() => new Set())
  const [pinnedSectionToolbars, setPinnedSectionToolbars] = useState<Set<string>>(() => new Set())
  const minimizeSectionToolbar = useCallback((blockId: string) => {
    setMinimizedSectionToolbars(prev => {
      const next = new Set(prev)
      next.add(blockId)
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
  // Lets the canvas capture-click handler drive image-frame selection without a
  // forward reference (handleSectionImageActivate is defined further down).
  const handleSectionImageActivateRef = useRef<(
    blockId: string,
    field: string,
    opts?: { arrayKey?: string; index?: number; itemField?: string; additive?: boolean },
  ) => void>(() => {})
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
  const [leftPanel, setLeftPanel] = useState<'blocks' | 'pages' | 'templates' | 'media'>(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('templateMode') === 'true') return 'templates'
    return 'blocks'
  })
  const [templateListSearch, setTemplateListSearch] = useState('')
  const [templatePanelSelectedId, setTemplatePanelSelectedId] = useState<string | null>(null)
  const [applyingTemplateInline, setApplyingTemplateInline] = useState(false)
  const [isStorefrontTemplateToggling, setIsStorefrontTemplateToggling] = useState(false)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [inputParamsOpen, setInputParamsOpen] = useState(false)
  const [readyPagePickerOpen, setReadyPagePickerOpen] = useState(false)
  const [siteSettingsOpen, setSiteSettingsOpen] = useState(false)
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
  const [rightPanel, setRightPanel] = useState<'props' | 'page' | 'style' | 'links'>('props')
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
  /** Browser window too narrow for dual docked side panels. */
  const [builderViewportNarrow, setBuilderViewportNarrow] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1200px)').matches : false
  ))
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 1200px)')
    const sync = () => setBuilderViewportNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  /**
   * Compact chrome: Phone/Tablet canvas preview, or a narrow browser window.
   * Panels stay available — collapsed as a thin rail, expanded as an overlay drawer
   * so the canvas keeps full width and collapse/expand always works.
   */
  const compactSidePanels = device === 'mobile' || device === 'tablet' || builderViewportNarrow
  const panelCollapseBeforeCompactRef = useRef<{ left: boolean; right: boolean } | null>(null)
  const wasCompactSidePanelsRef = useRef(compactSidePanels)

  useEffect(() => {
    const wasCompact = wasCompactSidePanelsRef.current
    wasCompactSidePanelsRef.current = compactSidePanels
    if (compactSidePanels && !wasCompact) {
      if (!panelCollapseBeforeCompactRef.current) {
        panelCollapseBeforeCompactRef.current = { left: leftCollapsed, right: rightCollapsed }
      }
      setLeftCollapsed(true)
      setRightCollapsed(true)
      return
    }
    if (!compactSidePanels && wasCompact && panelCollapseBeforeCompactRef.current) {
      const prev = panelCollapseBeforeCompactRef.current
      panelCollapseBeforeCompactRef.current = null
      setLeftCollapsed(prev.left)
      setRightCollapsed(prev.right)
    }
  }, [compactSidePanels])

  const openLeftBuilderPanel = useCallback(() => {
    setLeftCollapsed(false)
    if (compactSidePanels) setRightCollapsed(true)
  }, [compactSidePanels])

  const openRightBuilderPanel = useCallback(() => {
    setRightCollapsed(false)
    if (compactSidePanels) setLeftCollapsed(true)
  }, [compactSidePanels])

  const closeLeftBuilderPanel = useCallback(() => setLeftCollapsed(true), [])
  const closeRightBuilderPanel = useCallback(() => setRightCollapsed(true), [])

  const leftPanelOverlay = compactSidePanels && !leftCollapsed
  const rightPanelOverlay = compactSidePanels && !rightCollapsed
  const showPanelBackdrop = leftPanelOverlay || rightPanelOverlay

  useEffect(() => {
    if (!showPanelBackdrop) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setLeftCollapsed(true)
      setRightCollapsed(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showPanelBackdrop])

  const openLeftBuilderPanelRef = useRef(openLeftBuilderPanel)
  const openRightBuilderPanelRef = useRef(openRightBuilderPanel)
  openLeftBuilderPanelRef.current = openLeftBuilderPanel
  openRightBuilderPanelRef.current = openRightBuilderPanel

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
  /** Block ids removed on the server — prevents autosave from recreating them after undo/refetch races. */
  const deletedBlockIdsRef = useRef<Set<string>>(new Set())
  const styleDirtyRef = useRef(false)    // mirror for style dirty flag
  const [openingBrowserPreview, setOpeningBrowserPreview] = useState(false)
  const openingBrowserPreviewRef = useRef(false)
  const [trashedPages, setTrashedPages] = useState<PageTrashItem[]>([])
  const [trashLoading, setTrashLoading] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [storePopover, setStorePopover] = useState(false)
  const viewStoreAnchorRef = useRef<HTMLButtonElement>(null)
  const storePopoverRef = useRef<HTMLDivElement>(null)
  const [storePopoverRect, setStorePopoverRect] = useState<{ top: number; right: number } | null>(null)
  // ?? Block-level saving indicator ???????????????????????????????????????????
  const [savingBlockId, setSavingBlockId] = useState<string | null>(null)
  /** Selected in-canvas image overlay (for AI / Media apply). */
  const [overlayImageTarget, setOverlayImageTarget] = useState<{ blockId: string; overlayId: string } | null>(null)
  /** Explicit Links-tab row focus (block link, social) when canvas has no matching target. */
  const [linksPanelFocus, setLinksPanelFocus] = useState<LinksPanelSelection | null>(null)
  /** Floating position/size/text panel — opened from overlay context menu only. */
  const [overlaySettingsPanelId, setOverlaySettingsPanelId] = useState<string | null>(null)
  const overlayImageTargetRef = useRef<{ blockId: string; overlayId: string } | null>(null)
  /** Survives overlay deselect while the media picker / upload is in flight. */
  const pendingOverlayUploadRef = useRef<{ blockId: string; overlayId: string } | null>(null)
  /** When switching blocks via image click, keep the new image selection for that block only. */
  const preserveCanvasImageForBlockRef = useRef<string | null>(null)
  /** Suppress duplicate activate calls from the same pointer gesture (pointerdown + click). */
  const lastSectionImageActivateRef = useRef<{ key: string; ts: number } | null>(null)
  const selectedBlockIdRef = useRef<string | null>(null)
  useEffect(() => { overlayImageTargetRef.current = overlayImageTarget }, [overlayImageTarget])
  useEffect(() => { selectedBlockIdRef.current = selectedBlockId }, [selectedBlockId])
  /** Selected canvas image slot(s) ? Shift/Ctrl+click for multi (Media + design bar). */
  const [canvasImageTarget, setCanvasImageTarget] = useState<ActiveCanvasImageTarget | null>(null)
  const canvasImageTargetRef = useRef<ActiveCanvasImageTarget | null>(null)
  useEffect(() => { canvasImageTargetRef.current = canvasImageTarget }, [canvasImageTarget])

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
    for (const pageBlocks of Object.values(snapshot)) {
      for (const b of pageBlocks) deletedBlockIdsRef.current.delete(b.id)
    }
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
      for (const pageBlocks of Object.values(snapshot)) {
        for (const b of pageBlocks) deletedBlockIdsRef.current.delete(b.id)
      }
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
      for (const pageBlocks of Object.values(snapshot)) {
        for (const b of pageBlocks) deletedBlockIdsRef.current.delete(b.id)
      }
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
  const canvasMainRef = useRef<HTMLDivElement | null>(null)

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
    if (!moreMenuOpen) {
      setStorePopover(false)
      setStorePopoverRect(null)
    }
  }, [moreMenuOpen])

  useEffect(() => {
    if (!storePopover) return
    const onReposition = () => {
      const el = viewStoreAnchorRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setStorePopoverRect({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [storePopover])

  useEffect(() => {
    if (!moreMenuOpen) return
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (moreMenuRef.current?.contains(target)) return
      // Popover is portaled to document.body — ignore clicks inside it so Copy/Open fire before close.
      if (storePopoverRef.current?.contains(target)) return
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
    const consolidatedShell = blocksByPageFingerprint(nextBlocks) !== blocksByPageFingerprint(normalized)
    setLocalBlocks(syncNavLinksInBlockMap(normalized, nextSite.pages))
    const homepage = nextSite.pages.find(p => p.is_homepage) || nextSite.pages[0]
    setActivePageId(homepage?.id ?? null)
    setSelectedBlockId(null)
    setActiveTextTarget(null)
    setStyleDirty(false)
    setBlocksDirty(consolidatedShell)
    blocksDirtyRef.current = consolidatedShell
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
    const consolidated = normalizeAllStructureBlocks(nextBlocks, normalized)
    const synced = syncNavLinksInBlockMap(consolidated, normalized)
    if (blocksByPageFingerprint(nextBlocks) !== blocksByPageFingerprint(consolidated)) {
      blocksDirtyRef.current = true
      setBlocksDirty(true)
    }
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
      subtitle: 'Save a copy of this site as a new website. It will appear in your Business Website Builder list.',
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
            toast.success(`"${finalName}" saved — find it in Business Website Builder`)
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
          const beforeFp = blocksByPageFingerprint(next)
          const normalized = normalizeAllStructureBlocks(next, site.pages)
          if (beforeFp !== blocksByPageFingerprint(normalized)) {
            blocksDirtyRef.current = true
            setBlocksDirty(true)
          }
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
      if (ctrl && (e.key === 'x' || e.key === 'X' || e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V')) {
        const clipAction = e.key.toLowerCase() === 'x' ? 'cut' as const
          : e.key.toLowerCase() === 'c' ? 'copy' as const
            : 'paste' as const
        const layerTarget = overlayImageTarget?.blockId === selectedBlockId && overlayImageTarget.overlayId
        if (clipAction === 'paste') {
          if (hasOverlayClipboard() && selectedBlockId) {
            e.preventDefault()
            runOverlayClipboardActionRef.current('paste', selectedBlockId)
          }
          return
        }
        if (layerTarget) {
          e.preventDefault()
          runOverlayClipboardActionRef.current(clipAction, selectedBlockId ?? undefined)
          return
        }
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
        const layerSelected = overlayImageTarget?.blockId === selectedBlockId
          && !!overlayImageTarget?.overlayId
        if (heroPosition || fieldPosition || layerSelected) {
          // FieldPositionNudge / OverlayTransformControls listen in capture phase — skip section reorder.
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
  }, [selectedBlockId, activePageId, localBlocks, handleUndo, handleRedo, activeTextTarget, overlayImageTarget])

  const activePage = useMemo(() =>
    localPages.find(p => p.id === activePageId) || null
  , [localPages, activePageId])

  const canvasStyle = useMemo(
    () => mergePageStyleConfig(localStyle, activePageId),
    [localStyle, activePageId],
  )

  const vendorCatalogSlug = myVendor?.slug?.trim() || null
  const builderVendorSlug = myVendor?.slug?.trim() || site?.subdomain?.trim() || ''

  const builderPublicSite = useMemo(() => {
    if (!site) return null
    return buildBuilderPublicSite(site, localPages, localBlocks, localStyle, vendorCatalogSlug)
  }, [site, localPages, localBlocks, localStyle, vendorCatalogSlug])

  const builderBusinessProfile = useMemo(() => {
    if (!myVendor) return null
    return {
      id: myVendor.id,
      business_name: myVendor.business_name,
      display_name: myVendor.display_name,
      slug: myVendor.slug,
      description: myVendor.description,
      offering_type: myVendor.offering_type,
      logo_url: myVendor.logo_url,
      banner_url: myVendor.banner_url,
      theme_config: myVendor.theme_config,
      primary_email: myVendor.primary_email,
      primary_phone: myVendor.primary_phone,
      support_email: myVendor.support_email,
      support_phone: myVendor.support_phone,
      street_address: myVendor.street_address,
      city: myVendor.city,
      state: myVendor.state,
      postal_code: myVendor.postal_code,
      country: myVendor.country,
      social_links: myVendor.social_links,
      settings: myVendor.settings,
    }
  }, [myVendor])

  const builderPreviewStore = useMemo(() => {
    if (!site || builderStores.length === 0) return null
    const { scope, storeId } = resolveWebsiteStoreLink(site, localStyle as unknown as Record<string, unknown>)
    if (scope !== 'store' || !storeId) return null
    const linked = builderStores.find((s) => s.id === storeId)
    if (!linked) return null
    return {
      id: linked.id,
      name: linked.name,
      code: linked.code,
      description: linked.description,
      email: linked.email,
      phone: linked.phone,
      address: linked.address,
      settings: linked.settings,
    }
  }, [site, localStyle, builderStores])

  // Catalog/commerce pages (product detail, service detail, cart, checkout…) are not
  // block-based builder pages — they're storefront route templates. Instead of popping
  // them open in a separate preview tab, we embed the draft-catalog storefront route
  // directly inside the builder canvas so the user never leaves the builder.
  const [canvasCatalogRoute, setCanvasCatalogRoute] = useState<string | null>(null)
  const [canvasCatalogToken, setCanvasCatalogToken] = useState<string | null>(null)
  const [canvasCatalogLoading, setCanvasCatalogLoading] = useState(false)

  const exitCanvasCatalog = useCallback(() => {
    setCanvasCatalogRoute(null)
    setCanvasCatalogLoading(false)
  }, [])

  const showCatalogInCanvas = useCallback(async (url: string) => {
    if (!siteId || !site) return
    const raw = (url || '/').trim()
    const normalized = raw.startsWith('/') ? raw : `/${raw}`
    const embedRoute = parseStorefrontEmbedRoute(normalized)
    if (!embedRoute) return

    let previewToken = recallDraftPreviewToken()
    if (!previewToken) {
      setCanvasCatalogLoading(true)
      try {
        const payload = buildPublicSitePayloadFromLocal(site, localPages, localBlocks, localStyle, vendorCatalogSlug)
        const { preview_token } = await websiteApi.createBuilderPreview(siteId, {
          payload,
          label: 'Preview',
        })
        rememberDraftPreviewSession(siteId, preview_token)
        previewToken = preview_token
      } catch (err) {
        toast.error(extractApiError(err, 'Could not open catalog page'))
        setCanvasCatalogLoading(false)
        return
      }
    }
    setCanvasCatalogToken(previewToken)
    setCanvasCatalogRoute(embedRoute)
    setCanvasCatalogLoading(false)
    setSelectedBlockId(null)
  }, [siteId, site, localPages, localBlocks, localStyle, vendorCatalogSlug])

  const handleNavigateBuilderPage = useCallback((url: string) => {
    const raw = (url || '/').trim()
    const normalized = normalizeStorefrontCatalogHref(raw.startsWith('/') ? raw : `/${raw}`)
    const pathOnly = normalized.split('?')[0].split('#')[0]

    const target = findBuilderPageForNavPath(pathOnly, localPages)
    if (target) {
      exitCanvasCatalog()
      setActivePageId(target.id)
      setSelectedBlockId(null)
      return
    }

    if (parseStorefrontEmbedRoute(normalized) || parseCatalogStorePath(pathOnly)) {
      void showCatalogInCanvas(normalized)
      return
    }

    const cleanUrl = pathOnly.replace(/\/+$/, '') || '/'
    toast.info(`No builder page found for "${cleanUrl}". Add it from the Pages panel or update the nav link.`)
  }, [localPages, showCatalogInCanvas, exitCanvasCatalog])

  // Keep the embedded catalog view in sync with navigation that happens *inside* the
  // iframe (clicking a product card, the cart icon, "continue shopping", etc.). The
  // storefront embed posts its route to its parent window via postMessage.
  useEffect(() => {
    if (!canvasCatalogRoute) return
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as { type?: string; route?: string } | null
      if (!data || data.type !== PREVIEW_NAV_MESSAGE_TYPE || typeof data.route !== 'string') return
      const nextRoute = data.route.trim().replace(/^\/+|\/+$/g, '')
      if (!nextRoute) {
        // The embed asked to return home → drop back to the active builder page.
        exitCanvasCatalog()
        return
      }
      setCanvasCatalogRoute(prev => (prev === nextRoute ? prev : nextRoute))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [canvasCatalogRoute, exitCanvasCatalog])

  // Switching to a different builder page (Pages panel, nav, etc.) leaves the catalog view.
  useEffect(() => {
    setCanvasCatalogRoute(null)
    setCanvasCatalogLoading(false)
  }, [activePageId])

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
    openRightBuilderPanel()
  }, [formatPaintBrush])

  const handleCanvasBlockSelectCapture = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const fieldKey = resolveCanvasFieldKeyFromTarget(e.target)
    const isFieldClick = isCanvasFieldClickTarget(e.target)

    if (target.closest('[data-overlay-root],[data-overlay-toolbar],[data-builder-section-toolbar],[data-section-padding-handle],[data-section-min-height-handle],[data-section-scale-handle]')) return

    // Image frames own their selection. Drive it from this always-firing capture click
    // so a single click reliably selects the image slot. The frame's own pointerdown can
    // be missed during canvas re-renders / cross-package HMR, which previously left users
    // needing a second click to select an image.
    const sectionImageEl = target.closest('[data-builder-section-image]') as HTMLElement | null
    if (sectionImageEl) {
      const imgBlockId = (sectionImageEl.closest('[data-block-id]') as HTMLElement | null)
        ?.getAttribute('data-block-id')
      const imgField = sectionImageEl.getAttribute('data-builder-section-image')
      if (imgBlockId && imgField) {
        e.preventDefault()
        e.stopPropagation()
        const arrayKey = sectionImageEl.getAttribute('data-builder-image-array-key') || undefined
        const indexAttr = sectionImageEl.getAttribute('data-builder-image-index')
        const itemField = sectionImageEl.getAttribute('data-builder-image-item-field') || undefined
        handleSectionImageActivateRef.current(imgBlockId, imgField, {
          arrayKey,
          index: indexAttr != null ? Number(indexAttr) : undefined,
          itemField,
          additive: e.shiftKey || e.metaKey || e.ctrlKey,
        })
      }
      return
    }

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
      openRightBuilderPanel()
      return
    }

    if ((e.target as HTMLElement).closest('a, button, input, textarea, select, label, [role="button"]')) return

    const isNewSelection = selectedBlockId !== id
    setSelectedBlockId(id)
    setOverlayImageTarget(null)
    setCanvasImageTarget(null)
    setActiveTextTarget(null)
    if (isNewSelection) {
      setRightPanel('props')
    }
    openRightBuilderPanel()
  }, [formatPaintBrush, selectedBlockId])

  const handleCanvasNavClickCapture = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const catalogNavDiv = target.closest('[data-builder-catalog-nav="product"]:not(a)') as HTMLElement | null
    if (catalogNavDiv && canvasPreviewInnerRef.current?.contains(catalogNavDiv)) {
      return
    }

    const anchor = target.closest('a[href]') as HTMLAnchorElement | null
    if (!anchor || !canvasPreviewInnerRef.current?.contains(anchor)) return

    const href = anchor.getAttribute('href') || ''
    const normalized = normalizeStorefrontCatalogHref(href.startsWith('/') ? href : `/${href}`)
    const pathOnly = normalized.split('?')[0].split('#')[0]

    const blockRoot = anchor.closest('[data-block-id]') as HTMLElement | null
    const blockId = blockRoot?.getAttribute('data-block-id')
    const blockType = blockId ? findCanvasBlockType(localBlocks, localPages, blockId, activePageId) : null
    const isShellNavLink = blockType === 'nav' || blockType === 'footer'

    if (
      findBuilderPageForNavPath(pathOnly, localPages)
      || anchor.dataset.builderCatalogNav === 'product'
      || parseCatalogStorePath(pathOnly)?.slug
      || pathOnly.endsWith('/cart')
      || (isShellNavLink && (parseStorefrontEmbedRoute(normalized) || parseCatalogStorePath(pathOnly)))
    ) {
      e.preventDefault()
      e.stopPropagation()
      handleNavigateBuilderPage(normalized)
      return
    }

    e.preventDefault()
    e.stopPropagation()
    if (blockId) {
      setSelectedBlockId(blockId)
      setRightPanel('links')
      openRightBuilderPanel()
    }
  }, [handleNavigateBuilderPage, localPages, localBlocks, activePageId])

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

  const ALL_READY_PAGES = useMemo(() => [
    { slug: 'about',     title: 'About',     page_type: 'about',     icon: Info,        description: 'Your story, mission and values' },
    { slug: 'services',  title: 'Services',  page_type: 'services',  icon: Briefcase,   description: 'What you offer' },
    { slug: 'contact',   title: 'Contact',   page_type: 'contact',   icon: Mail,        description: 'Get in touch form and details' },
    { slug: 'products',  title: 'Products',  page_type: 'custom',    icon: ShoppingBag, description: 'Product catalog landing page' },
    { slug: 'blog',      title: 'Blog',      page_type: 'blog',      icon: FileText,    description: 'News, guides and articles' },
    { slug: 'pricing',   title: 'Pricing',   page_type: 'pricing',   icon: Star,        description: 'Plans and pricing tiers' },
    { slug: 'portfolio', title: 'Portfolio', page_type: 'portfolio', icon: Camera,      description: 'Work and project showcase' },
    { slug: 'team',      title: 'Team',      page_type: 'custom',    icon: Users,       description: 'Meet the team' },
    { slug: 'faq',       title: 'FAQ',       page_type: 'custom',    icon: MessageSquare, description: 'Frequently asked questions' },
    { slug: 'rentals',   title: 'Rentals',   page_type: 'rentals',   icon: Package,     description: 'Asset rental marketplace' },
  ] as const, [])

  const availableReadyPages = useMemo(() => {
    const existingSlugs = new Set(localPages.map(p => p.slug))
    return ALL_READY_PAGES.filter(rp => !existingSlugs.has(rp.slug)).map(rp => {
      if (rp.slug === 'blog' && !websiteBlogEnabled) {
        return {
          ...rp,
          description: 'Hidden on the live website until you enable Show on website in Blog Manager',
        }
      }
      return rp
    })
  }, [localPages, ALL_READY_PAGES, websiteBlogEnabled])

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

  const linksPanelSelection = useMemo((): LinksPanelSelection | null => {
    if (!selectedBlock) return null
    if (overlayImageTarget?.blockId === selectedBlock.id && overlayImageTarget.overlayId) {
      return { kind: 'overlay', id: overlayImageTarget.overlayId }
    }
    if (activeTextTarget?.blockId === selectedBlock.id) {
      const key = primaryTextFieldKey(activeTextTarget)
      if (key && LINK_PANEL_PROP_KEYS.has(key)) {
        return { kind: 'prop', key }
      }
    }
    return linksPanelFocus
  }, [selectedBlock, overlayImageTarget, activeTextTarget, linksPanelFocus])

  const scrollToLinksCanvasTarget = useCallback((blockId: string, target: 'overlay' | 'prop', keyOrId: string) => {
    requestAnimationFrame(() => {
      const sel = target === 'overlay'
        ? `[data-block-id="${CSS.escape(blockId)}"] [data-overlay-id="${CSS.escape(keyOrId)}"]`
        : `[data-block-id="${CSS.escape(blockId)}"] [data-text-key="${CSS.escape(keyOrId)}"], [data-block-id="${CSS.escape(blockId)}"] [data-field-layout="${CSS.escape(keyOrId)}"]`
      document.querySelector<HTMLElement>(sel)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  const selectLinkPanelProp = useCallback((propKey: string) => {
    if (!selectedBlock) return
    setOverlayImageTarget(null)
    setCanvasImageTarget(null)
    if (
      propKey.startsWith('social_links.')
      || propKey.includes('.links.')
      || propKey.endsWith('_url')
      || propKey === 'policy_url'
    ) {
      setActiveTextTarget(null)
      setLinksPanelFocus({ kind: 'prop', key: propKey })
      if (propKey.includes('.links.') && !/\.(href|url)$/.test(propKey)) {
        scrollToLinksCanvasTarget(selectedBlock.id, 'prop', propKey)
      }
      return
    }
    setLinksPanelFocus(null)
    setActiveTextTarget({ blockId: selectedBlock.id, fieldKeys: [propKey] })
    scrollToLinksCanvasTarget(selectedBlock.id, 'prop', propKey)
  }, [selectedBlock, scrollToLinksCanvasTarget])

  const selectLinkPanelBlock = useCallback(() => {
    if (!selectedBlock) return
    setLinksPanelFocus({ kind: 'block' })
    setOverlayImageTarget(null)
    setActiveTextTarget(null)
    setCanvasImageTarget(null)
  }, [selectedBlock])

  useEffect(() => {
    setLinksPanelFocus(null)
  }, [selectedBlockId])

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
    setOverlayImageTarget(prev => (prev && prev.blockId !== selectedBlockId ? null : prev))
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

  const onOverlayLayerPicked = useCallback((
    overlayId: string | null,
    blockId?: string | null,
    opts?: { keepSettingsPanel?: boolean },
  ) => {
    const bid = blockId ?? selectedBlockId
    if (!bid) {
      overlayImageTargetRef.current = null
      setOverlayImageTarget(null)
      setCanvasImageTarget(null)
      setOverlaySettingsPanelId(null)
      return
    }
    if (blockId && blockId !== selectedBlockId) {
      setSelectedBlockId(blockId)
    }
    const next = overlayId ? { blockId: bid, overlayId } : null
    overlayImageTargetRef.current = next
    setOverlayImageTarget(next)
    if (overlayId) {
      setCanvasImageTarget(null)
      setActiveTextTarget(null)
    }
    if (!opts?.keepSettingsPanel) {
      setOverlaySettingsPanelId(null)
    }
  }, [selectedBlockId])

  const selectLinkPanelOverlay = useCallback((overlayId: string) => {
    if (!selectedBlock) return
    setLinksPanelFocus(null)
    onOverlayLayerPicked(overlayId, selectedBlock.id)
    scrollToLinksCanvasTarget(selectedBlock.id, 'overlay', overlayId)
  }, [selectedBlock, onOverlayLayerPicked, scrollToLinksCanvasTarget])

  const openOverlaySettingsPanel = useCallback((overlayId: string, blockId: string) => {
    onOverlayLayerPicked(overlayId, blockId, { keepSettingsPanel: true })
    setOverlaySettingsPanelId(overlayId)
  }, [onOverlayLayerPicked])

  const closeOverlaySettingsPanel = useCallback(() => {
    setOverlaySettingsPanelId(null)
  }, [])

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
      const topLevel: Partial<WebsiteBlock> = {}
      const TOP_KEYS = [
        'visible', 'visible_on_mobile', 'visible_on_tablet', 'visible_on_desktop',
        'animation', 'animation_delay', 'style_overrides',
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
  }, [activePageId])

  // Update block props — immediate UI; server sync on explicit Save
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
      let mergedProps: BlockProps = { ...block.props, ...propsUpdate }
      if (String(block.block_type).includes('hero')) {
        mergedProps = normalizeHeroSideImageProps(
          block.block_type,
          mergedProps as Record<string, unknown>,
        ) as BlockProps
      }
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

  const runOverlayClipboardAction = useCallback((
    action: 'cut' | 'copy' | 'paste',
    blockId?: string | null,
  ): boolean => {
    if (!activePageId) return false
    const bid = blockId ?? selectedBlockId
    if (!bid) {
      if (action === 'paste') toast.info('Select a section first, then paste.')
      return false
    }

    const block = (localBlocks[activePageId] || []).find(b => b.id === bid)
    if (!block) return false

    const overlays = ((block.props as Record<string, unknown>).overlays as BlockOverlayItem[]) || []
    const overlayId = overlayImageTarget?.blockId === bid ? overlayImageTarget.overlayId : null
    const selected = overlayId ? overlays.find(o => o.id === overlayId) : null

    if (action === 'copy') {
      if (!selected) {
        toast.info('Select a layer on the canvas first.')
        return false
      }
      setOverlayClipboard(selected as unknown as Record<string, unknown>, 'copy', bid)
      toast.success('Layer copied')
      return true
    }

    if (action === 'cut') {
      if (!selected) {
        toast.info('Select a layer on the canvas first.')
        return false
      }
      setOverlayClipboard(selected as unknown as Record<string, unknown>, 'cut', bid)
      handleUpdateBlockProps(bid, { overlays: overlays.filter(o => o.id !== selected.id) } as Partial<BlockProps>)
      onOverlayLayerPicked(null, bid)
      setOverlaySettingsPanelId(null)
      toast.success('Layer cut')
      return true
    }

    const clip = getOverlayClipboard()
    if (!clip) {
      toast.info('Nothing to paste — copy or cut a layer first.')
      return false
    }
    const pasted = cloneOverlayForPaste(clip.item) as unknown as BlockOverlayItem
    handleUpdateBlockProps(bid, { overlays: [...overlays, pasted] } as Partial<BlockProps>)
    onOverlayLayerPicked(pasted.id, bid)
    consumeOverlayClipboardAfterPaste()
    toast.success('Layer pasted')
    return true
  }, [
    activePageId,
    selectedBlockId,
    localBlocks,
    overlayImageTarget,
    handleUpdateBlockProps,
    onOverlayLayerPicked,
  ])

  const runOverlayClipboardActionRef = useRef(runOverlayClipboardAction)
  runOverlayClipboardActionRef.current = runOverlayClipboardAction

  const handleSectionImageActivate = useCallback((
    blockId: string,
    field: string,
    opts?: { arrayKey?: string; index?: number; itemField?: string; additive?: boolean },
  ) => {
    const slot: CanvasImageSlot = (
      opts?.arrayKey != null && opts.index != null && opts.itemField
    )
      ? { arrayKey: opts.arrayKey, index: opts.index, itemField: opts.itemField }
      : { propField: field }
    const activateKey = `${blockId}:${slotKey(slot)}:${opts?.additive ? 'a' : 's'}`
    const now = Date.now()
    const last = lastSectionImageActivateRef.current
    if (last && last.key === activateKey && now - last.ts < 120) return
    lastSectionImageActivateRef.current = { key: activateKey, ts: now }

    // A click that lands on an image frame is an explicit request to edit THAT
    // image, so select the slot in a single click — even when its section was not
    // selected yet. The section is selected at the same time (padding handles stay
    // reachable via Escape). Previously only array-item photos (team, features,
    // logos) selected on the first click while whole-section images (hero, section
    // image) needed a second click.
    if (selectedBlockId !== blockId && !opts?.additive) {
      preserveCanvasImageForBlockRef.current = blockId
      setSelectedBlockId(blockId)
      setOverlayImageTarget(null)
      setActiveTextTarget(null)
      setRightPanel('props')
      openRightBuilderPanel()
      setCanvasImageTarget(toggleCanvasImageSlot(null, blockId, field, opts))
      return
    }
    if (blockId !== selectedBlockId) preserveCanvasImageForBlockRef.current = blockId
    if (blockId !== selectedBlockId) setSelectedBlockId(blockId)
    setOverlayImageTarget(null)
    setActiveTextTarget(null)
    setCanvasImageTarget((prev: ActiveCanvasImageTarget | null) => toggleCanvasImageSlot(prev, blockId, field, opts))
  }, [selectedBlockId])

  handleSectionImageActivateRef.current = handleSectionImageActivate

  const handleArrayItemImageFocus = useCallback((
    blockId: string,
    arrayKey: string,
    index: number,
    itemField: string,
  ) => {
    if (blockId !== selectedBlockId) preserveCanvasImageForBlockRef.current = blockId
    if (blockId !== selectedBlockId) setSelectedBlockId(blockId)
    setOverlayImageTarget(null)
    setActiveTextTarget(null)
    setCanvasImageTarget({
      blockId,
      slots: [{ arrayKey, index, itemField }],
    })
  }, [selectedBlockId])

  useEffect(() => {
    if (preserveCanvasImageForBlockRef.current === selectedBlockId) {
      preserveCanvasImageForBlockRef.current = null
      return
    }
    setCanvasImageTarget(null)
  }, [selectedBlockId])

  const openMediaFromCanvas = useCallback(() => {
    openLeftBuilderPanel()
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
    const pages = localPagesRef.current.filter(p => isPersistedPageId(p.id))
    await Promise.all(pages.map(async page => {
      const block = (blocksSnapshot[page.id] || []).find(b => b.block_type === def.type)
      if (!block) return
      const payload = { props: sanitizeForApiJson(nextProps) }
      if (block.id.startsWith('temp-')) {
        const saved = await websiteApi.createBlock(siteId, page.id, {
          block_type: def.type,
          label: block.label || def.label,
          ...payload,
          style_overrides: sanitizeForApiJson(block.style_overrides || {}),
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
        await websiteApi.updateBlock(siteId, page.id, block.id, payload as any)
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
      normalizeHeroSideImageProps(
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
    openRightBuilderPanel()
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
        openRightBuilderPanel()
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
    openRightBuilderPanel()
    scrollCanvasToBlock(tempId)

    // 2. Persist in background (structure blocks always save on the homepage)
    const homePage = resolveHomePage(pages)
    const persistPageId = isStructure && homePage ? homePage.id : activePageId
    const persistBlocks = isStructure && homePage ? (next[homePage.id] || []) : pageBlocks
    const persistSortOrder = persistBlocks.findIndex(b => b.id === tempId)
    try {
      const saved = await websiteApi.createBlock(siteId!, persistPageId, {
        block_type: def.type, label: def.label,
        props: initialProps, style_overrides: {},
        visible: true, visible_on_mobile: true, visible_on_tablet: true, visible_on_desktop: true,
        sort_order: persistSortOrder >= 0 ? persistSortOrder : persistBlocks.length,
      } as any)
      setLocalBlocks(prev => {
        let updated: Record<string, WebsiteBlock[]> = {
          ...prev,
          [persistPageId]: (prev[persistPageId] || [])
            .filter(b => b.block_type !== def.type || b.id === tempId)
            .map(b => b.id === tempId ? saved : b),
        }
        if (isStructure) {
          updated = consolidateStructureBlocksOnHomepage(updated, localPagesRef.current)
        }
        localBlocksRef.current = updated
        if (site) {
          queryClient.setQueryData<WebsiteSite>(['websites', siteId!], old =>
            old ? syncSiteQueryBlocks(old, updated) : old,
          )
        }
        return updated
      })
      if (isStructure && homePage && homePage.id !== activePageId) {
        setActivePageId(homePage.id)
      }
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
          : isStructure
            ? `${def.label} updated site-wide header`
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

  const applyBlockLayoutAtIndex = useCallback(async (block: WebsiteBlock, targetIdx: number) => {
    const def = BLOCK_CATALOG.find(d => d.type === block.block_type)
    if (!def || !site) return
    const options = getSectionLayoutOptions(block.block_type)
    const option = options[targetIdx]
    if (!option) return
    if (findActiveLayoutIndex(block.props as Record<string, unknown>, block.block_type) === targetIdx) return
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

  const applySectionPaddingPatch = useCallback((
    blockId: string,
    patch: { padding_top?: number; padding_bottom?: number; section_scale?: number },
    persist: boolean,
  ) => {
    const pages = localPagesRef.current
    const pageId = findPageIdForBlock(localBlocksRef.current, pages, blockId, activePageId)
    if (!pageId) return
    const block = (localBlocksRef.current[pageId] || []).find(b => b.id === blockId)
    if (!block) return
    const merged = patchBreakpointSectionSpacing(block, device, patch)
    const update = {
      ...merged.props,
      style_overrides: merged.style_overrides,
    } as Partial<BlockProps>
    if (persist) handleUpdateBlockProps(blockId, update)
    else handlePreviewBlockProps(blockId, update)
  }, [activePageId, device, handleUpdateBlockProps, handlePreviewBlockProps])

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

  const handleCanvasDeleteBlockField = useCallback((blockId: string, fieldKey: string) => {
    const pageId = findPageIdForBlock(localBlocksRef.current, localPagesRef.current, blockId, activePageId)
    if (!pageId) return
    const block = (localBlocksRef.current[pageId] || []).find(b => b.id === blockId)
    if (!block) return
    const patch = buildDeleteBlockElementPatch(block, { kind: 'field', fieldKey })
    if (!patch) return
    handleUpdateBlockProps(blockId, patch as Partial<BlockProps>)
    setActiveTextTarget(prev => {
      if (prev?.blockId === blockId && prev.fieldKeys.includes(fieldKey)) return null
      return prev
    })
    toast.success('Element removed from section')
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
          openRightBuilderPanel()
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
          openRightBuilderPanel()
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
    openRightBuilderPanel()
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
    storePopoverOpen: false,
    hasActiveTextTarget: false,
    hasSelectedBlock: false,
  })
  const builderEscapeActionsRef = useRef<BuilderEscapeActions>({
    clearFormatPaint: () => {},
    clearArmedDelete: () => {},
    clearOverlayImage: () => {},
    clearCanvasImage: () => {},
    closeStorePopover: () => {},
    clearActiveTextTarget: () => {},
    clearSelectedBlock: () => {},
  })

  builderEscapeUiRef.current = {
    formatPaintActive: Boolean(formatPaintBrush),
    armedDeleteActive: false,
    overlayImageActive: Boolean(overlayImageTarget),
    canvasImageActive: Boolean(canvasImageTarget),
    storePopoverOpen: storePopover,
    hasActiveTextTarget: Boolean(activeTextTarget),
    hasSelectedBlock: Boolean(selectedBlockId),
  }

  builderEscapeActionsRef.current = {
    clearFormatPaint: () => setFormatPaintBrush(null),
    clearArmedDelete: () => {},
    clearOverlayImage: () => setOverlayImageTarget(null),
    clearCanvasImage: () => setCanvasImageTarget(null),
    closeStorePopover: () => {
      setStorePopover(false)
      setStorePopoverRect(null)
    },
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
    hero: 'bg_image_url', hero_split: 'image_url', hero_minimal: 'bg_image_url',
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
    video_gallery:        { arrayKey: 'videos',       itemField: 'video_url' },
    portfolio_grid:       { arrayKey: 'projects',     itemField: 'image_url',   defaultTitle: 'Project' },
    category_cards:       { arrayKey: 'categories',   itemField: 'image_url',   defaultTitle: 'Category' },
    blog_grid:            { arrayKey: 'posts',        itemField: 'image_url',   defaultTitle: 'Post' },
    blog_featured:        { arrayKey: 'posts',        itemField: 'image_url',   defaultTitle: 'Post' },
    blog_list:            { arrayKey: 'posts',        itemField: 'image_url',   defaultTitle: 'Post' },
    menu_grid:            { arrayKey: 'categories',   itemField: 'image_url',   defaultTitle: 'Category' },
    menu_list:            { arrayKey: 'categories',   itemField: 'image_url',   defaultTitle: 'Category' },
    pricing:              { arrayKey: 'plans',        itemField: 'image_url',   defaultTitle: 'Plan' },
    faq:                  { arrayKey: 'faqs',         itemField: 'image_url',   defaultTitle: 'Question' },
    'service.faq':        { arrayKey: 'faqs',         itemField: 'image_url',   defaultTitle: 'Question' },
    marquee_strip:        { arrayKey: 'items',        itemField: 'image_url',   defaultTitle: 'Highlight' },
    timeline:             { arrayKey: 'items',        itemField: 'image_url',   defaultTitle: 'Milestone' },
    'service.team':       { arrayKey: 'members',      itemField: 'avatar',      defaultTitle: 'Team Member' },
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
        toast.success(target.type === 'video' ? 'Video applied to layer!' : 'Image applied to layer!')
        return
      }
      toast.error('Could not find that overlay layer — select it and try again.')
      return
    }

    // 2) Canvas image target (clicked image on preview)
    const imageTarget = canvasImageTargetRef.current
    if (imageTarget && imageTarget.blockId === blockId) {
      const arraySlots = canvasImageArraySlots(imageTarget, blockId)
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
        if (block.block_type === 'marquee_strip' && arrayKey === 'items') {
          handleUpdateBlockProps(blockId, patchMarqueeBlockItemsFromRaw(arr) as Partial<BlockProps>)
        } else {
          handleUpdateBlockProps(blockId, { [arrayKey]: arr } as Partial<BlockProps>)
        }
        toast.success(
          arraySlots.length > 1
            ? `Image applied to ${arraySlots.length} photos`
            : 'Image updated',
        )
        return
      }
      const propSlot = imageTarget.slots.find((s: CanvasImageSlot) => s.propField)
      if (propSlot?.propField) {
        handleUpdateBlockProps(
          blockId,
          buildSectionImagePropsPatch(
            propSlot.propField,
            url,
            (block.props ?? {}) as Record<string, unknown>,
          ) as Partial<BlockProps>,
        )
        toast.success('Image updated')
        return
      }
    }

    // 3) Array-item blocks (testimonials, team, features, gallery, etc.)
    const arrayCfg = BLOCK_ARRAY_IMAGE[block.block_type]
    if (arrayCfg) {
      const imageTarget = canvasImageTargetRef.current
      const selectedSlots = (
        imageTarget
        && imageTarget.blockId === blockId
      )
        ? canvasImageArraySlots(imageTarget, blockId).filter((s: CanvasImageSlot) => s.arrayKey === arrayCfg.arrayKey)
        : []
      if (selectedSlots.length === 0) {
        toast.error('Click the item photo on the canvas, or expand that item in Section Edit and use its Image control.')
        return
      }
      const targetIndices = new Set(
        selectedSlots
          .map((s: CanvasImageSlot) => s.index)
          .filter((idx): idx is number => typeof idx === 'number'),
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
        if (block.block_type === 'marquee_strip') {
          handleUpdateBlockProps(blockId, patchMarqueeBlockItemsFromRaw(updated) as Partial<BlockProps>)
        } else {
          handleUpdateBlockProps(blockId, { [arrayCfg.arrayKey]: updated } as Partial<BlockProps>)
        }
        toast.success(
          targetIndices.size > 1
            ? `Image applied to ${targetIndices.size} slots`
            : `Image applied to slot ${maxTargetIdx + 1}`,
        )
      } else {
        // No items yet ? create one with the image
        const newItem: Record<string, unknown> = { [arrayCfg.itemField]: url }
        if (arrayCfg.defaultTitle) newItem.title = arrayCfg.defaultTitle
        if (arrayCfg.itemField === 'avatar_url') newItem.name = arrayCfg.defaultTitle || 'Person'
        if (arrayCfg.itemField === 'src') delete newItem.title
        if (block.block_type === 'marquee_strip') {
          handleUpdateBlockProps(blockId, patchMarqueeBlockItemsFromRaw([newItem]) as Partial<BlockProps>)
        } else {
          handleUpdateBlockProps(blockId, { [arrayCfg.arrayKey]: [newItem] } as Partial<BlockProps>)
        }
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
    handleUpdateBlockProps(
      blockId,
      buildSectionImagePropsPatch(field, url, (block.props ?? {}) as Record<string, unknown>) as Partial<BlockProps>,
    )
    toast.success('Image applied to block!')
  }, [activePageId, canvasImageTarget, handleUpdateBlockProps])

  const resolveOverlayUploadTarget = useCallback(() => (
    pendingOverlayUploadRef.current ?? overlayImageTargetRef.current
  ), [])

  const clearPendingOverlayUpload = useCallback(() => {
    pendingOverlayUploadRef.current = null
  }, [])

  const uploadImageFileToSelection = useCallback(async (
    file: File,
    overlayTarget?: { blockId: string; overlayId: string },
  ) => {
    if (!siteId) {
      toast.error('Save the site first before uploading media')
      return
    }
    const capturedOverlayTarget = overlayTarget ?? resolveOverlayUploadTarget()
    let overlayType: string | undefined
    if (capturedOverlayTarget && activePageId) {
      const block = (localBlocksRef.current[activePageId] || []).find(b => b.id === capturedOverlayTarget.blockId)
      const overlays = ((block?.props as Record<string, unknown>)?.overlays as BlockOverlayItem[]) || []
      overlayType = overlays.find(o => o.id === capturedOverlayTarget.overlayId)?.type
    }
    const isVideoUpload = overlayType === 'video'
    if (isVideoUpload) {
      if (!file.type.startsWith('video/')) {
        toast.error('Please use a video file (MP4, WebM, MOV)')
        return
      }
    } else if (!file.type.startsWith('image/')) {
      toast.error('Please use an image file (JPG, PNG, WebP, ?)')
      return
    }
    if (overlayTarget) {
      overlayImageTargetRef.current = overlayTarget
      setOverlayImageTarget(overlayTarget)
      pendingOverlayUploadRef.current = overlayTarget
      if (selectedBlockIdRef.current !== overlayTarget.blockId) {
        setSelectedBlockId(overlayTarget.blockId)
      }
    }
    if (!selectedBlockIdRef.current) {
      toast.error('Select a block on the canvas first')
      return
    }
    const capturedBlockId = overlayTarget?.blockId ?? selectedBlockIdRef.current
    try {
      const saved = await overlayLayerUpload.mutateAsync(file)
      const uploadedUrl = saved.original_url || (saved as { url?: string }).url || ''
      if (!uploadedUrl) {
        toast.error(`Upload finished but no ${isVideoUpload ? 'video' : 'image'} URL was returned`)
        return
      }
      applyMediaUrlToSelection(uploadedUrl, {
        blockId: capturedBlockId,
        overlayTarget: capturedOverlayTarget,
      })
    } catch {
      toast.error('Upload failed ? try a smaller file or check your connection')
    } finally {
      clearPendingOverlayUpload()
    }
  }, [siteId, activePageId, overlayLayerUpload, applyMediaUrlToSelection, resolveOverlayUploadTarget, clearPendingOverlayUpload])

  const sectionMediaPicker = useImageSourcePicker({
    title: 'Image',
    showGallery: true,
    onFile: uploadImageFileToSelection,
    onUrl: url => {
      const overlayTarget = resolveOverlayUploadTarget()
      applyMediaUrlToSelection(url, {
        blockId: overlayTarget?.blockId ?? selectedBlockIdRef.current ?? undefined,
        overlayTarget,
      })
      clearPendingOverlayUpload()
    },
  })

  const openSectionMediaPicker = useCallback((overlayTarget?: { blockId: string; overlayId: string }) => {
    if (overlayTarget) {
      overlayImageTargetRef.current = overlayTarget
      setOverlayImageTarget(overlayTarget)
      pendingOverlayUploadRef.current = overlayTarget
      if (selectedBlockIdRef.current !== overlayTarget.blockId) {
        setSelectedBlockId(overlayTarget.blockId)
      }
    } else {
      pendingOverlayUploadRef.current = null
    }
    if (!selectedBlockIdRef.current && !overlayTarget?.blockId) {
      toast.error('Select a section on the canvas first')
      return
    }
    sectionMediaPicker.openPicker()
  }, [sectionMediaPicker.openPicker])

  const openOverlayImageFilePicker = openSectionMediaPicker

  const openOverlayImageUrlPrompt = useCallback(() => {
    if (!selectedBlock || !overlayImageTarget || overlayImageTarget.blockId !== selectedBlock.id) return
    const overlays = ((selectedBlock.props as Record<string, unknown>).overlays as BlockOverlayItem[]) || []
    const item = overlays.find(o => o.id === overlayImageTarget.overlayId && (o.type === 'image' || o.type === 'video'))
    if (!item) return
    const isVideo = item.type === 'video'
    openTextPrompt({
      title: isVideo ? 'Set video URL' : 'Set image URL',
      placeholder: isVideo ? 'https://?/video.mp4' : 'https://?/image.jpg',
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
      for (const { blockId: bid } of deleteJobs) {
        deletedBlockIdsRef.current.add(bid)
      }
      skipServerHydrateRef.current = Date.now()
      if (siteId) {
        try {
          const fresh = await websiteApi.getSite(siteId)
          queryClient.setQueryData(['websites', siteId], fresh)
        } catch {
          if (site) {
            queryClient.setQueryData<WebsiteSite>(['websites', siteId!], old =>
              old ? syncSiteQueryBlocks(old, nextMap) : old,
            )
          }
        }
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
    const planCtaLabel = propKey.match(/^plans\.(\d+)\.cta$/)
    const linkPropKey = planCtaLabel ? `plans.${planCtaLabel[1]}.cta_url` : propKey
    if (
      (propKey === 'block_link' || propKey === 'block_link_url')
      && !blockTypeSupportsBlockLink(block.block_type)
    ) {
      return
    }
    const p = block.props as any

    if (propKey.startsWith('social_links.')) {
      const platform = propKey.split('.')[1] || ''
      const socialLinks = { ...(p?.social_links || {}) }
      const currentValue: LinkValue = {
        type: socialLinks[platform] ? 'url' : 'none',
        target: socialLinks[platform] || '',
        label: platform.charAt(0).toUpperCase() + platform.slice(1),
        openInNewTab: true,
      }
      setLinkEditor({
        anchor,
        value: currentValue,
        save: (v) => {
          const next = { ...(p?.social_links || {}) }
          if (v.type === 'none' || !v.target.trim()) {
            delete next[platform]
          } else {
            next[platform] = v.target.trim()
          }
          handleUpdateBlockProps(blockId, { social_links: next } as any)
        },
      })
      return
    }

    const nestedColumnLinkMatch = linkPropKey.match(/^(\w+)\.(\d+)\.links\.(\d+)\.(href|url)$/)
    if (nestedColumnLinkMatch) {
      const [, arrayKey, colIdxStr, linkIdxStr, urlField] = nestedColumnLinkMatch
      const colIdx = Number.parseInt(colIdxStr, 10)
      const linkIdx = Number.parseInt(linkIdxStr, 10)
      const cols = Array.isArray(p?.[arrayKey]) ? [...(p[arrayKey] as unknown[])] : []
      const col = (cols[colIdx] && typeof cols[colIdx] === 'object'
        ? { ...(cols[colIdx] as object) }
        : {}) as Record<string, unknown>
      const links = Array.isArray(col.links) ? [...(col.links as unknown[])] : []
      const rawLink = links[linkIdx]
      const linkObj: Record<string, unknown> = rawLink && typeof rawLink === 'object'
        ? { ...(rawLink as Record<string, unknown>) }
        : { label: typeof rawLink === 'string' ? rawLink : '' }
      const label = String(linkObj.label ?? (typeof rawLink === 'string' ? rawLink : '') ?? '').trim()
      const target = String(linkObj[urlField] ?? linkObj.href ?? linkObj.url ?? '').trim()
      const currentValue: LinkValue = {
        type: target ? 'url' : 'none',
        target,
        label: label || 'Link',
        // Prefer saved preference; default http(s) links to new tab.
        openInNewTab: typeof linkObj.openInNewTab === 'boolean'
          ? !!linkObj.openInNewTab
          : /^https?:\/\//i.test(target),
      }
      setLinkEditor({
        anchor,
        value: currentValue,
        save: (v) => {
          const nextCols = Array.isArray(p?.[arrayKey]) ? [...(p[arrayKey] as unknown[])] : []
          while (nextCols.length <= colIdx) nextCols.push({ title: '', links: [] })
          const prevCol = nextCols[colIdx]
          const colBase = prevCol && typeof prevCol === 'object' ? { ...(prevCol as object) } : { title: '', links: [] }
          const nextLinks = Array.isArray((colBase as Record<string, unknown>).links)
            ? [...((colBase as Record<string, unknown>).links as unknown[])]
            : []
          while (nextLinks.length <= linkIdx) nextLinks.push('')
          const prevLink = nextLinks[linkIdx]
          const prevLabel = prevLink && typeof prevLink === 'object'
            ? String((prevLink as Record<string, unknown>).label ?? '')
            : String(prevLink ?? '')
          const nextLabel = (v.label || prevLabel || 'Link').trim()
          nextLinks[linkIdx] = {
            label: nextLabel,
            href: v.type === 'none' ? '' : v.target.trim(),
            openInNewTab: v.openInNewTab,
          }
          nextCols[colIdx] = { ...colBase, links: nextLinks }
          handleUpdateBlockProps(blockId, { [arrayKey]: nextCols } as Partial<BlockProps>)
        },
      })
      return
    }

    const arrayItemLinkMatch = linkPropKey.match(/^(\w+)\.(\d+)\.(url|href|cta_url)$/)
    if (arrayItemLinkMatch) {
      const [, arrayKey, indexStr, urlField] = arrayItemLinkMatch
      const index = Number.parseInt(indexStr, 10)
      const arr = Array.isArray(p?.[arrayKey]) ? [...(p[arrayKey] as unknown[])] : []
      const item = (arr[index] && typeof arr[index] === 'object'
        ? { ...(arr[index] as object) }
        : {}) as Record<string, unknown>
      const label = String(item.label ?? item.title ?? item.name ?? item.cta ?? '').trim()
      const target = String(item[urlField] ?? item.url ?? item.href ?? '').trim()
      const currentValue: LinkValue = {
        type: target ? 'url' : 'none',
        target,
        label,
        openInNewTab: typeof item.openInNewTab === 'boolean'
          ? !!item.openInNewTab
          : /^https?:\/\//i.test(target),
      }
      setLinkEditor({
        anchor,
        value: currentValue,
        save: (v) => {
          const nextArr = Array.isArray(p?.[arrayKey]) ? [...(p[arrayKey] as unknown[])] : []
          while (nextArr.length <= index) nextArr.push({})
          const prev = nextArr[index]
          const base = prev && typeof prev === 'object' ? { ...(prev as object) } : {}
          const nextItem = {
            ...base,
            [urlField]: v.type === 'none' ? '' : v.target.trim(),
            openInNewTab: v.openInNewTab,
            ...(v.label && urlField !== 'cta_url' ? { label: v.label } : {}),
            ...(v.label && urlField === 'cta_url' ? { cta: v.label } : {}),
          }
          nextArr[index] = nextItem
          if (arrayKey === 'items' && block.block_type === 'marquee_strip') {
            handleUpdateBlockProps(blockId, patchMarqueeBlockItemsFromRaw(nextArr) as Partial<BlockProps>)
            return
          }
          handleUpdateBlockProps(blockId, { [arrayKey]: nextArr } as Partial<BlockProps>)
        },
      })
      return
    }

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
    marquee_strip: { field: 'items.0.label', label: 'Marquee item' },
    footer: { field: 'copyright', label: 'Copyright' },
    rich_text: { field: 'content', label: 'Content', multiline: true },
    html_embed: { field: 'html', label: 'HTML code', multiline: true },
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
    openRightBuilderPanel()
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
    const actions: ContextMenuAction[] = [
      {
        id: 'props',
        label: 'Block properties (side panel)',
        icon: SlidersHorizontal,
        onSelect: () => { setRightPanel('props'); openRightBuilderPanel() },
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
        onSelect: () => { setRightPanel('style'); openRightBuilderPanel() },
      },
      ...(getSectionLayoutOptions(block.block_type).length > 0 ? [{
        id: 'layout',
        label: 'Change section style',
        icon: Layout,
        onSelect: () => openLayoutPickerForBlock(block),
      }] : []),
      ...(suggested && !dsType ? [{
        id: 'connect',
        label: `Connect to ${DATA_SOURCES.find(s => s.id === suggested)?.label}`,
        icon: Plug,
        onSelect: () => {
          handleUpdateBlockProps(block.id, { data_source: { type: suggested, auto: true } } as any)
          toast.success(`Connected to ${DATA_SOURCES.find(s => s.id === suggested)?.label}`)
        },
      }] : []),
      { id: 'div1', label: '', divider: true },
      {
        id: 'media',
        label: 'Images & media upload',
        icon: ImageIcon,
        onSelect: () => {
          setLeftPanel('media')
          openLeftBuilderPanel()
          const primaryField = sectionPrimaryImageField(
            String(block.block_type),
            (block.props ?? {}) as Record<string, unknown>,
          )
          if (primaryField) {
            handleSectionImageActivate(block.id, primaryField)
          }
          openSectionMediaPicker()
        },
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
  }, [handleUpdateBlockProps, confirmDeleteBlock, handleDuplicateBlock, openInlineTextEditForBlock, openLayoutPickerForBlock, openSectionMediaPicker, handleSectionImageActivate])

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
    const textPromptAnchor = (): { x: number; y: number } => {
      const toolbar = document.querySelector('[data-overlay-toolbar]')
      if (toolbar) {
        const rect = toolbar.getBoundingClientRect()
        return { x: Math.max(12, rect.left - 404), y: rect.top }
      }
      const placed = placeAnchoredPanel({ x: e.clientX, y: e.clientY }, 380, 280)
      return { x: placed.left, y: placed.top }
    }
    const actions: ContextMenuAction[] = [
      {
        id: 'layer-settings',
        label: `${overlayLayerTypeLabel(item.type)} settings`,
        icon: SlidersHorizontal,
        onSelect: () => openOverlaySettingsPanel(item.id, blockId),
      },
      { id: 'div-settings', label: '', divider: true },
      {
        id: 'cut-overlay',
        label: 'Cut layer',
        icon: Scissors,
        onSelect: () => { runOverlayClipboardAction('cut', blockId) },
      },
      {
        id: 'copy-overlay',
        label: 'Copy layer',
        icon: ClipboardCopy,
        onSelect: () => { runOverlayClipboardAction('copy', blockId) },
      },
      ...(hasOverlayClipboard() ? [{
        id: 'paste-overlay',
        label: 'Paste layer',
        icon: ClipboardPaste,
        onSelect: () => { runOverlayClipboardAction('paste', blockId) },
      }] : []),
      { id: 'div-clipboard', label: '', divider: true },
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
            openOverlayImageFilePicker({ blockId, overlayId: item.id })
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
      ...(item.type === 'video' ? [
        {
          id: 'upload-video',
          label: 'Upload video?',
          icon: Upload,
          onSelect: () => {
            onOverlayLayerPicked(item.id, blockId)
            openOverlayImageFilePicker({ blockId, overlayId: item.id })
          },
        },
        {
          id: 'library-video',
          label: 'Choose from library?',
          icon: Video,
          onSelect: () => {
            onOverlayLayerPicked(item.id, blockId)
            openMediaFromCanvas()
          },
        },
        {
          id: 'replace-video',
          label: 'Set video URL?',
          icon: Link2,
          onSelect: () => {
            openTextPrompt({
              title: 'Set video URL',
              subtitle: 'Paste a direct link to an MP4, WebM, or other video file.',
              placeholder: 'https://?/video.mp4',
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
          setOverlaySettingsPanelId(null)
        },
      },
    ]
    setContextMenu({ x: e.clientX, y: e.clientY, actions })
  }, [activePageId, localBlocks, handleUpdateBlockProps, openLinkEditorForOverlay, openTextPrompt, openOverlayImageFilePicker, openMediaFromCanvas, onOverlayLayerPicked, overlayImageTarget, openOverlaySettingsPanel, runOverlayClipboardAction])

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
    openRightBuilderPanel()
  }

  const openSectionsPanel = useCallback(() => {
    setLeftPanel('blocks')
    openLeftBuilderPanel()
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
    const pages = [...localPagesRef.current]
      .filter(p => isPersistedPageId(p.id))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const blocksToPersist = syncNavLinksInBlockMap(localBlocksRef.current, pages)

    for (const page of pages) {
      const blocks = (blocksToPersist[page.id] || []).map((b, i) => ({ ...b, sort_order: i }))
      if (!blocks.length) continue

      const pageReplacements: { tempId: string; saved: WebsiteBlock }[] = []
      const persistedBlocks: WebsiteBlock[] = []

      for (const b of blocks) {
        const apiPayload = blockPayloadForApi(b)
        if (b.id.startsWith('temp-')) {
          const existingSameType = GLOBAL_STRUCTURE_BLOCK_TYPES.has(b.block_type)
            ? blocks.find(x => x.block_type === b.block_type && !x.id.startsWith('temp-') && x.id !== b.id)
            : undefined
          if (existingSameType) {
            await websiteApi.updateBlock(siteId, page.id, existingSameType.id, apiPayload as any)
            pageReplacements.push({ tempId: b.id, saved: { ...existingSameType, ...b, id: existingSameType.id } })
            persistedBlocks.push({ ...existingSameType, ...b, id: existingSameType.id })
            continue
          }
          const saved = await websiteApi.createBlock(siteId, page.id, {
            block_type: b.block_type,
            ...apiPayload,
          } as any)
          pageReplacements.push({ tempId: b.id, saved })
          persistedBlocks.push(saved)
        } else {
          try {
            await websiteApi.updateBlock(siteId, page.id, b.id, apiPayload as any)
          } catch (err) {
            if (!isAxiosError(err) || err.response?.status !== 404) throw err
            if (deletedBlockIdsRef.current.has(b.id)) continue
            const saved = await websiteApi.createBlock(siteId, page.id, {
              block_type: b.block_type,
              ...apiPayload,
            } as any)
            pageReplacements.push({ tempId: b.id, saved })
            persistedBlocks.push(saved)
            continue
          }
          persistedBlocks.push(b)
        }
      }

      if (persistedBlocks.length) {
        const ordered = [...persistedBlocks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        await websiteApi.reorderBlocks(
          siteId,
          page.id,
          ordered.map((blk, i) => ({ id: blk.id, sort_order: i })),
        )
      }

      for (const r of pageReplacements) {
        replacements.push({ pageId: page.id, ...r })
      }
    }

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
      if (saveStyle) {
        const stylePayload = mergeWebsiteStyleConfig(
          site?.style_config as unknown as Record<string, unknown>,
          sanitizeForApiJson(localStyle) as unknown as Record<string, unknown>,
        )
        await websiteApi.updateSite(siteId, { style_config: stylePayload as any })
      }
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
          buildPublicSitePayloadFromLocal(site, pages, localBlocksRef.current, localStyle, vendorCatalogSlug),
          pageSlug,
        ).catch(() => { /* preview tab closed or not open */ })
      }
      if (!opts?.silent) {
        setSaveFlash(true)
        setTimeout(() => setSaveFlash(false), 1800)
        toast.success(saveBlocks && saveStyle ? 'Canvas and styles saved' : saveBlocks ? 'Canvas saved' : 'Styles saved')
      }
    } catch (err) {
      setAutoSaveStatus('error')
      console.error('[Builder save]', err)
      const message = extractApiError(err, opts?.silent ? 'Auto-save' : 'Save')
      toast.error(message)
    }
    setIsSaving(false)
    isSavingRef.current = false
  }, [siteId, localStyle, styleDirty, blocksDirty, persistAllBlocksToServer, site, activePageId, vendorCatalogSlug])

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
        buildPublicSitePayloadFromLocal(site, pages, localBlocksRef.current, localStyle, vendorCatalogSlug),
        pageSlug,
      ).catch(() => { /* preview tab not open */ })
    }, 3500)
    return () => clearTimeout(timer)
  }, [blocksDirty, styleDirty, siteId, site, activePageId, localStyle, vendorCatalogSlug])

  /** Save canvas, then enable or disable this design in Website templates. */
  const handleToggleStorefrontTemplate = useCallback(async () => {
    if (!siteId || isStorefrontTemplateToggling || !site || isExternalSite) return
    const enabling = !site.is_published
    setIsStorefrontTemplateToggling(true)
    try {
      if (enabling) {
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
        setStyleDirty(false)
        setBlocksDirty(false)
        blocksDirtyRef.current = false
        styleDirtyRef.current = false
        setLastSavedAt(new Date())
        setSaveFlash(true)
        setTimeout(() => setSaveFlash(false), 1800)
        toast.success('Enabled — assign this design in Business Website Templates')
      } else {
        await websiteApi.unpublishSite(siteId)
        toast.success('Disabled — hidden from Business Website Templates')
      }
      await queryClient.invalidateQueries({ queryKey: ['websites', siteId] })
      await queryClient.invalidateQueries({ queryKey: ['websites'], exact: true })
    } catch (err) {
      toast.error(extractApiError(err, enabling ? 'Enable for storefront' : 'Disable from templates'))
      console.error('[Toggle storefront template]', err)
    } finally {
      setIsStorefrontTemplateToggling(false)
    }
  }, [
    siteId,
    site,
    isStorefrontTemplateToggling,
    blocksDirty,
    styleDirty,
    persistAllPagesToServer,
    persistAllBlocksToServer,
    localStyle,
    queryClient,
    isExternalSite,
  ])

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

  const handleAddReadyPage = useCallback(async (slug: string, title: string, pageType: string) => {
    if (!siteId) return
    setReadyPagePickerOpen(false)
    try {
      let page: WebsitePage
      if (slug === 'rentals') {
        page = await websiteApi.ensureRentalsPage(siteId)
      } else {
        page = await websiteApi.createPage(siteId, {
          title,
          slug,
          page_type: pageType as WebsitePage['page_type'],
          sort_order: localPagesRef.current.length,
        } as any)
      }
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
        queryClient.setQueryData<WebsiteSite>(['websites', siteId], old => {
          if (!old) return old
          return { ...old, pages: [...old.pages, { ...page, blocks: seededBlocks }] }
        })
      }
      setActivePageId(page.id)
      toast.success(`"${title}" page added`)
    } catch { toast.error('Failed to add page') }
  }, [siteId, site, commitLocalBlocks, queryClient])

  // Delete page (soft delete — 7-day trash)
  const loadTrashedPages = useCallback(async (opts?: { silent?: boolean }): Promise<PageTrashItem[]> => {
    if (!siteId) return []
    setTrashLoading(true)
    try {
      const items = await websiteApi.listTrashedPages(siteId)
      setTrashedPages(items)
      return items
    } catch (err) {
      setTrashedPages([])
      if (!opts?.silent) {
        toast.error(extractApiError(err, 'Could not load deleted pages'))
      }
      return []
    } finally {
      setTrashLoading(false)
    }
  }, [siteId])

  const refreshTrashedPages = useCallback(() => { void loadTrashedPages() }, [loadTrashedPages])

  useEffect(() => {
    if (siteId && (rightPanel === 'page' || moreMenuOpen)) {
      void loadTrashedPages({ silent: true })
    }
  }, [rightPanel, moreMenuOpen, siteId, loadTrashedPages])

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
          const trash = await loadTrashedPages({ silent: true })
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
      void loadTrashedPages({ silent: true })
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to restore page'))
      void loadTrashedPages({ silent: true })
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

  const handleRenamePage = useCallback((page: WebsitePage) => {
    if (!siteId) return
    openTextPrompt({
      title: 'Rename page',
      subtitle: 'Changes the name shown in the builder and navigation menu. The page URL stays the same.',
      placeholder: 'e.g. About Us, Services, Contact…',
      initialValue: page.title,
      confirmLabel: 'Save name',
      minLength: 1,
      maxLength: 120,
      onSave: async (value) => {
        const title = value.trim()
        if (!title || title === page.title) return
        const backupPages = localPagesRef.current
        const nextPages = backupPages.map(p => (p.id === page.id ? { ...p, title } : p))
        localPagesRef.current = nextPages
        setLocalPages(nextPages)
        skipServerHydrateRef.current = Date.now()
        if (site) {
          queryClient.setQueryData<WebsiteSite>(['websites', siteId], old => {
            if (!old) return old
            return { ...old, pages: old.pages.map(p => (p.id === page.id ? { ...p, title } : p)) }
          })
        }
        try {
          if (isPersistedPageId(page.id)) {
            await websiteApi.updatePage(siteId, page.id, { title } as any)
          }
          toast.success('Page renamed')
        } catch (err) {
          localPagesRef.current = backupPages
          setLocalPages(backupPages)
          if (site) {
            queryClient.setQueryData<WebsiteSite>(['websites', siteId], old => {
              if (!old) return old
              return { ...old, pages: old.pages.map(p => (p.id === page.id ? { ...p, title: page.title } : p)) }
            })
          }
          toast.error(extractApiError(err, 'Failed to rename page'))
        }
      },
    })
  }, [siteId, site, openTextPrompt, queryClient])

  const handleMovePage = useCallback(async (pageId: string, direction: 'up' | 'down') => {
    const backup = localPagesRef.current
    const sorted = [...backup].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const idx = sorted.findIndex(p => p.id === pageId)
    if (idx < 0) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= sorted.length) return

    const reordered = [...sorted]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(targetIdx, 0, moved)
    const nextPages = reordered.map((p, i) => ({ ...p, sort_order: i }))

    localPagesRef.current = nextPages
    setLocalPages(nextPages)
    skipServerHydrateRef.current = Date.now()
    if (site) {
      queryClient.setQueryData<WebsiteSite>(['websites', siteId], old => {
        if (!old) return old
        const byId = new Map(nextPages.map(p => [p.id, p]))
        return {
          ...old,
          pages: old.pages.map(p => byId.get(p.id) ?? p).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        }
      })
    }

    const persisted = nextPages.filter(p => isPersistedPageId(p.id))
    if (!siteId || !persisted.length) return

    try {
      await websiteApi.reorderPages(
        siteId,
        persisted.map(p => ({ id: p.id, sort_order: p.sort_order ?? 0 })),
      )
    } catch (err) {
      localPagesRef.current = backup
      setLocalPages(backup)
      if (site) {
        queryClient.setQueryData<WebsiteSite>(['websites', siteId], old => {
          if (!old) return old
          const byId = new Map(backup.map(p => [p.id, p]))
          return {
            ...old,
            pages: old.pages.map(p => byId.get(p.id) ?? p).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
          }
        })
      }
      toast.error(extractApiError(err, 'Failed to reorder pages'))
    }
  }, [siteId, site, queryClient])

  // Store test URL — business front /store/:slug resolves vendors via GET /catalog/vendor/{slug} (Vendor.slug),
  // not wb_sites.subdomain. In dev, always use the logged-in vendor's catalog slug so links don't 404.
  const siteTestUrl = useMemo(() => {
    if (!site) return null
    const vendorSettings = myVendor?.settings ?? null
    const customDomain = site.custom_domain?.trim()
    if (customDomain) {
      return customDomain.startsWith('http://') || customDomain.startsWith('https://')
        ? customDomain
        : `https://${customDomain}`
    }
    if (vendorCatalogSlug) {
      const scopedLink = resolveSiteStoreLink(vendorCatalogSlug, site, builderStores, vendorSettings)
      if (scopedLink) return scopedLink

      const linkMode = resolveStorefrontLinkMode(vendorSettings)
      const templateMode = resolveStorefrontTemplateMode(vendorSettings)
      if (!storefrontUrlNeedsBranch(linkMode, templateMode)) {
        return buildCustomerStoreLink(vendorCatalogSlug)
      }

      const linkedStore =
        site.website_store_scope === 'store' && site.website_store_id
          ? builderStores.find(s => s.id === site.website_store_id)
          : builderStores[0]
      if (linkedStore) {
        return customerLinkForStore(vendorCatalogSlug, linkedStore, linkMode, templateMode)
      }

      if (shouldUseLocalStorefrontUrls()) {
        return `${getStorefrontAppOrigin()}/store/${encodeURIComponent(vendorCatalogSlug)}`
      }
    }
    if (!shouldUseLocalStorefrontUrls() && site.subdomain?.trim()) {
      return `https://${site.subdomain.trim()}.kiterp.com`
    }
    return null
  }, [site, vendorCatalogSlug, builderStores, myVendor?.settings])

  const siteAssignedToBus = useMemo(
    () => (site ? isBuilderSiteAssignedToAnyStore(site, builderStores, myVendor?.settings) : false),
    [site, builderStores, myVendor?.settings],
  )

  const canViewStoreLink = Boolean(siteAssignedToBus && siteTestUrl)

  const handleViewStore = useCallback(async () => {
    if (canViewStoreLink && siteTestUrl) {
      if (storePopover) {
        setStorePopover(false)
        setStorePopoverRect(null)
      } else {
        const el = viewStoreAnchorRef.current
        if (el) {
          const rect = el.getBoundingClientRect()
          setStorePopoverRect({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
        }
        setStorePopover(true)
      }
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
  }, [canViewStoreLink, siteTestUrl, storePopover, openTextPrompt, updateSite])

  const handleOpenBrowserPreview = useCallback(async () => {
    if (!siteId || !site || openingBrowserPreviewRef.current) return
    openingBrowserPreviewRef.current = true
    setOpeningBrowserPreview(true)
    clearPendingPreviewTabNavigate(siteId)
    clearPendingPreviewTabError(siteId)
    const previewTab = prepareDraftPreviewTab(siteId)
    try {
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
        const message = 'Could not resolve your vendor store slug. Open the dashboard home once, then try again.'
        toast.error(message)
        broadcastPreviewTabError(message, siteId)
        return
      }
      const payload = buildPublicSitePayloadFromLocal(site, localPages, localBlocks, localStyle, vendorSlug)
      const { preview_token } = await websiteApi.createBuilderPreview(siteId, {
        payload,
        label: `Preview ${new Date().toLocaleString()}`,
      })
      rememberDraftPreviewSession(siteId, preview_token)
      const url = buildVendorDraftPreviewUrl(preview_token, activePage?.slug, siteId)
      const delivered = navigateDraftPreviewTab(url, siteId)
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
      broadcastPreviewTabError(message, siteId)
    } finally {
      openingBrowserPreviewRef.current = false
      setOpeningBrowserPreview(false)
    }
  }, [siteId, site, myVendor, localPages, localBlocks, localStyle, activePage, siteTestUrl])

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
  }, [designWidthPx, leftCollapsed, rightCollapsed, leftWidth, rightWidth, isLoading, site, activePageId, compactSidePanels])

  useLayoutEffect(() => {
    const main = canvasMainRef.current
    if (!main) return
    main.scrollLeft = 0
    // Keep preview fitted when side panels resize (user can zoom again after).
    setCanvasZoom(1)
  }, [canvasFitScale, designWidthPx, leftCollapsed, rightCollapsed, leftWidth, rightWidth, compactSidePanels])

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
  }, [activePageId, device, canvasBlocksRevision, effectiveCanvasScale])

  const scaledCanvasWidth = Math.round(designWidthPx * effectiveCanvasScale)
  /** zoom (not transform) so position:sticky works for nav / announcement in the canvas. */
  const canvasScaleStyle = {
    width: designWidthPx,
    zoom: effectiveCanvasScale,
  } as React.CSSProperties
  const canvasOuterHeight = canvasPreviewHeight

  useLayoutEffect(() => {
    const main = canvasMainRef.current
    if (!main) return
    const maxScrollLeft = Math.max(0, scaledCanvasWidth + CANVAS_VIEWPORT_PAD_PX - main.clientWidth)
    if (main.scrollLeft > maxScrollLeft) main.scrollLeft = maxScrollLeft
  }, [scaledCanvasWidth, leftCollapsed, rightCollapsed, leftWidth, rightWidth, compactSidePanels])

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

  const builderModalOpen = Boolean(
    sectionLayoutPicker
    || linkEditor
    || textPrompt
    || inlineTextEdit
    || contextMenu
    || commandPaletteOpen,
  )
  return (
    <div className="fixed inset-0 flex flex-col bg-gray-100 z-[100]" style={{ fontFamily: 'Inter, sans-serif' }}>
      {sectionMediaPicker.modal}

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

      {/* Ready page picker modal */}
      <ReadyPagePickerModal
        open={readyPagePickerOpen}
        pages={availableReadyPages as unknown as ReadyPageItem[]}
        onSelect={handleAddReadyPage}
        onClose={() => setReadyPagePickerOpen(false)}
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

      {storePopover && canViewStoreLink && siteTestUrl && storePopoverRect && site && createPortal(
        <>
          <div
            className="fixed inset-0 z-[310]"
            aria-hidden
            onClick={() => {
              setStorePopover(false)
              setStorePopoverRect(null)
            }}
          />
          <div
            ref={storePopoverRef}
            role="dialog"
            aria-label={site.is_published ? 'Live store URL' : 'Preview store URL'}
            className={cn('fixed z-[320] w-[min(18rem,calc(100vw-1rem))] rounded-xl border p-3 shadow-2xl', builderPanelUi.popover)}
            style={{ top: storePopoverRect.top, right: storePopoverRect.right }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className={builderPanelUi.eyebrow}>
                {site.is_published ? 'Live URL' : 'Preview URL'}
              </div>
              {site.is_published ? (
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-px text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                  Published
                </span>
              ) : null}
            </div>
            <div className={cn('mb-2 rounded-lg px-2 py-1.5', builderPanelUi.mutedSurface)}>
              <div className="flex items-start gap-1.5">
                <Globe className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                <span
                  className="min-w-0 flex-1 break-all font-mono text-[10px] leading-snug text-foreground"
                  title={siteTestUrl}
                >
                  {siteTestUrl}
                </span>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(siteTestUrl).catch(() => {})
                  toast.success('Link copied to clipboard!')
                  setStorePopover(false)
                  setStorePopoverRect(null)
                }}
                className={cn(builderPanelUi.btnSecondary, 'flex-1 justify-center px-2 py-1.5 text-[10px] font-medium')}
              >
                <Copy className="h-3 w-3" /> Copy
              </button>
              <button
                type="button"
                onClick={() => {
                  window.open(siteTestUrl, '_blank')
                  setStorePopover(false)
                  setStorePopoverRect(null)
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-[10px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ExternalLink className="h-3 w-3" /> Open
              </button>
            </div>
          </div>
        </>,
        document.body,
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
          if (panel === 'settings') {
            setSiteSettingsOpen(true)
            return
          }
          setLeftPanel(panel)
          openLeftBuilderPanel()
        }}
        onOpenSeoManagement={() => {
          const params = new URLSearchParams()
          if (siteId) params.set('siteId', siteId)
          if (activePageId) params.set('pageId', activePageId)
          const qs = params.toString()
          navigate(`/websites/seo${qs ? `?${qs}` : ''}`)
        }}
        onOpenRightPanel={(panel) => {
          setRightPanel(panel)
          openRightBuilderPanel()
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
                  {isExternalSite ? 'Other Use' : site.is_published ? 'Ready to assign' : 'Not in templates'}
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

                  <div className="border-t border-border bg-muted/25 px-3 py-2.5">
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
                  <div className={cn('absolute right-0 top-full z-[300] mt-1.5 w-72 max-h-[min(70vh,520px)] overflow-y-auto rounded-xl', builderPanelUi.popover)}>
                    <p className={cn(builderPanelUi.eyebrow, 'px-3 pt-2.5 pb-1')}>
                      Business Website Templates
                    </p>

                    {!isExternalSite ? (
                    <div
                      className={cn(
                        builderPanelUi.menuItem,
                        'cursor-default justify-between gap-3 hover:bg-transparent',
                        site?.is_published && 'bg-emerald-500/5',
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        {isStorefrontTemplateToggling ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <StoreIcon className={cn(
                            'h-4 w-4 shrink-0',
                            site?.is_published ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                          )} />
                        )}
                        <span className="min-w-0 flex-1">
                          Assign to storefront
                          <span className={builderPanelUi.menuItemHint}>
                            {site?.is_published
                              ? 'Showing in Business Website Templates — assign to a business unit'
                              : 'Turn on to show in Business Website Templates'}
                          </span>
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!!site?.is_published}
                        aria-label={site?.is_published ? 'Disable for storefront assign' : 'Enable for storefront assign'}
                        disabled={isStorefrontTemplateToggling || applyingTemplateInline || !siteId}
                        onClick={() => void handleToggleStorefrontTemplate()}
                        className={cn(
                          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
                          site?.is_published
                            ? 'border-emerald-500/60 bg-emerald-500'
                            : 'border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700',
                          (isStorefrontTemplateToggling || applyingTemplateInline) && 'cursor-wait opacity-60',
                        )}
                      >
                        <span
                          className={cn(
                            'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                            site?.is_published ? 'translate-x-[18px]' : 'translate-x-0.5',
                          )}
                        />
                      </button>
                    </div>
                    ) : null}

                    {/* View store — only when this template is assigned to a business unit */}
                    {canViewStoreLink ? (
                      <div className="relative">
                        <button
                          ref={viewStoreAnchorRef}
                          type="button"
                          onClick={handleViewStore}
                          title={siteTestUrl ?? undefined}
                          className={builderPanelUi.menuItem}
                        >
                          <ExternalLink className="h-4 w-4 shrink-0 text-primary" />
                          <span className="flex-1">
                            View store
                            <span className={builderPanelUi.menuItemHint}>
                              Open or copy your store link
                            </span>
                          </span>
                        </button>
                      </div>
                    ) : null}

                    <div className={cn('my-1 border-t', builderPanelUi.divider)} />
                    <p className={cn(builderPanelUi.eyebrow, 'px-3 pt-1 pb-1')}>
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
                      title="Save a copy of this site as a new website in Business Website Builder"
                      className={builderPanelUi.menuItem}
                    >
                      <ClipboardCopy className="h-4 w-4 shrink-0 text-primary" />
                      <span className="flex-1">
                        Copy template / Save As
                        <span className={builderPanelUi.menuItemHint}>
                          Duplicate this site under a new name
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!siteId || !site}
                      onClick={() => { setMoreMenuOpen(false); setInputParamsOpen(true) }}
                      title="View and edit template setup inputs"
                      className={builderPanelUi.menuItem}
                    >
                      <SlidersHorizontal className="h-4 w-4 shrink-0 text-primary" />
                      <span className="flex-1">
                        Input parameters
                        <span className={builderPanelUi.menuItemHint}>
                          Edit name, scope, sections, and palette
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={!siteId || !site}
                      onClick={() => { setMoreMenuOpen(false); setSiteSettingsOpen(true) }}
                      title="Site language, branding, redirects, and headless API"
                      className={builderPanelUi.menuItem}
                    >
                      <Globe className="h-4 w-4 shrink-0 text-primary" />
                      <span className="flex-1">
                        Site
                        <span className={builderPanelUi.menuItemHint}>
                          Language, branding, redirects &amp; more
                        </span>
                      </span>
                    </button>

                    {/* Recently deleted pages (7-day trash) — always visible in Tools */}
                    <div className={builderPanelUi.trashSection}>
                      <div className={builderPanelUi.trashSectionHeader}>
                        <Trash2 className={cn('h-4 w-4 shrink-0', builderPanelUi.amberIcon)} />
                        <span className="flex-1 text-xs font-semibold text-foreground">
                          Recently deleted
                          {trashedPages.length > 0 && (
                            <span className={cn(builderPanelUi.amberBadge, 'ml-1.5')}>
                              {trashedPages.length}
                            </span>
                          )}
                          <span className={cn(builderPanelUi.menuItemHint, 'text-muted-foreground')}>
                            Restore pages removed in the last 7 days
                          </span>
                        </span>
                      </div>
                      <DeletedPagesPanel
                        variant="menu"
                        alwaysShow
                        items={trashedPages}
                        loading={trashLoading}
                        onRestore={handleRestorePage}
                        onRefresh={refreshTrashedPages}
                      />
                    </div>

                    {/* Change history (restore previous edits) */}
                    <button
                      type="button"
                      onClick={() => setChangeHistoryOpen(v => !v)}
                      aria-expanded={changeHistoryOpen}
                      className={builderPanelUi.menuItem}
                    >
                      <History className="h-4 w-4 shrink-0 text-primary" />
                      <span className="flex-1">
                        Change history
                        <span className={builderPanelUi.menuItemHint}>
                          Restore a previous version of this session
                        </span>
                      </span>
                      <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', changeHistoryOpen && 'rotate-180')} />
                    </button>

                    {changeHistoryOpen && (
                      <div className={cn('max-h-60 overflow-y-auto border-t', builderPanelUi.divider, builderPanelUi.mutedSurface, 'rounded-none border-x-0 border-b-0')} data-history-version={historyVersion}>
                        {historyStack.current.length === 0 ? (
                          <p className={cn(builderPanelUi.hint, 'px-3 py-4 text-center')}>
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
                                  isCurrent ? 'cursor-default bg-primary/10' : 'hover:bg-muted/50',
                                )}
                              >
                                <span className={cn(
                                  'h-1.5 w-1.5 shrink-0 rounded-full',
                                  isCurrent ? 'bg-primary' : 'bg-muted-foreground/40',
                                )} />
                                <span className="flex-1 min-w-0">
                                  <span className="block truncate text-[11px] font-semibold text-foreground">
                                    {label}
                                    {isCurrent && <span className="ml-1.5 text-[9px] font-bold uppercase text-primary">Current</span>}
                                  </span>
                                  <span className={builderPanelUi.menuItemHint}>
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
      <div className="relative flex flex-1 overflow-hidden">
        {showPanelBackdrop && (
          <button
            type="button"
            aria-label="Close side panel"
            className="absolute inset-0 z-[190] bg-black/25"
            onClick={() => {
              closeLeftBuilderPanel()
              closeRightBuilderPanel()
            }}
          />
        )}

        {/* Compact (Phone/Tablet/narrow): corner expand chips — no side rails / white gutters */}
        {compactSidePanels && leftCollapsed && (
          <button
            type="button"
            onClick={openLeftBuilderPanel}
            title="Open panel — Sections, Pages, Templates, Media"
            className={cn(
              builderPanelUi.panelEdgeToggleCorner,
              builderPanelUi.panelEdgeToggleCornerLeft,
            )}
          >
            <PanelLeft className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
        {compactSidePanels && rightCollapsed && (
          <button
            type="button"
            onClick={openRightBuilderPanel}
            title="Open panel — Section Edit, Page Edit, Links, Style"
            className={cn(
              builderPanelUi.panelEdgeToggleCorner,
              builderPanelUi.panelEdgeToggleCornerRight,
            )}
          >
            <PanelRight className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}

        {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
        {/* Compact+collapsed: omit rail so canvas is full-bleed. Desktop keeps a thin rail. */}
        {(leftPanelOverlay || !compactSidePanels) && (
        <aside
          className={cn(
            'flex flex-col border-r',
            builderPanelUi.shell,
            builderPanelUi.panelRailStack,
            leftPanelOverlay
              ? 'absolute inset-y-0 left-0 z-[200] shadow-2xl'
              : 'relative shrink-0',
            !leftPanelOverlay && leftCollapsed ? 'w-10' : '',
          )}
          style={
            leftCollapsed && !leftPanelOverlay
              ? undefined
              : { width: Math.min(leftWidth, compactSidePanels ? 320 : leftWidth) }
          }
        >
          {leftCollapsed ? (
            <button
              type="button"
              onClick={openLeftBuilderPanel}
              title="Open panel — Sections, Pages, Templates, Media"
              className={cn(
                builderPanelUi.panelEdgeToggle,
                builderPanelUi.panelEdgeToggleMid,
                'right-0 translate-x-1/2',
              )}
            >
              <PanelLeft className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : (
            <>
              {/* Left panel tabs */}
              <div className={builderPanelUi.tabStrip}>
                <div className={builderPanelUi.tabStripTabs}>
                {([
                  { id: 'blocks' as const, icon: Layout, label: 'Sections' },
                  { id: 'pages' as const, icon: FileText, label: 'Pages' },
                  { id: 'templates' as const, icon: Sparkles, label: 'Templates' },
                  { id: 'media' as const, icon: ImageIcon, label: 'Media' },
                ] as const).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setLeftPanel(id)}
                      title={label}
                      className={cn(
                        builderPanelUi.tabBtn,
                        leftPanel === id ? builderPanelUi.tabActive : builderPanelUi.tabInactive,
                      )}
                    >
                      <Icon className={builderPanelUi.tabBtnIcon} />
                      <span className={builderPanelUi.tabBtnLabel}>{label}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={closeLeftBuilderPanel}
                  title="Collapse panel"
                  className={cn(builderPanelUi.tabCollapseBtn, 'mr-1.5 self-center')}
                >
                  <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>

              <BuilderWelcomePanel
                dismissed={builderWelcomeDismissed}
                onDismiss={() => {
                  dismissBuilderWelcome()
                  setBuilderWelcomeDismissed(true)
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

              <div className={builderPanelUi.panelBody}>
                {/* SECTIONS panel — sticky search/filter + add-section catalog */}
                {leftPanel === 'blocks' && (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
                      <Select
                        value={sectionCategory}
                        onChange={setSectionCategory}
                        options={BLOCK_CATEGORIES.map(cat => ({ value: cat.id, label: cat.label }))}
                        className="w-full pl-3 pr-8 py-2 text-xs border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                        aria-label="Filter section category"
                      />
                    </div>

                    <div className={cn(builderPanelUi.panelScroll, 'p-3 space-y-3')}>
                      <div>
                        <FormColumnLabel className="tracking-wide px-1 mb-2">
                          {`Add Section${sectionSearchLower || sectionCategory !== 'all' ? ` · ${filteredCatalogBlocks.length}` : ''}`}
                        </FormColumnLabel>
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
                  </div>
                )}

                {/* PAGES panel — pages with expandable sections */}
                {leftPanel === 'pages' && (
                  <div className={cn(builderPanelUi.panelScroll, 'p-3 space-y-1.5')}>
                    <div className="px-1 mb-1">
                      <FormColumnLabel className="tracking-wide">
                        {`${localPages.length} page${localPages.length !== 1 ? 's' : ''}`}
                      </FormColumnLabel>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                        Open <strong className="font-semibold text-gray-500">Actions</strong> on a page to duplicate or delete it.
                      </p>
                    </div>
                    {pageSectionGroups.map(({ page, entries, totalBlocks }, pageIndex) => {
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
                                  {!websiteBlogEnabled && (page.page_type === 'blog' || String(page.slug || '').toLowerCase() === 'blog') && (
                                    <span className="text-[8px] bg-amber-100 text-amber-800 rounded px-1 font-bold shrink-0" title="Hidden on the live website until you enable Blog in Blog Manager">
                                      HIDDEN
                                    </span>
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
                              totalPages={sortedSitePages.length}
                              pageIndex={pageIndex}
                              onRename={() => { handleRenamePage(page) }}
                              onSetHomepage={() => { void handleSetHomepage(page) }}
                              onMoveUp={() => { void handleMovePage(page.id, 'up') }}
                              onMoveDown={() => { void handleMovePage(page.id, 'down') }}
                              onDuplicate={() => { void handleDuplicatePage(page) }}
                              onDelete={() => handleDeletePage(page.id, page.title)}
                            />
                          </div>

                          {isExpanded && (
                            <div className="px-1.5 pb-1.5 space-y-0.5 border-t border-border bg-muted/25 pt-1">
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
                    {availableReadyPages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setReadyPagePickerOpen(true)}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-500 font-semibold hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700 transition-colors mt-1.5"
                      >
                        <Layout className="w-3.5 h-3.5" /> Add Ready Page
                      </button>
                    )}
                    {activePage && localPages.length > 0 && (
                      <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 space-y-2">
                        <div className="text-[11px] font-semibold text-gray-700 truncate" title={activePage.title}>
                          Current page: {activePage.title}
                        </div>
                        {!websiteBlogEnabled && (activePage.page_type === 'blog' || String(activePage.slug || '').toLowerCase() === 'blog') && (
                          <p className="text-[10px] leading-snug text-amber-700">
                            Blog is off in Blog Manager, so this screen will not appear in the website menu until you turn on Show on website.
                          </p>
                        )}
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
                  <div className={cn(builderPanelUi.panelScroll, 'p-3 space-y-2')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wide leading-tight pt-0.5">
                        Business Website Templates
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
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <MediaStudioPanel
                    siteId={siteId!}
                    selectedBlock={selectedBlock}
                    applyToImageLayer={applyToImageLayer}
                    applyTargetDescription={mediaApplyTargetDescription}
                    onApplyUrl={applyMediaUrlToSelection}
                  />
                  </div>
                )}

              </div>
            </>
          )}
        </aside>
        )}

        {/* ── LEFT RESIZE HANDLE ──────────────────────────────────────── */}
        {!compactSidePanels && !leftCollapsed && (
          <div
            className={cn(
              'w-px shrink-0 self-stretch bg-transparent transition-colors group hover:bg-gray-500 active:bg-gray-600',
              builderPanelUi.panelResizeStack,
            )}
            title="Drag to resize panel"
          >
            <div
              className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize"
              onMouseDown={e => {
                e.preventDefault()
                isResizingLeft.current = true
                document.body.style.cursor = 'col-resize'
                document.body.style.userSelect = 'none'
              }}
            />
          </div>
        )}

        {/* ── CANVAS ──────────────────────────────────────────────────── */}
        <main className="relative z-0 flex-1 min-w-0 flex flex-col overflow-hidden bg-gray-100">
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
            const selectionHint = formatPaintBrush
              ? `Copy formatting — click text to apply (${formatPaintStyleSummary(formatPaintBrush.style)})${formatPaintBrush.sticky ? ' · apply to several' : ''}`
              : overlayImageTarget?.blockId === block.id && overlayImageTarget.overlayId
                ? 'Inserted layer selected — General tab edits text; Visual tab handles layout and style'
                : canvasImageTarget?.blockId === block.id && canvasImageStyleField(canvasImageTarget, block.id)
                  ? (() => {
                      const slots = canvasImageArraySlots(canvasImageTarget, block.id)
                      if (slots.length > 1) {
                        return `${slots.length} photos selected — toolbar changes apply to all`
                      }
                      return slots.length
                        ? 'Photo selected — zoom and crop in General / Visual, or replace in Media'
                        : 'Section photo selected — adjust zoom, position, or height here'
                    })()
                  : multiFieldSelectionOnBlock
                    ? `${selectedCount} text areas selected — toolbar applies to all`
                    : `${catalogBlockLabel(block)} selected — double-click text to edit`
            return (
              <div className="shrink-0 z-10 bg-white border-b border-gray-200 shadow-sm">
                <BlockDesignBar
                  docked
                  selectionHint={selectionHint}
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
                  onOverlayClipboard={action => runOverlayClipboardAction(action, block.id)}
                  onOpenSectionEdit={() => {
                    setRightPanel('props')
                    openRightBuilderPanel()
                  }}
                  onOpenLayoutPicker={() => openLayoutPickerForBlock(block)}
                  onCycleLayout={dir => { void cycleBlockLayout(block, dir) }}
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
            className="builder-canvas-scroll relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            onDragOver={handleCanvasDragOver}
            onDrop={handleDropOnCanvas}
          >
          {device !== 'desktop' && (
            <div className="sticky top-0 z-[60] flex items-center justify-center gap-2 border-b border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary backdrop-blur-sm">
              {device === 'mobile' ? <Smartphone className="h-3.5 w-3.5" /> : <Tablet className="h-3.5 w-3.5" />}
              <span>
                {device === 'mobile'
                  ? 'Phone preview — tap the side rails to open panels as drawers'
                  : 'Tablet preview — side panels open as drawers; spacing & layout follow this breakpoint'}
              </span>
              <button
                type="button"
                onClick={() => setDevice('desktop')}
                className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary/80 hover:bg-primary/15 hover:text-primary"
              >
                Desktop
              </button>
            </div>
          )}

          {/* Embedded catalog / commerce page (product, service, cart, checkout…) shown
              in-place instead of opening a separate preview tab. */}
          {(canvasCatalogRoute || canvasCatalogLoading) && (
            <div className="absolute inset-0 z-40 flex flex-col bg-white">
              <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-gray-50 px-3 py-2">
                <button
                  type="button"
                  onClick={exitCanvasCatalog}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  Back to editor
                </button>
                <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-gray-500">
                  <Eye className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                  <span className="truncate">Store page preview — this page isn’t edited here, use the live data above.</span>
                </span>
              </div>
              {canvasCatalogRoute && canvasCatalogToken ? (
                <DraftCatalogPreview
                  vendorSlug={builderVendorSlug || vendorCatalogSlug || 'preview'}
                  catalogRoute={canvasCatalogRoute}
                  previewToken={canvasCatalogToken}
                  hideBreadcrumb
                />
              ) : (
                <div className="flex flex-1 items-center justify-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading store page…
                </div>
              )}
            </div>
          )}

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
                height: canvasOuterHeight,
              }}
            >
              {!activePage ? (
                <div
                  ref={canvasPreviewInnerRef}
                  data-page-canvas="true"
                  onClickCapture={handleCanvasNavClickCapture}
                  style={canvasScaleStyle}
                  className="shadow-lg rounded-none min-h-[600px] overflow-visible"
                >
                  <div className="flex items-center justify-center h-full text-gray-400 py-32">
                    <div className="text-center">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Select a page to start building</p>
                    </div>
                  </div>
                </div>
              ) : activeBlocks.length === 0 ? (
                <div
                  ref={canvasPreviewInnerRef}
                  data-page-canvas="true"
                  data-preview-bp={device}
                  onClickCapture={handleCanvasNavClickCapture}
                  style={canvasScaleStyle}
                  className="shadow-lg rounded-none min-h-[600px] overflow-visible"
                >
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
                </div>
              ) : (
                <BuilderCanvasProviders
                  siteId={siteId!}
                  vendorSlug={builderVendorSlug || 'preview'}
                  siteName={site?.name}
                  businessProfile={builderBusinessProfile}
                  previewStore={builderPreviewStore}
                  builderPublicSite={builderPublicSite}
                  onNavigate={handleNavigateBuilderPage}
                  activePageSlug={activePage?.slug ?? null}
                  activePageIsHomepage={Boolean(activePage?.is_homepage)}
                  canvasScale={effectiveCanvasScale}
                  previewBreakpoint={device}
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
                  onPropLinkEdit={(blockId, propKey, anchor) => openLinkEditorForProp(blockId, propKey, anchor)}
                  onDeleteBlockField={handleCanvasDeleteBlockField}
                >
                <>
                  <div
                    ref={canvasPreviewInnerRef}
                    data-page-canvas="true"
                    data-preview-bp={device}
                    onClickCapture={handleCanvasNavClickCapture}
                    style={canvasScaleStyle}
                    className="shadow-lg rounded-none min-h-[600px] overflow-visible"
                  >
                    <div
                      ref={builderPageRootRef}
                      className={cn('relative', formatPaintBrush && 'builder-format-paint-active')}
                      onClickCapture={handleCanvasBlockSelectCapture}
                      onContextMenuCapture={handleCanvasBlockContextMenuCapture}
                    >
                      {builderPublicSite && (
                        <BuilderCanvasPageRenderer
                          publicSite={builderPublicSite}
                          blocks={activeBlocks}
                          pageId={activePageId}
                          isHomepage={Boolean(activePage?.is_homepage)}
                          revision={canvasBlocksRevision}
                        />
                      )}

                      {activeBlocks.map((block, idx) => (
                      <BuilderSectionOverlay
                        key={block.id}
                        blockId={block.id}
                        containerRef={builderPageRootRef}
                        scrollRootRef={canvasMainRef}
                        layoutScale={1}
                        revision={canvasBlocksRevision}
                        selected={selectedBlockId === block.id}
                        label={catalogBlockLabel(block)}
                        imageSelected={
                          selectedBlockId === block.id
                          && Boolean(canvasImageStyleField(canvasImageTarget, block.id))
                        }
                        saving={savingBlockId === block.id}
                        visible={block.visible !== false}
                        shellHeader={block.block_type === 'nav' || block.block_type === 'announcement_bar'}
                        dropBefore={dropTarget?.idx === idx && dropTarget.before}
                        dropAfter={dropTarget?.idx === idx && !dropTarget.before}
                        dragging={draggingBlockIdx === idx}
                        interactive={draggingBlockIdx !== null || draggingNewBlock !== null}
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
                          visible={selectedBlockId === block.id}
                          containerRef={builderPageRootRef}
                          scrollRootRef={canvasMainRef}
                          canvasRevision={canvasBlocksRevision}
                          onMinimize={() => {
                            if (pinnedSectionToolbars.has(block.id)) {
                              unpinSectionToolbar(block.id)
                              minimizeSectionToolbar(block.id)
                              return
                            }
                            if (!minimizedSectionToolbars.has(block.id)) {
                              minimizeSectionToolbar(block.id)
                            }
                          }}
                          onTogglePin={() => togglePinSectionToolbar(block.id)}
                          onMoveBlock={dir => handleMoveBlock(block.id, dir)}
                          onDuplicate={() => handleDuplicateBlock(block.id)}
                          onDelete={() => confirmDeleteBlock(block.id)}
                          onOpenLayoutPicker={() => openLayoutPickerForBlock(block)}
                          onCycleLayout={dir => { void cycleBlockLayout(block, dir) }}
                          onOpenLinksPanel={() => {
                            setSelectedBlockId(block.id)
                            setRightPanel('links')
                            openRightBuilderPanel()
                          }}
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
                          'absolute left-0 top-0 z-[74] max-w-[min(100%,240px)] truncate px-1.5 py-0.5 rounded-br text-[10px] font-bold bg-primary text-white transition-opacity pointer-events-none',
                          selectedBlockId === block.id ? 'opacity-0' : 'opacity-0 group-hover:opacity-80',
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
                          mobilePreview={device === 'mobile'}
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
                          settingsPanelOverlayId={
                            block.id === selectedBlockId && overlayImageTarget?.blockId === block.id
                              ? overlaySettingsPanelId
                              : null
                          }
                          onCloseSettingsPanel={closeOverlaySettingsPanel}
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

                        {(() => {
                          const sectionResizeActive = selectedBlockId === block.id
                          const inlineEditingThisBlock = inlineTextEdit?.blockId === block.id
                          const suppressSectionResizeChrome =
                            builderModalOpen
                            || Boolean(canvasImageStyleField(canvasImageTarget, block.id))
                            || inlineEditingThisBlock
                            || (overlayImageTarget?.blockId === block.id && overlayImageTarget?.overlayId)

                          if (!sectionResizeActive || suppressSectionResizeChrome) return null

                          const sectionSpacing = resolveBlockSectionSpacing(block, device)
                          const { paddingTop, paddingBottom } = sectionSpacing
                          return (
                          <>
                          <BuilderSectionPaddingHandles
                            blockId={block.id}
                            containerRef={builderPageRootRef}
                            scrollRootRef={canvasMainRef}
                            revision={canvasBlocksRevision}
                            paddingTop={paddingTop}
                            paddingBottom={paddingBottom}
                            canvasScale={effectiveCanvasScale}
                            suppressed={false}
                            onPaddingPreview={patch => applySectionPaddingPatch(block.id, patch, false)}
                            onPaddingCommit={patch => applySectionPaddingPatch(block.id, patch, true)}
                          />
                          <SectionSizeControl
                            blockId={block.id}
                            containerRef={builderPageRootRef}
                            scrollRootRef={canvasMainRef}
                            scale={sectionSpacing.sectionScale}
                            canvasScale={effectiveCanvasScale}
                            onPreview={next => applySectionPaddingPatch(block.id, { section_scale: next }, false)}
                            onCommit={next => applySectionPaddingPatch(block.id, { section_scale: next }, true)}
                            onActivate={() => {
                              setSelectedBlockId(block.id)
                              setRightPanel('props')
                              openRightBuilderPanel()
                            }}
                          />
                          </>
                          )
                        })()}

                        {selectedBlockId === block.id
                          && Number((block.props as Record<string, unknown>).min_height ?? 0) > 0
                          && !canvasImageStyleField(canvasImageTarget, block.id)
                          && inlineTextEdit?.blockId !== block.id && (
                          <div
                            data-section-min-height-handle
                            title="Minimum section height (not padding) — drag or clear in Layout → More"
                            className="absolute bottom-0 right-2 translate-y-[calc(100%+4px)] z-[55] flex h-4 w-4 items-center justify-center rounded border-2 border-amber-400 bg-white shadow-sm cursor-ns-resize pointer-events-auto hover:bg-amber-50"
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
                  </div>
                </>
                </BuilderCanvasProviders>
              )}
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
        {!compactSidePanels && !rightCollapsed && (
          <div
            className={cn(
              'w-px shrink-0 self-stretch bg-transparent transition-colors group hover:bg-gray-500 active:bg-gray-600',
              builderPanelUi.panelResizeStack,
            )}
            title="Drag to resize panel"
          >
            <div
              className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize"
              onMouseDown={e => {
                e.preventDefault()
                isResizingRight.current = true
                document.body.style.cursor = 'col-resize'
                document.body.style.userSelect = 'none'
              }}
            />
          </div>
        )}

        {/* ── RIGHT PANEL ──────────────────────────────────────────────── */}
        {(rightPanelOverlay || !compactSidePanels) && (
        <aside
          className={cn(
            'flex flex-col border-l',
            builderPanelUi.shell,
            builderPanelUi.panelRailStack,
            rightPanelOverlay
              ? 'absolute inset-y-0 right-0 z-[200] shadow-2xl'
              : 'relative shrink-0',
            !rightPanelOverlay && rightCollapsed ? 'w-10' : '',
          )}
          style={
            rightCollapsed && !rightPanelOverlay
              ? undefined
              : { width: Math.min(rightWidth, compactSidePanels ? 320 : rightWidth) }
          }
        >
          {rightCollapsed ? (
            <button
              type="button"
              onClick={openRightBuilderPanel}
              title="Open panel — Section Edit, Page Edit, Links, Style"
              className={cn(
                builderPanelUi.panelEdgeToggle,
                builderPanelUi.panelEdgeToggleMid,
                'left-0 -translate-x-1/2',
              )}
            >
              <PanelRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : (
            <>
              {/* Right panel tabs */}
              <div className={builderPanelUi.tabStrip}>
                <div className={builderPanelUi.tabStripTabs}>
                {([
                  { id: 'props' as const, icon: Settings2, label: 'Section Edit', hint: 'Text, colors, and layout for the selected section' },
                  { id: 'page' as const, icon: FileText, label: 'Page Edit', hint: 'Page-wide colors and fonts (switch pages in the left Pages panel)' },
                  { id: 'links' as const, icon: Link2, label: 'Links', hint: 'Connect this section’s buttons to pages, products, or any URL' },
                  { id: 'style' as const, icon: Palette, label: 'Template Style', hint: 'Site fonts and colors' },
                ] as const).map(({ id, icon: Icon, label, hint }) => (
                  <button
                    key={id}
                    onClick={() => setRightPanel(id)}
                    title={hint}
                    className={cn(
                      builderPanelUi.tabBtn,
                      rightPanel === id ? builderPanelUi.tabActive : builderPanelUi.tabInactive,
                    )}
                  >
                    <Icon className={builderPanelUi.tabBtnIcon} />
                    <span className={builderPanelUi.tabBtnLabel}>{label}</span>
                  </button>
                ))}
                </div>
                <button
                  type="button"
                  onClick={closeRightBuilderPanel}
                  title="Collapse panel"
                  className={cn(builderPanelUi.tabCollapseBtn, 'ml-1.5 mr-1.5 self-center')}
                >
                  <PanelRightClose className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>

              <div className={builderPanelUi.panelBody}>
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
                      onSelectLayoutIndex={idx => { void applyBlockLayoutAtIndex(selectedBlock, idx) }}
                      onArrayItemImageFocus={(arrayKey, index, itemField) => {
                        handleArrayItemImageFocus(selectedBlock.id, arrayKey, index, itemField)
                      }}
                      themeColors={{
                        primary_color: canvasStyle.primary_color || '#64C3A0',
                        text_color: canvasStyle.text_color || '#111827',
                        surface_color: canvasStyle.surface_color || '#f9fafb',
                        bg_color: canvasStyle.bg_color || '#ffffff',
                      }}
                      previewDevice={device}
                      onPreviewDeviceChange={setDevice}
                    />
                  ) : (
                    <div className="p-4 space-y-4">
                      <div className="text-center py-8">
                        <MousePointerIcon className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="text-sm font-semibold text-foreground">Select a section on the canvas</p>
                        <p className={cn(builderPanelUi.hintXs, 'mt-1')}>Colors, layout, and content appear under Section Edit → Design.</p>
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
                    onRefreshTrash={refreshTrashedPages}
                  />
                )}

                {rightPanel === 'links' && (
                  <SectionLinksPanel
                    block={selectedBlock}
                    selectedLink={linksPanelSelection}
                    onSelectOverlay={selectLinkPanelOverlay}
                    onSelectPropLink={selectLinkPanelProp}
                    onSelectBlockLink={selectLinkPanelBlock}
                    onEditPropLink={(propKey, anchor) =>
                      selectedBlock && openLinkEditorForProp(selectedBlock.id, propKey, anchor)
                    }
                    onEditOverlayLink={(item, anchor) =>
                      selectedBlock && openLinkEditorForOverlay(selectedBlock.id, item, anchor)
                    }
                  />
                )}

                {rightPanel === 'style' && (
                  <BuilderStylePanel style={localStyle} onChange={s => { setLocalStyle(prev => ({ ...prev, ...s })); setStyleDirty(true) }} />
                )}

              </div>
            </>
          )}
        </aside>
        )}
      </div>

      {site && siteId ? (
        <BuilderSiteInputParametersModal
          open={inputParamsOpen}
          onClose={() => setInputParamsOpen(false)}
          site={site}
          siteId={siteId}
          stores={builderStores}
          vendor={myVendor}
          onStyleSaved={(style, savedName) => {
            setLocalStyle(prev => ({ ...prev, ...style }))
            setStyleDirty(true)
            if (savedName !== site.name) {
              queryClient.setQueryData(['websites', siteId], (prev: WebsiteSite | undefined) =>
                prev ? { ...prev, name: savedName, style_config: style } : prev,
              )
            }
          }}
        />
      ) : null}

      {site && siteId ? (
        <SiteSettingsModal
          open={siteSettingsOpen}
          onClose={() => setSiteSettingsOpen(false)}
          siteId={siteId}
          site={site}
        />
      ) : null}
    </div>
  )
}

// ── Site Settings Modal ───────────────────────────────────────────────────────

function SiteSettingsModal({
  open,
  onClose,
  siteId,
  site,
}: {
  open: boolean
  onClose: () => void
  siteId: string
  site: WebsiteSite
}) {
  useEscapeToClose(onClose, open)

  if (!open) return null

  return (
    <div data-kiterp-modal className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Site settings</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Language, branding, redirects, and optional headless API.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <SiteSettingsPanel siteId={siteId} site={site} layout="modal" />
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

function SiteSettingsPanel({
  siteId,
  site,
  layout = 'sidebar',
}: {
  siteId: string
  site: WebsiteSite
  layout?: 'sidebar' | 'modal'
}) {
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
    <div className={cn('flex flex-col', layout === 'sidebar' ? 'h-full' : 'min-h-0 flex-1')}>
      <div className="flex shrink-0 items-center gap-0.5 border-b border-gray-100 px-1 py-1">
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

      <div className={cn('flex-1 overflow-y-auto p-4 space-y-4', layout === 'modal' && 'max-h-[min(70vh,640px)]')}>
        {/* I18N TAB */}
        {tab === 'i18n' && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Primary Language</label>
              <Select
                value={lang}
                onChange={setLang}
                options={LANGUAGES.map(l => ({ value: l.code, label: `${l.label} (${l.code})` }))}
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Currency</label>
              <Select
                value={currency}
                onChange={v => {
                  const c = CURRENCIES.find(x => x.code === v)
                  setCurrency(v)
                  if (c) setCurrSymbol(c.symbol)
                }}
                options={CURRENCIES.map(c => ({ value: c.code, label: `${c.label} (${c.symbol})` }))}
                className="text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Symbol</label>
                <input value={currSymbol} onChange={e => setCurrSymbol(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Position</label>
                <Select
                  value={currPos}
                  onChange={setCurrPos}
                  options={[
                    { value: 'before', label: 'Before (₹999)' },
                    { value: 'after', label: 'After (999₹)' },
                  ]}
                  className="text-xs"
                />
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
                  <Select
                    value={String(newCode)}
                    onChange={v => setNewCode(Number(v) as 301 | 302)}
                    options={[
                      { value: '301', label: '301 Permanent' },
                      { value: '302', label: '302 Temporary' },
                    ]}
                    className="text-xs"
                  />
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
                <div className={cn('w-8 h-5 rounded-full shrink-0 border-2 transition-colors cursor-pointer flex items-center', siteHeadless ? 'border-transparent bg-primary' : 'border-gray-300 bg-gray-200 dark:border-gray-500 dark:bg-gray-600')}
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


// Tiny icon component to avoid import conflict
function MousePointerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4l7.07 17 2.51-7.39L21 11.07z" />
    </svg>
  )
}
