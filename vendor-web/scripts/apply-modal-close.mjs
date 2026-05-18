/**
 * Adds X close button, backdrop click, and stopPropagation to modals
 * that use `fixed inset-0` overlays but lack aria-label="Close".
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..', 'src')
const SKIP = new Set(['components/ui/Modal.tsx'])

const CLOSE_BTN = (handler) => `<button
                type="button"
                onClick={${handler}}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>`

function walk(dir, files = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) walk(p, files)
    else if (ent.name.endsWith('.tsx')) files.push(p)
  }
  return files
}

function ensureXImport(content) {
  const m = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"]/)
  if (m) {
    if (/\bX\b/.test(m[1])) return content
    return content.replace(m[0], `import { ${m[1].trim()}, X } from 'lucide-react'`)
  }
  const reactM = content.match(/^import .+ from 'react'\n/m)
  if (reactM) {
    return content.replace(reactM[0], `${reactM[0]}import { X } from 'lucide-react'\n`)
  }
  return `import { X } from 'lucide-react'\n${content}`
}

function findBlockEnd(content, start) {
  const lineStart = content.lastIndexOf('\n', start) + 1
  const indent = content.slice(lineStart).match(/^(\s*)/)[1]
  const escaped = indent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${escaped}\\)\\}`, 'm')
  const m = re.exec(content.slice(start))
  if (!m) return null
  return start + m.index + m[0].length
}

function findCloseHandler(block) {
  const closeFn = block.match(/const\s+(close\w+)\s*=\s*\(\)\s*=>/)
  if (closeFn) return closeFn[1]

  const setFalse = [...block.matchAll(/onClick=\{(\(\)\s*=>\s*)?set(\w+)\(false\)\}/g)]
  if (setFalse.length) {
    const last = setFalse[setFalse.length - 1]
    return last[1] ? `() => set${last[2]}(false)` : `set${last[2]}(false)`
  }

  if (/\bonClose\b/.test(block)) return 'onClose'

  return null
}

function hasCloseInBlock(block) {
  return (
    block.includes('aria-label="Close"') ||
    /justify-between[\s\S]{0,500}<X\s+className/.test(block) ||
    block.includes('ModalCloseButton')
  )
}

function patchOverlay(block, handler) {
  return block.replace(
    /(<div)(\s+)(className="[^"]*fixed\s+inset-0[^"]*")(\s*)(>)/,
    (full, open, sp1, cls, sp2, close) => {
      if (/onClick=\{/.test(full)) return full
      const gap = sp2.trim() ? sp2 : ' '
      return `${open}${sp1}${cls}${gap}onClick={${handler}}${close}`
    },
  )
}

function patchPanel(block) {
  let done = false
  return block.replace(
    /(<div)(\s+)(className="[^"]*bg-white[^"]*")([^>]*)(>)/,
    (full, open, sp, cls, rest, close) => {
      if (done) return full
      if (rest.includes('stopPropagation') || full.includes('onClick={e => e.stopPropagation()}')) return full
      done = true
      return `${open}${sp}${cls}${rest} onClick={e => e.stopPropagation()}${close}`
    },
  )
}

function patchTitle(block, handler) {
  if (/flex items-start justify-between/.test(block) || /flex items-center justify-between/.test(block)) {
    return block.replace(
      /<button([^>]*onClick=\{[^}]+\}[^>]*)>\s*<X className="w-5 h-5[^"]*"[^/]*\/>\s*<\/button>/,
      (btn) => (btn.includes('aria-label="Close"') ? btn : btn.replace('<button', '<button type="button" aria-label="Close"')),
    )
  }

  let out = block.replace(
    /(<div className="bg-white[^"]*"[^>]*>\s*(?:<div[^>]*>\s*)?)(<h2 className="[^"]*">[\s\S]*?<\/h2>)(\s*\n\s*<p className="text-xs[^"]*">[\s\S]*?<\/p>)?/,
    (full, before, h2, sub) => {
      if (full.includes('justify-between')) return full
      const subBlock = sub || ''
      return `${before}<div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                ${h2.trim()}${subBlock}
              </div>
              ${CLOSE_BTN(handler)}
            </div>`
    },
  )

  if (out === block) {
    out = block.replace(
      /(\n\s+)(<h2 className="[^"]*">[^<]+<\/h2>)/,
      (full, indent, h2) => {
        if (/justify-between[\s\S]{0,800}<X\s+className/.test(block)) return full
        const h2Clean = h2.replace(/\smb-\d+/g, '')
        return `\n${indent}<div className="flex items-start justify-between gap-3 mb-4">
${indent}  <div className="min-w-0">${h2Clean}</div>
${indent}  ${CLOSE_BTN(handler)}
${indent}</div>`
      },
    )
  }
  return out
}

function patchBlock(block, handler) {
  let out = patchOverlay(block, handler)
  out = patchPanel(out)
  out = patchTitle(out, handler)
  return out
}

function processFile(filePath) {
  const srcRel = relative(ROOT, filePath).replace(/\\/g, '/')
  if (SKIP.has(srcRel)) return false

  const content = readFileSync(filePath, 'utf8')
  if (!content.includes('fixed inset-0')) return false

  const re = /\{[\s\S]{0,120}?\s*&&\s*\(\s*\n\s*<div[^>]*fixed\s+inset-0/g
  let changed = false
  let result = ''
  let lastIdx = 0
  let match

  while ((match = re.exec(content)) !== null) {
    const blockStart = match.index
    const blockEnd = findBlockEnd(content, blockStart)
    if (!blockEnd) continue

    result += content.slice(lastIdx, blockStart)
    const block = content.slice(blockStart, blockEnd)
    const handler = findCloseHandler(block)

    let patched = block
    if (handler) {
      if (!hasCloseInBlock(block)) {
        patched = patchBlock(block, handler)
      } else if (!/fixed\s+inset-0[^>]*onClick/.test(block)) {
        patched = patchOverlay(patchPanel(block), handler)
        patched = patched.replace(
          /<button([^>]*onClick=\{[^}]+\}[^>]*)>\s*<X className/,
          (btn) => (btn.includes('aria-label="Close"') ? btn : btn.replace('<button', '<button type="button" aria-label="Close"')),
        )
      }
    }

    if (patched !== block) {
      result += patched
      changed = true
    } else {
      result += block
    }
    lastIdx = blockEnd
    re.lastIndex = blockEnd
  }

  result += content.slice(lastIdx)

  if (!changed) return false
  if (result.includes('aria-label="Close"')) {
    writeFileSync(filePath, ensureXImport(result))
  } else {
    writeFileSync(filePath, result)
  }
  console.log('updated:', srcRel)
  return true
}

function processReturnModals(filePath) {
  const srcRel = relative(ROOT, filePath).replace(/\\/g, '/')
  if (SKIP.has(srcRel)) return false

  let content = readFileSync(filePath, 'utf8')
  if (!content.includes('fixed inset-0') || !content.includes('onClose')) return false
  if (content.includes('aria-label="Close"')) return false

  const handler = 'onClose'
  let changed = false

  if (!/fixed\s+inset-0[^>]*onClick/.test(content)) {
    const next = content.replace(
      /(<div)(\s+)(className="[^"]*fixed\s+inset-0[^"]*")(\s*)(>)/,
      (full, open, sp1, cls, sp2, close) => {
        if (/onClick=\{/.test(full)) return full
        changed = true
        const gap = sp2.trim() ? sp2 : ' '
        return `${open}${sp1}${cls}${gap}onClick={${handler}}${close}`
      },
    )
    if (changed) content = next
  }

  if (!/justify-between[\s\S]{0,400}<X\s+className/.test(content)) {
    const next = patchTitle(content, handler)
    if (next !== content) {
      content = next
      changed = true
    }
  } else {
    const next = content.replace(
      /<button([^>]*onClick=\{onClose\}[^>]*)>\s*<X className/,
      (btn) => (btn.includes('aria-label="Close"') ? btn : btn.replace('<button', '<button type="button" aria-label="Close"')),
    )
    if (next !== content) {
      content = next
      changed = true
    }
  }

  if (!changed) return false
  content = patchPanel(content)
  if (content.includes('aria-label="Close"')) content = ensureXImport(content)
  writeFileSync(filePath, content)
  console.log('updated (return modal):', srcRel)
  return true
}

let count = 0
for (const f of walk(ROOT)) {
  if (processFile(f)) count++
  else if (processReturnModals(f)) count++
}
console.log(`Done. ${count} file(s) updated.`)
