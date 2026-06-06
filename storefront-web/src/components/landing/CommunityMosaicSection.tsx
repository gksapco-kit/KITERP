import { MOSAIC_AVATARS } from './landingData'

type MosaicCell = {
  kind: 'avatar' | 'shape'
  shape?: 'rounded' | 'circle' | 'leaf-tl' | 'leaf-br'
  tone?: 'plum' | 'gray'
  avatarIdx?: number
}

const GRID: MosaicCell[] = [
  { kind: 'shape', shape: 'rounded', tone: 'gray' },
  { kind: 'avatar', shape: 'circle', avatarIdx: 0 },
  { kind: 'shape', shape: 'leaf-tl', tone: 'plum' },
  { kind: 'avatar', shape: 'rounded', avatarIdx: 1 },
  { kind: 'shape', shape: 'circle', tone: 'gray' },
  { kind: 'avatar', shape: 'leaf-br', avatarIdx: 2 },
  { kind: 'avatar', shape: 'rounded', avatarIdx: 3 },
  { kind: 'shape', shape: 'leaf-tl', tone: 'gray' },
  { kind: 'avatar', shape: 'circle', avatarIdx: 4 },
  { kind: 'shape', shape: 'rounded', tone: 'plum' },
  { kind: 'avatar', shape: 'leaf-br', avatarIdx: 5 },
  { kind: 'shape', shape: 'circle', tone: 'gray' },
  { kind: 'avatar', shape: 'rounded', avatarIdx: 6 },
  { kind: 'shape', shape: 'leaf-tl', tone: 'plum' },
  { kind: 'avatar', shape: 'circle', avatarIdx: 7 },
  { kind: 'shape', shape: 'rounded', tone: 'gray' },
]

function MosaicCellView({ cell }: { cell: MosaicCell }) {
  const shape = cell.shape ?? 'rounded'
  const classes = ['odoo-mosaic-shape w-full h-full', shape, cell.tone].filter(Boolean).join(' ')

  if (cell.kind === 'shape') {
    return <div className={classes} />
  }

  const av = MOSAIC_AVATARS[cell.avatarIdx ?? 0]
  return (
    <div className={`${classes} flex items-center justify-center text-white font-bold text-lg`} style={{ background: av.bg }}>
      {av.initials}
    </div>
  )
}

export function CommunityMosaicSection() {
  return (
    <section className="py-16 sm:py-20 bg-[#eef9f4] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="relative flex flex-col lg:flex-row items-center gap-10 lg:gap-6">
          {/* Left mosaic — hidden on small screens */}
          <div className="hidden lg:grid grid-cols-4 gap-2 w-[280px] shrink-0 opacity-90 [mask-image:linear-gradient(to_right,transparent,black_30%)]">
            {GRID.slice(0, 8).map((cell, i) => (
              <div key={i} className="aspect-square w-16">
                <MosaicCellView cell={cell} />
              </div>
            ))}
          </div>

          <div className="relative z-10 flex-1 text-center max-w-xl mx-auto">
            <div className="inline-block bg-white rounded-full px-8 sm:px-12 py-8 sm:py-10 shadow-xl shadow-[#64C3A0]/12 border border-[#64C3A0]/15">
              <p className="font-odoo-script text-3xl sm:text-4xl text-[#1e3d34] leading-tight">
                Join <span className="text-[#64C3A0]">happy</span> vendors
              </p>
              <p className="mt-2 text-gray-600 text-sm sm:text-base">
                who grow their business with KITERP
              </p>
            </div>
          </div>

          {/* Right mosaic */}
          <div className="hidden lg:grid grid-cols-4 gap-2 w-[280px] shrink-0 opacity-90 [mask-image:linear-gradient(to_left,transparent,black_30%)]">
            {GRID.slice(8).map((cell, i) => (
              <div key={i} className="aspect-square w-16">
                <MosaicCellView cell={cell} />
              </div>
            ))}
          </div>

          {/* Mobile simplified mosaic ring */}
          <div className="lg:hidden grid grid-cols-5 gap-1.5 max-w-sm mx-auto w-full opacity-80">
            {GRID.slice(0, 10).map((cell, i) => (
              <div key={i} className="aspect-square">
                <MosaicCellView cell={cell} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
