import { Link } from 'react-router-dom'
import { VENDOR_SIGNUP_PATH } from '@/lib/vendorSignupPaths'

export function LandingHero() {
  return (
    <section id="stores" className="relative kiterp-hero overflow-hidden pt-8 pb-6 sm:pt-14 sm:pb-8">
      <div className="kiterp-hero-atmosphere" aria-hidden>
        <span className="kiterp-hero-blob kiterp-hero-blob--a" />
        <span className="kiterp-hero-blob kiterp-hero-blob--b" />
        <span className="kiterp-hero-blob kiterp-hero-blob--c" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center kiterp-reveal">
        <h1 className="font-kiterp-script text-[2.05rem] sm:text-5xl lg:text-[3.25rem] leading-[1.12] text-[#1e3d34]">
          Run your business, team, and website on{' '}
          <span className="kiterp-highlight">one KIT ERP platform.</span>
        </h1>

        <p className="kiterp-hero-sub">
          One login — affordable, scalable, ROI-driven, and built for everyday teams.
        </p>

        <div className="kiterp-hero-cta-row">
          <div
            className="kiterp-hero-cta-offer"
            aria-label="Nine hundred ninety-nine rupees per month for all apps"
          >
            <div className="kiterp-hero-cta-pricing-wrap">
              <p className="kiterp-hero-cta-pricing">
                <span className="kiterp-hero-cta-amount">₹999</span>
                <span className="kiterp-hero-cta-period">/ month</span>
                <span className="kiterp-hero-cta-scope">for ALL apps</span>
              </p>
            </div>
            <svg
              className="kiterp-hero-cta-arrow"
              viewBox="0 0 56 36"
              fill="none"
              aria-hidden
            >
              <path
                className="kiterp-hero-cta-arrow-path"
                d="M4 18 C14 10 24 7 38 10 C44 11 49 14 52 17"
              />
              <path className="kiterp-hero-cta-arrow-path" d="M52 17 L46 12" />
              <path className="kiterp-hero-cta-arrow-path" d="M52 17 L47 23" />
            </svg>
          </div>

          <div className="kiterp-hero-cta-actions">
            <a href={VENDOR_SIGNUP_PATH} className="kiterp-btn-primary px-7 py-3 text-base sm:text-lg">
              Get started
            </a>
            <Link
              to="/contact"
              className="kiterp-btn-secondary px-7 py-3 text-base sm:text-lg"
            >
              Talk to us
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
