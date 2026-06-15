import { getFieldMappingByLabel } from '@/lib/fieldMappingRuntime'

/** Short (hover) and full (F1 popup) help for form field labels. */
export type FieldHelpCopy = { hover: string; full: string; footerNote?: string }

export function normalizeLabelKey(label: string): string {
  return label
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Registry keyed by normalized label text (lowercase, no asterisks). */
export const FIELD_HELP_BY_LABEL: Record<string, FieldHelpCopy> = {
  // ── Settings · Profile (user account) ──
  'full name': {
    hover: 'Your display name across the vendor dashboard.',
    full:
      'The name shown on your profile, activity logs, and internal records. On customer or employee forms the same label may map to customer.full_name or employee records.',
  },
  'phone number': {
    hover: 'Mobile or contact number with country code.',
    full:
      'Your personal contact number for verification and alerts. Country code is selected automatically in the phone field.',
  },

  // ── Settings · Profile ──
  'business name': {
    hover: 'Legal or registered name (e.g. on invoices).',
    full:
      'The official business name used on invoices, tax documents, and contracts. Your customer storefront URL does not change when you update this. When a single business unit is selected, this applies to that unit only.',
  },
  'brand name': {
    hover: 'Public name shown on your customer storefront.',
    full:
      'The friendly name customers see on your business front, emails, and marketing. It can differ from the legal business name — for example "Fresh Mart" instead of "Fresh Mart Pvt Ltd".',
  },
  'business category': {
    hover: 'Industry type from business unit setup or registration.',
    full:
      'Shows the business category chosen when this unit was created or during signup. It helps tailor defaults and reporting. To change it, update the category on the business unit or create a new unit with the right type.',
  },
  'offering type': {
    hover: 'Whether you sell products, services, or both.',
    full:
      'Controls what appears on your customer storefront and catalog — products only, services only, or both. Choose the option that matches how customers buy from you.',
  },
  description: {
    hover: 'Short summary shown on your business front.',
    full:
      'A brief description of your business or this unit — what you offer and why customers choose you. Keep it clear and customer-friendly; it may appear on your storefront and listings.',
  },

  // ── Settings · Contact ──
  'business support email': {
    hover: 'Primary email customers use for support.',
    full:
      'The main support email shown to customers on your business front. You can add more addresses below. Replies and notifications related to customer support should reach these inboxes.',
  },
  'business support phone': {
    hover: 'Primary phone number for customer support.',
    full:
      'The main support phone number customers can call. Include country code where applicable. Additional numbers can be added for different departments or locations.',
  },

  // ── Settings · Address ──
  'street address': {
    hover: 'Building, street, and area.',
    full: 'The physical street address for this location or registered office — used on invoices, delivery, and location maps where applicable.',
  },
  city: {
    hover: 'City or town for this address.',
    full: 'City or town name for the branch or headquarters address.',
  },
  state: {
    hover: 'State or province.',
    full: 'State, province, or region for tax, shipping, and display on documents.',
  },
  'postal code': {
    hover: 'PIN / ZIP code for this address.',
    full: 'Postal or ZIP code used for deliveries, tax jurisdiction, and address validation.',
  },
  pincode: {
    hover: 'PIN / ZIP code for this address.',
    full: 'Postal or ZIP code for this business unit location.',
  },

  // ── Settings · Tax ──
  gstin: {
    hover: '15-character GST identification number.',
    full:
      'Your Goods and Services Tax Identification Number (GSTIN) if registered for GST in India. Required on tax invoices when GST registered. Format: 15 characters (e.g. 22AAAAA0000A1Z5).',
  },
  'default tax rate (%)': {
    hover: 'Default GST/tax % applied to new items.',
    full:
      'The default tax percentage applied to products and services when no specific rate is set. Individual items can override this rate.',
  },
  'pan number': {
    hover: 'Permanent Account Number for tax identity.',
    full:
      'Your business PAN (Permanent Account Number) used for income tax and compliance in India. Ten characters, letters and numbers.',
  },

  // ── Settings · External domain ──
  'where does this domain apply?': {
    hover: 'One shared domain for all shops, or a separate domain per shop.',
    full:
      'Choose how your custom domain maps to business units. "One for all" uses a single domain for every shop (requires Single Website mode). "Per business unit" lets each shop have its own domain (requires Unique Website Per BU mode).',
  },
  'how should dns be configured?': {
    hover: 'You add DNS records yourself, or KIT ERP configures them for you.',
    full:
      '"I\'ll manage DNS" — you sign in to your registrar and add the DNS records KIT ERP shows you. "KIT ERP help" — you grant our team delegated access at your registrar and we configure DNS for you.',
  },
  'domain name': {
    hover: 'Your website address without https:// (e.g. myshop.com).',
    full:
      'Enter the domain you own or plan to use for your customer storefront — for example yourbusiness.com. Do not include https:// or paths. Your default KIT ERP link stays active until the custom domain goes live.',
  },
  registrar: {
    hover: 'Where you bought or manage this domain.',
    full:
      'Select the registrar where the domain is registered — such as GoDaddy, Namecheap, or Cloudflare. Required when you choose KIT ERP assisted DNS setup.',
  },
  'registrar login email': {
    hover: 'Email used to log in to your registrar account.',
    full:
      'The email address tied to your registrar login. KIT ERP uses this to coordinate delegated access during DNS setup.',
  },
  'account holder name': {
    hover: 'Name on the domain registration (optional).',
    full:
      'Person or organization name on the domain WHOIS record, if different from your business name. Helps verify ownership during setup.',
  },
  'domain expiry date': {
    hover: 'When your domain registration renews (optional).',
    full:
      'Renewal or expiry date from your registrar dashboard. Helps avoid accidental downtime if the domain lapses.',
  },
  '2fa recovery contact': {
    hover: 'Phone or backup email for registrar 2FA (optional).',
    full:
      'Backup contact used when KIT ERP assists with DNS and your registrar requires two-factor authentication.',
  },
  'verification code': {
    hover: 'One-time code sent to confirm a sensitive change.',
    full:
      'Enter the verification code sent to your registered email or phone to confirm this action — for example deactivating a live custom domain.',
  },

  // ── Auth & account ──
  email: {
    hover: 'Your account email address.',
    full: 'Email used to sign in and receive account notifications. Use an address you check regularly.',
  },
  password: {
    hover: 'Keep it strong and private.',
    full: 'Use a strong password you do not reuse elsewhere. It protects your vendor account and business data.',
  },
  'phone number': {
    hover: 'Contact number with country code.',
    full: 'Mobile or landline number for account verification and important alerts. Include country code (e.g. +91 for India).',
  },

  // ── Common commerce / CRM ──
  'customer name': {
    hover: 'Full name of the customer.',
    full: 'Customer\'s display name used on orders, invoices, and communication.',
  },
  sku: {
    hover: 'Stock keeping unit — unique product code.',
    full: 'Internal product code for inventory and orders. Keep it unique within your catalog.',
  },
  price: {
    hover: 'Selling price for this item.',
    full: 'Amount customers pay before tax and discounts. Currency follows your store settings.',
  },
  quantity: {
    hover: 'Number of units.',
    full: 'How many units to order, sell, or adjust in inventory.',
  },
  notes: {
    hover: 'Optional internal or team notes.',
    full: 'Free-text notes visible to your team. Not shown to customers unless the form says otherwise.',
  },

  // ── Coupons ──
  code: {
    hover: 'Unique coupon code customers enter at checkout.',
    full:
      'A short, memorable code (e.g. SAVE20) that customers type to apply the discount. Codes are usually uppercase and must be unique. Cannot be changed after creation.',
  },
  title: {
    hover: 'Display name shown to customers.',
    full: 'Friendly name for the coupon (e.g. "20% Off") shown on receipts, storefront, or marketing.',
  },
  'discount type': {
    hover: 'Percentage off or fixed amount.',
    full: 'Choose percentage (%) to discount a share of the order, or fixed amount (₹) to subtract a flat value.',
  },
  'discount value': {
    hover: 'Amount or percent to discount.',
    full: 'For percentage type, enter the percent (e.g. 20 for 20% off). For fixed amount, enter rupees to subtract.',
  },
  'max discount (₹)': {
    hover: 'Cap on percentage discounts (0 = no cap).',
    full: 'Maximum rupees off when using a percentage discount. Use 0 for unlimited cap.',
  },
  'min order (₹)': {
    hover: 'Minimum cart total to use this coupon.',
    full: 'Order subtotal must reach this amount before the coupon can be applied. Use 0 for no minimum.',
  },
  'total usage limit': {
    hover: 'How many times the coupon can be used overall.',
    full: 'Maximum redemptions across all customers. Use 0 for unlimited total uses.',
  },
  'per customer': {
    hover: 'Max uses per individual customer.',
    full: 'How many times one customer can redeem this coupon. Helps prevent abuse of single-use offers.',
  },
  active: {
    hover: 'Whether this coupon can be redeemed now.',
    full: 'Inactive coupons are ignored at checkout. Turn off instead of deleting to preserve history.',
  },
  'visible on store': {
    hover: 'Show this coupon on your customer storefront.',
    full: 'When enabled, customers may see and copy the coupon from your store. Hidden coupons work only when the code is shared manually.',
  },

  // ── Invoices & quotations ──
  'select customer (optional)': {
    hover: 'Link an existing customer record.',
    full:
      'Search and pick a saved customer to auto-fill name, phone, and GSTIN. Optional — you can enter details manually or create a new customer.',
  },
  type: {
    hover: 'Document type for this record.',
    full: 'Invoice bills for a sale; quotation (estimate) is a non-binding quote you can convert later.',
  },
  'valid until': {
    hover: 'Quotation expiry date.',
    full: 'Date after which the quotation is no longer valid. Helps customers know how long pricing is held.',
  },
  phone: {
    hover: 'Customer contact number.',
    full: 'Customer phone for SMS, WhatsApp, or follow-up. Country code is selected separately (+91 default for India).',
  },
  'inter-state supply (igst)': {
    hover: 'Supply across state borders — uses IGST.',
    full:
      'Enable when the customer is in a different state than your business. Tax splits as IGST instead of CGST+SGST.',
  },
  'line items': {
    hover: 'Products or services on this document.',
    full: 'Add rows for each product or service. Search your catalog to auto-fill HSN, rate, and tax.',
  },
  item: {
    hover: 'Product or service name.',
    full: 'Line item description. Search your catalog or type a custom name.',
  },
  'hsn/sac': {
    hover: 'Tax classification code for GST.',
    full: 'Harmonized System of Nomenclature (goods) or Services Accounting Code. Required for GST invoices in India.',
  },
  qty: {
    hover: 'Quantity sold or quoted.',
    full: 'Number of units for this line. Affects line total and tax calculation.',
  },
  'rate (₹)': {
    hover: 'Unit price before tax.',
    full: 'Price per unit in rupees. Line amount = quantity × rate.',
  },
  'tax %': {
    hover: 'GST rate for this line.',
    full: 'Tax percentage applied to this line (e.g. 18 for 18% GST). CGST/SGST or IGST depends on inter-state setting.',
  },
  'terms & conditions': {
    hover: 'Legal or payment terms on the quotation.',
    full: 'Text printed on the quotation PDF — payment terms, validity, warranties, etc.',
  },

  // ── Report & list columns ──
  'invoice #': {
    hover: 'Unique invoice document number.',
    full: 'System-generated or custom invoice number for tracking and GST compliance.',
  },
  customer: {
    hover: 'Buyer or client name.',
    full: 'Customer associated with this order, invoice, or report row.',
  },
  status: {
    hover: 'Current state of this record.',
    full: 'Workflow status — e.g. draft, paid, overdue, or cancelled depending on the list.',
  },
  total: {
    hover: 'Grand total including tax.',
    full: 'Final amount for the transaction or period shown in this column.',
  },
  date: {
    hover: 'Document or transaction date.',
    full: 'Date the record was created or posted. Used for sorting and reporting periods.',
  },
  reference: {
    hover: 'External or internal reference.',
    full: 'Optional reference number — PO number, order ID, or your own tracking code.',
  },
  payment: {
    hover: 'How or whether payment was received.',
    full: 'Payment method or settlement status for this transaction.',
  },
  service: {
    hover: 'Booked or sold service.',
    full: 'Name of the service associated with this booking or sale.',
  },
}

function helpFromKeywords(label: string): FieldHelpCopy | null {
  const lower = label.toLowerCase()
  if (lower.includes('email')) {
    return {
      hover: 'Valid email address.',
      full: 'Enter a working email address. Used for notifications, login, or customer contact depending on this form.',
    }
  }
  if (lower.includes('phone') || lower.includes('mobile') || lower.includes('whatsapp')) {
    return {
      hover: 'Phone number with country code.',
      full: 'Enter a reachable phone number. Country code is added automatically where the field supports it.',
    }
  }
  if (lower.includes('address')) {
    return {
      hover: 'Street or mailing address.',
      full: 'Physical or mailing address used for delivery, billing, or records.',
    }
  }
  if (lower.includes('date')) {
    return {
      hover: 'Select or enter a date.',
      full: 'Choose the date that applies to this record. Format follows your browser and locale settings.',
    }
  }
  if (lower.includes('tax') || lower.includes('gst') || lower.includes('vat')) {
    return {
      hover: 'Tax-related value for compliance.',
      full: 'Enter the tax identifier or rate required for invoices and compliance in your region.',
    }
  }
  if (lower.includes('domain')) {
    return {
      hover: 'Website domain without https://.',
      full: 'Enter a domain name you control (e.g. mystore.com). Used to link your brand to online storefronts or email.',
    }
  }
  if (lower.includes('password')) {
    return FIELD_HELP_BY_LABEL.password
  }
  if (lower.includes('coupon') || lower.includes('discount')) {
    return {
      hover: 'Pricing or promotion setting.',
      full: 'Controls how discounts or coupons apply to orders and what customers see at checkout.',
    }
  }
  if (lower.includes('qty') || lower.includes('quantity')) {
    return FIELD_HELP_BY_LABEL.quantity
  }
  if (lower.includes('rate') || lower.includes('amount')) {
    return {
      hover: 'Monetary value for this field.',
      full: 'Enter the amount in your store currency (₹). Used in totals and tax calculations.',
    }
  }
  return null
}

export function generateDefaultFieldHelp(label: string): FieldHelpCopy {
  const clean = label.replace(/\*+/g, '').trim()
  const keyword = helpFromKeywords(clean)
  if (keyword) return keyword
  const lower = clean.toLowerCase()
  return {
    hover: `Enter or select ${lower}.`,
    full: `Use "${clean}" to complete this part of the form. Accurate values keep your records, reports, and customer-facing pages correct. Hover any field label for a quick tip; press F1 while hovering for the full description.`,
  }
}

export type ResolveFieldHelpInput = {
  helpKey?: string
  hoverHint?: string
  fullHelp?: string
  labelText?: string
}

export function resolveFieldHelp({
  helpKey,
  hoverHint,
  fullHelp,
  labelText = '',
}: ResolveFieldHelpInput): FieldHelpCopy | null {
  if (hoverHint?.trim() && fullHelp?.trim()) {
    return { hover: hoverHint.trim(), full: fullHelp.trim() }
  }
  const runtime =
    getFieldMappingByLabel(helpKey ?? '') ?? getFieldMappingByLabel(labelText)
  if (runtime?.help_short?.trim() && runtime?.help_full?.trim()) {
    return { hover: runtime.help_short.trim(), full: runtime.help_full.trim() }
  }
  if (runtime?.help_short?.trim()) {
    return {
      hover: runtime.help_short.trim(),
      full:
        runtime.help_full?.trim() ||
        `Use "${runtime.ui_label}" when working with ${runtime.table_name}.${runtime.column_name}.`,
    }
  }
  if (helpKey?.trim()) {
    const byKey = FIELD_HELP_BY_LABEL[normalizeLabelKey(helpKey)]
    if (byKey) return byKey
  }
  const normalized = normalizeLabelKey(labelText)
  if (!normalized) return null
  if (FIELD_HELP_BY_LABEL[normalized]) return FIELD_HELP_BY_LABEL[normalized]
  return generateDefaultFieldHelp(labelText)
}

/** @deprecated Use FIELD_HELP_BY_LABEL — kept for external-domain imports */
export const EXTERNAL_DOMAIN_FIELD_HELP = {
  domainScope: FIELD_HELP_BY_LABEL['where does this domain apply?'],
  dnsMode: FIELD_HELP_BY_LABEL['how should dns be configured?'],
  domainName: FIELD_HELP_BY_LABEL['domain name'],
  registrar: FIELD_HELP_BY_LABEL.registrar,
  regEmail: FIELD_HELP_BY_LABEL['registrar login email'],
  holder: FIELD_HELP_BY_LABEL['account holder name'],
  expiry: FIELD_HELP_BY_LABEL['domain expiry date'],
  recoveryContact: FIELD_HELP_BY_LABEL['2fa recovery contact'],
} as const
