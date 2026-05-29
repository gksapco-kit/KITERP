import { ChevronRight, Search, Star } from 'lucide-react'
import { createLinkClickHandler } from '../../lib/buttonNavigation'
import { searchBarInputStyle, searchBarWrapperStyle } from '../../lib/searchBarStyles'
import {
  blockInnerLayoutStyle,
  blockTypographyStyle,
  getHeroAnimationClass,
  inlineBlockContentStyle,
  getHeroBackgroundImageUrl,
  getHeroBackgroundMode,
  gridColumnClass,
  heroSectionBackgroundStyle,
} from '../../lib/blockUtils'
import { useBuilderStore } from '../../store/useBuilderStore'
import { CartWidget } from '../widgets/CartWidget'
import { CheckoutWidget } from '../widgets/CheckoutWidget'
import { MiniCartWidget } from '../widgets/MiniCartWidget'
import { ProductListingBlock } from './ProductListingBlock'
import { ServiceListingWidget } from '../widgets/ServiceListingWidget'
import { BlockShell } from '../builder/BlockShell'
import { BANNER_CONTENT_ROW_CLASS } from '../../lib/pageLayout'
import {
  heroContentFlexClasses,
  resolveHeroContentAlignX,
  resolveHeroContentAlignY,
  resolveBlockSectionHeight,
} from '../../lib/heroSectionLayout'
import { CardListBlock } from './CardListBlock'
import { LogosSectionBlock } from './LogosSectionBlock'
import { TeamMembersBlock } from './TeamMembersBlock'
import { TabsSectionBlock } from './TabsSectionBlock'
import { TestimonialsBlock } from './TestimonialsBlock'
import { CardsBlock } from './CardsBlock'
import { CarouselBlock } from './CarouselBlock'
import { ImageTitleSliderBlock } from './ImageTitleSliderBlock'
import { CategoryStackBlock } from './CategoryStackBlock'
import { GalleryBlock } from './GalleryBlock'
import { ProductVideoGalleryBlock } from './ProductVideoGalleryBlock'
import { ContactFormBlock } from './ContactFormBlock'
import { ContainerBlock } from './ContainerBlock'
import { NavbarBlock } from './NavbarBlock'
import { MapEmbedBlock } from './MapEmbedBlock'
import { FaqAccordionBlock } from './FaqAccordionBlock'
import { LegalDocumentBlock } from './LegalDocumentBlock'
import { HeroSplitBlock } from './HeroSplitBlock'
import { HeroBannerSliderBlock } from './HeroBannerSliderBlock'
import { BackToTopBlock } from './BackToTopBlock'
import { ToastNotificationBlock } from './ToastNotificationBlock'
import { CookieBannerBlock } from './CookieBannerBlock'
import { ChatFloatBlock } from './ChatFloatBlock'
import { StickyAddToCartBlock } from './StickyAddToCartBlock'
import { ProductRatingBlock } from './ProductRatingBlock'
import { ShippingReturnsInfoBlock } from './ShippingReturnsInfoBlock'
import { PaymentMethodsBlock } from './PaymentMethodsBlock'
import { SecureCheckoutBlock } from './SecureCheckoutBlock'
import { StatsCounterBlock } from './StatsCounterBlock'
import { HowItWorksBlock } from './HowItWorksBlock'
import { ProductTabsBlock } from './ProductTabsBlock'
import { ProgressBarBlock } from './ProgressBarBlock'
import { SkeletonLoaderBlock } from './SkeletonLoaderBlock'
import { SimpleLoaderBlock } from './SimpleLoaderBlock'
import { ModalBlock } from './ModalBlock'
import { CommentsSectionBlock } from './CommentsSectionBlock'
import { BeforeAfterSlideBlock } from './BeforeAfterSlideBlock'
import { CountdownTimerBlock } from './CountdownTimerBlock'
import { PricingMatrixBlock } from './PricingMatrixBlock'
import { DataTableBlock } from './DataTableBlock'
import { LightboxBlock } from './LightboxBlock'
import { MultiStepFormBlock } from './MultiStepFormBlock'
import { TimelineBlock } from './TimelineBlock'
import { StateScreenBlock } from './StateScreenBlock'
import { PollVotingBlock } from './PollVotingBlock'
import { MentionsTaggingBlock } from './MentionsTaggingBlock'
import { LivePresenceBlock } from './LivePresenceBlock'
import { UserProfileCardBlock } from './UserProfileCardBlock'
import { StepperBlock } from './StepperBlock'
import { OffCanvasMenuBlock } from './OffCanvasMenuBlock'
import { FloatingActionButtonBlock } from './FloatingActionButtonBlock'
import { WishlistBlock } from './WishlistBlock'
import { RecentlyViewedBlock } from './RecentlyViewedBlock'
import { FrequentlyBoughtTogetherBlock } from './FrequentlyBoughtTogetherBlock'
import { InfiniteScrollBlock } from './InfiniteScrollBlock'
import { BundleBuilderBlock } from './BundleBuilderBlock'
import { CartDrawerBlock } from './CartDrawerBlock'
import { isStateScreenType } from '../../lib/stateScreenConfig'
import { LookbookBlock } from './LookbookBlock'
import {
  CouponBannerBlock,
  FashionPromoBannerBlock,
  FlashSaleBannerBlock,
  GroceryDealBannerBlock,
  OfferStripBannerBlock,
  SplitCategoryBannerBlock,
  TrustStripBannerBlock,
} from './CommerceBannerBlocks'
import { FooterBlock } from './FooterBlock'
import { legacyPropsToCard } from '../../lib/cardDefaults'
import { InlineEditable } from '../builder/InlineEditable'
import type { Block, CardItem } from '../../types/builder'

interface RenderBlockProps {
  block: Block
  interactive?: boolean
  onNavigate?: (slug: string) => void
  selected?: boolean
  darkMode?: boolean
  onPropsChange?: (props: Partial<Block['props']>) => void
  nestedInContainer?: boolean
}

function Btn({
  text,
  link,
  linkClick,
  className = 'inline-block rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:opacity-90',
  style,
}: {
  text?: string
  link?: string
  linkClick: (e: React.MouseEvent<HTMLAnchorElement>) => void
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <a href={link || '#'} className={className} style={style} onClick={linkClick}>
      {text}
    </a>
  )
}

function CardGrid({ cards, cols = 3 }: { cards?: CardItem[]; cols?: number }) {
  const colClass = gridColumnClass(cols)
  return (
    <div className={`grid gap-6 ${colClass}`}>
      {cards?.map((c, i) => (
        <div key={c.id ?? i} className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {c.imageUrl && <img src={c.imageUrl} alt="" className="h-40 w-full object-cover" />}
          <div className="p-4">
            {c.badge && <span className="mb-2 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">{c.badge}</span>}
            <h3 className="font-semibold text-gray-900 dark:text-white">{c.title}</h3>
            <p className="mt-1 text-sm text-gray-500">{c.description}</p>
            {c.price && <p className="mt-2 font-bold text-brand-600">{c.price}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function RenderBlock({
  block,
  interactive,
  onNavigate,
  selected,
  darkMode,
  onPropsChange,
  nestedInContainer,
}: RenderBlockProps) {
  const pages = useBuilderStore((s) => s.pages)
  const { props } = block
  const layoutStyle = blockInnerLayoutStyle(block.styles, darkMode)
  const linkClick = (link?: string) => createLinkClickHandler({ interactive: !!interactive, link, pages, onNavigate })
  const edit = (patch: Partial<Block['props']>) => onPropsChange?.(patch)
  const ie = (field: keyof Block['props'], _val: string, tag: 'h1' | 'h2' | 'p' = 'p', multiline = false) => (
    <InlineEditable
      value={(props[field] as string) ?? ''}
      onChange={(v) => edit({ [field]: v })}
      interactive={!!interactive && !!selected && !!onPropsChange}
      selected={!!selected}
      tag={tag}
      multiline={multiline}
    />
  )

  const overlay = props.overlayOpacity ?? block.styles.overlayOpacity ?? 0.5

  const render = () => {
    switch (block.type) {
      case 'heading':
        return <h1 style={layoutStyle} className="leading-tight">{ie('text', props.text ?? '', 'h1')}</h1>

      case 'paragraph':
        return <p style={layoutStyle} className="leading-relaxed">{ie('text', props.text ?? '', 'p', true)}</p>

      case 'richText':
        return (
          <div
            style={layoutStyle}
            className="prose prose-gray prose-headings:scroll-mt-20 prose-a:text-brand-600 prose-a:no-underline hover:prose-a:underline mx-auto w-full max-w-3xl dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: props.html ?? props.text ?? '' }}
          />
        )

      case 'legalDocument':
        return <LegalDocumentBlock block={block} layoutStyle={layoutStyle} darkMode={darkMode} />

      case 'button':
      case 'buttonLink': {
        const btnStyle = inlineBlockContentStyle(block)
        if (!btnStyle.backgroundColor && block.styles.backgroundMode !== 'gradient') {
          btnStyle.backgroundColor = '#4f46e5'
        }
        if (!btnStyle.color) btnStyle.color = '#fff'
        return (
          <Btn
            text={props.text}
            link={props.buttonLink}
            linkClick={linkClick(props.buttonLink)}
            className="font-semibold transition hover:opacity-90"
            style={btnStyle}
          />
        )
      }

      case 'iconButton':
        return (
          <Btn
            text={`${props.icon ?? '→'} ${props.text}`}
            link={props.buttonLink}
            linkClick={linkClick(props.buttonLink)}
            className="inline-flex items-center gap-2 font-semibold transition hover:opacity-90"
            style={inlineBlockContentStyle(block)}
          />
        )

      case 'divider':
        return <hr className="border-gray-200 dark:border-gray-600" style={{ margin: block.styles.margin }} />

      case 'spacer':
        return (
          <div
            className={block.styles.height ? 'h-full w-full' : 'w-full'}
            style={block.styles.height ? undefined : { height: props.height }}
          />
        )

      case 'badge':
        return (
          <div style={layoutStyle} className="flex items-center gap-2">
            <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">{props.badge}</span>
            <span>{props.text}</span>
          </div>
        )

      case 'tags':
        return (
          <div style={layoutStyle} className="flex flex-wrap gap-2">
            {props.tags?.map((t) => (
              <span key={t} className="rounded-lg bg-gray-100 px-3 py-1 text-sm dark:bg-gray-700">{t}</span>
            ))}
          </div>
        )

      case 'image': {
        if (!props.imageUrl) return null
        const fixedHeight = block.styles.height?.trim()
        return (
          <div
            className={`relative w-full overflow-hidden ${fixedHeight ? 'h-full min-h-[120px]' : 'aspect-video'}`}
            style={{
              borderRadius: block.styles.borderRadius,
              ...(fixedHeight ? { height: fixedHeight } : {}),
            }}
          >
            <img
              src={props.imageUrl}
              alt={props.imageAlt ?? ''}
              className="h-full w-full object-cover"
              style={{ borderRadius: block.styles.borderRadius }}
            />
          </div>
        )
      }

      case 'hero':
      case 'heroGradient': // legacy
      case 'heroBgImage': // legacy
      case 'heroVideo': // legacy
      case 'promoBanner':
      case 'imageBanner':
        return (
          <ModeBasedHero
            block={block}
            props={props}
            layoutStyle={layoutStyle}
            overlay={overlay}
            ie={ie}
            linkClick={linkClick}
            variant="hero"
          />
        )

      case 'heroSplit':
        return (
          <HeroSplitBlock block={block} layoutStyle={layoutStyle} interactive={interactive} onNavigate={onNavigate} />
        )

      case 'heroBannerSlider':
        return (
          <HeroBannerSliderBlock
            block={block}
            layoutStyle={layoutStyle}
            interactive={interactive}
            onNavigate={onNavigate}
          />
        )

      case 'heroCta':
        return (
          <ModeBasedHero
            block={block}
            props={props}
            layoutStyle={layoutStyle}
            overlay={overlay}
            ie={ie}
            linkClick={linkClick}
            variant="cta"
          />
        )

      case 'announcementBanner': {
        const stripHeight = resolveBlockSectionHeight(block)
        const stripAlignX = resolveHeroContentAlignX(block)
        const stripAlignY = resolveHeroContentAlignY(block)
        const stripFlex = heroContentFlexClasses(stripAlignX, stripAlignY)
        return (
          <div style={{ ...layoutStyle, minHeight: stripHeight }} className="flex w-full rounded-none">
            <div className={`flex w-full min-h-full py-3 ${stripFlex} ${BANNER_CONTENT_ROW_CLASS}`} style={{ minHeight: stripHeight }}>
              {props.badge && <span className="rounded bg-amber-600 px-2 py-0.5 text-xs text-white">{props.badge}</span>}
              <p className="font-medium">{props.text}</p>
            </div>
          </div>
        )
      }

      case 'gradientBanner':
        return (
          <ModeBasedHero
            block={block}
            props={props}
            layoutStyle={layoutStyle}
            overlay={overlay}
            ie={ie}
            linkClick={linkClick}
            variant="banner"
          />
        )

      case 'couponBanner':
        return <CouponBannerBlock block={block} layoutStyle={layoutStyle} linkClick={linkClick} />

      case 'flashSaleBanner':
        return <FlashSaleBannerBlock block={block} layoutStyle={layoutStyle} linkClick={linkClick} />

      case 'splitCategoryBanner':
        return <SplitCategoryBannerBlock block={block} layoutStyle={layoutStyle} linkClick={linkClick} />

      case 'offerStripBanner':
        return <OfferStripBannerBlock block={block} layoutStyle={layoutStyle} linkClick={linkClick} />

      case 'groceryDealBanner':
        return <GroceryDealBannerBlock block={block} layoutStyle={layoutStyle} linkClick={linkClick} />

      case 'fashionPromoBanner':
        return <FashionPromoBannerBlock block={block} layoutStyle={layoutStyle} linkClick={linkClick} />

      case 'trustStripBanner':
        return <TrustStripBannerBlock block={block} layoutStyle={layoutStyle} linkClick={linkClick} />

      case 'cardGrid':
        return (
          <CardsBlock
            block={block}
            cards={props.cards ?? []}
            layoutStyle={layoutStyle}
            interactive={interactive}
            onNavigate={onNavigate}
          />
        )

      case 'categoryTabs':
        return (
          <TabsSectionBlock
            block={block}
            layoutStyle={layoutStyle}
            interactive={interactive}
            onNavigate={onNavigate}
          />
        )

      case 'categoryStack':
        return (
          <CategoryStackBlock
            block={block}
            layoutStyle={layoutStyle}
            interactive={interactive}
            onNavigate={onNavigate}
          />
        )

      case 'cardListView':
        return (
          <CardListBlock
            block={block}
            cards={props.cards ?? []}
            layoutStyle={layoutStyle}
            interactive={interactive}
            onNavigate={onNavigate}
            editable={!!selected && !!onPropsChange}
            onCardsChange={(cards) => edit({ cards })}
          />
        )

      case 'blogCard':
      case 'productCard':
      case 'teamCard':
      case 'featureCard':
      case 'pricingCard':
      case 'testimonialCard':
        return (
          <CardsBlock
            block={{ ...block, props: { ...props, columns: 1, cards: [legacyPropsToCard(props)] } }}
            cards={[legacyPropsToCard(props)]}
            layoutStyle={layoutStyle}
            interactive={interactive}
            onNavigate={onNavigate}
          />
        )

      case 'gallery':
        return (
          <GalleryBlock
            cards={props.cards}
            columns={props.columns}
            text={props.text}
            subtitle={props.subtitle}
            showGalleryTitle={props.showGalleryTitle}
            showGalleryCaption={props.showGalleryCaption}
            showGalleryLightbox={props.showGalleryLightbox}
            galleryLayout={props.galleryLayout}
            layoutStyle={layoutStyle}
            sectionStyles={block.styles}
            editable={!!selected && !!onPropsChange}
            interactive={interactive}
            onCardsChange={(cards) => edit({ cards })}
          />
        )

      case 'lookbook':
        return (
          <LookbookBlock
            cards={props.cards}
            text={props.text}
            subtitle={props.subtitle}
            showLookbookTitle={props.showLookbookTitle}
            showLookbookCaption={props.showLookbookCaption}
            showLookbookBadge={props.showLookbookBadge}
            lookbookLayout={props.lookbookLayout}
            layoutStyle={layoutStyle}
            sectionStyles={block.styles}
            interactive={interactive}
            onNavigate={onNavigate}
          />
        )

      case 'productVideoGallery':
        return (
          <ProductVideoGalleryBlock
            cards={props.cards}
            text={props.text}
            subtitle={props.subtitle}
            showProductVideoTitle={props.showProductVideoTitle}
            showProductVideoCaption={props.showProductVideoCaption}
            layoutStyle={layoutStyle}
            sectionStyles={block.styles}
          />
        )

      case 'productRating':
        return <ProductRatingBlock block={block} layoutStyle={layoutStyle} />

      case 'shippingReturnsInfo':
        return <ShippingReturnsInfoBlock block={block} layoutStyle={layoutStyle} />

      case 'paymentMethods':
        return <PaymentMethodsBlock block={block} layoutStyle={layoutStyle} />

      case 'secureCheckout':
        return <SecureCheckoutBlock block={block} layoutStyle={layoutStyle} />

      case 'statsCounter':
        return <StatsCounterBlock block={block} layoutStyle={layoutStyle} />

      case 'howItWorks':
        return <HowItWorksBlock block={block} layoutStyle={layoutStyle} />

      case 'timeline':
        return <TimelineBlock block={block} layoutStyle={layoutStyle} />

      case 'emptyState':
      case 'errorState':
      case 'successState':
      case 'maintenanceScreen':
      case 'notFoundPage':
      case 'comingSoon':
      case 'sessionExpired':
        if (isStateScreenType(block.type)) {
          return (
            <StateScreenBlock
              block={block}
              layoutStyle={layoutStyle}
              interactive={interactive}
              onNavigate={onNavigate}
              pages={pages}
            />
          )
        }
        return null

      case 'productTabs':
        return <ProductTabsBlock block={block} layoutStyle={layoutStyle} />

      case 'progressBar':
        return <ProgressBarBlock block={block} layoutStyle={layoutStyle} />

      case 'commentsSection':
        return <CommentsSectionBlock block={block} layoutStyle={layoutStyle} interactive={interactive} />

      case 'pollVoting':
        return <PollVotingBlock block={block} layoutStyle={layoutStyle} interactive={interactive} />

      case 'mentionsTagging':
        return <MentionsTaggingBlock block={block} layoutStyle={layoutStyle} />

      case 'livePresence':
        return <LivePresenceBlock block={block} layoutStyle={layoutStyle} />

      case 'userProfileCard':
        return <UserProfileCardBlock block={block} layoutStyle={layoutStyle} />

      case 'stepper':
        return <StepperBlock block={block} layoutStyle={layoutStyle} interactive={interactive} />

      case 'offCanvasMenu':
        return <OffCanvasMenuBlock block={block} interactive={interactive} onNavigate={onNavigate} pages={pages} />

      case 'floatingActionButton':
        return <FloatingActionButtonBlock block={block} interactive={interactive} onNavigate={onNavigate} pages={pages} />

      case 'wishlist':
        return <WishlistBlock block={block} layoutStyle={layoutStyle} />

      case 'recentlyViewed':
        return <RecentlyViewedBlock block={block} layoutStyle={layoutStyle} />

      case 'frequentlyBoughtTogether':
        return <FrequentlyBoughtTogetherBlock block={block} layoutStyle={layoutStyle} />

      case 'infiniteScroll':
        return <InfiniteScrollBlock block={block} layoutStyle={layoutStyle} interactive={interactive} />

      case 'bundleBuilder':
        return <BundleBuilderBlock block={block} layoutStyle={layoutStyle} interactive={interactive} />

      case 'cartDrawer':
        return <CartDrawerBlock block={block} interactive={interactive} onNavigate={onNavigate} />

      case 'skeletonLoader':
        return <SkeletonLoaderBlock block={block} layoutStyle={layoutStyle} />

      case 'simpleLoader':
        return <SimpleLoaderBlock block={block} layoutStyle={layoutStyle} />

      case 'gridSection':
      case 'masonryGrid':
        return (
          <section style={layoutStyle}>
            {props.text && <h2 className="mb-8 text-2xl font-bold">{props.text}</h2>}
            <CardGrid cards={props.cards} cols={props.columns} />
          </section>
        )

      case 'flexLayout':
        return (
          <section style={layoutStyle}>
            <h2 className="mb-6 text-2xl font-bold">{props.text}</h2>
            <div className="flex flex-col gap-6 md:flex-row">
              {props.cards?.map((c, i) => (
                <div key={i} className="flex-1 rounded-xl border p-6 dark:border-gray-700">
                  <h3 className="font-semibold">{c.title}</h3>
                  <p className="mt-2 text-sm text-gray-500">{c.description}</p>
                </div>
              ))}
            </div>
          </section>
        )

      case 'twoColumn':
        return (
          <section style={layoutStyle} className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold">{props.text}</h2>
              <p className="mt-4 text-gray-600">{props.subtitle}</p>
            </div>
            {props.imageUrl && <img src={props.imageUrl} alt="" className="rounded-xl" />}
          </section>
        )

      case 'threeColumn':
      case 'featureGrid':
      case 'features':
        return (
          <section style={layoutStyle}>
            {props.text && <h2 className="mb-10 text-3xl font-bold">{props.text}</h2>}
            <div className="grid gap-8 md:grid-cols-3">
              {props.features?.map((f, i) => (
                <div key={i} className="rounded-xl bg-white p-6 shadow-sm dark:bg-gray-800">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600">{i + 1}</div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-gray-500">{f.description}</p>
                </div>
              ))}
            </div>
          </section>
        )

      case 'contactForm':
        return (
          <ContactFormBlock
            block={block}
            fields={props.formFields ?? []}
            layoutStyle={layoutStyle}
            interactive={interactive}
          />
        )

      case 'multiStepForm':
        return <MultiStepFormBlock block={block} layoutStyle={layoutStyle} interactive={interactive} />

      case 'newsletterForm':
        return (
          <section style={layoutStyle} className="rounded-xl">
            <h2 className="text-2xl font-bold">{props.text}</h2>
            <p className="mb-4 text-gray-500">{props.subtitle}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input type="email" placeholder={props.placeholder} className="flex-1 rounded-lg border px-4 py-2 dark:border-gray-600 dark:bg-gray-800" disabled={!interactive} />
              <button type="button" className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white">Subscribe</button>
            </div>
          </section>
        )

      case 'formInput':
        return (
          <div style={layoutStyle}>
            <label className="mb-1 block text-sm font-medium">{props.label}</label>
            <input type="text" placeholder={props.placeholder} className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-800" disabled={!interactive} />
          </div>
        )

      case 'formTextarea':
        return (
          <div style={layoutStyle}>
            <label className="mb-1 block text-sm font-medium">{props.label}</label>
            <textarea placeholder={props.placeholder} rows={4} className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-800" disabled={!interactive} />
          </div>
        )

      case 'formSelect':
        return (
          <div style={layoutStyle}>
            <label className="mb-1 block text-sm font-medium">{props.label}</label>
            <select className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-800" disabled={!interactive}>
              {props.options?.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        )

      case 'formCheckbox':
        return (
          <label style={layoutStyle} className="flex items-center gap-2">
            <input type="checkbox" checked={props.checked} readOnly={!interactive} className="rounded" />
            <span className="text-sm">{props.label}</span>
          </label>
        )

      case 'formRadio':
        return (
          <fieldset style={layoutStyle}>
            <legend className="mb-2 text-sm font-medium">{props.label}</legend>
            {props.options?.map((o) => (
              <label key={o} className="mb-1 flex items-center gap-2">
                <input type="radio" name={block.id} disabled={!interactive} />
                <span className="text-sm">{o}</span>
              </label>
            ))}
          </fieldset>
        )

      case 'formFileUpload':
        return (
          <div style={layoutStyle} className="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center dark:border-gray-600">
            <p className="font-medium">{props.label}</p>
            <p className="mt-1 text-sm text-gray-500">{props.text}</p>
          </div>
        )

      case 'searchBar': {
        const wrapperStyle = searchBarWrapperStyle(block.styles)
        const inputStyle = searchBarInputStyle(block.styles)
        return (
          <div
            style={wrapperStyle}
            className={`flex gap-2 ${props.showSearchButton !== false ? 'flex-col sm:flex-row' : ''}`}
          >
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                readOnly={!interactive}
                placeholder={props.placeholder ?? 'Search…'}
                style={{
                  borderWidth: inputStyle.borderWidth ?? '1px',
                  borderColor: inputStyle.borderColor ?? '#e5e7eb',
                  borderStyle: inputStyle.borderStyle ?? 'solid',
                  borderRadius: inputStyle.borderRadius ?? '8px',
                }}
                className="w-full bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:bg-gray-800"
                onClick={(e) => e.stopPropagation()}
              />
            </label>
            {props.showSearchButton !== false && (
              <button
                type="button"
                className="shrink-0 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                onClick={(e) => e.stopPropagation()}
              >
                {props.buttonText ?? 'Search'}
              </button>
            )}
          </div>
        )
      }

      case 'carousel':
      case 'slider':
        return <CarouselBlock cards={props.cards} props={props} layoutStyle={layoutStyle} />

      case 'imageTitleSlider':
        return <ImageTitleSliderBlock block={block} layoutStyle={layoutStyle} />

      case 'videoEmbed':
        return (
          <section style={layoutStyle}>
            {props.videoUrl && (
              <div className="aspect-video overflow-hidden rounded-xl">
                <iframe src={props.videoUrl} title="video" className="h-full w-full" allowFullScreen />
              </div>
            )}
            {props.text && <p className="mt-4 text-center font-medium">{props.text}</p>}
          </section>
        )

      case 'beforeAfterSlide':
        return <BeforeAfterSlideBlock block={block} layoutStyle={layoutStyle} />

      case 'lightbox':
        return (
          <LightboxBlock
            block={block}
            layoutStyle={layoutStyle}
            editable={!!selected && !!onPropsChange}
            interactive={interactive}
          />
        )

      case 'countdownTimer':
        return <CountdownTimerBlock block={block} layoutStyle={layoutStyle} interactive={interactive} onNavigate={onNavigate} />

      case 'pricingMatrix':
        return <PricingMatrixBlock block={block} layoutStyle={layoutStyle} interactive={interactive} onNavigate={onNavigate} />

      case 'dataTable':
        return <DataTableBlock block={block} layoutStyle={layoutStyle} />

      case 'container':
        return (
          <ContainerBlock block={block} layoutStyle={layoutStyle} interactive={interactive} onNavigate={onNavigate} />
        )

      case 'mapEmbed':
        return (
          <MapEmbedBlock block={block} layoutStyle={layoutStyle} />
        )

      case 'navbar':
        return (
          <NavbarBlock
            block={block}
            layoutStyle={layoutStyle}
            interactive={interactive}
            onNavigate={onNavigate}
          />
        )

      case 'mobileMenu':
        return (
          <nav style={layoutStyle} className="space-y-2 rounded-xl md:hidden">
            {props.items?.map((item) => (
              <a key={item} href="#" className="block rounded-lg px-4 py-2 hover:bg-gray-100" onClick={(e) => e.preventDefault()}>{item}</a>
            ))}
          </nav>
        )

      case 'sidebar':
        return (
          <aside style={layoutStyle} className="w-full max-w-xs space-y-2 rounded-xl">
            {props.items?.map((item) => (
              <a key={item} href="#" className="block rounded-lg px-3 py-2 hover:bg-white/10" onClick={(e) => e.preventDefault()}>{item}</a>
            ))}
          </aside>
        )

      case 'footer':
        return (
          <FooterBlock
            block={block}
            layoutStyle={layoutStyle}
            interactive={interactive}
            onNavigate={onNavigate}
            variant="full"
          />
        )

      case 'footerMinimal':
        return (
          <FooterBlock
            block={block}
            layoutStyle={layoutStyle}
            interactive={interactive}
            onNavigate={onNavigate}
            variant="minimal"
          />
        )

      case 'breadcrumbs':
        return (
          <nav style={layoutStyle} className="flex items-center gap-2 text-sm text-gray-500">
            {props.items?.map((item, i) => (
              <span key={item} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                <span className={i === (props.items?.length ?? 0) - 1 ? 'font-medium text-gray-900' : ''}>{item}</span>
              </span>
            ))}
          </nav>
        )

      case 'testimonial':
        return (
          <TestimonialsBlock
            block={block}
            layoutStyle={layoutStyle}
            editable={!!selected && !!onPropsChange}
            onItemsChange={(testimonialItems) => edit({ testimonialItems })}
          />
        )

      case 'reviews':
        return (
          <section style={layoutStyle}>
            <h2 className="mb-6 text-2xl font-bold">{props.text}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {props.cards?.map((c, i) => (
                <div key={i} className="rounded-xl border p-4 dark:border-gray-700">
                  <div className="flex gap-1">{Array.from({ length: c.rating ?? 5 }).map((_, j) => <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />)}</div>
                  <p className="mt-2 italic">&ldquo;{c.quote}&rdquo;</p>
                  <p className="mt-2 text-sm font-medium">{c.author}</p>
                </div>
              ))}
            </div>
          </section>
        )

      case 'faqAccordion':
        return <FaqAccordionBlock block={block} items={props.faqItems ?? []} layoutStyle={layoutStyle} />

      case 'teamMembers':
        return (
          <TeamMembersBlock
            block={block}
            layoutStyle={layoutStyle}
            editable={!!selected && !!onPropsChange}
            onMembersChange={(teamMembers) => edit({ teamMembers })}
          />
        )

      case 'logosSection':
        return (
          <LogosSectionBlock
            block={block}
            layoutStyle={layoutStyle}
            editable={!!selected && !!onPropsChange}
            onLogosChange={(logoItems) => edit({ logoItems })}
          />
        )

      case 'cta':
      case 'checkoutCta':
        return (
          <section style={layoutStyle}>
            <h2 className="text-3xl font-bold">{props.text}</h2>
            <p className="mt-2 text-gray-600">{props.subtitle}</p>
            <div className="mt-6"><Btn text={props.buttonText} link={props.buttonLink} linkClick={linkClick(props.buttonLink)} /></div>
          </section>
        )

      case 'contact':
        return (
          <section style={layoutStyle}>
            <h2 className="text-3xl font-bold">{props.text}</h2>
            <p className="mt-2 text-gray-600">{props.subtitle}</p>
            <div className="mt-6 space-y-2">
              <p>{props.email}</p>
              <p>{props.phone}</p>
            </div>
          </section>
        )

      case 'productListing':
        return (
          <ProductListingBlock
            block={block}
            layoutStyle={layoutStyle}
            interactive={interactive}
            onNavigate={onNavigate}
            editable={!!selected && !!onPropsChange}
            onProductsChange={(products) => edit({ products })}
          />
        )

      case 'serviceListing':
        return <ServiceListingWidget title={props.text} subtitle={props.subtitle} columns={props.columns} showPrices={props.showPrices} interactive={interactive} />

      case 'cartWidget':
        return <CartWidget title={props.text} subtitle={props.subtitle} interactive={interactive} onCheckout={onNavigate ? () => onNavigate('checkout') : undefined} />

      case 'checkoutWidget':
        return <CheckoutWidget title={props.text} subtitle={props.subtitle} interactive={interactive} />

      case 'miniCart':
        return <MiniCartWidget />

      case 'backToTop':
        return <BackToTopBlock block={block} interactive={interactive} />

      case 'toastNotification':
        return <ToastNotificationBlock block={block} interactive={interactive} />

      case 'cookieBanner':
        return <CookieBannerBlock block={block} interactive={interactive} onNavigate={onNavigate} />

      case 'modal':
        return <ModalBlock block={block} interactive={interactive} onNavigate={onNavigate} />

      case 'chatFloat':
        return <ChatFloatBlock block={block} interactive={interactive} />

      case 'stickyAddToCart':
        return <StickyAddToCartBlock block={block} interactive={interactive} />

      case 'pricingTable':
        return (
          <section style={layoutStyle}>
            <h2 className="mb-10 text-3xl font-bold">{props.text}</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {props.pricingPlans?.map((plan, i) => (
                <div key={i} className={`rounded-xl border p-6 ${i === 1 ? 'border-brand-500 bg-brand-50' : 'bg-white dark:bg-gray-800'}`}>
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="mt-2 text-3xl font-bold text-brand-600">{plan.price}</p>
                  <ul className="mt-4 space-y-2 text-sm">{plan.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
                  <button type="button" className="mt-6 w-full rounded-lg bg-brand-600 py-2 text-sm text-white">Choose</button>
                </div>
              ))}
            </div>
          </section>
        )

      case 'productShowcase':
        return (
          <section style={layoutStyle} className="grid items-center gap-8 md:grid-cols-2">
            {props.imageUrl && <img src={props.imageUrl} alt="" className="rounded-2xl shadow-lg" />}
            <div>
              {props.badge && <span className="text-sm font-semibold text-brand-600">{props.badge}</span>}
              <h2 className="mt-2 text-3xl font-bold">{props.text}</h2>
              <p className="mt-4 text-gray-600">{props.excerpt}</p>
              <div className="mt-6"><Btn text={props.buttonText} link={props.buttonLink} linkClick={linkClick(props.buttonLink)} /></div>
            </div>
          </section>
        )

      case 'featuresComparison':
        return (
          <section style={layoutStyle}>
            <h2 className="mb-8 text-2xl font-bold">{props.text}</h2>
            <div className="space-y-4">
              {props.features?.map((f, i) => (
                <div key={i} className="flex justify-between border-b py-3 dark:border-gray-700">
                  <span className="font-medium">{f.title}</span>
                  <span className="text-gray-500">{f.description}</span>
                </div>
              ))}
            </div>
          </section>
        )

      case 'addToCartButton':
        return (
          <div style={layoutStyle} className="text-center">
            <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white">
              + {props.buttonText ?? 'Add to Cart'}
            </button>
          </div>
        )

      default:
        return <p className="text-gray-400">Unknown block: {block.type}</p>
    }
  }

  return (
    <BlockShell
      block={block}
      darkMode={darkMode}
      nestedInContainer={nestedInContainer}
      className={block.type === 'image' ? 'flex h-full min-h-0 flex-1 flex-col' : ''}
    >
      {render()}
    </BlockShell>
  )
}

function ModeBasedHero({
  block,
  props,
  layoutStyle,
  overlay,
  ie,
  linkClick,
  variant,
}: {
  block: Block
  props: Block['props']
  layoutStyle: React.CSSProperties
  overlay: number
  ie: (field: keyof Block['props'], _val: string, tag?: 'h1' | 'h2' | 'p', multiline?: boolean) => React.ReactNode
  linkClick: (link?: string) => (e: React.MouseEvent<HTMLAnchorElement>) => void
  variant: 'hero' | 'cta' | 'banner'
}) {
  const mode = getHeroBackgroundMode(block)
  const bgUrl = getHeroBackgroundImageUrl(block)
  const videoUrl = props.videoUrl?.trim()
  const isBanner = variant === 'banner'
  const rounded = 'w-full rounded-none'
  const sectionHeight = resolveBlockSectionHeight(block)
  const alignX = resolveHeroContentAlignX(block)
  const alignY = resolveHeroContentAlignY(block)
  const contentFlex = heroContentFlexClasses(alignX, alignY)
  const innerRowClass = `relative z-10 flex w-full min-h-full py-12 ${contentFlex} ${BANNER_CONTENT_ROW_CLASS}`
  const btnRowClass =
    alignX === 'start' ? 'justify-start' : alignX === 'end' ? 'justify-end' : 'justify-center'
  const animClass = getHeroAnimationClass(block.styles.animation)
  const sectionPad = { textAlign: block.styles.textAlign ?? 'center' }
  const textColor = block.styles.textColor ?? '#fff'
  const heroTitleTypo = blockTypographyStyle(block.styles, 'title', {
    fontSize: isBanner ? '1.5rem' : variant === 'cta' ? '1.875rem' : '2.25rem',
  })
  const heroBodyTypo = blockTypographyStyle(block.styles, 'body')

  const title =
    variant === 'cta' ? (
      <>
        <h1 className="mb-4 font-bold" style={heroTitleTypo}>{ie('text', props.text ?? '', 'h1')}</h1>
        <p className="mb-8 opacity-90" style={heroBodyTypo}>{ie('subtitle', props.subtitle ?? '', 'p', true)}</p>
        <div className={`flex flex-wrap gap-4 ${btnRowClass}`}>
          <Btn text={props.buttonText} link={props.buttonLink} linkClick={linkClick(props.buttonLink)} className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-gray-900" />
          {props.buttonText2 && (
            <Btn text={props.buttonText2} link={props.buttonLink2} linkClick={linkClick(props.buttonLink2)} className="rounded-lg border border-white px-6 py-3 text-sm font-semibold text-white" />
          )}
        </div>
      </>
    ) : isBanner ? (
      <>
        <h2 className="font-bold" style={heroTitleTypo}>{ie('text', props.text ?? '', 'h2')}</h2>
        <p className="mt-2 opacity-90" style={heroBodyTypo}>{ie('subtitle', props.subtitle ?? '', 'p', true)}</p>
        {props.buttonText && (
          <div className="mt-4">
            <Btn text={props.buttonText} link={props.buttonLink} linkClick={linkClick(props.buttonLink)} className="rounded-lg bg-white px-5 py-2 text-sm font-semibold text-gray-900" />
          </div>
        )}
      </>
    ) : (
      <>
        <h1 className="mb-4 font-bold" style={heroTitleTypo}>{ie('text', props.text ?? '', 'h1')}</h1>
        <p className={`mx-auto opacity-90 ${isBanner ? 'mt-2' : 'mb-8 max-w-2xl'}`} style={heroBodyTypo}>{ie('subtitle', props.subtitle ?? '', 'p', true)}</p>
        {props.buttonText && (
          <Btn text={props.buttonText} link={props.buttonLink} linkClick={linkClick(props.buttonLink)} className="inline-block rounded-lg bg-white px-8 py-3 text-sm font-semibold text-brand-600" />
        )}
      </>
    )

  if (mode === 'image') {
    return (
      <section
        className={`relative overflow-hidden ${rounded} ${animClass}`}
        style={{ ...sectionPad, minHeight: sectionHeight }}
      >
        {bgUrl && <img src={bgUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-black" style={{ opacity: overlay }} />
        <div className={innerRowClass} style={{ color: textColor, minHeight: sectionHeight }}>
          {title}
        </div>
      </section>
    )
  }

  if (mode === 'video') {
    return (
      <section
        className={`relative overflow-hidden ${rounded} ${animClass}`}
        style={{ ...sectionPad, minHeight: sectionHeight }}
      >
        {videoUrl && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <iframe
              src={videoUrl}
              title="Hero background video"
              className="absolute top-1/2 left-1/2 h-[300%] w-[300%] max-w-none -translate-x-1/2 -translate-y-1/2 border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        <div className="absolute inset-0 bg-black" style={{ opacity: overlay }} />
        <div className={innerRowClass} style={{ color: textColor, minHeight: sectionHeight }}>
          {title}
        </div>
      </section>
    )
  }

  return (
    <section
      style={{ ...layoutStyle, ...heroSectionBackgroundStyle(block), minHeight: sectionHeight }}
      className={`${rounded} ${animClass}`}
    >
      <div className={innerRowClass} style={{ minHeight: sectionHeight, color: textColor }}>
        {title}
      </div>
    </section>
  )
}

