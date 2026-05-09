import { useState } from "react";
import { CreditCard, Wallet, Building2, Clock, Apple, ChevronRight } from "lucide-react";
import { useCheckoutConfig } from "../config";
import { PaymentSelection, PaymentTabType, PaymentProvider } from "../types";

type Props = {
  onChange?: (selection: PaymentSelection) => void;
};

export function PaymentSection({ onChange }: Props) {
  const { paymentMode, enabledProviders } = useCheckoutConfig();

  return (
    <div className="space-y-4">
      {(paymentMode === "providers" || paymentMode === "hybrid") && (
        <ProviderButtons providers={enabledProviders} onSelect={(p) => onChange?.({ kind: "provider", provider: p })} />
      )}

      {paymentMode === "hybrid" && (
        <div className="ck-text-subtle flex items-center gap-3 text-xs uppercase tracking-wide">
          <span className="ck-border-t flex-1" />
          Or pay with card
          <span className="ck-border-t flex-1" />
        </div>
      )}

      {(paymentMode === "tabs" || paymentMode === "hybrid") && <PaymentTabs onChange={onChange} />}
    </div>
  );
}

function ProviderButtons({
  providers,
  onSelect,
}: {
  providers: PaymentProvider[];
  onSelect: (p: PaymentProvider) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {providers.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onSelect(p)}
          className="ck-selectable flex h-12 items-center justify-center gap-2 text-sm font-medium"
          aria-label={`Pay with ${p}`}
        >
          {providerIcon(p)}
          <span>{providerLabel(p)}</span>
        </button>
      ))}
    </div>
  );
}

function providerLabel(p: PaymentProvider) {
  switch (p) {
    case "apple_pay": return "Apple Pay";
    case "google_pay": return "Google Pay";
    case "paypal": return "PayPal";
    case "stripe": return "Card";
    case "klarna": return "Klarna";
    case "afterpay": return "Afterpay";
  }
}

function providerIcon(p: PaymentProvider) {
  if (p === "apple_pay") return <Apple size={16} />;
  if (p === "stripe") return <CreditCard size={16} />;
  if (p === "klarna" || p === "afterpay") return <Clock size={16} />;
  return <Wallet size={16} />;
}

const TABS: { id: PaymentTabType; label: string; icon: React.ReactNode }[] = [
  { id: "card", label: "Card", icon: <CreditCard size={14} /> },
  { id: "wallet", label: "Wallet", icon: <Wallet size={14} /> },
  { id: "bank_transfer", label: "Bank", icon: <Building2 size={14} /> },
  { id: "bnpl", label: "Pay later", icon: <Clock size={14} /> },
];

function PaymentTabs({ onChange }: { onChange?: (s: PaymentSelection) => void }) {
  const [tab, setTab] = useState<PaymentTabType>("card");

  return (
    <div>
      <div className="ck-border ck-radius-md flex p-1" style={{ background: "hsl(var(--surface-muted))" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              onChange?.({ kind: "tab", tab: t.id });
            }}
            className="flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-medium transition"
            style={{
              borderRadius: "calc(var(--radius-md) - 4px)",
              background: tab === t.id ? "hsl(var(--surface))" : "transparent",
              color: tab === t.id ? "hsl(var(--text))" : "hsl(var(--text-muted))",
              boxShadow: tab === t.id ? "var(--shadow-sm)" : "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "card" && <CardForm onChange={(d) => onChange?.({ kind: "tab", tab: "card", cardDetails: d })} />}
        {tab === "wallet" && <PlaceholderPanel text="Choose a wallet provider above (Apple Pay, Google Pay, PayPal)." />}
        {tab === "bank_transfer" && (
          <PlaceholderPanel text="You'll receive bank transfer instructions on the confirmation page." />
        )}
        {tab === "bnpl" && (
          <PlaceholderPanel text="Split your purchase into 4 interest-free payments. Eligibility checked at confirmation." />
        )}
      </div>
    </div>
  );
}

function PlaceholderPanel({ text }: { text: string }) {
  return (
    <div className="ck-border ck-radius-md ck-text-muted flex items-start gap-2 p-3 text-sm">
      <ChevronRight size={16} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function CardForm({ onChange }: { onChange?: (d: any) => void }) {
  const [d, setD] = useState({ number: "", name: "", expMonth: "", expYear: "", cvc: "" });
  function update(k: keyof typeof d, v: string) {
    const next = { ...d, [k]: v };
    setD(next);
    onChange?.(next);
  }
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="ck-label">Card number</span>
        <input className="ck-input" inputMode="numeric" autoComplete="cc-number"
          placeholder="1234 1234 1234 1234" value={d.number} onChange={(e) => update("number", e.target.value)} />
      </label>
      <label className="block">
        <span className="ck-label">Name on card</span>
        <input className="ck-input" autoComplete="cc-name" value={d.name} onChange={(e) => update("name", e.target.value)} />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="ck-label">Month</span>
          <input className="ck-input" inputMode="numeric" placeholder="MM" maxLength={2}
            value={d.expMonth} onChange={(e) => update("expMonth", e.target.value)} />
        </label>
        <label className="block">
          <span className="ck-label">Year</span>
          <input className="ck-input" inputMode="numeric" placeholder="YY" maxLength={2}
            value={d.expYear} onChange={(e) => update("expYear", e.target.value)} />
        </label>
        <label className="block">
          <span className="ck-label">CVC</span>
          <input className="ck-input" inputMode="numeric" placeholder="123" maxLength={4}
            value={d.cvc} onChange={(e) => update("cvc", e.target.value)} />
        </label>
      </div>
    </div>
  );
}
