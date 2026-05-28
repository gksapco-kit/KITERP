export function viewportBreakpointLabel(width: number): string {
  if (width < 640) return 'Mobile'
  if (width < 768) return 'Large phone'
  if (width < 1024) return 'Tablet'
  if (width < 1280) return 'Laptop'
  if (width < 1536) return 'Desktop'
  return 'Wide desktop'
}
