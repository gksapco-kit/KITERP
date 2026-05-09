import { useEffect, useState } from 'react'
import { Calendar, Check, Clock } from 'lucide-react'
import { useStorefront, formatMoney } from '../StorefrontContext'
import { StorefrontShell } from '../components/StorefrontShell'
import { buildSurfaceStyle, type StorefrontConfig } from '../theming'
import { getTemplate } from '../templates'
import { useContentField } from '../editContext'
import type { ServiceItem, ServiceProvider } from '../types'
import { Button } from '@/components/ui/button'

const TEMPLATE_ID = 'services'

export const ServicesTemplate = ({ config, basePath = '/templates/services/preview' }: { config?: StorefrontConfig; basePath?: string }) => {
  const tpl = getTemplate(TEMPLATE_ID)!
  const preset = config?.preset ?? 'minimal'
  const style = buildSurfaceStyle(tpl, config?.brand)

  return (
    <div className="sf-surface" data-preset={preset} style={style}>
      <StorefrontShell
        storeName={config?.storeName ?? tpl.name}
        tagline={config?.tagline ?? tpl.tagline}
        basePath={basePath}
        nav={[
          { label: 'Services', to: `${basePath}#services` },
          { label: 'Team',     to: `${basePath}#team` },
          { label: 'Book',     to: `${basePath}#book` },
          { label: 'Visit',    to: `${basePath}#visit` },
        ]}
      >
        <ServicesHome />
      </StorefrontShell>
    </div>
  )
}

const SLOTS = ['09:30', '11:00', '12:30', '14:00', '15:30', '17:00']

const ServicesHome = () => {
  const { adapter, addToCart } = useStorefront()
  const [services, setServices] = useState<ServiceItem[]>([])
  const [providers, setProviders] = useState<ServiceProvider[]>([])
  const [selected, setSelected] = useState<ServiceItem | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const c = useContentField()

  useEffect(() => {
    adapter.listServices?.().then((s) => { setServices(s); setSelected(s[0] ?? null) })
    adapter.listProviders?.().then(setProviders)
  }, [adapter])

  return (
    <>
      {/* Hero */}
      <section data-edit-id="hero" className="px-6 sm:px-12 py-20 lg:py-28">
        <div className="max-w-5xl mx-auto text-center">
          <span className="text-[11px] uppercase tracking-[0.3em] opacity-70">
            {c('hero.badge', 'Bookings open · Spring')}
          </span>
          <h1 className="text-[clamp(1.75rem,4vw_+_0.5rem,2.75rem)] sm:text-[clamp(2.1rem,4.5vw_+_0.5rem,3.35rem)] md:text-[clamp(2.35rem,5vw_+_0.45rem,3.85rem)] lg:text-[clamp(2.65rem,5.5vw,4.5rem)] mt-4 mb-6 text-balance" style={{ fontFamily: 'var(--sf-display)' }}>
            {c('hero.line1', 'Care,')}{' '}
            <em className="italic font-normal" style={{ color: 'hsl(var(--sf-accent))' }}>
              {c('hero.line2', 'by appointment.')}
            </em>
          </h1>
          <p className="text-base opacity-80 max-w-xl mx-auto">
            {c('hero.subtitle', 'A small studio of stylists, colorists and barbers — with the time and tools to do it properly.')}
          </p>
          <div className="flex justify-center gap-3 mt-8">
            <Button size="lg" className="rounded-none h-12 px-7" style={{ background: 'hsl(var(--sf-primary))', color: 'hsl(var(--sf-primary-foreground))' }}>
              {c('hero.cta1', 'Book now')}
            </Button>
            <Button size="lg" variant="outline" className="rounded-none h-12 px-7 bg-transparent" style={{ borderColor: 'hsl(var(--sf-fg) / 0.5)', color: 'hsl(var(--sf-fg))' }}>
              {c('hero.cta2', 'See services')}
            </Button>
          </div>
        </div>
      </section>

      {/* Services list */}
      <section data-edit-id="services" className="border-t py-16 px-6 sm:px-12" style={{ borderColor: 'hsl(var(--sf-border))' }} id="services">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl mb-10" style={{ fontFamily: 'var(--sf-display)' }}>
            {c('services.heading', 'Services')}
          </h2>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-10">
            {services.map((s) => (
              <article key={s.id} className="flex gap-5 group">
                {s.image ? (
                  <div className="h-28 w-28 flex-shrink-0 overflow-hidden">
                    <img src={s.image.url} alt={s.image.alt} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                  </div>
                ) : null}
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-xl" style={{ fontFamily: 'var(--sf-display)' }}>{s.name}</h3>
                    <span className="text-base font-medium whitespace-nowrap">{formatMoney(s.price)}</span>
                  </div>
                  <p className="text-sm opacity-70 mt-1">{s.description}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs opacity-70">
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {s.durationMinutes} min</span>
                    <span>·</span>
                    <button onClick={() => setSelected(s)} className="underline">Book</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section data-edit-id="team" className="border-t py-16 px-6 sm:px-12" style={{ borderColor: 'hsl(var(--sf-border))', background: 'hsl(var(--sf-muted) / 0.4)' }} id="team">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl mb-10" style={{ fontFamily: 'var(--sf-display)' }}>
            {c('team.heading', 'The team')}
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {providers.map((p) => (
              <div key={p.id} className="text-center">
                {p.avatar ? (
                  <div className="aspect-square overflow-hidden mb-4 mx-auto max-w-[260px]">
                    <img src={p.avatar.url} alt={p.avatar.alt} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ) : null}
                <h3 className="text-xl" style={{ fontFamily: 'var(--sf-display)' }}>{p.name}</h3>
                <div className="text-xs uppercase tracking-[0.2em] opacity-70 mt-1 mb-2">{p.role}</div>
                <p className="text-sm opacity-70 max-w-xs mx-auto">{p.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Booking widget */}
      <section data-edit-id="booking" className="border-t py-16 px-6 sm:px-12" style={{ borderColor: 'hsl(var(--sf-border))' }} id="book">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl mb-2" style={{ fontFamily: 'var(--sf-display)' }}>
            {c('booking.heading', 'Book your slot')}
          </h2>
          <p className="opacity-70 mb-8 text-sm">
            {c('booking.subtitle', "Choose a service and a time — we'll confirm by SMS within minutes.")}
          </p>
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6 border" style={{ borderColor: 'hsl(var(--sf-border))' }}>
            <div className="p-6 border-r" style={{ borderColor: 'hsl(var(--sf-border))', background: 'hsl(var(--sf-muted) / 0.3)' }}>
              <div className="text-[11px] uppercase tracking-[0.18em] opacity-70 mb-3">Service</div>
              <ul className="space-y-2">
                {services.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => setSelected(s)} className="w-full text-left p-3 border flex items-center justify-between gap-3 transition-colors"
                      style={{
                        borderColor: 'hsl(var(--sf-border))',
                        background: selected?.id === s.id ? 'hsl(var(--sf-primary))' : 'hsl(var(--sf-bg))',
                        color: selected?.id === s.id ? 'hsl(var(--sf-primary-foreground))' : 'hsl(var(--sf-fg))',
                      }}>
                      <div className="flex flex-col">
                        <span className="text-sm">{s.name}</span>
                        <span className="text-[11px] opacity-70">{s.durationMinutes} min</span>
                      </div>
                      <span className="text-sm">{formatMoney(s.price)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6">
              <div className="text-[11px] uppercase tracking-[0.18em] opacity-70 mb-3 flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /> Available · Tomorrow</div>
              <div className="grid grid-cols-3 gap-2">
                {SLOTS.map((t) => (
                  <button key={t} onClick={() => setSlot(t)} className="py-3 border text-sm transition-colors"
                    style={{
                      borderColor: 'hsl(var(--sf-border))',
                      background: slot === t ? 'hsl(var(--sf-accent))' : 'hsl(var(--sf-bg))',
                      color: slot === t ? 'hsl(var(--sf-primary-foreground))' : 'hsl(var(--sf-fg))',
                    }}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="mt-6 p-4 border text-sm flex items-start gap-3" style={{ borderColor: 'hsl(var(--sf-border))', background: 'hsl(var(--sf-muted) / 0.4)' }}>
                <Check className="h-4 w-4 mt-0.5" style={{ color: 'hsl(var(--sf-accent))' }} />
                <div>
                  <div>{selected?.name ?? 'Select a service'} {slot ? `· ${slot}` : ''}</div>
                  <div className="text-xs opacity-70 mt-1">Free cancellation up to 24h before.</div>
                </div>
              </div>
              <Button className="w-full h-12 mt-4 rounded-none" style={{ background: 'hsl(var(--sf-primary))', color: 'hsl(var(--sf-primary-foreground))' }} disabled={!selected || !slot}
                onClick={() => {
                  if (!selected || !slot) return
                  addToCart({ productId: selected.id, variantId: `${selected.id}_slot`, quantity: 1, name: selected.name, variantLabel: slot, imageUrl: selected.image?.url, unitPrice: selected.price, inStock: true, durationMinutes: selected.durationMinutes })
                }}
              >
                {c('booking.confirm', 'Confirm booking')}
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
