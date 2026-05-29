export const COUNTDOWN_TIMER_DEFAULTS = {
  countdownLayout: 'cards' as const,
  countdownTheme: 'premium' as const,
  showCountdownDays: true,
  showCountdownHours: true,
  showCountdownMinutes: true,
  showCountdownSeconds: true,
  countdownExpiredText: 'This offer has ended',
  countdownDayLabel: 'Days',
  countdownHourLabel: 'Hours',
  countdownMinuteLabel: 'Minutes',
  countdownSecondLabel: 'Seconds',
}

function defaultTargetDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 14)
  date.setHours(23, 59, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function defaultCountdownTimerProps() {
  return {
    text: 'Sale ends soon',
    subtitle: 'Grab your favorites before the clock runs out',
    countdownTargetDate: defaultTargetDate(),
    buttonText: 'Shop the sale',
    buttonLink: '#products',
    ...COUNTDOWN_TIMER_DEFAULTS,
  }
}

export interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
}

export function getCountdownParts(targetIso: string, now = Date.now()): CountdownParts {
  const target = new Date(targetIso).getTime()
  if (Number.isNaN(target)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  }

  const diff = target - now
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  }
}

export function padCountdown(value: number): string {
  return String(value).padStart(2, '0')
}
