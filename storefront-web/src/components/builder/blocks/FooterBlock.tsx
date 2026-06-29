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
  normalizeFooterSocialLinks,
  type FooterSocialPlatform,
} from '@/kit/footer/footerSocial'
import {
  buildFooterContactLinks,
  isFooterContactColumn,
} from '@/lib/businessContact'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
  blockId?: string
}

type RawColumn = { title?: string; links?: Array<{ label: string; href: string } | string> }

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
            return {
              label: x.label ?? '',
              href: storePath(x.href ?? '/'),
              external: previewShell || undefined,
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
  footerBg,
  footerClass,
  primaryColor,
  showSocial,
  socialLinks,
  profile,
  vendor,
}: {
  blockId: string
  blockProps: Record<string, unknown>
  brand: string
  description: string
  columns: RawColumn[]
  copyright: string
  footerBg: string
  footerClass: string
  primaryColor: string
  showSocial: boolean
  socialLinks: Partial<Record<FooterSocialPlatform, string>>
  profile?: LiveItem
  vendor?: VendorData | null
}) {
  const storePath = useStorePath()
  const liveContactLinks = buildFooterContactLinks(profile, vendor)

  return (
    <footer className={cn('border-t mt-8', footerClass)} style={{ backgroundColor: footerBg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
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
            {(description || blockId) && (
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
                  />
                ))}
              </div>
            )}
          </div>

          <div
            className={cn(
              'grid gap-8 md:col-span-8',
              (columns.length >= 4
                ? 'sm:grid-cols-2 md:grid-cols-4'
                : columns.length === 3
                  ? 'sm:grid-cols-2 md:grid-cols-3'
                  : columns.length === 2
                    ? 'sm:grid-cols-2'
                    : 'grid-cols-1'),
            )}
          >
            {columns.map((col, colIdx) => {
              const title = String(col.title ?? '').trim() || 'Links'
              const contactColumn = isFooterContactColumn(title) && liveContactLinks.length > 0
              return (
              <div key={colIdx}>
                <BuilderTextField
                  fieldKey={`footer_columns.${colIdx}.title`}
                  blockId={blockId}
                  blockProps={blockProps}
                  value={title}
                  as="h3"
                  className="text-sm font-semibold text-gray-900"
                  placeholder="Column title"
                />
                <ul className="mt-3 space-y-2">
                  {contactColumn
                    ? liveContactLinks.map((link) => (
                        <li key={link.label} className="text-sm text-gray-500">{link.label}</li>
                      ))
                    : (col.links ?? []).map((link, linkIdx) => (
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
                      ))}
                </ul>
              </div>
            )})}
          </div>
        </div>

        <div className="mt-10 border-t border-gray-200 pt-6">
          <BuilderTextField
            fieldKey="copyright"
            blockId={blockId}
            blockProps={blockProps}
            value={copyright}
            as="p"
            className="text-xs text-gray-400"
            placeholder="Copyright line"
          />
        </div>
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
    return <Link to={href} className={className}>{children}</Link>
  }, [previewShell, previewFooterClick])
  const brandName = effectiveVendor?.display_name?.trim() || vendor?.display_name?.trim() || 'Store'
  const logoUrl = effectiveVendor?.logo_url?.trim() || vendor?.logo_url?.trim() || null
  const copyright = (props.copyright as string) || `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`
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

  const profile = liveItems[0]
  const rawCols = props.footer_columns as RawColumn[] | undefined
  const footerColumns = normalizeFooterColumns(rawCols, storePath, previewShell === true, profile, effectiveVendor)
  const showSocial = props.show_social !== false
  const socialLinks = normalizeFooterSocialLinks({
    ...(vendor?.social_links as Record<string, string> | undefined),
    ...(props.social_links as Record<string, string> | undefined),
  })
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
        footerBg={footerBg}
        footerClass={footerClass}
        primaryColor={style.primary_color}
        showSocial={showSocial}
        socialLinks={socialLinks}
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
        showSocial={showSocial}
        socialLinks={socialLinks}
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
        <div className={cn('max-w-7xl mx-auto px-4 py-8 text-center', isCompact && 'py-6')}>
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
              <FooterLink key={i} href={storePath(link.url)} className={cn('hover:opacity-80', isDark || isBrand ? 'text-white/70' : 'text-gray-500')}>
                {link.label}
              </FooterLink>
            ))}
          </div>
          <BuilderTextField
            fieldKey="copyright"
            blockId={blockId}
            blockProps={props}
            value={copyright}
            as="p"
            className={cn('text-xs', isDark || isBrand ? 'text-white/50' : 'text-gray-400')}
            placeholder="Copyright line"
          />
        </div>
      </footer>
    )
  }

  if (isMinimal || isSimple) {
    return (
      <footer className={cn('border-t mt-8', footerClass)} style={{ backgroundColor: footerBg }}>
        <div className={cn('max-w-7xl mx-auto px-4 py-8 text-center', isCompact && 'py-6')}>
          <p className={cn('font-bold mb-3', isBrand || isDark ? 'text-white' : '')} style={!isBrand && !isDark ? { color: style.primary_color } : undefined}>
            {brand}
          </p>
          <div className={cn('flex flex-wrap justify-center gap-x-4 gap-y-2 mb-4', isSimple && 'text-sm')}>
            {navLinks.map((link, i) => (
              <FooterLink key={i} href={storePath(link.url)} className={cn('hover:opacity-80', isDark || isBrand ? 'text-white/70' : 'text-gray-500')}>
                {link.label}
              </FooterLink>
            ))}
          </div>
          <p className={cn('text-xs', isDark || isBrand ? 'text-white/50' : 'text-gray-400')}>{copyright}</p>
        </div>
      </footer>
    )
  }

  if (isEditor) {
    return (
      <footer className={cn('border-t mt-8', footerClass)} style={{ backgroundColor: footerBg }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
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
            </div>
            {navLinks.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Navigation</h4>
                <ul className="space-y-2">
                  {navLinks.map((link, i) => (
                    <li key={i}>
                      <FooterLink href={storePath(link.url)} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">{link.label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 pt-6">
            <BuilderTextField
              fieldKey="copyright"
              blockId={blockId}
              blockProps={props}
              value={copyright}
              as="p"
              className="text-xs text-gray-400"
              placeholder="Copyright line"
            />
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className={cn('border-t mt-8', footerClass)} style={{ backgroundColor: footerBg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className={cn('md:col-span-2', isCompact && 'md:col-span-1')}>
            {logoUrl ? (
              <img src={imgUrl(logoUrl)} alt={brand} className="h-8 w-auto object-contain mb-3" />
            ) : (
              <p className="text-xl font-bold mb-3" style={{ color: style.primary_color }}>{brand}</p>
            )}
            {description && <p className="text-sm text-gray-500 max-w-sm">{description}</p>}
          </div>
          {navLinks.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Navigation</h4>
              <ul className="space-y-2">
                {navLinks.map((link, i) => (
                  <li key={i}>
                    <FooterLink href={storePath(link.url)} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">{link.label}</FooterLink>
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
        <div className="border-t border-gray-200 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-400">{copyright}</p>
        </div>
      </div>
    </footer>
  )
}
