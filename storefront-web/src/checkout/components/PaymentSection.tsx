import { useEffect, useState } from "react";
import { CreditCard, Wallet, Building2, Clock, Apple, Smartphone } from "lucide-react";
import { useCheckoutConfig, type ConnectedPayment } from "../config";
import type { PaymentSelection, PaymentTabType, PaymentProvider, Money } from "../types";
import {
  HostedGatewayCheckoutNote,
  CodPaymentForm,
} from "./ProviderPaymentForms";
import { UpiPaymentPanel } from "./UpiPaymentPanel";

const HOSTED_GATEWAYS = new Set(["razorpay", "stripe", "square", "paypal", "payu"]);

type Props = {
  onChange?: (selection: PaymentSelection) => void;
  value?: PaymentSelection;
  total?: Money;
};

function PaymentMethodsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading payment methods">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-lg bg-gray-100" />
    </div>
  );
}

export function PaymentSection({ onChange, value, total }: Props) {
  const {
    paymentMode,
    enabledProviders,
    connectedPayments = [],
    codEnabled = true,
    paymentsLoading = false,
  } = useCheckoutConfig();
  const hasConnected = connectedPayments.length > 0;

  // Keep height stable while preview loads — avoids payment block "jumbling" in.
  if (paymentsLoading && !hasConnected) {
    return <PaymentMethodsSkeleton />;
  }

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

      {(paymentMode === "tabs" || paymentMode === "hybrid") && (
        <PaymentTabs onChange={onChange} total={total} />
      )}
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

  useEffect(() => {
    if (value) return;
    const defaultProvider = connectedPayments[0]?.provider;
    if (defaultProvider) {
      onChange?.({ kind: "provider", provider: defaultProvider as PaymentProvider });
    } else if (codEnabled) {
      onChange?.({ kind: "provider", provider: "cod" });
    }
  }, [value, connectedPayments, codEnabled, onChange]);

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

function PaymentTabs({
  onChange,
  total,
}: {
  onChange?: (s: PaymentSelection) => void;
  total?: Money;
}) {
  const { manualUpi } = useCheckoutConfig();
  const upiEnabled = Boolean(manualUpi?.enabled);
  // Default to Pay later so customers are not shown the UPI QR unless they choose UPI
  const [tab, setTab] = useState<PaymentTabType>("bnpl");

  useEffect(() => {
    onChange?.({ kind: "tab", tab: "bnpl" });
  }, []);

  const selectTab = (next: PaymentTabType) => {
    setTab(next);
    onChange?.({ kind: "tab", tab: next });
  };

  return (
    <div>
      <div
        className={`ck-border ck-radius-md grid gap-1 p-1 ${upiEnabled ? "grid-cols-2" : "grid-cols-1"}`}
        style={{ background: "hsl(var(--surface-muted))" }}
      >
        <button
          type="button"
          onClick={() => selectTab("bnpl")}
          className="flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition"
          style={{
            borderRadius: "calc(var(--radius-md) - 4px)",
            background: tab === "bnpl" ? "hsl(var(--surface))" : "transparent",
            color: tab === "bnpl" ? "hsl(var(--text))" : "hsl(var(--text-muted))",
            boxShadow: tab === "bnpl" ? "var(--shadow-sm)" : "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <Clock size={14} />
          Pay later
        </button>
        {upiEnabled && (
          <button
            type="button"
            onClick={() => selectTab("upi")}
            className="flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition"
            style={{
              borderRadius: "calc(var(--radius-md) - 4px)",
              background: tab === "upi" ? "hsl(var(--surface))" : "transparent",
              color: tab === "upi" ? "hsl(var(--text))" : "hsl(var(--text-muted))",
              boxShadow: tab === "upi" ? "var(--shadow-sm)" : "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Smartphone size={14} />
            UPI
          </button>
        )}
      </div>

      <div className="mt-4">
        {tab === "upi" && manualUpi?.enabled && (
          <UpiPaymentPanel manualUpi={manualUpi} total={total} />
        )}
        {tab === "bnpl" && (
          <p className="ck-border ck-radius-md ck-text-muted p-3 text-sm">
            Place your order now and pay later. No payment is required at checkout.
            The store will review and confirm your order before it is fulfilled.
          </p>
        )}
      </div>
    </div>
  );
}
