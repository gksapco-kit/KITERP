import { Link, NavLink } from "react-router-dom";
import { ShoppingBag, Menu } from "lucide-react";
import { ReactNode, useState } from "react";

type Theme = "retail" | "resto" | "hosp";

const themeMap: Record<Theme, { bg: string; ink: string; accent: string; border: string }> = {
  retail: { bg: "bg-retail-bg", ink: "text-retail-ink", accent: "text-retail-accent", border: "border-retail-ink/10" },
  resto:  { bg: "bg-resto-bg",  ink: "text-resto-ink",  accent: "text-resto-accent",  border: "border-resto-ink/15" },
  hosp:   { bg: "bg-hosp-bg",   ink: "text-hosp-ink",   accent: "text-hosp-accent",   border: "border-hosp-ink/10" },
};

interface Props {
  theme: Theme;
  brand: string;
  links: { label: string; to: string }[];
  cta?: ReactNode;
}

export const SiteHeader = ({ theme, brand, links, cta }: Props) => {
  const t = themeMap[theme];
  const [open, setOpen] = useState(false);
  return (
    <header className={`sticky top-0 z-40 backdrop-blur-md ${t.bg}/80 ${t.ink} border-b ${t.border}`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link to="/" className="font-display text-2xl tracking-tight">{brand}</Link>
        <nav className="hidden md:flex items-center gap-8 text-sm">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end className={({isActive}) => `transition-opacity hover:opacity-100 ${isActive ? "opacity-100" : "opacity-60"}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">{cta}</div>
          <button aria-label="menu" onClick={() => setOpen(!open)} className="md:hidden p-2"><Menu className="w-5 h-5" /></button>
        </div>
      </div>
      {open && (
        <div className={`md:hidden px-6 pb-4 grid gap-3 text-sm ${t.bg}`}>
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end onClick={() => setOpen(false)} className="opacity-80 py-1">{l.label}</NavLink>
          ))}
          {cta}
        </div>
      )}
    </header>
  );
};

export const CartIcon = () => <ShoppingBag className="w-4 h-4" />;
