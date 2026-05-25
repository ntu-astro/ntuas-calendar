import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { applySchema } from './helpers/load-schema';
import { BASE, req } from './helpers/admin';

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeAll(async () => {
	await applySchema(env.DB);
	await env.DB.prepare(
		"INSERT OR IGNORE INTO calendars (id, x_wr_calname, x_wr_timezone) VALUES ('main-cal-001', 'NTUAS Events', 'Asia/Singapore')",
	).run();
});

// ─── GET /health ─────────────────────────────────────────────────────────────

describe('GET /health', () => {
	it('returns 200 with ok status', async () => {
		const res = await req(`${BASE}/health`);
		expect(res.status).toBe(200);
		const data = (await res.json()) as { status: string };
		expect(data.status).toBe('ok');
	});
});

// ─── HSTS header ─────────────────────────────────────────────────────────────

describe('HSTS header', () => {
	it('is present on admin responses', async () => {
		const res = await req(`${BASE}/admin`);
		const hsts = res.headers.get('Strict-Transport-Security');
		expect(hsts).toBeTruthy();
		expect(hsts).toContain('max-age=');
		expect(hsts).toContain('includeSubDomains');
	});

	it('is present on subscribe responses', async () => {
		const res = await req(`${BASE}/subscribe`);
		expect(res.headers.get('Strict-Transport-Security')).toBeTruthy();
	});
});

// ─── 404 ─────────────────────────────────────────────────────────────────────

describe('Unknown routes', () => {
	it('returns 404 for unknown paths', async () => {
		const res = await req(`${BASE}/not-a-real-path`);
		expect(res.status).toBe(404);
	});

	it('has security headers on 404', async () => {
		const res = await req(`${BASE}/not-a-real-path`);
		expect(res.headers.get('X-Frame-Options')).toBe('DENY');
	});
});
