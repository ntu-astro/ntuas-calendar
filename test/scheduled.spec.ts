import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { applySchema } from './helpers/load-schema';
import { runDailyCleanup } from '../src/scheduled';

interface CountRow { cnt: number }

beforeAll(async () => {
	await applySchema(env.DB);
});

beforeEach(async () => {
	await env.DB.prepare('DELETE FROM login_attempts').run();
	await env.DB.prepare('DELETE FROM admin_sessions').run();
});

describe('runDailyCleanup', () => {
	it('purges login_attempts older than the rate-limit window', async () => {
		const oldTs = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
		const freshTs = new Date().toISOString();
		await env.DB.prepare(
			"INSERT INTO login_attempts (ip, attempted_at, success) VALUES ('1.1.1.1', ?, 0)",
		).bind(oldTs).run();
		await env.DB.prepare(
			"INSERT INTO login_attempts (ip, attempted_at, success) VALUES ('2.2.2.2', ?, 0)",
		).bind(freshTs).run();

		await runDailyCleanup(env);

		const row = await env.DB.prepare('SELECT COUNT(*) as cnt FROM login_attempts').first<CountRow>();
		expect(row?.cnt).toBe(1);
		const survivor = await env.DB.prepare("SELECT ip FROM login_attempts").first<{ ip: string }>();
		expect(survivor?.ip).toBe('2.2.2.2');
	});

	it('purges expired admin sessions', async () => {
		const expired = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
		const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
		await env.DB.prepare(
			"INSERT INTO admin_sessions (token, csrf_token, created_at, expires_at) VALUES ('old', 'csrf1', ?, ?)",
		).bind(expired, expired).run();
		await env.DB.prepare(
			"INSERT INTO admin_sessions (token, csrf_token, created_at, expires_at) VALUES ('new', 'csrf2', ?, ?)",
		).bind(new Date().toISOString(), future).run();

		await runDailyCleanup(env);

		const row = await env.DB.prepare('SELECT COUNT(*) as cnt FROM admin_sessions').first<CountRow>();
		expect(row?.cnt).toBe(1);
	});
});
