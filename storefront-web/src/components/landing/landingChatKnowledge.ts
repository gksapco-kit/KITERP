import { LANDING_MODULES } from '@/components/landing/landingData'

export type ChatContact = {
  email?: string | null
  phone?: string | null
  address?: string | null
}

export type ChatMessage = {
  id: string
  role: 'bot' | 'user'
  text: string
}

const MODULE_BLURBS = LANDING_MODULES.map(
  (m) => `• ${m.title}: ${m.description}`,
).join('\n')

const MODULE_NAMES = LANDING_MODULES.map((m) => m.title.toLowerCase()).join(' ')

function normalize(q: string) {
  return q
    .toLowerCase()
    .replace(/[^\w\s+/₹.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasAny(text: string, words: string[]) {
  return words.some((w) => {
    if (w.length <= 3) {
      return new RegExp(`(?:^|\\s)${w}(?:\\s|$)`).test(text)
    }
    return text.includes(w)
  })
}

function formatContact(contact: ChatContact | null): string {
  if (!contact) {
    return 'I don\'t have live contact details loaded yet. Use **Talk to us** / Contact, or try again in a moment.'
  }
  const lines: string[] = []
  if (contact.phone) lines.push(`Phone: ${contact.phone}`)
  if (contact.email) lines.push(`Email: ${contact.email}`)
  if (contact.address) lines.push(`Address: ${contact.address}`)
  if (lines.length === 0) {
    return 'Contact details aren\'t set in Admin yet. You can still leave a message on the Contact page.'
  }
  return `Here’s how to reach the KIT ERP team:\n${lines.join('\n')}\n\nOr open the Contact page and send us a message.`
}

/** Rule-based replies for landing visitors (contact, pricing, products, getting started). */
export function replyToLandingQuestion(raw: string, contact: ChatContact | null): string {
  const q = normalize(raw)
  if (!q) {
    return 'Ask me about pricing, apps/modules, how to sign up, or how to contact us.'
  }

  if (hasAny(q, ['hi', 'hello', 'hey', 'good morning', 'good evening', 'namaste'])) {
    return 'Hi! I\'m the KIT ERP helper. Ask about pricing, what\'s included, signup, or contact details.'
  }

  if (hasAny(q, ['thank', 'thanks', 'thx'])) {
    return 'You\'re welcome! Anything else — pricing, products, or contact?'
  }

  if (hasAny(q, ['bye', 'goodbye', 'see you'])) {
    return 'Bye! When you\'re ready, hit Get started or Talk to us on the homepage.'
  }

  if (
    hasAny(q, [
      'contact',
      'email',
      'phone',
      'mobile',
      'call',
      'address',
      'reach',
      'support',
      'talk to',
      'speak',
    ])
  ) {
    return formatContact(contact)
  }

  if (
    hasAny(q, [
      'price',
      'pricing',
      'cost',
      'fee',
      '₹',
      'rs',
      'rupee',
      'month',
      'subscription',
      'free',
      'plan',
      'charge',
    ])
  ) {
    return (
      'Pricing is simple right now:\n' +
      '• ₹0.00 / month for ALL apps\n' +
      'One login covers business, team, and website tools on KIT ERP.\n\n' +
      'Use Get started to create your business account — no monthly fee listed on the landing page.'
    )
  }

  if (
    hasAny(q, [
      'product',
      'module',
      'app',
      'feature',
      'include',
      'offer',
      'capability',
      'what can',
      'what do you',
      'inventory',
      'crm',
      'hr',
      'finance',
      'website',
      'pos',
      'restaurant',
      'sales',
      'procurement',
    ]) ||
    hasAny(q, MODULE_NAMES.split(' ').filter((w) => w.length > 3))
  ) {
    return (
      'KIT ERP is one platform for your business, team, and website. Main areas:\n' +
      `${MODULE_BLURBS}\n\n` +
      'Hover modules on the homepage orbit to preview apps, or ask about a specific area (e.g. “HR” or “Website”).'
    )
  }

  if (hasAny(q, ['sign up', 'signup', 'register', 'create account', 'get started', 'onboard', 'start'])) {
    return (
      'To get started:\n' +
      '1. Click Get started on the homepage\n' +
      '2. Create your business account\n' +
      '3. Sign in to the vendor dashboard\n\n' +
      'Already have an account? Use Sign in in the header.'
    )
  }

  if (hasAny(q, ['login', 'log in', 'sign in', 'signin', 'vendor login', 'admin'])) {
    return (
      'Sign in from the header (Sign in), or open the vendor login from the footer.\n' +
      'Platform admins use the Admin portal link in the footer.'
    )
  }

  if (hasAny(q, ['what is', 'whats', 'about', 'kiterp', 'kit erp', 'platform', 'who are'])) {
    return (
      'KIT ERP is a multi-vendor business platform: commerce, services, HR, CRM, finance, production, restaurant, ' +
      'and a storefront/website builder — with one login.\n\n' +
      'Tagline: One Login, Yet Affordable, Scalable, ROI-Driven, and User-Friendly.'
    )
  }

  if (hasAny(q, ['store', 'storefront', 'shop', 'vendor store', 'open store'])) {
    return (
      'Businesses get a storefront/website plus vendor tools (orders, catalog, POS, and more).\n' +
      'Browse stores from the homepage community section, or create yours via Get started.'
    )
  }

  if (hasAny(q, ['help', 'assist', 'support ticket', 'human', 'agent'])) {
    return (
      `${formatContact(contact)}\n\n` +
      'For a written question, open Contact and use Send a message — it shows up under Admin → Queries.'
    )
  }

  return (
    'I can help with basic questions about:\n' +
    '• Contact info\n' +
    '• Pricing (₹0/month for all apps)\n' +
    '• Products / modules\n' +
    '• Signup & login\n\n' +
    'Try asking e.g. “What is the price?” or “How do I contact you?”'
  )
}

export const CHAT_QUICK_PROMPTS = [
  'What is the pricing?',
  'What products are included?',
  'How do I contact you?',
  'How do I get started?',
] as const

export const OPEN_LANDING_CHAT_EVENT = 'kiterp:open-landing-chat'
