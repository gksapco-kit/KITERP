/** Normalize YouTube watch/share links to embed URLs for iframes */
export function toEmbedVideoUrl(url?: string): string {
  const trimmed = url?.trim() ?? ''
  if (!trimmed) return ''
  if (trimmed.includes('/embed/')) return trimmed
  const watch = trimmed.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/)([\w-]{11})/)
  if (watch) return `https://www.youtube.com/embed/${watch[1]}`
  const short = trimmed.match(/youtu\.be\/([\w-]{11})/)
  if (short) return `https://www.youtube.com/embed/${short[1]}`
  return trimmed
}
