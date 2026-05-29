import type { BlockProps, FooterColumn, FooterLink, FooterSocialLink } from '../types/builder'

export function buildDefaultFooterColumns(navItems: string[]): FooterColumn[] {
  const shopLinks: FooterLink[] = []
  if (navItems.includes('Products')) shopLinks.push({ label: 'Products', url: '#products' })
  if (navItems.includes('Services')) shopLinks.push({ label: 'Services', url: '#services' })
  if (navItems.includes('Cart')) shopLinks.push({ label: 'Cart', url: '#cart' })

  const columns: FooterColumn[] = []
  if (shopLinks.length) columns.push({ title: 'Shop', links: shopLinks })
  columns.push(
    {
      title: 'Company',
      links: [
        { label: 'About Us', url: '#home' },
        { label: 'Contact', url: '#contact' },
      ],
    },
    {
      title: 'Support',
      links: [
        { label: 'Help Center', url: '#' },
        { label: 'Shipping & Returns', url: '#' },
        { label: 'Privacy Policy', url: '#privacy' },
      ],
    },
  )
  return columns
}

export function defaultSocialLinks(): FooterSocialLink[] {
  return [
    { platform: 'Facebook', url: 'https://facebook.com' },
    { platform: 'Instagram', url: 'https://instagram.com' },
    { platform: 'Twitter', url: 'https://twitter.com' },
    { platform: 'LinkedIn', url: 'https://linkedin.com' },
  ]
}

export function defaultLegalLinks(): FooterLink[] {
  return [
    { label: 'Privacy Policy', url: '#privacy' },
    { label: 'Terms & Conditions', url: '#terms' },
  ]
}

export function createFullFooterProps(companyName: string, navItems: string[]): BlockProps {
  const year = new Date().getFullYear()
  return {
    visible: true,
    companyName,
    tagline: 'Quality products and friendly service — built for your success.',
    text: `© ${year} ${companyName}. All rights reserved.`,
    subtitle: '',
    email: 'hello@example.com',
    phone: '+1 (555) 123-4567',
    address: '123 Business Ave, Suite 100\nSan Francisco, CA 94102',
    items: navItems,
    footerColumns: buildDefaultFooterColumns(navItems),
    socialLinks: defaultSocialLinks(),
    legalLinks: defaultLegalLinks(),
    showNewsletter: true,
    newsletterTitle: 'Subscribe to our newsletter',
    newsletterPlaceholder: 'Your email address',
  }
}

export function createMinimalFooterProps(companyName: string): BlockProps {
  const year = new Date().getFullYear()
  return {
    visible: true,
    companyName,
    text: `© ${year} ${companyName}. All rights reserved.`,
    legalLinks: [
      { label: 'Privacy', url: '#privacy' },
      { label: 'Terms', url: '#terms' },
    ],
  }
}
