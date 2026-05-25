import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { applySchema } from './helpers/load-schema';
import { ADMIN_PASS, BASE, login, req, runSQL } from './helpers/admin';

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
	await applySchema(env.DB);
	await env.DB.prepare(
		"INSERT OR IGNORE INTO calendars (id, x_wr_calname, x_wr_timezone) VALUES ('main-cal-001', 'NTUAS Events', 'Asia/Singapore')",
	).run();
});

// ─── POST /admin/login ───────────────────────────────────────────────────────

describe('POST /admin/login', () => {
	beforeEach(async () => {
		await runSQL('DELETE FROM admin_sessions; DELETE FROM login_attempts;');
	});

	it('returns 200 with login form on wrong password', async () => {
		const body = new FormData();
		body.append('password', 'wrong-password');
		const res = await req(`${BASE}/admin/login`, { method: 'POST', body });
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('<form');
	});

	it('redirects to /admin on correct password with secure cookie', async () => {
		const body = new FormData();
		body.append('password', ADMIN_PASS);
		const res = await req(`${BASE}/admin/login`, { method: 'POST', body });
		expect(res.status).toBe(302);
		expect(res.headers.get('Location')).toBe('/admin');
		const cookie = res.headers.get('Set-Cookie') ?? '';
		expect(cookie).toContain('admin_session=');
		expect(cookie).toContain('HttpOnly');
		expect(cookie).toContain('Secure');
		expect(cookie).toContain('SameSite=Strict');
	});

	it('returns 429 after 5 failed login attempts', async () => {
		const wrongBody = () => {
			const f = new FormData();
			f.append('password', 'wrong');
			return f;
		};
		for (let i = 0; i < 5; i++) {
			await req(`${BASE}/admin/login`, { method: 'POST', body: wrongBody() });
		}
		const res = await req(`${BASE}/admin/login`, { method: 'POST', body: wrongBody() });
		expect(res.status).toBe(429);
		expect(res.headers.get('Retry-After')).toBe('600');
	});
});

// ─── GET /admin ──────────────────────────────────────────────────────────────

describe('GET /admin', () => {
	beforeEach(async () => {
		await runSQL('DELETE FROM admin_sessions;');
	});

	it('shows login form when unauthenticated', async () => {
		const res = await req(`${BASE}/admin`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('<form');
		expect(html).toContain('password');
	});

	it('shows admin dashboard when authenticated', async () => {
		const { cookie } = await login();
		const res = await req(`${BASE}/admin`, { headers: { Cookie: cookie } });
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('Admin Dashboard');
	});

	it('has security headers', async () => {
		const res = await req(`${BASE}/admin`);
		expect(res.headers.get('X-Frame-Options')).toBe('DENY');
		expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(res.headers.get('Content-Security-Policy')).toBeTruthy();
	});
});

// ─── POST /admin/logout ──────────────────────────────────────────────────────

describe('POST /admin/logout', () => {
	beforeEach(async () => {
		await runSQL('DELETE FROM admin_sessions;');
	});

	it('returns 403 without CSRF token', async () => {
		const { cookie } = await login();
		const body = new FormData();
		const res = await req(`${BASE}/admin/logout`, {
			method: 'POST',
			headers: { Cookie: cookie },
			body,
		});
		expect(res.status).toBe(403);
	});

	it('redirects and clears session cookie on valid logout', async () => {
		const { cookie, csrfToken } = await login();
		const body = new FormData();
		body.append('_csrf', csrfToken);
		const res = await req(`${BASE}/admin/logout`, {
			method: 'POST',
			headers: { Cookie: cookie },
			body,
		});
		expect(res.status).toBe(302);
		expect(res.headers.get('Location')).toBe('/admin');
		expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
	});
});

// ─── Session expiry ───────────────────────────────────────────────────────────

describe('Session expiry', () => {
	beforeEach(async () => {
		await runSQL('DELETE FROM admin_sessions;');
	});

	it('rejects an expired session and shows login form', async () => {
		// Insert an already-expired session directly into the DB
		const expiredToken = 'expired-token-12345';
		const past = new Date(Date.now() - 1000).toISOString();
		await env.DB.prepare('INSERT INTO admin_sessions (token, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?)')
			.bind(expiredToken, 'some-csrf', past, past)
			.run();

		const res = await req(`${BASE}/admin`, {
			headers: { Cookie: `admin_session=${expiredToken}` },
		});
		expect(res.status).toBe(200);
		const html = await res.text();
		// Should show login form, not admin dashboard
		expect(html).toContain('<form');
		expect(html).not.toContain('Admin Dashboard');
	});

	it('cleans up expired session from DB after rejection', async () => {
		const expiredToken = 'expired-cleanup-token';
		const past = new Date(Date.now() - 1000).toISOString();
		await env.DB.prepare('INSERT INTO admin_sessions (token, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?)')
			.bind(expiredToken, 'some-csrf', past, past)
			.run();

		await req(`${BASE}/admin`, {
			headers: { Cookie: `admin_session=${expiredToken}` },
		});

		const row = await env.DB.prepare('SELECT token FROM admin_sessions WHERE token = ?').bind(expiredToken).first();
		expect(row).toBeNull();
	});
});
