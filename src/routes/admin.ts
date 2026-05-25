import {
	Env,
	SESSION_MAX_AGE_SECONDS,
	RATE_LIMIT_WINDOW_MS,
	MAX_LOGIN_ATTEMPTS,
	MAX_SUMMARY_LENGTH,
	MAX_DESCRIPTION_LENGTH,
	MAX_LOCATION_LENGTH,
	VALID_STATUSES,
	SECURITY_HEADERS,
} from '../constants';
import { timingSafeCompare, createSession, validateSession, deleteSession, cleanExpiredSessions, getCookie } from '../lib/auth';
import { toIcsDate, toIcsDateOnly } from '../lib/ics';
import { parseAndValidateEventInput } from '../lib/validation';
import { ADMIN_HTML } from '../templates/admin.html.ts';
import { LOGIN_HTML } from '../templates/login.html.ts';
import type { LoginAttemptCount } from '../types';

export async function handleAdmin(url: URL, request: Request, env: Env): Promise<Response | null> {
	// /admin/login (POST)
	if (url.pathname === '/admin/login' && request.method === 'POST') {
		return handleLogin(request, env);
	}

	// /admin/logout (POST)
	if (url.pathname === '/admin/logout' && request.method === 'POST') {
		return handleLogout(request, env);
	}

	// /admin (GET or POST)
	if (url.pathname === '/admin') {
		return handleAdminPage(request, env);
	}

	return null;
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
	const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';

	const recentFailures = await env.DB.prepare(
		'SELECT COUNT(*) as cnt FROM login_attempts WHERE ip = ? AND attempted_at > ? AND success = 0',
	)
		.bind(clientIp, new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString())
		.first<LoginAttemptCount>();

	if (recentFailures && recentFailures.cnt >= MAX_LOGIN_ATTEMPTS) {
		return new Response(JSON.stringify({ error: 'Too many failed attempts. Try again later.' }), {
			status: 429,
			headers: { 'Content-Type': 'application/json', 'Retry-After': '600' },
		});
	}

	const formData = await request.formData();
	const password = formData.get('password') as string;

	if (!timingSafeCompare(password, env.ADMIN_PASSWORD)) {
		await env.DB.prepare('INSERT INTO login_attempts (ip, attempted_at, success) VALUES (?, ?, 0)')
			.bind(clientIp, new Date().toISOString())
			.run();
		return new Response(LOGIN_HTML(true), {
			headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS },
		});
	}

	await env.DB.prepare('DELETE FROM login_attempts WHERE attempted_at < ?')
		.bind(new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString())
		.run();
	await cleanExpiredSessions(env.DB);

	const { token } = await createSession(env.DB);
	return new Response(null, {
		status: 302,
		headers: {
			Location: '/admin',
			'Set-Cookie': `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=${SESSION_MAX_AGE_SECONDS}`,
		},
	});
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
	const sessionCookie = getCookie(request, 'admin_session');
	const { csrfToken: logoutCsrf } = await validateSession(env.DB, sessionCookie);
	const logoutForm = await request.formData();
	const submittedLogoutCsrf = logoutForm.get('_csrf') as string;
	if (!submittedLogoutCsrf || submittedLogoutCsrf !== logoutCsrf) {
		return new Response('Forbidden', { status: 403 });
	}
	await deleteSession(env.DB, sessionCookie);
	return new Response(null, {
		status: 302,
		headers: {
			Location: '/admin',
			'Set-Cookie': `admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/admin; Max-Age=0`,
		},
	});
}

async function handleAdminPage(request: Request, env: Env): Promise<Response> {
	const sessionCookie = getCookie(request, 'admin_session');
	const { valid: isValidSession, csrfToken } = await validateSession(env.DB, sessionCookie);

	if (!isValidSession) {
		return new Response(LOGIN_HTML(false), {
			headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS },
		});
	}

	if (request.method === 'GET') {
		return new Response(ADMIN_HTML(csrfToken!), {
			headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS },
		});
	}

	if (request.method === 'POST') {
		return handleAdminMutation(request, env, csrfToken!);
	}

	return new Response('Method Not Allowed', { status: 405 });
}

async function handleAdminMutation(request: Request, env: Env, csrfToken: string): Promise<Response> {
	try {
		const formData = await request.formData();

		const submittedCsrf = formData.get('_csrf') as string;
		if (!submittedCsrf || submittedCsrf !== csrfToken) {
			return Response.json({ success: false, error: 'Invalid request. Please refresh and try again.' }, { status: 403 });
		}

		const action = formData.get('action');

		if (action === 'add') {
			const result = await addEvent(formData, env);
			if (result) return result;
		} else if (action === 'update') {
			const result = await updateEvent(formData, env);
			if (result) return result;
		} else if (action === 'delete') {
			const result = await deleteEvent(formData, env);
			if (result) return result;
		}

		const cache = caches.default;
		const origin = new URL(request.url).origin;
		await Promise.all([
			cache.delete(new Request(`${origin}/api/events`)),
			cache.delete(new Request(`${origin}/subscribe`)),
			cache.delete(new Request(`${origin}/calendar.ics`)),
		]);

		return Response.json({ success: true, message: 'Action completed successfully' });
	} catch (e: unknown) {
		console.error('Admin action failed:', e);
		return Response.json({ success: false, error: 'An error occurred. Please try again.' }, { status: 500 });
	}
}

async function addEvent(formData: FormData, env: Env): Promise<Response | null> {
	const result = parseAndValidateEventInput(formData);
	if (!result.ok) {
		return Response.json(result.error.body, { status: result.error.status });
	}
	const i = result.input;
	const uid = `event-${crypto.randomUUID()}@ntuas.edu`;
	const nowIcs = toIcsDate(new Date().toISOString());

	await env.DB.prepare(
		`INSERT INTO events (
				uid, calendar_id, dtstamp, created, last_modified, dtstart, dtend,
				summary, description, location, transp, geo, categories, class, status, url, organizer
			) VALUES (?, 'main-cal-001', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			uid,
			nowIcs,
			nowIcs,
			nowIcs,
			i.dtstart,
			i.dtend,
			i.summary,
			i.description,
			i.location,
			i.transp,
			i.geo,
			i.categories,
			i.class,
			i.status,
			i.url,
			i.organizer,
		)
		.run();

	if (i.attachUri) {
		await env.DB.prepare('INSERT INTO event_attachments (event_uid, uri, fmttype) VALUES (?, ?, ?)')
			.bind(uid, i.attachUri, i.attachFmttype)
			.run();
	}

	if (i.alarmTrigger) {
		await env.DB.prepare('INSERT INTO event_alarms (event_uid, action, trigger, description) VALUES (?, ?, ?, ?)')
			.bind(uid, i.alarmAction, i.alarmTrigger, i.alarmDescription)
			.run();
	}

	return null;
}

async function updateEvent(formData: FormData, env: Env): Promise<Response | null> {
	const uid = formData.get('uid') as string;
	const summary = formData.get('summary') as string;
	const isAllDay = formData.get('is_all_day') === '1';

	if (!summary || summary.trim().length === 0) {
		return Response.json({ success: false, error: 'Event title is required.' }, { status: 400 });
	}
	if (summary.length > MAX_SUMMARY_LENGTH) {
		return Response.json({ success: false, error: `Event title must be ${MAX_SUMMARY_LENGTH} characters or less.` }, { status: 400 });
	}

	let dtstart: string | null;
	let dtend: string | null;

	if (isAllDay) {
		dtstart = toIcsDateOnly(formData.get('dtstart') as string);
		dtend = toIcsDateOnly(formData.get('dtend') as string);
		if (dtstart && !dtend) {
			const d = new Date(formData.get('dtstart') as string);
			d.setUTCDate(d.getUTCDate() + 1);
			dtend = toIcsDateOnly(d.toISOString());
		}
	} else {
		dtstart = toIcsDate(formData.get('dtstart') as string);
		dtend = toIcsDate(formData.get('dtend') as string);
	}

	if (!dtstart) {
		return Response.json({ success: false, error: 'Start date is required.' }, { status: 400 });
	}

	const status = (formData.get('status') as string) || 'CONFIRMED';
	if (!(VALID_STATUSES as readonly string[]).includes(status)) {
		return Response.json({ success: false, error: 'Invalid status value.' }, { status: 400 });
	}

	const location = (formData.get('location') as string) || null;
	if (location && location.length > MAX_LOCATION_LENGTH) {
		return Response.json({ success: false, error: `Location must be ${MAX_LOCATION_LENGTH} characters or less.` }, { status: 400 });
	}

	const description = (formData.get('description') as string) || null;
	if (description && description.length > MAX_DESCRIPTION_LENGTH) {
		return Response.json({ success: false, error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.` }, { status: 400 });
	}

	const geo = (formData.get('geo') as string) || null;
	const transp = isAllDay ? 'TRANSPARENT' : (formData.get('transp') as string) || 'OPAQUE';
	const nowIcs = toIcsDate(new Date().toISOString());

	await env.DB.prepare(
		`UPDATE events
			SET summary = ?, dtstart = ?, dtend = ?, status = ?, location = ?, geo = ?, description = ?, transp = ?, last_modified = ?, sequence = sequence + 1
			WHERE uid = ?`,
	)
		.bind(summary, dtstart, dtend, status, location, geo, description, transp, nowIcs, uid)
		.run();

	return null;
}

async function deleteEvent(formData: FormData, env: Env): Promise<Response | null> {
	const uid = formData.get('uid') as string;
	const password = formData.get('password') as string;
	if (!timingSafeCompare(password, env.ADMIN_PASSWORD)) {
		return Response.json({ success: false, error: 'Incorrect password for deletion.' }, { status: 401 });
	}
	await env.DB.prepare('DELETE FROM events WHERE uid = ?').bind(uid).run();
	return null;
}
