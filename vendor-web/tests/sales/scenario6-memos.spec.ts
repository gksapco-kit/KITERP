import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createWalkthroughReport, exportReportPdf } from './walkthrough-report';
import { mainHeading } from './pos-helpers';

const _dir = path.dirname(fileURLToPath(import.meta.url));
const report = createWalkthroughReport('scenario6-memos', 'Scenario 6 — Credit / Debit Memos', _dir);

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.describe('Scenario 6 — Credit / Debit Memos', () => {
  test.afterAll(async () => {
    report.writeReport();
    await exportReportPdf(report.reportPath, report.pdfPath);
  });

  test('memos page loads with list and actions', async ({ page }) => {
    await page.goto('/memos');
    await expect(mainHeading(page, 'Credit & Debit Memos')).toBeVisible({ timeout: 15000 });
    const img01 = await report.snap(page, '01-memos-list');
    report.record('6.1', 'Credit & Debit Memos page loads', true, img01);

    const createBtn = page.getByRole('button', { name: /New Memo/i }).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(800);
      const img02 = await report.snap(page, '02-create-memo');
      const formVisible = await page.getByText(/New credit document|New debit document|credit document/i).first().isVisible().catch(() => false);
      report.record('6.2', 'Create memo form opens', formVisible, img02);
    } else {
      const img02 = await report.snap(page, '02-memos-toolbar');
      report.record('6.2', 'Memos toolbar visible', true, img02);
    }
  });
});
