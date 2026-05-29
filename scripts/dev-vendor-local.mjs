/**
 * Start vendor-web on :3001 for local development.
 * Stops Docker `vendor-web` first so the port is free (avoids "Port 3001 is already in use").
 */
import { spawn, execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vendorDir = path.join(root, 'vendor-web')

console.log('\n  Freeing port 3001 (stopping Docker vendor-web if running)...\n')
try {
  execSync('docker compose stop vendor-web', { cwd: root, stdio: 'inherit' })
} catch {
  /* Docker not running or container already stopped */
}

const child = spawn('npm', ['run', 'dev'], {
  cwd: vendorDir,
  stdio: 'inherit',
  shell: true,
})

child.on('exit', (code) => process.exit(code ?? 0))
