import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../../src';

export const BASE = 'http://localhost';
export const ADMIN_PASS = 'test-password-123';

/** Run one or more semicolon-separated SQL statements against the test D1 binding. */
export async function runSQL(sql: string): Promise<void> {
	const stmts = sql
		.split(';')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
	for (const stmt of stmts) {
		await env.DB.prepare(stmt).run();
	}
}

/** Send a fetch through the worker using the Cloudflare test execution context. */
export async function req(url: string, init?: RequestInit): Promise<Response> {
	const request = new Request(url, init);
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

/** Log in with the admin password and return the cookie + extracted CSRF token. */
export async function login(): Promise<{ cookie: string; csrfToken: string }> {
	await runSQL('DELETE FROM login_attempts;');
	const body = new FormData();
	body.append('password', ADMIN_PASS);
	const res = await req(`${BASE}/admin/login`, { method: 'POST', body });
	const setCookie = res.headers.get('Set-Cookie') ?? '';
	const token = setCookie.match(/admin_session=([^;]+)/)?.[1] ?? '';

	const adminRes = await req(`${BASE}/admin`, {
		headers: { Cookie: `admin_session=${token}` },
	});
	const html = await adminRes.text();
	const csrfToken = html.match(/name="csrf-token" content="([^"]+)"/)?.[1] ?? '';

	return { cookie: `admin_session=${token}`, csrfToken };
}

/** POST a form-encoded body to /admin with the CSRF token and session cookie. */
export async function adminPost(cookie: string, csrfToken: string, fields: Record<string, string>): Promise<Response> {
	const body = new FormData();
	body.append('_csrf', csrfToken);
	for (const [k, v] of Object.entries(fields)) body.append(k, v);
	return req(`${BASE}/admin`, { method: 'POST', headers: { Cookie: cookie }, body });
}
