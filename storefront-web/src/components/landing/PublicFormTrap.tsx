import { useEffect, useRef, useState } from 'react'
import { apiClient } from '@/api/client'

type Protection = {
  captcha?: 'turnstile' | null
  site_key?: string | null
  required?: boolean
}

type TrapState = {
  hpWebsite: string
  formStartedAt: number
  captchaToken: string
}

export function emptyTrapState(): TrapState {
  return { hpWebsite: '', formStartedAt: Date.now(), captchaToken: '' }
}

type Props = {
  value: TrapState
  onChange: (patch: Partial<TrapState>) => void
}

export function PublicFormTrap({ value, onChange }: Props) {
  const [siteKey, setSiteKey] = useState('')
  const widgetRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<Protection>('/catalog/form-protection')
      .then((res) => {
        if (cancelled) return
        const key = (res.data.site_key || '').trim()
        if (res.data.captcha === 'turnstile' && key) setSiteKey(key)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!siteKey || !widgetRef.current) return
    const w = window as Window & {
      turnstile?: {
        render: (el: HTMLElement, opts: Record<string, unknown>) => string
        remove: (id: string) => void
      }
    }
    let widgetId = ''
    const render = () => {
      if (!widgetRef.current || !w.turnstile) return
      widgetId = w.turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onChange({ captchaToken: token }),
        'expired-callback': () => onChange({ captchaToken: '' }),
      })
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-kiterp-turnstile]')
    if (w.turnstile) {
      render()
    } else if (existing) {
      existing.addEventListener('load', render, { once: true })
    } else {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.dataset.kiterpTurnstile = '1'
      script.addEventListener('load', render, { once: true })
      document.head.appendChild(script)
    }
    return () => {
      if (widgetId && w.turnstile) w.turnstile.remove(widgetId)
    }
  }, [siteKey])

  return (
    <>
      <div
        className="kiterp-hp"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}
      >
        <label>
          Website
          <input
            type="text"
            name="hp_website"
            tabIndex={-1}
            autoComplete="off"
            value={value.hpWebsite}
            onChange={(e) => onChange({ hpWebsite: e.target.value })}
          />
        </label>
      </div>
      {siteKey ? <div className="kiterp-turnstile" ref={widgetRef} /> : null}
    </>
  )
}

export function trapPayload(trap: TrapState) {
  return {
    hp_website: trap.hpWebsite,
    form_started_at: trap.formStartedAt,
    captcha_token: trap.captchaToken || undefined,
  }
}
