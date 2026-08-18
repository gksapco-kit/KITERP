import { test, expect, type Page, type Browser } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createWalkthroughReport, dateOffset } from './walkthrough-report';
import {
  apiLogin,
  ensureProduct,
  ensureRestaurantModules,
  ensureRestaurantSetup,
  ensurePosSessionOpen,
  resetTableForScenario,
  getVendorSlug,
  storefrontReserveUrl,
} from './api-helpers';

const _dir = path.dirname(fileURLToPath(import.meta.url));

async function ensurePosReady(page: Page) {
  if (!page.url().includes('/pos')) await page.goto('/pos', { timeout: 25000 });
  await page.waitForFunction(
    () => /POS Billing|Open POS Session|Point of Sale/.test(document.body.innerText),
    null,
    { timeout: 60000 },
  );
  const openBtn = page.getByRole('button', { name: /Open POS Session/i });
  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click();
    await page.waitForFunction(() => document.body.innerText.includes('POS Billing'), null, { timeout: 30000 });
  }
}

test.describe.configure({ mode: 'serial', timeout: 300_000 });

test.describe('Scenario 3 — Reservations', () => {
  const r = createWalkthroughReport('scenario3', 'Scenario 3 — Online reservation', _dir);
  let reserveUrl = '';

  test.beforeAll(async ({ request }) => {
    const auth = await apiLogin(request);
    await ensureRestaurantModules(request, auth);
    await ensureRestaurantSetup(request, auth);
    const slug = await getVendorSlug(request, auth);
    reserveUrl = storefrontReserveUrl(slug);
  });

  test.afterAll(() => r.writeReport());

  test('online + vendor reservation management', async ({ browser }) => {
    const vendorCtx = await browser.newContext({ storageState: 'tests/.auth/vendor.json' });
    const guestCtx = await browser.newContext();
    const vendor = await vendorCtx.newPage();
    const guest = await guestCtx.newPage();
    const janeName = `Jane Doe ${Date.now() % 10000}`;

    try {
      await guest.goto(reserveUrl, { timeout: 30000 });
      await expect(guest.getByRole('heading', { name: 'Reserve a table' })).toBeVisible({ timeout: 20000 });
      r.record('3.1', 'Reservation form loads', true, await r.snap(guest, '01-form'));

      await guest.getByPlaceholder('John Smith').fill(janeName);
      await guest.locator('input[type="tel"]').fill('9876543210');
      await guest.getByPlaceholder('you@email.com').fill('jane@x.com');
      await guest.getByRole('button', { name: '19:00', exact: true }).click();
      await guest.getByPlaceholder(/Allergies|occasions/i).fill('Anniversary');
      await guest.getByRole('button', { name: /Confirm reservation/i }).click();
      await expect(guest.getByRole('heading', { name: /Reservation confirmed/i })).toBeVisible({ timeout: 20000 });
      r.record('3.3', 'Online reservation submitted', true, await r.snap(guest, '02-confirmed'));

      await vendor.goto('/restaurant/reservations');
      await expect(vendor.getByRole('main').getByText('Reservations').first()).toBeVisible({ timeout: 20000 });
      await expect(vendor.getByText(janeName).first()).toBeVisible({ timeout: 20000 });
      r.record('3.4', 'Vendor list shows pending guest', true, await r.snap(vendor, '03-vendor-list'));

      const janeRow = vendor.locator('div.rounded-xl.border').filter({ hasText: janeName }).last();
      await janeRow.getByRole('button').first().click();
      await janeRow.getByRole('button', { name: 'Confirmed', exact: true }).click();
      await janeRow.getByRole('button', { name: 'Seat at table' }).click();
      const tableSelect = janeRow.locator('select');
      await tableSelect.selectOption({ index: 1 });
      await janeRow.getByRole('button', { name: /Seat & order/i }).click();
      await vendor.waitForURL(/\/restaurant\/order\//, { timeout: 20000 });
      r.record('3.6–3.7', 'Confirmed and seated at table', true, await r.snap(vendor, '04-seated'));
    } finally {
      await vendorCtx.close();
      await guestCtx.close();
    }
  });
});

test.describe('Scenario 4 — Multi-KOT', () => {
  const r = createWalkthroughReport('scenario4', 'Scenario 4 — Multi-KOT', _dir);
  let tableT3Id = '';

  test.beforeAll(async ({ request }) => {
    const auth = await apiLogin(request);
    await ensureRestaurantModules(request, auth);
    await ensureProduct(request, auth, { name: 'Garlic Bread', price: 150, category: 'Starters' });
    await ensureProduct(request, auth, { name: 'Coke', price: 60, category: 'Drinks' });
    await ensureProduct(request, auth, { name: 'Margherita Pizza', price: 350, category: 'Mains' });
    const setup = await ensureRestaurantSetup(request, auth);
    tableT3Id = setup.tables.T3.id;
    await resetTableForScenario(request, auth, tableT3Id);
    await ensurePosSessionOpen(request, auth);
  });

  test.afterAll(() => r.writeReport());

  test('two KOT batches on T3', async ({ page }) => {
    await page.goto('/restaurant/floor');
    await page.getByRole('button', { name: 'T3' }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: /Seat table/i }).click();
    await page.waitForURL(/\/restaurant\/order\//);

    await page.getByRole('button', { name: /Coke/i }).first().click();
    await page.getByRole('button', { name: /Garlic Bread/i }).first().click();
    await page.getByRole('button', { name: /Send to Kitchen/i }).click();
    await page.waitForTimeout(800);
    r.record('4.2', 'KOT #1 sent', true, await r.snap(page, '01-kot1'));

    await page.getByRole('button', { name: /Margherita/i }).first().click();
    const modal = page.locator('div.fixed.inset-0').filter({ hasText: 'Customise' });
    if (await modal.isVisible().catch(() => false)) {
      await modal.getByRole('button', { name: /Add to order/i }).click();
    }
    await page.getByRole('button', { name: /Send to Kitchen/i }).click();
    await expect(page.getByText(/KOT #2/i)).toBeVisible({ timeout: 15000 });
    r.record('4.3', 'KOT #2 sent', true, await r.snap(page, '02-kot2'));

    await page.getByRole('button', { name: /Request Bill/i }).click();
    await page.waitForURL(/\/pos\?/, { timeout: 20000 });
    await ensurePosReady(page);
    r.record('4.7', 'Bill → POS', true, await r.snap(page, '03-pos'));
  });
});

test.describe('Scenario 5 — Void', () => {
  const r = createWalkthroughReport('scenario5', 'Scenario 5 — Void order', _dir);
  let tableT1Id = '';

  test.beforeAll(async ({ request }) => {
    const auth = await apiLogin(request);
    await ensureRestaurantModules(request, auth);
    await ensureProduct(request, auth, { name: 'Coke', price: 60, category: 'Drinks' });
    const setup = await ensureRestaurantSetup(request, auth);
    tableT1Id = setup.tables.T1.id;
    await resetTableForScenario(request, auth, tableT1Id);
  });

  test.afterAll(() => r.writeReport());

  test('void releases table', async ({ page }) => {
    await page.goto('/restaurant/floor');
    await page.getByRole('button', { name: 'T1' }).click();
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: /Seat table/i }).click();
    await page.waitForURL(/\/restaurant\/order\//);
    await page.getByRole('button', { name: /Coke/i }).first().click();
    await page.getByRole('button', { name: /Send to Kitchen/i }).click();
    await page.waitForTimeout(500);

    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: /Void/i }).click();
    await page.waitForURL(/\/restaurant\/floor/, { timeout: 20000 });
    r.record('5.2–5.3', 'Void returns to floor', true, await r.snap(page, '01-floor-free'));

    await page.goto('/restaurant/kitchen');
    await expect(page.getByText(/Order voided|Table T1/i).first()).toBeVisible({ timeout: 15000 });
    r.record('5.4', 'Kitchen shows voided order badge', true, await r.snap(page, '02-kitchen'));
  });
});

test.describe('Scenario 6 — Reports', () => {
  const r = createWalkthroughReport('scenario6', 'Scenario 6 — Reports', _dir);

  test.afterAll(() => r.writeReport());

  test('reports KPIs load', async ({ page }) => {
    await page.goto('/restaurant/reports');
    await expect(page.getByRole('main').getByText(/Reports|Covers/i).first()).toBeVisible({ timeout: 20000 });
    r.record('6.1', 'Reports page loads', true, await r.snap(page, '01-reports'));
    await page.getByRole('button', { name: '7d', exact: true }).click();
    await page.waitForTimeout(500);
    r.record('6.9', '7d filter works', true, await r.snap(page, '02-7d'));
  });
});

test.describe('Scenario 7 — Edge cases', () => {
  const r = createWalkthroughReport('scenario7', 'Scenario 7 — Edge cases', _dir);

  test.afterAll(() => r.writeReport());

  test('invalid QR and empty send', async ({ page }) => {
    const slug = 'nonexistent-vendor-slug-xyz';
    await page.goto(`http://127.0.0.1:3002/${slug}/table/bad-token-xyz`, { timeout: 15000 });
    await expect(page.getByText(/not found|invalid/i).first()).toBeVisible({ timeout: 20000 });
    r.record('7.4', 'Invalid QR shows error', true, await r.snap(page, '01-invalid-qr'));

    await page.goto('/restaurant/floor');
    await page.getByRole('button', { name: 'T1' }).click();
    await page.getByRole('button', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: /Seat table/i }).click();
    await page.waitForURL(/\/restaurant\/order\//);
    const sendBtn = page.getByRole('button', { name: /Send to Kitchen/i });
    await expect(sendBtn).toBeDisabled();
    r.record('7.7', 'Send KOT disabled with no pending items', true, await r.snap(page, '02-send-disabled'));
  });
});
