/**
 * FI Document Types master (SAP OBA7).
 * Codes such as SA, DR, KR classify journals and drive number ranges.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { FileText, Plus, Trash2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  useDocumentTypes,
  useSeedDocumentTypes,
  useCreateDocumentType,
  useUpdateDocumentType,
  useDeleteDocumentType,
} from '@/hooks/useFinance'
import type { DocumentType } from '@/api/finance'
import { onClickableTableRow } from '@/lib/clickableTableRow'

type Form = Omit<DocumentType, 'id'>

const BLANK: Form = {
  code: '',
  name: '',
  description: null,
  number_range_prefix: null,
  reversal_doc_type: null,
  is_active: true,
  sort_order: 10,
}

function fmtErr(e: unknown) {
  const d = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (!d) return 'Save failed'
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((x: { msg?: string }) => x?.msg ?? JSON.stringify(x)).join('; ')
  return JSON.stringify(d)
}

export default function DocumentTypes() {
  const { data: types = [], isLoading } = useDocumentTypes()
  const seed = useSeedDocumentTypes()
  const create = useCreateDocumentType()
  const update = useUpdateDocumentType()
  const del = useDeleteDocumentType()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DocumentType | null>(null)
  const [form, setForm] = useState<Form>(BLANK)

  const isSaving = create.isPending || update.isPending

  const openNew = () => {
    setEditing(null)
    setForm(BLANK)
    setOpen(true)
  }

  const openEdit = (dt: DocumentType) => {
    setEditing(dt)
    setForm({
      code: dt.code,
      name: dt.name,
      description: dt.description,
      number_range_prefix: dt.number_range_prefix,
      reversal_doc_type: dt.reversal_doc_type,
      is_active: dt.is_active,
      sort_order: dt.sort_order,
    })
    setOpen(true)
  }

  const handleSave = async () => {
    try {
      if (editing) await update.mutateAsync({ id: editing.id, data: form })
      else await create.mutateAsync(form)
      toast.success(editing ? 'Document type updated.' : 'Document type created.')
      setOpen(false)
    } catch (e) {
      toast.error(fmtErr(e))
    }
  }

  const handleSeed = async () => {
    try {
      const res = await seed.mutateAsync()
      toast.success(res.seeded ? `Seeded ${res.seeded} document type(s).` : 'Defaults already present.')
    } catch (e) {
      toast.error(fmtErr(e))
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Document Types
          </h1>
          <p className="text-muted-foreground mt-1">
            FI document type codes (SA, DR, KR, …) used on journals and number ranges.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleSeed} disabled={seed.isPending}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${seed.isPending ? 'animate-spin' : ''}`} />
            Seed defaults
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1.5" />
            New type
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Prefix</th>
                    <th className="px-3 py-2 font-medium">Reversal</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium w-16" />
                  </tr>
                </thead>
                <tbody>
                  {types.map(dt => (
                    <tr
                      key={dt.id}
                      className="border-b hover:bg-muted/30 cursor-pointer"
                      {...onClickableTableRow(() => openEdit(dt))}
                    >
                      <td className="px-3 py-2 font-mono font-medium">{dt.code}</td>
                      <td className="px-3 py-2">
                        <div>{dt.name}</div>
                        {dt.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">{dt.description}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {dt.number_range_prefix || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">
                        {dt.reversal_doc_type || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={dt.is_active ? 'default' : 'secondary'}>
                          {dt.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => del.mutate(dt.id, {
                            onSuccess: () => toast.success('Document type deleted.'),
                            onError: (e) => toast.error(fmtErr(e)),
                          })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {types.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                        No document types yet. Seed defaults or create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'New'} Document Type</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Code</Label>
                <Input
                  placeholder="SA"
                  maxLength={4}
                  value={form.code}
                  disabled={!!editing}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                placeholder="G/L Account Document"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description ?? ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value || null }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Number prefix</Label>
                <Input
                  placeholder="JV"
                  maxLength={10}
                  value={form.number_range_prefix ?? ''}
                  onChange={e => setForm(f => ({
                    ...f,
                    number_range_prefix: e.target.value.toUpperCase() || null,
                  }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Reversal type</Label>
                <Input
                  placeholder="DG"
                  maxLength={4}
                  value={form.reversal_doc_type ?? ''}
                  onChange={e => setForm(f => ({
                    ...f,
                    reversal_doc_type: e.target.value.toUpperCase() || null,
                  }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="dt-active">Active</Label>
              <Switch
                id="dt-active"
                checked={form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button
              disabled={!form.code.trim() || !form.name.trim() || isSaving}
              onClick={handleSave}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
