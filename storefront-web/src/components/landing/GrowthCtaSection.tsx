import { Check, HardDrive, Package, Users, X } from 'lucide-react'
import { PLAN_FEATURES, saasSignupHref } from '@/components/landing/saasPlans'
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

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6 text-left">
          {plans.map((plan) => (
            <article
              key={plan.slug}
              className={`relative flex h-full flex-col rounded-2xl border bg-white/90 p-6 shadow-sm backdrop-blur-sm ${
                plan.featured
                  ? 'border-[#64C3A0] ring-2 ring-[#64C3A0]/35 shadow-md'
                  : 'border-[#1e3d34]/10'
              }`}
            >
              {plan.featured ? (
                <span className="absolute -top-3 left-5 rounded-full bg-[#64C3A0] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                  Popular
                </span>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-[#1e3d34]">{plan.name}</h3>
                  <p className="mt-0.5 text-sm font-medium text-[#3d8f72]">{plan.appsLabel}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-[#1e3d34]">{plan.priceLabel}</div>
                  <div className="text-xs text-[#1e3d34]/50">/ month</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-[#1e3d34]/65 leading-relaxed">{plan.blurb}</p>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-[#1e3d34]/40">
                Plan details
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {PLAN_FEATURES.map(([key, label]) => {
                  const enabled = Boolean(plan.features[key])
                  return (
                    <li
                      key={key}
                      className={`flex min-w-0 items-center gap-1.5 text-[13px] leading-none ${
                        enabled ? 'font-medium text-[#1e3d34]' : 'text-[#1e3d34]/35'
                      }`}
                    >
                      {enabled ? (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#64C3A0]/20">
                          <Check className="h-2.5 w-2.5 text-[#1e7a5c]" aria-hidden />
                        </span>
                      ) : (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1e3d34]/10">
                          <X className="h-2.5 w-2.5 text-[#1e3d34]/35" aria-hidden />
                        </span>
                      )}
                      <span className="truncate">{label}</span>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-4 grid grid-cols-3 divide-x divide-[#1e3d34]/10 rounded-xl border border-[#1e3d34]/10 bg-[#f7fbf9]">
                {[
                  { icon: Package, value: plan.productsLabel, label: 'Products' },
                  { icon: Users, value: plan.teamLabel, label: 'Team' },
                  { icon: HardDrive, value: plan.storageLabel, label: 'Storage' },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-center gap-1.5 px-1 py-2">
                    <stat.icon className="h-3.5 w-3.5 shrink-0 text-[#1e3d34]/40" aria-hidden />
                    <div className="min-w-0 leading-none">
                      <p className="truncate text-xs font-semibold text-[#1e3d34]">{stat.value}</p>
                      <p className="mt-0.5 text-[10px] text-[#1e3d34]/50">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
              <a
                href={saasSignupHref(plan.slug)}
                className={`kiterp-btn-primary mt-6 inline-flex w-full items-center justify-center px-5 py-3 text-sm sm:text-base ${
                  plan.featured ? '' : 'opacity-95'
                }`}
              >
                {plan.cta}
              </a>
            </article>
          ))}
        </div>

        <p className="mt-8 text-xs sm:text-sm text-[#1e3d34]/55 font-medium">
          Secure checkout with Razorpay · Cancel or upgrade anytime from Billing &amp; Plans
        </p>
      </div>
    </section>
  )
}
