/**
 * Adds useEscapeToClose(onClose|onCancel) to modal function components — hook only, no JSX edits.
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..', 'src')
const SKIP = new Set(['hooks/useEscapeToClose.ts', 'components/ui/ModalEscapeHandler.tsx'])

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

function injectHookInFunction(content, fnStart, closeProp) {
  const hookLine = `\n  useEscapeToClose(${closeProp})\n`
  const braceIdx = content.indexOf('{', fnStart)
  if (braceIdx < 0) return content
  return content.slice(0, braceIdx + 1) + hookLine + content.slice(braceIdx + 1)
}

function processFile(filePath) {
  const srcRel = relative(ROOT, filePath).replace(/\\/g, '/')
  if (SKIP.has(srcRel)) return false

  let content = readFileSync(filePath, 'utf8')
  if (!content.includes('fixed inset-0')) return false

  let changed = false
  const fnRe = /(?:export\s+)?function\s+(\w+)\([^)]*\)/g
  let match

  while ((match = fnRe.exec(content)) !== null) {
    const params = match[0].slice(match[0].indexOf('(') + 1, -1)
    const fnStart = match.index
    const fnName = match[1]

    const closeProp = params.includes('onClose')
      ? 'onClose'
      : params.includes('onCancel')
        ? 'onCancel'
        : null
    if (!closeProp) continue

    const fnBodyStart = content.indexOf('{', fnStart)
    const nextFn = content.indexOf('\nfunction ', fnBodyStart + 1)
    const nextExportFn = content.indexOf('\nexport function ', fnBodyStart + 1)
    const fnEnd = Math.min(
      nextFn > 0 ? nextFn : content.length,
      nextExportFn > 0 ? nextExportFn : content.length,
    )
    const fnSlice = content.slice(fnStart, fnEnd)
    if (!fnSlice.includes('fixed inset-0')) continue
    if (fnSlice.includes('useEscapeToClose(')) continue

    content = injectHookInFunction(content, fnStart, closeProp)
    changed = true
    fnRe.lastIndex = fnStart + 50
  }

  if (!changed) return false
  content = ensureHookImport(content)
  writeFileSync(filePath, content)
  console.log('updated:', srcRel)
  return true
}

let count = 0
for (const f of walk(ROOT)) {
  if (processFile(f)) count++
}
console.log(`Done. ${count} file(s) updated.`)
