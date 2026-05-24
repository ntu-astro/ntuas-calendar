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


export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// ==========================================
		// 0. HEALTH CHECK
		// ==========================================
		if (url.pathname === '/health') {
			return Response.json({ status: 'ok' });
		}

		// ==========================================
		// 1. API: FETCH EVENTS (JSON)
		// ==========================================
		if (url.pathname === '/api/events' && request.method === 'GET') {
			const { results: events } = await env.DB.prepare(
				'SELECT uid, summary, dtstart, dtend, status, location, geo, description, categories, url, organizer FROM events ORDER BY dtstart DESC',
			).all();
			return new Response(JSON.stringify(events), {
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'public, max-age=10, s-maxage=30',
					'Access-Control-Allow-Origin': '*',
				},
			});
		}

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
const ADMIN_HTML = (csrfToken: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="${csrfToken}">
  <title>NTUAS Calendar Management System</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      /* Notion blue primary (DESIGN.md link-blue token) */
      --color-primary: #0075de;
      --color-primary-pressed: #005bab;
      --on-primary: #ffffff;
      --link-blue: #0075de;
      --link-blue-pressed: #005bab;

      /* Surfaces */
      --color-canvas: #ffffff;
      --color-surface: #f6f5f4;
      --color-surface-soft: #fafaf9;
      --color-hairline: #e5e3df;
      --color-hairline-soft: #ede9e4;
      --color-hairline-strong: #c8c4be;

      /* Warm-charcoal text hierarchy */
      --color-ink: #1a1a1a;
      --color-charcoal: #37352f;
      --color-slate: #5d5b54;
      --color-steel: #787671;
      --color-stone: #a4a097;
      --color-muted: #bbb8b1;

      /* Card tints */
      --tint-lavender: #e6e0f5;
      --tint-rose: #fde0ec;
      --tint-mint: #d9f3e1;
      --tint-peach: #ffe8d4;

      /* Semantic */
      --color-success: #1aae39;
      --color-warning: #dd5b00;
      --color-error: #e03131;

      /* Legacy aliases */
      --bg-main: var(--color-canvas);
      --bg-sidebar: var(--color-surface);
      --bg-hover: #efedea;
      --text-primary: var(--color-charcoal);
      --text-secondary: var(--color-slate);
      --text-tertiary: var(--color-steel);
      --accent-blue: var(--link-blue);
      --accent-blue-hover: var(--link-blue-pressed);
      --accent-blue-light: var(--tint-lavender);
      --border: var(--color-hairline);
      --border-strong: var(--color-hairline-strong);
      --success: var(--color-success);
      --danger: var(--color-error);
      --danger-hover: #b71c1c;
      --danger-light: var(--tint-rose);
      --warning: var(--color-warning);

      /* Radius (DESIGN.md rounded.*) */
      --radius-xs: 4px;
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-full: 9999px;
    }

    * { box-sizing: border-box; }

    body {
      font-family: 'Notion Sans', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background-color: var(--color-surface);
      color: var(--color-charcoal);
      padding: 0;
      margin: 0;
      -webkit-font-smoothing: antialiased;
      line-height: 1.5;
      font-size: 14px;
    }

    .admin-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 24px;
      height: 48px;
      background: var(--bg-sidebar);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .admin-header h1 {
      font-size: 14px;
      font-weight: 600;
      margin: 0;
      color: var(--text-primary);
      letter-spacing: -0.01em;
    }

    .logout-link {
      color: var(--text-tertiary);
      font-size: 12px;
      font-weight: 500;
      text-decoration: none;
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      transition: all 0.15s;
    }

    .logout-link:hover {
      color: var(--text-secondary);
      background: var(--bg-hover);
    }

    .admin-body {
      max-width: 860px;
      margin: 0 auto;
      padding: 24px;
    }

    h2 {
      font-size: 16px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 16px;
      color: var(--text-primary);
    }

    /* DESIGN.md micro-uppercase */
    h3 {
      font-size: 11px;
      font-weight: 600;
      border-bottom: 1px solid var(--color-hairline);
      padding-bottom: 6px;
      margin-top: 20px;
      margin-bottom: 12px;
      color: var(--color-steel);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* DESIGN.md card-feature — 12px rounded canvas card */
    .panel {
      background: var(--color-canvas);
      padding: 24px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-hairline);
      margin-bottom: 20px;
    }

    form.add-form { display: flex; flex-direction: column; gap: 16px; }
    .row { display: grid; grid-template-columns: 1fr; gap: 16px; }
    .row-3 { display: grid; grid-template-columns: 1fr; gap: 16px; }

    @media (min-width: 600px) {
      .add-form .row { grid-template-columns: 1fr 1fr; }
      .add-form .row-3 { grid-template-columns: 1fr 1fr 1fr; }
      .modal form .row { grid-template-columns: 1fr !important; }
    }

    label {
      font-size: 12px;
      font-weight: 500;
      margin-bottom: 4px;
      color: var(--text-tertiary);
      display: block;
    }

    /* DESIGN.md text-input — 44px height, hairline-strong border */
    input, textarea, select {
      padding: 10px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-hairline-strong);
      background: var(--color-canvas);
      color: var(--color-ink);
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      font-family: inherit;
      font-size: 14px;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    /* text-input-focused — blue ring */
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(0, 117, 222, 0.18);
    }

    /* DESIGN.md button-primary — signature purple CTA */
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary);
      color: var(--on-primary);
      padding: 10px 18px;
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-weight: 500;
      font-size: 14px;
      line-height: 1.3;
      font-family: inherit;
      width: 100%;
      margin-top: 8px;
      transition: background 0.15s;
    }

    button:hover:not(:disabled) {
      background: var(--color-primary-pressed);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .event-card {
      display: flex;
      flex-direction: column;
      background: transparent;
      padding: 14px 0;
      margin-bottom: 0;
      border-bottom: 1px solid var(--border);
      gap: 10px;
    }

    .event-card:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    @media (min-width: 650px) {
      .event-card {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
      }
    }

    .event-info { flex-grow: 1; min-width: 0; }
    .event-info strong {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 2px;
      color: var(--text-primary);
    }

    .event-status {
      display: inline-block;
      padding: 2px 6px;
      background: var(--bg-sidebar);
      border-radius: var(--radius-sm);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      margin-left: 6px;
      vertical-align: middle;
      color: var(--text-secondary);
    }

    .event-card form {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;
    }

    /* DESIGN.md badge-tag-* style — soft tinted pill, strong tone for destructive intent */
    .btn-delete {
      background: var(--tint-rose);
      color: #a02e6d;
      padding: 8px 14px;
      width: auto;
      margin-top: 0;
      font-size: 13px;
      border-radius: var(--radius-md);
    }

    .btn-delete:hover:not(:disabled) {
      background: var(--color-error);
      color: var(--on-primary);
    }

    /* DESIGN.md button-secondary — outlined rectangular */
    .btn-edit {
      background: transparent;
      border: 1px solid var(--color-hairline-strong);
      color: var(--color-charcoal);
      padding: 8px 14px;
      width: auto;
      margin-top: 0;
      font-size: 13px;
      border-radius: var(--radius-md);
    }

    .btn-edit:hover:not(:disabled) {
      background: var(--color-surface);
      color: var(--color-ink);
      border-color: var(--color-hairline-strong);
    }

    .del-pass { width: 120px; padding: 6px 8px; font-size: 12px; }

    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.25);
      backdrop-filter: blur(2px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }

    .modal-overlay.open { display: flex; }

    /* DESIGN.md card-base, elevation 4 (modal shadow) */
    .modal {
      background: var(--color-canvas);
      border: 1px solid var(--color-hairline);
      border-radius: var(--radius-lg);
      padding: 28px;
      width: 90%;
      max-width: 520px;
      position: relative;
      box-shadow: rgba(15, 15, 15, 0.16) 0px 16px 48px -8px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal h2 { margin-top: 0; }

    .modal::-webkit-scrollbar { width: 6px; }
    .modal::-webkit-scrollbar-track { background: transparent; }
    .modal::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }
    .modal::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }

    .modal-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      color: var(--text-tertiary);
      font-size: 18px;
      cursor: pointer;
      width: auto;
      padding: 4px 8px;
      margin: 0;
    }

    .modal-close:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
      border-radius: var(--radius-sm);
    }

    .modal form { display: flex; flex-direction: column; gap: 16px; }

    .toggle-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 4px;
    }
    .toggle-row label.toggle-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0;
      cursor: pointer;
      user-select: none;
    }
    .toggle-switch {
      position: relative;
      width: 40px;
      height: 22px;
      flex-shrink: 0;
    }
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }
    .toggle-switch .slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      width: auto;
      height: auto;
      margin: 0;
      padding: 0;
      display: block;
      background: var(--border-strong);
      border-radius: 22px;
      transition: background 0.2s ease;
      font-size: 0;
      color: transparent;
    }
    .toggle-switch .slider::before {
      content: '';
      position: absolute;
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    }
    /* Toggle on = signature purple */
    .toggle-switch input:checked + .slider {
      background: var(--color-primary);
    }
    .toggle-switch input:checked + .slider::before {
      transform: translateX(18px);
    }
    /* Soft-blue tag — harmonizes with primary */
    .all-day-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #dcecfa;
      color: #003f7a;
      border-radius: var(--radius-sm);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      margin-left: 6px;
      vertical-align: middle;
    }
  </style>
</head>
<body>
  <div class="admin-header">
    <h1>Admin Dashboard</h1>
    <form method="POST" action="/admin/logout" style="display:inline">
      <input type="hidden" name="_csrf" value="${csrfToken}">
      <button type="submit" class="logout-link">Logout</button>
    </form>
  </div>
  <div class="admin-body">
  
  <div class="panel">
    <h2>Create Event</h2>
    <form class="add-form" id="eventForm">
      <input type="hidden" name="action" value="add">
      <input type="hidden" name="_csrf" value="${csrfToken}">
      
      <div class="row">
        <div><label>Event Title*</label><input type="text" name="summary" required></div>
      </div>

      <h3>Date &amp; Time</h3>
      <div class="toggle-row">
        <div class="toggle-switch">
          <input type="checkbox" id="allDayToggle">
          <label class="slider" for="allDayToggle"></label>
        </div>
        <label class="toggle-label" for="allDayToggle">All Day Event</label>
      </div>
      <input type="hidden" name="is_all_day" id="isAllDayInput" value="0">
      <div class="row">
        <div>
          <label id="startLabel">Start Date &amp; Time (Local)*</label>
          <input type="datetime-local" id="localStart" required>
          <input type="hidden" name="dtstart" id="isoStart">
        </div>
        <div>
          <label id="endLabel">End Date &amp; Time (Local)</label>
          <input type="datetime-local" id="localEnd">
          <input type="hidden" name="dtend" id="isoEnd">
        </div>
      </div>
      <div id="tzRow">
         <label>Timezone Override</label>
         <select id="tzSelect">
            <option value="+08:00" selected>Singapore Time (SGT / +08:00)</option>
            <option value="+00:00">Coordinated Universal Time (UTC)</option>
         </select>
      </div>

      <h3>Core Metadata</h3>
      <div class="row">
        <div>
          <label>Location (Search NTU Facilities)</label>
          <input list="ntu-venues" id="locationInput" name="location" placeholder="e.g. LKC-LT, TR+10...">
          <datalist id="ntu-venues"></datalist>
        </div>
        <div>
          <label>Geo (Lat;Lon)</label>
          <input type="text" id="geoInput" name="geo" placeholder="Auto-fills from location">
        </div>
      </div>
      
      <div class="row-3">
        <div>
          <label>Status</label>
          <select name="status">
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="TENTATIVE">TENTATIVE</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
        <div>
          <label>Transparency</label>
          <select name="transp">
            <option value="OPAQUE">OPAQUE (Busy)</option>
            <option value="TRANSPARENT">TRANSPARENT (Free)</option>
          </select>
        </div>
        <div>
          <label>Class</label>
          <select name="class">
            <option value="PUBLIC">PUBLIC</option>
            <option value="PRIVATE">PRIVATE</option>
          </select>
        </div>
      </div>

      <div class="row">
        <div>
          <label>Categories</label>
          <input list="category-list" type="text" name="categories" placeholder="e.g. Club Events,Astronomical Events">
          <datalist id="category-list">
            <option value="Club Events">
            <option value="Astronomical Events">
          </datalist>
        </div>
        <div><label>URL / Web Link</label><input type="url" name="url" placeholder="https://..."></div>
      </div>
      
      <div class="row">
        <div>
          <label>Organizer Name</label>
          <input list="organizer-list" type="text" name="organizer_name" placeholder="e.g. NTUAS">
          <datalist id="organizer-list">
            <option value="NTUAS">
          </datalist>
        </div>
        <div>
          <label>Organizer Email</label>
          <input list="organizer-email-list" type="email" name="organizer_email" placeholder="e.g. ntuas-secretary@e.ntu.edu.sg">
          <datalist id="organizer-email-list">
            <option value="ntuas-secretary@e.ntu.edu.sg">
          </datalist>
        </div>
      </div>

      <div>
        <label>Description</label>
        <textarea name="description" rows="3"></textarea>
      </div>

      <h3>Alarms &amp; Attachments (Optional)</h3>
      <div class="row">
        <div>
          <label>Alarm Trigger</label>
          <input list="alarm-trigger-list" type="text" name="alarm_trigger" placeholder="e.g. 15 minutes before">
          <datalist id="alarm-trigger-list">
            <option value="At time of event">
            <option value="5 minutes before">
            <option value="10 minutes before">
            <option value="15 minutes before">
            <option value="30 minutes before">
            <option value="1 hour before">
            <option value="2 hours before">
            <option value="1 day before">
            <option value="2 days before">
            <option value="1 week before">
          </datalist>
        </div>
        <div>
          <label>Alarm Action</label>
          <select name="alarm_action">
            <option value="DISPLAY">DISPLAY</option>
            <option value="AUDIO">AUDIO</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div><label>Attachment URI</label><input type="text" name="attach_uri" placeholder="https://..."></div>
        <div><label>Attachment Format Type</label><input type="text" name="attach_fmttype" placeholder="application/pdf"></div>
      </div>

      <button type="submit" id="submitBtn">Publish to Calendar Feed</button>
    </form>
  </div>

  <div class="panel">
    <h2>Active Events Feed</h2>
    <div id="events-container"><p>Loading events...</p></div>
  </div>

  </div>

  <div class="modal-overlay" id="editModal">
    <div class="modal">
      <button class="modal-close" onclick="closeEditModal()">&times;</button>
      <h2>Edit Event</h2>
      <form id="editForm" onsubmit="handleEdit(event)">
        <input type="hidden" name="action" value="update">
        <input type="hidden" name="_csrf" value="${csrfToken}">
        <input type="hidden" name="uid" id="edit-uid">
        <div>
          <label>Event Title (Summary)*</label>
          <input type="text" name="summary" id="edit-summary" required>
        </div>
        <div class="toggle-row">
          <div class="toggle-switch">
            <input type="checkbox" id="editAllDayToggle">
            <label class="slider" for="editAllDayToggle"></label>
          </div>
          <label class="toggle-label" for="editAllDayToggle">All Day Event</label>
        </div>
        <input type="hidden" name="is_all_day" id="editIsAllDayInput" value="0">
        <div class="row">
          <div>
            <label id="editStartLabel">Start Date &amp; Time*</label>
            <input type="datetime-local" id="edit-local-start" required>
            <input type="hidden" name="dtstart" id="edit-iso-start">
          </div>
          <div>
            <label id="editEndLabel">End Date &amp; Time</label>
            <input type="datetime-local" id="edit-local-end">
            <input type="hidden" name="dtend" id="edit-iso-end">
          </div>
        </div>

        <div id="editTzRow">
          <label>Timezone Override</label>
          <select id="editTzSelect">
            <option value="+08:00" selected>Singapore Time (SGT / +08:00)</option>
            <option value="+00:00">Coordinated Universal Time (UTC)</option>
          </select>
        </div>

        <div>
          <label>Status</label>
          <select name="status" id="edit-status">
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="TENTATIVE">TENTATIVE</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div id="edit-more-details" style="display: none; border-top: 1px solid var(--border); padding-top: 12px; margin-top: 4px;">
          <div class="row">
            <div>
              <label>Location</label>
              <input list="ntu-venues" name="location" id="edit-location" placeholder="e.g. LKC-LT...">
            </div>
            <div>
              <label>Geo (Lat;Lon)</label>
              <input type="text" name="geo" id="edit-geo" placeholder="Auto-fills from location">
            </div>
          </div>
          <div style="margin-top: 16px;">
            <label>Description</label>
            <textarea name="description" id="edit-description" rows="3"></textarea>
          </div>
        </div>

        <button type="button" id="editMoreBtn" onclick="toggleMoreDetails()" style="background: transparent; border: 1px solid var(--border-strong); color: var(--text-secondary); margin-top: 0;">Show More Details</button>
        <button type="submit" id="editSubmitBtn">Save Changes</button>
      </form>
    </div>
  </div>

  <script>
    const CSRF_TOKEN = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    const COORDS = { NORTH_SPINE: "1.3473;103.6803", SOUTH_SPINE: "1.3428;103.6824", THE_HIVE: "1.3436;103.6823", THE_ARC: "1.3475777755020193;103.6816184760447", WKWSCI: "1.3438;103.6818", EMB: "1.3446803707174764;103.67849230240778" };
    const venues = [
        { name: "LT1 (Von Lee Yong Miang) - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "TCT-LT (LT2) - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT3 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT4 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT5 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT6 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT7 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT8 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT9 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT10 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT11 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT12 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT13 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT14 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT15 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT16 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT17 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT18 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT19 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT19A - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT1A - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT20 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT2A - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LHSLT- - The Hive", geo: COORDS.THE_HIVE },
        { name: "LT22 - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "LT23 - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "LT24 - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "LT25 - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "LT26 - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "LT27 - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "LT28 - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "LT29 - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "LKC-LT (Lee Kong Chian) - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "LF-LT (Lee Foundation) - WKWSCI", geo: COORDS.WKWSCI },
        { name: "LHNLT- - The Arc", geo: COORDS.THE_ARC }, { name: "RECEP RM - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "FOYER - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "EXHIB GALY - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "FN RM - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "S3.2 ESR4 - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "S3.2 ESR3 - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "TRX122 - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "ICC-LAB1 ICC CoILAB 1 - Experimental Medicine Building", geo: COORDS.EMB }, { name: "ICC-LAB2 ICC CoILAB 2 - Experimental Medicine Building", geo: COORDS.EMB },
        { name: "TRX43 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "TRX44 - North Spine", geo: COORDS.NORTH_SPINE }
    ];
    [1,2,3,4,5,6,7,8,9,15,16,17,18,19,20,21,22,23,29,30,31,32,33,34,35,36,37].forEach(n => venues.push({ name: \`TR+\${n} - North Spine\`, geo: COORDS.NORTH_SPINE }));
    [7,8,9].forEach(n => venues.push({ name: \`CS-TR+\${n} - WKWSCI\`, geo: COORDS.WKWSCI }));
    [61,62,63,64,65,66,67,68,69,77,78,79,80,87,88,89,90,91,92,93,94,95,96,102,103,106,107,108,109,110,111,112,113,114,120,121,151,152,153,154,159,160,165,166].forEach(n => venues.push({ name: \`TR+\${n} - South Spine\`, geo: COORDS.SOUTH_SPINE }));
    for(let i=1;i<=56;i++) venues.push({ name: \`LHS-TR+\${i} - The Hive\`, geo: COORDS.THE_HIVE });
    for(let i=1;i<=56;i++) venues.push({ name: \`LHN-TR+\${i<10?'0'+i:i} - The Arc\`, geo: COORDS.THE_ARC });

    function initVenues() {
        const list = document.getElementById('ntu-venues');
        venues.forEach(v => { const opt = document.createElement('option'); opt.value = v.name; list.appendChild(opt); });
        document.getElementById('locationInput').addEventListener('input', (e) => {
            const match = venues.find(v => v.name === e.target.value);
            if (match) document.getElementById('geoInput').value = match.geo;
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    }

    let allEvents = [];
    let currentPage = 1;
    const EVENTS_PER_PAGE = 10;

    async function loadEvents() {
        try {
            const res = await fetch('/api/events?_t=' + Date.now());
            allEvents = await res.json();
            currentPage = 1;
            renderEventsPage();
        } catch (err) { document.getElementById('events-container').textContent = 'Error loading events.'; }
    }

    function renderEventsPage() {
        const container = document.getElementById('events-container');
        if (allEvents.length === 0) return container.innerHTML = '<p>No events scheduled.</p>';

        const totalPages = Math.ceil(allEvents.length / EVENTS_PER_PAGE);
        const startIndex = (currentPage - 1) * EVENTS_PER_PAGE;
        const endIndex = startIndex + EVENTS_PER_PAGE;
        const pageEvents = allEvents.slice(startIndex, endIndex);

        const html = pageEvents.map(e => {
            const isAllDay = e.dtstart && !e.dtstart.includes('T');
            let displayDate;
            if (isAllDay) {
                const y = e.dtstart.slice(0,4), m = e.dtstart.slice(4,6), d = e.dtstart.slice(6,8);
                displayDate = new Date(y + '-' + m + '-' + d + 'T00:00:00+08:00').toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', year: 'numeric', month: 'long', day: 'numeric' });
            } else {
                const dt = e.dtstart.replace(/(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
                displayDate = new Date(dt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
            }
            return \`
                  <div class="event-card">
                    <div class="event-info">
                      <strong>\${escapeHtml(e.summary)}</strong> <span class="event-status">\${escapeHtml(e.status)}</span>\${isAllDay ? '<span class="all-day-badge">ALL DAY</span>' : ''}<br>
                      <small style="color: var(--text-tertiary); display: block; margin-top: 2px; font-size: 12px;">\${isAllDay ? '' : 'Starts: '}\${escapeHtml(displayDate)}</small>
                    </div>
                    <button class="btn-edit"
                      data-uid="\${escapeHtml(e.uid)}"
                      data-summary="\${escapeHtml(e.summary)}"
                      data-dtstart="\${escapeHtml(e.dtstart)}"
                      data-dtend="\${escapeHtml(e.dtend)}"
                      data-status="\${escapeHtml(e.status)}"
                      data-location="\${escapeHtml(e.location)}"
                      data-geo="\${escapeHtml(e.geo)}"
                      data-description="\${escapeHtml(e.description)}"
                    >Edit</button>
                    <form class="form-delete" data-uid="\${escapeHtml(e.uid)}">
                      <input type="password" placeholder="Password" required class="del-pass">
                      <button type="submit" class="btn-delete">Delete</button>
                    </form>
                  </div>\`;
        }).join('');

        const paginationHtml = totalPages > 1 ? \`
          <div class="pagination-controls" style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
            <button onclick="changePage(-1)" \${currentPage === 1 ? 'disabled' : ''} style="width: auto; margin-top: 0; background: transparent; border: 1px solid var(--border-strong); color: \${currentPage === 1 ? 'var(--border-strong)' : 'var(--text-secondary)'}; padding: 6px 12px; font-size: 12px;">\u2039 Previous</button>
            <span style="color: var(--text-tertiary); font-size: 12px; font-weight: 500;">Page \${currentPage} of \${totalPages}</span>
            <button onclick="changePage(1)" \${currentPage === totalPages ? 'disabled' : ''} style="width: auto; margin-top: 0; background: transparent; border: 1px solid var(--border-strong); color: \${currentPage === totalPages ? 'var(--border-strong)' : 'var(--text-secondary)'}; padding: 6px 12px; font-size: 12px;">Next \u203a</button>
          </div>
        \` : '';

        container.innerHTML = html + paginationHtml;

        // Attach edit button handlers
        container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                openEditModal(
                  btn.dataset.uid, 
                  btn.dataset.summary, 
                  btn.dataset.dtstart, 
                  btn.dataset.dtend, 
                  btn.dataset.status,
                  btn.dataset.location,
                  btn.dataset.geo,
                  btn.dataset.description
                );
            });
        });

        container.querySelectorAll('.form-delete').forEach(form => {
            form.addEventListener('submit', (e) => {
                handleDelete(e, form.dataset.uid);
            });
        });
    }

    window.changePage = function(delta) {
        currentPage += delta;
        renderEventsPage();
    };

    // --- All-Day Toggle Logic (Create form) ---
    document.getElementById('allDayToggle').addEventListener('change', function() {
        const isAllDay = this.checked;
        document.getElementById('isAllDayInput').value = isAllDay ? '1' : '0';
        const startInput = document.getElementById('localStart');
        const endInput = document.getElementById('localEnd');
        document.getElementById('startLabel').textContent = isAllDay ? 'Start Date*' : 'Start Date & Time (Local)*';
        document.getElementById('endLabel').textContent = isAllDay ? 'End Date' : 'End Date & Time (Local)';
        startInput.type = isAllDay ? 'date' : 'datetime-local';
        endInput.type = isAllDay ? 'date' : 'datetime-local';
        document.getElementById('tzRow').style.display = isAllDay ? 'none' : '';
        startInput.value = '';
        endInput.value = '';
    });

    // --- All-Day Toggle Logic (Edit modal) ---
    document.getElementById('editAllDayToggle').addEventListener('change', function() {
        const isAllDay = this.checked;
        document.getElementById('editIsAllDayInput').value = isAllDay ? '1' : '0';
        const startInput = document.getElementById('edit-local-start');
        const endInput = document.getElementById('edit-local-end');
        document.getElementById('editStartLabel').textContent = isAllDay ? 'Start Date*' : 'Start Date & Time*';
        document.getElementById('editEndLabel').textContent = isAllDay ? 'End Date' : 'End Date & Time';
        startInput.type = isAllDay ? 'date' : 'datetime-local';
        endInput.type = isAllDay ? 'date' : 'datetime-local';
        document.getElementById('editTzRow').style.display = isAllDay ? 'none' : '';
        startInput.value = '';
        endInput.value = '';
    });

    document.getElementById('eventForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const btn = document.getElementById('submitBtn');
        btn.innerText = "Publishing..."; btn.disabled = true;

        const isAllDay = document.getElementById('allDayToggle').checked;
        const start = document.getElementById('localStart').value;
        const end = document.getElementById('localEnd').value;

        if (isAllDay) {
            // For all-day, send date as-is (YYYY-MM-DD)
            if(start) document.getElementById('isoStart').value = start;
            if(end) document.getElementById('isoEnd').value = end;
        } else {
            const tz = document.getElementById('tzSelect').value;
            if(start) document.getElementById('isoStart').value = start + tz;
            if(end) document.getElementById('isoEnd').value = end + tz;
        }

        try {
            const res = await fetch('/admin', { method: 'POST', body: new FormData(form) });
            const data = await res.json();
            if (!data.success) alert("Error: " + data.error);
            else { alert("Success!"); form.reset(); document.getElementById('allDayToggle').checked = false; document.getElementById('isAllDayInput').value = '0'; document.getElementById('localStart').type = 'datetime-local'; document.getElementById('localEnd').type = 'datetime-local'; document.getElementById('tzRow').style.display = ''; document.getElementById('startLabel').textContent = 'Start Date & Time (Local)*'; document.getElementById('endLabel').textContent = 'End Date & Time (Local)'; loadEvents(); }
        } catch (err) { alert("Network Error"); } 
        finally { btn.innerText = "Publish to Calendar Feed"; btn.disabled = false; }
    });

    async function handleDelete(e, uid) {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector('button');
        btn.disabled = true;
        const formData = new FormData();
        formData.append("action", "delete");
        formData.append("_csrf", CSRF_TOKEN);
        formData.append("uid", uid);
        formData.append("password", form.querySelector('.del-pass').value);

        try {
            const res = await fetch('/admin', { method: 'POST', body: formData });
            const data = await res.json();
            if (!data.success) alert("Error: " + data.error);
            else loadEvents();
        } catch (err) { alert("Network Error"); }
        finally { btn.disabled = false; }
    }

    function openEditModal(uid, summary, dtstart, dtend, status, location, geo, description) {
        document.getElementById('edit-uid').value = uid;
        document.getElementById('edit-summary').value = summary;
        document.getElementById('edit-status').value = status;
        document.getElementById('edit-location').value = location || '';
        document.getElementById('edit-geo').value = geo || '';
        document.getElementById('edit-description').value = description || '';

        // Reset more details toggle
        document.getElementById('edit-more-details').style.display = 'none';
        document.getElementById('editMoreBtn').innerText = 'Show More Details';
        document.getElementById('editTzSelect').value = '+08:00';

        // Detect all-day: dtstart has no 'T'
        const isAllDay = dtstart && !dtstart.includes('T');
        document.getElementById('editAllDayToggle').checked = isAllDay;
        document.getElementById('editIsAllDayInput').value = isAllDay ? '1' : '0';
        const editStartInput = document.getElementById('edit-local-start');
        const editEndInput = document.getElementById('edit-local-end');
        editStartInput.type = isAllDay ? 'date' : 'datetime-local';
        editEndInput.type = isAllDay ? 'date' : 'datetime-local';
        document.getElementById('editStartLabel').textContent = isAllDay ? 'Start Date*' : 'Start Date & Time*';
        document.getElementById('editEndLabel').textContent = isAllDay ? 'End Date' : 'End Date & Time';
        document.getElementById('editTzRow').style.display = isAllDay ? 'none' : '';

        if (isAllDay) {
            // Convert YYYYMMDD to YYYY-MM-DD for date input
            function icsDateToInput(d) {
                if (!d) return '';
                return d.slice(0,4) + '-' + d.slice(4,6) + '-' + d.slice(6,8);
            }
            editStartInput.value = icsDateToInput(dtstart);
            editEndInput.value = icsDateToInput(dtend);
        } else {
            // Convert ICS date (e.g. 20260315T100000Z) to datetime-local format
            function icsToLocal(icsDate) {
                if (!icsDate) return '';
                const iso = icsDate.replace(/(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
                const d = new Date(iso);
                const offset = -480;
                const local = new Date(d.getTime() - offset * 60000);
                return local.toISOString().slice(0, 16);
            }
            editStartInput.value = icsToLocal(dtstart);
            editEndInput.value = icsToLocal(dtend);
        }

        document.getElementById('editModal').classList.add('open');
    }

    function closeEditModal() {
        document.getElementById('editModal').classList.remove('open');
        document.getElementById('editForm').reset();
    }

    window.toggleMoreDetails = function() {
        const div = document.getElementById('edit-more-details');
        const btn = document.getElementById('editMoreBtn');
        if (div.style.display === 'none') {
            div.style.display = 'block';
            btn.innerText = 'Hide More Details';
        } else {
            div.style.display = 'none';
            btn.innerText = 'Show More Details';
        }
    };

    async function handleEdit(e) {
        e.preventDefault();
        const btn = document.getElementById('editSubmitBtn');
        btn.innerText = 'Saving...'; btn.disabled = true;

        const isAllDay = document.getElementById('editAllDayToggle').checked;
        const start = document.getElementById('edit-local-start').value;
        const end = document.getElementById('edit-local-end').value;

        if (isAllDay) {
            document.getElementById('edit-iso-start').value = start || '';
            document.getElementById('edit-iso-end').value = end || '';
        } else {
            const tz = document.getElementById('editTzSelect').value;
            document.getElementById('edit-iso-start').value = start ? start + tz : '';
            document.getElementById('edit-iso-end').value = end ? end + tz : '';
        }

        try {
            const res = await fetch('/admin', { method: 'POST', body: new FormData(document.getElementById('editForm')) });
            const data = await res.json();
            if (!data.success) alert('Error: ' + data.error);
            else { closeEditModal(); loadEvents(); }
        } catch (err) { alert('Network Error'); }
        finally { btn.innerText = 'Save Changes'; btn.disabled = false; }
    }

    // Link location to geo in edit modal
    document.getElementById('edit-location').addEventListener('input', (e) => {
        const match = venues.find(v => v.name === e.target.value);
        if (match) document.getElementById('edit-geo').value = match.geo;
    });

    // Close modal on backdrop click
    document.getElementById('editModal').addEventListener('click', function(e) {
        if (e.target === this) closeEditModal();
    });

    document.addEventListener('DOMContentLoaded', () => { initVenues(); loadEvents(); });
  </script>
</body>
</html>`;


