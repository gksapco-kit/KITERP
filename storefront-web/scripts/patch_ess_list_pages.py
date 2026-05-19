from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src" / "pages" / "employee"

# Performance: add Action column
perf = (ROOT / "Performance.tsx").read_text(encoding="utf-8")
if "storePath" not in perf:
    perf = perf.replace(
        "import { Target, ClipboardList, MessageCircle } from 'lucide-react'",
        "import { Link } from 'react-router-dom'\nimport { Target, ClipboardList, MessageCircle } from 'lucide-react'\nimport { useVendor } from '@/contexts/VendorContext'",
    )
    perf = perf.replace(
        "export default function ESSPerformancePage() {\n  const { data, isLoading } = useESSPerformance()",
        "export default function ESSPerformancePage() {\n  const { storePath } = useVendor()\n  const { data, isLoading } = useESSPerformance()",
    )
perf = perf.replace(
    "['Cycle', 'Status', 'Self Rating', 'Overall Rating'].map",
    "['Cycle', 'Status', 'Self Rating', 'Overall', 'Action'].map",
)
old_row = """                      <td className=\"py-3 px-4 text-sm text-gray-600\">{r.overall_rating ?? '—'}</td>
                    </tr>"""
new_row = """                      <td className=\"py-3 px-4 text-sm text-gray-600\">{r.overall_rating ?? '—'}</td>
                      <td className=\"py-3 px-4\">
                        <Link to={storePath(`/hr/performance/reviews/${r.id}`)}
                          className=\"text-xs text-blue-600 hover:underline font-medium\">Open</Link>
                      </td>
                    </tr>"""
if "performance/reviews" not in perf:
    perf = perf.replace(old_row, new_row)
(ROOT / "Performance.tsx").write_text(perf, encoding="utf-8")
print("Performance.tsx")

# Policies: read link
pol = (ROOT / "Policies.tsx").read_text(encoding="utf-8")
if "storePath" not in pol:
    pol = pol.replace(
        "import { ShieldCheck, Loader2 } from 'lucide-react'",
        "import { Link } from 'react-router-dom'\nimport { ShieldCheck, Loader2, ExternalLink } from 'lucide-react'\nimport { useVendor } from '@/contexts/VendorContext'",
    )
    pol = pol.replace(
        "export default function ESSPolicies() {\n  const { data: profile, isLoading } = useESSProfile()",
        "export default function ESSPolicies() {\n  const { storePath } = useVendor()\n  const { data: profile, isLoading } = useESSProfile()",
    )
if "hr/policies/" not in pol:
    pol = pol.replace(
        """                <Button
                  size=\"sm\"
                  disabled={ack.isPending}
                  onClick={() => ack.mutate(id)}
                  className=\"shrink-0\"
                >""",
        """                <motionPlaceholder>
                  <Link to={storePath(`/hr/policies/${id}`)}
                    className=\"flex items-center gap-1 text-sm text-blue-600 hover:underline shrink-0\">
                    <ExternalLink className=\"w-4 h-4\" /> Read
                  </Link>
                  <Button
                  size=\"sm\"
                  disabled={ack.isPending}
                  onClick={() => ack.mutate(id)}
                  className=\"shrink-0\"
                >""",
    )
    pol = pol.replace(
        """                  {ack.isPending ? <Loader2 className=\"w-4 h-4 animate-spin\" /> : 'I have read & acknowledge'}
                </Button>
              </li>""",
        """                  {ack.isPending ? <Loader2 className=\"w-4 h-4 animate-spin\" /> : 'I have read & acknowledge'}
                </Button>
                </motionPlaceholder>
              </li>""",
    )
import re
pol = re.sub("motionPlaceholder", "motionPlaceholder", pol)
pol = re.sub("motionPlaceholder", "div", pol)
(ROOT / "Policies.tsx").write_text(pol, encoding="utf-8")
print("Policies.tsx")

# Leaves: holidays
leaves = (ROOT / "Leaves.tsx").read_text(encoding="utf-8")
if "useESSHolidays" not in leaves:
    leaves = leaves.replace(
        "import { useESSLeaves, useESSLeavePolicies, useESSSubmitLeave, useESSCancelLeave } from '@/hooks/useESS'",
        "import { useESSLeaves, useESSLeavePolicies, useESSSubmitLeave, useESSCancelLeave, useESSHolidays } from '@/hooks/useESS'",
    )
    leaves = leaves.replace(
        "export default function ESSLeavesPage() {\n  const { data, isLoading } = useESSLeaves()",
        "export default function ESSLeavesPage() {\n  const year = new Date().getFullYear()\n  const { data, isLoading } = useESSLeaves()\n  const { data: holidays = [] } = useESSHolidays(year)",
    )
    block = """
      {(holidays as Record<string, unknown>[]).length > 0 && (
        <section className=\"mb-6\">
          <h2 className=\"text-sm font-semibold text-gray-700 mb-2\">Company holidays ({year})</h2>
          <ul className=\"bg-white border rounded-xl divide-y text-sm\">
            {(holidays as Record<string, unknown>[]).map((h) => (
              <li key={String(h.id)} className=\"px-4 py-2 flex justify-between gap-2\">
                <span className=\"font-medium text-gray-900\">{String(h.name)}</span>
                <span className=\"text-gray-500\">{String(h.date)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
"""
    leaves = leaves.replace("      {/* Balances */}", block + "\n      {/* Balances */}")
(ROOT / "Leaves.tsx").write_text(leaves, encoding="utf-8")
print("Leaves.tsx")
