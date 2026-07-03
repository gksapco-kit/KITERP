import { test, expect } from '@playwright/test';

test.describe('Store theme presets (light)', () => {
  test('website templates page shows light preset and theme customizer', async ({
    page,
  }) => {
    await page.goto('/websites/templates');

    await expect(page.getByRole('heading', { name: /Business Website Templates/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Light', { exact: true })).toBeVisible();
    await expect(page.getByText('Dark', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Customize' }).click();
    await expect(page.getByRole('heading', { name: /Customize store theme/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Product pages/i })).toHaveCount(0);
    await expect(page.getByText('Product Page Template')).toHaveCount(0);

    const preview = page.locator('[data-kiterp-modal]').locator('#store-theme-customizer').locator('.sticky.top-4').locator('div.rounded-xl.border-2.border-gray-200').first();
    await expect(preview).toBeVisible();

    await page.goto('/websites/templates?customize=1');
    await expect(page.getByRole('heading', { name: /Customize store theme/i })).toBeVisible({ timeout: 15000 });
  });
});
