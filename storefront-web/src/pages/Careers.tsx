import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  GraduationCap,
  Heart,
  HeartPulse,
  IndianRupee,
  Laptop,
  Lightbulb,
  Linkedin,
  Loader2,
  MapPin,
  Search,
  Share2,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/api/client'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { PlatformAnalyticsBeacon } from '@/components/landing/PlatformAnalyticsBeacon'
import '@/styles/kiterp-landing.css'

const ACCEPTED_CV =
  '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const ACCEPTED_PHOTO = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'
const MAX_CV_BYTES = 10 * 1024 * 1024
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const WHY_JOIN_IMAGE = '/images/careers-why-join.png?v=4'
const SAVED_JOBS_KEY = 'kiterp-careers-saved'

type CareerOpening = {
  id: string
  title: string
  department?: string | null
  designation?: string | null
  employment_type: string
  employment_type_label: string
  location?: string | null
  openings: number
  salary_min?: number | null
  salary_max?: number | null
  description?: string | null
  requirements?: string | null
  benefits?: string | null
  posted_at?: string | null
}

type FormState = {
  first_name: string
  last_name: string
  email: string
  phone: string
  city: string
  experience_years: string
  company: string
  current_role: string
  skills: string
  linkedin: string
  portfolio: string
  cover_note: string
}

const WHY_JOIN = [
  { title: 'Great Culture', description: 'People who care about craft.', Icon: Users },
  { title: 'Competitive Pay', description: 'Pay aligned with impact.', Icon: IndianRupee },
  { title: 'Career Growth', description: 'Mentorship and clear paths.', Icon: TrendingUp },
  { title: 'Health Benefits', description: 'Cover for you and family.', Icon: HeartPulse },
  { title: 'Flexible Work', description: 'Hybrid-friendly rhythms.', Icon: Laptop },
  { title: 'Learning Budget', description: 'Courses and tools to grow.', Icon: GraduationCap },
] as const

const HIRING_STEPS = [
  { step: '01', title: 'Apply', detail: 'Submit your profile for an open role.' },
  { step: '02', title: 'HR Screening', detail: 'We review fit and schedule a short call.' },
  { step: '03', title: 'Technical Interview', detail: 'Deep dive into skills and problem-solving.' },
  { step: '04', title: 'Manager Round', detail: 'Meet the team and discuss how you work.' },
  { step: '05', title: 'Offer', detail: 'Receive an offer and join the KIT ERP family.' },
] as const

const FAQS = [
  {
    q: 'How long does hiring take?',
    a: 'Most roles move from application to offer in 2–4 weeks, depending on interview rounds and scheduling.',
  },
  {
    q: 'Can I work remotely?',
    a: 'Many roles support hybrid or remote setups. Check each job card for location and work-mode details.',
  },
  {
    q: 'Are internships available?',
    a: 'Yes — when internship openings are posted they appear under Current Openings with type Internship.',
  },
  {
    q: 'What happens after I apply?',
    a: 'You will get a confirmation toast and email when available. Our HR team reviews applications and contacts shortlisted candidates.',
  },
] as const

const EMPTY_FORM: FormState = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  city: '',
  experience_years: '',
  company: '',
  current_role: '',
  skills: '',
  linkedin: '',
  portfolio: '',
  cover_note: '',
}

function formatSalary(min?: number | null, max?: number | null): string | null {
  if (min == null && max == null) return null
  const fmt = (n: number) => {
    if (n >= 100000) {
      const lpa = n / 100000
      return `₹${lpa % 1 === 0 ? lpa.toFixed(0) : lpa.toFixed(1)} LPA`
    }
    return `₹${n.toLocaleString('en-IN')}`
  }
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`
  if (min != null) return `From ${fmt(min)}`
  return `Up to ${fmt(max!)}`
}

function skillTags(requirements?: string | null): string[] {
  if (!requirements?.trim()) return []
  return requirements
    .split(/[\n,•|/;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 28)
    .slice(0, 5)
}

function isRemoteLocation(location?: string | null): boolean {
  if (!location) return false
  return /remote|hybrid|wfh|work from home/i.test(location)
}

function loadSavedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SAVED_JOBS_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
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
  const [openings, setOpenings] = useState<CareerOpening[]>([])
  const [openingsLoading, setOpeningsLoading] = useState(true)
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [detailJobId, setDetailJobId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [locFilter, setLocFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [savedIds, setSavedIds] = useState<Set<string>>(() => loadSavedIds())
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [heroSearch, setHeroSearch] = useState('')
  const cvRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const openingsRef = useRef<HTMLElement>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setOpeningsLoading(true)
      try {
        const res = await apiClient.get<{ items: CareerOpening[] }>('/catalog/career-openings')
        if (cancelled) return
        setOpenings(res.data.items ?? [])
      } catch {
        if (!cancelled) setOpenings([])
      } finally {
        if (!cancelled) setOpeningsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  useEffect(() => {
    if (!showForm) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowForm(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [showForm])

  const departments = useMemo(
    () =>
      Array.from(new Set(openings.map((j) => j.department).filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b),
      ),
    [openings],
  )

  const locations = useMemo(
    () =>
      Array.from(new Set(openings.map((j) => j.location).filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b),
      ),
    [openings],
  )

  const employmentTypes = useMemo(
    () =>
      Array.from(
        new Map(openings.map((j) => [j.employment_type, j.employment_type_label])).entries(),
      ).map(([value, label]) => ({ value, label })),
    [openings],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return openings.filter((job) => {
      if (deptFilter && job.department !== deptFilter) return false
      if (locFilter && job.location !== locFilter) return false
      if (typeFilter && job.employment_type !== typeFilter) return false
      if (!q) return true
      const hay = [
        job.title,
        job.department,
        job.designation,
        job.location,
        job.employment_type_label,
        job.description,
        job.requirements,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [openings, query, deptFilter, locFilter, typeFilter])

  const selectedJob = openings.find((j) => j.id === selectedJobId) ?? null
  const detailJob = openings.find((j) => j.id === detailJobId) ?? null
  const totalOpenSlots = openings.reduce((sum, j) => sum + (j.openings || 1), 0)

  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const persistSaved = (next: Set<string>) => {
    setSavedIds(next)
    localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify([...next]))
  }

  const toggleSave = (jobId: string) => {
    const next = new Set(savedIds)
    if (next.has(jobId)) {
      next.delete(jobId)
      toast.message('Removed from saved jobs')
    } else {
      next.add(jobId)
      toast.success('Job saved')
    }
    persistSaved(next)
  }

  const shareJob = async (job: CareerOpening) => {
    const url = `${window.location.origin}/careers#job-${job.id}`
    const text = `${job.title}${job.location ? ` · ${job.location}` : ''} at KIT ERP`
    try {
      if (navigator.share) {
        await navigator.share({ title: job.title, text, url })
        return
      }
    } catch {
      /* user cancelled */
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Job link copied')
    } catch {
      toast.error('Could not share this job')
    }
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
      toast.error('Photograph must be JPG, PNG, or WebP')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error('Photograph must be 5 MB or smaller')
      return
    }
    setPhoto(file)
  }

  const scrollToOpenings = (search?: string) => {
    if (search != null) setQuery(search)
    openingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const startApply = (jobId: string) => {
    setSelectedJobId(jobId)
    setShowForm(true)
    setSubmitted(false)
    setDetailJobId(null)
  }

  const startGeneralApply = () => {
    setSelectedJobId('')
    setShowForm(true)
    setSubmitted(false)
  }

  const closeForm = () => {
    setShowForm(false)
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
    if (openings.length > 0 && !selectedJobId) {
      toast.error('Please select an open position to apply for')
      return
    }

    const aboutParts: string[] = []
    if (form.skills.trim()) aboutParts.push(`Skills: ${form.skills.trim()}`)
    if (form.portfolio.trim()) aboutParts.push(`Portfolio: ${form.portfolio.trim()}`)
    if (form.cover_note.trim()) aboutParts.push(form.cover_note.trim())
    const cover = aboutParts.join('\n\n')

    const body = new FormData()
    body.append('full_name', `${first} ${last}`)
    body.append('email', form.email.trim())
    if (form.phone.trim()) body.append('phone', form.phone.trim())
    if (form.company.trim()) body.append('college', form.company.trim())
    if (form.current_role.trim()) body.append('course', form.current_role.trim())
    if (form.experience_years.trim()) body.append('graduation_year', form.experience_years.trim())
    if (form.city.trim()) body.append('city', form.city.trim())
    if (form.skills.trim()) body.append('skills', form.skills.trim())
    if (form.linkedin.trim()) body.append('linkedin_url', form.linkedin.trim())
    if (cover) body.append('cover_note', cover)
    if (selectedJobId) body.append('job_posting_id', selectedJobId)
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

      <main>
        {/* Hero: brand + search left, team image right */}
        <section className="kiterp-careers-hero" aria-labelledby="careers-hero-title">
          <div className="kiterp-careers-hero-split">
            <div className="kiterp-careers-hero-copy kiterp-reveal">
              <h1 id="careers-hero-title" className="kiterp-careers-hero-title">
                Join the team, shape the{' '}
                <span className="kiterp-careers-hero-accent">
                  future.
                  <svg className="kiterp-careers-hero-underline" viewBox="0 0 120 12" aria-hidden>
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
              <p className="kiterp-careers-hero-lead">
                Build commerce, HR, and storefront products used by real businesses every day.
              </p>

              <form
                className="kiterp-careers-hero-search"
                onSubmit={(e) => {
                  e.preventDefault()
                  scrollToOpenings(heroSearch)
                }}
              >
                <Search className="kiterp-careers-hero-search-icon" aria-hidden />
                <input
                  value={heroSearch}
                  onChange={(e) => setHeroSearch(e.target.value)}
                  placeholder="Search jobs by title, skill, or city…"
                  aria-label="Search jobs"
                />
                <button type="submit" className="kiterp-btn-primary kiterp-careers-hero-search-btn">
                  Search
                </button>
              </form>

              <div className="kiterp-careers-hero-meta">
                <span className="kiterp-careers-stat">
                  <Sparkles className="w-4 h-4" aria-hidden />
                  <strong>{openingsLoading ? '…' : openings.length || 0}</strong>
                  {' '}open roles
                  {!openingsLoading && totalOpenSlots > openings.length ? (
                    <span className="kiterp-careers-stat-sub"> · {totalOpenSlots} seats</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="kiterp-careers-hero-cta"
                  onClick={() => scrollToOpenings()}
                >
                  View openings
                </button>
              </div>
            </div>

            <figure className="kiterp-careers-hero-visual kiterp-reveal">
              <img
                src={WHY_JOIN_IMAGE}
                alt="KIT ERP team collaborating in a modern office"
                width={1600}
                height={1067}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            </figure>
          </div>
        </section>

        {/* Why join — compact strip, no heavy cards */}
        <section className="kiterp-careers-section kiterp-careers-section--why" aria-labelledby="why-join-title">
          <div className="kiterp-careers-container">
            <header className="kiterp-careers-why-head">
              <div>
                <p className="kiterp-careers-eyebrow">Why join us</p>
                <h2 id="why-join-title">Work that compounds</h2>
              </div>
            </header>
            <ul className="kiterp-careers-why-strip">
              {WHY_JOIN.map(({ title, description, Icon }) => (
                <li key={title}>
                  <span className="kiterp-careers-why-icon" aria-hidden>
                    <Icon className="w-4 h-4" strokeWidth={2.25} />
                  </span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Openings */}
        <section
          ref={openingsRef}
          id="openings"
          className="kiterp-careers-section kiterp-careers-section--openings"
          aria-labelledby="openings-title"
        >
          <div className="kiterp-careers-container">
            <header className="kiterp-careers-section-head kiterp-careers-section-head--row">
              <div>
                <p className="kiterp-careers-eyebrow">Current openings</p>
                <h2 id="openings-title">Find your next role</h2>
                <p>Filter by department, location, or employment type — then apply in one click.</p>
              </div>
              {!openingsLoading && openings.length > 0 ? (
                <button type="button" className="kiterp-careers-ghost-btn" onClick={startGeneralApply}>
                  General application
                </button>
              ) : null}
            </header>

            <div className="kiterp-careers-filters">
              <label className="kiterp-careers-filter-search">
                <Search className="w-4 h-4" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search jobs…"
                  aria-label="Filter jobs by keyword"
                />
              </label>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                aria-label="Department"
              >
                <option value="">Department</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={locFilter}
                onChange={(e) => setLocFilter(e.target.value)}
                aria-label="Location"
              >
                <option value="">Location</option>
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Job type"
              >
                <option value="">Job type</option>
                {employmentTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {openingsLoading ? (
              <div className="kiterp-careers-openings-empty">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--kiterp-primary)]" />
                <p>Loading openings…</p>
              </div>
            ) : openings.length === 0 ? (
              <div className="kiterp-careers-openings-empty">
                <Briefcase className="w-8 h-8 text-[color-mix(in_srgb,var(--kiterp-ink)_28%,transparent)]" />
                <p>No open positions right now.</p>
                <button type="button" className="kiterp-btn-primary mt-3" onClick={startGeneralApply}>
                  Send a general application
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="kiterp-careers-openings-empty">
                <Search className="w-7 h-7 text-[color-mix(in_srgb,var(--kiterp-ink)_28%,transparent)]" />
                <p>No roles match your filters.</p>
                <button
                  type="button"
                  className="kiterp-careers-ghost-btn mt-2"
                  onClick={() => {
                    setQuery('')
                    setDeptFilter('')
                    setLocFilter('')
                    setTypeFilter('')
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <ul className="kiterp-careers-job-grid">
                {filtered.map((job) => {
                  const salary = formatSalary(job.salary_min, job.salary_max)
                  const tags = skillTags(job.requirements)
                  const remote = isRemoteLocation(job.location)
                  const saved = savedIds.has(job.id)
                  return (
                    <li key={job.id} id={`job-${job.id}`} className="kiterp-careers-job-card">
                      <div className="kiterp-careers-job-top">
                        <div className="min-w-0">
                          <div className="kiterp-careers-job-tags">
                            {remote ? <span className="kiterp-careers-chip kiterp-careers-chip--mint">Remote</span> : null}
                            {job.posted_at &&
                            Date.now() - new Date(job.posted_at).getTime() < 14 * 86400000 ? (
                              <span className="kiterp-careers-chip kiterp-careers-chip--new">New</span>
                            ) : null}
                            {job.openings > 1 ? (
                              <span className="kiterp-careers-chip">{job.openings} openings</span>
                            ) : null}
                          </div>
                          <h3 className="kiterp-careers-job-title">{job.title}</h3>
                        </div>
                        <div className="kiterp-careers-job-actions-icon">
                          <button
                            type="button"
                            aria-label={saved ? 'Unsave job' : 'Save job'}
                            className={saved ? 'is-active' : undefined}
                            onClick={() => toggleSave(job.id)}
                          >
                            <Heart className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} />
                          </button>
                          <button type="button" aria-label="Share job" onClick={() => void shareJob(job)}>
                            <Share2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <ul className="kiterp-careers-job-meta">
                        {job.location ? (
                          <li>
                            <MapPin className="w-3.5 h-3.5" aria-hidden />
                            {job.location}
                          </li>
                        ) : null}
                        <li>
                          <Briefcase className="w-3.5 h-3.5" aria-hidden />
                          {job.employment_type_label}
                        </li>
                        {job.department ? (
                          <li>
                            <Building2 className="w-3.5 h-3.5" aria-hidden />
                            {job.department}
                          </li>
                        ) : null}
                        {job.designation ? (
                          <li>
                            <Lightbulb className="w-3.5 h-3.5" aria-hidden />
                            {job.designation}
                          </li>
                        ) : null}
                        {salary ? (
                          <li>
                            <IndianRupee className="w-3.5 h-3.5" aria-hidden />
                            {salary}
                          </li>
                        ) : null}
                      </ul>

                      {tags.length ? (
                        <ul className="kiterp-careers-skill-row">
                          {tags.map((tag) => (
                            <li key={tag}>{tag}</li>
                          ))}
                        </ul>
                      ) : null}

                      <div className="kiterp-careers-job-footer">
                        <button
                          type="button"
                          className="kiterp-careers-secondary-btn"
                          onClick={() => setDetailJobId(job.id)}
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          className="kiterp-btn-primary kiterp-careers-apply-btn"
                          onClick={() => startApply(job.id)}
                        >
                          Apply Now
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Hiring process */}
        <section className="kiterp-careers-section" aria-labelledby="process-title">
          <div className="kiterp-careers-container">
            <header className="kiterp-careers-section-head">
              <p className="kiterp-careers-eyebrow">Hiring process</p>
              <h2 id="process-title">What happens after you apply</h2>
              <p>A clear, respectful process — no black-hole applications.</p>
            </header>
            <ol className="kiterp-careers-process">
              {HIRING_STEPS.map((item, idx) => (
                <li key={item.step} className="kiterp-careers-process-step">
                  <span className="kiterp-careers-process-num">{item.step}</span>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                  {idx < HIRING_STEPS.length - 1 ? (
                    <span className="kiterp-careers-process-connector" aria-hidden />
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section className="kiterp-careers-section" aria-labelledby="faq-title">
          <div className="kiterp-careers-container kiterp-careers-faq-wrap">
            <header className="kiterp-careers-section-head">
              <p className="kiterp-careers-eyebrow">FAQ</p>
              <h2 id="faq-title">Common questions</h2>
            </header>
            <ul className="kiterp-careers-faq">
              {FAQS.map((item, i) => {
                const open = openFaq === i
                return (
                  <li key={item.q}>
                    <button
                      type="button"
                      className={`kiterp-careers-faq-btn${open ? ' is-open' : ''}`}
                      aria-expanded={open}
                      onClick={() => setOpenFaq(open ? null : i)}
                    >
                      <span>{item.q}</span>
                      <ChevronDown className="w-4 h-4" aria-hidden />
                    </button>
                    {open ? <p className="kiterp-careers-faq-answer">{item.a}</p> : null}
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      </main>

      <LandingFooter />

      {/* Job details dialog */}
      {detailJob ? (
        <div
          className="kiterp-careers-overlay"
          role="presentation"
          onClick={() => setDetailJobId(null)}
        >
          <div
            className="kiterp-careers-drawer kiterp-careers-drawer--detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="kiterp-careers-drawer-close"
              aria-label="Close"
              onClick={() => setDetailJobId(null)}
            >
              <X className="w-5 h-5" />
            </button>
            <p className="kiterp-careers-eyebrow">Role details</p>
            <h2 id="job-detail-title">{detailJob.title}</h2>
            <ul className="kiterp-careers-job-meta kiterp-careers-job-meta--detail">
              {detailJob.location ? (
                <li>
                  <MapPin className="w-3.5 h-3.5" />
                  {detailJob.location}
                </li>
              ) : null}
              <li>
                <Briefcase className="w-3.5 h-3.5" />
                {detailJob.employment_type_label}
              </li>
              {detailJob.department ? (
                <li>
                  <Building2 className="w-3.5 h-3.5" />
                  {detailJob.department}
                </li>
              ) : null}
              {formatSalary(detailJob.salary_min, detailJob.salary_max) ? (
                <li>
                  <IndianRupee className="w-3.5 h-3.5" />
                  {formatSalary(detailJob.salary_min, detailJob.salary_max)}
                </li>
              ) : null}
              {detailJob.posted_at ? (
                <li>
                  <Clock className="w-3.5 h-3.5" />
                  Posted {new Date(detailJob.posted_at).toLocaleDateString()}
                </li>
              ) : null}
            </ul>
            {detailJob.description ? (
              <div className="kiterp-careers-detail-block">
                <h3>About the role</h3>
                <p>{detailJob.description}</p>
              </div>
            ) : null}
            {detailJob.requirements ? (
              <div className="kiterp-careers-detail-block">
                <h3>Requirements</h3>
                <p>{detailJob.requirements}</p>
              </div>
            ) : null}
            {detailJob.benefits ? (
              <div className="kiterp-careers-detail-block">
                <h3>Benefits</h3>
                <p>{detailJob.benefits}</p>
              </div>
            ) : null}
            <button
              type="button"
              className="kiterp-btn-primary kiterp-careers-submit"
              onClick={() => startApply(detailJob.id)}
            >
              Apply for this role
            </button>
          </div>
        </div>
      ) : null}

      {/* Application drawer / modal */}
      {showForm ? (
        <div className="kiterp-careers-overlay" role="presentation" onClick={closeForm}>
          <div
            className="kiterp-careers-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="careers-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="kiterp-careers-drawer-close"
              aria-label="Close application form"
              onClick={closeForm}
            >
              <X className="w-5 h-5" />
            </button>

            {submitted ? (
              <div className="kiterp-careers-success">
                <span className="kiterp-careers-success-icon">
                  <CheckCircle2 className="w-7 h-7" />
                </span>
                <h2>Application received</h2>
                <p>
                  Thanks — we will review your profile
                  {selectedJob ? ` for ${selectedJob.title}` : ''} and get in touch if there is a fit.
                </p>
                <p className="kiterp-careers-success-next">
                  Next: HR screening → technical interview → manager round → offer.
                </p>
                <div className="kiterp-careers-success-actions">
                  <button
                    type="button"
                    className="kiterp-btn-primary"
                    onClick={() => {
                      setSubmitted(false)
                      closeForm()
                      scrollToOpenings()
                    }}
                  >
                    Back to openings
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="kiterp-careers-form-panel">
                <div className="kiterp-careers-form-head">
                  <button type="button" className="kiterp-careers-back" onClick={closeForm}>
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Openings
                  </button>
                  <h2 id="careers-form-title" className="kiterp-careers-form-title">
                    Application
                  </h2>
                  {selectedJob ? (
                    <p className="kiterp-careers-form-hint">
                      Applying for <strong>{selectedJob.title}</strong>
                      {selectedJob.location ? ` · ${selectedJob.location}` : ''}
                    </p>
                  ) : (
                    <p className="kiterp-careers-form-hint">General application</p>
                  )}
                </div>

                <div className="kiterp-careers-form-scroll">
                  <fieldset className="kiterp-careers-fieldset">
                    <legend>Personal information</legend>
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
                      <label className="kiterp-careers-field kiterp-careers-field--full">
                        <span>City</span>
                        <input
                          value={form.city}
                          onChange={(e) => setField('city', e.target.value)}
                          placeholder="Your city"
                          autoComplete="address-level2"
                        />
                      </label>
                    </div>
                  </fieldset>

                  <fieldset className="kiterp-careers-fieldset">
                    <legend>Professional details</legend>
                    <div className="kiterp-careers-fields">
                      <label className="kiterp-careers-field">
                        <span>Experience (years)</span>
                        <input
                          value={form.experience_years}
                          onChange={(e) =>
                            setField('experience_years', e.target.value.replace(/\D/g, '').slice(0, 2))
                          }
                          placeholder="e.g. 3"
                          inputMode="numeric"
                        />
                      </label>
                      <label className="kiterp-careers-field">
                        <span>Current role</span>
                        <input
                          value={form.current_role}
                          onChange={(e) => setField('current_role', e.target.value)}
                          placeholder="e.g. Senior Developer"
                        />
                      </label>
                      <label className="kiterp-careers-field kiterp-careers-field--full">
                        <span>Current company</span>
                        <input
                          value={form.company}
                          onChange={(e) => setField('company', e.target.value)}
                          placeholder="Current or previous"
                        />
                      </label>
                      <label className="kiterp-careers-field kiterp-careers-field--full">
                        <span>Skills</span>
                        <input
                          value={form.skills}
                          onChange={(e) => setField('skills', e.target.value)}
                          placeholder="e.g. Angular, TypeScript, REST, RxJS"
                          maxLength={500}
                        />
                      </label>
                    </div>
                  </fieldset>

                  <fieldset className="kiterp-careers-fieldset">
                    <legend>Links</legend>
                    <div className="kiterp-careers-fields">
                      <label className="kiterp-careers-field">
                        <span>
                          <Linkedin className="inline w-3 h-3 mr-1" aria-hidden />
                          LinkedIn
                        </span>
                        <input
                          value={form.linkedin}
                          onChange={(e) => setField('linkedin', e.target.value)}
                          placeholder="linkedin.com/in/…"
                          autoComplete="url"
                        />
                      </label>
                      <label className="kiterp-careers-field">
                        <span>Portfolio / GitHub</span>
                        <input
                          value={form.portfolio}
                          onChange={(e) => setField('portfolio', e.target.value)}
                          placeholder="https://"
                          autoComplete="url"
                        />
                      </label>
                    </div>
                  </fieldset>

                  <fieldset className="kiterp-careers-fieldset">
                    <legend>Documents</legend>
                    <div className="kiterp-careers-uploads">
                      <div className="kiterp-careers-field">
                        <span>Photograph</span>
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
                                alt="Photo preview"
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
                              <span className="min-w-0 truncate text-[12px] font-semibold text-[var(--kiterp-ink)]">
                                Drop image or browse · JPG, PNG, WebP
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="kiterp-careers-field">
                        <span>Resume / CV</span>
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
                                Drop CV or browse · PDF, DOC
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="kiterp-careers-fieldset">
                    <legend>About you</legend>
                    <label className="kiterp-careers-field kiterp-careers-field--full">
                      <span>Cover letter (optional)</span>
                      <textarea
                        value={form.cover_note}
                        onChange={(e) => setField('cover_note', e.target.value)}
                        placeholder="Why would you like to join KIT ERP? Share a short note about yourself."
                        maxLength={4000}
                        rows={4}
                      />
                    </label>
                  </fieldset>
                </div>

                <button type="submit" disabled={sending} className="kiterp-btn-primary kiterp-careers-submit">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {sending ? 'Submitting…' : 'Submit application'}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {/* Keep a quiet home link for empty states / accessibility */}
      <Link to="/" className="sr-only">
        Back to home
      </Link>
    </div>
  )
}
