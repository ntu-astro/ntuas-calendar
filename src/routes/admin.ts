import { Env, SESSION_MAX_AGE_SECONDS, RATE_LIMIT_WINDOW_MS, MAX_LOGIN_ATTEMPTS, SECURITY_HEADERS } from '../constants';
import { timingSafeCompare, createSession, validateSession, deleteSession, cleanExpiredSessions, getCookie } from '../lib/auth';
import { toIcsDate } from '../lib/ics';
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
	if (!uid) {
		return Response.json({ success: false, error: 'uid is required for update.' }, { status: 400 });
	}

	const result = parseAndValidateEventInput(formData);
	if (!result.ok) {
		return Response.json(result.error.body, { status: result.error.status });
	}
	const i = result.input;
	const nowIcs = toIcsDate(new Date().toISOString());

	await env.DB.prepare(
		`UPDATE events
		 SET summary = ?, dtstart = ?, dtend = ?, status = ?, location = ?, geo = ?, description = ?,
		     transp = ?, categories = ?, class = ?, url = ?, organizer = ?,
		     last_modified = ?, sequence = sequence + 1
		 WHERE uid = ?`,
	)
		.bind(
			i.summary,
			i.dtstart,
			i.dtend,
			i.status,
			i.location,
			i.geo,
			i.description,
			i.transp,
			i.categories,
			i.class,
			i.url,
			i.organizer,
			nowIcs,
			uid,
		)
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
