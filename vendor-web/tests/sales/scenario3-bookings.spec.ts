import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createWalkthroughReport, exportReportPdf } from './walkthrough-report';
import { mainHeading } from './pos-helpers';

const _dir = path.dirname(fileURLToPath(import.meta.url));
const report = createWalkthroughReport('scenario3-bookings', 'Scenario 3 — Bookings', _dir);

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.describe('Scenario 3 — Bookings', () => {
  test.afterAll(async () => {
    report.writeReport();
    await exportReportPdf(report.reportPath, report.pdfPath);
  });

  test('bookings page and new booking modal', async ({ page }) => {
    await page.goto('/bookings');
    await expect(mainHeading(page, /^Bookings$/)).toBeVisible({ timeout: 15000 });
    const img01 = await report.snap(page, '01-bookings-list');
    report.record('3.1', 'Bookings page loads', true, img01);

    const newBookingBtn = page.getByRole('button', { name: /New Booking/i }).first();
    await expect(newBookingBtn).toBeVisible();
    await newBookingBtn.click();

    const dialog = page.locator('.fixed.inset-0.z-50').filter({ hasText: 'New Booking' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder(/Search name, phone, email/i)).toBeVisible();
    await expect(dialog.getByText('Service *', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Date *', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Time Slot', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Payment', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Create Booking/i })).toBeVisible();
    const img02 = await report.snap(page, '02-create-booking-modal');
    report.record('3.2', 'New Booking modal with required fields', true, img02);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden({ timeout: 5000 });
    const img03 = await report.snap(page, '03-modal-closed');
    report.record('3.3', 'Modal closes cleanly', true, img03);
  });
});
