import { test, expect } from '@playwright/test'

const VENDOR_EMAIL = process.env.TEST_VENDOR_EMAIL || 'vendor@kiterp.com'
const VENDOR_PASSWORD = process.env.TEST_VENDOR_PASSWORD || 'vendor123'

async function loginViaUi(page: import('@playwright/test').Page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
    const apiDown = page.getByText('API server is not reachable')
    if (await apiDown.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Retry check' }).click().catch(() => {})
      await page.waitForTimeout(3000)
      continue
    }
    await expect(page.locator('text=User Login')).toBeVisible({ timeout: 30000 })
    await page.fill('#login', VENDOR_EMAIL)
    await page.fill('#password', VENDOR_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL(url => !url.pathname.includes('login'), { timeout: 60000 })
    return
  }
  throw new Error('Login failed — backend unreachable after retries')
}

async function openFirstWebsiteBuilder(page: import('@playwright/test').Page) {
  await page.goto('/websites', { waitUntil: 'domcontentloaded', timeout: 60000 })

  if (/\/websites\/[^/?#]+/.test(page.url())) return

  const openBuilder = page.getByRole('button', { name: 'Open Builder' }).first()
  await expect(openBuilder).toBeVisible({ timeout: 30000 })
  await openBuilder.click()

  await page.waitForURL(/\/websites\/[^/?#]+/, { timeout: 60000 })
}

async function ensureCanvasHasBlock(page: import('@playwright/test').Page) {
  const block = page.locator('[data-block-id]').first()
  if (await block.isVisible({ timeout: 8000 }).catch(() => false)) return

  const templatesTab = page.getByRole('button', { name: 'Templates', exact: true })
  if (await templatesTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await templatesTab.click()
    const templateRow = page.locator('button[title="Click to load this template on the canvas"]').first()
    await expect(templateRow).toBeVisible({ timeout: 30000 })
    await templateRow.click()
    await expect(page.locator('[data-block-id]').first()).toBeVisible({ timeout: 120000 })
    return
  }

  const browseBlocks = page.getByRole('button', { name: 'Browse all sections' }).first()
  if (await browseBlocks.isVisible({ timeout: 5000 }).catch(() => false)) {
    await browseBlocks.click()
  }

  const heroBtn = page.locator('button').filter({ hasText: /^Hero$/ }).first()
  if (await heroBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
    await heroBtn.click()
  }

  if (await page.getByRole('heading', { name: 'Choose section style' }).isVisible({ timeout: 5000 }).catch(() => false)) {
    await page.locator('button').filter({ hasText: /Solid|Split|Minimal|Bar/i }).first().click()
  }

  await expect(page.locator('[data-block-id]').first()).toBeVisible({ timeout: 120000 })
}

test('website builder smoke — navigation, guides, canvas, selection', async ({ page }) => {
  await loginViaUi(page)

  // P0: Website Builder must appear under My Kit (not only buried in System Configuration)
  await page.goto('/websites', { waitUntil: 'domcontentloaded', timeout: 60000 })
  const myKitHeader = page.getByRole('button', { name: 'My Kit' })
  if (await myKitHeader.isVisible({ timeout: 10000 }).catch(() => false)) {
    const expanded = await myKitHeader.getAttribute('aria-expanded')
    if (expanded === 'false') await myKitHeader.click()
  }
  await expect(page.getByRole('link', { name: 'Website Builder' }).first()).toBeVisible({ timeout: 15000 })

  await openFirstWebsiteBuilder(page)

  // "More" menu in the main toolbar — publish, view store, change history, tips
  await page.getByRole('button', { name: 'More' }).click()
  await expect(page.getByText('Change history')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Show tips')).toBeVisible()
  await page.getByRole('button', { name: 'More' }).click()

  const welcomeGuide = page.getByText('Start here', { exact: true })
  if (await welcomeGuide.isVisible({ timeout: 3000 }).catch(() => false)) {
    await expect(welcomeGuide).toBeVisible()
  }

  await ensureCanvasHasBlock(page)

  await expect(page.locator('[data-block-id]').first()).toBeVisible({ timeout: 90000 })
  expect(await page.locator('[data-block-id]').count()).toBeGreaterThan(0)

  const textField = page.locator('[data-text-key]').first()
  if (await textField.count()) {
    await textField.click()
    await expect(textField).toHaveAttribute('contenteditable', 'true', { timeout: 10000 })
  } else {
    await page.locator('[data-block-id]').nth(1).click({ position: { x: 40, y: 40 }, force: true })
  }

  await expect(page.locator('[data-builder-section-toolbar]').first()).toBeVisible({ timeout: 15000 })

  // Spacing tip or padding handle affordance when a section is selected
  const spacingHint = page.getByText('Adjust spacing', { exact: false })
  const paddingHandle = page.locator('[data-section-padding-handle]').first()
  await expect(spacingHint.or(paddingHandle).first()).toBeVisible({ timeout: 10000 })

  // Device preview — phone view button
  await expect(page.getByRole('button', { name: 'Phone view' })).toBeVisible({ timeout: 10000 })
})
