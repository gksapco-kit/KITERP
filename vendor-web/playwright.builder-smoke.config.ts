import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/websites',
  testMatch: 'builder-smoke.spec.ts',
  workers: 1,
  timeout: 180000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 60000,
    actionTimeout: 30000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
