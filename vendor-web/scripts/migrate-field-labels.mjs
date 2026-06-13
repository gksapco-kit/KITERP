/**
 * Migrate table/report headers and form column labels to help-enabled components.
 * Run: node scripts/migrate-field-labels.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC_ROOT = path.join(__dirname, '..', 'src')

const SKIP_FILES = ['FieldLabel.tsx', 'FieldHelpLabel.tsx', 'label.tsx', 'migrate-field-labels.mjs', 'migrate-form-labels.mjs']

const FORM_COL_STRIP = [
  'text-xs',
  'font-medium',
  'text-gray-400',
  'uppercase',
  'text-center',
  'text-left',
  'text-right',
]

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      walk(full, files)
    } else if (/\.tsx$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

function ensureImport(content, symbol, fromPath) {
  if (new RegExp(`\\b${symbol}\\b`).test(content.split('\n').slice(0, 30).join('\n')) &&
      content.includes(`from '${fromPath}'`) || content.includes(`from "${fromPath}"`)) {
    if (content.includes(symbol)) return content
  }
  if (content.includes(`import { ${symbol}`) || content.includes(`, ${symbol}`)) return content
  const importLine = `import { ${symbol} } from '${fromPath}'`
  if (content.includes(importLine)) return content
  const firstImport = content.match(/^import .+$/m)
  if (!firstImport) return content
  const insertAt = content.indexOf(firstImport[0]) + firstImport[0].length
  return `${content.slice(0, insertAt)}\n${importLine}${content.slice(insertAt)}`
}

function stripClasses(className) {
  const parts = className.split(/\s+/).filter(Boolean)
  return parts.filter((p) => !FORM_COL_STRIP.includes(p)).join(' ')
}

function migrateContent(content) {
  let next = content
  let changed = false

  // <th ...>Plain text</th>  (no nested tags)
  next = next.replace(/<th([^>]*)>\s*([^<{}]+?)\s*<\/th>/g, (match, attrs, text) => {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length > 80) return match
    changed = true
    return `<th${attrs}><TableColumnLabel>${trimmed}</TableColumnLabel></th>`
  })

  // Form grid column headers: <p className="...text-gray-400 uppercase...">Text</p>
  next = next.replace(
    /<p className="([^"]*text-xs font-medium text-gray-400 uppercase[^"]*)">([^<]+)<\/p>/g,
    (match, className, text) => {
      const trimmed = text.trim()
      if (!trimmed) return match
      const extra = stripClasses(className)
      changed = true
      if (extra) {
        return `<FormColumnLabel className="${extra}">${trimmed}</FormColumnLabel>`
      }
      return `<FormColumnLabel>${trimmed}</FormColumnLabel>`
    },
  )

  // Section headers in reports: <p className="...text-gray-500 uppercase tracking-wide...">Text</p>
  next = next.replace(
    /<p className="([^"]*text-xs font-medium text-gray-500 uppercase tracking-wide[^"]*)">([^<]+)<\/p>/g,
    (match, className, text) => {
      const trimmed = text.trim()
      if (!trimmed || trimmed.length > 60) return match
      const extra = className
        .split(/\s+/)
        .filter((p) => !['text-xs', 'font-medium', 'text-gray-500', 'uppercase', 'tracking-wide', 'flex', 'items-center', 'gap-1.5'].includes(p))
        .join(' ')
      changed = true
      if (extra) {
        return `<SectionLabel className="${extra}">${trimmed}</SectionLabel>`
      }
      return `<SectionLabel>${trimmed}</SectionLabel>`
    },
  )

  // Checkbox rows: <label className="flex items-center gap-2"><input type="checkbox" .../><span className="text-sm">Text</span></label>
  // Skipped — too varied; handle key files manually.

  if (!changed) return content

  if (next.includes('TableColumnLabel')) {
    next = ensureImport(next, 'TableColumnLabel', '@/components/common/FieldLabel')
  }
  if (next.includes('FormColumnLabel')) {
    next = ensureImport(next, 'FormColumnLabel', '@/components/common/FieldLabel')
  }
  if (next.includes('SectionLabel')) {
    next = ensureImport(next, 'SectionLabel', '@/components/common/FieldLabel')
  }

  return next
}

const files = walk(SRC_ROOT)
let updated = 0

for (const file of files) {
  if (SKIP_FILES.some((s) => file.includes(s))) continue
  const before = fs.readFileSync(file, 'utf8')
  const after = migrateContent(before)
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8')
    updated++
    console.log(path.relative(SRC_ROOT, file))
  }
}

console.log(`\nUpdated ${updated} file(s).`)
