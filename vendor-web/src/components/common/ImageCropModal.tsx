import { useState, useRef, useCallback, useEffect } from 'react'
import { useEscapeToClose } from '@/hooks/useEscapeToClose'
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
} from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Lock, Unlock, RotateCcw, Check, ZoomIn, ZoomOut } from 'lucide-react'

interface ImageCropModalProps {
  file: File
  aspectRatio?: number        // e.g. 1 for square, 3 for banner. Undefined = free
  maxOutputWidth?: number     // cap the exported image width
  outputType?: 'jpeg' | 'png' | 'auto'
  /** When set, compress the export until it is at or under this size. Omit to keep full quality. */
  maxBytes?: number
  onConfirm: (croppedFile: File) => void | Promise<void>
  onCancel: () => void
  title?: string
}

function canvasToFile(
  canvas: HTMLCanvasElement,
  originalFile: File,
  outputType: ImageCropModalProps['outputType'] = 'auto',
  maxBytes?: number,
): Promise<File> {
  const forceJpeg = outputType === 'jpeg'
  const mimeType = forceJpeg ? 'image/jpeg' : (originalFile.type === 'image/png' ? 'image/png' : 'image/jpeg')
  const ext = mimeType === 'image/png' ? 'png' : 'jpg'
  const base = originalFile.name.replace(/\.[^.]+$/, '') || 'image'

  const tryBlob = (quality: number) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Canvas empty'))),
        mimeType,
        mimeType === 'image/jpeg' ? quality : undefined,
      )
    })

  return (async () => {
    let quality = 0.92
    let blob = await tryBlob(quality)
    if (maxBytes && mimeType === 'image/jpeg') {
      while (blob.size > maxBytes && quality > 0.5) {
        quality -= 0.12
        blob = await tryBlob(quality)
      }
    }
    return new File([blob], `${base}-cropped.${ext}`, { type: mimeType })
  })()
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  )
}

async function getCroppedImg(
  image: HTMLImageElement,
  pixelCrop: PixelCrop,
  originalFile: File,
  options: { maxOutputWidth?: number; outputType?: ImageCropModalProps['outputType']; maxBytes?: number } = {},
): Promise<File> {
  const canvas = document.createElement('canvas')
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  let outputWidth = Math.round(pixelCrop.width * scaleX)
  let outputHeight = Math.round(pixelCrop.height * scaleY)
  const cap = options.maxOutputWidth
  if (cap && outputWidth > cap) {
    const ratio = cap / outputWidth
    outputWidth = cap
    outputHeight = Math.max(1, Math.round(outputHeight * ratio))
  }

  canvas.width = outputWidth
  canvas.height = outputHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Cannot get canvas context')

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    outputWidth,
    outputHeight,
  )

  return canvasToFile(canvas, originalFile, options.outputType, options.maxBytes)
}

export function ImageCropModal({
  file,
  aspectRatio,
  maxOutputWidth,
  outputType = 'auto',
  maxBytes,
  onConfirm,
  onCancel,
  title = 'Crop & Resize Image',
}: ImageCropModalProps) {
  useEscapeToClose(onCancel)

  const imgRef = useRef<HTMLImageElement>(null)
  const [imgSrc, setImgSrc] = useState('')
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [lockAspect, setLockAspect] = useState(aspectRatio !== undefined)
  const [currentAspect, setCurrentAspect] = useState<number | undefined>(aspectRatio)
  const [outputW, setOutputW] = useState('')
  const [outputH, setOutputH] = useState('')
  const [processing, setProcessing] = useState(false)
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => setImgSrc(reader.result as string)
    reader.readAsDataURL(file)
  }, [file])

  const applyCropSelection = useCallback((nextCrop: Crop, displayWidth: number, displayHeight: number) => {
    setCrop(nextCrop)
    setCompletedCrop(convertToPixelCrop(nextCrop, displayWidth, displayHeight))
  }, [])

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: nw, naturalHeight: nh, width, height } = e.currentTarget
    setNaturalSize({ w: nw, h: nh })
    setOutputW(String(nw))
    setOutputH(String(nh))
    const aspect = currentAspect
    const initialCrop = aspect
      ? centerAspectCrop(width, height, aspect)
      : centerCrop({ unit: '%', width: 90, height: 90 }, width, height)
    applyCropSelection(initialCrop, width, height)
  }, [applyCropSelection, currentAspect])

  // Keep output W/H in sync with the completed crop region
  useEffect(() => {
    if (!completedCrop || !imgRef.current) return
    const img = imgRef.current
    const scaleX = img.naturalWidth / img.width
    const scaleY = img.naturalHeight / img.height
    const cw = Math.round(completedCrop.width * scaleX)
    const ch = Math.round(completedCrop.height * scaleY)
    setOutputW(String(cw))
    setOutputH(String(ch))
  }, [completedCrop])

  const handleWidthChange = (val: string) => {
    setOutputW(val)
    const w = parseInt(val)
    if (isNaN(w) || w <= 0) return
    if (lockAspect && completedCrop && imgRef.current) {
      const img = imgRef.current
      const scaleX = img.naturalWidth / img.width
      const scaleY = img.naturalHeight / img.height
      const cropAspect = (completedCrop.width * scaleX) / (completedCrop.height * scaleY)
      setOutputH(String(Math.round(w / cropAspect)))
    }
  }

  const handleHeightChange = (val: string) => {
    setOutputH(val)
    const h = parseInt(val)
    if (isNaN(h) || h <= 0) return
    if (lockAspect && completedCrop && imgRef.current) {
      const img = imgRef.current
      const scaleX = img.naturalWidth / img.width
      const scaleY = img.naturalHeight / img.height
      const cropAspect = (completedCrop.width * scaleX) / (completedCrop.height * scaleY)
      setOutputW(String(Math.round(h * cropAspect)))
    }
  }

  const toggleLock = () => {
    setLockAspect((prev) => !prev)
    if (!lockAspect && completedCrop && imgRef.current) {
      const img = imgRef.current
      const scaleX = img.naturalWidth / img.width
      const scaleY = img.naturalHeight / img.height
      const cropAspect = (completedCrop.width * scaleX) / (completedCrop.height * scaleY)
      setCurrentAspect(cropAspect)
    } else {
      setCurrentAspect(undefined)
    }
  }

  const resetCrop = () => {
    if (!imgRef.current) return
    const { width, height } = imgRef.current
    const nextCrop = currentAspect
      ? centerAspectCrop(width, height, currentAspect)
      : centerCrop({ unit: '%', width: 90, height: 90 }, width, height)
    applyCropSelection(nextCrop, width, height)
  }

  const handleConfirm = async () => {
    if (!imgRef.current || !completedCrop) return
    setProcessing(true)
    try {
      let croppedFile = await getCroppedImg(imgRef.current, completedCrop, file, {
        maxOutputWidth,
        outputType,
        maxBytes,
      })

      const targetW = parseInt(outputW)
      const targetH = parseInt(outputH)
      const cropNatW = Math.round(completedCrop.width * (imgRef.current.naturalWidth / imgRef.current.width))
      const cropNatH = Math.round(completedCrop.height * (imgRef.current.naturalHeight / imgRef.current.height))

      if (!isNaN(targetW) && !isNaN(targetH) && (targetW !== cropNatW || targetH !== cropNatH)) {
        croppedFile = await resizeFile(croppedFile, targetW, targetH, file, { outputType, maxBytes, maxOutputWidth })
      }

      await onConfirm(croppedFile)
    } catch (err) {
      console.error('Crop error:', err)
    } finally {
      setProcessing(false)
    }
  }

  const useOriginal = async () => {
    await onConfirm(file)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-card border border-border text-foreground rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button type="button" aria-label="Close" onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Crop area */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50 flex items-center justify-center min-h-0">
          {imgSrc ? (
            <ReactCrop
              crop={crop}
              onChange={(_, pct) => setCrop(pct)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={lockAspect ? currentAspect : undefined}
              ruleOfThirds
              className="max-w-full max-h-full"
            >
              <img
                ref={imgRef}
                src={imgSrc}
                alt="Crop preview"
                onLoad={onImageLoad}
                style={{ maxHeight: '45vh', maxWidth: '100%', objectFit: 'contain' }}
              />
            </ReactCrop>
          ) : (
            <div className="w-64 h-48 bg-gray-200 rounded-lg animate-pulse" />
          )}
        </div>

        {/* Controls */}
        <div className="px-5 py-4 border-t space-y-4 shrink-0">
          {/* Natural size info */}
          {naturalSize.w > 0 && (
            <p className="text-xs text-gray-400">
              Original: {naturalSize.w} × {naturalSize.h} px
            </p>
          )}

          {/* Output size controls */}
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Width (px)</Label>
              <Input
                type="number"
                min={1}
                value={outputW}
                onChange={(e) => handleWidthChange(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={toggleLock}
              title={lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
              className={`mb-0.5 p-2 rounded-lg border-2 transition-colors ${
                lockAspect
                  ? 'border-blue-500 bg-blue-50 text-blue-600'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
            >
              {lockAspect ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>

            <div className="flex-1 space-y-1">
              <Label className="text-xs">Height (px)</Label>
              <Input
                type="number"
                min={1}
                value={outputH}
                onChange={(e) => handleHeightChange(e.target.value)}
                className="h-8 text-sm"
                disabled={lockAspect}
              />
            </div>

            <button
              type="button"
              onClick={resetCrop}
              title="Reset crop"
              className="mb-0.5 p-2 rounded-lg border-2 border-gray-200 text-gray-400 hover:border-gray-300 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {lockAspect && (
            <p className="text-xs text-blue-500 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Aspect ratio is locked — width &amp; height scale together
            </p>
          )}

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-400 self-center">Presets:</span>
            {[
              { label: '1:1', aspect: 1 },
              { label: '4:3', aspect: 4 / 3 },
              { label: '16:9', aspect: 16 / 9 },
              { label: '3:1 Banner', aspect: 3 },
              { label: 'Free', aspect: undefined },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setCurrentAspect(p.aspect)
                  setLockAspect(p.aspect !== undefined)
                  if (imgRef.current) {
                    const { width, height } = imgRef.current
                    const nextCrop = p.aspect
                      ? centerAspectCrop(width, height, p.aspect)
                      : centerCrop({ unit: '%', width: 90, height: 90 }, width, height)
                    applyCropSelection(nextCrop, width, height)
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                  currentAspect === p.aspect && (p.aspect !== undefined || !lockAspect)
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={useOriginal} className="text-gray-500">
              Use original
            </Button>
            <div className="flex-1" />
            <Button type="button" variant="cancel" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={!completedCrop || processing}
              className="gap-2"
            >
              {processing ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Apply &amp; Upload
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

async function resizeFile(
  file: File,
  targetW: number,
  targetH: number,
  originalFile: File,
  options: { outputType?: ImageCropModalProps['outputType']; maxBytes?: number; maxOutputWidth?: number } = {},
): Promise<File> {
  let width = targetW
  let height = targetH
  const cap = options.maxOutputWidth
  if (cap && width > cap) {
    const ratio = cap / width
    width = cap
    height = Math.max(1, Math.round(height * ratio))
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas ctx')); return }
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvasToFile(canvas, originalFile, options.outputType, options.maxBytes).then(resolve, reject)
    }
    img.onerror = reject
    img.src = url
  })
}
