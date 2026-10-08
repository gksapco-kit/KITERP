import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const routesPath = path.join(__dirname, '../src/routes/index.tsx')
const outPath = path.join(__dirname, '../src/lib/vendorRoutePrefetch.ts')
const text = fs.readFileSync(routesPath, 'utf8')

const lazyMap = new Map()
const lazyRe = /const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\('([^']+)'\)\)/g
let m
while ((m = lazyRe.exec(text))) lazyMap.set(m[1], m[2])

const routes = new Map()
for (const line of text.split('\n')) {
  let pm = line.match(/\{\s*path:\s*'([^']+)',\s*element:\s*<(\w+)/)
  if (pm && lazyMap.has(pm[2])) {
    routes.set(pm[1], lazyMap.get(pm[2]))
    continue
  }
  pm = line.match(/\{\s*path:\s*'([^']+)',\s*element:\s*<PermissionRoute[^>]*><(\w+)/)
  if (pm && lazyMap.has(pm[2])) {
    routes.set(pm[1], lazyMap.get(pm[2]))
    continue
  }
  pm = line.match(/\{\s*path:\s*'([^']+)',\s*element:\s*<VendorAdminRoute><(\w+)/)
  if (pm && lazyMap.has(pm[2])) {
    routes.set(pm[1], lazyMap.get(pm[2]))
  }
}

const entries = [...routes.entries()].sort((a, b) => a[0].localeCompare(b[0]))
const loaderLines = entries
  .map(([p, imp]) => `  ${JSON.stringify('/' + p.replace(/^\//, ''))}: () => import(${JSON.stringify(imp)}),`)
  .join('\n')

const out = `/** Prefetch lazy page chunks on sidebar hover — map built from routes/index.tsx */
const LOADERS: Record<string, () => Promise<unknown>> = {
${loaderLines}
}

export function prefetchVendorRoute(pathname: string): void {
  const path = (pathname.split('?')[0] || '/').replace(/\\/+$/, '') || '/'
  let loader = LOADERS[path]
  if (!loader) {
    const parts = path.split('/').filter(Boolean)
    while (parts.length && !loader) {
      parts.pop()
      const candidate = parts.length ? \`/\${parts.join('/')}\` : '/'
      loader = LOADERS[candidate]
    }
  }
  if (loader) void loader()
}
`

fs.writeFileSync(outPath, out)
console.log(`Wrote ${entries.length} route prefetch entries to ${outPath}`)
