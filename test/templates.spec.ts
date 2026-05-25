import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src';
import { applySchema } from './helpers/load-schema';

const BASE = 'http://localhost';

/** Replace random tokens so the snapshot is stable across runs. */
function normalize(html: string): string {
	return html
		.replace(
			/content="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"/g,
			'content="<<CSRF_PLACEHOLDER>>"',
		)
		.replace(
			/value="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"/g,
			'value="<<CSRF_PLACEHOLDER>>"',
		);
}

beforeAll(async () => {
	await applySchema(env.DB);
});

describe('UI byte snapshots', () => {
	it('LOGIN_HTML(false) — unauthenticated GET /admin', async () => {
		const res = await worker.fetch(new Request(`${BASE}/admin`), env as any);
		expect(res.status).toBe(200);
		const html = normalize(await res.text());
		expect(html).toMatchSnapshot();
	});

	it('LOGIN_HTML(true) — POST /admin/login with wrong password', async () => {
		const form = new URLSearchParams();
		form.set('password', 'definitely-wrong-password');
		const res = await worker.fetch(
			new Request(`${BASE}/admin/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: form.toString(),
			}),
			env as any,
		);
		expect(res.status).toBe(200);
		const html = normalize(await res.text());
		expect(html).toMatchSnapshot();
	});

	it('ADMIN_HTML — authenticated GET /admin', async () => {
		// Seed a session row directly
		const token = 'snapshot-test-session-token';
		const csrf = 'snapshot-test-csrf-token';
		const expires = new Date(Date.now() + 3600_000).toISOString();
		await env.DB.prepare('INSERT INTO admin_sessions (token, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?)')
			.bind(token, csrf, new Date().toISOString(), expires)
			.run();

		const res = await worker.fetch(new Request(`${BASE}/admin`, { headers: { Cookie: `admin_session=${token}` } }), env as any);
		expect(res.status).toBe(200);
		let html = await res.text();
		// The session CSRF is deterministic here — substitute it for cleaner snapshots
		html = html.replace(new RegExp(csrf, 'g'), '<<CSRF_PLACEHOLDER>>');
		expect(html).toMatchSnapshot();
	});
});
