# D1 Migrations

Schema changes for `calendar_db` (the Cloudflare D1 database bound as `env.DB`).

## Quickstart

Create a new migration:
```bash
npx wrangler d1 migrations create calendar_db add_event_recurrence
```
Wrangler creates a numbered file (e.g., `0002_add_event_recurrence.sql`). Write idempotent SQL inside.

Apply to local D1:
```bash
npx wrangler d1 migrations apply calendar_db --local
```

Apply to production: auto-runs in CI on merge to `main`. To apply manually:
```bash
npx wrangler d1 migrations apply calendar_db --remote
```

List status:
```bash
npx wrangler d1 migrations list calendar_db --local
npx wrangler d1 migrations list calendar_db --remote
```

## Conventions

- **Idempotent SQL only.** Use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ALTER TABLE … ADD COLUMN` (D1 doesn't error on a re-add when the column already exists in some cases — verify per migration), or `INSERT OR IGNORE`.
- **No DROP TABLE.** If you truly need to drop, write a separate migration for it and double-check the data is safe to lose.
- **One logical change per migration.** Easier to read in `git log` and easier to revert by writing a follow-up migration.
- **Never edit an applied migration.** If `0002_*.sql` is already in production, write `0003_*.sql` to amend it.
- **Test locally first.** Apply against `--local`, run `npm test`, verify the schema with `npx wrangler d1 execute calendar_db --local --command ".schema"` before pushing.

## Recovery

If a migration fails on `--remote`:
1. Wrangler does NOT mark the migration as applied if it errored.
2. Check the error and fix the migration file.
3. Re-run `npx wrangler d1 migrations apply calendar_db --remote`.
4. If a partially-applied migration left the DB in a bad state, write a follow-up migration to clean it up rather than editing the original.
