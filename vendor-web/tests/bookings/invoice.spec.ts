import { test, expect } from '@playwright/test';

test.describe('Feature 17: Bookings and invoice linkage', () => {
  test('bookings list and API payload; invoices page loads', async ({ page }) => {
    const bookingsResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/vendors/me/bookings') &&
        res.request().method() === 'GET' &&
        res.ok(),
    );

    await page.goto('/bookings');
    const bookingsRes = await bookingsResponse;
    const bookingsJson = (await bookingsRes.json()) as {
      items?: Record<string, unknown>[];
    };

    await expect(page.getByRole('heading', { name: /^Bookings$/ })).toBeVisible();

    const items = bookingsJson.items ?? [];
    if (items.length > 0) {
      await expect(page.getByRole('columnheader', { name: /Total/i })).toBeVisible();
    }

    for (const row of items) {
      expect(row).toHaveProperty('invoice_id');
    }

    const completed = items.filter((b) => b.status === 'completed');
    for (const b of completed) {
      expect(b).toHaveProperty('invoice_id');
    }

    const invoicesResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/vendors/me/invoices') &&
        res.request().method() === 'GET' &&
        res.ok(),
    );

    await page.goto('/invoices');
    await invoicesResponse;

    await expect(page.getByRole('heading', { name: /Invoices & Billing/i })).toBeVisible();

    const listReady = page
      .getByRole('columnheader', { name: /Invoice #/i })
      .or(page.getByText('No invoices yet'));
    await expect(listReady.first()).toBeVisible({ timeout: 15000 });
  });
});
