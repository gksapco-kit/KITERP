import { Zap, Bot, Shield } from 'lucide-react'
import { LandingDemoVideo } from './LandingDemoVideo'

const PROPS = [
  {
    icon: Zap,
    title: 'Built for Speed & Productivity',
    body: 'Work smarter with lightning-fast performance, intelligent automation, and seamless workflows. Manage inventory, finance, sales, HR, and operations—all from a single platform.',
    accent: '#64C3A0',
  },
  {
    icon: Bot,
    title: 'AI Built Into Every Module',
    body: 'Leverage AI to automate routine tasks, generate insights, forecast trends, create content, analyze data, and make faster business decisions across every department.',
    accent: '#3d9a7a',
  },
  {
    icon: Shield,
    title: 'Enterprise Security & Scalability',
    body: 'Enterprise-grade security, role-based access, audit trails, and flexible deployment. Scale confidently from startups to global enterprises without changing platforms.',
    accent: '#52b38f',
  },
]

export function ValuePropSection() {
  return (
    <section className="pt-4 pb-16 sm:pt-6 sm:pb-24 kiterp-value-section scroll-mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <h2 className="font-kiterp-script text-3xl sm:text-4xl text-center leading-tight text-[#1e3d34] mb-8 sm:mb-10">
          Do More with Less Effort
          <br />
          <span className="text-[#64C3A0]">Work Faster. Work Smarter.</span>
        </h2>

        <LandingDemoVideo />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-8 mt-12 sm:mt-14">
          {PROPS.map((item) => {
            const Icon = item.icon
            return (
              <article key={item.title} className="kiterp-reveal kiterp-value-item">
                <h3 className="flex items-center gap-2.5 text-base sm:text-lg font-bold text-[#1e3d34] leading-snug">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${item.accent}18` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: item.accent }} strokeWidth={2} />
                  </span>
                  <span>{item.title}</span>
                </h3>
                <p className="mt-2.5 text-sm text-[#1e3d34]/65 leading-relaxed">{item.body}</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
