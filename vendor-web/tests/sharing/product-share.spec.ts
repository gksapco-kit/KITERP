import { test, expect } from '@playwright/test'

test.describe('Feature 4: Category, product, and service share buttons', () => {
  test('products, services, and categories list pages show share actions when rows exist', async ({
    page,
  }) => {
    await page.goto('/products')
    await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible()

    const noProducts = page.getByText('No products yet')
    if (!(await noProducts.isVisible())) {
      const firstProductRow = page.locator('tbody tr').filter({ has: page.locator('button[title="Copy"]') }).first()
      await expect(firstProductRow).toBeVisible()
      const actions = firstProductRow.locator('td').last()
      await expect(actions.locator('button[title="Copy"]').first()).toBeVisible()
      await expect(actions.locator('button[title="WhatsApp"]')).toBeVisible()
      await expect(actions.locator('button[title="Email"]')).toBeVisible()
      await expect(actions.locator('button[title="Share"]')).toBeVisible()
    }

    await page.goto('/services')
    await expect(page.getByRole('heading', { level: 1, name: 'Services' })).toBeVisible()

    const noServices = page.getByText('No services yet')
    if (!(await noServices.isVisible())) {
      const firstServiceRow = page.locator('tbody tr').filter({ has: page.locator('button[title="Copy"]') }).first()
      await expect(firstServiceRow).toBeVisible()
      const svcActions = firstServiceRow.locator('td').last()
      await expect(svcActions.locator('button[title="Copy"]').first()).toBeVisible()
      await expect(svcActions.locator('button[title="WhatsApp"]')).toBeVisible()
      await expect(svcActions.locator('button[title="Email"]')).toBeVisible()
    }

    await page.goto('/categories')
    await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible()

    const noCategories = page.getByText(/No categories yet/)
    if (!(await noCategories.isVisible())) {
      const firstCategoryRow = page.locator('tbody tr.group').first()
      await firstCategoryRow.hover()
      await expect(firstCategoryRow.locator('button[title="Copy"]').first()).toBeVisible()
      await expect(firstCategoryRow.locator('button[title="WhatsApp"]')).toBeVisible()
      await expect(firstCategoryRow.locator('button[title="Email"]')).toBeVisible()
    }
  })
})
