import type { ApiEvent } from './api-types.js';
import {
	STATE,
	eventsData,
	currentVisibleMonth,
	setCurrentVisibleMonth,
	setMiniCalDate,
} from './state.js';
import {
	sundayOfWeek,
	thursdayOfWeek,
	addWeeks,
	getWeekKey,
	getMonthKey,
	monthKeyToDate,
	formatMonthYear,
	dtToDateStr,
} from './dates.js';
import { showEventDetails, clearEventDetails } from './eventDetail.js';
import { renderMiniCalendar } from './miniCal.js';
import { getCategoryStyle, isCategoryVisible } from './categories.js';

const STICKY_OFFSET = 112;
const SMOOTH_SCROLL_VIEWPORT_RATIO = 1.5;



export function insertWeekRowSorted(row: HTMLDivElement, weekKey: string): void {
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

export function getVisibleEventsForDate(dateStr: string | null): ApiEvent[] {
	if (!dateStr) return [];
	return eventsData.filter(e => {
		if (!e.dtstart) return false;
		if (dtToDateStr(e.dtstart) !== dateStr) return false;
		return isCategoryVisible(e);
	});
}

export function applyDayEventChips(dayEl: HTMLDivElement, allDayEvents: ApiEvent[]): void {
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

export function refreshAllDayChips(): void {
	document.querySelectorAll('.calendar-day[data-date]').forEach(el => {
		const dayEl = el as HTMLDivElement;
		const dateStr = dayEl.dataset.date || '';
		const dayEvents = eventsData.filter(e => e.dtstart && dtToDateStr(e.dtstart) === dateStr);
		applyDayEventChips(dayEl, dayEvents);
	});
}

function createDayNumberElement(cellDate: Date, isToday: boolean): HTMLSpanElement {
	const numEl = document.createElement('span');
	numEl.className = isToday ? 'today-marker' : 'day-number';
	const dayNum = cellDate.getDate();
	if (dayNum === 1) {
		numEl.classList.add('first-of-month');
		const shortMonth = cellDate.toLocaleString('default', { month: 'short' });
		numEl.textContent = `${shortMonth} ${dayNum}`;
	} else {
		numEl.textContent = String(dayNum);
	}
	return numEl;
}

function handleDayCellClick(dayEl: HTMLDivElement): void {
	document.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
	dayEl.classList.add('selected');
	const visible = getVisibleEventsForDate(dayEl.dataset.date || null);
	if (visible.length > 0) {
		showEventDetails(visible[0]);
	} else {
		clearEventDetails();
	}
}

function renderDayCell(cellDate: Date, sundayDate: Date, ownerMonthKey: string, todayStr: string, d: number): HTMLDivElement {
	const cellMonthKey = getMonthKey(cellDate);
	const dayEl = document.createElement('div') as HTMLDivElement;
	dayEl.className = 'calendar-day';

	if (d === 0 || d === 6) {
		dayEl.classList.add('weekend-day');
	}

	dayEl.dataset.dateMonth = cellMonthKey;

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

	const numEl = createDayNumberElement(cellDate, isToday);
	dayEl.appendChild(numEl);

	const dayEvents = eventsData.filter(e => {
		if (!e.dtstart) return false;
		return dtToDateStr(e.dtstart) === currentDayStr;
	});

	applyDayEventChips(dayEl, dayEvents);
	dayEl.addEventListener('click', () => handleDayCellClick(dayEl));

	return dayEl;
}

export function renderWeekRow(sundayDate: Date): HTMLElement {
	const weekKey = getWeekKey(sundayDate);
	if (STATE.weekElements.has(weekKey)) return STATE.weekElements.get(weekKey)!;

	const today = new Date();
	const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

	const row = document.createElement('div') as HTMLDivElement;
	row.className = 'week-row';
	row.dataset.week = weekKey;

	const thu = thursdayOfWeek(sundayDate);
	const ownerMonthKey = getMonthKey(thu);

	for (let d = 0; d < 7; d++) {
		const cellDate = new Date(sundayDate);
		cellDate.setDate(cellDate.getDate() + d);
		row.appendChild(renderDayCell(cellDate, sundayDate, ownerMonthKey, todayStr, d));
	}

	insertWeekRowSorted(row, weekKey);
	STATE.weekElements.set(weekKey, row);
	return row;
}

export function renderWeeks(centerDate: Date, direction: 'both' | 'up' | 'down'): void {
	const center = sundayOfWeek(centerDate);
	const count = STATE.BUFFER_WEEKS;

	if (direction === 'both' || direction === 'up') {
		for (let i = count; i >= 1; i--) {
			const sun = addWeeks(center, -i);
			renderWeekRow(sun);
		}
	}

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

export function appendWeeks(count: number): void {
	if (!STATE.renderedEnd) return;
	for (let i = 1; i <= count; i++) {
		const sun = addWeeks(STATE.renderedEnd, i);
		renderWeekRow(sun);
	}
	updateRenderedRange();
	recycleIfNeeded();
}

export function prependWeeks(count: number): void {
	if (!STATE.renderedStart) return;
	const scrollArea = document.getElementById('calendarArea') as HTMLDivElement;
	const anchorEl = STATE.weekElements.get(getWeekKey(STATE.renderedStart));
	const anchorTop = anchorEl ? anchorEl.offsetTop : 0;

	for (let i = count; i >= 1; i--) {
		const sun = addWeeks(STATE.renderedStart, -i);
		renderWeekRow(sun);
	}

	if (anchorEl) {
		const shift = anchorEl.offsetTop - anchorTop;
		scrollArea.scrollTop += shift;
	}

	updateRenderedRange();
	recycleIfNeeded();
}

export function updateRenderedRange(): void {
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

export function recycleIfNeeded(): void {
	if (STATE.weekElements.size <= STATE.MAX_WEEKS) return;

	const scrollArea = document.getElementById('calendarArea') as HTMLDivElement;
	const scrollTop = scrollArea.scrollTop;
	const viewportHeight = scrollArea.clientHeight;
	const viewCenter = scrollTop + viewportHeight / 2;

	const keys = Array.from(STATE.weekElements.keys()).sort();
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

	for (let i = 0; i < keepStart; i++) {
		removeWeek(keys[i]);
	}
	for (let i = keepEnd + 1; i < keys.length; i++) {
		removeWeek(keys[i]);
	}

	updateRenderedRange();
}

export function removeWeek(weekKey: string): void {
	const el = STATE.weekElements.get(weekKey);
	if (el) {
		el.remove();
		STATE.weekElements.delete(weekKey);
	}
}

export function setupSentinelObserver(): void {
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

let headerRafPending = false;

function updateVisibleMonth(): void {
	headerRafPending = false;
	const scrollArea = document.getElementById('calendarArea') as HTMLDivElement;
	if (!scrollArea) return;
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
		const weekKey = closestRow.dataset.week || '';
		const [y, m, d] = weekKey.split('-').map(Number);
		const sun = new Date(y, m - 1, d);
		const thu = thursdayOfWeek(sun);
		const monthKey = getMonthKey(thu);

		if (monthKey !== currentVisibleMonth) {
			setCurrentVisibleMonth(monthKey);
			const md = monthKeyToDate(monthKey);
			document.getElementById('monthLabel')!.textContent = formatMonthYear(md);

			document.querySelectorAll('.calendar-day[data-date-month]').forEach(el => {
				const cell = el as HTMLElement;
				cell.classList.toggle('other-month-day', cell.dataset.dateMonth !== monthKey);
			});

			setMiniCalDate(new Date(md));
			renderMiniCalendar();
		}
	}
}

export function setupMonthHeaderObserver(): void {
	const scrollArea = document.getElementById('calendarArea') as HTMLDivElement;
	if (!scrollArea) return;

	scrollArea.addEventListener('scroll', () => {
		if (!headerRafPending) {
			headerRafPending = true;
			requestAnimationFrame(updateVisibleMonth);
		}
	}, { passive: true });

	STATE.updateVisibleMonth = updateVisibleMonth;
	updateVisibleMonth();
}

export function scrollWeekIntoView(weekEl: HTMLElement, behavior?: 'smooth'): void {
	const scrollArea = document.getElementById('calendarArea') as HTMLDivElement;
	const targetTop = weekEl.offsetTop - STICKY_OFFSET;
	if (behavior === 'smooth') {
		scrollArea.scrollTo({ top: targetTop, behavior: 'smooth' });
	} else {
		scrollArea.scrollTop = targetTop;
	}
}

export function scrollToDate(targetDate: Date, _behavior?: ScrollBehavior): void {
	const weekKey = getWeekKey(targetDate);
	let weekEl = STATE.weekElements.get(weekKey);

	const scrollArea = document.getElementById('calendarArea') as HTMLDivElement;
	const canSmoothScroll = weekEl && Math.abs(weekEl.offsetTop - STICKY_OFFSET - scrollArea.scrollTop) < scrollArea.clientHeight * SMOOTH_SCROLL_VIEWPORT_RATIO;

	if (weekEl && canSmoothScroll) {
		scrollWeekIntoView(weekEl, 'smooth');
	} else {
		if (STATE.observers.sentinel) {
			STATE.observers.sentinel.disconnect();
		}

		clearAllWeeks();
		renderWeeks(targetDate, 'both');
		weekEl = STATE.weekElements.get(weekKey);

		if (weekEl) {
			scrollWeekIntoView(weekEl);
		}

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

export function scrollToMonth(monthKey: string): void {
	const d = monthKeyToDate(monthKey);
	d.setDate(1);
	scrollToDate(d, 'smooth');
}

export function clearAllWeeks(): void {
	for (const el of STATE.weekElements.values()) {
		el.remove();
	}
	STATE.weekElements.clear();

	STATE.renderedStart = null;
	STATE.renderedEnd = null;
}
