import type { ApiEvent } from './api-types.js';
import {
	STATE,
	activeCategories,
	eventsData,
	miniCalDate,
	currentVisibleMonth,
	CATEGORY_CONFIG,
	setEventsData,
	setMiniCalDate,
	setCurrentVisibleMonth,
	setCategoryConfig,
	type CategoryStyle,
} from './state.js';

// ─── MODULE-SCOPE STATE (lifted from the former IIFE closure) ───
const SUB_URL = 'https://calendar.ntuas.com/subscribe';

const NOTION_PALETTE: ReadonlyArray<{ color: string; colorLight: string }> = [
	{ color: '#337ea9', colorLight: '#ddebf1' }, // blue
	{ color: '#e03e3e', colorLight: '#ffe2dd' }, // red
	{ color: '#d9730d', colorLight: '#faebdd' }, // orange
	{ color: '#448361', colorLight: '#ddedea' }, // green
	{ color: '#9065b0', colorLight: '#eae4f2' }, // purple
	{ color: '#c14c8a', colorLight: '#f4dfeb' }, // pink
	{ color: '#cb912f', colorLight: '#fbf3db' }, // yellow
	{ color: '#64473a', colorLight: '#e9e5e3' }  // brown
];
const DEFAULT_CATEGORY: CategoryStyle = { color: '#787774', colorLight: '#ebeced' };

function buildCategoriesFromEvents(): void {
	const seen = new Map<string, string>();
	for (const e of eventsData) {
		if (!e || !e.categories) continue;
		const raw = String(e.categories).split(/[,;]/)[0].trim();
		if (!raw) continue;
		const key = raw.toLowerCase();
		if (!seen.has(key)) seen.set(key, raw);
	}
	const sortedKeys = [...seen.keys()].sort();
	const config: Record<string, CategoryStyle> = {};
	activeCategories.clear();
	sortedKeys.forEach((key, i) => {
		const palette = NOTION_PALETTE[i % NOTION_PALETTE.length];
		config[key] = { label: seen.get(key), ...palette };
		activeCategories.add(key);
	});
	setCategoryConfig(config);
}

function getCategoryKey(evt: ApiEvent): string | null {
	if (!evt || !evt.categories) return null;
	const first = String(evt.categories).toLowerCase().split(/[,;]/)[0].trim();
	return first && CATEGORY_CONFIG[first] ? first : null;
}

function getCategoryStyle(evt: ApiEvent): CategoryStyle {
	const key = getCategoryKey(evt);
	return key ? CATEGORY_CONFIG[key] : DEFAULT_CATEGORY;
}

function isCategoryVisible(evt: ApiEvent): boolean {
	const key = getCategoryKey(evt);
	return key === null || activeCategories.has(key);
}

function buildCheckSvg(): SVGElement {
	const SVG_NS = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '3.5');
	svg.setAttribute('stroke-linecap', 'round');
	svg.setAttribute('stroke-linejoin', 'round');
	const p = document.createElementNS(SVG_NS, 'path');
	p.setAttribute('d', 'M5 12.5l5 5L20 7');
	svg.appendChild(p);
	return svg;
}

function renderCategoryFilter(): void {
	const container = document.getElementById('eventCategories');
	if (!container) return;
	container.textContent = '';
	for (const [key, cfg] of Object.entries(CATEGORY_CONFIG)) {
		const row = document.createElement('div');
		row.className = 'category-item';
		row.dataset.category = key;
		row.style.setProperty('--cat-color', cfg.color);
		row.style.setProperty('--cat-color-light', cfg.colorLight);
		const icon = document.createElement('span');
		icon.className = 'category-icon';
		icon.appendChild(buildCheckSvg());
		const label = document.createElement('span');
		label.className = 'category-label';
		label.textContent = cfg.label || '';
		row.append(icon, label);
		row.addEventListener('click', () => {
			if (activeCategories.has(key)) {
				activeCategories.delete(key);
				row.classList.add('inactive');
			} else {
				activeCategories.add(key);
				row.classList.remove('inactive');
			}
			refreshAllDayChips();
			renderUpcomingEvents();
		});
		container.appendChild(row);
	}
}

// STATE is now imported from state.js

// ─── UTILITY FUNCTIONS ───

function sundayOfWeek(date: Date): Date {
	const d = new Date(date);
	d.setDate(d.getDate() - d.getDay());
	d.setHours(0, 0, 0, 0);
	return d;
}

function thursdayOfWeek(sundayDate: Date): Date {
	const d = new Date(sundayDate);
	d.setDate(d.getDate() + 4);
	return d;
}

function addWeeks(date: Date, n: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() + 7 * n);
	return d;
}

function getWeekKey(date: Date): string {
	const sun = sundayOfWeek(date);
	return `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`;
}

function getMonthKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeyToDate(key: string): Date {
	const [y, m] = key.split('-').map(Number);
	return new Date(y, m - 1, 1);
}

function formatMonthYear(date: Date): string {
	return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function parseDtstart(dtstart: string | null): Date | null {
	if (!dtstart) return null;
	if (dtstart.includes('T')) {
		const iso = dtstart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
		return new Date(iso);
	} else {
		const y = dtstart.slice(0, 4), m = dtstart.slice(4, 6), d = dtstart.slice(6, 8);
		return new Date(y + '-' + m + '-' + d + 'T00:00:00');
	}
}

function dtToDateStr(dtstart: string | null): string | null {
	if (!dtstart) return null;
	if (dtstart.includes('T')) {
		return dtstart.replace(/(\d{4})(\d{2})(\d{2})T.*/, '$1-$2-$3');
	} else {
		const y = dtstart.slice(0, 4), m = dtstart.slice(4, 6), d = dtstart.slice(6, 8);
		return y + '-' + m + '-' + d;
	}
}

// ─── INIT ───

async function initCalendar(): Promise<void> {
	try {
		const today = new Date();
		const fromISO = new Date(today.getFullYear() - 1, 0, 1).toISOString().slice(0, 10);
		const toISO = new Date(today.getFullYear() + 1, 11, 31).toISOString().slice(0, 10);
		const res = await fetch(`/api/events?from=${fromISO}&to=${toISO}`);
		if (res.ok) {
			setEventsData(await res.json() as ApiEvent[]);
		} else {
			document.getElementById('errorBanner')!.classList.add('visible');
		}
	} catch {
		document.getElementById('errorBanner')!.classList.add('visible');
	}

	buildCategoriesFromEvents();
	renderCategoryFilter();

	renderDayNamesRow();

	// Start the view on the week containing the 1st of the current month
	const today = new Date();
	const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
	renderWeeks(firstOfMonth, 'both');

	// Scroll so the week containing the 1st of the month is the first visible row
	const firstWeekKey = getWeekKey(firstOfMonth);
	const firstWeekEl = STATE.weekElements.get(firstWeekKey);
	if (firstWeekEl) {
		scrollWeekIntoView(firstWeekEl);
	}

	// Setup month header observer immediately for sync
	setupMonthHeaderObserver();
	renderMiniCalendar();
	renderUpcomingEvents();
	attachButtonHandlers();

	// Defer sentinel observer so initial scroll settles first
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			setupSentinelObserver();
		});
	});
}

// ─── DAY NAMES ROW ───

function renderDayNamesRow(): void {
	const row = document.getElementById('dayNamesRow')!;
	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	days.forEach(d => {
		const el = document.createElement('div');
		el.className = 'calendar-day-name';
		el.textContent = d;
		row.appendChild(el);
	});
}

// ─── WEEK ROW INSERTION (continuous grid, no month sections) ───

function insertWeekRowSorted(row: HTMLDivElement, weekKey: string): void {
	const container = document.getElementById('scrollContainer')!;
	const sentinelBottom = document.getElementById('sentinelBottom')!;
	const existingWeeks = Array.from(container.querySelectorAll('.week-row')) as HTMLDivElement[];
	let inserted = false;
	for (const existing of existingWeeks) {
		if (existing.dataset.week && existing.dataset.week > weekKey) {
			container.insertBefore(row, existing);
			inserted = true;
			break;
		}
	}
	if (!inserted) {
		container.insertBefore(row, sentinelBottom);
	}
}

// ─── DAY EVENT CHIPS ───

function getVisibleEventsForDate(dateStr: string | null): ApiEvent[] {
	if (!dateStr) return [];
	return eventsData.filter(e => {
		if (!e.dtstart) return false;
		if (dtToDateStr(e.dtstart) !== dateStr) return false;
		return isCategoryVisible(e);
	});
}

function applyDayEventChips(dayEl: HTMLDivElement, allDayEvents: ApiEvent[]): void {
	// Strip existing chips/more from a re-render
	dayEl.querySelectorAll('.event-chip, .event-chip-more').forEach(el => el.remove());
	const visible = allDayEvents.filter(isCategoryVisible);
	if (visible.length === 0) {
		dayEl.classList.remove('has-event');
		return;
	}
	dayEl.classList.add('has-event');
	visible.slice(0, 2).forEach(evt => {
		const chip = document.createElement('div');
		chip.className = 'event-chip';
		const style = getCategoryStyle(evt);
		chip.style.background = style.colorLight;
		chip.style.color = style.color;
		chip.textContent = evt.summary || 'Event';
		chip.addEventListener('click', (e) => {
			e.stopPropagation();
			document.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
			dayEl.classList.add('selected');
			showEventDetails(evt);
		});
		dayEl.appendChild(chip);
	});
	if (visible.length > 2) {
		const more = document.createElement('div');
		more.className = 'event-chip-more';
		more.textContent = `+${visible.length - 2} more`;
		dayEl.appendChild(more);
	}
}

function refreshAllDayChips(): void {
	document.querySelectorAll('.calendar-day[data-date]').forEach(el => {
		const dayEl = el as HTMLDivElement;
		const dateStr = dayEl.dataset.date || '';
		const dayEvents = eventsData.filter(e => e.dtstart && dtToDateStr(e.dtstart) === dateStr);
		applyDayEventChips(dayEl, dayEvents);
	});
}

// ─── WEEK ROW RENDERING ───

function renderWeekRow(sundayDate: Date): HTMLElement {
	const weekKey = getWeekKey(sundayDate);
	if (STATE.weekElements.has(weekKey)) return STATE.weekElements.get(weekKey)!;

	const today = new Date();
	const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

	const row = document.createElement('div') as HTMLDivElement;
	row.className = 'week-row';
	row.dataset.week = weekKey;

	// Determine which month this week belongs to (by Thursday)
	const thu = thursdayOfWeek(sundayDate);
	const ownerMonthKey = getMonthKey(thu);

	for (let d = 0; d < 7; d++) {
		const cellDate = new Date(sundayDate);
		cellDate.setDate(cellDate.getDate() + d);

		const cellMonthKey = getMonthKey(cellDate);
		const dayEl = document.createElement('div') as HTMLDivElement;
		dayEl.className = 'calendar-day';

		// Weekend styling (Sun=0, Sat=6)
		if (d === 0 || d === 6) {
			dayEl.classList.add('weekend-day');
		}

		// Store cell's month for dynamic ghosting on scroll
		dayEl.dataset.dateMonth = cellMonthKey;

		// Ghost cells that don't belong to the currently visible month.
		// Fall back to the week's owning month until the scroll observer
		// sets currentVisibleMonth on first paint.
		const refMonthKey = currentVisibleMonth || ownerMonthKey;
		if (cellMonthKey !== refMonthKey) {
			dayEl.classList.add('other-month-day');
		}

		const year = cellDate.getFullYear();
		const month = cellDate.getMonth();
		const dayNum = cellDate.getDate();

		const currentDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
		dayEl.dataset.date = currentDayStr;
		const isToday = currentDayStr === todayStr;

		const numEl = document.createElement('span');
		if (isToday) {
			numEl.className = 'today-marker';
		} else {
			numEl.className = 'day-number';
		}
		// Show month name on the 1st of each month (bold)
		if (dayNum === 1) {
			numEl.classList.add('first-of-month');
			const shortMonth = cellDate.toLocaleString('default', { month: 'short' });
			numEl.textContent = `${shortMonth} ${dayNum}`;
		} else {
			numEl.textContent = String(dayNum);
		}
		dayEl.appendChild(numEl);

		// Events for this day
		const dayEvents = eventsData.filter(e => {
			if (!e.dtstart) return false;
			return dtToDateStr(e.dtstart) === currentDayStr;
		});

		applyDayEventChips(dayEl, dayEvents);
		dayEl.addEventListener('click', () => {
			document.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
			dayEl.classList.add('selected');
			const visible = getVisibleEventsForDate(dayEl.dataset.date || null);
			if (visible.length > 0) {
				showEventDetails(visible[0]);
			} else {
				clearEventDetails();
			}
		});

		row.appendChild(dayEl);
	}

	// Place directly in scroll container (continuous grid)
	insertWeekRowSorted(row, weekKey);

	STATE.weekElements.set(weekKey, row);
	return row;
}

// ─── RENDER WEEKS ───

function renderWeeks(centerDate: Date, direction: 'both' | 'up' | 'down'): void {
	const center = sundayOfWeek(centerDate);
	const count = STATE.BUFFER_WEEKS;

	if (direction === 'both' || direction === 'up') {
		for (let i = count; i >= 1; i--) {
			const sun = addWeeks(center, -i);
			renderWeekRow(sun);
		}
	}

	// Render center week
	renderWeekRow(center);

	if (direction === 'both' || direction === 'down') {
		for (let i = 1; i <= count; i++) {
			const sun = addWeeks(center, i);
			renderWeekRow(sun);
		}
	}

	updateRenderedRange();
	recycleIfNeeded();
}

function appendWeeks(count: number): void {
	if (!STATE.renderedEnd) return;
	for (let i = 1; i <= count; i++) {
		const sun = addWeeks(STATE.renderedEnd, i);
		renderWeekRow(sun);
	}
	updateRenderedRange();
	recycleIfNeeded();
}

function prependWeeks(count: number): void {
	if (!STATE.renderedStart) return;
	const scrollArea = document.getElementById('calendarArea') as HTMLDivElement;
	const anchorEl = STATE.weekElements.get(getWeekKey(STATE.renderedStart));
	const anchorTop = anchorEl ? anchorEl.offsetTop : 0;

	for (let i = count; i >= 1; i--) {
		const sun = addWeeks(STATE.renderedStart, -i);
		renderWeekRow(sun);
	}

	// Manual scroll anchor compensation
	if (anchorEl) {
		const shift = anchorEl.offsetTop - anchorTop;
		scrollArea.scrollTop += shift;
	}

	updateRenderedRange();
	recycleIfNeeded();
}

function updateRenderedRange(): void {
	const keys = Array.from(STATE.weekElements.keys()).sort();
	if (keys.length === 0) {
		STATE.renderedStart = null;
		STATE.renderedEnd = null;
		return;
	}
	const parseKey = (k: string): Date => {
		const [y, m, d] = k.split('-').map(Number);
		return new Date(y, m - 1, d);
	};
	STATE.renderedStart = parseKey(keys[0]);
	STATE.renderedEnd = parseKey(keys[keys.length - 1]);
}

function recycleIfNeeded(): void {
	if (STATE.weekElements.size <= STATE.MAX_WEEKS) return;

	const scrollArea = document.getElementById('calendarArea') as HTMLDivElement;
	const scrollTop = scrollArea.scrollTop;
	const viewportHeight = scrollArea.clientHeight;
	const viewCenter = scrollTop + viewportHeight / 2;

	const keys = Array.from(STATE.weekElements.keys()).sort();
	// Find the week closest to viewport center
	let closestIdx = 0;
	let closestDist = Infinity;
	keys.forEach((key, idx) => {
		const el = STATE.weekElements.get(key);
		if (!el) return;
		const elCenter = el.offsetTop + el.offsetHeight / 2;
		const dist = Math.abs(elCenter - viewCenter);
		if (dist < closestDist) {
			closestDist = dist;
			closestIdx = idx;
		}
	});

	const keepStart = Math.max(0, closestIdx - Math.floor(STATE.MAX_WEEKS / 2));
	const keepEnd = Math.min(keys.length - 1, keepStart + STATE.MAX_WEEKS - 1);

	// Remove weeks outside keep range
	for (let i = 0; i < keepStart; i++) {
		removeWeek(keys[i]);
	}
	for (let i = keepEnd + 1; i < keys.length; i++) {
		removeWeek(keys[i]);
	}

	updateRenderedRange();
}

function removeWeek(weekKey: string): void {
	const el = STATE.weekElements.get(weekKey);
	if (el) {
		el.remove();
		STATE.weekElements.delete(weekKey);
	}
}

// ─── INTERSECTION OBSERVERS ───

function setupSentinelObserver(): void {
	const scrollArea = document.getElementById('calendarArea') as HTMLDivElement;
	const observer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			if (entry.target.id === 'sentinelBottom') {
				appendWeeks(8);
			} else if (entry.target.id === 'sentinelTop') {
				prependWeeks(8);
			}
		}
	}, {
		root: scrollArea,
		rootMargin: '200px 0px',
		threshold: 0,
	});

	observer.observe(document.getElementById('sentinelTop')!);
	observer.observe(document.getElementById('sentinelBottom')!);
	STATE.observers.sentinel = observer;
}

function setupMonthHeaderObserver(): void {
	const scrollArea = document.getElementById('calendarArea') as HTMLDivElement;
	let rafPending = false;

	function updateVisibleMonth(): void {
		rafPending = false;
		const areaRect = scrollArea.getBoundingClientRect();
		const viewCenter = areaRect.top + areaRect.height / 2;

		let closestRow: HTMLElement | null = null;
		let closestDist = Infinity;

		for (const [, el] of STATE.weekElements) {
			const rect = el.getBoundingClientRect();
			const rowCenter = rect.top + rect.height / 2;
			const dist = Math.abs(rowCenter - viewCenter);
			if (dist < closestDist) {
				closestDist = dist;
				closestRow = el;
			}
		}

		if (closestRow) {
			// Derive month from the week's Thursday
			const weekKey = closestRow.dataset.week || '';
			const [y, m, d] = weekKey.split('-').map(Number);
			const sun = new Date(y, m - 1, d);
			const thu = thursdayOfWeek(sun);
			const monthKey = getMonthKey(thu);

			if (monthKey !== currentVisibleMonth) {
				setCurrentVisibleMonth(monthKey);
				const md = monthKeyToDate(monthKey);
				document.getElementById('monthLabel')!.textContent = formatMonthYear(md);

				// Re-ghost every rendered day cell against the newly visible month
				document.querySelectorAll('.calendar-day[data-date-month]').forEach(el => {
					const cell = el as HTMLElement;
					cell.classList.toggle('other-month-day', cell.dataset.dateMonth !== monthKey);
				});

				// Sync mini-cal
				setMiniCalDate(new Date(md));
				renderMiniCalendar();
			}
		}
	}

	scrollArea.addEventListener('scroll', () => {
		if (!rafPending) {
			rafPending = true;
			requestAnimationFrame(updateVisibleMonth);
		}
	}, { passive: true });

	// Expose for explicit calls
	STATE.updateVisibleMonth = updateVisibleMonth;

	// Initial sync
	updateVisibleMonth();
}

// ─── SCROLL TO DATE ───

// Sticky offset: top bar + month heading + day names row
const STICKY_OFFSET = 112;

function scrollWeekIntoView(weekEl: HTMLElement, behavior?: 'smooth'): void {
	const scrollArea = document.getElementById('calendarArea') as HTMLDivElement;
	const targetTop = weekEl.offsetTop - STICKY_OFFSET;
	if (behavior === 'smooth') {
		scrollArea.scrollTo({ top: targetTop, behavior: 'smooth' });
	} else {
		scrollArea.scrollTop = targetTop;
	}
}

function scrollToDate(targetDate: Date, _behavior?: 'smooth'): void {
	const weekKey = getWeekKey(targetDate);
	let weekEl = STATE.weekElements.get(weekKey);

	// Check if target is nearby (within a few screens) for smooth scroll
	const scrollArea = document.getElementById('calendarArea') as HTMLDivElement;
	const canSmoothScroll = weekEl && Math.abs(weekEl.offsetTop - STICKY_OFFSET - scrollArea.scrollTop) < scrollArea.clientHeight * 1.5;

	if (weekEl && canSmoothScroll) {
		scrollWeekIntoView(weekEl, 'smooth');
	} else {
		// Far away or not in DOM: clear and re-center
		if (STATE.observers.sentinel) {
			STATE.observers.sentinel.disconnect();
		}

		clearAllWeeks();
		renderWeeks(targetDate, 'both');
		weekEl = STATE.weekElements.get(weekKey);

		if (weekEl) {
			scrollWeekIntoView(weekEl);
		}

		// Re-enable sentinel observer after layout settles
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (STATE.observers.sentinel) {
					STATE.observers.sentinel.observe(document.getElementById('sentinelTop')!);
					STATE.observers.sentinel.observe(document.getElementById('sentinelBottom')!);
				}

				if (STATE.updateVisibleMonth) {
					STATE.updateVisibleMonth();
				}
			});
		});
	}
}

function scrollToMonth(monthKey: string): void {
	const d = monthKeyToDate(monthKey);
	d.setDate(1);
	scrollToDate(d, 'smooth');
}

function clearAllWeeks(): void {
	for (const el of STATE.weekElements.values()) {
		el.remove();
	}
	STATE.weekElements.clear();

	STATE.renderedStart = null;
	STATE.renderedEnd = null;
}

// ─── BUTTON HANDLERS ───

function attachButtonHandlers(): void {
	const helpBtn = document.getElementById('helpBtn');
	const helpMenu = document.getElementById('helpMenu');
	const helpWrap = helpBtn?.closest('.help-btn-wrap');
	if (helpBtn && helpMenu && helpWrap) {
		helpBtn.addEventListener('click', (e: MouseEvent) => {
			e.stopPropagation();
			const isOpen = helpMenu.classList.toggle('active');
			helpWrap.classList.toggle('menu-open', isOpen);
		});
		document.addEventListener('click', (e: MouseEvent) => {
			if (!helpWrap.contains(e.target as Node)) {
				helpMenu.classList.remove('active');
				helpWrap.classList.remove('menu-open');
			}
		});
		document.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				helpMenu.classList.remove('active');
				helpWrap.classList.remove('menu-open');
			}
		});
	}

	document.getElementById('todayBtn')!.addEventListener('click', () => {
		clearEventDetails();
		const now = new Date();
		const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		scrollToDate(firstOfMonth, 'smooth');
	});

	document.getElementById('prevMonth')!.addEventListener('click', () => {
		clearEventDetails();
		const current = currentVisibleMonth ? monthKeyToDate(currentVisibleMonth) : new Date();
		const prev = new Date(current.getFullYear(), current.getMonth() - 1, 1);
		scrollToMonth(getMonthKey(prev));
	});

	document.getElementById('nextMonth')!.addEventListener('click', () => {
		clearEventDetails();
		const current = currentVisibleMonth ? monthKeyToDate(currentVisibleMonth) : new Date();
		const next = new Date(current.getFullYear(), current.getMonth() + 1, 1);
		scrollToMonth(getMonthKey(next));
	});

	document.getElementById('miniCalPrev')!.addEventListener('click', () => {
		setMiniCalDate(new Date(miniCalDate.getFullYear(), miniCalDate.getMonth() - 1, 1));
		renderMiniCalendar();
	});

	document.getElementById('miniCalNext')!.addEventListener('click', () => {
		setMiniCalDate(new Date(miniCalDate.getFullYear(), miniCalDate.getMonth() + 1, 1));
		renderMiniCalendar();
	});

	function toggleSidebar(): void {
		const sidebar = document.getElementById('leftSidebar') as HTMLElement;
		const calToolbar = document.getElementById('calendarToolbar') as HTMLElement;
		const content = document.querySelector('.main-content') as HTMLElement;
		const isHidden = sidebar.style.display === 'none';
		sidebar.style.display = isHidden ? 'flex' : 'none';
		calToolbar.style.display = isHidden ? 'none' : 'flex';
		content.style.gridTemplateColumns = isHidden
			? 'var(--left-sidebar-width) 1fr 280px'
			: '1fr 280px';
	}

	document.getElementById('toggleSidebar')!.addEventListener('click', toggleSidebar);
	document.getElementById('toggleSidebarAlt')!.addEventListener('click', toggleSidebar);

	document.getElementById('backToUpcoming')!.addEventListener('click', () => {
		clearEventDetails();
	});

	// Search button handlers
	document.getElementById('searchBtn')!.addEventListener('click', openSearch);
	document.getElementById('searchBtnAlt')!.addEventListener('click', openSearch);

	// Close search on backdrop click
	document.getElementById('searchOverlay')!.addEventListener('click', (e: MouseEvent) => {
		if (e.target === e.currentTarget) closeSearch();
	});

	// Search input handlers
	const searchInput = document.getElementById('searchInput') as HTMLInputElement;
	const searchClear = document.getElementById('searchClear') as HTMLElement;

	searchInput.addEventListener('input', () => {
		const query = searchInput.value.trim();
		searchClear.classList.toggle('visible', query.length > 0);
		renderSearchResults(query);
	});

	searchClear.addEventListener('click', () => {
		searchInput.value = '';
		searchClear.classList.remove('visible');
		renderSearchResults('');
		searchInput.focus();
	});

	// Keyboard shortcut: Cmd/Ctrl+K to open search
	document.addEventListener('keydown', (e: KeyboardEvent) => {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			openSearch();
		}
		if (e.key === 'Escape') {
			closeSearch();
		}
	});

	// Keyboard navigation in search results
	searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
		const items = document.querySelectorAll('.search-result-item') as NodeListOf<HTMLElement>;
		if (items.length === 0) return;
		const focused = document.querySelector('.search-result-item.focused') as HTMLElement | null;
		let idx = Array.from(items).indexOf(focused!);

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			if (focused) focused.classList.remove('focused');
			idx = idx < items.length - 1 ? idx + 1 : 0;
			items[idx].classList.add('focused');
			items[idx].scrollIntoView({ block: 'nearest' });
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			if (focused) focused.classList.remove('focused');
			idx = idx > 0 ? idx - 1 : items.length - 1;
			items[idx].classList.add('focused');
			items[idx].scrollIntoView({ block: 'nearest' });
		} else if (e.key === 'Enter' && focused) {
			e.preventDefault();
			focused.click();
		}
	});
}

// ─── SEARCH ───

function openSearch(): void {
	const overlay = document.getElementById('searchOverlay')!;
	const input = document.getElementById('searchInput') as HTMLInputElement;
	overlay.classList.add('active');
	input.value = '';
	document.getElementById('searchClear')!.classList.remove('visible');
	renderSearchResults('');
	// Delay focus to allow transition
	requestAnimationFrame(() => input.focus());
}

function closeSearch(): void {
	const overlay = document.getElementById('searchOverlay')!;
	overlay.classList.remove('active');
}

interface ApiEventWithParsedDate extends ApiEvent {
	parsedDate: Date | null;
}

function renderSearchResults(query: string): void {
	const container = document.getElementById('searchResults')!;
	container.textContent = '';

	if (!query) {
		// Show upcoming events as initial suggestions
		const now = new Date();
		const upcoming = eventsData
			.map(e => ({ ...e, parsedDate: parseDtstart(e.dtstart) } as ApiEventWithParsedDate))
			.filter((e): e is ApiEventWithParsedDate & { parsedDate: Date } => e.parsedDate !== null && e.parsedDate >= now)
			.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())
			.slice(0, 6);

		if (upcoming.length > 0) {
			const label = document.createElement('div');
			label.className = 'search-section-label';
			label.textContent = 'Upcoming';
			container.appendChild(label);
			upcoming.forEach(evt => container.appendChild(createSearchResultItem(evt)));
		}
		return;
	}

	const lowerQuery = query.toLowerCase();
	const matches = eventsData
		.map(e => ({ ...e, parsedDate: parseDtstart(e.dtstart) } as ApiEventWithParsedDate))
		.filter((e): e is ApiEventWithParsedDate & { parsedDate: Date } => {
			if (!e.parsedDate) return false;
			const fields = [
				e.summary, e.description, e.location, e.categories
			].filter(Boolean).join(' ').toLowerCase();
			return fields.includes(lowerQuery);
		})
		.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

	if (matches.length === 0) {
		const empty = document.createElement('div');
		empty.className = 'search-empty';
		empty.textContent = `No events matching "${query}"`;
		container.appendChild(empty);
		return;
	}

	const label = document.createElement('div');
	label.className = 'search-section-label';
	label.textContent = `Search · ${matches.length} result${matches.length !== 1 ? 's' : ''}`;
	container.appendChild(label);

	matches.slice(0, 20).forEach(evt => {
		container.appendChild(createSearchResultItem(evt));
	});
}

function createSearchResultItem(evt: ApiEventWithParsedDate): HTMLElement {
	const item = document.createElement('div');
	item.className = 'search-result-item';

	const dot = document.createElement('div');
	dot.className = 'search-result-dot';

	const info = document.createElement('div');
	info.className = 'search-result-info';

	const title = document.createElement('div');
	title.className = 'search-result-title';
	title.textContent = evt.summary || 'Untitled Event';

	const meta = document.createElement('div');
	meta.className = 'search-result-meta';
	const isAllDay = evt.dtstart !== null && !evt.dtstart.includes('T');
	const dateStr = evt.parsedDate
		? evt.parsedDate.toLocaleDateString('en-SG', {
			weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
		}) + (isAllDay ? '' : ' · ' + evt.parsedDate.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' }))
		: '';
	const parts = [dateStr];
	if (evt.location) parts.push(evt.location);
	meta.textContent = parts.join(' · ');

	info.appendChild(title);
	info.appendChild(meta);
	item.appendChild(dot);
	item.appendChild(info);

	item.addEventListener('click', () => {
		closeSearch();
		if (evt.parsedDate) {
			scrollToDate(evt.parsedDate, 'smooth');
		}
		showEventDetails(evt);
	});

	return item;
}

// ─── MINI CALENDAR ───

function renderMiniCalendar(): void {
	const grid = document.getElementById('miniCalGrid')!;
	const monthLabel = document.getElementById('miniCalMonth')!;
	grid.textContent = '';

	const year = miniCalDate.getFullYear();
	const month = miniCalDate.getMonth();

	monthLabel.textContent = miniCalDate.toLocaleString('default', { month: 'long', year: 'numeric' });

	const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
	dayNames.forEach(d => {
		const el = document.createElement('div');
		el.className = 'mini-cal-day-name';
		el.textContent = d;
		grid.appendChild(el);
	});

	const firstDay = new Date(year, month, 1).getDay();
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const prevMonthDays = new Date(year, month, 0).getDate();

	// Previous month trailing days
	for (let i = firstDay - 1; i >= 0; i--) {
		const el = document.createElement('div');
		el.className = 'mini-cal-day other-month';
		const dayNum = prevMonthDays - i;
		el.textContent = String(dayNum);
		el.addEventListener('click', () => {
			const targetDate = new Date(year, month - 1, dayNum);
			setMiniCalDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
			renderMiniCalendar();
			clearEventDetails();
			scrollToDate(targetDate, 'smooth');
		});
		grid.appendChild(el);
	}

	// Current month days
	const today = new Date();
	for (let i = 1; i <= daysInMonth; i++) {
		const el = document.createElement('div');
		const isToday = year === today.getFullYear() && month === today.getMonth() && i === today.getDate();
		el.className = 'mini-cal-day' + (isToday ? ' today' : '');
		el.textContent = String(i);
		el.addEventListener('click', () => {
			const targetDate = new Date(year, month, i);
			clearEventDetails();
			scrollToDate(targetDate, 'smooth');
		});
		grid.appendChild(el);
	}

	// Next month leading days (always fill 6 rows = 42 cells)
	const totalCells = firstDay + daysInMonth;
	const remaining = 42 - totalCells;
	for (let i = 1; i <= remaining; i++) {
		const el = document.createElement('div');
		el.className = 'mini-cal-day other-month';
		el.textContent = String(i);
		const dayNum = i;
		el.addEventListener('click', () => {
			const targetDate = new Date(year, month + 1, dayNum);
			setMiniCalDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
			renderMiniCalendar();
			clearEventDetails();
			scrollToDate(targetDate, 'smooth');
		});
		grid.appendChild(el);
	}
}

// ─── UPCOMING EVENTS ───

interface ApiEventWithParsedAndAllDay extends ApiEvent {
	parsedDate: Date | null;
	isAllDay: boolean;
}

function renderUpcomingEvents(): void {
	const list = document.getElementById('eventsList')!;
	if (!eventsData || eventsData.length === 0) {
		list.textContent = '';
		const noEvt = document.createElement('div');
		noEvt.className = 'no-events';
		noEvt.textContent = 'No upcoming events scheduled.';
		list.appendChild(noEvt);
		return;
	}

	const now = new Date();

	const upcoming = eventsData.map(e => {
		const parsed = parseDtstart(e.dtstart);
		return { ...e, parsedDate: parsed, isAllDay: !!(e.dtstart && !e.dtstart.includes('T')) } as ApiEventWithParsedAndAllDay;
	})
		.filter((e): e is ApiEventWithParsedAndAllDay & { parsedDate: Date } => e.parsedDate !== null)
		.filter(isCategoryVisible)
		.filter(e => {
			const eventDay = new Date(e.parsedDate);
			eventDay.setHours(0, 0, 0, 0);
			const todayDate = new Date(now);
			todayDate.setHours(0, 0, 0, 0);
			return eventDay >= todayDate;
		})
		.sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())
		.slice(0, 5);

	if (upcoming.length === 0) {
		list.textContent = '';
		const noEvt = document.createElement('div');
		noEvt.className = 'no-events';
		noEvt.textContent = 'No upcoming events.';
		list.appendChild(noEvt);
		return;
	}

	list.textContent = '';
	upcoming.forEach(e => {
		const dateDisplay = e.isAllDay
			? e.parsedDate.toLocaleDateString('en-SG', { month: 'short', day: 'numeric' }) + ' \u2022 All Day'
			: e.parsedDate.toLocaleDateString('en-SG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

		const item = document.createElement('div');
		item.className = 'event-item';
		item.dataset.date = e.parsedDate.toISOString();
		item.dataset.uid = e.uid || '';

		const dateEl = document.createElement('div');
		dateEl.className = 'event-date';
		dateEl.textContent = dateDisplay;

		const titleEl = document.createElement('div');
		titleEl.className = 'event-title';
		titleEl.textContent = e.summary || 'Untitled Event';

		item.appendChild(dateEl);
		item.appendChild(titleEl);
		list.appendChild(item);
	});

	list.querySelectorAll('.event-item').forEach(el => {
		el.addEventListener('click', function (this: HTMLElement) {
			const rawDate = this.dataset.date;
			const evtUid = this.dataset.uid;
			if (!rawDate) return;

			const eventDate = new Date(rawDate);
			scrollToDate(eventDate, 'smooth');

			// Find the specific event by uid and show it
			const targeted = eventsData.find(e => e.uid === evtUid);
			if (targeted) showEventDetails(targeted);
		});
	});
}

// ─── EVENT DETAILS ───

export function escapeHTML(str: string): string {
	return str.replace(/[&<>'"]/g, tag => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
	}[tag] || tag));
}

function showEventDetails(evt: ApiEvent): void {
	const parsed = parseDtstart(evt.dtstart);
	let endParsed: Date | null = null;
	if (evt.dtend) endParsed = parseDtstart(evt.dtend);
	const isAllDay = !!(evt.dtstart && !evt.dtstart.includes('T'));
	const enriched = { ...evt, parsedDate: parsed, parsedEnd: endParsed, isAllDay };

	const content = document.getElementById('eventDetailContent')!;
	content.textContent = '';

	// Date heading
	const headingDate = parsed
		? parsed.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
		: 'Event Details';
	const heading = document.createElement('div');
	heading.className = 'detail-date-heading';
	heading.textContent = headingDate;
	content.appendChild(heading);

	// Event card
	const card = document.createElement('div');
	card.className = 'detail-event-card';

	const titleRow = document.createElement('div');
	titleRow.className = 'detail-event-title';
	titleRow.appendChild(document.createTextNode(enriched.summary || 'Untitled Event'));
	titleRow.appendChild(document.createTextNode(' '));
	const badge = document.createElement('span');
	const statusClass = (enriched.status || 'CONFIRMED').toLowerCase();
	badge.className = 'detail-badge badge-' + statusClass;
	badge.textContent = enriched.status || 'CONFIRMED';
	titleRow.appendChild(badge);
	card.appendChild(titleRow);

	let timeStr: string;
	if (enriched.isAllDay) {
		timeStr = 'All Day';
	} else {
		const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' };
		const startTime = enriched.parsedDate ? enriched.parsedDate.toLocaleTimeString('en-SG', timeOpts) : '';
		timeStr = startTime;
		if (enriched.parsedEnd) {
			timeStr = startTime + ' \u2014 ' + enriched.parsedEnd.toLocaleTimeString('en-SG', timeOpts);
		}
	}

	function addDetailRow(label: string, value: string): void {
		const row = document.createElement('div');
		row.className = 'detail-row';
		const labelEl = document.createElement('span');
		labelEl.className = 'detail-label';
		labelEl.textContent = label;
		const valueEl = document.createElement('span');
		valueEl.className = 'detail-value';
		valueEl.textContent = value;
		row.appendChild(labelEl);
		row.appendChild(valueEl);
		card.appendChild(row);
	}

	function addLinkRow(label: string, url: string): void {
		const row = document.createElement('div');
		row.className = 'detail-row';
		const labelEl = document.createElement('span');
		labelEl.className = 'detail-label';
		labelEl.textContent = label;
		const valueEl = document.createElement('span');
		valueEl.className = 'detail-value';
		const link = document.createElement('a');
		link.href = url;
		link.target = '_blank';
		link.rel = 'noopener';
		link.textContent = url;
		valueEl.appendChild(link);
		row.appendChild(labelEl);
		row.appendChild(valueEl);
		card.appendChild(row);
	}

	addDetailRow('Time', timeStr);
	if (enriched.location) addDetailRow('Location', enriched.location);
	if (enriched.description) addDetailRow('Details', enriched.description);
	if (enriched.categories) addDetailRow('Category', enriched.categories);
	if (enriched.url) addLinkRow('Link', enriched.url);

	content.appendChild(card);

	// Swap sidebar views
	document.getElementById('upcomingEventsView')!.style.display = 'none';
	document.getElementById('eventDetailView')!.style.display = 'block';
}

function clearEventDetails(): void {
	document.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
	document.getElementById('eventDetailView')!.style.display = 'none';
	document.getElementById('upcomingEventsView')!.style.display = 'block';
}

// ─── BOOTSTRAP ENTRY ───
function main(): void {
	const copyBtn = document.getElementById('copyBtn');
	if (copyBtn) {
		copyBtn.addEventListener('click', () => {
			navigator.clipboard.writeText(SUB_URL).then(() => {
				copyBtn.textContent = '\u2713 Copied';
				copyBtn.classList.add('copied');
				setTimeout(() => {
					copyBtn.textContent = 'Copy URL';
					copyBtn.classList.remove('copied');
				}, 2000);
			});
		});
	}
	initCalendar();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', main);
} else {
	main();
}
