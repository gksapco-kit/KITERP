import { Link, useNavigate, useParams } from "react-router-dom";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardList, Clock, CreditCard, ExternalLink, Loader2, MapPin, Package, Truck } from "lucide-react";
import { toast } from "sonner";
import { CheckoutHeader, CheckoutFooter } from "../components/Header";
import { CheckoutConfigProvider, formatMoney, useCheckoutConfig } from "../config";
import { LineItem } from "../components/LineItem";
import { useBranch } from "@/contexts/BranchContext";
import { useBuilderSiteCheckoutTheme } from "@/hooks/useBuilderSiteCheckoutTheme";
import { useOrder, useStoreInfo, storeKeys } from "@/hooks/useStore";
import { useVendor } from "@/contexts/VendorContext";
import { fulfillPendingCheckoutIntent } from "@/lib/fulfillCheckoutIntent";
import { payOrderWithRazorpay, verifyRazorpayOrderPayment } from "@/lib/payOrderWithRazorpay";
import type { CartItem } from "../types";
import type { OrderTimelineEvent } from "../types";
import type { Order } from "@/types";

export default function OrderStatusPage() {
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
  const navigate = useNavigate();
  const checkoutTheme = useBuilderSiteCheckoutTheme();
  const { data: order, isLoading, error, refetch } = useOrder(orderId ?? "");
  const { data: storeInfo } = useStoreInfo();
  const { vendorSlug } = useVendor();
  const qc = useQueryClient();
  const [paying, setPaying] = useState(false);
  const storeName =
    (storeInfo as { display_name?: string; business_name?: string } | undefined)?.display_name
    ?? (storeInfo as { business_name?: string } | undefined)?.business_name
    ?? "Store";

  const canPayWithRazorpay =
    !!order
    && order.payment_method === "razorpay"
    && order.payment_status !== "paid"
    && order.total >= 1;

  const handleRazorpayPay = async () => {
    if (!orderId || !order || paying) return;
    setPaying(true);
    try {
      const payment = await payOrderWithRazorpay({ orderId, storeName });
      await verifyRazorpayOrderPayment(orderId, payment);
      await fulfillPendingCheckoutIntent(vendorSlug, orderId, "razorpay");
      await refetch();
      await qc.invalidateQueries({ queryKey: storeKeys.order(orderId) });
      toast.success("Payment received — thank you!");
      navigate(storePath(`/order/${orderId}/confirmation`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment could not be completed.";
      if (msg !== "Payment cancelled") toast.error(msg);
    } finally {
      setPaying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="checkout-root min-h-screen" style={checkoutTheme}>
        <CheckoutHeader />
        <main className="mx-auto flex max-w-4xl justify-center px-3 py-16 sm:px-4 sm:py-20 md:px-6">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <CheckoutFooter />
      </div>
    );
  }

  if (!order || error) {
    return (
      <div className="checkout-root min-h-screen" style={checkoutTheme}>
        <CheckoutHeader />
        <main className="mx-auto max-w-4xl px-3 py-12 text-center sm:px-4 sm:py-16 md:px-6">
          <h1 className="mb-4 text-2xl font-semibold">Order not found</h1>
          <Link to={storePath("/products")} className="ck-btn-primary no-underline" style={{ width: "auto", padding: "12px 24px" }}>
            Continue shopping
          </Link>
        </main>
        <CheckoutFooter />
      </div>
    );
  }

  const lineItems = mapOrderItems(order);
  const shipping = order.shipping_address ?? {};
  const timeline = buildTimeline(order);

  return (
    <div className="checkout-root min-h-screen" style={checkoutTheme}>
      <CheckoutHeader />
      <main className="mx-auto max-w-4xl px-3 py-6 sm:px-4 sm:py-8 md:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="ck-text-subtle text-xs uppercase tracking-wide">Order</p>
            <h1 className="text-2xl font-semibold">{order.order_number}</h1>
            <p className="ck-text-muted text-sm">Placed {new Date(order.created_at).toLocaleString()}</p>
          </div>
          <span className="ck-badge ck-badge-success">{statusLabel(order.status)}</span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="ck-surface ck-border ck-radius-md p-4 md:p-6">
              <h2 className="mb-5 text-base font-semibold tracking-tight">Tracking</h2>
              <Timeline events={timeline} />
              {order.tracking_number ? (
                <div className="ck-border-t mt-4 flex flex-wrap items-center justify-between gap-2 pt-4 text-sm">
                  <div>
                    <div className="ck-text-subtle text-xs uppercase tracking-wide">Tracking number</div>
                    <div className="font-mono">{order.tracking_number}</div>
                  </div>
                  {order.tracking_url ? (
                    <a href={order.tracking_url} className="ck-btn-ghost flex items-center gap-1 no-underline" target="_blank" rel="noopener noreferrer">
                      Track with carrier <ExternalLink size={12} />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="ck-surface ck-border ck-radius-md p-4 md:p-6">
              <h2 className="mb-2 text-base font-semibold">Items</h2>
              {lineItems.map((it, i) => (
                <div key={it.id} className={i > 0 ? "ck-border-t" : ""}>
                  <LineItem item={it} compact />
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <SidePanel icon={<MapPin size={14} />} title="Delivery address">
              {formatAddressText(shipping)}
            </SidePanel>
            <SidePanel icon={<Truck size={14} />} title="Order total">
              {formatMoney({ amount: Math.round(order.total * 100), currency: "INR" }, locale)}
            </SidePanel>
            <SidePanel icon={<ClipboardList size={14} />} title="Payment">
              <div className="space-y-2">
                <p>{order.payment_method ?? order.payment_status ?? "—"}</p>
                {canPayWithRazorpay ? (
                  <button
                    type="button"
                    className="ck-btn-primary flex w-full items-center justify-center gap-2"
                    disabled={paying}
                    onClick={() => void handleRazorpayPay()}
                  >
                    {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    {paying ? "Opening Razorpay…" : "Pay with Razorpay"}
                  </button>
                ) : null}
              </div>
            </SidePanel>
            <Link to={storePath("/products")} className="ck-btn-secondary block text-center no-underline">
              Continue shopping
            </Link>
          </aside>
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

function formatAddressText(shipping: Record<string, string>): string {
  return [
    shipping.full_name || shipping.name,
    shipping.street_address || shipping.line1,
    [shipping.city, shipping.state || shipping.region, shipping.postal_code].filter(Boolean).join(", "),
    shipping.country,
  ].filter(Boolean).join("\n");
}

function buildTimeline(order: Order): OrderTimelineEvent[] {
  if (order.status_history?.length) {
    return order.status_history.map((h) => ({
      status: (h.to_status as OrderTimelineEvent["status"]) || "placed",
      label: statusLabel(h.to_status),
      occurredAt: h.timestamp,
    }));
  }
  const events: OrderTimelineEvent[] = [
    { status: "placed", label: "Order placed", occurredAt: order.created_at },
  ];
  if (order.confirmed_at) events.push({ status: "paid", label: "Confirmed", occurredAt: order.confirmed_at });
  if (order.shipped_at) events.push({ status: "shipped", label: "Shipped", occurredAt: order.shipped_at });
  if (order.delivered_at) events.push({ status: "delivered", label: "Delivered", occurredAt: order.delivered_at });
  return events;
}

function Timeline({ events }: { events: OrderTimelineEvent[] }) {
  if (!events.length) {
    return <p className="ck-text-muted text-sm">No tracking updates yet.</p>;
  }

  const lastDoneIdx = events.reduce((acc, e, i) => (e.occurredAt ? i : acc), -1);

  return (
    <ol className="m-0 list-none space-y-0 p-0">
      {events.map((e, i) => {
        const done = !!e.occurredAt;
        const isLatest = i === lastDoneIdx;
        const isLast = i === events.length - 1;
        const Icon = iconForStatus(e.status);

        return (
          <li key={`${e.status}-${e.occurredAt ?? i}`} className="flex gap-3">
            {/* Rail: icon + connector */}
            <div className="flex w-7 shrink-0 flex-col items-center">
              <span
                className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: done
                    ? isLatest
                      ? "hsl(var(--success))"
                      : "hsl(var(--success) / 0.18)"
                    : "hsl(var(--surface-muted))",
                  color: done
                    ? isLatest
                      ? "#fff"
                      : "hsl(var(--success))"
                    : "hsl(var(--text-muted))",
                  boxShadow: isLatest ? "0 0 0 4px hsl(var(--success) / 0.15)" : undefined,
                }}
                aria-hidden
              >
                {done ? <Check size={14} strokeWidth={2.5} /> : <Icon size={14} />}
              </span>
              {!isLast ? (
                <span
                  aria-hidden
                  className="mt-1 w-0.5 flex-1 min-h-[1.25rem]"
                  style={{
                    background: i < lastDoneIdx
                      ? "hsl(var(--success) / 0.45)"
                      : "hsl(var(--border-token))",
                  }}
                />
              ) : null}
            </div>

            {/* Content */}
            <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-5"}`}>
              <div className={`text-sm leading-7 ${isLatest ? "font-semibold" : "font-medium"}`}>
                {e.label}
              </div>
              <div className="ck-text-muted mt-0.5 text-xs leading-snug">
                {e.occurredAt
                  ? new Date(e.occurredAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "Awaiting update"}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SidePanel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ck-surface ck-border ck-radius-md p-4">
      <div className="ck-text-subtle mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide">
        {icon} {title}
      </div>
      <div className="whitespace-pre-line text-sm">{children}</div>
    </div>
  );
}

function iconForStatus(s: string) {
  const key = (s || "").toLowerCase();
  if (key === "pending") return Clock;
  if (key === "placed" || key === "paid" || key === "confirmed" || key === "processing") return ClipboardList;
  if (key === "packed") return Package;
  if (key === "shipped" || key === "out_for_delivery") return Truck;
  if (key === "delivered") return Check;
  return MapPin;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  placed: "Order placed",
  confirmed: "Confirmed",
  paid: "Paid",
  processing: "Processing",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

function statusLabel(s: string) {
  const key = (s || "").toLowerCase();
  if (STATUS_LABELS[key]) return STATUS_LABELS[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
