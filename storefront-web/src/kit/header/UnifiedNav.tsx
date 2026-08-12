import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search, ShoppingCart, User, Menu, LogIn, UserPlus, Package, LogOut, Bell, X } from "lucide-react";
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
import {
  isNavLinkActive,
  resolveCurrentNavActiveKey,
} from "@/lib/siteNavPages";
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
    rentals?: string;
    wishlist?: string;
    profile?: string;
    notifications?: string;
  };
  /** Store path prefix helper — enables active nav link highlighting. */
  storePath?: (p: string) => string;
}

function AccountAvatar({ user }: { user?: AccountUser | null }) {
  if (!user) return <User className="h-7 w-7" />;
  const initial = (user.name || user.email || "U").trim().charAt(0).toUpperCase() || "U";
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name || "Account"}
        className="h-9 w-9 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
      {initial}
    </span>
  );
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
  storePath,
}: UnifiedNavProps) {
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  const currentNavKey = useMemo(() => {
    if (!storePath) return null;
    return resolveCurrentNavActiveKey(location, storePath);
  }, [location.pathname, location.search, storePath]);

  const navLinkClass = (href: string, mobile = false) => {
    const active = storePath && currentNavKey
      ? isNavLinkActive(href, currentNavKey, storePath)
      : false;
    return cn(
      mobile ? "px-3 py-2 rounded-md text-base" : "px-3 py-2 rounded-md text-base font-medium",
      active
        ? "font-semibold text-primary bg-primary/10"
        : mobile
          ? "hover:bg-muted"
          : "text-foreground hover:bg-muted",
    );
  };

  const p = {
    signIn: accountPaths.signIn ?? "/sign-in",
    register: accountPaths.register ?? "/register",
    account: accountPaths.account ?? "/account",
    orders: accountPaths.orders ?? "/account/orders",
    bookings: accountPaths.bookings ?? "/account/bookings",
    rentals: accountPaths.rentals ?? "/account/rentals",
    wishlist: accountPaths.wishlist ?? "/account/wishlist",
    profile: accountPaths.profile ?? "/account/profile",
    notifications: accountPaths.notifications ?? "/account/notifications",
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQ("");
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    closeSearch();
    if (onSearch) onSearch(trimmed);
    else window.location.href = `/products?search=${encodeURIComponent(trimmed)}`;
  };

  const mobileSearchBarNode = showSearch && searchOpen && (
    <form onSubmit={submitSearch} className="flex lg:hidden flex-1 items-center gap-1.5 min-w-0">
      <Input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products, prices, variants…"
        className="h-9 text-sm flex-1 min-w-0"
        aria-label="Search products"
      />
      <Button type="submit" size="icon" variant="ghost" aria-label="Submit search">
        <Search className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" onClick={closeSearch} aria-label="Close search">
        <X className="h-4 w-4" />
      </Button>
    </form>
  );

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
            <Button variant="ghost" size="icon" className="lg:hidden shrink-0" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
            <nav className="mt-6 flex flex-col gap-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  to={l.href}
                  className={navLinkClass(l.href, true)}
                  aria-current={storePath && currentNavKey && isNavLinkActive(l.href, currentNavKey, storePath) ? 'page' : undefined}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            {sheetExtra && <div className="mt-6 border-t pt-4">{sheetExtra}</div>}
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
                  <Link to={p.rentals} className="px-3 py-2 rounded-md hover:bg-muted text-base flex items-center gap-2"><Package className="h-4 w-4" />My Rentals</Link>
                  <Link to={p.wishlist} className="px-3 py-2 rounded-md hover:bg-muted text-base flex items-center gap-2"><User className="h-4 w-4" />Wishlist</Link>
                  <Link to={p.notifications} className="px-3 py-2 rounded-md hover:bg-muted text-base flex items-center gap-2"><Bell className="h-4 w-4" />Notifications</Link>
                  <button onClick={onSignOut} className="text-left px-3 py-2 rounded-md hover:bg-muted text-base flex items-center gap-2 text-destructive"><LogOut className="h-4 w-4" />Sign out</button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {mobileSearchBarNode ?? (
          <Link
            to={logoHomeTo}
            className="font-semibold tracking-tight text-base sm:text-lg min-w-0 flex-1 lg:flex-initial truncate max-w-[min(100%,56vw)] lg:max-w-none [&_img]:max-w-[min(200px,48vw)] sm:[&_img]:max-w-[280px]"
          >
            {logo ?? "Acme ERP"}
          </Link>
        )}

        {afterLogo}

        <nav
          className={cn(
            'ml-2 lg:ml-4 min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
            linksLayout === 'always-visible' ? 'block' : 'hidden lg:block',
          )}
          aria-label="Primary"
        >
          <div className="flex w-max min-w-full items-center justify-end gap-0.5 lg:gap-1 flex-nowrap">
            {links.map((l) => (
              <Link
                key={l.href}
                to={l.href}
                title={l.label}
                className={cn(navLinkClass(l.href), 'shrink-0 max-w-[9.5rem] truncate')}
                aria-current={storePath && currentNavKey && isNavLinkActive(l.href, currentNavKey, storePath) ? 'page' : undefined}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
          {showSearch && !searchOpen && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search />
            </Button>
          )}

          {showCart && (
            <Button variant="ghost" size="icon" asChild className="relative" aria-label="Cart">
              <Link to={cartHref}>
                <ShoppingCart className="h-7 w-7" />
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
                <Button variant="ghost" size="icon" aria-label="Account" className="rounded-full">
                  <AccountAvatar user={user} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user ? (
                  <>
                    <DropdownMenuLabel className="truncate">{user.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild><Link to={p.account}><User className="mr-2 h-4 w-4" />My Account</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to={p.orders}><Package className="mr-2 h-4 w-4" />My Orders</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to={p.bookings}><Package className="mr-2 h-4 w-4" />My Bookings</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link to={p.rentals}><Package className="mr-2 h-4 w-4" />My Rentals</Link></DropdownMenuItem>
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
            <Button asChild className="hidden lg:inline-flex">
              <Link to={cta.href} title={cta.label}>{cta.label}</Link>
            </Button>
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
