import { v4 as uuid } from 'uuid'
import { StorageQuotaError, storageGet, storageSet } from './largeStorage'
import { getHomePage, stripSiteChrome } from './siteChrome'
import type { CatalogProduct, CatalogService, Page, SiteConfig } from '../types/builder'

export type TemplateStorageErrorCode = 'quota' | 'serialize' | 'unknown'

export type TemplateStorageError = Error & { code: TemplateStorageErrorCode }

function templateStorageError(message: string, code: TemplateStorageErrorCode): TemplateStorageError {
  const err = new Error(message) as TemplateStorageError
  err.name = 'TemplateStorageError'
  err.code = code
  return err
}

export function isTemplateStorageError(err: unknown): err is TemplateStorageError {
  return err instanceof Error && err.name === 'TemplateStorageError'
}

function cloneJson<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    throw templateStorageError(
      'Site data could not be encoded. Remove unusually large custom HTML or images and try again.',
      'serialize',
    )
  }
}

/** Non-home pages omit shared navbar/footer (re-applied on load via site chrome sync). */
function preparePagesForStorage(pages: Page[]): Page[] {
  const home = getHomePage(pages)
  return pages.map((page) => {
    const copy = cloneJson(page)
    if (home && copy.id !== home.id) {
      copy.blocks = stripSiteChrome(copy.blocks)
    }
    return copy
  })
}

const STORAGE_KEY = 'website-builder-saved-templates'
const BACKUP_STORAGE_KEY = 'website-builder-saved-templates-backup'

export interface TemplatesExportBundle {
  version: 1
  exportedAt: string
  templates: SavedTemplate[]
}

export interface SavedTemplate {
  id: string
  name: string
  siteName: string
  siteConfig: SiteConfig
  pages: Page[]
  catalog: { products: CatalogProduct[]; services: CatalogService[] }
  savedAt: string
}

function parseTemplatesJson(raw: string): SavedTemplate[] | null {
  try {
    const parsed = JSON.parse(raw) as SavedTemplate[] | TemplatesExportBundle
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as TemplatesExportBundle).templates)) {
      return (parsed as TemplatesExportBundle).templates
    }
    return null
  } catch {
    return null
  }
}

function readRawFromKey(key: string): SavedTemplate[] | null {
  const raw = storageGet(key)
  if (!raw) return null
  const parsed = parseTemplatesJson(raw)
  return parsed && parsed.length > 0 ? parsed : null
}

function readAll(): SavedTemplate[] {
  const primary = readRawFromKey(STORAGE_KEY)
  if (primary) return primary

  const backup = readRawFromKey(BACKUP_STORAGE_KEY)
  if (backup) {
    try {
      storageSet(STORAGE_KEY, JSON.stringify(backup))
    } catch {
      /* primary restore failed; still return backup for this session */
    }
    return backup
  }

  return []
}

/** If the main templates key was cleared, restore from the automatic backup copy. */
export function recoverTemplatesFromBackupIfNeeded(): number {
  if (readRawFromKey(STORAGE_KEY)) return 0
  const backup = readRawFromKey(BACKUP_STORAGE_KEY)
  if (!backup) return 0
  try {
    storageSet(STORAGE_KEY, JSON.stringify(backup))
    return backup.length
  } catch {
    return 0
  }
}

function writeAll(templates: SavedTemplate[]) {
  let raw: string
  try {
    raw = JSON.stringify(templates)
  } catch {
    throw templateStorageError(
      'Site data could not be encoded. Remove unusually large custom HTML or images and try again.',
      'serialize',
    )
  }

  try {
    storageSet(STORAGE_KEY, raw)
    try {
      storageSet(BACKUP_STORAGE_KEY, raw)
    } catch {
      /* backup is best-effort; primary save still succeeded */
    }
  } catch (err) {
    if (err instanceof StorageQuotaError || (err instanceof DOMException && err.name === 'QuotaExceededError')) {
      throw templateStorageError(
        'Browser storage is full. Delete an old saved template from Templates, or export your site, then try again.',
        'quota',
      )
    }
    throw templateStorageError(
      err instanceof Error ? err.message : 'Could not write to browser storage.',
      'unknown',
    )
  }
}

export function listSavedTemplates(): SavedTemplate[] {
  return readAll().sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
}

export function getSavedTemplate(id: string): SavedTemplate | null {
  return readAll().find((t) => t.id === id) ?? null
}

export function saveTemplate(input: {
  name: string
  siteName: string
  siteConfig: SiteConfig
  pages: Page[]
  catalog: { products: CatalogProduct[]; services: CatalogService[] }
}): SavedTemplate {
  const entry: SavedTemplate = {
    id: uuid(),
    name: input.name.trim(),
    siteName: input.siteName,
    siteConfig: {
      ...cloneJson(input.siteConfig),
      savedTemplateSourceId: undefined,
    },
    pages: preparePagesForStorage(input.pages),
    catalog: cloneJson(input.catalog),
    savedAt: new Date().toISOString(),
  }
  entry.siteConfig.savedTemplateSourceId = entry.id

  const templates = readAll()
  templates.unshift(entry)
  writeAll(templates)
  return entry
}

export function updateSavedTemplate(
  id: string,
  input: {
    name: string
    siteName: string
    siteConfig: SiteConfig
    pages: Page[]
    catalog: { products: CatalogProduct[]; services: CatalogService[] }
  },
): SavedTemplate | null {
  const templates = readAll()
  const index = templates.findIndex((t) => t.id === id)
  if (index === -1) return null

  const updated: SavedTemplate = {
    id,
    name: input.name.trim(),
    siteName: input.siteName,
    siteConfig: {
      ...cloneJson(input.siteConfig),
      savedTemplateSourceId: id,
    },
    pages: preparePagesForStorage(input.pages),
    catalog: cloneJson(input.catalog),
    savedAt: new Date().toISOString(),
  }

  templates[index] = updated
  writeAll(templates)
  return updated
}

export function deleteSavedTemplate(id: string): boolean {
  const templates = readAll()
  const next = templates.filter((t) => t.id !== id)
  if (next.length === templates.length) return false
  writeAll(next)
  return true
}

export function formatSavedTemplateDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function buildTemplatesExportBundle(templates: SavedTemplate[]): TemplatesExportBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    templates: cloneJson(templates),
  }
}

export function downloadTemplatesBackupFile(templates?: SavedTemplate[]): boolean {
  const list = templates ?? listSavedTemplates()
  if (list.length === 0) return false

  const bundle = buildTemplatesExportBundle(list)
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `website-builder-templates-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
  return true
}

export function parseTemplatesImportFile(json: unknown): SavedTemplate[] {
  if (Array.isArray(json)) {
    return json.filter((t) => t && typeof t === 'object' && 'name' in t && 'pages' in t) as SavedTemplate[]
  }
  if (json && typeof json === 'object' && 'templates' in json) {
    const templates = (json as TemplatesExportBundle).templates
    if (Array.isArray(templates)) {
      return templates.filter((t) => t && typeof t === 'object' && 'name' in t && 'pages' in t) as SavedTemplate[]
    }
  }
  throw new Error('Invalid backup file. Use a file exported from Website Builder → Templates → Download backup.')
}

/** Merge imported templates by id; adds new entries and updates matches. */
export function importTemplates(templates: SavedTemplate[]): number {
  if (templates.length === 0) return 0

  const existing = readAll()
  const byId = new Map(existing.map((t) => [t.id, t]))

  for (const tpl of templates) {
    const copy = cloneJson(tpl)
    if (!copy.id) copy.id = uuid()
    copy.name = copy.name?.trim() || 'Imported template'
    copy.savedAt = copy.savedAt || new Date().toISOString()
    byId.set(copy.id, copy)
  }

  const merged = [...byId.values()].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  )
  writeAll(merged)
  return templates.length
}
