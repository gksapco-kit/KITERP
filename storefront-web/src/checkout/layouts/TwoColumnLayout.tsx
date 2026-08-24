import { ContactStep } from "../components/ContactStep";
import { AddressBook } from "../components/AddressBook";
import { AddressForm } from "../components/AddressForm";
import { ShippingMethods } from "../components/ShippingMethods";
import { PaymentSection } from "../components/PaymentSection";
import { Section } from "../components/Section";
import { OrderSummary } from "../components/OrderSummary";
import { useCheckoutConfig } from "../config";
import { useState } from "react";
import { toast } from "sonner";
import { CheckoutActions, CheckoutState } from "../hooks/useCheckoutDemo";
import { Lock, Repeat, CalendarDays } from "lucide-react";

type Props = { state: CheckoutState; actions: CheckoutActions };

export function TwoColumnLayout({ state, actions }: Props) {
  const { showShippingMethods, showSavedAddresses, showOrderNotes, showGiftMessage } = useCheckoutConfig();
  const [addingNew, setAddingNew] = useState(false);
  const hasSaved = showSavedAddresses && (state.customer.savedAddresses?.length ?? 0) > 0;
  const selectedShippingLabel = state.shippingMethods.find((m) => m.id === state.shippingMethodId)?.label;
  const isSubscription = state.checkoutIntentKind === "subscription";
  const isBooking = state.checkoutIntentKind === "booking";
  const requiresShipping = state.requiresShipping !== false;
  const showShippingStep = requiresShipping && showShippingMethods;
  const addressTitle = isSubscription || isBooking ? "Delivery / billing address" : "Shipping address";

  let nextStep = 1;
  const contactStep = nextStep++;
  const addressStep = requiresShipping ? nextStep++ : null;
  const shippingStep = showShippingStep ? nextStep++ : null;
  const paymentStep = nextStep++;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-3 py-6 sm:px-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,460px)] lg:items-start lg:gap-8">
      <div className="order-2 min-w-0 space-y-4 lg:order-1">
        {(isSubscription || isBooking) && (
          <div className="ck-surface ck-border ck-radius-md flex gap-3 p-4 transition-opacity duration-200">
            <div className="mt-0.5 shrink-0 text-[var(--ck-primary,#0d9488)]">
              {isSubscription ? <Repeat size={18} /> : <CalendarDays size={18} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {isSubscription ? "Complete your subscription" : "Complete your booking"}
              </p>
              <p className="ck-text-muted mt-0.5 text-xs">
                {requiresShipping
                  ? "Confirm your address and payment below"
                  : "Confirm your payment below"}
                {state.checkoutIntentSummary ? <> · {state.checkoutIntentSummary}</> : null}.
              </p>
            </div>
          </div>
        )}

        <Section step={contactStep} title="Contact">
          <ContactStep
            customer={state.customer}
            onChange={actions.setCustomer}
            fieldErrors={state.fieldErrors}
          />
        </Section>

        {requiresShipping && (
          <Section
            step={addressStep!}
            title={addressTitle}
            action={
              hasSaved && !addingNew ? (
                <button type="button" className="ck-btn-ghost" onClick={() => setAddingNew(true)}>
                  Use a new address
                </button>
              ) : hasSaved ? (
                <button type="button" className="ck-btn-ghost" onClick={() => setAddingNew(false)}>
                  Use saved
                </button>
              ) : null
            }
          >
            {hasSaved && !addingNew ? (
              <AddressBook
                addresses={state.customer.savedAddresses!}
                selectedId={state.selectedSavedAddressId}
                onSelect={actions.selectSavedAddress}
                onAddNew={() => setAddingNew(true)}
              />
            ) : (
              <AddressForm
                initial={state.shippingAddress}
                onSubmit={actions.setShippingAddress}
                onChange={actions.setShippingAddress}
                hideSubmit
                hidePhone
                fieldErrors={state.fieldErrors}
              />
            )}
          </Section>
        )}

        {showShippingStep && (
          <Section step={shippingStep!} title="Shipping method">
            <ShippingMethods
              methods={state.shippingMethods}
              selectedId={state.shippingMethodId}
              onSelect={actions.setShippingMethod}
            />
          </Section>
        )}

        <Section step={paymentStep} title="Payment" description="All transactions are secure & encrypted.">
          <PaymentSection onChange={actions.setPayment} value={state.payment} total={state.cart.total} />
        </Section>

        {(showOrderNotes || showGiftMessage) && (
          <Section title="Additional details">
            {showOrderNotes && (
              <label className="mb-3 block">
                <span className="ck-label">Order notes (optional)</span>
                <textarea
                  className="ck-input"
                  style={{ height: 80, padding: 12 }}
                  value={state.notes}
                  onChange={(e) => actions.setNotes(e.target.value)}
                  placeholder={
                    isSubscription
                      ? "Anything we should know about your subscription…"
                      : isBooking
                        ? "Special instructions for your booking…"
                        : "Delivery instructions, gate code, etc."
                  }
                />
              </label>
            )}
            {showGiftMessage && (
              <label className="block">
                <span className="ck-label">Gift message (optional)</span>
                <textarea
                  className="ck-input"
                  style={{ height: 80, padding: 12 }}
                  value={state.giftMessage}
                  onChange={(e) => actions.setGiftMessage(e.target.value)}
                  placeholder="Add a personal note"
                />
              </label>
            )}
          </Section>
        )}

        <PlaceOrderBar state={state} actions={actions} />
      </div>

      <div className="order-1 min-w-0 lg:order-2 lg:self-start lg:pl-1 lg:sticky lg:top-20">
        <OrderSummary
          cart={state.cart}
          selectedShippingLabel={requiresShipping ? selectedShippingLabel : undefined}
          showShipping={requiresShipping}
          collapsibleOnMobile
          onApplyCoupon={actions.applyCoupon}
          onRemoveCoupon={actions.removeCoupon}
        />
      </div>
    </div>
  );
}

export function PlaceOrderBar({ state, actions }: Props) {
  const handleClick = async () => {
    const res = await actions.placeOrder();
    if (!res.ok) {
      if (res.error) toast.error(res.error);
      return;
    }
    if (res.ok && !res.orderId) window.location.assign("/order/demo/confirmation");
  };
  return (
    <div className="ck-surface ck-border ck-radius-md flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="ck-text-muted flex items-center gap-2 text-xs">
        <Lock size={12} /> By placing this order you agree to our terms and privacy policy.
      </p>
        <button type="button" className="ck-btn-primary sm:w-auto sm:px-8" disabled={state.isPlacing} onClick={handleClick}>
        {state.isPlacing
          ? (state.processingMessage ?? 'Placing order…')
          : (state.placeOrderLabel ?? 'Place order')}
      </button>
    </div>
  );
}
