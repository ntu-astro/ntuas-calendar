import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import worker from '../src';
import { applySchema } from './helpers/load-schema';

const BASE = 'http://localhost';
const ADMIN_PASS = 'test-password-123';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function runSQL(sql: string): Promise<void> {
	const stmts = sql
		.split(';')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	for (const stmt of stmts) {
		await env.DB.prepare(stmt).run();
	}
}

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

async function fetchIcs(): Promise<string> {
	const res = await req(`${BASE}/subscribe?from=2020-01-01&to=2030-12-31`);
	expect(res.status).toBe(200);
	return res.text();
}

interface JsonEvent {
	uid: string;
	summary: string | null;
	organizer: { name: string | null; email: string | null } | null;
}

async function fetchEventsJson(): Promise<JsonEvent[]> {
	const res = await req(`${BASE}/api/events?from=2020-01-01&to=2030-12-31`);
	expect(res.status).toBe(200);
	return (await res.json()) as JsonEvent[];
}

interface OrganizerRow {
	organizer: string | null;
	organizer_name: string | null;
	organizer_email: string | null;
}

async function readOrganizer(uid: string): Promise<OrganizerRow | null> {
	return env.DB.prepare('SELECT organizer, organizer_name, organizer_email FROM events WHERE uid = ?')
		.bind(uid)
		.first<OrganizerRow>();
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
	await applySchema(env.DB);
	await env.DB.prepare(
		"INSERT OR IGNORE INTO calendars (id, x_wr_calname, x_wr_timezone) VALUES ('main-cal-001', 'NTUAS Events', 'Asia/Singapore')",
	).run();
});

beforeEach(async () => {
	await runSQL('DELETE FROM event_alarms; DELETE FROM event_attachments; DELETE FROM events; DELETE FROM admin_sessions; DELETE FROM login_attempts;');
});

// ─── Add / Update writes split columns ─────────────────────────────────────

describe('admin add/update writes split organizer columns', () => {
	it('stores both organizer_name and organizer_email when both are provided', async () => {
		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'add',
			summary: 'Talk',
			dtstart: '2026-04-01T10:00',
			organizer_name: 'Prof Smith',
			organizer_email: 'smith@ntu.edu.sg',
		});
		expect(res.status).toBe(200);

		const row = await env.DB.prepare("SELECT organizer, organizer_name, organizer_email FROM events WHERE summary = 'Talk'").first<OrganizerRow>();
		expect(row).toBeTruthy();
		expect(row?.organizer).toBeNull(); // legacy column intentionally NULL for new rows
		expect(row?.organizer_name).toBe('Prof Smith');
		expect(row?.organizer_email).toBe('smith@ntu.edu.sg');
	});

	it('stores only organizer_email when no name is provided', async () => {
		const { cookie, csrfToken } = await login();
		await adminPost(cookie, csrfToken, {
			action: 'add',
			summary: 'EmailOnly',
			dtstart: '2026-04-01T10:00',
			organizer_email: 'lone@ntu.edu.sg',
		});

		const row = await env.DB.prepare("SELECT organizer, organizer_name, organizer_email FROM events WHERE summary = 'EmailOnly'").first<OrganizerRow>();
		expect(row?.organizer).toBeNull();
		expect(row?.organizer_name).toBeNull();
		expect(row?.organizer_email).toBe('lone@ntu.edu.sg');
	});

	it('stores all NULLs when no organizer info is provided', async () => {
		const { cookie, csrfToken } = await login();
		await adminPost(cookie, csrfToken, {
			action: 'add',
			summary: 'NoOrganizer',
			dtstart: '2026-04-01T10:00',
		});

		const row = await env.DB.prepare("SELECT organizer, organizer_name, organizer_email FROM events WHERE summary = 'NoOrganizer'").first<OrganizerRow>();
		expect(row?.organizer).toBeNull();
		expect(row?.organizer_name).toBeNull();
		expect(row?.organizer_email).toBeNull();
	});

	it('update clears the legacy organizer column and writes the new ones', async () => {
		const uid = 'event-legacy-update@ntuas.edu';
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, organizer)
			 VALUES (?, 'main-cal-001', '20260101T000000Z', '20260401T100000Z', 'Legacy', 'CONFIRMED', ':mailto:old@x.com')`,
		)
			.bind(uid)
			.run();

		const { cookie, csrfToken } = await login();
		const res = await adminPost(cookie, csrfToken, {
			action: 'update',
			uid,
			summary: 'Legacy',
			dtstart: '2026-04-01T10:00',
			organizer_name: 'New Name',
			organizer_email: 'new@x.com',
		});
		expect(res.status).toBe(200);

		const row = await readOrganizer(uid);
		expect(row?.organizer).toBeNull();
		expect(row?.organizer_name).toBe('New Name');
		expect(row?.organizer_email).toBe('new@x.com');
	});
});

// ─── ICS rendering ──────────────────────────────────────────────────────────

describe('ICS rendering of ORGANIZER', () => {
	it('emits ORGANIZER;CN=...:mailto:... when both name and email are present', async () => {
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, organizer_name, organizer_email)
			 VALUES ('e-full', 'main-cal-001', '20260101T000000Z', '20260601T100000Z', 'Full', 'CONFIRMED', 'NTUAS', 'sec@e.ntu.edu.sg')`,
		).run();

		const ics = await fetchIcs();
		expect(ics).toContain('ORGANIZER;CN=NTUAS:mailto:sec@e.ntu.edu.sg');
	});

	it('emits ORGANIZER:mailto:... when only email is present', async () => {
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, organizer_email)
			 VALUES ('e-email', 'main-cal-001', '20260101T000000Z', '20260601T100000Z', 'EmailOnly', 'CONFIRMED', 'sec@e.ntu.edu.sg')`,
		).run();

		const ics = await fetchIcs();
		expect(ics).toContain('ORGANIZER:mailto:sec@e.ntu.edu.sg');
		// Make sure we never emit the old prefix-doubled shape.
		expect(ics).not.toContain('ORGANIZER:mailto:sec@e.ntu.edu.sg:mailto:');
		expect(ics).not.toMatch(/ORGANIZER::/);
	});

	it('omits ORGANIZER entirely when no organizer info is present', async () => {
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status)
			 VALUES ('e-none', 'main-cal-001', '20260101T000000Z', '20260601T100000Z', 'NoOrganizer', 'CONFIRMED')`,
		).run();

		const ics = await fetchIcs();
		expect(ics).not.toContain('ORGANIZER');
	});

	it('sanitises CN of forbidden characters (colon, semicolon, newline)', async () => {
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, organizer_name, organizer_email)
			 VALUES ('e-dirty', 'main-cal-001', '20260101T000000Z', '20260601T100000Z', 'Dirty', 'CONFIRMED', 'Bad;Name:With\nStuff', 'who@x.com')`,
		).run();

		const ics = await fetchIcs();
		expect(ics).toContain('ORGANIZER;CN=BadNameWithStuff:mailto:who@x.com');
	});

	it('falls back to the legacy organizer column when split columns are NULL', async () => {
		// Defensive fallback path: a row that somehow still has the old prefix-shape
		// in `organizer` (e.g., a backfill missed it). The renderer should still
		// emit a well-formed line.
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, organizer)
			 VALUES ('e-legacy', 'main-cal-001', '20260101T000000Z', '20260601T100000Z', 'Legacy', 'CONFIRMED', ';CN=Legacy:mailto:legacy@x.com')`,
		).run();

		const ics = await fetchIcs();
		expect(ics).toContain('ORGANIZER;CN=Legacy:mailto:legacy@x.com');
	});
});

// ─── JSON /api/events shape ─────────────────────────────────────────────────

describe('GET /api/events organizer shape', () => {
	it('exposes organizer as an object with name + email when both are set', async () => {
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, organizer_name, organizer_email)
			 VALUES ('e-json-full', 'main-cal-001', '20260101T000000Z', '20260601T100000Z', 'JsonFull', 'CONFIRMED', 'NTUAS', 'sec@e.ntu.edu.sg')`,
		).run();

		const events = await fetchEventsJson();
		const ev = events.find((e) => e.uid === 'e-json-full');
		expect(ev).toBeTruthy();
		expect(ev?.organizer).toEqual({ name: 'NTUAS', email: 'sec@e.ntu.edu.sg' });
	});

	it('exposes organizer with name: null when only email is set', async () => {
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, organizer_email)
			 VALUES ('e-json-email', 'main-cal-001', '20260101T000000Z', '20260601T100000Z', 'JsonEmail', 'CONFIRMED', 'lone@x.com')`,
		).run();

		const events = await fetchEventsJson();
		const ev = events.find((e) => e.uid === 'e-json-email');
		expect(ev?.organizer).toEqual({ name: null, email: 'lone@x.com' });
	});

	it('exposes organizer: null when neither column is set', async () => {
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status)
			 VALUES ('e-json-none', 'main-cal-001', '20260101T000000Z', '20260601T100000Z', 'JsonNone', 'CONFIRMED')`,
		).run();

		const events = await fetchEventsJson();
		const ev = events.find((e) => e.uid === 'e-json-none');
		expect(ev?.organizer).toBeNull();
	});

	it('does NOT leak the legacy raw organizer string in the JSON payload', async () => {
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, organizer)
			 VALUES ('e-json-legacy', 'main-cal-001', '20260101T000000Z', '20260601T100000Z', 'JsonLegacy', 'CONFIRMED', ':mailto:legacy@x.com')`,
		).run();

		const events = await fetchEventsJson();
		const ev = events.find((e) => e.uid === 'e-json-legacy');
		expect(ev).toBeTruthy();
		// Pre-refactor this would have surfaced ':mailto:legacy@x.com'. Now the
		// raw prefix-shape value is dropped (split columns are NULL ⇒ organizer: null).
		expect(ev?.organizer).toBeNull();
		expect(JSON.stringify(ev)).not.toContain(':mailto:');
	});
});

// ─── Migration 0004 backfill behaviour ──────────────────────────────────────

describe('migration 0004 backfill on legacy rows', () => {
	// We can't easily re-run migration 0004 from inside the test because applySchema
	// already ran it, but we can re-execute the backfill UPDATE statements verbatim
	// against a freshly-inserted legacy row to assert the parse logic.
	const backfillCnName = `UPDATE events
		SET organizer_name = SUBSTR(organizer, 5, INSTR(organizer, ':mailto:') - 5),
		    organizer_email = SUBSTR(organizer, INSTR(organizer, ':mailto:') + 8)
		WHERE organizer LIKE ';CN=%:mailto:%'
		  AND organizer_name IS NULL
		  AND organizer_email IS NULL`;

	const backfillEmailOnly = `UPDATE events
		SET organizer_email = SUBSTR(organizer, 9)
		WHERE organizer LIKE ':mailto:%'
		  AND organizer_name IS NULL
		  AND organizer_email IS NULL`;

	it('parses ;CN=NAME:mailto:EMAIL into split columns', async () => {
		const uid = 'e-bf-name';
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, organizer)
			 VALUES (?, 'main-cal-001', '20260101T000000Z', '20260601T100000Z', 'BackfillName', 'CONFIRMED', ';CN=NTUAS:mailto:sec@e.ntu.edu.sg')`,
		)
			.bind(uid)
			.run();

		await env.DB.prepare(backfillCnName).run();

		const row = await readOrganizer(uid);
		expect(row?.organizer_name).toBe('NTUAS');
		expect(row?.organizer_email).toBe('sec@e.ntu.edu.sg');
	});

	it('parses :mailto:EMAIL (email-only) into organizer_email', async () => {
		const uid = 'e-bf-email';
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, organizer)
			 VALUES (?, 'main-cal-001', '20260101T000000Z', '20260601T100000Z', 'BackfillEmail', 'CONFIRMED', ':mailto:solo@x.com')`,
		)
			.bind(uid)
			.run();

		await env.DB.prepare(backfillEmailOnly).run();

		const row = await readOrganizer(uid);
		expect(row?.organizer_name).toBeNull();
		expect(row?.organizer_email).toBe('solo@x.com');
	});

	it('is idempotent — re-running backfill does not double-overwrite populated rows', async () => {
		const uid = 'e-bf-idem';
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, organizer, organizer_name, organizer_email)
			 VALUES (?, 'main-cal-001', '20260101T000000Z', '20260601T100000Z', 'BackfillIdem', 'CONFIRMED',
			         ';CN=KEEP:mailto:keep@x.com', 'AlreadySet', 'already@x.com')`,
		)
			.bind(uid)
			.run();

		await env.DB.prepare(backfillCnName).run();
		await env.DB.prepare(backfillEmailOnly).run();

		const row = await readOrganizer(uid);
		// Should not have been touched because organizer_name/email were already non-NULL.
		expect(row?.organizer_name).toBe('AlreadySet');
		expect(row?.organizer_email).toBe('already@x.com');
	});

	it('renders ICS correctly for a row that went through the backfill', async () => {
		const uid = 'e-bf-render';
		// Simulate the post-migration state: split columns populated, legacy column
		// still carrying the old shape.
		await env.DB.prepare(
			`INSERT INTO events (uid, calendar_id, dtstamp, dtstart, summary, status, organizer, organizer_name, organizer_email)
			 VALUES (?, 'main-cal-001', '20260101T000000Z', '20260601T100000Z', 'BackfillRender', 'CONFIRMED',
			         ';CN=NTUAS:mailto:sec@e.ntu.edu.sg', 'NTUAS', 'sec@e.ntu.edu.sg')`,
		)
			.bind(uid)
			.run();

		const ics = await fetchIcs();
		// New code path takes precedence; no double-emit of the line.
		const occurrences = ics.match(/ORGANIZER;CN=NTUAS:mailto:sec@e\.ntu\.edu\.sg/g)?.length ?? 0;
		expect(occurrences).toBe(1);
	});
});
