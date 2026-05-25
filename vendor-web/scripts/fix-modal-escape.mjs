/**
 * Fixes useEscapeToClose accidentally injected into destructuring params.
 * Re-inserts the hook at the start of the function body.
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..', 'src')
const HOOK_IMPORT = "import { useEscapeToClose } from '@/hooks/useEscapeToClose'\n"

function walk(dir, files = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) walk(p, files)
    else if (ent.name.endsWith('.tsx')) files.push(p)
  }
  return files
}

function ensureHookImport(content) {
  if (content.includes("from '@/hooks/useEscapeToClose'")) return content
  const reactM = content.match(/^import .+ from 'react'\n/m)
  if (reactM) return content.replace(reactM[0], `${reactM[0]}${HOOK_IMPORT}`)
  return `${HOOK_IMPORT}${content}`
}

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf8')
  let changed = false

  const stripped = content.replace(
    /((?:export\s+default\s+)?function\s+[^(]+\(\{\s*\n)\s*useEscapeToClose\((onClose|onCancel)\)\s*\n/gm,
    '$1',
  )
  if (stripped !== content) {
    content = stripped
    changed = true
  }

  const fnRe = /(?:export\s+default\s+)?function\s+\w+\([^)]*\b(onClose|onCancel)\b[^)]*\)\s*(?::\s*[^{]+)?\s*\{/g
  let match
  const inserts = []

  while ((match = fnRe.exec(content)) !== null) {
    const closeProp = match[1]
    const braceEnd = match.index + match[0].length
    const afterBrace = content.slice(braceEnd, braceEnd + 80)
    if (/^\s*useEscapeToClose\(/.test(afterBrace)) continue

    const fnStart = match.index
    const nextFn = content.indexOf('\nfunction ', braceEnd)
    const nextExportFn = content.indexOf('\nexport function ', braceEnd)
    const nextDefaultFn = content.indexOf('\nexport default function ', braceEnd)
    const fnEnd = Math.min(
      ...[nextFn, nextExportFn, nextDefaultFn, content.length].filter((n) => n >= 0),
    )
    const fnSlice = content.slice(fnStart, fnEnd)
    if (!fnSlice.includes('fixed inset-0')) continue

    inserts.push({ braceEnd, closeProp })
  }

  for (const { braceEnd, closeProp } of inserts.reverse()) {
    const insert = `\n  useEscapeToClose(${closeProp})\n`
    content = content.slice(0, braceEnd) + insert + content.slice(braceEnd)
    changed = true
  }

  if (!changed) return false
  content = ensureHookImport(content)
  writeFileSync(filePath, content)
  console.log('fixed:', relative(ROOT, filePath).replace(/\\/g, '/'))
  return true
}

let count = 0
for (const f of walk(ROOT)) {
  if (processFile(f)) count++
}
console.log(`Done. ${count} file(s) fixed.`)
