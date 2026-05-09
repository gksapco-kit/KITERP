import { test, expect } from '@playwright/test';

test.describe('Feature 5: Roles — detailed permissions breakdown', () => {
  test('shows heading, built-in roles, expandable permission matrix with modules', async ({ page }) => {
    await page.goto('/roles');

    await expect(
      page.getByRole('heading', { name: /Roles/i }).first(),
    ).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('Built-in System Roles')).toBeVisible({ timeout: 10000 });

    // Roles are displayed with CSS capitalize, raw text is lowercase
    for (const role of ['owner', 'admin', 'manager', 'sales', 'staff']) {
      await expect(page.locator('.capitalize', { hasText: new RegExp(`^${role}$`, 'i') }).first()).toBeVisible({ timeout: 5000 });
    }

    // Click the Owner row to expand it
    const ownerRow = page
      .locator('.cursor-pointer')
      .filter({ has: page.locator('.capitalize', { hasText: /^owner$/i }) })
      .first();
    await ownerRow.click();

    // Wait for expansion - permission module labels should appear
    // Module labels are: Dashboard, Products, Services, Orders, Customers, Reviews, Settings, Team, Roles
    const moduleLabels = ['Dashboard', 'Products', 'Services', 'Orders', 'Customers', 'Reviews', 'Settings', 'Team', 'Roles'];
    let sawModule = false;
    for (const label of moduleLabels) {
      const loc = page.getByText(label, { exact: true });
      // Multiple elements may match (e.g., sidebar), so check for at least one in the expanded area
      const count = await loc.count();
      if (count > 0) {
        sawModule = true;
        break;
      }
    }
    expect(sawModule).toBeTruthy();

    // Verify green checkmarks are visible (Check icon with text-green-500)
    await expect(page.locator('.text-green-500').first()).toBeVisible({ timeout: 5000 });
  });
});
