import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { applySchema } from './helpers/load-schema';
import {
	cleanExpiredSessions,
	createSession,
	deleteSession,
	generateRandomToken,
	getCookie,
	timingSafeCompare,
	validateSession,
} from '../src/lib/auth';

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
	await applySchema(env.DB);
});

// ─── timingSafeCompare ──────────────────────────────────────────────────────

describe('timingSafeCompare', () => {
	it('returns true for equal strings', () => {
		expect(timingSafeCompare('hello', 'hello')).toBe(true);
	});

	it('returns false for different strings of the same length', () => {
		expect(timingSafeCompare('abcdef', 'abcxyz')).toBe(false);
	});

	it('returns false for strings of different lengths', () => {
		expect(timingSafeCompare('short', 'much-longer-string')).toBe(false);
	});

	it('returns true when both strings are empty', () => {
		expect(timingSafeCompare('', '')).toBe(true);
	});

	it('returns false when only one string is empty', () => {
		expect(timingSafeCompare('', 'nonempty')).toBe(false);
		expect(timingSafeCompare('nonempty', '')).toBe(false);
	});

	it('compares unicode strings correctly', () => {
		expect(timingSafeCompare('café 你好 🎉', 'café 你好 🎉')).toBe(true);
		expect(timingSafeCompare('café 你好 🎉', 'café 你好 🎊')).toBe(false);
	});
});

// ─── generateRandomToken ────────────────────────────────────────────────────

describe('generateRandomToken', () => {
	it('returns a string with a hyphen separator between two UUIDs', () => {
		const token = generateRandomToken();
		expect(typeof token).toBe('string');
		expect(token).toContain('-');
		// Two UUIDs joined by '-' = 5 hyphens per UUID + 1 joiner = 11 total
		const hyphenCount = (token.match(/-/g) ?? []).length;
		expect(hyphenCount).toBeGreaterThanOrEqual(9);
	});

	it('returns different values on consecutive calls', () => {
		const t1 = generateRandomToken();
		const t2 = generateRandomToken();
		expect(t1).not.toBe(t2);
	});

	it('produces tokens of a consistent length', () => {
		const lengths = Array.from({ length: 10 }, () => generateRandomToken().length);
		const unique = new Set(lengths);
		expect(unique.size).toBe(1);
	});
});

// ─── getCookie ──────────────────────────────────────────────────────────────

describe('getCookie', () => {
	function makeReq(cookieHeader: string | null): Request {
		const headers: HeadersInit = {};
		if (cookieHeader !== null) headers.Cookie = cookieHeader;
		return new Request('http://localhost/', { headers });
	}

	it('returns the cookie value when present', () => {
		const r = makeReq('admin_session=abc123');
		expect(getCookie(r, 'admin_session')).toBe('abc123');
	});

	it('returns null when the Cookie header is missing', () => {
		const r = makeReq(null);
		expect(getCookie(r, 'admin_session')).toBeNull();
	});

	it('returns null when the named cookie is absent', () => {
		const r = makeReq('other=value');
		expect(getCookie(r, 'admin_session')).toBeNull();
	});

	it('handles multiple cookies in the same header', () => {
		const r = makeReq('foo=1; admin_session=xyz; bar=2');
		expect(getCookie(r, 'admin_session')).toBe('xyz');
		expect(getCookie(r, 'foo')).toBe('1');
		expect(getCookie(r, 'bar')).toBe('2');
	});

	it('handles cookie values with special characters', () => {
		const r = makeReq('token=abc.def-ghi_jkl+mno=pq');
		expect(getCookie(r, 'token')).toBe('abc.def-ghi_jkl+mno=pq');
	});
});

// ─── Session lifecycle (D1-backed) ──────────────────────────────────────────

describe('Session lifecycle', () => {
	beforeEach(async () => {
		await env.DB.prepare('DELETE FROM admin_sessions').run();
	});

	it('round-trips: create → validate (valid + csrf matches) → delete → validate (invalid)', async () => {
		const { token, csrfToken } = await createSession(env.DB);
		expect(token).toBeTruthy();
		expect(csrfToken).toBeTruthy();

		const valid = await validateSession(env.DB, token);
		expect(valid.valid).toBe(true);
		expect(valid.csrfToken).toBe(csrfToken);

		await deleteSession(env.DB, token);

		const after = await validateSession(env.DB, token);
		expect(after.valid).toBe(false);
		expect(after.csrfToken).toBeNull();
	});

	it('returns invalid for a null token without touching the DB', async () => {
		const result = await validateSession(env.DB, null);
		expect(result.valid).toBe(false);
		expect(result.csrfToken).toBeNull();
	});

	it('returns invalid for an unknown token', async () => {
		const result = await validateSession(env.DB, 'does-not-exist');
		expect(result.valid).toBe(false);
		expect(result.csrfToken).toBeNull();
	});

	it('deleteSession is a no-op when token is null', async () => {
		// Should not throw and should not affect any rows
		await deleteSession(env.DB, null);
		const { results } = await env.DB.prepare('SELECT * FROM admin_sessions').all();
		expect(results).toHaveLength(0);
	});

	it('treats expired sessions as invalid and removes them on validate', async () => {
		const past = new Date(Date.now() - 1000).toISOString();
		const token = 'expired-direct-token';
		await env.DB.prepare('INSERT INTO admin_sessions (token, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?)')
			.bind(token, 'csrf-x', past, past)
			.run();

		const result = await validateSession(env.DB, token);
		expect(result.valid).toBe(false);
		expect(result.csrfToken).toBeNull();

		const row = await env.DB.prepare('SELECT token FROM admin_sessions WHERE token = ?').bind(token).first();
		expect(row).toBeNull();
	});

	it('cleanExpiredSessions removes only expired rows', async () => {
		const past = new Date(Date.now() - 1000).toISOString();
		const future = new Date(Date.now() + 60_000).toISOString();
		await env.DB.prepare('INSERT INTO admin_sessions (token, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?)')
			.bind('expired-cleanup', 'csrf-a', past, past)
			.run();
		await env.DB.prepare('INSERT INTO admin_sessions (token, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?)')
			.bind('alive-cleanup', 'csrf-b', past, future)
			.run();

		await cleanExpiredSessions(env.DB);

		const remaining = await env.DB.prepare('SELECT token FROM admin_sessions ORDER BY token').all<{ token: string }>();
		expect(remaining.results.map((r) => r.token)).toEqual(['alive-cleanup']);
	});
});
