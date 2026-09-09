import { miniCalDate, setMiniCalDate, selectedDateStr } from './state.js';
import { clearEventDetails } from './eventDetail.js';
import { scrollToDate, highlightDate } from './weekGrid.js';

function renderPrevMonthDays(grid: HTMLElement, year: number, month: number, firstDay: number, prevMonthDays: number): void {
	for (let i = firstDay - 1; i >= 0; i--) {
		const el = document.createElement('div');
		const dayNum = prevMonthDays - i;
		const targetDate = new Date(year, month - 1, dayNum);
		const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
		const isSelected = selectedDateStr === dateStr;
		el.className = 'mini-cal-day other-month' + (isSelected ? ' selected' : '');
		el.textContent = String(dayNum);
		el.addEventListener('click', () => {
			setMiniCalDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
			clearEventDetails(true);
			highlightDate(dateStr);
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
		const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
		const isSelected = selectedDateStr === dateStr;
		el.className = 'mini-cal-day' + (isToday ? ' today' : '') + (isSelected && !isToday ? ' selected' : '');
		el.textContent = String(i);
		el.addEventListener('click', () => {
			clearEventDetails(true);
			highlightDate(dateStr);
			const targetDate = new Date(year, month, i);
			scrollToDate(targetDate, 'smooth');
		});
		grid.appendChild(el);
	}
}

function renderNextMonthDays(grid: HTMLElement, year: number, month: number, totalCells: number): void {
	const remaining = 42 - totalCells;
	for (let i = 1; i <= remaining; i++) {
		const el = document.createElement('div');
		const dayNum = i;
		const targetDate = new Date(year, month + 1, dayNum);
		const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
		const isSelected = selectedDateStr === dateStr;
		el.className = 'mini-cal-day other-month' + (isSelected ? ' selected' : '');
		el.textContent = String(i);
		el.addEventListener('click', () => {
			setMiniCalDate(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
			clearEventDetails(true);
			highlightDate(dateStr);
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
	dayNames.forEach((d) => {
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
