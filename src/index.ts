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

            const alarmTrigger = formData.get("alarm_trigger") as string;
            if (alarmTrigger) {
              await env.DB.prepare("INSERT INTO event_alarms (event_uid, action, trigger, description) VALUES (?, ?, ?, ?)")
                .bind(uid, formData.get("alarm_action") as string || "DISPLAY", alarmTrigger, formData.get("alarm_desc") as string || "Event Reminder").run();
            }
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
  <title>NTUAS Event Manager</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #05070a; color: #f8fafc; padding: 2rem; max-width: 900px; margin: auto; }
    h1, h2, h3 { color: #818cf8; margin-top: 0; }
    h3 { border-bottom: 1px solid #334155; padding-bottom: 5px; margin-top: 20px; color: #a5b4fc; font-size: 1.1rem; }
    .panel { background: #11141b; padding: 2rem; border-radius: 12px; border: 1px solid #ffffff10; margin-bottom: 2rem; }
    form.add-form { display: flex; flex-direction: column; gap: 15px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
    label { font-size: 0.85rem; margin-bottom: 4px; color: #94a3b8; display: block; }
    input, textarea, select { padding: 10px; border-radius: 6px; border: 1px solid #334155; background: #0f172a; color: white; width: 100%; box-sizing: border-box; }
    button { background: #4f46e5; color: white; padding: 12px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%; margin-top: 15px; transition: background 0.2s; }
    button:hover:not(:disabled) { background: #4338ca; }
    button:disabled { background: #312e81; cursor: not-allowed; opacity: 0.7; }
    .event-card { display: flex; justify-content: space-between; align-items: center; background: #0f172a; padding: 15px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #1e293b; }
    .event-info { flex-grow: 1; }
    .btn-delete { background: #e11d48; padding: 8px 15px; width: auto; margin-top: 0; margin-left: 10px; }
    .btn-delete:hover:not(:disabled) { background: #be123c; }
    .del-pass { width: 150px; display: inline-block; }
  </style>
</head>
<body>
  <h1>NTUAS Command Center</h1>
  
  <div class="panel">
    <h2>Create Comprehensive Event</h2>
    <form class="add-form" id="eventForm">
      <input type="hidden" name="action" value="add">
      
      <div class="row">
        <div><label>Admin Password*</label><input type="password" name="password" required></div>
        <div><label>Event Title (Summary)*</label><input type="text" name="summary" required></div>
      </div>

      <h3>Date & Time</h3>
      <div class="row">
        <div>
          <label>Start Date & Time (Local)*</label>
          <input type="datetime-local" id="localStart" required>
          <input type="hidden" name="dtstart" id="isoStart">
        </div>
        <div>
          <label>End Date & Time (Local)</label>
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
        <div><label>Categories</label><input type="text" name="categories" placeholder="e.g. MEETING,ASTRONOMY"></div>
        <div><label>URL / Web Link</label><input type="url" name="url" placeholder="https://..."></div>
      </div>
      
      <div class="row">
        <div>
          <label>Organizer Name</label>
          <input type="text" name="organizer_name" placeholder="e.g. NTUAS Secretary">
        </div>
        <div>
          <label>Organizer Email</label>
          <input type="email" name="organizer_email" placeholder="e.g. ntuas-secretary@e.ntu.edu.sg">
        </div>
      </div>

      <div>
        <label>Description</label>
        <textarea name="description" rows="3"></textarea>
      </div>

      <h3>Alarms & Attachments (Optional)</h3>
      <div class="row">
        <div><label>Alarm Trigger</label><input type="text" name="alarm_trigger" placeholder="-PT15M"></div>
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

  <script>
    const COORDS = { NORTH_SPINE: "1.3473;103.6803", SOUTH_SPINE: "1.3428;103.6824", THE_HIVE: "1.3436;103.6823", THE_ARC: "1.3461;103.6802", WKWSCI: "1.3438;103.6818" };
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
        { name: "ICC-LAB1 ICC CoILAB 1 - South Spine", geo: COORDS.SOUTH_SPINE }, { name: "ICC-LAB2 ICC CoILAB 2 - South Spine", geo: COORDS.SOUTH_SPINE },
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

    async function loadEvents() {
        try {
            const res = await fetch('/api/events');
            const events = await res.json();
            const container = document.getElementById('events-container');
            if (events.length === 0) return container.innerHTML = '<p>No events scheduled.</p>';
            
            container.innerHTML = events.map(e => {
                const dt = e.dtstart.replace(/(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
                return \`
                  <div class="event-card">
                    <div class="event-info">
                      <strong>\${e.summary}</strong> <span style="font-size: 0.8rem; color: #94a3b8;">(\${e.status})</span><br>
                      <small>Starts: \${new Date(dt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })}</small>
                    </div>
                    <form onsubmit="handleDelete(event, '\${e.uid}')" style="margin: 0;">
                      <input type="password" id="del-pass-\${e.uid}" placeholder="Password" required class="del-pass">
                      <button type="submit" class="btn-delete">Delete</button>
                    </form>
                  </div>\`;
            }).join('');
        } catch (err) { document.getElementById('events-container').innerHTML = '<p style="color:red;">Error loading events.</p>'; }
    }

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

    document.addEventListener('DOMContentLoaded', () => { initVenues(); loadEvents(); });
  </script>
</body>
</html>`;