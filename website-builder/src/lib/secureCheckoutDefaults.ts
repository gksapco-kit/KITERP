import { v4 as uuid } from 'uuid'
import type { TrustBadgeItem } from '../types/builder'

export const SECURE_CHECKOUT_DEFAULTS = {
  secureCheckoutLayout: 'grid' as const,
  showSecureHighlight: true,
  highlightTitle: '100% secure checkout',
  highlightSubtitle: 'Your payment and personal data are protected at every step.',
}

export function createTrustBadge(overrides: Partial<TrustBadgeItem> = {}): TrustBadgeItem {
  return {
    id: uuid(),
    title: 'Trust badge',
    description: 'Short reassurance line',
    icon: 'shield',
    enabled: true,
    ...overrides,
  }
}

export function defaultTrustBadges(): TrustBadgeItem[] {
  return [
    {
      id: 'ssl',
      title: 'SSL encrypted',
      description: '256-bit encryption on every transaction',
      icon: 'lock',
      enabled: true,
    },
    {
      id: 'guarantee',
      title: 'Money-back guarantee',
      description: 'Shop with confidence — easy refunds',
      icon: 'refresh',
      enabled: true,
    },
    {
      id: 'secure-pay',
      title: 'Secure payments',
      description: 'PCI-compliant payment processing',
      icon: 'shield',
      enabled: true,
    },
    {
      id: 'support',
      title: '24/7 support',
      description: "We're here if you need help",
      icon: 'headphones',
      enabled: true,
    },
  ]
}

export function defaultSecureCheckoutProps() {
  return {
    text: 'Shop with confidence',
    subtitle: 'Trusted by thousands of customers worldwide',
    trustBadges: defaultTrustBadges(),
    ...SECURE_CHECKOUT_DEFAULTS,
  }
}
