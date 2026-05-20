import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..', 'src')

function addImport(content) {
  if (!content.includes('onModalBackdropClick')) return content
  const m = content.match(/import \{([^}]+)\} from '@\/lib\/utils'/)
  if (m) {
    if (m[1].includes('onModalBackdropClick')) return content
    const parts = m[1].split(',').map((s) => s.trim()).filter(Boolean)
    parts.push('onModalBackdropClick')
    const uniq = [...new Set(parts)]
    return content.replace(m[0], `import { ${uniq.join(', ')} } from '@/lib/utils'`)
  }
  return `import { onModalBackdropClick } from '@/lib/utils'\n${content}`
}

function patchFile(filePath) {
  let s = fs.readFileSync(filePath, 'utf8')
  const re = /(<div className="fixed inset-0[^"]*"[^>]*?)onClick=\{onClose\}/g
  if (!re.test(s)) return false
  s = fs.readFileSync(filePath, 'utf8')
  const next = s.replace(re, '$1onClick={onModalBackdropClick(onClose)}')
  if (next === s) return false
  fs.writeFileSync(filePath, addImport(next))
  console.log('patched', path.relative(root, filePath))
  return true
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p)
    else if (p.endsWith('.tsx')) patchFile(p)
  }
}

walk(path.join(root, 'pages', 'hr'))
walk(path.join(root, 'components', 'hr'))
