import { clearEventDetails } from './eventDetail.js';
import { scrollToDate, scrollToMonth } from './weekGrid.js';
import { miniCalDate, setMiniCalDate, currentVisibleMonth } from './state.js';
import { renderMiniCalendar } from './miniCal.js';
import { getMonthKey, monthKeyToDate } from './dates.js';
import { openSearch, closeSearch, renderSearchResults } from './search.js';

const SUB_URL = 'https://calendar.ntuas.com/subscribe';
const COPY_FEEDBACK_MS = 2000;

export function renderDayNamesRow(): void {
	const row = document.getElementById('dayNamesRow')!;
	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	days.forEach(d => {
		const el = document.createElement('div');
		el.className = 'calendar-day-name';
		el.textContent = d;
		row.appendChild(el);
	});
}

export function wireHelpMenu(): void {
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
}

export function wireNavigationButtons(): void {
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

	document.getElementById('backToUpcoming')!.addEventListener('click', () => {
		clearEventDetails();
	});
}

export function wireSidebarToggle(): void {
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
}

export function wireSearchOverlay(): void {
	document.getElementById('searchBtn')!.addEventListener('click', openSearch);
	document.getElementById('searchBtnAlt')!.addEventListener('click', openSearch);

	document.getElementById('searchOverlay')!.addEventListener('click', (e: MouseEvent) => {
		if (e.target === e.currentTarget) closeSearch();
	});
}

export function wireSearchInput(): void {
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
}

export function wireSearchKeyboard(): void {
	const searchInput = document.getElementById('searchInput') as HTMLInputElement;

	document.addEventListener('keydown', (e: KeyboardEvent) => {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			openSearch();
		}
		if (e.key === 'Escape') {
			closeSearch();
		}
	});

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

export function wireCopyButton(): void {
	const copyBtn = document.getElementById('copyBtn');
	if (copyBtn) {
		copyBtn.addEventListener('click', () => {
			navigator.clipboard.writeText(SUB_URL).then(() => {
				copyBtn.textContent = '\u2713 Copied';
				copyBtn.classList.add('copied');
				setTimeout(() => {
					copyBtn.textContent = 'Copy URL';
					copyBtn.classList.remove('copied');
				}, COPY_FEEDBACK_MS);
			});
		});
	}
}
