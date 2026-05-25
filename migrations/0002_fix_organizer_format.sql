-- Migration 0002: backfill ORGANIZER values missing the leading ICS delimiter.
--
-- Before the validator fix in src/lib/validation.ts, email-only organizers were
-- stored as 'mailto:foo@x.com' which the ICS renderer concatenated as
-- 'ORGANIZERmailto:foo@x.com' (missing the colon separator — RFC 5545 violation).
-- New events now store ':mailto:foo@x.com'. This migration retrofits existing
-- rows to the new format.
--
-- Idempotent: rows that already start with ':' or ';' are skipped.

UPDATE events
SET organizer = ':' || organizer
WHERE organizer LIKE 'mailto:%'
  AND organizer NOT LIKE ':%'
  AND organizer NOT LIKE ';%';
