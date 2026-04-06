DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS admin_sessions;
DROP TABLE IF EXISTS event_alarms;
DROP TABLE IF EXISTS event_attachments;
DROP TABLE IF EXISTS timezone_rules;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS calendars;

-- 1. VCALENDAR Wrapper
CREATE TABLE calendars (
    id TEXT PRIMARY KEY,
    prodid TEXT NOT NULL DEFAULT '-//NTUAS//MyCalendar//EN',
    version TEXT NOT NULL DEFAULT '2.0',
    calscale TEXT DEFAULT 'GREGORIAN',
    x_wr_calname TEXT,
    x_wr_timezone TEXT
);

-- 2. VEVENT Core Component
CREATE TABLE events (
    uid TEXT PRIMARY KEY, 
    calendar_id TEXT NOT NULL,
    dtstamp TEXT NOT NULL, 
    dtstart TEXT NOT NULL, 
    dtend TEXT,
    duration TEXT,
    transp TEXT DEFAULT 'OPAQUE',
    summary TEXT,
    description TEXT,
    location TEXT,
    geo TEXT, 
    categories TEXT,
    class TEXT DEFAULT 'PUBLIC',
    status TEXT DEFAULT 'CONFIRMED',
    url TEXT,
    organizer TEXT,
    sequence INTEGER DEFAULT 0,
    created TEXT,
    last_modified TEXT,
    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);

-- 3. ATTACH
CREATE TABLE event_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_uid TEXT NOT NULL,
    uri TEXT,           
    binary_data BLOB,   
    fmttype TEXT,       
    FOREIGN KEY (event_uid) REFERENCES events(uid) ON DELETE CASCADE
);

-- 4. VALARM
CREATE TABLE event_alarms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_uid TEXT NOT NULL,
    action TEXT DEFAULT 'DISPLAY', 
    trigger TEXT NOT NULL,          
    description TEXT,               
    summary TEXT,                   
    duration TEXT,                  
    repeat INTEGER,                 
    FOREIGN KEY (event_uid) REFERENCES events(uid) ON DELETE CASCADE
);

-- 5. VTIMEZONE
CREATE TABLE timezone_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calendar_id TEXT NOT NULL,
    tzid TEXT NOT NULL,            
    type TEXT NOT NULL,            
    dtstart TEXT NOT NULL,         
    tzoffsetfrom TEXT NOT NULL,    
    tzoffsetto TEXT NOT NULL,      
    rrule TEXT,            
    tzname TEXT,
    FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE
);

-- 6. Admin Sessions
CREATE TABLE admin_sessions (
    token TEXT PRIMARY KEY,
    csrf_token TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

-- 7. Login Rate Limiting
CREATE TABLE login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    attempted_at TEXT NOT NULL,
    success INTEGER NOT NULL DEFAULT 0
);

-- 8. Indexes
CREATE INDEX idx_events_calendar_dtstart ON events(calendar_id, dtstart);
CREATE INDEX idx_events_dtstart ON events(dtstart DESC);
CREATE INDEX idx_event_alarms_event_uid ON event_alarms(event_uid);
CREATE INDEX idx_event_attachments_event_uid ON event_attachments(event_uid);
CREATE INDEX idx_login_attempts_ip_time ON login_attempts(ip, attempted_at);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);