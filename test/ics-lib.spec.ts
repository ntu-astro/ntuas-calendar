import { describe, it, expect } from 'vitest';
import { fold, sanitizeIcsOrganizerName, sanitizeIcsValue, toIcsDate, toIcsDateOnly } from '../src/lib/ics';

// ─── fold ───────────────────────────────────────────────────────────────────

describe('fold', () => {
	it('returns a short line unchanged', () => {
		const short = 'SUMMARY:hello';
		expect(fold(short)).toBe(short);
	});

	it('returns a line at exactly 75 octets unchanged', () => {
		const line = 'A'.repeat(75);
		expect(new TextEncoder().encode(line).byteLength).toBe(75);
		expect(fold(line)).toBe(line);
	});

	it('splits a long ASCII line with \\r\\n + space continuation, each chunk <= 75 octets', () => {
		const line = 'A'.repeat(200);
		const folded = fold(line);
		expect(folded).toContain('\r\n ');
		const encoder = new TextEncoder();
		for (const segment of folded.split('\r\n')) {
			expect(encoder.encode(segment).byteLength).toBeLessThanOrEqual(75);
		}
		// Joined-back content (continuation lines are prefixed with ' ') still
		// contains the original run of A's.
		expect(folded.replace(/\r\n /g, '')).toBe(line);
	});

	it('splits multi-byte CJK characters without breaking a UTF-8 sequence', () => {
		// '你' = 3 bytes in UTF-8. A run of 40 chars = 120 bytes — must fold.
		const cjkLine = '你'.repeat(40);
		const folded = fold(cjkLine);
		const encoder = new TextEncoder();

		for (const segment of folded.split('\r\n')) {
			const bytes = encoder.encode(segment).byteLength;
			expect(bytes).toBeLessThanOrEqual(75);
		}

		// Round-trip: stripping the CRLF+space continuation must yield the original.
		expect(folded.replace(/\r\n /g, '')).toBe(cjkLine);

		// Each segment must decode without replacement characters (which would
		// indicate a sliced multi-byte sequence).
		const decoder = new TextDecoder('utf-8', { fatal: true });
		for (const segment of folded.split('\r\n')) {
			expect(() => decoder.decode(encoder.encode(segment))).not.toThrow();
		}
	});

	it('returns an empty string unchanged', () => {
		expect(fold('')).toBe('');
	});
});

// ─── toIcsDate ──────────────────────────────────────────────────────────────

describe('toIcsDate', () => {
	it('formats a valid ISO datetime to YYYYMMDDTHHmmssZ', () => {
		expect(toIcsDate('2026-04-09T15:30:45.000Z')).toBe('20260409T153045Z');
	});

	it('returns null for null input', () => {
		expect(toIcsDate(null)).toBeNull();
	});

	it('returns null for empty string', () => {
		expect(toIcsDate('')).toBeNull();
	});

	it('round-trips a known fixed datetime', () => {
		const iso = '2026-12-31T23:59:59.000Z';
		const formatted = toIcsDate(iso);
		expect(formatted).toBe('20261231T235959Z');
		// Re-parse the formatted string to confirm fidelity to the original instant.
		const parsedBack = new Date(
			`${formatted!.slice(0, 4)}-${formatted!.slice(4, 6)}-${formatted!.slice(6, 8)}T${formatted!.slice(9, 11)}:${formatted!.slice(11, 13)}:${formatted!.slice(13, 15)}Z`,
		);
		expect(parsedBack.toISOString()).toBe(iso);
	});
});

// ─── toIcsDateOnly ──────────────────────────────────────────────────────────

describe('toIcsDateOnly', () => {
	it('formats a valid date to YYYYMMDD', () => {
		expect(toIcsDateOnly('2026-04-09T00:00:00.000Z')).toBe('20260409');
	});

	it('returns null for null input', () => {
		expect(toIcsDateOnly(null)).toBeNull();
	});
});

// ─── sanitizeIcsValue ───────────────────────────────────────────────────────

describe('sanitizeIcsValue', () => {
	it('escapes a single backslash to \\\\', () => {
		expect(sanitizeIcsValue('a\\b')).toBe('a\\\\b');
	});

	it('escapes a semicolon to \\;', () => {
		expect(sanitizeIcsValue('a;b')).toBe('a\\;b');
	});

	it('escapes a comma to \\,', () => {
		expect(sanitizeIcsValue('a,b')).toBe('a\\,b');
	});

	it('converts \\n, \\r, and \\r\\n to the literal escape sequence \\n', () => {
		expect(sanitizeIcsValue('a\nb')).toBe('a\\nb');
		expect(sanitizeIcsValue('a\rb')).toBe('a\\nb');
		expect(sanitizeIcsValue('a\r\nb')).toBe('a\\nb');
	});

	it('escapes a combination of all four special types without double-escaping', () => {
		// Input has a backslash, a semicolon, a comma, and a newline.
		const input = 'foo\\bar;baz,qux\nend';
		const out = sanitizeIcsValue(input);
		// Backslash → \\, semicolon → \;, comma → \,, newline → \n (literal).
		expect(out).toBe('foo\\\\bar\\;baz\\,qux\\nend');
		// Confirm the backslash introduced by \n is NOT itself escaped (would be \\\\n).
		expect(out).not.toContain('\\\\nend');
	});
});

// ─── sanitizeIcsOrganizerName ───────────────────────────────────────────────

describe('sanitizeIcsOrganizerName', () => {
	it('strips \\r, \\n, semicolons, and colons', () => {
		expect(sanitizeIcsOrganizerName('foo\r\n;:bar')).toBe('foobar');
		expect(sanitizeIcsOrganizerName('Dr\nSmith;Jr:')).toBe('DrSmithJr');
	});

	it('leaves other characters intact', () => {
		expect(sanitizeIcsOrganizerName('Jane Doe, PhD')).toBe('Jane Doe, PhD');
		expect(sanitizeIcsOrganizerName('张伟 (Wei)')).toBe('张伟 (Wei)');
		expect(sanitizeIcsOrganizerName('a-b_c.d')).toBe('a-b_c.d');
	});

	it('returns an empty string when input is empty', () => {
		expect(sanitizeIcsOrganizerName('')).toBe('');
	});
});
