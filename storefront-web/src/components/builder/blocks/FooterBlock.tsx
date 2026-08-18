import { useCallback, type MouseEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cn, imgUrl } from '@/lib/utils'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { useStorePath } from '@/hooks/useStorePath'
import { useVendor, type VendorData } from '@/contexts/VendorContext'
import { useEffectiveVendor } from '@/hooks/useEffectiveVendor'
import { useBuilderCanvas } from '@/contexts/BuilderCanvasContext'
import { isDraftPreviewShellHref } from '@/lib/previewNavRouting'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { BuilderSocialIcon } from '@/components/builder/BuilderSocialIcon'
import { ColumnFooter } from '@/kit/footer/ColumnFooter'
import type { FooterColumn } from '@/kit/footer/ColumnFooter'
import {
  FOOTER_SOCIAL_PLATFORMS,
  resolveFooterSocialLinks,
  type FooterSocialPlatform,
} from '@/kit/footer/footerSocial'
import { formatKiterpBrandText } from '@/kit/footer/kiterpBrandText'
import {
  buildFooterContactLinks,
  isFooterContactColumn,
} from '@/lib/businessContact'
import {
  isBlockFieldHidden,
  isNestedBlockFieldHidden,
  resolveBlockTextField,
  visibleArrayEntries,
} from '@/lib/blockHiddenFields'
import { readSocialIconStyleFromSettings, SocialPlatformIcon } from '@/lib/socialPlatformIcons'
import type { SocialLinksIconStyle } from '@/lib/socialLinksMode'
import { resolveSocialLinkHref } from '@/lib/socialLinkHref'
import { builderSectionContainerClass } from '@/lib/builderSectionLayout'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

type RawColumn = {
  title?: string
  links?: Array<{ label: string; href: string; openInNewTab?: boolean } | string>
}

const DEFAULT_POWERED_BY_TEXT = 'Powered By @ KITERP.com'
const DEFAULT_POWERED_BY_URL = 'https://kiterp.com/'

function resolvePoweredByText(props: Record<string, unknown>): string | null {
  // Platform branding is always on for every site.
  // Only a platform admin can hide it (powered_by_admin_disabled).
  // Ignore legacy show_powered_by:false so older BUs still show the mark.
  if (props.powered_by_admin_disabled === true) return null
  const text = String(props.powered_by_text ?? '').trim()
  return text || DEFAULT_POWERED_BY_TEXT
}

function isExternalHref(href: string): boolean {
  return /^(https?:|mailto:|tel:)/i.test(href)
    || href.startsWith('//')
    || href.startsWith('#')
}

function isHttpHref(href: string): boolean {
  return /^https?:\/\//i.test(href) || href.startsWith('//')
}

/**
 * Resolve a footer/nav href for storefront routing.
 * http(s) links default to new-tab external navigation (including same-site HR URLs)
 * so they are never prefixed with `/{slug}/`. Unchecking "Open in new tab"
 * keeps same-origin URLs as in-app paths.
 */
function resolveFooterHref(
  rawHref: string | undefined | null,
  storePath: (p: string) => string,
  openInNewTab?: boolean | null,
): { href: string; external: boolean; openInNewTab: boolean } {
  const raw = String(rawHref ?? '/').trim() || '/'

  if (isHttpHref(raw)) {
    const absolute = raw.startsWith('//') ? `https:${raw}` : raw
    // Default: all http(s) links open in a new tab unless explicitly disabled.
    const newTab = openInNewTab !== false
    if (newTab) {
      return { href: absolute, external: true, openInNewTab: true }
    }
    try {
      if (typeof window !== 'undefined') {
        const url = new URL(absolute, window.location.origin)
        if (url.origin === window.location.origin) {
          return { href: `${url.pathname}${url.search}${url.hash}`, external: false, openInNewTab: false }
        }
      }
    } catch {
      /* keep absolute */
    }
    // Cross-origin, same-tab preference: use <a> without target=_blank.
    return { href: absolute, external: true, openInNewTab: false }
  }

  if (isExternalHref(raw)) {
    return { href: raw, external: true, openInNewTab: openInNewTab === true }
  }

  const href = storePath(raw.startsWith('/') ? raw : `/${raw}`)
  if (openInNewTab === true) {
    return { href, external: true, openInNewTab: true }
  }
  return { href, external: false, openInNewTab: false }
}

function resolvePoweredByHref(
  props: Record<string, unknown>,
  storePath: (p: string) => string,
): string | null {
  const raw = String(props.powered_by_text_url ?? '').trim() || DEFAULT_POWERED_BY_URL
  if (isExternalHref(raw)) return raw
  return storePath(raw.startsWith('/') ? raw : `/${raw}`)
}

function FooterBarPoweredBy({
  text,
  href,
  openInNewTab,
  className,
  asLink = true,
  InternalLink,
}: {
  text: string | null
  href?: string | null
  openInNewTab?: boolean
  className?: string
  /** When false (builder canvas), render plain text even if a URL is set. */
  asLink?: boolean
  InternalLink?: (props: { href: string; className?: string; children: ReactNode }) => ReactNode
}) {
  if (!text) return null
  const label = formatKiterpBrandText(text)
  const linkHref = (asLink && href?.trim()) || ''
  if (!linkHref) {
    return <p className={cn('text-xs text-center', className)}>{label}</p>
  }
  const external = isExternalHref(linkHref)
  // Never underline — same look in preview and after publish.
  const linkClass = cn('text-xs text-center cursor-pointer no-underline hover:no-underline', className)
  const linkStyle = { textDecoration: 'none' as const }
  if (external || openInNewTab) {
    return (
      <a
        href={linkHref}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        style={linkStyle}
      >
        {label}
      </a>
    )
  }
  if (InternalLink) {
    return <InternalLink href={linkHref} className={linkClass}>{label}</InternalLink>
  }
  return (
    <Link to={linkHref} className={linkClass} style={linkStyle}>
      {label}
    </Link>
  )
}

function FooterPublishedSocialRow({
  socialLinks,
  socialIconStyle,
  showAllSocialIcons,
  className,
  linkClassName,
}: {
  socialLinks: Partial<Record<FooterSocialPlatform, string>>
  socialIconStyle: SocialLinksIconStyle
  showAllSocialIcons?: boolean
  className?: string
  linkClassName?: string
}) {
  const visible = FOOTER_SOCIAL_PLATFORMS.filter(({ key }) =>
    showAllSocialIcons || Boolean(resolveSocialLinkHref(key, socialLinks[key] ?? '')),
  )
  if (visible.length === 0) return null

  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-2', className)}>
      {visible.map(({ key, label }) => {
        const href = resolveSocialLinkHref(key, socialLinks[key] ?? '')
        if (!href) {
          return (
            <span key={key} aria-label={label} className="text-muted-foreground/35">
              <SocialPlatformIcon platform={key} style={socialIconStyle} className="h-4 w-4" />
            </span>
          )
        }
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className={cn('text-muted-foreground hover:text-foreground', linkClassName)}
          >
            <SocialPlatformIcon platform={key} style={socialIconStyle} className="h-4 w-4" />
          </a>
        )
      })}
    </div>
  )
}

function linkLabel(link: string | { label?: string; href?: string }): string {
  if (typeof link === 'string') return link
  return link.label ?? ''
}

function normalizeFooterColumns(
  rawCols: RawColumn[] | undefined,
  storePath: (p: string) => string,
  previewShell = false,
  profile?: LiveItem,
  vendor?: VendorData | null,
): FooterColumn[] {
  if (!Array.isArray(rawCols) || rawCols.length === 0) return []
  const liveContactLinks = buildFooterContactLinks(profile, vendor)
  return rawCols.map(c => {
    const title = String(c?.title ?? '').trim() || 'Links'
    if (isFooterContactColumn(title) && liveContactLinks.length > 0) {
      return {
        title,
        links: liveContactLinks.map((link) => ({
          label: link.label,
          href: link.href,
          external: link.external ?? previewShell,
        })),
      }
    }
    return {
      title,
      links: Array.isArray(c?.links)
        ? c.links!.map(x => {
            if (typeof x === 'string') {
              return { label: x, href: storePath('/'), external: previewShell || undefined }
            }
            const resolved = resolveFooterHref(x.href, storePath, x.openInNewTab)
            return {
              label: x.label ?? '',
              href: resolved.href,
              external: previewShell || resolved.external || undefined,
              openInNewTab: resolved.openInNewTab || undefined,
            }
          })
        : [],
    }
  })
}

function EditableColumnFooter({
  blockId,
  blockProps,
  brand,
  description,
  columns,
  copyright,
  poweredByText,
  footerBg,
  footerClass,
  primaryColor,
  showSocial,
  socialLinks,
  socialIconStyle,
  profile,
  vendor,
}: {
  blockId: string
  blockProps: Record<string, unknown>
  brand: string
  description: string
  columns: RawColumn[]
  copyright: string
  poweredByText: string | null
  footerBg: string
  footerClass: string
  primaryColor: string
  showSocial: boolean
  socialLinks: Partial<Record<FooterSocialPlatform, string>>
  socialIconStyle: SocialLinksIconStyle
  profile?: LiveItem
  vendor?: VendorData | null
}) {
  const storePath = useStorePath()
  const liveContactLinks = buildFooterContactLinks(profile, vendor)
  const showBrand = !isBlockFieldHidden(blockProps, 'brand') && (brand.trim() || blockId)
  const showDescription = !isBlockFieldHidden(blockProps, 'description') && (description.trim() || blockId)
  const showCopyright = !isBlockFieldHidden(blockProps, 'copyright') && (copyright.trim() || blockId)
  const visibleColumns = visibleArrayEntries(columns, blockProps, 'footer_columns')

  return (
    <footer className={cn('w-full min-w-0 border-t mt-8', footerClass)} style={{ backgroundColor: footerBg }}>
      <div className={builderSectionContainerClass('pt-7 pb-5')}>
        <div className="grid w-full min-w-0 gap-10 md:grid-cols-12">
          <div className="min-w-0 md:col-span-4">
            {showBrand && (
            <BuilderTextField
              fieldKey="brand"
              blockId={blockId}
              blockProps={blockProps}
              value={brand}
              as="div"
              className="text-lg font-semibold"
              style={{ color: primaryColor }}
              placeholder="Brand name"
            />
            )}
            {showDescription && (
              <BuilderTextField
                fieldKey="description"
                blockId={blockId}
                blockProps={blockProps}
                value={description}
                as="p"
                multiline
                className="mt-3 text-sm text-gray-500 max-w-sm"
                placeholder="Short site description"
              />
            )}
            {showSocial && (
              <div className="mt-4 flex items-center gap-2">
                {FOOTER_SOCIAL_PLATFORMS.map(({ key }) => (
                  <BuilderSocialIcon
                    key={key}
                    blockId={blockId}
                    platform={key}
                    url={socialLinks[key] || ''}
                    iconStyle={socialIconStyle}
                  />
                ))}
              </div>
            )}
          </div>

          <div
            className={cn(
              'grid w-full min-w-0 gap-8 md:col-span-8',
              (visibleColumns.length >= 4
                ? 'md:grid-cols-2 lg:grid-cols-4'
                : visibleColumns.length === 3
                  ? 'md:grid-cols-2 lg:grid-cols-3'
                  : visibleColumns.length === 2
                    ? 'md:grid-cols-2'
                    : 'grid-cols-1'),
            )}
          >
            {visibleColumns.map(({ item: col, index: colIdx }) => {
              const title = String(col.title ?? '').trim() || 'Links'
              const showColTitle = !isNestedBlockFieldHidden(blockProps, `footer_columns.${colIdx}.title`)
              const contactColumn = isFooterContactColumn(title) && liveContactLinks.length > 0
              return (
              <div key={colIdx}>
                {showColTitle && (
                <BuilderTextField
                  fieldKey={`footer_columns.${colIdx}.title`}
                  blockId={blockId}
                  blockProps={blockProps}
                  value={title}
                  as="h3"
                  className="text-sm font-semibold text-gray-900"
                  placeholder="Column title"
                />
                )}
                <ul className="mt-3 space-y-2">
                  {contactColumn
                    ? liveContactLinks.map((link) => (
                        <li key={link.label} className="text-sm text-gray-500">{link.label}</li>
                      ))
                    : (col.links ?? []).map((link, linkIdx) => (
                        !isNestedBlockFieldHidden(blockProps, `footer_columns.${colIdx}.links.${linkIdx}`) ? (
                        <li key={linkIdx}>
                          <BuilderTextField
                            fieldKey={`footer_columns.${colIdx}.links.${linkIdx}`}
                            blockId={blockId}
                            blockProps={blockProps}
                            value={linkLabel(link)}
                            as="span"
                            className="text-sm text-gray-500"
                            placeholder="Link label"
                          />
                        </li>
                        ) : null
                      ))}
                </ul>
              </div>
            )})}
          </div>
        </div>

        {(showCopyright || poweredByText) && (
        <div className="relative mt-6 flex min-h-[1.25rem] flex-col items-center justify-center gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-between">
          {showCopyright ? (
            <BuilderTextField
              fieldKey="copyright"
              blockId={blockId}
              blockProps={blockProps}
              value={copyright}
              as="p"
              className="text-xs text-gray-400"
              placeholder="Copyright line"
            />
          ) : <span />}
          <FooterBarPoweredBy
            text={poweredByText}
            asLink={false}
            className="text-gray-400 sm:absolute sm:left-1/2 sm:-translate-x-1/2"
          />
        </div>
        )}
      </div>
    </footer>
  )
}

export default function FooterBlock({ site, style, props, liveItems, blockId }: Props) {
  const storePath = useStorePath()
  const navigate = useNavigate()
  const builderCanvas = useBuilderCanvas()
  const { previewShell, openBuilderForPage, vendor } = useVendor()
  const effectiveVendor = useEffectiveVendor()
  const isEditor = builderCanvas?.isEditorCanvas === true && !!blockId

  const previewFooterClick = useCallback((e: MouseEvent, href: string) => {
    if (!previewShell) return
    e.preventDefault()
    try {
      const url = new URL(href, window.location.origin)
      if (isDraftPreviewShellHref(url.pathname)) {
        if (url.searchParams.has('route')) {
          navigate({ pathname: url.pathname, search: url.search })
          return
        }
        openBuilderForPage?.(url.searchParams.get('page'))
        return
      }
    } catch {
      /* fall through */
    }
    navigate(href)
  }, [previewShell, openBuilderForPage, navigate])

  const FooterLink = useCallback(({ href, className, children }: { href: string; className?: string; children: ReactNode }) => {
    if (previewShell) {
      return (
        <a href={href} className={className} onClick={(e) => previewFooterClick(e, href)}>
          {children}
        </a>
      )
    }
    if (isExternalHref(href)) {
      return (
        <a href={href} className={className} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      )
    }
    return <Link to={href} className={className}>{children}</Link>
  }, [previewShell, previewFooterClick])
  const brandName = effectiveVendor?.display_name?.trim() || vendor?.display_name?.trim() || 'Store'
  const logoUrl = effectiveVendor?.logo_url?.trim() || vendor?.logo_url?.trim() || null
  const copyright = (props.copyright as string) || `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`
  const poweredByText = resolvePoweredByText(props)
  const poweredByHref = resolvePoweredByHref(props, storePath)
  // External attribution links open in a new tab by default.
  const poweredByNewTab = props.powered_by_text_link_new_tab === false
    ? false
    : Boolean(props.powered_by_text_link_new_tab) || Boolean(poweredByHref && isExternalHref(poweredByHref))
  const brand = brandName
  const description = (props.description as string) || site.description || ''
  const footerBg = (props.footer_bg as string) || style.surface_color || '#f9fafb'
  const footerStyle = String(props.footer_style ?? 'columns')
  const isDark = footerStyle === 'dark'
  const isMinimal = footerStyle === 'minimal'
  const isSimple = footerStyle === 'simple'
  const isBrand = footerStyle === 'brand'
  const isCompact = footerStyle === 'compact'
  const footerClass = isDark
    ? 'bg-slate-900 text-slate-300 border-slate-700'
    : isBrand
      ? 'text-white border-white/20'
      : 'border-gray-100'
  const poweredByClass = isDark || isBrand ? 'text-white/50' : 'text-gray-400'

  const profile = liveItems[0]
  const rawCols = props.footer_columns as RawColumn[] | undefined
  const footerColumns = normalizeFooterColumns(rawCols, storePath, previewShell === true, profile, effectiveVendor)
  const showSocial = props.show_social !== false
  const socialLinks = resolveFooterSocialLinks(
    effectiveVendor?.social_links as Record<string, string> | undefined,
    props.social_links as Record<string, string> | undefined,
  )
  const socialIconStyle = readSocialIconStyleFromSettings(effectiveVendor?.settings)
  const showAllSocialIcons = isEditor || previewShell === true

  const navLinks: Array<{ label: string; url: string }> =
    liveItems.length > 0
      ? liveItems.map(item => ({ label: item.title, url: item.url || '/' }))
      : (props.nav_links as Array<{ label: string; url: string }> | undefined) || []

  if (isEditor && footerColumns.length > 0 && !isMinimal && !isSimple) {
    return (
      <EditableColumnFooter
        blockId={blockId}
        blockProps={props}
        brand={brand}
        description={description}
        columns={rawCols ?? []}
        copyright={copyright}
        poweredByText={poweredByText}
        footerBg={footerBg}
        footerClass={footerClass}
        primaryColor={style.primary_color}
        showSocial={showSocial}
        socialLinks={socialLinks}
        socialIconStyle={socialIconStyle}
        profile={profile}
        vendor={effectiveVendor}
      />
    )
  }

  if (footerColumns.length > 0 && !isMinimal && !isSimple) {
    return (
      <ColumnFooter
        variant="standard"
        brand={brand}
        description={description || undefined}
        columns={footerColumns}
        copyright={copyright}
        poweredByText={poweredByText}
        poweredByHref={poweredByHref}
        poweredByNewTab={poweredByNewTab}
        showSocial={showSocial}
        socialLinks={socialLinks}
        socialIconStyle={socialIconStyle}
        showAllSocialIcons={showAllSocialIcons}
        showNewsletter={props.show_newsletter === true || footerStyle === 'mega'}
        className={footerClass}
        style={{ backgroundColor: footerBg }}
      />
    )
  }

  if (isEditor && (isMinimal || isSimple)) {
    return (
      <footer className={cn('border-t mt-8', footerClass)} style={{ backgroundColor: footerBg }}>
        <div className={builderSectionContainerClass('pt-5 pb-3 text-center', isCompact && 'pt-4 pb-2')}>
          <BuilderTextField
            fieldKey="brand"
            blockId={blockId}
            blockProps={props}
            value={brand}
            as="p"
            className={cn('font-bold mb-3', isBrand || isDark ? 'text-white' : '')}
            style={!isBrand && !isDark ? { color: style.primary_color } : undefined}
            placeholder="Brand name"
          />
          <div className={cn('flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4', isSimple && 'text-sm')}>
            {navLinks.map((link, i) => (
              <FooterLink key={i} href={resolveFooterHref(link.url, storePath).href} className={cn('hover:opacity-80', isDark || isBrand ? 'text-white/70' : 'text-gray-500')}>
                {link.label}
              </FooterLink>
            ))}
          </div>
          {showSocial && blockId && (
            <div className="mb-4 flex items-center justify-center gap-2">
              {FOOTER_SOCIAL_PLATFORMS.map(({ key }) => (
                <BuilderSocialIcon
                  key={key}
                  blockId={blockId}
                  platform={key}
                  url={socialLinks[key] || ''}
                  iconStyle={socialIconStyle}
                />
              ))}
            </div>
          )}
          <BuilderTextField
            fieldKey="copyright"
            blockId={blockId}
            blockProps={props}
            value={copyright}
            as="p"
            className={cn('text-xs', poweredByClass)}
            placeholder="Copyright line"
          />
          <FooterBarPoweredBy
            text={poweredByText}
            href={poweredByHref}
            openInNewTab={poweredByNewTab}
            asLink={false}
            className={cn('mt-2', poweredByClass)}
          />
        </div>
      </footer>
    )
  }

  if (isMinimal || isSimple) {
    return (
      <footer className={cn('border-t mt-8', footerClass)} style={{ backgroundColor: footerBg }}>
        <div className={builderSectionContainerClass('pt-5 pb-3 text-center', isCompact && 'pt-4 pb-2')}>
          <p className={cn('font-bold mb-3', isBrand || isDark ? 'text-white' : '')} style={!isBrand && !isDark ? { color: style.primary_color } : undefined}>
            {brand}
          </p>
          <div className={cn('flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4', isSimple && 'text-sm')}>
            {navLinks.map((link, i) => (
              <FooterLink key={i} href={resolveFooterHref(link.url, storePath).href} className={cn('hover:opacity-80', isDark || isBrand ? 'text-white/70' : 'text-gray-500')}>
                {link.label}
              </FooterLink>
            ))}
          </div>
          {showSocial && (
            <FooterPublishedSocialRow
              socialLinks={socialLinks}
              socialIconStyle={socialIconStyle}
              className="mb-4"
              linkClassName={isDark || isBrand ? 'text-white/70 hover:text-white' : undefined}
            />
          )}
          <p className={cn('text-xs', poweredByClass)}>{copyright}</p>
          <FooterBarPoweredBy
            text={poweredByText}
            href={poweredByHref}
            openInNewTab={poweredByNewTab}
            InternalLink={FooterLink}
            className={cn('mt-2', poweredByClass)}
          />
        </div>
      </footer>
    )
  }

  if (isEditor) {
    return (
      <footer className={cn('border-t mt-8', footerClass)} style={{ backgroundColor: footerBg }}>
        <div className={builderSectionContainerClass('pt-7 pb-5')}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-5">
            <div className={cn('md:col-span-2', isCompact && 'md:col-span-1')}>
              <BuilderTextField
                fieldKey="brand"
                blockId={blockId}
                blockProps={props}
                value={brand}
                as="p"
                className="text-xl font-bold mb-3"
                style={{ color: style.primary_color }}
                placeholder="Brand name"
              />
              {(description || blockId) && (
                <BuilderTextField
                  fieldKey="description"
                  blockId={blockId}
                  blockProps={props}
                  value={description}
                  as="p"
                  multiline
                  className="text-sm text-gray-500 max-w-sm"
                  placeholder="Short site description"
                />
              )}
              {showSocial && (
                <div className="mt-4 flex items-center gap-2">
                  {FOOTER_SOCIAL_PLATFORMS.map(({ key }) => (
                    <BuilderSocialIcon
                      key={key}
                      blockId={blockId!}
                      platform={key}
                      url={socialLinks[key] || ''}
                      iconStyle={socialIconStyle}
                    />
                  ))}
                </div>
              )}
            </div>
            {navLinks.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Navigation</h4>
                <ul className="space-y-2">
                  {navLinks.map((link, i) => (
                    <li key={i}>
                      <FooterLink href={resolveFooterHref(link.url, storePath).href} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">{link.label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="relative border-t border-gray-200 pt-4 flex min-h-[1.25rem] flex-col items-center justify-center gap-2 sm:flex-row sm:justify-between">
            <BuilderTextField
              fieldKey="copyright"
              blockId={blockId}
              blockProps={props}
              value={copyright}
              as="p"
              className="text-xs text-gray-400"
              placeholder="Copyright line"
            />
            <FooterBarPoweredBy
              text={poweredByText}
              href={poweredByHref}
              openInNewTab={poweredByNewTab}
              asLink={false}
              className="text-gray-400 sm:absolute sm:left-1/2 sm:-translate-x-1/2"
            />
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className={cn('border-t mt-8', footerClass)} style={{ backgroundColor: footerBg }}>
      <div className={builderSectionContainerClass('pt-7 pb-5')}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-5">
          <div className={cn('md:col-span-2', isCompact && 'md:col-span-1')}>
            {logoUrl ? (
              <img src={imgUrl(logoUrl)} alt={brand} className="h-11 w-auto max-w-[200px] object-contain mb-3" />
            ) : (
              <p className="text-xl font-bold mb-3" style={{ color: style.primary_color }}>{brand}</p>
            )}
            {description && <p className="text-sm text-gray-500 max-w-sm">{description}</p>}
            {showSocial && (
              <FooterPublishedSocialRow
                socialLinks={socialLinks}
                socialIconStyle={socialIconStyle}
                className="mt-4 justify-start"
              />
            )}
          </div>
          {navLinks.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Navigation</h4>
              <ul className="space-y-2">
                {navLinks.map((link, i) => (
                  <li key={i}>
                    <FooterLink href={resolveFooterHref(link.url, storePath).href} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Legal</h4>
            <ul className="space-y-2">
              <li><FooterLink href={storePath('/policies')} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Privacy Policy</FooterLink></li>
              <li><FooterLink href={storePath('/policies')} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Terms of Service</FooterLink></li>
            </ul>
          </div>
        </div>
        <div className="relative border-t border-gray-200 pt-4 flex min-h-[1.25rem] flex-col items-center justify-center gap-2 sm:flex-row sm:justify-between">
          <p className="text-xs text-gray-400">{copyright}</p>
          <FooterBarPoweredBy
            text={poweredByText}
            href={poweredByHref}
            openInNewTab={poweredByNewTab}
            InternalLink={FooterLink}
            className="text-gray-400 sm:absolute sm:left-1/2 sm:-translate-x-1/2"
          />
        </div>
      </div>
    </footer>
  )
}
