import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileText,
  Heart,
  Lightbulb,
  Loader2,
  TrendingUp,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { PlatformAnalyticsBeacon } from '@/components/landing/PlatformAnalyticsBeacon'
import '@/styles/kiterp-landing.css'

const ACCEPTED_CV = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const ACCEPTED_PHOTO = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'
const MAX_CV_BYTES = 10 * 1024 * 1024
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const HERO_IMAGE = '/images/careers-hero.png?v=8'

type FormState = {
  first_name: string
  last_name: string
  email: string
  phone: string
  company: string
  experience_years: string
  city: string
  cover_note: string
}

const CAREER_VALUES = [
  {
    title: 'People First',
    description: 'We value people, ideas and collaboration.',
    Icon: Users,
  },
  {
    title: 'Grow Together',
    description: 'Learn, grow and achieve more every day.',
    Icon: TrendingUp,
  },
  {
    title: 'Make an Impact',
    description: 'Solve real problems and create lasting impact.',
    Icon: Lightbulb,
  },
  {
    title: 'Work & Wellbeing',
    description: 'We support balance, wellness and flexibility.',
    Icon: Heart,
  },
] as const

const EMPTY_FORM: FormState = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  company: '',
  experience_years: '',
  city: '',
  cover_note: '',
}

export default function Careers() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [cv, setCv] = useState<File | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [cvDrag, setCvDrag] = useState(false)
  const [photoDrag, setPhotoDrag] = useState(false)
  const [sending, setSending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const cvRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const pickCv = (file: File | null | undefined) => {
    if (!file) return
    const name = file.name.toLowerCase()
    const okExt = name.endsWith('.pdf') || name.endsWith('.doc') || name.endsWith('.docx')
    if (!okExt) {
      toast.error('Please upload a PDF or Word CV (.pdf, .doc, .docx)')
      return
    }
    if (file.size > MAX_CV_BYTES) {
      toast.error('CV must be 10 MB or smaller')
      return
    }
    setCv(file)
  }

  const pickPhoto = (file: File | null | undefined) => {
    if (!file) return
    const name = file.name.toLowerCase()
    const okExt =
      name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp')
    const okType = file.type.startsWith('image/')
    if (!okExt && !okType) {
      toast.error('Passport photo must be JPG, PNG, or WebP')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error('Passport photo must be 5 MB or smaller')
      return
    }
    setPhoto(file)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const first = form.first_name.trim()
    const last = form.last_name.trim()
    if (!first) {
      toast.error('Please enter your first name')
      return
    }
    if (!last) {
      toast.error('Please enter your last name')
      return
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error('Please enter a valid email')
      return
    }

    const body = new FormData()
    body.append('full_name', `${first} ${last}`)
    body.append('email', form.email.trim())
    if (form.phone.trim()) body.append('phone', form.phone.trim())
    if (form.company.trim()) body.append('college', form.company.trim())
    if (form.experience_years.trim()) body.append('graduation_year', form.experience_years.trim())
    if (form.city.trim()) body.append('city', form.city.trim())
    if (form.cover_note.trim()) body.append('cover_note', form.cover_note.trim())
    if (cv) body.append('cv', cv)
    if (photo) body.append('photo', photo)

    setSending(true)
    try {
      const res = await apiClient.post<{ message?: string }>('/catalog/career-applications', body)
      toast.success(res.data.message || 'Application submitted!')
      setForm(EMPTY_FORM)
      setCv(null)
      setPhoto(null)
      setSubmitted(true)
      if (cvRef.current) cvRef.current.value = ''
      if (photoRef.current) photoRef.current.value = ''
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      let message = 'Failed to submit application'
      if (typeof detail === 'string') {
        message = detail
      } else if (Array.isArray(detail)) {
        message = detail
          .map((item) => {
            if (item && typeof item === 'object' && 'msg' in item) return String((item as { msg: unknown }).msg)
            return String(item)
          })
          .filter(Boolean)
          .join(' · ')
      }
      toast.error(message || 'Failed to submit application')
    } finally {
      setSending(false)
    }
  }

  const dropClass = (active: boolean, filled: boolean) =>
    `kiterp-careers-drop${active ? ' kiterp-careers-drop--active' : ''}${filled ? ' kiterp-careers-drop--filled' : ''}`

  return (
    <div className="kiterp-landing kiterp-careers-page font-kiterp-body">
      <PlatformAnalyticsBeacon />
      <div className="kiterp-careers-glow" aria-hidden />
      <LandingHeader />

      <main className="kiterp-careers-main">
        <div className="kiterp-careers-shell kiterp-reveal">
          <aside className="kiterp-careers-brand" aria-label="KIT ERP careers">
            <div className="kiterp-careers-brand-top">
              <h1 className="kiterp-careers-brand-title">
                Join the team, shape the{' '}
                <span className="kiterp-careers-brand-accent">
                  future.
                  <svg className="kiterp-careers-brand-underline" viewBox="0 0 120 12" aria-hidden>
                    <path
                      d="M2 8c18-4 36-5 56-3 18 2 36 3 50 1"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>
              <p className="kiterp-careers-brand-lead">
                Passionate about excellence? Join a global family that&apos;s building smarter
                solutions for tomorrow.
              </p>

              <ul className="kiterp-careers-values">
                {CAREER_VALUES.map(({ title, description, Icon }) => (
                  <li key={title} className="kiterp-careers-value">
                    <span className="kiterp-careers-value-icon" aria-hidden>
                      <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
                    </span>
                    <span>
                      <span className="kiterp-careers-value-title">{title}</span>
                      <span className="kiterp-careers-value-desc">{description}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="kiterp-careers-visual">
              <div className="kiterp-careers-visual-frame">
                <img src={HERO_IMAGE} alt="KIT ERP team partnership" />
              </div>
            </div>
          </aside>

          <section className="kiterp-careers-form" aria-labelledby="careers-form-title">
            {submitted ? (
              <div className="kiterp-careers-success">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--kiterp-mint-bg)] text-[var(--kiterp-primary-deeper)]">
                  <CheckCircle2 className="w-6 h-6" />
                </span>
                <h2 className="mt-3 text-lg font-bold text-[var(--kiterp-ink)]">Application received</h2>
                <p className="mt-1.5 max-w-sm text-sm text-[color-mix(in_srgb,var(--kiterp-ink)_55%,transparent)]">
                  Thanks — we will review your profile and get in touch if there is a fit.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="kiterp-btn-primary mt-4 inline-flex items-center justify-center rounded-full px-5 py-2 text-sm"
                >
                  Submit another
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate>
                <div className="kiterp-careers-form-head">
                  <Link to="/" className="kiterp-careers-back">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Home
                  </Link>
                  <h2 id="careers-form-title" className="kiterp-careers-form-title">
                    Application
                  </h2>
                </div>

                <div className="kiterp-careers-fields">
                  <label className="kiterp-careers-field">
                    <span>First name *</span>
                    <input
                      value={form.first_name}
                      onChange={(e) => setField('first_name', e.target.value)}
                      placeholder="First name"
                      autoComplete="given-name"
                      required
                    />
                  </label>
                  <label className="kiterp-careers-field">
                    <span>Last name *</span>
                    <input
                      value={form.last_name}
                      onChange={(e) => setField('last_name', e.target.value)}
                      placeholder="Last name"
                      autoComplete="family-name"
                      required
                    />
                  </label>

                  <label className="kiterp-careers-field">
                    <span>Email *</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setField('email', e.target.value)}
                      placeholder="you@email.com"
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label className="kiterp-careers-field">
                    <span>Phone</span>
                    <input
                      value={form.phone}
                      onChange={(e) => setField('phone', e.target.value)}
                      placeholder="Mobile"
                      autoComplete="tel"
                    />
                  </label>

                  <label className="kiterp-careers-field">
                    <span>City</span>
                    <input
                      value={form.city}
                      onChange={(e) => setField('city', e.target.value)}
                      placeholder="Your city"
                      autoComplete="address-level2"
                    />
                  </label>
                  <label className="kiterp-careers-field">
                    <span>Experience (yrs)</span>
                    <input
                      value={form.experience_years}
                      onChange={(e) => setField('experience_years', e.target.value.replace(/\D/g, '').slice(0, 2))}
                      placeholder="e.g. 3"
                      inputMode="numeric"
                    />
                  </label>

                  <label className="kiterp-careers-field kiterp-careers-field--full">
                    <span>Company / Organization</span>
                    <input
                      value={form.company}
                      onChange={(e) => setField('company', e.target.value)}
                      placeholder="Current or previous"
                    />
                  </label>

                  <label className="kiterp-careers-field kiterp-careers-field--full">
                    <span>About you</span>
                    <input
                      value={form.cover_note}
                      onChange={(e) => setField('cover_note', e.target.value)}
                      placeholder="Why would you like to join KIT ERP?"
                      maxLength={4000}
                    />
                  </label>

                  <div className="kiterp-careers-uploads">
                    <div className="kiterp-careers-field">
                      <span>Passport photo</span>
                      <input
                        ref={photoRef}
                        type="file"
                        accept={ACCEPTED_PHOTO}
                        className="sr-only"
                        onChange={(e) => pickPhoto(e.target.files?.[0])}
                      />
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => photoRef.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            photoRef.current?.click()
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setPhotoDrag(true)
                        }}
                        onDragLeave={() => setPhotoDrag(false)}
                        onDrop={(e) => {
                          e.preventDefault()
                          setPhotoDrag(false)
                          pickPhoto(e.dataTransfer.files?.[0])
                        }}
                        className={dropClass(photoDrag, Boolean(photo))}
                      >
                        {photo && photoPreview ? (
                          <>
                            <img
                              src={photoPreview}
                              alt="Passport preview"
                              className="h-8 w-7 shrink-0 rounded object-cover ring-1 ring-[color-mix(in_srgb,var(--kiterp-ink)_12%,transparent)]"
                            />
                            <span className="min-w-0 flex-1 text-left">
                              <span className="block text-[12px] font-semibold text-[var(--kiterp-ink)] truncate">
                                {photo.name}
                              </span>
                            </span>
                            <button
                              type="button"
                              className="shrink-0 p-0.5 text-[color-mix(in_srgb,var(--kiterp-ink)_35%,transparent)] hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                setPhoto(null)
                                if (photoRef.current) photoRef.current.value = ''
                              }}
                              aria-label="Remove photo"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4 shrink-0 text-[var(--kiterp-primary)]" />
                            <span className="text-[12px] font-semibold text-[var(--kiterp-ink)]">Photo</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="kiterp-careers-field">
                      <span>Upload CV</span>
                      <input
                        ref={cvRef}
                        type="file"
                        accept={ACCEPTED_CV}
                        className="sr-only"
                        onChange={(e) => pickCv(e.target.files?.[0])}
                      />
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => cvRef.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            cvRef.current?.click()
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          setCvDrag(true)
                        }}
                        onDragLeave={() => setCvDrag(false)}
                        onDrop={(e) => {
                          e.preventDefault()
                          setCvDrag(false)
                          pickCv(e.dataTransfer.files?.[0])
                        }}
                        className={dropClass(cvDrag, Boolean(cv))}
                      >
                        {cv ? (
                          <>
                            <FileText className="w-4 h-4 shrink-0 text-[var(--kiterp-primary-deeper)]" />
                            <span className="min-w-0 flex-1 text-left">
                              <span className="block text-[12px] font-semibold text-[var(--kiterp-ink)] truncate">
                                {cv.name}
                              </span>
                            </span>
                            <button
                              type="button"
                              className="shrink-0 p-0.5 text-[color-mix(in_srgb,var(--kiterp-ink)_35%,transparent)] hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                setCv(null)
                                if (cvRef.current) cvRef.current.value = ''
                              }}
                              aria-label="Remove CV"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 shrink-0 text-[var(--kiterp-primary)]" />
                            <span className="min-w-0 truncate text-[12px] font-semibold text-[var(--kiterp-ink)]">
                              Drop CV or browse · PDF, DOC, DOCX
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="kiterp-btn-primary kiterp-careers-submit"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {sending ? 'Submitting…' : 'Submit application'}
                </button>
              </form>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
