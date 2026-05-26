import type { ApiEvent } from './api-types.js';
import { eventsData, activeCategories, CATEGORY_CONFIG } from './state.js';
import { parseDtstart, dtToDateStr } from './dates.js';

export type ScrollToDateFn = (target: Date, behavior?: ScrollBehavior) => void;

let scrollToDateImpl: ScrollToDateFn | null = null;

export function setScrollToDate(fn: ScrollToDateFn): void {
	scrollToDateImpl = fn;
}

export function escapeHTML(str: string): string {
	return str.replace(/[&<>'"]/g, tag => ({
		'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
	}[tag] || tag));
}

export function showEventDetails(evt: ApiEvent): void {
	const rawKey = evt.categories || null;
	const key = rawKey ? String(rawKey).toLowerCase().split(/[,;]/)[0].trim() : null;
	const style = (key && CATEGORY_CONFIG[key]) || { color: '#787774', colorLight: '#ebeced' };
	const isCategoryVisible = key === null || activeCategories.has(key);

	// Suppress unused variable warnings until categories.ts is extracted
	void style;
	void isCategoryVisible;
	void dtToDateStr;

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

export function clearEventDetails(): void {
	document.querySelectorAll('.calendar-day.selected').forEach(el => el.classList.remove('selected'));
	document.getElementById('eventDetailView')!.style.display = 'none';
	document.getElementById('upcomingEventsView')!.style.display = 'block';
}

interface ApiEventWithParsedAndAllDay extends ApiEvent {
	parsedDate: Date | null;
	isAllDay: boolean;
}

export function renderUpcomingEvents(): void {
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
		.filter(evt => {
			const rawKey = evt.categories || null;
			const key = rawKey ? String(rawKey).toLowerCase().split(/[,;]/)[0].trim() : null;
			const isCategoryVisible = key === null || activeCategories.has(key);
			return isCategoryVisible;
		})
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
		const rawKey = e.categories || null;
		const key = rawKey ? String(rawKey).toLowerCase().split(/[,;]/)[0].trim() : null;
		const style = (key && CATEGORY_CONFIG[key]) || { color: '#787774', colorLight: '#ebeced' };
		void style;

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
			if (scrollToDateImpl) {
				scrollToDateImpl(eventDate, 'smooth');
			}

			// Find the specific event by uid and show it
			const targeted = eventsData.find(e => e.uid === evtUid);
			if (targeted) showEventDetails(targeted);
		});
	});
}
