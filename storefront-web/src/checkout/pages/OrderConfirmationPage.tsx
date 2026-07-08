import { Link, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Mail, MapPin, Package } from "lucide-react";
import { CheckoutHeader, CheckoutFooter } from "../components/Header";
import { Confetti } from "../components/Confetti";
import { OrderConfirmationLoading } from "../components/OrderConfirmationLoading";
import { CheckoutConfigProvider, formatMoney, useCheckoutConfig } from "../config";
import { LineItem } from "../components/LineItem";
import { useBranch } from "@/contexts/BranchContext";
import { useBuilderSiteCheckoutTheme } from "@/hooks/useBuilderSiteCheckoutTheme";
import { useOrder, useCart, resetCartAfterOrder } from "@/hooks/useStore";
import { useVendor } from "@/contexts/VendorContext";
import type { CartItem } from "../types";
import type { Order } from "@/types";

export default function OrderConfirmationPage() {
  return (
    <CheckoutConfigProvider>
      <Inner />
    </CheckoutConfigProvider>
  );
}

function Inner() {
  const { locale } = useCheckoutConfig();
  const { orderId } = useParams<{ orderId: string }>();
  const { storePath } = useBranch();
  const { vendorSlug } = useVendor();
  const checkoutTheme = useBuilderSiteCheckoutTheme();
  const qc = useQueryClient();
  const { data: order, isLoading } = useOrder(orderId ?? "");
  useCart();

  useEffect(() => {
    void resetCartAfterOrder(qc, vendorSlug);
  }, [qc, vendorSlug]);

  if (isLoading) {
    return <OrderConfirmationLoading theme={checkoutTheme} />;
  }

  const resolvedId = order?.id ?? orderId ?? "";
  const lineItems = order ? mapOrderItems(order) : [];
  const shipping = order?.shipping_address ?? {};
  const customerName = String(shipping.full_name ?? shipping.name ?? "there");
  const customerEmail = String(shipping.email ?? "");

  return (
    <div className="checkout-root min-h-screen" style={checkoutTheme}>
      <Confetti />
      <CheckoutHeader />
      <main className="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8 md:px-6">
        <div
          className="ck-radius-lg mb-6 flex flex-col items-center px-6 py-10 text-center"
          style={{ background: "hsl(var(--brand-primary) / 0.04)" }}
        >
          <div
            className="mb-3 flex h-12 w-12 animate-bounce items-center justify-center"
            style={{ borderRadius: "999px", background: "hsl(var(--success) / 0.15)", color: "hsl(var(--success))" }}
          >
            <CheckCircle2 size={28} />
          </div>
          <h1 className="text-2xl font-semibold md:text-3xl">Thank you for placing your order, {customerName}!</h1>
          <p className="ck-text-muted mt-1 text-sm">
            Your order{" "}
            <span className="font-medium">{order?.order_number ?? resolvedId}</span> has been placed.
          </p>
          {customerEmail ? (
            <p className="ck-text-muted mt-1 text-sm">A confirmation email is on its way to {customerEmail}.</p>
          ) : null}
        </div>

        <div className="ck-surface ck-border ck-radius-md mb-4 p-4 md:p-6">
          <h2 className="mb-3 text-base font-semibold">What happens next</h2>
          <ul className="space-y-3">
            <NextStep icon={<Mail size={16} />} title="Order confirmation" body="You'll receive a confirmation email shortly." />
            <NextStep icon={<Package size={16} />} title="Packing & shipping" body="We'll notify you when your order ships." />
            <NextStep icon={<MapPin size={16} />} title="Delivery" body="Track your package any time from the order status page." />
          </ul>
        </div>

        {order ? (
          <>
            <div className="ck-surface ck-border ck-radius-md mb-4 p-4 md:p-6">
              <h2 className="mb-3 text-base font-semibold">Order details</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Block label="Shipping to">
                  {formatAddress(shipping)}
                </Block>
                <Block label="Payment">{order.payment_method ?? order.payment_status ?? "—"}</Block>
                <Block label="Status">{order.status.replace(/_/g, " ")}</Block>
                <Block label="Total">{formatMoney({ amount: Math.round(order.total * 100), currency: "INR" }, locale)}</Block>
              </div>
            </div>

            {lineItems.length > 0 ? (
              <div className="ck-surface ck-border ck-radius-md mb-6 p-4 md:p-6">
                <h2 className="mb-2 text-base font-semibold">Items</h2>
                {lineItems.map((it, i) => (
                  <div key={it.id} className={i > 0 ? "ck-border-t" : ""}>
                    <LineItem item={it} compact />
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          {resolvedId ? (
            <Link
              to={storePath(`/order/${resolvedId}/status`)}
              className="ck-btn-primary no-underline"
              style={{ width: "auto", padding: "12px 24px", textAlign: "center" }}
            >
              Track your order
            </Link>
          ) : null}
          <Link
            to={storePath("/products")}
            className="ck-btn-secondary no-underline"
            style={{ textAlign: "center" }}
          >
            Continue shopping
          </Link>
        </div>
      </main>
      <CheckoutFooter />
    </div>
  );
}

function mapOrderItems(order: Order): CartItem[] {
  return (order.items ?? []).map((item, i) => ({
    id: String(i),
    productId: item.product_id,
    name: item.name,
    imageUrl: item.image_url,
    unitPrice: { amount: Math.round(Number(item.price) * 100), currency: "INR" },
    quantity: item.qty,
  }));
}

function formatAddress(shipping: Record<string, string>): React.ReactNode {
  const lines = [
    shipping.full_name || shipping.name,
    shipping.street_address || shipping.line1,
    [shipping.city, shipping.state || shipping.region, shipping.postal_code].filter(Boolean).join(", "),
    shipping.country,
  ].filter(Boolean);
  if (!lines.length) return "—";
  return lines.map((line, i) => (
    <span key={i}>
      {line}
      {i < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

function NextStep({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center"
        style={{
          borderRadius: "999px",
          background: "hsl(var(--surface-muted))",
          color: "hsl(var(--text-muted))",
        }}
      >
        {icon}
      </span>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="ck-text-muted text-sm">{body}</div>
      </div>
    </li>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="ck-text-subtle mb-1 text-xs uppercase tracking-wide">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
