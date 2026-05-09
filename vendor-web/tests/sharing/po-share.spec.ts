import { test, expect } from '@playwright/test'

test.describe('Feature 12: Purchase order share, download, and messaging actions', () => {
  test('PO list loads and detail page shows share toolbar with Copy, WhatsApp, Email, Print, Download, Share', async ({
    page,
  }) => {
    await page.goto('/purchase-orders')
    await expect(page.getByRole('heading', { level: 1, name: 'Purchase Orders' })).toBeVisible()

    const empty = page.getByText('No purchase orders found.')
    if (await empty.isVisible()) {
      test.skip(true, 'No purchase orders; detail share toolbar not applicable')
    }

    await page.locator('tbody tr.cursor-pointer').first().click()
    await expect(page).toHaveURL(/\/purchase-orders\/[^/]+$/)

    const toolbar = page.locator('div.flex.flex-wrap.gap-2').filter({
      has: page.getByRole('button', { name: /^Copy$/ }),
    })
    await expect(toolbar).toBeVisible()

    await expect(page.getByRole('button', { name: /^Copy$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^WhatsApp$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Email$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Print$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Download$/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Share$/ })).toBeVisible()

    const shareActions = page.locator('button').filter({
      hasText: /^(Copy|WhatsApp|Email|Print|Download|Share)$/,
    })
    expect(await shareActions.count()).toBeGreaterThanOrEqual(3)
  })
})
