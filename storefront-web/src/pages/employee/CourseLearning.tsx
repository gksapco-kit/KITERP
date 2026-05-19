import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Award } from 'lucide-react'
import { useVendor } from '@/contexts/VendorContext'
import { useESSEnrollment, useESSCompleteCourse } from '@/hooks/useESS'
import { essApi } from '@/api/ess'
type QuizOption = { id: string; text?: string; is_correct?: boolean }
type QuizQuestion = { id: string; question?: string; question_type?: string; points?: number; options?: QuizOption[] }
type TrainingCourse = { id: string; title: string; sequence: number; content_type?: string; body_html?: string; content_url?: string; duration_min?: number; pass_score_pct?: number; questions?: QuizQuestion[] }
type TrainingProgram = { id: string; name: string; courses?: TrainingCourse[] }
type Completion = { course_id: string; passed?: boolean }
type Enrollment = { id: string; progress_pct?: number; program?: TrainingProgram; completions?: Completion[]; certificate_id?: string }


export default function ESSCourseLearningPage() {
  const { enrollmentId = '' } = useParams<{ enrollmentId: string }>()
  const { storePath } = useVendor()
  const { data: enrollment, isLoading } = useESSEnrollment(enrollmentId)
  const enr = enrollment as Enrollment | undefined
  const prog = enr?.program
  const complete = useESSCompleteCourse()
  const [activeIdx, setActiveIdx] = useState(0)

  if (isLoading || !enr || !prog) return <div className="p-6 text-gray-400">Loading?</div>
  const courses = (prog.courses ?? []).slice().sort((a, b) => a.sequence - b.sequence)
  const completedIds = new Set((enr.completions ?? []).filter(c => c.passed).map(c => c.course_id))
  const course = courses[activeIdx]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link to={storePath("/hr/training")} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back to training
      </Link>
      <h1 className="text-2xl font-bold text-gray-900">{prog.name}</h1>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
        <div className="h-2 flex-1 max-w-xs bg-gray-200 rounded">
          <div className="h-2 bg-blue-500 rounded" style={{ width: `${enr.progress_pct}%` }} />
        </div>
        <span>{enr.progress_pct}% complete</span>
        {enr.certificate_id && (
          <button type="button"
            onClick={() => essApi.openCertificateInNewTab(enr.certificate_id!)}
            className="ml-3 flex items-center gap-1 text-green-600 hover:underline text-sm">
            <Award className="w-4 h-4" /> Certificate
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <aside className="lg:col-span-1 bg-white border rounded-xl p-3 h-fit">
          <h3 className="text-sm font-semibold text-gray-700 mb-2 px-2">Lessons</h3>
          <ul className="space-y-1">
            {courses.map((c, i) => {
              const done = completedIds.has(c.id)
              return (
                <li key={c.id}>
                  <button onClick={() => setActiveIdx(i)}
                    className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded text-sm ${
                      activeIdx === i ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                    }`}>
                    {done ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> :
                      <span className="w-4 h-4 rounded-full border border-gray-300 shrink-0" />}
                    <span className="line-clamp-1 flex-1">{i + 1}. {c.title}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>
        <main className="lg:col-span-3 bg-white border rounded-xl p-5">
          {course ? (
            <CourseRunner key={course.id} course={course} enrollmentId={enr.id}
              alreadyDone={completedIds.has(course.id)}
              onComplete={(passed, scorePct, answers) =>
                complete.mutate({ eid: enr.id, course_id: course.id, score_pct: scorePct, passed, answers })}
              busy={complete.isPending} />
          ) : (
            <p className="text-gray-500">No lesson selected.</p>
          )}
        </main>
      </div>
    </div>
  )
}

function CourseRunner({
  course, alreadyDone, onComplete, busy,
}: {
  course: TrainingCourse
  enrollmentId: string
  alreadyDone: boolean
  onComplete: (passed: boolean, scorePct: number, answers?: Record<string, unknown>) => void
  busy: boolean
}) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [graded, setGraded] = useState<{ pct: number; passed: boolean } | null>(null)

  const grade = () => {
    let total = 0, got = 0
    const qs = course.questions ?? []
    for (const q of qs) {
      const points = q.points ?? 1
      total += points
      const correctIds = (q.options ?? []).filter(o => o.is_correct).map(o => o.id)
      const picked = answers[q.id] ?? []
      const same = correctIds.length === picked.length && correctIds.every(c => picked.includes(c))
      if (same) got += points
    }
    const pct = total ? Math.round((got / total) * 100) : 100
    const passed = pct >= (course.pass_score_pct ?? 70)
    setGraded({ pct, passed })
    onComplete(passed, pct, answers)
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">{course.title}</h2>
      <p className="text-xs text-gray-500 uppercase mb-4">{course.content_type}
        {course.duration_min ? <> ? {course.duration_min} min</> : null}</p>

      {course.content_type === 'text' && (
        <div className="prose prose-sm max-w-none mb-5"
          dangerouslySetInnerHTML={{ __html: course.body_html ?? '<p class="text-gray-400">No content.</p>' }} />
      )}
      {course.content_type === 'video' && course.content_url && (
        <div className="aspect-video mb-5">
          <iframe src={toEmbed(course.content_url)} className="w-full h-full rounded-lg border" allowFullScreen />
        </div>
      )}
      {course.content_type === 'pdf' && course.content_url && (
        <iframe src={course.content_url} className="w-full h-[600px] rounded-lg border mb-5" />
      )}

      {course.content_type === 'quiz' ? (
        <div>
          <div className="space-y-4">
            {(course.questions ?? []).map((q, qi) => (
              <QuestionInput key={q.id} q={q} qi={qi} value={answers[q.id] ?? []}
                onChange={v => setAnswers({ ...answers, [q.id]: v })} disabled={!!graded} />
            ))}
          </div>
          {graded ? (
            <div className={`mt-5 p-4 rounded-lg ${graded.passed ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <p className="font-semibold">Score: {graded.pct}% ? {graded.passed ? 'Passed' : 'Did not pass'}</p>
              <p className="text-xs mt-1">Pass mark: {course.pass_score_pct ?? 70}%</p>
            </div>
          ) : (
            <button onClick={grade} disabled={busy}
              className="mt-5 px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-medium disabled:opacity-50">
              Submit answers
            </button>
          )}
        </div>
      ) : (
        !alreadyDone && (
          <button onClick={() => onComplete(true, 100)} disabled={busy}
            className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50">
            Mark as completed
          </button>
        )
      )}
      {alreadyDone && !graded && (
        <p className="mt-4 text-sm text-green-700 flex items-center gap-1">
          <CheckCircle2 className="w-4 h-4" /> Already completed
        </p>
      )}
    </div>
  )
}

function QuestionInput({
  q, qi, value, onChange, disabled,
}: {
  q: QuizQuestion; qi: number; value: string[]
  onChange: (v: string[]) => void; disabled: boolean
}) {
  const isMulti = q.question_type === 'multi'
  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      <p className="font-medium text-sm mb-2">Q{qi + 1}. {q.question}</p>
      <div className="space-y-1">
        {(q.options ?? []).map(opt => (
          <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type={isMulti ? 'checkbox' : 'radio'} disabled={disabled}
              checked={value.includes(opt.id)}
              onChange={() => {
                if (isMulti) {
                  if (value.includes(opt.id)) onChange(value.filter(v => v !== opt.id))
                  else onChange([...value, opt.id])
                } else {
                  onChange([opt.id])
                }
              }} />
            <span>{opt.text}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function toEmbed(url: string): string {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{6,})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return url
}
