import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  SlidersHorizontal,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  Info,
  GitBranch,
} from 'lucide-react'
import { PR_FIELDS, PO_FIELDS, type DocType } from '@/lib/procurementFieldCatalog'
import { DocTypeFieldList } from '@/components/procurement/FieldStatusEditor'
import { useProcurementFieldConfig } from '@/hooks/useProcurementFieldConfig'

export default function ProcurementFieldConfigPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'PR' | 'PO'>('PR')
  const { getStatus, setStatus, save, resetDocType, resetAll, dirty, saved, overrideCount } =
    useProcurementFieldConfig()

  const docType = tab as DocType

  return (
    <div className="space-y-6 pb-24">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-primary" />
            Procurement Field Configuration
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Control which fields are <strong>mandatory</strong>, <strong>optional</strong>, or{' '}
            <strong>suppressed</strong> on Purchase Requisitions and Purchase Orders.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate('/procurement/workflow')}
          >
            <GitBranch className="w-4 h-4" />
            Approval Workflow
          </Button>
          {(overrideCount('PR') > 0 || overrideCount('PO') > 0) && (
            <button
              type="button"
              onClick={resetAll}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-lg hover:border-red-300 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset all
            </button>
          )}
          <Button onClick={save} disabled={!dirty} className="gap-2">
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <strong>How field status works:</strong>{' '}
          <span className="text-rose-600 dark:text-rose-400 font-medium">Mandatory</span> — the field is required and enforced on save.{' '}
          <span className="text-blue-600 dark:text-blue-400 font-medium">Optional</span> — the field is shown but not required.{' '}
          <span className="text-gray-500 font-medium">Suppress</span> — the field is hidden from the form entirely.
          Changes apply to all users in your organisation.
          To configure <strong>approval workflow fields</strong>, use the{' '}
          <button
            type="button"
            className="underline font-semibold hover:text-blue-900 dark:hover:text-blue-200"
            onClick={() => navigate('/procurement/workflow')}
          >
            Approval Workflow
          </button>{' '}
          page.
        </div>
      </div>

      {/* Unsaved changes warning */}
      {dirty && (
        <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          You have unsaved changes. Click <strong>Save changes</strong> to apply them.
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={v => setTab(v as 'PR' | 'PO')}>
        <TabsList className="mb-4">
          <TabsTrigger value="PR" className="gap-2">
            Purchase Requisition (PR)
            {overrideCount('PR') > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-primary/10 text-primary font-semibold">
                {overrideCount('PR')}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="PO" className="gap-2">
            Purchase Order (PO)
            {overrideCount('PO') > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-primary/10 text-primary font-semibold">
                {overrideCount('PO')}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="PR">
          <DocTypeFieldList
            docType="PR"
            fields={PR_FIELDS}
            getStatus={getStatus}
            setStatus={setStatus}
            resetDocType={resetDocType}
            overrideCount={overrideCount}
          />
        </TabsContent>

        <TabsContent value="PO">
          <DocTypeFieldList
            docType="PO"
            fields={PO_FIELDS}
            getStatus={getStatus}
            setStatus={setStatus}
            resetDocType={resetDocType}
            overrideCount={overrideCount}
          />
        </TabsContent>
      </Tabs>

      {/* Floating save bar */}
      {dirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 dark:bg-gray-800 text-white px-5 py-3 rounded-2xl shadow-2xl ring-1 ring-white/10">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm">Unsaved changes</span>
          <Button
            size="sm"
            onClick={save}
            className="bg-white text-gray-900 hover:bg-gray-100 font-semibold gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
        </div>
      )}
    </div>
  )
}
