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

test.describe('Landing page — category filter', () => {
	test('filtering a category closes a detail panel showing that category', async ({ page }) => {
		await gotoFrozen(page);

		await page.locator('.event-chip').first().click();
		await expect(page.locator('.detail-event-title')).toBeVisible();
		const category = await page.locator('.detail-event-card').getAttribute('data-category');

		await page.locator(`.category-item[data-category="${category}"]`).click();

		await expect(page.locator('.detail-event-title')).toHaveCount(0);
	});
});

test.describe('Landing page — weekday header', () => {
	test("today's weekday column header is emphasised", async ({ page }) => {
		await gotoFrozen(page); // 2026-09-08 is a Tuesday

		const today = page.locator('.calendar-day-name.is-today');
		await expect(today).toHaveText('Tue');
		await expect(today).toHaveCSS('font-weight', '500');
		await expect(today).toHaveCSS('color', 'rgb(50, 48, 44)');
	});
});
