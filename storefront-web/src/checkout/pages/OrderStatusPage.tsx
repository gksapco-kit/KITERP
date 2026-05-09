import { Link } from "react-router-dom";
import { Check, Truck, Package, MapPin, ClipboardList, ExternalLink } from "lucide-react";
import { CheckoutHeader, CheckoutFooter } from "../components/Header";
import { CheckoutConfigProvider } from "../config";
import { mockOrder } from "../mock/data";
import { LineItem } from "../components/LineItem";
import { OrderTimelineEvent } from "../types";

export default function OrderStatusPage() {
  const order = mockOrder;
  return (
    <CheckoutConfigProvider>
      <div className="checkout-root min-h-screen">
        <CheckoutHeader />
        <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="ck-text-subtle text-xs uppercase tracking-wide">Order</p>
              <h1 className="text-2xl font-semibold">{order.number}</h1>
              <p className="ck-text-muted text-sm">Placed {new Date(order.placedAt).toLocaleString()}</p>
            </div>
            <span className="ck-badge ck-badge-success">{statusLabel(order.status)}</span>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="ck-surface ck-border ck-radius-md p-4 md:p-6">
                <h2 className="mb-4 text-base font-semibold">Tracking</h2>
                <Timeline events={order.timeline ?? []} />
                {order.trackingNumber && (
                  <div className="ck-border-t mt-4 flex flex-wrap items-center justify-between gap-2 pt-4 text-sm">
                    <div>
                      <div className="ck-text-subtle text-xs uppercase tracking-wide">Tracking number</div>
                      <div className="font-mono">{order.trackingNumber}</div>
                    </div>
                    {order.trackingUrl && (
                      <a
                        href={order.trackingUrl}
                        className="ck-btn-ghost flex items-center gap-1 no-underline"
                      >
                        Track with carrier <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="ck-surface ck-border ck-radius-md p-4 md:p-6">
                <h2 className="mb-2 text-base font-semibold">Items</h2>
                {order.cart.items.map((it, i) => (
                  <div key={it.id} className={i > 0 ? "ck-border-t" : ""}>
                    <LineItem item={it} compact />
                  </div>
                ))}
              </div>
            </div>

            <aside className="space-y-4">
              <SidePanel icon={<MapPin size={14} />} title="Delivery address">
                {order.shippingAddress.fullName}
                <br />
                {order.shippingAddress.line1}
                <br />
                {order.shippingAddress.city}, {order.shippingAddress.region} {order.shippingAddress.postalCode}
              </SidePanel>
              <SidePanel icon={<Truck size={14} />} title="Shipping method">
                {order.shippingMethod.label}
              </SidePanel>
              <SidePanel icon={<ClipboardList size={14} />} title="Payment">
                {order.paymentSummary.method}
              </SidePanel>
              <Link to="/" className="ck-btn-secondary block text-center no-underline">
                Back to store
              </Link>
            </aside>
          </div>
        </main>
        <CheckoutFooter />
      </div>
    </CheckoutConfigProvider>
  );
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
      <div className="text-sm">{children}</div>
    </div>
  );
}

function iconForStatus(s: string) {
  if (s === "placed" || s === "paid") return ClipboardList;
  if (s === "packed") return Package;
  if (s === "shipped" || s === "out_for_delivery") return Truck;
  return MapPin;
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
