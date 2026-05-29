import { v4 as uuid } from 'uuid'
import type { BlockProps, NavbarNavLink } from '../types/builder'

export function defaultNavbarLinks(): NavbarNavLink[] {
  return [
    { id: uuid(), label: 'Home' },
    { id: uuid(), label: 'Products' },
    { id: uuid(), label: 'Contact' },
  ]
}

export function resolveNavbarLinks(props: BlockProps): NavbarNavLink[] {
  if (props.navbarLinks?.length) return props.navbarLinks
  return (props.items ?? []).map((label, i) => ({ id: `legacy-${i}-${label}`, label }))
}

export function defaultNavbarProps(companyName = 'My Website'): Partial<BlockProps> {
  return {
    companyName,
    items: ['Home', 'Products', 'Contact'],
    navbarLinks: defaultNavbarLinks(),
    navbarShowLogo: true,
    navbarLogoUrl: '',
    navbarShowLinks: true,
    navbarShowSearch: true,
    navbarSearchPlaceholder: 'Search products…',
    navbarShowLogin: true,
    navbarLoginText: 'Log in',
    navbarLoginLink: 'login',
    navbarShowCart: true,
    visible: true,
  }
}

export function mergeNavbarProps(props: BlockProps, companyName?: string): BlockProps {
  const defaults = defaultNavbarProps(companyName ?? props.companyName)
  const merged = { ...defaults, ...props }
  if (!merged.navbarLinks?.length) {
    merged.navbarLinks = resolveNavbarLinks(merged)
  }
  return merged
}
