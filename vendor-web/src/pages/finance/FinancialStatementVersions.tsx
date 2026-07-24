import { useState } from 'react'
import {
  Plus, Pencil, Trash2, ChevronRight, X, RefreshCw, AlertCircle,
  FileText, BarChart2, CheckCircle2, Eye, Settings2, ChevronDown,
  TrendingUp, TrendingDown,
} from 'lucide-react'
import {
  useFsvList, useSeedFsv, useCreateFsv, useUpdateFsv, useDeleteFsv,
  useFsvNodes, useComputeFsv,
} from '@/hooks/useFinance'
import type { FsvVersion, FsvNode, FsvResultRow } from '@/api/finance'

import { askConfirm } from '@/components/common/ConfirmProvider'
import { Select } from '@/components/ui/select'
import { ModalBody, ModalFooter, ModalHeader, ModalOverlay, ModalPanel } from '@/components/ui/Modal'

const fmtAmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n))

// ─── Statement preview ────────────────────────────────────────────────────────
function StatementPreview({ versionId }: { versionId: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const fyStart = `${today.slice(0, 4)}-04-01`
  const [from, setFrom] = useState(fyStart)
  const [to, setTo] = useState(today)
  const [applied, setApplied] = useState({ from_date: fyStart, to_date: today })

  const { data, isLoading, refetch } = useComputeFsv(versionId, applied)

  return (
    <div className="space-y-3">
      {/* Date range */}
      <div className="flex items-center gap-3 flex-wrap p-3 bg-muted/30 border border-border rounded-xl">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-input rounded-lg px-2 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-input rounded-lg px-2 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <button onClick={() => setApplied({ from_date: from, to_date: to })}
          className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90">
          Apply
        </button>
        <button onClick={() => refetch()} className="p-1.5 text-muted-foreground hover:text-foreground border border-border rounded-lg">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Report table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> Computing…
        </div>
      ) : !data ? null : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{data.version_name}</h3>
              <p className="text-xs text-muted-foreground">{data.from_date} → {data.to_date}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {data.statement_type === 'income_statement' ? 'P&L' : 'Balance Sheet'}
            </span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {(data.rows as FsvResultRow[]).map(row => {
                if (row.node_type === 'separator') {
                  return <tr key={row.node_id}><td colSpan={2} className="py-1" /></tr>
                }
                const negative = row.value < 0
                const indent = row.indent_level * 20
                return (
                  <tr key={row.node_id} className={`${row.node_type === 'subtotal' ? 'border-t border-border/60' : ''} hover:bg-muted/20`}>
                    <td className="px-4 py-2" style={{ paddingLeft: `${16 + indent}px` }}>
                      <span className={row.bold ? 'font-bold text-foreground' : row.node_type === 'group' ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                        {row.name}
                      </span>
                    </td>
                    <td className={`px-4 py-2 text-right font-mono ${row.bold ? 'font-bold' : ''} ${negative ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                      {row.node_type === 'group' ? '' : (
                        <span>{negative ? `(${fmtAmt(row.value)})` : fmtAmt(row.value)}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Node tree ───────────────────────────────────────────────────────────────
function NodeTree({
  nodes, versionId, onEdit, onDelete,
}: {
  nodes: FsvNode[]
  versionId: string
  onEdit: (n: FsvNode) => void
  onDelete: (n: FsvNode) => void
}) {
  const NODE_TYPE_BADGE: Record<string, string> = {
    group: 'bg-blue-50 text-blue-700',
    item: 'bg-green-50 text-green-700',
    subtotal: 'bg-violet-50 text-violet-700',
    separator: 'bg-muted text-muted-foreground',
  }

  const renderNodes = (parentId: string | null, depth: number): React.ReactNode => {
    const children = nodes.filter(n => n.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order)
    return children.map(n => (
      <div key={n.id}>
        <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 rounded-lg group"
          style={{ paddingLeft: `${12 + depth * 18}px` }}>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 shrink-0" />
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${NODE_TYPE_BADGE[n.node_type] ?? 'bg-muted text-muted-foreground'}`}>
            {n.node_type}
          </span>
          <span className={`flex-1 text-sm ${n.bold ? 'font-bold' : ''}`}>{n.name}</span>
          {n.sign_flip && <span className="text-xs text-orange-500">±flip</span>}
          <span className="text-xs text-muted-foreground/50">ord {n.sort_order}</span>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(n)} className="p-1 hover:text-primary text-muted-foreground">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(n)} className="p-1 hover:text-red-500 text-muted-foreground">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {renderNodes(n.id, depth + 1)}
      </div>
    ))
  }

  return <div className="bg-card rounded-xl border border-border p-2">{renderNodes(null, 0)}</div>
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FinancialStatementVersions() {
  const { data: versions = [], isLoading } = useFsvList()
  const seedMut = useSeedFsv()
  const createMut = useCreateFsv()
  const updateMut = useUpdateFsv()
  const deleteMut = useDeleteFsv()

  const [selectedId, setSelectedId] = useState('')
  const [tab, setTab] = useState<'nodes' | 'preview'>('nodes')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', statement_type: 'income_statement', description: '' })
  const [error, setError] = useState('')

  const selectedVersion = (versions as FsvVersion[]).find(v => v.id === selectedId)
  const { data: nodes = [] } = useFsvNodes(selectedId)

  const handleCreate = () => {
    setError('')
    createMut.mutate(newForm, {
      onSuccess: v => { setSelectedId((v as FsvVersion).id); setShowNewForm(false) },
      onError: (e: any) => setError(e?.response?.data?.detail || 'Creation failed'),
    })
  }

  const handleDelete = async (v: FsvVersion) => {
    if (!await askConfirm(`Delete FSV "${v.name}"? This will also delete all its nodes.`)) return
    deleteMut.mutate(v.id, {
      onSuccess: () => { if (selectedId === v.id) setSelectedId('') },
    })
  }

  const STMT_ICON = { income_statement: TrendingUp, balance_sheet: BarChart2 }

  return (
    <div className="mx-auto max-w-7xl space-y-3 p-3 md:p-4">
      {/* Header — title already shown in the top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          Define customisable P&L and Balance Sheet layouts.
        </p>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => seedMut.mutate()}
            disabled={seedMut.isPending}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-foreground hover:bg-muted/30 disabled:opacity-50"
          >
            {seedMut.isPending ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Seeding…</> : 'Seed Defaults'}
          </button>
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> New FSV
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left: version list */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Versions</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (versions as FsvVersion[]).length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No versions yet. Seed defaults or create one.
            </div>
          ) : (versions as FsvVersion[]).map(v => {
            const Icon = STMT_ICON[v.statement_type as keyof typeof STMT_ICON] ?? FileText
            return (
              <button
                key={v.id}
                onClick={() => { setSelectedId(v.id); setTab('nodes') }}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  selectedId === v.id
                    ? 'border-primary/60 bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:bg-muted/30'
                }`}
              >
                <Icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{v.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.statement_type === 'income_statement' ? 'Income Statement' : 'Balance Sheet'}
                    {v.is_default && <span className="ml-1 text-green-600 font-medium">· Default</span>}
                  </p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(v) }}
                  className="p-1 text-muted-foreground/40 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </button>
            )
          })}
        </div>

        {/* Right: detail panel */}
        <div className="md:col-span-2 space-y-3">
          {!selectedVersion ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl text-muted-foreground gap-2">
              <Settings2 className="w-10 h-10 opacity-25" />
              <p className="text-sm">Select a version to view or edit</p>
            </div>
          ) : (
            <>
              {/* Version header */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-foreground">{selectedVersion.name}</h2>
                  {selectedVersion.description && (
                    <p className="text-xs text-muted-foreground">{selectedVersion.description}</p>
                  )}
                </div>
                {/* Tabs */}
                <div className="flex border border-border rounded-lg overflow-hidden">
                  {[
                    { id: 'nodes', label: 'Structure', icon: Settings2 },
                    { id: 'preview', label: 'Preview', icon: Eye },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                        tab === t.id
                          ? 'bg-primary text-white'
                          : 'text-muted-foreground hover:bg-muted/30'
                      }`}
                    >
                      <t.icon className="w-3.5 h-3.5" /> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {tab === 'nodes' && (
                <NodeTree
                  nodes={nodes as FsvNode[]}
                  versionId={selectedId}
                  onEdit={n => {}} /* TODO: inline edit */
                  onDelete={n => {}}
                />
              )}
              {tab === 'preview' && (
                <StatementPreview versionId={selectedId} />
              )}
            </>
          )}
        </div>
      </div>

      {/* New FSV form modal */}
      {showNewForm && (
        <ModalOverlay onClose={() => setShowNewForm(false)} className="z-[100] bg-black/60 p-3">
          <ModalPanel className="max-w-sm max-h-[calc(100dvh-1.5rem)] !rounded-lg">
            <ModalHeader
              title="New FSV"
              onClose={() => setShowNewForm(false)}
              className="border-0 px-4 py-3 [&>div>h2]:text-base [&>div>h2]:leading-none"
            />
            <ModalBody className="space-y-3 px-4 pb-1 pt-0">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
                <input
                  value={newForm.name}
                  onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Management P&L"
                  autoFocus
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Statement Type</label>
                <Select
                  value={newForm.statement_type}
                  onChange={v => setNewForm(f => ({ ...f, statement_type: v }))}
                  options={[
                    { value: 'income_statement', label: 'Income Statement (P&L)' },
                    { value: 'balance_sheet', label: 'Balance Sheet' },
                    { value: 'custom', label: 'Custom' },
                  ]}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
                <input
                  value={newForm.description}
                  onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </ModalBody>
            <ModalFooter className="border-0 px-4 py-3">
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newForm.name || createMut.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {createMut.isPending ? 'Creating…' : 'Create'}
              </button>
            </ModalFooter>
          </ModalPanel>
        </ModalOverlay>
      )}
    </div>
  )
}
