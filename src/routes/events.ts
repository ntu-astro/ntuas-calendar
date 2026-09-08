import { parseRange } from '../lib/range';
import { SECURITY_HEADERS } from '../constants';
import type { ApiEvent } from '../types';

const MISSING_TABLE = /no such table/i;

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

	let results: EventRow[];
	try {
		const rows = await env.DB.prepare(
			`SELECT uid, summary, dtstart, dtend, status, location, geo, description, categories, url,
			        organizer_name, organizer_email
			 FROM events
			 WHERE dtstart >= ? AND dtstart <= ?
			 ORDER BY dtstart DESC`,
		)
			.bind(fromKey, toKey)
			.all<EventRow>();
		results = rows.results;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (MISSING_TABLE.test(message)) {
			console.error('[events] local database not initialised:', message);
			return Response.json(
				{ error: 'Local database is not initialised. Run: npm run setup' },
				{ status: 503, headers: SECURITY_HEADERS },
			);
		}
		throw err;
	}

	const events = results.map(toJson);

	return new Response(JSON.stringify(events), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=10, s-maxage=30',
			'Access-Control-Allow-Origin': '*',
		},
	});
}
