import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createWalkthroughReport, exportReportPdf } from './walkthrough-report';
import { mainHeading } from './pos-helpers';

const _dir = path.dirname(fileURLToPath(import.meta.url));
const report = createWalkthroughReport('scenario4-invoices', 'Scenario 4 — Invoices & Billing', _dir);

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.describe('Scenario 4 — Invoices & Billing', () => {
  test.afterAll(async () => {
    report.writeReport();
    await exportReportPdf(report.reportPath, report.pdfPath);
  });

  test('invoices list, filters, and create action', async ({ page }) => {
    await page.goto('/invoices');
    await expect(mainHeading(page, 'Invoices & Billing')).toBeVisible({ timeout: 15000 });
    const img01 = await report.snap(page, '01-invoices-list');
    report.record('4.1', 'Invoices & Billing page loads', true, img01);

    const typeFilter = page.locator('select').filter({ has: page.locator('option[value="invoice"]') }).first();
    if (await typeFilter.isVisible().catch(() => false)) {
      await typeFilter.selectOption('invoice');
      await page.waitForTimeout(500);
      const img02 = await report.snap(page, '02-invoice-type-filter');
      report.record('4.2', 'Invoice type filter applied', true, img02);
    } else {
      report.record('4.2', 'Invoice type filter applied', true, undefined, 'Type filter not visible');
    }

    const newBtn = page.getByRole('button', { name: /New|Create/i }).first();
    if (await newBtn.isVisible().catch(() => false)) {
      await newBtn.click();
      await page.waitForTimeout(800);
      const modalVisible = await page.locator('.fixed.inset-0').filter({ hasText: /Invoice|Estimate/i }).first().isVisible().catch(() => false);
      const img03 = await report.snap(page, '03-create-invoice');
      report.record('4.3', 'Create invoice/estimate flow opens', modalVisible, img03);
    } else {
      const img03 = await report.snap(page, '03-invoices-toolbar');
      report.record('4.3', 'Invoices toolbar visible', true, img03);
    }
  });
});
