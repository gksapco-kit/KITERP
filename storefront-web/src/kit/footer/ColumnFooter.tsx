import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SocialPlatformIcon } from "@/lib/socialPlatformIcons";
import type { SocialLinksIconStyle } from "@/lib/socialLinksMode";
import { resolveSocialLinkHref } from "@/lib/socialLinkHref";
import {
  FOOTER_SOCIAL_PLATFORMS,
  type FooterSocialPlatform,
} from "@/kit/footer/footerSocial";
import { builderSectionContainerClass } from "@/lib/builderSectionLayout";

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
  socialLinks?: Partial<Record<FooterSocialPlatform, string>>;
  /** Outline, filled, or brand-colored social icons. */
  socialIconStyle?: SocialLinksIconStyle;
  /** When true, render all social icons (used in builder canvas). */
  showAllSocialIcons?: boolean;
  renderSocialIcon?: (platform: FooterSocialPlatform, url: string) => ReactNode;
  showNewsletter?: boolean;
  showPaymentStrip?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function ColumnFooter({
  variant = "standard",
  brand = "Acme ERP",
  description,
  columns,
  copyright = `© ${new Date().getFullYear()} Acme ERP. All rights reserved.`,
  showSocial = true,
  socialLinks,
  socialIconStyle = "brand",
  showAllSocialIcons = false,
  renderSocialIcon,
  showNewsletter,
  showPaymentStrip,
  className,
  style,
}: ColumnFooterProps) {
  const isFull = variant === "full";
  const newsletter = showNewsletter ?? isFull;
  const paymentStrip = showPaymentStrip ?? isFull;
  const visibleSocial = FOOTER_SOCIAL_PLATFORMS.filter(({ key }) =>
    showAllSocialIcons || Boolean(resolveSocialLinkHref(key, socialLinks?.[key] ?? '')),
  );
  const linkColumnGrid =
    columns.length >= 4
      ? "md:grid-cols-2 lg:grid-cols-4"
      : columns.length === 3
        ? "md:grid-cols-2 lg:grid-cols-3"
        : columns.length === 2
          ? "md:grid-cols-2"
          : "grid-cols-1";

  return (
    <footer className={cn("w-full min-w-0 border-t bg-muted/30", className)} style={style}>
      <div className={builderSectionContainerClass("py-12")}>
        <div className="grid w-full min-w-0 gap-10 md:grid-cols-12">
          {variant !== "simple" && (
            <div className="min-w-0 md:col-span-4">
              <div className="text-lg font-semibold">{brand}</div>
              {description && <p className="mt-3 text-sm text-muted-foreground max-w-sm">{description}</p>}
              {showSocial && visibleSocial.length > 0 && (
                <div className="mt-4 flex items-center gap-2">
                  {visibleSocial.map(({ key, label }) => {
                    const rawUrl = socialLinks?.[key]?.trim() || '';
                    const url = resolveSocialLinkHref(key, rawUrl);
                    if (renderSocialIcon) {
                      return <span key={key}>{renderSocialIcon(key, url)}</span>;
                    }
                    if (!url) {
                      return (
                        <span
                          key={key}
                          aria-label={label}
                          className="text-muted-foreground/35"
                        >
                          <SocialPlatformIcon platform={key} style={socialIconStyle} className="h-4 w-4" />
                        </span>
                      );
                    }
                    return (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <SocialPlatformIcon platform={key} style={socialIconStyle} className="h-4 w-4" />
                      </a>
                    );
                  })}
                </div>
              )}
              {newsletter && (
                <form className="mt-5 flex gap-2 max-w-sm" onSubmit={(e) => e.preventDefault()}>
                  <Input type="email" placeholder="you@example.com" required />
                  <Button type="submit">Subscribe</Button>
                </form>
              )}
            </div>
          )}

          <div className={cn("grid w-full min-w-0 gap-8", linkColumnGrid, variant === "simple" ? "md:col-span-12" : "md:col-span-8")}>
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

        <div className="mt-10 border-t pt-6">
          <p className="text-xs text-muted-foreground">{copyright}</p>
        </div>
      </div>
    </footer>
  );
}
