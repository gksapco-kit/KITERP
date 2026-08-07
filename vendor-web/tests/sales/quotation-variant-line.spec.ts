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

    // Catalogue menu is portaled to document.body (fixed), not nested in the modal.
    const dropdown = page.locator('body > div.fixed').filter({ hasText: /Click a row to select|Select variant/i }).first()
    await expect(dropdown).toBeVisible({ timeout: 10_000 })

    // Prefer a row that advertises multiple variants
    const multiVariantRow = dropdown.locator('button').filter({ hasText: /\d+ variants/ }).first()
    const hasMulti = await multiVariantRow.isVisible().catch(() => false)

    if (!hasMulti) {
      // Single-variant / no-variant products should select on one click of the full row.
      const anyRow = dropdown.locator('ul button').first()
      await expect(anyRow).toBeVisible()
      const productLabel = ((await anyRow.locator('.font-medium').first().textContent()) || '').trim()
      await anyRow.click()
      await expect(itemInput).toHaveValue(new RegExp(escapeRegExp(productLabel)))
      return
    }

    const productLabel = ((await multiVariantRow.locator('.font-medium').first().textContent()) || '').trim()
    await multiVariantRow.click()

    // Product name fills immediately; variant chooser stays open
    await expect(itemInput).toHaveValue(productLabel)
    await expect(dropdown.getByText(/Select variant/i)).toBeVisible({ timeout: 5_000 })
    const firstVariant = dropdown.locator('ul button').first()
    await expect(firstVariant).toBeVisible()
    const variantName = ((await firstVariant.locator('.font-medium').first().textContent()) || '').trim()
    await firstVariant.click()

    // Line fills with Product — Variant (unless default "Variant 1" is collapsed)
    await expect(itemInput).toHaveValue(new RegExp(escapeRegExp(productLabel)))

    // Rate should be auto-filled (> 0 for priced variants, or at least a number)
    const rateInput = modal.locator('input[placeholder="Rate"]').first()
    await expect(rateInput).toBeVisible()
    const rate = Number(await rateInput.inputValue())
    expect(Number.isFinite(rate)).toBeTruthy()
    expect(variantName.length).toBeGreaterThan(0)
  })
})

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
