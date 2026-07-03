import { test, expect } from '@playwright/test';
import {
  apiLogin,
  deleteMenuById,
  ensureRestaurant,
  ensureRestaurantModules,
  ensureRestaurantZoneForOutlet,
} from './api-helpers';

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.describe('Restaurant menu admin', () => {
  const menuName = `E2E Menu ${Date.now()}`;
  const categoryName = 'E2E Starters';
  let menuId = '';
  let zoneName = 'Indoor';

  test.beforeAll(async ({ request }) => {
    const auth = await apiLogin(request);
    await ensureRestaurantModules(request, auth);
    const restaurant = await ensureRestaurant(request, auth);
    const zone = await ensureRestaurantZoneForOutlet(request, auth, restaurant.id);
    zoneName = zone.zoneName;
  });

  test.afterAll(async ({ request }) => {
    if (!menuId) return;
    const auth = await apiLogin(request);
    await deleteMenuById(request, auth, menuId);
  });

  test('create menu, configure detail, search, and cleanup', async ({ page }) => {
    await page.goto('/restaurant/menu', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await expect(page.getByRole('heading', { name: /Dine-in & QR Menu/i })).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /Create menu/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Menu name').fill(menuName);

    const restaurantTrigger = page.locator('[role="dialog"] button').filter({ hasText: /Select restaurant|Restaurant/i }).first();
    if (await restaurantTrigger.isVisible().catch(() => false)) {
      await restaurantTrigger.click();
      const option = page.getByRole('option').first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
      }
    }

    await page.getByRole('dialog').getByRole('button', { name: /^Create$/ }).click();
    await expect(page.getByText(menuName, { exact: true }).first()).toBeVisible({ timeout: 15000 });

    const menuRow = page.locator('li').filter({ hasText: menuName }).first();
    await expect(menuRow.getByText(/1 cat|0 cat/)).toBeVisible();
    await expect(menuRow.getByText(/zone/)).toBeVisible();

    await menuRow.getByRole('button').first().click();
    await expect(page.getByRole('button', { name: /Rename/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Deactivate|Activate/i })).toBeVisible();

    await page.getByRole('button', { name: /Create menu category/i }).click();
    await page.getByLabel('Category name').fill(categoryName);
    await page.getByRole('dialog').getByRole('button', { name: /^Create$/ }).click();
    await expect(page.getByText(categoryName)).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /Edit zones/i }).click();
    const zonesBtn = page.getByRole('button', { name: /^Zones/ }).first();
    await zonesBtn.click();
    const indoorZone = page.locator('label').filter({ hasText: zoneName }).first();
    if (await indoorZone.isVisible().catch(() => false)) {
      await indoorZone.click();
      await page.getByRole('button', { name: /^Done$/ }).first().click();
      await expect(page.getByText(/Guest URLs/i)).toBeVisible();
    } else {
      await page.getByRole('button', { name: /^Done$/ }).first().click();
    }

    await page.getByRole('button', { name: /^Menus$/ }).click();
    await expect(page.getByRole('heading', { name: /Dine-in & QR Menu/i })).toBeVisible();

    const search = page.getByPlaceholder('Search…');
    await search.fill(menuName);
    await expect(page.getByText(menuName, { exact: true })).toBeVisible();
    await search.fill('no-such-menu-xyz');
    await expect(page.getByText('No match')).toBeVisible();
    await search.fill(menuName);
    await expect(page.getByText(menuName, { exact: true })).toBeVisible();

    page.once('dialog', dialog => dialog.accept());
    await page.locator('li').filter({ hasText: menuName }).getByLabel('Delete menu').click();
    await expect(page.getByText(menuName, { exact: true })).not.toBeVisible({ timeout: 10000 });
    menuId = '';
  });
});
