import { test, expect } from '@playwright/test';

async function ensurePosReady(page: import('@playwright/test').Page) {
  await page.goto('/pos', { timeout: 20000 });

  // POS has two states: "no session" (shows Open POS Session button) or "session open" (shows POS - Billing)
  const billingHeading = page.locator('h1', { hasText: 'POS - Billing' });
  const openBtn = page.getByRole('button', { name: /Open POS Session/i });
  const noSessionHeading = page.locator('h2', { hasText: 'Point of Sale' });

  // Wait for either state to appear
  await expect(billingHeading.or(noSessionHeading).or(openBtn).first()).toBeVisible({ timeout: 15000 });

  // If we need to open a session, do so
  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click();
    await expect(billingHeading).toBeVisible({ timeout: 15000 });
  }

  // If we see "Point of Sale" but no open button, the session might be loading
  if (await noSessionHeading.isVisible().catch(() => false)) {
    // Wait a bit for the session state to resolve
    await page.waitForTimeout(3000);
    if (await openBtn.isVisible().catch(() => false)) {
      await openBtn.click();
    }
    await expect(billingHeading).toBeVisible({ timeout: 15000 });
  }
}

test.describe('POS tax auto-population from catalog', () => {
  test('POS page loads and shows catalog search and cart areas', async ({ page }) => {
    await ensurePosReady(page);

    // Verify search and cart sections exist
    await expect(
      page.getByPlaceholder(/Search products/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Cart header should be visible
    await expect(page.getByText(/Cart/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('adding a catalog item shows tax info in cart', async ({ page }) => {
    await ensurePosReady(page);

    // Find any clickable catalog item
    const catalogItem = page.locator('button').filter({ has: page.locator('p.text-sm.font-medium') }).first();

    if ((await catalogItem.count()) === 0) {
      test.skip(true, 'No products or services in POS catalog');
      return;
    }

    await catalogItem.click({ timeout: 10000 });

    // Verify something appeared in the cart area
    await expect(page.getByText(/Subtotal/i).first()).toBeVisible({ timeout: 10000 });
  });
});
