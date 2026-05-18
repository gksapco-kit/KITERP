import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src')
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
  return content
}

function process(content) {
  let out = content
  let changed = false

  const next1 = out.replace(
    /<button(?![^>]*aria-label="Close")([^>]*onClick=\{[^}]+\}[^>]*)>\s*<X className/g,
    (full, attrs) => {
      changed = true
      const clean = attrs.includes('type="button"') ? attrs : attrs
      return `<button type="button" aria-label="Close"${clean}>\n                <X className`
    },
  )
  out = next1

  if (!/justify-between[\s\S]{0,1200}<X\s+className/.test(out)) {
    const next2 = out.replace(
      /(<div className="bg-white[^"]*"[^>]*onClick=\{e => e\.stopPropagation\(\)\}>\s*\n\s*)<h2 className="([^"]*)">([^<]+)<\/h2>/,
      (full, before, cls, title) => {
        if (full.includes('aria-label="Close"')) return full
        const handler = out.includes('onClose') ? 'onClose' : null
        if (!handler) return full
        changed = true
        return `${before}<motion.div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="${cls}">${title}</h2>
              ${CLOSE_BTN(handler)}
            </motion.div>`.replace(/motion\.div/g, 'motion.div')
      },
    )
    out = next2.replace(/motion\.div/g, 'div')
  }

  if (changed && out.includes('aria-label="Close"')) {
    out = ensureXImport(out)
  }
  return { out, changed }
}

let count = 0
for (const f of walk(ROOT)) {
  const content = readFileSync(f, 'utf8')
  if (!content.includes('fixed inset-0')) continue
  const { out, changed } = process(content)
  if (changed && out !== content) {
    writeFileSync(f, out)
    count++
    console.log('updated:', f.replace(/\\/g, '/').split('/src/')[1])
  }
}
console.log(`Done. ${count} file(s).`)
