import { describe, it, expect } from 'vitest';
import {
	sundayOfWeek,
	thursdayOfWeek,
	addWeeks,
	getWeekKey,
	getMonthKey,
	monthKeyToDate,
	formatMonthYear,
	parseDtstart,
	dtToDateStr,
} from '../client/src/dates';

describe('dates utilities', () => {
	describe('sundayOfWeek', () => {
		it('correctly rolls back to Sunday at 00:00:00', () => {
			// A Wednesday (Wednesday, Jan 7, 2026)
			const date = new Date(2026, 0, 7, 14, 30, 0);
			const result = sundayOfWeek(date);
			expect(result.getFullYear()).toBe(2026);
			expect(result.getMonth()).toBe(0); // January
			expect(result.getDate()).toBe(4); // Sunday is Jan 4
			expect(result.getHours()).toBe(0);
			expect(result.getMinutes()).toBe(0);
			expect(result.getSeconds()).toBe(0);
			expect(result.getMilliseconds()).toBe(0);
		});

		it('remains on Sunday at 00:00:00 if given a Sunday', () => {
			const sunday = new Date(2026, 0, 4, 18, 0, 0);
			const result = sundayOfWeek(sunday);
			expect(result.getFullYear()).toBe(2026);
			expect(result.getMonth()).toBe(0);
			expect(result.getDate()).toBe(4);
			expect(result.getHours()).toBe(0);
		});

		it('correctly rolls back across year/month boundaries', () => {
			// Thursday, Jan 1, 2026 should roll back to Sunday, Dec 28, 2025
			const newYearDay = new Date(2026, 0, 1, 10, 0, 0);
			const result = sundayOfWeek(newYearDay);
			expect(result.getFullYear()).toBe(2025);
			expect(result.getMonth()).toBe(11); // December
			expect(result.getDate()).toBe(28);
			expect(result.getHours()).toBe(0);
		});
	});

	describe('thursdayOfWeek', () => {
		it('returns Sunday + 4 days', () => {
			// Sunday, Jan 4, 2026
			const sunday = new Date(2026, 0, 4, 0, 0, 0);
			const thursday = thursdayOfWeek(sunday);
			expect(thursday.getFullYear()).toBe(2026);
			expect(thursday.getMonth()).toBe(0);
			expect(thursday.getDate()).toBe(8); // Jan 8 is Thursday
		});

		it('works correctly across month/year boundaries', () => {
			// Sunday, Dec 28, 2025
			const sunday = new Date(2025, 11, 28);
			const thursday = thursdayOfWeek(sunday);
			expect(thursday.getFullYear()).toBe(2026);
			expect(thursday.getMonth()).toBe(0); // January
			expect(thursday.getDate()).toBe(1); // Thursday, Jan 1
		});
	});

	describe('addWeeks', () => {
		it('shifts dates forward correctly', () => {
			const date = new Date(2026, 0, 1);
			const nextWeek = addWeeks(date, 1);
			expect(nextWeek.getFullYear()).toBe(2026);
			expect(nextWeek.getMonth()).toBe(0);
			expect(nextWeek.getDate()).toBe(8);
		});

		it('shifts dates backward correctly', () => {
			const date = new Date(2026, 0, 8);
			const prevWeek = addWeeks(date, -1);
			expect(prevWeek.getFullYear()).toBe(2026);
			expect(prevWeek.getMonth()).toBe(0);
			expect(prevWeek.getDate()).toBe(1);
		});

		it('does not shift dates if n is 0', () => {
			const date = new Date(2026, 0, 1);
			const sameDate = addWeeks(date, 0);
			expect(sameDate.getTime()).toBe(date.getTime());
		});

		it('works correctly across year boundaries', () => {
			const date = new Date(2025, 11, 28);
			const shifted = addWeeks(date, 2); // 14 days forward -> Jan 11, 2026
			expect(shifted.getFullYear()).toBe(2026);
			expect(shifted.getMonth()).toBe(0);
			expect(shifted.getDate()).toBe(11);
		});
	});

	describe('getWeekKey', () => {
		it('formats the week starting Sunday correctly matching YYYY-MM-DD', () => {
			// Wednesday, Jan 7, 2026 (Sunday is Jan 4)
			const date = new Date(2026, 0, 7);
			expect(getWeekKey(date)).toBe('2026-01-04');
		});

		it('correctly handles boundaries', () => {
			// Wednesday, Dec 31, 2025 (Sunday of the week is Dec 28)
			const date = new Date(2025, 11, 31);
			expect(getWeekKey(date)).toBe('2025-12-28');
		});
	});

	describe('getMonthKey', () => {
		it('formats the month matching YYYY-MM', () => {
			const date = new Date(2026, 0, 15);
			expect(getMonthKey(date)).toBe('2026-01');
		});

		it('correctly pads month digits', () => {
			const date = new Date(2026, 8, 15); // September (index 8)
			expect(getMonthKey(date)).toBe('2026-09');
		});
	});

	describe('monthKeyToDate', () => {
		it('returns the 1st of that month', () => {
			const date = monthKeyToDate('2026-01');
			expect(date.getFullYear()).toBe(2026);
			expect(date.getMonth()).toBe(0); // January
			expect(date.getDate()).toBe(1);
		});

		it('handles December correctly', () => {
			const date = monthKeyToDate('2025-12');
			expect(date.getFullYear()).toBe(2025);
			expect(date.getMonth()).toBe(11); // December
			expect(date.getDate()).toBe(1);
		});
	});

	describe('formatMonthYear', () => {
		it('formats correctly (e.g. "January 2026")', () => {
			const date = new Date(2026, 0, 15);
			expect(formatMonthYear(date, 'en-US')).toMatch(/January\s+2026/);
		});

		it('formats December correctly', () => {
			const date = new Date(2025, 11, 1);
			expect(formatMonthYear(date, 'en-US')).toMatch(/December\s+2025/);
		});
	});

	describe('parseDtstart', () => {
		it('returns null if input is null or empty', () => {
			expect(parseDtstart(null)).toBeNull();
			expect(parseDtstart('')).toBeNull();
		});

		it('parses iso string with T cleanly', () => {
			const result = parseDtstart('20260601T100000Z');
			expect(result).not.toBeNull();
			if (result) {
				expect(result.toISOString()).toBe('2026-06-01T10:00:00.000Z');
			}
		});

		it('parses iso string lacking a trailing Z suffix cleanly', () => {
			const result = parseDtstart('20260601T100000');
			expect(result).not.toBeNull();
			if (result) {
				expect(isNaN(result.getTime())).toBe(false);
				expect(result.getFullYear()).toBe(2026);
				expect(result.getMonth()).toBe(5); // June is 5
				expect(result.getDate()).toBe(1);
			}
		});

		it('parses basic YYYYMMDD date cleanly', () => {
			const result = parseDtstart('20260601');
			expect(result).not.toBeNull();
			if (result) {
				// Because 20260601 gets converted to 2026-06-01T00:00:00 (local time)
				expect(result.getFullYear()).toBe(2026);
				expect(result.getMonth()).toBe(5); // June is 5
				expect(result.getDate()).toBe(1);
				expect(result.getHours()).toBe(0);
				expect(result.getMinutes()).toBe(0);
				expect(result.getSeconds()).toBe(0);
			}
		});

		it('returns null for malformed strings and invalid dates safely', () => {
			expect(parseDtstart('invalid-date-string')).toBeNull();
			expect(parseDtstart('20269999')).toBeNull();
			expect(parseDtstart('20260601T999999Z')).toBeNull();
			expect(parseDtstart('99999999T999999')).toBeNull();
		});
	});

	describe('dtToDateStr', () => {
		it('returns null if input is null or empty', () => {
			expect(dtToDateStr(null)).toBeNull();
			expect(dtToDateStr('')).toBeNull();
		});

		it('converts datetime strings with T to YYYY-MM-DD cleanly', () => {
			expect(dtToDateStr('20260601T100000Z')).toBe('2026-06-01');
			expect(dtToDateStr('20261225T180000')).toBe('2026-12-25');
		});

		it('converts basic YYYYMMDD to YYYY-MM-DD cleanly', () => {
			expect(dtToDateStr('20260601')).toBe('2026-06-01');
			expect(dtToDateStr('20251228')).toBe('2025-12-28');
		});
	});
});
