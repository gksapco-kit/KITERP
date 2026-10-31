import { Check } from 'lucide-react'
import { saasSignupHref } from '@/components/landing/saasPlans'
import { usePublicSaasPlans } from '@/components/landing/usePublicSaasPlans'

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
  const { plans } = usePublicSaasPlans()
  return (
    <section id="pricing" className="py-20 sm:py-28 kiterp-growth-cta text-center">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 kiterp-reveal">
        <SparkleBurst />

        <h2 className="font-kiterp-script text-[2rem] sm:text-4xl lg:text-5xl leading-tight">
          <span className="text-[#1e3d34]">Simple plans</span>
          <br />
          <span className="text-[#64C3A0]">pay for the apps you need</span>
        </h2>
        <p className="mt-4 max-w-2xl mx-auto text-sm sm:text-base text-[#1e3d34]/70">
          My Kit is always included. Install more sidebar apps up to your plan limit —
          upgrade anytime when you need more modules.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 md:items-stretch text-left">
          {plans.map((plan) => {
            const appsText = plan.appsLabel.replace(/^My Kit \+ /, '')
            const highlights = [
              'My Kit workspace always included',
              appsText.toLowerCase() === 'all apps' ? 'Access to all apps' : `Install ${appsText}`,
              'Upgrade or cancel anytime',
            ]
            return (
              <article
                key={plan.slug}
                className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-white p-7 transition-all duration-300 hover:-translate-y-1 ${
                  plan.featured
                    ? 'border-[#64C3A0] shadow-[0_18px_50px_-18px_rgba(100,195,160,0.55)] ring-2 ring-[#64C3A0]/40 md:scale-[1.03]'
                    : 'border-[#1e3d34]/10 shadow-sm hover:shadow-lg'
                }`}
              >
                {plan.featured ? (
                  <>
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#64C3A0]/15 to-transparent" />
                    <span className="absolute right-5 top-5 rounded-full bg-[#64C3A0] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
                      Most popular
                    </span>
                  </>
                ) : null}

                <div className="relative">
                  <h3 className="text-xl font-semibold text-[#1e3d34]">{plan.name}</h3>
                  <span className="mt-2 inline-flex items-center rounded-full bg-[#64C3A0]/15 px-3 py-1 text-xs font-semibold text-[#2f7d5f]">
                    {plan.appsLabel}
                  </span>

                  <div className="mt-6 flex items-baseline gap-1.5">
                    <span className="text-5xl font-bold tracking-tight text-[#1e3d34]">{plan.priceLabel}</span>
                    <span className="text-sm font-medium text-[#1e3d34]/50">/ month</span>
                  </div>
                  <p className="mt-3 min-h-[2.75rem] text-sm leading-relaxed text-[#1e3d34]/65">{plan.blurb}</p>
                </div>

                <ul className="relative mb-8 mt-5 space-y-3 border-t border-[#1e3d34]/10 pt-5">
                  {highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-[#1e3d34]/80">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#64C3A0]/20">
                        <Check className="h-3 w-3 text-[#1e7a5c]" aria-hidden />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={saasSignupHref(plan.slug)}
                  className={`kiterp-btn-primary relative mt-auto inline-flex w-full items-center justify-center px-5 py-3 text-sm sm:text-base ${
                    plan.featured ? '' : 'opacity-95'
                  }`}
                >
                  {plan.cta}
                </a>
              </article>
            )
          })}
        </div>
        <p className="mt-8 text-xs sm:text-sm text-[#1e3d34]/55 font-medium">
          Secure checkout with Razorpay · Cancel or upgrade anytime from Billing &amp; Plans
        </p>
      </div>
    </section>
  )
}
