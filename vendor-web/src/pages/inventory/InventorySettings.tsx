import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Barcode, Loader2, Save, ArrowLeft, Info } from 'lucide-react'
import { vendorApi } from '@/api/vendor'
import type { InventorySettings } from '@/api/vendor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function InventorySettingsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-settings'],
    queryFn: () => vendorApi.getInventorySettings(),
  })

  const [autoBarcode, setAutoBarcode] = useState(true)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (data) {
      setAutoBarcode(data.auto_generate_barcode)
      setDirty(false)
    }
  }, [data])

  const save = useMutation({
    mutationFn: (body: InventorySettings) => vendorApi.updateInventorySettings(body),
    onSuccess: (next) => {
      qc.setQueryData(['inventory-settings'], next)
      setDirty(false)
      toast.success('Inventory settings saved')
    },
    onError: () => toast.error('Could not save settings'),
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/inventory"
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Inventory
          </Link>
          <h1 className="text-xl font-semibold text-foreground">Inventory config</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Coding and identification preferences for products and variants.
          </p>
        </div>
        <Button
          size="sm"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate({ auto_generate_barcode: autoBarcode })}
        >
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Barcode className="h-4 w-4 text-muted-foreground" />
            Barcode generation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={cn(
              'flex items-start justify-between gap-4 rounded-lg border px-3 py-3',
              autoBarcode ? 'border-primary/30 bg-primary/[0.04]' : 'bg-muted/20',
            )}
          >
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-foreground">Auto-generate barcodes</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                When on, creating variants from the configurator fills a barcode automatically.
                When off, barcodes stay empty so you can type or scan your own.
              </p>
            </div>
            <Switch
              checked={autoBarcode}
              onCheckedChange={(v) => {
                setAutoBarcode(v)
                setDirty(true)
              }}
            />
          </div>

          <div className="flex gap-2 rounded-md border border-dashed bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {autoBarcode
                ? 'New generated variants will receive a system barcode. You can still edit any barcode later.'
                : 'New generated variants will have a blank barcode field for manual entry on the product or variant form.'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
