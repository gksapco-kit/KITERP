import { useEffect, useState } from 'react'
import { Eye, EyeOff, Layout, Settings2 } from 'lucide-react'
import { blockRegistry } from '../../lib/blockRegistry'
import { heroModeChangePatch, supportsHeroBackgroundMode } from '../../lib/blockUtils'
import type { HeroBackgroundMode } from '../../types/builder'
import { CardListPropertiesFields } from './CardListPropertiesFields'
import { LogosPropertiesFields } from './LogosPropertiesFields'
import { TeamPropertiesFields } from './TeamPropertiesFields'
import { TestimonialPropertiesFields } from './TestimonialPropertiesFields'
import { CardsPropertiesFields } from './CardsPropertiesFields'
import { TabsPropertiesFields } from './TabsPropertiesFields'
import { CarouselPropertiesFields } from './CarouselPropertiesFields'
import { ImageTitleSliderPropertiesFields } from './ImageTitleSliderPropertiesFields'
import { CategoryStackPropertiesFields } from './CategoryStackPropertiesFields'
import { GalleryPropertiesFields } from './GalleryPropertiesFields'
import { ProductVideoGalleryPropertiesFields } from './ProductVideoGalleryPropertiesFields'
import { ContactFormPropertiesFields } from './ContactFormPropertiesFields'
import { MultiStepFormPropertiesFields } from './MultiStepFormPropertiesFields'
import { MapPropertiesFields } from './MapPropertiesFields'
import { ProductListingPropertiesFields } from './ProductListingPropertiesFields'
import { FaqPropertiesFields } from './FaqPropertiesFields'
import { FooterPropertiesFields } from './FooterPropertiesFields'
import { LEGACY_CARD_TYPES } from '../../lib/cardDefaults'
import { HeroBackgroundFields } from './HeroBackgroundFields'
import { HeroBannerLayoutFields } from './HeroBannerLayoutFields'
import { supportsHeroBannerLayoutOptions } from '../../lib/pageLayout'
import { HeroSplitPropertiesFields } from './HeroSplitPropertiesFields'
import { HeroBannerSliderPropertiesFields } from './HeroBannerSliderPropertiesFields'
import { SearchBarPropertiesFields } from './SearchBarPropertiesFields'
import { BackToTopPropertiesFields } from './BackToTopPropertiesFields'
import { ToastNotificationPropertiesFields } from './ToastNotificationPropertiesFields'
import { CookieBannerPropertiesFields } from './CookieBannerPropertiesFields'
import { ChatFloatPropertiesFields } from './ChatFloatPropertiesFields'
import { StickyAddToCartPropertiesFields } from './StickyAddToCartPropertiesFields'
import { ProductRatingPropertiesFields } from './ProductRatingPropertiesFields'
import { ShippingReturnsInfoPropertiesFields } from './ShippingReturnsInfoPropertiesFields'
import { PaymentMethodsPropertiesFields } from './PaymentMethodsPropertiesFields'
import { SecureCheckoutPropertiesFields } from './SecureCheckoutPropertiesFields'
import { StatsCounterPropertiesFields } from './StatsCounterPropertiesFields'
import { HowItWorksPropertiesFields } from './HowItWorksPropertiesFields'
import { TimelinePropertiesFields } from './TimelinePropertiesFields'
import { StateScreenPropertiesFields } from './StateScreenPropertiesFields'
import { isStateScreenType } from '../../lib/stateScreenConfig'
import { ProductTabsPropertiesFields } from './ProductTabsPropertiesFields'
import { ProgressBarPropertiesFields } from './ProgressBarPropertiesFields'
import { SkeletonLoaderPropertiesFields } from './SkeletonLoaderPropertiesFields'
import { SimpleLoaderPropertiesFields } from './SimpleLoaderPropertiesFields'
import { ModalPropertiesFields } from './ModalPropertiesFields'
import { CommentsSectionPropertiesFields } from './CommentsSectionPropertiesFields'
import { PollVotingPropertiesFields } from './PollVotingPropertiesFields'
import { MentionsTaggingPropertiesFields } from './MentionsTaggingPropertiesFields'
import { LivePresencePropertiesFields } from './LivePresencePropertiesFields'
import { UserProfileCardPropertiesFields } from './UserProfileCardPropertiesFields'
import { StepperPropertiesFields } from './StepperPropertiesFields'
import { OffCanvasMenuPropertiesFields } from './OffCanvasMenuPropertiesFields'
import { FloatingActionButtonPropertiesFields } from './FloatingActionButtonPropertiesFields'
import { WishlistPropertiesFields } from './WishlistPropertiesFields'
import { RecentlyViewedPropertiesFields } from './RecentlyViewedPropertiesFields'
import { FrequentlyBoughtTogetherPropertiesFields } from './FrequentlyBoughtTogetherPropertiesFields'
import { InfiniteScrollPropertiesFields } from './InfiniteScrollPropertiesFields'
import { BundleBuilderPropertiesFields } from './BundleBuilderPropertiesFields'
import { CartDrawerPropertiesFields } from './CartDrawerPropertiesFields'
import { BeforeAfterSlidePropertiesFields } from './BeforeAfterSlidePropertiesFields'
import { CountdownTimerPropertiesFields } from './CountdownTimerPropertiesFields'
import { PricingMatrixPropertiesFields } from './PricingMatrixPropertiesFields'
import { DataTablePropertiesFields } from './DataTablePropertiesFields'
import { LightboxPropertiesFields } from './LightboxPropertiesFields'
import { LookbookPropertiesFields } from './LookbookPropertiesFields'
import { CommerceBannerPropertiesFields, isCommerceBannerType } from './CommerceBannerPropertiesFields'
import { PageBackgroundFields } from './PageBackgroundFields'
import { useActivePage, useBuilderStore, useSelectedBlock, useSelectedBlockLocation } from '../../store/useBuilderStore'
import { ContainerPropertiesFields } from './ContainerPropertiesFields'
import { ContainerChildLayoutFields } from './ContainerChildLayoutFields'
import { NavbarPropertiesFields } from './NavbarPropertiesFields'
import type { Block, ContainerLayout } from '../../types/builder'
import { ImageUploadField } from '../builder/ImageUploadField'
import { ColumnsInput } from './ColumnsInput'
import { StylePanel } from './StylePanel'
import { SectionSubtitleWidthField } from './SectionSubtitleWidthField'

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-600">{label}</span>
      {hint ? <p className="mb-1.5 text-[11px] leading-snug text-gray-500">{hint}</p> : null}
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

type PropertiesPanelTab = 'page' | 'component'

function PropertiesPanelTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: PropertiesPanelTab
  onTabChange: (tab: PropertiesPanelTab) => void
}) {
  const tabs: { id: PropertiesPanelTab; label: string; icon: typeof Layout }[] = [
    { id: 'page', label: 'Page', icon: Layout },
    { id: 'component', label: 'Component', icon: Settings2 },
  ]

  return (
    <div className="flex gap-1 px-4 pb-3">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onTabChange(id)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition ${
            activeTab === id
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {label}
        </button>
      ))}
    </div>
  )
}

export function PropertiesPanel() {
  const selectedBlockId = useBuilderStore((s) => s.selectedBlockId)
  const updateBlockProps = useBuilderStore((s) => s.updateBlockProps)
  const updateBlockStyles = useBuilderStore((s) => s.updateBlockStyles)
  const toggleBlockVisibility = useBuilderStore((s) => s.toggleBlockVisibility)
  const mode = useBuilderStore((s) => s.mode)
  const catalog = useBuilderStore((s) => s.catalog)
  const activePage = useActivePage()
  const updatePageBackground = useBuilderStore((s) => s.updatePageBackground)
  const setDarkMode = useBuilderStore((s) => s.setDarkMode)
  const darkMode = useBuilderStore((s) => s.darkMode)
  const block = useSelectedBlock()
  const blockLocation = useSelectedBlockLocation()
  const parentContainerLayout =
    blockLocation?.parent?.type === 'container'
      ? blockLocation.parent.props.containerLayout ?? 'row'
      : undefined
  const [panelTab, setPanelTab] = useState<PropertiesPanelTab>('page')

  useEffect(() => {
    if (selectedBlockId) setPanelTab('component')
  }, [selectedBlockId])

  if (mode === 'preview') {
    return (
      <aside className="flex w-72 shrink-0 flex-col border-l border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-500">Switch to Edit mode to customize elements.</p>
      </aside>
    )
  }

  const def = block
    ? blockRegistry[block.type] ??
      (block.type === 'heroBgImage' || block.type === 'heroGradient' || block.type === 'heroVideo'
        ? blockRegistry.hero
        : block.type === 'slider'
          ? blockRegistry.carousel
          : LEGACY_CARD_TYPES.has(block.type)
            ? blockRegistry.cardGrid
            : undefined)
    : undefined

  const headerTitle =
    panelTab === 'page'
      ? 'Page settings'
      : def?.label ?? 'Component'
  const headerSubtitle =
    panelTab === 'page'
      ? activePage
        ? `${activePage.name} — background & appearance`
        : 'Select a page'
      : def
        ? `${def.category} · Drag to reorder · Duplicate & delete on canvas`
        : 'Select a component on the canvas'

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-gray-200 bg-gray-50">
      <div className="border-b border-gray-200">
        <div className="px-4 py-4">
          <h2 className="text-sm font-semibold text-gray-900">{headerTitle}</h2>
          <p className="mt-1 text-xs text-gray-500">{headerSubtitle}</p>
        </div>
        <PropertiesPanelTabs activeTab={panelTab} onTabChange={setPanelTab} />
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {panelTab === 'page' ? (
          activePage ? (
            <PageBackgroundFields
              page={activePage}
              darkMode={darkMode}
              onBackgroundChange={(background) => updatePageBackground(background ?? {})}
              onDarkModeChange={setDarkMode}
            />
          ) : (
            <p className="text-sm text-gray-400">No page selected.</p>
          )
        ) : block && def ? (
          <>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3">
              <span className="text-xs font-medium text-gray-700">Visibility</span>
              <button
                type="button"
                onClick={() => toggleBlockVisibility(block.id)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                {block.props.visible !== false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {block.props.visible !== false ? 'Visible' : 'Hidden'}
              </button>
            </div>

            <ContentFields
              block={block}
              catalog={catalog}
              parentContainerLayout={parentContainerLayout}
              onChange={(p) => updateBlockProps(block.id, p)}
              onStylesChange={(s) => updateBlockStyles(block.id, s)}
              onHeroModeChange={(mode) => {
                const patch = heroModeChangePatch(mode, block.props)
                updateBlockProps(block.id, patch.props)
                updateBlockStyles(block.id, patch.styles)
              }}
            />
            {block.props.subtitle !== undefined && (
              <SectionSubtitleWidthField
                styles={block.styles}
                onChange={(s) => updateBlockStyles(block.id, s)}
              />
            )}
            {block.type !== 'searchBar' &&
              block.type !== 'backToTop' &&
              block.type !== 'toastNotification' &&
              block.type !== 'cookieBanner' &&
              block.type !== 'modal' &&
              block.type !== 'chatFloat' &&
              block.type !== 'offCanvasMenu' &&
              block.type !== 'floatingActionButton' &&
              block.type !== 'cartDrawer' &&
              block.type !== 'stickyAddToCart' &&
              block.type !== 'productRating' && (
              <>
                <hr className="border-gray-200" />
                <StylePanel block={block} onChange={(s) => updateBlockStyles(block.id, s)} isNestedInContainer={!!parentContainerLayout} />
              </>
            )}
          </>
        ) : (
          <p className="text-center text-sm text-gray-400">
            Click any section on the canvas to edit its content and styles.
          </p>
        )}
      </div>
    </aside>
  )
}

function ContentFields({
  block,
  catalog,
  onChange,
  onStylesChange,
  onHeroModeChange,
  parentContainerLayout,
}: {
  block: Block
  catalog: { products: { id: string; name: string }[]; services: { id: string; name: string }[] }
  onChange: (props: Partial<Block['props']>) => void
  onStylesChange: (styles: Partial<Block['styles']>) => void
  onHeroModeChange: (mode: HeroBackgroundMode) => void
  parentContainerLayout?: ContainerLayout
}) {
  const { type, props } = block
  const hasHeroBgMode =
    supportsHeroBackgroundMode(type)
  const hasText = ['heading', 'paragraph', 'button', 'buttonLink', 'iconButton', 'badge', 'announcementBanner'].includes(type)
  const isFooter = type === 'footer' || type === 'footerMinimal'
  const isCardGrid = type === 'cardGrid'
  const isCategoryTabs = type === 'categoryTabs'
  const isCategoryStack = type === 'categoryStack'
  const isCardListView = type === 'cardListView'
  const isGallery = type === 'gallery'
  const isLookbook = type === 'lookbook'
  const isProductVideoGallery = type === 'productVideoGallery'
  const isCarousel = type === 'carousel' || type === 'slider'
  const isImageTitleSlider = type === 'imageTitleSlider'
  const isTestimonial = type === 'testimonial'
  const isTeam = type === 'teamMembers'
  const isLogos = type === 'logosSection'
  const isFaq = type === 'faqAccordion'
  const isContactForm = type === 'contactForm'
  const isMultiStepForm = type === 'multiStepForm'
  const isMap = type === 'mapEmbed'
  const isHeroSplit = type === 'heroSplit'
  const isHeroBannerSlider = type === 'heroBannerSlider'
  const isProductListing = type === 'productListing'
  const isContainer = type === 'container'
  const isNavbar = type === 'navbar'
  const isSearchBar = type === 'searchBar'
  const isBackToTop = type === 'backToTop'
  const isToastNotification = type === 'toastNotification'
  const isCookieBanner = type === 'cookieBanner'
  const isModal = type === 'modal'
  const isChatFloat = type === 'chatFloat'
  const isStickyAddToCart = type === 'stickyAddToCart'
  const isProductRating = type === 'productRating'
  const isShippingReturnsInfo = type === 'shippingReturnsInfo'
  const isPaymentMethods = type === 'paymentMethods'
  const isSecureCheckout = type === 'secureCheckout'
  const isStatsCounter = type === 'statsCounter'
  const isHowItWorks = type === 'howItWorks'
  const isTimeline = type === 'timeline'
  const isStateScreen = isStateScreenType(type)
  const isProductTabs = type === 'productTabs'
  const isProgressBar = type === 'progressBar'
  const isSkeletonLoader = type === 'skeletonLoader'
  const isSimpleLoader = type === 'simpleLoader'
  const isCommentsSection = type === 'commentsSection'
  const isPollVoting = type === 'pollVoting'
  const isMentionsTagging = type === 'mentionsTagging'
  const isLivePresence = type === 'livePresence'
  const isUserProfileCard = type === 'userProfileCard'
  const isStepper = type === 'stepper'
  const isOffCanvasMenu = type === 'offCanvasMenu'
  const isFloatingActionButton = type === 'floatingActionButton'
  const isWishlist = type === 'wishlist'
  const isRecentlyViewed = type === 'recentlyViewed'
  const isFrequentlyBoughtTogether = type === 'frequentlyBoughtTogether'
  const isInfiniteScroll = type === 'infiniteScroll'
  const isBundleBuilder = type === 'bundleBuilder'
  const isCartDrawer = type === 'cartDrawer'
  const isBeforeAfterSlide = type === 'beforeAfterSlide'
  const isCountdownTimer = type === 'countdownTimer'
  const isPricingMatrix = type === 'pricingMatrix'
  const isDataTable = type === 'dataTable'
  const isLightbox = type === 'lightbox'
  const isCommerceBanner = isCommerceBannerType(type)

  if (isImageTitleSlider) {
    return <ImageTitleSliderPropertiesFields block={block} onChange={onChange} />
  }

  if (isSearchBar) {
    return (
      <SearchBarPropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
    )
  }

  if (isBackToTop) {
    return (
      <BackToTopPropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
    )
  }

  if (isToastNotification) {
    return (
      <ToastNotificationPropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
    )
  }

  if (isCookieBanner) {
    return (
      <CookieBannerPropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
    )
  }

  if (isModal) {
    return (
      <ModalPropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
    )
  }

  if (isChatFloat) {
    return (
      <ChatFloatPropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
    )
  }

  if (isOffCanvasMenu) {
    return <OffCanvasMenuPropertiesFields block={block} onChange={onChange} />
  }

  if (isFloatingActionButton) {
    return <FloatingActionButtonPropertiesFields block={block} onChange={onChange} />
  }

  if (isCartDrawer) {
    return <CartDrawerPropertiesFields block={block} onChange={onChange} />
  }

  if (isStickyAddToCart) {
    return (
      <StickyAddToCartPropertiesFields
        block={block}
        catalog={catalog}
        onChange={onChange}
        onStylesChange={onStylesChange}
      />
    )
  }

  if (isProductRating) {
    return (
      <ProductRatingPropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
    )
  }

  if (isShippingReturnsInfo) {
    return <ShippingReturnsInfoPropertiesFields block={block} onChange={onChange} />
  }

  if (isPaymentMethods) {
    return <PaymentMethodsPropertiesFields block={block} onChange={onChange} />
  }

  if (isSecureCheckout) {
    return <SecureCheckoutPropertiesFields block={block} onChange={onChange} />
  }

  if (isStatsCounter) {
    return <StatsCounterPropertiesFields block={block} onChange={onChange} />
  }

  if (isHowItWorks) {
    return <HowItWorksPropertiesFields block={block} onChange={onChange} />
  }

  if (isTimeline) {
    return <TimelinePropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
  }

  if (isStateScreen) {
    return <StateScreenPropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
  }

  if (isProductTabs) {
    return <ProductTabsPropertiesFields block={block} onChange={onChange} />
  }

  if (isProgressBar) {
    return <ProgressBarPropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
  }

  if (isSkeletonLoader) {
    return <SkeletonLoaderPropertiesFields block={block} onChange={onChange} />
  }

  if (isSimpleLoader) {
    return <SimpleLoaderPropertiesFields block={block} onChange={onChange} />
  }

  if (isCommentsSection) {
    return <CommentsSectionPropertiesFields block={block} onChange={onChange} />
  }

  if (isPollVoting) {
    return <PollVotingPropertiesFields block={block} onChange={onChange} />
  }

  if (isMentionsTagging) {
    return <MentionsTaggingPropertiesFields block={block} onChange={onChange} />
  }

  if (isLivePresence) {
    return <LivePresencePropertiesFields block={block} onChange={onChange} />
  }

  if (isUserProfileCard) {
    return <UserProfileCardPropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
  }

  if (isStepper) {
    return <StepperPropertiesFields block={block} onChange={onChange} />
  }

  if (isWishlist) {
    return <WishlistPropertiesFields block={block} onChange={onChange} />
  }

  if (isRecentlyViewed) {
    return <RecentlyViewedPropertiesFields block={block} onChange={onChange} />
  }

  if (isFrequentlyBoughtTogether) {
    return <FrequentlyBoughtTogetherPropertiesFields block={block} onChange={onChange} />
  }

  if (isInfiniteScroll) {
    return <InfiniteScrollPropertiesFields block={block} onChange={onChange} />
  }

  if (isBundleBuilder) {
    return <BundleBuilderPropertiesFields block={block} onChange={onChange} />
  }

  if (isBeforeAfterSlide) {
    return (
      <BeforeAfterSlidePropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
    )
  }

  if (isCountdownTimer) {
    return <CountdownTimerPropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
  }

  if (isPricingMatrix) {
    return <PricingMatrixPropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
  }

  if (isDataTable) {
    return <DataTablePropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
  }

  if (isLightbox) {
    return <LightboxPropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
  }

  if (isMultiStepForm) {
    return <MultiStepFormPropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
  }

  if (isLookbook) {
    return <LookbookPropertiesFields block={block} onChange={onChange} />
  }

  if (isCommerceBanner) {
    return <CommerceBannerPropertiesFields block={block} onChange={onChange} />
  }

  const hasTitle =
    !hasText &&
    props.text !== undefined &&
    !isCardGrid && !isCategoryTabs && !isCategoryStack && !isCardListView && !isGallery && !isLightbox && !isLookbook && !isBeforeAfterSlide && !isCountdownTimer && !isPricingMatrix && !isDataTable && !isProductVideoGallery && !isShippingReturnsInfo && !isPaymentMethods && !isSecureCheckout && !isStatsCounter && !isHowItWorks && !isTimeline && !isStateScreen && !isProductTabs && !isProgressBar && !isSkeletonLoader && !isSimpleLoader && !isCommentsSection && !isPollVoting && !isMentionsTagging && !isLivePresence && !isUserProfileCard && !isStepper && !isWishlist && !isRecentlyViewed && !isFrequentlyBoughtTogether && !isInfiniteScroll && !isBundleBuilder && !isCarousel && !isImageTitleSlider && !isHeroBannerSlider && !isTestimonial && !isTeam && !isLogos && !isFaq && !isContactForm && !isMultiStepForm && !isMap && !isHeroSplit && !isProductListing && !isContainer &&
    (['hero', 'cta', 'contact', 'contactForm', 'newsletterForm', 'promoBanner', 'gradientBanner', 'imageBanner', 'gridSection', 'featureGrid', 'features', 'faqAccordion', 'reviews', 'pricingTable', 'productShowcase', 'featuresComparison', 'checkoutCta', 'heroCta', 'cartWidget', 'checkoutWidget'].includes(
      type,
    ) || LEGACY_CARD_TYPES.has(type))

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Content</p>
      <p className="text-xs text-gray-400">Double-click text on canvas for inline editing.</p>

      {parentContainerLayout != null && (
        <ContainerChildLayoutFields
          block={block}
          parentLayout={parentContainerLayout}
          onChange={onChange}
        />
      )}

      {isCategoryStack && <CategoryStackPropertiesFields block={block} onChange={onChange} />}

      {isCategoryTabs && <TabsPropertiesFields block={block} onChange={onChange} />}

      {isCardGrid && <CardsPropertiesFields block={block} onChange={onChange} />}

      {isCardListView && <CardListPropertiesFields block={block} onChange={onChange} />}

      {isGallery && <GalleryPropertiesFields block={block} onChange={onChange} />}

      {isProductVideoGallery && <ProductVideoGalleryPropertiesFields block={block} onChange={onChange} />}

      {isCarousel && <CarouselPropertiesFields block={block} onChange={onChange} />}

      {isHeroBannerSlider && <HeroBannerSliderPropertiesFields block={block} onChange={onChange} />}

      {isTestimonial && <TestimonialPropertiesFields block={block} onChange={onChange} />}

      {isTeam && <TeamPropertiesFields block={block} onChange={onChange} />}

      {isLogos && <LogosPropertiesFields block={block} onChange={onChange} />}

      {isFaq && <FaqPropertiesFields block={block} onChange={onChange} />}

      {isContactForm && <ContactFormPropertiesFields block={block} onChange={onChange} />}

      {isMap && <MapPropertiesFields block={block} onChange={onChange} />}

      {isFooter && (
        <FooterPropertiesFields
          block={block}
          variant={type === 'footerMinimal' ? 'minimal' : 'full'}
          onChange={onChange}
        />
      )}

      {isHeroSplit && <HeroSplitPropertiesFields block={block} onChange={onChange} />}

      {isProductListing && <ProductListingPropertiesFields block={block} onChange={onChange} />}

      {isNavbar && <NavbarPropertiesFields block={block} onChange={onChange} />}

      {isContainer && (
        <ContainerPropertiesFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
      )}

      {hasHeroBgMode && (
        <HeroBackgroundFields
          block={block}
          onPropsChange={onChange}
          onStylesChange={onStylesChange}
          onModeChange={onHeroModeChange}
        />
      )}

      {supportsHeroBannerLayoutOptions(type) && (
        <HeroBannerLayoutFields block={block} onChange={onChange} onStylesChange={onStylesChange} />
      )}

      {type === 'richText' && (
        <Field
          label="HTML content"
          hint="Edit the full page text. Use &lt;h2&gt; for section headings, &lt;p&gt; for paragraphs, and &lt;ul&gt;&lt;li&gt; for lists."
        >
          <textarea
            className={`${inputClass} font-mono text-xs leading-relaxed`}
            rows={Math.min(20, Math.max(10, (props.html ?? '').split('\n').length + 2))}
            value={props.html ?? ''}
            onChange={(e) => onChange({ html: e.target.value })}
          />
        </Field>
      )}

      {type === 'legalDocument' && (
        <>
          <Field label="Page title">
            <input
              className={inputClass}
              value={props.text ?? ''}
              onChange={(e) => onChange({ text: e.target.value })}
            />
          </Field>
          <Field label="Last updated">
            <input
              className={inputClass}
              value={props.subtitle ?? ''}
              onChange={(e) => onChange({ subtitle: e.target.value })}
              placeholder="May 25, 2026"
            />
          </Field>
          <Field
            label="Policy content (HTML)"
            hint="Use &lt;h2&gt; for sections, &lt;p&gt; for paragraphs, and &lt;ul&gt;&lt;li&gt; for lists."
          >
            <textarea
              className={`${inputClass} font-mono text-xs leading-relaxed`}
              rows={Math.min(24, Math.max(12, (props.html ?? '').split('\n').length + 2))}
              value={props.html ?? ''}
              onChange={(e) => onChange({ html: e.target.value })}
            />
          </Field>
        </>
      )}

      {hasText && type !== 'richText' && (
        <Field label="Text">
          <textarea className={inputClass} rows={type === 'paragraph' ? 4 : 2} value={props.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
        </Field>
      )}

      {hasTitle && type !== 'richText' && (
        <Field label="Title">
          <input className={inputClass} value={props.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
        </Field>
      )}

      {(props.subtitle !== undefined || ['hero', 'cta', 'contact', 'twoColumn'].includes(type)) && !isCardGrid && !isCardListView && !isGallery && !isLightbox && !isLookbook && !isCarousel && !isImageTitleSlider && !isTestimonial && !isTeam && !isLogos && !isHeroSplit && !isProductListing && !isContactForm && !isMultiStepForm && !isStateScreen && (
        <Field label="Subtitle / Excerpt">
          <textarea className={inputClass} rows={2} value={props.subtitle ?? props.excerpt ?? ''} onChange={(e) => onChange({ subtitle: e.target.value, excerpt: e.target.value })} />
        </Field>
      )}

      {(type.includes('hero') || type.includes('Banner') || type === 'cta' || type === 'button' || type === 'buttonLink' || type === 'iconButton' || type === 'checkoutCta' || type.includes('Card')) && !isHeroSplit && (
        <>
          <Field label="Button text">
            <input className={inputClass} value={props.buttonText ?? ''} onChange={(e) => onChange({ buttonText: e.target.value })} />
          </Field>
          <Field label="Button link">
            <input className={inputClass} value={props.buttonLink ?? ''} onChange={(e) => onChange({ buttonLink: e.target.value })} placeholder="#products, #contact" />
          </Field>
        </>
      )}

      {type === 'heroCta' && (
        <>
          <Field label="Secondary button">
            <input className={inputClass} value={props.buttonText2 ?? ''} onChange={(e) => onChange({ buttonText2: e.target.value })} />
          </Field>
          <Field label="Secondary link">
            <input className={inputClass} value={props.buttonLink2 ?? ''} onChange={(e) => onChange({ buttonLink2: e.target.value })} />
          </Field>
        </>
      )}

      {!hasHeroBgMode &&
        (props.imageUrl !== undefined ||
          type === 'image' ||
          type.includes('Card') ||
          type === 'twoColumn') && (
          <ImageUploadField
            label="Image"
            value={props.imageUrl}
            onChange={(url) => onChange({ imageUrl: url })}
          />
        )}

      {type === 'videoEmbed' && (
        <Field label="Video embed URL">
          <input className={inputClass} value={props.videoUrl ?? ''} onChange={(e) => onChange({ videoUrl: e.target.value })} />
        </Field>
      )}

      {props.icon !== undefined && (
        <Field label="Icon (emoji)">
          <input className={inputClass} value={props.icon ?? ''} onChange={(e) => onChange({ icon: e.target.value })} />
        </Field>
      )}

      {props.badge !== undefined && (
        <Field label="Badge">
          <input className={inputClass} value={props.badge ?? ''} onChange={(e) => onChange({ badge: e.target.value })} />
        </Field>
      )}

      {props.tags && (
        <Field label="Tags (comma separated)">
          <input className={inputClass} value={props.tags.join(', ')} onChange={(e) => onChange({ tags: e.target.value.split(',').map((t) => t.trim()) })} />
        </Field>
      )}

      {props.quote !== undefined && !isTestimonial && (
        <Field label="Quote">
          <textarea className={inputClass} rows={3} value={props.quote ?? ''} onChange={(e) => onChange({ quote: e.target.value })} />
        </Field>
      )}

      {(props.author !== undefined || type === 'testimonialCard') && !isTestimonial && (
        <>
          <Field label="Author">
            <input className={inputClass} value={props.author ?? ''} onChange={(e) => onChange({ author: e.target.value })} />
          </Field>
          <Field label="Role">
            <input className={inputClass} value={props.role ?? ''} onChange={(e) => onChange({ role: e.target.value })} />
          </Field>
        </>
      )}

      {props.email !== undefined && (
        <Field label="Email">
          <input className={inputClass} value={props.email ?? ''} onChange={(e) => onChange({ email: e.target.value })} />
        </Field>
      )}

      {props.phone !== undefined && (
        <Field label="Phone">
          <input className={inputClass} value={props.phone ?? ''} onChange={(e) => onChange({ phone: e.target.value })} />
        </Field>
      )}

      {props.companyName !== undefined && !isFooter && !isNavbar && (
        <Field label="Company name">
          <input className={inputClass} value={props.companyName ?? ''} onChange={(e) => onChange({ companyName: e.target.value })} />
        </Field>
      )}

      {props.items && !isNavbar && (
        <Field label="Menu items (comma separated)">
          <input className={inputClass} value={props.items.join(', ')} onChange={(e) => onChange({ items: e.target.value.split(',').map((s) => s.trim()) })} />
        </Field>
      )}

      {props.columns !== undefined && !isGallery && !isLightbox && !isLookbook && !isCardGrid && !isCategoryTabs && !isCategoryStack && !isCardListView && !isCarousel && !isTestimonial && !isTeam && !isLogos && !isProductListing && (
        <ColumnsInput value={props.columns ?? 3} onChange={(columns) => onChange({ columns })} min={2} max={6} />
      )}

      {props.overlayOpacity !== undefined && (
        <Field label="Overlay opacity">
          <input type="range" min={0} max={1} step={0.05} value={props.overlayOpacity ?? 0.5} onChange={(e) => onChange({ overlayOpacity: parseFloat(e.target.value) })} className="w-full" />
        </Field>
      )}

      {type === 'spacer' && (
        <p className="text-xs text-gray-500">Set spacer height in Style &amp; Layout → Height, or drag the resize handle on the canvas.</p>
      )}

      {(type === 'formInput' || type === 'formTextarea' || type === 'formSelect' || type === 'formCheckbox' || type === 'formRadio' || type === 'formFileUpload') && (
        <Field label="Field label">
          <input className={inputClass} value={props.label ?? ''} onChange={(e) => onChange({ label: e.target.value })} />
        </Field>
      )}

      {type === 'addToCartButton' && (
        <Field label="Linked item">
          <select className={inputClass} value={props.linkedItemId ?? ''} onChange={(e) => onChange({ linkedItemId: e.target.value })}>
            <option value="">Select...</option>
            {(props.linkedItemType === 'service' ? catalog.services : catalog.products).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </Field>
      )}
    </div>
  )
}
