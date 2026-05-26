import { miniCalDate, setMiniCalDate } from './state.js';
import { clearEventDetails } from './eventDetail.js';
import { scrollToDate } from './weekGrid.js';

function renderPrevMonthDays(grid: HTMLElement, year: number, month: number, firstDay: number, prevMonthDays: number): void {
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
}

function renderCurrentMonthDays(grid: HTMLElement, year: number, month: number, daysInMonth: number): void {
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
}

function renderNextMonthDays(grid: HTMLElement, year: number, month: number, totalCells: number): void {
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

export function renderMiniCalendar(): void {
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

	renderPrevMonthDays(grid, year, month, firstDay, prevMonthDays);
	renderCurrentMonthDays(grid, year, month, daysInMonth);
	renderNextMonthDays(grid, year, month, firstDay + daysInMonth);
}
