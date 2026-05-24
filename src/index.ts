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
} from './constants';

import type {
	Calendar,
	Event,
	EventAlarm,
	EventAttachment,
	LoginAttemptCount,
} from './types';

import {
	timingSafeCompare,
	createSession,
	validateSession,
	deleteSession,
	cleanExpiredSessions,
	getCookie,
} from './lib/auth';

import {
	fold,
	toIcsDate,
	toIcsDateOnly,
	sanitizeIcsValue,
	sanitizeIcsOrganizerName,
} from './lib/ics';

import { LOGIN_HTML } from './templates/login.html.ts';
import { ADMIN_HTML } from './templates/admin.html.ts';
import { handleHealth } from './routes/health.ts';
import { handleEvents } from './routes/events.ts';


export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		const healthRes = handleHealth(url);
		if (healthRes) return healthRes;

		const eventsRes = await handleEvents(url, request, env);
		if (eventsRes) return eventsRes;

		// ==========================================
		// 2. ADMIN LOGIN / LOGOUT
		// ==========================================
		if (url.pathname === '/admin/login' && request.method === 'POST') {
			const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';

			// Rate limiting: check failed attempts
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

			const passwordMatch = timingSafeCompare(password, env.ADMIN_PASSWORD);

			if (!passwordMatch) {
				await env.DB.prepare('INSERT INTO login_attempts (ip, attempted_at, success) VALUES (?, ?, 0)')
					.bind(clientIp, new Date().toISOString())
					.run();
				return new Response(LOGIN_HTML(true), { headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS } });
			}

			// Clean up old attempts and expired sessions
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

		if (url.pathname === '/admin/logout' && request.method === 'POST') {
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

		// ==========================================
		// 3. ADMIN DASHBOARD & API
		// ==========================================
		if (url.pathname === '/admin') {
			const sessionCookie = getCookie(request, 'admin_session');
			const { valid: isValidSession, csrfToken } = await validateSession(env.DB, sessionCookie);

			if (!isValidSession) {
				return new Response(LOGIN_HTML(false), { headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS } });
			}

			if (request.method === 'GET') {
				return new Response(ADMIN_HTML(csrfToken!), { headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY_HEADERS } });
			}

			if (request.method === 'POST') {
				try {
					const formData = await request.formData();

					// CSRF validation
					const submittedCsrf = formData.get('_csrf') as string;
					if (!submittedCsrf || submittedCsrf !== csrfToken) {
						return Response.json({ success: false, error: 'Invalid request. Please refresh and try again.' }, { status: 403 });
					}

					const action = formData.get('action');

					if (action === 'add') {
						const uid = `event-${crypto.randomUUID()}@ntuas.edu`;
						const nowIcs = toIcsDate(new Date().toISOString());
						const isAllDay = formData.get('is_all_day') === '1';

						let dtstart: string | null;
						let dtend: string | null;

						if (isAllDay) {
							dtstart = toIcsDateOnly(formData.get('dtstart') as string);
							dtend = toIcsDateOnly(formData.get('dtend') as string);
							// RFC 5545: if no end date, default to next day for a single all-day event
							if (dtstart && !dtend) {
								const d = new Date(formData.get('dtstart') as string);
								d.setUTCDate(d.getUTCDate() + 1);
								dtend = toIcsDateOnly(d.toISOString());
							}
						} else {
							dtstart = toIcsDate(formData.get('dtstart') as string);
							dtend = toIcsDate(formData.get('dtend') as string);
						}

						const summary = formData.get('summary') as string;

						// Input validation
						if (!summary || summary.trim().length === 0) {
							return Response.json({ success: false, error: 'Event title is required.' }, { status: 400 });
						}
						if (summary.length > MAX_SUMMARY_LENGTH) {
							return Response.json(
								{ success: false, error: `Event title must be ${MAX_SUMMARY_LENGTH} characters or less.` },
								{ status: 400 },
							);
						}
						if (!dtstart) {
							return Response.json({ success: false, error: 'Start date is required.' }, { status: 400 });
						}
						const description = formData.get('description') as string;
						const location = formData.get('location') as string;
						const transp = isAllDay ? 'TRANSPARENT' : (formData.get('transp') as string) || 'OPAQUE';
						const geo = formData.get('geo') as string;
						const categories = formData.get('categories') as string;
						const eventClass = (formData.get('class') as string) || 'PUBLIC';
						const status = (formData.get('status') as string) || 'CONFIRMED';
						const eventUrl = formData.get('url') as string;

						if (description && description.length > MAX_DESCRIPTION_LENGTH) {
							return Response.json(
								{ success: false, error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.` },
								{ status: 400 },
							);
						}
						if (location && location.length > MAX_LOCATION_LENGTH) {
							return Response.json(
								{ success: false, error: `Location must be ${MAX_LOCATION_LENGTH} characters or less.` },
								{ status: 400 },
							);
						}

						if (!(VALID_STATUSES as readonly string[]).includes(status)) {
							return Response.json({ success: false, error: 'Invalid status value.' }, { status: 400 });
						}

						// --- ORGANIZER FORMATTING (sanitized) ---
						const orgName = formData.get('organizer_name') as string;
						const orgEmail = formData.get('organizer_email') as string;

						// Email format validation
						if (orgEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orgEmail)) {
							return Response.json({ success: false, error: 'Invalid organizer email format.' }, { status: 400 });
						}
						let organizer = null;

						if (orgName && orgEmail) {
							organizer = `;CN=${sanitizeIcsOrganizerName(orgName)}:mailto:${orgEmail}`;
						} else if (orgEmail) {
							organizer = `mailto:${orgEmail}`;
						}

						await env.DB.prepare(
							`
              INSERT INTO events (
                uid, calendar_id, dtstamp, created, last_modified, dtstart, dtend, 
                summary, description, location, transp, geo, categories, class, status, url, organizer
              ) VALUES (?, 'main-cal-001', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
						)
							.bind(
								uid,
								nowIcs,
								nowIcs,
								nowIcs,
								dtstart,
								dtend,
								summary,
								description,
								location,
								transp,
								geo,
								categories,
								eventClass,
								status,
								eventUrl,
								organizer,
							)
							.run();

						const attachUri = formData.get('attach_uri') as string;
						if (attachUri) {
							await env.DB.prepare('INSERT INTO event_attachments (event_uid, uri, fmttype) VALUES (?, ?, ?)')
								.bind(uid, attachUri, (formData.get('attach_fmttype') as string) || null)
								.run();
						}

						const rawAlarmTrigger = formData.get('alarm_trigger') as string;
						if (rawAlarmTrigger) {
							const triggerMap: Record<string, string> = {
								'At time of event': '-PT0M',
								'5 minutes before': '-PT5M',
								'10 minutes before': '-PT10M',
								'15 minutes before': '-PT15M',
								'30 minutes before': '-PT30M',
								'1 hour before': '-PT1H',
								'2 hours before': '-PT2H',
								'1 day before': '-P1D',
								'2 days before': '-P2D',
								'1 week before': '-P1W',
							};
							const alarmTrigger = triggerMap[rawAlarmTrigger] || rawAlarmTrigger;

							await env.DB.prepare('INSERT INTO event_alarms (event_uid, action, trigger, description) VALUES (?, ?, ?, ?)')
								.bind(
									uid,
									(formData.get('alarm_action') as string) || 'DISPLAY',
									alarmTrigger,
									(formData.get('alarm_desc') as string) || 'Event Reminder',
								)
								.run();
						}
					} else if (action === 'update') {
						const uid = formData.get('uid') as string;
						const summary = formData.get('summary') as string;
						const isAllDay = formData.get('is_all_day') === '1';

						if (!summary || summary.trim().length === 0) {
							return Response.json({ success: false, error: 'Event title is required.' }, { status: 400 });
						}
						if (summary.length > MAX_SUMMARY_LENGTH) {
							return Response.json(
								{ success: false, error: `Event title must be ${MAX_SUMMARY_LENGTH} characters or less.` },
								{ status: 400 },
							);
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
							return Response.json(
								{ success: false, error: `Location must be ${MAX_LOCATION_LENGTH} characters or less.` },
								{ status: 400 },
							);
						}

						const description = (formData.get('description') as string) || null;
						if (description && description.length > MAX_DESCRIPTION_LENGTH) {
							return Response.json(
								{ success: false, error: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.` },
								{ status: 400 },
							);
						}

						const geo = (formData.get('geo') as string) || null;
						const transp = isAllDay ? 'TRANSPARENT' : (formData.get('transp') as string) || 'OPAQUE';
						const nowIcs = toIcsDate(new Date().toISOString());

						await env.DB.prepare(
							`
              UPDATE events
              SET summary = ?, dtstart = ?, dtend = ?, status = ?, location = ?, geo = ?, description = ?, transp = ?, last_modified = ?, sequence = sequence + 1
              WHERE uid = ?
            `,
						)
							.bind(summary, dtstart, dtend, status, location, geo, description, transp, nowIcs, uid)
							.run();
					} else if (action === 'delete') {
						const uid = formData.get('uid') as string;
						const password = formData.get('password') as string;
						if (!timingSafeCompare(password, env.ADMIN_PASSWORD)) {
							return Response.json({ success: false, error: 'Incorrect password for deletion.' }, { status: 401 });
						}
						await env.DB.prepare('DELETE FROM events WHERE uid = ?').bind(uid).run();
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
		}

		// ==========================================
		// 3. CALENDAR FEED (RFC 5545)
		// ==========================================
		if (url.pathname === '/subscribe' || url.pathname === '/calendar.ics') {
			const cal = await env.DB.prepare('SELECT * FROM calendars LIMIT 1').first<Calendar>();
			if (!cal) return new Response('Calendar not found', { status: 404 });

			const { results: events } = await env.DB.prepare('SELECT * FROM events WHERE calendar_id = ? ORDER BY dtstart ASC')
				.bind(cal.id)
				.all<Event>();
			const { results: alarms } = await env.DB.prepare(
				'SELECT ea.* FROM event_alarms ea INNER JOIN events e ON ea.event_uid = e.uid WHERE e.calendar_id = ?',
			)
				.bind(cal.id)
				.all<EventAlarm>();
			const { results: attachments } = await env.DB.prepare(
				'SELECT att.* FROM event_attachments att INNER JOIN events e ON att.event_uid = e.uid WHERE e.calendar_id = ?',
			)
				.bind(cal.id)
				.all<EventAttachment>();

			// Group alarms and attachments by event_uid for O(1) lookup
			const alarmsByEvent = new Map<string, typeof alarms>();
			for (const alarm of alarms) {
				const list = alarmsByEvent.get(alarm.event_uid) ?? [];
				list.push(alarm);
				alarmsByEvent.set(alarm.event_uid, list);
			}
			const attachmentsByEvent = new Map<string, typeof attachments>();
			for (const att of attachments) {
				const list = attachmentsByEvent.get(att.event_uid) ?? [];
				list.push(att);
				attachmentsByEvent.set(att.event_uid, list);
			}

			let icsLines = [
				'BEGIN:VCALENDAR',
				`VERSION:${cal.version || '2.0'}`,
				`PRODID:${cal.prodid}`,
				`CALSCALE:${cal.calscale || 'GREGORIAN'}`,
			];
			if (cal.x_wr_calname) icsLines.push(`X-WR-CALNAME:${cal.x_wr_calname}`);
			if (cal.x_wr_timezone) icsLines.push(`X-WR-TIMEZONE:${cal.x_wr_timezone}`);

			for (const event of events) {
				const isAllDay = event.dtstart && !event.dtstart.includes('T');
				icsLines.push('BEGIN:VEVENT', `UID:${event.uid}`, `DTSTAMP:${event.dtstamp}`);

				if (isAllDay) {
					icsLines.push(`DTSTART;VALUE=DATE:${event.dtstart}`);
					if (event.dtend) icsLines.push(`DTEND;VALUE=DATE:${event.dtend}`);
				} else {
					icsLines.push(`DTSTART:${event.dtstart}`);
					if (event.dtend) icsLines.push(`DTEND:${event.dtend}`);
				}
				if (event.duration) icsLines.push(`DURATION:${event.duration}`);
				if (event.created) icsLines.push(`CREATED:${event.created}`);
				if (event.last_modified) icsLines.push(`LAST-MODIFIED:${event.last_modified}`);
				if (event.summary) icsLines.push(`SUMMARY:${sanitizeIcsValue(event.summary)}`);
				if (event.description) icsLines.push(`DESCRIPTION:${sanitizeIcsValue(event.description)}`);
				if (event.location) icsLines.push(`LOCATION:${sanitizeIcsValue(event.location)}`);
				if (event.geo) icsLines.push(`GEO:${event.geo}`);
				if (event.categories) icsLines.push(`CATEGORIES:${sanitizeIcsValue(event.categories)}`);
				if (event.url) icsLines.push(`URL:${event.url}`);

				// --- ORGANIZER INJECTION ---
				if (event.organizer) icsLines.push(`ORGANIZER${event.organizer}`);

				icsLines.push(`CLASS:${event.class || 'PUBLIC'}`);
				icsLines.push(`STATUS:${event.status || 'CONFIRMED'}`);
				icsLines.push(`TRANSP:${event.transp || 'OPAQUE'}`);

				for (const att of attachmentsByEvent.get(event.uid) ?? []) {
					icsLines.push(`ATTACH${att.fmttype ? `;FMTTYPE=${att.fmttype}` : ''}:${att.uri}`);
				}

				for (const alarm of alarmsByEvent.get(event.uid) ?? []) {
					icsLines.push('BEGIN:VALARM', `ACTION:${alarm.action}`, `TRIGGER:${alarm.trigger}`);
					if (alarm.description) icsLines.push(`DESCRIPTION:${alarm.description}`);
					if (alarm.summary) icsLines.push(`SUMMARY:${alarm.summary}`);
					icsLines.push('END:VALARM');
				}

				icsLines.push('END:VEVENT');
			}

			icsLines.push('END:VCALENDAR');

			return new Response(icsLines.map(fold).join('\r\n') + '\r\n', {
				headers: {
					'Content-Type': 'text/calendar; charset=utf-8',
					'Content-Disposition': 'inline; filename="ntuas.ics"',
					'Cache-Control': 'public, max-age=3600',
					'Access-Control-Allow-Origin': '*',
					...SECURITY_HEADERS,
				},
			});
		}

		return new Response('404 - Endpoint not found.', { status: 404, headers: { ...SECURITY_HEADERS } });
	},
} satisfies ExportedHandler<Env>;

// ==========================================
// THE HTML DASHBOARD
// ==========================================



