/** Navigate the vendor dashboard (parent frame) to a website route. */
export function navigateVendorWebsite(path: string): void {
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (typeof window !== 'undefined' && window.parent !== window) {
    window.parent.location.assign(normalized)
    return
  }
  window.location.assign(normalized)
}

export function openWebsiteBuilder(applyTemplateId?: string): void {
  if (applyTemplateId?.trim()) {
    navigateVendorWebsite(`/website/builder?applyTemplate=${encodeURIComponent(applyTemplateId.trim())}`)
    return
  }
  navigateVendorWebsite('/website/builder?newTemplate=1')
}

export function openWebsiteBuilderWithBuiltIn(builtInTemplateId: string): void {
  navigateVendorWebsite(
    `/website/builder?builtInTemplate=${encodeURIComponent(builtInTemplateId.trim())}`,
  )
}
