/**
 * Remaining violet/purple/fuchsia + invalid shadow tokens after pass 1.
 */
import fs from 'node:fs'
import path from 'node:path'

const roots = [
  path.join('vendor-web', 'src'),
  path.join('storefront-web', 'src'),
  path.join('frontend', 'src'),
]

const REPLACEMENTS = [
  [/shadow-primary\/500\/30/g, 'shadow-primary/30'],
  [/hover:shadow-primary\/300/g, 'hover:shadow-primary/40'],
  [/from-violet-600 to-blue-500/g, 'from-primary to-info'],
  [/from-violet-50 to-blue-50/g, 'from-accent to-info/15'],
  [/from-violet-600 via-blue-600 to-blue-700/g, 'from-primary via-info to-info'],
  [/from-violet-500 via-violet-600 to-blue-600/g, 'from-primary via-primary to-info'],
  [/from-violet-600 to-blue-500/g, 'from-primary to-info'],
  [/from-violet-400 to-blue-500/g, 'from-primary to-info'],
  [/from-violet-500\/10 to-blue-500\/10/g, 'from-primary/10 to-info/10'],
  [/from-emerald-500 to-violet-600/g, 'from-emerald-500 to-primary'],
  [/from-violet-100 to-indigo-200/g, 'from-accent to-primary/25'],
  [/from-violet-100 via-blue-50 to-indigo-100/g, 'from-accent via-info/10 to-primary/15'],
  [/from-violet-50 via-blue-50 to-indigo-50/g, 'from-accent via-info/10 to-primary/10'],
  [/from-violet-50\/40/g, 'from-accent/70'],
  [/from-violet-50\/30/g, 'from-accent/60'],
  [/from-violet-50/g, 'from-accent'],
  [/via-violet-50/g, 'via-accent'],
  [/to-violet-50/g, 'to-accent'],
  [/from-violet-100/g, 'from-accent'],
  [/hover:from-violet-500 hover:to-fuchsia-500/g, 'hover:from-primary/90 hover:to-emerald-700'],
  [/from-violet-600 to-indigo-700/g, 'from-primary to-emerald-800'],
  [/bg-violet-200/g, 'bg-primary/20'],
  [/bg-violet-100/g, 'bg-primary/15'],
  [/bg-violet-300/g, 'bg-primary/35'],
  [/bg-violet-400\//g, 'bg-primary/50/'],
  [/hover:bg-violet-200/g, 'hover:bg-primary/20'],
  [/hover:bg-violet-400/g, 'hover:bg-primary/50'],
  [/group-hover:bg-violet-400/g, 'group-hover:bg-primary/50'],
  [/group-hover\/resize:bg-violet-400/g, 'group-hover/resize:bg-primary/50'],
  [/bg-violet-400/g, 'bg-primary/50'],
  [/ring-violet-200/g, 'ring-primary/25'],
  [/ring-violet-500 ring-offset-1 ring-offset-gray-100/g, 'ring-ring ring-offset-1 ring-offset-gray-100'],
  [/ring-inset ring-violet-500/g, 'ring-inset ring-ring'],
  [/rgba\(124,58,237,0\.12\)/g, 'rgba(100,195,160,0.15)'],
  [/border-l-purple-500/g, 'border-l-primary'],
  [/border-purple-500/g, 'border-primary'],
  [/border-purple-100/g, 'border-primary/20'],
  [/border-purple-300/g, 'border-primary/40'],
  [/ring-purple-300/g, 'ring-primary/30'],
  [/ring-purple-100/g, 'ring-primary/15'],
  [/divide-purple-50/g, 'divide-primary/10'],
  [/bg-fuchsia-100 text-fuchsia-700/g, 'bg-accent text-primary'],
  [/bg-fuchsia-50/g, 'bg-accent'],
  [/text-fuchsia-700/g, 'text-primary'],
  [/border-l-fuchsia-500/g, 'border-l-primary'],
  [/bg-fuchsia-600/g, 'bg-primary'],
  [/to-fuchsia-50\/40/g, 'to-accent/60'],
  [/from-purple-400 to-violet-600/g, 'from-primary to-primary'],
  [/from-purple-400 to-primary/g, 'from-primary to-primary'],
  [/bg-fuchsia-500\/15 text-fuchsia-600 dark:text-fuchsia-400/g, 'bg-primary/15 text-primary dark:text-primary/80'],
  [/to-fuchsia-300/g, 'to-primary/30'],
  [/dark:bg-violet-400/g, 'dark:bg-primary/60'],
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
for (const root of roots) {
  const abs = path.join(process.cwd(), root)
  if (!fs.existsSync(abs)) continue
  for (const file of walk(abs)) {
    let s = fs.readFileSync(file, 'utf8')
    const orig = s
    for (const [re, rep] of REPLACEMENTS) {
      s = s.replace(re, rep)
    }
    // simple line fixes for ping animation
    s = s.replace(/bg-violet-400 opacity-40 animate-ping/g, 'bg-primary/60 opacity-40 animate-ping')
    s = s.replace(/rounded-full bg-violet-400"/g, 'rounded-full bg-primary/70"')
    if (s !== orig) {
      fs.writeFileSync(file, s, 'utf8')
      files++
    }
  }
}
console.log('Pass2 updated files:', files)
