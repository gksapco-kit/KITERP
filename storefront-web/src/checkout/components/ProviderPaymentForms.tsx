import { useState } from "react";
import { Lock } from "lucide-react";
import type { CardDetails, Money } from "../types";
import { formatMoney } from "../config";

function FormShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ck-border ck-radius-md space-y-4 p-4" style={{ background: "hsl(var(--surface-muted) / 0.35)" }}>
      {children}
    </div>
  );
}

/** Shown when a hosted gateway is selected — payment UI opens after Place Order. */
export function HostedGatewayCheckoutNote({
  provider,
  total,
}: {
  provider: string;
  total?: Money;
}) {
  const label = provider.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const message =
    provider === "razorpay"
      ? "Click Place Order to open Razorpay secure checkout — UPI, cards, netbanking, and wallets."
      : provider === "paypal"
        ? "Click Place Order to sign in to PayPal and complete payment."
        : provider === "payu"
          ? "Click Place Order to open PayU secure checkout."
          : provider === "stripe"
            ? "Click Place Order to enter card details and pay securely with Stripe."
            : provider === "square"
              ? "Click Place Order to pay securely with Square."
              : `Click Place Order to complete payment with ${label}.`;

  return (
    <div
      className="ck-border ck-radius-md space-y-2 p-4 text-sm"
      style={{ background: "hsl(var(--surface-muted) / 0.35)" }}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Lock size={12} />
          Secured by {label}
        </span>
        {total && (
          <span className="font-medium" style={{ color: "hsl(var(--text))" }}>
            {formatMoney(total)}
          </span>
        )}
      </div>
      <p style={{ color: "hsl(var(--text-muted))" }}>{message}</p>
    </div>
  );
}

export function CodPaymentForm() {
  return (
    <FormShell>
      <p className="text-sm" style={{ color: "hsl(var(--text))" }}>
        Pay in cash when your order is delivered.
      </p>
      <p className="text-xs text-muted-foreground">
        No online payment is required. Our delivery partner will collect the amount at your doorstep.
      </p>
    </FormShell>
  );
}

export function CardForm({
  onChange,
}: {
  onChange?: (d: CardDetails) => void;
  compact?: boolean;
}) {
  const [d, setD] = useState<CardDetails>({ number: "", name: "", expMonth: "", expYear: "", cvc: "" });

  function update(k: keyof CardDetails, v: string) {
    const next = { ...d, [k]: v };
    setD(next);
    onChange?.(next);
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="ck-label">Card number</span>
        <input
          className="ck-input"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="1234 1234 1234 1234"
          value={d.number}
          onChange={(e) => update("number", e.target.value)}
        />
      </label>
      <label className="block">
        <span className="ck-label">Name on card</span>
        <input
          className="ck-input"
          autoComplete="cc-name"
          placeholder="As printed on card"
          value={d.name}
          onChange={(e) => update("name", e.target.value)}
        />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="ck-label">Month</span>
          <input
            className="ck-input"
            inputMode="numeric"
            placeholder="MM"
            maxLength={2}
            value={d.expMonth}
            onChange={(e) => update("expMonth", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="ck-label">Year</span>
          <input
            className="ck-input"
            inputMode="numeric"
            placeholder="YY"
            maxLength={2}
            value={d.expYear}
            onChange={(e) => update("expYear", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="ck-label">CVC</span>
          <input
            className="ck-input"
            inputMode="numeric"
            placeholder="123"
            maxLength={4}
            value={d.cvc}
            onChange={(e) => update("cvc", e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
