import { Link } from 'react-router-dom'
import { KiterpHighlight } from '@/components/landing/KiterpHighlight'
import { VENDOR_SIGNUP_PATH } from '@/lib/vendorSignupPaths'

export function LandingHero() {
  return (
    <section id="stores" className="relative kiterp-hero overflow-x-hidden pt-8 pb-6 sm:pt-14 sm:pb-8">
      <div className="kiterp-hero-atmosphere" aria-hidden>
        <span className="kiterp-hero-blob kiterp-hero-blob--a" />
        <span className="kiterp-hero-blob kiterp-hero-blob--b" />
        <span className="kiterp-hero-blob kiterp-hero-blob--c" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center kiterp-reveal">
        <h1 className="font-kiterp-script text-[2.05rem] sm:text-5xl lg:text-[3.25rem] leading-[1.12] text-[#1e3d34]">
          Run your business, team, and website on{' '}
          <KiterpHighlight>one KIT ERP platform.</KiterpHighlight>
        </h1>

        <p className="kiterp-hero-sub">
          One login —{' '}
          <span className="kiterp-hero-sub-em">
            affordable
            <svg className="kiterp-hero-sub-em-line" viewBox="0 0 100 8" aria-hidden>
              <path
                className="kiterp-hero-sub-em-path"
                d="M2 5.5c15-3 30-4 50-2.5 15 1.5 30 2 46 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                pathLength={1}
              />
            </svg>
          </span>
          , scalable, ROI-driven, and built for everyday teams.
        </p>

        <div className="kiterp-hero-cta">
          <div className="kiterp-hero-cta-cluster">
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

            <svg className="kiterp-hero-price-arrow" viewBox="0 0 112 64" fill="none" aria-hidden>
              <path
                className="kiterp-hero-price-arrow-curve"
                d="M8 7 C38 10 67 28 91 49"
                pathLength={1}
              />
              <path
                className="kiterp-hero-price-arrow-head"
                d="M81.5 47 L91 49 L87 39.5"
              />
            </svg>

            <div
              className="kiterp-hero-price-annotation"
              aria-label="Nine hundred ninety-nine rupees per month for all apps"
            >
              <p className="kiterp-hero-price-note-copy">
                <span className="kiterp-hero-price-note-line">999.00 Rs / month</span>
                <span className="kiterp-hero-price-note-scope">for ALL apps</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
