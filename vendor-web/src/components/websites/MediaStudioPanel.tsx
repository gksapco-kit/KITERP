import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Check,
  Copy,
  Image as ImageIcon,
  Loader2,
  PlayCircle,
  RefreshCcw,
  Upload,
  Wand2,
} from 'lucide-react'
import { cn, mediaUrl } from '@/lib/utils'
import { websiteApi } from '@/api/websites'
import { useMedia, useUploadMedia } from '@/hooks/useWebsites'
import type { WebsiteBlock, WebsiteMedia } from '@/types/websites'

/** In-flight upload row before the API returns a full `WebsiteMedia`. */
type MediaStudioRow =
  | WebsiteMedia
  | {
      id: string
      filename: string
      original_url: string
      file_type: 'image' | 'video'
      adjustments: Record<string, unknown>
      ai_tags: string[]
    }

export interface MediaStudioPanelProps {
  siteId: string
  /** When set, primary apply button references this block's label. */
  selectedBlock?: WebsiteBlock | null
  applyToImageLayer?: boolean
  onApplyUrl: (url: string) => void
  /**
   * When there is no selected block (e.g. business front builder), show this
   * instead of the generic 'Apply to Block" hint.
   */
  applyTargetDescription?: string | null
}

/**
 * Uploads, media library, and AI image adjustments — shared by the full
 * website Builder and the Business Front Builder.
 */
export function MediaStudioPanel({
  siteId,
  selectedBlock,
  applyToImageLayer = false,
  onApplyUrl,
  applyTargetDescription,
}: MediaStudioPanelProps) {
  const { data: mediaListRaw = [], isLoading, refetch } = useMedia(siteId)
  const uploadMedia = useUploadMedia(siteId)
  const [localMedia, setLocalMedia] = useState<MediaStudioRow[]>([])
  const mediaList: MediaStudioRow[] = localMedia.length > 0 ? localMedia : mediaListRaw

  const [selectedMedia, setSelectedMedia] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [adjustments, setAdjustments] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    sharpness: 0,
    remove_background: false,
    color_grade: null as string | null,
    ai_enhance: false,
    grayscale: false,
    blur: 0,
    overlay: null as string | null,
  })
  const [adjustedUrl, setAdjustedUrl] = useState<string | null>(null)
  const [isAdjusting, setIsAdjusting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mediaListRaw.length > 0) setLocalMedia(mediaListRaw)
  }, [mediaListRaw])

  const selectedMediaObj = mediaList.find(m => m.id === selectedMedia)
  const resolveUrl = (url: string) => (url?.startsWith('blob:') ? url : mediaUrl(url))
  const isAdjustableImage = selectedMediaObj && selectedMediaObj.file_type !== 'video'

  const doUpload = async (file: File) => {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error('Only images and videos are allowed')
      return
    }
    const localPreviewUrl = URL.createObjectURL(file)
    const tempItem = {
      id: `temp-${Date.now()}`,
      filename: file.name,
      original_url: localPreviewUrl,
      file_type: file.type.startsWith('image/') ? ('image' as const) : ('video' as const),
      adjustments: {},
      ai_tags: [] as string[],
    }
    setLocalMedia(prev => [tempItem, ...prev])
    try {
      const saved = await uploadMedia.mutateAsync(file)
      setLocalMedia(prev => prev.map(m => (m.id === tempItem.id ? saved : m)))
      setSelectedMedia(saved.id)
      toast.success(`"${file.name}" uploaded!`)
      refetch()
    } catch {
      setLocalMedia(prev => prev.filter(m => m.id !== tempItem.id))
      toast.error('Upload failed — check file size and format')
    }
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    for (const f of files) await doUpload(f)
    e.target.value = ''
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    for (const f of files) await doUpload(f)
  }

  const handleAdjust = async () => {
    if (!selectedMediaObj || selectedMediaObj.file_type === 'video') return
    setIsAdjusting(true)
    try {
      const r = await websiteApi.aiMediaAdjust(siteId, selectedMediaObj.original_url, adjustments as any)
      setAdjustedUrl(mediaUrl(r.adjusted_url))
      toast.success('Adjustments applied!')
    } catch {
      toast.error('Adjustment failed')
    }
    setIsAdjusting(false)
  }

  const Slider = ({
    label,
    field,
    min = 0,
    max = 200,
    step = 1,
  }: {
    label: string
    field: string
    min?: number
    max?: number
    step?: number
  }) => (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        <span className="text-xs text-gray-400 font-mono w-8 text-right">{(adjustments as any)[field]}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={(adjustments as any)[field]}
        onChange={e => setAdjustments(a => ({ ...a, [field]: Number(e.target.value) }))}
        className="w-full accent-primary h-1.5"
      />
    </div>
  )

  const applyPrimaryLabel = applyToImageLayer
    ? 'Apply to Image Layer'
    : selectedBlock
      ? `Apply to "${selectedBlock.label || selectedBlock.block_type}"`
      : applyTargetDescription
        ? `Apply to ${applyTargetDescription}`
        : 'Apply to business front'

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="p-3 border-b border-gray-100 shrink-0">
        {applyToImageLayer && (
          <div className="mb-2 px-2 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-800">
            Selected: image layer — uploads and library items apply to that layer.
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileInput} />
        <div
          ref={dropZoneRef}
          onDragOver={e => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'w-full py-5 border-2 border-dashed rounded-xl text-xs cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5',
            isDragging
              ? 'border-primary bg-accent text-primary'
              : 'border-primary/30 text-primary hover:bg-accent hover:border-primary/60',
          )}
        >
          {uploadMedia.isPending ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6" />
              <span className="font-semibold">{isDragging ? 'Drop files here' : 'Click or drag & drop to upload'}</span>
              <span className="text-xs text-gray-400">JPG, PNG, WebP, GIF, MP4 • Multiple files ok</span>
            </>
          )}
        </div>
      </div>

      <div className="p-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Media Library ({mediaList.length})</span>
          <button type="button" onClick={() => refetch()} className="text-xs text-primary/80 hover:text-primary flex items-center gap-0.5">
            <RefreshCcw className="w-3 h-3" /> Refresh
          </button>
        </div>
        {isLoading && mediaList.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary/70" />
          </div>
        ) : mediaList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-2">
            <ImageIcon className="w-10 h-10 opacity-20" />
            <p className="text-xs font-medium">No media yet</p>
            <p className="text-xs">Upload images or generate with AI</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 max-h-64 overflow-y-auto">
            {mediaList.map(m => {
              const src = resolveUrl(m.original_url)
              const isSelected = selectedMedia === m.id
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    setSelectedMedia(m.id)
                    setAdjustedUrl(null)
                  }}
                  className={cn(
                    'group relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all',
                    isSelected ? 'border-primary ring-2 ring-primary/25 scale-105' : 'border-transparent hover:border-primary/40',
                  )}
                >
                  {m.file_type === 'video' ? (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <PlayCircle className="w-6 h-6 text-white opacity-80" />
                    </div>
                  ) : (
                    <img
                      src={src}
                      className="w-full h-full object-cover"
                      alt={m.filename}
                      onError={e => {
                        const el = e.target as HTMLImageElement
                        el.style.display = 'none'
                        const ph = el.nextElementSibling as HTMLElement | null
                        if (ph) ph.classList.remove('hidden')
                      }}
                    />
                  )}
                  <div className="hidden absolute inset-0 flex items-center justify-center bg-gray-100">
                    <ImageIcon className="w-5 h-5 text-gray-300" />
                  </div>
                  {m.ai_tags?.includes('ai-generated') && (
                    <div className="absolute top-1 left-1 bg-primary text-white text-[8px] font-bold px-1 py-0.5 rounded">AI</div>
                  )}
                  <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1.5">
                    <button
                      type="button"
                      onClick={ev => {
                        ev.stopPropagation()
                        onApplyUrl(m.original_url)
                      }}
                      className="w-full py-1.5 bg-primary rounded-lg text-xs font-bold text-white hover:bg-primary/90"
                    >
                      {applyToImageLayer ? 'Use in Layer' : 'Use in Block'}
                    </button>
                    <button
                      type="button"
                      onClick={ev => {
                        ev.stopPropagation()
                        void navigator.clipboard.writeText(src)
                        toast.success('URL copied!')
                      }}
                      className="w-full py-1.5 bg-white/90 rounded-lg text-xs font-bold text-gray-700"
                    >
                      Copy URL
                    </button>
                  </div>
                  {isSelected && (
                    <div className="absolute bottom-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedMediaObj && (
        <div className="flex-1 p-3 border-t border-gray-100 space-y-3">
          <div className="flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-gray-700">Image Adjuster & Designer</span>
            <span className="ml-auto text-xs text-gray-400 truncate max-w-[100px]">{selectedMediaObj.filename}</span>
          </div>

          {selectedMediaObj.file_type === 'video' ? (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-2 border border-gray-100">
              Video is ready to insert; AI adjustments apply to images only. Use &quot;Apply&quot; below with the original file, or pick an image from the library.
            </p>
          ) : null}

          <div className="relative rounded-xl overflow-hidden bg-gray-100 aspect-video border border-gray-200">
            <img
              src={adjustedUrl || resolveUrl(selectedMediaObj.original_url)}
              className="w-full h-full object-cover"
              alt=""
              onError={e => {
                ;(e.target as HTMLImageElement).style.opacity = '0.3'
              }}
            />
            {adjustedUrl && (
              <div className="absolute top-2 left-2 bg-emerald-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">✓ Adjusted</div>
            )}
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onApplyUrl(adjustedUrl || selectedMediaObj.original_url)}
              className="flex-1 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              {applyPrimaryLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(adjustedUrl || resolveUrl(selectedMediaObj.original_url))
                toast.success('URL copied!')
              }}
              className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
              title="Copy URL"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          {!selectedBlock && !applyTargetDescription && (
            <p className="text-xs text-center text-amber-600">← Select a block on the canvas first</p>
          )}
          {applyTargetDescription && !selectedBlock && (
            <p className="text-xs text-center text-emerald-700 bg-emerald-50 rounded-lg py-1.5">
              Applies to: {applyTargetDescription}
            </p>
          )}

          {isAdjustableImage ? (
            <>
              <div className="space-y-1 pt-1">
                <Slider label="Brightness" field="brightness" min={0} max={200} />
                <Slider label="Contrast" field="contrast" min={0} max={200} />
                <Slider label="Saturation" field="saturation" min={0} max={200} />
                <Slider label="Sharpness" field="sharpness" min={0} max={100} />
                <Slider label="Blur" field="blur" min={0} max={20} />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { key: 'remove_background', label: 'Remove BG' },
                  { key: 'ai_enhance', label: 'AI Enhance' },
                  { key: 'grayscale', label: 'Grayscale' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer bg-gray-50 rounded-lg px-2 py-1.5">
                    <input
                      type="checkbox"
                      checked={(adjustments as any)[key]}
                      onChange={e => setAdjustments(a => ({ ...a, [key]: e.target.checked }))}
                      className="rounded accent-primary"
                    />
                    <span className="text-xs text-gray-600 font-medium">{label}</span>
                  </label>
                ))}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Color Grade</label>
                <div className="grid grid-cols-4 gap-1">
                  {[null, 'cinematic', 'vivid', 'matte', 'vintage', 'cool', 'warm', 'faded'].map(grade => (
                    <button
                      type="button"
                      key={grade || 'none'}
                      onClick={() => setAdjustments(a => ({ ...a, color_grade: grade }))}
                      className={cn(
                        'py-1.5 rounded-lg text-xs font-bold border transition-colors',
                        adjustments.color_grade === grade
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40',
                      )}
                    >
                      {grade ? grade.charAt(0).toUpperCase() + grade.slice(1) : 'None'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Overlay</label>
                <div className="grid grid-cols-3 gap-1">
                  {[null, 'dark', 'light', 'gradient_down', 'gradient_up', 'vignette'].map(ov => (
                    <button
                      type="button"
                      key={ov || 'none'}
                      onClick={() => setAdjustments(a => ({ ...a, overlay: ov } as any))}
                      className={cn(
                        'py-1.5 rounded-lg text-xs font-bold border transition-colors',
                        (adjustments as any).overlay === ov
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40',
                      )}
                    >
                      {ov ? ov.replace('_', ' ').charAt(0).toUpperCase() + ov.replace('_', ' ').slice(1) : 'None'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustments({
                      brightness: 100,
                      contrast: 100,
                      saturation: 100,
                      sharpness: 0,
                      remove_background: false,
                      color_grade: null,
                      ai_enhance: false,
                      grayscale: false,
                      blur: 0,
                      overlay: null,
                    })
                    setAdjustedUrl(null)
                  }}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleAdjust}
                  disabled={isAdjusting}
                  className="flex-1 py-2 bg-gradient-to-r from-primary to-info text-white text-xs font-bold rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isAdjusting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  Apply AI
                </button>
              </div>

              {adjustedUrl && (
                <button
                  type="button"
                  onClick={() => onApplyUrl(adjustedUrl)}
                  className="w-full py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" /> {applyToImageLayer ? 'Use Adjusted on Layer' : 'Use This Adjusted Version'}
                </button>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
