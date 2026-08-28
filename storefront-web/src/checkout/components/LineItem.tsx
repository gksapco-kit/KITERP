import { Minus, Plus, Trash2 } from "lucide-react";
import { CartItem } from "../types";
import { formatMoney, useCheckoutConfig } from "../config";
import { ProductThumb } from "@/components/products/ProductThumb";

type Props = {
  item: CartItem;
  editable?: boolean;
  onUpdateQuantity?: (id: string, q: number) => void;
  onRemove?: (id: string) => void;
  compact?: boolean;
};

export function LineItem({ item, editable, onUpdateQuantity, onRemove, compact }: Props) {
  const { locale } = useCheckoutConfig();
  const lineTotal = { amount: item.unitPrice.amount * item.quantity, currency: item.unitPrice.currency };

  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div
        className="ck-radius-sm relative flex shrink-0 items-center justify-center"
        style={{
          width: compact ? 80 : 96,
          height: compact ? 80 : 96,
          background: "hsl(var(--surface-muted))",
          overflow: "hidden",
        }}
      >
        <ProductThumb
          src={item.imageUrl}
          alt={item.name}
          size={compact ? "sm" : "md"}
          className="absolute inset-0"
          imgClassName="object-cover object-center"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 sm:pr-1">
            <div className="text-sm font-medium leading-snug break-words sm:line-clamp-3">{item.name}</div>
            {item.variantLabel && <div className="ck-text-muted mt-0.5 text-xs">{item.variantLabel}</div>}
            {item.inStock === false && (
              <span className="ck-badge ck-badge-warning mt-1">Out of stock</span>
            )}
          </div>
          <div className="shrink-0 text-sm font-medium tabular-nums sm:pt-0.5 sm:text-right">
            {formatMoney(lineTotal, locale)}
          </div>
        </div>

        {(editable || onRemove) && (
          <div className="mt-2 flex items-center justify-between">
            {editable ? (
              <div
                className="ck-border ck-radius-sm flex items-center"
                style={{ width: "fit-content" }}
              >
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  className="ck-btn-ghost"
                  onClick={() => onUpdateQuantity?.(item.id, Math.max(1, item.quantity - 1))}
                  disabled={item.quantity <= 1}
                  style={{ padding: "6px 10px" }}
                >
                  <Minus size={14} />
                </button>
                <span className="px-2 text-sm" style={{ minWidth: 24, textAlign: "center" }}>
                  {item.quantity}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  className="ck-btn-ghost"
                  onClick={() =>
                    onUpdateQuantity?.(item.id, Math.min(item.maxQuantity ?? 99, item.quantity + 1))
                  }
                  disabled={item.quantity >= (item.maxQuantity ?? 99)}
                  style={{ padding: "6px 10px" }}
                >
                  <Plus size={14} />
                </button>
              </div>
            ) : (
              <span />
            )}
            {onRemove && (
              <button
                type="button"
                className="ck-btn-ghost flex items-center gap-1"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.name}`}
              >
                <Trash2 size={14} /> Remove
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
