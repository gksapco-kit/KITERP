import { useMemo, useState } from 'react'
import { Loader2, Printer, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useYieldProducts } from '@/hooks/useYield'
import { rawInputFor, outputFrom, formatQty } from '@/lib/yieldCalc'
import type { YieldProduct } from '@/api/yield'

type Mode = 'order' | 'stock'

/**
 * Customer asks for finished cuts (1 kg leg, 2 kg boneless …); the sheet shows how much
 * raw stock to cut for each and in total. "From stock" turns raw on hand into output per cut.
 */
export function CuttingSheet({ compact = false }: { compact?: boolean }) {
  const { data: products = [], isLoading } = useYieldProducts()
  const [productId, setProductId] = useState('')
  const [mode, setMode] = useState<Mode>('order')
  const [wanted, setWanted] = useState<Record<string, string>>({})
  const [rawOnHand, setRawOnHand] = useState('')

  const product: YieldProduct | undefined = useMemo(
    () => products.find((p) => p.id === productId) ?? products[0],
    [products, productId],
  )
  const uom = product?.pool_uom || 'kg'
  const cuts = (product?.cuts ?? []).filter((c) => (c.yield_factor ?? 0) > 0)

  const rows = cuts.map((c) => {
    const output = Number(wanted[c.variant_id] || 0)
    return { cut: c, output, raw: rawInputFor(output, c.yield_factor ?? 0) }
  })
  const totalOutput = rows.reduce((s, r) => s + r.output, 0)
  const totalRaw = rows.reduce((s, r) => s + r.raw, 0)
  const short = product?.stock_on_hand != null && totalRaw > product.stock_on_hand

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }
  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No products use cutting yield yet. Open a product, go to the Yield &amp; Cutting tab and turn on "Sold after cutting".
      </p>
    )
  }

  return (
    <div className="space-y-3 print:text-black">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={product?.id ?? ''}
          onChange={(v) => { setProductId(v); setWanted({}) }}
          options={products.map((p) => ({ value: p.id, label: p.name }))}
          className="w-48"
        />
        <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
          {(['order', 'stock'] as Mode[]).map((m) => (
            <button
              key={m} type="button" onClick={() => setMode(m)}
              className={`px-2.5 py-1 rounded ${mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              {m === 'order' ? 'Customer order → raw to cut' : 'Raw stock → output'}
            </button>
          ))}
        </div>
        {product?.stock_on_hand != null && (
          <span className="text-xs text-muted-foreground ml-auto">On hand: {formatQty(product.stock_on_hand, uom)}</span>
        )}
      </div>

      {cuts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Set a yield factor on this product's cuts first.</p>
      ) : mode === 'order' ? (
        <>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left font-medium py-1.5">Cut</th>
                <th className="text-left font-medium py-1.5 w-32">Customer wants ({uom})</th>
                <th className="text-right font-medium py-1.5">Factor</th>
                <th className="text-right font-medium py-1.5">Raw to cut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cut, raw }) => (
                <tr key={cut.variant_id} className="border-b border-border/60">
                  <td className="py-1.5">{cut.cut || cut.name}</td>
                  <td className="py-1">
                    <Input
                      type="number" min="0" step="0.05" inputMode="decimal"
                      value={wanted[cut.variant_id] ?? ''}
                      onChange={(e) => setWanted((w) => ({ ...w, [cut.variant_id]: e.target.value }))}
                      className={compact ? 'h-8' : 'h-9'}
                      placeholder="0"
                    />
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">× {cut.yield_factor?.toFixed(2)}</td>
                  <td className="py-1.5 text-right tabular-nums font-medium">{raw > 0 ? formatQty(raw, uom) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-2 font-semibold">Total</td>
                <td className="pt-2 tabular-nums">{formatQty(totalOutput, uom)}</td>
                <td />
                <td className={`pt-2 text-right tabular-nums font-bold ${short ? 'text-red-600' : ''}`}>{formatQty(totalRaw, uom)}</td>
              </tr>
            </tfoot>
          </table>
          {short && (
            <p className="text-xs text-red-600">
              Needs {formatQty(totalRaw - (product?.stock_on_hand ?? 0), uom)} more raw stock than is on hand.
            </p>
          )}
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => setWanted({})}><RotateCcw className="h-4 w-4 mr-1" /> Clear</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={totalRaw <= 0}><Printer className="h-4 w-4 mr-1" /> Print for cutter</Button>
          </div>
        </>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm">
            Raw stock ({uom})
            <Input
              type="number" min="0" step="0.1" inputMode="decimal"
              value={rawOnHand}
              onChange={(e) => setRawOnHand(e.target.value)}
              placeholder={product?.stock_on_hand != null ? String(product.stock_on_hand) : '0'}
              className="h-9 w-32"
            />
          </label>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left font-medium py-1.5">If all of it is cut as</th>
                <th className="text-right font-medium py-1.5">Factor</th>
                <th className="text-right font-medium py-1.5">Output</th>
              </tr>
            </thead>
            <tbody>
              {cuts.map((c) => {
                const raw = Number(rawOnHand || product?.stock_on_hand || 0)
                return (
                  <tr key={c.variant_id} className="border-b border-border/60">
                    <td className="py-1.5">{c.cut || c.name}</td>
                    <td className="py-1.5 text-right tabular-nums text-muted-foreground">÷ {c.yield_factor?.toFixed(2)}</td>
                    <td className="py-1.5 text-right tabular-nums font-medium">{formatQty(outputFrom(raw, c.yield_factor ?? 0), uom)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
