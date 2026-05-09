/**
 * Notification sound hook — Web Audio API synthesiser + local file support.
 * No external audio files required for built-in tones.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToneName =
  | 'chime' | 'ding' | 'alert' | 'ping' | 'pop'
  | 'sunrise' | 'classic' | 'success' | 'warning' | 'digital' | 'notification'
  | 'local' | 'silent'

export interface ToneOption {
  value: ToneName
  label: string
  description: string
  category: 'standard' | 'classic' | 'special'
}

export const TONE_OPTIONS: ToneOption[] = [
  // Standard
  { value: 'chime',        label: 'Chime',         description: 'Soft C-E-G chord',          category: 'standard' },
  { value: 'ding',         label: 'Ding',           description: 'Classic single bell',        category: 'standard' },
  { value: 'ping',         label: 'Ping',           description: 'Quick high-pitched ping',    category: 'standard' },
  { value: 'pop',          label: 'Pop',            description: 'Subtle soft pop',            category: 'standard' },
  // Classic
  { value: 'classic',      label: 'Classic Bell',   description: 'Traditional phone bell',     category: 'classic' },
  { value: 'notification', label: 'Notification',   description: 'Standard notification beep', category: 'classic' },
  { value: 'alert',        label: 'Alert',          description: 'Double attention tone',      category: 'classic' },
  { value: 'digital',      label: 'Digital',        description: 'Electronic beep sequence',   category: 'classic' },
  // Special
  { value: 'sunrise',      label: 'Sunrise',        description: 'Gentle rising arpeggio',     category: 'special' },
  { value: 'success',      label: 'Success',        description: 'Ascending victory tone',     category: 'special' },
  { value: 'warning',      label: 'Warning',        description: 'Descending warning tone',    category: 'special' },
  // Local & silent
  { value: 'local',        label: 'Custom (Local)', description: 'Your uploaded ringtone',     category: 'special' },
  { value: 'silent',       label: 'Silent',         description: 'No sound',                   category: 'standard' },
]

export const TONE_CATEGORIES = [
  { key: 'standard', label: 'Standard' },
  { key: 'classic',  label: 'Classic' },
  { key: 'special',  label: 'Special' },
] as const

// ── Audio context (shared, lazy) ──────────────────────────────────────────────

let _ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!_ctx) {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      _ctx = new Ctor()
    } catch { return null }
  }
  return _ctx
}

function resume(ctx: AudioContext): Promise<void> {
  return ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()
}

// ── Primitive helpers ─────────────────────────────────────────────────────────

function sine(ctx: AudioContext, freq: number, start: number, duration: number, gain: number, type: OscillatorType = 'sine') {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(gain, start)
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration)
}

function glide(ctx: AudioContext, f0: number, f1: number, start: number, duration: number, gain: number) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(f0, start)
  osc.frequency.exponentialRampToValueAtTime(f1, start + duration)
  g.gain.setValueAtTime(gain, start)
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

// ── Tone synthesisers ─────────────────────────────────────────────────────────

function _chime(ctx: AudioContext, v: number, t: number) {
  sine(ctx, 523.25, t,        0.8, v * 0.5)
  sine(ctx, 659.25, t + 0.09, 0.7, v * 0.4)
  sine(ctx, 783.99, t + 0.18, 0.6, v * 0.35)
}

function _ding(ctx: AudioContext, v: number, t: number) {
  sine(ctx, 880, t, 1.1, v * 0.6)
  sine(ctx, 1760, t, 0.3, v * 0.15) // subtle overtone
}

function _ping(ctx: AudioContext, v: number, t: number) {
  sine(ctx, 1318.5, t, 0.3, v * 0.45)
}

function _pop(ctx: AudioContext, v: number, t: number) {
  glide(ctx, 180, 60, t, 0.1, v * 0.7)
}

function _alert(ctx: AudioContext, v: number, t: number) {
  sine(ctx, 1046.5, t,       0.14, v * 0.5)
  sine(ctx, 880,    t + 0.2, 0.14, v * 0.5)
}

function _classic(ctx: AudioContext, v: number, t: number) {
  // Alternating two-tone phone bell
  const pairs = [[480, 620], [480, 620]]
  pairs.forEach(([f1, f2], i) => {
    const base = t + i * 0.5
    sine(ctx, f1, base,        0.2, v * 0.4, 'square')
    sine(ctx, f2, base,        0.2, v * 0.3, 'square')
    sine(ctx, f1, base + 0.25, 0.2, v * 0.4, 'square')
    sine(ctx, f2, base + 0.25, 0.2, v * 0.3, 'square')
  })
}

function _notification(ctx: AudioContext, v: number, t: number) {
  // Gmail-style: two notes up
  sine(ctx, 783.99, t,       0.15, v * 0.5)
  sine(ctx, 1046.5, t + 0.16, 0.2, v * 0.45)
}

function _digital(ctx: AudioContext, v: number, t: number) {
  const freqs = [1200, 1000, 1400, 1200]
  freqs.forEach((f, i) => sine(ctx, f, t + i * 0.08, 0.06, v * 0.4, 'square'))
}

function _sunrise(ctx: AudioContext, v: number, t: number) {
  // Gentle C-major ascending arpeggio
  [261.63, 329.63, 392, 523.25, 659.25].forEach((f, i) =>
    sine(ctx, f, t + i * 0.14, 0.6, v * 0.35)
  )
}

function _success(ctx: AudioContext, v: number, t: number) {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    sine(ctx, f, t + i * 0.1, 0.5, v * 0.4)
  )
}

function _warning(ctx: AudioContext, v: number, t: number) {
  [880, 783.99, 698.46, 587.33].forEach((f, i) =>
    sine(ctx, f, t + i * 0.1, 0.45, v * 0.45)
  )
}

// ── Local ringtone (localStorage-backed, AudioContext-decoded) ───────────────

const LS_NAME = 'vendorLocalRingtoneName'
const LS_DATA = 'vendorLocalRingtoneData'

/** Cached decoded AudioBuffer for the local ringtone (cleared on new upload). */
let _localBuffer: AudioBuffer | null = null

export function getLocalRingtoneName(): string | null {
  return localStorage.getItem(LS_NAME)
}

export function clearLocalRingtone(): void {
  localStorage.removeItem(LS_NAME)
  localStorage.removeItem(LS_DATA)
  _localBuffer = null
}

/** Load a file from disk into localStorage as a data-URL. */
export function loadLocalRingtone(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      if (dataUrl.length > 5_000_000) {
        reject(new Error('File too large (max 5 MB)'))
        return
      }
      localStorage.setItem(LS_NAME, file.name)
      localStorage.setItem(LS_DATA, dataUrl)
      _localBuffer = null                          // invalidate cached buffer
      resolve()
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * Play the user-uploaded file via AudioContext (same path as synthesised tones,
 * so it works even when triggered by a polling timer with no user gesture).
 * Falls back to HTMLAudioElement if AudioContext is unavailable.
 */
async function _playLocal(volume: number): Promise<void> {
  const dataUrl = localStorage.getItem(LS_DATA)
  if (!dataUrl) return

  const ctx = getCtx()
  if (!ctx) {
    // Fallback: HTMLAudioElement
    const audio = new Audio(dataUrl)
    audio.volume = Math.max(0, Math.min(1, volume / 100))
    audio.play().catch(() => {})
    return
  }

  try {
    await resume(ctx)

    // Decode once and cache the AudioBuffer
    if (!_localBuffer) {
      const res = await fetch(dataUrl)
      const ab  = await res.arrayBuffer()
      _localBuffer = await ctx.decodeAudioData(ab)
    }

    const source = ctx.createBufferSource()
    const gain   = ctx.createGain()
    source.buffer       = _localBuffer
    gain.gain.value     = Math.max(0, Math.min(1, volume / 100))
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start()
  } catch {
    // Fallback when decoding fails
    const audio = new Audio(dataUrl)
    audio.volume = Math.max(0, Math.min(1, volume / 100))
    audio.play().catch(() => {})
  }
}

// ── Public: play a tone (single play) ────────────────────────────────────────

export function playTone(tone: ToneName, volume = 70): void {
  if (tone === 'silent') return
  if (tone === 'local') { void _playLocal(volume); return }

  const ctx = getCtx()
  if (!ctx) return
  const vol = Math.max(0, Math.min(100, volume)) / 100

  resume(ctx).then(() => {
    const t = ctx.currentTime
    switch (tone) {
      case 'chime':        _chime(ctx, vol, t);        break
      case 'ding':         _ding(ctx, vol, t);          break
      case 'ping':         _ping(ctx, vol, t);          break
      case 'pop':          _pop(ctx, vol, t);           break
      case 'alert':        _alert(ctx, vol, t);         break
      case 'classic':      _classic(ctx, vol, t);       break
      case 'notification': _notification(ctx, vol, t);  break
      case 'digital':      _digital(ctx, vol, t);       break
      case 'sunrise':      _sunrise(ctx, vol, t);       break
      case 'success':      _success(ctx, vol, t);       break
      case 'warning':      _warning(ctx, vol, t);       break
    }
  })
}

/**
 * Play a tone repeatedly for `durationSec` seconds.
 * Built-in tones are short (~0.5–1.5 s) so we schedule repeats every 1.5 s
 * until the requested duration is covered. For 1 s we play exactly once.
 */
export function playToneForDuration(tone: ToneName, volume = 70, durationSec = 3): void {
  if (tone === 'silent') return
  const PERIOD_MS = 1500
  const plays = Math.max(1, Math.round((durationSec * 1000) / PERIOD_MS))
  for (let i = 0; i < plays; i++) {
    if (i === 0) {
      playTone(tone, volume)
    } else {
      setTimeout(() => playTone(tone, volume), i * PERIOD_MS)
    }
  }
}

/** React hook */
export function useNotificationSound() {
  return { playTone, playToneForDuration, preview: playTone }
}
