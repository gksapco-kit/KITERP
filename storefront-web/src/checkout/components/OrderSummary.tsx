import { useState } from "react";
import { ChevronDown, ChevronUp, Lock, ShoppingBag, Tag } from "lucide-react";
import { Cart } from "../types";
import { formatMoney, useCheckoutConfig } from "../config";
import { LineItem } from "./LineItem";

type Props = {
  cart: Cart;
  selectedShippingLabel?: string;
  /** When false, hide the Shipping row (service-only checkouts). Default true. */
  showShipping?: boolean;
  collapsibleOnMobile?: boolean;
  showItems?: boolean;
  showCouponInput?: boolean;
  onApplyCoupon?: (code: string) => void;
  onRemoveCoupon?: (code: string) => void;
};

export function OrderSummary({
  cart,
  selectedShippingLabel,
  showShipping = true,
  collapsibleOnMobile = false,
  showItems = true,
  showCouponInput,
  onApplyCoupon,
  onRemoveCoupon,
}: Props) {
  const { locale, showTaxBreakdown, showCoupon, showTrustBadges } = useCheckoutConfig();
  const [open, setOpen] = useState(!collapsibleOnMobile);
  const [coupon, setCoupon] = useState("");
  const showCouponField = showCouponInput ?? showCoupon;

  const totalDiscount = cart.discounts.reduce((sum, d) => sum + d.amount.amount, 0);
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <aside className="ck-surface-elevated ck-border ck-radius-md p-5 md:p-6 lg:flex lg:max-h-[calc(100vh-6rem)] lg:flex-col">
      {collapsibleOnMobile && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between md:hidden"
          style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            {open ? "Hide" : "Show"} order summary
            <span className="ck-badge inline-flex items-center gap-1">
              <ShoppingBag size={12} />
              {itemCount}
            </span>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
          <span className="text-base font-semibold">{formatMoney(cart.total, locale)}</span>
        </button>
      )}

      <div
        className={`${collapsibleOnMobile && !open ? "hidden md:block" : "block"} lg:flex lg:min-h-0 lg:flex-1 lg:flex-col`}
      >
        <h3 className="mb-4 flex shrink-0 items-center gap-2 text-base font-semibold">
          Order summary
          <span className="ck-badge inline-flex items-center gap-1 font-medium">
            <ShoppingBag size={12} />
            {itemCount}
          </span>
        </h3>

        {showItems && (
          <div className="ck-border-b mb-4 pb-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {cart.items.map((item) => (
              <LineItem key={item.id} item={item} compact />
            ))}
          </div>
        )}

        {showCouponField && (
          <div className="mb-4 shrink-0">
            {cart.discounts.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {cart.discounts.map((d) => (
                  <span key={d.code} className="ck-badge ck-badge-success">
                    <Tag size={12} /> {d.code}
                    <button
                      type="button"
                      aria-label="Remove coupon"
                      onClick={() => onRemoveCoupon?.(d.code)}
                      style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", marginLeft: 4 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
              <input
                className="ck-input min-w-0 flex-1 sm:min-h-[44px]"
                placeholder="Discount code"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
              />
              <button
                type="button"
                className="ck-btn-secondary shrink-0 whitespace-nowrap px-5 h-[44px] sm:self-auto"
                disabled={!coupon.trim()}
                onClick={() => {
                  onApplyCoupon?.(coupon.trim());
                  setCoupon("");
                }}
              >
                Apply
              </button>
            </div>
          </div>
        )}

        <dl className="shrink-0 space-y-2.5 text-sm">
          <Row label="Subtotal" value={formatMoney(cart.subtotal, locale)} />
          {totalDiscount > 0 && (
            <Row
              label="Discount"
              value={`− ${formatMoney({ amount: totalDiscount, currency: cart.subtotal.currency }, locale)}`}
              tone="success"
            />
          )}
          {showShipping && (
            <Row
              label={selectedShippingLabel ? `Shipping (${selectedShippingLabel})` : "Shipping"}
              value={
                cart.shipping
                  ? cart.shipping.amount === 0
                    ? "Free"
                    : formatMoney(cart.shipping, locale)
                  : "Calculated next"
              }
            />
          )}
          {showTaxBreakdown &&
            cart.taxes.map((t, i) => <Row key={i} label={t.label} value={formatMoney(t.amount, locale)} />)}
        </dl>

        <div className="ck-border-t mt-4 flex shrink-0 items-baseline justify-between gap-4 pt-4">
          <span className="min-w-0 text-sm font-medium">Total</span>
          <span className="shrink-0 text-xl font-semibold tabular-nums">{formatMoney(cart.total, locale)}</span>
        </div>

        {showTrustBadges && (
          <div className="ck-text-subtle mt-4 flex shrink-0 items-center justify-center gap-2 text-xs">
            <Lock size={12} /> Secure checkout · Encrypted payment
          </div>
        )}
      </div>
    </aside>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="ck-text-muted min-w-0">{label}</dt>
      <dd
        className="shrink-0 text-right tabular-nums"
        style={tone === "success" ? { color: "hsl(var(--success))" } : undefined}
      >
        {value}
      </dd>
    </div>
  );
}
