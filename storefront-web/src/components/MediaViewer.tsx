import { useState, useRef, useEffect } from 'react'
import { imgUrl } from '@/lib/utils'
import { ensureModelViewerScript } from '@/lib/modelViewerLoader'
import { Play, Pause, Volume2, VolumeX, Maximize, Box, Camera, RotateCcw, X } from 'lucide-react'

type MediaType = 'image' | 'video' | 'model3d'

interface MediaItem {
  id: string
  url: string
  alt_text?: string
  is_primary: boolean
  media_type?: MediaType
}

interface MediaViewerProps {
  items: MediaItem[]
  selectedIndex: number
  onSelect: (i: number) => void
  productName: string
  badges?: React.ReactNode
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string
        alt?: string
        ar?: boolean
        'ar-modes'?: string
        'camera-controls'?: boolean
        'touch-action'?: string
        'auto-rotate'?: boolean
        poster?: string
        loading?: string
        'shadow-intensity'?: string
        'environment-image'?: string
      }, HTMLElement>
    }
  }
}

function VideoPlayer({ url, alt }: { url: string; alt?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)

  const toggle = () => {
    if (!videoRef.current) return
    if (playing) { videoRef.current.pause() } else { videoRef.current.play() }
    setPlaying(!playing)
  }

  return (
    <div className="relative w-full h-full group">
      <video
        ref={videoRef}
        src={imgUrl(url)}
        className="w-full h-full object-contain p-4"
        muted={muted}
        loop
        playsInline
        onClick={toggle}
      />
      <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={toggle} className="bg-black/60 backdrop-blur-sm text-white rounded-full p-2 hover:bg-black/80 transition-colors">
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <button onClick={() => setMuted(!muted)} className="bg-black/60 backdrop-blur-sm text-white rounded-full p-2 hover:bg-black/80 transition-colors">
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button onClick={() => videoRef.current?.requestFullscreen()} className="bg-black/60 backdrop-blur-sm text-white rounded-full p-2 hover:bg-black/80 transition-colors ml-auto">
          <Maximize className="w-4 h-4" />
        </button>
      </div>
      <span className="absolute top-3 right-3 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
        <Play className="w-3 h-3" />Video
      </span>
    </div>
  )
}

function Model3DViewer({ url, alt, poster }: { url: string; alt?: string; poster?: string }) {
  const [arActive, setArActive] = useState(false)
  const [mvReady, setMvReady] = useState(false)
  const [mvError, setMvError] = useState(false)

  useEffect(() => {
    let cancelled = false
    ensureModelViewerScript()
      .then(() => {
        if (!cancelled) setMvReady(true)
      })
      .catch(() => {
        if (!cancelled) setMvError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (mvError) {
    return (
      <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center gap-2 bg-gray-50 text-center p-6 text-sm text-gray-600">
        <Box className="w-10 h-10 text-gray-400" />
        <p>3D preview could not be loaded (network may block the viewer script).</p>
        <a href={imgUrl(url)} download className="text-blue-600 underline font-medium">Download model</a>
      </div>
    )
  }

  if (!mvReady) {
    return (
      <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-gray-50 text-sm text-gray-500">
        Loading 3D viewer…
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <model-viewer
        src={imgUrl(url)}
        alt={alt || '3D Model'}
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        touch-action="pan-y"
        auto-rotate
        poster={poster ? imgUrl(poster) : undefined}
        shadow-intensity="1"
        environment-image="neutral"
        style={{ width: '100%', height: '100%', minHeight: '300px' }}
      >
        <button
          slot="ar-button"
          onClick={() => setArActive(true)}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center gap-2"
        >
          <Camera className="w-4 h-4" />
          Try On with Camera
        </button>
      </model-viewer>
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className="bg-cyan-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <Box className="w-3 h-3" />3D &amp; AR
        </span>
      </div>
      <div className="absolute top-3 left-3">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 text-[10px] text-gray-500 flex items-center gap-1">
          <RotateCcw className="w-3 h-3" /> Drag to rotate &middot; Pinch to zoom
        </div>
      </div>
    </div>
  )
}

function ThumbnailItem({ item, isSelected, onClick }: { item: MediaItem; isSelected: boolean; onClick: () => void }) {
  const mt = item.media_type || 'image'
  return (
    <button
      onClick={onClick}
      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-lg border-2 overflow-hidden shrink-0 transition-all relative ${
        isSelected ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-400'
      }`}
    >
      {mt === 'video' ? (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center relative">
          <video src={imgUrl(item.url)} className="w-full h-full object-cover" muted preload="metadata" />
          <Play className="absolute w-5 h-5 text-white drop-shadow-lg" />
        </div>
      ) : mt === 'model3d' ? (
        <div className="w-full h-full bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center">
          <Box className="w-6 h-6 text-cyan-600" />
        </div>
      ) : (
        <img src={imgUrl(item.url)} alt="" className="w-full h-full object-cover" />
      )}
      {mt !== 'image' && (
        <span className={`absolute bottom-0.5 right-0.5 text-[8px] font-bold text-white px-1 rounded ${mt === 'video' ? 'bg-primary' : 'bg-cyan-600'}`}>
          {mt === 'video' ? 'VID' : '3D'}
        </span>
      )}
    </button>
  )
}

export default function MediaViewer({ items, selectedIndex, onSelect, productName, badges }: MediaViewerProps) {
  const selected = items[selectedIndex]
  const mt = selected?.media_type || 'image'
  const firstImage = items.find(i => (i.media_type || 'image') === 'image')

  return (
    <div className="space-y-4">
      <div className="aspect-square bg-gray-50 rounded-xl overflow-hidden border relative">
        {!selected ? (
          <div className="w-full h-full flex items-center justify-center">
            <Box className="w-20 h-20 text-gray-200" />
          </div>
        ) : mt === 'video' ? (
          <VideoPlayer url={selected.url} alt={selected.alt_text} />
        ) : mt === 'model3d' ? (
          <Model3DViewer url={selected.url} alt={productName} poster={firstImage ? imgUrl(firstImage.url) : undefined} />
        ) : (
          <img src={imgUrl(selected.url)} alt={selected.alt_text || productName} className="w-full h-full object-contain p-4" />
        )}
        {mt === 'image' && badges}
      </div>
      {items.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {items.map((item, i) => (
            <ThumbnailItem key={item.id} item={item} isSelected={i === selectedIndex} onClick={() => onSelect(i)} />
          ))}
        </div>
      )}
    </div>
  )
}
