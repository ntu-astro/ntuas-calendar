import { test, expect } from '@playwright/test';
import { readDevVars } from '../scripts/read-dev-vars.mjs';

const { ADMIN_PASSWORD } = readDevVars();

if (!ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD missing from .dev.vars');
}

test.describe('Visual regression — UI must not drift', () => {
  test('login page', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    // Stabilise font rendering before screenshotting
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('login.png', { fullPage: true });
  });

  test('admin dashboard', async ({ page }) => {
    await page.goto('/admin');
    await page.fill('input[name="password"]', ADMIN_PASSWORD);
    await Promise.all([
      page.waitForURL('**/admin'),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('admin.png', {
      fullPage: true,
      mask: [page.locator('meta[name="csrf-token"]')],
    });
  });
});
