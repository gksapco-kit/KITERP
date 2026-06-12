import { MOSAIC_AVATARS } from './landingData'

type MosaicCell = {
  kind: 'avatar' | 'shape'
  shape?: 'rounded' | 'circle' | 'leaf-tl' | 'leaf-tr' | 'leaf-br' | 'leaf-bl' | 'blob' | 'pill' | 'squircle'
  tone?: 'plum' | 'gray'
  avatarIdx?: number
}

const SHAPES = ['rounded', 'circle', 'leaf-tl', 'leaf-tr', 'leaf-br', 'leaf-bl', 'blob', 'pill', 'squircle'] as const
const TONES = ['gray', 'plum'] as const

/** Deterministic mosaic of tiles, seeded so layouts differ. */
function makeGrid(seed: number, count: number): MosaicCell[] {
  const cells: MosaicCell[] = []
  let avatar = seed * 7
  for (let i = 0; i < count; i++) {
    const n = i + seed * 13
    const shape = SHAPES[n % SHAPES.length]
    const isAvatar = (n * 5 + 3) % 9 < 5
    if (isAvatar) {
      cells.push({ kind: 'avatar', shape, avatarIdx: avatar % MOSAIC_AVATARS.length })
      avatar++
    } else {
      cells.push({ kind: 'shape', shape, tone: TONES[(n + 1) % TONES.length] })
    }
  }
  return cells
}

const DESKTOP_COLS = 11
const DESKTOP_ROWS = 5
const MOBILE_COLS = 6
const MOBILE_ROWS = 5

const HL_STEP = 0.45
const DESKTOP_GRID = makeGrid(0, DESKTOP_COLS * DESKTOP_ROWS)
const MOBILE_GRID = makeGrid(2, MOBILE_COLS * MOBILE_ROWS)
const DESKTOP_CYCLE_S = DESKTOP_GRID.length * HL_STEP
const MOBILE_CYCLE_S = MOBILE_GRID.length * HL_STEP
const DESKTOP_CYCLE = `${DESKTOP_CYCLE_S.toFixed(2)}s`
const MOBILE_CYCLE = `${MOBILE_CYCLE_S.toFixed(2)}s`

/** Random (but stable) highlight delay per tile so they blink in no fixed order. */
function makeDelays(count: number, cycleSeconds: number): number[] {
  let s = count * 9301 + 49297
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  return Array.from({ length: count }, () => +(rand() * cycleSeconds).toFixed(2))
}

const DESKTOP_DELAYS = makeDelays(DESKTOP_GRID.length, DESKTOP_CYCLE_S)
const MOBILE_DELAYS = makeDelays(MOBILE_GRID.length, MOBILE_CYCLE_S)

function MosaicCellView({ cell, morphVariant }: { cell: MosaicCell; morphVariant: number }) {
  const shape = cell.shape ?? 'rounded'
  const classes = [
    'kiterp-mosaic-shape w-full h-full',
    shape,
    cell.tone,
    `kiterp-morph-v${morphVariant % 3}`,
  ].filter(Boolean).join(' ')

  if (cell.kind === 'shape') {
    return <div className={classes} />
  }

  const av = MOSAIC_AVATARS[cell.avatarIdx ?? 0]
  return (
    <div
      className={`${classes} flex items-center justify-center text-white font-bold text-sm sm:text-base`}
      style={{ background: av.bg }}
    >
      {av.initials}
    </div>
  )
}

function MosaicGrid({
  cells,
  cycle,
  delays,
  className,
}: {
  cells: MosaicCell[]
  cycle: string
  delays: number[]
  className: string
}) {
  return (
    <div className={className}>
      {cells.map((cell, i) => (
        <div
          key={i}
          className="kiterp-mosaic-cell aspect-square"
          style={{
            ['--mosaic-delay' as string]: `${(i * 0.08).toFixed(2)}s`,
            ['--mosaic-morph-delay' as string]: `${(delays[i] * 0.35).toFixed(2)}s`,
            ['--mosaic-hl' as string]: `${delays[i]}s`,
            ['--mosaic-cycle' as string]: cycle,
          }}
        >
          <MosaicCellView cell={cell} morphVariant={i % 3} />
        </div>
      ))}
    </div>
  )
}

export function CommunityMosaicSection() {
  return (
    <section id="community" className="relative py-16 sm:py-24 bg-white overflow-hidden scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="relative">
          {/* Decorative hand-drawn arrows */}
          <svg className="hidden sm:block absolute -top-6 left-2 w-16 h-16 opacity-50" viewBox="0 0 60 60" fill="none" aria-hidden>
            <path className="kiterp-scribble-arrow" d="M50 6 C30 10 14 24 12 46" />
            <path className="kiterp-scribble-arrow" d="M12 46 L6 34 M12 46 L24 42" />
          </svg>
          <svg className="hidden sm:block absolute -bottom-8 right-2 w-16 h-16 opacity-50" viewBox="0 0 60 60" fill="none" aria-hidden>
            <path className="kiterp-scribble-arrow" d="M10 8 C30 16 44 28 48 52" />
            <path className="kiterp-scribble-arrow" d="M48 52 L38 46 M48 52 L52 40" />
          </svg>

          {/* Full-width mosaic with the center faded out for the headline */}
          <MosaicGrid
            cells={DESKTOP_GRID}
            cycle={DESKTOP_CYCLE}
            delays={DESKTOP_DELAYS}
            className="hidden lg:grid grid-cols-11 gap-2.5 kiterp-mosaic-fullmask"
          />
          <MosaicGrid
            cells={MOBILE_GRID}
            cycle={MOBILE_CYCLE}
            delays={MOBILE_DELAYS}
            className="grid lg:hidden grid-cols-6 sm:grid-cols-8 gap-2 kiterp-mosaic-fullmask-sm"
          />

          {/* Centered headline floating over the mosaic */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4">
            <div className="text-center">
              <p className="font-kiterp-script text-3xl sm:text-5xl text-[#1e3d34] leading-tight drop-shadow-[0_2px_10px_rgba(255,255,255,0.95)]">
                Join <span className="text-[#64C3A0]">happy</span> vendors
              </p>
              <p className="mt-2 text-gray-700 text-sm sm:text-lg font-medium">
                who grow their business with KITERP
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
