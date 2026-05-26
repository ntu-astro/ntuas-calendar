import { SECURITY_HEADERS } from '../constants';

export async function handleHealth(url: URL, env: Env): Promise<Response | null> {
	if (url.pathname !== '/health') return null;
	try {
		await env.DB.prepare('SELECT 1').first();
		return Response.json({ status: 'ok', db: 'connected' }, { headers: SECURITY_HEADERS });
	} catch {
		return Response.json({ status: 'error', db: 'unreachable' }, { status: 503, headers: SECURITY_HEADERS });
	}
}
