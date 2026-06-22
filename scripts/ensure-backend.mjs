/**
 * Ensures the FastAPI backend on :8000 is reachable before starting LOCAL Vite dev servers.
 * Starts only postgres + redis + backend in Docker (not the frontend containers).
 *
 * For Docker-hosted frontends (3000/3001/3002), use: npm run dev:docker
 * Set SKIP_ENSURE_BACKEND=1 to skip (e.g. when running uvicorn locally).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const HEALTH_URL = process.env.KITERP_BACKEND_HEALTH_URL || 'http://127.0.0.1:8000/health'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TIMEOUT_MS = Number(process.env.KITERP_BACKEND_WAIT_MS || 90_000)
const POLL_MS = 1500
const LOCK_FILE = path.join(os.tmpdir(), 'kiterp-ensure-backend.lock')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function pingHealth() {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 4000)
  try {
    const response = await fetch(HEALTH_URL, { signal: ac.signal, cache: 'no-store' })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

function startDockerBackend() {
  console.log('\n[kiterp] Backend not reachable — starting Docker: postgres, redis, backend…\n')
  const result = spawnSync('docker', ['compose', 'up', '-d', 'postgres', 'redis', 'backend'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    console.error('\n[kiterp] Failed to start backend via Docker.')
    console.error('  • Is Docker Desktop running?')
    console.error('  • Or run manually: docker compose up -d postgres redis backend')
    console.error('  • For Docker frontends too: npm run dev:docker')
    console.error(`  • Then verify: ${HEALTH_URL}\n`)
    process.exit(result.status ?? 1)
  }
}

async function waitForBackend(label = '') {
  const deadline = Date.now() + TIMEOUT_MS
  process.stdout.write(`[kiterp${label}] Waiting for backend`)
  while (Date.now() < deadline) {
    if (await pingHealth()) {
      console.log(`\n[kiterp${label}] Backend is ready.\n`)
      return
    }
    process.stdout.write('.')
    await sleep(POLL_MS)
  }

  console.error(`\n[kiterp${label}] Backend did not become ready in time.`)
  console.error('  Check: docker compose logs backend --tail 50')
  console.error(`  Health URL: ${HEALTH_URL}\n`)
  process.exit(1)
}

function acquireLock() {
  try {
    const fd = fs.openSync(LOCK_FILE, 'wx')
    fs.writeFileSync(fd, String(process.pid))
    fs.closeSync(fd)
    return true
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EEXIST') return false
    throw err
  }
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK_FILE)
  } catch {
    /* ignore */
  }
}

async function waitForPeerLock() {
  const deadline = Date.now() + TIMEOUT_MS
  process.stdout.write('[kiterp] Another dev process is starting the backend')
  while (Date.now() < deadline) {
    if (await pingHealth()) {
      console.log('\n[kiterp] Backend OK (started by another process):', HEALTH_URL)
      return
    }
    if (!fs.existsSync(LOCK_FILE)) {
      if (await pingHealth()) {
        console.log('\n[kiterp] Backend OK:', HEALTH_URL)
        return
      }
      break
    }
    process.stdout.write('.')
    await sleep(POLL_MS)
  }
  await waitForBackend(' (peer wait)')
}

async function main() {
  if (process.env.SKIP_ENSURE_BACKEND === '1') {
    console.log('[kiterp] SKIP_ENSURE_BACKEND=1 — skipping backend check')
    return
  }

  if (await pingHealth()) {
    console.log('[kiterp] Backend OK:', HEALTH_URL)
    return
  }

  const ownsLock = acquireLock()
  if (!ownsLock) {
    await waitForPeerLock()
    return
  }

  try {
    startDockerBackend()
    await waitForBackend()
  } finally {
    releaseLock()
  }
}

main()
