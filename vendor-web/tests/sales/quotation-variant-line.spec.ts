import { test, expect } from '@playwright/test'

/**
 * Smoke: Create Quotation line items prompt for a variant when the
 * selected product has more than one active variant.
 */
test.describe('Quotation line item variants', () => {
  test('selecting a multi-variant product opens variant chooser and fills rate', async ({ page }) => {
    test.setTimeout(90_000)

    await page.goto('/quotations', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: /New Quotation/i })).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /New Quotation/i }).click()

    const modal = page.getByRole('dialog', { name: /Create Quotation/i })
    await expect(modal).toBeVisible({ timeout: 10_000 })

    const itemInput = modal.getByPlaceholder('Search product or service…').first()
    await itemInput.click()
    await itemInput.fill('')

    // Wait for catalogue dropdown results
    const dropdown = modal.locator('.absolute').filter({ hasText: /Products|results/i }).first()
    await expect(dropdown).toBeVisible({ timeout: 10_000 })

    // Prefer a row that advertises multiple variants
    const multiVariantRow = dropdown.locator('button').filter({ hasText: /\d+ variants/ }).first()
    const hasMulti = await multiVariantRow.isVisible().catch(() => false)

    if (!hasMulti) {
      test.skip(true, 'No multi-variant products in catalogue for this vendor')
      return
    }

    const productLabel = ((await multiVariantRow.locator('.font-medium').first().textContent()) || '').trim()
    await multiVariantRow.click()

    // Variant chooser step
    await expect(dropdown.getByText(/Select variant/i)).toBeVisible({ timeout: 5_000 })
    const firstVariant = dropdown.locator('ul button').first()
    await expect(firstVariant).toBeVisible()
    const variantName = ((await firstVariant.locator('.font-medium').first().textContent()) || '').trim()
    await firstVariant.click()

    // Line fills with Product — Variant
    await expect(itemInput).toHaveValue(new RegExp(`${escapeRegExp(productLabel)}\\s*—\\s*${escapeRegExp(variantName)}`))

    // Variant column select should show the chosen variant
    const variantSelect = modal.locator('select').filter({ has: page.locator('option', { hasText: variantName }) }).first()
    await expect(variantSelect).toBeVisible()
    await expect(variantSelect).toHaveValue(/.+/)

    // Rate should be auto-filled (> 0 for priced variants, or at least a number)
    const rateInput = modal.locator('input[placeholder="Rate"]').first()
    await expect(rateInput).toBeVisible()
    const rate = Number(await rateInput.inputValue())
    expect(Number.isFinite(rate)).toBeTruthy()
  })
})

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
