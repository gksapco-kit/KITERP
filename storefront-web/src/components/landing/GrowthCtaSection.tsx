import { VENDOR_SIGNUP_PATH } from '@/lib/vendorSignupPaths'

function SparkleBurst() {
  const rays = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * 360
    return (
      <line
        key={i}
        x1="50" y1="50"
        x2={50 + 38 * Math.cos((angle * Math.PI) / 180)}
        y2={50 + 38 * Math.sin((angle * Math.PI) / 180)}
        stroke="#ffc954"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    )
  })

  return (
    <svg
      viewBox="0 0 100 100"
      className="kiterp-sparkle-burst w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-6"
      aria-hidden
    >
      {rays}
      <path d="M72 18 C74 14 78 14 80 18 C82 14 86 14 88 18 C86 22 82 22 80 18 C78 22 74 22 72 18 Z" fill="#ffc954" />
      <path d="M18 62 C20 58 24 58 26 62 C28 58 32 58 34 62 C32 66 28 66 26 62 C24 66 20 66 18 62 Z" fill="#ffc954" />
    </svg>
  )
}

export function GrowthCtaSection() {
  return (
    <section id="pricing" className="py-20 sm:py-28 bg-white text-center">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 kiterp-reveal">
        <SparkleBurst />

        <h2 className="font-kiterp-script text-[2rem] sm:text-4xl lg:text-5xl leading-tight">
          <span className="text-[#1e3d34]">One login</span>
          <br />
          <span className="text-[#64C3A0]">every app you need</span>
        </h2>

        <a
          href={VENDOR_SIGNUP_PATH}
          className="kiterp-btn-primary inline-block mt-8 px-8 py-3.5 text-base sm:text-lg"
        >
          Create your account
        </a>

        <div className="mt-5 flex flex-col items-center gap-1">
          <svg width="20" height="24" viewBox="0 0 20 24" className="text-[#64C3A0]" aria-hidden>
            <path d="M10 22 L10 4 M4 10 L10 4 L16 10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-xs sm:text-sm text-gray-500">Free to start · All modules included</p>
        </div>
      </div>
    </section>
  )
}
