import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { FooterColumn } from '@/kit/footer/ColumnFooter'
import { formatKiterpBrandText } from '@/kit/footer/kiterpBrandText'
import { builderSectionContainerClass } from '@/lib/builderSectionLayout'

const DEFAULT_NEWSLETTER =
  'Subscribe and get notified on new arrivals, offers & much more!'

type LinkItem = FooterColumn['links'][number]

function FooterLinkItem({
  link,
  className,
  LinkWrap,
}: {
  link: LinkItem
  className?: string
  LinkWrap: (props: { href: string; className?: string; children: ReactNode }) => ReactNode
}) {
  const useAnchor =
    Boolean(link.external)
    || /^(https?:|mailto:|tel:)/i.test(link.href)
    || link.href.startsWith('//')
  const openNew = link.openInNewTab ?? Boolean(link.external)
  if (useAnchor) {
    return (
      <a
        href={link.href}
        className={className}
        {...(openNew ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {link.label}
      </a>
    )
  }
  return (
    <LinkWrap href={link.href} className={className}>
      {link.label}
    </LinkWrap>
  )
}

export function SilkAtelierFooter({
  columns,
  footerBg,
  bodyFont,
  newsletterBlurb,
  registeredAddress,
  copyright,
  poweredByText,
  poweredByHref,
  poweredByNewTab,
  supportExtras,
  LinkWrap,
}: {
  columns: FooterColumn[]
  footerBg: string
  bodyFont?: string
  newsletterBlurb?: string
  registeredAddress?: string
  copyright?: string
  poweredByText?: string | null
  poweredByHref?: string | null
  poweredByNewTab?: boolean
  /** Phone / email lines shown under Support (before link list). */
  supportExtras?: Array<{ label: string; href?: string }>
  LinkWrap: (props: { href: string; className?: string; children: ReactNode }) => ReactNode
}) {
  const linkCols = columns.slice(0, 3)
  const colTitle = 'mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-white'
  const linkClass =
    'text-[13px] font-normal italic text-white underline underline-offset-[3px] decoration-white/70 transition hover:decoration-white'
  const plainClass = 'text-[13px] font-normal italic leading-relaxed text-white/95'
  const addressLines = (registeredAddress || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)

  return (
    <footer
      className="mt-0 w-full min-w-0 border-0 text-white"
      style={{ backgroundColor: footerBg, fontFamily: bodyFont || 'Montserrat, sans-serif' }}
      data-silk-atelier-footer
    >
      <div className={builderSectionContainerClass('px-4 py-12 sm:px-8 sm:py-14 lg:py-16')}>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8 xl:gap-10">
          {linkCols.map((col) => (
            <div key={col.title} className="min-w-0">
              <h3 className={colTitle}>{col.title}</h3>
              {col.title.toLowerCase().includes('support') && supportExtras && supportExtras.length > 0 ? (
                <ul className="mb-3 space-y-1.5">
                  {supportExtras.map((line) => (
                    <li key={line.label}>
                      {line.href ? (
                        <a href={line.href} className={plainClass}>
                          {line.label}
                        </a>
                      ) : (
                        <span className={plainClass}>{line.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={`${l.href}-${l.label}`}>
                    <FooterLinkItem link={l} className={linkClass} LinkWrap={LinkWrap} />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="min-w-0 sm:col-span-2 lg:col-span-1 lg:max-w-none">
            <h3 className={colTitle}>Newsletter</h3>
            <p className={cn(plainClass, 'mb-4 max-w-sm')}>{newsletterBlurb?.trim() || DEFAULT_NEWSLETTER}</p>
            <form
              className="w-full max-w-[320px] space-y-3 xl:max-w-[360px]"
              onSubmit={(e) => e.preventDefault()}
            >
              <Input
                type="email"
                name="email"
                placeholder="Email"
                required
                className="h-11 w-full min-w-[12rem] rounded-md border-0 bg-white px-4 text-sm text-gray-900 shadow-none placeholder:text-[#5A0B3A]/50 focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label="Email for newsletter"
              />
              <button
                type="submit"
                className="h-11 w-full rounded-full border-2 border-white bg-transparent px-8 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto sm:min-w-[9.5rem]"
              >
                Subscribe
              </button>
            </form>
          </div>

          <div className="min-w-0 lg:col-span-1">
            <h3 className={colTitle}>Registered Address</h3>
            {addressLines.length > 0 ? (
              <address className={cn(plainClass, 'not-italic')}>
                {addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            ) : (
              <p className={plainClass}>Update registered address in footer block settings.</p>
            )}
          </div>
        </div>

        {(copyright || poweredByText) && (
          <div className="mt-10 flex flex-col items-center justify-center gap-2 border-t border-white/15 pt-6 text-center sm:flex-row sm:justify-between sm:text-left">
            {copyright ? <p className="text-[11px] italic text-white/60">{copyright}</p> : <span />}
            {poweredByText ? (
              poweredByHref ? (
                <a
                  href={poweredByHref}
                  {...(poweredByNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="text-[11px] italic text-white/50 no-underline hover:text-white/70"
                >
                  {formatKiterpBrandText(poweredByText)}
                </a>
              ) : (
                <p className="text-[11px] italic text-white/50">{formatKiterpBrandText(poweredByText)}</p>
              )
            ) : null}
          </div>
        )}
      </div>
    </footer>
  )
}
