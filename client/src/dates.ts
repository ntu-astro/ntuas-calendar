export function sundayOfWeek(date: Date): Date {
	const d = new Date(date);
	d.setDate(d.getDate() - d.getDay());
	d.setHours(0, 0, 0, 0);
	return d;
}

export function thursdayOfWeek(sundayDate: Date): Date {
	const d = new Date(sundayDate);
	d.setDate(d.getDate() + 4);
	return d;
}

export function addWeeks(date: Date, n: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() + 7 * n);
	return d;
}

export function getWeekKey(date: Date): string {
	const sun = sundayOfWeek(date);
	return `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`;
}

export function getMonthKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthKeyToDate(key: string): Date {
	const [y, m] = key.split('-').map(Number);
	return new Date(y, m - 1, 1);
}

export function formatMonthYear(date: Date): string {
	return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

export function parseDtstart(dtstart: string | null): Date | null {
	if (!dtstart) return null;
	if (dtstart.includes('T')) {
		const iso = dtstart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
		return new Date(iso);
	} else {
		const y = dtstart.slice(0, 4), m = dtstart.slice(4, 6), d = dtstart.slice(6, 8);
		return new Date(y + '-' + m + '-' + d + 'T00:00:00');
	}
}

export function dtToDateStr(dtstart: string | null): string | null {
	if (!dtstart) return null;
	if (dtstart.includes('T')) {
		return dtstart.replace(/(\d{4})(\d{2})(\d{2})T.*/, '$1-$2-$3');
	} else {
		const y = dtstart.slice(0, 4), m = dtstart.slice(4, 6), d = dtstart.slice(6, 8);
		return y + '-' + m + '-' + d;
	}
}
