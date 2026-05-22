import { useState } from "react";
import { Wine, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mockWines, mockCombos, mockNutrition } from "@/commerce-blocks/mock/menuExtras";
import { formatPrice } from "@/commerce-blocks/lib/format";
import { cn } from "@/lib/utils";

/* ---------------- Wine Pairing ---------------- */

interface WineProps {
  showNotes?: boolean;
  showBottle?: boolean;
  title?: string;
}

export function WinePairing({
  showNotes = true,
  showBottle = true,
  title = "By the glass & bottle",
}: WineProps) {
  return (
    <section className="px-6 py-10">
      {title && <h2 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h2>}
      <div className="mx-auto max-w-3xl divide-y divide-border rounded-lg border border-border bg-card">
        {mockWines.map((w) => (
          <article key={w.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
            <Wine className="h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="font-medium">{w.name}</h4>
                <div className="text-right text-sm tabular-nums">
                  <div className="font-semibold">{formatPrice(w.glassPrice, w.currency)} / glass</div>
                  {showBottle && (
                    <div className="text-xs text-muted-foreground">
                      {formatPrice(w.bottlePrice, w.currency)} bottle
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {w.varietal} · {w.region}
              </div>
              {showNotes && (
                <p className="mt-2 text-sm italic text-muted-foreground">"{w.notes}"</p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Pairs with:
                </span>
                {w.pairs.map((p) => (
                  <Badge key={p} variant="outline" className="text-xs">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Combo / Set Menu ---------------- */

interface ComboProps {
  layout?: "grid" | "stacked";
  cta?: string;
}

export function ComboMenu({ layout = "grid", cta = "Order combo" }: ComboProps) {
  return (
    <section className="px-6 py-10">
      <h2 className="mb-6 text-2xl font-semibold tracking-tight">Combos & set menus</h2>
      <div
        className={cn(
          "mx-auto max-w-5xl gap-6",
          layout === "grid" ? "grid md:grid-cols-2" : "space-y-6",
        )}
      >
        {mockCombos.map((c) => (
          <article
            key={c.id}
            className="flex flex-col rounded-lg border border-border bg-gradient-to-br from-card to-accent/40 p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold">{c.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
              </div>
              {c.badge && <Badge variant="secondary">{c.badge}</Badge>}
            </div>
            <div className="mt-4 flex-1 space-y-3">
              {c.includes.map((step) => (
                <div key={step.label} className="rounded-md border border-border bg-card p-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {step.label}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {step.options.map((o) => (
                      <Badge key={o} variant="outline" className="font-normal">
                        {o}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
              <div className="text-2xl font-semibold">{formatPrice(c.price, c.currency)}</div>
              <Button>{cta}</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Nutrition Table ---------------- */

interface NutritionProps {
  showSodium?: boolean;
  compact?: boolean;
}

type SortKey = "calories" | "protein" | "carbs" | "fat" | "sodium" | null;

export function NutritionTable({ showSodium = true, compact = false }: NutritionProps) {
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [asc, setAsc] = useState(true);

  const sorted = [...mockNutrition].sort((a, b) => {
    if (!sortKey) return 0;
    return asc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey];
  });

  const toggle = (k: SortKey) => {
    if (sortKey === k) setAsc(!asc);
    else {
      setSortKey(k);
      setAsc(true);
    }
  };

  const cols: { key: SortKey; label: string; suffix: string; show?: boolean }[] = [
    { key: "calories", label: "Cal", suffix: "" },
    { key: "protein", label: "Protein", suffix: "g" },
    { key: "carbs", label: "Carbs", suffix: "g" },
    { key: "fat", label: "Fat", suffix: "g" },
    { key: "sodium", label: "Sodium", suffix: "mg", show: showSodium },
  ];

  return (
    <section className="px-6 py-10">
      <h2 className="mb-6 text-2xl font-semibold tracking-tight">Nutrition information</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className={cn("w-full text-sm", compact && "text-xs")}>
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className={cn("p-4 font-medium", compact && "p-2")}>Item</th>
              {cols
                .filter((c) => c.show !== false)
                .map((c) => (
                  <th key={c.key} className={cn("p-4 text-right font-medium", compact && "p-2")}>
                    <button
                      onClick={() => toggle(c.key)}
                      className={cn(
                        "inline-flex items-center gap-1 hover:text-foreground",
                        sortKey === c.key ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {c.label}
                      {sortKey === c.key && <span className="text-xs">{asc ? "▲" : "▼"}</span>}
                    </button>
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.itemId} className="border-b border-border last:border-0">
                <td className={cn("p-4 font-medium", compact && "p-2")}>{row.name}</td>
                {cols
                  .filter((c) => c.show !== false)
                  .map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "p-4 text-right tabular-nums text-muted-foreground",
                        compact && "p-2",
                      )}
                    >
                      {row[c.key as keyof typeof row]}
                      {c.suffix}
                    </td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        <Check className="mr-1 inline h-3 w-3" />
        Values are approximate per serving and may vary based on preparation.
      </p>
    </section>
  );
}
