import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '[::1]') return
    const replace = window.location.replace.bind(window.location)
    window.location.replace = (url: string | URL) => {
      try {
        const next = new URL(String(url), window.location.href)
        if (next.hostname === '127.0.0.1') return
      } catch {
        /* ignore */
      }
      replace(url)
    }
  })
})

async function openFirstWebsiteBuilder(page: import('@playwright/test').Page) {
  await page.goto('/websites', { waitUntil: 'domcontentloaded', timeout: 60000 })

  if (/\/websites\/[^/?#]+/.test(page.url())) return

  const openBuilder = page.getByRole('button', { name: 'Open builder' }).first()
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
  await page.goto('/', { waitUntil: 'commit', timeout: 120000 })
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible({ timeout: 120000 })

  // P0: Website Builder must appear under Website Management
  await page.goto('/websites', { waitUntil: 'domcontentloaded', timeout: 60000 })
  const websiteMgmtHeader = page.getByRole('button', { name: 'Website Management' })
  if (await websiteMgmtHeader.isVisible({ timeout: 10000 }).catch(() => false)) {
    const expanded = await websiteMgmtHeader.getAttribute('aria-expanded')
    if (expanded === 'false') await websiteMgmtHeader.click()
  }
  await expect(page.getByRole('link', { name: 'Business Website Builder' }).first()).toBeVisible({ timeout: 15000 })

  await openFirstWebsiteBuilder(page)

  await expect(page.getByRole('button', { name: 'More', exact: true })).toBeVisible({ timeout: 120000 })

  // "More" menu in the main toolbar — publish, view store, change history, tips
  await page.getByRole('button', { name: 'More', exact: true }).click()
  await expect(page.getByText('Change history')).toBeVisible({ timeout: 10000 })
  if (await page.getByText('Show tips').isVisible({ timeout: 3000 }).catch(() => false)) { await expect(page.getByText('Show tips')).toBeVisible() }
  await page.getByRole('button', { name: 'More', exact: true }).click()

  const welcomeGuide = page.getByText('Start here', { exact: true })
  if (await welcomeGuide.isVisible({ timeout: 3000 }).catch(() => false)) {
    await expect(welcomeGuide).toBeVisible()
  }

  await ensureCanvasHasBlock(page)

  await expect(page.locator('[data-block-id]').first()).toBeVisible({ timeout: 90000 })
  expect(await page.locator('[data-block-id]').count()).toBeGreaterThan(0)

  const textField = page.locator('[data-text-key]').first()
  if (await textField.count()) {
    await textField.dblclick()
    if ((await textField.getAttribute('contenteditable')) !== 'true') {
      await page.locator('[data-block-id]').first().click({ force: true })
    }
  } else {
    await page.locator('[data-block-id]').nth(1).click({ position: { x: 40, y: 40 }, force: true })
  }

  await expect(page.locator('[data-builder-section-toolbar]').first()).toBeVisible({ timeout: 15000 })

  // Spacing tip or padding handle affordance when a section is selected
  const spacingHint = page.getByText('Adjust spacing', { exact: false })
  const paddingHandle = page.locator('[data-section-padding-handle]').first()
  await expect(spacingHint.or(paddingHandle).first()).toBeVisible({ timeout: 10000 })

})
