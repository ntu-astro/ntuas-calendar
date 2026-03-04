-- seed.sql

-- 1. Create a Test Calendar
INSERT INTO calendars (id, x_wr_calname, x_wr_timezone) 
VALUES ('main-cal-001', 'Project Alpha Team', 'UTC');

-- 2. Create a Test Event (VEVENT)
-- Note: Dates follow YYYYMMDDTHHMMSSZ format
INSERT INTO events (
    uid, 
    calendar_id, 
    dtstamp, 
    dtstart, 
    dtend, 
    summary, 
    description, 
    location, 
    status, 
    sequence
) VALUES (
    'event-abc-123@my-app.com', 
    'main-cal-001', 
    '20260304T000000Z', 
    '20260310T140000Z', -- March 10, 2026 at 2:00 PM UTC
    '20260310T150000Z', -- March 10, 2026 at 3:00 PM UTC
    '🚀 Team Sync & Launch Review',
    'Reviewing the final deployment checklist for the API.',
    'Virtual / Zoom',
    'CONFIRMED',
    0
);

-- 3. Add an Alarm (VALARM) - 15 minutes before
INSERT INTO event_alarms (event_uid, action, trigger, description)
VALUES ('event-abc-123@my-app.com', 'DISPLAY', '-PT15M', 'Meeting starting soon!');

-- 4. Add an Attachment (ATTACH)
INSERT INTO event_attachments (event_uid, uri, fmttype)
VALUES ('event-abc-123@my-app.com', 'https://example.com/project-brief.pdf', 'application/pdf');