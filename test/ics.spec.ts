import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { applySchema } from './helpers/load-schema';
import { BASE, req, runSQL } from './helpers/admin';

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
	await applySchema(env.DB);
	await env.DB.prepare(
		"INSERT OR IGNORE INTO calendars (id, x_wr_calname, x_wr_timezone) VALUES ('main-cal-001', 'NTUAS Events', 'Asia/Singapore')",
	).run();
});

// ─── GET /subscribe & /calendar.ics ─────────────────────────────────────────

describe('GET /subscribe', () => {
	beforeEach(async () => {
		await runSQL('DELETE FROM event_alarms; DELETE FROM event_attachments; DELETE FROM events;');
	});

	it('returns valid ICS with VCALENDAR wrapper', async () => {
		const res = await req(`${BASE}/subscribe`);
		expect(res.status).toBe(200);
		expect(res.headers.get('Content-Type')).toContain('text/calendar');
		const body = await res.text();
		expect(body).toContain('BEGIN:VCALENDAR');
		expect(body).toContain('END:VCALENDAR');
	});

	it('also works at /calendar.ics', async () => {
		const res = await req(`${BASE}/calendar.ics`);
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain('BEGIN:VCALENDAR');
	});

	it('has CORS and cache headers', async () => {
		const res = await req(`${BASE}/subscribe`);
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
		expect(res.headers.get('Cache-Control')).toContain('max-age=3600');
	});

	it('has security headers', async () => {
		const res = await req(`${BASE}/subscribe`);
		expect(res.headers.get('X-Frame-Options')).toBe('DENY');
	});

	it('includes VEVENT for each event', async () => {
		await env.DB.prepare(
			"INSERT INTO events (uid, calendar_id, dtstamp, dtstart, dtend, summary, status) VALUES ('ics-evt@ntuas.edu', 'main-cal-001', '20260101T000000Z', '20260201T100000Z', '20260201T120000Z', 'ICS Test Event', 'CONFIRMED')",
		).run();

		// Explicit wide range so seeded event falls inside the window.
		const res = await req(`${BASE}/subscribe?from=2020-01-01&to=2030-12-31`);
		const body = await res.text();
		expect(body).toContain('BEGIN:VEVENT');
		expect(body).toContain('SUMMARY:ICS Test Event');
		expect(body).toContain('END:VEVENT');
	});

	it('includes VALARM when alarm exists for event', async () => {
		await env.DB.prepare(
			"INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status) VALUES ('alarm-evt@ntuas.edu', 'main-cal-001', '20260101T000000Z', '20260201T100000Z', 'Alarm Event', 'CONFIRMED')",
		).run();
		await env.DB.prepare(
			"INSERT INTO event_alarms (event_uid, action, trigger, description) VALUES ('alarm-evt@ntuas.edu', 'DISPLAY', '-PT15M', 'Reminder')",
		).run();

		const res = await req(`${BASE}/subscribe?from=2020-01-01&to=2030-12-31`);
		const body = await res.text();
		expect(body).toContain('BEGIN:VALARM');
		expect(body).toContain('TRIGGER:-PT15M');
		expect(body).toContain('END:VALARM');
	});

	it('folds lines at 75 octets per RFC 5545', async () => {
		const longSummary = 'A'.repeat(200);
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status) VALUES ('fold-evt@ntuas.edu', 'main-cal-001', '20260101T000000Z', '20260201T100000Z', '${longSummary}', 'CONFIRMED')`,
		).run();

		const res = await req(`${BASE}/subscribe?from=2020-01-01&to=2030-12-31`);
		const body = await res.text();
		const encoder = new TextEncoder();
		for (const line of body.split('\r\n')) {
			expect(encoder.encode(line).byteLength).toBeLessThanOrEqual(75);
		}
	});

	it('uses VALUE=DATE format for all-day events', async () => {
		await env.DB.prepare(
			"INSERT INTO events (uid, calendar_id, dtstamp, dtstart, dtend, summary, status, transp) VALUES ('allday-evt@ntuas.edu', 'main-cal-001', '20260101T000000Z', '20260301', '20260302', 'All Day Event', 'CONFIRMED', 'TRANSPARENT')",
		).run();

		const res = await req(`${BASE}/subscribe?from=2020-01-01&to=2030-12-31`);
		const body = await res.text();
		expect(body).toContain('DTSTART;VALUE=DATE:20260301');
		expect(body).toContain('DTEND;VALUE=DATE:20260302');
	});

	it('returns 404 when no calendar row exists', async () => {
		// Wipe the seeded calendar for this test only
		await env.DB.prepare('DELETE FROM calendars').run();

		try {
			const res = await req(`${BASE}/subscribe`);
			expect(res.status).toBe(404);
			expect(await res.text()).toBe('Calendar not found');
		} finally {
			// Restore the seed for downstream tests in this file
			await env.DB.prepare(
				"INSERT INTO calendars (id, x_wr_calname, x_wr_timezone) VALUES ('main-cal-001', 'NTUAS Events', 'Asia/Singapore')",
			).run();
		}
	});

	it('includes ATTACH lines when event has attachments', async () => {
		const uid = 'event-attach-test-uid';
		const dtstamp = '20260524T120000Z';
		const dtstart = '20260601T100000Z';
		await env.DB.prepare(
			"INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, class) VALUES (?, 'main-cal-001', ?, ?, 'Event With Attachment', 'CONFIRMED', 'PUBLIC')",
		)
			.bind(uid, dtstamp, dtstart)
			.run();
		await env.DB.prepare('INSERT INTO event_attachments (event_uid, uri, fmttype) VALUES (?, ?, ?)')
			.bind(uid, 'https://example.com/slides.pdf', 'application/pdf')
			.run();

		try {
			// Explicit wide range so the seeded 2026 event falls inside the window.
			const res = await req(`${BASE}/subscribe?from=2020-01-01&to=2030-12-31`);
			expect(res.status).toBe(200);
			const body = await res.text();
			expect(body).toContain('ATTACH;FMTTYPE=application/pdf:https://example.com/slides.pdf');
		} finally {
			// Clean up so downstream tests see a deterministic state
			await env.DB.prepare('DELETE FROM events WHERE uid = ?').bind(uid).run();
		}
	});

	it('filters by from and to query params', async () => {
		await env.DB.prepare(
			"INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, class) VALUES ('ics-old', 'main-cal-001', '20260101T000000Z', '20260101T000000Z', 'Old Event', 'CONFIRMED', 'PUBLIC')",
		).run();
		await env.DB.prepare(
			"INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, class) VALUES ('ics-now', 'main-cal-001', '20260601T000000Z', '20260601T000000Z', 'Now Event', 'CONFIRMED', 'PUBLIC')",
		).run();

		const res = await req(`${BASE}/subscribe?from=2026-05-01&to=2026-07-01`);
		expect(res.status).toBe(200);
		const body = await res.text();
		expect(body).toContain('SUMMARY:Now Event');
		expect(body).not.toContain('SUMMARY:Old Event');
	});

	it('returns 400 on malformed range params for /subscribe', async () => {
		const res = await req(`${BASE}/subscribe?from=garbage`);
		expect(res.status).toBe(400);
	});
});

// ─── ICS output safety ───────────────────────────────────────────────────────

describe('ICS output safety', () => {
	beforeEach(async () => {
		await runSQL('DELETE FROM event_alarms; DELETE FROM event_attachments; DELETE FROM events;');
	});

	it('escapes special chars in SUMMARY per RFC 5545', async () => {
		await env.DB.prepare(
			"INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status) VALUES ('xss-evt@ntuas.edu', 'main-cal-001', '20260101T000000Z', '20260201T100000Z', 'Event; with, special\\chars', 'CONFIRMED')",
		).run();

		const res = await req(`${BASE}/subscribe?from=2020-01-01&to=2030-12-31`);
		const body = await res.text();
		// Semicolons, commas, and backslashes must be escaped in ICS values
		expect(body).toContain('SUMMARY:Event\\; with\\, special\\\\chars');
	});

	it('escapes newlines in DESCRIPTION per RFC 5545', async () => {
		await env.DB.prepare(
			"INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, description, status) VALUES ('nl-evt@ntuas.edu', 'main-cal-001', '20260101T000000Z', '20260201T100000Z', 'NL Event', 'Line1\nLine2', 'CONFIRMED')",
		).run();

		const res = await req(`${BASE}/subscribe?from=2020-01-01&to=2030-12-31`);
		const body = await res.text();
		expect(body).toContain('DESCRIPTION:Line1\\nLine2');
	});
});
