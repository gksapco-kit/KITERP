import { Link } from 'react-router-dom'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { useVendor } from '@/contexts/VendorContext'
import { BuilderTextField } from '@/components/builder/BuilderTextField'
import { ColumnFooter } from '@/kit/footer/ColumnFooter'
import type { FooterColumn } from '@/kit/footer/ColumnFooter'

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
): FooterColumn[] {
  if (!Array.isArray(rawCols) || rawCols.length === 0) return []
  return rawCols.map(c => ({
    title: String(c?.title ?? '').trim() || 'Links',
    links: Array.isArray(c?.links)
      ? c.links!.map(x => {
          if (typeof x === 'string') return { label: x, href: storePath('/') }
          return { label: x.label ?? '', href: storePath(x.href ?? '/') }
        })
      : [],
  }))
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
}) {
  const { storePath } = useVendor()

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
          </div>

          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4 md:col-span-8">
            {columns.map((col, colIdx) => (
              <div key={colIdx}>
                <BuilderTextField
                  fieldKey={`footer_columns.${colIdx}.title`}
                  blockId={blockId}
                  blockProps={blockProps}
                  value={String(col.title ?? '').trim() || 'Links'}
                  as="h3"
                  className="text-sm font-semibold text-gray-900"
                  placeholder="Column title"
                />
                <ul className="mt-3 space-y-2">
                  {(col.links ?? []).map((link, linkIdx) => (
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
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-4 border-t border-gray-200 pt-6">
          <BuilderTextField
            fieldKey="copyright"
            blockId={blockId}
            blockProps={blockProps}
            value={copyright}
            as="p"
            className="text-xs text-gray-400"
            placeholder="Copyright line"
          />
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            aria-label="Back to top"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </footer>
  )
}

export default function FooterBlock({ site, style, props, liveItems, blockId }: Props) {
  const { storePath } = useVendor()
  const copyright = (props.copyright as string) || `© ${new Date().getFullYear()} ${site.name}. All rights reserved.`
  const brand = (props.brand as string) || site.name
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

  const rawCols = props.footer_columns as RawColumn[] | undefined
  const footerColumns = normalizeFooterColumns(rawCols, storePath)

  const navLinks: Array<{ label: string; url: string }> =
    liveItems.length > 0
      ? liveItems.map(item => ({ label: item.title, url: item.url || '/' }))
      : (props.nav_links as Array<{ label: string; url: string }> | undefined) || []

  if (blockId && footerColumns.length > 0 && !isMinimal && !isSimple) {
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
        showSocial={false}
        showNewsletter={props.show_newsletter === true || footerStyle === 'mega'}
        showBackToTop
        className={footerClass}
        style={{ backgroundColor: footerBg }}
      />
    )
  }

  if (blockId && (isMinimal || isSimple)) {
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
              <Link key={i} to={storePath(link.url)} className={cn('hover:opacity-80', isDark || isBrand ? 'text-white/70' : 'text-gray-500')}>
                {link.label}
              </Link>
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
              <Link key={i} to={storePath(link.url)} className={cn('hover:opacity-80', isDark || isBrand ? 'text-white/70' : 'text-gray-500')}>
                {link.label}
              </Link>
            ))}
          </div>
          <p className={cn('text-xs', isDark || isBrand ? 'text-white/50' : 'text-gray-400')}>{copyright}</p>
        </div>
      </footer>
    )
  }

  if (blockId) {
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
                      <Link to={storePath(link.url)} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">{link.label}</Link>
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
            {site.logo_url ? (
              <img src={site.logo_url} alt={site.name} className="h-8 w-auto object-contain mb-3" />
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
                    <Link to={storePath(link.url)} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Legal</h4>
            <ul className="space-y-2">
              <li><Link to={storePath('/policies')} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Privacy Policy</Link></li>
              <li><Link to={storePath('/policies')} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Terms of Service</Link></li>
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
