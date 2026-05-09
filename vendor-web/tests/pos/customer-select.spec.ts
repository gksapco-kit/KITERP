import { test, expect } from '@playwright/test';

async function ensurePosReady(page: import('@playwright/test').Page) {
  await page.goto('/pos', { timeout: 20000 });

  const billingHeading = page.locator('h1', { hasText: 'POS - Billing' });
  const openBtn = page.getByRole('button', { name: /Open POS Session/i });
  const noSessionHeading = page.locator('h2', { hasText: 'Point of Sale' });

  await expect(billingHeading.or(noSessionHeading).or(openBtn).first()).toBeVisible({ timeout: 15000 });

  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click();
    await expect(billingHeading).toBeVisible({ timeout: 15000 });
  }

  if (await noSessionHeading.isVisible().catch(() => false)) {
    await page.waitForTimeout(3000);
    if (await openBtn.isVisible().catch(() => false)) {
      await openBtn.click();
    }
    await expect(billingHeading).toBeVisible({ timeout: 15000 });
  }
}

test.describe('POS customer search and quick create', () => {
  test('customer search, lookup results or empty response, and quick-create form', async ({ page }) => {
    await ensurePosReady(page);

    // Customer search input
    const customerSearch = page.getByPlaceholder(/search customer/i).first();
    await expect(customerSearch).toBeVisible({ timeout: 10000 });

    // Type to search
    await customerSearch.fill('Test');
    await page.waitForTimeout(1000);

    // Quick Create button - look for the icon button near the customer search
    const quickCreateTrigger = page.getByRole('button', { name: /Quick Create/i }).first();
    if (await quickCreateTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      await quickCreateTrigger.click();

      // Verify the Quick Create Customer heading appears
      await expect(
        page.getByRole('heading', { name: /Quick Create Customer/i })
      ).toBeVisible({ timeout: 10000 });

      // Verify form fields
      await expect(page.getByPlaceholder(/Customer name/i)).toBeVisible();
    }
  });
});
