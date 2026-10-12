import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Unit tests for pure library code. The Playwright end-to-end tests live in ./tests and are run
// separately with `npm test`, so only pick up *.test.ts files under src/.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
