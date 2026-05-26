/**
 * Calculates the Sunday of the week for a given date, setting the time to 00:00:00.000.
 *
 * @param date - The reference date.
 * @returns A new Date object representing Sunday at midnight of the same week.
 */
export function sundayOfWeek(date: Date): Date {
	const d = new Date(date);
	d.setDate(d.getDate() - d.getDay());
	d.setHours(0, 0, 0, 0);
	return d;
}

/**
 * Calculates the Thursday of the week given the Sunday of that week.
 *
 * @param sundayDate - The Sunday Date object (typically obtained from sundayOfWeek).
 * @returns A new Date object representing Thursday of that week.
 */
export function thursdayOfWeek(sundayDate: Date): Date {
	const d = new Date(sundayDate);
	d.setDate(d.getDate() + 4);
	return d;
}

/**
 * Adds or subtracts a specified number of weeks to/from a given date.
 *
 * @param date - The starting date.
 * @param n - The number of weeks to add (can be negative).
 * @returns A new Date object shifted by the specified number of weeks.
 */
export function addWeeks(date: Date, n: number): Date {
	const d = new Date(date);
	d.setDate(d.getDate() + 7 * n);
	return d;
}

/**
 * Generates a week key string representing the Sunday of the week for a given date.
 * Format: YYYY-MM-DD
 *
 * @param date - The reference date.
 * @returns A string key in the format YYYY-MM-DD.
 */
export function getWeekKey(date: Date): string {
	const sun = sundayOfWeek(date);
	return `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`;
}

/**
 * Generates a month key string for a given date.
 * Format: YYYY-MM
 *
 * @param date - The reference date.
 * @returns A string key in the format YYYY-MM.
 */
export function getMonthKey(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Converts a month key string (YYYY-MM) back to a Date object representing the 1st of that month.
 *
 * @param key - The month key in the format YYYY-MM.
 * @returns A new Date object set to the 1st of the specified month.
 */
export function monthKeyToDate(key: string): Date {
	const [y, m] = key.split('-').map(Number);
	return new Date(y, m - 1, 1);
}

/**
 * Formats a date into a month and year string using the specified locale.
 * Format: e.g. "January 2026"
 *
 * @param date - The date to format.
 * @param locale - Optional locale string (defaults to 'default').
 * @returns The formatted month and year string.
 */
export function formatMonthYear(date: Date, locale: string = 'default'): string {
	return date.toLocaleString(locale, { month: 'long', year: 'numeric' });
}

/**
 * Parses an iCalendar DTSTART string into a JavaScript Date object.
 * Supports formats like "YYYYMMDDThhmmssZ", "YYYYMMDDThhmmss" (local/no trailing Z), or "YYYYMMDD".
 * Returns null if the input is null, empty, or parsing results in an invalid date.
 *
 * @param dtstart - The iCalendar DTSTART string, or null.
 * @returns A Date object, or null if the string is invalid or empty.
 */
export function parseDtstart(dtstart: string | null): Date | null {
	if (!dtstart) return null;
	let date: Date;
	if (dtstart.includes('T')) {
		const iso = dtstart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)/, '$1-$2-$3T$4:$5:$6$7');
		date = new Date(iso);
	} else {
		const y = dtstart.slice(0, 4), m = dtstart.slice(4, 6), d = dtstart.slice(6, 8);
		date = new Date(y + '-' + m + '-' + d + 'T00:00:00');
	}
	return isNaN(date.getTime()) ? null : date;
}

/**
 * Converts an iCalendar DTSTART string into a simple date string format.
 * Format: YYYY-MM-DD
 *
 * @param dtstart - The iCalendar DTSTART string, or null.
 * @returns A string in the format YYYY-MM-DD, or null if input is empty/invalid.
 */
export function dtToDateStr(dtstart: string | null): string | null {
	if (!dtstart) return null;
	if (dtstart.includes('T')) {
		return dtstart.replace(/(\d{4})(\d{2})(\d{2})T.*/, '$1-$2-$3');
	} else {
		const y = dtstart.slice(0, 4), m = dtstart.slice(4, 6), d = dtstart.slice(6, 8);
		return y + '-' + m + '-' + d;
	}
}
