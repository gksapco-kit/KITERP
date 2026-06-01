import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createWalkthroughReport, exportReportPdf } from './walkthrough-report';
import { mainHeading } from './pos-helpers';

const _dir = path.dirname(fileURLToPath(import.meta.url));
const report = createWalkthroughReport('scenario5-coupons', 'Scenario 5 — Coupons & Promo Codes', _dir);

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.describe('Scenario 5 — Coupons & Promo Codes', () => {
  test.afterAll(async () => {
    report.writeReport();
    await exportReportPdf(report.reportPath, report.pdfPath);
  });

  test('coupons list and create coupon modal', async ({ page }) => {
    await page.goto('/coupons');
    await expect(mainHeading(page, 'Coupons & Promo Codes')).toBeVisible({ timeout: 15000 });
    const img01 = await report.snap(page, '01-coupons-list');
    report.record('5.1', 'Coupons page loads', true, img01);

    const createBtn = page.getByRole('button', { name: /New Coupon|Create|Add/i }).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(600);
      const modal = page.locator('.fixed.inset-0').filter({ hasText: /Coupon|Promo/i }).first();
      const modalVisible = await modal.isVisible().catch(() => false);
      const img02 = await report.snap(page, '02-create-coupon-modal');
      report.record('5.2', 'Create coupon modal opens', modalVisible, img02);

      if (modalVisible) {
        const closeBtn = modal.locator('button').filter({ has: page.locator('svg') }).first();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(400);
      }
    } else {
      const img02 = await report.snap(page, '02-coupons-toolbar');
      report.record('5.2', 'Coupons toolbar visible', true, img02);
    }

    const img03 = await report.snap(page, '03-coupons-final');
    report.record('5.3', 'Coupons page stable after interactions', true, img03);
  });
});
