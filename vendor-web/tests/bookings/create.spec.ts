import { test, expect } from '@playwright/test';

test.describe('Feature 16: Vendor booking creation with customer selection', () => {
  test('New Booking opens modal with required fields and can be closed', async ({ page }) => {
    await page.goto('/bookings');

    await expect(page.getByRole('heading', { name: /^Bookings$/ })).toBeVisible();

    const newBookingBtn = page.getByRole('button', { name: /New Booking/i }).first();
    await expect(newBookingBtn).toBeVisible();
    await newBookingBtn.click();

    const dialog = page.locator('.fixed.inset-0.z-50').filter({ hasText: 'Create Booking' });
    await expect(dialog).toBeVisible();

    await expect(dialog.getByPlaceholder(/Search customer/i)).toBeVisible();

    await expect(dialog.getByText('Service *', { exact: true })).toBeVisible();
    await expect(dialog.locator('select').first()).toBeVisible();

    await expect(dialog.getByText('Date *', { exact: true })).toBeVisible();
    await expect(dialog.locator('input[type="date"]').first()).toBeVisible();

    await expect(dialog.getByText('Start Time', { exact: true })).toBeVisible();
    await expect(dialog.locator('input[type="time"]').first()).toBeVisible();

    await expect(dialog.getByText('Payment Method', { exact: true })).toBeVisible();
    const paymentSelect = dialog.locator('select').filter({ has: page.locator('option[value="cod"]') }).first();
    await expect(paymentSelect).toBeVisible();

    await expect(dialog.getByText('Notes', { exact: true })).toBeVisible();
    await expect(dialog.locator('textarea').first()).toBeVisible();

    await expect(dialog.getByRole('button', { name: /Create Booking/i })).toBeVisible();

    await dialog
      .locator('div.flex.items-center.justify-between')
      .filter({ hasText: 'Create Booking' })
      .getByRole('button')
      .first()
      .click();
    await expect(dialog).toBeHidden();
  });
});
