export interface Env {
  DB: D1Database;
  ADMIN_PASSWORD: string;
}

const fold = (line: string): string => {
  const parts = [];
  while (line.length > 75) {
    parts.push(line.slice(0, 75));
    line = " " + line.slice(75);
  }
  parts.push(line);
  return parts.join("\r\n");
};

const toIcsDate = (dateStr: string | null): string | null => {
  if (!dateStr) return null;
  return new Date(dateStr).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ==========================================
    // 1. API: FETCH EVENTS (JSON)
    // ==========================================
    if (url.pathname === "/api/events" && request.method === "GET") {
      const { results: events } = await env.DB.prepare("SELECT * FROM events ORDER BY dtstart DESC").all();
      return Response.json(events);
    }

    // ==========================================
    // 2. ADMIN DASHBOARD & API
    // ==========================================
    if (url.pathname === "/admin") {

      if (request.method === "GET") {
        return new Response(ADMIN_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }

      if (request.method === "POST") {
        try {
          const formData = await request.formData();
          const password = formData.get("password");
          const action = formData.get("action");

          if (password !== env.ADMIN_PASSWORD) {
            return Response.json({ success: false, error: "Incorrect Admin Password." }, { status: 401 });
          }

          if (action === "add") {
            const uid = `event-${crypto.randomUUID()}@ntuas.edu`;
            const nowIcs = toIcsDate(new Date().toISOString());

            const dtstart = toIcsDate(formData.get("dtstart") as string);
            const dtend = toIcsDate(formData.get("dtend") as string);
            const summary = formData.get("summary") as string;
            const description = formData.get("description") as string;
            const location = formData.get("location") as string;
            const transp = formData.get("transp") as string || "OPAQUE";
            const geo = formData.get("geo") as string;
            const categories = formData.get("categories") as string;
            const eventClass = formData.get("class") as string || "PUBLIC";
            const status = formData.get("status") as string || "CONFIRMED";
            const eventUrl = formData.get("url") as string;

            // --- NEW ORGANIZER FORMATTING LOGIC ---
            const orgName = formData.get("organizer_name") as string;
            const orgEmail = formData.get("organizer_email") as string;
            let organizer = null;

            if (orgName && orgEmail) {
              organizer = `;CN=${orgName}:mailto:${orgEmail}`;
            } else if (orgEmail) {
              organizer = `mailto:${orgEmail}`;
            }

            await env.DB.prepare(`
              INSERT INTO events (
                uid, calendar_id, dtstamp, created, last_modified, dtstart, dtend, 
                summary, description, location, transp, geo, categories, class, status, url, organizer
              ) VALUES (?, 'main-cal-001', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              uid, nowIcs, nowIcs, nowIcs, dtstart, dtend,
              summary, description, location, transp, geo, categories, eventClass, status, eventUrl, organizer
            ).run();

            const attachUri = formData.get("attach_uri") as string;
            if (attachUri) {
              await env.DB.prepare("INSERT INTO event_attachments (event_uid, uri, fmttype) VALUES (?, ?, ?)")
                .bind(uid, attachUri, formData.get("attach_fmttype") as string || null).run();
            }

            const rawAlarmTrigger = formData.get("alarm_trigger") as string;
            if (rawAlarmTrigger) {
              const triggerMap: Record<string, string> = {
                "At time of event": "-PT0M",
                "5 minutes before": "-PT5M",
                "10 minutes before": "-PT10M",
                "15 minutes before": "-PT15M",
                "30 minutes before": "-PT30M",
                "1 hour before": "-PT1H",
                "2 hours before": "-PT2H",
                "1 day before": "-P1D",
                "2 days before": "-P2D",
                "1 week before": "-P1W"
              };
              const alarmTrigger = triggerMap[rawAlarmTrigger] || rawAlarmTrigger;

              await env.DB.prepare("INSERT INTO event_alarms (event_uid, action, trigger, description) VALUES (?, ?, ?, ?)")
                .bind(uid, formData.get("alarm_action") as string || "DISPLAY", alarmTrigger, formData.get("alarm_desc") as string || "Event Reminder").run();
            }
          }
          else if (action === "update") {
            const uid = formData.get("uid") as string;
            const summary = formData.get("summary") as string;
            const dtstart = toIcsDate(formData.get("dtstart") as string);
            const dtend = toIcsDate(formData.get("dtend") as string);
            const status = formData.get("status") as string || "CONFIRMED";
            const location = formData.get("location") as string || null;
            const geo = formData.get("geo") as string || null;
            const description = formData.get("description") as string || null;
            const nowIcs = toIcsDate(new Date().toISOString());

            await env.DB.prepare(`
              UPDATE events
              SET summary = ?, dtstart = ?, dtend = ?, status = ?, location = ?, geo = ?, description = ?, last_modified = ?, sequence = sequence + 1
              WHERE uid = ?
            `).bind(summary, dtstart, dtend, status, location, geo, description, nowIcs, uid).run();
          }
          else if (action === "delete") {
            const uid = formData.get("uid") as string;
            await env.DB.prepare("DELETE FROM events WHERE uid = ?").bind(uid).run();
          }

          return Response.json({ success: true, message: "Action completed successfully" });
        } catch (e: any) {
          return Response.json({ success: false, error: e.message || String(e) }, { status: 500 });
        }
      }
    }

    // ==========================================
    // 3. CALENDAR FEED (RFC 5545)
    // ==========================================
    if (url.pathname === "/subscribe" || url.pathname === "/calendar.ics") {
      const cal = await env.DB.prepare("SELECT * FROM calendars LIMIT 1").first<any>();
      if (!cal) return new Response("Calendar not found", { status: 404 });

      const { results: events } = await env.DB.prepare("SELECT * FROM events WHERE calendar_id = ? ORDER BY dtstart ASC").bind(cal.id).all();
      const { results: alarms } = await env.DB.prepare("SELECT * FROM event_alarms").all();
      const { results: attachments } = await env.DB.prepare("SELECT * FROM event_attachments").all();

      let icsLines = [
        "BEGIN:VCALENDAR",
        `VERSION:${cal.version || "2.0"}`,
        `PRODID:${cal.prodid}`,
        `CALSCALE:${cal.calscale || "GREGORIAN"}`,
      ];
      if (cal.x_wr_calname) icsLines.push(`X-WR-CALNAME:${cal.x_wr_calname}`);
      if (cal.x_wr_timezone) icsLines.push(`X-WR-TIMEZONE:${cal.x_wr_timezone}`);

      for (const event of events as any[]) {
        icsLines.push("BEGIN:VEVENT", `UID:${event.uid}`, `DTSTAMP:${event.dtstamp}`, `DTSTART:${event.dtstart}`);

        if (event.dtend) icsLines.push(`DTEND:${event.dtend}`);
        if (event.duration) icsLines.push(`DURATION:${event.duration}`);
        if (event.created) icsLines.push(`CREATED:${event.created}`);
        if (event.last_modified) icsLines.push(`LAST-MODIFIED:${event.last_modified}`);
        if (event.summary) icsLines.push(`SUMMARY:${event.summary}`);
        if (event.description) icsLines.push(`DESCRIPTION:${event.description.replace(/\n/g, "\\n")}`);
        if (event.location) icsLines.push(`LOCATION:${event.location}`);
        if (event.geo) icsLines.push(`GEO:${event.geo}`);
        if (event.categories) icsLines.push(`CATEGORIES:${event.categories}`);
        if (event.url) icsLines.push(`URL:${event.url}`);

        // --- ORGANIZER INJECTION ---
        if (event.organizer) icsLines.push(`ORGANIZER${event.organizer}`);

        icsLines.push(`CLASS:${event.class || "PUBLIC"}`);
        icsLines.push(`STATUS:${event.status || "CONFIRMED"}`);
        icsLines.push(`TRANSP:${event.transp || "OPAQUE"}`);

        const eventAttachments = attachments.filter((a: any) => a.event_uid === event.uid);
        for (const att of eventAttachments) {
          icsLines.push(`ATTACH${att.fmttype ? `;FMTTYPE=${att.fmttype}` : ''}:${att.uri}`);
        }

        const eventAlarms = alarms.filter((a: any) => a.event_uid === event.uid);
        for (const alarm of eventAlarms) {
          icsLines.push("BEGIN:VALARM", `ACTION:${alarm.action}`, `TRIGGER:${alarm.trigger}`);
          if (alarm.description) icsLines.push(`DESCRIPTION:${alarm.description}`);
          if (alarm.summary) icsLines.push(`SUMMARY:${alarm.summary}`);
          icsLines.push("END:VALARM");
        }

        icsLines.push("END:VEVENT");
      }

      icsLines.push("END:VCALENDAR");

      return new Response(icsLines.map(fold).join("\r\n") + "\r\n", {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": 'inline; filename="ntuas.ics"',
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*"
        },
      });
    }

    return new Response("404 - Endpoint not found.", { status: 404 });
  }
} satisfies ExportedHandler<Env>;

// ==========================================
// THE HTML DASHBOARD
// ==========================================
const ADMIN_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NTUAS Calendar Management System</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-void: #0B0E14;
      --surface-orbital: #151A23;
      --text-primary: #F8FAFC;
      --text-secondary: #94A3B8;
      --accent-indigo: #6366F1;
      --accent-hover: #4F46E5;
      --highlight-gold: #FBBF24;
      --border-dark: #222B38;
      --success: #34D399;
      --danger: #F87171;
      --danger-hover: #EF4444;
      --warning: #D97706;
      --warning-hover: #B45309;
    }

    * { box-sizing: border-box; }

    body { 
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg-void); 
      color: var(--text-primary); 
      padding: 2rem; 
      max-width: 900px; 
      margin: auto; 
      -webkit-font-smoothing: antialiased;
      line-height: 1.5;
    }
    
    h1 { 
      font-size: clamp(2rem, 4vw, 2.5rem); 
      font-weight: 800; 
      margin-top: 0; 
      margin-bottom: 2rem; 
      color: var(--text-primary);
      letter-spacing: -0.02em; 
    }
    
    h2 { 
      font-size: 1.5rem; 
      font-weight: 700; 
      margin-top: 0; 
      margin-bottom: 1.5rem; 
    }
    
    h3 { 
      font-size: 1rem; 
      font-weight: 700; 
      border-bottom: 1px solid var(--border-dark); 
      padding-bottom: 0.5rem; 
      margin-top: 2rem; 
      margin-bottom: 1rem;
      color: var(--text-secondary); 
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .panel { 
      background: var(--surface-orbital); 
      padding: 2.5rem; 
      border-radius: 20px; 
      border: 1px solid var(--border-dark); 
      margin-bottom: 2rem; 
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); 
    }
    
    form.add-form { display: flex; flex-direction: column; gap: 1.25rem; }
    .row { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }
    .row-3 { display: grid; grid-template-columns: 1fr; gap: 1.25rem; }
    
    @media (min-width: 600px) {
      .add-form .row { grid-template-columns: 1fr 1fr; }
      .add-form .row-3 { grid-template-columns: 1fr 1fr 1fr; }
      .modal form .row { grid-template-columns: 1fr !important; } /* Force single column in modal to prevent overflow */
    }
    
    label { 
      font-size: 0.8125rem; 
      font-weight: 600; 
      margin-bottom: 0.5rem; 
      color: var(--text-secondary); 
      display: block; 
    }
    
    input, textarea, select { 
      padding: 0.75rem 1rem; 
      border-radius: 8px; 
      border: 1px solid var(--border-dark); 
      background: rgba(255, 255, 255, 0.02); 
      color: var(--text-primary); 
      width: 100%; 
      max-width: 100%; /* Ensure it does not overflow */
      box-sizing: border-box; /* Ensure padding doesn't push it out */
      font-family: inherit;
      font-size: 0.9375rem;
      transition: all 0.2s;
    }
    
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--text-secondary);
      background: rgba(255, 255, 255, 0.04);
    }
    
    button { 
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--accent-indigo); 
      color: white; 
      padding: 0.875rem 1.5rem; 
      border: none; 
      border-radius: 10px; 
      cursor: pointer; 
      font-weight: 600; 
      font-size: 1rem;
      width: 100%; 
      margin-top: 1rem; 
      transition: all 0.2s ease; 
      box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.2);
    }
    
    button:hover:not(:disabled) { 
      background: var(--accent-hover); 
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.3);
    }
    
    button:disabled { 
      background: rgba(99, 102, 241, 0.4); 
      cursor: not-allowed; 
      box-shadow: none;
      transform: none;
    }
    
    .event-card { 
      display: flex; 
      flex-direction: column;
      background: transparent; 
      padding: 1.5rem 0; 
      margin-bottom: 0; 
      border-bottom: 1px solid var(--border-dark); 
      gap: 1rem; 
    }

    .event-card:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    @media (min-width: 650px) {
      .event-card {
        flex-direction: row;
        justify-content: space-between; 
        align-items: center; 
      }
    }
    
    .event-info { flex-grow: 1; min-width: 0; }
    .event-info strong { 
      display: block; 
      font-size: 1.05rem; 
      font-weight: 600; 
      margin-bottom: 0.25rem;
      color: var(--text-primary);
    }
    
    .event-status {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      background: rgba(255,255,255,0.05);
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-left: 0.5rem;
      vertical-align: middle;
      color: var(--text-secondary);
    }

    .event-card form { 
      flex-shrink: 0; 
      display: flex; 
      align-items: center; 
      gap: 0.75rem; 
      margin: 0; 
    }
    
    .btn-delete { 
      background: var(--danger); 
      padding: 0.6rem 1rem; 
      width: auto; 
      margin-top: 0; 
      font-size: 0.875rem;
      box-shadow: none;
    }
    
    .btn-delete:hover:not(:disabled) { 
      background: var(--danger-hover); 
      box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2);
    }
    
    .btn-edit { 
      background: transparent; 
      border: 1px solid var(--border-dark);
      color: var(--text-secondary);
      padding: 0.6rem 1rem; 
      width: auto; 
      margin-top: 0;
      font-size: 0.875rem;
      box-shadow: none;
    }
    
    .btn-edit:hover:not(:disabled) { 
      background: rgba(255,255,255,0.05); 
      color: var(--text-primary);
      border-color: var(--text-secondary);
      transform: none;
      box-shadow: none;
    }
    
    .del-pass { width: 140px; padding: 0.6rem 0.75rem; }
    
    .modal-overlay { 
      display: none; 
      position: fixed; 
      inset: 0; 
      background: rgba(0, 0, 0, 0.75); 
      backdrop-filter: blur(4px);
      z-index: 1000; 
      align-items: center; 
      justify-content: center; 
    }
    
    .modal-overlay.open { display: flex; }
    
    .modal { 
      background: var(--surface-orbital); 
      border: 1px solid var(--border-dark); 
      border-radius: 20px; 
      padding: 2.5rem; 
      width: 90%; 
      max-width: 520px; 
      position: relative; 
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    
    .modal h2 { margin-top: 0; }
    
    .modal-close { 
      position: absolute; 
      top: 1.25rem; 
      right: 1.25rem; 
      background: none; 
      border: none; 
      color: var(--text-secondary); 
      font-size: 1.5rem; 
      cursor: pointer; 
      width: auto; 
      padding: 0.25rem 0.5rem; 
      margin: 0; 
      box-shadow: none;
    }
    
    .modal-close:hover { 
      color: var(--text-primary); 
      background: rgba(255,255,255,0.05); 
      border-radius: 6px;
      transform: none;
    }
    
    .modal form { display: flex; flex-direction: column; gap: 1.25rem; }
  </style>
</head>
<body>
  <h1>Admin Dashboard</h1>
  
  <div class="panel">
    <h2>Create Comprehensive Event</h2>
    <form class="add-form" id="eventForm">
      <input type="hidden" name="action" value="add">
      
      <div class="row">
        <div><label>Admin Password*</label><input type="password" name="password" required></div>
        <div><label>Event Title (Summary)*</label><input type="text" name="summary" required></div>
      </div>

      <h3>Date &amp; Time</h3>
      <div class="row">
        <div>
          <label>Start Date &amp; Time (Local)*</label>
          <input type="datetime-local" id="localStart" required>
          <input type="hidden" name="dtstart" id="isoStart">
        </div>
        <div>
          <label>End Date &amp; Time (Local)</label>
          <input type="datetime-local" id="localEnd">
          <input type="hidden" name="dtend" id="isoEnd">
        </div>
      </div>
      <div>
         <label>Timezone Override</label>
         <select id="tzSelect">
            <option value="+08:00" selected>Singapore Time (SGT / +08:00)</option>
            <option value="+00:00">Coordinated Universal Time (UTC)</option>
         </select>
      </div>

      <h3>Core Metadata</h3>
      <div class="row">
        <div>
          <label>Location (Search NTU Facilities)</label>
          <input list="ntu-venues" id="locationInput" name="location" placeholder="e.g. LKC-LT, TR+10...">
          <datalist id="ntu-venues"></datalist>
        </div>
        <div>
          <label>Geo (Lat;Lon)</label>
          <input type="text" id="geoInput" name="geo" placeholder="Auto-fills from location">
        </div>
      </div>
      
      <div class="row-3">
        <div>
          <label>Status</label>
          <select name="status">
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="TENTATIVE">TENTATIVE</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
        <div>
          <label>Transparency</label>
          <select name="transp">
            <option value="OPAQUE">OPAQUE (Busy)</option>
            <option value="TRANSPARENT">TRANSPARENT (Free)</option>
          </select>
        </div>
        <div>
          <label>Class</label>
          <select name="class">
            <option value="PUBLIC">PUBLIC</option>
            <option value="PRIVATE">PRIVATE</option>
          </select>
        </div>
      </div>

      <div class="row">
        <div>
          <label>Categories</label>
          <input list="category-list" type="text" name="categories" placeholder="e.g. Club Events,Astronomical Events">
          <datalist id="category-list">
            <option value="Club Events">
            <option value="Astronomical Events">
          </datalist>
        </div>
        <div><label>URL / Web Link</label><input type="url" name="url" placeholder="https://..."></div>
      </div>
      
      <div class="row">
        <div>
          <label>Organizer Name</label>
          <input list="organizer-list" type="text" name="organizer_name" placeholder="e.g. NTUAS">
          <datalist id="organizer-list">
            <option value="NTUAS">
          </datalist>
        </div>
        <div>
          <label>Organizer Email</label>
          <input list="organizer-email-list" type="email" name="organizer_email" placeholder="e.g. ntuas-secretary@e.ntu.edu.sg">
          <datalist id="organizer-email-list">
            <option value="ntuas-secretary@e.ntu.edu.sg">
          </datalist>
        </div>
      </div>

      <div>
        <label>Description</label>
        <textarea name="description" rows="3"></textarea>
      </div>

      <h3>Alarms &amp; Attachments (Optional)</h3>
      <div class="row">
        <div>
          <label>Alarm Trigger</label>
          <input list="alarm-trigger-list" type="text" name="alarm_trigger" placeholder="e.g. 15 minutes before">
          <datalist id="alarm-trigger-list">
            <option value="At time of event">
            <option value="5 minutes before">
            <option value="10 minutes before">
            <option value="15 minutes before">
            <option value="30 minutes before">
            <option value="1 hour before">
            <option value="2 hours before">
            <option value="1 day before">
            <option value="2 days before">
            <option value="1 week before">
          </datalist>
        </div>
        <div>
          <label>Alarm Action</label>
          <select name="alarm_action">
            <option value="DISPLAY">DISPLAY</option>
            <option value="AUDIO">AUDIO</option>
          </select>
        </div>
      </div>
      <div class="row">
        <div><label>Attachment URI</label><input type="text" name="attach_uri" placeholder="https://..."></div>
        <div><label>Attachment Format Type</label><input type="text" name="attach_fmttype" placeholder="application/pdf"></div>
      </div>

      <button type="submit" id="submitBtn">Publish to Calendar Feed</button>
    </form>
  </div>

  <div class="panel">
    <h2>Active Events Feed</h2>
    <div id="events-container"><p>Loading events...</p></div>
  </div>

  <div class="modal-overlay" id="editModal">
    <div class="modal">
      <button class="modal-close" onclick="closeEditModal()">&times;</button>
      <h2>Edit Event</h2>
      <form id="editForm" onsubmit="handleEdit(event)">
        <input type="hidden" name="action" value="update">
        <input type="hidden" name="uid" id="edit-uid">
        <div>
          <label>Event Title (Summary)*</label>
          <input type="text" name="summary" id="edit-summary" required>
        </div>
        <div class="row">
          <div>
            <label>Start Date &amp; Time*</label>
            <input type="datetime-local" id="edit-local-start" required>
            <input type="hidden" name="dtstart" id="edit-iso-start">
          </div>
          <div>
            <label>End Date &amp; Time</label>
            <input type="datetime-local" id="edit-local-end">
            <input type="hidden" name="dtend" id="edit-iso-end">
          </div>
        </div>
        <div>
          <label>Status</label>
          <select name="status" id="edit-status">
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="TENTATIVE">TENTATIVE</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
        <div>
          <label>Admin Password*</label>
          <input type="password" name="password" id="edit-password" required autocomplete="current-password">
        </div>

        <div id="edit-more-details" style="display: none; border-top: 1px solid var(--border-dark); padding-top: 1rem; margin-top: 0.5rem;">
          <div class="row">
            <div>
              <label>Location</label>
              <input list="ntu-venues" name="location" id="edit-location" placeholder="e.g. LKC-LT...">
            </div>
            <div>
              <label>Geo (Lat;Lon)</label>
              <input type="text" name="geo" id="edit-geo" placeholder="Auto-fills from location">
            </div>
          </div>
          <div style="margin-top: 1.25rem;">
            <label>Description</label>
            <textarea name="description" id="edit-description" rows="3"></textarea>
          </div>
        </div>

        <button type="button" id="editMoreBtn" onclick="toggleMoreDetails()" style="background: transparent; border: 1px solid var(--border-dark); color: var(--text-secondary); margin-top: 0; box-shadow: none;">Show More Details</button>
        <button type="submit" id="editSubmitBtn">Save Changes</button>
      </form>
    </div>
  </div>

  <script>
    const COORDS = { NORTH_SPINE: "1.3473;103.6803", SOUTH_SPINE: "1.3428;103.6824", THE_HIVE: "1.3436;103.6823", THE_ARC: "1.3475777755020193;103.6816184760447", WKWSCI: "1.3438;103.6818", EMB: "1.3446803707174764;103.67849230240778" };
    const venues = [
        { name: "LT1 (Von Lee Yong Miang) - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "TCT-LT (LT2) - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT3 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT4 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT5 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT6 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT7 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT8 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT9 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT10 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT11 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT12 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT13 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT14 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT15 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT16 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT17 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT18 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT19 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT19A - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT1A - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LT20 - North Spine", geo: COORDS.NORTH_SPINE },
        { name: "LT2A - North Spine", geo: COORDS.NORTH_SPINE }, { name: "LHSLT- - The Hive", geo: COORDS.THE_HIVE },
        { name: "LT22 - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "LT23 - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "LT24 - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "LT25 - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "LT26 - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "LT27 - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "LT28 - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "LT29 - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "LKC-LT (Lee Kong Chian) - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "LF-LT (Lee Foundation) - WKWSCI", geo: COORDS.WKWSCI },
        { name: "LHNLT- - The Arc", geo: COORDS.THE_ARC }, { name: "RECEP RM - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "FOYER - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "EXHIB GALY - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "FN RM - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "S3.2 ESR4 - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "S3.2 ESR3 - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "TRX122 - South Spine", geo: COORDS.SOUTH_SPINE },
        { name: "ICC-LAB1 ICC CoILAB 1 - Experimental Medicine Building", geo: COORDS.EMB }, { name: "ICC-LAB2 ICC CoILAB 2 - Experimental Medicine Building", geo: COORDS.EMB },
        { name: "TRX43 - North Spine", geo: COORDS.NORTH_SPINE }, { name: "TRX44 - North Spine", geo: COORDS.NORTH_SPINE }
    ];
    [1,2,3,4,5,6,7,8,9,15,16,17,18,19,20,21,22,23,29,30,31,32,33,34,35,36,37].forEach(n => venues.push({ name: \`TR+\${n} - North Spine\`, geo: COORDS.NORTH_SPINE }));
    [7,8,9].forEach(n => venues.push({ name: \`CS-TR+\${n} - WKWSCI\`, geo: COORDS.WKWSCI }));
    [61,62,63,64,65,66,67,68,69,77,78,79,80,87,88,89,90,91,92,93,94,95,96,102,103,106,107,108,109,110,111,112,113,114,120,121,151,152,153,154,159,160,165,166].forEach(n => venues.push({ name: \`TR+\${n} - South Spine\`, geo: COORDS.SOUTH_SPINE }));
    for(let i=1;i<=56;i++) venues.push({ name: \`LHS-TR+\${i} - The Hive\`, geo: COORDS.THE_HIVE });
    for(let i=1;i<=56;i++) venues.push({ name: \`LHN-TR+\${i<10?'0'+i:i} - The Arc\`, geo: COORDS.THE_ARC });

    function initVenues() {
        const list = document.getElementById('ntu-venues');
        venues.forEach(v => { const opt = document.createElement('option'); opt.value = v.name; list.appendChild(opt); });
        document.getElementById('locationInput').addEventListener('input', (e) => {
            const match = venues.find(v => v.name === e.target.value);
            if (match) document.getElementById('geoInput').value = match.geo;
        });
    }

    let allEvents = [];
    let currentPage = 1;
    const EVENTS_PER_PAGE = 10;

    async function loadEvents() {
        try {
            const res = await fetch('/api/events');
            allEvents = await res.json();
            currentPage = 1;
            renderEventsPage();
        } catch (err) { document.getElementById('events-container').innerHTML = '<p style="color:red;">Error loading events.</p>'; }
    }

    function renderEventsPage() {
        const container = document.getElementById('events-container');
        if (allEvents.length === 0) return container.innerHTML = '<p>No events scheduled.</p>';

        const totalPages = Math.ceil(allEvents.length / EVENTS_PER_PAGE);
        const startIndex = (currentPage - 1) * EVENTS_PER_PAGE;
        const endIndex = startIndex + EVENTS_PER_PAGE;
        const pageEvents = allEvents.slice(startIndex, endIndex);

        const html = pageEvents.map(e => {
            const dt = e.dtstart.replace(/(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
            return \`
                  <div class="event-card">
                    <div class="event-info">
                      <strong>\${e.summary}</strong> <span class="event-status">\${e.status}</span><br>
                      <small style="color: var(--text-secondary); display: block; margin-top: 0.25rem;">Starts: \${new Date(dt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}</small>
                    </div>
                    <button class="btn-edit" 
                      data-uid="\${e.uid}" 
                      data-summary="\${(e.summary || '').replace(/"/g, '&quot;')}" 
                      data-dtstart="\${e.dtstart}" 
                      data-dtend="\${e.dtend || ''}" 
                      data-status="\${e.status}"
                      data-location="\${(e.location || '').replace(/"/g, '&quot;')}"
                      data-geo="\${e.geo || ''}"
                      data-description="\${(e.description || '').replace(/"/g, '&quot;')}"
                    >Edit</button>
                    <form onsubmit="handleDelete(event, '\${e.uid}')">
                      <input type="password" id="del-pass-\${e.uid}" placeholder="Password" required class="del-pass">
                      <button type="submit" class="btn-delete">Delete</button>
                    </form>
                  </div>\`;
        }).join('');

        const paginationHtml = totalPages > 1 ? \`
          <div class="pagination-controls" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-dark);">
            <button onclick="changePage(-1)" \${currentPage === 1 ? 'disabled' : ''} style="width: auto; margin-top: 0; background: transparent; border: 1px solid var(--border-dark); color: \${currentPage === 1 ? 'var(--border-dark)' : 'var(--text-secondary)'}; padding: 0.5rem 1rem; box-shadow: none;">Previous</button>
            <span style="color: var(--text-secondary); font-size: 0.875rem; font-weight: 600;">Page \${currentPage} of \${totalPages}</span>
            <button onclick="changePage(1)" \${currentPage === totalPages ? 'disabled' : ''} style="width: auto; margin-top: 0; background: transparent; border: 1px solid var(--border-dark); color: \${currentPage === totalPages ? 'var(--border-dark)' : 'var(--text-secondary)'}; padding: 0.5rem 1rem; box-shadow: none;">Next</button>
          </div>
        \` : '';

        container.innerHTML = html + paginationHtml;

        // Attach edit button handlers
        container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                openEditModal(
                  btn.dataset.uid, 
                  btn.dataset.summary, 
                  btn.dataset.dtstart, 
                  btn.dataset.dtend, 
                  btn.dataset.status,
                  btn.dataset.location,
                  btn.dataset.geo,
                  btn.dataset.description
                );
            });
        });
    }

    window.changePage = function(delta) {
        currentPage += delta;
        renderEventsPage();
    };

    document.getElementById('eventForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const btn = document.getElementById('submitBtn');
        btn.innerText = "Publishing..."; btn.disabled = true;

        const tz = document.getElementById('tzSelect').value;
        const start = document.getElementById('localStart').value;
        const end = document.getElementById('localEnd').value;
        if(start) document.getElementById('isoStart').value = start + tz;
        if(end) document.getElementById('isoEnd').value = end + tz;

        try {
            const res = await fetch('/admin', { method: 'POST', body: new FormData(form) });
            const data = await res.json();
            if (!data.success) alert("Error: " + data.error);
            else { alert("Success!"); form.reset(); loadEvents(); }
        } catch (err) { alert("Network Error"); } 
        finally { btn.innerText = "Publish to Calendar Feed"; btn.disabled = false; }
    });

    async function handleDelete(e, uid) {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        const formData = new FormData();
        formData.append("action", "delete");
        formData.append("uid", uid);
        formData.append("password", document.getElementById(\`del-pass-\${uid}\`).value);

        try {
            const res = await fetch('/admin', { method: 'POST', body: formData });
            const data = await res.json();
            if (!data.success) alert("Error: " + data.error);
            else loadEvents();
        } catch (err) { alert("Network Error"); }
        finally { btn.disabled = false; }
    }

    function openEditModal(uid, summary, dtstart, dtend, status, location, geo, description) {
        document.getElementById('edit-uid').value = uid;
        document.getElementById('edit-summary').value = summary;
        document.getElementById('edit-status').value = status;
        document.getElementById('edit-location').value = location || '';
        document.getElementById('edit-geo').value = geo || '';
        document.getElementById('edit-description').value = description || '';

        // Reset more details toggle
        document.getElementById('edit-more-details').style.display = 'none';
        document.getElementById('editMoreBtn').innerText = 'Show More Details';

        // Convert ICS date (e.g. 20260315T100000Z) to datetime-local format
        function icsToLocal(icsDate) {
            if (!icsDate) return '';
            const iso = icsDate.replace(/(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
            const d = new Date(iso);
            // Format as local datetime-local value in SGT (+8)
            const offset = d.getTimezoneOffset();
            const local = new Date(d.getTime() - offset * 60000);
            return local.toISOString().slice(0, 16);
        }
        document.getElementById('edit-local-start').value = icsToLocal(dtstart);
        document.getElementById('edit-local-end').value = icsToLocal(dtend);

        document.getElementById('editModal').classList.add('open');
    }

    function closeEditModal() {
        document.getElementById('editModal').classList.remove('open');
        document.getElementById('editForm').reset();
    }

    window.toggleMoreDetails = function() {
        const div = document.getElementById('edit-more-details');
        const btn = document.getElementById('editMoreBtn');
        if (div.style.display === 'none') {
            div.style.display = 'block';
            btn.innerText = 'Hide More Details';
        } else {
            div.style.display = 'none';
            btn.innerText = 'Show More Details';
        }
    };

    async function handleEdit(e) {
        e.preventDefault();
        const btn = document.getElementById('editSubmitBtn');
        btn.innerText = 'Saving...'; btn.disabled = true;

        const start = document.getElementById('edit-local-start').value;
        const end = document.getElementById('edit-local-end').value;
        document.getElementById('edit-iso-start').value = start ? start + '+08:00' : '';
        document.getElementById('edit-iso-end').value = end ? end + '+08:00' : '';

        try {
            const res = await fetch('/admin', { method: 'POST', body: new FormData(document.getElementById('editForm')) });
            const data = await res.json();
            if (!data.success) alert('Error: ' + data.error);
            else { closeEditModal(); loadEvents(); }
        } catch (err) { alert('Network Error'); }
        finally { btn.innerText = 'Save Changes'; btn.disabled = false; }
    }

    // Link location to geo in edit modal
    document.getElementById('edit-location').addEventListener('input', (e) => {
        const match = venues.find(v => v.name === e.target.value);
        if (match) document.getElementById('edit-geo').value = match.geo;
    });

    // Close modal on backdrop click
    document.getElementById('editModal').addEventListener('click', function(e) {
        if (e.target === this) closeEditModal();
    });

    document.addEventListener('DOMContentLoaded', () => { initVenues(); loadEvents(); });
  </script>
</body>
</html>`;