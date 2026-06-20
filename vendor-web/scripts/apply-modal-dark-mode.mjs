/**
 * One-off bulk pass: align inline modal/popover shells with modalUi tokens.
 * Safe targets: shadow + max-h viewports, sticky modal headers, popover menus.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.join(import.meta.dirname, '..', 'src')

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name !== 'node_modules') walk(p, out)
    } else if (/\.tsx?$/.test(ent.name) && !ent.name.endsWith('.bak')) {
      out.push(p)
    }
  }
  return out
}

const literalReplacements = [
  // Modal panel shells (shadow + viewport height = dialog)
  ['bg-white rounded-xl shadow-xl w-full', 'bg-card border border-border text-foreground rounded-xl shadow-2xl w-full'],
  ['bg-white rounded-xl shadow-2xl w-full', 'bg-card border border-border text-foreground rounded-xl shadow-2xl w-full'],
  ['bg-white rounded-2xl shadow-2xl w-full', 'bg-card border border-border text-foreground rounded-2xl shadow-2xl w-full'],
  ['bg-white rounded-2xl shadow-xl w-full', 'bg-card border border-border text-foreground rounded-2xl shadow-2xl w-full'],
  ['relative bg-white rounded-2xl shadow-2xl w-full', 'relative bg-card border border-border text-foreground rounded-2xl shadow-2xl w-full'],
  ['w-full max-w-lg bg-white rounded-xl shadow-xl', 'w-full max-w-lg bg-card border border-border text-foreground rounded-xl shadow-2xl'],
  ['bg-white rounded-xl w-full max-w-md shadow-xl', 'bg-card border border-border text-foreground rounded-xl w-full max-w-md shadow-2xl'],
  ['bg-white rounded-xl shadow-xl max-w-sm w-full', 'bg-card border border-border text-foreground rounded-xl shadow-2xl max-w-sm w-full'],
  ['bg-white rounded-xl shadow-xl max-w-lg w-full', 'bg-card border border-border text-foreground rounded-xl shadow-2xl max-w-lg w-full'],
  ['bg-white rounded-xl shadow-xl w-full max-w-sm mx-4', 'bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-sm mx-4'],
  ['bg-white rounded-xl shadow-xl w-full max-w-md mx-4', 'bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-md mx-4'],
  ['bg-white rounded-xl shadow-xl w-full max-w-lg mx-4', 'bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-lg mx-4'],
  ['bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4', 'bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-2xl mx-4'],
  ['bg-white rounded-xl shadow-xl w-full max-w-xl mx-4', 'bg-card border border-border text-foreground rounded-xl shadow-2xl w-full max-w-xl mx-4'],
  ['bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4', 'bg-card border border-border text-foreground rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4'],
  ['bg-white rounded-2xl shadow-2xl max-w-lg w-full', 'bg-card border border-border text-foreground rounded-2xl shadow-2xl max-w-lg w-full'],
  ['bg-white rounded-2xl shadow-2xl max-w-2xl w-full', 'bg-card border border-border text-foreground rounded-2xl shadow-2xl max-w-2xl w-full'],
  ['bg-white rounded-2xl shadow-2xl max-w-3xl w-full', 'bg-card border border-border text-foreground rounded-2xl shadow-2xl max-w-3xl w-full'],
  ['bg-white rounded-xl shadow-xl max-w-3xl w-full', 'bg-card border border-border text-foreground rounded-xl shadow-2xl max-w-3xl w-full'],
  ['bg-white rounded-2xl border shadow-lg overflow-hidden max-h-[90vh]', 'bg-card border border-border text-foreground rounded-2xl shadow-2xl overflow-hidden max-h-[90vh]'],
  // Sticky modal headers
  ['border-b sticky top-0 bg-white z-10', 'border-b border-border sticky top-0 bg-card z-10'],
  ['border-b sticky top-0 bg-white/95 z-10', 'border-b border-border sticky top-0 bg-card/95 z-10'],
  // Popover / dropdown menus inside tables
  ['bg-white rounded-lg border shadow-lg z-50 py-1 max-h-[90vh]', 'bg-popover text-popover-foreground rounded-lg border border-border shadow-lg z-50 py-1 max-h-[90vh]'],
  ['w-44 bg-white rounded-lg border shadow-lg py-1', 'w-44 bg-popover text-popover-foreground rounded-lg border border-border shadow-lg py-1'],
  // Common modal header/footer dividers
  ['border-b border-gray-100 flex', 'border-b border-border flex'],
  ['border-t border-gray-100 flex', 'border-t border-border bg-muted/25 flex'],
  ['border-t border-gray-100 px', 'border-t border-border bg-muted/25 px'],
  ['border-t border-gray-100 p', 'border-t border-border bg-muted/25 p'],
  // Close buttons (modal pattern)
  ['p-1.5 hover:bg-gray-100 rounded-lg', 'p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted'],
  ['p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100', 'p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted'],
  // Variant panel shells missed in pass 1
  ['bg-white rounded-xl w-full max-w-lg shadow-xl', 'bg-card border border-border text-foreground rounded-xl w-full max-w-lg shadow-2xl'],
  ['bg-white border rounded-xl shadow-sm overflow-hidden max-h-[90vh]', 'bg-card border border-border text-foreground rounded-xl shadow-2xl overflow-hidden max-h-[90vh]'],
  ['bg-white border rounded-xl shadow-sm max-h-[90vh]', 'bg-card border border-border text-foreground rounded-xl shadow-2xl max-h-[90vh]'],
  ['bg-white border rounded-xl shadow-sm p-4 max-h-[90vh]', 'bg-card border border-border text-foreground rounded-xl shadow-2xl p-4 max-h-[90vh]'],
  ['bg-white border rounded-xl shadow-sm p-5 max-h-[90vh]', 'bg-card border border-border text-foreground rounded-xl shadow-2xl p-5 max-h-[90vh]'],
  ['bg-white border rounded-xl shadow-sm max-h-[90vh] overflow-y-auto', 'bg-card border border-border text-foreground rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto'],
  ['bg-white rounded-xl border shadow-sm overflow-hidden max-h-[90vh]', 'bg-card border border-border text-foreground rounded-xl shadow-2xl overflow-hidden max-h-[90vh]'],
  ['bg-white rounded-xl border shadow-sm p-4 max-h-[90vh]', 'bg-card border border-border text-foreground rounded-xl shadow-2xl p-4 max-h-[90vh]'],
  ['bg-white rounded-xl border shadow-sm p-5 mb-6', 'bg-card border border-border text-foreground rounded-xl shadow-2xl p-5 mb-6'],
  ['bg-white rounded-xl border shadow-sm p-4 mb-4', 'bg-card border border-border text-foreground rounded-xl shadow-2xl p-4 mb-4'],
  // Floating popovers / pickers
  ['bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden', 'bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl overflow-hidden'],
  ['bg-white border border-gray-200 rounded-xl shadow-xl', 'bg-popover text-popover-foreground border border-border rounded-xl shadow-xl'],
  ['absolute right-0 top-8 z-20 bg-white border border-gray-200 rounded-xl shadow-xl', 'absolute right-0 top-8 z-20 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl'],
  ['absolute right-0 top-10 z-50 w-72 bg-white rounded-xl border shadow-xl', 'absolute right-0 top-10 z-50 w-72 bg-popover text-popover-foreground rounded-xl border border-border shadow-xl'],
  ['absolute top-full left-0 z-50 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl', 'absolute top-full left-0 z-50 mt-1 w-72 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl'],
  ['absolute left-0 top-full mt-2 w-[380px] bg-white border border-gray-200 rounded-2xl shadow-xl', 'absolute left-0 top-full mt-2 w-[380px] bg-popover text-popover-foreground border border-border rounded-2xl shadow-xl'],
  ['absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-xl', 'absolute right-0 top-full mt-2 bg-popover text-popover-foreground border border-border rounded-2xl shadow-xl'],
  // Builder / design floating panels
  ['w-[380px] max-w-[92vw] bg-white border border-gray-200 rounded-2xl shadow-2xl', 'w-[380px] max-w-[92vw] bg-card border border-border text-foreground rounded-2xl shadow-2xl'],
  ['w-[460px] max-w-[94vw] bg-white border border-gray-200 rounded-2xl shadow-2xl', 'w-[460px] max-w-[94vw] bg-card border border-border text-foreground rounded-2xl shadow-2xl'],
  ['bg-white border border-gray-200 rounded-xl shadow-2xl p-2 w-[', 'bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl p-2 w-['],
  ['absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg', 'absolute z-50 mt-1 w-full bg-popover text-popover-foreground border border-border rounded-lg shadow-lg'],
  // CreateCalendarModal border
  ['border border-slate-200', 'border border-border'],
]

const regexReplacements = [
  // Standardize overlay darkness + blur
  [
    /(className="[^"]*fixed inset-0 z-50[^"]*)bg-black\/40/g,
    '$1bg-black/50 backdrop-blur-sm',
  ],
  [
    /(className="[^"]*fixed inset-0 z-\[60\][^"]*)bg-black\/40/g,
    '$1bg-black/50 backdrop-blur-sm',
  ],
  // Add data-kiterp-modal to overlay divs missing it
  [
    /<div(\s+)(?!data-kiterp-modal)(className="fixed inset-0 z-50)/g,
    '<div data-kiterp-modal$1$2',
  ],
  [
    /<div(\s+)(?!data-kiterp-modal)(className="fixed inset-0 z-\[60\])/g,
    '<div data-kiterp-modal$1$2',
  ],
]

let changedFiles = 0
for (const file of walk(ROOT)) {
  let text = fs.readFileSync(file, 'utf8')
  const before = text
  for (const [from, to] of literalReplacements) {
    text = text.split(from).join(to)
  }
  for (const [re, to] of regexReplacements) {
    text = text.replace(re, to)
  }
  if (text !== before) {
    fs.writeFileSync(file, text, 'utf8')
    changedFiles++
    console.log('updated:', path.relative(ROOT, file))
  }
}
console.log(`Done. ${changedFiles} file(s) updated.`)
