# Notion Calendar Alignment — JS/Markup Pass Implementation Plan

> **For Antigravity:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Fix three repo-hygiene defects that block local development, then close the remaining behavioural, accessibility, and theming gaps between `calendar.ntuas.com` and Notion Calendar that could not be fixed in CSS alone.

**Architecture:** The landing page is a static shell (`public/index.html`, all CSS inline) hydrated by an ES module graph compiled from `client/src/*.ts` into `public/dist/`. All remaining work is in those TypeScript modules plus the inline CSS. No Worker or database schema changes are required except seed fixtures.

**Tech Stack:** Cloudflare Workers + D1, TypeScript (strict, no framework), wrangler, vitest with `@cloudflare/vitest-pool-workers`, Playwright.

---

## Critical Context — read before writing any test

This project has **two test runners with different capabilities**. Choosing wrong wastes hours.

| Runner | Location | Environment | Use it for |
|---|---|---|---|
| vitest | `test/*.spec.ts` | Cloudflare Workers pool — **no DOM, no `document`, no `window`** | Pure functions only |
| Playwright | `e2e/*.spec.ts` | Real Chromium at `127.0.0.1:8787`, viewport 1280×800 | Anything touching the DOM |

Precedent for unit-testing client code exists: `test/dates.spec.ts` imports directly from `../client/src/dates`. That works **only** because `dates.ts` is pure. `weekGrid.ts`, `ui.ts`, `categories.ts`, and `eventDetail.ts` all touch `document` and therefore **cannot** be tested in vitest.

Two further constraints:

1. **`e2e/screenshot.spec.ts` currently covers only `/admin` and `/admin/login`.** The landing page has zero end-to-end coverage. Task 4 creates the first landing-page e2e file; every DOM task afterwards depends on it.
2. **The app renders "today", so tests are time-dependent.** Every landing-page e2e test must freeze the clock with Playwright's `page.clock` API before `page.goto`, or tests will pass today and fail tomorrow. Task 4 establishes this helper.

**Build step:** after editing anything in `client/src/**` you must run `npm run build:client`. `wrangler dev` serves `public/dist/` as-is, so skipping this means you are testing a stale bundle. This is the single most common way to waste time in this repo.

**Uncommitted work exists.** A completed CSS alignment pass is sitting unstaged in `public/index.html` and `.claude/launch.json`. Task 1 commits it before anything else.

---

## Task 1: Commit the existing CSS pass and the launch-config fix

The working tree currently holds a finished, verified CSS alignment pass plus a repair to `.claude/launch.json`. Commit these before starting new work so later diffs stay readable.

**Files:**
- Modify: `public/index.html` (already edited — do not re-edit)
- Modify: `.claude/launch.json` (already edited — do not re-edit)

**Step 1: Review what is staged for commit**

```bash
git diff --stat
git diff .claude/launch.json
```

Expected: `public/index.html` shows roughly 20 style changes; `.claude/launch.json` shows `runtimeExecutable` changed from an absolute node path to `npm`.

**Step 2: Confirm the suite is green before committing**

```bash
npm test
```

Expected: `Test Files 13 passed (13)`, `Tests 151 passed (151)`.

**Step 3: Commit as two logical changes**

```bash
git add .claude/launch.json
git commit -m "fix: point launch.json at this project's own dev server

The runtimeExecutable referenced a wrangler binary inside
Documents/NTUAS/my-calendar-api, a checkout that no longer exists, so no
dev server could start from the launch config at all. Use npm run dev."

git add public/index.html
git commit -m "style: align landing page with Notion Calendar

Match Notion's computed values exactly: flat 13px UI type scale, title-case
weekday headers, #fcfcfc weekend tint, opacity-based out-of-month dimming,
#f04842 today badge, #ececec grid lines, borderless toolbar buttons.

Move hover affordance from the cell onto the day number, matching Notion,
and stop advertising empty cells as clickable.

Fix a focus trap: the closed search overlay was opacity:0 but still
visibility:visible, leaving its input in the tab order.

Drop the Google Fonts Inter import — the stack led with 'Notion Sans',
which has no @font-face rule and only ever resolved on machines with the
Notion Calendar desktop app installed. Everyone else silently got Inter.
Use the system stack, which is what Notion's own web app uses."
```

---

## Task 2: Make a broken local database fail loudly instead of as a 500

**Problem observed:** `/api/events` returned `500 D1_ERROR: no such table: events`. The landing page rendered its shell and showed "Could not load calendar events", giving no hint that the fix is a one-line setup command. `npm run setup` already exists and does the right thing (wipe state → apply migrations → seed → typegen) but nothing points you at it when the database is missing.

**Files:**
- Modify: `src/routes/events.ts`
- Test: `test/events.spec.ts`

**Step 1: Read the current handler**

```bash
sed -n '1,50p' src/routes/events.ts
```

Note the line that queries the `events` table (around line 34) and how errors currently propagate.

**Step 2: Write the failing test**

Add to `test/events.spec.ts`:

```typescript
it('returns a setup hint when the events table does not exist', async () => {
	await env.DB.prepare('DROP TABLE IF EXISTS events').run();

	const res = await SELF.fetch('https://example.com/api/events');

	expect(res.status).toBe(503);
	const body = (await res.json()) as { error: string };
	expect(body.error).toContain('npm run setup');
});
```

**Step 3: Run it and watch it fail**

```bash
npm test -- --run test/events.spec.ts
```

Expected: FAIL — received status 500, and the body has no `npm run setup` text.

**Step 4: Implement the minimal handler change**

In `src/routes/events.ts`, wrap the D1 query so a missing-table error becomes an actionable 503. Keep every other error path exactly as it is — do not swallow unrelated failures:

```typescript
const MISSING_TABLE = /no such table/i;

// inside handleEvents, around the existing query:
try {
	// ...existing query...
} catch (err) {
	const message = err instanceof Error ? err.message : String(err);
	if (MISSING_TABLE.test(message)) {
		console.error('[events] local database not initialised:', message);
		return Response.json(
			{ error: 'Local database is not initialised. Run: npm run setup' },
			{ status: 503, headers: SECURITY_HEADERS },
		);
	}
	throw err;
}
```

Import `SECURITY_HEADERS` from `../constants` if it is not already imported.

**Step 5: Run the test again**

```bash
npm test -- --run test/events.spec.ts
```

Expected: PASS.

**Step 6: Confirm nothing else regressed**

```bash
npm test
```

Expected: all 13 files pass, test count now 152.

**Step 7: Commit**

```bash
git add src/routes/events.ts test/events.spec.ts
git commit -m "fix(events): return an actionable 503 when local D1 is uninitialised

A wiped .wrangler state produced an opaque 500 and a generic connection
error in the UI. Point the developer at npm run setup instead."
```

---

## Task 3: Give the seed deterministic, dated fixtures

**Problem observed:** `seed.sql` is 1.6 KB and contains no events in the month currently under development, so a rendered event chip could not be visually confirmed after changing its border radius. Fixtures must also be **fixed dates**, not relative ones, so that Playwright can freeze the clock against them.

**Files:**
- Modify: `seed.sql`
- Test: `test/events.spec.ts`

**Step 1: Read the existing seed to match its column list exactly**

```bash
cat seed.sql
```

Copy the existing `INSERT INTO events (...)` column list verbatim — do not invent column names. Note the `YYYYMMDDTHHMMSSZ` date format and the existing `calendar_id` of `main-cal-001`.

**Step 2: Write the failing test**

Add to `test/events.spec.ts`:

```typescript
it('seed fixtures cover the September 2026 reference month', async () => {
	const res = await SELF.fetch('https://example.com/api/events');
	const events = (await res.json()) as Array<{ dtstart: string; categories: string | null }>;

	const september = events.filter(e => e.dtstart?.startsWith('202609'));
	expect(september.length).toBeGreaterThanOrEqual(3);

	// At least two distinct categories, so the filter UI has something to toggle.
	const categories = new Set(september.map(e => e.categories).filter(Boolean));
	expect(categories.size).toBeGreaterThanOrEqual(2);
});
```

**Step 3: Run it and watch it fail**

```bash
npm test -- --run test/events.spec.ts
```

Expected: FAIL — `september.length` is 0.

**Step 4: Append fixtures to `seed.sql`**

Use fixed September 2026 dates spread across different weeks so the grid, the chip overflow (`.event-chip-more`), and the category filter all have something to render. Include at least one all-day event, one timed event, and one day carrying three events so the overflow affordance is exercised:

```sql
-- ─── September 2026 reference fixtures ───
-- Fixed dates on purpose: e2e tests freeze the clock to 2026-09-08 and assert
-- against these. Changing these dates will break e2e/landing.spec.ts.

INSERT INTO events (uid, calendar_id, dtstamp, dtstart, dtend, summary, description, location, status, sequence, categories)
VALUES
  ('seed-sep-04', 'main-cal-001', '20260901T000000Z', '20260904T110000Z', '20260904T130000Z',
   'Stargazing and Telescope Sharing', 'Seed fixture.', 'LHN-TR+07', 'CONFIRMED', 0, 'Club Events'),
  ('seed-sep-12', 'main-cal-001', '20260901T000000Z', '20260912T000000Z', '20260913T000000Z',
   'Total Solar Eclipse', 'Seed fixture, all-day.', '', 'CONFIRMED', 0, 'Astronomical Events'),
  ('seed-sep-21a', 'main-cal-001', '20260901T000000Z', '20260921T090000Z', '20260921T100000Z',
   'Committee Meeting', 'Seed fixture, overflow 1 of 3.', 'TR+11', 'CONFIRMED', 0, 'Club Events'),
  ('seed-sep-21b', 'main-cal-001', '20260901T000000Z', '20260921T110000Z', '20260921T120000Z',
   'Perseids Debrief', 'Seed fixture, overflow 2 of 3.', 'TR+11', 'CONFIRMED', 0, 'Astronomical Events'),
  ('seed-sep-21c', 'main-cal-001', '20260901T000000Z', '20260921T140000Z', '20260921T150000Z',
   'Outreach Planning', 'Seed fixture, overflow 3 of 3.', 'TR+11', 'CONFIRMED', 0, 'Club Events');
```

If the existing `events` table has no `categories` column, check the migrations before assuming — run `grep -n "categories" migrations/*.sql` and match the real schema.

**Step 5: Reload the local database and run the test**

```bash
npm run setup
npm test -- --run test/events.spec.ts
```

Expected: PASS.

**Step 6: Confirm the chips actually render**

```bash
npm run build:client
npm run dev
```

Open `http://localhost:8787`, scroll to September 2026. Expected: chips on the 4th, 12th, and three on the 21st (or two plus a "+1 more"). This is the visual confirmation that was impossible before this task.

**Step 7: Commit**

```bash
git add seed.sql test/events.spec.ts
git commit -m "test: add fixed-date September 2026 seed fixtures

Local dev had no events in the reference month, so rendered event chips
and the overflow affordance could not be verified. Dates are fixed rather
than relative because the e2e suite freezes the clock against them."
```

---

## Task 4: Create the landing-page e2e harness

Everything after this task depends on it. The landing page has no e2e coverage at all today.

**Files:**
- Create: `e2e/landing.spec.ts`
- Create: `e2e/helpers/freezeClock.ts`

**Step 1: Write the clock helper**

Create `e2e/helpers/freezeClock.ts`:

```typescript
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
```

**Step 2: Write the first failing test**

Create `e2e/landing.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { gotoFrozen } from './helpers/freezeClock';

test.describe('Landing page — structure', () => {
	test('renders the frozen month with today marked', async ({ page }) => {
		await gotoFrozen(page);

		await expect(page.locator('#monthLabel')).toHaveText('September 2026');
		await expect(page.locator('.today-marker')).toHaveText('8');
	});
});
```

**Step 3: Run it**

```bash
npm run test:e2e -- e2e/landing.spec.ts
```

Expected: PASS. If it fails on `#monthLabel`, the clock is not being installed early enough — confirm `page.clock.install` runs before `page.goto`.

**Step 4: Commit**

```bash
git add e2e/landing.spec.ts e2e/helpers/freezeClock.ts
git commit -m "test(e2e): add landing-page harness with a frozen clock

The landing page had no e2e coverage. Freezing the clock makes every
assertion about today's date reproducible."
```

---

## Task 5 (A1): Fix the clipped first row

**Root cause, already diagnosed — do not re-investigate.** `client/src/weekGrid.ts:23` hardcodes `const STICKY_OFFSET = 112;`, which matches the CSS custom properties `--topbar-height: 44px` + `--month-heading-height: 36px` + `--daynames-height: 32px`. But the header *renders* 48 + 45 + 34 = **127px**. The 15px difference is exactly the amount of the first week row hidden behind the sticky header. The CSS variables are stale, and the Task 1 CSS pass changed the weekday font size, which may move the real height again.

**Do not replace 112 with 127.** A second magic number rots the same way. Measure at runtime.

**Files:**
- Modify: `client/src/weekGrid.ts:23`, and `scrollWeekIntoView` at `client/src/weekGrid.ts:376`
- Test: `e2e/landing.spec.ts`

**Step 1: Write the failing test**

Append to `e2e/landing.spec.ts`:

```typescript
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
```

**Step 2: Run it and watch it fail**

```bash
npm run test:e2e -- e2e/landing.spec.ts
```

Expected: FAIL — `clipped` is about 15.

**Step 3: Replace the constant with a runtime measurement**

In `client/src/weekGrid.ts`, delete `const STICKY_OFFSET = 112;` and add:

```typescript
/**
 * Height of the sticky header stack (top bar + month heading + day names).
 * Measured rather than hardcoded: a previous constant of 112 drifted from the
 * real 127px and clipped the first week row by 15px.
 */
function getStickyOffset(): number {
	const namesRow = document.querySelector('.day-names-row');
	const area = document.getElementById('calendarArea');
	if (!namesRow || !area) return 0;
	return Math.round(namesRow.getBoundingClientRect().bottom - area.getBoundingClientRect().top);
}
```

Then replace both usages. At `scrollWeekIntoView`:

```typescript
export function scrollWeekIntoView(weekEl: HTMLElement, behavior?: 'smooth'): void {
	const scrollArea = document.getElementById('calendarArea') as HTMLDivElement;
	const targetTop = weekEl.offsetTop - getStickyOffset();
	if (behavior === 'smooth') {
		scrollArea.scrollTo({ top: targetTop, behavior: 'smooth' });
	} else {
		scrollArea.scrollTop = targetTop;
	}
}
```

And in `scrollToDate`, replace `STICKY_OFFSET` with `getStickyOffset()` in the `canSmoothScroll` expression.

**Step 4: Rebuild and re-run**

```bash
npm run build:client
npm run test:e2e -- e2e/landing.spec.ts
```

Expected: PASS.

**Step 5: Delete the now-lying CSS variables**

The `--topbar-height` / `--month-heading-height` / `--daynames-height` / `--header-height` variables in `public/index.html` no longer describe reality. Check whether anything still consumes them:

```bash
grep -n "header-height\|topbar-height\|daynames-height\|month-heading-height" public/index.html
```

`--header-height` is used by `.calendar-day`'s `height: calc((100vh - var(--header-height)) / 6)`. Update the three component variables to the measured values (48px / 45px / 34px) so that calc stays correct, and add a comment that `getStickyOffset()` in `weekGrid.ts` is the runtime source of truth.

**Step 6: Confirm nothing regressed and commit**

```bash
npm test && npm run test:e2e
git add client/src/weekGrid.ts public/index.html e2e/landing.spec.ts
git commit -m "fix(grid): measure the sticky header instead of hardcoding 112px

STICKY_OFFSET was a hardcoded 112 matching stale CSS variables, while the
header actually rendered 127px, clipping the first week row by 15px on
every scroll anchor. Measure at runtime so it cannot drift again."
```

---

## Task 6 (A2): Clear the detail panel when its category is filtered out

**Root cause:** `renderCategoryFilter` in `client/src/categories.ts` calls `refreshAllDayChips()` and `renderUpcomingEvents()` on toggle, but nothing re-checks the open detail panel. Nothing in `state.ts` records which event is currently displayed, so there is nothing to check against — that state must be added first, following the existing `export let` + setter pattern.

**Files:**
- Modify: `client/src/state.ts`
- Modify: `client/src/eventDetail.ts:106` (`showEventDetails`), `:125` (`clearEventDetails`)
- Modify: `client/src/categories.ts` (toggle handler)
- Test: `e2e/landing.spec.ts`

**Step 1: Write the failing test**

```typescript
test('filtering a category closes a detail panel showing that category', async ({ page }) => {
	await gotoFrozen(page);

	await page.locator('.event-chip').first().click();
	await expect(page.locator('.detail-event-title')).toBeVisible();
	const category = await page.locator('.detail-event-card').getAttribute('data-category');

	await page.locator(`.category-item[data-category="${category}"]`).click();

	await expect(page.locator('.detail-event-title')).toHaveCount(0);
});
```

If `.detail-event-card` has no `data-category` attribute, add one in `showEventDetails` as part of Step 3 — the test needs a way to name the category to toggle.

**Step 2: Run it and watch it fail**

```bash
npm run test:e2e -- e2e/landing.spec.ts
```

Expected: FAIL — the detail title is still visible after the toggle.

**Step 3: Add selected-event state**

In `client/src/state.ts`, beside the other mutable bindings:

```typescript
export let selectedEvent: ApiEvent | null = null;

export function setSelectedEvent(v: ApiEvent | null): void {
	selectedEvent = v;
}
```

**Step 4: Track it in the detail panel**

In `client/src/eventDetail.ts`, import `setSelectedEvent` from `./state.js`, then call `setSelectedEvent(evt)` as the first line of `showEventDetails` and `setSelectedEvent(null)` as the first line of `clearEventDetails`.

**Step 5: Re-check visibility on toggle**

In `client/src/categories.ts`, import `selectedEvent` from `./state.js` and `clearEventDetails` from `./eventDetail.js` (the latter is likely already imported), then extend the toggle handler:

```typescript
refreshAllDayChips();
renderUpcomingEvents();

// A hidden category must not leave its event open in the detail panel.
if (selectedEvent && !isCategoryVisible(selectedEvent)) {
	clearEventDetails();
}
```

`isCategoryVisible` is already exported from this module.

**Step 6: Rebuild, re-run, commit**

```bash
npm run build:client
npm run test:e2e -- e2e/landing.spec.ts
git add client/src/state.ts client/src/eventDetail.ts client/src/categories.ts e2e/landing.spec.ts
git commit -m "fix(filter): close the detail panel when its category is hidden

Unchecking a category hid its chips but left an open detail panel showing
a now-filtered-out event."
```

---

## Task 7 (B3): Emphasise today's weekday column header

Notion renders today's column label at weight 500 in `rgb(50,48,44)` while the other six sit at weight 400 in `rgb(120,119,116)`. The site renders all seven identically.

**Files:**
- Modify: `client/src/ui.ts:11` (`renderDayNamesRow`)
- Modify: `public/index.html` (`.calendar-day-name` block)
- Test: `e2e/landing.spec.ts`

**Step 1: Write the failing test**

```typescript
test("today's weekday column header is emphasised", async ({ page }) => {
	await gotoFrozen(page); // 2026-09-08 is a Tuesday

	const today = page.locator('.calendar-day-name.is-today');
	await expect(today).toHaveText('Tue');
	await expect(today).toHaveCSS('font-weight', '500');
	await expect(today).toHaveCSS('color', 'rgb(50, 48, 44)');
});
```

**Step 2: Run and watch it fail**

Expected: FAIL — no element matches `.calendar-day-name.is-today`.

**Step 3: Tag the column in `renderDayNamesRow`**

```typescript
export function renderDayNamesRow(): void {
	const row = document.getElementById('dayNamesRow')!;
	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const todayIndex = new Date().getDay();
	days.forEach((d, i) => {
		const el = document.createElement('div');
		el.className = 'calendar-day-name';
		if (i === todayIndex) el.classList.add('is-today');
		el.textContent = d;
		row.appendChild(el);
	});
}
```

**Step 4: Add the style**

After the existing `.calendar-day-name` rule in `public/index.html`:

```css
        .calendar-day-name.is-today {
            font-weight: 500;
            color: var(--color-charcoal);
        }
```

**Step 5: Rebuild, re-run, commit**

```bash
npm run build:client
npm run test:e2e -- e2e/landing.spec.ts
git add client/src/ui.ts public/index.html e2e/landing.spec.ts
git commit -m "feat(grid): emphasise today's weekday column header"
```

---

## Task 8 (B6): Full month name with split weights on the first of the month

Notion writes `September 1` with the month word at weight 700 and the numeral at 400. The site writes `Sep 1` with both parts at one weight.

**Files:**
- Modify: `client/src/weekGrid.ts:94` (`createDayNumberElement`)
- Modify: `public/index.html` (`.first-of-month` block)
- Test: `e2e/landing.spec.ts`

**Step 1: Write the failing test**

```typescript
test('the first of the month shows the full month name with split weights', async ({ page }) => {
	await gotoFrozen(page);

	const label = page.locator('.day-number.first-of-month', { hasText: 'September' }).first();
	await expect(label).toContainText('September 1');
	await expect(label.locator('.fom-month')).toHaveCSS('font-weight', '700');
	await expect(label.locator('.fom-day')).toHaveCSS('font-weight', '400');
});
```

**Step 2: Run and watch it fail**

Expected: FAIL — the label reads `Sep 1` and has no `.fom-month` child.

**Step 3: Rewrite the label builder**

```typescript
function createDayNumberElement(cellDate: Date, isToday: boolean): HTMLSpanElement {
	const numEl = document.createElement('span');
	numEl.className = isToday ? 'today-marker' : 'day-number';
	const dayNum = cellDate.getDate();
	if (dayNum === 1) {
		numEl.classList.add('first-of-month');
		// Notion inverts the emphasis here: month word bold, numeral regular.
		const month = document.createElement('span');
		month.className = 'fom-month';
		month.textContent = cellDate.toLocaleString('default', { month: 'long' });
		const day = document.createElement('span');
		day.className = 'fom-day';
		day.textContent = ` ${dayNum}`;
		numEl.append(month, day);
	} else {
		numEl.textContent = String(dayNum);
	}
	return numEl;
}
```

**Step 4: Replace the blanket weight rule**

The Task 1 CSS pass set `.day-number.first-of-month` to `font-weight: 700` across the whole label. Replace that with per-part weights in `public/index.html`:

```css
        .day-number.first-of-month,
        .today-marker.first-of-month {
            color: var(--color-ink);
        }

        .first-of-month .fom-month {
            font-weight: 700;
        }

        .first-of-month .fom-day {
            font-weight: 400;
        }
```

**Step 5: Check it still fits**

`September 1` is materially wider than `Sep 1`. Confirm it does not wrap or overflow at the narrow breakpoint:

```bash
npm run build:client && npm run dev
```

Check `http://localhost:8787` at 1280px and at the narrow breakpoint defined around `public/index.html:967`. If it wraps, add `white-space: nowrap` to `.day-number`.

**Step 6: Commit**

```bash
git add client/src/weekGrid.ts public/index.html e2e/landing.spec.ts
git commit -m "feat(grid): full month name with Notion's split weights on the 1st"
```

---

## Task 9 (G1–G4): Grid semantics and real controls

The whole grid is bare `<div>`s: no roles, no tabindex, no labels. There are 17 focusable controls on the page and **not one of them is a day or an event**; Notion exposes 182. The category filters look like checkboxes but are `<div>`s with no `role`, no `tabindex`, and no `<input>`. The two arrow pairs also disagree on `aria-label` casing (`Previous month` vs `Previous Month`).

This is the largest task. Split the commits.

**Files:**
- Modify: `client/src/weekGrid.ts` (`renderDayCell`, week row creation)
- Modify: `client/src/ui.ts` (`renderDayNamesRow`)
- Modify: `client/src/categories.ts` (`renderCategoryFilter`)
- Modify: `public/index.html` (aria-label casing, focus-visible styles)
- Test: `e2e/landing.spec.ts`

**Step 1: Write the failing tests**

```typescript
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

	test('month navigation labels use consistent casing', async ({ page }) => {
		await gotoFrozen(page);
		const labels = await page.locator('[aria-label*="onth" i]').evaluateAll(
			els => els.map(e => e.getAttribute('aria-label')),
		);
		const nav = labels.filter(l => /previous|next/i.test(l ?? ''));
		expect(new Set(nav.map(l => l!.toLowerCase())).size).toBe(nav.length / 2);
		expect(nav.every(l => l === l!.toLowerCase().replace(/^./, c => c.toUpperCase()))).toBe(true);
	});
});
```

**Step 2: Run and watch them all fail**

**Step 3: Add roles to the grid**

In `client/src/weekGrid.ts`, in `renderDayCell` (around line 120):

```typescript
	dayEl.className = 'calendar-day';
	dayEl.setAttribute('role', 'gridcell');
	dayEl.setAttribute('aria-label', cellDate.toLocaleDateString('en-GB', {
		day: 'numeric', month: 'long', year: 'numeric',
	}));
	dayEl.tabIndex = -1; // roving tabindex; Task 10 moves focus between cells
```

Find where week rows are created and add `role="row"`. Add `role="grid"` to the scroll container, and give it an `aria-label` such as `NTUAS event calendar`.

In `client/src/ui.ts`, add `el.setAttribute('role', 'columnheader')` inside `renderDayNamesRow`.

**Step 4: Commit the grid semantics**

```bash
npm run build:client && npm run test:e2e -- e2e/landing.spec.ts
git add client/src/weekGrid.ts client/src/ui.ts e2e/landing.spec.ts
git commit -m "feat(a11y): expose grid/row/gridcell/columnheader semantics"
```

**Step 5: Make the category filters real checkboxes**

In `client/src/categories.ts`, inside `renderCategoryFilter`, after `row.dataset.category = key;`:

```typescript
		row.setAttribute('role', 'checkbox');
		row.setAttribute('aria-checked', 'true');
		row.tabIndex = 0;
```

Extract the existing click body into a named `toggle()` so the keyboard handler can reuse it rather than duplicating logic:

```typescript
		const toggle = (): void => {
			const nowActive = !activeCategories.has(key);
			if (nowActive) {
				activeCategories.add(key);
				row.classList.remove('inactive');
			} else {
				activeCategories.delete(key);
				row.classList.add('inactive');
			}
			row.setAttribute('aria-checked', String(nowActive));
			refreshAllDayChips();
			renderUpcomingEvents();
			if (selectedEvent && !isCategoryVisible(selectedEvent)) {
				clearEventDetails();
			}
		};

		row.addEventListener('click', toggle);
		row.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === ' ' || e.key === 'Enter') {
				e.preventDefault();
				toggle();
			}
		});
```

Note this supersedes the handler written in Task 6 — fold that logic in rather than leaving two copies.

**Step 6: Add a visible focus ring**

Bare `<div>`s given `tabindex` get no focus ring by default. In `public/index.html`:

```css
        .category-item:focus-visible,
        .calendar-day:focus-visible {
            outline: 2px solid var(--color-primary);
            outline-offset: -2px;
        }
```

**Step 7: Normalise the aria-label casing**

```bash
grep -n 'aria-label="Previous Month"\|aria-label="Next Month"\|aria-label="Previous month"\|aria-label="Next month"' public/index.html
```

Pick sentence case (`Previous month` / `Next month`) for all four and make them unique per control — the mini-calendar pair should read `Previous month (mini calendar)` and `Next month (mini calendar)` so screen-reader users can tell the two pairs apart.

**Step 8: Rebuild, re-run, commit**

```bash
npm run build:client && npm run test:e2e -- e2e/landing.spec.ts
git add client/src/categories.ts public/index.html e2e/landing.spec.ts
git commit -m "feat(a11y): real checkbox semantics for filters, consistent nav labels"
```

---

## Task 10 (H1): Keyboard shortcuts

Confirmed absent: `t`, `m`, `w`, arrow keys, `/`, and `?` are all no-ops. Notion ships `⌘K`, `` ` ``, `.`, `?`, `1`/`D`, `0`/`W`, `M`. Scope this task to the subset that maps onto a month-only calendar.

**Files:**
- Create: `client/src/keyboard.ts`
- Modify: `client/src/index.ts` (wire it up)
- Test: `e2e/landing.spec.ts`

**Step 1: Write the failing tests**

```typescript
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
		await page.locator('.search-overlay input').fill('t');
		await expect(page.locator('.search-overlay')).toHaveClass(/active/);
	});
});
```

That third test matters: a naive global listener will hijack every keystroke typed into the search field.

**Step 2: Run and watch them fail**

**Step 3: Create `client/src/keyboard.ts`**

```typescript
import { scrollToDate } from './weekGrid.js';
import { openSearch, closeSearch } from './search.js';

/** True when the user is typing, so shortcuts must not hijack the key. */
function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName;
	return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

export function wireKeyboardShortcuts(): void {
	document.addEventListener('keydown', (e: KeyboardEvent) => {
		if (e.key === 'Escape') {
			closeSearch();
			return;
		}
		if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

		switch (e.key) {
			case 't':
			case 'T':
				e.preventDefault();
				scrollToDate(new Date(), 'smooth');
				break;
			case '/':
				e.preventDefault();
				openSearch();
				break;
			default:
				break;
		}
	});
}
```

Check the real exported names in `client/src/search.ts` before importing — `openSearch` and `closeSearch` are exported there and already imported by `ui.ts`.

**Step 4: Wire it in `client/src/index.ts`**

Import `wireKeyboardShortcuts` and call it alongside the other wiring calls.

**Step 5: Rebuild, re-run, commit**

```bash
npm run build:client && npm run test:e2e -- e2e/landing.spec.ts
git add client/src/keyboard.ts client/src/index.ts e2e/landing.spec.ts
git commit -m "feat(keyboard): add t (today) and / (search) shortcuts

Guarded so they never fire while the user is typing in the search field."
```

---

## Task 11 (E1, E2): Sidebar spacer and help menu

**E1:** roughly 250px of empty `.left-sidebar-spacer` sits between the category filters and the footer, which is what makes the panel read as unfinished. **E2:** the help `?` opens a one-item popover; Notion's opens a real menu.

These are the lowest-value items in the backlog and are partly product decisions rather than defects. Confirm with the owner what belongs in the help menu before building it — do not invent entries.

**Files:**
- Modify: `public/index.html` (`.left-sidebar-spacer` at line ~510, `.help-menu` markup at ~1293)
- Modify: `client/src/ui.ts` (`wireHelpMenu`)

**Step 1: Reduce the spacer**

`.left-sidebar-spacer` currently uses `flex: 1` to push the footer down. That is reasonable behaviour; the emptiness is a content problem, not a layout bug. Leave the flex behaviour and instead fill the space — the natural candidates are a subscribe hint and the ICS feed URL, both of which already exist elsewhere in the UI.

**Step 2: Extend the help menu**

Once the owner confirms the entries, add them as `.help-menu-item` anchors matching the existing Instagram entry's markup, and add a keyboard handler to `wireHelpMenu` so Escape closes the menu and arrow keys move between items.

**Step 3: Commit**

```bash
git add public/index.html client/src/ui.ts
git commit -m "feat(sidebar): fill the empty spacer and extend the help menu"
```

---

## Task 12 (C7): Dark mode

**Blocked on measurement — do not guess values.** Every Notion value captured so far was measured in **light mode only**. Notion follows the system theme and has a full dark palette, but none of it has been sampled. Implementing dark mode from invented colours would reintroduce exactly the class of error that the weekend-tint and nav-arrow findings turned out to be.

**Step 1: Measure Notion in dark mode first**

Switch macOS to dark, open `calendar.notion.so` in month view, and capture the same properties already captured for light: body background and colour, weekday header colour, today's column colour, day-number colour, out-of-month opacity, weekend cell background, grid line colour, today badge background, sidebar background, and event chip background/text.

**Step 2: Only then implement**

Define the complete light palette on bare `:root` (already the case), redefine only the changed tokens under `@media (prefers-color-scheme: dark)`, and give `body` an explicit token background. The existing token architecture in `public/index.html` makes this a token-only change — no component rules should need touching if the tokens are named correctly.

**Step 3: Extend the e2e suite**

```typescript
test('dark mode follows the system preference', async ({ browser }) => {
	const ctx = await browser.newContext({ colorScheme: 'dark' });
	const page = await ctx.newPage();
	await gotoFrozen(page);
	await expect(page.locator('body')).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
	await ctx.close();
});
```

---

## Final verification

```bash
npm run lint
npm test
npm run test:e2e
```

All three must pass. `npm run lint` runs `tsc --noEmit` over both tsconfigs plus eslint, and will catch any client-side type error introduced along the way.

**Visual regression note:** none of these tasks touch `src/templates/*`, so the admin and login byte snapshots and Playwright screenshots are unaffected. If you add a landing-page screenshot test, generate its baseline with `npm run test:e2e -- --update-snapshots` and **look at the generated PNG before committing it**.

---

## Deliberately out of scope

- `src/templates/admin.html.ts` and `src/templates/login.html.ts` still lead their font stack with `'Notion Sans'` and still import Google Fonts Inter — the same dead-font problem fixed on the landing page in Task 1. Changing them would churn both the HTML byte snapshots and the Playwright pixel baselines for pages that were never part of the Notion comparison. Worth a separate, deliberate change.
- Event chip **colours** were not aligned. Notion's chips draw from its own per-calendar palette; this site's draw from `NOTION_PALETTE` in `client/src/categories.ts`, keyed by event category. The relationship worth copying is structural — a very light background with desaturated mid-tone text of the same hue, plus a 10px/400 time prefix in a lighter tint — not the literal blue.
- **D2 (nav arrow direction) was withdrawn.** Notion's month view rotates a left/right chevron 90° via `transform: matrix(0, 1, -1, 0, 0, 0)`, so it renders vertically. The site's vertical arrows already match. Do not "fix" this.
