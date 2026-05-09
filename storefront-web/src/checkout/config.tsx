import { createContext, useContext, ReactNode } from "react";
import type { Money } from "./types";

export type CheckoutLayout = "two-column" | "wizard" | "accordion";
export type PaymentMode = "tabs" | "providers" | "hybrid";

export type CheckoutConfig = {
  /** Visual layout for the checkout page */
  layout: CheckoutLayout;
  /** How payment options render */
  paymentMode: PaymentMode;
  /** Which payment provider buttons to show in providers/hybrid mode */
  enabledProviders: Array<"stripe" | "paypal" | "apple_pay" | "google_pay" | "klarna" | "afterpay">;

  /** Feature toggles */
  showCoupon: boolean;
  showOrderNotes: boolean;
  showGiftMessage: boolean;
  allowGuest: boolean;
  requirePhone: boolean;
  showTaxBreakdown: boolean;
  showShippingMethods: boolean;
  showSavedAddresses: boolean;
  showTrustBadges: boolean;

  /** Branding */
  storeName: string;
  logoUrl?: string;
  /** Locale used for currency/number formatting */
  locale: string;
  /** Optional override; otherwise derived from cart total currency */
  defaultCurrency?: string;
  /** Legal links shown in footer */
  legalLinks?: { label: string; href: string }[];
};

export const defaultConfig: CheckoutConfig = {
  layout: "two-column",
  paymentMode: "hybrid",
  enabledProviders: ["stripe", "paypal", "apple_pay", "google_pay"],
  showCoupon: true,
  showOrderNotes: true,
  showGiftMessage: false,
  allowGuest: true,
  requirePhone: false,
  showTaxBreakdown: true,
  showShippingMethods: true,
  showSavedAddresses: true,
  showTrustBadges: true,
  storeName: "Your Store",
  locale: "en-US",
  legalLinks: [
    { label: "Refund policy", href: "#" },
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
  ],
};

const CheckoutConfigContext = createContext<CheckoutConfig>(defaultConfig);

export function CheckoutConfigProvider({
  config,
  children,
}: {
  config?: Partial<CheckoutConfig>;
  children: ReactNode;
}) {
  const merged: CheckoutConfig = { ...defaultConfig, ...config };
  return <CheckoutConfigContext.Provider value={merged}>{children}</CheckoutConfigContext.Provider>;
}

export function useCheckoutConfig() {
  return useContext(CheckoutConfigContext);
}

/* ---------- formatting helpers ---------- */
export function formatMoney(money: Money, locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
  }).format(money.amount / 100);
}
