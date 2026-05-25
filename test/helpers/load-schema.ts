import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(__dirname, '..', '..', 'schema.sql');

/**
 * Load the production schema.sql, rewrite it to be safe for repeated test runs,
 * and return the list of executable statements.
 *
 * Rewrites applied:
 *   - Strip leading `DROP TABLE IF EXISTS …;` lines (tests start from a clean
 *     in-memory DB, so DROPs aren't needed and just add noise).
 *   - Replace `CREATE TABLE foo` with `CREATE TABLE IF NOT EXISTS foo` so calling
 *     this twice (e.g., across describe blocks) is a no-op.
 *   - Replace `CREATE INDEX idx_x` with `CREATE INDEX IF NOT EXISTS idx_x` for
 *     the same reason.
 */
export function loadSchemaStatements(): string[] {
	const raw = readFileSync(SCHEMA_PATH, 'utf8');

	const rewritten = raw
		.replace(/^\s*DROP TABLE IF EXISTS [^;]+;\s*$/gm, '')
		.replace(/CREATE TABLE (?!IF NOT EXISTS)(\w+)/g, 'CREATE TABLE IF NOT EXISTS $1')
		.replace(/CREATE INDEX (?!IF NOT EXISTS)(\w+)/g, 'CREATE INDEX IF NOT EXISTS $1');

	return rewritten
		.split(';')
		.map((s) => s.trim())
		.filter((s) => s.length > 0 && !s.startsWith('--'));
}

/**
 * Execute every statement of the production schema against the provided D1.
 * Safe to call multiple times.
 */
export async function applySchema(db: D1Database): Promise<void> {
	for (const stmt of loadSchemaStatements()) {
		await db.prepare(stmt).run();
	}
}
