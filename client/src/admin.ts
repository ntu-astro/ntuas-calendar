import type { ApiEvent } from './api-types.js';

interface Venue {
	name: string;
	geo: string;
}

const CSRF_TOKEN = document.querySelector('meta[name="csrf-token"]')!.getAttribute('content')!;
let VENUES: Venue[] = [];

async function initVenues(): Promise<void> {
	try {
		const res = await fetch('/data/venues.json');
		if (!res.ok) throw new Error('HTTP ' + res.status);
		const data = (await res.json()) as { venues: Venue[] };
		VENUES = data.venues;
	} catch (e) {
		console.error('Failed to load venues:', e);
		VENUES = [];
	}

	const list = document.getElementById('ntu-venues') as HTMLDataListElement;
	if (list) {
		VENUES.forEach(v => {
			const opt = document.createElement('option');
			opt.value = v.name;
			list.appendChild(opt);
		});
	}

	const locationInput = document.getElementById('locationInput') as HTMLInputElement;
	if (locationInput) {
		locationInput.addEventListener('input', (e) => {
			const target = e.target as HTMLInputElement;
			const match = VENUES.find(v => v.name === target.value);
			const geoInput = document.getElementById('geoInput') as HTMLInputElement;
			if (match && geoInput) {
				geoInput.value = match.geo;
			}
		});
	}
}

function escapeHtml(str: string | null): string {
	if (!str) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#x27;');
}

let allEvents: ApiEvent[] = [];
let currentPage = 1;
const EVENTS_PER_PAGE = 10;

async function loadEvents(): Promise<void> {
	try {
		const res = await fetch('/api/events?_t=' + Date.now());
		allEvents = (await res.json()) as ApiEvent[];
		currentPage = 1;
		renderEventsPage();
	} catch {
		const container = document.getElementById('events-container')!;
		container.textContent = 'Error loading events.';
	}
}

function renderEventsPage(): void {
	const container = document.getElementById('events-container');
	if (!container) return;

	if (allEvents.length === 0) {
		container.textContent = '';
		const p = document.createElement('p');
		p.textContent = 'No events scheduled.';
		container.appendChild(p);
		return;
	}

	const totalPages = Math.ceil(allEvents.length / EVENTS_PER_PAGE);
	const startIndex = (currentPage - 1) * EVENTS_PER_PAGE;
	const endIndex = startIndex + EVENTS_PER_PAGE;
	const pageEvents = allEvents.slice(startIndex, endIndex);

	const html = pageEvents
		.map(e => {
			const isAllDay = !!(e.dtstart && !e.dtstart.includes('T'));
			let displayDate = '';
			if (isAllDay) {
				const y = e.dtstart.slice(0, 4),
					m = e.dtstart.slice(4, 6),
					d = e.dtstart.slice(6, 8);
				displayDate = new Date(y + '-' + m + '-' + d + 'T00:00:00+08:00').toLocaleDateString('en-SG', {
					timeZone: 'Asia/Singapore',
					year: 'numeric',
					month: 'long',
					day: 'numeric',
				});
			} else {
				const dt = e.dtstart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
				displayDate = new Date(dt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
			}
			return `
              <div class="event-card">
                <div class="event-info">
                  <strong>${escapeHtml(e.summary)}</strong> <span class="event-status">${escapeHtml(e.status)}</span>${isAllDay ? '<span class="all-day-badge">ALL DAY</span>' : ''}<br>
                  <small style="color: var(--text-tertiary); display: block; margin-top: 2px; font-size: 12px;">${isAllDay ? '' : 'Starts: '}${escapeHtml(displayDate)}</small>
                </div>
                <button class="btn-edit"
                  data-uid="${escapeHtml(e.uid)}"
                  data-summary="${escapeHtml(e.summary)}"
                  data-dtstart="${escapeHtml(e.dtstart)}"
                  data-dtend="${escapeHtml(e.dtend)}"
                  data-status="${escapeHtml(e.status)}"
                  data-location="${escapeHtml(e.location)}"
                  data-geo="${escapeHtml(e.geo)}"
                  data-description="${escapeHtml(e.description)}"
                >Edit</button>
                <form class="form-delete" data-uid="${escapeHtml(e.uid)}">
                  <input type="password" placeholder="Password" required class="del-pass">
                  <button type="submit" class="btn-delete">Delete</button>
                </form>
              </div>`;
		})
		.join('');

	const paginationHtml =
		totalPages > 1
			? `
      <div class="pagination-controls" style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
        <button data-page-delta="-1" ${currentPage === 1 ? 'disabled' : ''} style="width: auto; margin-top: 0; background: transparent; border: 1px solid var(--border-strong); color: ${currentPage === 1 ? 'var(--border-strong)' : 'var(--text-secondary)'}; padding: 6px 12px; font-size: 12px;">‹ Previous</button>
        <span style="color: var(--text-tertiary); font-size: 12px; font-weight: 500;">Page ${currentPage} of ${totalPages}</span>
        <button data-page-delta="1" ${currentPage === totalPages ? 'disabled' : ''} style="width: auto; margin-top: 0; background: transparent; border: 1px solid var(--border-strong); color: ${currentPage === totalPages ? 'var(--border-strong)' : 'var(--text-secondary)'}; padding: 6px 12px; font-size: 12px;">Next ›</button>
      </div>
    `
			: '';

	container.textContent = '';
	container.insertAdjacentHTML('beforeend', html + paginationHtml);

	container.querySelectorAll('.btn-edit').forEach(btn => {
		const element = btn as HTMLButtonElement;
		element.addEventListener('click', () => {
			openEditModal(
				element.dataset.uid || '',
				element.dataset.summary || '',
				element.dataset.dtstart || '',
				element.dataset.dtend || '',
				element.dataset.status || '',
				element.dataset.location || '',
				element.dataset.geo || '',
				element.dataset.description || '',
			);
		});
	});

	container.querySelectorAll('.form-delete').forEach(form => {
		const element = form as HTMLFormElement;
		element.addEventListener('submit', (e) => {
			handleDelete(e, element.dataset.uid || '');
		});
	});

	container.querySelectorAll('[data-page-delta]').forEach(btn => {
		const element = btn as HTMLButtonElement;
		element.addEventListener('click', () => {
			const delta = parseInt(element.dataset.pageDelta || '0', 10);
			changePage(delta);
		});
	});
}

function changePage(delta: number): void {
	currentPage += delta;
	renderEventsPage();
}

document.getElementById('allDayToggle')!.addEventListener('change', function (this: HTMLInputElement) {
	const isAllDay = this.checked;
	(document.getElementById('isAllDayInput') as HTMLInputElement).value = isAllDay ? '1' : '0';
	const startInput = document.getElementById('localStart') as HTMLInputElement;
	const endInput = document.getElementById('localEnd') as HTMLInputElement;
	document.getElementById('startLabel')!.textContent = isAllDay ? 'Start Date*' : 'Start Date & Time (Local)*';
	document.getElementById('endLabel')!.textContent = isAllDay ? 'End Date' : 'End Date & Time (Local)';
	startInput.type = isAllDay ? 'date' : 'datetime-local';
	endInput.type = isAllDay ? 'date' : 'datetime-local';
	document.getElementById('tzRow')!.style.display = isAllDay ? 'none' : '';
	startInput.value = '';
	endInput.value = '';
});

document.getElementById('editAllDayToggle')!.addEventListener('change', function (this: HTMLInputElement) {
	const isAllDay = this.checked;
	(document.getElementById('editIsAllDayInput') as HTMLInputElement).value = isAllDay ? '1' : '0';
	const startInput = document.getElementById('edit-local-start') as HTMLInputElement;
	const endInput = document.getElementById('edit-local-end') as HTMLInputElement;
	document.getElementById('editStartLabel')!.textContent = isAllDay ? 'Start Date*' : 'Start Date & Time*';
	document.getElementById('editEndLabel')!.textContent = isAllDay ? 'End Date' : 'End Date & Time';
	startInput.type = isAllDay ? 'date' : 'datetime-local';
	endInput.type = isAllDay ? 'date' : 'datetime-local';
	document.getElementById('editTzRow')!.style.display = isAllDay ? 'none' : '';
	startInput.value = '';
	endInput.value = '';
});

document.getElementById('eventForm')!.addEventListener('submit', async (e) => {
	e.preventDefault();
	const form = e.target as HTMLFormElement;
	const btn = document.getElementById('submitBtn') as HTMLButtonElement;
	btn.innerText = 'Publishing...';
	btn.disabled = true;

	const isAllDay = (document.getElementById('allDayToggle') as HTMLInputElement).checked;
	const start = (document.getElementById('localStart') as HTMLInputElement).value;
	const end = (document.getElementById('localEnd') as HTMLInputElement).value;

	if (isAllDay) {
		if (start) (document.getElementById('isoStart') as HTMLInputElement).value = start;
		if (end) (document.getElementById('isoEnd') as HTMLInputElement).value = end;
	} else {
		const tz = (document.getElementById('tzSelect') as HTMLSelectElement).value;
		if (start) (document.getElementById('isoStart') as HTMLInputElement).value = start + tz;
		if (end) (document.getElementById('isoEnd') as HTMLInputElement).value = end + tz;
	}

	try {
		const res = await fetch('/admin', { method: 'POST', body: new FormData(form) });
		const data = (await res.json()) as { success: boolean; error?: string };
		if (!data.success) {
			alert('Error: ' + data.error);
		} else {
			alert('Success!');
			form.reset();
			(document.getElementById('allDayToggle') as HTMLInputElement).checked = false;
			(document.getElementById('isAllDayInput') as HTMLInputElement).value = '0';
			(document.getElementById('localStart') as HTMLInputElement).type = 'datetime-local';
			(document.getElementById('localEnd') as HTMLInputElement).type = 'datetime-local';
			document.getElementById('tzRow')!.style.display = '';
			document.getElementById('startLabel')!.textContent = 'Start Date & Time (Local)*';
			document.getElementById('endLabel')!.textContent = 'End Date & Time (Local)';
			loadEvents();
		}
	} catch {
		alert('Network Error');
	} finally {
		btn.innerText = 'Publish to Calendar Feed';
		btn.disabled = false;
	}
});

async function handleDelete(e: Event, uid: string): Promise<void> {
	e.preventDefault();
	const form = e.target as HTMLFormElement;
	const btn = form.querySelector('button') as HTMLButtonElement;
	btn.disabled = true;
	const formData = new FormData();
	formData.append('action', 'delete');
	formData.append('_csrf', CSRF_TOKEN);
	formData.append('uid', uid);
	formData.append('password', (form.querySelector('.del-pass') as HTMLInputElement).value);

	try {
		const res = await fetch('/admin', { method: 'POST', body: formData });
		const data = (await res.json()) as { success: boolean; error?: string };
		if (!data.success) {
			alert('Error: ' + data.error);
		} else {
			loadEvents();
		}
	} catch {
		alert('Network Error');
	} finally {
		btn.disabled = false;
	}
}

function openEditModal(
	uid: string,
	summary: string,
	dtstart: string,
	dtend: string,
	status: string,
	location: string,
	geo: string,
	description: string,
): void {
	(document.getElementById('edit-uid') as HTMLInputElement).value = uid;
	(document.getElementById('edit-summary') as HTMLInputElement).value = summary;
	(document.getElementById('edit-status') as HTMLSelectElement).value = status;
	(document.getElementById('edit-location') as HTMLInputElement).value = location || '';
	(document.getElementById('edit-geo') as HTMLInputElement).value = geo || '';
	(document.getElementById('edit-description') as HTMLTextAreaElement).value = description || '';

	document.getElementById('edit-more-details')!.style.display = 'none';
	document.getElementById('editMoreBtn')!.innerText = 'Show More Details';
	(document.getElementById('editTzSelect') as HTMLSelectElement).value = '+08:00';

	const isAllDay = !!(dtstart && !dtstart.includes('T'));
	(document.getElementById('editAllDayToggle') as HTMLInputElement).checked = isAllDay;
	(document.getElementById('editIsAllDayInput') as HTMLInputElement).value = isAllDay ? '1' : '0';
	const editStartInput = document.getElementById('edit-local-start') as HTMLInputElement;
	const editEndInput = document.getElementById('edit-local-end') as HTMLInputElement;
	editStartInput.type = isAllDay ? 'date' : 'datetime-local';
	editEndInput.type = isAllDay ? 'date' : 'datetime-local';
	document.getElementById('editStartLabel')!.textContent = isAllDay ? 'Start Date*' : 'Start Date & Time*';
	document.getElementById('editEndLabel')!.textContent = isAllDay ? 'End Date' : 'End Date & Time';
	document.getElementById('editTzRow')!.style.display = isAllDay ? 'none' : '';

	if (isAllDay) {
		const icsDateToInput = (d: string): string => {
			if (!d) return '';
			return d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
		};
		editStartInput.value = icsDateToInput(dtstart);
		editEndInput.value = icsDateToInput(dtend);
	} else {
		const icsToLocal = (icsDate: string): string => {
			if (!icsDate) return '';
			const iso = icsDate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
			const d = new Date(iso);
			const offset = -480;
			const local = new Date(d.getTime() - offset * 60000);
			return local.toISOString().slice(0, 16);
		};
		editStartInput.value = icsToLocal(dtstart);
		editEndInput.value = icsToLocal(dtend);
	}

	document.getElementById('editModal')!.classList.add('open');
}

function closeEditModal(): void {
	document.getElementById('editModal')!.classList.remove('open');
	(document.getElementById('editForm') as HTMLFormElement).reset();
}

function toggleMoreDetails(): void {
	const div = document.getElementById('edit-more-details')!;
	const btn = document.getElementById('editMoreBtn')!;
	if (div.style.display === 'none') {
		div.style.display = 'block';
		btn.innerText = 'Hide More Details';
	} else {
		div.style.display = 'none';
		btn.innerText = 'Show More Details';
	}
}

async function handleEdit(e: Event): Promise<void> {
	e.preventDefault();
	const btn = document.getElementById('editSubmitBtn') as HTMLButtonElement;
	btn.innerText = 'Saving...';
	btn.disabled = true;

	const isAllDay = (document.getElementById('editAllDayToggle') as HTMLInputElement).checked;
	const start = (document.getElementById('edit-local-start') as HTMLInputElement).value;
	const end = (document.getElementById('edit-local-end') as HTMLInputElement).value;

	if (isAllDay) {
		(document.getElementById('edit-iso-start') as HTMLInputElement).value = start || '';
		(document.getElementById('edit-iso-end') as HTMLInputElement).value = end || '';
	} else {
		const tz = (document.getElementById('editTzSelect') as HTMLSelectElement).value;
		(document.getElementById('edit-iso-start') as HTMLInputElement).value = start ? start + tz : '';
		(document.getElementById('edit-iso-end') as HTMLInputElement).value = end ? end + tz : '';
	}

	try {
		const res = await fetch('/admin', {
			method: 'POST',
			body: new FormData(document.getElementById('editForm') as HTMLFormElement),
		});
		const data = (await res.json()) as { success: boolean; error?: string };
		if (!data.success) {
			alert('Error: ' + data.error);
		} else {
			closeEditModal();
			loadEvents();
		}
	} catch {
		alert('Network Error');
	} finally {
		btn.innerText = 'Save Changes';
		btn.disabled = false;
	}
}

const editLocationInput = document.getElementById('edit-location') as HTMLInputElement;
if (editLocationInput) {
	editLocationInput.addEventListener('input', (e) => {
		const target = e.target as HTMLInputElement;
		const match = VENUES.find(v => v.name === target.value);
		const editGeoInput = document.getElementById('edit-geo') as HTMLInputElement;
		if (match && editGeoInput) {
			editGeoInput.value = match.geo;
		}
	});
}

document.getElementById('editModal')!.addEventListener('click', function (this: HTMLElement, e) {
	if (e.target === this) {
		closeEditModal();
	}
});

document.getElementById('modalCloseBtn')!.addEventListener('click', closeEditModal);
document.getElementById('editMoreBtn')!.addEventListener('click', toggleMoreDetails);
document.getElementById('editForm')!.addEventListener('submit', handleEdit);

initVenues();
loadEvents();
