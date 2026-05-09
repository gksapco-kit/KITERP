import { Link } from "react-router-dom";
import { ShoppingBag, ChevronRight } from "lucide-react";
import { CheckoutHeader, CheckoutFooter } from "../components/Header";
import { LineItem } from "../components/LineItem";
import { OrderSummary } from "../components/OrderSummary";
import { useCheckoutDemo } from "../hooks/useCheckoutDemo";
import { CheckoutConfigProvider } from "../config";

export default function CartPage() {
  const { state, actions } = useCheckoutDemo();
  const empty = state.cart.items.length === 0;

  return (
    <CheckoutConfigProvider>
      <div className="checkout-root min-h-screen">
        <CheckoutHeader />
        <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
          <h1 className="mb-6 text-2xl font-semibold md:text-3xl">Your cart</h1>

          {empty ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
              <div className="ck-surface ck-border ck-radius-md p-2 md:p-4">
                {state.cart.items.map((item, i) => (
                  <div key={item.id} className={i > 0 ? "ck-border-t" : ""}>
                    <LineItem
                      item={item}
                      editable
                      onUpdateQuantity={actions.updateQuantity}
                      onRemove={actions.removeItem}
                    />
                  </div>
                ))}
                <div className="ck-border-t mt-2 flex items-center justify-between p-4">
                  <Link to="/" className="ck-btn-ghost">
                    ← Continue shopping
                  </Link>
                </div>
              </div>

              <div>
                <OrderSummary
                  cart={state.cart}
                  showItems={false}
                  onApplyCoupon={actions.applyCoupon}
                  onRemoveCoupon={actions.removeCoupon}
                />
                <Link to="/checkout" className="ck-btn-primary mt-3 flex items-center justify-center gap-2 no-underline">
                  Checkout <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          )}
        </main>
        <CheckoutFooter />
      </div>
    </CheckoutConfigProvider>
  );
}

function EmptyState() {
  return (
    <div className="ck-surface ck-border ck-radius-md flex flex-col items-center justify-center px-6 py-16 text-center">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center"
        style={{ borderRadius: "999px", background: "hsl(var(--surface-muted))" }}
      >
        <ShoppingBag size={24} className="ck-text-muted" />
      </div>
      <h2 className="text-xl font-semibold">Your cart is empty</h2>
      <p className="ck-text-muted mt-1 max-w-md text-sm">
        Looks like you haven't added anything yet. Find something you like and come back.
      </p>
      <Link to="/" className="ck-btn-primary mt-6 no-underline" style={{ width: "auto", padding: "12px 24px" }}>
        Browse products
      </Link>
    </div>
  );
}
