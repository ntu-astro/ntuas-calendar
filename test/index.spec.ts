import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import worker from '../src';

const BASE = 'http://localhost';
const ADMIN_PASS = 'test-password-123';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY,
  prodid TEXT NOT NULL DEFAULT '-//NTUAS//MyCalendar//EN',
  version TEXT NOT NULL DEFAULT '2.0',
  calscale TEXT DEFAULT 'GREGORIAN',
  x_wr_calname TEXT,
  x_wr_timezone TEXT
);
CREATE TABLE IF NOT EXISTS events (
  uid TEXT PRIMARY KEY,
  calendar_id TEXT NOT NULL,
  dtstamp TEXT NOT NULL,
  dtstart TEXT NOT NULL,
  dtend TEXT,
  duration TEXT,
  transp TEXT DEFAULT 'OPAQUE',
  summary TEXT,
  description TEXT,
  location TEXT,
  geo TEXT,
  categories TEXT,
  class TEXT DEFAULT 'PUBLIC',
  status TEXT DEFAULT 'CONFIRMED',
  url TEXT,
  organizer TEXT,
  sequence INTEGER DEFAULT 0,
  created TEXT,
  last_modified TEXT,
  FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS event_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_uid TEXT NOT NULL,
  uri TEXT,
  binary_data BLOB,
  fmttype TEXT,
  FOREIGN KEY (event_uid) REFERENCES events(uid) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS event_alarms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_uid TEXT NOT NULL,
  action TEXT DEFAULT 'DISPLAY',
  trigger TEXT NOT NULL,
  description TEXT,
  summary TEXT,
  duration TEXT,
  repeat INTEGER,
  FOREIGN KEY (event_uid) REFERENCES events(uid) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  csrf_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  attempted_at TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0
);
`;

// Run one or more semicolon-separated SQL statements against the test D1 binding
async function runSQL(sql: string): Promise<void> {
	const stmts = sql
		.split(';')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	for (const stmt of stmts) {
		await env.DB.prepare(stmt).run();
	}
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function req(url: string, init?: RequestInit): Promise<Response> {
	const request = new Request(url, init);
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

async function login(): Promise<{ cookie: string; csrfToken: string }> {
	await runSQL('DELETE FROM login_attempts;');
	const body = new FormData();
	body.append('password', ADMIN_PASS);
	const res = await req(`${BASE}/admin/login`, { method: 'POST', body });
	const setCookie = res.headers.get('Set-Cookie') ?? '';
	const token = setCookie.match(/admin_session=([^;]+)/)?.[1] ?? '';

	const adminRes = await req(`${BASE}/admin`, {
		headers: { Cookie: `admin_session=${token}` },
	});
	const html = await adminRes.text();
	const csrfToken = html.match(/name="csrf-token" content="([^"]+)"/)?.[1] ?? '';

	return { cookie: `admin_session=${token}`, csrfToken };
}

async function adminPost(cookie: string, csrfToken: string, fields: Record<string, string>): Promise<Response> {
	const body = new FormData();
	body.append('_csrf', csrfToken);
	for (const [k, v] of Object.entries(fields)) body.append(k, v);
	return req(`${BASE}/admin`, { method: 'POST', headers: { Cookie: cookie }, body });
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
	await runSQL(SCHEMA_SQL);
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

		const res = await req(`${BASE}/api/events`);
		const data = (await res.json()) as { summary: string }[];
		expect(data).toHaveLength(1);
		expect(data[0].summary).toBe('Test Event');
	});
});

// ─── POST /admin/login ───────────────────────────────────────────────────────

describe('POST /admin/login', () => {
	beforeEach(async () => {
		await runSQL('DELETE FROM admin_sessions; DELETE FROM login_attempts;');
	});

	it('returns 200 with login form on wrong password', async () => {
		const body = new FormData();
		body.append('password', 'wrong-password');
		const res = await req(`${BASE}/admin/login`, { method: 'POST', body });
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('<form');
	});

	it('redirects to /admin on correct password with secure cookie', async () => {
		const body = new FormData();
		body.append('password', ADMIN_PASS);
		const res = await req(`${BASE}/admin/login`, { method: 'POST', body });
		expect(res.status).toBe(302);
		expect(res.headers.get('Location')).toBe('/admin');
		const cookie = res.headers.get('Set-Cookie') ?? '';
		expect(cookie).toContain('admin_session=');
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('Secure');
		expect(cookie).toContain('SameSite=Strict');
	});

	it('returns 429 after 5 failed login attempts', async () => {
		const wrongBody = () => {
			const f = new FormData();
			f.append('password', 'wrong');
			return f;
		};
		for (let i = 0; i < 5; i++) {
			await req(`${BASE}/admin/login`, { method: 'POST', body: wrongBody() });
		}
		const res = await req(`${BASE}/admin/login`, { method: 'POST', body: wrongBody() });
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toBe('600');
	});
});

// ─── GET /admin ──────────────────────────────────────────────────────────────

describe('GET /admin', () => {
	beforeEach(async () => {
		await runSQL('DELETE FROM admin_sessions;');
	});

	it('shows login form when unauthenticated', async () => {
		const res = await req(`${BASE}/admin`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('<form');
		expect(html).toContain('password');
	});

	it('shows admin dashboard when authenticated', async () => {
		const { cookie } = await login();
		const res = await req(`${BASE}/admin`, { headers: { Cookie: cookie } });
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('Admin Dashboard');
	});

	it('has security headers', async () => {
		const res = await req(`${BASE}/admin`);
		expect(res.headers.get('X-Frame-Options')).toBe('DENY');
		expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(res.headers.get('Content-Security-Policy')).toBeTruthy();
	});
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
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, class, categories, url, organizer)
				 VALUES (?, 'main-cal-001', '20260524T120000Z', '20260601T100000Z', 'Initial', 'CONFIRMED', 'PUBLIC', 'OLD_CAT', 'https://old.example', 'mailto:old@x.com')`,
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
			organizer: string;
		}>();
		expect(row).toBeTruthy();
		expect(row?.summary).toBe('Updated');
		expect(row?.categories).toBe('NEW_CAT,LECTURE');
		expect(row?.class).toBe('PRIVATE');
		expect(row?.url).toBe('https://new.example');
		expect(row?.organizer).toBe(':mailto:new@x.com');

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

// ─── POST /admin/logout ──────────────────────────────────────────────────────

describe('POST /admin/logout', () => {
	beforeEach(async () => {
		await runSQL('DELETE FROM admin_sessions;');
	});

	it('returns 403 without CSRF token', async () => {
		const { cookie } = await login();
		const body = new FormData();
		const res = await req(`${BASE}/admin/logout`, {
			method: 'POST',
			headers: { Cookie: cookie },
			body,
		});
		expect(res.status).toBe(403);
	});

	it('redirects and clears session cookie on valid logout', async () => {
		const { cookie, csrfToken } = await login();
		const body = new FormData();
		body.append('_csrf', csrfToken);
		const res = await req(`${BASE}/admin/logout`, {
			method: 'POST',
			headers: { Cookie: cookie },
			body,
		});
		expect(res.status).toBe(302);
		expect(res.headers.get('Location')).toBe('/admin');
		expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
	});
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

		const res = await req(`${BASE}/subscribe`);
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

		const res = await req(`${BASE}/subscribe`);
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

		const res = await req(`${BASE}/subscribe`);
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

		const res = await req(`${BASE}/subscribe`);
		const body = await res.text();
		expect(body).toContain('DTSTART;VALUE=DATE:20260301');
		expect(body).toContain('DTEND;VALUE=DATE:20260302');
	});
});

// ─── GET /health ─────────────────────────────────────────────────────────────

describe('GET /health', () => {
	it('returns 200 with ok status', async () => {
		const res = await req(`${BASE}/health`);
		expect(res.status).toBe(200);
		const data = (await res.json()) as { status: string };
		expect(data.status).toBe('ok');
	});
});

// ─── HSTS header ─────────────────────────────────────────────────────────────

describe('HSTS header', () => {
	it('is present on admin responses', async () => {
		const res = await req(`${BASE}/admin`);
		const hsts = res.headers.get('Strict-Transport-Security');
		expect(hsts).toBeTruthy();
		expect(hsts).toContain('max-age=');
		expect(hsts).toContain('includeSubDomains');
	});

	it('is present on subscribe responses', async () => {
		const res = await req(`${BASE}/subscribe`);
		expect(res.headers.get('Strict-Transport-Security')).toBeTruthy();
	});
});

// ─── Session expiry ───────────────────────────────────────────────────────────

describe('Session expiry', () => {
	beforeEach(async () => {
		await runSQL('DELETE FROM admin_sessions;');
	});

	it('rejects an expired session and shows login form', async () => {
		// Insert an already-expired session directly into the DB
		const expiredToken = 'expired-token-12345';
		const past = new Date(Date.now() - 1000).toISOString();
		await env.DB.prepare('INSERT INTO admin_sessions (token, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?)')
			.bind(expiredToken, 'some-csrf', past, past)
			.run();

		const res = await req(`${BASE}/admin`, {
			headers: { Cookie: `admin_session=${expiredToken}` },
		});
		expect(res.status).toBe(200);
		const html = await res.text();
		// Should show login form, not admin dashboard
		expect(html).toContain('<form');
		expect(html).not.toContain('Admin Dashboard');
	});

	it('cleans up expired session from DB after rejection', async () => {
		const expiredToken = 'expired-cleanup-token';
		const past = new Date(Date.now() - 1000).toISOString();
		await env.DB.prepare('INSERT INTO admin_sessions (token, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?)')
			.bind(expiredToken, 'some-csrf', past, past)
			.run();

		await req(`${BASE}/admin`, {
			headers: { Cookie: `admin_session=${expiredToken}` },
		});

		const row = await env.DB.prepare('SELECT token FROM admin_sessions WHERE token = ?').bind(expiredToken).first();
		expect(row).toBeNull();
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

		const res = await req(`${BASE}/subscribe`);
		const body = await res.text();
		// Semicolons, commas, and backslashes must be escaped in ICS values
		expect(body).toContain('SUMMARY:Event\\; with\\, special\\\\chars');
	});

	it('escapes newlines in DESCRIPTION per RFC 5545', async () => {
		await env.DB.prepare(
			"INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, description, status) VALUES ('nl-evt@ntuas.edu', 'main-cal-001', '20260101T000000Z', '20260201T100000Z', 'NL Event', 'Line1\nLine2', 'CONFIRMED')",
		).run();

		const res = await req(`${BASE}/subscribe`);
		const body = await res.text();
		expect(body).toContain('DESCRIPTION:Line1\\nLine2');
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

// ─── 404 ─────────────────────────────────────────────────────────────────────

describe('Unknown routes', () => {
	it('returns 404 for unknown paths', async () => {
		const res = await req(`${BASE}/not-a-real-path`);
		expect(res.status).toBe(404);
	});

	it('has security headers on 404', async () => {
		const res = await req(`${BASE}/not-a-real-path`);
		expect(res.headers.get('X-Frame-Options')).toBe('DENY');
	});
});
