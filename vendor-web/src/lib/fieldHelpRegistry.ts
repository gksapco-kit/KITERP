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

  // ── System · Message Center ──
  'message center': {
    hover: 'Configure who gets notified and how messages are sent.',
    full:
      'Message Center controls outbound notifications per business unit: which events trigger alerts, who receives them (email and phone), scheduled message templates for customers and your team, and which channels (email, SMS, WhatsApp) are enabled. Settings save automatically when you change them. Hover any section title or field label for a quick tip; press F1 while hovering for full help.',
  },
  'message center:business unit': {
    hover: 'Settings apply to the selected shop or branch only.',
    full:
      'Each business unit can have its own recipients, templates, and channel toggles. Select the unit you are configuring before adding emails, phones, or templates. Switching units loads that unit\'s saved configuration.',
  },
  'select business unit': {
    hover: 'Choose which shop or branch to configure.',
    full:
      'Pick the business unit whose message settings you want to edit. Recipients and templates do not copy automatically between units — configure each location that should send notifications.',
  },
  'message center:delivery providers': {
    hover: 'Shows whether email, SMS, and WhatsApp can send.',
    full:
      'Email is ready when SMTP or SendGrid is configured (Settings or environment). SMS and WhatsApp require Twilio or Meta credentials under CRM → Integrations. Channels show as "setup needed" until providers are connected; toggles for SMS/WhatsApp stay disabled until ready.',
    footerNote: 'Open CRM → Integrations to connect Twilio or Meta for SMS and WhatsApp.',
  },
  'message center:new orders': {
    hover: 'Alerts when a customer places an order.',
    full:
      'Configure who on your team receives new-order notifications and which scheduled templates go to customers or staff. Add email and phone recipients per event; leave lists empty to fall back to your vendor support email or contact phone. Templates support placeholders like {customer_name}, {order_number}, and {total}.',
  },
  'message center:order status updates': {
    hover: 'Notifications when order status changes.',
    full:
      'Use this section when you want emails or texts for milestones such as confirmed, packed, shipped, or delivered. Add recipients and optional templates with start/end dates for seasonal messaging. Each template can target email, SMS, and/or WhatsApp.',
  },
  'message center:customer inquiries': {
    hover: 'Messages from contact forms, chat, or support.',
    full:
      'Route inbound-style alerts to your team when customers reach out through your storefront or support channels. Add operations emails and mobile numbers that should be notified immediately.',
  },
  'message center:system notifications': {
    hover: 'Platform and account-level system alerts.',
    full:
      'Receive internal alerts for maintenance, billing, security, or other system events. Useful for admin contacts who need to know about platform issues affecting your store.',
  },
  'message center:vendor notification preferences': {
    hover: 'Channels for new-order alerts to your team.',
    full:
      'Turn on email, SMS, and/or WhatsApp for vendor-side new-order alerts. SMS and WhatsApp require a ready provider in Delivery providers. These toggles apply to team notifications, not customer confirmations.',
  },
  'message center:customer notification preferences': {
    hover: 'Channels for order confirmations to customers.',
    full:
      'Control how customers receive order confirmations — email is on by default; enable SMS or WhatsApp when your provider is configured. Customer messages use templates and placeholders defined under each event.',
  },
  'message center:email recipients': {
    hover: 'Team inboxes notified for this event.',
    full:
      'Add one or more email addresses that should receive alerts for this notification type. Optional labels help identify roles (e.g. "Warehouse"). When no recipients are listed, the vendor primary support email is used as fallback.',
  },
  'message center:phone recipients': {
    hover: 'Mobile numbers for SMS and WhatsApp alerts.',
    full:
      'Add E.164 phone numbers (country code included) for text alerts to your team. The same numbers can receive SMS and WhatsApp when those channels are enabled. Fallback: vendor contact phone when the list is empty.',
  },
  'message center:vendor message templates': {
    hover: 'Scheduled messages sent to your team.',
    full:
      'Create named templates with optional email subject, body text, active date range, and channels. Use placeholders such as {order_number} and {store_name}. Only templates within their schedule and marked enabled are sent.',
  },
  'message center:customer message templates': {
    hover: 'Scheduled messages sent to customers.',
    full:
      'Templates for customer-facing order or status messages. Include {customer_name}, {payment_note}, and other tokens. Set start and end times for campaigns or seasonal wording. Preview before saving to check sample text.',
  },
  'message center:template name': {
    hover: 'Internal name to identify this template.',
    full:
      'A short label for your reference in lists and reports — customers do not see this name unless you include it in the message body.',
  },
  'message center:email subject': {
    hover: 'Subject line for email channel only.',
    full:
      'Optional subject used when this template is sent by email. SMS and WhatsApp ignore the subject. You may use the same placeholders as the message body.',
  },
  'message center:message body': {
    hover: 'Text sent on enabled channels.',
    full:
      'Main message content. Insert placeholders from the hint list — they are replaced with real order data when sent. Keep SMS bodies short; long text may fail on trial SMS accounts.',
  },
  'message center:template channels': {
    hover: 'Which channels may send this template.',
    full:
      'Enable email, SMS, and/or WhatsApp for this template. A channel must be both enabled here and turned on under Customer or Vendor notification preferences, with a ready delivery provider.',
  },
  'message center:template schedule': {
    hover: 'Template is active only between these dates.',
    full:
      'Set start and end date/time in your local timezone. Outside this window the template is stored but not used for automated sends — useful for promotions or holiday wording.',
  },
  'message center:email recipient': {
    hover: 'Inbox that receives alerts for this event.',
    full:
      'Enter a valid email address for a team member or shared mailbox. This address receives notifications only for the event you are editing (e.g. New Orders), not every message in Message Center.',
  },
  'message center:recipient label': {
    hover: 'Optional note for who this contact is.',
    full:
      'A friendly name such as "Night shift" or "Store manager" — shown only in the admin list, not in outbound messages.',
  },

  // ── Rental module — asset sheet sections ──
  basics: {
    hover: 'Core identity — name, category, and asset type.',
    full:
      'Set the asset name customers and your team will see, choose the category (e.g. Milk Dairy, Vehicles) and the asset type within that category. The name appears on booking confirmations and storefront listings.',
  },
  pricing: {
    hover: 'Daily, weekly, and monthly rental rates plus deposit.',
    full:
      'Enter the rate charged per day, per week, or per month. At least a daily rate is required. The security deposit is collected upfront and refunded on return after deducting any damage or late fees. Extra qty / weight charges apply when the customer exceeds the base capacity.',
  },
  'storefront availability': {
    hover: 'Control when this asset appears on your storefront.',
    full:
      'Choose "Always available" to show this asset every day, or "Date range" to set a specific display window. Approved bookings automatically expand the window so customers can always see occupied dates. Set end date to hide the asset once the rental season ends.',
  },
  'location, status & notes': {
    hover: 'Physical location, current status, and internal notes.',
    full:
      'Location fields (section, row, rack number) help your team find the asset in a warehouse or store. Status controls availability — set to Maintenance or Unavailable to block new bookings without deleting the asset. Notes are internal only.',
  },
  'sub-assets & unit tracking': {
    hover: 'Choose how individual items within this asset are tracked.',
    full:
      'Three modes are available:\n\n• None — track only total capacity (default, suits most assets).\n\n• Hierarchy — this asset is part of a parent/child tree (e.g. individual van inside a fleet group). Set the parent asset here.\n\n• Serialized units — each physical item has its own serial number (e.g. numbered cylinders or racks). After saving the asset in this mode, add individual units with serial numbers. On return, operators select exactly which units came back and record their condition.',
    footerNote: 'Save the asset after changing the tracking mode before adding units.',
  },

  // ── Rental module — unit fields ──
  'serial no': {
    hover: 'Unique identifier printed on the physical item.',
    full:
      'Enter the serial number, barcode, or any code that uniquely identifies this individual unit. It will appear on return checklists so operators can tick off each item as it comes back.',
  },
  'tracking mode': {
    hover: 'How individual items within this asset are tracked.',
    full:
      'None: total capacity only. Hierarchy: child assets under a parent (e.g. van inside a fleet). Serialized units: individual serial-numbered items (e.g. cylinders, racks). Change and save — then add units from the same section.',
  },
  'parent asset': {
    hover: 'The container asset this one belongs to.',
    full:
      'Assign this asset as a child of another (e.g. "Van 03" inside "City Fleet"). The parent must be saved first and should use Hierarchy tracking mode. Only top-level assets appear in the list.',
  },
  'initial condition': {
    hover: 'Condition of this unit when it is first added.',
    full:
      'Good = rental-ready. Damaged = under repair (excluded from available capacity). Lost = permanently removed from the pool. Retired = decommissioned. You can update the condition later from the asset\'s unit list.',
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
