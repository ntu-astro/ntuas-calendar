import { fetchEvents } from './api.js';
import {
	STATE,
	setEventsData,
} from './state.js';
import {
	getWeekKey,
} from './dates.js';
import {
	renderUpcomingEvents,
} from './eventDetail.js';
import {
	renderMiniCalendar,
} from './miniCal.js';
import {
	buildCategoriesFromEvents,
	renderCategoryFilter,
} from './categories.js';
import {
	renderWeeks,
	setupSentinelObserver,
	setupMonthHeaderObserver,
	scrollWeekIntoView,
} from './weekGrid.js';
import {
	renderDayNamesRow,
	wireHelpMenu,
	wireNavigationButtons,
	wireSidebarToggle,
	wireSearchOverlay,
	wireSearchInput,
	wireSearchKeyboard,
	wireCopyButton,
} from './ui.js';

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

	// Wire up UI interaction and navigation handlers
	wireHelpMenu();
	wireSidebarToggle();
	wireSearchOverlay();
	wireSearchInput();
	wireSearchKeyboard();
	wireNavigationButtons();
	wireCopyButton();

	// Defer sentinel observer so initial scroll settles first
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			setupSentinelObserver();
		});
	});
}

// ─── BOOTSTRAP ENTRY ───
function main(): void {
	initCalendar();
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', main);
} else {
	main();
}

