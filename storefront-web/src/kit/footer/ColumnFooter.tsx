import { Link } from "react-router-dom";
import { Facebook, Instagram, Twitter, Youtube, Linkedin, ArrowUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FooterColumn {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}

export interface ColumnFooterProps {
  variant?: "simple" | "standard" | "full";
  brand?: string;
  description?: string;
  columns: FooterColumn[];
  copyright?: string;
  showSocial?: boolean;
  showNewsletter?: boolean;
  showPaymentStrip?: boolean;
  showBackToTop?: boolean;
  className?: string;
}

const socialLinks = [
  { Icon: Facebook, href: "#", label: "Facebook" },
  { Icon: Instagram, href: "#", label: "Instagram" },
  { Icon: Twitter, href: "#", label: "Twitter" },
  { Icon: Youtube, href: "#", label: "Youtube" },
  { Icon: Linkedin, href: "#", label: "LinkedIn" },
];

export function ColumnFooter({
  variant = "standard",
  brand = "Acme ERP",
  description,
  columns,
  copyright = `© ${new Date().getFullYear()} Acme ERP. All rights reserved.`,
  showSocial = true,
  showNewsletter,
  showPaymentStrip,
  showBackToTop = true,
  className,
}: ColumnFooterProps) {
  const isFull = variant === "full";
  const newsletter = showNewsletter ?? isFull;
  const paymentStrip = showPaymentStrip ?? isFull;

  return (
    <footer className={cn("border-t bg-muted/30", className)}>
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-10 md:grid-cols-12">
          {variant !== "simple" && (
            <div className="md:col-span-4">
              <div className="text-lg font-semibold">{brand}</div>
              {description && <p className="mt-3 text-sm text-muted-foreground max-w-sm">{description}</p>}
              {newsletter && (
                <form className="mt-5 flex gap-2 max-w-sm" onSubmit={(e) => e.preventDefault()}>
                  <Input type="email" placeholder="you@example.com" required />
                  <Button type="submit">Subscribe</Button>
                </form>
              )}
            </div>
          )}

          <div className={cn("grid gap-8 sm:grid-cols-2 md:grid-cols-3", variant === "simple" ? "md:col-span-12" : "md:col-span-8")}>
            {columns.map((col) => (
              <div key={col.title}>
                <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
                <ul className="mt-3 space-y-2">
                  {col.links.map((l) => (
                    <li key={l.href + l.label}>
                      {l.external ? (
                        <a
                          href={l.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-muted-foreground hover:text-foreground"
                        >
                          {l.label}
                        </a>
                      ) : (
                        <Link to={l.href} className="text-sm text-muted-foreground hover:text-foreground">
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {paymentStrip && (
          <div className="mt-10 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>We accept:</span>
            {["Visa", "Mastercard", "Amex", "UPI", "PayPal", "Razorpay"].map((p) => (
              <span key={p} className="px-2 py-1 rounded border bg-background">{p}</span>
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-4 border-t pt-6">
          <p className="text-xs text-muted-foreground">{copyright}</p>
          <div className="flex items-center gap-3">
            {showSocial && socialLinks.map(({ Icon, href, label }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
            {showBackToTop && (
              <Button
                size="icon"
                variant="outline"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                aria-label="Back to top"
              >
                <ArrowUp />
              </Button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
