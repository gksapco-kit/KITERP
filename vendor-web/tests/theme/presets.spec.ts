import { test, expect } from '@playwright/test';

test.describe('Feature 18: Theme presets for business categories', () => {
  test('template page lists category presets and Live Preview updates when a preset is applied', async ({
    page,
  }) => {
    await page.goto('/template');

    await expect(page.getByRole('heading', { name: /Store Template/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Customize your storefront appearance/i)).toBeVisible();

    await expect(page.getByRole('button', { name: /Templates/i })).toBeVisible();

    const presetNames = [
      /Fashion & Apparel/i,
      /Clinic \/ Healthcare/i,
      /Grocery & Supermarket/i,
      /Jewellery & Luxury/i,
      /Laundry & Dry Cleaning/i,
      /Pharmacy & Medicine/i,
      /Food & Bakery/i,
    ];
    for (const pattern of presetNames) {
      await expect(page.getByRole('button', { name: pattern }).first()).toBeVisible();
    }

    const preview = page.locator('.sticky.top-4').locator('div.rounded-xl.border-2.border-gray-200').first();
    await expect(preview).toBeVisible();

    // Apply Fashion preset first to ensure we have a known state
    const fashionPromise = page.waitForResponse(
      (res) => res.url().includes('/template/apply-preset/') && res.request().method() === 'POST' && res.ok(),
      { timeout: 15000 },
    );
    await page.getByRole('button', { name: /Fashion & Apparel/i }).first().click();
    await fashionPromise;

    // Record the background after Fashion preset
    await page.waitForTimeout(1000);
    const fashionBg = await preview.evaluate((el) => getComputedStyle(el).backgroundColor);

    // Now apply Grocery preset
    const groceryPromise = page.waitForResponse(
      (res) => res.url().includes('/template/apply-preset/') && res.request().method() === 'POST' && res.ok(),
      { timeout: 15000 },
    );
    await page.getByRole('button', { name: /Grocery & Supermarket/i }).first().click();
    await groceryPromise;

    // Verify background changed from Fashion to Grocery
    await expect
      .poll(async () => preview.evaluate((el) => getComputedStyle(el).backgroundColor), {
        timeout: 15000,
      })
      .not.toBe(fashionBg);
  });
});
