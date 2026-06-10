/** Template editor sandboxes — hidden from the main websites list by default. */
export function isTemplateSandboxSite(site: {
  description?: string | null
  name?: string | null
}): boolean {
  const desc = (site.description ?? '').trim()
  const name = (site.name ?? '').trim()
  return (
    desc.startsWith('Sandbox:')
    || desc.startsWith('Sandbox for template:')
    || name.startsWith('Template edit')
  )
}
