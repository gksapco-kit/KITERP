import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bookmark,
  Download,
  LayoutTemplate,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { businessCategories, getCategoryLabel } from '../lib/categories'
import { loadPersistedSite } from '../lib/sitePersistence'
import { openWebsiteBuilder, openWebsiteBuilderWithBuiltIn } from '../lib/vendorWebsiteNav'
import {
  deleteSavedTemplate,
  downloadTemplatesBackupFile,
  formatSavedTemplateDate,
  importTemplates,
  listSavedTemplates,
  parseTemplatesImportFile,
  recoverTemplatesFromBackupIfNeeded,
  type SavedTemplate,
} from '../lib/savedTemplatePersistence'
import {
  getTemplatesForSelection,
  websiteTemplates,
  type WebsiteTemplate,
} from '../lib/websiteTemplates'

function categoryEmoji(category: SavedTemplate['siteConfig']['category']): string {
  return businessCategories.find((c) => c.id === category)?.emoji ?? '📄'
}

function BuiltInTemplateCard({
  tpl,
  onUse,
}: {
  tpl: WebsiteTemplate
  onUse: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onUse(tpl.id)}
      className="overflow-hidden rounded-xl border-2 border-gray-200 bg-white text-left transition hover:border-brand-400 hover:shadow-md"
    >
      <div className={`flex h-28 items-center justify-center bg-gradient-to-br ${tpl.preview.gradient}`}>
        <span className="text-5xl">{tpl.preview.emoji}</span>
      </div>
      <div className="p-4">
        <p className="font-semibold text-gray-900">{tpl.name}</p>
        <p className="mt-1 text-xs text-gray-500">{tpl.description}</p>
        <p className="mt-2 text-[10px] text-gray-400">{getCategoryLabel(tpl.category)}</p>
      </div>
    </button>
  )
}

export function TemplatesManagerPage() {
  const [templates, setTemplates] = useState<SavedTemplate[]>([])
  const [importMessage, setImportMessage] = useState('')
  const [recoveredCount, setRecoveredCount] = useState(0)
  const importInputRef = useRef<HTMLInputElement>(null)

  const refresh = () => setTemplates(listSavedTemplates())

  const builtInTemplates = useMemo(() => {
    const persisted = loadPersistedSite()
    const config = persisted?.siteConfig
    if (config?.category && config?.businessType) {
      const filtered = getTemplatesForSelection(config.category, config.businessType)
      if (filtered.length > 0) return filtered
    }
    return websiteTemplates
  }, [])

  const builtInFilterHint = useMemo(() => {
    const persisted = loadPersistedSite()
    const config = persisted?.siteConfig
    if (config?.category && config?.businessType) {
      return `${getCategoryLabel(config.category)} · ${config.businessType}`
    }
    return 'All categories'
  }, [])

  useEffect(() => {
    const recovered = recoverTemplatesFromBackupIfNeeded()
    setRecoveredCount(recovered)
    refresh()
  }, [])

  const handleDelete = (tpl: SavedTemplate) => {
    if (!confirm(`Delete template "${tpl.name}"? This cannot be undone.`)) return
    deleteSavedTemplate(tpl.id)
    refresh()
  }

  const handleDownload = () => {
    if (!downloadTemplatesBackupFile()) {
      setImportMessage('No saved templates to download yet.')
      return
    }
    setImportMessage('Template backup downloaded.')
  }

  const handleRestore = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = parseTemplatesImportFile(JSON.parse(text))
      const count = importTemplates(parsed)
      setRecoveredCount(0)
      refresh()
      setImportMessage(`Restored ${count} template${count === 1 ? '' : 's'} from backup file.`)
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : 'Could not import that file.')
    }
  }

  const handleUseBuiltIn = (templateId: string) => {
    const tpl = websiteTemplates.find((t) => t.id === templateId)
    if (!tpl) return
    if (
      !confirm(
        `Open "${tpl.name}" in Website Builder? Your current site draft will be replaced.`,
      )
    ) {
      return
    }
    openWebsiteBuilderWithBuiltIn(templateId)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-50">
      <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
                <LayoutTemplate className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Website Templates</h1>
                <p className="text-sm text-gray-500">
                  Built-in layouts and your saved templates — stored in this browser.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <Upload className="h-3.5 w-3.5" />
              Restore template
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={templates.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download templates
            </button>
            <button
              type="button"
              onClick={() => openWebsiteBuilder()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
            >
              <Plus className="h-3.5 w-3.5" />
              New template
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleRestore(file)
                e.target.value = ''
              }}
            />
          </div>
        </div>
        {recoveredCount > 0 && (
          <p className="mt-3 text-xs font-medium text-green-700">
            Recovered {recoveredCount} template{recoveredCount === 1 ? '' : 's'} from automatic browser
            backup.
          </p>
        )}
        {importMessage && <p className="mt-2 text-xs text-gray-600">{importMessage}</p>}
      </header>

      <main className="flex-1 space-y-10 overflow-y-auto p-6">
        <section>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Your saved templates</h2>
            <span className="text-xs text-gray-400">{templates.length} saved</span>
          </div>

          {templates.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 bg-white px-6 py-10 text-center">
              <Bookmark className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No saved templates yet</p>
              <p className="mt-1 text-xs text-gray-400">
                Build a site in Website Builder, then use <strong>Templates → Save</strong> in the header
                toolbar.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {templates.map((tpl) => (
                <article
                  key={tpl.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-brand-200 hover:shadow-md"
                >
                  <div className="flex h-28 items-center justify-center bg-gradient-to-br from-brand-100 to-indigo-100">
                    <span className="text-5xl">{categoryEmoji(tpl.siteConfig.category)}</span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900">{tpl.name}</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {tpl.siteName} · {tpl.pages.length} page{tpl.pages.length === 1 ? '' : 's'}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-400">{formatSavedTemplateDate(tpl.savedAt)}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openWebsiteBuilder(tpl.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tpl)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Built-in templates</h2>
              <p className="text-xs text-gray-500">{builtInFilterHint}</p>
            </div>
            <span className="text-xs text-gray-400">{builtInTemplates.length} available</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {builtInTemplates.map((tpl) => (
              <BuiltInTemplateCard key={tpl.id} tpl={tpl} onUse={handleUseBuiltIn} />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
