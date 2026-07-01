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
import { Lock } from "lucide-react";

type Props = { state: CheckoutState; actions: CheckoutActions };

export function TwoColumnLayout({ state, actions }: Props) {
  const { showShippingMethods, showSavedAddresses, showOrderNotes, showGiftMessage } = useCheckoutConfig();
  const [addingNew, setAddingNew] = useState(false);
  const hasSaved = showSavedAddresses && (state.customer.savedAddresses?.length ?? 0) > 0;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,460px)] lg:gap-8">
      <div className="order-2 min-w-0 space-y-4 lg:order-1">
        <Section step={1} title="Contact">
          <ContactStep
            customer={state.customer}
            onChange={actions.setCustomer}
            fieldErrors={state.fieldErrors}
          />
        </Section>

        <Section
          step={2}
          title="Shipping address"
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
              fieldErrors={state.fieldErrors}
            />
          )}
        </Section>

        {showShippingMethods && (
          <Section step={3} title="Shipping method">
            <ShippingMethods
              methods={state.shippingMethods}
              selectedId={state.shippingMethodId}
              onSelect={actions.setShippingMethod}
            />
          </Section>
        )}

        <Section step={showShippingMethods ? 4 : 3} title="Payment" description="All transactions are secure & encrypted.">
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
                  placeholder="Delivery instructions, gate code, etc."
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

      <div className="order-1 min-w-0 lg:order-2">
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
        {state.isPlacing ? "Placing order…" : "Place order"}
      </button>
    </div>
  );
}
