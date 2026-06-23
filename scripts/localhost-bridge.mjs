/**
 * Optional proxy when Docker binds vendor/storefront on non-standard host ports.
 * Default compose maps 127.0.0.1:3001 and :3002 directly — bridge only needed if you
 * override ports (e.g. VENDOR_HOST_PORT=13001). Set KITERP_BRIDGE_VENDOR_TARGET /
 * KITERP_BRIDGE_STOREFRONT_TARGET to enable non-default targets.
 */
import http from 'node:http'
import httpProxy from 'http-proxy'

const vendorTarget = process.env.KITERP_BRIDGE_VENDOR_TARGET
const storefrontTarget = process.env.KITERP_BRIDGE_STOREFRONT_TARGET

const BRIDGES = [
  vendorTarget ? { listen: 3001, target: vendorTarget, label: 'vendor-web' } : null,
  storefrontTarget ? { listen: 3002, target: storefrontTarget, label: 'storefront-web' } : null,
].filter(Boolean)

if (BRIDGES.length === 0) {
  console.log('[localhost-bridge] No bridge targets set — compose uses 127.0.0.1:3001/:3002 directly.')
  console.log('[localhost-bridge] To proxy alternate ports: KITERP_BRIDGE_VENDOR_TARGET=http://127.0.0.1:13001 npm run dev:docker-bridge')
  process.exit(0)
}

for (const { listen, target, label } of BRIDGES) {
  const proxy = httpProxy.createProxyServer({
    target,
    ws: true,
    changeOrigin: true,
  })

  proxy.on('error', (err, _req, res) => {
    if (res && typeof res.writeHead === 'function' && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(
        `localhost bridge error (${label}): ${err.message}\n\n`
        + `Is Docker running? Try: docker compose up -d vendor-web storefront-web\n`,
      )
    }
  })

  const server = http.createServer((req, res) => {
    proxy.web(req, res, { target })
  })

  server.on('upgrade', (req, socket, head) => {
    proxy.ws(req, socket, head, { target })
  })

  server.listen(listen, () => {
    console.log(`[localhost-bridge] http://localhost:${listen} -> ${target} (${label})`)
  })
}

console.log('[localhost-bridge] Ready — use http://localhost:3001 and http://localhost:3002')
