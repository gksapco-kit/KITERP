import type { CSSProperties } from 'react'
import { Mail, MapPin, Phone } from 'lucide-react'
import { createLinkClickHandler } from '../../lib/buttonNavigation'
import { blockBackgroundStyle, blockInnerLayoutStyle } from '../../lib/blockUtils'
import { PAGE_CONTENT_PADDING, PAGE_MAX_WIDTH_CLASS } from '../../lib/pageLayout'
import type { Block } from '../../types/builder'
import { useBuilderStore } from '../../store/useBuilderStore'

function socialInitial(platform: string): string {
  const p = platform.trim()
  if (!p) return '?'
  const words = p.split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return p.slice(0, 2).toUpperCase()
}

function FooterNavLink({
  label,
  url,
  interactive,
  onNavigate,
  className = 'text-sm text-gray-400 transition hover:text-white',
}: {
  label: string
  url: string
  interactive: boolean
  onNavigate?: (slug: string) => void
  className?: string
}) {
  const pages = useBuilderStore((s) => s.pages)
  const href = url?.trim() || '#'
  const click = createLinkClickHandler({ interactive, link: href, pages, onNavigate })

  return (
    <a href={href} onClick={click} className={className}>
      {label}
    </a>
  )
}

interface FooterBlockProps {
  block: Block
  layoutStyle: CSSProperties
  interactive?: boolean
  onNavigate?: (slug: string) => void
  variant: 'full' | 'minimal'
}

export function FooterBlock({ block, layoutStyle, interactive = false, onNavigate, variant }: FooterBlockProps) {
  const { props } = block
  const textColor = block.styles.textColor ?? '#9ca3af'
  const headingColor = '#f9fafb'
  const footerStyle: CSSProperties = {
    ...blockBackgroundStyle(block.styles),
    ...blockInnerLayoutStyle(block.styles),
    ...layoutStyle,
    marginBottom: 0,
  }

  if (variant === 'minimal') {
    return (
      <footer style={footerStyle} className="w-full border-t border-gray-800">
        <div className={`mx-auto flex w-full ${PAGE_MAX_WIDTH_CLASS} flex-col items-center justify-between gap-4 py-6 sm:flex-row ${PAGE_CONTENT_PADDING}`}>
          <p className="text-sm" style={{ color: textColor }}>
            {props.text}
          </p>
          {props.legalLinks && props.legalLinks.length > 0 && (
            <div className="flex flex-wrap justify-center gap-4">
              {props.legalLinks.map((link, i) => (
                <FooterNavLink
                  key={i}
                  label={link.label}
                  url={link.url}
                  interactive={interactive}
                  onNavigate={onNavigate}
                  className="text-xs text-gray-500 hover:text-gray-300"
                />
              ))}
            </div>
          )}
        </div>
      </footer>
    )
  }

  return (
    <footer style={footerStyle} className="w-full border-t border-gray-800">
      <div className={`mx-auto w-full ${PAGE_MAX_WIDTH_CLASS} py-12 ${PAGE_CONTENT_PADDING}`}>
        <div className="flex flex-nowrap items-start justify-between gap-6 overflow-x-auto pb-1">
          {/* Brand & contact */}
          <div className="w-[220px] shrink-0">
            <h3 className="text-xl font-bold" style={{ color: headingColor }}>
              {props.companyName ?? 'My Website'}
            </h3>
            {props.tagline && (
              <p className="mt-3 text-sm leading-relaxed" style={{ color: textColor }}>
                {props.tagline}
              </p>
            )}
            <ul className="mt-6 space-y-3">
              {props.email && (
                <li className="flex items-start gap-2 text-sm" style={{ color: textColor }}>
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                  <a href={`mailto:${props.email}`} className="hover:text-white">
                    {props.email}
                  </a>
                </li>
              )}
              {props.phone && (
                <li className="flex items-start gap-2 text-sm" style={{ color: textColor }}>
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                  <a href={`tel:${props.phone.replace(/\s/g, '')}`} className="hover:text-white">
                    {props.phone}
                  </a>
                </li>
              )}
              {props.address && (
                <li className="flex items-start gap-2 text-sm whitespace-pre-line" style={{ color: textColor }}>
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                  <span>{props.address}</span>
                </li>
              )}
            </ul>
            {props.socialLinks && props.socialLinks.length > 0 && (
              <div className="mt-6 flex gap-3">
                {props.socialLinks.map((s, i) => (
                  <a
                    key={i}
                    href={s.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (!interactive) e.preventDefault()
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-800 text-xs font-bold text-gray-300 transition hover:bg-brand-600 hover:text-white"
                    aria-label={s.platform}
                    title={s.platform}
                  >
                    {socialInitial(s.platform)}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Link columns */}
          {props.footerColumns?.map((col, ci) => (
            <div key={ci} className="w-[130px] shrink-0">
              <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: headingColor }}>
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2">
                {col.links.map((link, li) => (
                  <li key={li}>
                    <FooterNavLink
                      label={link.label}
                      url={link.url}
                      interactive={interactive}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Newsletter */}
          {props.showNewsletter && (
            <div className="w-[260px] shrink-0">
              <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: headingColor }}>
                {props.newsletterTitle ?? 'Newsletter'}
              </h4>
              <p className="mt-2 text-sm" style={{ color: textColor }}>
                Get updates, offers, and news delivered to your inbox.
              </p>
              <form
                className="mt-4 flex flex-nowrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                }}
              >
                <input
                  type="email"
                  placeholder={props.newsletterPlaceholder ?? 'Email address'}
                  className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-brand-500"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Subscribe
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div
          className="mt-10 flex flex-nowrap items-center justify-between gap-6 border-t border-gray-800 pt-8"
          style={{ color: textColor }}
        >
          <p className="min-w-0 shrink text-sm">{props.text}</p>
          {props.legalLinks && props.legalLinks.length > 0 && (
            <div className="flex shrink-0 flex-nowrap items-center gap-4">
              {props.legalLinks.map((link, i) => (
                <FooterNavLink
                  key={i}
                  label={link.label}
                  url={link.url}
                  interactive={interactive}
                  onNavigate={onNavigate}
                  className="text-xs text-gray-500 hover:text-gray-300"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}
