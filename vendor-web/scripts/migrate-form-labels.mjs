/**
 * One-off migration: replace raw <label className="…">Text *</label> with shared <Label>.
 * Run: node scripts/migrate-form-labels.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC_ROOT = path.join(__dirname, '..', 'src')

const PATTERNS = [
  'block text-xs font-medium text-gray-700 mb-1',
  'block text-xs font-medium text-gray-600 mb-1',
  'block text-xs text-gray-500 mb-0.5',
  'block text-sm font-medium text-gray-700 mb-1',
  'text-xs font-medium text-gray-600 uppercase',
  'text-xs font-medium text-gray-500 uppercase tracking-wide',
  'text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1.5',
  'block text-xs font-medium text-gray-700 mb-2',
  'text-xs font-medium text-gray-500 block mb-1',
]

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      walk(full, files)
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

function parseLabelText(raw) {
  const trimmed = raw.trim()
  const required = /\*\s*$/.test(trimmed)
  const text = trimmed.replace(/\s*\*+\s*$/, '').trim()
  return { text, required }
}

function migrateContent(content) {
  let next = content
  let changed = false

  for (const className of PATTERNS) {
    const re = new RegExp(
      `<label className="${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">([^<]*)</label>`,
      'g',
    )
    next = next.replace(re, (_match, inner) => {
      const { text, required } = parseLabelText(inner)
      if (!text) return _match
      changed = true
      const requiredAttr = required ? ' required' : ''
      return `<Label className="${className}"${requiredAttr}>${text}</Label>`
    })
  }

  if (!changed) return content

  if (!/\bfrom ['"]@\/components\/ui\/label['"]/.test(next)) {
    const importMatch = next.match(/^import .+$/m)
    if (importMatch) {
      const insertAt = next.indexOf(importMatch[0]) + importMatch[0].length
      next = `${next.slice(0, insertAt)}\nimport { Label } from '@/components/ui/label'${next.slice(insertAt)}`
    }
  }

  return next
}

const files = walk(SRC_ROOT)
let updated = 0

for (const file of files) {
  if (file.includes('InlineFieldLabel') || file.includes('migrate-form-labels')) continue
  const before = fs.readFileSync(file, 'utf8')
  const after = migrateContent(before)
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8')
    updated++
    console.log(path.relative(SRC_ROOT, file))
  }
}

console.log(`\nUpdated ${updated} file(s).`)
