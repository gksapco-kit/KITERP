import { Trash2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { CartLine } from "../types";
import { formatPrice } from "../mock";

export interface MiniCartProps {
  lines: CartLine[];
  onUpdateQty?: (id: string, qty: number) => void;
  onRemove?: (id: string) => void;
  onCheckout?: () => void;
}

export function MiniCart({ lines, onUpdateQty, onRemove, onCheckout }: MiniCartProps) {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  return (
    <div className="flex flex-col h-full">
      {lines.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">Your cart is empty.</div>
      ) : (
        <ul className="flex-1 overflow-auto p-4 space-y-3">
          {lines.map((l) => (
            <li key={l.id} className="flex gap-3">
              <img src={l.image} alt={l.name} className="h-16 w-16 rounded-md object-cover border" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{l.name}</div>
                {l.variant && <div className="text-xs text-muted-foreground">{l.variant}</div>}
                <div className="mt-1 inline-flex items-center border rounded-md">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdateQty?.(l.id, Math.max(1, l.qty - 1))}><Minus /></Button>
                  <span className="w-6 text-center text-xs">{l.qty}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdateQty?.(l.id, l.qty + 1)}><Plus /></Button>
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="font-medium">{formatPrice(l.price * l.qty)}</div>
                <Button variant="ghost" size="icon" className="h-7 w-7 mt-1" onClick={() => onRemove?.(l.id)} aria-label="Remove">
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold">{formatPrice(subtotal)}</span>
        </div>
        <p className="text-xs text-muted-foreground">Shipping & taxes calculated at checkout.</p>
        <Separator />
        <Button className="w-full" onClick={onCheckout} disabled={!lines.length}>Checkout</Button>
      </div>
    </div>
  );
}
