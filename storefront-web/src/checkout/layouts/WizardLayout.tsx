import { useState } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { ContactStep } from "../components/ContactStep";
import { AddressBook } from "../components/AddressBook";
import { AddressForm } from "../components/AddressForm";
import { ShippingMethods } from "../components/ShippingMethods";
import { PaymentSection } from "../components/PaymentSection";
import { OrderSummary } from "../components/OrderSummary";
import { CheckoutActions, CheckoutState } from "../hooks/useCheckoutDemo";
import { useCheckoutConfig, formatMoney } from "../config";
import { PlaceOrderBar } from "./TwoColumnLayout";

const STEPS = ["Information", "Shipping", "Payment", "Review"] as const;
type StepKey = (typeof STEPS)[number];

export function WizardLayout({ state, actions }: { state: CheckoutState; actions: CheckoutActions }) {
  const { showSavedAddresses, locale } = useCheckoutConfig();
  const [step, setStep] = useState<StepKey>("Information");
  const [addingNew, setAddingNew] = useState(false);
  const idx = STEPS.indexOf(step);
  const hasSaved = showSavedAddresses && (state.customer.savedAddresses?.length ?? 0) > 0;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,460px)] lg:gap-8">
      <div className="min-w-0 space-y-4">
        <ProgressIndicator current={idx} />

        <div className="ck-surface ck-border ck-radius-md p-4 md:p-6">
          {step === "Information" && (
            <div className="space-y-5">
              <Header title="Contact information" onBack={null} />
              <ContactStep customer={state.customer} onChange={actions.setCustomer} />
              <h3 className="text-sm font-semibold">Shipping address</h3>
              {hasSaved && !addingNew ? (
                <AddressBook
                  addresses={state.customer.savedAddresses!}
                  selectedId={state.selectedSavedAddressId}
                  onSelect={actions.selectSavedAddress}
                  onAddNew={() => setAddingNew(true)}
                />
              ) : (
                <AddressForm initial={state.shippingAddress} onSubmit={actions.setShippingAddress} hideSubmit />
              )}
            </div>
          )}

          {step === "Shipping" && (
            <div className="space-y-5">
              <Header title="Shipping method" onBack={() => setStep("Information")} />
              <ShippingMethods
                methods={state.shippingMethods}
                selectedId={state.shippingMethodId}
                onSelect={actions.setShippingMethod}
              />
            </div>
          )}

          {step === "Payment" && (
            <div className="space-y-5">
              <Header title="Payment" onBack={() => setStep("Shipping")} />
              <PaymentSection onChange={actions.setPayment} />
            </div>
          )}

          {step === "Review" && (
            <div className="space-y-5">
              <Header title="Review your order" onBack={() => setStep("Payment")} />
              <ReviewBlock label="Contact" value={state.customer.email ?? "—"} onEdit={() => setStep("Information")} />
              <ReviewBlock
                label="Ship to"
                value={
                  state.shippingAddress
                    ? `${state.shippingAddress.fullName} · ${state.shippingAddress.line1}, ${state.shippingAddress.city}`
                    : "—"
                }
                onEdit={() => setStep("Information")}
              />
              <ReviewBlock
                label="Method"
                value={state.shippingMethods.find((m) => m.id === state.shippingMethodId)?.label ?? "—"}
                onEdit={() => setStep("Shipping")}
              />
              <ReviewBlock
                label="Payment"
                value={
                  state.payment?.kind === "tab"
                    ? `Card · ${state.payment.tab}`
                    : state.payment?.kind === "provider"
                      ? state.payment.provider
                      : "—"
                }
                onEdit={() => setStep("Payment")}
              />
            </div>
          )}
        </div>

        {step !== "Review" ? (
          <button
            type="button"
            className="ck-btn-primary"
            onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, idx + 1)])}
          >
            Continue to {STEPS[idx + 1]} · {formatMoney(state.cart.total, locale)}
          </button>
        ) : (
          <PlaceOrderBar state={state} actions={actions} />
        )}
      </div>

      <div className="min-w-0">
        <div className="lg:sticky lg:top-6 lg:pl-1">
          <OrderSummary
            cart={state.cart}
            collapsibleOnMobile
            onApplyCoupon={actions.applyCoupon}
            onRemoveCoupon={actions.removeCoupon}
          />
        </div>
      </div>
    </div>
  );
}

function ProgressIndicator({ current }: { current: number }) {
  return (
    <ol className="ck-surface ck-border ck-radius-md flex items-center gap-2 p-3 text-sm">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center text-xs font-medium"
              style={{
                borderRadius: "999px",
                background: done ? "hsl(var(--success))" : active ? "hsl(var(--brand-primary))" : "hsl(var(--surface-muted))",
                color: done || active ? "hsl(var(--brand-primary-foreground))" : "hsl(var(--text-muted))",
              }}
            >
              {done ? <Check size={12} /> : i + 1}
            </span>
            <span
              className="hidden sm:inline"
              style={{
                color: active ? "hsl(var(--text))" : "hsl(var(--text-muted))",
                fontWeight: active ? 600 : 400,
              }}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && <span className="ck-border-t flex-1" />}
          </li>
        );
      })}
    </ol>
  );
}

function Header({ title, onBack }: { title: string; onBack: (() => void) | null }) {
  return (
    <div className="flex items-center gap-2">
      {onBack && (
        <button type="button" className="ck-btn-ghost flex items-center gap-1" onClick={onBack}>
          <ChevronLeft size={14} /> Back
        </button>
      )}
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
  );
}

function ReviewBlock({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="ck-border ck-radius-md flex items-start justify-between gap-3 p-3">
      <div>
        <div className="ck-text-muted text-xs uppercase tracking-wide">{label}</div>
        <div className="text-sm">{value}</div>
      </div>
      <button type="button" className="ck-btn-ghost" onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}
