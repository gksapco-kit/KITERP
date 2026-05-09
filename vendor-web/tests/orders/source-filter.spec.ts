import { test, expect } from '@playwright/test';

test.describe('Orders list source filter', () => {
  test('Source tabs, Online/POS selection, All Sources reset, Source column, Status filter', async ({
    page,
  }) => {
    await page.goto('/orders', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 15000 });

    const sourceSection = page.locator('div').filter({ has: page.getByText('Source:', { exact: true }) }).first();
    await expect(sourceSection).toBeVisible();

    await expect(page.getByRole('button', { name: /All Sources/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Online$/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^POS$/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Booking$/ }).first()).toBeVisible();

    const onlineBtn = page.getByRole('button', { name: /^Online$/ }).first();
    await onlineBtn.click();
    await expect(onlineBtn).toHaveClass(/bg-primary/, { timeout: 5000 });

    const posBtn = page.getByRole('button', { name: /^POS$/ }).first();
    await posBtn.click();
    await expect(posBtn).toHaveClass(/bg-primary/, { timeout: 5000 });
    await expect(onlineBtn).not.toHaveClass(/bg-primary/);

    const allSourcesBtn = page.getByRole('button', { name: /All Sources/i }).first();
    await allSourcesBtn.click();
    await expect(allSourcesBtn).toHaveClass(/bg-primary/, { timeout: 5000 });

    await expect(page.locator('th', { hasText: 'SOURCE' }).first()).toBeVisible();

    const statusSection = page.locator('div').filter({ has: page.getByText('Status:', { exact: true }) }).first();
    await expect(statusSection).toBeVisible();
    await expect(statusSection.getByRole('button', { name: 'All' }).first()).toBeVisible();
  });
});
