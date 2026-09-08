import { test, expect } from '@playwright/test';
import { gotoFrozen } from './helpers/freezeClock';

test.describe('Landing page — structure', () => {
	test('renders the frozen month with today marked', async ({ page }) => {
		await gotoFrozen(page);

		await expect(page.locator('#monthLabel')).toHaveText('September 2026');
		await expect(page.locator('.today-marker')).toHaveText('8');
	});
});

test.describe('Landing page — scroll anchoring', () => {
	test('the first visible week row is not clipped by the sticky header', async ({ page }) => {
		await gotoFrozen(page);
		await page.locator('#todayBtn').click();
		await page.waitForTimeout(500); // settle smooth scroll

		const clipped = await page.evaluate(() => {
			const namesRow = document.querySelector('.day-names-row')!;
			const contentTop = namesRow.getBoundingClientRect().bottom;
			const area = document.getElementById('calendarArea')!.getBoundingClientRect();
			const firstVisible = [...document.querySelectorAll('.week-row')]
				.map(r => r.getBoundingClientRect())
				.find(r => r.bottom > contentTop && r.top < area.bottom)!;
			return Math.round(contentTop - firstVisible.top);
		});

		expect(clipped).toBeLessThanOrEqual(1);
	});
});
