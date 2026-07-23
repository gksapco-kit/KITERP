import { type ReactNode, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, Search, ShoppingBag, X, ArrowRight } from 'lucide-react'
import { useStorefront, formatMoney } from '../StorefrontContext'

interface NavItem {
  label: string
  to: string
}

interface StorefrontShellProps {
  storeName: string
  tagline?: string
  nav: NavItem[]
  basePath: string
  children: ReactNode
  variant?: 'light' | 'dark'
}

export const StorefrontShell = ({ storeName, tagline, nav, basePath, children }: StorefrontShellProps) => {
  const navigate = useNavigate()
  const { cart, updateLine, removeLine } = useStorefront()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const lineCount = cart?.lines.reduce((s, l) => s + l.quantity, 0) ?? 0

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'hsl(var(--sf-bg))', color: 'hsl(var(--sf-fg))' }}>
      {/* Announcement bar */}
      <div className="border-b text-xs py-2 px-4 text-center" style={{ borderColor: 'hsl(var(--sf-border))', background: 'hsl(var(--sf-primary))', color: 'hsl(var(--sf-primary-foreground))' }}>
        Free shipping over $150 · Easy 30-day returns · Powered by your ERP
      </div>

      {/* Header */}
      <header className="border-b sticky top-0 z-30 backdrop-blur" style={{ borderColor: 'hsl(var(--sf-border))', background: 'hsl(var(--sf-bg) / 0.85)' }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4 min-w-0">
          <button type="button" className="md:hidden p-2 shrink-0" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>

          <Link to={basePath} className="flex flex-col leading-tight min-w-0 flex-1 md:flex-none text-left md:text-center">
            <span className="text-base sm:text-xl tracking-tight truncate" style={{ fontFamily: 'var(--sf-display)' }}>{storeName}</span>
            {tagline ? <span className="text-xs sm:text-xs uppercase tracking-[0.14em] sm:tracking-[0.18em] opacity-70 truncate">{tagline}</span> : null}
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm shrink-0">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="hover:opacity-70 transition-opacity">{n.label}</Link>
            ))}
          </nav>

          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button type="button" className="p-2 rounded-md hover:opacity-80" aria-label="Search">
              <Search className="h-5 w-5" />
            </button>
            <button type="button" className="p-2 relative rounded-md hover:opacity-80" aria-label="Open cart" onClick={() => setCartOpen(true)}>
              <ShoppingBag className="h-5 w-5" />
              {lineCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full text-xs font-medium flex items-center justify-center px-1" style={{ background: 'hsl(var(--sf-accent))', color: 'hsl(var(--sf-primary-foreground))' }}>
                  {lineCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-40 md:hidden" style={{ background: 'hsl(var(--sf-bg))' }}>
            <div className="h-16 flex items-center justify-between px-4 border-b" style={{ borderColor: 'hsl(var(--sf-border))' }}>
              <span className="text-xl" style={{ fontFamily: 'var(--sf-display)' }}>{storeName}</span>
              <button onClick={() => setMobileOpen(false)} className="p-2" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col p-6 gap-5 text-lg">
              {nav.map((n) => (
                <Link key={n.to} to={n.to} onClick={() => setMobileOpen(false)} className="border-b pb-3" style={{ borderColor: 'hsl(var(--sf-border))' }}>
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t mt-16 py-12 px-4" style={{ borderColor: 'hsl(var(--sf-border))' }}>
        <div className="max-w-7xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm">
          <div>
            <div className="text-lg mb-3" style={{ fontFamily: 'var(--sf-display)' }}>{storeName}</div>
            <p className="opacity-70 max-w-xs">A demo business front powered by KITERP. Replace this copy from your dashboard.</p>
          </div>
          <FooterCol title="Shop" links={nav.map((n) => n.label)} />
          <FooterCol title="Help" links={['Shipping', 'Returns', 'Size guide', 'Contact']} />
          <FooterCol title="Company" links={['About', 'Stores', 'Press', 'Careers']} />
        </div>
        <div className="max-w-7xl mx-auto mt-10 pt-6 border-t flex flex-wrap items-center justify-between gap-3 text-xs opacity-70" style={{ borderColor: 'hsl(var(--sf-border))' }}>
          <span>© {new Date().getFullYear()} {storeName}. All rights reserved.</span>
          <span>Business Front template — demo data</span>
        </div>
      </footer>

      {/* Cart side drawer */}
      {cartOpen ? (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setCartOpen(false)} />
          <div className="fixed inset-y-0 right-0 w-full sm:max-w-md z-50 flex flex-col shadow-2xl" style={{ background: 'hsl(var(--sf-bg))', color: 'hsl(var(--sf-fg))' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'hsl(var(--sf-border))' }}>
              <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--sf-display)' }}>
                Your cart
                {lineCount > 0 && <span className="ml-2 text-sm font-normal opacity-60">({lineCount} {lineCount === 1 ? 'item' : 'items'})</span>}
              </h2>
              <button onClick={() => setCartOpen(false)} className="p-1 opacity-70 hover:opacity-100" aria-label="Close cart">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!cart || cart.lines.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-sm opacity-70 px-6">
                <ShoppingBag className="h-12 w-12 opacity-30" />
                <p>Your cart is empty.</p>
                <button onClick={() => setCartOpen(false)} className="text-xs underline">Continue shopping</button>
              </div>
            ) : (
              <>
                <ul className="flex-1 overflow-auto px-6 divide-y" style={{ borderColor: 'hsl(var(--sf-border))' }}>
                  {cart.lines.map((line) => (
                    <li key={line.id} className="py-4 flex gap-3 items-start">
                      {line.imageUrl && (
                        <div className="w-16 h-16 shrink-0 rounded overflow-hidden" style={{ background: 'hsl(var(--sf-muted))' }}>
                          <img src={line.imageUrl} alt={line.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{line.name}</div>
                        {line.variantLabel && <div className="text-xs opacity-60 mt-0.5">{line.variantLabel}</div>}
                        <div className="text-sm font-medium mt-1">{formatMoney(line.unitPrice)}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => updateLine(line.id, Math.max(0, line.quantity - 1))}
                            className="border w-7 h-7 rounded flex items-center justify-center text-lg leading-none hover:opacity-70"
                            style={{ borderColor: 'hsl(var(--sf-border))' }}
                          >−</button>
                          <span className="text-sm w-5 text-center">{line.quantity}</span>
                          <button
                            onClick={() => updateLine(line.id, line.quantity + 1)}
                            className="border w-7 h-7 rounded flex items-center justify-center text-lg leading-none hover:opacity-70"
                            style={{ borderColor: 'hsl(var(--sf-border))' }}
                          >+</button>
                          <button onClick={() => removeLine(line.id)} className="ml-auto text-xs underline opacity-60 hover:opacity-100">Remove</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="border-t px-6 pt-4 pb-6 space-y-3" style={{ borderColor: 'hsl(var(--sf-border))' }}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="opacity-70">Subtotal</span>
                    <span className="font-medium">{formatMoney(cart.subtotal)}</span>
                  </div>
                  <p className="text-xs opacity-50">Shipping and taxes calculated at checkout.</p>
                  <button
                    className="w-full h-11 flex items-center justify-center gap-2 font-medium text-sm rounded-none"
                    style={{ background: 'hsl(var(--sf-primary))', color: 'hsl(var(--sf-primary-foreground))' }}
                    onClick={() => { setCartOpen(false); navigate(`${basePath}/cart`) }}
                  >
                    View cart <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    className="w-full h-11 flex items-center justify-center gap-2 font-medium text-sm border rounded-none hover:opacity-80"
                    style={{ borderColor: 'hsl(var(--sf-border))' }}
                    onClick={() => { setCartOpen(false); navigate(`${basePath}/checkout`) }}
                  >
                    Checkout <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}

const FooterCol = ({ title, links }: { title: string; links: string[] }) => (
  <div>
    <div className="text-xs uppercase tracking-[0.18em] opacity-70 mb-3">{title}</div>
    <ul className="space-y-2">
      {links.map((l) => (
        <li key={l}><a href="#" className="hover:opacity-100 opacity-90">{l}</a></li>
      ))}
    </ul>
  </div>
)
