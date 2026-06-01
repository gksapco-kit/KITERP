/**
 * Ensures centered modal overlays scroll and panels respect viewport height.
 * Run: node scripts/patch-modal-viewport.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..', 'src')

const OVERLAY_RE =
  /className=(?:\{cn\(|"|'|`)([^"'`]*fixed inset-0[^"'`]*flex items-center justify-center[^"'`]*)(?:"|'|`|\))/g

const PANEL_RE =
  /className=(?:\{cn\(|"|'|`)([^"'`]*(?:bg-white|bg-card)[^"'`]*(?:rounded-xl|rounded-2xl|rounded-lg)[^"'`]*)(?:"|'|`|\))/g

function patchOverlayClasses(classes) {
  let next = classes
  if (!/\boverflow-y-auto\b/.test(next) && !/\boverflow-hidden\b/.test(next)) {
    next = `${next.trim()} overflow-y-auto`
  }
  return next.trim().replace(/\s+/g, ' ')
}

function patchPanelClasses(classes) {
  if (/\bmax-h-/.test(classes)) return classes
  if (/\binset-/.test(classes)) return classes
  let next = classes.trim()
  if (/\bflex-col\b/.test(next)) {
    if (!/\boverflow-hidden\b/.test(next)) next += ' overflow-hidden'
  } else {
    next += ' max-h-[90vh] overflow-y-auto'
  }
  return next.replace(/\s+/g, ' ')
}

function patchFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  const original = content

  content = content.replace(OVERLAY_RE, (match, classes) => {
    const patched = patchOverlayClasses(classes)
    if (patched === classes.trim()) return match
    return match.replace(classes, patched)
  })

  // Only patch panel classNames on lines that look like modal shells (shadow / max-w)
  content = content.replace(PANEL_RE, (match, classes) => {
    if (!/\b(shadow-|max-w-)/.test(classes)) return match
    const patched = patchPanelClasses(classes)
    if (patched === classes.trim()) return match
    return match.replace(classes, patched)
  })

  if (content !== original) {
    fs.writeFileSync(filePath, content)
    console.log('patched', path.relative(root, filePath))
    return true
  }
  return false
}

function walk(dir) {
  let count = 0
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) count += walk(p)
    else if (p.endsWith('.tsx')) count += patchFile(p) ? 1 : 0
  }
  return count
}

const n = walk(root)
console.log(`Done. Patched ${n} file(s).`)
