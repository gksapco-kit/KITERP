/**
 * One-off: map legacy violet/purple Tailwind (old brand) to semantic tokens.
 * Run: node scripts/replace-purple-brand.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const roots = [
  path.join('vendor-web', 'src'),
  path.join('storefront-web', 'src'),
  path.join('frontend', 'src'),
]

/** Longer keys first. Order matters. */
const REPLACEMENTS = [
  [/from-violet-600 via-purple-600 to-indigo-600/g, 'from-primary via-primary/90 to-emerald-800'],
  [/from-violet-600 to-fuchsia-600/g, 'from-primary to-emerald-700'],
  [/from-violet-600 to-purple-600/g, 'from-primary to-emerald-700'],
  [/from-violet-600 to-blue-600/g, 'from-primary to-info'],
  [/from-violet-500 to-blue-500/g, 'from-primary to-info'],
  [/from-violet-500 to-purple-600/g, 'from-primary to-emerald-700'],
  [/from-blue-600 to-purple-600/g, 'from-primary to-emerald-700'],
  [/from-blue-500 to-purple-500/g, 'from-primary to-emerald-600'],
  [/from-blue-500 to-violet-500/g, 'from-primary to-info'],
  [/from-violet-100 to-fuchsia-100/g, 'from-accent to-primary/20'],
  [/bg-gradient-to-r from-purple-50 to-violet-50/g, 'bg-gradient-to-r from-accent to-primary/10'],
  [/dark:bg-violet-950\/50/g, 'dark:bg-primary/20'],
  [/dark:bg-violet-950\/40/g, 'dark:bg-primary/20'],
  [/dark:text-violet-300/g, 'dark:text-primary-foreground/90'],
  [/text-violet-200/g, 'text-primary-foreground/85'],
  [/bg-violet-500\/12/g, 'bg-primary/15'],
  [/bg-violet-500\/10/g, 'bg-primary/10'],
  [/text-violet-900/g, 'text-primary'],
  [/text-violet-800/g, 'text-primary'],
  [/text-violet-700/g, 'text-primary'],
  [/text-violet-600/g, 'text-primary'],
  [/text-violet-500/g, 'text-primary/80'],
  [/text-violet-400/g, 'text-primary/70'],
  [/text-violet-300/g, 'text-primary/50'],
  [/hover:text-violet-800/g, 'hover:text-primary/90'],
  [/hover:text-violet-700/g, 'hover:text-primary/90'],
  [/hover:text-violet-600/g, 'hover:text-primary'],
  [/bg-violet-700/g, 'bg-primary/90'],
  [/hover:bg-violet-700/g, 'hover:bg-primary/90'],
  [/hover:bg-violet-600/g, 'hover:bg-primary/90'],
  [/bg-violet-600/g, 'bg-primary'],
  [/bg-violet-500/g, 'bg-primary'],
  [/bg-violet-400/g, 'bg-primary/50'],
  [/bg-violet-50\/50/g, 'bg-accent/80'],
  [/bg-violet-50\/40/g, 'bg-accent/70'],
  [/bg-violet-50\/30/g, 'bg-accent/60'],
  [/hover:bg-violet-50\/50/g, 'hover:bg-accent/80'],
  [/hover:bg-violet-50\/30/g, 'hover:bg-accent/60'],
  [/hover:bg-violet-50(?!\\d)/g, 'hover:bg-accent'],
  [/bg-violet-50(?!\\d)/g, 'bg-accent'],
  [/hover:bg-violet-100/g, 'hover:bg-primary/15'],
  [/bg-violet-100/g, 'bg-primary/10'],
  [/border-violet-600/g, 'border-primary'],
  [/border-violet-500/g, 'border-primary'],
  [/border-violet-400/g, 'border-primary/60'],
  [/border-violet-300/g, 'border-primary/40'],
  [/border-violet-200/g, 'border-primary/30'],
  [/border-violet-100/g, 'border-primary/20'],
  [/hover:border-violet-500/g, 'hover:border-primary'],
  [/hover:border-violet-400/g, 'hover:border-primary/60'],
  [/hover:border-violet-300/g, 'hover:border-primary/40'],
  [/hover:border-violet-200/g, 'hover:border-primary/30'],
  [/ring-violet-600/g, 'ring-primary'],
  [/ring-violet-500\/45/g, 'ring-ring/45'],
  [/ring-violet-500\/40/g, 'ring-ring/40'],
  [/ring-violet-500\/35/g, 'ring-ring/35'],
  [/ring-violet-400/g, 'ring-ring'],
  [/ring-violet-300/g, 'ring-ring'],
  [/ring-1 ring-violet-300/g, 'ring-1 ring-ring'],
  [/ring-1 ring-violet-400/g, 'ring-1 ring-ring'],
  [/ring-2 ring-violet-300/g, 'ring-2 ring-ring'],
  [/ring-2 ring-violet-400/g, 'ring-2 ring-ring'],
  [/focus:ring-violet-500/g, 'focus:ring-ring'],
  [/focus:ring-violet-400/g, 'focus:ring-ring'],
  [/focus:ring-violet-300/g, 'focus:ring-ring'],
  [/focus:ring-violet-200/g, 'focus:ring-ring'],
  [/focus:ring-1 focus:ring-violet-400/g, 'focus:ring-1 focus:ring-ring'],
  [/focus:ring-2 focus:ring-violet-400/g, 'focus:ring-2 focus:ring-ring'],
  [/focus:ring-2 focus:ring-violet-300/g, 'focus:ring-2 focus:ring-ring'],
  [/focus:ring-purple-400/g, 'focus:ring-ring'],
  [/focus:border-violet-500/g, 'focus:border-primary'],
  [/outline-violet-500/g, 'outline-ring'],
  [/outline-violet-300/g, 'outline-ring/50'],
  [/hover:outline-violet-300/g, 'hover:outline-ring/50'],
  [/accent-violet-600/g, 'accent-primary'],
  [/accent-purple-600/g, 'accent-primary'],
  [/text-purple-900/g, 'text-primary'],
  [/text-purple-800/g, 'text-primary'],
  [/text-purple-700/g, 'text-primary'],
  [/text-purple-600/g, 'text-primary'],
  [/text-purple-500/g, 'text-primary/80'],
  [/text-purple-400/g, 'text-primary/70'],
  [/hover:text-purple-800/g, 'hover:text-primary/90'],
  [/hover:text-purple-700/g, 'hover:text-primary/90'],
  [/hover:text-purple-600/g, 'hover:text-primary'],
  [/bg-purple-700/g, 'bg-primary/90'],
  [/hover:bg-purple-600/g, 'hover:bg-primary/90'],
  [/hover:bg-purple-400/g, 'hover:bg-primary/80'],
  [/bg-purple-600/g, 'bg-primary'],
  [/bg-purple-500/g, 'bg-primary'],
  [/bg-purple-400/g, 'bg-primary/70'],
  [/bg-purple-100/g, 'bg-primary/12'],
  [/bg-purple-50\/50/g, 'bg-accent/70'],
  [/bg-purple-50\/30/g, 'bg-accent/50'],
  [/bg-purple-50/g, 'bg-accent'],
  [/hover:bg-purple-100/g, 'hover:bg-primary/15'],
  [/hover:bg-purple-50/g, 'hover:bg-accent'],
  [/border-purple-400/g, 'border-primary/60'],
  [/border-purple-300/g, 'border-primary/40'],
  [/border-purple-200/g, 'border-primary/30'],
  [/hover:border-purple-200/g, 'hover:border-primary/30'],
  [/hover:border-purple-300/g, 'hover:border-primary/40'],
  [/border-purple-600/g, 'border-primary'],
  [/ring-purple-400/g, 'ring-ring'],
  [/to-fuchsia-600/g, 'to-emerald-700'],
  [/to-fuchsia-100/g, 'to-accent'],
  [/from-fuchsia-/g, 'from-primary/'],
  [/shadow-violet-200/g, 'shadow-primary/20'],
  [/shadow-violet-/g, 'shadow-primary/'],
  [/divide-violet-200/g, 'divide-primary/20'],
]

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name)
    if (name.isDirectory()) {
      if (name.name === 'node_modules' || name.name === 'dist') continue
      walk(p, out)
    } else if (/\.(tsx|ts|css)$/.test(name.name)) out.push(p)
  }
  return out
}

let files = 0
let changes = 0
for (const root of roots) {
  const abs = path.join(process.cwd(), root)
  if (!fs.existsSync(abs)) continue
  for (const file of walk(abs)) {
    let s = fs.readFileSync(file, 'utf8')
    const orig = s
    for (const [re, rep] of REPLACEMENTS) s = s.replace(re, rep)
    if (s !== orig) {
      fs.writeFileSync(file, s, 'utf8')
      files++
      changes += [...orig.matchAll(/\bviolet-|purple-|fuchsia-/gi)].length
    }
  }
}
console.log('Updated files:', files, '(approx pattern hits in originals — see git diff)')
