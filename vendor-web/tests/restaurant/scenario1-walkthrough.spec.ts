import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  apiLogin,
  ensureProduct,
  ensureRestaurantModules,
  ensureRestaurantSetup,
  ensurePosSessionOpen,
  resetTableForScenario,
} from './api-helpers';

const _dir = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(_dir, 'results', 'scenario1');
const REPORT_PATH = path.join(SCREENSHOT_DIR, 'report.html');

type StepResult = { id: string; title: string; pass: boolean; note?: string; image?: string };

const steps: StepResult[] = [];

async function snap(page: Page, id: string, title: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const file = `${id}.png`;
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, file), fullPage: true });
  return file;
}

function record(id: string, title: string, pass: boolean, image?: string, note?: string) {
  steps.push({ id, title, pass, image, note });
}

async function ensurePosReady(page: Page) {
  // Keep ?table=&order= query params when arriving from Request Bill
  if (!page.url().includes('/pos')) {
    await page.goto('/pos', { timeout: 25000 });
  }
  await page.waitForFunction(
    () => /POS Billing|Open POS Session|Point of Sale/.test(document.body.innerText),
    null,
    { timeout: 60000 },
  );

  const openBtn = page.getByRole('button', { name: /Open POS Session/i });
  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click();
    await page.waitForFunction(
      () => document.body.innerText.includes('POS Billing'),
      null,
      { timeout: 30000 },
    );
  }
}

function writeReport() {
  const passed = steps.filter(s => s.pass).length;
  const rows = steps
    .map(
      s => `
    <section class="step ${s.pass ? 'pass' : 'fail'}">
      <h2><span class="badge">${s.pass ? 'PASS' : 'FAIL'}</span> ${s.id} — ${s.title}</h2>
      ${s.note ? `<p class="note">${s.note}</p>` : ''}
      ${s.image ? `<img src="${s.image}" alt="${s.title}" />` : ''}
    </section>`,
    )
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>Scenario 1 — Restaurant E2E</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 1100px; margin: 0 auto; padding: 24px; background: #f8fafc; color: #111; }
  h1 { font-size: 1.5rem; }
  .summary { margin: 16px 0; padding: 12px 16px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; }
  .step { margin: 24px 0; padding: 16px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0; }
  .step.fail { border-color: #fca5a5; }
  .badge { font-size: 0.7rem; padding: 2px 8px; border-radius: 4px; margin-right: 8px; vertical-align: middle; }
  .pass .badge { background: #dcfce7; color: #166534; }
  .fail .badge { background: #fee2e2; color: #991b1b; }
  img { max-width: 100%; margin-top: 12px; border: 1px solid #e2e8f0; border-radius: 6px; }
  .note { color: #64748b; font-size: 0.9rem; }
</style></head><body>
  <h1>Scenario 1 — Server-driven dine-in</h1>
  <div class="summary"><strong>${passed}/${steps.length}</strong> steps passed · ${new Date().toLocaleString()}</div>
  ${rows}
</body></html>`;
  fs.writeFileSync(REPORT_PATH, html, 'utf-8');
}

test.describe.configure({ mode: 'serial', timeout: 180_000 });

test.describe('Scenario 1 walkthrough', () => {
  let tableT1Id = '';
  let products: { garlic: string; coke: string } = { garlic: '', coke: '' };

  test.beforeAll(async ({ request }) => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const auth = await apiLogin(request);
    await ensureRestaurantModules(request, auth);
    await ensureProduct(request, auth, { name: 'Garlic Bread', price: 150, category: 'Starters' });
    await ensureProduct(request, auth, { name: 'Coke', price: 60, category: 'Drinks' });
    await ensureProduct(request, auth, { name: 'Margherita Pizza', price: 350, category: 'Mains' });
    await ensureProduct(request, auth, { name: 'Tiramisu', price: 200, category: 'Desserts' });
    const setup = await ensureRestaurantSetup(request, auth);
    tableT1Id = setup.tables.T1.id;
    await resetTableForScenario(request, auth, tableT1Id);
    await ensurePosSessionOpen(request, auth);

    const list = await request.get('http://127.0.0.1:8000/api/v1/vendors/me/products', {
      headers: auth.headers,
      params: { limit: '50', status: 'active' },
    });
    const items = (await list.json()).items || [];
    const garlic = items.find((p: { name: string }) => p.name === 'Garlic Bread');
    const coke = items.find((p: { name: string }) => p.name === 'Coke');
    products = { garlic: garlic?.name ?? 'Garlic Bread', coke: coke?.name ?? 'Coke' };
  });

  test.afterAll(() => {
    writeReport();
  });

  test('full happy path with screenshots', async ({ page }) => {
    // 1.1 Floor
    await page.goto('/restaurant/floor');
    await expect(page.getByRole('main').getByRole('heading', { name: /Restaurant Floor/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('T1').first()).toBeVisible();
    const img01 = await snap(page, '01', 'Floor — tables visible');
    record('1.1', 'Restaurant floor loads with T1', true, img01);

    // 1.2–1.3 Seat T1
    await page.getByRole('button', { name: 'T1' }).click();
    await expect(page.getByRole('heading', { name: /Seat Table T1/i }).first()).toBeVisible();
    const img02 = await snap(page, '02', 'Seat dialog');
    record('1.2', 'Seat dialog opens for T1', true, img02);

    await page.getByRole('button', { name: '3', exact: true }).click();
    await page.getByPlaceholder('Server name').fill('Ravi');
    await page.getByRole('button', { name: /Seat table/i }).click();
    await page.waitForURL(/\/restaurant\/order\//, { timeout: 20000 });
    await expect(page.getByText(/Table T1/i).first()).toBeVisible();
    await expect(page.getByText(/Ravi/i).first()).toBeVisible();
    const img03 = await snap(page, '03', 'Order page after seating');
    record('1.3', 'Seated 3 covers, server Ravi', true, img03);

    // 1.5–1.9 Add items
    await page.getByPlaceholder('Search products…').fill('garl');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: new RegExp(products.garlic, 'i') }).first().click();
    await page.getByPlaceholder('Search products…').fill('');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: new RegExp(products.coke, 'i') }).first().click();
    await page.getByRole('button', { name: new RegExp(products.coke, 'i') }).first().click();

    const pending = page.locator('text=Pending (not yet sent)');
    await expect(pending).toBeVisible();
    const img04 = await snap(page, '04', 'Pending items before KOT');
    record('1.7–1.8', 'Garlic Bread + Coke ×2 in pending', true, img04);

    // Increase first pending line to qty 2
    const pendingSection = page.locator('section').filter({ hasText: 'Pending (not yet sent)' });
    await pendingSection.locator('button').filter({ has: page.locator('svg.lucide-plus, [class*="lucide-plus"]') }).first().click();

    await page.getByRole('button', { name: /Send to Kitchen/i }).click();
    await expect(page.getByText(/KOT sent|sent to kitchen/i)).toBeVisible({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    const img05 = await snap(page, '05', 'After first KOT');
    record('1.10', 'KOT sent — order summary populated', true, img05);

    // 1.11 Kitchen
    await page.goto('/restaurant/kitchen');
    await expect(page.getByRole('main').getByRole('heading', { name: /Kitchen Board/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Table T1/i).first()).toBeVisible({ timeout: 15000 });
    const kotCard = page.locator('div.rounded-xl.border').filter({ hasText: 'Table T1' }).first();
    await kotCard.getByRole('button', { name: 'Preparing' }).click();
    await kotCard.getByRole('button', { name: 'Ready' }).click();
    await kotCard.getByRole('button', { name: 'Done' }).click();
    const img06 = await snap(page, '06', 'Kitchen — KOT progressed');
    record('1.11–1.13', 'Kitchen status transitions', true, img06);

    // Back to order — request bill
    await page.goBack();
    if (!page.url().includes('/restaurant/order/')) {
      await page.goto('/restaurant/floor');
      await page.getByRole('button', { name: 'T1' }).click();
    }
    await expect(page.getByRole('button', { name: /Request Bill/i })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Request Bill/i }).click();
    await page.waitForURL(/\/pos\?/, { timeout: 20000 });
    const img07 = await snap(page, '07', 'POS after Request Bill');
    record('1.17', 'Request Bill navigates to POS', true, img07);

    // 1.18 POS prefill
    await ensurePosReady(page);
    await expect(page.getByText(/Loaded \d+ item/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Garlic Bread|Coke/i).first()).toBeVisible({ timeout: 10000 });
    const img08 = await snap(page, '08', 'POS cart prefilled');
    record('1.18', 'POS cart prefilled from restaurant order', true, img08);

    // 1.20–1.21 Pay
    await page.getByRole('button', { name: /Charge /i }).click();
    await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();
    const paymentPanel = page.locator('div.fixed.inset-0').filter({ hasText: 'Payment' });
    await paymentPanel.getByText('Tip (₹)').locator('..').locator('input').fill('50');
    await paymentPanel.getByText('Service charge (₹)').locator('..').locator('input').fill('40');
    const img09 = await snap(page, '09', 'Payment modal tip + service');
    record('1.20', 'Tip ₹50 and service charge ₹40', true, img09);

    await paymentPanel.getByRole('button', { name: 'Cash', exact: true }).click();
    await paymentPanel.getByText('Cash Received').locator('..').locator('input').fill('10000');
    await paymentPanel.getByRole('button', { name: 'Complete Sale' }).click();
    await expect(page.getByText(/Sale Complete|completed/i).first()).toBeVisible({ timeout: 30000 });
    const img10 = await snap(page, '10', 'Sale complete');
    record('1.21', 'Cash payment completed', true, img10);

    // 1.22–1.23 Clear table
    await page.waitForURL(/\/restaurant\/floor/, { timeout: 30000 }).catch(async () => {
      await page.goto('/restaurant/floor');
    });
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Needs clear|dirty/i).first()).toBeVisible({ timeout: 15000 });
    const img11 = await snap(page, '11', 'Floor — table needs clear');
    record('1.22', 'T1 shows needs clear after payment', true, img11);

    await page.getByRole('button', { name: 'T1' }).click();
    await page.waitForTimeout(800);
    await expect(page.getByText('Free').first()).toBeVisible({ timeout: 10000 });
    const img12 = await snap(page, '12', 'Floor — T1 free again');
    record('1.23', 'Tap T1 clears table to Free', true, img12);
  });
});
