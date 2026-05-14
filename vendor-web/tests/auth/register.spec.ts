import { test, expect } from '@playwright/test';

// /register and /login render inside AuthLayout, which redirects when already logged in.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Feature 11: Vendor signup / register page', () => {
  test('loads with Create your business heading', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create your business/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test('Step 1 shows full name, email, phone, password, and confirm password fields', async ({
    page,
  }) => {
    await page.goto('/register');
    await expect(page.getByText(/step 1:\s*create your account/i)).toBeVisible({ timeout: 15000 });

    // Register labels are not wired with htmlFor; placeholders match the Step 1 inputs.
    await expect(page.getByPlaceholder('John Doe').first()).toBeVisible();
    await expect(page.getByPlaceholder('you@example.com').first()).toBeVisible();
    await expect(page.getByPlaceholder('+919876543210').first()).toBeVisible();
    await expect(page.getByPlaceholder('Min 8 characters').first()).toBeVisible();
    await expect(page.getByPlaceholder('Re-enter password').first()).toBeVisible();
  });

  test('submitting empty Step 1 form shows validation feedback', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create your business/i })).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole('button', { name: /create account/i }).first().click();

    await expect(page.getByText(/name and password are required/i)).toBeVisible({ timeout: 10000 });
  });

  test('Sign In link on register navigates to /login', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('link', { name: /sign in/i }).first()).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole('link', { name: /sign in/i }).first().click();
    await page.waitForURL('**/login', { timeout: 15000 });
    await expect(page).toHaveURL(/\/login\/?$/);
    await expect(page.getByRole('heading', { name: /user login/i })).toBeVisible();
  });

  test('login page Create your business link navigates to /register', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /user login/i })).toBeVisible({
      timeout: 15000,
    });

    await expect(page.getByRole('link', { name: /create your business/i }).first()).toBeVisible();
    await page.getByRole('link', { name: /create your business/i }).first().click();
    await page.waitForURL('**/register', { timeout: 15000 });
    await expect(page).toHaveURL(/\/register\/?$/);
    await expect(page.getByRole('heading', { name: /create your business/i })).toBeVisible();
  });
});
