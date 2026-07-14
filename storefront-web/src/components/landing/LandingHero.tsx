import { Link } from 'react-router-dom'
import { VENDOR_SIGNUP_PATH } from '@/lib/vendorSignupPaths'

export function LandingHero() {
  return (
    <section id="stores" className="relative kiterp-curve-bg overflow-hidden pt-10 pb-4 sm:pt-16 sm:pb-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center kiterp-reveal">
        <h1 className="font-kiterp-script text-[2rem] sm:text-5xl lg:text-[3.2rem] leading-[1.1] text-[#1e3d34]">
          Run your business, team, and website on{' '}
          <span className="kiterp-highlight">one KIT ERP platform.</span>
        </h1>

        <p className="mt-5 font-kiterp-script text-xl sm:text-2xl lg:text-3xl text-[#1e3d34]/90 max-w-3xl mx-auto">
          One Login, Yet Affordable, Scalable, ROI-Driven, and User-Friendly.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center sm:items-start justify-center gap-3 sm:gap-4">
          <div className="kiterp-hero-cta-primary">
            <a href={VENDOR_SIGNUP_PATH} className="kiterp-btn-primary px-7 py-3 text-base sm:text-lg">
              Get started
            </a>
            <div className="kiterp-hero-cta-note">
              <svg
                className="kiterp-hero-cta-arrow"
                viewBox="0 0 64 44"
                fill="none"
                aria-hidden
              >
                <path
                  className="kiterp-hero-cta-arrow-path"
                  d="M38 3 C30 9 22 17 16 27 C12 33 10 37 8 41"
                />
                <path className="kiterp-hero-cta-arrow-path" d="M8 41 L2 35" />
                <path className="kiterp-hero-cta-arrow-path" d="M8 41 L14 39" />
              </svg>
              <div className="kiterp-hero-cta-pricing-wrap">
                <div className="kiterp-hero-cta-pricing">
                  <span className="kiterp-hero-cta-price-line">₹0.00 / month</span>
                  <span className="kiterp-hero-cta-price-line kiterp-hero-cta-price-line--sub">
                    for ALL apps
                  </span>
                </div>
              </div>
            </div>
          </div>
          <Link
            to="/contact"
            className="kiterp-btn-secondary px-7 py-3 text-base sm:text-lg sm:mt-0"
          >
            Talk to us
          </Link>
        </div>
      </div>
    </section>
  )
}
