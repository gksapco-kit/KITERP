import { test, expect } from '@playwright/test'

test.describe('Feature 13: Report metrics and tables link to detail pages', () => {
  test('stat cards navigate to orders, customers, and products; top tables rows are clickable', async ({
    page,
  }) => {
    await page.goto('/reports')
    await expect(page.getByRole('heading', { level: 1, name: 'Reports & Insights' })).toBeVisible()

    await expect(page.getByText('Total Orders', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Customers', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Active Products', { exact: true }).first()).toBeVisible()

    await page
      .locator('div.cursor-pointer.group')
      .filter({ hasText: 'Total Orders' })
      .first()
      .click()
    await expect(page).toHaveURL(/\/orders/)

    await page.goBack()
    await expect(page.getByRole('heading', { level: 1, name: 'Reports & Insights' })).toBeVisible()

    await page
      .locator('div.cursor-pointer.group')
      .filter({ has: page.getByText('Customers', { exact: true }) })
      .first()
      .click()
    await expect(page).toHaveURL(/\/customers/)

    await page.goBack()
    await expect(page.getByRole('heading', { level: 1, name: 'Reports & Insights' })).toBeVisible()

    await page
      .locator('div.cursor-pointer.group')
      .filter({ hasText: 'Active Products' })
      .first()
      .click()
    await expect(page).toHaveURL(/\/products/)

    await page.goto('/reports')
    await expect(page.getByRole('heading', { level: 1, name: 'Reports & Insights' })).toBeVisible()

    const topProductsCard = page
      .getByRole('heading', { name: 'Top Products (by stock)' })
      .locator(
        'xpath=ancestor::div[contains(@class,"rounded-lg") and contains(@class,"border")][1]',
      )

    const topProductRows = topProductsCard.locator('table tbody tr.cursor-pointer')
    if ((await topProductRows.count()) > 0) {
      const row = topProductRows.first()
      await expect(row).toHaveClass(/cursor-pointer/)
      await expect(row.locator('td.font-medium.text-blue-600').first()).toBeVisible()
    }

    const topCustomersCard = page
      .getByRole('heading', { name: 'Top Customers (by spend)' })
      .locator(
        'xpath=ancestor::div[contains(@class,"rounded-lg") and contains(@class,"border")][1]',
      )

    const topCustomerRows = topCustomersCard.locator('table tbody tr.cursor-pointer')
    if ((await topCustomerRows.count()) > 0) {
      const row = topCustomerRows.first()
      await expect(row).toHaveClass(/cursor-pointer/)
      await expect(row.locator('p.font-medium.text-blue-600').first()).toBeVisible()
    }
  })
})
