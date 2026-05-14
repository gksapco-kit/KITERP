import { useState } from 'react'
import { Copy, Check, ShieldCheck, ShieldAlert, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Vendor, VendorDocument, VendorDocumentType } from '@/types'

// ── Human-readable IDs ────────────────────────────────────────────

/** Format a UUID into a short, prefixed display code, e.g. USR-A1B2-C3D4. */
export function formatShortId(prefix: string, uuid?: string | null): string {
  if (!uuid) return `${prefix}-—`
  const compact = uuid.replace(/-/g, '').toUpperCase()
  return `${prefix}-${compact.slice(0, 4)}-${compact.slice(4, 8)}`
}

/** Choose the best display code for a store (its `code` field, falling back to UUID slice). */
export function formatStoreCode(store: { code?: string | null; id: string }): string {
  if (store.code && store.code.trim()) return store.code.trim().toUpperCase()
  return formatShortId('STR', store.id)
}

/** Choose the best display code for a vendor (slug + UUID slice). */
export function formatVendorCode(vendor?: Pick<Vendor, 'slug' | 'id'> | null): string {
  if (!vendor) return formatShortId('BUS', undefined)
  const slug = (vendor.slug || '').toUpperCase()
  if (slug) return `BUS-${slug.slice(0, 12)}`
  return formatShortId('BUS', vendor.id)
}

// ── Copy to clipboard ─────────────────────────────────────────────

export async function copyText(text: string, label = 'Copied') {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} to clipboard`)
  } catch {
    toast.error('Could not copy — please copy manually')
  }
}

// ── ID display chip ───────────────────────────────────────────────

export function IdChip({
  label,
  code,
  fullValue,
  className,
}: {
  label: string
  code: string
  fullValue?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    await copyText(fullValue || code, label)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-gray-200 bg-gray-50 text-[11px]',
        className,
      )}
    >
      <span className="text-gray-400 font-medium">{label}</span>
      <span className="font-mono font-semibold text-gray-800">{code}</span>
      <button
        type="button"
        onClick={onCopy}
        className="ml-0.5 p-0.5 rounded hover:bg-white text-gray-400 hover:text-primary transition-colors"
        title={`Copy ${fullValue || code}`}
      >
        {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  )
}

// ── Verification status helpers ───────────────────────────────────

export type VerificationLevel = 'verified' | 'in_review' | 'rejected' | 'unverified' | 'partial'

export function vendorVerificationLevel(vendor?: Vendor | null): VerificationLevel {
  if (!vendor) return 'unverified'
  const s = (vendor.verification_status || '').toLowerCase()
  if (s === 'verified' || s === 'approved' || vendor.verified_at) return 'verified'
  if (s === 'rejected') return 'rejected'
  if (s === 'submitted' || s === 'in_review' || s === 'review') return 'in_review'
  if (s === 'partial') return 'partial'
  return 'unverified'
}

export function userVerificationLevel(user?: {
  is_email_verified?: boolean
  is_phone_verified?: boolean
} | null): VerificationLevel {
  if (!user) return 'unverified'
  const e = !!user.is_email_verified
  const p = !!user.is_phone_verified
  if (e && p) return 'verified'
  if (e || p) return 'partial'
  return 'unverified'
}

export function VerifiedBadge({
  level,
  size = 'sm',
  label,
}: {
  level: VerificationLevel
  size?: 'xs' | 'sm' | 'md'
  /** Override the auto-derived label (defaults: Verified / In review / Rejected / Unverified / Partially verified). */
  label?: string
}) {
  const map: Record<
    VerificationLevel,
    { label: string; classes: string; Icon: typeof ShieldCheck }
  > = {
    verified: {
      label: 'Verified',
      classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Icon: ShieldCheck,
    },
    partial: {
      label: 'Partially verified',
      classes: 'bg-blue-50 text-blue-700 border-blue-200',
      Icon: ShieldCheck,
    },
    in_review: {
      label: 'In review',
      classes: 'bg-amber-50 text-amber-700 border-amber-200',
      Icon: Clock,
    },
    rejected: {
      label: 'Rejected',
      classes: 'bg-red-50 text-red-700 border-red-200',
      Icon: ShieldAlert,
    },
    unverified: {
      label: 'Unverified',
      classes: 'bg-gray-50 text-gray-600 border-gray-200',
      Icon: ShieldAlert,
    },
  }
  const m = map[level]
  const sizeCls =
    size === 'xs'
      ? 'text-[9px] px-1.5 py-0.5 gap-0.5'
      : size === 'md'
        ? 'text-xs px-2.5 py-1 gap-1.5'
        : 'text-[10px] px-2 py-0.5 gap-1'
  const iconCls = size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-semibold',
        m.classes,
        sizeCls,
      )}
      title={`${label || m.label} status: ${level}`}
    >
      <m.Icon className={iconCls} />
      {label || m.label}
    </span>
  )
}

// ── KYC document helpers ──────────────────────────────────────────

export const REQUIRED_DOCUMENT_TYPES: VendorDocumentType[] = [
  'business_registration',
  'tax_id',
  'id_proof',
]

export const ALL_DOCUMENT_TYPES: VendorDocumentType[] = [
  'business_registration',
  'tax_id',
  'id_proof',
  'address_proof',
  'bank_proof',
]

export const DOCUMENT_LABELS: Record<VendorDocumentType, { label: string; hint: string }> = {
  business_registration: {
    label: 'Business registration',
    hint: 'Incorporation certificate, MSME / Udyam, partnership deed, etc.',
  },
  tax_id: {
    label: 'Tax ID',
    hint: 'GSTIN certificate, PAN card, or VAT registration.',
  },
  id_proof: {
    label: 'ID proof of owner',
    hint: 'Aadhaar, passport, driving licence, or voter ID of the primary owner.',
  },
  address_proof: {
    label: 'Address proof',
    hint: 'Recent utility bill, rental agreement, or property tax receipt.',
  },
  bank_proof: {
    label: 'Bank proof',
    hint: 'Cancelled cheque or passbook showing account number + IFSC.',
  },
}

export function documentForType(
  docs: VendorDocument[] | undefined,
  type: VendorDocumentType,
): VendorDocument | undefined {
  if (!docs) return undefined
  const matches = docs.filter(d => d.document_type === type)
  if (matches.length === 0) return undefined
  return matches.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0]
}
