import { fetchEvents } from './api.js';
import {
	STATE,
	activeCategories,
	eventsData,
	miniCalDate,
	currentVisibleMonth,
	CATEGORY_CONFIG,
	setEventsData,
	setMiniCalDate,
	setCategoryConfig,
	type CategoryStyle,
} from './state.js';
import {
	getWeekKey,
	getMonthKey,
	monthKeyToDate,
} from './dates.js';
import {
	clearEventDetails,
	renderUpcomingEvents,
} from './eventDetail.js';
import {
	openSearch,
	closeSearch,
	renderSearchResults,
} from './search.js';
import {
	renderMiniCalendar,
} from './miniCal.js';
import {
	refreshAllDayChips,
	renderWeeks,
	setupSentinelObserver,
	setupMonthHeaderObserver,
	scrollWeekIntoView,
	scrollToDate,
	scrollToMonth,
} from './weekGrid.js';

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

// ─── INIT ───

async function initCalendar(): Promise<void> {
	try {
		const today = new Date();
		const fromISO = new Date(today.getFullYear() - 1, 0, 1).toISOString().slice(0, 10);
		const toISO = new Date(today.getFullYear() + 1, 11, 31).toISOString().slice(0, 10);
		const events = await fetchEvents(fromISO, toISO);
		setEventsData(events);
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
