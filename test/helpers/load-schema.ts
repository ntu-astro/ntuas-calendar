// Vite's `?raw` import returns the file contents as a string at build time,
// so this works inside the Workers runtime where Node's `fs` is unavailable.
import schemaSql from '../../schema.sql?raw';

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
 *   - Strip SQL comments so each statement is a single CREATE.
 */
export function loadSchemaStatements(): string[] {
	const rewritten = schemaSql
		.replace(/^\s*DROP TABLE IF EXISTS [^;]+;\s*$/gm, '')
		.replace(/CREATE TABLE (?!IF NOT EXISTS)(\w+)/g, 'CREATE TABLE IF NOT EXISTS $1')
		.replace(/CREATE INDEX (?!IF NOT EXISTS)(\w+)/g, 'CREATE INDEX IF NOT EXISTS $1')
		// Strip `-- …` comments (whole-line and trailing) so the parser doesn't
		// see them as part of an adjacent statement.
		.replace(/--[^\n]*\n/g, '\n');

	return rewritten
		.split(';')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
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
