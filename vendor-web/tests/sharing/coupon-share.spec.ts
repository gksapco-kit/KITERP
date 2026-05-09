import { test, expect } from '@playwright/test'

test.describe('Feature 3: Coupon sharing options', () => {
  test('coupons page loads with Coupons heading and data rows expose copy, WhatsApp, and email share actions', async ({
    page,
  }) => {
    await page.goto('/coupons')

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Coupons/i)

    const emptyState = page.getByText('No coupons yet')
    if (await emptyState.isVisible()) {
      test.skip(true, 'No coupons in account; share row actions not applicable')
    }

    const firstRow = page.locator('tbody tr').filter({ has: page.getByTitle('Copy code') }).first()

    await expect(firstRow).toBeVisible()

    const actionsCell = firstRow.locator('td').last()
    await expect(actionsCell).toBeVisible()

    await expect(actionsCell.getByTitle('Copy code')).toBeVisible()
    await expect(actionsCell.locator('button[title="Share via WhatsApp"]')).toBeVisible()
    await expect(actionsCell.locator('button[title="Share via Email"]')).toBeVisible()

    const shareRelated = actionsCell.locator(
      'button[title="Copy code"], button[title="Share via WhatsApp"], button[title="Share via Email"], button[title="Share"], svg.lucide-copy, svg.lucide-message-circle, svg.lucide-mail',
    )
    await expect(shareRelated.first()).toBeVisible()
    expect(await shareRelated.count()).toBeGreaterThanOrEqual(3)
  })
})
