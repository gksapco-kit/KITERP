/** Resolve YouTube / Vimeo watch URLs to embed iframe src. */
export function getVideoEmbedUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  try {
    const u = new URL(trimmed)
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const id = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop()
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop()
      return id ? `https://player.vimeo.com/video/${id}` : null
    }
    return trimmed
  } catch {
    return null
  }
}

/** YouTube thumbnail for builder canvas selection; Vimeo has no stable public thumb URL. */
export function getVideoThumbnailUrl(url: string): string | null {
  const embed = getVideoEmbedUrl(url)
  if (!embed?.includes('youtube.com/embed/')) return null
  const id = embed.replace(/^https:\/\/www\.youtube\.com\/embed\//, '').split('?')[0]
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
}
