import { RATE_LIMIT_WINDOW_MS } from './constants';
import { cleanExpiredSessions } from './lib/auth';

export async function runDailyCleanup(env: Env): Promise<void> {
	try {
		const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
		await env.DB.prepare('DELETE FROM login_attempts WHERE attempted_at < ?').bind(cutoff).run();
		await cleanExpiredSessions(env.DB);
	} catch (e: unknown) {
		console.error(
			JSON.stringify({
				message: 'runDailyCleanup failed',
				error: e instanceof Error ? e.message : String(e),
				stack: e instanceof Error ? e.stack : undefined,
			}),
		);
		throw e;
	}
}
