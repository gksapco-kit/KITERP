import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const root = join(import.meta.dirname, '..', 'src')
function walk(d, f = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) walk(p, f)
    else if (e.name.endsWith('.tsx')) f.push(p)
  }
  return f
}
const missing = []
for (const f of walk(root)) {
  const c = readFileSync(f, 'utf8')
  if (c.includes('fixed inset-0') && !c.includes('aria-label="Close"')) {
    missing.push(f.replace(/\\/g, '/').split('/src/')[1])
  }
}
console.log(missing.join('\n'))
console.log('count', missing.length)
