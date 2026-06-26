import { DOCUMENT_LAYOUT_THUMBNAILS } from '@/lib/documentLayoutThumbnails'
import { INVOICE_TEMPLATE_LABELS } from '@/lib/invoiceTemplates'
import type { DocumentLayoutThumbnail } from '@/lib/documentLayoutThumbnails'

const OFFER_ONLY: DocumentLayoutThumbnail[] = [
  {
    id: 'official_gulf',
    name: 'Official Gulf Letter',
    desc: 'Corporate UAE-style offer with ref bar and signatures',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <circle cx="22" cy="22" r="14" fill="none" stroke="${color}" stroke-width="2"/>
      <rect x="40" y="12" width="50" height="5" fill="${color}" rx="1"/>
      <rect x="40" y="20" width="36" height="3" fill="#16a34a" rx="1"/>
      <rect x="0" y="36" width="120" height="8" fill="#f3f4f6"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${48+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="6" y="108" width="50" height="1" fill="#374151"/>
      <rect x="64" y="108" width="50" height="1" fill="#374151"/>
    </svg>`,
  },
  {
    id: 'employment_formal',
    name: 'Employment Formal',
    desc: 'Centered title with terms summary and dual signatures',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="6" y="8" width="20" height="16" fill="#e2e8f0" rx="2"/>
      <rect x="8" y="11" width="16" height="10" fill="${color}" opacity=".55" rx="1"/>
      <rect x="28" y="28" width="64" height="5" fill="#374151" rx="1"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${40+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="6" y="100" width="44" height="1" fill="#374151"/>
      <rect x="70" y="100" width="44" height="1" fill="#374151"/>
    </svg>`,
  },
  {
    id: 'branded_bands',
    name: 'Branded Bands',
    desc: 'Colour band header and footer',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect y="0" width="120" height="8" fill="linear-gradient" style="fill:${color}"/>
      <rect x="6" y="14" width="18" height="14" fill="#e2e8f0" rx="2"/>
      <rect x="28" y="16" width="40" height="4" fill="#0f766e" rx="1"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${36+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect y="152" width="120" height="8" fill="${color}"/>
    </svg>`,
  },
  {
    id: 'classic_formal',
    name: 'Classic Formal',
    desc: 'Centered logo and simple formal letter',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="44" y="10" width="32" height="18" fill="#e2e8f0" rx="2"/>
      <rect x="48" y="14" width="24" height="10" fill="${color}" opacity=".45" rx="1"/>
      <rect x="36" y="34" width="48" height="5" fill="#374151" rx="1"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${46+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
    </svg>`,
  },
  {
    id: 'toprightbottomleft',
    name: 'Top Right · Bottom Left',
    desc: 'Logo top-right, accent bottom-left',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="82" y="6" width="32" height="22" fill="#e2e8f0" rx="2"/>
      <rect x="6" y="10" width="46" height="5" fill="#374151" rx="1"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${38+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="8" y="126" width="28" height="18" fill="#e2e8f0" rx="2"/>
      <rect x="12" y="130" width="20" height="10" fill="${color}" opacity=".65" rx="1"/>
    </svg>`,
  },
  {
    id: 'topleftbottomright',
    name: 'Top Left · Bottom Right',
    desc: 'Logo top-left, accent bottom-right',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="6" y="6" width="32" height="22" fill="#e2e8f0" rx="2"/>
      <rect x="44" y="10" width="46" height="5" fill="#374151" rx="1"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${38+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="84" y="126" width="28" height="18" fill="#e2e8f0" rx="2"/>
      <rect x="88" y="130" width="20" height="10" fill="${color}" opacity=".65" rx="1"/>
    </svg>`,
  },
]

const EXISTING = new Set(DOCUMENT_LAYOUT_THUMBNAILS.map(t => t.id))

export const OFFER_LAYOUT_THUMBNAILS: DocumentLayoutThumbnail[] = [
  ...DOCUMENT_LAYOUT_THUMBNAILS,
  ...OFFER_ONLY.filter(t => !EXISTING.has(t.id)),
]

export function layoutThumbnailLabel(id: string): string {
  const t = OFFER_LAYOUT_THUMBNAILS.find(x => x.id === id)
  if (t) return t.name
  return INVOICE_TEMPLATE_LABELS[id as keyof typeof INVOICE_TEMPLATE_LABELS] ?? id.replace(/_/g, ' ')
}
