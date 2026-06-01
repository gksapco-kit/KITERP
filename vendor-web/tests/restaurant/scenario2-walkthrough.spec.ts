import { test, expect, type Page, type Browser } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  apiLogin,
  ensureProduct,
  ensureRestaurantModules,
  ensureRestaurantSetup,
  ensureTableQrToken,
  getVendorSlug,
  resetTableForScenario,
  storefrontTableOrderUrl,
} from './api-helpers';

const _dir = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = path.join(_dir, 'results', 'scenario2');
const REPORT_PATH = path.join(SCREENSHOT_DIR, 'report.html');

type StepResult = { id: string; title: string; pass: boolean; note?: string; image?: string };
const steps: StepResult[] = [];

async function snap(page: Page, id: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const file = `${id}.png`;
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, file), fullPage: true });
  return file;
}

function record(id: string, title: string, pass: boolean, image?: string, note?: string) {
  steps.push({ id, title, pass, image, note });
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
<html lang="en"><head><meta charset="utf-8"/><title>Scenario 2 — QR self-order</title>
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
  <h1>Scenario 2 — Customer QR self-order</h1>
  <div class="summary"><strong>${passed}/${steps.length}</strong> steps passed · ${new Date().toLocaleString()}</div>
  ${rows}
</body></html>`;
  fs.writeFileSync(REPORT_PATH, html, 'utf-8');
}

async function tapCategory(page: Page, category: string) {
  const tab = page.getByRole('button', { name: category, exact: true });
  if (await tab.isVisible().catch(() => false)) await tab.click();
}

async function addProductQty(page: Page, productName: string, qty: number) {
  const row = page.locator('div.flex.items-center.gap-3').filter({
    has: page.locator('p.font-medium', { hasText: productName }),
  }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  for (let i = 0; i < qty; i++) {
    const plus = row.getByRole('button').last();
    await plus.click();
  }
}

test.describe.configure({ mode: 'serial', timeout: 240_000 });

test.describe('Scenario 2 walkthrough', () => {
  let tableT2Id = '';
  let menuUrl = '';

  test.beforeAll(async ({ request }) => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const auth = await apiLogin(request);
    await ensureRestaurantModules(request, auth);
    await ensureProduct(request, auth, { name: 'Garlic Bread', price: 150, category: 'Starters' });
    await ensureProduct(request, auth, { name: 'Coke', price: 60, category: 'Drinks' });
    await ensureProduct(request, auth, { name: 'Tiramisu', price: 200, category: 'Desserts' });
    const setup = await ensureRestaurantSetup(request, auth);
    tableT2Id = setup.tables.T2.id;
    await resetTableForScenario(request, auth, tableT2Id);
    const slug = await getVendorSlug(request, auth);
    const token = await ensureTableQrToken(request, auth, tableT2Id);
    menuUrl = storefrontTableOrderUrl(slug, token);
  });

  test.afterAll(() => {
    writeReport();
  });

  test('QR guest order with vendor verification', async ({ browser }) => {
    const vendorContext = await browser.newContext({ storageState: 'tests/.auth/vendor.json' });
    const guestContext = await browser.newContext();
    const vendor = await vendorContext.newPage();
    const guest = await guestContext.newPage();

    try {
      await vendor.goto('/restaurant/setup');
      await expect(vendor.getByRole('main').getByRole('heading', { name: 'Restaurant Setup' })).toBeVisible({ timeout: 20000 });
      await expect(vendor.locator('span.font-semibold', { hasText: 'T2' })).toBeVisible();
      record('2.1', 'Setup shows T2 with QR', true, await snap(vendor, '01-vendor-setup'));
      record('2.2', 'Storefront menu URL', true, undefined, menuUrl);

      await guest.goto(menuUrl, { timeout: 30000 });
      await expect(guest.getByText(/Dine-in menu/i)).toBeVisible({ timeout: 20000 });
      record('2.3', 'Guest menu loads for T2', true, await snap(guest, '02-guest-menu'));

      await tapCategory(guest, 'Drinks');
      await addProductQty(guest, 'Coke', 2);
      await tapCategory(guest, 'Starters');
      await addProductQty(guest, 'Garlic Bread', 1);
      await expect(guest.getByText(/3 item/i)).toBeVisible();
      record('2.4–2.6', 'Cart has 3 items', true, await snap(guest, '03-guest-cart'));

      await guest.getByPlaceholder('Your name (optional)').fill('Diner 1');
      await guest.getByRole('button', { name: /Place order/i }).click();
      await expect(guest.getByRole('heading', { name: /Order placed/i })).toBeVisible({ timeout: 20000 });
      record('2.7', 'Order placed', true, await snap(guest, '04-placed'));

      await vendor.goto('/restaurant/kitchen');
      await expect(vendor.getByText(/Table T2/i).first()).toBeVisible({ timeout: 20000 });
      record('2.8', 'Kitchen KOT for T2', true, await snap(vendor, '05-kitchen'));

      await vendor.goto('/restaurant/floor');
      await expect(vendor.getByText(/Ordering|Open order/i).first()).toBeVisible({ timeout: 15000 });
      record('2.9', 'Floor T2 ordering', true, await snap(vendor, '06-floor'));

      await vendor.getByRole('button', { name: 'T2' }).click();
      await vendor.waitForURL(/\/restaurant\/order\//, { timeout: 15000 });
      await expect(vendor.getByText(/Coke|Garlic Bread/i).first()).toBeVisible();
      record('2.10', 'Vendor order shows QR items', true, await snap(vendor, '07-order'));

      await guest.getByRole('button', { name: /Order more items/i }).click();
      await tapCategory(guest, 'Desserts');
      await addProductQty(guest, 'Tiramisu', 1);
      await guest.getByRole('button', { name: /Place order/i }).click();
      await expect(guest.getByRole('heading', { name: /Order placed/i })).toBeVisible({ timeout: 20000 });
      record('2.11', 'Second batch placed', true, await snap(guest, '08-more'));

      await vendor.reload();
      await expect(vendor.getByText(/KOT #1/i)).toBeVisible({ timeout: 15000 });
      await expect(vendor.getByText(/KOT #2/i)).toBeVisible({ timeout: 15000 });
      record('2.12', 'Two KOTs on order page', true, await snap(vendor, '09-two-kots'));
    } finally {
      await vendorContext.close();
      await guestContext.close();
    }
  });
});
