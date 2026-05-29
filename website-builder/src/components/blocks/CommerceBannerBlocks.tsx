import { Clock, Truck, RotateCcw, ShieldCheck } from 'lucide-react'
import { blockTypographyStyle } from '../../lib/blockUtils'
import {
  heroColLayoutClasses,
  heroContentFlexClasses,
  heroRowLayoutClasses,
  resolveHeroContentAlignX,
  resolveHeroContentAlignY,
  resolveBlockSectionHeight,
} from '../../lib/heroSectionLayout'
import { BANNER_CONTENT_ROW_CLASS } from '../../lib/pageLayout'
import type { Block } from '../../types/builder'

function BannerBtn({
  text,
  link,
  onClick,
  className = '',
}: {
  text?: string
  link?: string
  onClick: (link?: string) => (e: React.MouseEvent<HTMLAnchorElement>) => void
  className?: string
}) {
  if (!text) return null
  return (
    <a
      href={link || '#'}
      onClick={onClick(link)}
      className={`inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 ${className}`}
    >
      {text}
    </a>
  )
}

interface CommerceBannerProps {
  block: Block
  layoutStyle?: React.CSSProperties
  linkClick: (link?: string) => (e: React.MouseEvent<HTMLAnchorElement>) => void
}

/** Promo code banner — common on grocery, fashion, and jewellery stores */
function bannerLayout(block: Block, rowBreakpoint: 'sm' | 'md' = 'md') {
  const sectionHeight = resolveBlockSectionHeight(block)
  const alignX = resolveHeroContentAlignX(block)
  const alignY = resolveHeroContentAlignY(block)
  return {
    sectionHeight,
    contentFlex: heroContentFlexClasses(alignX, alignY),
    colRow: `${heroColLayoutClasses(alignX, alignY)} ${heroRowLayoutClasses(alignX, alignY, rowBreakpoint)}`,
  }
}

export function CouponBannerBlock({ block, layoutStyle, linkClick }: CommerceBannerProps) {
  const { props, styles } = block
  const code = props.couponCode ?? 'SAVE20'
  const titleTypo = blockTypographyStyle(styles, 'title')
  const bodyTypo = blockTypographyStyle(styles, 'body')
  const { sectionHeight, colRow } = bannerLayout(block)

  return (
    <section
      style={{ ...layoutStyle, minHeight: sectionHeight }}
      className="w-full overflow-hidden rounded-none border border-brand-200 bg-gradient-to-br from-brand-50 to-white dark:border-brand-900 dark:from-brand-950/40 dark:to-gray-900"
    >
      <div
        className={`min-h-full gap-8 py-8 md:py-10 ${colRow} ${BANNER_CONTENT_ROW_CLASS}`}
        style={{ minHeight: sectionHeight }}
      >
        <div className="text-center md:text-left">
          {props.badge && (
            <span className="mb-3 inline-block rounded-full bg-brand-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              {props.badge}
            </span>
          )}
          {props.text && (
            <h2 className="font-bold" style={titleTypo}>
              {props.text}
            </h2>
          )}
          {props.subtitle && (
            <p className="mt-2 max-w-md text-gray-600 dark:text-gray-400" style={bodyTypo}>
              {props.subtitle}
            </p>
          )}
        </div>
        <div className="flex w-full max-w-xs flex-col items-center gap-3">
          <div
            className="w-full rounded-xl border-2 border-dashed border-brand-400 bg-white px-6 py-4 text-center font-mono text-2xl font-bold tracking-[0.2em] text-brand-700 dark:bg-gray-900 dark:text-brand-300"
            style={{ color: styles.textColor }}
          >
            {code}
          </div>
          <p className="text-xs text-gray-500">Apply at checkout</p>
          <BannerBtn text={props.buttonText} link={props.buttonLink} onClick={linkClick} className="w-full text-center" />
        </div>
      </div>
    </section>
  )
}

/** Urgency / flash sale banner */
export function FlashSaleBannerBlock({ block, layoutStyle, linkClick }: CommerceBannerProps) {
  const { props, styles } = block
  const titleTypo = blockTypographyStyle(styles, 'title', { fontSize: '1.5rem' })
  const { sectionHeight, colRow } = bannerLayout(block, 'sm')

  return (
    <section
      style={{
        ...layoutStyle,
        backgroundColor: styles.backgroundColor ?? '#dc2626',
        color: styles.textColor ?? '#fff',
        minHeight: sectionHeight,
      }}
      className="w-full overflow-hidden rounded-none"
    >
      <div
        className={`min-h-full gap-4 py-5 ${colRow} ${BANNER_CONTENT_ROW_CLASS}`}
        style={{ minHeight: sectionHeight }}
      >
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
          {props.badge && (
            <span className="rounded-md bg-white/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider">
              {props.badge}
            </span>
          )}
          <div className="text-center sm:text-left">
            {props.text && <h2 className="font-bold" style={titleTypo}>{props.text}</h2>}
            {props.subtitle && <p className="mt-1 text-sm opacity-90">{props.subtitle}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {props.endsAt && (
            <div className="flex items-center gap-2 rounded-lg bg-black/20 px-4 py-2 text-sm font-medium">
              <Clock className="h-4 w-4 shrink-0" aria-hidden />
              <span>Ends {props.endsAt}</span>
            </div>
          )}
          <BannerBtn
            text={props.buttonText}
            link={props.buttonLink}
            onClick={linkClick}
            className="!bg-white !text-red-700 hover:!bg-red-50"
          />
        </div>
      </div>
    </section>
  )
}

/** Image + copy split — jewellery, fashion, grocery categories */
export function SplitCategoryBannerBlock({ block, layoutStyle, linkClick }: CommerceBannerProps) {
  const { props } = block
  const imageOnLeft = props.splitImageSide === 'left'
  const { sectionHeight, contentFlex } = bannerLayout(block)

  const textCol = (
    <div className={`flex min-h-full flex-col p-6 md:p-10 ${contentFlex}`} style={{ minHeight: sectionHeight }}>
      {props.badge && (
        <span className="mb-3 w-fit rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">
          {props.badge}
        </span>
      )}
      {props.text && <h2 className="text-2xl font-bold md:text-3xl">{props.text}</h2>}
      {props.subtitle && <p className="mt-3 text-gray-600 dark:text-gray-400">{props.subtitle}</p>}
      {props.buttonText && (
        <div className="mt-6">
          <BannerBtn text={props.buttonText} link={props.buttonLink} onClick={linkClick} />
        </div>
      )}
    </div>
  )

  const imageCol = props.imageUrl ? (
    <div className="relative" style={{ minHeight: sectionHeight }}>
      <img src={props.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
    </div>
  ) : (
    <div
      className="flex items-center justify-center bg-gray-100 text-sm text-gray-400 dark:bg-gray-800"
      style={{ minHeight: sectionHeight }}
    >
      Add image
    </div>
  )

  return (
    <section
      style={{ ...layoutStyle, minHeight: sectionHeight }}
      className="w-full overflow-hidden rounded-none border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <div className={`grid md:grid-cols-2 ${BANNER_CONTENT_ROW_CLASS}`}>
        {imageOnLeft ? (
          <>
            {imageCol}
            {textCol}
          </>
        ) : (
          <>
            {textCol}
            {imageCol}
          </>
        )}
      </div>
    </section>
  )
}

/** Slim offer strip — grocery / delivery promos */
export function OfferStripBannerBlock({ block, layoutStyle, linkClick }: CommerceBannerProps) {
  const { props, styles } = block
  const { sectionHeight, colRow } = bannerLayout(block, 'sm')

  return (
    <section
      style={{
        ...layoutStyle,
        backgroundColor: styles.backgroundColor ?? '#ecfdf5',
        color: styles.textColor ?? '#065f46',
        minHeight: sectionHeight,
      }}
      className="w-full rounded-none"
    >
      <div
        className={`min-h-full gap-4 py-4 ${colRow} ${BANNER_CONTENT_ROW_CLASS}`}
        style={{ minHeight: sectionHeight }}
      >
        <div className="flex items-center gap-4 text-center sm:text-left">
          {props.icon && <span className="text-3xl" aria-hidden>{props.icon}</span>}
          <div>
            {props.text && <p className="font-bold">{props.text}</p>}
            {props.subtitle && <p className="mt-0.5 text-sm opacity-90">{props.subtitle}</p>}
          </div>
        </div>
        <BannerBtn text={props.buttonText} link={props.buttonLink} onClick={linkClick} />
      </div>
    </section>
  )
}

/** Weekly deals card — grocery style with image accent */
export function GroceryDealBannerBlock({ block, layoutStyle, linkClick }: CommerceBannerProps) {
  const { props } = block
  const { sectionHeight, contentFlex } = bannerLayout(block)

  return (
    <section
      style={{ ...layoutStyle, minHeight: sectionHeight }}
      className="w-full overflow-hidden rounded-none border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
    >
      <div className={`grid md:grid-cols-[1fr_200px] ${BANNER_CONTENT_ROW_CLASS}`}>
        <div className={`flex min-h-full flex-col p-6 md:p-8 ${contentFlex}`} style={{ minHeight: sectionHeight }}>
          <div className="flex items-center gap-2">
            {props.icon && <span className="text-2xl">{props.icon}</span>}
            {props.badge && (
              <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">{props.badge}</span>
            )}
          </div>
          {props.text && <h2 className="mt-2 text-xl font-bold text-emerald-900 dark:text-emerald-100">{props.text}</h2>}
          {props.subtitle && <p className="mt-2 text-sm text-emerald-800/90 dark:text-emerald-200/80">{props.subtitle}</p>}
          {props.buttonText && (
            <div className="mt-4">
              <BannerBtn text={props.buttonText} link={props.buttonLink} onClick={linkClick} />
            </div>
          )}
        </div>
        {props.imageUrl && (
          <img
            src={props.imageUrl}
            alt=""
            className="hidden h-full w-full object-cover md:block"
            style={{ minHeight: sectionHeight }}
          />
        )}
      </div>
    </section>
  )
}

const TRUST_ICONS = [Truck, RotateCcw, ShieldCheck]

/** Trust / USP strip — used across ecommerce sites */
export function TrustStripBannerBlock({ block, layoutStyle }: CommerceBannerProps) {
  const items = block.props.features ?? []
  const { sectionHeight } = bannerLayout(block)

  return (
    <section
      style={{ ...layoutStyle, minHeight: sectionHeight }}
      className="w-full rounded-none border border-gray-100 bg-gray-50 py-6 dark:border-gray-700 dark:bg-gray-800/50"
    >
      <div className={`grid min-h-full gap-6 sm:grid-cols-3 ${BANNER_CONTENT_ROW_CLASS}`} style={{ minHeight: sectionHeight }}>
        {items.map((f, i) => {
          const Icon = TRUST_ICONS[i % TRUST_ICONS.length]
          return (
            <div key={i} className="flex flex-col items-center text-center sm:items-start sm:text-left">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/50">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">{f.title}</p>
              {f.description && <p className="mt-1 text-sm text-gray-500">{f.description}</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Fashion / lifestyle image promo */
export function FashionPromoBannerBlock({ block, layoutStyle, linkClick }: CommerceBannerProps) {
  const { props, styles } = block
  const overlay = props.overlayOpacity ?? styles.overlayOpacity ?? 0.45
  const bg = props.imageUrl
  const { sectionHeight, contentFlex } = bannerLayout(block)

  return (
    <section style={{ ...layoutStyle, minHeight: sectionHeight }} className="relative w-full overflow-hidden rounded-none">
      {bg && <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-black" style={{ opacity: overlay }} />
      <div
        className={`relative z-10 flex min-h-full w-full flex-col py-8 md:py-12 ${contentFlex} ${BANNER_CONTENT_ROW_CLASS}`}
        style={{ color: styles.textColor ?? '#fff', minHeight: sectionHeight }}
      >
        {props.badge && (
          <span className="mb-3 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur-sm">
            {props.badge}
          </span>
        )}
        {props.text && <h2 className="max-w-lg text-2xl font-bold md:text-4xl">{props.text}</h2>}
        {props.subtitle && <p className="mt-3 max-w-md text-sm opacity-95 md:text-base">{props.subtitle}</p>}
        {props.buttonText && (
          <div className="mt-6">
            <BannerBtn
              text={props.buttonText}
              link={props.buttonLink}
              onClick={linkClick}
              className="!bg-white !text-gray-900 hover:!bg-gray-100"
            />
          </div>
        )}
      </div>
    </section>
  )
}
