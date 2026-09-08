import type { Page } from '@playwright/test';

/** The date every landing-page test pretends it is. Matches seed.sql fixtures. */
export const FROZEN_NOW = new Date('2026-09-08T12:00:00+08:00');

/**
 * Freeze the page clock before any app code runs. The calendar renders
 * "today" from the system clock, so without this every assertion about
 * today's badge, today's column, or the initial scroll position rots.
 */
export async function gotoFrozen(page: Page, path = '/'): Promise<void> {
	await page.clock.install({ time: FROZEN_NOW });
	await page.goto(path);
	await page.waitForSelector('.calendar-day', { state: 'attached' });
}
