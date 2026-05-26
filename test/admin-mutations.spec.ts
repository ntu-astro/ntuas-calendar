import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { applySchema } from './helpers/load-schema';
import { ADMIN_PASS, BASE, adminPost, login, req, runSQL } from './helpers/admin';

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
	await applySchema(env.DB);
	await env.DB.prepare(
		"INSERT OR IGNORE INTO calendars (id, x_wr_calname, x_wr_timezone) VALUES ('main-cal-001', 'NTUAS Events', 'Asia/Singapore')",
	).run();
});

// ─── POST /admin — add event ─────────────────────────────────────────────────

describe('POST /admin — add event', () => {
	beforeEach(async () => {
		await runSQL('DELETE FROM event_alarms; DELETE FROM event_attachments; DELETE FROM events; DELETE FROM admin_sessions;');
	});

	it('returns 403 without CSRF token', async () => {
		const { cookie } = await login();
		const body = new FormData();
		body.append('action', 'add');
		body.append('summary', 'Test');
		body.append('dtstart', '2026-03-01T10:00');
		const res = await req(`${BASE}/admin`, { method: 'POST', headers: { Cookie: cookie }, body });
		expect(res.status).toBe(403);
	});

	it('returns 400 when summary is missing', async () => {
		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'add',
			dtstart: '2026-03-01T10:00',
		});
		expect(res.status).toBe(400);
		const data = (await res.json()) as { error: string };
		expect(data.error).toContain('title');
	});

	it('returns 400 when summary exceeds 500 chars', async () => {
		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'add',
			summary: 'a'.repeat(501),
			dtstart: '2026-03-01T10:00',
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 for invalid status', async () => {
		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'add',
			summary: 'Test Event',
			dtstart: '2026-03-01T10:00',
			status: 'INVALID',
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 for invalid organizer email', async () => {
		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'add',
			summary: 'Test Event',
			dtstart: '2026-03-01T10:00',
			organizer_email: 'not-an-email',
		});
		expect(res.status).toBe(400);
	});

	it('creates event successfully with valid data', async () => {
		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'add',
			summary: 'New Test Event',
			dtstart: '2026-03-01T10:00',
			dtend: '2026-03-01T12:00',
			status: 'CONFIRMED',
		});
		expect(res.status).toBe(200);
		const data = (await res.json()) as { success: boolean };
		expect(data.success).toBe(true);

		const { results } = await env.DB.prepare("SELECT * FROM events WHERE summary = 'New Test Event'").all();
		expect(results).toHaveLength(1);
	});

	it('creates all-day event with date-only dtstart', async () => {
		const { cookie, csrfToken } = await login();
		await adminPost(cookie, csrfToken, {
			action: 'add',
			summary: 'All Day Event',
			is_all_day: '1',
			dtstart: '2026-03-01',
			status: 'CONFIRMED',
		});

		const row = await env.DB.prepare("SELECT dtstart FROM events WHERE summary = 'All Day Event'").first<{ dtstart: string }>();
		expect(row?.dtstart).not.toContain('T');
		expect(row?.dtstart).toMatch(/^\d{8}$/);
	});
});

// ─── POST /admin — update event ──────────────────────────────────────────────

describe('POST /admin — update event', () => {
	const TEST_UID = 'evt-update-test@ntuas.edu';

	beforeEach(async () => {
		await runSQL('DELETE FROM event_alarms; DELETE FROM event_attachments; DELETE FROM events; DELETE FROM admin_sessions;');
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, dtend, summary, status)
         VALUES ('${TEST_UID}', 'main-cal-001', '20260101T000000Z', '20260201T100000Z', '20260201T120000Z', 'Original Title', 'CONFIRMED')`,
		).run();
	});

	it('returns 400 when summary is missing', async () => {
		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'update',
			uid: TEST_UID,
			dtstart: '2026-03-01T10:00',
		});
		expect(res.status).toBe(400);
	});

	it('returns 400 for invalid status', async () => {
		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'update',
			uid: TEST_UID,
			summary: 'Updated',
			dtstart: '2026-03-01T10:00',
			status: 'INVALID_STATUS',
		});
		expect(res.status).toBe(400);
	});

	it('updates event and increments sequence', async () => {
		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'update',
			uid: TEST_UID,
			summary: 'Updated Title',
			dtstart: '2026-03-01T10:00',
			status: 'TENTATIVE',
		});
		expect(res.status).toBe(200);

		const row = await env.DB.prepare(`SELECT summary, status, sequence FROM events WHERE uid = '${TEST_UID}'`).first<{
			summary: string;
			status: string;
			sequence: number;
		}>();
		expect(row?.summary).toBe('Updated Title');
		expect(row?.status).toBe('TENTATIVE');
		expect(row?.sequence).toBe(1);
	});

	it('updates ALL editable fields: categories, class, url, organizer', async () => {
		// Seed event with initial values for the four fields under test.
		const uid = 'event-update-fields-test';
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, class, categories, url)
				 VALUES (?, 'main-cal-001', '20260524T120000Z', '20260601T100000Z', 'Initial', 'CONFIRMED', 'PUBLIC', 'OLD_CAT', 'https://old.example')`,
		)
			.bind(uid)
			.run();

		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'update',
			uid,
			summary: 'Updated',
			dtstart: '2026-06-01T10:00',
			status: 'CONFIRMED',
			categories: 'NEW_CAT,LECTURE',
			class: 'PRIVATE',
			url: 'https://new.example',
			organizer_email: 'new@x.com',
		});
		expect(res.status).toBe(200);

		const row = await env.DB.prepare('SELECT * FROM events WHERE uid = ?').bind(uid).first<{
			summary: string;
			categories: string;
			class: string;
			url: string;
			organizer_name: string | null;
			organizer_email: string | null;
		}>();
		expect(row).toBeTruthy();
		expect(row?.summary).toBe('Updated');
		expect(row?.categories).toBe('NEW_CAT,LECTURE');
		expect(row?.class).toBe('PRIVATE');
		expect(row?.url).toBe('https://new.example');
		expect(row?.organizer_email).toBe('new@x.com');
		expect(row?.organizer_name).toBeNull();

		await env.DB.prepare('DELETE FROM events WHERE uid = ?').bind(uid).run();
	});
});

// ─── POST /admin — delete event ──────────────────────────────────────────────

describe('POST /admin — delete event', () => {
	const TEST_UID = 'evt-delete-test@ntuas.edu';

	beforeEach(async () => {
		await runSQL('DELETE FROM event_alarms; DELETE FROM event_attachments; DELETE FROM events; DELETE FROM admin_sessions;');
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status)
         VALUES ('${TEST_UID}', 'main-cal-001', '20260101T000000Z', '20260201T100000Z', 'To Delete', 'CONFIRMED')`,
		).run();
	});

	it('returns 401 on wrong password', async () => {
		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'delete',
			uid: TEST_UID,
			password: 'wrong-password',
		});
		expect(res.status).toBe(401);
	});

	it('deletes event on correct password', async () => {
		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'delete',
			uid: TEST_UID,
			password: ADMIN_PASS,
		});
		expect(res.status).toBe(200);

		const row = await env.DB.prepare(`SELECT uid FROM events WHERE uid = '${TEST_UID}'`).first();
		expect(row).toBeNull();
	});
});

// ─── Input validation edge cases ─────────────────────────────────────────────

describe('POST /admin — input validation edge cases', () => {
	beforeEach(async () => {
		await runSQL('DELETE FROM event_alarms; DELETE FROM event_attachments; DELETE FROM events; DELETE FROM admin_sessions;');
	});

	it('returns 400 when description exceeds 5000 chars', async () => {
		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'add',
			summary: 'Test',
			dtstart: '2026-03-01T10:00',
			description: 'x'.repeat(5001),
		});
		expect(res.status).toBe(400);
		const data = (await res.json()) as { error: string };
		expect(data.error).toContain('5000');
	});

	it('returns 400 when location exceeds 500 chars', async () => {
		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'add',
			summary: 'Test',
			dtstart: '2026-03-01T10:00',
			location: 'x'.repeat(501),
		});
		expect(res.status).toBe(400);
		const data = (await res.json()) as { error: string };
		expect(data.error).toContain('500');
	});

	it('returns 400 when update location exceeds 500 chars', async () => {
		const uid = 'evt-validation@ntuas.edu';
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status) VALUES ('${uid}', 'main-cal-001', '20260101T000000Z', '20260201T100000Z', 'Original', 'CONFIRMED')`,
		).run();
		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'update',
			uid,
			summary: 'Updated',
			dtstart: '2026-03-01T10:00',
			location: 'x'.repeat(501),
		});
		expect(res.status).toBe(400);
	});
});
