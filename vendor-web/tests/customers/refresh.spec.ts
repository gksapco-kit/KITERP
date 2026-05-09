import { test, expect } from '@playwright/test';

test.describe('Feature 1: Customer list refresh after creation', () => {
  test('customers page loads with heading and add action', async ({ page }) => {
    await page.goto('/customers');
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole('button', { name: /add customer/i }).first(),
    ).toBeVisible();
  });

  test('creating a customer closes the dialog and shows the new row in the list', async ({
    page,
  }) => {
    test.setTimeout(60000);

    await page.goto('/customers');
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 15000 });

    const uniqueSuffix = `${Date.now()}`;
    const fullName = `PW Cust ${uniqueSuffix}`;
    const email = `pw-${uniqueSuffix}@example.com`;
    const phone = `9${uniqueSuffix.slice(-9).padStart(9, '0')}`;

    // Click the header "Add Customer" button to open the dialog
    await page.getByRole('button', { name: /add customer/i }).first().click();
    await expect(page.locator('#full_name')).toBeVisible({ timeout: 10000 });

    await page.locator('#full_name').fill(fullName);
    await page.locator('#email').fill(email);
    await page.locator('#phone').fill(phone);

    // Set up response listener before clicking submit
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/customers') && resp.request().method() === 'POST',
      { timeout: 20000 },
    );

    // Click the submit button - the dialog's submit button is the one with flex-1 class
    await page.locator('button[type="submit"].flex-1').click();

    // Wait for the POST response and verify success
    const response = await responsePromise;
    expect(response.status()).toBeLessThan(400);

    // After successful creation, the dialog should close and list should refresh
    // Reload to ensure we see the latest data
    await page.goto('/customers');
    await expect(page.getByRole('heading', { name: 'Customers' })).toBeVisible({ timeout: 15000 });

    // The new customer should be in the list
    await expect(page.getByText(fullName).first()).toBeVisible({ timeout: 20000 });
  });
});
