import { expect, type Page } from '@playwright/test';

export function mainHeading(page: Page, name: string | RegExp) {
  return page.getByRole('main').getByRole('heading', { name });
}

export async function ensurePosReady(page: Page) {
  await page.goto('/pos', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

  await page.waitForFunction(
    () => /POS Billing|Open POS Session|Point of Sale/.test(document.body.innerText),
    null,
    { timeout: 90000 },
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

  await expect(page.getByPlaceholder(/Search by name, SKU, barcode/i).first()).toBeVisible({ timeout: 15000 });
}
