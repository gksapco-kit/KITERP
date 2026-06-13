import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AppliedTemplateViewLiveLink } from '@/lib/liveStorefrontUrl'

export const templateCardIconActionClass =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-800'

type Props = {
  links: AppliedTemplateViewLiveLink[]
  className?: string
}

export function AppliedTemplateViewLiveButton({ links, className }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!links.length) return null

  if (links.length === 1) {
    return (
      <a
        href={links[0].href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(templateCardIconActionClass, className)}
        title="View live BU / Store"
        aria-label="View live BU / Store"
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
      </a>
    )
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={templateCardIconActionClass}
        title="View live BU / Store"
        aria-label="View live BU / Store"
        aria-expanded={open}
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
      </button>
      {open ? (
        <div className="absolute right-0 bottom-full z-20 mb-1 min-w-[10rem] max-w-[14rem] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <p className="border-b border-gray-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
            View live
          </p>
          {links.map(link => (
            <a
              key={`${link.href}-${link.label}`}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              title={link.label}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}
