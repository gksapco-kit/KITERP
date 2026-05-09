import { useMemo, useState } from "react";
import { Address, Cart, Customer, PaymentSelection, ShippingMethod } from "../types";
import { mockCart, mockCustomer, mockSavedAddresses, mockShippingMethods } from "../mock/data";

export type CheckoutState = {
  cart: Cart;
  customer: Partial<Customer>;
  shippingAddress?: Address;
  selectedSavedAddressId?: string;
  shippingMethodId?: string;
  shippingMethods: ShippingMethod[];
  payment?: PaymentSelection;
  notes: string;
  giftMessage: string;
  isPlacing: boolean;
  error?: string;
};

export type CheckoutActions = {
  setCustomer: (c: Partial<Customer>) => void;
  setShippingAddress: (a: Address) => void;
  selectSavedAddress: (id: string) => void;
  clearSavedAddress: () => void;
  setShippingMethod: (id: string) => void;
  setPayment: (p: PaymentSelection) => void;
  setNotes: (s: string) => void;
  setGiftMessage: (s: string) => void;
  updateQuantity: (itemId: string, q: number) => void;
  removeItem: (itemId: string) => void;
  applyCoupon: (code: string) => void;
  removeCoupon: (code: string) => void;
  placeOrder: () => Promise<{ ok: boolean; orderId?: string; error?: string }>;
};

export function useCheckoutDemo(): { state: CheckoutState; actions: CheckoutActions } {
  const [cart, setCart] = useState<Cart>(mockCart);
  const [customer, setCustomer] = useState<Partial<Customer>>({
    email: mockCustomer.email,
    isGuest: true,
    savedAddresses: mockSavedAddresses,
  });
  const [shippingAddress, setShippingAddress] = useState<Address | undefined>(mockSavedAddresses[0]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | undefined>(mockSavedAddresses[0].id);
  const [shippingMethodId, setShippingMethodId] = useState<string | undefined>("standard");
  const [payment, setPayment] = useState<PaymentSelection | undefined>({ kind: "tab", tab: "card" });
  const [notes, setNotes] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const actions: CheckoutActions = useMemo(
    () => ({
      setCustomer,
      setShippingAddress: (a) => {
        setShippingAddress(a);
        setSelectedSavedAddressId(undefined);
      },
      selectSavedAddress: (id) => {
        const a = mockSavedAddresses.find((x) => x.id === id);
        if (a) setShippingAddress(a);
        setSelectedSavedAddressId(id);
      },
      clearSavedAddress: () => setSelectedSavedAddressId(undefined),
      setShippingMethod: (id) => {
        setShippingMethodId(id);
        const m = mockShippingMethods.find((x) => x.id === id);
        if (m) setCart((c) => recomputeTotals({ ...c, shipping: m.price }));
      },
      setPayment,
      setNotes,
      setGiftMessage,
      updateQuantity: (itemId, q) =>
        setCart((c) =>
          recomputeTotals({
            ...c,
            items: c.items.map((it) => (it.id === itemId ? { ...it, quantity: q } : it)),
          }),
        ),
      removeItem: (itemId) =>
        setCart((c) => recomputeTotals({ ...c, items: c.items.filter((it) => it.id !== itemId) })),
      applyCoupon: (code) => {
        if (cart.discounts.find((d) => d.code.toLowerCase() === code.toLowerCase())) return;
        const pct = code.toLowerCase().includes("welcome") ? 0.1 : 0.05;
        const amount = Math.round(cart.subtotal.amount * pct);
        setCart((c) =>
          recomputeTotals({
            ...c,
            discounts: [
              ...c.discounts,
              { code: code.toUpperCase(), label: `${Math.round(pct * 100)}% off`, amount: { amount, currency: c.subtotal.currency } },
            ],
          }),
        );
      },
      removeCoupon: (code) =>
        setCart((c) => recomputeTotals({ ...c, discounts: c.discounts.filter((d) => d.code !== code) })),
      placeOrder: async () => {
        setIsPlacing(true);
        setError(undefined);
        await new Promise((r) => setTimeout(r, 900));
        setIsPlacing(false);
        return { ok: true, orderId: "demo" };
      },
    }),
    [cart],
  );

  return {
    state: {
      cart,
      customer,
      shippingAddress,
      selectedSavedAddressId,
      shippingMethodId,
      shippingMethods: mockShippingMethods,
      payment,
      notes,
      giftMessage,
      isPlacing,
      error,
    },
    actions,
  };
}

function recomputeTotals(c: Cart): Cart {
  const subtotal = c.items.reduce((sum, it) => sum + it.unitPrice.amount * it.quantity, 0);
  const discount = c.discounts.reduce((sum, d) => sum + d.amount.amount, 0);
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = Math.round(taxable * 0.08875);
  const taxes = taxAmount > 0 ? [{ label: "Sales tax (8.875%)", amount: { amount: taxAmount, currency: c.subtotal.currency } }] : [];
  const shipping = c.shipping?.amount ?? 0;
  const total = taxable + taxAmount + shipping;
  return {
    ...c,
    subtotal: { amount: subtotal, currency: c.subtotal.currency },
    taxes,
    total: { amount: total, currency: c.subtotal.currency },
  };
}
