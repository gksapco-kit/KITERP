import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search, ShoppingCart, User, Menu, LogIn, UserPlus, Package, LogOut, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { AccountUser, NavLinkItem } from "../types";

export interface UnifiedNavProps {
  logo?: React.ReactNode;
  /** Target for the logo link (business front should pass `storePath("/')`). Defaults to `/`. */
  logoHomeTo?: string;
  /** Rendered after the logo (e.g. branch / store selector). */
  afterLogo?: React.ReactNode;
  /** Extra block inside the mobile sheet below nav links. */
  sheetExtra?: React.ReactNode;
  links: NavLinkItem[];
  /** In builder canvas, always show page links (ignore md:hidden). */
  linksLayout?: 'responsive' | 'always-visible';
  /** Extra controls in the header tray (e.g. business front notification bell). */
  extraTray?: React.ReactNode;
  showSearch?: boolean;
  showCart?: boolean;
  showAccount?: boolean;
  cartCount?: number;
  cartHref?: string;
  user?: AccountUser | null;
  cta?: { label: string; href: string };
  variant?: 'bordered' | 'transparent' | 'centered';
  sticky?: boolean;
  onSearch?: (q: string) => void;
  onSignOut?: () => void;
  /** Override account-related link paths (e.g. store-prefixed paths) */
  accountPaths?: {
    signIn?: string;
    register?: string;
    account?: string;
    orders?: string;
    bookings?: string;
    wishlist?: string;
    profile?: string;
    notifications?: string;
  };
}

export function UnifiedNav({
  logo,
  logoHomeTo = "/",
  afterLogo,
  sheetExtra,
  links,
  linksLayout = 'responsive',
  extraTray,
  showSearch = true,
  showCart = true,
  showAccount = true,
  cartCount = 0,
  cartHref = "/cart",
  user,
  cta,
  variant = "bordered",
  sticky = true,
  onSearch,
  onSignOut,
  accountPaths = {},
}: UnifiedNavProps) {
  const [q, setQ] = useState("");
  const location = useLocation();

  const p = {
    signIn: accountPaths.signIn ?? "/sign-in",
    register: accountPaths.register ?? "/register",
    account: accountPaths.account ?? "/account",
    orders: accountPaths.orders ?? "/account/orders",
    bookings: accountPaths.bookings ?? "/account/bookings",
    wishlist: accountPaths.wishlist ?? "/account/wishlist",
    profile: accountPaths.profile ?? "/account/profile",
    notifications: accountPaths.notifications ?? "/account/notifications",
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(q);
    else if (q.trim()) window.location.href = `/products?q=${encodeURIComponent(q)}`;
  };

  return (
    <header
      className={cn(
        "w-full z-40 bg-background",
        sticky && "sticky top-0",
        variant === "bordered" && "border-b",
        variant === "transparent" && "bg-transparent backdrop-blur-sm",
      )}
    >
      <div
        className={cn(
          "container mx-auto flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-14 sm:h-16 min-w-0 max-w-full",
          variant === "centered" && "justify-between",
        )}
      >
        {/* Mobile menu */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden shrink-0 -ml-1" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
            <nav className="mt-6 flex flex-col gap-1">
              {links.map((l) => (
                <Link key={l.href} to={l.href} className="px-3 py-2 rounded-md hover:bg-muted text-base">
                  {l.label}
                </Link>
              ))}
            </nav>
            {sheetExtra && <div className="mt-6 border-t pt-4">{sheetExtra}</div>}
            {showSearch && (
              <form onSubmit={submitSearch} className="mt-6 flex gap-2">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..." />
                <Button type="submit" size="icon"><Search /></Button>
              </form>
            )}
            <div className="mt-6 flex flex-col gap-2">
              {showAccount && !user && (
                <>
                  <Button variant="outline" asChild>
                    <Link to={p.signIn} state={{ from: location.pathname }}><LogIn /> Sign in</Link>
                  </Button>
                  <Button asChild>
                    <Link to={p.register}><UserPlus /> Register</Link>
                  </Button>
                </>
              )}
              {showAccount && user && (
                <>
                  <Link to={p.account} className="px-3 py-2 rounded-md hover:bg-muted text-base flex items-center gap-2"><User className="h-4 w-4" />My Account</Link>
                  <Link to={p.orders} className="px-3 py-2 rounded-md hover:bg-muted text-base flex items-center gap-2"><Package className="h-4 w-4" />My Orders</Link>
                  <Link to={p.bookings} className="px-3 py-2 rounded-md hover:bg-muted text-base flex items-center gap-2"><Package className="h-4 w-4" />My Bookings</Link>
                  <Link to={p.wishlist} className="px-3 py-2 rounded-md hover:bg-muted text-base flex items-center gap-2"><User className="h-4 w-4" />Wishlist</Link>
                  <Link to={p.notifications} className="px-3 py-2 rounded-md hover:bg-muted text-base flex items-center gap-2"><Bell className="h-4 w-4" />Notifications</Link>
                  <button onClick={onSignOut} className="text-left px-3 py-2 rounded-md hover:bg-muted text-base flex items-center gap-2 text-destructive"><LogOut className="h-4 w-4" />Sign out</button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <Link
          to={logoHomeTo}
          className="font-semibold tracking-tight text-base sm:text-lg min-w-0 flex-1 md:flex-initial truncate max-w-[min(100%,56vw)] md:max-w-none [&_img]:max-w-[min(140px,42vw)] sm:[&_img]:max-w-[160px]"
        >
          {logo ?? "Acme ERP"}
        </Link>

        {afterLogo}

        <nav className={cn(
          'items-center gap-1 ml-2 lg:ml-4 shrink-0',
          linksLayout === 'always-visible' ? 'flex flex-wrap' : 'hidden md:flex',
        )}>
          {links.map((l) => (
            <Link
              key={l.href}
              to={l.href}
              className="px-3 py-2 rounded-md text-base text-foreground hover:bg-muted font-medium"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
          {showSearch && (
            <form onSubmit={submitSearch} className="hidden md:flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search products..."
                  className="pl-8 w-56 h-10 text-base"
                />
              </div>
            </form>
          )}

          {showCart && (
            <Button variant="ghost" size="icon" asChild className="relative" aria-label="Cart">
              <Link to={cartHref}>
                <ShoppingCart />
                {cartCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full text-xs">
                    {cartCount}
                  </Badge>
                )}
              </Link>
            </Button>
          )}

          {extraTray}

          {showAccount && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Account"><User /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user ? (
                  <>
                    <DropdownMenuLabel className="truncate">{user.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild><Link to={p.account}><User className="mr-2 h-4 w-4" />My Account</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to={p.orders}><Package className="mr-2 h-4 w-4" />My Orders</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to={p.bookings}><Package className="mr-2 h-4 w-4" />My Bookings</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to={p.wishlist}><User className="mr-2 h-4 w-4" />Wishlist</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to={p.notifications}><Bell className="mr-2 h-4 w-4" />Notifications</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to={p.profile}><User className="mr-2 h-4 w-4" />Profile & Settings</Link></DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to={p.signIn} state={{ from: location.pathname }}>
                        <LogIn className="mr-2 h-4 w-4" />Sign in
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={p.register}><UserPlus className="mr-2 h-4 w-4" />Register</Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {cta && (
            <Button asChild className="hidden md:inline-flex"><Link to={cta.href}>{cta.label}</Link></Button>
          )}
        </div>
      </div>
    </header>
  );
}

export interface AnnouncementBarProps {
  message: string;
  ctaLabel?: string;
  ctaHref?: string;
  dismissible?: boolean;
}

export function AnnouncementBar({ message, ctaLabel, ctaHref, dismissible = true }: AnnouncementBarProps) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="bg-primary text-primary-foreground text-sm">
      <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-3">
        <span>{message}</span>
        {ctaHref && ctaLabel && (
          <Link to={ctaHref} className="underline underline-offset-2">{ctaLabel}</Link>
        )}
        {dismissible && (
          <button
            onClick={() => setOpen(false)}
            aria-label="Dismiss"
            className="ml-auto opacity-80 hover:opacity-100"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
