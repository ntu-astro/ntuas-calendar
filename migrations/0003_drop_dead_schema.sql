-- Migration 0003: drop dead schema objects to bring prod in sync with 0001_initial.sql.
--
-- Verified empty in remote prod (2026-05-25) before drop:
--   - timezone_rules: orphan table from an earlier design; never referenced by the worker
--   - event_recurrence: orphan table; never referenced by the worker
--   - event_alarms.attendee: orphan column; never read or written by the worker
--
-- After this migration, the only remaining drift from 0001_initial.sql is the cosmetic
-- `calendars.prodid` DEFAULT value ('-//Cloudflare//MyCalendar//EN' vs '-//NTUAS//MyCalendar//EN'),
-- which only affects new INSERTs that omit prodid — the worker never inserts into calendars.

DROP TABLE IF EXISTS timezone_rules;
DROP TABLE IF EXISTS event_recurrence;
ALTER TABLE event_alarms DROP COLUMN attendee;
