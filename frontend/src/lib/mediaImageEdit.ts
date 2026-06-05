import { mediaUrl } from '@/lib/utils'

export type ImageEditTransform = {
  rotation: number
  flipH: boolean
  flipV: boolean
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image'))
    img.src = src
  })
}

export async function urlToImageFile(url: string, fallbackName = 'media.jpg'): Promise<File> {
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    const res = await fetch(url)
    const blob = await res.blob()
    const name = fallbackName.includes('.') ? fallbackName : `${fallbackName.replace(/\.\w+$/, '')}.${blob.type.includes('png') ? 'png' : 'jpg'}`
    return new File([blob], name, { type: blob.type || 'image/jpeg' })
  }
  const res = await fetch(mediaUrl(url))
  if (!res.ok) throw new Error('Could not fetch image')
  const blob = await res.blob()
  const ext = blob.type.includes('png') ? 'png' : 'jpg'
  return new File([blob], fallbackName.replace(/\.\w+$/, '') + `.${ext}`, { type: blob.type || 'image/jpeg' })
}

function canvasToFile(canvas: HTMLCanvasElement, fileName: string): Promise<File> {
  const mimeType = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
  const quality = mimeType === 'image/jpeg' ? 0.92 : undefined
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not export image'))
          return
        }
        resolve(new File([blob], fileName, { type: mimeType }))
      },
      mimeType,
      quality,
    )
  })
}

/** Bake rotation + flip transforms into a new image File. */
export async function renderEditedImageFile(
  source: string,
  transform: ImageEditTransform,
  fileName = 'edited.jpg',
): Promise<File> {
  const img = await loadImage(source)
  const rot = ((transform.rotation % 360) + 360) % 360
  const swap = rot === 90 || rot === 270
  const w = swap ? img.naturalHeight : img.naturalWidth
  const h = swap ? img.naturalWidth : img.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(w / 2, h / 2)
  ctx.rotate((rot * Math.PI) / 180)
  ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1)
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)

  return canvasToFile(canvas, fileName)
}

export function buildImagePreviewTransform(
  transform: ImageEditTransform,
  pan: { x: number; y: number },
  zoom: number,
): string {
  const rot = transform.rotation
  const sx = transform.flipH ? -1 : 1
  const sy = transform.flipV ? -1 : 1
  return `translate(${pan.x}px, ${pan.y}px) scale(${zoom * sx}, ${zoom * sy}) rotate(${rot}deg)`
}

export function hasImageEdits(transform: ImageEditTransform): boolean {
  return transform.rotation !== 0 || transform.flipH || transform.flipV
}
