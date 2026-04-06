PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE calendars (
    id TEXT PRIMARY KEY,
    prodid TEXT NOT NULL DEFAULT '-//Cloudflare//MyCalendar//EN',
    version TEXT NOT NULL DEFAULT '2.0',
    calscale TEXT DEFAULT 'GREGORIAN',
    x_wr_calname TEXT,
    x_wr_timezone TEXT
);
INSERT INTO "calendars" ("id","prodid","version","calscale","x_wr_calname","x_wr_timezone") VALUES('main-cal-001','-//Cloudflare//MyCalendar//EN','2.0','GREGORIAN','NTUAS Events and Astronomy Calendar','UTC');
CREATE TABLE events (
    uid TEXT PRIMARY KEY, -- REQUIRED
    calendar_id TEXT NOT NULL,
    dtstamp TEXT NOT NULL, -- REQUIRED
    dtstart TEXT NOT NULL, -- REQUIRED
    dtend TEXT,
    duration TEXT,
    summary TEXT,
    description TEXT,
    location TEXT,
    geo TEXT, -- Format: "lat;lon"
    categories TEXT,
    class TEXT DEFAULT 'PUBLIC',
    status TEXT DEFAULT 'CONFIRMED',
    url TEXT,
    organizer TEXT,
    sequence INTEGER DEFAULT 0,
    created TEXT,
    last_modified TEXT, transp TEXT DEFAULT 'OPAQUE',
    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-32bd4f2d-42ac-49d4-977f-fce60f8bf901@ntuas.edu','main-cal-001','20260304T115734Z','20250830T060000Z','20250830T130000Z',NULL,'NTUAS Annual General Meeting 2025',replace(replace('We will be having our AGM on the 30th of August! This will be the very last event hosted by the 34th Management Committee where we will reminisce and celebrate the achievements of the past academic year, and NTUAS overall! Beyond looking back, we will also be looking forward as we hold elections for the incoming 35th Management Committee.\r\n\r\nFree dinner provided to the first 30 sign-ups! Slots are limited so sign up asap\r\n\r\n(Please note that all members running for elections MUST attend AGM)\r\n\r\nSee you there!','\r',char(13)),'\n',char(10)),'LT1A - North Spine','1.3473;103.6803','Club Events','PUBLIC','CONFIRMED','https://forms.office.com/r/wwxKu34Evp',';CN=NTUAS:mailto:ntuas-secretary@e.ntu.edu.sg',0,'20260304T115734Z','20260304T115734Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-1e0f5821-ddc1-46e2-bc53-a219d5fb0303@ntuas.edu','main-cal-001','20260305T003839Z','20250811T020000Z','20250811T090000Z',NULL,'Welcome Week','Come join us for Welcome Week as we share our passion for astronomy with incoming freshmen!','North Spine Level 2 (Near CCDS)','1.3473;103.6803','Club Events','PUBLIC','CONFIRMED','',NULL,0,'20260305T003839Z','20260305T003839Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-5e432601-f6f5-424d-bf1c-e1c3743a7e61@ntuas.edu','main-cal-001','20260305T004154Z','20250812T020000Z','20250812T090000Z',NULL,'Welcome Week','Come join us for Welcome Week as we share our passion for astronomy with incoming freshmen!','North Spine Level 2 (Near CCDS)','1.3473;103.6803','Club Events','PUBLIC','CONFIRMED','',NULL,0,'20260305T004154Z','20260305T004154Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-efac65fd-aa40-4c11-ac4a-f9226b0e69b5@ntuas.edu','main-cal-001','20260305T004355Z','20250813T020000Z','20250813T070000Z',NULL,'Welcome Week','Come join us for Welcome Week as we share our passion for astronomy with incoming freshmen!','North Spine Level 2 (Near CCDS)','1.3473;103.6803','Club Events','PUBLIC','CONFIRMED','',NULL,0,'20260305T004355Z','20260305T004355Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-c45863a5-de65-4246-8670-7f567a7866f2@ntuas.edu','main-cal-001','20260305T035727Z','20250815T103000Z','20250815T130000Z',NULL,'NTUAS Welcome Tea',replace(replace('Join us for the Welcome Tea this Friday as we give you an introduction to the club and everything to expect for the upcoming academic year. Get a chance to meet the current and upcoming members, as we share our passion for astronomy and get to know each other!\r\n\r\nAdditionally, you can also expect a stargazing session if the weather permits ','\r',char(13)),'\n',char(10)),'LT1 (Von Lee Yong Miang) - North Spine','1.3473;103.6803','Club Events','PUBLIC','CONFIRMED','https://forms.office.com/r/ZdTyybNS6J',';CN=NTUAS:mailto:ntuas-secretary@e.ntu.edu.sg',0,'20260305T035727Z','20260305T035727Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-edf679bd-4fe0-4e84-9490-7cecedb6c120@ntuas.edu','main-cal-001','20260305T041544Z','20250907T150000Z','20250907T180000Z',NULL,'Total Lunar Eclipse Observation',replace(replace('We are excited to invite you to our Lunar Eclipse Observation Night! Join us for a chill evening under the stars as we gather to witness this celestial event together.\r\n\r\nLet’s enjoy the night sky as a club!\r\nSee you there!\r\n\r\n[Disclaimer] For safety reasons, this is a Members Only Event, public will be turned away','\r',char(13)),'\n',char(10)),'SRC Main Field','1.3493;103.6886','Club Events','PUBLIC','CONFIRMED','https://forms.office.com/r/nJaZr8ttgz',';CN=NTUAS:mailto:ntuas-secretary@e.ntu.edu.sg',0,'20260305T041544Z','20260305T041544Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-77f0dc0b-ca96-4bdc-852f-ed728e705bfd@ntuas.edu','main-cal-001','20260305T091402Z','20250918T013000Z','20250918T033000Z',NULL,'Fireside Chat with Professor Charles Elachi','Ever wondered what it’s like to send missions to Mars, or lead NASA’s Jet Propulsion Laboratory? Come join NTUAS for a Fireside Chat with Prof Charles Elachi!','LHN-TR+01 - The Arc','1.3461;103.6802','Club Events','PUBLIC','CONFIRMED','https://forms.office.com/r/E0HHGNTykK',';CN=NTUAS:mailto:ntuas-secretary@e.ntu.edu.sg',0,'20260305T091402Z','20260305T091402Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-ab1a5427-a625-47de-bd4a-f47f0374757e@ntuas.edu','main-cal-001','20260305T092124Z','20250926T110000Z','20250926T130000Z',NULL,'Planet in Beads?',replace(replace('Ever wondered if you could wear the planets on your wrist? \r\nCome join NTUAS for our Bracelet Workshop and design your very own planet-inspired bracelet — because every bead is a planet, and every bracelet a universe! \r\n\r\nAll materials will be provided, just bring your creativity and good vibes \r\n\r\nSee you among the stars (and beads)!','\r',char(13)),'\n',char(10)),'LHN-TR+18 - The Arc','1.3461;103.6802','Club Events','PUBLIC','CONFIRMED','https://forms.office.com/r/zZhDVE7Eah',';CN=NTUAS:mailto:ntuas-secretary@e.ntu.edu.sg',0,'20260305T092124Z','20260305T092124Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-edac469e-87cc-416c-b13e-3a17ce5f2416@ntuas.edu','main-cal-001','20260305T092909Z','20251010T110000Z','20251010T140000Z',NULL,'Under the Same Moon',replace(replace('Join us for night of stories and discovery as we explore moon myths from around the world  , learn how the moon shapes tides and eclipses , and get creative with a DIY Moon Lamp workshop!\r\n\r\nPlus, enjoy some mooncakes with us to celebrate mid autumn festival! ','\r',char(13)),'\n',char(10)),'LHN-TR+06 - The Arc','1.3461;103.6802','Club Events','PUBLIC','CONFIRMED','https://forms.cloud.microsoft/r/PKW73j3KKi',';CN=NTUAS:mailto:ntuas-secretary@e.ntu.edu.sg',0,'20260305T092909Z','20260305T092909Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-de21f43f-0433-46a6-a35c-4ebbae7e6950@ntuas.edu','main-cal-001','20260305T093543Z','20251030T110000Z','20251030T130000Z',NULL,'A Time Travelling Mission','This round, you’ll be thrown into an escape room adventure, solving puzzles, connecting clues, and uncovering a story that bends time itself.','LHN-TR+28 - The Arc','1.3461;103.6802','Club Events','PUBLIC','CONFIRMED','https://forms.office.com/r/JJj8CHSH6b',';CN=NTUAS:mailto:ntuas-secretary@e.ntu.edu.sg',0,'20260305T093543Z','20260305T093543Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-07eb2926-9df5-49b6-bd27-9215cd7fd9c9@ntuas.edu','main-cal-001','20260305T095825Z','20251107T113000Z','20251107T133000Z',NULL,'NTUAS Exam Welfare Dinner','Take a breather from the exam grind and unwind with us at our final event of the semester!','LHN-TR+37 - The Arc','1.3461;103.6802','Club Events','PUBLIC','CONFIRMED','https://forms.office.com/r/ntyag0i9Zc',';CN=NTUAS:mailto:ntuas-secretary@e.ntu.edu.sg',0,'20260305T095825Z','20260305T095825Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-3bf3c1be-2b9d-4ff1-ba23-4f0c32da1c56@ntuas.edu','main-cal-001','20260305T100456Z','20260206T104500Z','20260206T130000Z',NULL,'NTUAS x NTUMuseum : A Journey Through The History of Astronomy',replace(replace('Join us for a unique evening where science, history, and art converge.\r\n\r\nIn this special session, we explore how ancient civilizations made sense of the cosmos, from Ancient Chinese astronomy to the Renaissance. We’ll uncover how the moon guided early calendars and how our ancestors read the sky long before modern telescopes.','\r',char(13)),'\n',char(10)),'LHS-TR+6 - The Hive','1.3436;103.6823','Club Events','PUBLIC','CONFIRMED','https://forms.office.com/r/ZJKPwFUeve',';CN=NTUAS:mailto:ntuas-secretary@e.ntu.edu.sg',0,'20260305T100456Z','20260305T100456Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-20f125f3-2838-4aeb-b650-3836d78704a3@ntuas.edu','main-cal-001','20260305T101450Z','20260213T104500Z','20260213T123000Z',NULL,'Telescope Sharing Session',replace(replace('Join us for a cozy, hands-on evening where curiosity meets the night sky.\r\n\r\nThis Telescope Sharing Session is part mini crash-course, part show-and-tell, part “wait… you can see that with your own eyes?!” We’ll walk through how the telescope works, then jump straight into the practical magic: setting up, aiming, focusing, and actually observing.\r\n\r\nAfter the quick intro, the night becomes a shared observing playground—bring your questions, your wonder, and (if you have one) your telescope.','\r',char(13)),'\n',char(10)),'TR+3 - North Spine','1.3473;103.6803','Club Events','PUBLIC','CONFIRMED','https://forms.office.com/r/wr7vxDkJQP',';CN=NTUAS:mailto:ntuas-secretary@e.ntu.edu.sg',0,'20260305T101450Z','20260305T101450Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-4fa0639a-5ac2-463e-96eb-a68f801f7335@ntuas.edu','main-cal-001','20260305T121526Z','20260325T013000Z','20260325T103000Z',NULL,'AstroFair 2026 - Day 1','','MAS Atrium - SPMS','1.3421019581700795;103.68159661693286','Club Events','PUBLIC','CONFIRMED','',';CN=NTUAS:mailto:ntuas-secretary@e.ntu.edu.sg',1,'20260305T121526Z','20260305T142320Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-310a24d1-5640-4711-b86d-1aaea9ba12b5@ntuas.edu','main-cal-001','20260305T143705Z','20260313T110000Z','20260313T123000Z',NULL,'Decipher The Stars: Introduction to Stargazing',NULL,'LHN-TR+20 - The Arc','1.3475777755020193;103.6816184760447','Club Events','PUBLIC','CONFIRMED','',';CN=NTUAS:mailto:ntuas-secretary@e.ntu.edu.sg',3,'20260305T143705Z','20260405T170004Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-9df4c355-5d10-43f6-99ba-58ea58ab701a@ntuas.edu','main-cal-001','20260305T143953Z','20260322T060000Z','20260322T130000Z',NULL,'Heritage Under The Stars (Excursion with NTU Heritage Club)','','TCT-LT (LT2) - North Spine','1.3473;103.6803','Club Events','PUBLIC','CONFIRMED','https://forms.cloud.microsoft/r/CErNaPL3m8',';CN=NTUAS:mailto:ntuas-secretary@e.ntu.edu.sg',0,'20260305T143953Z','20260305T143953Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-07e78ce2-b64a-4a30-9172-9fd0b27716ec@ntuas.edu','main-cal-001','20260305T145413Z','20260326T013000Z','20260326T103000Z',NULL,'AstroFair 2026 - Day 2','','MAS Atrium - SPMS','1.3421019581700795;103.68159661693286','Club Events','PUBLIC','CONFIRMED','',';CN=NTUAS:mailto:ntuas-secretary@e.ntu.edu.sg',0,'20260305T145413Z','20260305T145413Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-26042f5e-ef7b-4515-b8ce-4f2a3f3ad34a@ntuas.edu','main-cal-001','20260305T145757Z','20260410T110000Z','20260410T130000Z',NULL,'Member Appreciation Dinner','Appreciation Dinner to members who actively participated in club sessions for the whole academic year. Revision and wrap up for event in the academic year.',NULL,NULL,'Club Events','PUBLIC','CONFIRMED','',';CN=NTUAS:mailto:ntuas-secretary@e.ntu.edu.sg',2,'20260305T145757Z','20260401T111949Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-53fa92b1-2179-4511-b7f8-57558f3a4150@ntuas.edu','main-cal-001','20260305T150646Z','20260303T111400Z','20260303T142300Z',NULL,'Total Lunar Eclipse - March 2026','Earth’s shadow will cross over the moon, creating the "blood moon" effect.','','','Astronomical Events','PUBLIC','CANCELLED','',NULL,0,'20260305T150646Z','20260305T150646Z','OPAQUE');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-905bd4d3-cd9c-4836-90f9-6dd5f4e4f533@ntuas.edu','main-cal-001','20260305T170033Z','20260812','20260814',NULL,'Perseids Meteor Shower','This year, we are in luck as the peak coincides with a New Moon, providing perfectly dark, moon-free skies for optimal viewing.','','','Astronomical Events','PUBLIC','CONFIRMED','',NULL,0,'20260305T170033Z','20260305T170033Z','TRANSPARENT');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-596b7511-6ea8-4d43-82e7-987b784b6aa3@ntuas.edu','main-cal-001','20260305T171417Z','20261213','20261215',NULL,'Geminids Meteor Shower','The Geminids are one of the strongest and most popular meteor showers each year.','','','Astronomical Events','PUBLIC','CONFIRMED','',NULL,0,'20260305T171417Z','20260305T171417Z','TRANSPARENT');
INSERT INTO "events" ("uid","calendar_id","dtstamp","dtstart","dtend","duration","summary","description","location","geo","categories","class","status","url","organizer","sequence","created","last_modified","transp") VALUES('event-80b7cf15-b26d-4721-b7e6-75dd902d90b6@ntuas.edu','main-cal-001','20260305T172012Z','20260812T153400Z','20260812T201300Z',NULL,'Total Solar Eclipse (Visible in Greenland, Iceland, and Spain)','The moon will blot out the sun in parts of Europe',NULL,NULL,'Astronomical Events','PUBLIC','CONFIRMED','',NULL,1,'20260305T172012Z','20260305T172134Z','OPAQUE');
CREATE TABLE event_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_uid TEXT NOT NULL,
    uri TEXT,           -- External link to file
    binary_data BLOB,   -- Inline data (use sparingly in D1)
    fmttype TEXT,       -- MIME type (e.g., application/pdf)
    FOREIGN KEY (event_uid) REFERENCES events(uid) ON DELETE CASCADE
);
INSERT INTO "event_attachments" ("id","event_uid","uri","binary_data","fmttype") VALUES(2,'event-20f125f3-2838-4aeb-b650-3836d78704a3@ntuas.edu','https://ntuas.com/ntuas-calendar/seeds/NTUAS-EQP-MN-001.pdf',NULL,'application/pdf');
CREATE TABLE event_alarms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_uid TEXT NOT NULL,
    action TEXT DEFAULT 'DISPLAY', -- AUDIO, DISPLAY, EMAIL
    trigger TEXT NOT NULL,          -- e.g., "-PT15M" (15 mins before)
    description TEXT,               -- Text to display
    summary TEXT,                   -- Subject for email alarms
    attendee TEXT,                  -- Who to email
    duration TEXT,                  -- For repeat alarms
    repeat INTEGER,                 -- Number of repetitions
    FOREIGN KEY (event_uid) REFERENCES events(uid) ON DELETE CASCADE
);
INSERT INTO "event_alarms" ("id","event_uid","action","trigger","description","summary","attendee","duration","repeat") VALUES(3,'event-32bd4f2d-42ac-49d4-977f-fce60f8bf901@ntuas.edu','DISPLAY','-PT12H','Event Reminder',NULL,NULL,NULL,NULL);
INSERT INTO "event_alarms" ("id","event_uid","action","trigger","description","summary","attendee","duration","repeat") VALUES(4,'event-4fa0639a-5ac2-463e-96eb-a68f801f7335@ntuas.edu','DISPLAY','-PT24H','Event Reminder',NULL,NULL,NULL,NULL);
INSERT INTO "event_alarms" ("id","event_uid","action","trigger","description","summary","attendee","duration","repeat") VALUES(6,'event-310a24d1-5640-4711-b86d-1aaea9ba12b5@ntuas.edu','DISPLAY','-P1D','Event Reminder',NULL,NULL,NULL,NULL);
INSERT INTO "event_alarms" ("id","event_uid","action","trigger","description","summary","attendee","duration","repeat") VALUES(7,'event-9df4c355-5d10-43f6-99ba-58ea58ab701a@ntuas.edu','DISPLAY','-P1D','Event Reminder',NULL,NULL,NULL,NULL);
INSERT INTO "event_alarms" ("id","event_uid","action","trigger","description","summary","attendee","duration","repeat") VALUES(8,'event-07e78ce2-b64a-4a30-9172-9fd0b27716ec@ntuas.edu','DISPLAY','-PT2H','Event Reminder',NULL,NULL,NULL,NULL);
INSERT INTO "event_alarms" ("id","event_uid","action","trigger","description","summary","attendee","duration","repeat") VALUES(9,'event-26042f5e-ef7b-4515-b8ce-4f2a3f3ad34a@ntuas.edu','DISPLAY','-P1D','Event Reminder',NULL,NULL,NULL,NULL);
INSERT INTO "event_alarms" ("id","event_uid","action","trigger","description","summary","attendee","duration","repeat") VALUES(11,'event-905bd4d3-cd9c-4836-90f9-6dd5f4e4f533@ntuas.edu','DISPLAY','-P1W','Event Reminder',NULL,NULL,NULL,NULL);
INSERT INTO "event_alarms" ("id","event_uid","action","trigger","description","summary","attendee","duration","repeat") VALUES(12,'event-596b7511-6ea8-4d43-82e7-987b784b6aa3@ntuas.edu','DISPLAY','-P1W','Event Reminder',NULL,NULL,NULL,NULL);
INSERT INTO "event_alarms" ("id","event_uid","action","trigger","description","summary","attendee","duration","repeat") VALUES(13,'event-80b7cf15-b26d-4721-b7e6-75dd902d90b6@ntuas.edu','DISPLAY','-P1W','Event Reminder',NULL,NULL,NULL,NULL);
CREATE TABLE timezone_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calendar_id TEXT NOT NULL,
    tzid TEXT NOT NULL,            -- e.g., "America/New_York"
    type TEXT NOT NULL,            -- "STANDARD" or "DAYLIGHT"
    dtstart TEXT NOT NULL,         -- Rule start date
    tzoffsetfrom TEXT NOT NULL,    -- e.g., "-0400"
    tzoffsetto TEXT NOT NULL,      -- e.g., "-0500"
    rrule TEXT,                    -- Recurrence for the rule
    tzname TEXT,                   -- e.g., "EST"
    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);
CREATE TABLE event_recurrence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_uid TEXT NOT NULL,
    rrule TEXT NOT NULL,
    exdate TEXT,
    FOREIGN KEY (event_uid) REFERENCES events(uid) ON DELETE CASCADE
);
CREATE TABLE admin_sessions (
    token TEXT PRIMARY KEY,
    csrf_token TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
INSERT INTO "admin_sessions" ("token","csrf_token","created_at","expires_at") VALUES('06b1c2f3-0623-4b0b-a319-f53e0a078dec-882e466e-b0d6-4063-b8a2-477ca7c08a4a','89522aff-db25-4c3f-afe1-0a14c51df56f-f877c397-a6b1-4828-86bd-8d3a8dfb70f6','2026-04-06T09:26:00.834Z','2026-04-07T09:26:00.834Z');
CREATE TABLE login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    attempted_at TEXT NOT NULL,
    success INTEGER NOT NULL DEFAULT 0
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('event_alarms',13);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('event_attachments',2);
CREATE INDEX idx_events_calendar_dtstart ON events(calendar_id, dtstart);
CREATE INDEX idx_events_dtstart ON events(dtstart DESC);
CREATE INDEX idx_event_alarms_event_uid ON event_alarms(event_uid);
CREATE INDEX idx_event_attachments_event_uid ON event_attachments(event_uid);
CREATE INDEX idx_login_attempts_ip_time ON login_attempts(ip, attempted_at);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);
