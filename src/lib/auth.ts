import { SESSION_MAX_AGE_SECONDS } from '../constants';
import type { AdminSession } from '../types';

export function generateRandomToken(): string {
	return crypto.randomUUID() + '-' + crypto.randomUUID();
}

export function timingSafeCompare(input: string, expected: string): boolean {
	const encoder = new TextEncoder();
	const inputBytes = encoder.encode(input);
	const expectedBytes = encoder.encode(expected);
	const maxLen = Math.max(inputBytes.byteLength, expectedBytes.byteLength);
	const a = new Uint8Array(maxLen);
	const b = new Uint8Array(maxLen);
	a.set(inputBytes);
	b.set(expectedBytes);
	return (
		inputBytes.byteLength === expectedBytes.byteLength &&
		crypto.subtle.timingSafeEqual(a, b)
	);
}

export async function createSession(
	db: D1Database,
): Promise<{ token: string; csrfToken: string }> {
	const token = generateRandomToken();
	const csrfToken = generateRandomToken();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);
	await db
		.prepare(
			'INSERT INTO admin_sessions (token, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?)',
		)
		.bind(token, csrfToken, now.toISOString(), expiresAt.toISOString())
		.run();
	return { token, csrfToken };
}

export async function validateSession(
	db: D1Database,
	token: string | null,
): Promise<{ valid: boolean; csrfToken: string | null }> {
	if (!token) return { valid: false, csrfToken: null };
	const session = await db
		.prepare('SELECT * FROM admin_sessions WHERE token = ?')
		.bind(token)
		.first<AdminSession>();
	if (!session) return { valid: false, csrfToken: null };
	if (new Date(session.expires_at) < new Date()) {
		await db
			.prepare('DELETE FROM admin_sessions WHERE token = ?')
			.bind(token)
			.run();
		return { valid: false, csrfToken: null };
	}
	return { valid: true, csrfToken: session.csrf_token };
}

export async function deleteSession(
	db: D1Database,
	token: string | null,
): Promise<void> {
	if (token) {
		await db
			.prepare('DELETE FROM admin_sessions WHERE token = ?')
			.bind(token)
			.run();
	}
}

export async function cleanExpiredSessions(db: D1Database): Promise<void> {
	await db
		.prepare('DELETE FROM admin_sessions WHERE expires_at < ?')
		.bind(new Date().toISOString())
		.run();
}

export function getCookie(request: Request, name: string): string | null {
	const cookieHeader = request.headers.get('Cookie');
	if (!cookieHeader) return null;
	const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
	return match ? match[1] : null;
}
