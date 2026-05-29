import { LogIn, LogOut, Search, ShoppingCart, User } from 'lucide-react'
import { parseLinkToSlug } from '../../lib/buttonNavigation'
import { blockBackgroundStyle, blockInnerLayoutStyle } from '../../lib/blockUtils'
import { mergeNavbarProps, resolveNavbarLinks } from '../../lib/navbarDefaults'
import { useAuthStore } from '../../store/useAuthStore'
import { useBuilderStore } from '../../store/useBuilderStore'
import { PAGE_CONTENT_PADDING, PAGE_MAX_WIDTH_CLASS } from '../../lib/pageLayout'
import type { Block } from '../../types/builder'

interface NavbarBlockProps {
  block: Block
  layoutStyle?: React.CSSProperties
  interactive?: boolean
  onNavigate?: (slug: string) => void
  onCartClick?: () => void
  activeSlug?: string
}

function navLabelToSlug(label: string): string {
  const map: Record<string, string> = {
    Home: 'home',
    Products: 'products',
    Services: 'services',
    Cart: 'cart',
    Checkout: 'checkout',
    Contact: 'contact',
    Login: 'login',
    'Log in': 'login',
    Signup: 'signup',
    'Sign up': 'signup',
  }
  return map[label] ?? label.toLowerCase().replace(/\s+/g, '-')
}

export function NavbarBlock({
  block,
  layoutStyle,
  interactive,
  onNavigate,
  onCartClick,
  activeSlug,
}: NavbarBlockProps) {
  const pages = useBuilderStore((s) => s.pages)
  const cart = useBuilderStore((s) => s.cart)
  const authUser = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const props = mergeNavbarProps(block.props)
  const shellStyle = {
    ...blockBackgroundStyle(block.styles),
    ...blockInnerLayoutStyle(block.styles),
    ...layoutStyle,
  }
  const links = resolveNavbarLinks(props)

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const handleLogin = (e: React.MouseEvent) => {
    if (!interactive) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    const href = props.navbarLoginLink?.trim() ?? ''
    if (href.startsWith('http://') || href.startsWith('https://')) {
      window.open(href, '_blank', 'noopener,noreferrer')
      return
    }
    const slug = parseLinkToSlug(props.navbarLoginLink, pages)
    onNavigate?.(slug)
  }

  const handleCart = (e: React.MouseEvent) => {
    if (!interactive) return
    e.preventDefault()
    if (onCartClick) {
      onCartClick()
      return
    }
    onNavigate?.('cart')
  }

  return (
    <nav
      style={shellStyle}
      className="w-full border-b border-gray-200/80 bg-white/95 backdrop-blur-md dark:border-gray-700/80 dark:bg-gray-900/95"
    >
      <div className={`mx-auto flex w-full ${PAGE_MAX_WIDTH_CLASS} flex-wrap items-center justify-between gap-3 py-3 sm:gap-4 ${PAGE_CONTENT_PADDING}`}>
        <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-8">
          {props.navbarShowLogo !== false && (
            <button
              type="button"
              onClick={() => interactive && onNavigate?.('home')}
              className="flex shrink-0 items-center gap-2.5 text-left"
            >
              {props.navbarLogoUrl ? (
                <img
                  src={props.navbarLogoUrl}
                  alt={props.companyName ?? 'Logo'}
                  className="h-9 w-9 rounded-lg object-cover ring-1 ring-gray-200"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
                  {(props.companyName ?? 'W').charAt(0).toUpperCase()}
                </span>
              )}
              <span className="truncate text-base font-bold tracking-tight text-gray-900 sm:text-lg">
                {props.companyName ?? 'My Website'}
              </span>
            </button>
          )}

          {props.navbarShowLinks !== false && links.length > 0 && (
            <ul className="hidden items-center gap-1 md:flex">
              {links.map((item) => {
                const slug = item.link ? item.link.replace(/^#/, '') : navLabelToSlug(item.label)
                const isActive = activeSlug === slug
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => interactive && onNavigate?.(slug)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
          {props.navbarShowSearch !== false && (
            <label className="relative hidden min-w-[140px] max-w-[220px] flex-1 sm:block lg:min-w-[200px] lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                readOnly={!interactive}
                placeholder={props.navbarSearchPlaceholder ?? 'Search…'}
                className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
                onClick={(e) => e.stopPropagation()}
              />
            </label>
          )}

          {props.navbarShowLogin !== false && (
            authUser ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
                  <User className="h-4 w-4 text-brand-600" />
                  <span className="hidden max-w-[120px] truncate sm:inline">{authUser.name.split(' ')[0]}</span>
                </span>
                <button
                  type="button"
                  onClick={() => interactive && logout()}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-red-200 hover:text-red-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  title="Log out"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Log out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLogin}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                <LogIn className="h-4 w-4 text-gray-500" />
                <span className="hidden sm:inline">{props.navbarLoginText ?? 'Log in'}</span>
              </button>
            )
          )}

          {props.navbarShowCart !== false && (
            <button
              type="button"
              onClick={handleCart}
              className="relative inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-brand-300 hover:bg-brand-50/50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            >
              <ShoppingCart className="h-4 w-4 text-gray-600" />
              <span className="hidden sm:inline">
                {cartCount === 0 ? 'Cart' : `$${cartTotal.toFixed(2)}`}
              </span>
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
