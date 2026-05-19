from pathlib import Path

src = Path(__file__).resolve().parents[2] / "vendor-web" / "src" / "pages" / "hr" / "training" / "CourseLearning.tsx"
dst = Path(__file__).resolve().parents[1] / "src" / "pages" / "employee" / "CourseLearning.tsx"

content = src.read_text(encoding="utf-8")
content = content.replace(
    "import { useHREnrollment, useHRProgram, useCompleteCourse } from '@/hooks/useVendor'\nimport { vendorApi } from '@/api/vendor'\nimport type { TrainingEnrollment, TrainingProgram, TrainingCourse, QuizQuestion } from '@/types'\n",
    "import { useVendor } from '@/contexts/VendorContext'\nimport { useESSEnrollment, useESSCompleteCourse } from '@/hooks/useESS'\nimport { essApi } from '@/api/ess'\n",
)
types = """type QuizOption = { id: string; text?: string; is_correct?: boolean }
type QuizQuestion = { id: string; question?: string; question_type?: string; points?: number; options?: QuizOption[] }
type TrainingCourse = { id: string; title: string; sequence: number; content_type?: string; body_html?: string; content_url?: string; duration_min?: number; pass_score_pct?: number; questions?: QuizQuestion[] }
type TrainingProgram = { id: string; name: string; courses?: TrainingCourse[] }
type Completion = { course_id: string; passed?: boolean }
type Enrollment = { id: string; progress_pct?: number; program?: TrainingProgram; completions?: Completion[]; certificate_id?: string }

"""
content = content.replace("import { essApi } from '@/api/ess'\n", f"import {{ essApi }} from '@/api/ess'\n{types}")
content = content.replace("CourseLearningPage", "ESSCourseLearningPage")
content = content.replace("id: string", "enrollmentId: string", 1)
content = content.replace("const { id = '' }", "const { enrollmentId = '' }")
content = content.replace("useESSEnrollment(enrollmentId)", "useESSEnrollment(enrollmentId)")
content = content.replace(
    "const { data: enrollment } = useESSEnrollment(enrollmentId)",
    "const { data: enrollment, isLoading } = useESSEnrollment(enrollmentId)",
)
content = content.replace("useESSCompleteCourse()", "useESSCompleteCourse()")
content = content.replace(
    "  const enr = enrollment as (TrainingEnrollment & { certificate_id?: string }) | undefined\n"
    "  const { data: program } = useHRProgram(enr?.program_id ?? null)\n"
    "  const prog = program as TrainingProgram | undefined\n",
    "  const { storePath } = useVendor()\n"
    "  const enr = enrollment as Enrollment | undefined\n"
    "  const prog = enr?.program\n",
)
content = content.replace("if (!enr || !prog)", "if (isLoading || !enr || !prog)")
content = content.replace('to="/hr/my-training"', 'to={storePath("/hr/training")}')
content = content.replace("Back to my training", "Back to training")
content = content.replace(
    """        {enr.certificate_id && (
          <a href={vendorApi.hrCertificateUrl(enr.certificate_id)} target="_blank" rel="noopener noreferrer"
            className="ml-3 flex items-center gap-1 text-green-600 hover:underline">
            <Award className="w-4 h-4" /> Download certificate
          </a>
        )}""",
    """        {enr.certificate_id && (
          <button type="button"
            onClick={() => essApi.openCertificateInNewTab(enr.certificate_id!)}
            className="ml-3 flex items-center gap-1 text-green-600 hover:underline text-sm">
            <Award className="w-4 h-4" /> Certificate
          </button>
        )}""",
)
content = content.replace("vendorApi", "essApi")

dst.write_text(content, encoding="utf-8")
print("wrote", dst)
