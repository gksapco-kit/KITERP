import { useState } from "react";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { mockProducts } from "@/commerce-blocks/mock/products";

interface Props {
  showImages?: boolean;
  showShipping?: boolean;
  cta?: string;
  layout?: "drawer" | "page";
}

export function MiniCart({
  showImages = true,
  showShipping = true,
  cta = "Checkout",
  layout = "drawer",
}: Props) {
  const initial = mockProducts.slice(0, 3).map((p) => ({ ...p, qty: 1 }));
  const [items, setItems] = useState(initial);

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const shipping = showShipping ? (subtotal > 75 ? 0 : 8) : 0;
  const total = subtotal + shipping;

  const update = (id: string, delta: number) =>
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
        .filter((i) => i.qty > 0),
    );
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const containerClass =
    layout === "drawer"
      ? "mx-auto flex max-w-md flex-col p-6"
      : "mx-auto grid max-w-4xl gap-8 p-6 md:grid-cols-[1fr_320px]";

  const itemsList = (
    <div className="space-y-4">
      {items.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Your cart is empty.</p>
      )}
      {items.map((i) => (
        <div key={i.id} className="flex gap-3">
          {showImages && i.image && (
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
              <img src={i.image} alt={i.name} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium">{i.name}</div>
              <button
                onClick={() => remove(i.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="text-xs text-muted-foreground">{i.category}</div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center rounded-md border border-input">
                <button
                  className="px-2 py-1 text-muted-foreground hover:text-foreground"
                  onClick={() => update(i.id, -1)}
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-7 text-center text-xs tabular-nums">{i.qty}</span>
                <button
                  className="px-2 py-1 text-muted-foreground hover:text-foreground"
                  onClick={() => update(i.id, 1)}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="text-sm font-medium">
                {formatPrice(i.price * i.qty, i.currency)}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const summary = (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal</span>
        <span>{formatPrice(subtotal)}</span>
      </div>
      {showShipping && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Shipping</span>
          <span>{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
        </div>
      )}
      <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
        <span>Total</span>
        <span>{formatPrice(total)}</span>
      </div>
      <Button className="w-full" size="lg" disabled={items.length === 0}>
        <ShoppingBag className="h-4 w-4" />
        {cta}
      </Button>
    </div>
  );

  if (layout === "page") {
    return (
      <section className={containerClass}>
        <div>
          <h2 className="mb-4 text-2xl font-semibold">Your cart</h2>
          {itemsList}
        </div>
        <div>{summary}</div>
      </section>
    );
  }

  return (
    <section className={containerClass}>
      <h2 className="mb-4 text-lg font-semibold">Your cart ({items.length})</h2>
      {itemsList}
      <div className="mt-6">{summary}</div>
    </section>
  );
}
