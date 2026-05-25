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

// ─── GET /api/events ─────────────────────────────────────────────────────────

describe('GET /api/events', () => {
	beforeEach(async () => {
		await runSQL('DELETE FROM event_alarms; DELETE FROM event_attachments; DELETE FROM events;');
	});

	it('returns 200 with empty array when no events', async () => {
		const res = await req(`${BASE}/api/events`);
		expect(res.status).toBe(200);
		const data = (await res.json()) as unknown[];
		expect(Array.isArray(data)).toBe(true);
		expect(data).toHaveLength(0);
	});

	it('has correct Content-Type, Cache-Control, and CORS headers', async () => {
		const res = await req(`${BASE}/api/events`);
		expect(res.headers.get('Content-Type')).toContain('application/json');
		expect(res.headers.get('Cache-Control')).toBe('public, max-age=10, s-maxage=30');
		expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});

	it('returns events when they exist', async () => {
		await env.DB.prepare(
			"INSERT INTO events (uid, calendar_id, dtstamp, dtstart, dtend, summary, status) VALUES ('evt-1@ntuas.edu', 'main-cal-001', '20260101T000000Z', '20260201T100000Z', '20260201T120000Z', 'Test Event', 'CONFIRMED')",
		).run();

		// Explicit wide range so the seeded event (20260201) falls inside the window.
		const res = await req(`${BASE}/api/events?from=2020-01-01&to=2030-12-31`);
		const data = (await res.json()) as { summary: string }[];
		expect(data).toHaveLength(1);
		expect(data[0].summary).toBe('Test Event');
	});

	it('filters by from and to query params', async () => {
		await env.DB.prepare(
			"INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, class) VALUES ('e-old', 'main-cal-001', '20260101T000000Z', '20260101T000000Z', 'Old', 'CONFIRMED', 'PUBLIC')",
		).run();
		await env.DB.prepare(
			"INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, class) VALUES ('e-now', 'main-cal-001', '20260601T000000Z', '20260601T000000Z', 'Now', 'CONFIRMED', 'PUBLIC')",
		).run();
		await env.DB.prepare(
			"INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, class) VALUES ('e-far', 'main-cal-001', '20271201T000000Z', '20271201T000000Z', 'Far Future', 'CONFIRMED', 'PUBLIC')",
		).run();

		const res = await req(`${BASE}/api/events?from=2026-05-01&to=2026-07-01`);
		expect(res.status).toBe(200);
		const events = (await res.json()) as Array<{ uid: string }>;
		const uids = events.map((e) => e.uid).sort();
		expect(uids).toEqual(['e-now']);
	});

	it('returns 400 for malformed from', async () => {
		const res = await req(`${BASE}/api/events?from=not-a-date`);
		expect(res.status).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/Invalid `from`/);
	});

	it('returns 400 when from > to', async () => {
		const res = await req(`${BASE}/api/events?from=2026-12-31&to=2026-01-01`);
		expect(res.status).toBe(400);
	});
});
