export const ADMIN_HTML = (csrfToken: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="${csrfToken}">
  <title>NTUAS Calendar Management System</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      /* Notion blue primary (DESIGN.md link-blue token) */
      --color-primary: #0075de;
      --color-primary-pressed: #005bab;
      --on-primary: #ffffff;
      --link-blue: #0075de;
      --link-blue-pressed: #005bab;

      /* Surfaces */
      --color-canvas: #ffffff;
      --color-surface: #f6f5f4;
      --color-surface-soft: #fafaf9;
      --color-hairline: #e5e3df;
      --color-hairline-soft: #ede9e4;
      --color-hairline-strong: #c8c4be;

      /* Warm-charcoal text hierarchy */
      --color-ink: #1a1a1a;
      --color-charcoal: #37352f;
      --color-slate: #5d5b54;
      --color-steel: #787671;
      --color-stone: #a4a097;
      --color-muted: #bbb8b1;

      /* Card tints */
      --tint-lavender: #e6e0f5;
      --tint-rose: #fde0ec;
      --tint-mint: #d9f3e1;
      --tint-peach: #ffe8d4;

      /* Semantic */
      --color-success: #1aae39;
      --color-warning: #dd5b00;
      --color-error: #e03131;

      /* Legacy aliases */
      --bg-main: var(--color-canvas);
      --bg-sidebar: var(--color-surface);
      --bg-hover: #efedea;
      --text-primary: var(--color-charcoal);
      --text-secondary: var(--color-slate);
      --text-tertiary: var(--color-steel);
      --accent-blue: var(--link-blue);
      --accent-blue-hover: var(--link-blue-pressed);
      --accent-blue-light: var(--tint-lavender);
      --border: var(--color-hairline);
      --border-strong: var(--color-hairline-strong);
      --success: var(--color-success);
      --danger: var(--color-error);
      --danger-hover: #b71c1c;
      --danger-light: var(--tint-rose);
      --warning: var(--color-warning);

      /* Radius (DESIGN.md rounded.*) */
      --radius-xs: 4px;
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-full: 9999px;
    }

    * { box-sizing: border-box; }

    body {
      font-family: 'Notion Sans', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background-color: var(--color-surface);
      color: var(--color-charcoal);
      padding: 0;
      margin: 0;
      -webkit-font-smoothing: antialiased;
      line-height: 1.5;
      font-size: 14px;
    }

    .admin-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 24px;
      height: 48px;
      background: var(--bg-sidebar);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .admin-header h1 {
      font-size: 14px;
      font-weight: 600;
      margin: 0;
      color: var(--text-primary);
      letter-spacing: -0.01em;
    }

    .logout-link {
      color: var(--text-tertiary);
      font-size: 12px;
      font-weight: 500;
      text-decoration: none;
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      transition: all 0.15s;
    }

    .logout-link:hover {
      color: var(--text-secondary);
      background: var(--bg-hover);
    }

    .admin-body {
      max-width: 860px;
      margin: 0 auto;
      padding: 24px;
    }

    h2 {
      font-size: 16px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 16px;
      color: var(--text-primary);
    }

    /* DESIGN.md micro-uppercase */
    h3 {
      font-size: 11px;
      font-weight: 600;
      border-bottom: 1px solid var(--color-hairline);
      padding-bottom: 6px;
      margin-top: 20px;
      margin-bottom: 12px;
      color: var(--color-steel);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* DESIGN.md card-feature — 12px rounded canvas card */
    .panel {
      background: var(--color-canvas);
      padding: 24px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-hairline);
      margin-bottom: 20px;
    }

    form.add-form { display: flex; flex-direction: column; gap: 16px; }
    .row { display: grid; grid-template-columns: 1fr; gap: 16px; }
    .row-3 { display: grid; grid-template-columns: 1fr; gap: 16px; }

    @media (min-width: 600px) {
      .add-form .row { grid-template-columns: 1fr 1fr; }
      .add-form .row-3 { grid-template-columns: 1fr 1fr 1fr; }
      .modal form .row { grid-template-columns: 1fr !important; }
    }

    label {
      font-size: 12px;
      font-weight: 500;
      margin-bottom: 4px;
      color: var(--text-tertiary);
      display: block;
    }

    /* DESIGN.md text-input — 44px height, hairline-strong border */
    input, textarea, select {
      padding: 10px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-hairline-strong);
      background: var(--color-canvas);
      color: var(--color-ink);
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      font-family: inherit;
      font-size: 14px;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    /* text-input-focused — blue ring */
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(0, 117, 222, 0.18);
    }

    /* DESIGN.md button-primary — signature purple CTA */
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary);
      color: var(--on-primary);
      padding: 10px 18px;
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      font-weight: 500;
      font-size: 14px;
      line-height: 1.3;
      font-family: inherit;
      width: 100%;
      margin-top: 8px;
      transition: background 0.15s;
    }

    button:hover:not(:disabled) {
      background: var(--color-primary-pressed);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .event-card {
      display: flex;
      flex-direction: column;
      background: transparent;
      padding: 14px 0;
      margin-bottom: 0;
      border-bottom: 1px solid var(--border);
      gap: 10px;
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
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 2px;
      color: var(--text-primary);
    }

    .event-status {
      display: inline-block;
      padding: 2px 6px;
      background: var(--bg-sidebar);
      border-radius: var(--radius-sm);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      margin-left: 6px;
      vertical-align: middle;
      color: var(--text-secondary);
    }

    .event-card form {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0;
    }

    /* DESIGN.md badge-tag-* style — soft tinted pill, strong tone for destructive intent */
    .btn-delete {
      background: var(--tint-rose);
      color: #a02e6d;
      padding: 8px 14px;
      width: auto;
      margin-top: 0;
      font-size: 13px;
      border-radius: var(--radius-md);
    }

    .btn-delete:hover:not(:disabled) {
      background: var(--color-error);
      color: var(--on-primary);
    }

    /* DESIGN.md button-secondary — outlined rectangular */
    .btn-edit {
      background: transparent;
      border: 1px solid var(--color-hairline-strong);
      color: var(--color-charcoal);
      padding: 8px 14px;
      width: auto;
      margin-top: 0;
      font-size: 13px;
      border-radius: var(--radius-md);
    }

    .btn-edit:hover:not(:disabled) {
      background: var(--color-surface);
      color: var(--color-ink);
      border-color: var(--color-hairline-strong);
    }

    .del-pass { width: 120px; padding: 6px 8px; font-size: 12px; }

    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.25);
      backdrop-filter: blur(2px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }

    .modal-overlay.open { display: flex; }

    /* DESIGN.md card-base, elevation 4 (modal shadow) */
    .modal {
      background: var(--color-canvas);
      border: 1px solid var(--color-hairline);
      border-radius: var(--radius-lg);
      padding: 28px;
      width: 90%;
      max-width: 520px;
      position: relative;
      box-shadow: rgba(15, 15, 15, 0.16) 0px 16px 48px -8px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .modal h2 { margin-top: 0; }

    .modal::-webkit-scrollbar { width: 6px; }
    .modal::-webkit-scrollbar-track { background: transparent; }
    .modal::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 3px; }
    .modal::-webkit-scrollbar-thumb:hover { background: var(--text-tertiary); }

    .modal-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      color: var(--text-tertiary);
      font-size: 18px;
      cursor: pointer;
      width: auto;
      padding: 4px 8px;
      margin: 0;
    }

    .modal-close:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
      border-radius: var(--radius-sm);
    }

    .modal form { display: flex; flex-direction: column; gap: 16px; }

    .toggle-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 4px;
    }
    .toggle-row label.toggle-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0;
      cursor: pointer;
      user-select: none;
    }
    .toggle-switch {
      position: relative;
      width: 40px;
      height: 22px;
      flex-shrink: 0;
    }
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }
    .toggle-switch .slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      width: auto;
      height: auto;
      margin: 0;
      padding: 0;
      display: block;
      background: var(--border-strong);
      border-radius: 22px;
      transition: background 0.2s ease;
      font-size: 0;
      color: transparent;
    }
    .toggle-switch .slider::before {
      content: '';
      position: absolute;
      height: 16px;
      width: 16px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    }
    /* Toggle on = signature purple */
    .toggle-switch input:checked + .slider {
      background: var(--color-primary);
    }
    .toggle-switch input:checked + .slider::before {
      transform: translateX(18px);
    }
    /* Soft-blue tag — harmonizes with primary */
    .all-day-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #dcecfa;
      color: #003f7a;
      border-radius: var(--radius-sm);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      margin-left: 6px;
      vertical-align: middle;
    }
  </style>
</head>
<body>
  <div class="admin-header">
    <h1>Admin Dashboard</h1>
    <form method="POST" action="/admin/logout" style="display:inline">
      <input type="hidden" name="_csrf" value="${csrfToken}">
      <button type="submit" class="logout-link">Logout</button>
    </form>
  </div>
  <div class="admin-body">
  
  <div class="panel">
    <h2>Create Event</h2>
    <form class="add-form" id="eventForm">
      <input type="hidden" name="action" value="add">
      <input type="hidden" name="_csrf" value="${csrfToken}">
      
      <div class="row">
        <div><label>Event Title*</label><input type="text" name="summary" required></div>
      </div>

      <h3>Date &amp; Time</h3>
      <div class="toggle-row">
        <div class="toggle-switch">
          <input type="checkbox" id="allDayToggle">
          <label class="slider" for="allDayToggle"></label>
        </div>
        <label class="toggle-label" for="allDayToggle">All Day Event</label>
      </div>
      <input type="hidden" name="is_all_day" id="isAllDayInput" value="0">
      <div class="row">
        <div>
          <label id="startLabel">Start Date &amp; Time (Local)*</label>
          <input type="datetime-local" id="localStart" required>
          <input type="hidden" name="dtstart" id="isoStart">
        </div>
        <div>
          <label id="endLabel">End Date &amp; Time (Local)</label>
          <input type="datetime-local" id="localEnd">
          <input type="hidden" name="dtend" id="isoEnd">
        </div>
      </div>
      <div id="tzRow">
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

  </div>

  <div class="modal-overlay" id="editModal">
    <div class="modal">
      <button class="modal-close" id="modalCloseBtn" type="button">&times;</button>
      <h2>Edit Event</h2>
      <form id="editForm">
        <input type="hidden" name="action" value="update">
        <input type="hidden" name="_csrf" value="${csrfToken}">
        <input type="hidden" name="uid" id="edit-uid">
        <div>
          <label>Event Title (Summary)*</label>
          <input type="text" name="summary" id="edit-summary" required>
        </div>
        <div class="toggle-row">
          <div class="toggle-switch">
            <input type="checkbox" id="editAllDayToggle">
            <label class="slider" for="editAllDayToggle"></label>
          </div>
          <label class="toggle-label" for="editAllDayToggle">All Day Event</label>
        </div>
        <input type="hidden" name="is_all_day" id="editIsAllDayInput" value="0">
        <div class="row">
          <div>
            <label id="editStartLabel">Start Date &amp; Time*</label>
            <input type="datetime-local" id="edit-local-start" required>
            <input type="hidden" name="dtstart" id="edit-iso-start">
          </div>
          <div>
            <label id="editEndLabel">End Date &amp; Time</label>
            <input type="datetime-local" id="edit-local-end">
            <input type="hidden" name="dtend" id="edit-iso-end">
          </div>
        </div>

        <div id="editTzRow">
          <label>Timezone Override</label>
          <select id="editTzSelect">
            <option value="+08:00" selected>Singapore Time (SGT / +08:00)</option>
            <option value="+00:00">Coordinated Universal Time (UTC)</option>
          </select>
        </div>

        <div>
          <label>Status</label>
          <select name="status" id="edit-status">
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="TENTATIVE">TENTATIVE</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>

        <div id="edit-more-details" style="display: none; border-top: 1px solid var(--border); padding-top: 12px; margin-top: 4px;">
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
          <div style="margin-top: 16px;">
            <label>Description</label>
            <textarea name="description" id="edit-description" rows="3"></textarea>
          </div>
        </div>

        <button type="button" id="editMoreBtn" style="background: transparent; border: 1px solid var(--border-strong); color: var(--text-secondary); margin-top: 0;">Show More Details</button>
        <button type="submit" id="editSubmitBtn">Save Changes</button>
      </form>
    </div>
  </div>

  <script src="/admin/admin.js" defer></script>
</body>
</html>`;
