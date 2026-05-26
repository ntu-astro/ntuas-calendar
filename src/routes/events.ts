import { parseRange } from '../lib/range';
import type { ApiEvent } from '../../client/src/api-types';

interface EventRow {
	uid: string;
	summary: string | null;
	dtstart: string;
	dtend: string | null;
	status: string | null;
	location: string | null;
	geo: string | null;
	description: string | null;
	categories: string | null;
	url: string | null;
	organizer_name: string | null;
	organizer_email: string | null;
}

function toJson(row: EventRow): ApiEvent {
	const { organizer_name, organizer_email, ...rest } = row;
	const organizer = organizer_name === null && organizer_email === null ? null : { name: organizer_name, email: organizer_email };
	return { ...rest, organizer };
}

export async function handleEvents(url: URL, request: Request, env: Env): Promise<Response | null> {
	if (url.pathname !== '/api/events' || request.method !== 'GET') return null;

	const range = parseRange(url);
	if ('error' in range) return range.error;

	const fromKey = range.from.replace(/-/g, '');
	const toKey = range.to.replace(/-/g, '') + 'T235959Z';

	const { results } = await env.DB.prepare(
		`SELECT uid, summary, dtstart, dtend, status, location, geo, description, categories, url,
		        organizer_name, organizer_email
		 FROM events
		 WHERE dtstart >= ? AND dtstart <= ?
		 ORDER BY dtstart DESC`,
	)
		.bind(fromKey, toKey)
		.all<EventRow>();

	const events = results.map(toJson);

	return new Response(JSON.stringify(events), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=10, s-maxage=30',
			'Access-Control-Allow-Origin': '*',
		},
	});
}
