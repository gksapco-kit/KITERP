import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Bookmark, Download, LayoutTemplate, Save, Trash2, Upload, X } from 'lucide-react'
import { applyBuiltInTemplateToStore } from '../../lib/applyBuiltInTemplate'
import { applySavedTemplateToStore } from '../../lib/applySavedTemplate'
import { businessCategories, getCategoryLabel } from '../../lib/categories'
import {
  deleteSavedTemplate,
  downloadTemplatesBackupFile,
  formatSavedTemplateDate,
  getSavedTemplate,
  importTemplates,
  listSavedTemplates,
  parseTemplatesImportFile,
  recoverTemplatesFromBackupIfNeeded,
  saveTemplate,
  updateSavedTemplate,
  isTemplateStorageError,
  type SavedTemplate,
} from '../../lib/savedTemplatePersistence'
import { StorageQuotaError } from '../../lib/largeStorage'
import { persistSite } from '../../lib/sitePersistence'
import { getTemplatesForSelection } from '../../lib/websiteTemplates'
import { useBuilderStore } from '../../store/useBuilderStore'

function categoryEmoji(category: SavedTemplate['siteConfig']['category']): string {
  return businessCategories.find((c) => c.id === category)?.emoji ?? '📄'
}

function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

export function TemplatePickerModal() {
  const [open, setOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([])
  const [saveError, setSaveError] = useState('')
  const [importMessage, setImportMessage] = useState('')
  const [recoveredCount, setRecoveredCount] = useState(0)
  const importInputRef = useRef<HTMLInputElement>(null)

  const siteConfig = useBuilderStore((s) => s.siteConfig)
  const siteName = useBuilderStore((s) => s.siteName)
  const activeSavedTemplateId = siteConfig?.savedTemplateSourceId ?? null
  const activeSavedTemplate = activeSavedTemplateId ? getSavedTemplate(activeSavedTemplateId) : null

  const closeSaveDialog = () => {
    setSaveOpen(false)
    setTemplateName('')
    setSaveError('')
  }

  useEffect(() => {
    if (!open) return
    const recovered = recoverTemplatesFromBackupIfNeeded()
    setRecoveredCount(recovered)
    setSavedTemplates(listSavedTemplates())
    setImportMessage('')
  }, [open])

  useEffect(() => {
    if (!saveOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSaveDialog()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveOpen])

  if (!siteConfig) return null

  const builtInTemplates = getTemplatesForSelection(siteConfig.category, siteConfig.businessType)

  const refreshSaved = () => setSavedTemplates(listSavedTemplates())

  const applyBuiltInTemplate = (templateId: string) => {
    if (!confirm('Replace your current site with this template? Unsaved changes on the canvas will be lost.')) return
    applyBuiltInTemplateToStore(templateId)
    setOpen(false)
  }

  const applySavedTemplate = (tpl: SavedTemplate) => {
    if (!confirm(`Load "${tpl.name}"? Your current site will be replaced.`)) return
    applySavedTemplateToStore(tpl)
    setOpen(false)
  }

  const persistAfterSave = (entry: SavedTemplate) => {
    const state = useBuilderStore.getState()
    if (!state.siteConfig) return
    useBuilderStore.setState({
      siteConfig: { ...state.siteConfig, savedTemplateSourceId: entry.id },
    })
  }

  const handleSave = (saveAsNew: boolean) => {
    const name = templateName.trim()
    if (!name) {
      setSaveError('Enter a template name.')
      return
    }

    const state = useBuilderStore.getState()
    if (!state.siteConfig || state.pages.length === 0) {
      setSaveError('Add at least one page before saving.')
      return
    }

    try {
      const payload = {
        name,
        siteName: state.siteName,
        siteConfig: state.siteConfig,
        pages: state.pages,
        catalog: state.catalog,
      }

      const updatingExisting =
        !saveAsNew && activeSavedTemplateId && getSavedTemplate(activeSavedTemplateId)

      if (updatingExisting) {
        const updated = updateSavedTemplate(activeSavedTemplateId, payload)
        if (!updated) {
          setSaveError('Template no longer exists. Save as a new template instead.')
          return
        }
        persistAfterSave(updated)
      } else {
        const entry = saveTemplate(payload)
        persistAfterSave(entry)
      }

      persistSite(useBuilderStore.getState(), { immediate: true })
      refreshSaved()
      closeSaveDialog()
      downloadTemplatesBackupFile()
    } catch (err) {
      if (isTemplateStorageError(err) || err instanceof StorageQuotaError) {
        setSaveError(err.message)
      } else if (err instanceof Error) {
        setSaveError(err.message || 'Could not save the template. Try again.')
      } else {
        setSaveError('Could not save the template. Try again.')
      }
    }
  }

  const handleDeleteSaved = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    if (!confirm(`Delete saved template "${name}"?`)) return
    deleteSavedTemplate(id)
    if (activeSavedTemplateId === id) {
      const state = useBuilderStore.getState()
      if (state.siteConfig) {
        useBuilderStore.setState({
          siteConfig: { ...state.siteConfig, savedTemplateSourceId: undefined },
        })
      }
    }
    refreshSaved()
  }

  const openSaveDialog = () => {
    const existing = activeSavedTemplateId ? getSavedTemplate(activeSavedTemplateId) : null
    setTemplateName(existing?.name ?? (siteName ? `${siteName} template` : 'My template'))
    setSaveError('')
    setOpen(false)
    setSaveOpen(true)
  }

  const isUpdating = !!(activeSavedTemplateId && getSavedTemplate(activeSavedTemplateId))

  const handleDownloadBackup = () => {
    if (!downloadTemplatesBackupFile()) {
      setImportMessage('No saved templates to download yet.')
      return
    }
    setImportMessage('Backup file downloaded — store it somewhere safe (Drive, USB, email).')
  }

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = parseTemplatesImportFile(JSON.parse(text))
      const count = importTemplates(parsed)
      setRecoveredCount(0)
      refreshSaved()
      setImportMessage(`Restored ${count} template${count === 1 ? '' : 's'} from backup file.`)
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : 'Could not import that file.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
      >
        <LayoutTemplate className="h-3.5 w-3.5" />
        Templates
      </button>

      <button
        type="button"
        onClick={openSaveDialog}
        className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
        title={isUpdating ? 'Update the loaded saved template' : 'Save current site as a template'}
      >
        <Save className="h-3.5 w-3.5" />
        {isUpdating ? 'Update' : 'Save'}
      </button>

      {open && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Website Templates</h2>
                <p className="text-sm text-gray-500">
                  {getCategoryLabel(siteConfig.category)} · {siteConfig.businessType}
                  {activeSavedTemplate && (
                    <span className="mt-0.5 block text-brand-600">
                      Editing: {activeSavedTemplate.name}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openSaveDialog}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isUpdating ? 'Update template' : 'Save current site'}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-gray-100">
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-8 overflow-y-auto p-6">
              <section className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3">
                <p className="text-xs font-semibold text-amber-900">Protect your saved templates</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800/90">
                  Templates are stored in this browser. We keep an automatic backup copy, and you can
                  download a <strong>.json file</strong> so templates survive clearing site data or switching
                  browsers.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    disabled={savedTemplates.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download backup
                  </button>
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-50"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Restore from file
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleImportFile(file)
                      e.target.value = ''
                    }}
                  />
                </div>
                {recoveredCount > 0 && (
                  <p className="mt-2 text-xs font-medium text-green-700">
                    Recovered {recoveredCount} template{recoveredCount === 1 ? '' : 's'} from automatic browser
                    backup.
                  </p>
                )}
                {importMessage && (
                  <p className="mt-2 text-xs text-amber-900">{importMessage}</p>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">Your saved templates</h3>
                  <span className="text-xs text-gray-400">{savedTemplates.length} saved</span>
                </div>

                {savedTemplates.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
                    <Bookmark className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm font-medium text-gray-600">No saved templates yet</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Click &quot;Save current site&quot; to store your layout and content for later.
                    </p>
                    <button
                      type="button"
                      onClick={openSaveDialog}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save template
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {savedTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => applySavedTemplate(tpl)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            applySavedTemplate(tpl)
                          }
                        }}
                        className={`group relative overflow-hidden rounded-xl border-2 text-left transition hover:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                          tpl.id === activeSavedTemplateId ? 'border-brand-600 ring-2 ring-brand-100' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex h-24 items-center justify-center bg-gradient-to-br from-brand-100 to-indigo-100">
                          <span className="text-4xl">{categoryEmoji(tpl.siteConfig.category)}</span>
                        </div>
                        <div className="p-3 pr-10">
                          <p className="font-semibold text-gray-900">{tpl.name}</p>
                          {tpl.id === activeSavedTemplateId && (
                            <span className="mt-0.5 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                              Currently editing
                            </span>
                          )}
                          <p className="mt-0.5 text-xs text-gray-500">
                            {tpl.siteName} · {tpl.pages.length} page{tpl.pages.length === 1 ? '' : 's'}
                          </p>
                          <p className="mt-1 text-[10px] text-gray-400">{formatSavedTemplateDate(tpl.savedAt)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSaved(e, tpl.id, tpl.name)}
                          className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 text-gray-400 opacity-0 shadow-sm transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                          aria-label={`Delete ${tpl.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Built-in templates</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {builtInTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyBuiltInTemplate(tpl.id)}
                      className={`overflow-hidden rounded-xl border-2 text-left transition hover:border-brand-400 ${
                        siteConfig.templateId === tpl.id ? 'border-brand-600' : 'border-gray-200'
                      }`}
                    >
                      <div className={`flex h-24 items-center justify-center bg-gradient-to-br ${tpl.preview.gradient}`}>
                        <span className="text-4xl">{tpl.preview.emoji}</span>
                      </div>
                      <div className="p-3">
                        <p className="font-semibold text-gray-900">{tpl.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{tpl.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {saveOpen && (
        <ModalPortal>
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={closeSaveDialog}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-save-title"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <h3 id="template-save-title" className="text-lg font-semibold text-gray-900">
              {isUpdating ? 'Update template' : 'Save template'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {isUpdating
                ? `Changes will replace "${activeSavedTemplate?.name ?? 'this template'}" — no new copy will be created.`
                : 'Saves all pages, blocks, catalog, and site settings from your current build.'}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              A backup copy is kept in this browser automatically. A <strong>.json file</strong> is also
              downloaded when you save — keep that file to recover templates anywhere.
            </p>
            <label className="mt-4 block text-xs font-medium text-gray-600">Template name</label>
            <input
              autoFocus
              type="text"
              value={templateName}
              onChange={(e) => {
                setTemplateName(e.target.value)
                setSaveError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave(false)
              }}
              placeholder="e.g. Summer sale layout"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            {saveError && <p className="mt-2 text-xs text-red-600">{saveError}</p>}
            <div className="relative z-10 mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeSaveDialog}
                className="relative z-10 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              {isUpdating && (
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="relative z-10 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Save as new copy
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSave(false)}
                className="relative z-10 flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Save className="h-4 w-4" />
                {isUpdating ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  )
}
