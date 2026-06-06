import { Zap, Sparkles, Shield, BadgeIndianRupee } from 'lucide-react'
import { LandingDemoVideo } from './LandingDemoVideo'

const PROPS = [
  {
    icon: Zap,
    title: 'Optimized for productivity',
    body: 'Experience true speed — smart workflows, live inventory, and a fast UI. Operations done in less than 90ms.',
    accent: '#64C3A0',
  },
  {
    icon: Sparkles,
    title: 'Native AI across your business',
    body: 'Automate work, tailor storefronts, perform deep research, and scale without limits.',
    accent: '#3d9a7a',
  },
  {
    icon: Shield,
    title: 'Enterprise software, done right',
    body: 'Open platform with vendor-owned data. No lock-in — host on our cloud or your infrastructure.',
    accent: '#52b38f',
  },
  {
    icon: BadgeIndianRupee,
    title: 'Fair pricing',
    body: 'No usage-based surprises. One simple price per vendor — products, services, HR, and storefront included.',
    accent: '#ffc954',
  },
]

export function ValuePropSection() {
  return (
    <section className="py-16 sm:py-24 bg-white scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="font-kiterp-script text-3xl sm:text-4xl text-center text-[#1e3d34] mb-8 sm:mb-10">
          Level up your quality of work
        </h2>

        <LandingDemoVideo />

        <div className="grid sm:grid-cols-2 gap-8 lg:gap-12 mt-14 sm:mt-16">
          {PROPS.map((item) => (
            <article key={item.title} className="flex gap-5 kiterp-reveal">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${item.accent}18` }}
              >
                <item.icon className="w-6 h-6" style={{ color: item.accent }} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1e3d34]">{item.title}</h3>
                <p className="mt-2 text-sm sm:text-base text-gray-600 leading-relaxed">{item.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
