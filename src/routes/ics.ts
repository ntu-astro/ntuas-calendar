import { Env, SECURITY_HEADERS } from '../constants';
import { fold, sanitizeIcsValue } from '../lib/ics';
import type { Calendar, Event, EventAlarm, EventAttachment } from '../types';

export async function handleIcs(
	url: URL,
	_request: Request,
	env: Env,
): Promise<Response | null> {
	if (url.pathname !== '/subscribe' && url.pathname !== '/calendar.ics') {
		return null;
	}

	const cal = await env.DB.prepare('SELECT * FROM calendars LIMIT 1').first<Calendar>();
	if (!cal) return new Response('Calendar not found', { status: 404 });

	const { results: events } = await env.DB.prepare(
		'SELECT * FROM events WHERE calendar_id = ? ORDER BY dtstart ASC',
	)
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

	const icsLines: string[] = [
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
