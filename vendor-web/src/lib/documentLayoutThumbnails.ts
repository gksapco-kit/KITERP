import type { InvoiceTemplateId } from '@/lib/invoiceTemplates'
import { INVOICE_TEMPLATE_LABELS } from '@/lib/invoiceTemplates'

export type DocumentLayoutThumbnail = {
  id: string
  name: string
  desc: string
  svg: (color: string) => string
}

const TEMPLATES: DocumentLayoutThumbnail[] = [
  {
    id: 'classic',
    name: 'Classic',
    desc: 'Traditional GST invoice with coloured table header',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect y="0" width="120" height="28" fill="${color}"/>
      <rect x="6" y="5" width="30" height="18" fill="rgba(255,255,255,.25)" rx="2"/>
      <rect x="42" y="8" width="50" height="6" fill="rgba(255,255,255,.8)" rx="1"/>
      <rect x="42" y="16" width="34" height="4" fill="rgba(255,255,255,.5)" rx="1"/>
      <rect x="6" y="34" width="50" height="18" fill="#f8fafc" rx="2"/>
      <rect x="64" y="34" width="50" height="18" fill="#f8fafc" rx="2"/>
      <rect y="58" width="120" height="8" fill="${color}"/>
      ${[0,1,2,3].map(i=>`<rect x="0" y="${66+i*14}" width="120" height="13" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="80" y="126" width="34" height="26" fill="#f8fafc" rx="2"/>
      <rect x="6" y="148" width="60" height="6" fill="#e5e7eb" rx="1"/>
    </svg>`,
  },
  {
    id: 'modern',
    name: 'Modern',
    desc: 'Gradient header with clean layout and colour accents',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect y="0" width="120" height="36" fill="url(#mg)"/>
      <defs><linearGradient id="mg" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${color}cc"/></linearGradient></defs>
      <rect x="6" y="7" width="22" height="22" fill="rgba(255,255,255,.2)" rx="3"/>
      <rect x="34" y="10" width="40" height="6" fill="rgba(255,255,255,.85)" rx="1"/>
      <rect x="34" y="18" width="28" height="4" fill="rgba(255,255,255,.5)" rx="1"/>
      <rect x="84" y="8" width="30" height="8" fill="rgba(255,255,255,.15)" rx="1"/>
      <rect x="84" y="18" width="24" height="4" fill="rgba(255,255,255,.3)" rx="1"/>
      <rect x="6" y="42" width="108" height="12" fill="#f1f5f9" rx="3"/>
      <rect x="6" y="58" width="114" height="7" fill="none" stroke="${color}" stroke-width="1.5"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${65+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="74" y="116" width="40" height="30" fill="#f8fafc" rx="3"/>
      <rect x="6" y="150" width="50" height="5" fill="#e5e7eb" rx="1"/>
    </svg>`,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    desc: 'Clean white layout with subtle borders',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="6" y="8" width="24" height="10" fill="#e5e7eb" rx="1"/>
      <rect x="6" y="20" width="40" height="5" fill="#374151" rx="1"/>
      <rect x="6" y="27" width="28" height="3" fill="#9ca3af" rx="1"/>
      <rect x="80" y="8" width="34" height="10" fill="${color}" opacity=".2" rx="2"/>
      <rect x="82" y="12" width="20" height="4" fill="${color}" rx="1"/>
      <rect x="6" y="38" width="114" height="1" fill="#e5e7eb"/>
      <rect x="6" y="42" width="114" height="1" fill="#e5e7eb"/>
      ${['#9ca3af','#9ca3af','#9ca3af','#9ca3af','#9ca3af','#9ca3af'].map((c,i)=>`<rect x="${6+i*19}" y="44" width="14" height="3" fill="${c}" rx="1"/>`).join('')}
      <rect x="6" y="49" width="114" height="1" fill="#e5e7eb"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${50+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="6" y="100" width="114" height="1" fill="#e5e7eb"/>
      <rect x="80" y="106" width="34" height="30" fill="#f8fafc" rx="2"/>
      <rect x="6" y="148" width="50" height="5" fill="#f3f4f6" rx="1"/>
    </svg>`,
  },
  {
    id: 'luxury',
    name: 'Luxury',
    desc: 'Dark header with premium accent stripe',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect y="0" width="120" height="36" fill="#1f2937"/>
      <rect y="36" width="120" height="3" fill="${color}"/>
      <rect x="6" y="7" width="22" height="22" fill="rgba(255,255,255,.1)" rx="3"/>
      <rect x="34" y="10" width="40" height="6" fill="rgba(255,255,255,.8)" rx="1"/>
      <rect x="34" y="18" width="28" height="4" fill="rgba(255,255,255,.4)" rx="1"/>
      <rect x="88" y="8" width="26" height="4" fill="${color}" opacity=".5" rx="1"/>
      <rect x="88" y="14" width="20" height="5" fill="rgba(255,255,255,.7)" rx="1"/>
      <rect x="6" y="44" width="108" height="20" fill="#f8fafc" rx="3"/>
      <rect x="10" y="47" width="30" height="4" fill="#9ca3af" rx="1"/>
      <rect x="10" y="53" width="22" height="5" fill="#374151" rx="1"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${70+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="74" y="120" width="40" height="28" fill="#1f2937" rx="3"/>
      <rect x="78" y="126" width="20" height="4" fill="${color}" rx="1"/>
      <rect x="78" y="132" width="30" height="4" fill="rgba(255,255,255,.4)" rx="1"/>
      <rect x="6" y="152" width="50" height="4" fill="#e5e7eb" rx="1"/>
    </svg>`,
  },
  {
    id: 'corporate',
    name: 'Corporate',
    desc: 'Formal letterhead style with left accent border',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="0" y="0" width="4" height="160" fill="${color}"/>
      <rect x="8" y="10" width="60" height="16" fill="#f1f5f9" rx="2"/>
      <rect x="10" y="13" width="20" height="10" fill="#e2e8f0" rx="1"/>
      <rect x="32" y="14" width="30" height="4" fill="#374151" rx="1"/>
      <rect x="32" y="20" width="22" height="3" fill="#9ca3af" rx="1"/>
      <rect x="76" y="8" width="3" height="22" fill="${color}"/>
      <rect x="82" y="10" width="32" height="4" fill="${color}" opacity=".4" rx="1"/>
      <rect x="82" y="16" width="24" height="5" fill="#374151" rx="1"/>
      <rect x="82" y="23" width="20" height="3" fill="#9ca3af" rx="1"/>
      <rect x="8" y="34" width="106" height="1" fill="#e5e7eb"/>
      <rect x="8" y="38" width="106" height="12" fill="#f8fafc" rx="2"/>
      <rect x="10" y="41" width="16" height="3" fill="${color}" opacity=".5" rx="1"/>
      <rect x="28" y="41" width="30" height="3" fill="#374151" rx="1"/>
      <rect x="8" y="55" width="106" height="1" fill="${color}"/>
      <rect x="8" y="55" width="106" height="1" fill="${color}" opacity=".3"/>
      ${[0,1,2,3].map(i=>`<rect x="8" y="${57+i*13}" width="106" height="12" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="75" y="113" width="38" height="30" fill="#f8fafc" rx="2"/>
      <rect x="8" y="150" width="50" height="5" fill="#f3f4f6" rx="1"/>
    </svg>`,
  },
  {
    id: 'colorblock',
    name: 'Colorblock',
    desc: 'Colored sidebar with all key details at a glance',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="0" y="0" width="34" height="160" fill="${color}" rx="2"/>
      <rect x="4" y="10" width="26" height="16" fill="rgba(255,255,255,.15)" rx="2"/>
      <rect x="4" y="30" width="20" height="4" fill="rgba(255,255,255,.8)" rx="1"/>
      <rect x="4" y="36" width="14" height="3" fill="rgba(255,255,255,.4)" rx="1"/>
      <rect x="4" y="48" width="10" height="3" fill="rgba(255,255,255,.4)" rx="1"/>
      <rect x="4" y="53" width="22" height="4" fill="rgba(255,255,255,.7)" rx="1"/>
      <rect x="4" y="65" width="10" height="3" fill="rgba(255,255,255,.4)" rx="1"/>
      <rect x="4" y="70" width="18" height="3" fill="rgba(255,255,255,.6)" rx="1"/>
      <rect x="4" y="82" width="10" height="3" fill="rgba(255,255,255,.4)" rx="1"/>
      <rect x="4" y="87" width="24" height="6" fill="rgba(255,255,255,.9)" rx="1"/>
      <rect x="38" y="10" width="14" height="3" fill="${color}" opacity=".5" rx="1"/>
      <rect x="38" y="15" width="30" height="5" fill="#374151" rx="1"/>
      <rect x="38" y="22" width="20" height="3" fill="#9ca3af" rx="1"/>
      <rect x="38" y="32" width="74" height="1" fill="${color}" opacity=".4"/>
      ${[0,1,2,3].map(i=>`<rect x="38" y="${34+i*12}" width="74" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="76" y="84" width="36" height="28" fill="#f8fafc" rx="2"/>
      <rect x="38" y="148" width="40" height="4" fill="#f3f4f6" rx="1"/>
    </svg>`,
  },
  {
    id: 'compact',
    name: 'Compact',
    desc: 'Dense layout â€” fits more items, great for long invoices',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="4" y="6" width="60" height="14" fill="#fff"/>
      <rect x="4" y="7" width="14" height="12" fill="#e2e8f0" rx="1"/>
      <rect x="20" y="8" width="30" height="4" fill="#374151" rx="1"/>
      <rect x="20" y="14" width="22" height="3" fill="#9ca3af" rx="1"/>
      <rect x="76" y="7" width="36" height="5" fill="${color}" opacity=".25" rx="1"/>
      <rect x="76" y="14" width="28" height="4" fill="${color}" rx="1" opacity=".7"/>
      <rect x="4" y="22" width="112" height="2" fill="${color}"/>
      <rect x="4" y="26" width="112" height="8" fill="#f8fafc" rx="1"/>
      <rect x="6" y="28" width="40" height="3" fill="#374151" rx="1"/>
      <rect x="4" y="36" width="112" height="2" fill="${color}"/>
      ${[0,1,2,3,4,5,6].map(i=>`<rect x="4" y="${39+i*10}" width="112" height="9" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="76" y="111" width="38" height="24" fill="#f8fafc" rx="2"/>
      <rect x="4" y="148" width="44" height="5" fill="#f3f4f6" rx="1"/>
    </svg>`,
  },
  {
    id: 'bold',
    name: 'Bold',
    desc: 'High-impact header with prominent total display',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect y="0" width="120" height="32" fill="${color}"/>
      <rect x="6" y="7" width="18" height="18" fill="rgba(255,255,255,.2)" rx="2"/>
      <rect x="28" y="9" width="38" height="6" fill="rgba(255,255,255,.9)" rx="1"/>
      <rect x="28" y="17" width="26" height="4" fill="rgba(255,255,255,.5)" rx="1"/>
      <rect x="82" y="6" width="34" height="20" fill="rgba(0,0,0,.2)" rx="2"/>
      <rect x="84" y="9" width="18" height="3" fill="rgba(255,255,255,.5)" rx="1"/>
      <rect x="84" y="14" width="28" height="5" fill="rgba(255,255,255,.85)" rx="1"/>
      <rect y="32" width="120" height="22" fill="#1f2937"/>
      <rect x="6" y="37" width="30" height="4" fill="#9ca3af" rx="1"/>
      <rect x="6" y="43" width="44" height="5" fill="#fff" rx="1"/>
      <rect x="78" y="34" width="38" height="16" fill="${color}" opacity=".2" rx="2"/>
      <rect x="82" y="37" width="22" height="4" fill="${color}" rx="1" opacity=".8"/>
      <rect x="80" y="43" width="34" height="6" fill="${color}" rx="1"/>
      <rect x="8" y="60" width="104" height="7" fill="none" stroke="${color}" stroke-width="1.5"/>
      ${[0,1,2,3].map(i=>`<rect x="8" y="${67+i*12}" width="104" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="76" y="118" width="36" height="26" fill="#f8fafc" rx="2"/>
      <rect x="8" y="150" width="44" height="4" fill="#f3f4f6" rx="1"/>
    </svg>`,
  },
  {
    id: 'visual',
    name: 'Visual',
    desc: 'Product-image showcase â€” shows a photo with every line item',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <!-- Header -->
      <rect x="4" y="6" width="14" height="12" fill="#e2e8f0" rx="1"/>
      <rect x="21" y="7" width="32" height="5" fill="#1e293b" rx="1"/>
      <rect x="21" y="14" width="22" height="3" fill="#94a3b8" rx="1"/>
      <rect x="80" y="4" width="36" height="18" fill="${color}" rx="4"/>
      <rect x="84" y="7" width="18" height="3" fill="rgba(255,255,255,.55)" rx="1"/>
      <rect x="84" y="12" width="26" height="4" fill="rgba(255,255,255,.95)" rx="1"/>
      <rect x="84" y="18" width="16" height="2.5" fill="rgba(255,255,255,.45)" rx="1"/>
      <rect x="4" y="26" width="112" height="1" fill="#f1f5f9"/>
      <!-- Bill-to + total strip -->
      <rect x="4" y="29" width="68" height="18" fill="#fff"/>
      <rect x="6" y="30" width="16" height="2.5" fill="#94a3b8" rx="1"/>
      <rect x="6" y="34" width="40" height="4" fill="#1e293b" rx="1"/>
      <rect x="6" y="40" width="28" height="2.5" fill="#94a3b8" rx="1"/>
      <rect x="76" y="29" width="40" height="18" fill="#fff"/>
      <rect x="78" y="30" width="22" height="2.5" fill="#94a3b8" rx="1"/>
      <rect x="78" y="35" width="36" height="8" fill="${color}" opacity=".2" rx="2"/>
      <rect x="80" y="37" width="28" height="4" fill="${color}" rx="1"/>
      <rect x="4" y="47" width="112" height="1" fill="#f1f5f9"/>
      <!-- Product item rows with thumbnails -->
      ${[0,1,2,3].map(i=>`
        <rect x="6" y="${50+i*24}" width="16" height="16" fill="${i%2===0?color+'30':'#f1f5f9'}" rx="2"/>
        <rect x="${i%2===0?9:9}" y="${54+i*24}" width="${i%2===0?10:10}" height="${i%2===0?8:8}" fill="${i%2===0?color+'80':'#e2e8f0'}" rx="1"/>
        <rect x="26" y="${51+i*24}" width="34" height="4" fill="#374151" rx="1"/>
        <rect x="26" y="${57+i*24}" width="22" height="2.5" fill="#94a3b8" rx="1"/>
        <rect x="26" y="${61+i*24}" width="14" height="2.5" fill="${color}" opacity=".35" rx="8"/>
        <rect x="88" y="${53+i*24}" width="24" height="5" fill="${color}" opacity="${i===0?'.9':'.5'}" rx="1"/>
        <rect x="4" y="${67+i*24}" width="112" height="1" fill="#f1f5f9"/>
      `).join('')}
      <!-- Totals pill -->
      <rect x="70" y="148" width="46" height="10" fill="${color}" rx="2"/>
      <rect x="74" y="151" width="12" height="3" fill="rgba(255,255,255,.7)" rx="1"/>
      <rect x="96" y="150" width="16" height="5" fill="rgba(255,255,255,.9)" rx="1"/>
    </svg>`,
  },
  {
    id: 'toprightlogobottomleft',
    name: 'Top Right Logo Â· Bottom Left Logo',
    desc: 'Top: logo right in header. Bottom: logo left below signature (dashed line)',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="6" y="10" width="46" height="5" fill="#374151" rx="1"/>
      <rect x="6" y="18" width="34" height="3" fill="#9ca3af" rx="1"/>
      <rect x="6" y="24" width="24" height="3" fill="#9ca3af" rx="1"/>
      <rect x="82" y="6" width="32" height="22" fill="#e2e8f0" rx="2"/>
      <rect x="86" y="10" width="24" height="14" fill="${color}" opacity=".65" rx="1"/>
      <rect x="6" y="32" width="108" height="2" fill="${color}"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${38+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="72" y="100" width="36" height="14" fill="#f8fafc" stroke="#e5e7eb" rx="1"/>
      <rect x="78" y="104" width="24" height="6" fill="#e5e7eb" rx="1"/>
      <line x1="6" y1="118" x2="114" y2="118" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4 3"/>
      <rect x="8" y="126" width="28" height="18" fill="#e2e8f0" rx="2"/>
      <rect x="12" y="130" width="20" height="10" fill="${color}" opacity=".65" rx="1"/>
    </svg>`,
  },
  {
    id: 'topleftlogobottomright',
    name: 'Top Left Logo Â· Bottom Right Logo',
    desc: 'Top: logo left in header. Bottom: logo right below signature (dashed line)',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="6" y="6" width="32" height="22" fill="#e2e8f0" rx="2"/>
      <rect x="10" y="10" width="24" height="14" fill="${color}" opacity=".65" rx="1"/>
      <rect x="44" y="10" width="46" height="5" fill="#374151" rx="1"/>
      <rect x="44" y="18" width="34" height="3" fill="#9ca3af" rx="1"/>
      <rect x="44" y="24" width="24" height="3" fill="#9ca3af" rx="1"/>
      <rect x="6" y="32" width="108" height="2" fill="${color}"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${38+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="12" y="100" width="36" height="14" fill="#f8fafc" stroke="#e5e7eb" rx="1"/>
      <rect x="18" y="104" width="24" height="6" fill="#e5e7eb" rx="1"/>
      <line x1="6" y1="118" x2="114" y2="118" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4 3"/>
      <rect x="84" y="126" width="28" height="18" fill="#e2e8f0" rx="2"/>
      <rect x="88" y="130" width="20" height="10" fill="${color}" opacity=".65" rx="1"/>
    </svg>`,
  },
  {
    id: 'centered',
    name: 'Centered',
    desc: 'Logo and company name centered â€” clean and professional',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="44" y="8" width="32" height="20" fill="#e2e8f0" rx="2"/>
      <rect x="48" y="12" width="24" height="12" fill="${color}" opacity=".4" rx="1"/>
      <rect x="30" y="32" width="60" height="5" fill="#374151" rx="1"/>
      <rect x="38" y="40" width="44" height="3" fill="#9ca3af" rx="1"/>
      <rect x="32" y="48" width="56" height="5" fill="${color}" opacity=".25" rx="1"/>
      <rect x="6" y="58" width="108" height="1" fill="${color}"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${62+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="76" y="114" width="38" height="26" fill="#f8fafc" rx="2"/>
    </svg>`,
  },
  {
    id: 'letterhead',
    name: 'Letterhead',
    desc: 'Formal letterhead with logo left and mark on right',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="6" y="10" width="18" height="14" fill="#e2e8f0" rx="1"/>
      <rect x="28" y="12" width="44" height="4" fill="#374151" rx="1"/>
      <rect x="28" y="18" width="30" height="3" fill="#9ca3af" rx="1"/>
      <rect x="92" y="10" width="20" height="12" fill="${color}" opacity=".2" rx="1"/>
      <rect x="6" y="30" width="108" height="1" fill="#111"/>
      <rect x="6" y="36" width="50" height="3" fill="#9ca3af" rx="1"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${44+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="76" y="96" width="38" height="28" fill="#f8fafc" rx="2"/>
    </svg>`,
  },
  {
    id: 'banner',
    name: 'Banner',
    desc: 'Full-width colour banner with logo on the left only',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect y="0" width="120" height="30" fill="${color}"/>
      <rect x="6" y="6" width="20" height="18" fill="rgba(255,255,255,.25)" rx="2"/>
      <rect x="44" y="10" width="32" height="5" fill="rgba(255,255,255,.9)" rx="1"/>
      <rect x="88" y="10" width="24" height="5" fill="rgba(255,255,255,.5)" rx="1"/>
      <rect x="6" y="34" width="108" height="8" fill="#f8fafc" rx="1"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${46+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="76" y="98" width="38" height="28" fill="#f8fafc" rx="2"/>
    </svg>`,
  },
  {
    id: 'executive',
    name: 'Executive',
    desc: 'Large right logo with subtle watermark background',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="6" y="10" width="28" height="4" fill="${color}" rx="1"/>
      <rect x="6" y="18" width="48" height="6" fill="#374151" rx="1"/>
      <rect x="6" y="28" width="32" height="3" fill="#9ca3af" rx="1"/>
      <rect x="70" y="6" width="44" height="36" fill="${color}" opacity=".08" rx="4"/>
      <rect x="78" y="10" width="32" height="28" fill="#e2e8f0" rx="2"/>
      <rect x="82" y="14" width="24" height="20" fill="${color}" opacity=".5" rx="1"/>
      <rect x="6" y="48" width="80" height="2" fill="${color}" opacity=".4"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${54+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="76" y="106" width="38" height="28" fill="#f8fafc" rx="2"/>
    </svg>`,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    desc: 'Tri-colour stripe header with logo on the left only',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect y="0" width="40" height="5" fill="${color}"/>
      <rect x="40" y="0" width="40" height="5" fill="#1f2937"/>
      <rect x="80" y="0" width="40" height="5" fill="${color}"/>
      <rect x="4" y="10" width="18" height="16" fill="#e2e8f0" rx="1"/>
      <rect x="46" y="12" width="28" height="5" fill="#374151" rx="1"/>
      <rect x="46" y="20" width="20" height="4" fill="${color}" rx="1"/>
      <rect x="94" y="12" width="20" height="4" fill="#9ca3af" rx="1"/>
      <rect x="6" y="32" width="108" height="1" fill="#e5e7eb"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${36+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="76" y="88" width="38" height="28" fill="#f8fafc" rx="2"/>
    </svg>`,
  },
  {
    id: 'gstpro',
    name: 'GST Pro',
    desc: 'Indian GST format â€” logo left in bordered box',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="6" y="8" width="28" height="24" fill="#f8fafc" stroke="#e5e7eb" rx="2"/>
      <rect x="10" y="12" width="20" height="16" fill="${color}" opacity=".35" rx="1"/>
      <rect x="38" y="12" width="44" height="5" fill="#374151" rx="1"/>
      <rect x="38" y="20" width="30" height="3" fill="#9ca3af" rx="1"/>
      <rect x="88" y="10" width="26" height="12" fill="${color}" rx="2"/>
      <rect x="6" y="38" width="54" height="22" fill="#f8fafc" stroke="#e5e7eb" rx="2"/>
      <rect x="64" y="38" width="50" height="22" fill="#f8fafc" stroke="#e5e7eb" rx="2"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${64+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="76" y="116" width="38" height="28" fill="#f8fafc" rx="2"/>
    </svg>`,
  },
  {
    id: 'retail',
    name: 'Retail',
    desc: 'Store style â€” logo left, bold total header',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect y="0" width="120" height="24" fill="#111"/>
      <rect x="6" y="5" width="18" height="14" fill="#fff" opacity=".3" rx="1"/>
      <rect x="28" y="7" width="36" height="4" fill="#fff" opacity=".8" rx="1"/>
      <rect x="88" y="6" width="26" height="12" fill="${color}" rx="2"/>
      <rect y="24" width="120" height="8" fill="${color}" opacity=".2"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${36+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="76" y="88" width="38" height="28" fill="#f8fafc" rx="2"/>
    </svg>`,
  },
  {
    id: 'sideright',
    name: 'Side Right',
    desc: 'Coloured sidebar on right with logo',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="90" y="0" width="30" height="160" fill="${color}" rx="2"/>
      <rect x="94" y="10" width="22" height="18" fill="rgba(255,255,255,.2)" rx="2"/>
      <rect x="8" y="12" width="40" height="5" fill="${color}" rx="1"/>
      <rect x="8" y="20" width="28" height="3" fill="#9ca3af" rx="1"/>
      ${[0,1,2,3].map(i=>`<rect x="8" y="${30+i*12}" width="78" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="58" y="82" width="28" height="24" fill="#f8fafc" rx="2"/>
    </svg>`,
  },
  {
    id: 'framed',
    name: 'Framed',
    desc: 'Double border frame â€” logo on the right',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="112" height="152" fill="#fff" stroke="${color}" stroke-width="2"/>
      <rect x="6" y="10" width="40" height="5" fill="#374151" rx="1"/>
      <rect x="6" y="18" width="28" height="3" fill="#9ca3af" rx="1"/>
      <rect x="86" y="8" width="26" height="22" fill="#e2e8f0" rx="2"/>
      <rect x="90" y="12" width="18" height="14" fill="${color}" opacity=".4" rx="1"/>
      ${[0,1,2,3].map(i=>`<rect x="8" y="${36+i*12}" width="104" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="72" y="90" width="40" height="28" fill="#f8fafc" rx="2"/>
    </svg>`,
  },
  {
    id: 'slimleft',
    name: 'Slim Left',
    desc: 'Narrow left column with logo and company info',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="0" y="0" width="34" height="160" fill="#f8fafc"/>
      <rect x="4" y="10" width="26" height="20" fill="#e2e8f0" rx="2"/>
      <rect x="7" y="14" width="20" height="12" fill="${color}" opacity=".4" rx="1"/>
      <rect x="4" y="34" width="26" height="3" fill="#374151" rx="1"/>
      <rect x="38" y="10" width="30" height="5" fill="${color}" rx="1"/>
      <rect x="38" y="18" width="40" height="3" fill="#9ca3af" rx="1"/>
      ${[0,1,2,3].map(i=>`<rect x="38" y="${28+i*12}" width="76" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="76" y="80" width="38" height="28" fill="#f8fafc" rx="2"/>
    </svg>`,
  },
  {
    id: 'premiumright',
    name: 'Premium Right',
    desc: 'Logo right with summary feature cards',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="6" y="10" width="44" height="5" fill="#374151" rx="1"/>
      <rect x="6" y="18" width="30" height="3" fill="#9ca3af" rx="1"/>
      <rect x="82" y="8" width="32" height="26" fill="#f8fafc" stroke="#e5e7eb" rx="2"/>
      <rect x="86" y="12" width="24" height="18" fill="${color}" opacity=".45" rx="1"/>
      ${[0,1,2,3].map(i=>`<rect x="${6+i*28}" y="32" width="24" height="14" fill="#f8fafc" stroke="#e5e7eb" rx="2"/>`).join('')}
      ${[0,1,2,3].map(i=>`<rect x="6" y="${52+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="76" y="104" width="38" height="28" fill="#f8fafc" rx="2"/>
    </svg>`,
  },
  {
    id: 'leftlogo',
    name: 'Left Logo',
    desc: 'Logo on the left â€” company details beside it',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="0" y="0" width="120" height="34" fill="#f8fafc"/>
      <rect x="8" y="8" width="28" height="18" fill="#e2e8f0" rx="2"/>
      <rect x="11" y="11" width="22" height="12" fill="${color}" opacity=".55" rx="1"/>
      <rect x="42" y="10" width="48" height="5" fill="#374151" rx="1"/>
      <rect x="42" y="18" width="34" height="3" fill="#9ca3af" rx="1"/>
      <rect x="6" y="38" width="108" height="1" fill="#e5e7eb"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${44+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="76" y="96" width="38" height="28" fill="#f8fafc" rx="2"/>
    </svg>`,
  },
  {
    id: 'rightlogo',
    name: 'Right Logo',
    desc: 'Logo on the right â€” company details on the left',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="0" y="0" width="120" height="34" fill="#f8fafc"/>
      <rect x="8" y="10" width="48" height="5" fill="#374151" rx="1"/>
      <rect x="8" y="18" width="36" height="3" fill="#9ca3af" rx="1"/>
      <rect x="84" y="8" width="28" height="18" fill="#e2e8f0" rx="2"/>
      <rect x="87" y="11" width="22" height="12" fill="${color}" opacity=".55" rx="1"/>
      <rect x="6" y="38" width="108" height="1" fill="#e5e7eb"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${44+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="76" y="96" width="38" height="28" fill="#f8fafc" rx="2"/>
    </svg>`,
  },
  {
    id: 'footerleft',
    name: 'Footer Left',
    desc: 'Logo in the footer on the left â€” clean header',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="8" y="10" width="56" height="5" fill="#374151" rx="1"/>
      <rect x="8" y="18" width="40" height="3" fill="#9ca3af" rx="1"/>
      <rect x="6" y="28" width="108" height="2" fill="${color}"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${34+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="0" y="118" width="120" height="42" fill="#f8fafc"/>
      <rect x="8" y="128" width="24" height="16" fill="#e2e8f0" rx="2"/>
      <rect x="11" y="131" width="18" height="10" fill="${color}" opacity=".55" rx="1"/>
      <rect x="38" y="132" width="40" height="3" fill="#9ca3af" rx="1"/>
      <rect x="88" y="130" width="24" height="12" fill="#e5e7eb" rx="1"/>
    </svg>`,
  },
  {
    id: 'footerright',
    name: 'Footer Right',
    desc: 'Logo in the footer on the right â€” clean header',
    svg: (color: string) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="3"/>
      <rect x="8" y="10" width="56" height="5" fill="#374151" rx="1"/>
      <rect x="8" y="18" width="40" height="3" fill="#9ca3af" rx="1"/>
      <rect x="6" y="28" width="108" height="2" fill="${color}"/>
      ${[0,1,2,3].map(i=>`<rect x="6" y="${34+i*12}" width="108" height="11" fill="${i%2===0?'#fff':'#f9fafb'}"/>`).join('')}
      <rect x="0" y="118" width="120" height="42" fill="#f8fafc"/>
      <rect x="8" y="132" width="40" height="3" fill="#9ca3af" rx="1"/>
      <rect x="88" y="128" width="24" height="16" fill="#e2e8f0" rx="2"/>
      <rect x="91" y="131" width="18" height="10" fill="${color}" opacity=".55" rx="1"/>
      <rect x="52" y="130" width="24" height="12" fill="#e5e7eb" rx="1"/>
    </svg>`,
  },
]

export const DOCUMENT_LAYOUT_THUMBNAILS: DocumentLayoutThumbnail[] = TEMPLATES

export function layoutThumbnailFor(id: string, color = '#1a56db'): string {
  const t = DOCUMENT_LAYOUT_THUMBNAILS.find(x => x.id === id)
  return t ? t.svg(color) : `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="160" fill="#fff" rx="3"/><rect x="6" y="8" width="24" height="16" fill="${color}" opacity=".4" rx="2"/></svg>`
}

export function layoutThumbnailLabel(id: string): string {
  return DOCUMENT_LAYOUT_THUMBNAILS.find(t => t.id === id)?.name ?? INVOICE_TEMPLATE_LABELS[id as InvoiceTemplateId] ?? id
}
