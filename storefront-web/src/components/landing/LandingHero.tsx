import { VENDOR_SIGNUP_PATH } from '@/lib/vendorSignupPaths'
import { vendorAppUrl } from '@/lib/appUrls'

export function LandingHero() {
  return (
    <section id="stores" className="relative kiterp-curve-bg overflow-hidden pt-10 pb-16 sm:pt-16 sm:pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center kiterp-reveal">
        <h1 className="font-kiterp-script text-[2rem] sm:text-5xl lg:text-[3.2rem] leading-[1.1] text-[#1e3d34]">
          Run your business, team, and website on{' '}
          <span className="kiterp-highlight">one KIT ERP platform.</span>
        </h1>

        <p className="mt-5 font-kiterp-script text-xl sm:text-2xl lg:text-3xl text-[#1e3d34]/90 max-w-3xl mx-auto">
          One Login, Yet Affordable, Scalable, ROI-Driven, and User-Friendly.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 sm:items-start">
          <div className="flex flex-col items-center gap-0.5">
            <a href={VENDOR_SIGNUP_PATH} className="kiterp-btn-primary px-7 py-3 text-base sm:text-lg">
              Get started
            </a>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-[#64C3A0]" aria-hidden>
              <path
                d="M4 20C4 20 2 12 8 9C14 6 10 2 18 2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <p className="kiterp-hand-note kiterp-hand-note--cta-subline">
              ₹0.00 / month for ALL apps
            </p>
          </div>
          <a
            href={`${vendorAppUrl}/login`}
            className="kiterp-btn-secondary px-7 py-3 text-base sm:text-lg"
          >
            Talk to us
          </a>
        </div>
      </div>
    </section>
  )
}
