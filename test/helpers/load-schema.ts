// Vite's `?raw` import returns the file contents as a string at build time,
// so this works inside the Workers runtime where Node's `fs` is unavailable.
// migrations/0001_initial.sql is the canonical schema source (schema.sql is deprecated).
import schemaSql from '../../migrations/0001_initial.sql?raw';
// Migration 0004 adds the split organizer columns. The 0002/0003 migrations
// only mutate data or drop dead schema objects that 0001 never declares, so
// they are not needed for tests starting from a clean in-memory DB.
import splitOrganizerSql from '../../migrations/0004_split_organizer_columns.sql?raw';
// Migration 0005 drops the legacy organizer column (rollback window closed).
import dropLegacyOrganizerSql from '../../migrations/0005_drop_legacy_organizer.sql?raw';

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
 * Split a SQL script into statements at top-level `;` only — semicolons inside
 * single-quoted string literals are kept with the surrounding statement so a
 * pattern like `WHERE organizer LIKE ';CN=...'` is not severed at the embedded `;`.
 */
function splitStatements(sql: string): string[] {
	const stripped = sql.replace(/--[^\n]*\n/g, '\n');
	const stmts: string[] = [];
	let buf = '';
	let inString = false;
	for (let i = 0; i < stripped.length; i++) {
		const ch = stripped[i];
		if (ch === "'") {
			// SQLite escapes a literal `'` inside a string by doubling it (`''`).
			// In both cases we just keep toggling: `''` toggles off then on, which
			// is the same in-string state as if we hadn't toggled.
			inString = !inString;
			buf += ch;
			continue;
		}
		if (ch === ';' && !inString) {
			const stmt = buf.trim();
			if (stmt.length > 0) stmts.push(stmt);
			buf = '';
			continue;
		}
		buf += ch;
	}
	const tail = buf.trim();
	if (tail.length > 0) stmts.push(tail);
	return stmts;
}

/**
 * Execute every statement of the production schema against the provided D1.
 * Also applies post-initial migrations needed for new columns. Safe to call
 * multiple times — DDL guarded by IF NOT EXISTS; column adds are wrapped in
 * try/catch because SQLite ALTER TABLE ADD COLUMN has no IF NOT EXISTS form.
 */
export async function applySchema(db: D1Database): Promise<void> {
	for (const stmt of loadSchemaStatements()) {
		await db.prepare(stmt).run();
	}
	for (const stmt of splitStatements(splitOrganizerSql)) {
		try {
			await db.prepare(stmt).run();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			// Re-applying ADD COLUMN against an already-migrated DB is a no-op
			// for our purposes; surface anything else.
			if (!/duplicate column name/i.test(msg)) throw e;
		}
	}
	for (const stmt of splitStatements(dropLegacyOrganizerSql)) {
		try {
			await db.prepare(stmt).run();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			// Re-applying DROP COLUMN against an already-migrated DB fails with
			// "no such column: organizer"; treat that as a no-op identical to 0004 handling.
			if (!/no such column: organizer\b/i.test(msg)) throw e;
		}
	}
}
