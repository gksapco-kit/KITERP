import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  workers: 1,
  timeout: 240000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    navigationTimeout: 120000,
    actionTimeout: 60000,
  },
  projects: [
    {
      name: 'setup',
      testDir: './tests',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      testDir: './tests/websites',
      testMatch: 'builder-smoke.spec.ts',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: 'tests/.auth/vendor.json' },
    },
  ],
})
