import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { LANDING_APPS } from './landingData'
import { ImagineToggle } from './ImagineToggle'

export function AppsGridSection() {
  const [showCompetitors, setShowCompetitors] = useState(false)

  return (
    <section id="apps" className="py-14 sm:py-20 bg-[#eef9f4]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
          {LANDING_APPS.map((app, i) => {
            const Icon = app.icon
            return (
              <div
                key={app.id}
                className="kiterp-app-tile relative flex flex-col items-center text-center group"
                style={{ animationDelay: `${Math.min(i * 35, 700)}ms` }}
              >
                {showCompetitors && app.competitor && (
                  <span
                    className="absolute -top-2 left-1/2 -translate-x-1/2 kiterp-hand-note text-sm whitespace-nowrap z-10 pointer-events-none"
                    style={{ transform: 'translateX(-50%) rotate(-4deg)' }}
                  >
                    {app.competitor}
                  </span>
                )}
                <div className="kiterp-app-icon w-full aspect-square max-w-[88px] mx-auto bg-white rounded-2xl shadow-sm border border-white flex items-center justify-center p-4">
                  <Icon className="w-9 h-9 sm:w-10 sm:h-10" style={{ color: app.color }} strokeWidth={1.75} />
                </div>
                <p className="mt-2 text-[11px] sm:text-xs font-medium text-gray-600 leading-tight px-1">
                  {app.label}
                </p>
              </div>
            )
          })}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <ImagineToggle
            on={showCompetitors}
            onToggle={() => setShowCompetitors((v) => !v)}
          />

          <a
            href="#pricing"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#64C3A0] hover:gap-2.5 transition-all"
          >
            View all Apps <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="mt-14 max-w-3xl mx-auto text-center">
          <p className="text-lg sm:text-xl text-gray-700 leading-relaxed">
            <strong>Imagine a vast collection of business apps at your disposal.</strong>
            <br className="hidden sm:block" />
            {' '}Got something to improve? There is an app for that.
            <br />
            No complexity, no cost, just a one-click install.
          </p>
          <p className="mt-4 text-gray-500">
            Each app simplifies a process and empowers more people.
            Imagine the impact when everyone gets the right tool for the job.
          </p>
          <p className="mt-6 font-kiterp-script text-2xl text-[#1e3d34]/80 italic">
            If you simplify everything, you can do anything!
          </p>
        </div>
      </div>
    </section>
  )
}
