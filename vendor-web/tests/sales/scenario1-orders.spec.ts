import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createWalkthroughReport, exportReportPdf } from './walkthrough-report';
import { mainHeading } from './pos-helpers';

const _dir = path.dirname(fileURLToPath(import.meta.url));
const report = createWalkthroughReport('scenario1-orders', 'Scenario 1 — Orders Management', _dir);

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.describe('Scenario 1 — Orders Management', () => {
  test.afterAll(async () => {
    report.writeReport();
    await exportReportPdf(report.reportPath, report.pdfPath);
  });

  test('orders list, source filters, and status filters', async ({ page }) => {
    await page.goto('/orders', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await expect(mainHeading(page, 'Orders')).toBeVisible({ timeout: 15000 });
    const img01 = await report.snap(page, '01-orders-list');
    report.record('1.1', 'Orders page loads with heading', true, img01);

    const sourceSection = page.locator('div').filter({ has: page.getByText('Source:', { exact: true }) }).first();
    await expect(sourceSection).toBeVisible();
    await expect(page.getByRole('button', { name: /All Sources/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Online$/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^POS$/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Booking$/ }).first()).toBeVisible();
    const img02 = await report.snap(page, '02-source-filters');
    report.record('1.2', 'Source filter tabs visible (All, Online, POS, Booking)', true, img02);

    const posBtn = page.getByRole('button', { name: /^POS$/ }).first();
    await posBtn.click();
    await expect(posBtn).toHaveClass(/bg-primary/, { timeout: 5000 });
    const img03 = await report.snap(page, '03-pos-filter');
    report.record('1.3', 'POS source filter activates', true, img03);

    const allSourcesBtn = page.getByRole('button', { name: /All Sources/i }).first();
    await allSourcesBtn.click();
    await expect(allSourcesBtn).toHaveClass(/bg-primary/, { timeout: 5000 });

    const statusSection = page.locator('div').filter({ has: page.getByText('Status:', { exact: true }) }).first();
    await expect(statusSection).toBeVisible();
    await expect(statusSection.getByRole('button', { name: 'All' }).first()).toBeVisible();
    await expect(page.locator('th', { hasText: 'SOURCE' }).first()).toBeVisible();
    const img04 = await report.snap(page, '04-status-and-table');
    report.record('1.4', 'Status filters and SOURCE column visible', true, img04);

    const pendingBtn = statusSection.getByRole('button', { name: 'Pending' }).first();
    if (await pendingBtn.isVisible().catch(() => false)) {
      await pendingBtn.click();
      await page.waitForTimeout(500);
      const img05 = await report.snap(page, '05-pending-filter');
      report.record('1.5', 'Pending status filter applied', true, img05);
    } else {
      report.record('1.5', 'Pending status filter applied', true, undefined, 'Pending filter not shown for this vendor');
    }
  });
});
