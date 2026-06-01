import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { PublicSite, StyleConfig, LiveItem } from '@/blocks/registry'
import { useVendor } from '@/contexts/VendorContext'
import { ColumnFooter } from '@/kit/footer/ColumnFooter'
import type { FooterColumn } from '@/kit/footer/ColumnFooter'

interface Props {
  site: PublicSite
  style: StyleConfig
  props: Record<string, unknown>
  liveItems: LiveItem[]
  branchCode?: string | null
}

type RawColumn = { title?: string; links?: Array<{ label: string; href: string } | string> }

export default function FooterBlock({ site, style, props, liveItems }: Props) {
  const { storePath } = useVendor()
  const copyright = (props.copyright as string) || `© ${new Date().getFullYear()} ${site.name}. All rights reserved.`
  const footerBg = (props.footer_bg as string) || style.surface_color || '#f9fafb'
  const footerStyle = String(props.footer_style ?? 'columns')
  const isDark = footerStyle === 'dark'
  const footerClass = isDark
    ? 'bg-slate-900 text-slate-300 border-slate-700'
    : footerStyle === 'brand'
      ? 'text-white border-white/20'
      : 'border-gray-100'

  const rawCols = props.footer_columns as RawColumn[] | undefined
  const footerColumns: FooterColumn[] = Array.isArray(rawCols) && rawCols.length > 0
    ? rawCols.map((c) => ({
        title: String(c?.title ?? '').trim() || 'Links',
        links: Array.isArray(c?.links)
          ? c.links!.map((x) => {
              if (typeof x === 'string') return { label: x, href: storePath('/') }
              return { label: (x as any).label ?? '', href: storePath((x as any).href ?? '/') }
            })
          : [],
      }))
    : []

  const navLinks: Array<{ label: string; url: string }> =
    liveItems.length > 0
      ? liveItems.map((item) => ({ label: item.title, url: item.url || '/' }))
      : (props.nav_links as Array<{ label: string; url: string }> | undefined) || []

  // Multi-column builder footer — use ColumnFooter (real <Link> elements, fully clickable)
  if (footerColumns.length > 0) {
    return (
      <ColumnFooter
        variant="standard"
        brand={site.name}
        description={site.description ?? undefined}
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

  // Default footer — navigation + legal links
  return (
    <footer className={cn('border-t mt-8', footerClass)} style={{ backgroundColor: footerBg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-2">
            {site.logo_url ? (
              <img src={site.logo_url} alt={site.name} className="h-8 w-auto object-contain mb-3" />
            ) : (
              <p className="text-xl font-bold mb-3" style={{ color: style.primary_color }}>{site.name}</p>
            )}
            {site.description && <p className="text-sm text-gray-500 max-w-sm">{site.description}</p>}
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
          <p className="text-xs text-gray-400">Powered by KITERP</p>
        </div>
      </div>
    </footer>
  )
}
