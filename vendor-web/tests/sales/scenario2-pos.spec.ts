import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { apiLogin, ensureProduct, ensurePosSessionOpen, ensureSalesModules } from './api-helpers';
import { ensurePosReady } from './pos-helpers';
import { createWalkthroughReport, exportReportPdf } from './walkthrough-report';

const _dir = path.dirname(fileURLToPath(import.meta.url));
const report = createWalkthroughReport('scenario2-pos', 'Scenario 2 — POS Billing', _dir);

test.describe.configure({ mode: 'serial', timeout: 180_000 });

test.describe('Scenario 2 — POS Billing', () => {
  let productName = 'Sales Test Widget';

  test.beforeAll(async ({ request }) => {
    const auth = await apiLogin(request);
    await ensureSalesModules(request, auth);
    const product = await ensureProduct(request, auth, {
      name: productName,
      price: 299,
      category: 'General',
    });
    productName = product.name;
    await ensurePosSessionOpen(request, auth);
  });

  test.afterAll(async () => {
    report.writeReport();
    await exportReportPdf(report.reportPath, report.pdfPath);
  });

  test('open POS, add catalog item, and complete cash sale', async ({ page }) => {
    await ensurePosReady(page);
    const img01 = await report.snap(page, '01-pos-billing');
    report.record('2.1', 'POS billing screen ready', true, img01);

    const search = page.getByPlaceholder(/Search by name, SKU, barcode/i).first();
    await search.fill(productName.slice(0, 4).toLowerCase());
    await page.waitForTimeout(600);

    const catalogItem = page.getByRole('button', { name: new RegExp(productName, 'i') }).first();
    if ((await catalogItem.count()) === 0) {
      await page.getByText(productName, { exact: false }).first().click({ timeout: 10000 });
    } else {
      await catalogItem.click();
    }

    await expect(page.getByText(/Subtotal/i).first()).toBeVisible({ timeout: 10000 });
    const img02 = await report.snap(page, '02-cart-with-item');
    report.record('2.2', 'Catalog item added to cart', true, img02);

    const chargeBtn = page.getByRole('button', { name: /Charge /i });
    await expect(chargeBtn).toBeVisible({ timeout: 10000 });
    await chargeBtn.click();

    await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible({ timeout: 10000 });
    const paymentPanel = page.locator('div.fixed.inset-0').filter({ hasText: 'Payment' });
    const img03 = await report.snap(page, '03-payment-modal');
    report.record('2.3', 'Payment modal opens', true, img03);

    await paymentPanel.getByRole('button', { name: 'Cash', exact: true }).click();
    const cashInput = paymentPanel.getByText('Cash Received').locator('..').locator('input');
    if (await cashInput.isVisible().catch(() => false)) {
      await cashInput.fill('5000');
    }
    await paymentPanel.getByRole('button', { name: 'Complete Sale' }).click();

    await expect(page.getByText(/Sale Complete|completed/i).first()).toBeVisible({ timeout: 30000 });
    const img04 = await report.snap(page, '04-sale-complete');
    report.record('2.4', 'Cash sale completed successfully', true, img04);
  });
});
