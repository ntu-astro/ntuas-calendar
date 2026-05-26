-- Migration 0005: drop the legacy events.organizer column.
--
-- Migration 0004 split organizer into organizer_name / organizer_email but
-- kept the legacy column for rollback safety. The 0004 backfill has been in
-- production since commit 33c43e7. Nothing in src/ reads the legacy column
-- after this migration; the renderer fallback in src/routes/ics.ts and the
-- INSERT/UPDATE references in src/routes/admin.ts are removed in the same commit.

ALTER TABLE events DROP COLUMN organizer;
