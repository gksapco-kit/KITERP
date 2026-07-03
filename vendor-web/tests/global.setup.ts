import { test as setup, expect } from '@playwright/test';

const VENDOR_EMAIL = process.env.TEST_VENDOR_EMAIL || 'vendor@kiterp.com';
const VENDOR_PASSWORD = process.env.TEST_VENDOR_PASSWORD || 'vendor123';

async function blockLoopbackRedirect(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '[::1]') return;
    const replace = window.location.replace.bind(window.location);
    window.location.replace = (url: string | URL) => {
      try {
        const next = new URL(String(url), window.location.href);
        if (next.hostname === '127.0.0.1') return;
      } catch {
        /* ignore */
      }
      replace(url);
    };
  });
}

setup('authenticate as vendor', async ({ page }) => {
  await blockLoopbackRedirect(page);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
    const apiDown = page.getByText('API server is not reachable');
    if (await apiDown.isVisible({ timeout: 8000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Retry check' }).click().catch(() => {});
      await page.waitForTimeout(3000);
      continue;
    }
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 30000 });
    await page.locator('#login').fill(VENDOR_EMAIL);
    await page.locator('#password').fill(VENDOR_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 120000 });
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible({ timeout: 120000 });
    await page.context().storageState({ path: 'tests/.auth/vendor.json' });
    return;
  }
  throw new Error('Vendor UI login failed after retries');
});
