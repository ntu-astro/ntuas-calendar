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

test.describe('Landing page — first of month', () => {
	test('the first of the month shows the full month name with split weights', async ({ page }) => {
		await gotoFrozen(page);

		const label = page.locator('.day-number.first-of-month', { hasText: 'September' }).first();
		await expect(label).toContainText('September 1');
		await expect(label.locator('.fom-month')).toHaveCSS('font-weight', '700');
		await expect(label.locator('.fom-day')).toHaveCSS('font-weight', '400');
	});
});

test.describe('Landing page — accessibility', () => {
	test('the grid exposes grid/row/gridcell semantics', async ({ page }) => {
		await gotoFrozen(page);
		await expect(page.locator('[role="grid"]')).toHaveCount(1);
		expect(await page.locator('[role="row"]').count()).toBeGreaterThan(3);
		expect(await page.locator('[role="gridcell"]').count()).toBeGreaterThan(20);
		await expect(page.locator('[role="columnheader"]')).toHaveCount(7);
	});

	test('day cells carry an accessible date label', async ({ page }) => {
		await gotoFrozen(page);
		await expect(page.locator('[role="gridcell"][aria-label="8 September 2026"]')).toHaveCount(1);
	});

	test('category filters are real checkboxes reachable by keyboard', async ({ page }) => {
		await gotoFrozen(page);
		const filter = page.locator('.category-item').first();
		await expect(filter).toHaveAttribute('role', 'checkbox');
		await expect(filter).toHaveAttribute('aria-checked', 'true');

		await filter.focus();
		await page.keyboard.press('Space');
		await expect(filter).toHaveAttribute('aria-checked', 'false');
	});

	test('month navigation labels use consistent sentence case and unique pairs', async ({ page }) => {
		await gotoFrozen(page);
		const labels = await page.locator('[aria-label]').evaluateAll(els =>
			els.map(e => e.getAttribute('aria-label') ?? ''),
		);
		const nav = labels.filter(l => /previous|next/i.test(l));

		// Two pairs of arrows: the main month nav and the mini-calendar nav.
		expect(nav).toHaveLength(4);

		// Sentence case: first letter uppercase, the rest lowercase.
		const toSentence = (l: string): string => l.toLowerCase().replace(/^./, c => c.toUpperCase());
		expect(nav.every(l => l === toSentence(l))).toBe(true);

		// The mini-calendar pair is uniquely labelled so screen-reader users can
		// tell the two arrow pairs apart.
		const prev = nav.filter(l => /previous/i.test(l));
		const next = nav.filter(l => /next/i.test(l));
		expect(new Set(prev.map(l => l.toLowerCase())).size).toBe(2);
		expect(new Set(next.map(l => l.toLowerCase())).size).toBe(2);
	});
});

test.describe('Landing page — keyboard', () => {
	test('t returns to today', async ({ page }) => {
		await gotoFrozen(page);
		const area = page.locator('#calendarArea');
		await area.evaluate(el => { el.scrollTop -= 900; });
		const moved = await area.evaluate(el => el.scrollTop);

		await page.keyboard.press('t');
		await page.waitForTimeout(500);

		expect(await area.evaluate(el => el.scrollTop)).not.toBe(moved);
		await expect(page.locator('#monthLabel')).toHaveText('September 2026');
	});

	test('/ opens search and Escape closes it', async ({ page }) => {
		await gotoFrozen(page);
		await page.keyboard.press('/');
		await expect(page.locator('.search-overlay')).toHaveClass(/active/);
		await page.keyboard.press('Escape');
		await expect(page.locator('.search-overlay')).not.toHaveClass(/active/);
	});

	test('shortcuts do not fire while typing in the search box', async ({ page }) => {
		await gotoFrozen(page);
		await page.keyboard.press('/');
		await expect(page.locator('.search-overlay')).toHaveClass(/active/);

		await page.locator('.search-overlay input').press('t');

		await expect(page.locator('.search-overlay')).toHaveClass(/active/);
		await expect(page.locator('.search-overlay input')).toHaveValue('t');
	});
});

test.describe('Landing page — dark mode', () => {
	test('dark mode follows the system preference', async ({ browser }) => {
		const ctx = await browser.newContext({ colorScheme: 'dark' });
		const page = await ctx.newPage();
		await gotoFrozen(page);
		await expect(page.locator('body')).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
		await ctx.close();
	});
});
