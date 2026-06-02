import { cn } from '@/lib/utils'

type PreviewProps = {
  blockType: string
  variantProps: Record<string, unknown>
  sampleUrls: string[]
}

function Bar({ w, h = 'h-1.5', className }: { w: string; h?: string; className?: string }) {
  return <div className={cn(h, w, 'rounded', className ?? 'bg-gray-300')} />
}

function Img({ src, className }: { src?: string; className?: string }) {
  if (!src) return <div className={cn('bg-gray-300 rounded', className)} />
  return <img src={src} alt="" className={cn('object-cover rounded', className)} />
}

function FooterPreview({ variantProps }: { variantProps: Record<string, unknown> }) {
  const style = String(variantProps.footer_style ?? 'columns')
  const isDark = style === 'dark'
  const isMinimal = style === 'minimal'
  const isBrand = style === 'brand'
  const isCompact = style === 'compact'
  const isMega = style === 'mega'
  const isSimple = style === 'simple'
  const shell = isDark ? 'bg-slate-900' : isBrand ? 'bg-emerald-700' : 'bg-slate-50'
  const line = isDark ? 'bg-slate-600' : isBrand ? 'bg-white/25' : 'bg-slate-200'
  const link = isDark ? 'bg-slate-700' : isBrand ? 'bg-white/30' : 'bg-slate-200'
  const head = isDark ? 'bg-slate-400' : isBrand ? 'bg-white/90' : 'bg-slate-500'

  if (isSimple) {
    return (
      <div className={cn('h-full flex flex-col items-center justify-center gap-2 p-3', shell)}>
        <div className="flex gap-1 flex-wrap justify-center">
          {[0, 1, 2, 3].map(i => <Bar key={i} w="w-5" h="h-1" className={link} />)}
        </div>
        <Bar w="w-12" h="h-1" className={line} />
      </div>
    )
  }

  if (isMinimal) {
    return (
      <div className={cn('h-full flex flex-col items-center justify-center gap-2 p-4', shell)}>
        <Bar w="w-10" h="h-2.5" className={head} />
        <div className="flex gap-1.5 flex-wrap justify-center">
          {[0, 1, 2, 3, 4].map(i => <Bar key={i} w="w-5" h="h-1" className={link} />)}
        </div>
        <Bar w="w-14" h="h-1" className={line} />
      </div>
    )
  }

  const cols = isCompact ? 2 : Number(variantProps.columns) || 4

  return (
    <div className={cn('h-full flex flex-col justify-end p-2.5 pt-2', shell)}>
      {isMega && (
        <div className="mb-2 pb-2 border-b border-slate-200/40 flex gap-1 items-center">
          <Bar w="w-1/3" h="h-1" className={head} />
          <Bar w="flex-1" h="h-2" className={isDark ? 'bg-slate-800 border border-slate-600' : 'bg-white border border-slate-200'} />
          <Bar w="w-6" h="h-2" className="bg-primary/60" />
        </div>
      )}
      <div className={cn('grid gap-1.5 mb-2', cols >= 4 ? 'grid-cols-4' : cols === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
        {Array.from({ length: Math.min(cols, 4) }).map((_, col) => (
          <div key={col} className="space-y-0.5">
            <Bar w="w-3/4" h="h-1.5" className={head} />
            {[0, 1, 2].map(i => <Bar key={i} w="w-full" h="h-0.5" className={link} />)}
          </div>
        ))}
      </div>
      <div className={cn('h-px w-full', line)} />
      <Bar w="w-1/3 mx-auto mt-1.5" h="h-1" className={link} />
    </div>
  )
}

function NavPreview({ variantProps }: { variantProps: Record<string, unknown> }) {
  const style = String(variantProps.nav_style ?? 'white')
  const isCentered = style === 'centered' || style === 'dark_centered' || variantProps.nav_layout === 'centered'
  const isDark = style === 'dark' || style === 'brand' || style === 'dark_centered'
  const isTransparent = style === 'transparent' || style === 'transparent_cta'
  const isGlass = style === 'glass' || variantProps.nav_glass
  const isElevated = style === 'elevated' || variantProps.nav_elevated
  const isCompact = style === 'compact' || variantProps.nav_compact
  const isAccentBorder = style === 'accent_border' || variantProps.nav_accent_border
  const isShop = style === 'shop'
  const shell = isDark
    ? 'bg-slate-900'
    : isTransparent
      ? 'bg-gradient-to-b from-slate-300/70 to-transparent'
      : isGlass
        ? 'bg-white/60 backdrop-blur-sm border-b border-white/40'
        : style === 'brand'
          ? 'bg-orange-500'
          : 'bg-white border-b border-slate-200'
  const logo = isDark || style === 'brand' ? 'bg-white/80' : 'bg-slate-500'
  const link = isDark || style === 'brand' ? 'bg-white/30' : 'bg-slate-200'
  const cta = style === 'brand' || style === 'transparent_cta' ? 'bg-orange-500' : 'bg-primary/70'
  const rowClass = cn(
    'h-full px-2',
    isCompact ? 'py-1' : 'py-2',
    isElevated && 'mx-1 mt-1 rounded-md shadow-md',
    isCentered ? 'flex flex-col items-center justify-center gap-1' : 'flex items-center justify-between',
    shell,
    isAccentBorder && 'border-b-2 border-orange-500',
  )

  const linksRow = (
    <div className={cn('flex gap-1', isCentered && 'justify-center')}>
      {[0, 1, 2].map(i => <Bar key={i} w="w-5" h="h-1" className={link} />)}
    </div>
  )

  const actionsRow = (
    <div className="flex gap-1 items-center">
      {isShop && (
        <>
          <Bar w="w-3" h="h-3" className={cn('rounded-full', link)} />
          <Bar w="w-3" h="h-3" className={cn('rounded-full', link)} />
        </>
      )}
      <Bar w="w-8" h="h-2" className={cta} />
    </div>
  )

  if (isCentered) {
    return (
      <div className={rowClass}>
        <Bar w="w-12" h="h-2" className={logo} />
        {linksRow}
        {actionsRow}
      </div>
    )
  }

  return (
    <div className={rowClass}>
      <Bar w="w-12" h="h-2" className={logo} />
      {linksRow}
      {actionsRow}
    </div>
  )
}

function HeroPreview({ blockType, variantProps, sampleUrls }: PreviewProps) {
  const img = sampleUrls[0]
  const isSplit = blockType === 'hero_split' || variantProps.layout === 'split'
  const bgStyle = String(variantProps.bg_style ?? 'gradient')
  const isMinimal = blockType === 'hero_minimal' || bgStyle === 'minimal'
  const isDark = bgStyle === 'dark' || bgStyle === 'solid'

  if (isSplit) {
    return (
      <div className="h-full flex bg-white">
        <div className="flex-1 flex flex-col justify-center gap-1 px-2 py-2">
          <Bar w="w-4/5" h="h-2.5" className="bg-slate-600" />
          <Bar w="w-full" h="h-1" className="bg-slate-200" />
          <Bar w="w-full" h="h-1" className="bg-slate-200" />
          <div className="flex gap-1 mt-1">
            <Bar w="w-8" h="h-2" className="bg-primary/60" />
            <Bar w="w-8" h="h-2" className="bg-slate-200" />
          </div>
        </div>
        <Img src={img} className="w-[45%] h-full rounded-none" />
      </div>
    )
  }

  if (isMinimal) {
    return (
      <div className="h-full flex flex-col justify-center gap-1.5 px-4 bg-white relative overflow-hidden">
        {img && (
          <>
            <Img src={img} className="absolute inset-0 w-full h-full rounded-none object-cover opacity-25" />
            <div className="absolute inset-0 bg-white/70" />
          </>
        )}
        <div className="relative z-10 flex flex-col gap-1.5">
          <Bar w="w-1/2" h="h-3" className="bg-slate-700" />
          <Bar w="w-2/3" h="h-1" className="bg-slate-300" />
          <Bar w="w-10" h="h-2" className="bg-primary/60 mt-1" />
        </div>
      </div>
    )
  }

  const shell = img
    ? 'relative'
    : isDark
      ? 'bg-slate-900'
      : 'bg-gradient-to-br from-primary/25 via-violet-100 to-emerald-50'

  return (
    <div className={cn('h-full flex flex-col items-center justify-center gap-1.5 p-3', shell)}>
      {img && (
        <>
          <Img src={img} className="absolute inset-0 w-full h-full rounded-none object-cover" />
          <div className={cn(
            'absolute inset-0',
            isDark ? 'bg-black/55'
              : bgStyle === 'gradient' ? 'bg-gradient-to-br from-violet-900/50 via-primary/35 to-black/45'
                : 'bg-black/40',
          )} />
        </>
      )}
      <div className="relative z-10 flex flex-col items-center gap-1 w-full">
        <Bar w="w-2/3" h="h-2.5" className={img || isDark ? 'bg-white/90' : 'bg-slate-700'} />
        <Bar w="w-1/2" h="h-1" className={img || isDark ? 'bg-white/60' : 'bg-slate-400'} />
        <div className="flex gap-1 mt-1">
          <Bar w="w-8" h="h-2" className="bg-primary/80" />
          <Bar w="w-8" h="h-2" className={img || isDark ? 'bg-white/30' : 'bg-white/80'} />
        </div>
      </div>
    </div>
  )
}

function GridCardsPreview({ variantProps, sampleUrls, withImages = true }: {
  variantProps: Record<string, unknown>
  sampleUrls: string[]
  withImages?: boolean
}) {
  const cols = Number(variantProps.columns) || 3
  const isList = variantProps.layout === 'list'
  const colClass = cols >= 4 ? 'grid-cols-4' : cols === 2 ? 'grid-cols-2' : 'grid-cols-3'

  if (isList) {
    return (
      <div className="h-full p-2 space-y-1">
        <Bar w="w-1/3 mx-auto" h="h-1.5" className="bg-slate-500 mb-1" />
        {[0, 1, 2].map(i => (
          <div key={i} className="flex gap-1.5 items-center border border-slate-100 rounded p-1 bg-white">
            {withImages && <Img src={sampleUrls[i]} className="w-8 h-8 shrink-0" />}
            <div className="flex-1 space-y-0.5">
              <Bar w="w-2/3" h="h-1" className="bg-slate-400" />
              <Bar w="w-full" h="h-0.5" className="bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="h-full p-2 flex flex-col gap-1">
      <Bar w="w-1/3 mx-auto" h="h-1.5" className="bg-slate-500" />
      <div className={cn('grid flex-1 gap-1', colClass)}>
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded border border-slate-100 bg-white p-0.5 flex flex-col gap-0.5 overflow-hidden">
            {withImages && <Img src={sampleUrls[i]} className="w-full h-7" />}
            <Bar w="w-3/4 mx-auto" h="h-0.5" className="bg-slate-400" />
            <Bar w="w-full" h="h-0.5" className="bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  )
}

function StatsPreview({ variantProps, sampleUrls }: { variantProps: Record<string, unknown>; sampleUrls: string[] }) {
  const isDark = variantProps.bg_style === 'dark'
  const isGradient = variantProps.bg_style === 'gradient'
  const cols = Number(variantProps.columns) || 4
  const img = sampleUrls[0]
  const shell = img ? 'relative'
    : isDark ? 'bg-slate-900'
      : isGradient ? 'bg-gradient-to-r from-primary/20 to-violet-100'
        : 'bg-slate-50'
  const num = isDark || img ? 'bg-slate-300' : 'bg-slate-600'
  const lbl = isDark || img ? 'bg-slate-600' : 'bg-slate-300'

  return (
    <div className={cn('h-full flex items-center justify-around px-2 overflow-hidden', shell)}>
      {img && (
        <>
          <Img src={img} className="absolute inset-0 w-full h-full rounded-none object-cover opacity-30" />
          <div className={cn('absolute inset-0', isDark ? 'bg-black/55' : 'bg-white/60')} />
        </>
      )}
      {Array.from({ length: Math.min(cols, 4) }).map((_, i) => (
        <div key={i} className="text-center space-y-0.5 relative z-10">
          <Bar w="w-7 mx-auto" h="h-2.5" className={num} />
          <Bar w="w-5 mx-auto" h="h-1" className={lbl} />
        </div>
      ))}
    </div>
  )
}

function TestimonialsPreview({ variantProps, sampleUrls }: { variantProps: Record<string, unknown>; sampleUrls: string[] }) {
  const layout = String(variantProps.layout ?? 'grid')
  const isCentered = layout === 'centered'

  if (isCentered) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-3 bg-slate-50 gap-1">
        {sampleUrls[0] && <Img src={sampleUrls[0]} className="w-6 h-6 rounded-full mb-0.5" />}
        <div className="text-primary text-lg leading-none">“</div>
        <Bar w="w-4/5" h="h-1" className="bg-slate-300" />
        <Bar w="w-3/5" h="h-1" className="bg-slate-200" />
        <Bar w="w-1/4" h="h-1" className="bg-slate-400 mt-1" />
      </div>
    )
  }

  const cols = layout === 'masonry' ? 2 : 3
  return (
    <div className="h-full p-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded border border-slate-200 bg-white p-1.5 flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <Img src={sampleUrls[i]} className="w-4 h-4 rounded-full shrink-0" />
            <div className="flex gap-0.5">{[0, 1, 2, 3, 4].map(s => <div key={s} className="w-1 h-1 rounded-full bg-amber-400" />)}</div>
          </div>
          <Bar w="w-full" h="h-0.5" className="bg-slate-200" />
          <Bar w="w-2/3" h="h-0.5" className="bg-slate-200" />
          <Bar w="w-1/2" h="h-1" className="bg-slate-400 mt-auto" />
        </div>
      ))}
    </div>
  )
}

function PricingPreview({ variantProps }: { variantProps: Record<string, unknown> }) {
  const cols = Number(variantProps.columns) || 3
  return (
    <div className="h-full p-2 flex gap-1 items-end justify-center">
      {Array.from({ length: Math.min(cols, 3) }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex-1 rounded border p-1.5 flex flex-col gap-0.5 max-w-[33%]',
            i === 1 && cols >= 3 ? 'border-primary/50 bg-primary/5 h-[88%] shadow-sm' : 'border-slate-200 bg-white h-[72%]',
          )}
        >
          <Bar w="w-2/3" h="h-1" className="bg-slate-400" />
          <Bar w="w-1/2" h="h-2" className="bg-slate-600" />
          {[0, 1, 2].map(j => <Bar key={j} w="w-full" h="h-0.5" className="bg-slate-200" />)}
          <Bar w="w-full" h="h-1.5" className={i === 1 ? 'bg-primary/60 mt-auto' : 'bg-slate-200 mt-auto'} />
        </div>
      ))}
    </div>
  )
}

function FaqPreview({ variantProps }: { variantProps: Record<string, unknown> }) {
  const isTwoCol = variantProps.layout === 'two-col'
  const items = [0, 1, 2, 3]

  if (isTwoCol) {
    return (
      <div className="h-full p-2 grid grid-cols-2 gap-1">
        {items.map(i => (
          <div key={i} className="rounded border border-slate-200 px-1 py-1 flex justify-between items-center bg-white">
            <Bar w="w-3/4" h="h-0.5" className="bg-slate-400" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="h-full p-2 space-y-0.5">
      <Bar w="w-1/3 mx-auto" h="h-1.5" className="bg-slate-500 mb-1" />
      {items.map(i => (
        <div key={i} className="rounded border border-slate-200 px-1.5 py-1 flex justify-between items-center bg-white">
          <Bar w="w-4/5" h="h-0.5" className="bg-slate-500" />
          <div className="w-2 h-2 rounded border border-slate-300 flex items-center justify-center text-[6px] text-slate-400">+</div>
        </div>
      ))}
    </div>
  )
}

function ContactFormPreview({ variantProps, sampleUrls }: { variantProps: Record<string, unknown>; sampleUrls: string[] }) {
  const layout = String(variantProps.layout ?? 'split')
  const img = sampleUrls[0]
  const field = (h = 'h-2') => <Bar w="w-full" h={h} className="bg-white border border-slate-200" />

  if (layout === 'centered') {
    return (
      <div className="h-full p-3 flex flex-col items-center justify-center bg-slate-50 gap-1 relative overflow-hidden">
        {img && <Img src={img} className="absolute inset-0 w-full h-full rounded-none object-cover opacity-15" />}
        <Bar w="w-1/3" h="h-1.5" className="bg-slate-600 mb-1 relative z-10" />
        <div className="w-3/4 space-y-0.5 relative z-10">{field()}{field()}{field('h-4')}{<Bar w="w-1/2" h="h-2" className="bg-primary/60" />}</div>
      </div>
    )
  }

  if (layout === 'stacked') {
    return (
      <div className="h-full p-2 flex flex-col gap-1 bg-slate-50">
        <div className="flex-1 space-y-0.5">{field()}{field()}{field('h-3')}{<Bar w="w-2/3" h="h-2" className="bg-primary/60" />}</div>
        <Img src={img} className="h-1/3 w-full rounded border border-slate-200" />
      </div>
    )
  }

  return (
    <div className="h-full p-2 flex gap-1.5 bg-slate-50 relative overflow-hidden">
      {img && <Img src={img} className="absolute inset-0 w-full h-full rounded-none object-cover opacity-10" />}
      <div className="flex-1 space-y-0.5 relative z-10">{field()}{field()}{field('h-3')}{<Bar w="w-2/3" h="h-2" className="bg-primary/60" />}</div>
      <div className="w-2/5 space-y-0.5 pt-1 relative z-10">
        <Bar w="w-full" h="h-1" className="bg-slate-500" />
        <Bar w="w-3/4" h="h-0.5" className="bg-slate-300" />
        <Bar w="w-2/3" h="h-0.5" className="bg-slate-300" />
      </div>
    </div>
  )
}

function CtaPreview({ variantProps, sampleUrls }: { variantProps: Record<string, unknown>; sampleUrls: string[] }) {
  const bgStyle = String(variantProps.bg_style ?? 'gradient')
  const img = sampleUrls[0]
  const shell =
    img ? 'relative'
      : bgStyle === 'dark' ? 'bg-slate-900'
        : bgStyle === 'light' ? 'bg-slate-50'
          : 'bg-gradient-to-r from-primary/30 to-emerald-100'
  const text = bgStyle === 'dark' || img ? 'bg-white/80' : 'bg-slate-700'
  const sub = bgStyle === 'dark' || img ? 'bg-white/50' : 'bg-slate-400'

  return (
    <div className={cn('h-full flex flex-col items-center justify-center gap-1 p-3 overflow-hidden', shell)}>
      {img && (
        <>
          <Img src={img} className="absolute inset-0 w-full h-full rounded-none object-cover" />
          <div className={cn('absolute inset-0', bgStyle === 'dark' ? 'bg-black/60' : 'bg-black/45')} />
        </>
      )}
      <div className="relative z-10 flex flex-col items-center gap-1">
        <Bar w="w-1/2" h="h-2" className={text} />
        <Bar w="w-1/3" h="h-1" className={sub} />
        <Bar w="w-12" h="h-2.5" className="bg-primary/70 mt-1" />
      </div>
    </div>
  )
}

function NewsletterPreview({ variantProps, sampleUrls }: { variantProps: Record<string, unknown>; sampleUrls: string[] }) {
  const layout = String(variantProps.layout ?? 'inline')
  const img = sampleUrls[0]
  if (layout === 'split') {
    return (
      <div className="h-full flex bg-slate-100">
        <Img src={img} className="w-2/5 h-full rounded-none object-cover" />
        <div className="flex-1 flex flex-col justify-center gap-1 p-2">
          <Bar w="w-3/4" h="h-1.5" className="bg-slate-600" />
          <div className="flex gap-0.5"><Bar w="flex-1" h="h-2" className="bg-white border border-slate-200" /><Bar w="w-8" h="h-2" className="bg-primary/60" /></div>
        </div>
      </div>
    )
  }
  if (layout === 'card') {
    return (
      <div className="h-full p-3 flex items-center justify-center bg-slate-50 relative overflow-hidden">
        {img && <Img src={img} className="absolute inset-0 w-full h-full rounded-none object-cover opacity-15" />}
        <div className="w-4/5 rounded-lg border border-slate-200 bg-white/95 p-2 space-y-1 shadow-sm relative z-10">
          <Bar w="w-2/3 mx-auto" h="h-1.5" className="bg-slate-600" />
          <div className="flex gap-0.5"><Bar w="flex-1" h="h-2" className="bg-slate-50 border border-slate-200" /><Bar w="w-8" h="h-2" className="bg-primary/60" /></div>
        </div>
      </div>
    )
  }
  return (
    <div className="h-full flex items-center justify-center gap-1 px-2 bg-primary/10 relative overflow-hidden">
      {img && <Img src={img} className="absolute inset-0 w-full h-full rounded-none object-cover opacity-20" />}
      <Bar w="w-1/4" h="h-1" className="bg-slate-600 shrink-0 relative z-10" />
      <Bar w="flex-1" h="h-2" className="bg-white border border-slate-200 relative z-10" />
      <Bar w="w-10" h="h-2" className="bg-primary/60 shrink-0 relative z-10" />
    </div>
  )
}

function TeamPreview({ variantProps, sampleUrls }: { variantProps: Record<string, unknown>; sampleUrls: string[] }) {
  const cols = Number(variantProps.columns) || 4
  return (
    <div className="h-full p-2 flex flex-col gap-1">
      <Bar w="w-1/3 mx-auto" h="h-1.5" className="bg-slate-500" />
      <div className={cn('grid flex-1 gap-1', cols >= 5 ? 'grid-cols-5' : cols === 3 ? 'grid-cols-3' : 'grid-cols-4')}>
        {Array.from({ length: Math.min(cols, 4) }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <Img src={sampleUrls[i]} className="w-full aspect-square rounded-full" />
            <Bar w="w-2/3" h="h-0.5" className="bg-slate-500" />
            <Bar w="w-1/2" h="h-0.5" className="bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  )
}

function AlternatingPreview({ variantProps, sampleUrls }: { variantProps: Record<string, unknown>; sampleUrls: string[] }) {
  const pos = variantProps.image_position === 'right' ? 'right' : 'left'
  return (
    <div className="h-full p-1.5 space-y-1">
      {[0, 1].map(row => (
        <div key={row} className={cn('flex gap-1 h-[46%]', row === 1 && pos === 'left' && 'flex-row-reverse', row === 1 && pos === 'right' && 'flex-row')}>
          <Img src={sampleUrls[row]} className="w-2/5 h-full" />
          <div className="flex-1 flex flex-col justify-center gap-0.5 px-1">
            <Bar w="w-2/3" h="h-1" className="bg-slate-500" />
            <Bar w="w-full" h="h-0.5" className="bg-slate-200" />
            <Bar w="w-full" h="h-0.5" className="bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  )
}

function GalleryPreview({ variantProps, sampleUrls }: { variantProps: Record<string, unknown>; sampleUrls: string[] }) {
  const layout = String(variantProps.layout ?? 'grid')
  const cols = Number(variantProps.columns) || 3
  const shape = String(variantProps.image_shape ?? 'square')
  const imgClass = shape === 'circle' ? 'aspect-square rounded-full' : shape === 'rounded' ? 'rounded-xl' : 'rounded-sm'
  if (layout === 'featured') {
    return (
      <div className="h-full p-1.5 grid grid-cols-3 grid-rows-2 gap-0.5">
        <Img src={sampleUrls[0]} className={cn('col-span-2 row-span-2 w-full h-full', imgClass)} />
        {[1, 2].map(i => <Img key={i} src={sampleUrls[i]} className={cn('w-full h-full', imgClass)} />)}
      </div>
    )
  }
  if (layout === 'masonry') {
    return (
      <div className="h-full p-1.5 columns-3 gap-0.5">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <Img key={i} src={sampleUrls[i]} className={cn('w-full mb-0.5 break-inside-avoid', imgClass, i % 3 === 0 ? 'h-8' : 'h-5')} />
        ))}
      </div>
    )
  }
  return (
    <div className={cn('h-full p-1.5 grid gap-0.5', cols <= 2 ? 'grid-cols-2' : cols >= 4 ? 'grid-cols-4' : 'grid-cols-3')}>
      {[0, 1, 2, 3, 4, 5].slice(0, cols <= 2 ? 4 : cols >= 4 ? 8 : 6).map(i => (
        <Img key={i} src={sampleUrls[i]} className={cn('w-full', imgClass, cols <= 2 ? 'aspect-[4/3]' : 'aspect-square')} />
      ))}
    </div>
  )
}

function AnnouncementPreview({ variantProps }: { variantProps: Record<string, unknown> }) {
  const color = String(variantProps.color ?? '#64C3A0')
  const showClose = variantProps.show_close !== false
  const isLight = color.toLowerCase() === '#f3f4f6' || color.toLowerCase() === '#ecfdf5'
  return (
    <div className="h-full flex items-center justify-center px-3 text-center gap-2 relative" style={{ backgroundColor: color }}>
      <Bar w="w-4/5" h="h-1.5" className={isLight ? 'bg-slate-600' : 'bg-white/90'} />
      {showClose && <div className={cn('w-2 h-2 rounded-full shrink-0', isLight ? 'bg-slate-400' : 'bg-white/60')} />}
    </div>
  )
}

/** Distinct mini-previews for commerce library blocks (product.*, service.*, etc.). */
function VariantPreview({
  blockType,
  variantProps,
  sampleUrls,
}: {
  blockType: string
  variantProps: Record<string, unknown>
  sampleUrls: string[]
}) {
  const variant = String(variantProps.variant ?? variantProps.layout ?? 'default')
  const img = sampleUrls[0]
  const isProduct = blockType.startsWith('product.')
  const isMenu = blockType.startsWith('menu.')
  const isBooking = blockType.startsWith('booking.')
  const isCommerce = blockType.startsWith('commerce.')

  const tile = (i: number, cls?: string) => (
    <div key={i} className={cn('rounded border border-slate-200 bg-white overflow-hidden', cls)}>
      {img ? <Img src={sampleUrls[i % sampleUrls.length]} className="w-full h-5" /> : <div className="w-full h-5 bg-slate-200" />}
      <div className="p-0.5 space-y-0.5">
        <Bar w="w-3/4" h="h-0.5" className="bg-slate-500" />
        {isProduct && <Bar w="w-1/2" h="h-0.5" className="bg-primary/50" />}
      </div>
    </div>
  )

  if (variant === 'compact') {
    return (
      <div className="h-full p-1.5 flex flex-col gap-0.5 bg-slate-50">
        <Bar w="w-1/3" h="h-1" className="bg-slate-500" />
        <div className="grid grid-cols-4 gap-0.5 flex-1">
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => tile(i, 'p-0'))}
        </div>
      </div>
    )
  }

  if (variant === 'featured' || variant === 'hero') {
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        <div className="relative flex-1 min-h-0">
          {img ? <Img src={img} className="w-full h-full rounded-none" /> : <div className="w-full h-full bg-slate-300" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-1.5 left-2 right-2 space-y-0.5">
            <Bar w="w-2/3" h="h-1.5" className="bg-white/90" />
            <Bar w="w-1/3" h="h-1" className="bg-primary/80" />
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'minimal') {
    return (
      <div className="h-full p-3 flex flex-col justify-center gap-1 bg-white">
        <Bar w="w-1/2" h="h-1.5" className="bg-slate-700" />
        <Bar w="w-full" h="h-0.5" className="bg-slate-200" />
        <Bar w="w-3/4" h="h-0.5" className="bg-slate-200" />
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div className="h-full p-2 flex items-center justify-center bg-slate-100">
        <div className="w-4/5 rounded-lg border border-slate-200 bg-white shadow-sm p-2 space-y-1">
          {img && <Img src={img} className="w-full h-8 rounded" />}
          <Bar w="w-2/3" h="h-1" className="bg-slate-600" />
          <Bar w="w-full" h="h-0.5" className="bg-slate-200" />
          <Bar w="w-1/2" h="h-1.5" className="bg-primary/60" />
        </div>
      </div>
    )
  }

  if (variant === 'split') {
    return (
      <div className="h-full flex bg-white">
        <div className="flex-1 p-2 flex flex-col justify-center gap-0.5">
          <Bar w="w-3/4" h="h-1.5" className="bg-slate-600" />
          <Bar w="w-full" h="h-0.5" className="bg-slate-200" />
          <Bar w="w-1/2" h="h-1.5" className="bg-primary/60 mt-0.5" />
        </div>
        {img ? <Img src={img} className="w-[42%] h-full rounded-none" /> : <div className="w-[42%] bg-slate-200" />}
      </div>
    )
  }

  if (variant === 'editorial') {
    return (
      <div className="h-full p-2 flex flex-col gap-1 bg-white">
        <Bar w="w-1/2" h="h-2.5" className="bg-slate-800" />
        <Bar w="w-2/3" h="h-1" className="bg-slate-300" />
        {img && <Img src={img} className="w-full flex-1 min-h-0 rounded" />}
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className="h-full p-1.5 space-y-0.5 bg-slate-50">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex gap-1 items-center bg-white border border-slate-100 rounded px-1 py-0.5">
            {img && <Img src={sampleUrls[i]} className="w-6 h-6 shrink-0 rounded" />}
            <div className="flex-1 space-y-0.5">
              <Bar w="w-3/4" h="h-0.5" className="bg-slate-500" />
              <Bar w="w-1/2" h="h-0.5" className="bg-slate-200" />
            </div>
            {(isProduct || isMenu) && <Bar w="w-4" h="h-1" className="bg-primary/50 shrink-0" />}
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'grid') {
    return (
      <div className="h-full p-1.5 grid grid-cols-3 gap-0.5 bg-slate-50">
        {[0, 1, 2, 3, 4, 5].map(i => tile(i))}
      </div>
    )
  }

  // Booking-specific default
  if (isBooking) {
    return (
      <div className="h-full p-2 bg-slate-50 flex flex-col gap-1">
        <Bar w="w-1/3" h="h-1" className="bg-slate-500" />
        <div className="grid grid-cols-7 gap-0.5 flex-1">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className={cn('rounded-sm h-2', i === 9 ? 'bg-primary/60' : 'bg-white border border-slate-200')} />
          ))}
        </div>
      </div>
    )
  }

  // Menu default
  if (isMenu) {
    return (
      <div className="h-full p-2 grid grid-cols-2 gap-1 bg-white">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="space-y-0.5">
            <Bar w="w-2/3" h="h-0.5" className="bg-slate-600" />
            <Bar w="w-full" h="h-0.5" className="bg-slate-200" />
            <Bar w="w-1/3" h="h-0.5" className="bg-primary/50" />
          </div>
        ))}
      </div>
    )
  }

  // Default / commerce checkout
  if (isCommerce) {
    return (
      <div className="h-full p-2 flex gap-1 bg-slate-50">
        <div className="flex-1 space-y-0.5">{[0, 1, 2].map(i => <Bar key={i} w="w-full" h="h-1.5" className="bg-white border border-slate-200" />)}</div>
        <div className="w-2/5 rounded border border-slate-200 bg-white p-1 space-y-0.5">
          <Bar w="w-full" h="h-0.5" className="bg-slate-400" />
          <Bar w="w-full" h="h-2" className="bg-primary/60" />
        </div>
      </div>
    )
  }

  // Default product/service grid
  return (
    <div className="h-full p-1.5 flex flex-col gap-1 bg-slate-50">
      <Bar w="w-1/3" h="h-1" className="bg-slate-500" />
      <div className="grid grid-cols-3 gap-1 flex-1">
        {[0, 1, 2, 3, 4, 5].map(i => tile(i))}
      </div>
    </div>
  )
}

function SpacingPreview({ variantProps }: { variantProps: Record<string, unknown> }) {
  const layout = String(variantProps.layout ?? 'standard')
  const align = String(variantProps.align ?? 'left')
  const isDark = variantProps.bg_style === 'dark'
  const isCard = layout === 'card' || variantProps.card_style === 'elevated'
  const isNarrow = layout === 'narrow' || variantProps.max_width === 'prose'
  const isWide = layout === 'wide' || variantProps.max_width === 'full'
  const isSplit = layout === 'split'
  const shell = isDark ? 'bg-slate-900' : 'bg-slate-50'
  const bar = isDark ? 'bg-slate-400' : 'bg-slate-600'
  const sub = isDark ? 'bg-slate-600' : 'bg-slate-300'

  const content = (
    <div className={cn(
      'space-y-1',
      align === 'center' && 'flex flex-col items-center',
      isNarrow && 'w-1/2 mx-auto',
      isWide && 'w-full',
    )}>
      <Bar w={isNarrow ? 'w-full' : 'w-2/5'} h="h-2" className={bar} />
      <Bar w={isNarrow ? 'w-full' : 'w-full'} h="h-1" className={sub} />
      <Bar w={isNarrow ? 'w-4/5' : 'w-4/5'} h="h-1" className={sub} />
      {layout === 'statement' && <Bar w="w-1/3" h="h-2" className="bg-primary/60 mt-1" />}
    </div>
  )

  if (isSplit) {
    return (
      <div className={cn('h-full flex gap-1 p-2', shell)}>
        <div className="flex-1 flex flex-col justify-center">{content}</div>
        <div className="w-2/5 bg-slate-200 rounded" />
      </div>
    )
  }

  if (isCard) {
    return (
      <div className={cn('h-full p-2 flex items-center justify-center', shell)}>
        <div className="w-4/5 rounded-lg border border-slate-200 bg-white shadow-sm p-2">{content}</div>
      </div>
    )
  }

  const pad = layout === 'spacious' ? 'py-4' : layout === 'compact' || layout === 'minimal' ? 'py-1' : 'py-2'
  return (
    <div className={cn('h-full px-3 flex flex-col justify-center', shell, pad)}>
      {content}
    </div>
  )
}

function MarqueePreview({ variantProps }: { variantProps: Record<string, unknown> }) {
  const style = String(variantProps.style ?? 'default')
  const shell = style === 'dark' ? 'bg-slate-900' : style === 'brand' ? 'bg-primary/80' : 'bg-slate-100'
  const bar = style === 'dark' || style === 'brand' ? 'bg-white/70' : 'bg-slate-500'
  return (
    <div className={cn('h-full flex items-center overflow-hidden px-1', shell)}>
      <div className="flex gap-2 whitespace-nowrap">
        {[0, 1, 2, 3, 4].map(i => <Bar key={i} w="w-10" h="h-1" className={bar} />)}
      </div>
    </div>
  )
}

function DividerPreview({ variantProps }: { variantProps: Record<string, unknown> }) {
  const style = String(variantProps.style ?? 'line')
  const color = String(variantProps.color ?? '#e5e7eb')
  return (
    <div className="h-full flex flex-col justify-center px-4 gap-2 bg-white">
      <Bar w="w-full" h="h-1" className="bg-slate-200" />
      {style === 'thick' && <div className="h-1 w-full rounded" style={{ backgroundColor: color }} />}
      {style === 'dashed' && <div className="h-px w-full border-t-2 border-dashed" style={{ borderColor: color }} />}
      {style === 'dotted' && <div className="h-px w-full border-t-2 border-dotted" style={{ borderColor: color }} />}
      {style === 'gradient' && <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-400 to-transparent" />}
      {style === 'double' && <><div className="h-px w-full bg-slate-300" /><div className="h-px w-full bg-slate-300" /></>}
      {style === 'icon' && (
        <div className="flex items-center gap-1">
          <div className="flex-1 h-px bg-slate-300" />
          <div className="w-2 h-2 rounded-full bg-primary/60" />
          <div className="flex-1 h-px bg-slate-300" />
        </div>
      )}
      {style === 'line' && <div className="h-px w-full" style={{ backgroundColor: color }} />}
      <Bar w="w-full" h="h-1" className="bg-slate-200" />
    </div>
  )
}

function SpacerPreview({ variantProps }: { variantProps: Record<string, unknown> }) {
  const h = Number(variantProps.height ?? 80)
  const pct = Math.min(100, Math.max(15, (h / 200) * 100))
  return (
    <div className="h-full flex flex-col bg-white">
      <div className="h-1/4 bg-slate-100 flex items-end justify-center pb-1"><Bar w="w-1/3" h="h-1" className="bg-slate-300" /></div>
      <div className="flex items-center justify-center border-y border-dashed border-primary/30 bg-primary/5" style={{ height: `${pct}%` }}>
        <span className="text-[8px] font-bold text-primary/60">{h}px</span>
      </div>
      <div className="flex-1 bg-slate-100 flex items-start justify-center pt-1"><Bar w="w-1/3" h="h-1" className="bg-slate-300" /></div>
    </div>
  )
}

function CountdownPreview({ variantProps }: { variantProps: Record<string, unknown> }) {
  const style = String(variantProps.style ?? 'boxes')
  const isDark = variantProps.bg_style === 'dark' || variantProps.bg_style === 'gradient'
  const shell = isDark ? 'bg-slate-900' : 'bg-slate-50'
  const unit = isDark ? 'bg-slate-800 border border-slate-600' : 'bg-white border border-slate-200'
  const num = isDark ? 'bg-slate-300' : 'bg-slate-700'

  if (style === 'inline') {
    return (
      <div className={cn('h-full flex items-center justify-center gap-1 px-2', shell)}>
        {['12', '05', '30'].map((_, i) => (
          <div key={i} className="flex items-center gap-0.5">
            <Bar w="w-4" h="h-2" className={num} />
            {i < 2 && <span className="text-[8px] text-slate-400">:</span>}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('h-full flex flex-col items-center justify-center gap-1 p-2', shell)}>
      <Bar w="w-1/3" h="h-1.5" className={isDark ? 'bg-white/80' : 'bg-slate-600'} />
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={cn('rounded px-1.5 py-1 flex flex-col items-center gap-0.5', unit, style === 'circles' && 'rounded-full w-7 h-7 p-0 justify-center')}>
            <Bar w="w-3" h="h-1.5" className={num} />
            {style !== 'circles' && <Bar w="w-2" h="h-0.5" className="bg-slate-400" />}
          </div>
        ))}
      </div>
    </div>
  )
}

function GenericPreview({ sampleUrls, variantProps }: { sampleUrls: string[]; variantProps?: Record<string, unknown> }) {
  if (variantProps && (variantProps.layout || variantProps.padding_top || variantProps.align || variantProps.bg_style)) {
    return <SpacingPreview variantProps={variantProps} />
  }
  const img = sampleUrls[0]
  return (
    <div className="h-full p-3 flex flex-col gap-1 justify-center bg-slate-50 relative overflow-hidden">
      {img && (
        <>
          <Img src={img} className="absolute inset-0 w-full h-full rounded-none object-cover opacity-20" />
          <div className="absolute inset-0 bg-white/75" />
        </>
      )}
      <div className="relative z-10 flex flex-col gap-1 justify-center">
        <Bar w="w-2/5" h="h-2" className="bg-slate-600" />
        <Bar w="w-full" h="h-1" className="bg-slate-200" />
        <Bar w="w-4/5" h="h-1" className="bg-slate-200" />
        <Bar w="w-1/3" h="h-2" className="bg-primary/50 mt-1" />
      </div>
    </div>
  )
}

export function SectionLayoutPreview({ blockType, variantProps, sampleUrls }: PreviewProps) {
  switch (blockType) {
    case 'footer':
      return <FooterPreview variantProps={variantProps} />
    case 'nav':
      return <NavPreview variantProps={variantProps} />
    case 'hero':
    case 'hero_split':
    case 'hero_minimal':
      return <HeroPreview blockType={blockType} variantProps={variantProps} sampleUrls={sampleUrls} />
    case 'features':
    case 'services_cards':
    case 'product_grid':
    case 'blog_grid':
      return <GridCardsPreview variantProps={variantProps} sampleUrls={sampleUrls} withImages={sampleUrls.length > 0} />
    case 'features_alternating':
    case 'about_split':
      return <AlternatingPreview variantProps={variantProps} sampleUrls={sampleUrls} />
    case 'stats':
      return <StatsPreview variantProps={variantProps} sampleUrls={sampleUrls} />
    case 'testimonials':
      return <TestimonialsPreview variantProps={variantProps} sampleUrls={sampleUrls} />
    case 'pricing':
      return <PricingPreview variantProps={variantProps} />
    case 'faq':
      return <FaqPreview variantProps={variantProps} />
    case 'contact_form':
      return <ContactFormPreview variantProps={variantProps} sampleUrls={sampleUrls} />
    case 'cta':
      return <CtaPreview variantProps={variantProps} sampleUrls={sampleUrls} />
    case 'newsletter':
      return <NewsletterPreview variantProps={variantProps} sampleUrls={sampleUrls} />
    case 'team_grid':
      return <TeamPreview variantProps={variantProps} sampleUrls={sampleUrls} />
    case 'gallery_masonry':
    case 'portfolio_grid':
    case 'image_gallery':
      return <GalleryPreview variantProps={variantProps} sampleUrls={sampleUrls} />
    case 'category_cards':
      return <GridCardsPreview variantProps={{ ...variantProps, columns: 3 }} sampleUrls={sampleUrls} />
    case 'announcement_bar':
      return <AnnouncementPreview variantProps={variantProps} />
    case 'marquee_strip':
      return <MarqueePreview variantProps={variantProps} />
    case 'divider':
      return <DividerPreview variantProps={variantProps} />
    case 'spacer':
      return <SpacerPreview variantProps={variantProps} />
    case 'countdown':
      return <CountdownPreview variantProps={variantProps} />
    case 'map_embed':
      return (
        <div className="h-full p-1.5 bg-slate-50">
          {variantProps.layout === 'split' ? (
            <div className="h-full flex gap-1">
              <div className="flex-1 space-y-0.5 pt-2"><Bar w="w-3/4" h="h-1" /><Bar w="w-1/2" h="h-0.5" className="bg-slate-300" /></div>
              <div className="w-3/5 rounded bg-emerald-100 border border-emerald-200 flex items-center justify-center"><Bar w="w-1/2" h="h-1" className="bg-emerald-400" /></div>
            </div>
          ) : (
            <div className="h-full rounded bg-emerald-100 border border-emerald-200 flex items-center justify-center">
              <Bar w="w-1/3" h="h-1.5" className="bg-emerald-400" />
            </div>
          )}
        </div>
      )
    case 'image_block':
      return (
        <div className="h-full p-2 flex flex-col gap-1 justify-center bg-slate-50">
          {variantProps.layout === 'split' ? (
            <div className="flex gap-1 h-3/4">
              <Img src={sampleUrls[0]} className="w-1/2 h-full" />
              <div className="flex-1 space-y-0.5 pt-2"><Bar w="w-full" h="h-1" /><Bar w="w-full" h="h-0.5" className="bg-slate-200" /></div>
            </div>
          ) : (
            <Img src={sampleUrls[0]} className={variantProps.layout === 'full' ? 'w-full h-4/5' : 'w-3/4 h-3/5 mx-auto'} />
          )}
          {!!variantProps.show_caption && <Bar w="w-1/4 mx-auto" h="h-1" className="bg-slate-300" />}
        </div>
      )
    case 'video_embed':
      return (
        <div className="h-full p-2">
          <div className="h-full rounded bg-slate-800 flex items-center justify-center relative overflow-hidden">
            {sampleUrls[0] && <Img src={sampleUrls[0]} className="absolute inset-0 w-full h-full opacity-50 rounded-none" />}
            <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center relative z-10">
              <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-slate-700 ml-0.5" />
            </div>
          </div>
        </div>
      )
    case 'trust_logos':
    case 'partner_logos':
      return (
        <div className="h-full flex flex-col items-center justify-center gap-1 p-2 bg-slate-50">
          <Bar w="w-1/4" h="h-1" className="bg-slate-400" />
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map(i => (
              <Img key={i} src={sampleUrls[i]} className={cn('w-7 h-4', variantProps.grayscale === true && 'grayscale opacity-60')} />
            ))}
          </div>
        </div>
      )
    case 'timeline':
      return variantProps.layout === 'horizontal'
        ? <StatsPreview variantProps={{ columns: 4 }} sampleUrls={sampleUrls} />
        : <FaqPreview variantProps={{ layout: 'list' }} />
    case 'rich_text':
      return (
        <div className="h-full p-3 flex flex-col gap-0.5 justify-center bg-white">
          <Bar w="w-1/2" h="h-2" className="bg-slate-700" />
          {[0, 1, 2, 3].map(i => <Bar key={i} w={i === 3 ? 'w-3/5' : 'w-full'} h="h-0.5" className="bg-slate-200" />)}
        </div>
      )
    case 'booking_widget':
      return variantProps.layout === 'cta'
        ? <CtaPreview variantProps={{ bg_style: 'gradient' }} sampleUrls={sampleUrls} />
        : <ContactFormPreview variantProps={{ layout: 'split' }} sampleUrls={sampleUrls} />
    default:
      if (blockType.includes('.')) {
        return <VariantPreview blockType={blockType} variantProps={variantProps} sampleUrls={sampleUrls} />
      }
      return <GenericPreview sampleUrls={sampleUrls} variantProps={variantProps} />
  }
}
