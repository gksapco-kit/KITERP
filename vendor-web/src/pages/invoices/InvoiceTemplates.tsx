import { useState, useRef, useCallback, useEffect } from 'react'
import { SectionLabel } from '@/components/common/FieldLabel'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useInvoiceSettings, useUpdateInvoiceSettings, useUploadInvoiceSignature,
  useQuotationSettings, useUpdateQuotationSettings, useUploadQuotationSignature,
} from '@/hooks/useVendor'
import { useQuery } from '@tanstack/react-query'
import { vendorApi } from '@/api/vendor'
import { toast } from 'sonner'
import {
  ArrowLeft, Loader2, Upload, X, Check, RefreshCw,
  ChevronDown, ChevronUp, Building2, Pen, Eye, Eraser, RotateCcw,
  ShoppingCart, GripVertical, EyeOff, Type, Palette,
  FileOutput, ToggleLeft, QrCode,
} from 'lucide-react'
import { InvoiceAccentColorPicker } from '@/components/invoices/InvoiceAccentColorPicker'
import {
  generateInvoiceHtml, DEFAULT_INVOICE_SETTINGS, DEFAULT_QUOTATION_SETTINGS, PAPER_SIZES,
  loadPosInvoiceSettings, savePosInvoiceSettings, DEFAULT_LAYOUT_SECTIONS, resolveInvoiceTemplateLogoPath,
  LOGO_SHAPES, URL_POSITION_OPTIONS,
  INVOICE_TEMPLATE_LABELS,
} from '@/lib/invoiceTemplates'
import type { InvoiceSettings, PaperSize, LayoutSection, LogoShape, InvoiceTemplateId } from '@/lib/invoiceTemplates'
import { buildCustomerStoreLink } from '@/lib/liveStorefrontUrl'
import type { Vendor } from '@/types'
import { ImageSourcePicker } from '@/components/common/ImageSourcePicker'
import { SingleImagePreview } from '@/components/common/CatalogMediaLightbox'

function resolveOriginPath(url: string) {
  if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) return url
  return `${window.location.origin}${url}`
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = ev => resolve(ev.target?.result as string)
    reader.onerror = () => reject(new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

// ── Template visual thumbnails ────────────────────────────────────────────────

const TEMPLATES = [
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
    desc: 'Dense layout — fits more items, great for long invoices',
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
    desc: 'Product-image showcase — shows a photo with every line item',
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
    name: 'Top Right Logo · Bottom Left Logo',
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
    name: 'Top Left Logo · Bottom Right Logo',
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
    desc: 'Logo and company name centered — clean and professional',
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
    desc: 'Indian GST format — logo left in bordered box',
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
    desc: 'Store style — logo left, bold total header',
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
    desc: 'Double border frame — logo on the right',
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
    desc: 'Logo on the left — company details beside it',
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
    desc: 'Logo on the right — company details on the left',
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
    desc: 'Logo in the footer on the left — clean header',
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
    desc: 'Logo in the footer on the right — clean header',
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

function templateLabelFor(id: InvoiceTemplateId | undefined): string {
  if (!id) return 'Classic'
  return TEMPLATES.find(t => t.id === id)?.name ?? INVOICE_TEMPLATE_LABELS[id] ?? id
}

function resolveVendorWebsiteFallback(vendor?: Vendor | null): string {
  if (!vendor) return 'www.example.com'
  if (vendor.external_domain_enabled && vendor.external_domain_access_status === 'active' && vendor.external_domain_name) {
    return vendor.external_domain_name.trim().replace(/^https?:\/\//i, '')
  }
  const store = buildCustomerStoreLink(vendor.slug)
  if (store) return store.replace(/^https?:\/\//i, '')
  return 'www.example.com'
}

const LOGO_SHAPE_PREVIEW_CLASS: Record<LogoShape, string> = {
  square: 'rounded object-contain !w-12 !h-12',
  rounded: 'rounded-lg object-contain !w-12 !h-12',
  squircle: 'object-cover !w-12 !h-12 [border-radius:28%]',
  circle: 'rounded-full object-cover aspect-square !w-12 !h-12 !max-w-[3rem]',
  oval: 'rounded-full object-cover !w-14 !h-10 !max-w-[3.5rem]',
  pill: 'rounded-full object-contain !w-16 !h-10 !max-w-[4rem]',
  sharp: 'rounded-none object-contain !w-12 !h-12',
  diamond: 'object-cover !w-12 !h-12 [clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)]',
  hexagon: 'object-cover !w-12 !h-12 [clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]',
  arch: 'object-cover !w-12 !h-12 [border-radius:50%_50%_6px_6px]',
  shield: 'object-cover !w-12 !h-[3.25rem] [clip-path:polygon(50%_0%,92%_12%,92%_58%,50%_100%,8%_58%,8%_12%)]',
}

function LogoShapeIcon({ shape, selected }: { shape: LogoShape; selected?: boolean }) {
  const fill = selected ? '#3b82f6' : '#cbd5e1'
  const stroke = selected ? '#2563eb' : '#9ca3af'
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden className="mx-auto">
      {shape === 'square' && (
        <rect x="6" y="6" width="20" height="20" rx="2" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'rounded' && (
        <rect x="6" y="6" width="20" height="20" rx="6" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'squircle' && (
        <rect x="6" y="6" width="20" height="20" rx="7" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'circle' && (
        <circle cx="16" cy="16" r="10" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'oval' && (
        <ellipse cx="16" cy="16" rx="12" ry="8" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'pill' && (
        <rect x="4" y="11" width="24" height="10" rx="5" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'sharp' && (
        <rect x="6" y="6" width="20" height="20" rx="0" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'diamond' && (
        <polygon points="16,5 27,16 16,27 5,16" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'hexagon' && (
        <polygon points="16,4 26,9 26,23 16,28 6,23 6,9" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'arch' && (
        <path d="M8 24 V14 Q8 6 16 6 Q24 6 24 14 V24 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
      {shape === 'shield' && (
        <path d="M16 4 L26 8 L26 18 Q26 24 16 28 Q6 24 6 18 L6 8 Z" fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}
    </svg>
  )
}

// ── Template theme grid ───────────────────────────────────────────────────────

function TemplateThemeGrid({
  selectedId,
  accentColor,
  onSelect,
}: {
  selectedId: InvoiceTemplateId
  accentColor: string
  onSelect: (id: InvoiceTemplateId) => void
}) {
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  return (
    <div className="grid grid-cols-2 gap-2 flex-1 min-w-0 max-h-[480px] overflow-y-auto pr-1">
      {TEMPLATES.map(tmpl => {
        const active = selectedId === tmpl.id
        return (
          <button
            key={tmpl.id}
            ref={active ? selectedRef : undefined}
            onClick={() => onSelect(tmpl.id)}
            className={`relative rounded-lg border-2 p-1.5 transition-all text-left ${
              active ? 'border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {active && (
              <>
                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center z-10">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
                <div className="absolute top-1 left-1 z-10 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-600 text-white">
                  In use
                </div>
              </>
            )}
            <div
              className="w-full rounded overflow-hidden border border-gray-100"
              dangerouslySetInnerHTML={{ __html: tmpl.svg(accentColor) }}
            />
            <p className={`mt-1 text-xs font-medium truncate ${active ? 'text-blue-800' : 'text-gray-800'}`}>
              {tmpl.name}
            </p>
          </button>
        )
      })}
    </div>
  )
}

// ── Live invoice preview (iframe) ─────────────────────────────────────────────

function InvoiceLivePreview({
  html,
  title,
  paperSize,
  templateId,
  onTemplateChange,
}: {
  html: string
  title: string
  paperSize: PaperSize
  templateId: InvoiceTemplateId
  onTemplateChange?: (id: InvoiceTemplateId) => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [frameHeight, setFrameHeight] = useState(880)

  const isNarrow = paperSize === '2inch' || paperSize === '3inch' || paperSize === '4inch'
  const previewWidth = paperSize === '2inch' ? '220px'
    : paperSize === '3inch' ? '302px'
    : paperSize === '4inch' ? '393px'
    : '100%'

  const resizeFrame = useCallback(() => {
    const doc = iframeRef.current?.contentDocument
    if (!doc?.body) return
    const h = Math.max(520, doc.documentElement.scrollHeight || doc.body.scrollHeight)
    setFrameHeight(h + 16)
  }, [])

  useEffect(() => {
    if (!html) return
    const t = window.setTimeout(resizeFrame, 80)
    return () => window.clearTimeout(t)
  }, [html, resizeFrame])

  const openFullPreview = () => {
    if (!html) return
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
    }
  }

  const templateOptions = (() => {
    const inGrid = new Set(TEMPLATES.map(t => t.id))
    const opts = TEMPLATES.map(t => ({ id: t.id, name: t.name }))
    if (templateId && !inGrid.has(templateId)) {
      opts.unshift({ id: templateId, name: templateLabelFor(templateId) })
    }
    return opts
  })()

  return (
    <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Eye className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-sm font-medium text-gray-600">Live Preview</span>
          <span className="text-xs text-gray-400">(sample data)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {onTemplateChange ? (
            <label className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-gray-500 shrink-0">Template</span>
              <select
                value={templateId}
                onChange={e => onTemplateChange(e.target.value as InvoiceTemplateId)}
                className="h-8 max-w-[200px] rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-800 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                aria-label="Select invoice template"
              >
                {templateOptions.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
              <Check className="w-3 h-3" />
              {templateLabelFor(templateId)}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs shrink-0"
            disabled={!html}
            onClick={openFullPreview}
          >
            Open full preview
          </Button>
        </div>
      </div>
      <p className="text-xs text-gray-500 -mt-1">
        Showing <span className="font-medium text-gray-700">{templateLabelFor(templateId)}</span> template
      </p>
      <div className="border rounded-xl overflow-auto bg-gray-100 min-h-[560px] max-h-[85vh] flex items-start justify-center p-3 sm:p-4">
        {!html ? (
          <div className="flex flex-col items-center justify-center gap-2 w-full min-h-[480px] text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm">Generating preview…</span>
          </div>
        ) : (
          <div
            className="bg-white shadow-lg rounded-lg w-full shrink-0"
            style={{
              transform: isNarrow ? 'none' : 'scale(0.88)',
              transformOrigin: 'top center',
              width: previewWidth,
              maxWidth: '760px',
            }}
          >
            <iframe
              ref={iframeRef}
              srcDoc={html}
              title={title}
              onLoad={resizeFrame}
              className="w-full border-0 block bg-white"
              style={{ height: `${frameHeight}px`, minHeight: '520px' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── PDF Margin visual preview ──────────────────────────────────────────────────
// Shows a scaled A4 page with the margin zone (blue tint) and content area
// (white) so the user instantly sees the effect of the slider value.

// ── Layout Section Drag-and-Drop Editor ───────────────────────────────────────

function LayoutEditor({
  sections,
  onChange,
}: {
  sections: LayoutSection[]
  onChange: (s: LayoutSection[]) => void
}) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const dragNode = useRef<HTMLDivElement | null>(null)

  const handleDragStart = (id: string, el: HTMLDivElement) => {
    setDragging(id)
    dragNode.current = el
    setTimeout(() => el.classList.add('opacity-40'), 0)
  }

  const handleDragEnd = () => {
    dragNode.current?.classList.remove('opacity-40')
    setDragging(null)
    setDragOver(null)
    dragNode.current = null
  }

  const handleDrop = (targetId: string) => {
    if (!dragging || dragging === targetId) return
    const from = sections.findIndex(s => s.id === dragging)
    const to   = sections.findIndex(s => s.id === targetId)
    const next = [...sections]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
    handleDragEnd()
  }

  const toggleVisible = (id: string) => {
    onChange(sections.map(s => s.id === id ? { ...s, visible: !s.visible } : s))
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-gray-500 leading-relaxed mb-2">
        Drag sections to reorder them. Toggle the eye icon to show / hide a section.
        Changes are reflected instantly in the preview.
      </p>
      {sections.map(s => (
        <div
          key={s.id}
          draggable
          onDragStart={e => handleDragStart(s.id, e.currentTarget as HTMLDivElement)}
          onDragEnd={handleDragEnd}
          onDragOver={e => { e.preventDefault(); setDragOver(s.id) }}
          onDragLeave={() => setDragOver(null)}
          onDrop={() => handleDrop(s.id)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-grab active:cursor-grabbing select-none transition-colors ${
            dragOver === s.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
          } ${!s.visible ? 'opacity-50' : ''}`}
        >
          <GripVertical className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className={`flex-1 text-xs font-medium ${s.visible ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
            {s.label}
          </span>
          <button
            onClick={() => toggleVisible(s.id)}
            title={s.visible ? 'Hide section' : 'Show section'}
            className={`p-1 rounded transition-colors ${s.visible ? 'text-blue-600 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-100'}`}
          >
            {s.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange(DEFAULT_LAYOUT_SECTIONS.map(d => ({ ...d })))}
        className="text-xs text-gray-400 hover:text-gray-600 mt-1 flex items-center gap-1"
      >
        <RotateCcw className="w-3 h-3" /> Reset to default order
      </button>
    </div>
  )
}

// ── Font Size Selector ────────────────────────────────────────────────────────

function FontSizeSelector({
  value,
  onChange,
}: {
  value: 'sm' | 'md' | 'lg'
  onChange: (v: 'sm' | 'md' | 'lg') => void
}) {
  return (
    <div className="flex gap-2">
      {([
        { id: 'sm', label: 'Small', hint: '~88%' },
        { id: 'md', label: 'Medium', hint: '100%' },
        { id: 'lg', label: 'Large',  hint: '~112%' },
      ] as { id: 'sm' | 'md' | 'lg'; label: string; hint: string }[]).map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 flex flex-col items-center py-2 rounded-lg border-2 transition-all ${
            value === o.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <Type className={`mb-0.5 ${o.id === 'sm' ? 'w-3 h-3' : o.id === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} ${value === o.id ? 'text-blue-600' : 'text-gray-500'}`} />
          <span className={`text-xs font-medium ${value === o.id ? 'text-blue-700' : 'text-gray-600'}`}>{o.label}</span>
          <span className="text-xs text-gray-400">{o.hint}</span>
        </button>
      ))}
    </div>
  )
}

function MarginPreview({ margin, orientation = 'portrait' }: { margin: number; orientation?: 'portrait' | 'landscape' }) {
  const isLandscape = orientation === 'landscape'
  const W     = isLandscape ? 112 : 80            // preview pixel width
  const H     = isLandscape ? Math.round((210 / 297) * W) : Math.round((297 / 210) * W)
  const scale = W / (isLandscape ? 297 : 210)     // 1 mm → px in preview
  const mPx   = Math.max(1, Math.round(margin * scale))

  const LINES = [55, 30, 70, 40, 55, 35, 65, 28, 50, 38, 62]

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div
        style={{ width: W, height: H, position: 'relative', backgroundColor: '#e0e7ff', borderRadius: 2, boxShadow: '0 1px 4px rgba(0,0,0,.18)' }}
        title={margin === 0 ? 'Full bleed — no margin' : `${margin} mm margin on each side`}
      >
        {/* Content area (white inset) */}
        <div style={{
          position: 'absolute',
          top: mPx, left: mPx, right: mPx, bottom: mPx,
          backgroundColor: '#fff',
          borderRadius: 1,
          overflow: 'hidden',
          padding: '3px 4px',
        }}>
          {LINES.map((w, i) => (
            <div key={i} style={{
              height: 2.5, width: `${w}%`,
              backgroundColor: i === 0 ? '#6366f1' : '#cbd5e1',
              borderRadius: 1, marginBottom: 2,
            }} />
          ))}
        </div>

        {/* Top margin tick */}
        {margin > 0 && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: mPx,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 7, color: '#3730a3', fontWeight: 700, lineHeight: 1 }}>
              {margin}mm
            </span>
          </div>
        )}
      </div>

      {/* Caption */}
      <p style={{ fontSize: 9, color: '#6b7280', textAlign: 'center', lineHeight: 1.4 }}>
        {margin === 0 ? 'Full bleed' : `${margin} mm`}
        <br />
        <span style={{ color: '#9ca3af', fontSize: 8 }}>{orientation}</span>
      </p>
    </div>
  )
}

// ── Accordion section ─────────────────────────────────────────────────────────

function AccordionSection({ title, badge, children, defaultOpen = false }: {
  title: string; badge?: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-700"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {title}
          {badge && <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-600">{badge}</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 py-4 space-y-3 bg-white">{children}</div>}
    </div>
  )
}

function ToggleRow({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between py-1.5 cursor-pointer gap-3">
      <div>
        <span className="text-sm text-gray-700">{label}</span>
        {hint && <p className="text-xs text-gray-400 mt-0.5 leading-tight">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors mt-0.5 ${checked ? 'bg-primary' : 'bg-gray-300'}`}
      >
        <span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform" style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }} />
      </button>
    </label>
  )
}

function WebsiteUrlSettings({
  settings,
  set,
  vendorWebsiteFallback,
}: {
  settings: InvoiceSettings
  set: <K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) => void
  vendorWebsiteFallback: string
}) {
  const showUrl = settings.show_url ?? false
  const effectiveUrl = settings.website_url?.trim() || vendorWebsiteFallback

  return (
    <AccordionSection title="Website URL" badge={showUrl ? 'On' : 'Off'} defaultOpen={showUrl}>
      <ToggleRow
        label="Show website URL"
        hint="Print your store or website link on the invoice"
        checked={showUrl}
        onChange={v => set('show_url', v)}
      />
      {showUrl && (
        <div className="space-y-3 pt-1">
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">Website URL</Label>
            <Input
              value={settings.website_url ?? ''}
              onChange={e => set('website_url', e.target.value)}
              placeholder={vendorWebsiteFallback}
              className="h-9 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Leave blank to use your store link ({vendorWebsiteFallback})
            </p>
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1.5 block">URL position</Label>
            <div className="grid grid-cols-1 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
              {URL_POSITION_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => set('url_position', opt.id)}
                  className={`rounded-lg border-2 px-3 py-2 text-left transition-all ${
                    (settings.url_position ?? 'auto') === opt.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-xs font-medium text-gray-800">{opt.label}</div>
                  <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{opt.hint}</div>
                </button>
              ))}
            </div>
            {(settings.url_position ?? 'auto') === 'auto' && (
              <p className="text-xs text-blue-600 mt-2">
                Auto uses the best spot for <strong>{templateLabelFor(settings.template)}</strong> (e.g. logo-left themes → header left).
              </p>
            )}
          </div>
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Preview: <span className="font-medium text-gray-700">{effectiveUrl}</span>
          </div>
        </div>
      )}
    </AccordionSection>
  )
}

// ── Signature drawing canvas ──────────────────────────────────────────────────

function SignaturePad({ onSave, onClear }: { onSave: (dataUrl: string) => void; onClear: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing   = useRef(false)
  const lastPos   = useRef<{ x: number; y: number } | null>(null)

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const src  = 'touches' in e ? e.touches[0] : e
    return { x: src.clientX - rect.left, y: src.clientY - rect.top }
  }

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    drawing.current = true
    const canvas = canvasRef.current
    if (!canvas) return
    lastPos.current = getPos(e, canvas)
  }, [])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e, canvas)
    if (lastPos.current) {
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.strokeStyle = '#1f2937'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
    }
    lastPos.current = pos
  }, [])

  const stopDraw = useCallback(() => {
    drawing.current = false
    lastPos.current = null
  }, [])

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onClear()
  }, [onClear])

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    onSave(canvas.toDataURL('image/png'))
  }, [onSave])

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={320}
          height={110}
          className="w-full cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
      <p className="text-xs text-gray-400 text-center">Draw your signature above using mouse or touch</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={handleClear}>
          <Eraser className="w-3.5 h-3.5" /> Clear
        </Button>
        <Button size="sm" className="flex-1 gap-1.5 bg-primary hover:bg-primary/90" onClick={handleSave}>
          <Check className="w-3.5 h-3.5" /> Use Signature
        </Button>
      </div>
    </div>
  )
}

// ── Sample invoice data for preview ──────────────────────────────────────────

const SAMPLE_INVOICE = {
  invoice_number: 'INV/2025-26/001',
  invoice_type: 'invoice',
  status: 'paid',
  created_at: new Date().toISOString(),
  due_date: null,
  financial_year: '2025-26',
  vendor_name: 'Your Business Name',
  vendor_gstin: '29ABCDE1234F1Z5',
  vendor_address: { street: 'Block A, Industrial Area', city: 'Hyderabad', state: 'Telangana', postal_code: '500001' },
  customer_name: 'Sample Customer',
  customer_email: 'customer@example.com',
  customer_phone: '+91 98765 43210',
  customer_gstin: '27XYZAB9876C1Z3',
  billing_address: { street: 'Block A, Industrial Area', city: 'Hyderabad', state: 'Telangana', postal_code: '500001' },
  shipping_address: { label: 'Warehouse', street: 'Plot 45, APIIC Layout', city: 'Pune', state: 'Maharashtra', postal_code: '411001' },
  place_of_supply: 'Telangana (36)',
  is_inter_state: false,
  payment_terms: 'Net 30 Days',
  items: [
    { name: 'Service Booking', description: 'Professional service', hsn_sac: '998314', qty: 1, rate: 5000, discount: 250, cgst_amt: 427.5, sgst_amt: 427.5, igst_amt: 0, total: 5605 },
    { name: 'Consultation Fee', description: '', hsn_sac: '', qty: 2, rate: 750, discount: 0, cgst_amt: 67.5, sgst_amt: 67.5, igst_amt: 0, total: 1635 },
  ],
  subtotal: 6500,
  discount_amount: 250,
  taxable_amount: 6250,
  cgst_amount: 495,
  sgst_amount: 495,
  igst_amount: 0,
  total_tax: 990,
  round_off: -0.5,
  total: 7239.5,
  amount_paid: 7239.5,
  balance_due: 0,
  is_gst: true,
  notes: 'Thank you for your business!',
  terms_and_conditions: '',
  booking_number: 'BK-00007',
}

const SAMPLE_QUOTATION = {
  ...SAMPLE_INVOICE,
  invoice_number: 'EST/2026-27/0001',
  invoice_type: 'estimate',
  status: 'draft',
  due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  amount_paid: 0,
  balance_due: 0,
  payment_terms: '',
  notes: '',
  terms_and_conditions: DEFAULT_QUOTATION_SETTINGS.default_terms,
  booking_number: undefined,
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InvoiceSettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isQuotationMode = location.pathname.startsWith('/quotations/templates')

  const { data: rawInvoiceSettings, isLoading: invoiceSettingsLoading } = useInvoiceSettings()
  const { data: rawQuotationSettings, isLoading: quotationSettingsLoading } = useQuotationSettings()
  const rawSettings = isQuotationMode ? rawQuotationSettings : rawInvoiceSettings
  const isLoading = isQuotationMode ? quotationSettingsLoading : invoiceSettingsLoading

  const { data: vendor } = useQuery({ queryKey: ['myVendor'], queryFn: vendorApi.getMyVendor })
  const updateInvoiceSettings = useUpdateInvoiceSettings()
  const updateQuotationSettings = useUpdateQuotationSettings()
  const updateSettings = isQuotationMode ? updateQuotationSettings : updateInvoiceSettings
  const uploadInvoiceSignature = useUploadInvoiceSignature()
  const uploadQuotationSignature = useUploadQuotationSignature()
  const uploadSignature = isQuotationMode ? uploadQuotationSignature : uploadInvoiceSignature

  // Tab: 'invoice' = standard customer invoice (API-backed), 'pos' = POS receipt (localStorage)
  const [activeTab, setActiveTab] = useState<'invoice' | 'pos'>('invoice')
  // Settings panel tabs
  const [settingsTab, setSettingsTab] = useState<'design' | 'branding' | 'content' | 'export'>('design')
  // POS settings panel tabs
  const [posTab, setPosTab] = useState<'design' | 'content' | 'export'>('design')

  const [settings, setSettings] = useState<InvoiceSettings>(
    isQuotationMode ? { ...DEFAULT_QUOTATION_SETTINGS } : { ...DEFAULT_INVOICE_SETTINGS },
  )
  const [previewHtml, setPreviewHtml] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [sigMode, setSigMode] = useState<'upload' | 'draw'>('upload')

  // POS-specific settings (localStorage)
  const [posSettings, setPosSettings] = useState<Partial<InvoiceSettings>>(
    () => loadPosInvoiceSettings()
  )
  const [posPreviewHtml, setPosPreviewHtml] = useState('')
  const posMerged = (): InvoiceSettings => ({ ...DEFAULT_INVOICE_SETTINGS, ...settings, ...posSettings })

  const setPos = <K extends keyof InvoiceSettings>(k: K, v: InvoiceSettings[K]) =>
    setPosSettings(prev => ({ ...prev, [k]: v }))

  // Load settings from API
  useEffect(() => {
    const base = isQuotationMode ? DEFAULT_QUOTATION_SETTINGS : DEFAULT_INVOICE_SETTINGS
    if (rawSettings && Object.keys(rawSettings).length > 0) {
      setSettings({ ...base, ...(rawSettings as Partial<InvoiceSettings>) })
    } else if (isQuotationMode) {
      setSettings({ ...DEFAULT_QUOTATION_SETTINGS })
    }
  }, [rawSettings, isQuotationMode])

  const vendorLogo = vendor?.logo_url || ''
  const vendorWebsiteFallback = resolveVendorWebsiteFallback(vendor)
  const logoUrl = resolveInvoiceTemplateLogoPath(settings, vendorLogo)
  const logoShape = settings.logo_shape ?? 'rounded'
  const logoPreviewClass = LOGO_SHAPE_PREVIEW_CLASS[logoShape]

  // Regenerate document preview whenever settings change
  useEffect(() => {
    const sampleBase = isQuotationMode ? SAMPLE_QUOTATION : SAMPLE_INVOICE
    const sampleData = {
      ...sampleBase,
      vendor_name: vendor?.business_name || sampleBase.vendor_name,
      vendor_gstin: vendor?.gstin || sampleBase.vendor_gstin,
      vendor_address: vendor?.street_address
        ? { street: vendor.street_address, city: vendor.city || '', state: vendor.state || '', postal_code: vendor.postal_code || '' }
        : sampleBase.vendor_address,
      vendor_logo_url: vendorLogo,
      vendor_website_url: settings.website_url?.trim() || vendorWebsiteFallback,
      terms_and_conditions: settings.default_terms || sampleBase.terms_and_conditions,
    }
    const html = generateInvoiceHtml(sampleData, settings, window.location.origin)
    setPreviewHtml(html)
  }, [settings, vendor, vendorLogo, vendorWebsiteFallback, isQuotationMode])

  // Regenerate POS preview whenever posSettings change
  useEffect(() => {
    const pm = posMerged()
    const sampleData = {
      ...SAMPLE_INVOICE,
      invoice_number: 'POS-000042',
      vendor_name: vendor?.business_name || SAMPLE_INVOICE.vendor_name,
      vendor_gstin: vendor?.gstin || SAMPLE_INVOICE.vendor_gstin,
      vendor_address: vendor?.street_address
        ? { street: vendor.street_address, city: vendor.city || '', state: vendor.state || '', postal_code: vendor.postal_code || '' }
        : SAMPLE_INVOICE.vendor_address,
      vendor_logo_url: vendorLogo,
      vendor_website_url: pm.website_url?.trim() || vendorWebsiteFallback,
      customer_name: 'Walk-in Customer',
      notes: 'POS Transaction: POS-000042',
    }
    setPosPreviewHtml(generateInvoiceHtml(sampleData, pm, window.location.origin))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posSettings, settings, vendor, vendorLogo, vendorWebsiteFallback])

  const set = useCallback(<K extends keyof InvoiceSettings>(key: K, value: InvoiceSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateSettings.mutateAsync(settings as unknown as Record<string, unknown>)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePosSave = () => {
    savePosInvoiceSettings(posSettings)
    toast.success('POS receipt template saved!')
  }

  const handlePosReset = () => {
    setPosSettings({})
    savePosInvoiceSettings({})
    toast.success('POS template reset to match invoice settings')
  }

  const removeLogo = () => {
    set('logo_url', '')
    toast.success('Logo removed from invoice template')
  }

  const uploadLogo = async (file: File) => {
    try {
      const result = await vendorApi.uploadVendorLogo(file)
      set('logo_url', result.logo_url)
      toast.success('Logo updated!')
    } catch {
      toast.error('Could not upload logo — use a PNG or JPG file under 2MB')
    }
  }

  const applySignatureUpload = async (file: File) => {
    const result = await uploadSignature.mutateAsync(file)
    set('signature_url', result.signature_url)
  }

  const applyDrawnSignatureSave = async (file: File) => {
    set('signature_url', await fileToDataUrl(file))
  }

  const applyQrDataUrl = async (file: File) => {
    set('qr_code_url', await fileToDataUrl(file))
  }

  const applyPosQrDataUrl = async (file: File) => {
    setPos('qr_code_url', await fileToDataUrl(file))
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-300" /></div>
  }

  return (
    <div className="space-y-0">
      {/* Top bar */}
      <div className="flex items-center justify-between pb-4 border-b mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(isQuotationMode ? '/quotations' : '/invoices')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{isQuotationMode ? 'Quotation Templates' : 'Invoice Settings'}</h1>
            <p className="text-xs text-gray-500">
              {isQuotationMode
                ? 'Customise quotation print and PDF templates — layout, branding, and content'
                : 'Customise how your invoices look and what they include'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!isQuotationMode ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={activeTab === 'pos' ? handlePosReset : () => setSettings({ ...DEFAULT_INVOICE_SETTINGS })}
                className="h-9 min-w-[5.5rem] gap-1.5 text-xs text-gray-600"
                title={activeTab === 'pos' ? 'Reset POS template to match invoice settings' : 'Reset all settings to defaults'}
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                Reset
              </Button>
            <div className="flex rounded-lg border bg-gray-50 p-0.5 gap-0.5">
              <button
                onClick={() => setActiveTab('invoice')}
                  className={`flex h-9 items-center gap-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'invoice' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" /> Customer Invoice
              </button>
              <button
                onClick={() => setActiveTab('pos')}
                  className={`flex h-9 items-center gap-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'pos' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" /> POS Receipt
              </button>
            </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettings({ ...DEFAULT_QUOTATION_SETTINGS })}
              className="gap-1.5 text-xs text-gray-600"
              title="Reset all settings to defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </Button>
          )}

          <Button
            onClick={!isQuotationMode && activeTab === 'pos' ? handlePosSave : handleSave}
            disabled={isSaving && (isQuotationMode || activeTab === 'invoice')}
            className="h-9 min-w-[9.5rem] gap-2 bg-primary hover:bg-primary/90"
            title={!isQuotationMode && activeTab === 'pos' ? 'Save POS receipt template' : undefined}
          >
            {isSaving && (isQuotationMode || activeTab === 'invoice') ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4 shrink-0" />
            )}
            {isQuotationMode ? 'Save Templates' : 'Save Template'}
              </Button>
        </div>
      </div>

      {/* ── POS Receipt Tab ─────────────────────────────────────── */}
      {!isQuotationMode && activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          <InvoiceLivePreview
            html={posPreviewHtml}
            title="POS Preview"
            paperSize={posMerged().paper_size}
            templateId={posMerged().template}
            onTemplateChange={id => setPos('template', id)}
          />

          {/* Right: POS-specific controls */}
          <div className="space-y-3">
            <div className="rounded-xl border bg-blue-50 border-blue-100 px-4 py-2.5 text-xs text-blue-700 leading-relaxed">
              <strong>POS Receipt</strong> settings override the Customer Invoice template only for POS transactions.
            </div>

            {/* ── POS Tab bar ── */}
            <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
              {([
                { id: 'design',  label: 'Design',  icon: Palette },
                { id: 'content', label: 'Content', icon: ToggleLeft },
                { id: 'export',  label: 'Export',  icon: FileOutput },
              ] as { id: typeof posTab; label: string; icon: React.ElementType }[]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setPosTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all ${
                    posTab === t.id
                      ? 'bg-white shadow text-blue-700 border border-blue-100'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* ── POS DESIGN tab ── */}
            {posTab === 'design' && <>
            {/* ── Template + Layout Editor side-by-side ── */}
            <AccordionSection title="Template" badge={templateLabelFor(posMerged().template)} defaultOpen>
              <div className="flex gap-3">
                <TemplateThemeGrid
                  selectedId={posMerged().template}
                  accentColor={posMerged().color}
                  onSelect={id => setPos('template', id)}
                />

                {/* Layout Editor - right panel within Template */}
                <div className="w-44 shrink-0 border-l pl-3 space-y-3">
                  <div>
                    <SectionLabel className="mb-1.5">Font Size</SectionLabel>
                    <div className="flex gap-1">
                      {([{ id: 'sm', label: 'S' }, { id: 'md', label: 'M' }, { id: 'lg', label: 'L' }] as { id: 'sm' | 'md' | 'lg'; label: string }[]).map(o => (
                        <button key={o.id} onClick={() => setPos('font_size_scale', o.id)}
                          className={`flex-1 py-1.5 text-xs font-bold rounded border-2 transition-all ${(posMerged().font_size_scale ?? 'md') === o.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <SectionLabel className="mb-1">Section Order</SectionLabel>
                    <p className="text-xs text-gray-400 mb-1.5 leading-tight">Drag to reorder · eye to hide</p>
                    {(posMerged().layout_sections ?? DEFAULT_LAYOUT_SECTIONS.map(s => ({ ...s }))).map((s, idx, arr) => (
                      <div key={s.id}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData('text/plain', s.id); (e.currentTarget as HTMLDivElement).classList.add('opacity-40') }}
                        onDragEnd={e => (e.currentTarget as HTMLDivElement).classList.remove('opacity-40')}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => {
                          e.preventDefault()
                          const fromId = e.dataTransfer.getData('text/plain')
                          const sections = arr.slice()
                          const from = sections.findIndex(x => x.id === fromId)
                          const to   = sections.findIndex(x => x.id === s.id)
                          const [moved] = sections.splice(from, 1)
                          sections.splice(to, 0, moved)
                          setPos('layout_sections', sections)
                        }}
                        className={`flex items-center gap-1 py-1 px-1.5 rounded mb-0.5 cursor-grab border transition-colors ${s.visible ? 'border-gray-100 hover:border-gray-200 bg-white' : 'border-transparent opacity-40'}`}
                      >
                        <GripVertical className="w-3 h-3 text-gray-300 shrink-0" />
                        <span className={`flex-1 text-xs truncate ${s.visible ? 'text-gray-700' : 'text-gray-400 line-through'}`}>{s.label}</span>
                        <button onClick={() => setPos('layout_sections', arr.map(x => x.id === s.id ? { ...x, visible: !x.visible } : x))}
                          className="shrink-0 text-gray-300 hover:text-blue-500 transition-colors">
                          {s.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                      </div>
                    ))}
                    <button onClick={() => setPos('layout_sections', DEFAULT_LAYOUT_SECTIONS.map(d => ({ ...d })))}
                      className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5 mt-1">
                      <RotateCcw className="w-2.5 h-2.5" /> Reset order
                    </button>
                  </div>
                </div>
              </div>
            </AccordionSection>

            {/* ── Paper Size + Colour side-by-side ── */}
            <div className="grid grid-cols-2 gap-3">
              <AccordionSection title="Paper Size" defaultOpen>
                <div className="space-y-1.5">
                  {PAPER_SIZES.map(ps => (
                    <button key={ps.id} onClick={() => setPos('paper_size', ps.id as PaperSize)}
                      className={`w-full flex items-center gap-2 rounded-lg border-2 px-2 py-1.5 text-left transition-all ${posMerged().paper_size === ps.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className={`w-5 shrink-0 rounded border ${ps.id === 'A4' ? 'h-7' : 'h-3.5'} ${posMerged().paper_size === ps.id ? 'border-blue-400 bg-blue-100' : 'border-gray-300 bg-gray-50'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium leading-tight text-gray-800">{ps.label}</p>
                        <p className="text-xs text-gray-400 leading-tight truncate">{ps.sub}</p>
                      </div>
                      {posMerged().paper_size === ps.id && <Check className="w-3 h-3 text-blue-500 ml-auto shrink-0" />}
                    </button>
                  ))}
                </div>
              </AccordionSection>

              <AccordionSection title="Colour">
                <InvoiceAccentColorPicker
                  value={posMerged().color}
                  onChange={c => setPos('color', c)}
                />
              </AccordionSection>
            </div>

            </>}

            {/* ── POS CONTENT tab ── */}
            {posTab === 'content' && <>
            <WebsiteUrlSettings
              settings={posMerged()}
              set={(k, v) => setPos(k, v)}
              vendorWebsiteFallback={vendorWebsiteFallback}
            />
            {/* ── POS: Discounts ── */}
            <AccordionSection title="Discounts" defaultOpen>
              <ToggleRow
                label="Show discount on receipt"
                hint="Adds a discount column in line items and/or a summary row in totals"
                checked={posMerged().show_discount ?? false}
                onChange={v => setPos('show_discount', v)}
              />
              {(posMerged().show_discount ?? false) && (
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">Discount Display</Label>
                    <div className="flex gap-1.5">
                      {([
                        { id: 'column',  label: 'Column' },
                        { id: 'summary', label: 'Summary' },
                        { id: 'both',    label: 'Both' },
                      ] as { id: 'column' | 'summary' | 'both'; label: string }[]).map(o => (
                        <button key={o.id} onClick={() => setPos('discount_display', o.id)}
                          className={`flex-1 text-xs py-1.5 rounded border-2 transition-colors ${(posMerged().discount_display ?? 'both') === o.id ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold' : 'border-gray-200 text-gray-500'}`}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Discount Label</Label>
                    <Input className="mt-0.5 text-sm h-8" placeholder="Discount"
                      value={posMerged().discount_label || ''}
                      onChange={e => setPos('discount_label', e.target.value)} />
                  </div>
                </div>
              )}
            </AccordionSection>

            {/* ── POS: Tax ── */}
            <AccordionSection title="Tax">
              <ToggleRow label="Show tax breakdown (CGST / SGST / IGST)" hint="When off, shows a single combined tax row"
                checked={posMerged().show_tax_breakdown} onChange={v => setPos('show_tax_breakdown', v)} />
              <ToggleRow label="Show taxable amount row" hint="Displays subtotal-after-discount before tax"
                checked={posMerged().show_taxable_amount ?? false} onChange={v => setPos('show_taxable_amount', v)} />
              <ToggleRow label="Show round-off" hint="Displays the rounding adjustment row in totals"
                checked={posMerged().show_round_off ?? true} onChange={v => setPos('show_round_off', v)} />
              <ToggleRow label="Show amount in words" hint="Prints total in English words"
                checked={posMerged().show_amount_in_words ?? false} onChange={v => setPos('show_amount_in_words', v)} />
              <ToggleRow label="Show tax-inclusive note" hint='Adds "All prices inclusive of taxes" note'
                checked={posMerged().show_tax_inclusive_note ?? false} onChange={v => setPos('show_tax_inclusive_note', v)} />
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <SectionLabel>Custom Tax Labels</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'tax_label',  label: 'Combined Tax', placeholder: 'Tax'  },
                    { key: 'cgst_label', label: 'CGST Label',   placeholder: 'CGST' },
                    { key: 'sgst_label', label: 'SGST Label',   placeholder: 'SGST' },
                    { key: 'igst_label', label: 'IGST Label',   placeholder: 'IGST' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <Label className="text-xs text-gray-500">{label}</Label>
                      <Input className="mt-0.5 text-sm h-8" placeholder={placeholder}
                        value={(posMerged()[key as keyof InvoiceSettings] as string) || ''}
                        onChange={e => setPos(key as keyof InvoiceSettings, e.target.value as never)} />
                    </div>
                  ))}
                </div>
              </div>
            </AccordionSection>

            {/* ── Watermark ── */}
            <AccordionSection title="Document Stamp / Watermark">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {['', 'ORIGINAL', 'DUPLICATE', 'COPY', 'DRAFT', 'CANCELLED'].map(w => (
                  <button key={w} onClick={() => setPos('watermark', w)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${(posMerged().watermark ?? '') === w ? 'bg-primary text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                    {w === '' ? 'None' : w}
                  </button>
                ))}
              </div>
              <Input className="text-sm h-8 mb-3" placeholder="Custom text (e.g. CONFIDENTIAL)"
                value={posMerged().watermark || ''} onChange={e => setPos('watermark', e.target.value.toUpperCase())} maxLength={20} />

              {posMerged().watermark && (
                <div className="space-y-2.5 pt-2.5 border-t border-gray-100">
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">Position</Label>
                    <div className="flex gap-1.5">
                      {([
                        { id: 'top',      label: '▲ Top' },
                        { id: 'bottom',   label: '▼ Bottom' },
                        { id: 'diagonal', label: '⤢ Diagonal' },
                      ] as { id: 'top' | 'bottom' | 'diagonal'; label: string }[]).map(p => (
                        <button key={p.id} onClick={() => setPos('watermark_position', p.id)}
                          className={`flex-1 text-xs py-1.5 rounded border transition-colors ${(posMerged().watermark_position ?? 'diagonal') === p.id ? 'bg-primary text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 mb-1.5 block">Font Size</Label>
                    <div className="flex gap-1.5">
                      {([{ id: 'sm', label: 'Small' }, { id: 'md', label: 'Medium' }, { id: 'lg', label: 'Large' }] as { id: 'sm' | 'md' | 'lg'; label: string }[]).map(s => (
                        <button key={s.id} onClick={() => setPos('watermark_size', s.id)}
                          className={`flex-1 text-xs py-1.5 rounded border transition-colors ${(posMerged().watermark_size ?? 'md') === s.id ? 'bg-primary text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs text-gray-500">Opacity</Label>
                      <span className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {Math.round((posMerged().watermark_opacity ?? ((posMerged().watermark_position ?? 'diagonal') === 'diagonal' ? 0.07 : 0.18)) * 100)}%
                      </span>
                    </div>
                    <div className="flex gap-1.5 mb-1.5">
                      {[{ label: 'Subtle', val: (posMerged().watermark_position ?? 'diagonal') === 'diagonal' ? 0.05 : 0.1 },
                        { label: 'Normal', val: (posMerged().watermark_position ?? 'diagonal') === 'diagonal' ? 0.07 : 0.18 },
                        { label: 'Bold',   val: (posMerged().watermark_position ?? 'diagonal') === 'diagonal' ? 0.15 : 0.35 }].map(o => (
                        <button key={o.label} onClick={() => setPos('watermark_opacity', o.val)}
                          className={`flex-1 text-xs py-0.5 rounded border transition-colors ${(posMerged().watermark_opacity ?? -1) === o.val ? 'bg-primary text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                          {o.label}
                        </button>
                      ))}
                    </div>
                    <input type="range" min={0.02} max={0.6} step={0.01}
                      value={posMerged().watermark_opacity ?? ((posMerged().watermark_position ?? 'diagonal') === 'diagonal' ? 0.07 : 0.18)}
                      onChange={e => setPos('watermark_opacity', Number(e.target.value))}
                      className="w-full accent-blue-600" />
                  </div>
                </div>
              )}
            </AccordionSection>

            {/* ── POS: QR Code ── */}
            <AccordionSection title="QR Code" badge="Print on receipt">
              <ToggleRow
                label="Print QR code on receipt"
                hint="The QR code appears in the footer next to the signature"
                checked={posMerged().show_qr_code ?? false}
                onChange={v => setPos('show_qr_code', v)}
              />
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  {posMerged().qr_code_url ? (
                    <SingleImagePreview
                      url={posMerged().qr_code_url!}
                      alt="QR Code"
                      className="shrink-0 rounded-lg"
                      imgClassName="w-20 h-20 object-contain border rounded-lg p-1 bg-white"
                      editable
                      onSave={applyPosQrDataUrl}
                    >
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPos('qr_code_url', '') }}
                        className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </SingleImagePreview>
                  ) : (
                    <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 shrink-0 bg-gray-50">
                      <QrCode className="w-6 h-6 text-gray-300" />
                      <span className="text-xs text-gray-400">QR Code</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      id="pos-qr-upload"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = ev => setPos('qr_code_url', ev.target?.result as string)
                        reader.readAsDataURL(file)
                        e.target.value = ''
                      }}
                    />
                    <label htmlFor="pos-qr-upload">
                      <Button variant="outline" size="sm" className="gap-1.5 w-full cursor-pointer text-xs" asChild>
                        <span><Upload className="w-3 h-3" /> {posMerged().qr_code_url ? 'Change QR Code' : 'Upload QR Code'}</span>
                      </Button>
                    </label>
                    <p className="text-xs text-gray-400 leading-snug">
                      PNG, JPG, SVG, WebP · Max 2 MB<br />
                      Generate via any UPI / payment app
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Label below QR code</Label>
                  <Input
                    className="mt-0.5 text-sm h-8"
                    placeholder="e.g. Scan to Pay, Scan to Verify"
                    value={posMerged().qr_code_label || ''}
                    onChange={e => setPos('qr_code_label', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">Position on receipt</Label>
                  <div className="flex gap-1.5">
                    {([
                      { id: 'footer', label: '▼ Footer', hint: 'Next to signature at bottom' },
                      { id: 'header', label: '▲ Header', hint: 'Next to logo at top' },
                    ] as { id: 'footer' | 'header'; label: string; hint: string }[]).map(p => (
                      <button
                        key={p.id}
                        title={p.hint}
                        onClick={() => setPos('qr_code_position', p.id)}
                        className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                          (posMerged().qr_code_position ?? 'footer') === p.id
                            ? 'bg-primary text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </AccordionSection>

            {/* ── POS: Display Options ── */}
            <div className="border rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Display Options</span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-gray-100 p-px">
                {([
                  { label: 'Logo',                  key: 'show_logo',             val: posMerged().show_logo },
                  { label: 'Copy Label (Original…)', key: 'show_copy_label',       val: posMerged().show_copy_label ?? true },
                  { label: 'Vendor Address',         key: 'show_vendor_address',   val: posMerged().show_vendor_address ?? true },
                  { label: 'Website URL',            key: 'show_url',              val: posMerged().show_url ?? false },
                  { label: 'GSTIN (vendor + customer)', key: 'show_gstin',         val: posMerged().show_gstin },
                  { label: 'Financial Year (F.Y.)',  key: 'show_financial_year',   val: posMerged().show_financial_year ?? true },
                  { label: 'Due Date',               key: 'show_due_date',         val: posMerged().show_due_date ?? true },
                  { label: 'Booking / Ref. No.',     key: 'show_booking_number',   val: posMerged().show_booking_number ?? true },
                  { label: 'Customer / Bill To',     key: 'show_customer_address', val: posMerged().show_customer_address ?? true },
                  { label: 'Customer Phone',         key: 'show_phone',            val: posMerged().show_phone },
                  { label: 'Customer Email',         key: 'show_customer_email',   val: posMerged().show_customer_email ?? true },
                  { label: 'Item Description',       key: 'show_description',      val: posMerged().show_description },
                  { label: 'Item Number (#)',         key: 'show_item_numbers',     val: posMerged().show_item_numbers ?? false },
                  { label: 'HSN / SAC Code',         key: 'show_hsn',              val: posMerged().show_hsn },
                  { label: 'Discount Column',        key: 'show_discount',         val: posMerged().show_discount ?? false },
                  { label: 'Product Images',         key: 'show_product_images',   val: posMerged().show_product_images ?? false },
                  { label: 'Tax Breakdown',          key: 'show_tax_breakdown',    val: posMerged().show_tax_breakdown },
                  { label: 'Amount Paid',            key: 'show_amount_paid',      val: posMerged().show_amount_paid ?? true },
                  { label: 'Balance Due',            key: 'show_balance_due',      val: posMerged().show_balance_due ?? true },
                  { label: 'Signature',              key: 'show_signature',        val: posMerged().show_signature },
                  { label: 'Bank Details',           key: 'show_bank_details',     val: posMerged().show_bank_details },
                  { label: 'Shipping Address',       key: 'show_shipping_address', val: posMerged().show_shipping_address },
                  { label: 'Place of Supply',        key: 'show_place_of_supply',  val: posMerged().show_place_of_supply },
                  { label: 'Payment Terms',          key: 'show_payment_terms',    val: posMerged().show_payment_terms ?? true },
                  { label: 'Notes',                  key: 'show_notes',            val: posMerged().show_notes },
                  { label: 'Legal Footer Line',      key: 'show_legal_note',       val: posMerged().show_legal_note ?? true },
                ] as { label: string; key: string; val: boolean }[]).map(({ label, key, val }) => (
                  <button
                    key={key}
                    onClick={() => setPos(key as keyof InvoiceSettings, !val as never)}
                    className={`flex items-center justify-between px-3 py-2 text-left transition-colors bg-white hover:bg-gray-50 ${val ? '' : 'opacity-60'}`}
                  >
                    <span className="text-xs text-gray-700 leading-tight">{label}</span>
                    <span className={`ml-2 shrink-0 w-8 h-4 rounded-full relative transition-colors ${val ? 'bg-primary' : 'bg-gray-200'}`}>
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${val ? 'left-4' : 'left-0.5'}`} />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            </>}

            {/* ── POS EXPORT tab ── */}
            {posTab === 'export' && <>
            {/* ── PDF Layout (POS) ── */}
            <AccordionSection title="PDF Download Layout" defaultOpen>
              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  <MarginPreview margin={posMerged().pdf_margin ?? 5} orientation={posMerged().pdf_orientation ?? 'portrait'} />
                  <div className="flex-1 space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-gray-600 font-medium">Page Margin</Label>
                      <span className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{posMerged().pdf_margin ?? 5} mm</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {[{ label: 'None', val: 0 }, { label: 'Compact', val: 3 }, { label: 'Standard', val: 5 }, { label: 'Relaxed', val: 10 }, { label: 'Wide', val: 15 }].map(p => (
                        <button key={p.val} onClick={() => setPos('pdf_margin', p.val)}
                          className={`text-xs px-2 py-0.5 rounded border transition-colors ${(posMerged().pdf_margin ?? 5) === p.val ? 'bg-primary text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <input type="range" min={0} max={20} step={1} value={posMerged().pdf_margin ?? 5}
                      onChange={e => setPos('pdf_margin', Number(e.target.value))} className="w-full accent-blue-600" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-xs text-gray-600 font-medium w-20 shrink-0">Orientation</Label>
                  <div className="flex gap-2">
                    {(['portrait', 'landscape'] as const).map(o => (
                      <button key={o} onClick={() => setPos('pdf_orientation', o)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${(posMerged().pdf_orientation ?? 'portrait') === o ? 'bg-primary text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                        <span>{o === 'portrait' ? '📄' : '📋'}</span>
                        <span className="capitalize">{o}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-600 font-medium">Image Quality</Label>
                    <span className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{Math.round((posMerged().pdf_image_quality ?? 0.98) * 100)}%</span>
                  </div>
                  <div className="flex gap-1">
                    {[{ label: 'Low', val: 0.7 }, { label: 'Medium', val: 0.85 }, { label: 'High', val: 0.98 }].map(q => (
                      <button key={q.val} onClick={() => setPos('pdf_image_quality', q.val)}
                        className={`text-xs px-2 py-0.5 rounded border transition-colors ${(posMerged().pdf_image_quality ?? 0.98) === q.val ? 'bg-primary text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                        {q.label}
                      </button>
                    ))}
                  </div>
                  <input type="range" min={0.5} max={1} step={0.01} value={posMerged().pdf_image_quality ?? 0.98}
                    onChange={e => setPos('pdf_image_quality', Number(e.target.value))} className="w-full accent-blue-600" />
                </div>
              </div>
            </AccordionSection>

            </>}

          </div>
        </div>
      )}

      {/* ── Customer Invoice Tab ─────────────────────────────────── */}
      {(isQuotationMode || activeTab === 'invoice') && (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <InvoiceLivePreview
          html={previewHtml}
                title={isQuotationMode ? 'Quotation Preview' : 'Invoice Preview'}
          paperSize={settings.paper_size}
          templateId={settings.template}
          onTemplateChange={id => set('template', id)}
              />

        {/* Right: Settings Panel */}
        <div className="space-y-3">

          {/* ── Tab bar ── */}
          <div className="flex gap-0.5 bg-gray-100 rounded-xl p-1">
            {([
              { id: 'design',   label: 'Design',   icon: Palette },
              { id: 'branding', label: 'Branding',  icon: Building2 },
              { id: 'content',  label: 'Content',   icon: ToggleLeft },
              { id: 'export',   label: 'Export',    icon: FileOutput },
            ] as { id: typeof settingsTab; label: string; icon: React.ElementType }[]).map(t => (
              <button
                key={t.id}
                onClick={() => setSettingsTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all ${
                  settingsTab === t.id
                    ? 'bg-white shadow text-blue-700 border border-blue-100'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <t.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {/* ── DESIGN tab ── */}
          {settingsTab === 'design' && <>
          {/* ── Themes + Layout Editor (side-by-side) ── */}
          <AccordionSection title="Themes" badge={templateLabelFor(settings.template)} defaultOpen>
            <div className="flex gap-3">
              <TemplateThemeGrid
                selectedId={settings.template}
                accentColor={settings.color}
                onSelect={id => set('template', id)}
              />

              {/* Layout Editor - right panel within Themes */}
              <div className="w-44 shrink-0 border-l pl-3 space-y-3">
                <div>
                  <SectionLabel className="mb-1.5">Font Size</SectionLabel>
                  <div className="flex gap-1">
                    {([{ id: 'sm', label: 'S' }, { id: 'md', label: 'M' }, { id: 'lg', label: 'L' }] as { id: 'sm' | 'md' | 'lg'; label: string }[]).map(o => (
                      <button key={o.id} onClick={() => set('font_size_scale', o.id)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded border-2 transition-all ${(settings.font_size_scale ?? 'md') === o.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionLabel className="mb-1">Section Order</SectionLabel>
                  <p className="text-xs text-gray-400 mb-1.5 leading-tight">Drag to reorder · eye to hide</p>
                  {(settings.layout_sections ?? DEFAULT_LAYOUT_SECTIONS.map(s => ({ ...s }))).map((s, idx, arr) => (
                    <div key={s.id}
                      draggable
                      onDragStart={e => { e.dataTransfer.setData('text/plain', s.id); (e.currentTarget as HTMLDivElement).classList.add('opacity-40') }}
                      onDragEnd={e => (e.currentTarget as HTMLDivElement).classList.remove('opacity-40')}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault()
                        const fromId = e.dataTransfer.getData('text/plain')
                        const sections = arr.slice()
                        const from = sections.findIndex(x => x.id === fromId)
                        const to   = sections.findIndex(x => x.id === s.id)
                        const [moved] = sections.splice(from, 1)
                        sections.splice(to, 0, moved)
                        set('layout_sections', sections)
                      }}
                      className={`flex items-center gap-1 py-1 px-1.5 rounded mb-0.5 cursor-grab border transition-colors ${s.visible ? 'border-gray-100 hover:border-gray-200 bg-white' : 'border-transparent opacity-40'}`}
                    >
                      <GripVertical className="w-3 h-3 text-gray-300 shrink-0" />
                      <span className={`flex-1 text-xs truncate ${s.visible ? 'text-gray-700' : 'text-gray-400 line-through'}`}>{s.label}</span>
                      <button onClick={() => set('layout_sections', arr.map(x => x.id === s.id ? { ...x, visible: !x.visible } : x))}
                        className="shrink-0 text-gray-300 hover:text-blue-500 transition-colors">
                        {s.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                    </div>
                  ))}
                  <button onClick={() => set('layout_sections', DEFAULT_LAYOUT_SECTIONS.map(d => ({ ...d })))}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5 mt-1">
                    <RotateCcw className="w-2.5 h-2.5" /> Reset order
                  </button>
                </div>
              </div>
            </div>
          </AccordionSection>

          {/* ── Paper Size + Theme Colour (side-by-side accordions) ── */}
          <div className="grid grid-cols-2 gap-3">
            <AccordionSection title="Paper Size" defaultOpen>
              <div className="space-y-1.5">
                {PAPER_SIZES.map(ps => (
                  <button key={ps.id} onClick={() => set('paper_size', ps.id)}
                    className={`w-full flex items-center gap-2 rounded-lg border-2 px-2 py-1.5 text-left transition-all ${settings.paper_size === ps.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className={`w-5 shrink-0 rounded border ${ps.id === 'A4' ? 'h-7' : 'h-3.5'} ${settings.paper_size === ps.id ? 'border-blue-400 bg-blue-100' : 'border-gray-300 bg-gray-50'}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium leading-tight text-gray-800">{ps.label}</p>
                      <p className="text-xs text-gray-400 leading-tight truncate">{ps.sub}</p>
                    </div>
                    {settings.paper_size === ps.id && <Check className="w-3 h-3 text-blue-500 ml-auto shrink-0" />}
                  </button>
                ))}
              </div>
            </AccordionSection>

            <AccordionSection title="Colour" defaultOpen>
              <InvoiceAccentColorPicker
                value={settings.color}
                onChange={c => set('color', c)}
              />
            </AccordionSection>
          </div>

          </>}

          {/* ── BRANDING tab ── */}
          {settingsTab === 'branding' && <>
          {/* ── Company Logo ── */}
          <AccordionSection title="Company Logo" defaultOpen>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <SingleImagePreview
                  url={logoUrl}
                  alt="Logo"
                  resolveUrl={resolveOriginPath}
                  className="shrink-0"
                  imgClassName={`h-12 w-12 max-w-[100px] border p-1 ${logoPreviewClass}`}
                  editable
                  onSave={uploadLogo}
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeLogo() }}
                    className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </SingleImagePreview>
              ) : (
                <div className={`h-12 w-12 border-2 border-dashed border-gray-300 flex items-center justify-center shrink-0 ${logoPreviewClass}`}>
                  <Building2 className="w-5 h-5 text-gray-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <ImageSourcePicker
                  title="Logo"
                  onFile={uploadLogo}
                  buttonLabel={logoUrl ? 'Change logo' : 'Upload logo'}
                  buttonVariant="outline"
                  buttonSize="sm"
                  buttonClassName="gap-1.5 w-full cursor-pointer text-xs"
                />
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG • Max 2 MB</p>
              </div>
            </div>
            <div className="mt-3">
              <SectionLabel className="mb-1.5">Logo shape</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {LOGO_SHAPES.map(shape => (
                  <button
                    key={shape.id}
                    type="button"
                    title={shape.label}
                    aria-label={shape.label}
                    onClick={() => set('logo_shape', shape.id)}
                    className={`p-2 rounded-xl border-2 transition-all ${
                      logoShape === shape.id
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <LogoShapeIcon shape={shape.id} selected={logoShape === shape.id} />
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Shape applies to the logo in the live preview and printed invoices.</p>
            </div>
          </AccordionSection>

          <WebsiteUrlSettings
            settings={settings}
            set={set}
            vendorWebsiteFallback={vendorWebsiteFallback}
          />

          {/* ── Authorised Signature ── */}
          <AccordionSection title="Authorised Signature" badge="Draw or Upload">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-2">
              {(['upload', 'draw'] as const).map(m => (
                <button key={m} onClick={() => setSigMode(m)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${sigMode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {m === 'upload' ? '⬆ Upload' : '✏ Draw'}
                </button>
              ))}
            </div>

            {sigMode === 'upload' ? (
              <div className="flex items-center gap-3">
                {settings.signature_url && !settings.signature_url.startsWith('data:') ? (
                  <SingleImagePreview
                    url={settings.signature_url}
                    alt="Signature"
                    resolveUrl={resolveOriginPath}
                    className="shrink-0 rounded-lg"
                    imgClassName="h-12 max-w-[120px] object-contain border rounded-lg p-1 bg-white"
                    editable
                    onSave={applySignatureUpload}
                  >
                    <button onClick={() => set('signature_url', '')}
                      className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </SingleImagePreview>
                ) : (
                  <div className="h-12 w-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-0.5 shrink-0">
                    <Pen className="w-4 h-4 text-gray-300" />
                    <span className="text-xs text-gray-400">Signature</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <ImageSourcePicker
                    title="Signature"
                    onFile={applySignatureUpload}
                    disabled={uploadSignature.isPending}
                    uploading={uploadSignature.isPending}
                    buttonLabel={settings.signature_url ? 'Change signature' : 'Upload signature'}
                    buttonVariant="outline"
                    buttonSize="sm"
                    buttonClassName="gap-1.5 w-full text-xs"
                  />
                  <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG recommended</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {settings.signature_url?.startsWith('data:') && (
                  <SingleImagePreview
                    url={settings.signature_url}
                    alt="Drawn signature"
                    className="rounded-lg w-full"
                    imgClassName="h-14 border rounded-lg p-2 bg-white object-contain w-full"
                    editable
                    onSave={applyDrawnSignatureSave}
                  >
                    <button onClick={() => set('signature_url', '')}
                      className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </SingleImagePreview>
                )}
                <SignaturePad
                  onSave={dataUrl => set('signature_url', dataUrl)}
                  onClear={() => { if (settings.signature_url?.startsWith('data:')) set('signature_url', '') }}
                />
              </div>
            )}

            <div className="pt-2 border-t border-gray-100 space-y-2 mt-2">
              <ToggleRow label="Show signature on invoice" checked={settings.show_signature} onChange={v => set('show_signature', v)} />
              {settings.show_signature && (
                <div>
                  <Label className="text-xs text-gray-500">Signatory Name (override)</Label>
                  <Input className="mt-0.5 text-sm h-8" placeholder="Leave blank to use your business name"
                    value={settings.signatory_name || ''} onChange={e => set('signatory_name', e.target.value)} />
                </div>
              )}
            </div>
          </AccordionSection>

          {/* ── QR Code ── */}
          <AccordionSection title="QR Code" badge="Print on document">
            <ToggleRow
              label="Print QR code on invoice"
              hint="The QR code appears in the footer next to the signature"
              checked={settings.show_qr_code ?? false}
              onChange={v => set('show_qr_code', v)}
            />

            <div className="space-y-3 pt-2">
              {/* Upload area */}
              <div className="flex items-center gap-3">
                {settings.qr_code_url ? (
                  <SingleImagePreview
                    url={settings.qr_code_url}
                    alt="QR Code"
                    className="shrink-0 rounded-lg"
                    imgClassName="w-20 h-20 object-contain border rounded-lg p-1 bg-white"
                    editable
                    onSave={applyQrDataUrl}
                  >
                    <button
                      onClick={() => set('qr_code_url', '')}
                      className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </SingleImagePreview>
                ) : (
                  <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 shrink-0 bg-gray-50">
                    <QrCode className="w-6 h-6 text-gray-300" />
                    <span className="text-xs text-gray-400">QR Code</span>
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    id="qr-upload"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = ev => set('qr_code_url', ev.target?.result as string)
                      reader.readAsDataURL(file)
                      e.target.value = ''
                    }}
                  />
                  <label htmlFor="qr-upload">
                    <Button variant="outline" size="sm" className="gap-1.5 w-full cursor-pointer text-xs" asChild>
                      <span><Upload className="w-3 h-3" /> {settings.qr_code_url ? 'Change QR Code' : 'Upload QR Code'}</span>
                    </Button>
                  </label>
                  <p className="text-xs text-gray-400 leading-snug">
                    PNG, JPG, SVG, WebP · Max 2 MB<br />
                    Generate a QR via any UPI / payment app
                  </p>
                </div>
              </div>

              {/* Label */}
              <div>
                <Label className="text-xs text-gray-500">Label below QR code</Label>
                <Input
                  className="mt-0.5 text-sm h-8"
                  placeholder="e.g. Scan to Pay, Scan to Verify"
                  value={settings.qr_code_label || ''}
                  onChange={e => set('qr_code_label', e.target.value)}
                />
              </div>

              {/* Position */}
              <div>
                <Label className="text-xs text-gray-500 mb-1.5 block">Position on document</Label>
                <div className="flex gap-1.5">
                  {([
                    { id: 'footer', label: '▼ Footer', hint: 'Next to signature at the bottom' },
                    { id: 'header', label: '▲ Header', hint: 'Next to logo at the top' },
                  ] as { id: 'footer' | 'header'; label: string; hint: string }[]).map(p => (
                    <button
                      key={p.id}
                      title={p.hint}
                      onClick={() => set('qr_code_position', p.id)}
                      className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
                        (settings.qr_code_position ?? 'footer') === p.id
                          ? 'bg-primary text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </AccordionSection>

          </>}

          {/* ── CONTENT tab ── */}
          {settingsTab === 'content' && <>
          {/* ── Document Watermark ── */}
          <AccordionSection title="Document Stamp / Watermark" defaultOpen>
            {/* Presets */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {['', 'ORIGINAL', 'DUPLICATE', 'COPY', 'DRAFT', 'CANCELLED'].map(w => (
                <button key={w} onClick={() => set('watermark', w)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${(settings.watermark ?? '') === w ? 'bg-primary text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                  {w === '' ? 'None' : w}
                </button>
              ))}
            </div>
            <Input className="text-sm h-8 mb-3" placeholder="Custom text (e.g. CONFIDENTIAL)"
              value={settings.watermark || ''} onChange={e => set('watermark', e.target.value.toUpperCase())} maxLength={20} />

            {settings.watermark && (
              <div className="space-y-2.5 pt-2.5 border-t border-gray-100">
                {/* Position */}
                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">Position</Label>
                  <div className="flex gap-1.5">
                    {([
                      { id: 'top',      label: '▲ Top',      hint: 'Banner at top' },
                      { id: 'bottom',   label: '▼ Bottom',   hint: 'Banner at bottom' },
                      { id: 'diagonal', label: '⤢ Diagonal', hint: 'Full-page stamp' },
                    ] as { id: 'top' | 'bottom' | 'diagonal'; label: string; hint: string }[]).map(p => (
                      <button key={p.id} title={p.hint}
                        onClick={() => set('watermark_position', p.id)}
                        className={`flex-1 text-xs py-1.5 rounded border transition-colors ${(settings.watermark_position ?? 'diagonal') === p.id ? 'bg-primary text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Size */}
                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">Font Size</Label>
                  <div className="flex gap-1.5">
                    {([{ id: 'sm', label: 'Small' }, { id: 'md', label: 'Medium' }, { id: 'lg', label: 'Large' }] as { id: 'sm' | 'md' | 'lg'; label: string }[]).map(s => (
                      <button key={s.id} onClick={() => set('watermark_size', s.id)}
                        className={`flex-1 text-xs py-1.5 rounded border transition-colors ${(settings.watermark_size ?? 'md') === s.id ? 'bg-primary text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs text-gray-500">Opacity</Label>
                    <span className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      {Math.round((settings.watermark_opacity ?? ((settings.watermark_position ?? 'diagonal') === 'diagonal' ? 0.07 : 0.18)) * 100)}%
                    </span>
                  </div>
                  <div className="flex gap-1.5 mb-1.5">
                    {[{ label: 'Subtle', val: (settings.watermark_position ?? 'diagonal') === 'diagonal' ? 0.05 : 0.1 },
                      { label: 'Normal', val: (settings.watermark_position ?? 'diagonal') === 'diagonal' ? 0.07 : 0.18 },
                      { label: 'Bold',   val: (settings.watermark_position ?? 'diagonal') === 'diagonal' ? 0.15 : 0.35 }].map(o => (
                      <button key={o.label} onClick={() => set('watermark_opacity', o.val)}
                        className={`flex-1 text-xs py-0.5 rounded border transition-colors ${(settings.watermark_opacity ?? -1) === o.val ? 'bg-primary text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <input type="range" min={0.02} max={0.6} step={0.01}
                    value={settings.watermark_opacity ?? ((settings.watermark_position ?? 'diagonal') === 'diagonal' ? 0.07 : 0.18)}
                    onChange={e => set('watermark_opacity', Number(e.target.value))}
                    className="w-full accent-blue-600" />
                </div>
              </div>
            )}
          </AccordionSection>

          {/* ── Discounts ── */}
          <AccordionSection title="Discounts">
            <ToggleRow
              label="Show discount on invoice"
              hint="Adds a discount column in line items and/or a summary row in totals"
              checked={settings.show_discount ?? false}
              onChange={v => set('show_discount', v)}
            />
            {(settings.show_discount ?? false) && (
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div>
                  <Label className="text-xs text-gray-500 mb-1.5 block">Discount Display</Label>
                  <div className="flex gap-1.5">
                    {([
                      { id: 'column',  label: 'Column only',  hint: 'Per-item column in table' },
                      { id: 'summary', label: 'Summary only', hint: 'Row in totals block' },
                      { id: 'both',    label: 'Both',         hint: 'Column + summary row' },
                    ] as { id: 'column' | 'summary' | 'both'; label: string; hint: string }[]).map(o => (
                      <button
                        key={o.id}
                        title={o.hint}
                        onClick={() => set('discount_display', o.id)}
                        className={`flex-1 text-xs py-1.5 px-1 rounded border-2 transition-colors leading-tight ${
                          (settings.discount_display ?? 'both') === o.id
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Discount Label</Label>
                  <Input
                    className="mt-0.5 text-sm h-8"
                    placeholder="Discount"
                    value={settings.discount_label || ''}
                    onChange={e => set('discount_label', e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-0.5">Label shown in the totals summary row (e.g. "Discount", "Offer", "Coupon Savings")</p>
                </div>
              </div>
            )}
          </AccordionSection>

          {/* ── Tax ── */}
          <AccordionSection title="Tax">
            <ToggleRow
              label="Show tax breakdown (CGST / SGST / IGST)"
              hint="When off, shows a single combined tax row"
              checked={settings.show_tax_breakdown}
              onChange={v => set('show_tax_breakdown', v)}
            />
            <ToggleRow
              label="Show taxable amount row"
              hint="Displays subtotal-after-discount before adding tax"
              checked={settings.show_taxable_amount ?? false}
              onChange={v => set('show_taxable_amount', v)}
            />
            <ToggleRow
              label="Show round-off"
              hint="Displays the rounding adjustment row in totals"
              checked={settings.show_round_off ?? true}
              onChange={v => set('show_round_off', v)}
            />
            <ToggleRow
              label="Show amount in words"
              hint="Prints total in English words (e.g. Seven Thousand Rupees Only)"
              checked={settings.show_amount_in_words ?? false}
              onChange={v => set('show_amount_in_words', v)}
            />
            <ToggleRow
              label="Show tax-inclusive note"
              hint='Adds "All prices are inclusive of applicable taxes" at the bottom of totals'
              checked={settings.show_tax_inclusive_note ?? false}
              onChange={v => set('show_tax_inclusive_note', v)}
            />

            <div className="pt-3 border-t border-gray-100 space-y-2">
              <SectionLabel>Custom Tax Labels</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'tax_label',  label: 'Combined Tax Label', placeholder: 'Tax' },
                  { key: 'cgst_label', label: 'CGST Label',         placeholder: 'CGST' },
                  { key: 'sgst_label', label: 'SGST Label',         placeholder: 'SGST' },
                  { key: 'igst_label', label: 'IGST Label',         placeholder: 'IGST' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <Label className="text-xs text-gray-500">{label}</Label>
                    <Input
                      className="mt-0.5 text-sm h-8"
                      placeholder={placeholder}
                      value={(settings[key as keyof InvoiceSettings] as string) || ''}
                      onChange={e => set(key as keyof InvoiceSettings, e.target.value as never)}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 leading-relaxed">Useful for non-GST businesses (VAT, Service Tax, etc.) or custom display preferences.</p>
            </div>
          </AccordionSection>

          {/* ── Payment & Bank Details ── */}
          <AccordionSection title="Payment & Bank Details">
            <div className="mb-2">
              <Label className="text-xs text-gray-500">Default Payment Terms</Label>
              <Input className="mt-0.5 text-sm h-8" placeholder="e.g. Net 30 Days, Due on Receipt"
                value={settings.default_payment_terms || ''} onChange={e => set('default_payment_terms', e.target.value)} />
            </div>
            <ToggleRow label="Show bank details on invoice" checked={settings.show_bank_details} onChange={v => set('show_bank_details', v)} />
            {settings.show_bank_details && (
              <div className="space-y-2 pt-2 border-t border-gray-100 mt-1">
                {[
                  { key: 'bank_name', label: 'Bank Name', placeholder: 'State Bank of India' },
                  { key: 'account_holder_name', label: 'Account Holder', placeholder: 'Business Legal Name' },
                  { key: 'account_number', label: 'Account Number', placeholder: '1234567890' },
                  { key: 'ifsc_code', label: 'IFSC Code', placeholder: 'SBIN0001234' },
                  { key: 'upi_id', label: 'UPI ID', placeholder: 'business@upi' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <Label className="text-xs text-gray-500">{label}</Label>
                    <Input className="mt-0.5 text-sm h-8" placeholder={placeholder}
                      value={(settings[key as keyof InvoiceSettings] as string) || ''}
                      onChange={e => set(key as keyof InvoiceSettings, e.target.value as never)} />
                  </div>
                ))}
              </div>
            )}
          </AccordionSection>

          {/* ── Notes & Terms ── */}
          <AccordionSection title="Notes & Terms">
            <ToggleRow label="Show notes" checked={settings.show_notes} onChange={v => set('show_notes', v)} />
            {settings.show_notes && (
              <textarea className="w-full mt-1 text-sm border rounded-lg px-3 py-2 min-h-[56px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Thank you for your business!" value={settings.default_notes || ''}
                onChange={e => set('default_notes', e.target.value)} />
            )}
            <ToggleRow label="Show terms & conditions" checked={settings.show_terms} onChange={v => set('show_terms', v)} />
            {settings.show_terms && (
              <textarea className="w-full mt-1 text-sm border rounded-lg px-3 py-2 min-h-[56px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Goods once sold will not be taken back." value={settings.default_terms || ''}
                onChange={e => set('default_terms', e.target.value)} />
            )}
          </AccordionSection>

          {/* ── Display Options (2-col grid) ── */}
          <div className="border rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b">
              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Display Options</span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-gray-100 p-px">
              {([
                // ── Header ──
                { label: 'Logo',                   key: 'show_logo',             val: settings.show_logo },
                { label: 'Copy Label (Original…)',  key: 'show_copy_label',       val: settings.show_copy_label ?? true },
                { label: 'Vendor Address',          key: 'show_vendor_address',   val: settings.show_vendor_address ?? true },
                { label: 'Website URL',             key: 'show_url',              val: settings.show_url ?? false },
                { label: 'GSTIN (vendor + customer)', key: 'show_gstin',          val: settings.show_gstin },
                // ── Invoice Meta ──
                { label: 'Financial Year (F.Y.)',   key: 'show_financial_year',   val: settings.show_financial_year ?? true },
                { label: isQuotationMode ? 'Valid Until' : 'Due Date', key: 'show_due_date', val: settings.show_due_date ?? true },
                { label: 'Booking / Ref. No.',      key: 'show_booking_number',   val: settings.show_booking_number ?? true },
                // ── Bill To ──
                { label: 'Customer / Bill To',      key: 'show_customer_address', val: settings.show_customer_address ?? true },
                { label: 'Customer Phone',          key: 'show_phone',            val: settings.show_phone },
                { label: 'Customer Email',          key: 'show_customer_email',   val: settings.show_customer_email ?? true },
                // ── Line Items ──
                { label: 'Item Description',        key: 'show_description',      val: settings.show_description },
                { label: 'Item Number (#)',          key: 'show_item_numbers',     val: settings.show_item_numbers ?? false },
                { label: 'HSN / SAC Code',          key: 'show_hsn',              val: settings.show_hsn },
                { label: 'Discount Column',         key: 'show_discount',         val: settings.show_discount ?? false },
                { label: 'Product Images',          key: 'show_product_images',   val: settings.show_product_images ?? false },
                // ── Totals ──
                { label: 'Tax Breakdown',           key: 'show_tax_breakdown',    val: settings.show_tax_breakdown },
                { label: 'Amount Paid',             key: 'show_amount_paid',      val: settings.show_amount_paid ?? true },
                { label: 'Balance Due',             key: 'show_balance_due',      val: settings.show_balance_due ?? true },
                // ── Footer ──
                { label: 'Signature',               key: 'show_signature',        val: settings.show_signature },
                { label: 'Bank Details',            key: 'show_bank_details',     val: settings.show_bank_details },
                { label: 'Shipping Address',        key: 'show_shipping_address', val: settings.show_shipping_address },
                { label: 'Place of Supply',         key: 'show_place_of_supply',  val: settings.show_place_of_supply },
                { label: 'Payment Terms',           key: 'show_payment_terms',    val: settings.show_payment_terms ?? true },
                { label: 'Legal Footer Line',       key: 'show_legal_note',       val: settings.show_legal_note ?? true },
              ] as { label: string; key: keyof InvoiceSettings; val: boolean }[])
                .filter(row => !(isQuotationMode && ['show_amount_paid', 'show_balance_due', 'show_payment_terms'].includes(row.key)))
                .map(({ label, key, val }) => (
                <button
                  key={key}
                  onClick={() => set(key, !val as never)}
                  className={`flex items-center justify-between px-3 py-2 text-left transition-colors bg-white hover:bg-gray-50 ${val ? '' : 'opacity-60'}`}
                >
                  <span className="text-xs text-gray-700 leading-tight">{label}</span>
                  <span className={`ml-2 shrink-0 w-8 h-4 rounded-full relative transition-colors ${val ? 'bg-primary' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${val ? 'left-4' : 'left-0.5'}`} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          </>}

          {/* ── EXPORT tab ── */}
          {settingsTab === 'export' && <>
          {/* ── PDF Download Layout ── */}
          <AccordionSection title="PDF Download Layout" defaultOpen>
            <div className="space-y-4">
              <div className="flex gap-3 items-start">
                <MarginPreview margin={settings.pdf_margin ?? 5} orientation={settings.pdf_orientation ?? 'portrait'} />
                <div className="flex-1 space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-600 font-medium">Page Margin</Label>
                    <span className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{settings.pdf_margin ?? 5} mm</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {[{ label: 'None', val: 0 }, { label: 'Compact', val: 3 }, { label: 'Standard', val: 5 }, { label: 'Relaxed', val: 10 }, { label: 'Wide', val: 15 }].map(p => (
                      <button key={p.val} onClick={() => set('pdf_margin', p.val)}
                        className={`text-xs px-2 py-0.5 rounded border transition-colors ${(settings.pdf_margin ?? 5) === p.val ? 'bg-primary text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <input type="range" min={0} max={20} step={1} value={settings.pdf_margin ?? 5}
                    onChange={e => set('pdf_margin', Number(e.target.value))} className="w-full accent-blue-600" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label className="text-xs text-gray-600 font-medium w-20 shrink-0">Orientation</Label>
                <div className="flex gap-2">
                  {(['portrait', 'landscape'] as const).map(o => (
                    <button key={o} onClick={() => set('pdf_orientation', o)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${(settings.pdf_orientation ?? 'portrait') === o ? 'bg-primary text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                      <span>{o === 'portrait' ? '📄' : '📋'}</span>
                      <span className="capitalize">{o}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-600 font-medium">Image Quality</Label>
                  <span className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{Math.round((settings.pdf_image_quality ?? 0.98) * 100)}%</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {[{ label: 'Low', val: 0.7 }, { label: 'Medium', val: 0.85 }, { label: 'High', val: 0.98 }].map(q => (
                    <button key={q.val} onClick={() => set('pdf_image_quality', q.val)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${(settings.pdf_image_quality ?? 0.98) === q.val ? 'bg-primary text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                      {q.label}
                    </button>
                  ))}
                </div>
                <input type="range" min={0.5} max={1} step={0.01} value={settings.pdf_image_quality ?? 0.98}
                  onChange={e => set('pdf_image_quality', Number(e.target.value))} className="w-full accent-blue-600" />
              </div>
            </div>
          </AccordionSection>

          </>}

        </div>
      </div>
      )}
    </div>
  )
}
