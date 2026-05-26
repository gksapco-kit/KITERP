/**
 * Adds useEscapeToClose for page-level inline modals missing ESC support.
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

function showVarFromSetter(setter) {
  if (!setter.startsWith('set')) return null
  const rest = setter.slice(3)
  return rest.charAt(0).toLowerCase() + rest.slice(1)
}

function hasHook(content, closeFn, showVar) {
  return (
    content.includes(`useEscapeToClose(${closeFn}, ${showVar})`) ||
    content.includes(`useEscapeToClose(${closeFn}, !!${showVar})`) ||
    content.includes(`useEscapeToClose(() => ${closeFn.includes('set') ? closeFn : ''}`)
  )
}

function processFile(filePath) {
  const srcRel = relative(ROOT, filePath).replace(/\\/g, '/')
  if (SKIP.has(srcRel)) return false

  let content = readFileSync(filePath, 'utf8')
  if (!content.includes('fixed inset-0') || content.includes('useEscapeToClose')) return false

  let changed = false

  const closeRe = /const (close\w+) = \(\) => set(\w+)\((?:false|null)\)/g
  let match
  while ((match = closeRe.exec(content)) !== null) {
    const closeFn = match[1]
    const showVar = showVarFromSetter(match[2])
    if (!showVar || !content.includes(showVar)) continue
    if (hasHook(content, closeFn, showVar)) continue
    const hookLine = `\n  useEscapeToClose(${closeFn}, ${showVar})`
    const afterClose = match.index + match[0].length
    content = content.slice(0, afterClose) + hookLine + content.slice(afterClose)
    changed = true
    closeRe.lastIndex = afterClose + hookLine.length
  }

  const overlayRe =
    /(\w+) &&[\s\S]{0,400}?<div[^>]*fixed\s+inset-0[^>]*onClick=\{\(\) => (set\w+)\((?:false|null)\)\}/g
  while ((match = overlayRe.exec(content)) !== null) {
    const showVar = match[1]
    const setter = match[2]
    const expected = showVarFromSetter(setter)
    if (expected !== showVar) continue
    const hookLine = `\n  useEscapeToClose(() => ${setter}(false), ${showVar})`
    if (content.includes(hookLine.trim())) continue
    const fnMatch = content.match(/(?:export\s+default\s+)?function\s+\w+\([^)]*\)\s*\{/)
    if (!fnMatch) continue
    const insertAt = fnMatch.index + fnMatch[0].length
    if (content.slice(insertAt, insertAt + 200).includes(`useEscapeToClose(() => ${setter}`)) continue
    content = content.slice(0, insertAt) + hookLine + content.slice(insertAt)
    changed = true
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
