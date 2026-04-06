# Entity Relationship (ER) Diagram

This document describes the database entities and relationships defined in `schema.sql`.

## Mermaid ERD

```mermaid
erDiagram
    CALENDARS ||--o{ EVENTS : "has"
    CALENDARS ||--o{ TIMEZONE_RULES : "defines"
    EVENTS ||--o{ EVENT_ALARMS : "triggers"
    EVENTS ||--o{ EVENT_ATTACHMENTS : "includes"

    CALENDARS {
        text id PK
        text prodid
        text version
        text calscale
        text x_wr_calname
        text x_wr_timezone
    }

    EVENTS {
        text uid PK
        text calendar_id FK
        text dtstamp
        text dtstart
        text dtend
        text duration
        text transp
        text summary
        text description
        text location
        text geo
        text categories
        text class
        text status
        text url
        text organizer
        integer sequence
        text created
        text last_modified
    }

    EVENT_ATTACHMENTS {
        integer id PK
        text event_uid FK
        text uri
        blob binary_data
        text fmttype
    }

    EVENT_ALARMS {
        integer id PK
        text event_uid FK
        text action
        text trigger
        text description
        text summary
        text duration
        integer repeat
    }

    TIMEZONE_RULES {
        integer id PK
        text calendar_id FK
        text tzid
        text type
        text dtstart
        text tzoffsetfrom
        text tzoffsetto
        text rrule
        text tzname
    }

    ADMIN_SESSIONS {
        text token PK
        text csrf_token
        text created_at
        text expires_at
    }

    LOGIN_ATTEMPTS {
        integer id PK
        text ip
        text attempted_at
        integer success
    }
```

## Relationship Summary

- `calendars (1) -> (many) events` via `events.calendar_id -> calendars.id`
- `calendars (1) -> (many) timezone_rules` via `timezone_rules.calendar_id -> calendars.id`
- `events (1) -> (many) event_alarms` via `event_alarms.event_uid -> events.uid`
- `events (1) -> (many) event_attachments` via `event_attachments.event_uid -> events.uid`

## Notes

- Foreign-key relations use `ON DELETE CASCADE`, so deleting a calendar removes dependent events/timezone rules, and deleting an event removes its alarms/attachments.
- `admin_sessions` and `login_attempts` are operational security tables and are intentionally independent from calendar content entities.

## Alternative Diagram Source (DBML-Style)

```text
notation crows-foot
title iCalendar System Data Model

// Calendar domain
calendars [icon: calendar, color: blue] {
  id string pk
  prodid string
  version string
  calscale string
  x_wr_calname string
  x_wr_timezone string
}

events [icon: clock, color: green] {
  uid string pk
  calendar_id string fk
  dtstamp string
  dtstart string
  dtend string
  duration string
  transp string
  summary string
  description string
  location string
  geo string
  categories string
  class string
  status string
  url string
  organizer string
  sequence integer
  created string
  last_modified string
}

event_attachments [icon: paperclip, color: gray] {
  id integer pk
  event_uid string fk
  uri string
  binary_data blob
  fmttype string
}

event_alarms [icon: bell, color: orange] {
  id integer pk
  event_uid string fk
  action string
  trigger string
  description string
  summary string
  duration string
  repeat integer
}

timezone_rules [icon: globe, color: purple] {
  id integer pk
  calendar_id string fk
  tzid string
  type string
  dtstart string
  tzoffsetfrom string
  tzoffsetto string
  rrule string
  tzname string
}

// Admin domain
admin_sessions [icon: shield, color: red] {
  token string pk
  csrf_token string
  created_at string
  expires_at string
}

login_attempts [icon: alert-triangle, color: yellow] {
  id integer pk
  ip string
  attempted_at string
  success integer
}

// Relationships
events.calendar_id > calendars.id
event_attachments.event_uid > events.uid
event_alarms.event_uid > events.uid
timezone_rules.calendar_id > calendars.id
```