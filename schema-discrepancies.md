# Schema Discrepancies: remote_backup.sql vs schema.sql

Comparing the production backup (`remote_backup.sql`) against the canonical schema (`schema.sql`).

---

## 1. `event_alarms` — Missing `attendee` Column

**In backup:**
```sql
CREATE TABLE event_alarms (
    ...
    attendee TEXT,   -- present
    ...
);
```

**In schema.sql:** `attendee` column does not exist.

The backup contains rows with `attendee` set to `NULL` throughout, so the column appears unused in practice. Either add it to `schema.sql` to align with the backup, or drop it from the backup's table definition on next export.

---

## 2. `event_recurrence` Table — Missing from schema.sql

**In backup:**
```sql
CREATE TABLE event_recurrence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_uid TEXT NOT NULL,
    rrule TEXT NOT NULL,
    exdate TEXT,
    FOREIGN KEY (event_uid) REFERENCES events(uid) ON DELETE CASCADE
);
```

**In schema.sql:** This table does not exist.

No rows are inserted into it in the backup, so it is currently empty in production. If recurring events are not yet implemented, the table should either be added to `schema.sql` to reflect the actual production state, or dropped from production via a migration.

---

## 3. `calendars.prodid` Default Value Mismatch

| Source | Default value |
|--------|--------------|
| `schema.sql` | `-//NTUAS//MyCalendar//EN` |
| `remote_backup.sql` | `-//Cloudflare//MyCalendar//EN` |

The production record was created with the old Cloudflare default. `schema.sql` has since been updated to use the NTUAS identifier, but the live row was never updated. Run the following to fix the production record:

```sql
UPDATE calendars SET prodid = '-//NTUAS//MyCalendar//EN' WHERE id = 'main-cal-001';
```

---

## 4. Live Session Token in Backup

`remote_backup.sql` contains a live `admin_sessions` row with a real token and CSRF token. This backup should not be committed to version control or shared publicly as-is. Sanitise before use:

```sql
DELETE FROM admin_sessions;
```

Strip this row before storing or distributing any backup export.
