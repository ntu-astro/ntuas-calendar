import { Env } from '../constants';
import { parseRange } from '../lib/range';

export async function handleEvents(
	url: URL,
	request: Request,
	env: Env,
): Promise<Response | null> {
	if (url.pathname !== '/api/events' || request.method !== 'GET') return null;

	const range = parseRange(url);
	if ('error' in range) return range.error;

	const fromKey = range.from.replace(/-/g, '');
	const toKey = range.to.replace(/-/g, '') + 'T235959Z';

	const { results: events } = await env.DB.prepare(
		`SELECT uid, summary, dtstart, dtend, status, location, geo, description, categories, url, organizer
		 FROM events
		 WHERE dtstart >= ? AND dtstart <= ?
		 ORDER BY dtstart DESC`,
	)
		.bind(fromKey, toKey)
		.all();

	return new Response(JSON.stringify(events), {
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': 'public, max-age=10, s-maxage=30',
			'Access-Control-Allow-Origin': '*',
		},
	});
}
