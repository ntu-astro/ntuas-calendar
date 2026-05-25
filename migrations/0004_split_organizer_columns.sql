-- Migration 0004: split events.organizer into organizer_name / organizer_email.
--
-- Before this migration, events.organizer stored a value that included the leading
-- ICS delimiter so the renderer could emit `ORGANIZER${value}` verbatim:
--   ':mailto:foo@x.com'                    (email only)
--   ';CN=Some Name:mailto:foo@x.com'       (name + email)
--
-- That convention leaked the ICS prefix into the JSON `/api/events` payload and
-- was a footgun for any other consumer. After this migration:
--   - events.organizer_name  stores the plain CN value (or NULL)
--   - events.organizer_email stores the plain mailto value (or NULL)
--   - The renderer in src/routes/ics.ts re-derives the ICS line at render time.
--
-- The legacy `organizer` column is intentionally KEPT for one release so a
-- rollback is possible. A future migration can drop it once we are confident
-- nothing reads it.
--
-- Idempotence: wrangler tracks applied migrations and will only run this once,
-- but the backfill UPDATEs below are themselves idempotent (they refuse to
-- overwrite rows that already have the new columns populated and they only
-- match rows that still carry the legacy prefix-shape value).

ALTER TABLE events ADD COLUMN organizer_name TEXT;
ALTER TABLE events ADD COLUMN organizer_email TEXT;

-- Backfill case 1: ';CN=NAME:mailto:EMAIL'
--   Layout: ';CN=' + name + ':mailto:' + email
--   The name starts at offset 5 (1-indexed after ';CN=') and runs until the
--   ':mailto:' separator. INSTR returns 0 when missing, so the WHERE clause
--   guards against malformed rows.
UPDATE events
SET
    organizer_name = SUBSTR(organizer, 5, INSTR(organizer, ':mailto:') - 5),
    organizer_email = SUBSTR(organizer, INSTR(organizer, ':mailto:') + 8)
WHERE organizer LIKE ';CN=%:mailto:%'
  AND organizer_name IS NULL
  AND organizer_email IS NULL;

-- Backfill case 2: ':mailto:EMAIL' (email only, no name)
UPDATE events
SET organizer_email = SUBSTR(organizer, 9)
WHERE organizer LIKE ':mailto:%'
  AND organizer_name IS NULL
  AND organizer_email IS NULL;
