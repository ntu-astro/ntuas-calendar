import { SECURITY_HEADERS } from './constants';
import { handleHealth } from './routes/health.ts';
import { handleEvents } from './routes/events.ts';
import { handleAdmin } from './routes/admin.ts';
import { handleIcs } from './routes/ics.ts';

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		const healthRes = await handleHealth(url, env);
		if (healthRes) return healthRes;

		const eventsRes = await handleEvents(url, request, env);
		if (eventsRes) return eventsRes;

		const adminRes = await handleAdmin(url, request, env);
		if (adminRes) return adminRes;

		const icsRes = await handleIcs(url, request, env);
		if (icsRes) return icsRes;

		return new Response('404 - Endpoint not found.', { status: 404, headers: { ...SECURITY_HEADERS } });
	},
} satisfies ExportedHandler<Env>;
