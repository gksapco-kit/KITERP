export type SiteExportMode = 'static' | 'dynamic'

export type SiteExportPayload = {
  export_version: number
  export_mode?: SiteExportMode
  exported_at: string
  site: Record<string, unknown>
}

export function siteExportFilename(siteName: string, mode: SiteExportMode): string {
  const slug = siteName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'site'
  return `${slug}-${mode}.kit-site.json`
}

export function downloadSiteExportJson(payload: SiteExportPayload, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
