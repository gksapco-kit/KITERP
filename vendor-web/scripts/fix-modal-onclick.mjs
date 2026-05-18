import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src')

function walk(dir, files = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) walk(p, files)
    else if (ent.name.endsWith('.tsx')) files.push(p)
  }
  return files
}

function fix(content) {
  let out = content
  let prev
  do {
    prev = out
    out = out.replace(
      /onClick=\{e = onClick=\{e = onClick=\{e => e\.stopPropagation\(\)\}> e\.stopPropagation\(\)\}> e\.stopPropagation\(\)\}/g,
      'onClick={e => e.stopPropagation()}',
    )
    out = out.replace(
      /onClick=\{e = onClick=\{e => e\.stopPropagation\(\)\}> e\.stopPropagation\(\)\}/g,
      'onClick={e => e.stopPropagation()}',
    )
    out = out.replace(
      /onClick=\{\(e\) = onClick=\{e => e\.stopPropagation\(\)\}> e\.stopPropagation\(\)\}/g,
      'onClick={e => e.stopPropagation()}',
    )
  } while (out !== prev)
  return out
}

let count = 0
for (const f of walk(ROOT)) {
  const content = readFileSync(f, 'utf8')
  const fixed = fix(content)
  if (fixed !== content) {
    writeFileSync(f, fixed)
    count++
    console.log('fixed:', f)
  }
}
console.log(`Fixed ${count} file(s).`)
