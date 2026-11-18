/** YouTube / Vimeo helpers for HR training program & course media. */

export function trainingVideoEmbed(url: string): string {
  const trimmed = url.trim()
  const yt = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = trimmed.match(/vimeo\.com\/(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return trimmed
}

/** Public poster image for a watch/embed URL (YouTube only). */
export function trainingVideoThumbnail(url?: string | null): string | null {
  if (!url?.trim()) return null
  const yt = url.trim().match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/)
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg`
  return null
}

/** Card image: explicit cover, else YouTube thumbnail from video link. */
export function programCardImage(p: {
  cover_image_url?: string | null
  video_url?: string | null
}): string | null {
  const cover = p.cover_image_url?.trim()
  if (cover && !isLikelyVideoPageUrl(cover)) return cover
  return trainingVideoThumbnail(p.video_url) ?? trainingVideoThumbnail(cover)
}

function isLikelyVideoPageUrl(url: string): boolean {
  return /youtu\.be\/|youtube\.com\/|vimeo\.com\//i.test(url)
}
