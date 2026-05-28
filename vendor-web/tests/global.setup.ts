import { test as setup, expect } from '@playwright/test';

const VENDOR_EMAIL = process.env.TEST_VENDOR_EMAIL || 'vendor@kiterp.com';
const VENDOR_PASSWORD = process.env.TEST_VENDOR_PASSWORD || 'vendor123';

setup('authenticate as vendor', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('text=User Login')).toBeVisible({ timeout: 10000 });

  await page.fill('#login', VENDOR_EMAIL);
  await page.fill('#password', VENDOR_PASSWORD);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('**/', { timeout: 15000 });
  await expect(page).not.toHaveURL(/.*login.*/);

  // Save auth state
  await page.context().storageState({ path: 'tests/.auth/vendor.json' });
});
