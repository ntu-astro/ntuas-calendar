import type { ApiEvent } from './api-types.js';
import { eventsData } from './state.js';
import { parseDtstart } from './dates.js';
import { showEventDetails } from './eventDetail.js';

export type ScrollToDateFn = (target: Date, behavior?: ScrollBehavior) => void;
let scrollToDateImpl: ScrollToDateFn | null = null;

export function setSearchScrollToDate(fn: ScrollToDateFn): void {
	scrollToDateImpl = fn;
}

export function openSearch(): void {
	const overlay = document.getElementById('searchOverlay')!;
	const input = document.getElementById('searchInput') as HTMLInputElement;
	overlay.classList.add('active');
	input.value = '';
	document.getElementById('searchClear')!.classList.remove('visible');
	renderSearchResults('');
	// Delay focus to allow transition
	requestAnimationFrame(() => input.focus());
}

export function closeSearch(): void {
	const overlay = document.getElementById('searchOverlay')!;
	overlay.classList.remove('active');
}

interface ApiEventWithParsedDate extends ApiEvent {
	parsedDate: Date | null;
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
		if (evt.parsedDate && scrollToDateImpl) {
			scrollToDateImpl(evt.parsedDate, 'smooth');
		}
		showEventDetails(evt);
	});

	return item;
}

function renderSuggestions(container: HTMLElement): void {
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
}

function renderQueryResults(container: HTMLElement, query: string): void {
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

export function renderSearchResults(query: string): void {
	const container = document.getElementById('searchResults')!;
	container.textContent = '';

	if (!query) {
		renderSuggestions(container);
	} else {
		renderQueryResults(container, query);
	}
}
