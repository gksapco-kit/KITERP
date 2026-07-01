import { useState } from "react";
import { CreditCard, Wallet, Building2, Clock, Apple } from "lucide-react";
import { useCheckoutConfig, type ConnectedPayment } from "../config";
import { PaymentSelection, PaymentTabType, PaymentProvider, type Money } from "../types";
import {
  HostedGatewayCheckoutNote,
  CodPaymentForm,
  CardForm,
} from "./ProviderPaymentForms";

const HOSTED_GATEWAYS = new Set(["razorpay", "stripe", "square", "paypal", "payu"]);

type Props = {
  onChange?: (selection: PaymentSelection) => void;
  value?: PaymentSelection;
  total?: Money;
};

export function PaymentSection({ onChange, value, total }: Props) {
  const { paymentMode, enabledProviders, connectedPayments = [], codEnabled = true } = useCheckoutConfig();
  const hasConnected = connectedPayments.length > 0;

  if (hasConnected) {
    return (
      <ConnectedPaymentsPanel
        connectedPayments={connectedPayments}
        codEnabled={codEnabled}
        onChange={onChange}
        value={value}
        total={total}
      />
    );
  }

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

function resolveSelectedPaymentId(
  value: PaymentSelection | undefined,
  connectedPayments: ConnectedPayment[],
): string {
  if (value?.kind === "provider") return value.provider
  if (value?.kind === "tab" && value.tab === "bank_transfer") return "cod"
  return connectedPayments[0]?.provider ?? "cod"
}

function ConnectedPaymentsPanel({
  connectedPayments,
  codEnabled,
  onChange,
  value,
  total,
}: {
  connectedPayments: ConnectedPayment[];
  codEnabled: boolean;
  onChange?: (selection: PaymentSelection) => void;
  value?: PaymentSelection;
  total?: Money;
}) {
  const selected = resolveSelectedPaymentId(value, connectedPayments);

  const select = (provider: string) => {
    if (provider === "cod") {
      onChange?.({ kind: "provider", provider: "cod" });
      return;
    }
    onChange?.({ kind: "provider", provider: provider as PaymentProvider });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {connectedPayments.map((p) => {
          const isSelected = selected === p.provider;
          return (
          <button
            key={p.provider}
            type="button"
            onClick={() => select(p.provider)}
            className="ck-selectable flex h-12 items-center justify-center gap-2 text-sm font-medium"
            data-selected={isSelected ? "true" : undefined}
            aria-pressed={isSelected}
          >
            {storeProviderIcon(p.provider)}
            <span>{p.label || providerLabel(p.provider)}</span>
          </button>
          );
        })}
        {codEnabled && (
          <button
            type="button"
            onClick={() => select("cod")}
            className="ck-selectable flex h-12 items-center justify-center gap-2 text-sm font-medium"
            data-selected={selected === "cod" ? "true" : undefined}
            aria-pressed={selected === "cod"}
          >
            <Building2 size={16} />
            <span>Cash on Delivery</span>
          </button>
        )}
      </div>

      <div className="mt-2">
        {selected === "cod" && <CodPaymentForm />}
        {HOSTED_GATEWAYS.has(selected) && (
          <HostedGatewayCheckoutNote provider={selected} total={total} />
        )}
      </div>
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

function providerLabel(p: string) {
  switch (p) {
    case "apple_pay": return "Apple Pay";
    case "google_pay": return "Google Pay";
    case "paypal": return "PayPal";
    case "stripe": return "Card";
    case "razorpay": return "Razorpay";
    case "square": return "Square";
    case "payu": return "PayU";
    case "klarna": return "Klarna";
    case "afterpay": return "Afterpay";
    default: return p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function storeProviderIcon(p: string) {
  if (p === "stripe" || p === "square") return <CreditCard size={16} />;
  if (p === "paypal" || p === "razorpay" || p === "payu") return <Wallet size={16} />;
  return <Wallet size={16} />;
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
        {tab === "wallet" && (
          <p className="ck-border ck-radius-md ck-text-muted p-3 text-sm">
            Choose a wallet provider above (Apple Pay, Google Pay, PayPal).
          </p>
        )}
        {tab === "bank_transfer" && (
          <p className="ck-border ck-radius-md ck-text-muted p-3 text-sm">
            You&apos;ll receive bank transfer instructions on the confirmation page.
          </p>
        )}
        {tab === "bnpl" && (
          <p className="ck-border ck-radius-md ck-text-muted p-3 text-sm">
            Split your purchase into 4 interest-free payments. Eligibility checked at confirmation.
          </p>
        )}
      </div>
    </div>
  );
}
