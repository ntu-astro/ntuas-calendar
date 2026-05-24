import { Env } from '../constants';

export async function handleEvents(
	url: URL,
	request: Request,
	env: Env,
): Promise<Response | null> {
	if (url.pathname !== '/api/events' || request.method !== 'GET') return null;

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
