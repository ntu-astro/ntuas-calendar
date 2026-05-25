import { describe, it, expect } from 'vitest';
import { parseAndValidateEventInput } from '../src/lib/validation';

function form(entries: Record<string, string>): FormData {
	const f = new FormData();
	for (const [k, v] of Object.entries(entries)) f.set(k, v);
	return f;
}

describe('parseAndValidateEventInput', () => {
	it('rejects missing summary', () => {
		const result = parseAndValidateEventInput(form({ dtstart: '2026-06-01T10:00:00Z' }));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.status).toBe(400);
			expect(result.error.body.error).toMatch(/title is required/i);
		}
	});

	it('rejects summary over 500 chars', () => {
		const result = parseAndValidateEventInput(form({ summary: 'x'.repeat(501), dtstart: '2026-06-01T10:00:00Z' }));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.body.error).toMatch(/500 characters/);
	});

	it('rejects missing dtstart', () => {
		const result = parseAndValidateEventInput(form({ summary: 'A' }));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.body.error).toMatch(/Start date is required/);
	});

	it('rejects description over 5000 chars', () => {
		const result = parseAndValidateEventInput(
			form({
				summary: 'A',
				dtstart: '2026-06-01T10:00:00Z',
				description: 'x'.repeat(5001),
			}),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.body.error).toMatch(/5000 characters/);
	});

	it('rejects location over 500 chars', () => {
		const result = parseAndValidateEventInput(
			form({
				summary: 'A',
				dtstart: '2026-06-01T10:00:00Z',
				location: 'x'.repeat(501),
			}),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.body.error).toMatch(/Location must be/);
	});

	it('rejects invalid status', () => {
		const result = parseAndValidateEventInput(
			form({
				summary: 'A',
				dtstart: '2026-06-01T10:00:00Z',
				status: 'BOGUS',
			}),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.body.error).toMatch(/Invalid status/);
	});

	it('rejects invalid organizer email', () => {
		const result = parseAndValidateEventInput(
			form({
				summary: 'A',
				dtstart: '2026-06-01T10:00:00Z',
				organizer_email: 'not-an-email',
			}),
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.body.error).toMatch(/organizer email/i);
	});

	it('accepts a fully-formed timed event', () => {
		const result = parseAndValidateEventInput(
			form({
				summary: 'Lecture',
				dtstart: '2026-06-01T10:00:00Z',
				dtend: '2026-06-01T11:00:00Z',
				description: 'Intro to X',
				location: 'LT1 - North Spine',
				geo: '1.3473;103.6803',
				categories: 'ACADEMIC,LECTURE',
				class: 'PUBLIC',
				status: 'CONFIRMED',
				url: 'https://example.com',
				organizer_name: 'Prof Smith',
				organizer_email: 'smith@ntu.edu.sg',
				transp: 'OPAQUE',
			}),
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.input.isAllDay).toBe(false);
			expect(result.input.dtstart).toBe('20260601T100000Z');
			expect(result.input.dtend).toBe('20260601T110000Z');
			expect(result.input.summary).toBe('Lecture');
			expect(result.input.categories).toBe('ACADEMIC,LECTURE');
			expect(result.input.class).toBe('PUBLIC');
			expect(result.input.url).toBe('https://example.com');
			expect(result.input.organizer).toBe(';CN=Prof Smith:mailto:smith@ntu.edu.sg');
		}
	});

	it('accepts an all-day event and synthesises end date when missing', () => {
		const result = parseAndValidateEventInput(
			form({
				summary: 'Holiday',
				dtstart: '2026-12-25T00:00:00Z',
				is_all_day: '1',
			}),
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.input.isAllDay).toBe(true);
			expect(result.input.dtstart).toBe('20261225');
			expect(result.input.dtend).toBe('20261226');
			expect(result.input.transp).toBe('TRANSPARENT');
		}
	});

	it('prefixes email-only organizer with colon so ICS render is well-formed', () => {
		const result = parseAndValidateEventInput(
			form({
				summary: 'A',
				dtstart: '2026-06-01T10:00:00Z',
				organizer_email: 'smith@ntu.edu.sg',
			}),
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.input.organizer).toBe(':mailto:smith@ntu.edu.sg');
		}
	});

	it('defaults class to PUBLIC and status to CONFIRMED', () => {
		const result = parseAndValidateEventInput(form({ summary: 'A', dtstart: '2026-06-01T10:00:00Z' }));
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.input.class).toBe('PUBLIC');
			expect(result.input.status).toBe('CONFIRMED');
		}
	});
});
