// Admin dashboard client script.
// Extracted from src/templates/admin.html.ts so the page CSP can drop script-src 'unsafe-inline'.
// Behaviour is preserved verbatim from the inline version.

const CSRF_TOKEN = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
let VENUES = [];

async function initVenues() {
    try {
        const res = await fetch('/data/venues.json');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        VENUES = data.venues;
    } catch (e) {
        console.error('Failed to load venues:', e);
        VENUES = [];
    }

    const list = document.getElementById('ntu-venues');
    VENUES.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.name;
        list.appendChild(opt);
    });
    document.getElementById('locationInput').addEventListener('input', (e) => {
        const match = VENUES.find(v => v.name === e.target.value);
        if (match) document.getElementById('geoInput').value = match.geo;
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

let allEvents = [];
let currentPage = 1;
const EVENTS_PER_PAGE = 10;

async function loadEvents() {
    try {
        const res = await fetch('/api/events?_t=' + Date.now());
        allEvents = await res.json();
        currentPage = 1;
        renderEventsPage();
    } catch (err) { document.getElementById('events-container').textContent = 'Error loading events.'; }
}

function renderEventsPage() {
    const container = document.getElementById('events-container');
    if (allEvents.length === 0) {
        // Safe: static string with no user input.
        container.textContent = '';
        const p = document.createElement('p');
        p.textContent = 'No events scheduled.';
        container.appendChild(p);
        return;
    }

    const totalPages = Math.ceil(allEvents.length / EVENTS_PER_PAGE);
    const startIndex = (currentPage - 1) * EVENTS_PER_PAGE;
    const endIndex = startIndex + EVENTS_PER_PAGE;
    const pageEvents = allEvents.slice(startIndex, endIndex);

    const html = pageEvents.map(e => {
        const isAllDay = e.dtstart && !e.dtstart.includes('T');
        let displayDate;
        if (isAllDay) {
            const y = e.dtstart.slice(0,4), m = e.dtstart.slice(4,6), d = e.dtstart.slice(6,8);
            displayDate = new Date(y + '-' + m + '-' + d + 'T00:00:00+08:00').toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', year: 'numeric', month: 'long', day: 'numeric' });
        } else {
            const dt = e.dtstart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
            displayDate = new Date(dt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' });
        }
        return `
              <div class="event-card">
                <div class="event-info">
                  <strong>${escapeHtml(e.summary)}</strong> <span class="event-status">${escapeHtml(e.status)}</span>${isAllDay ? '<span class="all-day-badge">ALL DAY</span>' : ''}<br>
                  <small style="color: var(--text-tertiary); display: block; margin-top: 2px; font-size: 12px;">${isAllDay ? '' : 'Starts: '}${escapeHtml(displayDate)}</small>
                </div>
                <button class="btn-edit"
                  data-uid="${escapeHtml(e.uid)}"
                  data-summary="${escapeHtml(e.summary)}"
                  data-dtstart="${escapeHtml(e.dtstart)}"
                  data-dtend="${escapeHtml(e.dtend)}"
                  data-status="${escapeHtml(e.status)}"
                  data-location="${escapeHtml(e.location)}"
                  data-geo="${escapeHtml(e.geo)}"
                  data-description="${escapeHtml(e.description)}"
                >Edit</button>
                <form class="form-delete" data-uid="${escapeHtml(e.uid)}">
                  <input type="password" placeholder="Password" required class="del-pass">
                  <button type="submit" class="btn-delete">Delete</button>
                </form>
              </div>`;
    }).join('');

    const paginationHtml = totalPages > 1 ? `
      <div class="pagination-controls" style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
        <button data-page-delta="-1" ${currentPage === 1 ? 'disabled' : ''} style="width: auto; margin-top: 0; background: transparent; border: 1px solid var(--border-strong); color: ${currentPage === 1 ? 'var(--border-strong)' : 'var(--text-secondary)'}; padding: 6px 12px; font-size: 12px;">‹ Previous</button>
        <span style="color: var(--text-tertiary); font-size: 12px; font-weight: 500;">Page ${currentPage} of ${totalPages}</span>
        <button data-page-delta="1" ${currentPage === totalPages ? 'disabled' : ''} style="width: auto; margin-top: 0; background: transparent; border: 1px solid var(--border-strong); color: ${currentPage === totalPages ? 'var(--border-strong)' : 'var(--text-secondary)'}; padding: 6px 12px; font-size: 12px;">Next ›</button>
      </div>
    ` : '';

    // All user-provided values above pass through escapeHtml() so this assignment is safe.
    container.textContent = '';
    container.insertAdjacentHTML('beforeend', html + paginationHtml);

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

    container.querySelectorAll('.form-delete').forEach(form => {
        form.addEventListener('submit', (e) => {
            handleDelete(e, form.dataset.uid);
        });
    });

    // Attach pagination handlers (replaces inline onclick under strict CSP)
    container.querySelectorAll('[data-page-delta]').forEach(btn => {
        btn.addEventListener('click', () => {
            const delta = parseInt(btn.dataset.pageDelta, 10);
            changePage(delta);
        });
    });
}

function changePage(delta) {
    currentPage += delta;
    renderEventsPage();
}

// --- All-Day Toggle Logic (Create form) ---
document.getElementById('allDayToggle').addEventListener('change', function() {
    const isAllDay = this.checked;
    document.getElementById('isAllDayInput').value = isAllDay ? '1' : '0';
    const startInput = document.getElementById('localStart');
    const endInput = document.getElementById('localEnd');
    document.getElementById('startLabel').textContent = isAllDay ? 'Start Date*' : 'Start Date & Time (Local)*';
    document.getElementById('endLabel').textContent = isAllDay ? 'End Date' : 'End Date & Time (Local)';
    startInput.type = isAllDay ? 'date' : 'datetime-local';
    endInput.type = isAllDay ? 'date' : 'datetime-local';
    document.getElementById('tzRow').style.display = isAllDay ? 'none' : '';
    startInput.value = '';
    endInput.value = '';
});

// --- All-Day Toggle Logic (Edit modal) ---
document.getElementById('editAllDayToggle').addEventListener('change', function() {
    const isAllDay = this.checked;
    document.getElementById('editIsAllDayInput').value = isAllDay ? '1' : '0';
    const startInput = document.getElementById('edit-local-start');
    const endInput = document.getElementById('edit-local-end');
    document.getElementById('editStartLabel').textContent = isAllDay ? 'Start Date*' : 'Start Date & Time*';
    document.getElementById('editEndLabel').textContent = isAllDay ? 'End Date' : 'End Date & Time';
    startInput.type = isAllDay ? 'date' : 'datetime-local';
    endInput.type = isAllDay ? 'date' : 'datetime-local';
    document.getElementById('editTzRow').style.display = isAllDay ? 'none' : '';
    startInput.value = '';
    endInput.value = '';
});

document.getElementById('eventForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById('submitBtn');
    btn.innerText = "Publishing..."; btn.disabled = true;

    const isAllDay = document.getElementById('allDayToggle').checked;
    const start = document.getElementById('localStart').value;
    const end = document.getElementById('localEnd').value;

    if (isAllDay) {
        // For all-day, send date as-is (YYYY-MM-DD)
        if(start) document.getElementById('isoStart').value = start;
        if(end) document.getElementById('isoEnd').value = end;
    } else {
        const tz = document.getElementById('tzSelect').value;
        if(start) document.getElementById('isoStart').value = start + tz;
        if(end) document.getElementById('isoEnd').value = end + tz;
    }

    try {
        const res = await fetch('/admin', { method: 'POST', body: new FormData(form) });
        const data = await res.json();
        if (!data.success) alert("Error: " + data.error);
        else { alert("Success!"); form.reset(); document.getElementById('allDayToggle').checked = false; document.getElementById('isAllDayInput').value = '0'; document.getElementById('localStart').type = 'datetime-local'; document.getElementById('localEnd').type = 'datetime-local'; document.getElementById('tzRow').style.display = ''; document.getElementById('startLabel').textContent = 'Start Date & Time (Local)*'; document.getElementById('endLabel').textContent = 'End Date & Time (Local)'; loadEvents(); }
    } catch (err) { alert("Network Error"); }
    finally { btn.innerText = "Publish to Calendar Feed"; btn.disabled = false; }
});

async function handleDelete(e, uid) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button');
    btn.disabled = true;
    const formData = new FormData();
    formData.append("action", "delete");
    formData.append("_csrf", CSRF_TOKEN);
    formData.append("uid", uid);
    formData.append("password", form.querySelector('.del-pass').value);

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
    document.getElementById('editTzSelect').value = '+08:00';

    // Detect all-day: dtstart has no 'T'
    const isAllDay = dtstart && !dtstart.includes('T');
    document.getElementById('editAllDayToggle').checked = isAllDay;
    document.getElementById('editIsAllDayInput').value = isAllDay ? '1' : '0';
    const editStartInput = document.getElementById('edit-local-start');
    const editEndInput = document.getElementById('edit-local-end');
    editStartInput.type = isAllDay ? 'date' : 'datetime-local';
    editEndInput.type = isAllDay ? 'date' : 'datetime-local';
    document.getElementById('editStartLabel').textContent = isAllDay ? 'Start Date*' : 'Start Date & Time*';
    document.getElementById('editEndLabel').textContent = isAllDay ? 'End Date' : 'End Date & Time';
    document.getElementById('editTzRow').style.display = isAllDay ? 'none' : '';

    if (isAllDay) {
        // Convert YYYYMMDD to YYYY-MM-DD for date input
        function icsDateToInput(d) {
            if (!d) return '';
            return d.slice(0,4) + '-' + d.slice(4,6) + '-' + d.slice(6,8);
        }
        editStartInput.value = icsDateToInput(dtstart);
        editEndInput.value = icsDateToInput(dtend);
    } else {
        // Convert ICS date (e.g. 20260315T100000Z) to datetime-local format
        function icsToLocal(icsDate) {
            if (!icsDate) return '';
            const iso = icsDate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
            const d = new Date(iso);
            const offset = -480;
            const local = new Date(d.getTime() - offset * 60000);
            return local.toISOString().slice(0, 16);
        }
        editStartInput.value = icsToLocal(dtstart);
        editEndInput.value = icsToLocal(dtend);
    }

    document.getElementById('editModal').classList.add('open');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('open');
    document.getElementById('editForm').reset();
}

function toggleMoreDetails() {
    const div = document.getElementById('edit-more-details');
    const btn = document.getElementById('editMoreBtn');
    if (div.style.display === 'none') {
        div.style.display = 'block';
        btn.innerText = 'Hide More Details';
    } else {
        div.style.display = 'none';
        btn.innerText = 'Show More Details';
    }
}

async function handleEdit(e) {
    e.preventDefault();
    const btn = document.getElementById('editSubmitBtn');
    btn.innerText = 'Saving...'; btn.disabled = true;

    const isAllDay = document.getElementById('editAllDayToggle').checked;
    const start = document.getElementById('edit-local-start').value;
    const end = document.getElementById('edit-local-end').value;

    if (isAllDay) {
        document.getElementById('edit-iso-start').value = start || '';
        document.getElementById('edit-iso-end').value = end || '';
    } else {
        const tz = document.getElementById('editTzSelect').value;
        document.getElementById('edit-iso-start').value = start ? start + tz : '';
        document.getElementById('edit-iso-end').value = end ? end + tz : '';
    }

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
    const match = VENUES.find(v => v.name === e.target.value);
    if (match) document.getElementById('edit-geo').value = match.geo;
});

// Close modal on backdrop click
document.getElementById('editModal').addEventListener('click', function(e) {
    if (e.target === this) closeEditModal();
});

// Wire up handlers that were previously inline (replaces onclick/onsubmit for CSP 'self')
document.getElementById('modalCloseBtn').addEventListener('click', closeEditModal);
document.getElementById('editMoreBtn').addEventListener('click', toggleMoreDetails);
document.getElementById('editForm').addEventListener('submit', handleEdit);

initVenues();
loadEvents();
