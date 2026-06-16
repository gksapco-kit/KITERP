import { Link, useParams } from "react-router-dom";
import { Check, ClipboardList, ExternalLink, Loader2, MapPin, Package, Truck } from "lucide-react";
import { CheckoutHeader, CheckoutFooter } from "../components/Header";
import { CheckoutConfigProvider, formatMoney, useCheckoutConfig } from "../config";
import { LineItem } from "../components/LineItem";
import { useBranch } from "@/contexts/BranchContext";
import { useOrder } from "@/hooks/useStore";
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
  const { data: order, isLoading, error } = useOrder(orderId ?? "");

  if (isLoading) {
    return (
      <div className="checkout-root min-h-screen">
        <CheckoutHeader />
        <main className="mx-auto flex max-w-4xl justify-center px-4 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <CheckoutFooter />
      </div>
    );
  }

  if (!order || error) {
    return (
      <div className="checkout-root min-h-screen">
        <CheckoutHeader />
        <main className="mx-auto max-w-4xl px-4 py-16 text-center md:px-6">
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
    <div className="checkout-root min-h-screen">
      <CheckoutHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
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
              <h2 className="mb-4 text-base font-semibold">Tracking</h2>
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
              {order.payment_method ?? order.payment_status ?? "—"}
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
  return (
    <ol className="relative" style={{ paddingLeft: 28 }}>
      <span
        aria-hidden
        className="absolute"
        style={{ left: 13, top: 8, bottom: 8, width: 2, background: "hsl(var(--border-token))" }}
      />
      {events.map((e, i) => {
        const done = !!e.occurredAt;
        const Icon = iconForStatus(e.status);
        return (
          <li key={i} className="relative mb-5 last:mb-0">
            <span
              className="absolute flex h-7 w-7 items-center justify-center"
              style={{
                left: -27,
                top: 0,
                borderRadius: "999px",
                background: done ? "hsl(var(--success))" : "hsl(var(--surface-muted))",
                color: done ? "hsl(var(--brand-primary-foreground))" : "hsl(var(--text-muted))",
              }}
            >
              {done ? <Check size={14} /> : <Icon size={14} />}
            </span>
            <div className="text-sm font-medium">{e.label}</div>
            <div className="ck-text-muted text-xs">
              {e.occurredAt ? new Date(e.occurredAt).toLocaleString() : "Pending"}
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
  if (s === "placed" || s === "paid" || s === "confirmed") return ClipboardList;
  if (s === "packed") return Package;
  if (s === "shipped" || s === "out_for_delivery") return Truck;
  return MapPin;
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
