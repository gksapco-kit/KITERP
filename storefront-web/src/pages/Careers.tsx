import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Upload,
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
const HERO_IMAGE = '/images/careers-hero.png?v=4'

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

const fieldClass =
  'w-full rounded-md border border-[#1e3d34]/10 bg-[#fafbfb] px-2 py-1 text-[12.5px] text-[#1e3d34] placeholder:text-[#1e3d34]/35 outline-none transition focus:border-[#64C3A0] focus:bg-white focus:ring-2 focus:ring-[#64C3A0]/12'

const labelClass = 'mb-0.5 block text-[9px] font-semibold uppercase tracking-wide text-[#1e3d34]/40'

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
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
    if (!cv) {
      toast.error('Please upload your CV')
      return
    }
    if (!photo) {
      toast.error('Please upload a passport size photo')
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
    body.append('cv', cv)
    body.append('photo', photo)

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
      toast.error(typeof detail === 'string' ? detail : 'Failed to submit application')
    } finally {
      setSending(false)
    }
  }

  const dropZone = (active: boolean, filled: boolean) =>
    `flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed px-2 transition ${
      active
        ? 'border-[#64C3A0] bg-[#eef9f4]'
        : filled
          ? 'border-[#64C3A0]/45 bg-[#f3faf7]'
          : 'border-[#1e3d34]/12 bg-[#fafbfb] hover:border-[#64C3A0]/45 hover:bg-[#f3faf7]'
    }`

  return (
    <div className="kiterp-landing font-kiterp-body h-dvh overflow-hidden flex flex-col bg-white">
      <PlatformAnalyticsBeacon />
      <LandingHeader />

      <main className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-stretch overflow-hidden">
        {/* Smaller image panel — banner on small screens, ~40% width on lg+ */}
        <aside
          className="relative w-full shrink-0 overflow-hidden bg-[#dfe8e4]
            aspect-[2.4/1] max-h-[22svh] sm:aspect-[2.6/1] sm:max-h-[24svh] md:max-h-[26svh]
            lg:aspect-auto lg:max-h-none lg:h-full lg:min-h-0
            lg:rounded-br-[clamp(2rem,6vw,4rem)]"
          aria-label="Team collaboration at KIT ERP"
        >
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${HERO_IMAGE})` }}
            role="img"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white via-white/50 to-transparent lg:hidden"
            aria-hidden
          />
        </aside>

        <section className="flex-1 min-h-0 overflow-hidden flex flex-col justify-center px-4 py-2.5 sm:px-7 sm:py-3 lg:px-8 xl:px-12 bg-white">
          <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1e3d34]/40 hover:text-[#1e3d34] transition"
            >
              <ArrowLeft className="w-3 h-3" />
              Home
            </Link>
            <p className="inline-flex items-center gap-1 rounded-full bg-[#eef9f4] px-2 py-0.5 text-[9px] font-semibold tracking-wide text-[#3d9a7a] uppercase">
              <Sparkles className="w-3 h-3" />
              Careers
            </p>
          </div>

          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-[#1e3d34] leading-tight">
            Join the KIT ERP team
          </h1>
          <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-[12px] text-[#1e3d34]/50 leading-snug">
            Details, passport photo, and CV — open to everyone.
          </p>

          <div className="mt-2 sm:mt-3">
            {submitted ? (
              <div className="flex flex-col items-center text-center py-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef9f4] text-[#3d9a7a]">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
                <h3 className="mt-2.5 text-base font-bold text-[#1e3d34]">Application received</h3>
                <p className="mt-1 max-w-xs text-[12px] text-[#1e3d34]/55">
                  Thanks — we will review your profile and get in touch if there is a fit.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-3 inline-flex items-center justify-center rounded-md bg-[#64C3A0] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#52b38f] transition"
                >
                  Submit another
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1.5">
                  <div className="col-span-2 sm:col-span-3 grid grid-cols-2 gap-x-2">
                    <label className="block">
                      <span className={labelClass}>First name *</span>
                      <input
                        className={fieldClass}
                        value={form.first_name}
                        onChange={(e) => setField('first_name', e.target.value)}
                        placeholder="First name"
                        autoComplete="given-name"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className={labelClass}>Last name *</span>
                      <input
                        className={fieldClass}
                        value={form.last_name}
                        onChange={(e) => setField('last_name', e.target.value)}
                        placeholder="Last name"
                        autoComplete="family-name"
                        required
                      />
                    </label>
                  </div>

                  <label className="block col-span-2 sm:col-span-1">
                    <span className={labelClass}>Email *</span>
                    <input
                      type="email"
                      className={fieldClass}
                      value={form.email}
                      onChange={(e) => setField('email', e.target.value)}
                      placeholder="you@email.com"
                      autoComplete="email"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Phone</span>
                    <input
                      className={fieldClass}
                      value={form.phone}
                      onChange={(e) => setField('phone', e.target.value)}
                      placeholder="Mobile"
                      autoComplete="tel"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>City</span>
                    <input
                      className={fieldClass}
                      value={form.city}
                      onChange={(e) => setField('city', e.target.value)}
                      placeholder="Your city"
                      autoComplete="address-level2"
                    />
                  </label>

                  <label className="block col-span-2">
                    <span className={labelClass}>Company / Organization</span>
                    <input
                      className={fieldClass}
                      value={form.company}
                      onChange={(e) => setField('company', e.target.value)}
                      placeholder="Current or previous"
                    />
                  </label>

                  <label className="block">
                    <span className={labelClass}>Experience (yrs)</span>
                    <input
                      className={fieldClass}
                      value={form.experience_years}
                      onChange={(e) => setField('experience_years', e.target.value.replace(/\D/g, '').slice(0, 2))}
                      placeholder="e.g. 3"
                      inputMode="numeric"
                    />
                  </label>

                  <label className="block col-span-2 sm:col-span-3">
                    <span className={labelClass}>About you</span>
                    <input
                      className={fieldClass}
                      value={form.cover_note}
                      onChange={(e) => setField('cover_note', e.target.value)}
                      placeholder="Why would you like to join KIT ERP?"
                      maxLength={4000}
                    />
                  </label>

                  <div className="block col-span-1">
                    <span className={labelClass}>Passport photo *</span>
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
                      className={dropZone(photoDrag, Boolean(photo))}
                    >
                      {photo && photoPreview ? (
                        <>
                          <img
                            src={photoPreview}
                            alt="Passport preview"
                            className="h-7 w-6 shrink-0 rounded object-cover ring-1 ring-[#1e3d34]/10"
                          />
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block text-[11px] font-semibold text-[#1e3d34] truncate">{photo.name}</span>
                          </span>
                          <button
                            type="button"
                            className="shrink-0 p-0.5 text-[#1e3d34]/35 hover:text-red-600"
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
                          <Camera className="w-3.5 h-3.5 shrink-0 text-[#64C3A0]" />
                          <span className="text-[11px] font-semibold text-[#1e3d34]">Photo</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="block col-span-1 sm:col-span-2">
                    <span className={labelClass}>Upload CV *</span>
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
                      className={dropZone(cvDrag, Boolean(cv))}
                    >
                      {cv ? (
                        <>
                          <FileText className="w-3.5 h-3.5 shrink-0 text-[#3d9a7a]" />
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block text-[11px] font-semibold text-[#1e3d34] truncate">{cv.name}</span>
                          </span>
                          <button
                            type="button"
                            className="shrink-0 p-0.5 text-[#1e3d34]/35 hover:text-red-600"
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
                          <Upload className="w-3.5 h-3.5 shrink-0 text-[#64C3A0]" />
                          <span className="text-left min-w-0">
                            <span className="block text-[11px] font-semibold text-[#1e3d34]">Drop CV or browse</span>
                            <span className="block text-[10px] text-[#1e3d34]/40">PDF, DOC, DOCX</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#64C3A0] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#52b38f] disabled:opacity-60 transition"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {sending ? 'Submitting…' : 'Submit application'}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
