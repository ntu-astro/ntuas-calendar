-- seed.sql

-- 1. Create a Test Calendar
INSERT INTO calendars (id, x_wr_calname, x_wr_timezone) 
VALUES ('main-cal-001', 'NTUAS Events and Astronomy Calendar', 'Asia/Singapore');

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
    'event-20f125f3-2838-4aeb-b650-3836d78704a3@ntuas.edu', 
    'main-cal-001', 
    '20260305T101450Z', 
    '20260213T104500Z', 
    '20260213T123000Z', 
    'Telescope Sharing Session',
    'Join us for a cozy, hands-on evening where curiosity meets the night sky. This Telescope Sharing Session is part mini crash-course, part show-and-tell, part “wait… you can see that with your own eyes?!” We’ll walk through how the telescope works, then jump straight into the practical magic: setting up, aiming, focusing, and actually observing. After the quick intro, the night becomes a shared observing playground—bring your questions, your wonder, and (if you have one) your telescope.',
    'TR+3 - North Spine',
    'CONFIRMED',
    0
);

-- 3. Add an Alarm (VALARM)
INSERT INTO event_alarms (event_uid, action, trigger, description)
VALUES ('event-20f125f3-2838-4aeb-b650-3836d78704a3@ntuas.edu', 'DISPLAY', '-P1D', 'Event Reminder');

-- 4. Add an Attachment (ATTACH)
INSERT INTO event_attachments (event_uid, uri, fmttype)
VALUES ('event-20f125f3-2838-4aeb-b650-3836d78704a3@ntuas.edu', 'https://ntuas.com/ntuas-calendar/seeds/NTUAS-EQP-MN-001.pdf', 'application/pdf');