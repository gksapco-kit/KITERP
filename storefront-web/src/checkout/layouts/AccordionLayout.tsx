import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ContactStep } from "../components/ContactStep";
import { AddressBook } from "../components/AddressBook";
import { AddressForm } from "../components/AddressForm";
import { ShippingMethods } from "../components/ShippingMethods";
import { PaymentSection } from "../components/PaymentSection";
import { OrderSummary } from "../components/OrderSummary";
import { useCheckoutConfig } from "../config";
import { CheckoutActions, CheckoutState } from "../hooks/useCheckoutDemo";
import { PlaceOrderBar } from "./TwoColumnLayout";

export function AccordionLayout({ state, actions }: { state: CheckoutState; actions: CheckoutActions }) {
  const { showSavedAddresses } = useCheckoutConfig();
  const [openItem, setOpenItem] = useState("contact");
  const [addingNew, setAddingNew] = useState(false);
  const hasSaved = showSavedAddresses && (state.customer.savedAddresses?.length ?? 0) > 0;
  const selectedShippingLabel = state.shippingMethods.find((m) => m.id === state.shippingMethodId)?.label;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-3 py-6 sm:px-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,460px)] lg:items-start lg:gap-8">
      <div className="ck-surface ck-border ck-radius-md min-w-0 p-4 md:p-6">
        <Accordion type="single" collapsible value={openItem} onValueChange={setOpenItem} className="w-full">
          <AccordionItem value="contact">
            <AccordionTrigger>1. Contact</AccordionTrigger>
            <AccordionContent>
              <ContactStep
                customer={state.customer}
                onChange={actions.setCustomer}
                fieldErrors={state.fieldErrors}
              />
              <button type="button" className="ck-btn-primary mt-4" onClick={() => setOpenItem("address")}>
                Continue
              </button>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="address">
            <AccordionTrigger>2. Shipping address</AccordionTrigger>
            <AccordionContent>
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
              <button type="button" className="ck-btn-primary mt-4" onClick={() => setOpenItem("shipping")}>
                Continue
              </button>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="shipping">
            <AccordionTrigger>3. Shipping method</AccordionTrigger>
            <AccordionContent>
              <ShippingMethods
                methods={state.shippingMethods}
                selectedId={state.shippingMethodId}
                onSelect={actions.setShippingMethod}
              />
              <button type="button" className="ck-btn-primary mt-4" onClick={() => setOpenItem("payment")}>
                Continue
              </button>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="payment">
            <AccordionTrigger>4. Payment</AccordionTrigger>
            <AccordionContent>
              <PaymentSection onChange={actions.setPayment} value={state.payment} total={state.cart.total} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-4">
          <PlaceOrderBar state={state} actions={actions} />
        </div>
      </div>

      <div className="min-w-0 lg:sticky lg:top-6 lg:self-start lg:pl-1">
        <OrderSummary
          cart={state.cart}
          selectedShippingLabel={selectedShippingLabel}
          collapsibleOnMobile
          onApplyCoupon={actions.applyCoupon}
          onRemoveCoupon={actions.removeCoupon}
        />
      </div>
    </div>
  );
}
