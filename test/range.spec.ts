import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseRange, DEFAULT_PAST_DAYS, DEFAULT_FUTURE_DAYS } from '../src/lib/range';

function u(qs: string): URL {
	return new URL(`http://x.test/path${qs ? '?' + qs : ''}`);
}

describe('parseRange', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));
	});

	it('uses defaults when from and to are absent', () => {
		const r = parseRange(u(''));
		expect('error' in r).toBe(false);
		if (!('error' in r)) {
			expect(r.from).toBe('2026-05-02'); // 30 days back
			expect(r.to).toBe('2026-11-28'); // 180 days forward
		}
	});

	it('accepts ISO date strings', () => {
		const r = parseRange(u('from=2026-01-01&to=2026-12-31'));
		expect('error' in r).toBe(false);
		if (!('error' in r)) {
			expect(r.from).toBe('2026-01-01');
			expect(r.to).toBe('2026-12-31');
		}
	});

	it('rejects malformed from', () => {
		const r = parseRange(u('from=garbage&to=2026-12-31'));
		expect('error' in r).toBe(true);
	});

	it('rejects malformed to', () => {
		const r = parseRange(u('to=2026-13-99'));
		expect('error' in r).toBe(true);
	});

	it('rejects from > to', () => {
		const r = parseRange(u('from=2026-12-31&to=2026-01-01'));
		expect('error' in r).toBe(true);
	});

	it('uses default for missing endpoint', () => {
		const r = parseRange(u('from=2026-01-01'));
		expect('error' in r).toBe(false);
		if (!('error' in r)) {
			expect(r.from).toBe('2026-01-01');
			expect(r.to).toBe('2026-11-28');
		}
	});

	it('exposes default constants for callers that want to reuse them', () => {
		expect(DEFAULT_PAST_DAYS).toBe(30);
		expect(DEFAULT_FUTURE_DAYS).toBe(180);
	});
});
